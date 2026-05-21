#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, Env,
};

mod test;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanRecord {
    pub principal: i128,
    pub fee: i128,
    pub due_ledger: u32,
    pub repaid: bool,
    pub defaulted: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakeInfo {
    pub staked_amount: i128,
    pub pending_rewards: i128,
    pub share_bps: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    RegistryId,
    XlmToken,
    FlatFeeBps,
    LoanTermLedgers,
    Loan(Address),
    PoolBalance,
    TotalStaked,
    StakerBalance(Address),
    StakerRewards(Address), // Accumulated but not yet paid rewards
    RewardDebt(Address),
    AccRewardPerShare,
    TotalRewardPool,
    StakedPool,
    ReservedInterest,
    TimeDeposit(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TimeDepositRecord {
    pub amount: i128,
    pub deposited_at: u32,    // ledger sequence
    pub term_ledgers: u32,    // e.g., 518400 ≈ 30 days
    pub apy_bps: u32,         // fixed APY in basis points (e.g., 500 = 5%)
    pub projected_interest: i128,
}

#[contract]
pub struct LendingPool;

const MIN_TTL: u32 = 100_000;
const MAX_TTL: u32 = 6_312_000;
const REWARD_SCALE: i128 = 10_000_000; // 1e7 for precision
const LEDGERS_PER_YEAR: i128 = 6_307_200;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidFeeBps = 3,
    InvalidLoanTerm = 4,
    InvalidAmount = 5,
    PoolBalanceOverflow = 6,
    ActiveLoanExists = 7,
    NoCreditTier = 8,
    BorrowLimitExceeded = 9,
    InsufficientPoolLiquidity = 10,
    FeeOverflow = 11,
    DueLedgerOverflow = 12,
    LoanNotFound = 13,
    LoanAlreadyRepaid = 14,
    LoanDefaulted = 15,
    LoanOverdue = 16,
    RepaymentOverflow = 17,
    LoanNotOverdue = 18,
    InsufficientStake = 19,
    TimeDepositExists = 20,
    TimeDepositNotFound = 21,
    KycRequired = 22,
}

mod registry {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/credit_registry.wasm");
}

#[contractimpl]
impl LendingPool {
    pub fn initialize(
        env: Env,
        admin: Address,
        registry_id: Address,
        xlm_token: Address,
        flat_fee_bps: u32,
        loan_term_ledgers: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        if flat_fee_bps > 10_000 {
            panic_with_error!(&env, Error::InvalidFeeBps);
        }
        if loan_term_ledgers == 0 {
            panic_with_error!(&env, Error::InvalidLoanTerm);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RegistryId, &registry_id);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage()
            .instance()
            .set(&DataKey::FlatFeeBps, &flat_fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::LoanTermLedgers, &loan_term_ledgers);
        
        bump_instance_ttl(&env);
    }

    pub fn deposit(env: Env, amount: i128) {
        let admin = get_admin(&env);
        admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let xlm_token = get_xlm_token(&env);
        let client = token::Client::new(&env, &xlm_token);
        client.transfer(
            &admin,
            &env.current_contract_address(),
            &amount,
        );

        let balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        let new_balance = balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::PoolBalanceOverflow));
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &new_balance);
        bump_instance_ttl(&env);
    }

    pub fn borrow(env: Env, borrower: Address, amount: i128) {
        borrower.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let loan_key = DataKey::Loan(borrower.clone());
        if let Some(loan) = env.storage().persistent().get::<_, LoanRecord>(&loan_key) {
            if !loan.repaid && !loan.defaulted {
                panic_with_error!(&env, Error::ActiveLoanExists);
            }
        }

        let registry_id = get_registry_id(&env);
        let registry_client = registry::Client::new(&env, &registry_id);
        // Fail-Fast: Retrieve tier and limit in a single optimized inter-contract call
        let (tier, limit) = registry_client.get_active_tier_and_limit(&borrower);
        if tier < 1 || limit <= 0 {
            panic_with_error!(&env, Error::NoCreditTier);
        }
        if amount > limit {
            panic_with_error!(&env, Error::BorrowLimitExceeded);
        }

        // KYC enforcement: Silver (2), Gold (3), Platinum (4) require KYC
        if tier >= 2 {
            let kyc_verified = registry_client.get_kyc_verified(&borrower);
            if !kyc_verified {
                panic_with_error!(&env, Error::KycRequired);
            }
        }

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        if amount > balance {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }

        let flat_fee_bps = tier_fee_bps(read_flat_fee_bps(&env), tier);
        let fee = amount
            .checked_mul(flat_fee_bps as i128)
            .unwrap_or_else(|| panic_with_error!(&env, Error::FeeOverflow))
            / 10_000;
        let loan_term_ledgers = get_loan_term_ledgers(&env);
        let due_ledger = env
            .ledger()
            .sequence()
            .checked_add(loan_term_ledgers)
            .unwrap_or_else(|| panic_with_error!(&env, Error::DueLedgerOverflow));

        let loan = LoanRecord {
            principal: amount,
            fee,
            due_ledger,
            repaid: false,
            defaulted: false,
        };

        env.storage().persistent().set(&loan_key, &loan);
        env.storage()
            .persistent()
            .extend_ttl(&loan_key, MIN_TTL, MAX_TTL);
        balance -= amount;
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);
        bump_instance_ttl(&env);

        let xlm_token = get_xlm_token(&env);
        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&env.current_contract_address(), &borrower, &amount);

        env.events().publish(
            (symbol_short!("disburse"), borrower),
            (amount, fee, due_ledger),
        );
    }

    pub fn repay(env: Env, borrower: Address) {
        borrower.require_auth();

        let loan_key = DataKey::Loan(borrower.clone());
        let mut loan: LoanRecord = env
            .storage()
            .persistent()
            .get(&loan_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::LoanNotFound));

        if loan.repaid {
            panic_with_error!(&env, Error::LoanAlreadyRepaid);
        }
        if loan.defaulted {
            panic_with_error!(&env, Error::LoanDefaulted);
        }
        if env.ledger().sequence() > loan.due_ledger {
            panic_with_error!(&env, Error::LoanOverdue);
        }

        let total_owed = loan
            .principal
            .checked_add(loan.fee)
            .unwrap_or_else(|| panic_with_error!(&env, Error::RepaymentOverflow));

        // --- EFFECTS: update all state before any external call ---

        // 1. Mark loan repaid
        loan.repaid = true;
        env.storage().persistent().set(&loan_key, &loan);
        env.storage()
            .persistent()
            .extend_ttl(&loan_key, MIN_TTL, MAX_TTL);

        // 2. Distribute fees: 50% stays in pool, 50% to stakers if any
        let total_staked = get_total_staked(&env);
        let (staker_fee, pool_gain) = if total_staked > 0 {
            let s_fee = loan.fee / 2;
            (s_fee, total_owed - s_fee)
        } else {
            (0, total_owed)
        };

        if staker_fee > 0 {
            distribute_fee_to_stakers(&env, staker_fee);
        }

        // 3. Credit pool balance
        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        balance = balance
            .checked_add(pool_gain)
            .unwrap_or_else(|| panic_with_error!(&env, Error::PoolBalanceOverflow));
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);
        bump_instance_ttl(&env);

        // 4. Emit event
        env.events().publish(
            (symbol_short!("repaid"), borrower.clone()),
            (total_owed, env.ledger().timestamp()),
        );

        // --- INTERACTION: external token transfer happens last ---
        let xlm_token = get_xlm_token(&env);
        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(
            &borrower,
            &env.current_contract_address(),
            &total_owed,
        );
    }

    pub fn mark_default(env: Env, borrower: Address) {
        let admin = get_admin(&env);
        admin.require_auth();

        let loan_key = DataKey::Loan(borrower.clone());
        let mut loan: LoanRecord = env
            .storage()
            .persistent()
            .get(&loan_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::LoanNotFound));

        if loan.repaid {
            panic_with_error!(&env, Error::LoanAlreadyRepaid);
        }
        if loan.defaulted {
            panic_with_error!(&env, Error::LoanDefaulted);
        }
        if env.ledger().sequence() <= loan.due_ledger {
            panic_with_error!(&env, Error::LoanNotOverdue);
        }

        loan.defaulted = true;
        env.storage().persistent().set(&loan_key, &loan);
        env.storage()
            .persistent()
            .extend_ttl(&loan_key, MIN_TTL, MAX_TTL);

        env.events()
            .publish((symbol_short!("defaulted"), borrower), loan.principal);
        bump_instance_ttl(&env);
    }

    pub fn get_loan(env: Env, borrower: Address) -> Option<LoanRecord> {
        let key = DataKey::Loan(borrower);
        let loan = env.storage().persistent().get(&key);
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, MIN_TTL, MAX_TTL);
        }
        bump_instance_ttl(&env);
        loan
    }

    pub fn get_pool_balance(env: Env) -> i128 {
        bump_instance_ttl(&env);
        env.storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0)
    }

    pub fn get_total_staked(env: Env) -> i128 {
        bump_instance_ttl(&env);
        get_total_staked(&env)
    }

    pub fn get_total_reward_pool(env: Env) -> i128 {
        bump_instance_ttl(&env);
        get_total_reward_pool(&env)
    }

    pub fn get_flat_fee_bps(env: Env) -> u32 {
        bump_instance_ttl(&env);
        read_flat_fee_bps(&env)
    }

    pub fn admin_withdraw(env: Env, amount: i128) {
        let admin = get_admin(&env);
        admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        if amount > balance {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }

        let xlm_token = get_xlm_token(&env);
        let token_client = token::Client::new(&env, &xlm_token);
        let contract_balance = token_client.balance(&env.current_contract_address());
        let protected = get_staked_pool(&env) + get_reserved_interest(&env);

        if contract_balance - amount < protected {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }

        balance -= amount;
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);
        bump_instance_ttl(&env);

        token_client.transfer(&env.current_contract_address(), &admin, &amount);
    }

    pub fn stake(env: Env, staker: Address, amount: i128) {
        staker.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        update_staker_rewards(&env, &staker);

        let xlm_token = get_xlm_token(&env);
        let client = token::Client::new(&env, &xlm_token);
        client.transfer(
            &staker,
            &env.current_contract_address(),
            &amount,
        );

        // Reuse key construction
        let staker_balance_key = DataKey::StakerBalance(staker.clone());
        let mut staker_balance = env.storage().persistent().get(&staker_balance_key).unwrap_or(0);
        staker_balance += amount;
        env.storage().persistent().set(&staker_balance_key, &staker_balance);
        env.storage().persistent().extend_ttl(&staker_balance_key, MIN_TTL, MAX_TTL);

        let mut total_staked = get_total_staked(&env);
        total_staked += amount;
        env.storage().instance().set(&DataKey::TotalStaked, &total_staked);

        let mut staked_pool = get_staked_pool(&env);
        staked_pool += amount;
        env.storage().instance().set(&DataKey::StakedPool, &staked_pool);

        update_reward_debt(&env, &staker, staker_balance);

        env.events().publish((symbol_short!("stake"), staker), amount);
        bump_instance_ttl(&env);
    }

    pub fn unstake(env: Env, staker: Address, amount: i128) {
        staker.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        // Assertion from Bug #1 Option B: Ensure contract has enough physical SAC to cover stakers
        let xlm_token = get_xlm_token(&env);
        let token_client = token::Client::new(&env, &xlm_token);
        let contract_balance = token_client.balance(&env.current_contract_address());
        let staked_pool = get_staked_pool(&env);
        if contract_balance < staked_pool {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }

        // Reuse key construction
        let staker_balance_key = DataKey::StakerBalance(staker.clone());
        let mut staker_balance = env.storage().persistent().get(&staker_balance_key).unwrap_or(0);
        if amount > staker_balance {
            panic_with_error!(&env, Error::InsufficientStake);
        }

        update_staker_rewards(&env, &staker);

        // Claim rewards during unstake
        let rewards = get_staker_rewards(&env, &staker);
        if rewards > 0 {
            env.storage().persistent().set(&DataKey::StakerRewards(staker.clone()), &0i128);
            env.storage().persistent().extend_ttl(&DataKey::StakerRewards(staker.clone()), MIN_TTL, MAX_TTL);
            let mut total_reward_pool = get_total_reward_pool(&env);
            total_reward_pool -= rewards;
            env.storage().instance().set(&DataKey::TotalRewardPool, &total_reward_pool);

            let mut sp = get_staked_pool(&env);
            sp -= rewards;
            env.storage().instance().set(&DataKey::StakedPool, &sp);
        }

        staker_balance -= amount;
        env.storage().persistent().set(&staker_balance_key, &staker_balance);
        env.storage().persistent().extend_ttl(&staker_balance_key, MIN_TTL, MAX_TTL);
        
        let mut total_staked = get_total_staked(&env);
        total_staked -= amount;
        env.storage().instance().set(&DataKey::TotalStaked, &total_staked);

        let mut sp = get_staked_pool(&env);
        sp -= amount;
        env.storage().instance().set(&DataKey::StakedPool, &sp);

        update_reward_debt(&env, &staker, staker_balance);

        let total_to_send = amount + rewards;
        token_client.transfer(&env.current_contract_address(), &staker, &total_to_send);

        env.events().publish((symbol_short!("unstake"), staker), (amount, rewards));
        bump_instance_ttl(&env);
    }

    pub fn get_stake_info(env: Env, staker: Address) -> StakeInfo {
        let staker_balance = get_staker_balance(&env, &staker);
        let total_staked = get_total_staked(&env);
        
        let acc_reward_per_share = get_acc_reward_per_share(&env);
        let reward_debt = get_reward_debt(&env, &staker);
        let pending = ((staker_balance * acc_reward_per_share) / REWARD_SCALE)
            .saturating_sub(reward_debt);
        let total_pending = get_staker_rewards(&env, &staker) + pending;

        let share_bps = if total_staked > 0 {
            ((staker_balance * 10_000) / total_staked) as u32
        } else {
            0
        };

        bump_instance_ttl(&env);

        StakeInfo {
            staked_amount: staker_balance,
            pending_rewards: total_pending,
            share_bps,
        }
    }

    pub fn time_deposit(env: Env, depositor: Address, amount: i128, term_ledgers: u32) {
        depositor.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let key = DataKey::TimeDeposit(depositor.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::TimeDepositExists);
        }

        let apy_bps = if term_ledgers >= 1_036_800 {
            // 60 days
            800
        } else {
            500
        };

        // Projected interest at maturity (Cached optimization)
        let projected_interest = (amount * apy_bps as i128 * term_ledgers as i128)
            / (10_000 * LEDGERS_PER_YEAR);

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        
        if balance < projected_interest {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }
        balance -= projected_interest;

        let xlm_token = get_xlm_token(&env);
        let client = token::Client::new(&env, &xlm_token);
        client.transfer(
            &depositor,
            &env.current_contract_address(),
            &amount,
        );

        balance = balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::PoolBalanceOverflow));
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);

        let mut reserved = get_reserved_interest(&env);
        reserved += projected_interest;
        env.storage().instance().set(&DataKey::ReservedInterest, &reserved);

        let record = TimeDepositRecord {
            amount,
            deposited_at: env.ledger().sequence(),
            term_ledgers,
            apy_bps,
            projected_interest,
        };

        env.storage().persistent().set(&key, &record);
        env.storage()
            .persistent()
            .extend_ttl(&key, MIN_TTL, MAX_TTL);

        env.events().publish(
            (symbol_short!("tdeposit"), depositor),
            (amount, term_ledgers, apy_bps),
        );
        bump_instance_ttl(&env);
    }

    pub fn withdraw_time_deposit(env: Env, depositor: Address) {
        depositor.require_auth();

        let key = DataKey::TimeDeposit(depositor.clone());
        let record: TimeDepositRecord = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::TimeDepositNotFound));

        let current_ledger = env.ledger().sequence();
        let matured = current_ledger >= record.deposited_at + record.term_ledgers;

        let projected_interest = record.projected_interest;

        let actual_interest = if matured {
            let ledgers_elapsed = (current_ledger - record.deposited_at) as i128;
            let uncapped = (record.amount * record.apy_bps as i128 * ledgers_elapsed)
                / (10_000 * LEDGERS_PER_YEAR);
            core::cmp::min(uncapped, projected_interest)
        } else {
            0
        };

        // Early withdrawal penalty: 1% of principal if not matured
        let penalty = if !matured {
            record.amount / 100
        } else {
            0
        };

        let total_payout = record.amount + actual_interest - penalty;

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        
        if record.amount > balance {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }
        balance -= record.amount;

        // Return unused reserved interest to PoolBalance
        if projected_interest > actual_interest {
            balance += projected_interest - actual_interest;
        }

        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);

        let mut reserved = get_reserved_interest(&env);
        reserved -= projected_interest;
        env.storage().instance().set(&DataKey::ReservedInterest, &reserved);

        env.storage().persistent().remove(&key);

        let xlm_token = get_xlm_token(&env);
        let client = token::Client::new(&env, &xlm_token);
        client.transfer(&env.current_contract_address(), &depositor, &total_payout);

        env.events()
            .publish((symbol_short!("twithdraw"), depositor), (record.amount, actual_interest, penalty));
        bump_instance_ttl(&env);
    }

    pub fn get_time_deposit(env: Env, depositor: Address) -> Option<TimeDepositRecord> {
        let key = DataKey::TimeDeposit(depositor);
        let record = env.storage().persistent().get(&key);
        bump_instance_ttl(&env);
        record
    }
}

fn get_instance_value<
    T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
>(
    env: &Env,
    key: &DataKey,
) -> T {
    env.storage()
        .instance()
        .get(key)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn get_admin(env: &Env) -> Address {
    get_instance_value(env, &DataKey::Admin)
}

fn get_registry_id(env: &Env) -> Address {
    get_instance_value(env, &DataKey::RegistryId)
}

fn get_xlm_token(env: &Env) -> Address {
    get_instance_value(env, &DataKey::XlmToken)
}

fn read_flat_fee_bps(env: &Env) -> u32 {
    get_instance_value(env, &DataKey::FlatFeeBps)
}

fn get_loan_term_ledgers(env: &Env) -> u32 {
    get_instance_value(env, &DataKey::LoanTermLedgers)
}

fn tier_fee_bps(base_fee_bps: u32, tier: u32) -> u32 {
    match tier {
        4 => base_fee_bps.saturating_sub(450), // 50 bps = 0.5%
        3 => base_fee_bps.saturating_sub(350),
        2 => base_fee_bps.saturating_sub(200),
        _ => base_fee_bps,
    }
}

fn bump_instance_ttl(env: &Env) {
    env.storage().instance().extend_ttl(MIN_TTL, MAX_TTL);
}

fn get_total_staked(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalStaked).unwrap_or(0)
}

fn get_staker_balance(env: &Env, staker: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::StakerBalance(staker.clone())).unwrap_or(0)
}

fn get_staker_rewards(env: &Env, staker: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::StakerRewards(staker.clone())).unwrap_or(0)
}

fn get_reward_debt(env: &Env, staker: &Address) -> i128 {
    env.storage().persistent().get(&DataKey::RewardDebt(staker.clone())).unwrap_or(0)
}

fn get_acc_reward_per_share(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::AccRewardPerShare).unwrap_or(0)
}

fn get_total_reward_pool(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalRewardPool).unwrap_or(0)
}

fn get_staked_pool(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::StakedPool).unwrap_or(0)
}

fn get_reserved_interest(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::ReservedInterest).unwrap_or(0)
}

fn update_staker_rewards(env: &Env, staker: &Address) {
    let balance = get_staker_balance(env, staker);
    if balance > 0 {
        let acc_reward_per_share = get_acc_reward_per_share(env);
        let reward_debt = get_reward_debt(env, staker);
        let pending = ((balance * acc_reward_per_share) / REWARD_SCALE)
            .saturating_sub(reward_debt);
        if pending > 0 {
            let mut rewards = get_staker_rewards(env, staker);
            rewards += pending;
            env.storage().persistent().set(&DataKey::StakerRewards(staker.clone()), &rewards);
            env.storage().persistent().extend_ttl(&DataKey::StakerRewards(staker.clone()), MIN_TTL, MAX_TTL);
        }
    }
}

fn update_reward_debt(env: &Env, staker: &Address, balance: i128) {
    let acc_reward_per_share = get_acc_reward_per_share(env);
    let reward_debt = (balance * acc_reward_per_share) / REWARD_SCALE;
    env.storage().persistent().set(&DataKey::RewardDebt(staker.clone()), &reward_debt);
    env.storage().persistent().extend_ttl(&DataKey::RewardDebt(staker.clone()), MIN_TTL, MAX_TTL);
}

fn distribute_fee_to_stakers(env: &Env, amount: i128) {
    let total_staked = get_total_staked(env);
    if total_staked > 0 {
        let mut acc_reward_per_share = get_acc_reward_per_share(env);
        acc_reward_per_share += (amount * REWARD_SCALE) / total_staked;
        env.storage().instance().set(&DataKey::AccRewardPerShare, &acc_reward_per_share);
        
        let mut total_reward_pool = get_total_reward_pool(env);
        total_reward_pool += amount;
        env.storage().instance().set(&DataKey::TotalRewardPool, &total_reward_pool);

        let mut staked_pool = get_staked_pool(env);
        staked_pool += amount;
        env.storage().instance().set(&DataKey::StakedPool, &staked_pool);
    }
}

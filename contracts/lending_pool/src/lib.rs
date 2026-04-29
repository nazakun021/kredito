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

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    RegistryId,
    TokenId,
    FlatFeeBps,
    LoanTermLedgers,
    Loan(Address),
    PoolBalance,
}

#[contract]
pub struct LendingPool;

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
        phpc_token: Address,
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
        env.storage().instance().set(&DataKey::TokenId, &phpc_token);
        env.storage()
            .instance()
            .set(&DataKey::FlatFeeBps, &flat_fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::LoanTermLedgers, &loan_term_ledgers);
        env.storage().instance().set(&DataKey::PoolBalance, &0i128);
    }

    pub fn deposit(env: Env, amount: i128) {
        let admin = get_admin(&env);
        admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let token_id = get_token_id(&env);
        let client = token::TokenClient::new(&env, &token_id);
        // transfer_from(spender, from, to, amount)
        client.transfer_from(
            &env.current_contract_address(),
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
        let tier = registry_client.get_tier(&borrower);
        if tier < 1 {
            panic_with_error!(&env, Error::NoCreditTier);
        }

        let limit = registry_client.get_tier_limit(&tier);
        if amount > limit {
            panic_with_error!(&env, Error::BorrowLimitExceeded);
        }

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        if amount > balance {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }

        let flat_fee_bps = tier_fee_bps(get_flat_fee_bps(&env), tier);
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
        balance -= amount;
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);

        let token_id = get_token_id(&env);
        let token_client = token::TokenClient::new(&env, &token_id);
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
        let token_id = get_token_id(&env);
        let token_client = token::TokenClient::new(&env, &token_id);
        // transfer_from(spender, from, to, amount)
        token_client.transfer_from(
            &env.current_contract_address(),
            &borrower,
            &env.current_contract_address(),
            &total_owed,
        );

        loan.repaid = true;
        env.storage().persistent().set(&loan_key, &loan);

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        balance = balance
            .checked_add(total_owed)
            .unwrap_or_else(|| panic_with_error!(&env, Error::PoolBalanceOverflow));
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);

        env.events().publish(
            (symbol_short!("repaid"), borrower),
            (total_owed, env.ledger().timestamp()),
        );
    }

    pub fn mark_default(env: Env, borrower: Address) {
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

        env.events()
            .publish((symbol_short!("defaulted"), borrower), loan.principal);
    }

    pub fn get_loan(env: Env, borrower: Address) -> Option<LoanRecord> {
        env.storage().persistent().get(&DataKey::Loan(borrower))
    }

    pub fn get_pool_balance(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0)
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

fn get_token_id(env: &Env) -> Address {
    get_instance_value(env, &DataKey::TokenId)
}

fn get_flat_fee_bps(env: &Env) -> u32 {
    get_instance_value(env, &DataKey::FlatFeeBps)
}

fn get_loan_term_ledgers(env: &Env) -> u32 {
    get_instance_value(env, &DataKey::LoanTermLedgers)
}

fn tier_fee_bps(base_fee_bps: u32, tier: u32) -> u32 {
    match tier {
        3 => base_fee_bps.saturating_sub(350),
        2 => base_fee_bps.saturating_sub(200),
        _ => base_fee_bps,
    }
}

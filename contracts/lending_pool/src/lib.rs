#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env,
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
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RegistryId, &registry_id);
        env.storage().instance().set(&DataKey::TokenId, &phpc_token);
        env.storage().instance().set(&DataKey::FlatFeeBps, &flat_fee_bps);
        env.storage().instance().set(&DataKey::LoanTermLedgers, &loan_term_ledgers);
        env.storage().instance().set(&DataKey::PoolBalance, &0i128);
    }

    pub fn deposit(env: Env, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let client = token::TokenClient::new(&env, &token_id);
        // transfer_from(spender, from, to, amount)
        client.transfer_from(&env.current_contract_address(), &admin, &env.current_contract_address(), &amount);

        let balance: i128 = env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0);
        env.storage().instance().set(&DataKey::PoolBalance, &(balance + amount));
    }

    pub fn borrow(env: Env, borrower: Address, amount: i128) {
        borrower.require_auth();

        let loan_key = DataKey::Loan(borrower.clone());
        if let Some(loan) = env.storage().persistent().get::<_, LoanRecord>(&loan_key) {
            if !loan.repaid && !loan.defaulted {
                panic!("Active loan already exists");
            }
        }

        let registry_id: Address = env.storage().instance().get(&DataKey::RegistryId).unwrap();
        let registry_client = registry::Client::new(&env, &registry_id);
        let tier = registry_client.get_tier(&borrower);
        if tier < 1 {
            panic!("No credit tier — apply for a score first");
        }

        let limit = registry_client.get_tier_limit(&tier);
        if amount > limit {
            panic!("Amount exceeds tier borrow limit");
        }

        let mut balance: i128 = env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0);
        if amount > balance {
            panic!("Insufficient pool liquidity");
        }

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let flat_fee_bps: u32 = env.storage().instance().get(&DataKey::FlatFeeBps).unwrap();
        let fee = (amount * flat_fee_bps as i128) / 10_000;
        let loan_term_ledgers: u32 = env.storage().instance().get(&DataKey::LoanTermLedgers).unwrap();
        let due_ledger = env.ledger().sequence() + loan_term_ledgers;

        let loan = LoanRecord {
            principal: amount,
            fee,
            due_ledger,
            repaid: false,
            defaulted: false,
        };

        env.storage().persistent().set(&loan_key, &loan);
        balance -= amount;
        env.storage().instance().set(&DataKey::PoolBalance, &balance);

        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
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
        let mut loan: LoanRecord = env.storage().persistent().get(&loan_key).expect("No loan found");

        if loan.repaid {
            panic!("Loan already repaid");
        }
        if loan.defaulted {
            panic!("Loan has defaulted — contact support");
        }
        if env.ledger().sequence() > loan.due_ledger {
            panic!("Loan overdue — call mark_default first");
        }

        let total_owed = loan.principal + loan.fee;
        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let token_client = token::TokenClient::new(&env, &token_id);
        // transfer_from(spender, from, to, amount)
        token_client.transfer_from(&env.current_contract_address(), &borrower, &env.current_contract_address(), &total_owed);

        loan.repaid = true;
        env.storage().persistent().set(&loan_key, &loan);

        let mut balance: i128 = env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0);
        balance += total_owed;
        env.storage().instance().set(&DataKey::PoolBalance, &balance);

        env.events().publish(
            (symbol_short!("repaid"), borrower),
            (total_owed, env.ledger().timestamp()),
        );
    }

    pub fn mark_default(env: Env, borrower: Address) {
        let loan_key = DataKey::Loan(borrower.clone());
        let mut loan: LoanRecord = env.storage().persistent().get(&loan_key).expect("No loan found");

        if loan.repaid {
            panic!("Loan already repaid");
        }
        if loan.defaulted {
            panic!("Loan already marked as defaulted");
        }
        if env.ledger().sequence() <= loan.due_ledger {
            panic!("Loan not yet overdue");
        }

        loan.defaulted = true;
        env.storage().persistent().set(&loan_key, &loan);

        env.events().publish(
            (symbol_short!("defaulted"), borrower),
            loan.principal,
        );
    }

    pub fn get_loan(env: Env, borrower: Address) -> Option<LoanRecord> {
        env.storage().persistent().get(&DataKey::Loan(borrower))
    }

    pub fn get_pool_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::PoolBalance).unwrap_or(0)
    }
}

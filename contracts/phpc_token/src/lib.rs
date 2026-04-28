#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String,
};

mod test;

#[derive(Clone)]
#[contracttype]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address),
    Name,
    Symbol,
    Decimals,
}

#[contract]
pub struct Token;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidDecimals = 3,
    InvalidAmount = 4,
    BalanceOverflow = 5,
    InvalidAllowanceAmount = 6,
    InvalidAllowanceExpiration = 7,
    InsufficientBalance = 8,
    InsufficientAllowance = 9,
}

#[contractimpl]
impl Token {
    pub fn initialize(env: Env, admin: Address, decimal: u32, name: String, symbol: String) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        if decimal > 18 {
            panic_with_error!(&env, Error::InvalidDecimals);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Decimals, &decimal);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin = get_admin(&env);
        admin.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let key = DataKey::Balance(to.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_balance = balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::BalanceOverflow));
        env.storage().persistent().set(&key, &new_balance);

        env.events().publish((symbol_short!("mint"), to), amount);
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(from, spender);
        read_allowance(&env, &key).amount
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        from.require_auth();
        if amount < 0 {
            panic_with_error!(&env, Error::InvalidAllowanceAmount);
        }
        if amount > 0 && expiration_ledger < env.ledger().sequence() {
            panic_with_error!(&env, Error::InvalidAllowanceExpiration);
        }
        let key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance = AllowanceValue {
            amount,
            expiration_ledger,
        };
        env.storage().persistent().set(&key, &allowance);
        env.events()
            .publish((symbol_short!("approve"), from, spender), amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        let key = DataKey::Balance(id);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if from == to {
            return;
        }

        let from_key = DataKey::Balance(from.clone());
        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        let new_to_balance = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::BalanceOverflow));

        env.storage()
            .persistent()
            .set(&from_key, &(from_balance - amount));
        env.storage().persistent().set(&to_key, &new_to_balance);

        env.events()
            .publish((symbol_short!("transfer"), from, to), amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance = read_allowance(&env, &allowance_key);
        if allowance.amount < amount {
            panic_with_error!(&env, Error::InsufficientAllowance);
        }
        let remaining_allowance = allowance.amount - amount;

        if from == to {
            write_allowance(
                &env,
                &allowance_key,
                remaining_allowance,
                allowance.expiration_ledger,
            );
            return;
        }

        let from_key = DataKey::Balance(from.clone());
        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        let new_to_balance = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::BalanceOverflow));

        write_allowance(
            &env,
            &allowance_key,
            remaining_allowance,
            allowance.expiration_ledger,
        );
        env.storage()
            .persistent()
            .set(&from_key, &(from_balance - amount));
        env.storage().persistent().set(&to_key, &new_to_balance);

        env.events()
            .publish((symbol_short!("transfer"), from, to), amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        env.storage().persistent().set(&key, &(balance - amount));
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance = read_allowance(&env, &allowance_key);
        if allowance.amount < amount {
            panic_with_error!(&env, Error::InsufficientAllowance);
        }

        let from_key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        write_allowance(
            &env,
            &allowance_key,
            allowance.amount - amount,
            allowance.expiration_ledger,
        );
        env.storage()
            .persistent()
            .set(&from_key, &(balance - amount));
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or(7)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }
}

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn read_allowance(env: &Env, key: &DataKey) -> AllowanceValue {
    let allowance = env
        .storage()
        .persistent()
        .get::<_, AllowanceValue>(key)
        .unwrap_or(AllowanceValue {
            amount: 0,
            expiration_ledger: 0,
        });

    if allowance.amount > 0 && env.ledger().sequence() > allowance.expiration_ledger {
        return AllowanceValue {
            amount: 0,
            expiration_ledger: 0,
        };
    }

    allowance
}

fn write_allowance(env: &Env, key: &DataKey, amount: i128, expiration_ledger: u32) {
    let allowance = AllowanceValue {
        amount,
        expiration_ledger: if amount == 0 { 0 } else { expiration_ledger },
    };
    env.storage().persistent().set(key, &allowance);
}

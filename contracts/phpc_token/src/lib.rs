#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

mod test;

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

#[contractimpl]
impl Token {
    pub fn initialize(env: Env, admin: Address, decimal: u32, name: String, symbol: String) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Decimals, &decimal);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        if amount < 0 {
            panic!("negative amount is not allowed");
        }

        let key = DataKey::Balance(to.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(balance + amount));

        env.events().publish((symbol_short!("mint"), to), amount);
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(from, spender);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, _expiration_ledger: u32) {
        from.require_auth();
        if amount < 0 {
            panic!("negative amount is not allowed");
        }
        let key = DataKey::Allowance(from.clone(), spender.clone());
        env.storage().persistent().set(&key, &amount);
        env.events().publish((symbol_short!("approve"), from, spender), amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        let key = DataKey::Balance(id);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount < 0 {
            panic!("negative amount is not allowed");
        }
        if from == to {
            return;
        }

        let from_key = DataKey::Balance(from.clone());
        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic!("insufficient balance");
        }

        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);

        env.storage().persistent().set(&from_key, &(from_balance - amount));
        env.storage().persistent().set(&to_key, &(to_balance + amount));

        env.events().publish((symbol_short!("transfer"), from, to), amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount < 0 {
            panic!("negative amount is not allowed");
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance: i128 = env.storage().persistent().get(&allowance_key).unwrap_or(0);
        if allowance < amount {
            panic!("insufficient allowance");
        }

        if from == to {
            env.storage().persistent().set(&allowance_key, &(allowance - amount));
            return;
        }

        let from_key = DataKey::Balance(from.clone());
        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic!("insufficient balance");
        }

        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);

        env.storage().persistent().set(&allowance_key, &(allowance - amount));
        env.storage().persistent().set(&from_key, &(from_balance - amount));
        env.storage().persistent().set(&to_key, &(to_balance + amount));

        env.events().publish((symbol_short!("transfer"), from, to), amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount < 0 {
            panic!("negative amount is not allowed");
        }

        let key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if balance < amount {
            panic!("insufficient balance");
        }

        env.storage().persistent().set(&key, &(balance - amount));
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        if amount < 0 {
            panic!("negative amount is not allowed");
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance: i128 = env.storage().persistent().get(&allowance_key).unwrap_or(0);
        if allowance < amount {
            panic!("insufficient allowance");
        }

        let from_key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if balance < amount {
            panic!("insufficient balance");
        }

        env.storage().persistent().set(&allowance_key, &(allowance - amount));
        env.storage().persistent().set(&from_key, &(balance - amount));
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap_or(7)
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).expect("not initialized")
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).expect("not initialized")
    }
}

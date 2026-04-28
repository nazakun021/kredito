#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

mod test;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Issuer,
    Tier1Limit,
    Tier2Limit,
    CreditTier(Address),
    TierTimestamp(Address),
}

#[contract]
pub struct CreditRegistry;

#[contractimpl]
impl CreditRegistry {
    pub fn initialize(env: Env, issuer: Address, tier1_limit: i128, tier2_limit: i128) {
        if env.storage().instance().has(&DataKey::Issuer) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Issuer, &issuer);
        env.storage().instance().set(&DataKey::Tier1Limit, &tier1_limit);
        env.storage().instance().set(&DataKey::Tier2Limit, &tier2_limit);
    }

    pub fn set_tier(env: Env, wallet: Address, tier: u32) {
        let issuer: Address = env.storage().instance().get(&DataKey::Issuer).unwrap();
        issuer.require_auth();

        if tier > 2 {
            panic!("invalid tier");
        }

        env.storage().persistent().set(&DataKey::CreditTier(wallet.clone()), &tier);
        env.storage().persistent().set(&DataKey::TierTimestamp(wallet.clone()), &env.ledger().timestamp());

        env.events().publish(
            (symbol_short!("tier_set"), wallet),
            (tier, env.ledger().timestamp()),
        );
    }

    pub fn revoke_tier(env: Env, wallet: Address) {
        let issuer: Address = env.storage().instance().get(&DataKey::Issuer).unwrap();
        issuer.require_auth();

        env.storage().persistent().set(&DataKey::CreditTier(wallet.clone()), &0u32);
        env.events().publish(
            (symbol_short!("revoked"), wallet),
            env.ledger().timestamp(),
        );
    }

    pub fn get_tier(env: Env, wallet: Address) -> u32 {
        env.storage().persistent().get(&DataKey::CreditTier(wallet)).unwrap_or(0)
    }

    pub fn get_tier_limit(env: Env, tier: u32) -> i128 {
        match tier {
            1 => env.storage().instance().get(&DataKey::Tier1Limit).unwrap_or(0),
            2 => env.storage().instance().get(&DataKey::Tier2Limit).unwrap_or(0),
            _ => 0,
        }
    }

    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
        panic!("SBT: non-transferable by design");
    }

    pub fn transfer_from(_env: Env, _spender: Address, _from: Address, _to: Address, _amount: i128) {
        panic!("SBT: non-transferable by design");
    }
}

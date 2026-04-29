#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env,
};

mod test;

const BRONZE_MIN_SCORE: u32 = 40;
const SILVER_MIN_SCORE: u32 = 80;
const GOLD_MIN_SCORE: u32 = 120;
const MAX_AVG_BALANCE_FACTOR: u32 = 10;
const AVG_BALANCE_STEP: u32 = 100;
const DEFAULT_PENALTY: u32 = 25;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Metrics {
    pub tx_count: u32,
    pub repayment_count: u32,
    pub avg_balance: u32,
    pub default_count: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Issuer,
    Tier1Limit,
    Tier2Limit,
    Tier3Limit,
    Metrics(Address),
    Score(Address),
    CreditTier(Address),
    TierTimestamp(Address),
}

#[contract]
pub struct CreditRegistry;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidTierLimits = 3,
    TierOrderInvalid = 4,
    InvalidTier = 5,
    NonTransferable = 6,
}

#[contractimpl]
impl CreditRegistry {
    pub fn initialize(
        env: Env,
        issuer: Address,
        tier1_limit: i128,
        tier2_limit: i128,
        tier3_limit: i128,
    ) {
        if env.storage().instance().has(&DataKey::Issuer) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        issuer.require_auth();
        if tier1_limit <= 0 || tier2_limit <= 0 || tier3_limit <= 0 {
            panic_with_error!(&env, Error::InvalidTierLimits);
        }
        if tier2_limit < tier1_limit || tier3_limit < tier2_limit {
            panic_with_error!(&env, Error::TierOrderInvalid);
        }
        env.storage().instance().set(&DataKey::Issuer, &issuer);
        env.storage()
            .instance()
            .set(&DataKey::Tier1Limit, &tier1_limit);
        env.storage()
            .instance()
            .set(&DataKey::Tier2Limit, &tier2_limit);
        env.storage()
            .instance()
            .set(&DataKey::Tier3Limit, &tier3_limit);
    }

    pub fn update_metrics(env: Env, wallet: Address, metrics: Metrics) -> u32 {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        let score = Self::compute_score(env.clone(), metrics.clone());
        let tier = score_to_tier(score);
        store_credit_state(&env, wallet.clone(), metrics, score, tier);
        score
    }

    pub fn update_metrics_raw(
        env: Env,
        wallet: Address,
        tx_count: u32,
        repayment_count: u32,
        avg_balance: u32,
        default_count: u32,
    ) -> u32 {
        Self::update_metrics(
            env,
            wallet,
            Metrics {
                tx_count,
                repayment_count,
                avg_balance,
                default_count,
            },
        )
    }

    pub fn update_score(env: Env, wallet: Address) -> u32 {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        let metrics = Self::get_metrics(env.clone(), wallet.clone());
        let score = Self::compute_score(env.clone(), metrics.clone());
        let tier = score_to_tier(score);
        store_credit_state(&env, wallet, metrics, score, tier);
        score
    }

    pub fn set_tier(env: Env, wallet: Address, tier: u32) {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        if !(1..=3).contains(&tier) {
            panic_with_error!(&env, Error::InvalidTier);
        }

        let score = match tier {
            1 => BRONZE_MIN_SCORE,
            2 => SILVER_MIN_SCORE,
            _ => GOLD_MIN_SCORE,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Score(wallet.clone()), &score);
        env.storage()
            .persistent()
            .set(&DataKey::CreditTier(wallet.clone()), &tier);
        env.storage().persistent().set(
            &DataKey::TierTimestamp(wallet.clone()),
            &env.ledger().timestamp(),
        );
    }

    pub fn revoke_tier(env: Env, wallet: Address) {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::CreditTier(wallet.clone()), &0u32);
        env.storage()
            .persistent()
            .set(&DataKey::Score(wallet.clone()), &0u32);
        env.storage()
            .persistent()
            .remove(&DataKey::TierTimestamp(wallet.clone()));
        env.events()
            .publish((symbol_short!("revoked"), wallet), env.ledger().timestamp());
    }

    pub fn compute_score(_env: Env, metrics: Metrics) -> u32 {
        let avg_balance_factor = core::cmp::min(
            metrics.avg_balance / AVG_BALANCE_STEP,
            MAX_AVG_BALANCE_FACTOR,
        );
        let base_score = metrics
            .tx_count
            .saturating_mul(2)
            .saturating_add(metrics.repayment_count.saturating_mul(10))
            .saturating_add(avg_balance_factor.saturating_mul(5));
        let penalty = metrics.default_count.saturating_mul(DEFAULT_PENALTY);
        base_score.saturating_sub(penalty)
    }

    pub fn get_metrics(env: Env, wallet: Address) -> Metrics {
        env.storage()
            .persistent()
            .get(&DataKey::Metrics(wallet))
            .unwrap_or(Metrics {
                tx_count: 0,
                repayment_count: 0,
                avg_balance: 0,
                default_count: 0,
            })
    }

    pub fn get_score(env: Env, wallet: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Score(wallet))
            .unwrap_or(0)
    }

    pub fn get_tier(env: Env, wallet: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::CreditTier(wallet))
            .unwrap_or(0)
    }

    pub fn get_tier_limit(env: Env, tier: u32) -> i128 {
        match tier {
            1 => env
                .storage()
                .instance()
                .get(&DataKey::Tier1Limit)
                .unwrap_or(0),
            2 => env
                .storage()
                .instance()
                .get(&DataKey::Tier2Limit)
                .unwrap_or(0),
            3 => env
                .storage()
                .instance()
                .get(&DataKey::Tier3Limit)
                .unwrap_or(0),
            _ => 0,
        }
    }

    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
        panic_with_error!(&_env, Error::NonTransferable);
    }

    pub fn transfer_from(
        _env: Env,
        _spender: Address,
        _from: Address,
        _to: Address,
        _amount: i128,
    ) {
        panic_with_error!(&_env, Error::NonTransferable);
    }
}

fn store_credit_state(env: &Env, wallet: Address, metrics: Metrics, score: u32, tier: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::Metrics(wallet.clone()), &metrics);
    env.storage()
        .persistent()
        .set(&DataKey::Score(wallet.clone()), &score);
    env.storage()
        .persistent()
        .set(&DataKey::CreditTier(wallet.clone()), &tier);
    env.storage().persistent().set(
        &DataKey::TierTimestamp(wallet.clone()),
        &env.ledger().timestamp(),
    );
    env.events().publish(
        (symbol_short!("score_upd"), wallet),
        (score, tier, env.ledger().timestamp()),
    );
}

fn score_to_tier(score: u32) -> u32 {
    if score >= GOLD_MIN_SCORE {
        3
    } else if score >= SILVER_MIN_SCORE {
        2
    } else if score >= BRONZE_MIN_SCORE {
        1
    } else {
        0
    }
}

fn get_issuer(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Issuer)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

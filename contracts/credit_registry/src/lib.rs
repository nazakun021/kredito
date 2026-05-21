#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env,
};

mod test;

const BRONZE_MIN_SCORE: u32 = 40;
const SILVER_MIN_SCORE: u32 = 80;
const GOLD_MIN_SCORE: u32 = 120;
const PLATINUM_MIN_SCORE: u32 = 200;
const MAX_AVG_BALANCE_FACTOR: u32 = 10;
const AVG_BALANCE_STEP: u32 = 100;
const DEFAULT_PENALTY: u32 = 30;
const MIN_TTL: u32 = 100_000;
const MAX_TTL: u32 = 6_312_000;
const TIER_EXPIRY_LEDGERS: u32 = 6_307_200;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Metrics {
    pub tx_count: u32,
    pub repayment_count: u32,
    pub avg_balance: u32,
    pub default_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreditState {
    pub metrics: Metrics,
    pub score: u32,
    pub tier: u32,
    pub tier_timestamp: u64,
    pub tier_expiry: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Issuer,
    Tier1Limit,
    Tier2Limit,
    Tier3Limit,
    CreditState(Address),
    KycVerified(Address),
    KycTierLimit,
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
        kyc_tier_limit: i128,
    ) {
        if env.storage().instance().has(&DataKey::Issuer) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        issuer.require_auth();
        if tier1_limit <= 0 || tier2_limit <= 0 || tier3_limit <= 0 || kyc_tier_limit <= 0 {
            panic_with_error!(&env, Error::InvalidTierLimits);
        }
        if tier2_limit < tier1_limit || tier3_limit < tier2_limit || kyc_tier_limit < tier3_limit {
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
        env.storage()
            .instance()
            .set(&DataKey::KycTierLimit, &kyc_tier_limit);
        bump_instance_ttl(&env);
    }

    pub fn update_metrics(env: Env, wallet: Address, metrics: Metrics) -> u32 {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        let score = compute_score_internal(&metrics);
        let kyc = get_kyc_verified_internal(&env, &wallet);
        let tier = score_to_tier(score, kyc);
        store_credit_state(&env, &wallet, metrics, score, tier);
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
        let score = compute_score_internal(&metrics);
        let kyc = get_kyc_verified_internal(&env, &wallet);
        let tier = score_to_tier(score, kyc);
        store_credit_state(&env, &wallet, metrics, score, tier);
        score
    }

    pub fn set_tier(env: Env, wallet: Address, tier: u32) {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        if !(1..=4).contains(&tier) {
            panic_with_error!(&env, Error::InvalidTier);
        }

        let score = match tier {
            1 => BRONZE_MIN_SCORE,
            2 => SILVER_MIN_SCORE,
            3 => GOLD_MIN_SCORE,
            _ => 200u32, // Tier 4 / Platinum — above all regular thresholds
        };

        let state_key = DataKey::CreditState(wallet.clone());
        let mut state = env.storage().persistent().get::<_, CreditState>(&state_key).unwrap_or(CreditState {
            metrics: Metrics {
                tx_count: 0,
                repayment_count: 0,
                avg_balance: 0,
                default_count: 0,
            },
            score: 0,
            tier: 0,
            tier_timestamp: 0,
            tier_expiry: 0,
        });

        state.score = score;
        state.tier = tier;
        state.tier_timestamp = env.ledger().timestamp();
        state.tier_expiry = env.ledger().sequence().saturating_add(TIER_EXPIRY_LEDGERS);

        env.storage().persistent().set(&state_key, &state);
        maybe_extend_persistent_ttl(&env, &state_key);
        bump_instance_ttl(&env);
    }

    pub fn revoke_tier(env: Env, wallet: Address) {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        let kyc_key = DataKey::KycVerified(wallet.clone());
        env.storage()
            .persistent()
            .set(&kyc_key, &false);
        maybe_extend_persistent_ttl(&env, &kyc_key);

        let state_key = DataKey::CreditState(wallet.clone());
        if let Some(mut state) = env.storage().persistent().get::<_, CreditState>(&state_key) {
            state.tier = 0;
            state.score = 0;
            state.tier_timestamp = 0;
            state.tier_expiry = 0;
            env.storage().persistent().set(&state_key, &state);
            maybe_extend_persistent_ttl(&env, &state_key);
        }

        bump_instance_ttl(&env);
        env.events()
            .publish((symbol_short!("revoked"), wallet), env.ledger().timestamp());
    }

    pub fn compute_score(_env: Env, metrics: Metrics) -> u32 {
        compute_score_internal(&metrics)
    }

    pub fn get_metrics(env: Env, wallet: Address) -> Metrics {
        let state_key = DataKey::CreditState(wallet);
        let state = env.storage().persistent().get::<_, CreditState>(&state_key);
        if state.is_some() {
            maybe_extend_persistent_ttl(&env, &state_key);
        }
        state.map(|s| s.metrics).unwrap_or(Metrics {
            tx_count: 0,
            repayment_count: 0,
            avg_balance: 0,
            default_count: 0,
        })
    }

    pub fn get_score(env: Env, wallet: Address) -> u32 {
        let state_key = DataKey::CreditState(wallet);
        let state = env.storage().persistent().get::<_, CreditState>(&state_key);
        if state.is_some() {
            maybe_extend_persistent_ttl(&env, &state_key);
        }
        state.map(|s| s.score).unwrap_or(0)
    }

    pub fn get_tier(env: Env, wallet: Address) -> u32 {
        let state_key = DataKey::CreditState(wallet);
        let state = env.storage().persistent().get::<_, CreditState>(&state_key);
        if state.is_some() {
            maybe_extend_persistent_ttl(&env, &state_key);
        }
        state.map(|s| s.tier).unwrap_or(0)
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
            4 => env
                .storage()
                .instance()
                .get(&DataKey::KycTierLimit)
                .unwrap_or(0),
            _ => 0,
        }
    }

    pub fn get_active_tier_and_limit(env: Env, wallet: Address) -> (u32, i128) {
        let state_key = DataKey::CreditState(wallet);
        if let Some(state) = env.storage().persistent().get::<_, CreditState>(&state_key) {
            maybe_extend_persistent_ttl(&env, &state_key);
            if state.tier_expiry > env.ledger().sequence() && state.tier > 0 {
                let limit = Self::get_tier_limit(env.clone(), state.tier);
                return (state.tier, limit);
            }
        }
        (0, 0)
    }

    pub fn set_kyc_verified(env: Env, wallet: Address, verified: bool) {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        let kyc_key = DataKey::KycVerified(wallet.clone());
        env.storage()
            .persistent()
            .set(&kyc_key, &verified);
        maybe_extend_persistent_ttl(&env, &kyc_key);

        // Trigger score/tier update if KYC status changes
        let score = Self::get_score(env.clone(), wallet.clone());
        let tier = score_to_tier(score, verified);
        let metrics = Self::get_metrics(env.clone(), wallet.clone());
        store_credit_state(&env, &wallet, metrics, score, tier);
    }

    pub fn get_kyc_verified(env: Env, wallet: Address) -> bool {
        get_kyc_verified_internal(&env, &wallet)
    }

    pub fn is_tier_current(env: Env, wallet: Address) -> bool {
        let state_key = DataKey::CreditState(wallet);
        let state = env.storage().persistent().get::<_, CreditState>(&state_key);
        if state.is_some() {
            maybe_extend_persistent_ttl(&env, &state_key);
        }
        state.map(|s| s.tier_expiry > env.ledger().sequence()).unwrap_or(false)
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

fn store_credit_state(env: &Env, wallet: &Address, metrics: Metrics, score: u32, tier: u32) {
    let state_key = DataKey::CreditState(wallet.clone());
    let state = CreditState {
        metrics,
        score,
        tier,
        tier_timestamp: env.ledger().timestamp(),
        tier_expiry: env.ledger().sequence().saturating_add(TIER_EXPIRY_LEDGERS),
    };
    env.storage().persistent().set(&state_key, &state);
    maybe_extend_persistent_ttl(env, &state_key);
    bump_instance_ttl(env);
    env.events().publish(
        (symbol_short!("score_upd"), wallet.clone()),
        (score, tier, env.ledger().timestamp()),
    );
}

fn score_to_tier(score: u32, kyc: bool) -> u32 {
    if kyc && score >= PLATINUM_MIN_SCORE {
        4
    } else if score >= GOLD_MIN_SCORE {
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

fn bump_instance_ttl(env: &Env) {
    env.storage().instance().extend_ttl(MIN_TTL, MAX_TTL);
}

fn maybe_extend_persistent_ttl(env: &Env, key: &DataKey) {
    if env.storage().persistent().has(key) {
        env.storage().persistent().extend_ttl(key, MIN_TTL, MAX_TTL);
    }
}

fn compute_score_internal(metrics: &Metrics) -> u32 {
    let avg_balance_factor = core::cmp::min(
        metrics.avg_balance / AVG_BALANCE_STEP,
        MAX_AVG_BALANCE_FACTOR,
    );
    let base_score = metrics
        .tx_count
        .saturating_mul(1)
        .saturating_add(metrics.repayment_count.saturating_mul(15))
        .saturating_add(avg_balance_factor.saturating_mul(5));
    let penalty = metrics.default_count.saturating_mul(DEFAULT_PENALTY);
    base_score.saturating_sub(penalty)
}

fn get_kyc_verified_internal(env: &Env, wallet: &Address) -> bool {
    let key = DataKey::KycVerified(wallet.clone());
    let verified = env.storage().persistent().get(&key).unwrap_or(false);
    maybe_extend_persistent_ttl(env, &key);
    verified
}

#![cfg(test)]

use super::{CreditRegistry, CreditRegistryClient, Metrics};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal,
};

fn initialize_registry(
    env: &Env,
    client: &CreditRegistryClient<'_>,
    contract_id: &Address,
    issuer: &Address,
) {
    client
        .mock_auths(&[MockAuth {
            address: issuer,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "initialize",
                args: (
                    issuer.clone(),
                    50_000_000_000i128,
                    200_000_000_000i128,
                    500_000_000_000i128,
                    2_500_000_000_000i128,
                )
                    .into_val(env),
                sub_invokes: &[],
            },
        }])
        .initialize(
            issuer,
            &50_000_000_000,
            &200_000_000_000,
            &500_000_000_000,
            &2_500_000_000_000,
        );
}

#[test]
fn test_initialize_and_manage_scores() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );
    let metrics = Metrics {
        tx_count: 20,
        repayment_count: 4,
        avg_balance: 350,
        default_count: 0,
    };
    let score = client.update_metrics(&user, &metrics);

    assert_eq!(score, 95);
    assert_eq!(client.get_score(&user), 95);
    assert_eq!(client.get_tier(&user), 2);
    assert_eq!(client.get_metrics(&user), metrics);
    assert_eq!(client.get_tier_limit(&1), 50_000_000_000);
    assert_eq!(client.get_tier_limit(&2), 200_000_000_000);
    assert_eq!(client.get_tier_limit(&3), 500_000_000_000);
    assert_eq!(client.get_tier_limit(&4), 2_500_000_000_000);

    client.revoke_tier(&user);
    assert_eq!(client.get_tier(&user), 0);
    assert_eq!(client.get_score(&user), 0);
}

#[test]
fn test_compute_score_penalizes_defaults() {
    let env = Env::default();
    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    initialize_registry(&env, &client, &contract_id, &issuer);

    let score = client.compute_score(&Metrics {
        tx_count: 10,
        repayment_count: 2,
        avg_balance: 250,
        default_count: 1,
    });

    assert_eq!(score, 20);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_initialize_requires_issuer_auth() {
    let env = Env::default();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_initialize_rejects_non_positive_limits() {
    let env = Env::default();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client
        .mock_auths(&[MockAuth {
            address: &issuer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                args: (
                    issuer.clone(),
                    0i128,
                    200_000_000_000i128,
                    500_000_000_000i128,
                    2_500_000_000_000i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .initialize(
            &issuer,
            &0,
            &200_000_000_000,
            &500_000_000_000,
            &2_500_000_000_000,
        );
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_initialize_rejects_descending_limits() {
    let env = Env::default();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client
        .mock_auths(&[MockAuth {
            address: &issuer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                args: (
                    issuer.clone(),
                    200_000_000_000i128,
                    50_000_000_000i128,
                    500_000_000_000i128,
                    2_500_000_000_000i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .initialize(
            &issuer,
            &200_000_000_000,
            &50_000_000_000,
            &500_000_000_000,
            &2_500_000_000_000,
        );
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );
    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_non_issuer_cannot_update_metrics() {
    let env = Env::default();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    initialize_registry(&env, &client, &contract_id, &issuer);
    client.update_metrics(
        &user,
        &Metrics {
            tx_count: 1,
            repayment_count: 0,
            avg_balance: 50,
            default_count: 0,
        },
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_set_tier_rejects_invalid_values() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );
    client.set_tier(&user, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_transfer_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );
    client.transfer(&user_a, &user_b, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_transfer_from_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let spender = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );
    client.transfer_from(&spender, &user_a, &user_b, &1);
}

#[test]
fn test_kyc_unlocks_tier4() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );

    // Initial score 0, tier 0
    assert_eq!(client.get_tier(&user), 0);

    // Update metrics to get Tier 1 (Bronze requires score >= 40)
    // Under new formula: tx_count: 40 => score: 40 => Tier 1
    client.update_metrics(
        &user,
        &Metrics {
            tx_count: 40,
            repayment_count: 0,
            avg_balance: 0,
            default_count: 0,
        },
    );
    assert_eq!(client.get_tier(&user), 1);

    // Set KYC verified
    client.set_kyc_verified(&user, &true);
    assert!(client.get_kyc_verified(&user));

    // Under new rule: Platinum (Tier 4) requires score >= 200 and KYC.
    // Right now, score is 40. Even with KYC verified, tier should still be Tier 1 (Bronze) because score is only 40!
    assert_eq!(client.get_tier(&user), 1);

    // Now update metrics to get score >= 200 (e.g. 200)
    // tx: 40 (40), repayment: 10 (150), avg_balance: 200 (10) => total: 200
    client.update_metrics(
        &user,
        &Metrics {
            tx_count: 40,
            repayment_count: 10,
            avg_balance: 200,
            default_count: 0,
        },
    );

    // Now tier should be 4 because KYC is true and score >= 200
    assert_eq!(client.get_tier(&user), 4);
    assert_eq!(client.get_tier_limit(&4), 2_500_000_000_000);

    // Verify optimized get_active_tier_and_limit helper
    let (active_tier, active_limit) = client.get_active_tier_and_limit(&user);
    assert_eq!(active_tier, 4);
    assert_eq!(active_limit, 2_500_000_000_000);

    // Fast-forward sequence number to test expiration (1 year = 6_307_200 ledgers)
    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 6_307_205,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6_312_000,
    });

    // Now it should return 0, 0 because of expiry!
    let (expired_tier, expired_limit) = client.get_active_tier_and_limit(&user);
    assert_eq!(expired_tier, 0);
    assert_eq!(expired_limit, 0);

    // Reset ledger sequence back to 0 for subsequent assertions
    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 0,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 1000000,
    });

    // Revoke KYC
    client.set_kyc_verified(&user, &false);
    // Since score is 200, if KYC is false, tier should be 3 (Gold)
    assert_eq!(client.get_tier(&user), 3);
}

#[test]
fn test_revoke_tier_clears_kyc() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(
        &issuer,
        &50_000_000_000,
        &200_000_000_000,
        &500_000_000_000,
        &2_500_000_000_000,
    );

    client.set_kyc_verified(&user, &true);
    assert!(client.get_kyc_verified(&user));

    client.revoke_tier(&user);
    assert!(!client.get_kyc_verified(&user));
    assert_eq!(client.get_tier(&user), 0);
}

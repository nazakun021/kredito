#![cfg(test)]
use super::{CreditRegistry, CreditRegistryClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_issuer_sets_tier() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000);
    client.set_tier(&user, &1);

    assert_eq!(client.get_tier(&user), 1);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_non_issuer_sets_tier() {
    let env = Env::default();
    // No mock_all_auths here to test auth failure

    let issuer = Address::generate(&env);
    let _non_issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000);

    // This should panic
    client.set_tier(&user, &1);
}

#[test]
#[should_panic(expected = "SBT: non-transferable by design")]
fn test_transfer_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000);
    client.transfer(&user_a, &user_b, &1);
}

#[test]
fn test_revoke_tier() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000);
    client.set_tier(&user, &2);
    assert_eq!(client.get_tier(&user), 2);

    client.revoke_tier(&user);
    assert_eq!(client.get_tier(&user), 0);
}

#[test]
fn test_get_tier_limit() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000);

    assert_eq!(client.get_tier_limit(&1), 50_000_000_000);
    assert_eq!(client.get_tier_limit(&2), 200_000_000_000);
    assert_eq!(client.get_tier_limit(&0), 0);
}

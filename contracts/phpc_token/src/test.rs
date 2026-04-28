#![cfg(test)]

use super::{Token, TokenClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal, String,
};

fn token_name(env: &Env) -> String {
    String::from_str(env, "Philippine Peso Coin")
}

fn token_symbol(env: &Env) -> String {
    String::from_str(env, "PHPC")
}

fn initialize_token(
    env: &Env,
    client: &TokenClient<'_>,
    contract_id: &Address,
    admin: &Address,
    decimal: u32,
) {
    let name = token_name(env);
    let symbol = token_symbol(env);
    client
        .mock_auths(&[MockAuth {
            address: admin,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "initialize",
                args: (admin.clone(), decimal, name.clone(), symbol.clone()).into_val(env),
                sub_invokes: &[],
            },
        }])
        .initialize(admin, &decimal, &name, &symbol);
}

#[test]
fn test_happy_path_token_flows() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let spender = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&user_a, &10_000);
    client.transfer(&user_a, &user_b, &3_000);
    client.approve(&user_b, &spender, &2_000, &500);
    client.transfer_from(&spender, &user_b, &user_a, &1_500);

    assert_eq!(client.balance(&user_a), 8_500);
    assert_eq!(client.balance(&user_b), 1_500);
    assert_eq!(client.allowance(&user_b, &spender), 500);
    assert_eq!(client.decimals(), 7);
    assert_eq!(client.name(), token_name(&env));
    assert_eq!(client.symbol(), token_symbol(&env));
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_initialize_requires_admin_auth() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_initialize_rejects_invalid_decimals() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    initialize_token(&env, &client, &contract_id, &admin, 19);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_unauthorized_mint() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    initialize_token(&env, &client, &contract_id, &admin, 7);
    client.mint(&user, &1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_mint_rejects_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&user, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_approve_rejects_past_expiration() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 10,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let spender = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.approve(&user, &spender, &1_000, &0);
}

#[test]
fn test_allowance_expires() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&owner, &10_000);
    client.approve(&owner, &spender, &5_000, &50);

    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 51,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    assert_eq!(client.allowance(&owner, &spender), 0);
    let _ = recipient;
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_transfer_from_rejects_expired_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&owner, &10_000);
    client.approve(&owner, &spender, &5_000, &50);

    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 51,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    client.transfer_from(&spender, &owner, &recipient, &1);
}

#[test]
fn test_burn_and_burn_from_reduce_balances_and_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&owner, &10_000);
    client.burn(&owner, &1_000);
    client.approve(&owner, &spender, &4_000, &500);
    client.burn_from(&spender, &owner, &2_500);

    assert_eq!(client.balance(&owner), 6_500);
    assert_eq!(client.allowance(&owner, &spender), 1_500);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_transfer_rejects_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&user_a, &10_000);
    client.transfer(&user_a, &user_b, &0);
}

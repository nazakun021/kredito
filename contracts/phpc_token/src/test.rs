#![cfg(test)]
use super::{Token, TokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_happy_path_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Philippine Peso Coin"),
        &String::from_str(&env, "PHPC"),
    );

    client.mint(&user, &10_000_000_000_0); // 10,000 PHPC
    assert_eq!(client.balance(&user), 10_000_000_000_0);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Philippine Peso Coin"),
        &String::from_str(&env, "PHPC"),
    );

    client.mint(&user_a, &10_000);
    client.transfer(&user_a, &user_b, &3_000);

    assert_eq!(client.balance(&user_a), 7_000);
    assert_eq!(client.balance(&user_b), 3_000);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_unauthorized_mint() {
    let env = Env::default();
    // env.mock_all_auths(); // Don't mock auth to test failure

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Philippine Peso Coin"),
        &String::from_str(&env, "PHPC"),
    );

    // This should panic because admin didn't sign it
    client.mint(&user, &1000);
}

#[test]
fn test_allowance_and_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let user_c = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Philippine Peso Coin"),
        &String::from_str(&env, "PHPC"),
    );

    client.mint(&user_a, &10_000);
    client.approve(&user_a, &user_b, &5_000, &100);
    assert_eq!(client.allowance(&user_a, &user_b), 5_000);

    client.transfer_from(&user_b, &user_a, &user_c, &2_000);
    assert_eq!(client.balance(&user_a), 8_000);
    assert_eq!(client.balance(&user_c), 2_000);
    assert_eq!(client.allowance(&user_a, &user_b), 3_000);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Philippine Peso Coin"),
        &String::from_str(&env, "PHPC"),
    );

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Philippine Peso Coin"),
        &String::from_str(&env, "PHPC"),
    );
}

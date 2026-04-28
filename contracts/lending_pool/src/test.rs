#![cfg(test)]
use super::{LendingPool, LendingPoolClient};
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, String};

// Use the actual types for better testing if possible, 
// but since they are in different crates, we'll keep using the WASM 
// but I'll make sure the WASM is up to date and correct.
// Actually, I can just use the WASM, but I'll fix the repayment test logic.

mod phpc_token {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/phpc_token.wasm");
}

mod credit_registry {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/credit_registry.wasm");
}

#[test]
fn test_happy_path_borrow_and_repay() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let borrower = Address::generate(&env);

    let phpc_id = env.register(phpc_token::WASM, ());
    let phpc_client = phpc_token::Client::new(&env, &phpc_id);
    phpc_client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Philippine Peso Coin"),
        &String::from_str(&env, "PHPC"),
    );

    let registry_id = env.register(credit_registry::WASM, ());
    let registry_client = credit_registry::Client::new(&env, &registry_id);
    registry_client.initialize(&admin, &50_000_000_000, &200_000_000_000);

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);
    pool_client.initialize(&admin, &registry_id, &phpc_id, &500, &518400);

    // 1. Fund the pool
    phpc_client.mint(&admin, &1_000_000_000_000);
    phpc_client.approve(&admin, &pool_id, &1_000_000_000_000, &1000);
    pool_client.deposit(&1_000_000_000_000);

    // 2. Set borrower tier
    registry_client.set_tier(&borrower, &1);

    // 3. Borrow
    let borrow_amount = 5_000_000_000;
    pool_client.borrow(&borrower, &borrow_amount);

    // 4. Repay
    let fee = (borrow_amount * 500) / 10000;
    let total_owed = borrow_amount + fee;
    
    // Give borrower some extra PHPC to cover the fee
    phpc_client.mint(&borrower, &fee);
    
    // Borrower approves the pool to pull the total_owed
    phpc_client.approve(&borrower, &pool_id, &total_owed, &1000);
    
    pool_client.repay(&borrower);

    let loan = pool_client.get_loan(&borrower).unwrap();
    assert_eq!(loan.repaid, true);
}

#[test]
#[should_panic(expected = "No credit tier")]
fn test_no_sbt_rejection() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let borrower = Address::generate(&env);

    let phpc_id = env.register(phpc_token::WASM, ());
    let phpc_client = phpc_token::Client::new(&env, &phpc_id);
    phpc_client.initialize(&admin, &7, &String::from_str(&env, "PHPC"), &String::from_str(&env, "PHPC"));

    let registry_id = env.register(credit_registry::WASM, ());
    let registry_client = credit_registry::Client::new(&env, &registry_id);
    registry_client.initialize(&admin, &50_000_000_000, &200_000_000_000);

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);
    pool_client.initialize(&admin, &registry_id, &phpc_id, &500, &518400);

    phpc_client.mint(&admin, &1_000_000_000_000);
    phpc_client.approve(&admin, &pool_id, &1_000_000_000_000, &1000);
    pool_client.deposit(&1_000_000_000_000);

    pool_client.borrow(&borrower, &5_000_000_000);
}

#[test]
#[should_panic(expected = "Amount exceeds tier borrow limit")]
fn test_over_limit_rejection() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let borrower = Address::generate(&env);

    let phpc_id = env.register(phpc_token::WASM, ());
    let phpc_client = phpc_token::Client::new(&env, &phpc_id);
    phpc_client.initialize(&admin, &7, &String::from_str(&env, "PHPC"), &String::from_str(&env, "PHPC"));

    let registry_id = env.register(credit_registry::WASM, ());
    let registry_client = credit_registry::Client::new(&env, &registry_id);
    registry_client.initialize(&admin, &50_000_000_000, &200_000_000_000);

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);
    pool_client.initialize(&admin, &registry_id, &phpc_id, &500, &518400);

    phpc_client.mint(&admin, &1_000_000_000_000);
    phpc_client.approve(&admin, &pool_id, &1_000_000_000_000, &1000);
    pool_client.deposit(&1_000_000_000_000);

    registry_client.set_tier(&borrower, &1); // Limit is 50,000,000,000

    pool_client.borrow(&borrower, &50_000_000_001);
}

#[test]
fn test_mark_default() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let borrower = Address::generate(&env);

    let phpc_id = env.register(phpc_token::WASM, ());
    let phpc_client = phpc_token::Client::new(&env, &phpc_id);
    phpc_client.initialize(&admin, &7, &String::from_str(&env, "PHPC"), &String::from_str(&env, "PHPC"));

    let registry_id = env.register(credit_registry::WASM, ());
    let registry_client = credit_registry::Client::new(&env, &registry_id);
    registry_client.initialize(&admin, &50_000_000_000, &200_000_000_000);

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);
    pool_client.initialize(&admin, &registry_id, &phpc_id, &500, &100);

    phpc_client.mint(&admin, &1_000_000_000_000);
    phpc_client.approve(&admin, &pool_id, &1_000_000_000_000, &1000);
    pool_client.deposit(&1_000_000_000_000);

    registry_client.set_tier(&borrower, &1);
    pool_client.borrow(&borrower, &5_000_000_000);

    // Fast forward ledger sequence to after due_ledger (100)
    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 101,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    pool_client.mark_default(&borrower);

    let loan = pool_client.get_loan(&borrower).unwrap();
    assert_eq!(loan.defaulted, true);
}

#[test]
#[should_panic(expected = "Active loan already exists")]
fn test_double_borrow_rejection() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let borrower = Address::generate(&env);

    let phpc_id = env.register(phpc_token::WASM, ());
    let phpc_client = phpc_token::Client::new(&env, &phpc_id);
    phpc_client.initialize(&admin, &7, &String::from_str(&env, "PHPC"), &String::from_str(&env, "PHPC"));

    let registry_id = env.register(credit_registry::WASM, ());
    let registry_client = credit_registry::Client::new(&env, &registry_id);
    registry_client.initialize(&admin, &50_000_000_000, &200_000_000_000);

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);
    pool_client.initialize(&admin, &registry_id, &phpc_id, &500, &518400);

    phpc_client.mint(&admin, &1_000_000_000_000);
    phpc_client.approve(&admin, &pool_id, &1_000_000_000_000, &1000);
    pool_client.deposit(&1_000_000_000_000);

    registry_client.set_tier(&borrower, &1);

    pool_client.borrow(&borrower, &5_000_000_000);
    pool_client.borrow(&borrower, &5_000_000_000);
}

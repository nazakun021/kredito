#![cfg(test)]

use super::{LendingPool, LendingPoolClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env, IntoVal, String,
};

mod phpc_token {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/phpc_token.wasm");
}

mod credit_registry {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/credit_registry.wasm");
}

const TIER1_LIMIT: i128 = 50_000_000_000;
const TIER2_LIMIT: i128 = 200_000_000_000;
const TIER3_LIMIT: i128 = 500_000_000_000;
const POOL_FUNDING: i128 = 1_000_000_000_000;

struct TestContext {
    env: Env,
    admin: Address,
    borrower: Address,
    phpc_id: Address,
    registry_id: Address,
    pool_id: Address,
}

fn setup_pool(flat_fee_bps: u32, loan_term_ledgers: u32) -> TestContext {
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
    registry_client.initialize(&admin, &TIER1_LIMIT, &TIER2_LIMIT, &TIER3_LIMIT);

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);
    pool_client.initialize(
        &admin,
        &registry_id,
        &phpc_id,
        &flat_fee_bps,
        &loan_term_ledgers,
    );

    TestContext {
        env,
        admin,
        borrower,
        phpc_id,
        registry_id,
        pool_id,
    }
}

fn phpc_client(ctx: &TestContext) -> phpc_token::Client<'_> {
    phpc_token::Client::new(&ctx.env, &ctx.phpc_id)
}

fn registry_client(ctx: &TestContext) -> credit_registry::Client<'_> {
    credit_registry::Client::new(&ctx.env, &ctx.registry_id)
}

fn pool_client(ctx: &TestContext) -> LendingPoolClient<'_> {
    LendingPoolClient::new(&ctx.env, &ctx.pool_id)
}

fn fund_pool(ctx: &TestContext, amount: i128) {
    phpc_client(ctx).mint(&ctx.admin, &amount);
    phpc_client(ctx).approve(&ctx.admin, &ctx.pool_id, &amount, &1000);
    pool_client(ctx).deposit(&amount);
}

#[test]
fn test_happy_path_borrow_and_repay() {
    let ctx = setup_pool(500, 518_400);

    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    let borrow_amount = 5_000_000_000;
    let fee = (borrow_amount * 500) / 10_000;
    let total_owed = borrow_amount + fee;

    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);
    assert_eq!(
        pool_client(&ctx).get_pool_balance(),
        POOL_FUNDING - borrow_amount
    );

    phpc_client(&ctx).mint(&ctx.borrower, &fee);
    phpc_client(&ctx).approve(&ctx.borrower, &ctx.pool_id, &total_owed, &1000);
    pool_client(&ctx).repay(&ctx.borrower);

    let loan = pool_client(&ctx).get_loan(&ctx.borrower).unwrap();
    assert!(loan.repaid);
    assert!(!loan.defaulted);
    assert_eq!(pool_client(&ctx).get_pool_balance(), POOL_FUNDING + fee);
}

#[test]
fn test_gold_tier_gets_lower_fee() {
    let ctx = setup_pool(500, 518_400);

    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &3);

    let borrow_amount = 10_000_000_000;
    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);

    let loan = pool_client(&ctx).get_loan(&ctx.borrower).unwrap();
    assert_eq!(loan.fee, (borrow_amount * 150) / 10_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_initialize_rejects_excessive_fee_bps() {
    let _ = setup_pool(10_001, 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_initialize_rejects_zero_loan_term() {
    let _ = setup_pool(500, 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_deposit_rejects_zero_amount() {
    let ctx = setup_pool(500, 100);
    pool_client(&ctx).deposit(&0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_no_sbt_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);

    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_over_limit_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    pool_client(&ctx).borrow(&ctx.borrower, &(TIER1_LIMIT + 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_insufficient_liquidity_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, 1_000);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    pool_client(&ctx).borrow(&ctx.borrower, &5_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_borrow_rejects_zero_amount() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    pool_client(&ctx).borrow(&ctx.borrower, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_double_borrow_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);
    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn test_repay_rejects_overdue_loan() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);
    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 101,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    pool_client(&ctx).repay(&ctx.borrower);
}

#[test]
#[should_panic(expected = "Error(Contract, #18)")]
fn test_mark_default_rejects_current_loan() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);
    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);

    pool_client(&ctx).mark_default(&ctx.borrower);
}

#[test]
fn test_mark_default_marks_overdue_loan() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);
    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 101,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    pool_client(&ctx).mark_default(&ctx.borrower);

    let loan = pool_client(&ctx).get_loan(&ctx.borrower).unwrap();
    assert!(loan.defaulted);
    assert!(!loan.repaid);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn test_repay_rejects_defaulted_loan() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    let borrow_amount = 5_000_000_000;
    let fee = (borrow_amount * 500) / 10_000;
    let total_owed = borrow_amount + fee;

    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);
    phpc_client(&ctx).mint(&ctx.borrower, &fee);
    phpc_client(&ctx).approve(&ctx.borrower, &ctx.pool_id, &total_owed, &1000);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 101,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });
    pool_client(&ctx).mark_default(&ctx.borrower);
    pool_client(&ctx).repay(&ctx.borrower);
}

#[test]
fn test_admin_withdraw_happy_path() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);

    let withdraw_amount = 100_000_000_000;
    pool_client(&ctx).admin_withdraw(&withdraw_amount);

    assert_eq!(
        pool_client(&ctx).get_pool_balance(),
        POOL_FUNDING - withdraw_amount
    );
    assert_eq!(phpc_client(&ctx).balance(&ctx.admin), withdraw_amount);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_admin_withdraw_rejects_over_balance() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, 1_000);
    pool_client(&ctx).admin_withdraw(&1_001);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_admin_withdraw_rejects_zero_amount() {
    let ctx = setup_pool(500, 100);
    pool_client(&ctx).admin_withdraw(&0);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_mark_default_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let borrower = Address::generate(&env);
    let registry_id = Address::generate(&env);
    let phpc_id = Address::generate(&env);

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);

    pool_client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &pool_id,
                fn_name: "initialize",
                args: (
                    admin.clone(),
                    registry_id.clone(),
                    phpc_id.clone(),
                    500u32,
                    100u32,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .initialize(&admin, &registry_id, &phpc_id, &500, &100);

    // Call mark_default without any mock auth, should fail because require_auth() is called for admin
    pool_client.mark_default(&borrower);
}

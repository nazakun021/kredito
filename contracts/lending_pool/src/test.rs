#![cfg(test)]

use super::{LendingPool, LendingPoolClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env, IntoVal,
};

mod credit_registry {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/credit_registry.wasm");
}

const TIER1_LIMIT: i128 = 50_000_000_000;
const TIER2_LIMIT: i128 = 200_000_000_000;
const TIER3_LIMIT: i128 = 500_000_000_000;
const KYC_TIER_LIMIT: i128 = 1_000_000_000_000;
const POOL_FUNDING: i128 = 1_000_000_000_000;

struct TestContext {
    env: Env,
    admin: Address,
    borrower: Address,
    xlm_id: Address,
    registry_id: Address,
    pool_id: Address,
}

fn setup_pool(flat_fee_bps: u32, loan_term_ledgers: u32) -> TestContext {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 0,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6_312_000,
    });

    let admin = Address::generate(&env);
    let borrower = Address::generate(&env);

    let xlm_id = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();

    let registry_id = env.register(credit_registry::WASM, ());
    let registry_client = credit_registry::Client::new(&env, &registry_id);
    registry_client.initialize(
        &admin,
        &TIER1_LIMIT,
        &TIER2_LIMIT,
        &TIER3_LIMIT,
        &KYC_TIER_LIMIT,
    );

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);
    pool_client.initialize(
        &admin,
        &registry_id,
        &xlm_id,
        &flat_fee_bps,
        &loan_term_ledgers,
    );

    TestContext {
        env,
        admin,
        borrower,
        xlm_id,
        registry_id,
        pool_id,
    }
}

fn xlm_client(ctx: &TestContext) -> soroban_sdk::token::Client<'_> {
    soroban_sdk::token::Client::new(&ctx.env, &ctx.xlm_id)
}

fn xlm_admin_client(ctx: &TestContext) -> soroban_sdk::token::StellarAssetClient<'_> {
    soroban_sdk::token::StellarAssetClient::new(&ctx.env, &ctx.xlm_id)
}

fn registry_client(ctx: &TestContext) -> credit_registry::Client<'_> {
    credit_registry::Client::new(&ctx.env, &ctx.registry_id)
}

fn pool_client(ctx: &TestContext) -> LendingPoolClient<'_> {
    LendingPoolClient::new(&ctx.env, &ctx.pool_id)
}

fn fund_pool(ctx: &TestContext, amount: i128) {
    xlm_admin_client(ctx).mint(&ctx.admin, &amount);
    xlm_client(ctx).approve(&ctx.admin, &ctx.pool_id, &amount, &2000);
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

    xlm_admin_client(&ctx).mint(&ctx.borrower, &fee);
    xlm_client(&ctx).approve(&ctx.borrower, &ctx.pool_id, &total_owed, &1000);
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
    // Set KYC verified first, then set Tier 3 (Gold)
    registry_client(&ctx).set_kyc_verified(&ctx.borrower, &true);
    registry_client(&ctx).set_tier(&ctx.borrower, &3);

    let borrow_amount = 10_000_000_000;
    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);

    let loan = pool_client(&ctx).get_loan(&ctx.borrower).unwrap();
    assert_eq!(loan.fee, (borrow_amount * 150) / 10_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #22)")]
fn test_borrow_rejects_non_kyc_silver() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);

    // Set borrower to Silver (tier 2) but do NOT verify KYC
    registry_client(&ctx).set_tier(&ctx.borrower, &2);

    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);
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
    xlm_admin_client(&ctx).mint(&ctx.borrower, &fee);
    xlm_client(&ctx).approve(&ctx.borrower, &ctx.pool_id, &total_owed, &2000);

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
    assert_eq!(xlm_client(&ctx).balance(&ctx.admin), withdraw_amount);
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
    let xlm_id = Address::generate(&env);

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
                    xlm_id.clone(),
                    500u32,
                    100u32,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .initialize(&admin, &registry_id, &xlm_id, &500, &100);

    // Call mark_default without any mock auth, should fail because require_auth() is called for admin
    pool_client.mark_default(&borrower);
}

#[test]
fn test_staking_happy_path() {
    let ctx = setup_pool(500, 518_400);
    let staker = Address::generate(&ctx.env);

    let stake_amount = 100_000_000_000;
    xlm_admin_client(&ctx).mint(&staker, &stake_amount);
    xlm_client(&ctx).approve(&staker, &ctx.pool_id, &stake_amount, &2000);

    pool_client(&ctx).stake(&staker, &stake_amount);

    let info = pool_client(&ctx).get_stake_info(&staker);
    assert_eq!(info.staked_amount, stake_amount);
    assert_eq!(info.pending_rewards, 0);
    assert_eq!(info.share_bps, 10_000); // 100% share

    // Borrow and repay to generate rewards
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);
    let borrow_amount = 50_000_000_000;
    let fee = (borrow_amount * 500) / 10_000;
    let total_owed = borrow_amount + fee;

    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);
    xlm_admin_client(&ctx).mint(&ctx.borrower, &fee);
    xlm_client(&ctx).approve(&ctx.borrower, &ctx.pool_id, &total_owed, &2000);
    pool_client(&ctx).repay(&ctx.borrower);

    // Stakers get 50% of the fee
    let expected_rewards = fee / 2;
    let info_after = pool_client(&ctx).get_stake_info(&staker);
    assert_eq!(info_after.pending_rewards, expected_rewards);

    // Unstake and check balance
    pool_client(&ctx).unstake(&staker, &stake_amount);
    assert_eq!(
        xlm_client(&ctx).balance(&staker),
        stake_amount + expected_rewards
    );

    let info_final = pool_client(&ctx).get_stake_info(&staker);
    assert_eq!(info_final.staked_amount, 0);
    assert_eq!(info_final.pending_rewards, 0);
}

#[test]
fn test_multiple_stakers_proportional_rewards() {
    let ctx = setup_pool(500, 518_400);
    let staker1 = Address::generate(&ctx.env);
    let staker2 = Address::generate(&ctx.env);

    let stake1 = 100_000_000_000;
    let stake2 = 300_000_000_000;

    xlm_admin_client(&ctx).mint(&staker1, &stake1);
    xlm_client(&ctx).approve(&staker1, &ctx.pool_id, &stake1, &2000);
    pool_client(&ctx).stake(&staker1, &stake1);

    xlm_admin_client(&ctx).mint(&staker2, &stake2);
    xlm_client(&ctx).approve(&staker2, &ctx.pool_id, &stake2, &2000);
    pool_client(&ctx).stake(&staker2, &stake2);

    // Generate rewards
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);
    let borrow_amount = 50_000_000_000;
    let fee = (borrow_amount * 500) / 10_000; // 2,500,000,000
    let total_owed = borrow_amount + fee;

    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);

    xlm_admin_client(&ctx).mint(&ctx.borrower, &fee);
    xlm_client(&ctx).approve(&ctx.borrower, &ctx.pool_id, &total_owed, &2000);
    pool_client(&ctx).repay(&ctx.borrower);

    let total_staker_rewards = fee / 2; // 2,500,000,000

    let info1 = pool_client(&ctx).get_stake_info(&staker1);
    let info2 = pool_client(&ctx).get_stake_info(&staker2);

    // Staker 1 has 25% share, Staker 2 has 75% share
    assert_eq!(info1.share_bps, 2500);
    assert_eq!(info2.share_bps, 7500);

    // Check rewards (allowing for small rounding diffs if any, but should be exact here)
    assert_eq!(info1.pending_rewards, total_staker_rewards / 4);
    assert_eq!(info2.pending_rewards, total_staker_rewards * 3 / 4);
}

#[test]
#[should_panic(expected = "Error(Contract, #19)")]
fn test_unstake_rejects_insufficient_stake() {
    let ctx = setup_pool(500, 100);
    let staker = Address::generate(&ctx.env);

    xlm_admin_client(&ctx).mint(&staker, &1000);
    xlm_client(&ctx).approve(&staker, &ctx.pool_id, &1000, &2000);
    pool_client(&ctx).stake(&staker, &1000);

    pool_client(&ctx).unstake(&staker, &1001);
}

#[test]
fn test_time_deposit_matures_with_interest() {
    let ctx = setup_pool(500, 518_400);
    let depositor = Address::generate(&ctx.env);

    let amount = 100_000_000_000;
    let term = 10_000; // Use a smaller term for testing to avoid archival issues
    xlm_admin_client(&ctx).mint(&depositor, &amount);
    xlm_client(&ctx).approve(&depositor, &ctx.pool_id, &amount, &2000);

    // Fund pool to cover interest
    fund_pool(&ctx, 10_000_000_000);

    pool_client(&ctx).time_deposit(&depositor, &amount, &term);

    let record = pool_client(&ctx).get_time_deposit(&depositor).unwrap();
    assert_eq!(record.amount, amount);
    assert_eq!(record.term_ledgers, term);
    assert_eq!(record.apy_bps, 500);

    // Fast forward to maturity
    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: term + 1,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 1000000,
    });

    pool_client(&ctx).withdraw_time_deposit(&depositor);

    let expected_interest = (amount * 500 * term as i128) / (10_000 * 6_307_200);
    assert_eq!(
        xlm_client(&ctx).balance(&depositor),
        amount + expected_interest
    );
}

#[test]
fn test_time_deposit_late_withdrawal_is_capped() {
    let ctx = setup_pool(500, 518_400);
    let depositor = Address::generate(&ctx.env);

    let amount = 100_000_000_000;
    let term = 10_000;
    xlm_admin_client(&ctx).mint(&depositor, &amount);
    xlm_client(&ctx).approve(&depositor, &ctx.pool_id, &amount, &2000);

    fund_pool(&ctx, 10_000_000_000);

    pool_client(&ctx).time_deposit(&depositor, &amount, &term);

    // Fast forward way past maturity
    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: term * 2,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 1000000,
    });

    pool_client(&ctx).withdraw_time_deposit(&depositor);

    // Interest should be capped at term, not term * 2
    let expected_interest = (amount * 500 * term as i128) / (10_000 * 6_307_200);
    assert_eq!(
        xlm_client(&ctx).balance(&depositor),
        amount + expected_interest
    );
}

#[test]
fn test_time_deposit_early_withdrawal_penalty() {
    let ctx = setup_pool(500, 518_400);
    let depositor = Address::generate(&ctx.env);

    let amount = 100_000_000_000;
    let term = 518_400;
    xlm_admin_client(&ctx).mint(&depositor, &amount);
    xlm_client(&ctx).approve(&depositor, &ctx.pool_id, &amount, &2000);

    // Fund pool to cover interest reservation
    fund_pool(&ctx, 10_000_000_000);

    pool_client(&ctx).time_deposit(&depositor, &amount, &term);

    // Withdraw early
    pool_client(&ctx).withdraw_time_deposit(&depositor);

    // 1% penalty on principal applied
    let penalty = amount / 100;
    assert_eq!(xlm_client(&ctx).balance(&depositor), amount - penalty);
}

#[test]
#[should_panic(expected = "Error(Contract, #21)")]
fn test_time_deposit_not_found_rejection() {
    let ctx = setup_pool(500, 100);
    let depositor = Address::generate(&ctx.env);
    pool_client(&ctx).withdraw_time_deposit(&depositor);
}

#[test]
#[should_panic(expected = "Error(Contract, #20)")]
fn test_time_deposit_already_exists_rejection() {
    let ctx = setup_pool(500, 100);
    let depositor = Address::generate(&ctx.env);

    let amount = 1_000_000;
    xlm_admin_client(&ctx).mint(&depositor, &(amount * 2));
    xlm_client(&ctx).approve(&depositor, &ctx.pool_id, &(amount * 2), &2000);

    // Fund pool to cover interest reservation
    fund_pool(&ctx, 1_000_000);

    pool_client(&ctx).time_deposit(&depositor, &amount, &100);
    pool_client(&ctx).time_deposit(&depositor, &amount, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_expired_tier_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    // Fast forward ledger sequence to expire the tier.
    // TIER_EXPIRY_LEDGERS is 6,307,200.
    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 6_307_205,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6_312_000,
    });

    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);
}

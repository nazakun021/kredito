**Fix these before you deploy:**

**1. Expired tiers can still borrow** — add one line to `borrow()`:

```rust
if !registry_client.is_tier_current(&borrower) {
    panic_with_error!(&env, Error::NoCreditTier);
}
```

Put it right after the `get_tier` call.

**2. `revoke_tier` doesn't clear KYC** — the moment metrics are refreshed, the revoked wallet bounces straight back to Tier 4. Add at the top of `revoke_tier`:

```rust
env.storage().persistent().set(&DataKey::KycVerified(wallet.clone()), &false);
```

---

**Quick wins before the demo:**

**3. Tier 4 fee discount is missing** — your best users pay the most. One extra match arm:

```rust
4 => base_fee_bps.saturating_sub(500),
```

**4. `get_pool_balance()` returns the wrong number** — it returns the actual contract balance (includes staked XLM), but `borrow()` uses internal `PoolBalance`. The frontend will show phantom liquidity. Either return the stored `PoolBalance` value, or rename it `get_contract_balance()` and expose a separate `get_lendable_balance()`.

---

**Low-priority (note for judges / polish):**

- `admin_withdraw` can drain time-depositor funds — consider tracking a `TotalTimeDeposited` floor, or at least flag this as a "trusted admin" assumption in your README/DEMO.md since judges _will_ ask about it.
- `RewardDebt` / `StakerRewards` TTL not extended in all paths — could cause staker rewards to reset after 100k ledgers of inactivity. Not a demo problem, but worth a `bump_credit_state_ttl`-style helper for staker keys.

The contracts are architecturally solid — native XLM via SAC, staking with reward-per-share, time deposits, KYC tiers, everything wired together correctly. Just those 2 critical fixes and you're good to go for testnet tomorrow. Good luck at PDAX! 🏆

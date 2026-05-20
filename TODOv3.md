# Kredito — TODO (May 21, 2026 · Post-Contract Audit)

**Testnet deployed:** ✅  
**Hard Submission Deadline: May 22, 2026 · 12:00 NN**  
**Presentation: May 23, 2026 · 3:00 PM @ PDAX Office**

---

## Contract Audit Results

### `credit_registry` — ✅ Bulletproof

All issues from TEST.md and TODOv2.md have been fixed in the current code:

| Check                                            | Status   | Notes                                                        |
| ------------------------------------------------ | -------- | ------------------------------------------------------------ |
| Expired tier blocks borrow                       | ✅ Fixed | `is_tier_current()` check is in `borrow()`                   |
| `revoke_tier` clears KYC                         | ✅ Fixed | Sets `KycVerified = false` at top of `revoke_tier`           |
| Tier 4 fee discount                              | ✅ Fixed | `tier_fee_bps()` has `4 => base_fee_bps.saturating_sub(500)` |
| `get_pool_balance()` phantom liquidity           | ✅ Fixed | Returns `PoolBalance` (internal), not SAC balance            |
| `kyc_tier_limit` in `initialize()`               | ✅ Fixed | Present in signature and stored                              |
| KYC flag auto-updates tier on `set_kyc_verified` | ✅ Fixed | Calls `score_to_tier` and `store_credit_state`               |
| `transfer` / `transfer_from` blocked             | ✅ Fixed | Both panic with `NonTransferable`                            |
| TTL management                                   | ✅ Good  | Both instance and persistent keys bumped correctly           |

### `lending_pool` — ✅ Mostly Solid · 3 Issues Found

| Check                                                                                 | Status                | Notes                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XLM native SAC used (no PHPC)                                                         | ✅ Done               | `token::Client` with `XlmToken` key                                                                                                                                        |
| Expired tier blocks borrow                                                            | ✅ Fixed              | `is_tier_current()` called before borrow                                                                                                                                   |
| Fee discount by tier                                                                  | ✅ Fixed              | `tier_fee_bps()` applied in `borrow()`                                                                                                                                     |
| Staking reward math (MasterChef pattern)                                              | ✅ Correct            | `AccRewardPerShare` scaled by `1e7`, `RewardDebt` pattern is correct                                                                                                       |
| Repay fee split (50% pool / 50% stakers)                                              | ✅ Correct            | `pool_gain = total_owed - staker_fee` — principal always returns to pool                                                                                                   |
| `stake()` doesn't add to `PoolBalance`                                                | ✅ Fixed             | Staked XLM sits in contract but isn't counted in `PoolBalance`. Separated via `StakedPool` tracker and guarded in `admin_withdraw`. |
| `unstake()` pays rewards from contract balance not checked against actual SAC balance | ✅ Fixed              | `StakedPool` tracker (principal + rewards) is checked in `unstake()` and guarded in `admin_withdraw()`. |
| Time deposit interest paid from `PoolBalance`                                         | ✅ Fixed              | Interest is pre-reserved from `PoolBalance` at deposit time via `ReservedInterest` tracker. |
| `deposit()` uses `transfer_from` (requires pre-approve)                               | ✅ Correct            | Admin must approve XLM SAC before calling `deposit()`                                                                                                                      |
| One loan at a time enforced                                                           | ✅ Correct            | Active loan check on `repay=false && defaulted=false`                                                                                                                      |
| `mark_default` requires overdue check                                                 | ✅ Correct            | Panics if `sequence <= due_ledger`                                                                                                                                         |

---

## Bug Fixes (Contract Changes Needed)

### 🔴 BUG #1 — `stake()` XLM enters contract but bypasses `PoolBalance`

**Problem:** When a user stakes, XLM is transferred into the contract via SAC, but `PoolBalance` is not updated. The `borrow()` function checks `amount > balance` (PoolBalance) — so staked XLM is "invisible" to the borrow logic. This is actually _correct behavior by intent_ (staked funds shouldn't be lendable), but the contract has **no accounting separation**. If `borrow()` drains `PoolBalance` to zero, `unstake()` can still call `token_client.transfer()` because the actual SAC balance still has the staked XLM. This works correctly — but it's fragile and needs a comment at minimum.

**Fix Option A (Safe for demo — just add a comment):** Add a code comment in `stake()` explaining the separation is intentional — staked XLM is held in the contract but NOT counted in `PoolBalance`, which is the admin-seeded lending liquidity.

**Fix Option B (Proper):** Add a `StakedPool` balance tracker that is always `≥ TotalStaked`, and assert in `unstake()` that contract SAC balance ≥ `TotalStaked + TotalRewardPool`.

For the hackathon demo, **Option A is sufficient** — the accounting is actually safe because `borrow()` can never over-draw the SAC balance as long as `PoolBalance ≤ actual SAC balance`, which holds as long as staked funds are not counted in `PoolBalance`.

```rust
// In stake() — add comment:
// NOTE: Staked XLM is held in this contract's SAC balance but is intentionally
// NOT added to PoolBalance. PoolBalance tracks only admin-deposited lending liquidity.
// This ensures stakers' principal cannot be lent out.
```

### 🟠 BUG #2 — `unstake()` reward payout not guarded against actual SAC balance

**Problem:** `TotalRewardPool` tracks accumulated rewards, but it's possible (edge case) that `total_reward_pool > 0` while the contract's actual XLM SAC balance is lower than `amount + rewards`. This can happen if `admin_withdraw()` is called after rewards accumulate.

**Fix:** Before `client.transfer()` in `unstake()`, assert that `admin_withdraw` cannot drain below `TotalStaked + TotalRewardPool`. Add a guard in `admin_withdraw()`:

```rust
pub fn admin_withdraw(env: Env, amount: i128) {
    // ... existing auth check ...
    let total_staked = get_total_staked(&env);
    let total_rewards = get_total_reward_pool(&env);
    let protected = total_staked + total_rewards;
    if balance - amount < protected {
        panic_with_error!(&env, Error::InsufficientPoolLiquidity);
    }
    // ... rest of function ...
}
```

### 🟡 BUG #3 — Time deposit interest has no dedicated reserve

**Problem:** `withdraw_time_deposit()` pays `principal + interest` from `PoolBalance`. The interest is not pre-reserved anywhere when the deposit is created. If the pool is actively used for loans and runs low, a matured depositor could get `InsufficientPoolLiquidity` panic.

**Fix for demo:** Don't create time deposits if pool is near-empty. In production, reserve the projected interest at deposit time.

---

## What's NOT Done Yet (Backend & Frontend)

The contracts are deployed and solid. The remaining work is all backend + frontend.

### Legend

| Symbol | Meaning                                         |
| ------ | ----------------------------------------------- |
| 🔴     | Critical — broken or disqualifying without this |
| 🟠     | High — demo impact                              |
| 🟡     | Medium — differentiates                         |
| 🟢     | Nice-to-have                                    |

---

## Phase A — Backend Cleanup 🔴 (Do First · ~2 hrs)

These are blocking issues that will cause runtime errors.

- [ ] 🔴 `backend/src/config.ts` — remove `PHPC_ID`, add `XLM_SAC_ID` for testnet + mainnet
- [ ] 🔴 `backend/src/stellar/issuer.ts` — delete `phpcClient`, `mintPhpc`, `approvePhpcForPool`; rename `toPhpAmount()` → `toXlmAmount()`
- [ ] 🔴 `backend/src/routes/loan.ts` — remove the separate PHPC `approve` step from repay flow; update balance check to read native XLM from Horizon
- [ ] 🔴 `backend/src/routes/tx.ts` — change all `PHPC`/`toPhpAmount` references to XLM; fix `amountRepaid` label
- [ ] 🔴 `backend/src/index.ts` — register staking, deposit, and wallet routers (see Phase B)

---

## Phase B — New Backend Routes 🟠 (~3 hrs)

- [ ] 🟠 **`backend/src/routes/staking.ts`** — create file with:
  - `GET /staking/info` → `get_pool_balance`, `TotalStaked`, `TotalRewardPool` from lending_pool
  - `GET /staking/position` (auth) → `get_stake_info(wallet)`
  - `POST /staking/stake` (auth) → fee-bumped `stake(wallet, amount)` XDR
  - `POST /staking/unstake` (auth) → fee-bumped `unstake(wallet, amount)` XDR

- [ ] 🟠 **`backend/src/routes/wallet.ts`** — create file with:
  - `GET /wallet/balance` (auth) → XLM balance + XLM/PHP price from CoinGecko (60s cache)
  - `GET /wallet/transactions` (auth) → last 20 native XLM payments from Horizon
  - `POST /wallet/send` (auth) → builds native XLM payment XDR for Freighter

- [ ] 🟠 **`backend/src/routes/credit.ts`** — add `POST /credit/kyc-submit`:
  - Validate: name, email format, idType, idNumber, consent checkbox
  - Log submission server-side (do NOT store PII on-chain)
  - Call `set_kyc_verified(wallet, true)` via issuer-signed fee-bump
  - Return `{ success: true, tier: 4 }`

- [ ] 🟡 **`backend/src/routes/deposit.ts`** — create file with:
  - `GET /deposit/terms` → static 30d/60d term options
  - `GET /deposit/position` (auth) → `get_time_deposit(wallet)`
  - `POST /deposit/create` (auth) → fee-bumped `time_deposit(wallet, amount, termLedgers)` XDR
  - `POST /deposit/withdraw` (auth) → fee-bumped `withdraw_time_deposit(wallet)` XDR

- [ ] 🟠 **`backend/src/scoring/engine.ts`** — add `fetchHorizonMetrics(wallet)`:
  - Load account via Horizon → `walletAgeDays`, `currentBalanceXlm`
  - Paginate up to 200 native payments → `txCount`, `inboundPaymentCount`, `activitySpanDays`, `hasRegularActivity`
  - Map to `ContractMetrics` via `horizonMetricsToContractMetrics()`
  - Update `ScoreSummary` type to include `horizonMetrics` and `kycVerified`
  - Update `/credit/score` response to include both

---

## Phase C — Frontend: Global XLM Fix 🔴 (~1 hr)

- [ ] 🔴 **Global find-replace** across all frontend files: `PHPC` → `XLM`, `₱` (for token amounts) → `◎`; keep `₱` only for PHP equivalent labels
- [ ] 🔴 **`frontend/lib/constants.ts`**:
  - `REQUIRED_NETWORK = 'PUBLIC'`
  - Add `XLM_STROOP_FACTOR = 10_000_000`
  - Add `xlmToStroops(xlm: number)` and `stroopsToXlm(stroops: number)` helpers
- [ ] 🔴 **`frontend/lib/tiers.ts`** — update limits: Tier 1=1 XLM, Tier 2=5 XLM, Tier 3=20 XLM, Tier 4=100 XLM; add Tier 4 purple gradient
- [ ] 🔴 **`frontend/app/loan/borrow/page.tsx`** — XLM input, remove PHPC approve step, show borrow limit in XLM
- [ ] 🔴 **`frontend/app/loan/repay/page.tsx`** — single-step repay (no more approve), show owed in XLM, add shortfall banner
- [ ] 🟠 **`frontend/components/NetworkBadge.tsx`** — show `Mainnet ✓` (green) for `PUBLIC`, `Testnet` (yellow) for `TESTNET`

---

## Phase D — New Frontend Pages 🟠 (~4 hrs)

- [ ] 🟠 **`frontend/app/wallet/page.tsx`** + `layout.tsx`:
  - Balance hero: `◎ X.XXXX XLM` + `≈ ₱X,XXX.XX PHP`
  - Send / Receive buttons with modals
  - Connected Platforms card: Stellar (live), GCash / USDC / Maya (coming soon)
  - Recent transactions list from `/wallet/transactions`
  - `pnpm add qrcode @types/qrcode` for QR code in Receive modal

- [ ] 🟠 **`frontend/app/kyc/page.tsx`** + `layout.tsx`:
  - State A (not verified): form with name, email, ID type, ID number, consent checkbox → POST `/credit/kyc-submit`
  - State B (verified): big badge + "Tier 4 Unlocked" message
  - Redirect to dashboard after success

- [ ] 🟠 **`frontend/app/staking/page.tsx`** + `layout.tsx`:
  - Pool overview (total staked, reward pool)
  - User position (your stake, pending rewards, pool share %)
  - Stake modal + Unstake modal

- [ ] 🟠 **`frontend/app/dashboard/page.tsx`** — update:
  - Add `horizonMetrics` score breakdown section (wallet age, tx count, XLM balance, repayments)
  - Add KYC badge when `kycVerified === true`
  - Add "Get Verified →" CTA when not verified

- [ ] 🟠 **`frontend/components/app-shell.tsx`** — update nav: Wallet, Credit Score, Borrow, Repay, Stake & Earn, Time Deposit, Get Verified

- [ ] 🟡 **`frontend/app/deposit/page.tsx`** + `layout.tsx`:
  - Available terms table (30d/60d)
  - Active deposit card with countdown + maturity progress bar
  - Withdraw button (enabled on maturity)

---

## Phase E — Deploy & Test 🔴 (May 21 EOD)

- [ ] 🔴 Run all new backend routes locally against testnet contracts — confirm no PHPC references remain
- [ ] 🔴 Test full flow locally: connect Freighter → score → borrow XLM → repay → score updates
- [ ] 🔴 Test KYC flow: submit form → `set_kyc_verified` fires → dashboard shows Tier 4
- [ ] 🔴 Test staking: stake XLM → borrow + repay (generates fee) → check pending rewards → unstake
- [ ] 🔴 Deploy backend to Railway — verify `/api/health` responds
- [ ] 🔴 Deploy frontend to Vercel — set all env vars (mainnet network, mainnet RPC, Railway URL)
- [ ] 🔴 Test all routes on live URL before bed

---

## Phase F — Mainnet Deploy 🔴 (May 22 · 7–9 AM)

- [ ] 🔴 Create `contracts/deploy-mainnet.sh` (copy of redeploy.sh with `NETWORK="mainnet"` and mainnet XLM SAC)
- [ ] 🔴 Verify issuer wallet has enough XLM for deploy + pool seed (need ~10 XLM minimum; you have 2 — **fund this now via PDAX/Lobstr**)
- [ ] 🔴 Run mainnet deploy → save contract IDs to `deployed.json`
- [ ] 🔴 Update Railway env vars with mainnet contract IDs → redeploy
- [ ] 🔴 Take mainnet screenshot: dashboard with live score + tier (required for submission)

---

## Phase G — Submission Materials 🔴 (May 22 · 9 AM–11 AM)

- [ ] 🔴 **README.md** — add `## 🚀 Hackathon 2026 Updates` section at top with mainnet contract addresses, live URL, feature summary
- [ ] 🔴 **Demo video (2–3 min)** — screen record: wallet → credit score → borrow → KYC → stake → repay
- [ ] 🔴 **Pitch deck (10 slides)** — problem → insight → solution → screenshots → architecture → new features → multi-platform vision → judging criteria → roadmap → team
- [ ] 🔴 **Rise In submission** — submit before 11:00 AM (not 11:59): GitHub URL, demo video, pitch deck, testnet + mainnet screenshots, live app URL, 3 contract addresses

---

## Phase H — Presentation Day (May 23)

- [ ] 🔴 Practice live demo × 3 — wallet → score → borrow → KYC → stake, timed at 3 min
- [ ] 🔴 Prepare screen recording backup in case of internet issues at PDAX
- [ ] 🟠 Prepare Q&A answers (why XLM not PHPC, score accuracy for new wallets, gaming defense, pool liquidity source, GCash integration status)
- [ ] 🟠 Verify Railway + Vercel are healthy morning of May 23
- [ ] 🟡 Bring mobile with Freighter — showing wallet on mobile is powerful

---

## Contract Bug Fix Priority Summary

| Bug                                                | Severity | Fix Time      | Required for Demo?     |
| -------------------------------------------------- | -------- | ------------- | ---------------------- |
| BUG #1 — `stake()` comment / separation note       | Low      | 5 min         | No — functionally safe |
| BUG #2 — `admin_withdraw()` guard for staker funds | Medium   | 15 min        | Recommended            |
| BUG #3 — time deposit interest reserve             | Low      | Skip for demo | No                     |

**Verdict: Both contracts are safe to demo as-is.** The staking accounting separation is sound (staked XLM can't be borrowed). BUG #2 only matters if admin drains the pool while stakers have pending rewards — unlikely in a demo. Add the `admin_withdraw` guard if you have 15 spare minutes after backend work.

---

## What's Left by Day

### Today (May 21)

```
AM:  Phase A — Backend PHPC cleanup (blocking)
AM:  Phase B — New backend routes (staking, wallet, KYC, deposit)
PM:  Phase C — Frontend global XLM fix + borrow/repay pages
PM:  Phase D — New frontend pages (wallet, KYC, staking, dashboard updates)
EVE: Phase E — Local full E2E test → deploy to Railway + Vercel
```

### May 22

```
07:00  Phase F — Mainnet contract deploy + Railway update
08:30  Full production E2E test + mainnet screenshot
09:00  Phase G — README, demo video, pitch deck
11:00  SUBMIT ON RISE IN ← do not wait until 12:00
```

### May 23

```
AM:    Practice pitch × 3
3 PM:  PDAX Office — present, demo, win ₱25,000 🏆
```

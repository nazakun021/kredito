# Kredito — Mainnet Readiness TODO

### Full Codebase Review · May 21, 2026

**Submission Deadline: May 22, 2026 · 12:00 NN**

---

## Mainnet Readiness Verdict

> **Not yet. 3 critical bugs will crash key user flows on any live deployment.**
> Fix time is estimated at ~3 hours. Everything else is clean and well-built.

### What's already solid ✅

- Repayment count bug fixed — on-chain metrics now used as authoritative floor
- `tier_fee_bps` Tier 4 now correctly returns 0 bps
- XLM SAC IDs in `constants.ts` match `deployed.json`
- APY computed dynamically in `/staking/info`
- `scoreToTier(score, kycVerified)` correctly gates Tier 4 behind KYC flag
- `WalletConnectionBanner` shows "Mainnet"/"Testnet" in plain English
- Score breakdown is hidden behind a collapsible dropdown
- Admin sweep has circuit breaker and idempotency guard
- Contract tests correctly mock native XLM SAC
- Auth store has proper hydration guard against flash redirects
- `parseLedgerRange` gracefully recovers stale RPC ledger errors
- KYC flag on-chain, email off-chain — correct privacy split

---

## Legend

| Symbol | Meaning                                           |
| ------ | ------------------------------------------------- |
| 🔴     | **Critical** — will crash at runtime on mainnet   |
| 🟠     | **High** — wrong behavior, must fix before demo   |
| 🟡     | **Medium** — pre-mainnet hygiene or misleading UX |
| 🟢     | **Low / Polish** — nice to fix if time allows     |

---

## 🔴 CRITICAL — Fix These First

---

### BUG-01 · `deposit.ts` — `apyBps` still missing from `time_deposit` contract call

**File:** `backend/src/routes/deposit.ts` · `POST /create`

```typescript
// Current (broken) — only 3 args passed:
const { amount, termLedgers } = req.body;  // apyBps never extracted
...
[
  Address.fromString(wallet).toScVal(),
  nativeToScVal(amountStroops, { type: 'i128' }),
  nativeToScVal(Number(termLedgers), { type: 'u32' }),
  // ← apy_bps is missing. Contract expects 4 args, gets 3. Fails every time.
]
```

The `time_deposit` Soroban function signature requires four arguments:
`(depositor: Address, amount: i128, term_ledgers: u32, apy_bps: u32)`.
Every deposit creation call will fail with an arity mismatch from the RPC layer.

**Fix:**

```typescript
// backend/src/routes/deposit.ts — POST /create
const { amount, termLedgers, apyBps } = req.body;
if (!amount || !termLedgers || !apyBps) {
  throw badRequest('Amount, termLedgers, and apyBps are required');
}
...
[
  Address.fromString(wallet).toScVal(),
  nativeToScVal(amountStroops, { type: 'i128' }),
  nativeToScVal(Number(termLedgers), { type: 'u32' }),
  nativeToScVal(Number(apyBps), { type: 'u32' }),   // ← add this
]
```

**Frontend fix — `frontend/app/deposit/page.tsx`:**
The `POST /deposit/create` call must include `apyBps` from the selected term:

```typescript
await api.post("/deposit/create", {
  amount: depositAmount,
  termLedgers: selectedTerm.ledgers,
  apyBps: selectedTerm.apyBps, // ← must be passed
});
```

---

### BUG-02 · `lending_pool` contract — `get_total_staked` and `get_total_reward_pool` are private helpers, not public contract methods

**File:** `contracts/lending_pool/src/lib.rs`

The backend calls these as if they are externally-invokable contract functions:

```typescript
// backend/src/routes/staking.ts
queryContract(contractIds.lendingPool, 'get_total_staked', []),
queryContract(contractIds.lendingPool, 'get_total_reward_pool', []),
```

But in the contract source they are module-level private Rust functions:

```rust
fn get_total_staked(env: &Env) -> i128 { ... }       // private helper
fn get_total_reward_pool(env: &Env) -> i128 { ... }  // private helper
```

They are NOT declared as `pub fn` inside `impl LendingPool`, so they have no
Soroban dispatch entry point. Every call to `GET /staking/info` will throw an
RPC error, breaking the entire staking page.

**Fix — `contracts/lending_pool/src/lib.rs`:**
Add two public getters inside the `#[contractimpl] impl LendingPool` block:

```rust
pub fn get_total_staked_pub(env: Env) -> i128 {
    bump_instance_ttl(&env);
    get_total_staked(&env)
}

pub fn get_total_reward_pool_pub(env: Env) -> i128 {
    bump_instance_ttl(&env);
    get_total_reward_pool(&env)
}
```

**Backend fix — `backend/src/routes/staking.ts`:**

```typescript
queryContract<bigint>(contractIds.lendingPool, 'get_total_staked_pub', []),
queryContract<bigint>(contractIds.lendingPool, 'get_total_reward_pool_pub', []),
```

**After fixing: rebuild both contracts and redeploy.**

---

### BUG-03 · `staking/page.tsx` — Missing XLM SAC `approve` step before `stake`

**File:** `frontend/app/staking/page.tsx` · `StakeModal.handleStake()`

The `stake()` contract function calls `token::transfer_from()` to pull XLM from
the staker into the contract. `transfer_from` requires a prior `approve()` call
on the native XLM SAC granting the lending_pool an allowance. The frontend skips
this entirely:

```typescript
// Current (broken) — goes straight to stake, no approval:
const { data } = await api.post('/staking/stake', { amount });
const signResult = await signTx(data.unsignedXdr, ...);
await api.post('/tx/sign-and-submit', { signedInnerXdr: [signResult.signedXdr], ... });
// ↑ On-chain: transfer_from with no allowance → Authorization error
```

The backend already has `POST /staking/approve`. It just isn't being called.

**Fix — `StakeModal.handleStake()` in `frontend/app/staking/page.tsx`:**

```typescript
const handleStake = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!amount) return;
  setLoading(true);

  try {
    // Step 1: Approve the XLM SAC to allow lending_pool to pull funds
    setLoadingText("Approving XLM allowance...");
    const { data: approveData } = await api.post("/staking/approve", {
      amount,
    });
    const approveSign = await signTx(
      approveData.unsignedXdr,
      user!.wallet!,
      networkPassphrase ?? TESTNET_PASSPHRASE,
    );
    if ("error" in approveSign) throw new Error(approveSign.error);
    await api.post("/tx/sign-and-submit", {
      signedInnerXdr: [approveSign.signedXdr],
      flow: { action: "approve_xlm" },
    });

    // Step 2: Stake
    setLoadingText("Staking XLM...");
    const { data: stakeData } = await api.post("/staking/stake", { amount });
    const stakeSign = await signTx(
      stakeData.unsignedXdr,
      user!.wallet!,
      networkPassphrase ?? TESTNET_PASSPHRASE,
    );
    if ("error" in stakeSign) throw new Error(stakeSign.error);
    await api.post("/tx/sign-and-submit", {
      signedInnerXdr: [stakeSign.signedXdr],
      flow: { action: "stake" },
    });

    toast.success("Staked successfully!");
    queryClient.invalidateQueries({ queryKey: ["staking-info"] });
    queryClient.invalidateQueries({
      queryKey: ["staking-position", user?.wallet],
    });
    onClose();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Staking failed");
  } finally {
    setLoading(false);
    setLoadingText("");
  }
};
```

Add `const [loadingText, setLoadingText] = useState('')` and show it in the button label.

Also update `submitFlowSchema` in `backend/src/routes/tx.ts` to include `'approve_xlm'`
if it isn't already there (see BUG-04).

---

## 🟠 HIGH — Fix Before Demo

---

### BUG-04 · `tx.ts` — Verify `submitFlowSchema` includes all new action types

**File:** `backend/src/routes/tx.ts`

The schema that validates the `flow.action` field must include every action the
frontend now sends. Confirm the enum includes:

```typescript
action: z.enum([
  'borrow',
  'repay',
  'approve_xlm',   // ← used by staking and deposit approve flows
  'stake',
  'unstake',
  'create_deposit',
  'withdraw_deposit',
  'send',
  'update_metrics',
]).optional(),
```

If any value is missing, Zod throws a 400 validation error and the transaction
is never submitted. Cross-check every `flow: { action: '...' }` call across all
frontend pages against this enum right now.

---

### BUG-05 · `staking/page.tsx` — APY fallback is `8.5` instead of `0`

**File:** `frontend/app/staking/page.tsx` line ~1814

```typescript
// Current: shows 8.5% while loading — was the old hardcoded value
{(info?.apy ?? 8.5).toFixed(1)}%

// Fix: show 0 while loading; real value populates once query resolves
{isInfoLoading ? (
  <div className="skeleton h-12 w-24" />
) : (
  <p className="mt-2 text-5xl font-extrabold text-emerald-500">
    {(info?.apy ?? 0).toFixed(1)}%
  </p>
)}
```

Showing 8.5% APY before data loads is misleading, especially on mainnet where the
real APY starts at 0% until loans accumulate fees.

---

### BUG-06 · Network passphrase fallback uses testnet on mainnet

**Files:** `frontend/app/staking/page.tsx`, `frontend/app/deposit/page.tsx`, possibly others

```typescript
// Current — falls back to testnet passphrase regardless of environment
networkPassphrase ?? TESTNET_PASSPHRASE;

// Fix — fall back to the correct passphrase for the current environment
import {
  TESTNET_PASSPHRASE,
  MAINNET_PASSPHRASE,
  REQUIRED_NETWORK,
} from "@/lib/constants";
const NETWORK_PASSPHRASE =
  REQUIRED_NETWORK === "PUBLIC" ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;

// Then in all signTx calls:
networkPassphrase ?? NETWORK_PASSPHRASE;
```

If `networkPassphrase` from the wallet store is ever null on mainnet, the fallback
sends a testnet-signed transaction to mainnet RPC, which the node rejects with a
passphrase mismatch error. This is a silent, hard-to-debug failure.

---

## 🟡 MEDIUM — Pre-Mainnet Hygiene

---

### ISSUE-01 · `CORS_ORIGINS` must be locked down before mainnet

**File:** `backend/.env` / Railway env vars

The default `CORS_ORIGINS=*` allows any origin to call your backend API. On mainnet
this means anyone can call your fee-bump endpoints from their own website. Set it
to your exact Vercel domain before deploying:

```
CORS_ORIGINS=https://kredito.vercel.app
```

---

### ISSUE-02 · Create `deploy-mainnet.sh`

**File:** `contracts/` — doesn't exist yet

`deploy.sh` hardcodes `NETWORK="testnet"`. There is no mainnet deploy script.
Create `contracts/deploy-mainnet.sh` as a copy of `deploy.sh` with:

```bash
NETWORK="mainnet"
# XLM_SAC_MAINNET is already handled by the if/else in deploy.sh
# Tier limits — consider updating for mainnet (see ISSUE-04)
```

The deploy script also uses `stellar ledger latest` (line 7379). Verify this
command exists in your installed version of `stellar-cli`. If it doesn't, replace with:

```bash
CURRENT_LEDGER=$(curl -s "https://horizon.stellar.org/ledgers?order=desc&limit=1" \
  | jq '._embedded.records[0].sequence')
```

---

### ISSUE-03 · `README.md` still instructs users to use Testnet

**File:** `README.md` lines 12170 and 12239

```
- Freighter Browser Extension (set to Testnet)   ← line 12170
...
Freighter should be installed and pointed at Stellar Testnet  ← line 12239
```

For the judge-facing submission and mainnet demo, these should say:

> "Freighter Browser Extension (set to **Mainnet** for production, Testnet for local dev)"

---

### ISSUE-04 · Tier borrow limits in `deploy.sh` are very small

**File:** `contracts/deploy.sh` lines 7357–7360

```bash
--tier1_limit 10000000    # 1 XLM  ≈ ₱40–50
--tier2_limit 50000000    # 5 XLM  ≈ ₱200–250
--tier3_limit 200000000   # 20 XLM ≈ ₱800–1,000
--kyc_tier_limit 1000000000  # 100 XLM ≈ ₱4,000–5,000
```

At current XLM prices (~₱40/XLM), a Tier 1 max loan of ₱40 is barely meaningful
for Filipino MSMEs. Consider bumping these for mainnet to make the demo compelling
to judges evaluating "Real-World Impact" (30% of score):

```bash
--tier1_limit 50000000      # 5 XLM  ≈ ₱200  (starter)
--tier2_limit 250000000     # 25 XLM ≈ ₱1,000 (small vendor)
--tier3_limit 1000000000    # 100 XLM ≈ ₱4,000 (MSME)
--kyc_tier_limit 5000000000 # 500 XLM ≈ ₱20,000 (verified business)
```

---

### ISSUE-05 · `deployed.json` not visible in repo — confirm it exists locally

The file is gitignored, which is correct. But confirm that your local
`contracts/deployed.json` has the correct testnet contract IDs before running
the mainnet deploy, and that the backend `.env` reflects them. A stale or missing
`deployed.json` will cause every contract call to fail silently.

---

### ISSUE-06 · `redeploy.sh` — verify it no longer references `phpc_token`

**File:** `contracts/redeploy.sh`

From the directory listing the file still exists. Confirm it was updated to
remove all `phpc_token` build/deploy steps and now mirrors the clean structure
of `deploy.sh`. Run `grep -i phpc contracts/redeploy.sh` to verify.

---

## 🟢 LOW / POLISH

---

### POLISH-01 · Staking modal — add two-step progress indicator

Now that staking is a two-transaction flow (approve + stake), the modal should
show the user where they are so they don't think the first signing prompt is a bug:

```
Step 1 of 2 — Approve XLM allowance  [signing...]
Step 2 of 2 — Confirm stake          [signing...]
```

---

### POLISH-02 · Deposit page — show progress indicator for approve + deposit flow

Same two-step pattern as staking. The deposit `time_deposit` also uses
`transfer_from`, so it needs an approve step. Verify the deposit page implements
the same approve-first pattern as staking (BUG-03 above), and add a step indicator.

---

### POLISH-03 · `README.md` — add Hackathon 2026 Updates section

Add a "🚀 What's New (Hackathon 2026)" section at the top of README.md listing:

- XLM-native lending (no custom stablecoin)
- On-chain credit scoring from Horizon wallet history
- Stake & Earn (MasterChef-style reward distribution)
- Time Deposits (30/60-day fixed APY)
- KYC Verified Tier 4
- Multi-platform wallet with GCash/USDC roadmap

---

## Pre-Mainnet Deployment Checklist

Run through this in order on May 22 morning:

```
[x] BUG-01: Add apyBps to deposit.ts + deposit/page.tsx
[x] BUG-02: Add public getters to lending_pool contract
[x] BUG-02: Rebuild contracts: cargo build --workspace --release
[x] BUG-03: Add approve step to staking/page.tsx StakeModal
[x] BUG-04: Audit submitFlowSchema in tx.ts
[x] BUG-05: Fix APY fallback to 0
[x] BUG-06: Fix passphrase fallback to use MAINNET_PASSPHRASE on mainnet
[ ] ISSUE-01: Set CORS_ORIGINS in Railway env vars to production domain
[ ] ISSUE-02: Create deploy-mainnet.sh, verify stellar ledger command
[ ] ISSUE-04: Update tier limits in deploy-mainnet.sh
[ ] Run contracts/deploy-mainnet.sh — save new contract IDs
[ ] Update Railway env vars with mainnet contract IDs
[ ] Update Vercel env vars: NEXT_PUBLIC_NETWORK=PUBLIC
[ ] Trigger Railway redeploy
[ ] Trigger Vercel redeploy
[ ] Test full flow on mainnet production URLs:
    [ ] Connect Freighter (Mainnet) → SEP-10 auth
    [ ] Refresh Score → score appears with breakdown
    [ ] Borrow XLM → sign → check Freighter balance
    [ ] Stake XLM → approve sign → stake sign → position updates
    [ ] KYC form → submit → Tier 4 badge appears
    [ ] Repay loan → score updates
[ ] Take Mainnet screenshot of dashboard (required for submission)
[ ] Take Testnet screenshot (required for submission)
[ ] Record 2-3 min demo video
[ ] Finalize pitch deck
[ ] Submit on Rise In by 11:00 AM — do not wait for noon
```

---

## Estimated Time Budget

| Item                                        | Est. Time      |
| ------------------------------------------- | -------------- |
| BUG-01 (deposit apyBps)                     | 10 min         |
| BUG-02 (public contract getters + rebuild)  | 20 min         |
| BUG-03 (staking approve step)               | 25 min         |
| BUG-04 (verify tx schema)                   | 5 min          |
| BUG-05 + BUG-06 (passphrase + APY fallback) | 10 min         |
| ISSUE-01–06 (hygiene)                       | 20 min         |
| Mainnet deploy + smoke test                 | 30 min         |
| Production hosting setup                    | 20 min         |
| Demo video                                  | 30 min         |
| Pitch deck finalize                         | 30 min         |
| **Total**                                   | **~3.5 hours** |

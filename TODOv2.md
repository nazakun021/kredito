# Kredito — Hackathon Sprint TODO (v3 · Post-Mentor)

### Build on Stellar Philippines 2026

**Testnet Deadline: May 21, 2026 (mentor requirement)**
**Hard Submission Deadline: May 22, 2026 · 12:00 NN**
**Presentation: May 23, 2026 · 3:00 PM @ PDAX Office**

---

## Current Contracts Status ✅

Your contracts are already ahead of the game — no major rewrites needed.

| Contract          | Status     | Notes                                                                          |
| ----------------- | ---------- | ------------------------------------------------------------------------------ |
| `credit_registry` | ✅ Done    | KYC flag, Tier 4, `set_kyc_verified`, `kyc_tier_limit` param in `initialize()` |
| `lending_pool`    | ✅ Done    | XLM via native SAC, staking with reward-per-share, time deposits               |
| `phpc_token`      | ✅ Removed | No longer in `deployed.json` contracts                                         |

**What the contracts still need (small fixes only):**

- Deploy scripts (`deploy.sh`, `redeploy.sh`) still reference `phpc_token` — needs cleanup
- `deploy.sh` `initialize` call for `credit_registry` is missing the `kyc_tier_limit` arg
- `redeploy.sh` still generates `phpc_token` entry in `deployed.json`
- Pool seeding needs to use XLM (approve XLM SAC → deposit)

---

## Legend

| Symbol | Meaning                                            |
| ------ | -------------------------------------------------- |
| 🔴     | **Critical** — disqualified or broken without this |
| 🟠     | **High** — big judging/demo impact                 |
| 🟡     | **Medium** — differentiates from other teams       |
| 🟢     | **Nice-to-have** — do only if time allows          |

---

## Phase 0 — Environment & Script Fixes (May 20 · Do First)

### 0A. Fix Deploy Scripts ✅🔴

**`contracts/redeploy.sh`** — complete rewrite, remove all phpc_token steps:

- [x] Delete Steps 4–9 (Deploy phpc_token, Initialize phpc_token, Mint PHPC, Approve PHPC, Deposit PHPC)
- [x] Add native XLM SAC variable at the top:
  ```bash
  XLM_SAC_TESTNET="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
  XLM_SAC_MAINNET="CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
  XLM_SAC="${NETWORK:-testnet}" == "mainnet" && echo $XLM_SAC_MAINNET || echo $XLM_SAC_TESTNET
  ```
  Simpler — just hardcode per script (testnet script has testnet SAC, mainnet script has mainnet SAC)
- [x] Add `kyc_tier_limit` to `credit_registry` `initialize` call:
  ```bash
  stellar contract invoke --id $REGISTRY_ID --source $SOURCE --network $NETWORK -- \
    initialize \
    --issuer $ISSUER_PUB \
    --tier1_limit 10000000 \      # 1 XLM in stroops
    --tier2_limit 50000000 \      # 5 XLM in stroops
    --tier3_limit 200000000 \     # 20 XLM in stroops
    --kyc_tier_limit 1000000000   # 100 XLM in stroops
  ```
- [x] Update `lending_pool` `initialize` call — use `--xlm_token $XLM_SAC` (no more `--phpc_token`):
  ```bash
  stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
    initialize \
    --admin $ISSUER_PUB \
    --registry_id $REGISTRY_ID \
    --xlm_token $XLM_SAC \
    --flat_fee_bps 500 \
    --loan_term_ledgers 518400
  ```
- [x] Add pool seeding via XLM SAC approve + deposit:

  ```bash
  # Get expiry ledger
  CURRENT_LEDGER=$(stellar ledger --network $NETWORK | jq '.sequence')
  EXPIRY_LEDGER=$((CURRENT_LEDGER + 2000000))

  # Approve lending_pool to pull XLM from issuer
  stellar contract invoke --id $XLM_SAC --source $SOURCE --network $NETWORK -- \
    approve \
    --from $ISSUER_PUB \
    --spender $LENDING_POOL_ID \
    --amount 10000000000 \
    --expiration_ledger $EXPIRY_LEDGER

  # Seed the pool with 1000 XLM
  stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
    deposit \
    --amount 10000000000
  ```

- [x] Update `deployed.json` output at end of script — remove `phpc_token`, add `xlm_sac` used

**`contracts/deploy.sh`** — same fixes as `redeploy.sh` (this is the first-time deploy script):

- [x] Remove all phpc_token steps
- [x] Add `kyc_tier_limit` to registry init
- [x] Update lending_pool init to use `xlm_token`
- [x] Add XLM approve + deposit steps
- [x] Remove phpc_token from `deployed.json` output

### 0B. Testnet Wallet Funding ✅🔴

- [x] Fund testnet issuer via Friendbot:
  ```bash
  curl "https://friendbot.stellar.org/?addr=$(stellar keys address issuer)"
  ```
- [x] Fund a test user wallet via Friendbot for smoke testing borrow/repay/stake flows

### 0C. Mainnet Wallet Funding 🔴

- [x] Verify `GC5MOW3S5CY7G32MQK4VUIBGG3I7J3JSAY4QUISML23AS3MFK226JMV7` has at least 50 XLM (check at stellar.expert) (I only got 2 XLM)

---

## Phase 1 — Deploy & Smoke Test Contracts ✅ (May 20)

- [x] 🔴 `cd contracts && bash redeploy.sh` (testnet) — watch for errors; if deploy fails mid-way, contracts are uninitialized and you must redeploy all from scratch
- [x] 🔴 Verify `deployed.json` updated correctly — should have `credit_registry` and `lending_pool` IDs, `xlm_sac` object, no `phpc_token`
- [x] 🔴 Quick CLI smoke test — confirm contracts work before touching backend:

  ```bash
  # Get tier for fresh wallet (should return 0)
  stellar contract invoke --id $REGISTRY_ID --network testnet -- get_tier \
    --wallet $TEST_WALLET

  # Update metrics and check score
  stellar contract invoke --id $REGISTRY_ID --source issuer --network testnet -- \
    update_metrics_raw \
    --wallet $TEST_WALLET \
    --tx_count 30 \
    --repayment_count 2 \
    --avg_balance 500 \
    --default_count 0

  # Check score (should be ~90 → Tier 2 Silver)
  stellar contract invoke --id $REGISTRY_ID --network testnet -- get_score \
    --wallet $TEST_WALLET

  # Check borrow limit
  stellar contract invoke --id $REGISTRY_ID --network testnet -- get_tier_limit \
    --tier 2
  ```

- [x] 🔴 Take note of all testnet contract IDs — update `backend/.env` before touching any backend code

---

## Phase 2 — Backend: Enhanced On-Chain Credit Scoring (May 20)

> This is the standout feature. The moment a user connects their wallet, Kredito scans
> their entire Stellar history and derives an initial credit score — no self-reporting,
> no forms, no waiting. Pure on-chain truth.

### 2A. Scoring Engine Rewrite (`backend/src/scoring/engine.ts`) 🟠

The current engine does basic scoring. Enhance it to derive a rich initial score from full Horizon history.

**New function: `buildScoreSummaryFromHistory(wallet: string)`**

```typescript
interface HorizonMetrics {
  txCount: number; // total payment operations ever
  walletAgeDays: number; // days since account creation
  currentBalanceXlm: number; // current XLM balance
  inboundPaymentCount: number; // received payments (income signal)
  activitySpanDays: number; // days between first and last tx (consistency signal)
  hasRegularActivity: boolean; // ≥1 tx/month over last 3 months
}
```

**Implementation steps:**

- [ ] 🟠 Add `fetchHorizonMetrics(wallet: string): Promise<HorizonMetrics>` to scoring engine:

  ```typescript
  async function fetchHorizonMetrics(wallet: string): Promise<HorizonMetrics> {
    // 1. Load account — gets created_at, current balance, sequence
    const account = await horizonServer.loadAccount(wallet);
    const currentBalanceXlm = parseFloat(
      account.balances.find((b) => b.asset_type === "native")?.balance ?? "0",
    );
    const createdAt = new Date(account.last_modified_time); // approximate
    const walletAgeDays = (Date.now() - createdAt.getTime()) / 86_400_000;

    // 2. Fetch all payments (paginate up to 200 records)
    const payments = await horizonServer
      .payments()
      .forAccount(wallet)
      .limit(200)
      .order("asc")
      .call();

    const records = payments.records.filter(
      (p) => p.type === "payment" && p.asset_type === "native",
    );

    const txCount = records.length;
    const inboundPaymentCount = records.filter((p) => p.to === wallet).length;

    // Activity span: days between first and last payment
    const activitySpanDays =
      records.length >= 2
        ? (new Date(records[records.length - 1].created_at).getTime() -
            new Date(records[0].created_at).getTime()) /
          86_400_000
        : 0;

    // Regular activity: check last 3 months, at least 3 transactions
    const threeMonthsAgo = Date.now() - 90 * 86_400_000;
    const recentTxCount = records.filter(
      (p) => new Date(p.created_at).getTime() > threeMonthsAgo,
    ).length;
    const hasRegularActivity = recentTxCount >= 3;

    return {
      txCount,
      walletAgeDays,
      currentBalanceXlm,
      inboundPaymentCount,
      activitySpanDays,
      hasRegularActivity,
    };
  }
  ```

- [ ] 🟠 Add `horizonMetricsToContractMetrics(h: HorizonMetrics, repaymentCount: number, defaultCount: number)` — maps Horizon data to the 4 contract fields:

  ```typescript
  function horizonMetricsToContractMetrics(
    h: HorizonMetrics,
    repaymentCount: number,
    defaultCount: number,
  ): ContractMetrics {
    // tx_count: raw payment count, capped at 200 so chronic txers don't game it
    const txCount = Math.min(h.txCount, 200);

    // avg_balance: blend of current balance + age bonus + activity consistency bonus
    // Contract scores avg_balance / 100 * 5, capped at 10 * 5 = 50 pts
    // So avg_balance of 1000 = max balance factor
    const balanceComponent = Math.min(Math.floor(h.currentBalanceXlm * 2), 600);
    const ageBonus = Math.min(Math.floor(h.walletAgeDays / 30) * 50, 300); // 50 per month, max 6 months
    const activityBonus = h.hasRegularActivity ? 100 : 0;
    const avgBalance = Math.min(
      balanceComponent + ageBonus + activityBonus,
      1000,
    );

    return {
      tx_count: txCount,
      repayment_count: repaymentCount,
      avg_balance: avgBalance,
      default_count: defaultCount,
    };
  }
  ```

- [ ] 🟠 Update `buildScoreSummary(wallet)` to use the new Horizon scan:

  ```typescript
  export async function buildScoreSummary(
    wallet: string,
  ): Promise<ScoreSummary> {
    // Fetch Horizon history + existing on-chain credit state in parallel
    const [horizonMetrics, onChainState] = await Promise.all([
      fetchHorizonMetrics(wallet),
      getOnChainCreditSnapshot(wallet).catch(() => null),
    ]);

    const repaymentCount = onChainState?.metrics?.repayment_count ?? 0;
    const defaultCount = onChainState?.metrics?.default_count ?? 0;

    const contractMetrics = horizonMetricsToContractMetrics(
      horizonMetrics,
      repaymentCount,
      defaultCount,
    );

    // ... rest of existing scoring logic
    return {
      metrics: contractMetrics,
      horizonMetrics, // expose for frontend display
      score: computedScore,
      tier,
      tierLabel,
      borrowLimit,
    };
  }
  ```

- [ ] 🟠 **Update `ScoreSummary` type** to include the Horizon breakdown so the frontend can show it:

  ```typescript
  export interface ScoreSummary {
    metrics: ContractMetrics;
    horizonMetrics: HorizonMetrics; // NEW — shown on dashboard
    score: number;
    tier: number;
    tierLabel: string;
    borrowLimit: string;
    kycVerified: boolean; // NEW — pulled from credit_registry
  }
  ```

- [ ] 🟠 **Update `/credit/score` response** to include `horizonMetrics` and `kycVerified`:
      In `backend/src/routes/credit.ts`, after `buildScoreSummary()`, also call `getKycVerified(wallet)` from `credit_registry` and attach to response

### 2B. Remove All PHPC References from Backend 🔴

- [ ] `backend/src/config.ts` — remove `PHPC_ID` from config and `contractIds`; add `XLM_SAC_ID` for both networks
- [ ] `backend/src/stellar/issuer.ts` — delete `phpcClient`, `mintPhpc`, `approvePhpcForPool`; update `toXlmAmount()` function (rename from `toPhpAmount()`)
- [ ] `backend/src/routes/loan.ts` — repay flow no longer needs a separate PHPC `approve` step; remove it; update balance check to read native XLM balance from Horizon
- [ ] `backend/src/routes/tx.ts` — loan `amount`, `fee`, `totalOwed` in response should label as `XLM` not `PHPC`

### 2C. New: Staking Routes (`backend/src/routes/staking.ts`) 🟠

- [ ] `GET /staking/info` — reads `get_pool_balance`, `TotalStaked`, `TotalRewardPool` from lending_pool. Returns:
  ```json
  {
    "totalStaked": "0.0000000",
    "totalRewardPool": "0.0000000",
    "poolBalance": "1000.0000000"
  }
  ```
- [ ] `GET /staking/position` — auth required. Calls `get_stake_info(wallet)` on lending_pool. Returns `{ stakedAmount, pendingRewards, shareBps }`
- [ ] `POST /staking/stake` — auth required. Body: `{ amount: string }`. Builds fee-bumped Soroban invoke for `stake(wallet, amount_in_stroops)`, returns unsigned inner XDR for Freighter to sign
- [ ] `POST /staking/unstake` — auth required. Body: `{ amount: string }`. Builds fee-bumped invoke for `unstake(wallet, amount_in_stroops)`, returns XDR

### 2D. New: Time Deposit Routes (`backend/src/routes/deposit.ts`) 🟡

- [ ] `GET /deposit/terms` — static. Returns available terms:
  ```json
  [
    {
      "termDays": 30,
      "termLedgers": 518400,
      "apyBps": 500,
      "label": "30-Day Deposit"
    },
    {
      "termDays": 60,
      "termLedgers": 1036800,
      "apyBps": 800,
      "label": "60-Day Deposit"
    }
  ]
  ```
- [ ] `GET /deposit/position` — auth required. Calls `get_time_deposit(wallet)` on lending_pool. Returns `{ amount, depositedAt, maturesAt, estimatedInterest, canWithdraw, daysRemaining }`
- [ ] `POST /deposit/create` — auth required. Body: `{ amount: string, termLedgers: number, apyBps: number }`. Builds fee-bumped invoke for `time_deposit(wallet, amount, termLedgers, apyBps)`, returns XDR
- [ ] `POST /deposit/withdraw` — auth required. Builds fee-bumped invoke for `withdraw_time_deposit(wallet)`, returns XDR

### 2E. New: KYC Route with Email (`backend/src/routes/credit.ts`) 🟠

- [ ] `POST /credit/kyc-submit` — auth required. Body:

  ```json
  {
    "fullName": "Juan dela Cruz",
    "email": "juan@email.com",
    "idType": "PhilSys",
    "idNumber": "1234-5678-9012"
  }
  ```

  Handler:
  1. Validate all fields present and email format is valid (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
  2. Log the submission to backend console (or a simple JSON log file) — **do NOT store on-chain; email is PII**
  3. Call `set_kyc_verified(wallet, true)` on credit_registry via issuer-signed fee-bump
  4. Return `{ success: true, tier: 4, message: "KYC verified. Tier 4 unlocked." }`

  > For the demo, this auto-approves immediately. In production, this would go to a review queue.

### 2F. New: Wallet Routes (`backend/src/routes/wallet.ts`) 🟠

- [ ] `GET /wallet/balance` — auth required:
  - `horizonServer.loadAccount(wallet)` → extract native XLM balance
  - Fetch XLM/PHP price from CoinGecko (cache 60s):
    ```
    GET https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php
    ```
  - Return: `{ xlmBalance, phpEquivalent, xlmPricePHP, lastUpdated }`
- [ ] `GET /wallet/transactions` — auth required:
  - `horizonServer.payments().forAccount(wallet).limit(20).order('desc').call()`
  - Filter to native XLM payments only
  - Return formatted: `[{ id, type: 'sent'|'received', amount, date, counterparty, memo, explorerUrl }]`
- [ ] `POST /wallet/send` — auth required. Body: `{ to: string, amount: string, memo?: string }`:
  - Builds a classic Stellar payment operation (not Soroban — just XLM native payment)
  - Uses fee-bump pattern (issuer pays fee)
  - Returns unsigned inner XDR for Freighter to sign
  - Validates `to` is a valid G... address and amount > 0

### 2G. Register All New Routes (`backend/src/index.ts`) 🔴

- [ ] Add imports and mount:

  ```typescript
  import stakingRouter from "./routes/staking";
  import depositRouter from "./routes/deposit";
  import walletRouter from "./routes/wallet";

  app.use("/api/staking", stakingRouter);
  app.use("/api/deposit", depositRouter);
  app.use("/api/wallet", walletRouter);
  ```

---

## Phase 3 — Frontend (May 21)

### 3A. Fix Existing Screens for XLM 🔴

- [ ] **Global find-replace** across all frontend files: `PHPC` → `XLM`, `₱` → `◎` (for XLM amounts), keep `₱` only for PHP equivalent labels
- [ ] **`frontend/lib/constants.ts`**:
  - `REQUIRED_NETWORK = 'PUBLIC'` (mainnet Freighter network string)
  - Add `XLM_STROOP_FACTOR = 10_000_000`
  - Add helper: `xlmToStroops(xlm: number) => Math.round(xlm * 10_000_000)`
  - Add helper: `stroopsToXlm(stroops: number) => (stroops / 10_000_000).toFixed(7)`
- [ ] **`frontend/lib/tiers.ts`** — update tier labels and borrow limits:
  - Tier 1 Bronze: up to `1 XLM`
  - Tier 2 Silver: up to `5 XLM`
  - Tier 3 Gold: up to `20 XLM`
  - Tier 4 Verified: up to `100 XLM`
  - Add Tier 4 gradient: `linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)`
- [ ] **`frontend/components/NetworkBadge.tsx`** — show `Mainnet ✓` (green) for `network === 'PUBLIC'`, `Testnet ✓` (yellow) for `TESTNET`, red warning otherwise
- [ ] **`frontend/lib/constants.ts`** — `REQUIRED_NETWORK = 'PUBLIC'`
- [ ] **`frontend/next.config.ts`** — update CSP `connect-src` to include mainnet RPC URL from env

### 3B. Update Dashboard for New Score Breakdown 🟠

`frontend/app/dashboard/page.tsx`:

- [ ] Add `horizonMetrics` to `ScoreResponse` type:
  ```typescript
  interface ScoreResponse {
    score: number;
    tier: number;
    tierLabel: string;
    borrowLimit: string;
    kycVerified: boolean;
    horizonMetrics: {
      txCount: number;
      walletAgeDays: number;
      currentBalanceXlm: number;
      inboundPaymentCount: number;
      activitySpanDays: number;
      hasRegularActivity: boolean;
    };
    metrics: {
      tx_count: number;
      repayment_count: number;
      avg_balance: number;
      default_count: number;
    };
  }
  ```
- [ ] Add **Score Breakdown section** below the main Credit Passport card — 4 metric pills:
      | Metric | Value | Description |
      |--------|-------|-------------|
      | Wallet Age | X days | How long you've been on Stellar |
      | Transactions | X | Total payment history |
      | XLM Balance | ◎ X | Current balance |
      | Repayments | X | Loans repaid via Kredito |
- [ ] Add **KYC badge** to the Credit Passport card: purple `BadgeCheck` icon + "KYC Verified" when `kycVerified === true`
- [ ] Add **"Get Verified →"** CTA link (when NOT verified) that navigates to `/kyc`
- [ ] Add **Quick Stats row** below breakdown: `◎ X Staked` · `◎ X in Deposits` · `X Active Loans`

### 3C. Update Navigation (`frontend/components/app-shell.tsx`) 🟠

- [ ] Update `navItems` array:
  ```typescript
  const navItems = [
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/dashboard", label: "Credit Score", icon: ShieldCheck },
    { href: "/loan/borrow", label: "Borrow", icon: CreditCard },
    { href: "/loan/repay", label: "Repay", icon: ChartColumn },
    { href: "/staking", label: "Stake & Earn", icon: TrendingUp },
    { href: "/deposit", label: "Time Deposit", icon: Lock },
    { href: "/kyc", label: "Get Verified", icon: BadgeCheck },
  ];
  ```
  (Repay still shows conditionally; `/kyc` shows with "Verified ✓" label when already KYC'd)

### 3D. New Page: Wallet (`/wallet`) 🟠

**File: `frontend/app/wallet/page.tsx`**

The wallet is positioned as a multi-platform Filipino financial hub — XLM today, with clear hooks for GCash, USDC, and other money platforms in the future.

**Section 1 — Balance Hero card:**

- Large XLM balance: `◎ 24.3500 XLM`
- PHP equivalent subtitle: `≈ ₱1,240.00 PHP` (from backend `/wallet/balance`)
- Two primary action buttons: `[↑ Send]` `[↓ Receive]`

**Section 2 — "Connected Money Platforms" card:**

```
This is the visual showpiece. A card with a grid of platform icons showing
Kredito's wallet as the hub that connects to everything.
```

- **Stellar (Native XLM)** — `● Connected` (green badge) — "Your active wallet"
- **GCash** — `○ Coming Soon` (gray badge) — "Top up via Philippine peso on-ramp"
- **USDC** — `○ Coming Soon` (gray badge) — "Stable USD settlements via Circle anchor"
- **PayMaya / Maya** — `○ Coming Soon` — "Local bank transfer gateway"
- **[+] Suggest a platform** — opens a simple toast "Thanks! We'll add it to our roadmap."

> This section directly addresses the mentor's vision. It shows judges and users exactly
> what the future looks like without needing actual integrations yet.

**Section 3 — Recent Transactions:**

- List from `GET /wallet/transactions`
- Each row: direction icon (↑/↓), counterparty address (shortened), XLM amount, date, explorer link
- "No transactions yet" empty state

**Send Modal:**

- Input: recipient G... address
- Input: XLM amount (show PHP equivalent below in real-time)
- Memo input (optional)
- "Review & Sign" → backend `/wallet/send` → XDR → Freighter signs → backend submits

**Receive Modal:**

- Your wallet address with copy button
- QR code of address (use `qrcode` npm package)
- `pnpm add qrcode @types/qrcode` in frontend

- [ ] Create `frontend/app/wallet/page.tsx`
- [ ] Create `frontend/app/wallet/layout.tsx` (AppShell + auth guard)
- [ ] `pnpm add qrcode @types/qrcode` in frontend
- [ ] Build `SendModal` component
- [ ] Build `ReceiveModal` component
- [ ] Build `ConnectedPlatformsCard` component

### 3E. New Page: Stake & Earn (`/staking`) 🟠

**File: `frontend/app/staking/page.tsx`**

**Section 1 — Pool Overview:**

- Total XLM Staked: `◎ X XLM`
- Reward Pool: `◎ X XLM`
- "How it works" — 3 step flow: `Stake XLM → Borrowers pay interest → Earn your share`

**Section 2 — Your Position:**

- Your staked: `◎ X XLM`
- Pending rewards: `◎ X XLM`
- Pool share: `X.XX%`
- `[Stake XLM]` button (always shown)
- `[Unstake & Claim]` button (shown when stake > 0)

**Stake Modal:**

- XLM amount input
- Live preview: "Estimated return at 8% APY over 30 days: ◎ X XLM"
- Note: "Rewards are sourced from borrower interest fees. APY varies with loan volume."
- Sign flow → backend `/staking/stake` → XDR → Freighter

**Unstake Modal:**

- Show: Principal `◎ X` + Pending Rewards `◎ X` = Total `◎ X`
- `[Claim & Unstake]` → backend `/staking/unstake` → XDR → Freighter

- [ ] Create `frontend/app/staking/page.tsx`
- [ ] Create `frontend/app/staking/layout.tsx`

### 3F. New Page: Time Deposit (`/deposit`) 🟡

**File: `frontend/app/deposit/page.tsx`**

**Section 1 — Available Terms:**
| Term | APY | Min | Action |
|------|-----|-----|--------|
| 30 Days | 5% | 0.1 XLM | `[Lock XLM]` |
| 60 Days | 8% | 0.1 XLM | `[Lock XLM]` |

**Section 2 — Your Deposit:**

- If no active deposit: empty state with CTA
- If active: Amount, Deposited date, Matures date, Estimated return, Days remaining progress bar
- `[Withdraw]` button (enabled when matured; disabled with countdown if not)
- `[Early Withdraw]` link (shows penalty warning modal first)

**Deposit Modal:**

- Amount input
- Term selector (radio: 30 days / 60 days)
- Preview: "At maturity you will receive ◎ X.XXXXXXX XLM"
- Sign flow → backend `/deposit/create` → XDR → Freighter

- [ ] Create `frontend/app/deposit/page.tsx`
- [ ] Create `frontend/app/deposit/layout.tsx`

### 3G. New Page: Get Verified / KYC (`/kyc`) 🟠

**File: `frontend/app/kyc/page.tsx`**

**State A — Not Verified:**

- Hero: Purple shield icon + "Unlock Tier 4 Verified" + "Borrow up to ◎100 XLM"
- Benefits: Higher limit, lower fee (Tier 4 has best fee rate), KYC Verified badge
- Form:
  - Full Name (text input)
  - Email Address (email input — _not stored on-chain; used for account notifications_)
  - ID Type (select: PhilSys / SSS / GSIS / Driver's License / Passport)
  - ID Number (text input)
  - Checkbox: "I consent to Kredito verifying my identity off-chain"
- Disclaimer below form: "Your personal information is processed securely off-chain. Only a verification flag is stored on the Stellar blockchain."
- `[Submit for Verification]` → POST `/credit/kyc-submit` → auto-approves → toast "Tier 4 Verified ✓" → redirect to dashboard

**State B — Already Verified:**

- Large green/purple `BadgeCheck` icon
- "Identity Verified" heading
- "Your wallet is KYC verified. You have access to Tier 4 borrowing limits (up to ◎100 XLM)."
- Link back to dashboard

- [ ] Create `frontend/app/kyc/page.tsx`
- [ ] Create `frontend/app/kyc/layout.tsx`

### 3H. Update Borrow Page for XLM 🔴

`frontend/app/loan/borrow/page.tsx`:

- [ ] Amount input now accepts XLM (e.g., `2.5`) — show PHP equivalent below input in real-time
- [ ] Remove PHPC approve step from the borrow transaction flow — XLM transfer is direct, no pre-approve needed
- [ ] Show borrow limit in XLM: `Your limit: ◎ 5 XLM (Tier 2 Silver)`
- [ ] Fee breakdown in XLM: `Fee: ◎ 0.125 XLM (5%) → Total owed: ◎ 2.625 XLM`

### 3I. Update Repay Page for XLM 🔴

`frontend/app/loan/repay/page.tsx`:

- [ ] Repay is now a **single transaction** (no more PHPC approve + repay two-step) — update the step UI to remove the approval step
- [ ] Show amount owed in XLM: `You owe ◎ 2.625 XLM`
- [ ] Shortfall banner: if user's XLM balance < totalOwed, show: `"Insufficient XLM. You need ◎ X more XLM to repay. Get XLM on Lobstr or PDAX."`
- [ ] Show PHP equivalent of amount owed

---

## Phase 4 — Hosting & Deployment (May 21–22)

### 4A. Deploy to Testnet (Target: May 21, EOD) 🔴

- [ ] Run `contracts/redeploy.sh` (after Phase 0 fixes)
- [ ] Update `contracts/deployed.json` — confirm no phpc_token, confirm xlm_sac entries
- [ ] Update `backend/.env` with new testnet contract IDs
- [ ] Run backend locally and test all new endpoints:
  - `GET /api/credit/score?wallet=G...` — confirm horizonMetrics in response
  - `POST /api/credit/kyc-submit` — confirm on-chain flag set
  - `GET /api/staking/info` — confirm pool balance shows
  - `GET /api/wallet/balance` — confirm XLM + PHP price
- [ ] Run frontend locally (testnet mode) and test full user flow
- [ ] **Take testnet screenshots** — dashboard with score breakdown, wallet page, staking page, KYC page (required for submission)

### 4B. Deploy Backend to Railway 🔴

- [ ] Verify Railway project has all env vars set (mainnet RPC, Horizon, contract IDs from mainnet deploy)
- [ ] Trigger Railway deploy (push to main or manual)
- [ ] Verify health: `curl https://your-railway-url.railway.app/api/health`
- [ ] Test SEP-10 challenge from the live URL
- [ ] Set up Railway cron for `POST /api/admin/check-defaults` — every 6 hours

### 4C. Deploy Frontend to Vercel 🔴

- [ ] Set Vercel env vars:
  - `NEXT_PUBLIC_NETWORK=mainnet`
  - `NEXT_PUBLIC_API_URL=https://your-railway-url.railway.app/api`
  - `NEXT_PUBLIC_EXPLORER_URL=https://stellar.expert/explorer/public`
  - `NEXT_PUBLIC_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm`
- [ ] Trigger Vercel deploy
- [ ] Test all routes on the live URL: `/wallet`, `/dashboard`, `/staking`, `/deposit`, `/kyc`

### 4D. Deploy Contracts to Mainnet (May 22, target 10 AM) 🔴

- [ ] Create `contracts/deploy-mainnet.sh` — copy of `redeploy.sh` with:
  - `NETWORK="mainnet"`
  - `XLM_SAC="CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"`
- [ ] Run `contracts/deploy-mainnet.sh` — watch for XLM balance errors
- [ ] Update Railway env vars with mainnet contract IDs
- [ ] Re-trigger Railway deploy
- [ ] Full end-to-end test on production URLs (not localhost)
- [ ] **Take mainnet screenshot** of dashboard with live score + tier (required for submission)

---

## Phase 5 — Submission Materials (May 22 · Morning) 🔴

### 5A. README Updates

- [ ] Add **`## 🚀 Hackathon 2026 Updates (May 18–24)`** section at the very top:

  ```markdown
  ## 🚀 Hackathon 2026 Updates (May 18–24)

  ### What's New vs Bootcamp

  - **XLM-Native Lending** — migrated from custom PHPC stablecoin to native XLM
  - **On-Chain Credit Scoring** — scans full Stellar wallet history via Horizon API to
    derive initial credit score with no self-reporting required
  - **Wallet with Multi-Platform Vision** — GCash, USDC, Maya connection roadmap built into UI
  - **Stake & Earn** — deposit XLM into lending pool, earn share of borrower interest fees
  - **Time Deposits** — lock XLM for 30/60 days, earn fixed APY
  - **KYC Verification** — submit email + ID to unlock Tier 4 (◎100 XLM borrow limit)

  ### Mainnet Contract Addresses

  | Contract          | Address                          |
  | ----------------- | -------------------------------- |
  | `credit_registry` | `<FILL IN AFTER MAINNET DEPLOY>` |
  | `lending_pool`    | `<FILL IN AFTER MAINNET DEPLOY>` |
  ```

- [ ] Embed testnet screenshot
- [ ] Embed mainnet screenshot
- [ ] Add live app URL, demo video link, pitch deck link

### 5B. Demo Video (2–3 min) 🔴

Record with Freighter open on Mainnet. Script:

| Time      | Scene                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:15 | Hook: "33M Filipinos can't get a bank loan. Kredito reads their Stellar history and changes that."                                                     |
| 0:15–0:45 | **Wallet page** — show XLM balance + PHP equivalent + Connected Platforms card (GCash coming soon)                                                     |
| 0:45–1:05 | **Credit Score** — connect Freighter → click Refresh Score → watch Horizon history scan → score appears with breakdown (wallet age, tx count, balance) |
| 1:05–1:25 | **Borrow** — enter ◎2 XLM → review fee → sign → Freighter shows XLM increase → click Stellar Expert link to show on-chain tx                           |
| 1:25–1:40 | **KYC** — fill form (name, email, ID) → submit → Tier 4 Verified badge appears → borrow limit jumps to ◎100 XLM                                        |
| 1:40–1:55 | **Stake & Earn** — stake ◎5 XLM → show pool share and pending rewards                                                                                  |
| 1:55–2:10 | **Repay** — repay loan → score updates on dashboard                                                                                                    |
| 2:10–2:30 | Close: "Kredito — built on Stellar Mainnet. Scan. Score. Borrow. Earn." Show live URL + GitHub                                                         |

- [ ] Record video (OBS/Loom, 1080p)
- [ ] Upload to YouTube (unlisted) or Loom

### 5C. Pitch Deck (10 Slides) 🔴

- [ ] **Slide 1** — Title: "Kredito: Your On-Chain Credit Passport" + "The Filipino Blockchain Wallet" + live URL
- [ ] **Slide 2** — Problem: 33M unbanked, informal lenders at 20–30%/mo, digital wallets with no credit path
- [ ] **Slide 3** — Insight: "Your Stellar wallet already tells your financial story. We just read it."
- [ ] **Slide 4** — Solution overview: wallet → scan → score → borrow → earn cycle diagram
- [ ] **Slide 5** — Product screenshots: wallet page + credit score breakdown + KYC verified badge
- [ ] **Slide 6** — Technical architecture: Soroban contracts (credit_registry + lending_pool) + Horizon API scoring engine + Express + Next.js + SEP-10 + fee-bumps
- [ ] **Slide 7** — What's New (Hackathon 2026): side-by-side vs Bootcamp
- [ ] **Slide 8** — Multi-Platform Wallet vision: screenshot of Connected Platforms card, roadmap for GCash/USDC/Maya
- [ ] **Slide 9** — Judging criteria map: real-world impact (MSME loans), tech execution (Soroban inter-contract calls + Horizon scoring), UX (gasless fee-bumps), innovation (on-chain credit history), feasibility (live on Mainnet today)
- [ ] **Slide 10** — Roadmap + Team: your name, GitHub, live URL

- [ ] Upload to Google Drive (Anyone with link can view)

### 5D. Rise In Submission Checklist 🔴

**Submit before May 22, 12:00 NN. Do not wait until 11:59.**

- [ ] GitHub Repo URL: `https://github.com/nazakun021/kredito`
- [ ] Demo Video URL
- [ ] Pitch Deck URL
- [ ] Testnet screenshot (dashboard with score + horizon metrics breakdown)
- [ ] Mainnet screenshot (same)
- [ ] Live app URL
- [ ] All 3 mainnet contract addresses

---

## Phase 6 — Presentation Day (May 22–23)

- [ ] 🔴 Practice live demo 3× — wallet → score → borrow → KYC → stake — timed at 3 min flat
- [ ] 🔴 Prepare screen recording backup in case of live internet issues at PDAX
- [ ] 🟠 Prepare Q&A answers:

  **"Why XLM not a stablecoin like PHPC?"**

  > XLM is native to Stellar — zero friction, no token minting needed. The wallet shows PHP equivalent in real-time. A peso-pegged stablecoin anchor (GCash → PHP → XLM) is the next milestone.

  **"How accurate is the on-chain credit score for new wallets?"**

  > For wallets with little history, the score is low but honest — it reflects their current on-chain footprint. It grows naturally as they transact. This is analogous to how a traditional credit score starts low for new borrowers.

  **"Could someone game the score by sending transactions to themselves?"**

  > We weight _inbound_ payments and _activity span_ (how consistently active over months) more heavily than raw tx count. A wallet that just spam-sends to itself won't have regular inbound payments or a long activity span. Plus, on-chain behavior is immutable — faking a 2-year wallet history is economically expensive.

  **"Where does the pool liquidity come from?"**

  > Initially seeded by the issuer. The staking feature lets community members add liquidity and earn returns. Post-hackathon, the roadmap includes DAO-governed pool management and institutional depositors.

  **"Is GCash integration real?"**

  > The UI shows the integration architecture and roadmap. Actual integration requires BSP licensing and a Stellar anchor partner — both are on the post-hackathon roadmap.

- [ ] 🟠 Check Railway + Vercel are healthy morning of May 23
- [ ] 🟡 Bring mobile device with Freighter — showing wallet on mobile is powerful

---

## File Change Summary

| File                                   | Action                                     | Phase |
| -------------------------------------- | ------------------------------------------ | ----- |
| `contracts/deploy.sh`                  | Fix — remove phpc_token, add xlm params    | 0     |
| `contracts/redeploy.sh`                | Fix — remove phpc_token, add xlm params    | 0     |
| `contracts/deployed.json`              | Update after each deploy                   | 1, 4  |
| `backend/src/config.ts`                | Remove PHPC_ID, add XLM_SAC_ID             | 2B    |
| `backend/src/stellar/issuer.ts`        | Remove phpc client/mint/approve            | 2B    |
| `backend/src/scoring/engine.ts`        | **Full rewrite** — Horizon history scoring | 2A    |
| `backend/src/routes/credit.ts`         | Add `/kyc-submit` with email               | 2E    |
| `backend/src/routes/loan.ts`           | Remove PHPC approve step, XLM amounts      | 2B    |
| `backend/src/routes/tx.ts`             | XLM amount labels                          | 2B    |
| `backend/src/routes/staking.ts`        | **New**                                    | 2C    |
| `backend/src/routes/deposit.ts`        | **New**                                    | 2D    |
| `backend/src/routes/wallet.ts`         | **New**                                    | 2F    |
| `backend/src/index.ts`                 | Register new routers                       | 2G    |
| `frontend/lib/constants.ts`            | REQUIRED_NETWORK, XLM helpers              | 3A    |
| `frontend/lib/tiers.ts`                | Tier 4 + XLM limits                        | 3A    |
| `frontend/components/NetworkBadge.tsx` | Mainnet ✓ for PUBLIC                       | 3A    |
| `frontend/components/app-shell.tsx`    | New nav items                              | 3C    |
| `frontend/next.config.ts`              | CSP mainnet RPC                            | 3A    |
| `frontend/app/dashboard/page.tsx`      | Horizon breakdown, KYC badge               | 3B    |
| `frontend/app/wallet/page.tsx`         | **New** — wallet hub                       | 3D    |
| `frontend/app/wallet/layout.tsx`       | **New**                                    | 3D    |
| `frontend/app/staking/page.tsx`        | **New**                                    | 3E    |
| `frontend/app/staking/layout.tsx`      | **New**                                    | 3E    |
| `frontend/app/deposit/page.tsx`        | **New**                                    | 3F    |
| `frontend/app/deposit/layout.tsx`      | **New**                                    | 3F    |
| `frontend/app/kyc/page.tsx`            | **New** — KYC with email                   | 3G    |
| `frontend/app/kyc/layout.tsx`          | **New**                                    | 3G    |
| `frontend/app/loan/borrow/page.tsx`    | XLM amounts, remove approve step           | 3H    |
| `frontend/app/loan/repay/page.tsx`     | XLM amounts, single-step repay             | 3I    |
| `README.md`                            | Hackathon 2026 section + screenshots       | 5A    |

---

## Daily Schedule

### May 20 (Today)

```
AM:  Phase 0 (fix deploy scripts, fund wallets)
AM:  Phase 1 (deploy contracts to testnet, CLI smoke test)
PM:  Phase 2A (scoring engine rewrite — most important backend change)
PM:  Phase 2B–2G (remove PHPC refs, add all new routes)
EVE: Phase 3A (global XLM fixes on frontend)
```

### May 21

```
AM:  Phase 3B–3C (dashboard updates, new navigation)
AM:  Phase 3D (Wallet page — most complex new UI)
PM:  Phase 3E (Staking page)
PM:  Phase 3F–3G (Time deposit + KYC pages)
PM:  Phase 3H–3I (Borrow + Repay pages)
EVE: Phase 4A (testnet full end-to-end test + screenshots)
EVE: Phase 4B–4C (Railway + Vercel deploy)
```

### May 22

```
07:00  Phase 4D — Mainnet contract deploy
08:00  Update Railway env vars → redeploy backend
08:30  Full production end-to-end test + mainnet screenshot
09:00  Phase 5A — README
09:30  Phase 5B — Demo video (1 take, upload immediately)
10:15  Phase 5C — Pitch deck final
11:00  Phase 5D — SUBMIT ON RISE IN ← do not wait
11:00  Rest. You're done.
```

### May 23

```
AM:   Practice pitch × 3
3 PM: PDAX Office — present, demo, win ₱25,000 🏆
```

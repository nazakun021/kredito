# Kredito — Hackathon Sprint TODO (Post-Mentor Pivot)

## Build on Stellar Philippines 2026

**Testnet Deadline: May 21, 2026** (mentor requirement)
**Hard Submission Deadline: May 22, 2026 · 12:00 NN**
**Presentation: May 23, 2026 · 3:00 PM @ PDAX Office**

---

## What Changed After the Mentor Meeting

| Before                           | After                                                |
| -------------------------------- | ---------------------------------------------------- |
| PHPC custom stablecoin for loans | **Native XLM** as primary currency                   |
| Borrower-only platform           | **Wallet-first** Filipino financial app              |
| No staking                       | **Staking**: deposit XLM into pool, earn interest    |
| No time deposit                  | **Time Deposit**: lock XLM, earn fixed APY           |
| No KYC UI                        | **KYC**: transaction history + ID form → tier unlock |
| No GCash                         | **GCash integration framed** in wallet UI            |

---

## Legend

| Symbol | Meaning                                            |
| ------ | -------------------------------------------------- |
| 🔴     | **Critical** — disqualified or broken without this |
| 🟠     | **High** — big judging/demo impact                 |
| 🟡     | **Medium** — differentiates from other teams       |
| 🟢     | **Nice-to-have** — do only if time allows          |

---

## Architecture Overview (New)

```txt
Kredito Wallet — Filipino Blockchain Financial App
├── Wallet          XLM balance, send, receive, QR code, PHP equivalent
├── Credit Passport On-chain score from transaction history (existing, enhanced)
├── Borrow          XLM micro-loan from pool, backed by credit tier
├── Repay           Repay XLM + interest
├── Stake           Deposit XLM → earn share of borrower interest
├── Time Deposit    Lock XLM for fixed term → earn guaranteed APY
└── KYC             Submit ID → unlock higher tier → higher borrow limit
```

**Contracts (new set):**

```txt
credit_registry   (existing, + kyc_flag)
lending_pool      (rewrite: PHPC → native XLM SAC, + staking, + time_deposit)
```

`phpc_token` contract is **removed entirely**.

---

## Phase 0 — Critical Prep (May 20 · Do First)

- [x] 🔴 **Create branch `hackathon-2026`** — all commits during May 18–24 must be on this branch with clear dated commit messages so judges can verify new work
- [x] 🔴 **Fund testnet issuer wallet** via Friendbot: `https://friendbot.stellar.org/?addr=<ISSUER_PUB>`
- [x] 🔴 **Fund mainnet issuer wallet** (`GC5MOW3S5CY7G32MQK4VUIBGG3I7J3JSAY4QUISML23AS3MFK226JMV7`) with at least 50 XLM via Lobstr or PDAX — needed for Mainnet contract deployments (I only got 2 XLM)
- [x] 🔴 **Get the native XLM Stellar Asset Contract (SAC) ID** for both networks, you'll need these in the contracts:

  ```bash
  # Testnet
  stellar contract id asset --asset native --network testnet
  # Mainnet
  stellar contract id asset --asset native --network mainnet
  ```

  Save both IDs — the lending_pool will reference the native XLM SAC instead of phpc_token

---

## Phase 1 — Smart Contract Rewrite (May 20)

> This is the highest-risk phase. Do it first. Everything else depends on it.

### 1A. Remove `phpc_token` Contract

- [x] 🔴 **Delete `contracts/phpc_token/`** directory — this contract is no longer needed since native XLM replaces it
- [x] 🔴 **Remove `phpc_token` from `contracts/Cargo.toml`** workspace members
- [x] 🔴 **Update `contracts/deployed.json`** — remove `phpc_token` entry

### 1B. Rewrite `lending_pool` to Use Native XLM

The pool previously held PHPC. It now holds XLM via the native Stellar Asset Contract (SAC). The key change: replace all `phpc_token::Client` calls with `token::Client` pointing at the native XLM SAC.

**`contracts/lending_pool/src/lib.rs` changes:**

- [x] 🔴 **Add `soroban-sdk` token interface import**:

  ```rust
  use soroban_sdk::token;
  ```

- [x] 🔴 **Add `XlmToken` to `DataKey`** to store the native XLM SAC contract ID at init time:

  ```rust
  pub enum DataKey {
      Admin,
      RegistryId,
      XlmToken,       // replaces PhpcToken
      FlatFeeBps,
      LoanTermLedgers,
      PoolBalance,
      Loan(Address),
      // ... existing keys
  }
  ```

- [x] 🔴 **Update `initialize()` signature** — replace `phpc_token: Address` with `xlm_token: Address` (the native XLM SAC address):

  ```rust
  pub fn initialize(
      env: Env,
      admin: Address,
      registry_id: Address,
      xlm_token: Address,   // ← was phpc_token
      flat_fee_bps: u32,
      loan_term_ledgers: u32,
  )
  ```

- [x] 🔴 **Update `borrow()` function** — replace PHPC transfer with XLM transfer:

  ```rust
  // Old: phpc_client.transfer_from(&env.current_contract_address(), &borrower, &amount)
  // New:
  let xlm = token::Client::new(&env, &get_xlm_token(&env));
  xlm.transfer(&env.current_contract_address(), &borrower, &amount);
  ```

- [x] 🔴 **Update `repay()` function** — replace PHPC transfer_from with XLM transfer_from:

  ```rust
  // Borrower must approve pool before calling repay
  let xlm = token::Client::new(&env, &get_xlm_token(&env));
  xlm.transfer_from(&env.current_contract_address(), &borrower, &env.current_contract_address(), &total_owed);
  ```

- [x] 🔴 **Update `deposit()` function** (admin seeds pool) — transfer XLM from admin to contract:

  ```rust
  let xlm = token::Client::new(&env, &get_xlm_token(&env));
  xlm.transfer_from(&env.current_contract_address(), &admin, &env.current_contract_address(), &amount);
  ```

- [x] 🔴 **Update `pool_balance()` getter** — read from contract's XLM balance via SAC:

  ```rust
  pub fn pool_balance(env: Env) -> i128 {
      let xlm = token::Client::new(&env, &get_xlm_token(&env));
      xlm.balance(&env.current_contract_address())
  }
  ```

### 1C. Add Staking to `lending_pool`

- [x] 🟠 **Add staking data keys** to `DataKey`:

  ```rust
  TotalStaked,
  StakerBalance(Address),    // how much XLM this address has staked
  RewardDebt(Address),       // rewards already claimed/accounted for
  AccRewardPerShare,         // accumulated rewards per staked unit (scaled by 1e7)
  TotalRewardPool,           // XLM set aside for staker rewards
  ```

- [x] 🟠 **Add `stake(env, staker, amount)` function**:
  - `staker.require_auth()`
  - Transfer `amount` XLM from staker to contract via SAC
  - Update `StakerBalance(staker)` and `TotalStaked`
  - Emit `stake` event
  - Stakers earn from the `flat_fee_bps` charged to borrowers — when a loan repayment comes in, the fee portion is split: 50% goes to reward pool for stakers, 50% stays as pool liquidity

- [x] 🟠 **Add `unstake(env, staker, amount)` function**:
  - `staker.require_auth()`
  - Calculate proportional rewards: `(staker_balance / total_staked) * total_reward_pool`
  - Transfer `amount + rewards` XLM back to staker
  - Update balances, emit `unstake` event

- [x] 🟠 **Add `get_stake_info(env, staker) -> StakeInfo` getter**:

  ```rust
  pub struct StakeInfo {
      pub staked_amount: i128,
      pub pending_rewards: i128,
      pub share_percent: u32,   // basis points of total pool
  }
  ```

- [x] 🟠 **Update `repay()` to route fees to reward pool**: when repayment comes in, call an internal `distribute_fee_to_stakers(fee_amount)` that adds to `TotalRewardPool`

### 1D. Add Time Deposit to `lending_pool` 🟡

- [x] **Add time deposit data keys**:

  ```rust
  TimeDeposit(Address),
  ```

- [x] **Add `TimeDepositRecord` struct**:

  ```rust
  pub struct TimeDepositRecord {
      pub amount: i128,
      pub deposited_at: u32,    // ledger sequence
      pub term_ledgers: u32,    // e.g., 518400 ≈ 30 days
      pub apy_bps: u32,         // fixed APY in basis points (e.g., 500 = 5%)
      pub matured: bool,
  }
  ```

- [x] **Add `time_deposit(env, depositor, amount, term_ledgers)` function**:
  - Accepts XLM, stores `TimeDepositRecord`
  - Fixed APY of 500 bps (5%) for 30-day term, 800 bps for 60-day term
  - Emit `time_deposit` event

- [x] **Add `withdraw_time_deposit(env, depositor)` function**:
  - Check `current_ledger >= deposited_at + term_ledgers`
  - Calculate interest: `amount * apy_bps / 10_000 * actual_days / 365`
  - Transfer `amount + interest` back to depositor
  - If withdrawn early: return principal only, no interest (penalty)

### 1E. Add KYC Flag to `credit_registry`

- [x] 🟠 **Add `KycVerified(Address)` to `credit_registry` DataKey**
- [x] 🟠 **Add `set_kyc_verified(env, wallet, verified)` function** — issuer-only auth
- [x] 🟠 **Add `kyc_verified(env, wallet) -> bool` getter**
- [x] 🟠 **Add `KycTierLimit` to storage** — issuer sets this at init. Suggested: 5x the Tier 3 limit (₱250,000 equivalent in XLM)
- [x] 🟠 **Update tier resolution**: if `kyc_verified == true` AND score >= BRONZE_MIN_SCORE, return tier 4 ("Verified") with the higher limit

### 1F. Build & Deploy to Testnet (Deadline: May 21)

- [ ] 🔴 **Create `contracts/deploy-testnet.sh`** — updated version of redeploy.sh without phpc_token, with new staking init:

  ```bash
  NETWORK="testnet"
  XLM_SAC="<native XLM SAC ID for testnet>"

  # Build
  stellar contract build --package credit_registry
  stellar contract build --package lending_pool

  # Deploy credit_registry
  REGISTRY_ID=$(stellar contract deploy --wasm .../credit_registry.wasm ...)
  stellar contract invoke --id $REGISTRY_ID ... initialize \
    --issuer $ISSUER_PUB \
    --tier1_limit 10000000 \   # 1 XLM (in stroops × 10^7)
    --tier2_limit 50000000 \   # 5 XLM
    --tier3_limit 200000000    # 20 XLM

  # Deploy lending_pool
  LENDING_POOL_ID=$(stellar contract deploy --wasm .../lending_pool.wasm ...)
  stellar contract invoke --id $LENDING_POOL_ID ... initialize \
    --admin $ISSUER_PUB \
    --registry_id $REGISTRY_ID \
    --xlm_token $XLM_SAC \
    --flat_fee_bps 500 \
    --loan_term_ledgers 518400

  # Seed pool: deposit 1000 XLM (the issuer sends XLM to pool)
  stellar contract invoke --id $LENDING_POOL_ID ... deposit --amount 10000000000
  ```

- [ ] 🔴 **Run the deploy script** and save all testnet contract IDs to `deployed.json`
- [ ] 🔴 **Test happy path on Testnet**: connect → score → borrow XLM → repay XLM → score updates
- [ ] 🔴 **Test staking on Testnet**: stake XLM → take out a loan and repay it → check staker rewards → unstake
- [ ] 🔴 **Take Testnet screenshots** (required for submission): dashboard showing XLM borrow limit, wallet page, staking page

---

## Phase 2 — Backend Updates (May 20–21)

### 2A. Remove PHPC, Add XLM Logic 🔴

- [ ] **Delete `phpc_token` references** from `backend/src/config.ts` — remove `PHPC_ID` from `contractIds`
- [ ] **Update `backend/src/stellar/issuer.ts`** — remove all `phpcClient` calls. The pool now holds XLM natively; no token approval needed
- [ ] **Update `backend/src/scoring/engine.ts`** — loan amounts are now in XLM stroops (7 decimals, same as PHPC stroops), so `toPhpAmount()` should be renamed `toXlmAmount()` and use XLM decimals. Update the display label from "PHPC" to "XLM"
- [ ] **Update `backend/src/routes/loan.ts`**:
  - Repay flow no longer needs the PHPC `approve` step — the user approves the native XLM SAC directly (one fewer step)
  - Remove PHPC balance check; replace with XLM balance check via `horizonServer.loadAccount(wallet).then(acc => acc.balances.find(b => b.asset_type === 'native').balance)`
  - The `InsufficientBalance` error should now show shortfall in XLM
- [ ] **Update `backend/src/routes/tx.ts`** — loan amounts (`amount`, `fee`, `totalOwed`) should now format as XLM (e.g., `12.5 XLM`) not PHP pesos
- [ ] **Update `backend/src/config.ts`** — remove `PHPC_ID`, add `XLM_SAC_ID` for both networks

### 2B. New Staking Routes 🟠

- [ ] **Add `backend/src/routes/staking.ts`**:

  ```typescript
  GET  /staking/info           → { totalStaked, apy, rewardPool }
  GET  /staking/position       → { stakedAmount, pendingRewards, sharePercent } (auth required)
  POST /staking/stake          → build & return unsigned stake tx XDR (auth required)
  POST /staking/unstake        → build & return unsigned unstake tx XDR (auth required)
  ```

- [ ] **Build fee-bumped stake/unstake transactions** in the staking route — same pattern as borrow/repay: build the Soroban invocation, wrap in a fee-bump sponsored by issuer, return XDR for frontend to sign

### 2C. New Time Deposit Routes 🟡

- [ ] **Add `backend/src/routes/deposit.ts`**:

  ```typescript
  GET  /deposit/terms          → [{ term_days: 30, apy_bps: 500 }, { term_days: 60, apy_bps: 800 }]
  GET  /deposit/position       → { amount, depositedAt, maturesAt, estimatedReturn, canWithdraw }
  POST /deposit/create         → build & return unsigned time_deposit tx XDR
  POST /deposit/withdraw       → build & return unsigned withdraw tx XDR
  ```

### 2D. New KYC Route 🟠

- [ ] **Add `POST /credit/kyc-submit`** (auth required) — accepts `{ fullName, idType, idNumber }`, logs the submission, calls `set_kyc_verified(wallet, true)` on `credit_registry` via issuer-signed fee-bump. For the demo, auto-approve immediately (no human review queue needed)
- [ ] **Update `GET /credit/score`** response to include `kycVerified: boolean`

### 2E. New Wallet Route 🟠

- [ ] **Add `GET /wallet/balance`** (auth required):
  - Calls `horizonServer.loadAccount(wallet)`
  - Returns `{ xlmBalance: string, xlmBalanceStroops: string, phpEquivalent: string }`
  - For PHP equivalent: fetch XLM price from CoinGecko API: `GET https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php` — cache for 60 seconds
- [ ] **Add `GET /wallet/transactions`** (auth required):
  - Calls `horizonServer.loadAccount(wallet).transactions().limit(20).order('desc').call()`
  - Returns last 20 transactions formatted as `{ id, type, amount, asset, date, memo, explorerUrl }`
- [ ] **Register new routers** in `backend/src/index.ts`:

  ```typescript
  app.use("/api/staking", stakingRouter);
  app.use("/api/deposit", depositRouter);
  app.use("/api/wallet", walletRouter);
  ```

### 2F. Register Routes in `backend/src/index.ts`

- [ ] Add `import stakingRouter from './routes/staking'`
- [ ] Add `import depositRouter from './routes/deposit'`
- [ ] Add `import walletRouter from './routes/wallet'`
- [ ] Mount all three routers

---

## Phase 3 — Frontend Overhaul (May 21)

### 3A. Update Existing Screens for XLM 🔴

- [ ] **Global find-replace `PHPC` → `XLM`** in all frontend files
- [ ] **Update `frontend/lib/tiers.ts`** — update borrow limit labels from peso (₱) to XLM (◎ or just `XLM`):
  - Tier 1 Bronze: borrow up to 1 XLM
  - Tier 2 Silver: borrow up to 5 XLM
  - Tier 3 Gold: borrow up to 20 XLM
  - Tier 4 Verified (KYC): borrow up to 100 XLM
- [ ] **Update `frontend/lib/constants.ts`** — add `XLM_SAC_ID`, `REQUIRED_NETWORK = 'PUBLIC'` (for mainnet), update `TESTNET_PASSPHRASE` → keep, add `MAINNET_PASSPHRASE`
- [ ] **Update `frontend/components/NetworkBadge.tsx`** — show "Mainnet ✓" (green) when `network === 'PUBLIC'`; show "Testnet ✓" for testnet; red warning for mismatch
- [ ] **Update `frontend/app/loan/borrow/page.tsx`** — show amounts in XLM, remove PHPC approval step reference
- [ ] **Update `frontend/app/loan/repay/page.tsx`** — repay flow is now one step (no separate PHPC approve tx needed — XLM approve is handled differently). Update the step breadcrumb and instructions. Show XLM shortfall if insufficient balance
- [ ] **Update `frontend/app/dashboard/page.tsx`** — pool balance shows as "X XLM Available", borrow limit shows "◎X XLM", fee shows as XLM amount not peso

### 3B. New Navigation Structure 🟠

Update `frontend/components/app-shell.tsx` `navItems` to include all new pages:

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

- [ ] 🟠 Add `Wallet` to nav (already in lucide-react)
- [ ] 🟠 Add `TrendingUp` → Stake & Earn
- [ ] 🟡 Add `Lock` → Time Deposit
- [ ] 🟠 Add `BadgeCheck` → Get Verified (KYC)
- [ ] Show/hide Repay conditionally (same as before)
- [ ] Show "KYC Verified ✓" badge in sidebar when user is KYC-verified

### 3C. New: Wallet Page (`/wallet`) 🟠

Create `frontend/app/wallet/page.tsx`:

**Layout — 3 cards:**

**Card 1 — Balance Hero:**

- Large XLM balance: `◎ 24.3500 XLM`
- PHP equivalent below: `≈ ₱1,240.00 PHP` (from CoinGecko price)
- Two action buttons: `[Send ↑]` `[Receive ↓]`

**Card 2 — Quick Actions:**

- `[Stake XLM]` → navigate to /staking
- `[Borrow XLM]` → navigate to /loan/borrow
- `[Connect GCash]` → opens GCash modal (see below)
- `[Convert to USDC]` → opens USDC modal (roadmap)

**Card 3 — Transaction History:**

- List of last 20 transactions from `GET /wallet/transactions`
- Each row: icon (↑ sent / ↓ received), amount in XLM, date, Stellar Expert link
- Show "No transactions yet" empty state with instructions

**Send Modal** (when user clicks Send):

- Input: recipient Stellar address (G...)
- Input: amount in XLM
- Show PHP equivalent below the XLM amount field (live conversion)
- Button: "Review & Send" → builds a Stellar payment transaction → Freighter signs → backend fee-bumps and submits

**Receive Modal:**

- Show wallet address with copy button
- Show QR code (use a simple JS QR library or `qrcode` npm package)
- "Share Address" button

**GCash Modal:**

- Title: "Connect GCash"
- Logo: GCash logo (PNG asset)
- Body: "GCash integration allows you to top up your XLM wallet using Philippine Pesos and cash out your XLM earnings. Integration coming soon via licensed Stellar Anchor."
- Show: `GCash → PHP → Stellar Anchor → XLM → Kredito`
- CTA: `[Notify me when available]` → just a toast "We'll let you know!"
- This frames the roadmap vision without needing real implementation

- [ ] Create `frontend/app/wallet/page.tsx`
- [ ] Create `frontend/app/wallet/layout.tsx` (wraps with AppShell, requires auth)
- [ ] Add QR code library: `pnpm add qrcode` in frontend
- [ ] Build Send modal component
- [ ] Build Receive modal component
- [ ] Build GCash modal component
- [ ] Add PHP price fetch hook using CoinGecko (no API key needed for basic calls)

### 3D. New: Staking Page (`/staking`) 🟠

Create `frontend/app/staking/page.tsx`:

**Layout — 2 columns:**

**Left — Pool Stats:**

- Total XLM Staked: `◎ 5,420 XLM`
- Current APY: `8.5%` (calculated from actual fee revenue / total staked)
- Reward Pool: `◎ 45.2 XLM`
- "How it works" section: "Stake XLM → Borrowers pay interest → You earn a share of the fees"

**Right — Your Position:**

- Your stake: `◎ 0 XLM`
- Your pending rewards: `◎ 0 XLM`
- Your pool share: `0.00%`
- [Stake XLM] button → opens stake modal
- [Unstake + Claim] button (shown only when stake > 0)

**Stake Modal:**

- Input: amount in XLM
- Show: "Estimated annual return at current APY: ◎ X XLM"
- Button: "Stake" → GET /staking/stake → sign tx → submit

**Unstake Modal:**

- Show breakdown: Principal + Rewards = Total
- Button: "Unstake & Claim Rewards"

- [ ] Create `frontend/app/staking/page.tsx`
- [ ] Create `frontend/app/staking/layout.tsx`

### 3E. New: Time Deposit Page (`/deposit`) 🟡

Create `frontend/app/deposit/page.tsx`:

**Layout:**

**Terms card (2 options):**

| Term    | APY | Minimum |
| ------- | --- | ------- |
| 30 days | 5%  | 1 XLM   |
| 60 days | 8%  | 1 XLM   |

**Your deposit card:**

- If no deposit: "No active time deposit"
- If active: show amount, maturity date, estimated return, "Withdraw Early" (penalty warning) or "Withdraw" (if matured)

**Create Deposit form:**

- Input: amount
- Select: term (30 or 60 days)
- Shows: "You will receive ◎ X XLM at maturity"
- Button: "Lock XLM"

- [ ] Create `frontend/app/deposit/page.tsx`
- [ ] Create `frontend/app/deposit/layout.tsx`

### 3F. New: KYC Page (`/kyc`) 🟠

Create `frontend/app/kyc/page.tsx`:

**Two states:**

**State A — Not Verified:**

- Hero: "Unlock Tier 4 Verified Status" + badge graphic
- Benefits list: "Borrow up to ◎100 XLM", "Lower fee rate", "Verified badge on your Credit Passport"
- Form fields: Full name, ID type (dropdown: PhilSys, SSS, GSIS, Driver's License, Passport), ID number
- Disclaimer: "Your information is processed by Kredito's secure verification service. It is not stored on the Stellar blockchain."
- Button: "Submit for Verification" → POST /credit/kyc-submit → toast "Verification approved! Tier 4 unlocked ✓" (auto-approve for demo)
- Refresh credit score after successful KYC to show new tier

**State B — Already Verified:**

- Green "Identity Verified ✓" badge
- Show: "Your wallet is KYC verified. You have access to Tier 4 (Verified) borrowing limits."

- [ ] Create `frontend/app/kyc/page.tsx`
- [ ] Create `frontend/app/kyc/layout.tsx`
- [ ] Update `frontend/lib/tiers.ts` to add `tier 4`:

  ```typescript
  case 4: // Verified (KYC)
    return 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';
  ```

  And `tierLabel(4) = 'Verified'`

### 3G. Update Dashboard for New Features 🟠

- [ ] **Add KYC badge** to the Credit Passport card: show "KYC Verified ✓" with purple icon when `kycVerified === true`
- [ ] **Add "Get Verified" CTA** when not KYC verified: small banner below the tier badge — "Unlock Tier 4: Submit KYC →"
- [ ] **Add quick stats row** below the main card: `◎ X Staked`, `X Time Deposits`, `◎ X in Loans`
- [ ] **Update pool balance label** from "Pool status" to "XLM Lending Pool"

---

## Phase 4 — Deployment (May 21–22)

### 4A. Testnet (Target: May 21, EOD) 🔴

- [ ] Run `contracts/deploy-testnet.sh` — deploys credit_registry + lending_pool (no phpc_token)
- [ ] Update `contracts/deployed.json` with testnet contract IDs, note `"network": "testnet"`
- [ ] Update `backend/.env` with testnet contract IDs, testnet RPC/Horizon URLs
- [ ] Update `frontend/.env` with `NEXT_PUBLIC_NETWORK=testnet`, testnet explorer URL
- [ ] Run end-to-end test on Testnet — all 5 features: wallet, score, borrow, stake, KYC
- [ ] **Screenshot**: Dashboard on testnet with wallet balance, XLM borrow limit, staking position (REQUIRED for submission)

### 4B. Mainnet (Target: May 22, 10:00 AM) 🔴

- [ ] Create `contracts/deploy-mainnet.sh` — same as testnet script but `NETWORK="mainnet"` and mainnet XLM SAC ID
- [ ] Run `contracts/deploy-mainnet.sh` — watch for XLM balance issues; have 50 XLM ready
- [ ] Update `contracts/deployed.json` with mainnet IDs — set `"network": "mainnet"`
- [ ] Update `backend/.env.production` / Railway env vars with mainnet contract IDs:
  - `SOROBAN_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm`
  - `HORIZON_URL=https://horizon.stellar.org`
  - `STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015`
- [ ] Update `frontend/.env.production` / Vercel env vars:
  - `NEXT_PUBLIC_NETWORK=mainnet`
  - `NEXT_PUBLIC_EXPLORER_URL=https://stellar.expert/explorer/public`
- [ ] **Fix `frontend/next.config.ts` CSP** — add mainnet RPC URL to `connect-src` directive
- [ ] Deploy backend to Railway (fix previous issues — ensure all env vars are set)
- [ ] Deploy frontend to Vercel
- [ ] **Full end-to-end test on production URLs** (not localhost): wallet → score → borrow → stake
- [ ] **Screenshot**: Dashboard on Mainnet showing real XLM balance and tier (REQUIRED for submission)

---

## Phase 5 — Submission Materials (May 22 · Morning) 🔴

### 5A. README Updates

- [ ] Add `## 🚀 Hackathon 2026 Updates` section at top with:
  - What's new vs Bootcamp (XLM-based lending, wallet, staking, time deposit, KYC, GCash framing)
  - Mainnet contract addresses table
  - Testnet + Mainnet screenshots embedded
  - Live app URL + demo video link + pitch deck link
- [ ] Add Stellar Expert links for each Mainnet contract
- [ ] Update setup instructions to reflect removal of phpc_token

### 5B. Demo Video (2–3 min) 🔴

Script — record with Freighter on Mainnet, show entire screen:

1. **(0:00–0:20)** — "33 million Filipinos can't get a bank loan. Kredito changes that." Show dashboard landing
2. **(0:20–0:45)** — **Wallet** — show XLM balance, PHP equivalent, transaction history
3. **(0:45–1:00)** — **Credit Passport** — connect Freighter → sign SEP-10 → click Refresh Score → Soroban scores your on-chain history → tier appears
4. **(1:00–1:20)** — **Borrow** — enter XLM amount → sign → particles → check Freighter balance increased → click Stellar Expert link
5. **(1:20–1:35)** — **KYC** — show "Get Verified" page → fill form → approve → Tier 4 badge appears → higher borrow limit unlocks
6. **(1:35–2:00)** — **Stake & Earn** — show staking page → stake XLM → show pending rewards
7. **(2:00–2:15)** — **Repay** — repay loan → score updates
8. **(2:15–2:40)** — Close: "Kredito is a Filipino blockchain wallet — borrow, stake, and build credit on Stellar Mainnet today." Show live URL

- [ ] Record video, upload to YouTube (unlisted) or Loom

### 5C. Pitch Deck (10 Slides) 🔴

- [ ] **Slide 1** — Title: "Kredito — Filipino Blockchain Wallet" + tagline: "Borrow, stake, and build credit on Stellar" + live URL + your name
- [ ] **Slide 2** — Problem: 33M unbanked, predatory lending at 20–30%/mo, MSMEs with no credit access, OFWs with no home country financial identity
- [ ] **Slide 3** — Solution: Kredito Wallet — your Stellar wallet IS your credit score + bank + lending pool
- [ ] **Slide 4** — Product Features diagram (5 boxes): Wallet | Credit Passport | Borrow | Stake & Earn | KYC Verified
- [ ] **Slide 5** — How Credit Scoring Works: "We scan your Stellar ledger history (transactions, balance, repayments, wallet age) → Soroban contract computes score → instant borrow limit"
- [ ] **Slide 6** — Technical Architecture: Soroban contracts (credit_registry + lending_pool), Express API, Next.js frontend, Freighter + SEP-10, fee-bumped gasless UX
- [ ] **Slide 7** — What's New vs Bootcamp: side-by-side comparison table
- [ ] **Slide 8** — Screenshots: wallet page, staking page, KYC verified badge, borrow flow
- [ ] **Slide 9** — Roadmap: Real GCash anchor integration, USDC support, DAO-governed lending pool, Credit SDK for other Filipino apps
- [ ] **Slide 10** — Team + ask: Your name, GitHub, live URL, "Let's bring financial identity to every Filipino"

- [ ] Upload to Google Drive (Anyone with link can view)

### 5D. Rise In Submission Form 🔴

**Submit before May 22, 12:00 NN — do not wait until 11:59.**

- [ ] GitHub Repository: `https://github.com/nazakun021/kredito`
- [ ] Demo Video URL
- [ ] Pitch Deck URL
- [ ] Testnet Screenshot (dashboard with XLM borrow limit)
- [ ] Mainnet Screenshot (same, on mainnet)
- [ ] Live app URL
- [ ] Deployed Mainnet contract addresses

---

## Phase 6 — Presentation Day Prep (May 22–23)

- [ ] 🔴 **Practice the 3–5 min live pitch 3×** — include live demo with Freighter open on screen
- [ ] 🔴 **Screen recording backup** of full demo flow (wallet → score → borrow → stake) in case of internet issues at PDAX
- [ ] 🟠 **Prepare Q&A answers**:
  - _"Why XLM instead of a stablecoin?"_ — XLM is native to Stellar, instantly available, zero friction for users. Peso equivalent is shown in the wallet UI. A stablecoin anchor is on the roadmap.
  - _"How do stakers earn?"_ — A portion of every borrower's interest fee is routed to the staker reward pool. The APY is dynamic based on loan volume.
  - _"Is this regulated?"_ — The platform operates as a DeFi protocol. For the KYC component, the architecture is designed to be compliant with BSP's requirements for virtual asset service providers; full compliance is the next milestone.
  - _"What prevents loan defaults?"_ — Default detection sweep runs every 6 hours. Defaulters receive a permanent 25-point score penalty stored on-chain in the credit_registry, blocking them from future borrowing.
  - _"Can GCash really be integrated?"_ — Technically yes, via a licensed Stellar Anchor that bridges GCash/PHP to XLM. The wallet UI already shows this flow. We are in contact with potential anchor partners (say this if you have any contact, otherwise say it's on the roadmap).
- [ ] 🟠 **Check Railway + Vercel** are both healthy the morning of May 23
- [ ] 🟡 **Bring mobile device** with Freighter installed — showing the wallet on mobile is powerful

---

## Key Files Changed Summary

| File                                   | Change Type | Notes                                   |
| -------------------------------------- | ----------- | --------------------------------------- |
| `contracts/phpc_token/`                | **DELETE**  | Replaced by native XLM SAC              |
| `contracts/Cargo.toml`                 | Edit        | Remove phpc_token member                |
| `contracts/lending_pool/src/lib.rs`    | **REWRITE** | XLM via SAC, + staking, + time_deposit  |
| `contracts/credit_registry/src/lib.rs` | Edit        | + KYC flag, + Tier 4                    |
| `contracts/deploy-testnet.sh`          | **NEW**     | Updated deploy without phpc_token       |
| `contracts/deploy-mainnet.sh`          | **NEW**     | Mainnet version                         |
| `contracts/deployed.json`              | Update      | New contract IDs                        |
| `backend/src/config.ts`                | Edit        | Remove PHPC_ID, add XLM_SAC_ID          |
| `backend/src/stellar/issuer.ts`        | Edit        | Remove PHPC token client                |
| `backend/src/scoring/engine.ts`        | Edit        | XLM amounts, wallet_age_days            |
| `backend/src/routes/loan.ts`           | Edit        | XLM amounts, remove PHPC approve step   |
| `backend/src/routes/credit.ts`         | Edit        | + /kyc-submit endpoint                  |
| `backend/src/routes/staking.ts`        | **NEW**     | Stake/unstake routes                    |
| `backend/src/routes/deposit.ts`        | **NEW**     | Time deposit routes                     |
| `backend/src/routes/wallet.ts`         | **NEW**     | Balance + transaction history           |
| `backend/src/index.ts`                 | Edit        | Register new routers                    |
| `frontend/lib/constants.ts`            | Edit        | REQUIRED_NETWORK, XLM_SAC_ID            |
| `frontend/lib/tiers.ts`                | Edit        | Add Tier 4 Verified                     |
| `frontend/components/app-shell.tsx`    | Edit        | New nav items                           |
| `frontend/components/NetworkBadge.tsx` | Edit        | Mainnet ✓ for PUBLIC                    |
| `frontend/next.config.ts`              | Edit        | CSP for mainnet RPC                     |
| `frontend/app/wallet/page.tsx`         | **NEW**     | Wallet page                             |
| `frontend/app/staking/page.tsx`        | **NEW**     | Staking page                            |
| `frontend/app/deposit/page.tsx`        | **NEW**     | Time deposit page                       |
| `frontend/app/kyc/page.tsx`            | **NEW**     | KYC page                                |
| `frontend/app/dashboard/page.tsx`      | Edit        | XLM amounts, KYC badge, new stat row    |
| `frontend/app/loan/borrow/page.tsx`    | Edit        | XLM amounts, remove PHPC step           |
| `frontend/app/loan/repay/page.tsx`     | Edit        | XLM amounts, shortfall in XLM           |
| `README.md`                            | Edit        | Hackathon updates section + screenshots |

---

## Realistic Daily Schedule

### May 20 (Today) — Contracts + Backend

```txt
Morning:   Phase 0 (env setup, fund wallets, get XLM SAC IDs)
Morning:   Phase 1A–1B (remove phpc_token, rewrite lending_pool for XLM)
Afternoon: Phase 1C–1D (add staking to lending_pool)
Afternoon: Phase 1E (add KYC flag to credit_registry)
Evening:   Phase 1F (deploy to testnet, smoke test)
Evening:   Phase 2A–2B (backend: remove PHPC, add staking routes)
```

### May 21 — Frontend + Full Testnet Verification

```txt
Morning:   Phase 2C–2E (backend: time deposit, KYC, wallet routes)
Morning:   Phase 3A–3B (update existing screens for XLM, new nav)
Afternoon: Phase 3C (Wallet page — most complex new UI)
Afternoon: Phase 3D (Staking page)
Evening:   Phase 3E–3F (Time deposit + KYC pages)
Evening:   Phase 3G (dashboard updates)
Night:     Full testnet end-to-end test + screenshots
```

### May 22 — Mainnet + Submit

```txt
07:00 AM:  Phase 4B (deploy to mainnet)
08:00 AM:  Full mainnet end-to-end test + screenshot
09:00 AM:  Phase 5A (README updates)
09:30 AM:  Phase 5B (record demo video — 1 take, upload)
10:00 AM:  Phase 5C (finalize pitch deck)
11:00 AM:  Phase 5D (submit on Rise In)
11:00 AM:  ** DO NOT WAIT — SUBMIT NOW **
```

### May 23 — Win

```txt
AM:        Practice pitch 3× with screen recording backup ready
PM:        Arrive at PDAX Office early
3:00 PM:   Present, demo, collect ₱25,000
```

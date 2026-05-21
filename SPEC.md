# Kredito — Technical Specification

### Build on Stellar Philippines Hackathon 2026

**Version:** 1.0 · **Author:** nazakun021 · **Network:** Stellar Mainnet

---

## 1. Product Overview

Kredito is a decentralized micro-lending platform built on the Stellar blockchain. It reads a
user's existing Stellar wallet history, derives a credit score entirely from on-chain data,
and uses that score to grant instant XLM-denominated micro-loans from a decentralized pool —
with no bank account, no paperwork, and no waiting.

**Target users:** Unbanked and underbanked Filipino MSMEs — sari-sari store owners, online
resellers, market vendors, and OFW families — who have Stellar wallets but no formal
credit identity.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  User Browser (Freighter Wallet)                                    │
│  Next.js 15 + React 19 + Zustand + TanStack Query                  │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS + JWT (Bearer)
┌────────────────────────▼────────────────────────────────────────────┐
│  Backend API (Express.js / TypeScript)                              │
│  Stateless orchestrator — never holds user funds                    │
│  • SEP-10 WebAuth challenge / verify                                │
│  • Off-chain score assembly from Horizon + on-chain data            │
│  • Soroban transaction building + fee-bump sponsorship              │
│  • Admin default sweep (cron)                                       │
└──────┬─────────────────┬──────────────────────┬─────────────────────┘
       │                  │                      │
  Horizon API         Soroban RPC          Stellar Network
  (tx history,        (contract reads,     (tx submission)
   account data)       writes, events)
       │                  │
┌──────▼──────────────────▼────────────────────────────────────────┐
│  Soroban Smart Contracts                                          │
│  ┌─────────────────────┐     ┌──────────────────────────────┐   │
│  │  credit_registry    │◄────│  lending_pool                │   │
│  │  • Metrics storage  │     │  • Borrow / Repay            │   │
│  │  • Score compute    │     │  • Stake & Earn              │   │
│  │  • Tier management  │     │  • Time Deposits             │   │
│  │  • KYC flag         │     │  • Pool balance management   │   │
│  └─────────────────────┘     └──────────────┬───────────────┘   │
│                                              │                   │
│                               ┌──────────────▼───────────────┐   │
│                               │  Native XLM SAC              │   │
│                               │  (Stellar Asset Contract)    │   │
│                               └──────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

- **Stateless backend:** The Express API holds no persistent state. The Stellar blockchain
  is the single source of truth for all financial data.
- **Gasless UX:** The issuer pays all network fees via fee-bump transactions. Users sign
  transactions but never need XLM to cover gas.
- **Non-custodial:** Private keys never leave the user's Freighter browser extension.
- **Deterministic scoring:** Credit scores are computed from public, immutable on-chain data.
  No self-reported information is required or trusted.

---

## 3. Smart Contracts

### 3.1 `credit_registry`

**Purpose:** Stores and computes credit scores. Acts as a read-only oracle for `lending_pool`.

**Storage layout:**

| Key                    | Type      | Storage    | Description                           |
| ---------------------- | --------- | ---------- | ------------------------------------- |
| `Admin`                | `Address` | Instance   | Issuer address with write permissions |
| `Tier1Limit`           | `i128`    | Instance   | Max borrow for Tier 1 (stroops)       |
| `Tier2Limit`           | `i128`    | Instance   | Max borrow for Tier 2 (stroops)       |
| `Tier3Limit`           | `i128`    | Instance   | Max borrow for Tier 3 (stroops)       |
| `KycTierLimit`         | `i128`    | Instance   | Max borrow for Tier 4 / KYC (stroops) |
| `Metrics(Address)`     | `Metrics` | Persistent | Per-wallet metrics struct             |
| `TierExpiry(Address)`  | `u32`     | Persistent | Ledger at which tier expires          |
| `KycVerified(Address)` | `bool`    | Persistent | KYC verification flag                 |

**`Metrics` struct:**

```rust
pub struct Metrics {
    pub tx_count: u32,
    pub repayment_count: u32,
    pub avg_balance: u32,
    pub default_count: u32,
}
```

**Scoring formula** (mirrors backend `calculateScore`):

```
score = (tx_count * 2)
      + (repayment_count * 10)
      + (min(avg_balance * 2 / 100, 10) * 5)
      - (default_count * 25)
```

Score is clamped to `0..=u32::MAX`. Negative intermediate values saturate to 0.

**Tier thresholds:**

| Tier | Label    | Min Score | KYC Required |
| ---- | -------- | --------- | ------------ |
| 0    | Unrated  | —         | No           |
| 1    | Bronze   | 40        | No           |
| 2    | Silver   | 80        | No           |
| 3    | Gold     | 120       | No           |
| 4    | Verified | 40+       | Yes          |

Tier 4 overrides tiers 1–3 when `kyc_verified == true AND score >= BRONZE_MIN_SCORE`.

**Tier expiry:** Each `update_metrics` call sets `TierExpiry(wallet) = ledger + 518_400`
(≈30 days at 5s/ledger). After expiry, `get_tier()` returns 0 until the next refresh.
This incentivizes regular on-chain activity.

**Public functions:**

| Function                              | Auth        | Description                                         |
| ------------------------------------- | ----------- | --------------------------------------------------- |
| `initialize(issuer, t1, t2, t3, kyc)` | None (once) | Deploy-time setup                                   |
| `update_metrics(wallet, metrics)`     | Issuer      | Write new metrics, recompute score, set tier expiry |
| `get_score(wallet) → u32`             | None        | Read current computed score                         |
| `get_tier(wallet) → u32`              | None        | Read current tier (0–4), checks expiry              |
| `get_tier_limit(tier) → i128`         | None        | Read borrow limit for given tier                    |
| `get_metrics(wallet) → Metrics`       | None        | Read raw metrics                                    |
| `set_tier(wallet, tier)`              | Issuer      | Manually set tier (admin override)                  |
| `revoke_tier(wallet)`                 | Issuer      | Reset wallet to Tier 0, clear KYC flag              |
| `set_kyc_verified(wallet, verified)`  | Issuer      | Set KYC flag on/off                                 |
| `get_kyc_verified(wallet) → bool`     | None        | Read KYC flag                                       |

### 3.2 `lending_pool`

**Purpose:** Manages the XLM lending pool. Handles borrowing, repayment, staking, and
time deposits. Calls `credit_registry` and the native XLM SAC internally.

**Storage layout:**

| Key                      | Type                | Storage    | Description                                          |
| ------------------------ | ------------------- | ---------- | ---------------------------------------------------- |
| `Admin`                  | `Address`           | Instance   | Admin address                                        |
| `RegistryId`             | `Address`           | Instance   | `credit_registry` contract address                   |
| `XlmToken`               | `Address`           | Instance   | Native XLM SAC address                               |
| `FlatFeeBps`             | `u32`               | Instance   | Base fee in basis points (500 = 5%)                  |
| `LoanTermLedgers`        | `u32`               | Instance   | Loan term in ledgers (518,400 ≈ 30 days)             |
| `Loan(Address)`          | `LoanRecord`        | Persistent | Per-borrower loan record                             |
| `AllBorrowers`           | `Vec<Address>`      | Instance   | All wallets that have ever borrowed                  |
| `TotalStaked`            | `i128`              | Instance   | Total XLM staked                                     |
| `AccRewardPerShare`      | `i128`              | Instance   | Accumulated rewards per staked unit (× REWARD_SCALE) |
| `TotalRewardPool`        | `i128`              | Instance   | Total XLM in reward pool                             |
| `StakedPool`             | `i128`              | Instance   | Running sum of distributed staker fees               |
| `StakerBalance(Address)` | `i128`              | Persistent | Per-staker staked amount                             |
| `StakerRewards(Address)` | `i128`              | Persistent | Per-staker accumulated rewards                       |
| `RewardDebt(Address)`    | `i128`              | Persistent | Per-staker reward debt (MasterChef pattern)          |
| `TimeDeposit(Address)`   | `TimeDepositRecord` | Persistent | Per-depositor time deposit                           |

**`LoanRecord` struct:**

```rust
pub struct LoanRecord {
    pub amount: i128,
    pub fee: i128,
    pub total_owed: i128,
    pub due_ledger: u32,
    pub fee_bps: u32,
    pub repaid: bool,
    pub defaulted: bool,
}
```

**`TimeDepositRecord` struct:**

```rust
pub struct TimeDepositRecord {
    pub amount: i128,
    pub deposited_at: u32,
    pub term_ledgers: u32,
    pub apy_bps: u32,
}
```

**Fee discount by tier:**

| Tier         | Fee                                   |
| ------------ | ------------------------------------- |
| 1 (Bronze)   | `base_fee_bps` (500 bps = 5%)         |
| 2 (Silver)   | `base_fee_bps - 200` (300 bps = 3%)   |
| 3 (Gold)     | `base_fee_bps - 350` (150 bps = 1.5%) |
| 4 (Verified) | `base_fee_bps - 500` (0 bps = 0%)     |

**Fee distribution on repayment:**

```
staker_fee = total_fee / 2   (50% to staker reward pool)
pool_fee   = total_fee / 2   (50% stays as pool liquidity)
```

**Staking reward model (MasterChef / reward-per-share):**

```
acc_reward_per_share += (staker_fee * REWARD_SCALE) / total_staked
pending_rewards[staker] = (staker_balance * acc_reward_per_share / REWARD_SCALE) - reward_debt[staker]
```

`REWARD_SCALE = 1_000_000_000_000` (prevents precision loss in integer math)

**Time deposit interest formula:**

```
interest = amount × apy_bps × term_ledgers / (10_000 × 365_days_in_ledgers)
```

**Public functions:**

| Function                                                  | Auth        | Description                                           |
| --------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| `initialize(admin, registry, xlm_token, fee_bps, term)`   | None (once) | Deploy-time setup                                     |
| `deposit(amount)`                                         | Admin       | Seed pool with XLM                                    |
| `borrow(borrower, amount)`                                | Borrower    | Validate tier, disburse XLM                           |
| `repay(borrower)`                                         | Borrower    | Accept repayment, distribute fees                     |
| `mark_default(borrower)`                                  | Admin       | Mark overdue loan as defaulted                        |
| `stake(staker, amount)`                                   | Staker      | Pull XLM via SAC transfer_from, update rewards        |
| `unstake(staker, amount)`                                 | Staker      | Return XLM + pending rewards                          |
| `time_deposit(depositor, amount, term_ledgers, apy_bps)`  | Depositor   | Lock XLM for fixed term                               |
| `withdraw_time_deposit(depositor)`                        | Depositor   | Withdraw principal + interest                         |
| `get_loan(borrower) → Option<LoanRecord>`                 | None        | Read loan state                                       |
| `get_pool_balance() → i128`                               | None        | XLM balance of pool contract                          |
| `get_stake_info(staker) → StakeInfo`                      | None        | Read staker position                                  |
| `get_time_deposit(depositor) → Option<TimeDepositRecord>` | None        | Read deposit state                                    |
| `get_total_staked_pub() → i128`                           | None        | Total XLM staked _(to be added — see BUG-02)_         |
| `get_total_reward_pool_pub() → i128`                      | None        | Total XLM in reward pool _(to be added — see BUG-02)_ |

---

## 4. Backend API

**Base URL:** `https://<railway-deployment>/api`
**Auth:** JWT Bearer token issued after SEP-10 WebAuth. Token carries `wallet: string` claim.

### 4.1 Auth

| Method | Path              | Auth | Description                           |
| ------ | ----------------- | ---- | ------------------------------------- |
| `POST` | `/auth/challenge` | None | Issue SEP-10 challenge XDR for wallet |
| `POST` | `/auth/login`     | None | Verify signed challenge, return JWT   |

### 4.2 Credit Score

| Method | Path                 | Auth | Description                            |
| ------ | -------------------- | ---- | -------------------------------------- |
| `GET`  | `/credit/score`      | JWT  | Read current on-chain score (no write) |
| `POST` | `/credit/refresh`    | JWT  | Build unsigned `update_metrics` XDR    |
| `POST` | `/credit/kyc-submit` | JWT  | Submit KYC form, set on-chain flag     |

**`GET /credit/score` response:**

```json
{
  "wallet": "G...",
  "score": 145,
  "tier": 3,
  "tierLabel": "Gold",
  "borrowLimit": "20.0000000",
  "feeBps": 150,
  "feeRate": 1.5,
  "kycVerified": false,
  "source": "chain",
  "metrics": {
    "txCount": 62,
    "repaymentCount": 2,
    "xlmBalance": 340.5,
    "defaultCount": 0
  },
  "horizonMetrics": {
    "txCount": 62,
    "walletAgeDays": 214,
    "currentBalanceXlm": 340.5,
    "inboundPaymentCount": 28,
    "activitySpanDays": 198,
    "hasRegularActivity": true
  }
}
```

### 4.3 Loans

| Method | Path                  | Auth | Description                                          |
| ------ | --------------------- | ---- | ---------------------------------------------------- |
| `GET`  | `/loan/status`        | JWT  | Check for active loan + pool balance                 |
| `POST` | `/loan/borrow`        | JWT  | Build unsigned borrow XDR                            |
| `POST` | `/loan/repay-approve` | JWT  | Build unsigned XLM SAC approve XDR (step 1 of repay) |
| `POST` | `/loan/repay`         | JWT  | Build unsigned repay XDR (step 2 of repay)           |

### 4.4 Staking

| Method | Path                | Auth | Description                                          |
| ------ | ------------------- | ---- | ---------------------------------------------------- |
| `GET`  | `/staking/info`     | None | Pool balance, total staked, reward pool, APY         |
| `GET`  | `/staking/position` | JWT  | Per-wallet staked amount, pending rewards, share     |
| `POST` | `/staking/approve`  | JWT  | Build unsigned XLM SAC approve XDR (step 1 of stake) |
| `POST` | `/staking/stake`    | JWT  | Build unsigned stake XDR (step 2 of stake)           |
| `POST` | `/staking/unstake`  | JWT  | Build unsigned unstake XDR                           |

### 4.5 Time Deposits

| Method | Path                | Auth | Description                                     |
| ------ | ------------------- | ---- | ----------------------------------------------- |
| `GET`  | `/deposit/terms`    | None | Available terms (30d/5%, 60d/8%)                |
| `GET`  | `/deposit/position` | JWT  | Active deposit, maturity date, estimated return |
| `POST` | `/deposit/approve`  | JWT  | Build unsigned XLM SAC approve XDR (step 1)     |
| `POST` | `/deposit/create`   | JWT  | Build unsigned time_deposit XDR (step 2)        |
| `POST` | `/deposit/withdraw` | JWT  | Build unsigned withdraw XDR                     |

### 4.6 Wallet

| Method | Path                   | Auth | Description                              |
| ------ | ---------------------- | ---- | ---------------------------------------- |
| `GET`  | `/wallet/balance`      | JWT  | XLM balance + PHP equivalent (CoinGecko) |
| `GET`  | `/wallet/transactions` | JWT  | Last 20 native XLM payments              |
| `POST` | `/wallet/send`         | JWT  | Build unsigned XLM payment XDR           |

### 4.7 Transaction Submission

| Method | Path                  | Auth | Description                               |
| ------ | --------------------- | ---- | ----------------------------------------- |
| `POST` | `/tx/sign-and-submit` | JWT  | Wrap signed inner XDR in fee-bump, submit |

**`POST /tx/sign-and-submit` body:**

```json
{
  "signedInnerXdr": ["<base64-xdr>"],
  "flow": { "action": "borrow" }
}
```

Valid `action` values: `borrow`, `repay`, `approve_xlm`, `stake`, `unstake`,
`create_deposit`, `withdraw_deposit`, `send`, `update_metrics`

### 4.8 Admin

| Method | Path                    | Auth        | Description                                     |
| ------ | ----------------------- | ----------- | ----------------------------------------------- |
| `GET`  | `/admin/check-defaults` | Admin token | Sweep all loans, mark overdue ones as defaulted |

---

## 5. Credit Scoring Engine

### 5.1 Off-chain score assembly

The backend assembles a score from three sources in parallel:

```
buildScoreSummary(wallet)
├── buildWalletMetrics(wallet)
│   ├── fetchTxCount(wallet)          → Horizon payments endpoint
│   ├── fetchXlmBalance(wallet)       → Horizon loadAccount
│   └── fetchRepaymentMetrics(wallet) → Soroban events + credit_registry.get_metrics()
├── fetchHorizonMetrics(wallet)       → Horizon payments + account endpoints
└── queryContract('get_kyc_verified') → credit_registry Soroban RPC
```

### 5.2 Horizon metrics derivation

| Metric                | Source                                                      | Notes                        |
| --------------------- | ----------------------------------------------------------- | ---------------------------- |
| `txCount`             | `Horizon.payments().forAccount().limit(200)`                | Capped at 200 for pagination |
| `walletAgeDays`       | `Horizon.transactions().forAccount().order('asc').limit(1)` | Age from first-ever tx       |
| `currentBalanceXlm`   | `Horizon.loadAccount()`                                     | Native XLM balance           |
| `inboundPaymentCount` | Payments filtered by `to === wallet`                        | Income signal                |
| `activitySpanDays`    | Last payment date − first payment date (in last 200)        | Consistency proxy            |
| `hasRegularActivity`  | `payments in last 90 days >= 3`                             | Regular usage flag           |

### 5.3 Score formula parity

The backend `calculateScore()` mirrors the Rust `compute_score()` exactly.
Test vectors in `engine.test.ts` validate this parity:

```typescript
score =
  txCount * 2 +
  repaymentCount * 10 +
  min(Math.floor((xlmBalance * 2) / 100), 10) * 5 -
  defaultCount * 25;
// clamped: Math.max(0, score)
```

The `avg_balance` field passed to the contract is pre-enriched with Horizon bonuses
so the on-chain computed score matches the off-chain displayed score:

```
avg_balance_for_contract = xlmBalance_component + wallet_age_bonus + activity_bonus
```

### 5.4 Repayment count recovery

To fix the `repaymentCount === 1` bug from the bootcamp version:

1. Scan Soroban contract events for `repaid` and `defaulted` topics addressed to the wallet
2. Also query `credit_registry.get_metrics(wallet)` for the on-chain cumulative count
3. Take `Math.max(eventCount, onChainCount)` as the authoritative value

This ensures the count is correct even after Soroban RPC event history expires (~7 days
on testnet, longer on mainnet).

---

## 6. Transaction Flow Patterns

All Soroban interactions follow the same 4-step pattern:

```
Frontend                   Backend                     Stellar Network
    |                          |                              |
    |── POST /route/action ───►|                              |
    |                          |── buildUnsignedContractCall  |
    |                          |── simulate()                 |
    |◄── { unsignedXdr } ──────|                              |
    |                          |                              |
    |── Freighter.signTx() ────────────────────────────────── |
    |◄── { signedXdr } ─────── |                              |
    |                          |                              |
    |── POST /tx/sign-and-submit ─►|                          |
    |                          |── TransactionBuilder(fee-bump)|
    |                          |── issuerKeypair.sign()       |
    |                          |── rpcServer.sendTransaction()►|
    |◄── { txHash, explorerUrl }|                              |
```

### Multi-step flows requiring XLM SAC approval

Staking, time deposits, and loan repayment use `transfer_from`, which requires
a preceding `approve()` call on the native XLM SAC:

```
Step 1: POST /staking/approve → sign → POST /tx/sign-and-submit { action: 'approve_xlm' }
Step 2: POST /staking/stake   → sign → POST /tx/sign-and-submit { action: 'stake' }
```

---

## 7. Frontend Pages

| Route          | Auth Required | Description                                                        |
| -------------- | ------------- | ------------------------------------------------------------------ |
| `/`            | No            | Landing page with Freighter connect                                |
| `/wallet`      | Yes           | XLM balance, send/receive, transaction history, platform roadmap   |
| `/dashboard`   | Yes           | Credit Passport card, score, tier, metrics breakdown (collapsible) |
| `/loan/borrow` | Yes           | Borrow XLM within tier limit                                       |
| `/loan/repay`  | Yes           | Repay active loan (two-step: approve + repay)                      |
| `/staking`     | Yes           | Stake XLM, view position and rewards, unstake                      |
| `/deposit`     | Yes           | Create and manage time deposits                                    |
| `/kyc`         | Yes           | Submit KYC form to unlock Tier 4                                   |

---

## 8. Environment Variables

### Backend (`backend/.env`)

| Variable                 | Required | Description                                               |
| ------------------------ | -------- | --------------------------------------------------------- |
| `JWT_SECRET`             | Yes      | Random 256-bit string for JWT signing                     |
| `ISSUER_SECRET_KEY`      | Yes      | Stellar keypair for fee-bump sponsorship                  |
| `WEB_AUTH_SECRET_KEY`    | Yes      | Stellar keypair for SEP-10 challenge signing              |
| `ADMIN_API_SECRET`       | Yes      | Bearer token for `/admin/check-defaults`                  |
| `REGISTRY_ID`            | Yes      | Deployed `credit_registry` contract ID                    |
| `LENDING_POOL_ID`        | Yes      | Deployed `lending_pool` contract ID                       |
| `XLM_SAC_ID`             | Yes      | Native XLM SAC contract ID for current network            |
| `NETWORK`                | Yes      | `testnet` or `mainnet`                                    |
| `SOROBAN_RPC_URL`        | Yes      | Soroban RPC endpoint                                      |
| `HORIZON_URL`            | Yes      | Horizon REST endpoint                                     |
| `CORS_ORIGINS`           | Yes      | Comma-separated allowed origins (never `*` in production) |
| `APPROVAL_LEDGER_WINDOW` | No       | SAC approval TTL in ledgers (default: 500)                |

### Frontend (`frontend/.env`)

| Variable                   | Required | Description                                 |
| -------------------------- | -------- | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`      | Yes      | Backend base URL                            |
| `NEXT_PUBLIC_NETWORK`      | Yes      | `PUBLIC` for mainnet, `TESTNET` for testnet |
| `NEXT_PUBLIC_EXPLORER_URL` | Yes      | Stellar Expert base URL                     |
| `NEXT_PUBLIC_RPC_URL`      | Yes      | Soroban RPC URL (for CSP header)            |

---

## 9. Network Addresses

### Testnet

| Item           | Value                                                      |
| -------------- | ---------------------------------------------------------- |
| Native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Horizon        | `https://horizon-testnet.stellar.org`                      |
| Soroban RPC    | `https://soroban-testnet.stellar.org`                      |
| Explorer       | `https://stellar.expert/explorer/testnet`                  |

### Mainnet

| Item           | Value                                                      |
| -------------- | ---------------------------------------------------------- |
| Native XLM SAC | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| Horizon        | `https://horizon.stellar.org`                              |
| Soroban RPC    | `https://soroban-rpc.mainnet.stellar.gateway.fm`           |
| Explorer       | `https://stellar.expert/explorer/public`                   |

---

## 10. Error Codes

| Code                    | HTTP | Meaning                                           |
| ----------------------- | ---- | ------------------------------------------------- |
| `WALLET_NOT_FOUND`      | 404  | Stellar account doesn't exist on the network      |
| `INSUFFICIENT_BALANCE`  | 422  | User has less XLM than required for repayment     |
| `ACTIVE_LOAN_EXISTS`    | 409  | Wallet already has an open loan                   |
| `NO_ACTIVE_LOAN`        | 404  | Repay attempted with no open loan                 |
| `BORROW_LIMIT_EXCEEDED` | 422  | Requested amount exceeds tier limit               |
| `LOAN_OVERDUE`          | 422  | Loan past due date, cannot repay normally         |
| `TIER_ZERO`             | 403  | Score too low to borrow                           |
| `STALE_LEDGER`          | 503  | RPC returned a ledger outside the queryable range |
| `CONTRACT_ERROR`        | 502  | Unexpected Soroban contract execution error       |

---

## 11. Stellar Features Used

| Feature                             | How Used                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| **Soroban Smart Contracts**         | Core credit registry and lending pool logic in Rust                                 |
| **Inter-Contract Calls**            | `lending_pool` calls `credit_registry` and `xlm_sac` atomically during borrow/repay |
| **Native XLM SAC**                  | Lending pool uses the Stellar Asset Contract to move XLM trustlessly                |
| **Sponsored Fee-Bump Transactions** | Issuer covers all network fees; users sign but never pay gas                        |
| **SEP-10 WebAuth**                  | Keyless wallet authentication — private keys never leave the browser                |
| **Soroban RPC Events**              | Scanned for `repaid` and `defaulted` events to track repayment history              |
| **Horizon Payments API**            | Full transaction history used to derive initial credit score                        |

---

## 12. Judging Criteria Alignment

| Criterion           | Weight | Kredito Feature                                                                             |
| ------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Real-World Impact   | 30%    | Targets 33M unbanked Filipinos; tier limits map to ₱200–₱20,000 range                       |
| Technical Execution | 25%    | Three Soroban contracts with inter-contract calls, SAC integration, fee-bump sponsorship    |
| UX / Usability      | 20%    | Gasless transactions, single-click borrow, score visible without signing anything           |
| Innovation          | 15%    | On-chain credit score derived from Horizon wallet history — no paperwork, no self-reporting |
| Feasibility         | 10%    | Working mainnet MVP; existing bootcamp champion; extensible to Credit SDK / DAO governance  |

---

## 13. Post-Hackathon Roadmap

1. **GCash / Maya Anchor Integration** — PHP peso on-ramp via licensed Stellar Anchor
2. **USDC Settlement** — Stable USD denominated loans via Circle anchor
3. **DAO Governance** — Community-controlled tier limits and fee structures via on-chain voting
4. **Credit SDK** — NPM package allowing Filipino e-commerce platforms to embed Kredito scores
5. **SEP-12 Full KYC** — BSP-compliant identity verification for high-limit tiers
6. **Multi-Currency Pool** — Accept stablecoin deposits from international liquidity providers

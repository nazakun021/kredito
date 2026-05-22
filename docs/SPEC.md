# Kredito — Technical Specification

### Build on Stellar Philippines Hackathon 2026

**Version:** 1.1 · **Author:** nazakun021 · **Network:** Stellar Testnet & Stellar Mainnet

---

## 1. Product Overview

Kredito is a decentralized microfinance infrastructure platform built on the Stellar blockchain. It reads a user's existing Stellar wallet history, derives a credit score entirely from on-chain transaction metrics, and uses that score to grant instant XLM-denominated micro-loans from a decentralized pool — with no bank account, no paperwork, and no waiting.

**Target users:** Unbanked and underbanked Filipino MSMEs — sari-sari store owners, online resellers, market vendors, and freelancer gig workers — who have Stellar wallets but no traditional credit history.

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
│  │  └─────────────────────┘     └──────────────┬───────────────┘   │
│                                              │                   │
│                               ┌──────────────▼───────────────┐   │
│                               │  Native XLM SAC              │   │
│                               │  (Stellar Asset Contract)    │   │
│                               └──────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

- **Stateless backend:** The Express API holds no persistent state. The Stellar blockchain is the single source of truth for all financial data.
- **Gasless UX:** The platform covers all network fees via sponsored fee-bump transactions. Users sign transactions but never pay network gas.
- **Non-custodial:** Private keys never leave the user's Freighter browser extension.
- **Deterministic scoring:** Credit scores are computed from public, immutable on-chain data. No self-reported information is required or trusted.

---

## 3. Smart Contracts

### 3.1 `credit_registry`

**Purpose:** Stores and computes credit scores. Acts as a read-only oracle for `lending_pool`.

**Storage layout:**

| Key                    | Type          | Storage    | Description                           |
| ---------------------- | ------------- | ---------- | ------------------------------------- |
| `Issuer`               | `Address`     | Instance   | Issuer address with write permissions |
| `Tier1Limit`           | `i128`        | Instance   | Max borrow for Tier 1 (stroops)       |
| `Tier2Limit`           | `i128`        | Instance   | Max borrow for Tier 2 (stroops)       |
| `Tier3Limit`           | `i128`        | Instance   | Max borrow for Tier 3 (stroops)       |
| `KycTierLimit`         | `i128`        | Instance   | Max borrow for Tier 4 / KYC (stroops) |
| `CreditState(Address)` | `CreditState` | Persistent | Per-wallet credit information struct  |
| `KycVerified(Address)` | `bool`        | Persistent | KYC verification flag                 |

**`Metrics` struct:**

```rust
pub struct Metrics {
    pub tx_count: u32,
    pub repayment_count: u32,
    pub avg_balance: u32,
    pub default_count: u32,
}
```

**`CreditState` struct:**

```rust
pub struct CreditState {
    pub metrics: Metrics,
    pub score: u32,
    pub tier: u32,
    pub tier_timestamp: u64,
    pub tier_expiry: u32,
}
```

**Scoring formula** (mirrors backend `calculateScore`):

```
avg_balance_factor = min(avg_balance / 100, 10)
score = (tx_count * 1)
      + (repayment_count * 15)
      + (avg_balance_factor * 5)
      - (default_count * 30)
```

Score is clamped to `0..=u32::MAX` via saturating math.

**Tier thresholds and limits:**

| Tier | Label    | Min Score | KYC Required | Borrow Limit (Stroops) | Borrow Limit (XLM) |
| ---- | -------- | --------- | ------------ | ---------------------- | ------------------ |
| 0    | Unrated  | —         | No           | 0                      | ◎0                 |
| 1    | Bronze   | 40        | No           | 10,000,000             | ◎1                 |
| 2    | Silver   | 80        | Yes          | 50,000,000             | ◎5                 |
| 3    | Gold     | 120       | Yes          | 200,000,000            | ◎20                |
| 4    | Platinum | 200+      | Yes          | 1,000,000,000          | ◎100               |

Tiers 2–4 (Silver, Gold, Platinum) require KYC verification before users can borrow from the lending pool. Bronze (Tier 1) can borrow without KYC.

**Tier expiry:** Each `update_metrics` or `update_score` call sets `tier_expiry = ledger + 6,307,200` (≈365 days at 5s/ledger). After expiry, `get_tier()` and `get_active_tier_and_limit()` return 0 until the next refresh. This incentivizes annual on-chain activity.

**Public functions:**

| Function                                                                    | Auth        | Description                                                       |
| --------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `initialize(issuer, tier1_limit, tier2_limit, tier3_limit, kyc_tier_limit)` | None (once) | Deploy-time setup                                                 |
| `update_metrics(wallet, metrics) → u32`                                     | Issuer      | Write new metrics, recompute score, update state, set tier expiry |
| `update_metrics_raw(wallet, tx_count, repayment, balance, default) → u32`   | Issuer      | Flattened entrypoint for updating metrics                         |
| `update_score(wallet) → u32`                                                | Issuer      | Force re-evaluating score based on current metrics                |
| `get_score(wallet) → u32`                                                   | None        | Read current computed score                                       |
| `get_tier(wallet) → u32`                                                    | None        | Read current tier (0–4)                                           |
| `get_tier_limit(tier) → i128`                                               | None        | Read borrow limit for given tier                                  |
| `get_active_tier_and_limit(wallet) → (u32, i128)`                           | None        | Returns active tier and borrow limit, checking expiry             |
| `get_metrics(wallet) → Metrics`                                             | None        | Read raw metrics                                                  |
| `set_tier(wallet, tier)`                                                    | Issuer      | Manually set tier (admin override)                                |
| `revoke_tier(wallet)`                                                       | Issuer      | Reset wallet to Tier 0 and clear KYC flag                         |
| `set_kyc_verified(wallet, verified)`                                        | Issuer      | Set KYC flag on/off                                               |
| `get_kyc_verified(wallet) → bool`                                           | None        | Read KYC flag                                                     |
| `is_tier_current(wallet) → bool`                                            | None        | Verify if tier is not expired                                     |
| `transfer(from, to, amount)`                                                | None        | Always panics (Registry is non-transferable)                      |
| `transfer_from(spender, from, to, amount)`                                  | None        | Always panics (Registry is non-transferable)                      |

### 3.2 `lending_pool`

**Purpose:** Manages the XLM lending pool. Handles borrowing, repayment, staking, and time deposits. Calls `credit_registry` and the native XLM SAC internally.

**Storage layout:**

| Key                      | Type                | Storage    | Description                                          |
| ------------------------ | ------------------- | ---------- | ---------------------------------------------------- |
| `Admin`                  | `Address`           | Instance   | Admin address                                        |
| `RegistryId`             | `Address`           | Instance   | `credit_registry` contract address                   |
| `XlmToken`               | `Address`           | Instance   | Native XLM SAC address                               |
| `FlatFeeBps`             | `u32`               | Instance   | Base fee in basis points (500 = 5%)                  |
| `LoanTermLedgers`        | `u32`               | Instance   | Loan term in ledgers (518,400 ≈ 30 days)             |
| `Loan(Address)`          | `LoanRecord`        | Persistent | Per-borrower loan record                             |
| `TotalStaked`            | `i128`              | Instance   | Total XLM staked                                     |
| `AccRewardPerShare`      | `i128`              | Instance   | Accumulated rewards per staked unit (× REWARD_SCALE) |
| `TotalRewardPool`        | `i128`              | Instance   | Total XLM in reward pool                             |
| `StakedPool`             | `i128`              | Instance   | Running sum of distributed staker fees               |
| `StakerBalance(Address)` | `i128`              | Persistent | Per-staker staked amount                             |
| `StakerRewards(Address)` | `i128`              | Persistent | Per-staker accumulated rewards                       |
| `RewardDebt(Address)`    | `i128`              | Persistent | Per-staker reward debt (MasterChef pattern)          |
| `ReservedInterest`       | `i128`              | Instance   | Pool balance locked to fulfill time deposits         |
| `TimeDeposit(Address)`   | `TimeDepositRecord` | Persistent | Per-depositor time deposit                           |

**`LoanRecord` struct:**

```rust
pub struct LoanRecord {
    pub principal: i128,
    pub fee: i128,
    pub due_ledger: u32,
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
    pub projected_interest: i128,
}
```

**Fee discount by tier:**

| Tier         | Fee                                   |
| ------------ | ------------------------------------- |
| 1 (Bronze)   | `base_fee_bps` (500 bps = 5%)         |
| 2 (Silver)   | `base_fee_bps - 200` (300 bps = 3%)   |
| 3 (Gold)     | `base_fee_bps - 350` (150 bps = 1.5%) |
| 4 (Platinum) | `base_fee_bps - 450` (50 bps = 0.5%)  |

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

`REWARD_SCALE = 10,000,000` (prevents precision loss in integer math).

**Time deposit interest formula:**

```
projected_interest = amount × apy_bps × term_ledgers / (10,000 × 6,307,200)
```

`6,307,200` represents average closing ledgers per year (5s interval).

**Early withdrawal penalty:** Withdrawing before maturity maturity forfeits all accrued interest and deducts a 1% penalty on the principal:

```
penalty = amount / 100
payout = amount - penalty
```

**Public functions:**

| Function                                                  | Auth        | Description                                          |
| --------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `initialize(admin, registry, xlm_token, fee_bps, term)`   | None (once) | Deploy-time setup                                    |
| `deposit(amount)`                                         | Admin       | Seed pool with XLM liquidity                         |
| `borrow(borrower, amount)`                                | Borrower    | Validate tier, check KYC, disburse XLM               |
| `repay(borrower)`                                         | Borrower    | Accept repayment, distribute staker/pool fees        |
| `mark_default(borrower)`                                  | Admin       | Mark overdue loan as defaulted                       |
| `stake(staker, amount)`                                   | Staker      | Pull XLM via SAC transfer_from, update rewards       |
| `unstake(staker, amount)`                                 | Staker      | Return XLM + pending rewards                         |
| `time_deposit(depositor, amount, term_ledgers)`           | Depositor   | Lock XLM for fixed term (30d = 5% APY, 60d = 8% APY) |
| `withdraw_time_deposit(depositor)`                        | Depositor   | Withdraw principal + interest (penalizes early)      |
| `get_loan(borrower) → Option<LoanRecord>`                 | None        | Read active loan record                              |
| `get_pool_balance() → i128`                               | None        | XLM balance of pool contract                         |
| `get_total_staked() → i128`                               | None        | Total XLM staked in the pool                         |
| `get_total_reward_pool() → i128`                          | None        | Total XLM in reward pool                             |
| `get_flat_fee_bps() → u32`                                | None        | Read base fee rate in bps                            |
| `get_stake_info(staker) → StakeInfo`                      | None        | Read staker position, pending rewards, and share     |
| `get_time_deposit(depositor) → Option<TimeDepositRecord>` | None        | Read active time deposit state                       |
| `admin_withdraw(amount)`                                  | Admin       | Withdraw pool liquidity, keeping staker funds safe   |

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
  "kycVerified": true,
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
  "signedInnerXdr": "AAAAAgAAAAD...",
  "flow": { "action": "borrow" }
}
```

Valid `action` values: `borrow`, `repay`, `approve_xlm`, `stake`, `unstake`, `create_deposit`, `withdraw_deposit`, `send`, `update_metrics`

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

The backend `calculateScore()` mirrors the Rust `compute_score()` exactly. Test vectors validate this parity:

```typescript
avgBalanceFactor = Math.min(Math.floor(xlmBalance / 100), 10);
score =
  txCount * 1 + repaymentCount * 15 + avgBalanceFactor * 5 - defaultCount * 30;
score = Math.max(0, score);
```

### 5.4 Repayment count recovery

To guarantee robustness against RPC event history timeouts:

1. Scan Soroban contract events for `repaid` and `defaulted` topics addressed to the wallet.
2. Query `credit_registry.get_metrics(wallet)` for the on-chain cumulative count.
3. Take `Math.max(eventCount, onChainCount)` as the authoritative value.

This ensures credit history is never lost even if Soroban RPC event cache expires.

---

## 6. Transaction Flow Patterns

All Soroban interactions follow the same 4-step sponsored gas pattern:

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

Staking, time deposits, and loan repayment use `transfer_from`, which requires a preceding `approve()` call on the native XLM SAC:

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
| `/kyc`         | Yes           | Submit KYC form to unlock Tiers 2-4                                |

---

## 8. Environment Variables

### Backend (`backend/.env`)

| Variable                     | Required | Description                                            |
| ---------------------------- | -------- | ------------------------------------------------------ |
| `JWT_SECRET`                 | Yes      | Random string for JWT signing                          |
| `ISSUER_SECRET_KEY`          | Yes      | Stellar private key for fee-bump sponsorship           |
| `WEB_AUTH_SECRET_KEY`        | Yes      | Stellar private key for SEP-10 challenge signing       |
| `ADMIN_API_SECRET`           | Yes      | Bearer token for secure `/admin/check-defaults` sweeps |
| `REGISTRY_ID`                | Yes      | Deployed `credit_registry` contract ID                 |
| `LENDING_POOL_ID`            | Yes      | Deployed `lending_pool` contract ID                    |
| `XLM_SAC_ID`                 | Yes      | Native XLM SAC contract ID for current network         |
| `SOROBAN_RPC_URL`            | Yes      | Soroban RPC endpoint                                   |
| `HORIZON_URL`                | Yes      | Horizon REST endpoint                                  |
| `STELLAR_NETWORK_PASSPHRASE` | Yes      | Passphrase matching target network (Testnet or Public) |
| `CORS_ORIGINS`               | Yes      | Comma-separated allowed origins                        |
| `APPROVAL_LEDGER_WINDOW`     | No       | SAC approval TTL in ledgers (default: 100 ledgers)     |

### Frontend (`frontend/.env`)

| Variable                   | Required | Description             |
| -------------------------- | -------- | ----------------------- |
| `NEXT_PUBLIC_API_URL`      | Yes      | Backend base URL        |
| `NEXT_PUBLIC_NETWORK`      | Yes      | `testnet` or `mainnet`  |
| `NEXT_PUBLIC_EXPLORER_URL` | Yes      | Stellar Expert base URL |

---

## 9. Deployed Contract Addresses

### 9.1 Testnet

| Item                      | Value                                                      |
| ------------------------- | ---------------------------------------------------------- |
| `credit_registry`         | `CDBVJNDU6AI6TOE3CHSEK54LQXJQVEBD2EHMKJIENWDHQCZ4CUHFONCI` |
| `lending_pool`            | `CDF5CP4X46RDVQAFBH4CWRTUFMXTMDXXB5TTIJWZEGGTYRFT6Y774KOA` |
| Native XLM SAC            | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Issuer Public Key (Admin) | `GBOFR2BNDABBSAFWOBGEQFLKMAJULZLMCYYG5GM4QB5S6RZKSYIT7DLO` |
| Horizon                   | `https://horizon-testnet.stellar.org`                      |
| Soroban RPC               | `https://soroban-testnet.stellar.org`                      |
| Explorer                  | `https://stellar.expert/explorer/testnet`                  |

### 9.2 Mainnet

| Item                      | Value                                                      |
| ------------------------- | ---------------------------------------------------------- |
| `credit_registry`         | `CAI54RZVSDNK2ZXDRFTUU4EO3IDZR23DJBOXCQ2CKX4A5RKAK7NVF2YK` |
| `lending_pool`            | `CBC3L4HR7XWHDB2VBS2DJK6CFIEEVBNR3XZUL5UYQPVCASRS2YDVPEZX` |
| Native XLM SAC            | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| Issuer Public Key (Admin) | `GBOFR2BNDABBSAFWOBGEQFLKMAJULZLMCYYG5GM4QB5S6RZKSYIT7DLO` |
| Horizon                   | `https://horizon.stellar.org`                              |
| Soroban RPC               | `https://soroban-rpc.mainnet.stellar.gateway.fm`           |
| Explorer                  | `https://stellar.expert/explorer/public`                   |

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
| `KYC_REQUIRED`          | 403  | Silver, Gold, Platinum tier require KYC           |
| `STALE_LEDGER`          | 503  | RPC returned a ledger outside the queryable range |
| `CONTRACT_ERROR`        | 502  | Unexpected Soroban contract execution error       |

---

## 11. Stellar Features Used

| Feature                             | How Used                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| **Soroban Smart Contracts**         | Core credit registry and lending pool logic written securely in Rust                 |
| **Inter-Contract Calls**            | `lending_pool` queries `credit_registry` and invokes `xlm_sac` atomically in a tx    |
| **Native XLM SAC**                  | Moving native XLM assets trustlessly inside Soroban contracts using the SAC bridge   |
| **Sponsored Fee-Bump Transactions** | Backend sponsors transaction network fees for all user interactions (gasless UX)     |
| **SEP-10 WebAuth**                  | Keyless wallet session establishment; private keys never leave the browser extension |
| **Soroban RPC Events**              | Emitting and scanning events for updates to ensure off-chain database-less sync      |
| **Horizon Payments API**            | Reading wallet transaction history to compute on-chain credit passport metrics       |

---

## 12. Judging Criteria Alignment

| Criterion           | Weight | Kredito Feature                                                                               |
| ------------------- | ------ | --------------------------------------------------------------------------------------------- |
| Real-World Impact   | 30%    | Targets 33M underbanked Filipinos; tier limits map to practical everyday micro-loan amounts   |
| Technical Execution | 25%    | Deployed to Stellar Mainnet, inter-contract calls, MasterChef staking, time deposits, gasless |
| UX / Usability      | 20%    | Sponsored gas (fee-bumps), one-click credit score calculation, Freighter wallet SEP-10 auth   |
| Innovation          | 15%    | On-chain reputation registry derived dynamically from public ledger behavior without inputs   |
| Feasibility         | 10%    | Stable, mainnet-ready MVP with robust error handling, automated sweepers, and full coverage   |

---

## 13. Post-Hackathon Roadmap

1. **GCash / Maya Anchor Integration** — Fast PHP peso cash-in/out via licensed local Stellar anchors.
2. **Alternative Identity Scoring** — Incorporating on-chain activity from stablecoins and decentralized identity providers.
3. **DAO Governance** — Yield-aggregator governance letting stakers vote on tier limits, fee structures, and pool parameters.
4. **Credit SDK** — A plug-and-play NPM package enabling other Filipino Web3 or Web2 e-commerce sites to embed credit scoring.
5. **SEP-12 Full KYC** — Integrating formal identity providers to legally support higher credit limits.

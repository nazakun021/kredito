# Kredito — SPEC.md

> Technical specification for the full Kredito system.
> Cross-references all three layers: Contracts (Soroban), Backend (Express), Frontend (Next.js).
> Covers contract interfaces, data flows, API contracts, and the interconnection model.

---

## 1. System Overview

Kredito is a micro-lending platform on Stellar Testnet. The architecture is a strict three-tier stack:

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND  (Next.js 16 / React 19 / Tailwind v4)    │
│  Vercel deployment, Freighter wallet, TanStack Query │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (JWT Bearer)
┌──────────────────────▼──────────────────────────────┐
│  BACKEND   (Express 5 / TypeScript / SQLite)         │
│  Auth, score orchestration, fee-bump sponsorship     │
└──────────────────────┬──────────────────────────────┘
                       │ Soroban RPC / Horizon REST
┌──────────────────────▼──────────────────────────────┐
│  CONTRACTS (Soroban on Stellar Testnet)               │
│  credit_registry · lending_pool · phpc_token         │
└─────────────────────────────────────────────────────┘
```

---

## 2. Smart Contracts

### 2.1 `phpc_token` — Philippine Peso Coin

**Deployed:** `CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR`

**Storage:**

| Key                           | Type             | Storage    | Description               |
| ----------------------------- | ---------------- | ---------- | ------------------------- |
| `Admin`                       | `Address`        | Instance   | Contract admin            |
| `Decimals`                    | `u32`            | Instance   | Always `7`                |
| `Name`                        | `String`         | Instance   | "Philippine Peso Coin"    |
| `Symbol`                      | `String`         | Instance   | "PHPC"                    |
| `Balance(Address)`            | `i128`           | Persistent | Token balance per address |
| `Allowance(Address, Address)` | `AllowanceValue` | Persistent | Spender allowance         |
| `Authorized(Address)`         | `bool`           | Persistent | Freeze / clawback gate    |
| `TotalSupply`                 | `i128`           | Instance   | Total PHPC supply         |

**Key functions:**

| Function                                            | Auth Required | Description                                     |
| --------------------------------------------------- | ------------- | ----------------------------------------------- |
| `initialize(admin, decimal, name, symbol)`          | `admin`       | One-time init. Panics if already initialized.   |
| `mint(to, amount)`                                  | `admin`       | Mints new PHPC. Amount must be `> 0`.           |
| `transfer(from, to, amount)`                        | `from`        | Moves PHPC between addresses.                   |
| `transfer_from(spender, from, to, amount)`          | `spender`     | Moves PHPC using a pre-approved allowance.      |
| `approve(from, spender, amount, expiration_ledger)` | `from`        | Sets spending allowance. Must not be expired.   |
| `allowance(from, spender)` → `i128`                 | —             | Reads current allowance (returns 0 if expired). |
| `balance(id)` → `i128`                              | —             | Reads token balance.                            |
| `burn(from, amount)`                                | `from`        | Destroys tokens.                                |
| `total_supply()` → `i128`                           | —             | Returns circulating PHPC supply.                |
| `authorized(id)` → `bool`                           | —             | Returns whether an address is authorized.       |
| `set_authorized(id, authorize)`                     | `admin`       | Toggles address authorization.                  |
| `decimals()`                                        | —             | Always `7`.                                     |

**Error codes:**

| Code | Name                         | Meaning                                |
| ---- | ---------------------------- | -------------------------------------- |
| 1    | `AlreadyInitialized`         | `initialize` called twice              |
| 2    | `NotInitialized`             | Admin not set                          |
| 3    | `InvalidDecimals`            | Decimal > 18                           |
| 4    | `InvalidAmount`              | Amount ≤ 0                             |
| 5    | `BalanceOverflow`            | Balance + amount overflows i128        |
| 6    | `InvalidAllowanceAmount`     | Allowance amount < 0                   |
| 7    | `InvalidAllowanceExpiration` | Expiration ledger is in the past       |
| 8    | `InsufficientBalance`        | Not enough tokens to transfer/burn     |
| 9    | `InsufficientAllowance`      | Allowance less than requested transfer |

**SPEC NOTE — PHPC Decimals:** All PHPC amounts in storage are in "stroops" (smallest unit). `1 PHPC = 10^7 stroops`. The backend converts with `toPhpAmount(bigint)` and `toStroops(phpFloat)`.

---

### 2.2 `credit_registry` — On-Chain Credit Score

**Deployed:** `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ`

**Storage:**

| Key                      | Type      | Storage    | Description                                                   |
| ------------------------ | --------- | ---------- | ------------------------------------------------------------- |
| `Issuer`                 | `Address` | Instance   | Contract issuer (backend keypair)                             |
| `Tier1Limit`             | `i128`    | Instance   | Max borrow for Bronze (50,000,000,000 stroops = 5,000 PHPC)   |
| `Tier2Limit`             | `i128`    | Instance   | Max borrow for Silver (200,000,000,000 stroops = 20,000 PHPC) |
| `Tier3Limit`             | `i128`    | Instance   | Max borrow for Gold (500,000,000,000 stroops = 50,000 PHPC)   |
| `Metrics(Address)`       | `Metrics` | Persistent | Raw on-chain metrics per wallet                               |
| `Score(Address)`         | `u32`     | Persistent | Computed credit score per wallet                              |
| `CreditTier(Address)`    | `u32`     | Persistent | Tier (0=Unrated, 1=Bronze, 2=Silver, 3=Gold)                  |
| `TierTimestamp(Address)` | `u64`     | Persistent | Ledger timestamp of last tier assignment                      |
| `TierExpiry(Address)`    | `u32`     | Persistent | Ledger number after which a tier is considered stale          |

**`Metrics` struct:**

```rust
pub struct Metrics {
    pub tx_count: u32,
    pub repayment_count: u32,
    pub avg_balance: u32,   // XLM native balance in whole units
    pub default_count: u32,
}
```

**Scoring Formula (identical in contract and backend):**

```
avg_balance_factor = min(avg_balance / 100, 10)   // [0..10]
score = (tx_count × 2) + (repayment_count × 10) + (avg_balance_factor × 5) - (default_count × 25)
score = max(0, score)   // floor at 0
```

**Tier Thresholds:**

```
score >= 120 → Tier 3 (Gold)
score >= 80  → Tier 2 (Silver)
score >= 40  → Tier 1 (Bronze)
score <  40  → Tier 0 (Unrated)
```

**Key functions:**

| Function                                                                                    | Auth Required | Description                                                                 |
| ------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------- |
| `initialize(issuer, tier1_limit, tier2_limit, tier3_limit)`                                 | `issuer`      | One-time init. Limits must be positive and ascending.                       |
| `update_metrics(wallet, metrics)` → `u32`                                                   | `issuer`      | Writes metrics, recomputes score and tier. Returns new score.               |
| `update_metrics_raw(wallet, tx_count, repayment_count, avg_balance, default_count)` → `u32` | `issuer`      | Convenience wrapper over `update_metrics`.                                  |
| `update_score(wallet)` → `u32`                                                              | `issuer`      | Recomputes score from current stored metrics.                               |
| `set_tier(wallet, tier)`                                                                    | `issuer`      | Directly sets tier (1–3) and sets score to tier minimum.                    |
| `revoke_tier(wallet)`                                                                       | `issuer`      | Sets tier to 0, score to 0. Emits `revoked` event.                          |
| `compute_score(metrics)` → `u32`                                                            | —             | Pure computation, no state changes.                                         |
| `get_metrics(wallet)` → `Metrics`                                                           | —             | Returns stored metrics (defaults to zero if none).                          |
| `get_score(wallet)` → `u32`                                                                 | —             | Returns stored score.                                                       |
| `get_tier(wallet)` → `u32`                                                                  | —             | Returns current tier.                                                       |
| `get_tier_limit(tier)` → `i128`                                                             | —             | Returns borrow limit for a tier.                                            |
| `is_tier_current(wallet)` → `bool`                                                          | —             | Returns whether the wallet's tier is still current.                         |
| `transfer(...)`                                                                             | —             | **Always panics** (`NonTransferable`). Credit passport is non-transferable. |
| `transfer_from(...)`                                                                        | —             | **Always panics** (`NonTransferable`).                                      |

**Events emitted:**

- `(score_upd, wallet) → (score, tier, timestamp)` — on any metrics/score update.
- `(revoked, wallet) → timestamp` — on tier revocation.

**TTL policy:** wallet credit state and contract instance storage are TTL-bumped on reads/writes to reduce expiration risk.

---

### 2.3 `lending_pool` — Borrow and Repay

**Deployed:** `CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH`

**Storage:**

| Key               | Type         | Storage    | Description                                        |
| ----------------- | ------------ | ---------- | -------------------------------------------------- |
| `Admin`           | `Address`    | Instance   | Contract admin                                     |
| `RegistryId`      | `Address`    | Instance   | Address of `credit_registry`                       |
| `TokenId`         | `Address`    | Instance   | Address of `phpc_token`                            |
| `FlatFeeBps`      | `u32`        | Instance   | Base fee in basis points (deployed: 500 = 5%)      |
| `LoanTermLedgers` | `u32`        | Instance   | Loan term in ledgers (deployed: 518,400 ≈ 30 days) |
| `PoolBalance`     | `i128`       | Instance   | Total PHPC in pool (stroops)                       |
| `Loan(Address)`   | `LoanRecord` | Persistent | Loan record per borrower                           |

**`LoanRecord` struct:**

```rust
pub struct LoanRecord {
    pub principal: i128,  // borrowed amount in stroops
    pub fee: i128,        // fee charged in stroops
    pub due_ledger: u32,  // ledger number when loan expires
    pub repaid: bool,     // true after successful repayment
    pub defaulted: bool,  // true after mark_default is called
}
```

**Tier-Based Fee Calculation:**
The deployed contract uses `flat_fee_bps = 500` as a base, then reduces by tier:

```
Tier 3 (Gold):   flat_fee_bps - 350 = 150 bps (1.5%)
Tier 2 (Silver): flat_fee_bps - 200 = 300 bps (3.0%)
Tier 1 (Bronze): flat_fee_bps       = 500 bps (5.0%)
```

This **matches** `tierFeeBps()` in the backend scoring engine. Both are consistent.

**Key functions:**

| Function                                                                      | Auth Required | Description                                                                                             |
| ----------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `initialize(admin, registry_id, phpc_token, flat_fee_bps, loan_term_ledgers)` | `admin`       | One-time init. `flat_fee_bps ≤ 10000`.                                                                  |
| `deposit(amount)`                                                             | `admin`       | Admin transfers PHPC into pool via `transfer_from`. Requires prior `approve`.                           |
| `borrow(borrower, amount)`                                                    | `borrower`    | Validates tier, checks limit, charges fee, sends PHPC. Stores LoanRecord.                               |
| `repay(borrower)`                                                             | `borrower`    | Pulls `principal + fee` from borrower via `transfer_from`. Requires prior `approve`. Panics if overdue. |
| `mark_default(borrower)`                                                      | — (anyone)    | Marks a loan as defaulted if `current_ledger > due_ledger`.                                             |
| `get_loan(borrower)` → `Option<LoanRecord>`                                   | —             | Returns loan record if exists.                                                                          |
| `get_pool_balance()` → `i128`                                                 | —             | Returns current pool balance in stroops.                                                                |
| `get_flat_fee_bps()` → `u32`                                                  | —             | Returns the pool's base fee schedule parameter.                                                         |
| `admin_withdraw(amount)`                                                      | `admin`       | Allows the pool admin to withdraw PHPC from the pool.                                                   |

**Events emitted:**

- `(disburse, borrower) → (amount, fee, due_ledger)` — on borrow.
- `(repaid, borrower) → (total_owed, timestamp)` — on repayment.
- `(defaulted, borrower) → principal` — on mark_default.

**TTL policy:** loan entries and instance storage are TTL-bumped on reads/writes to keep active pool state alive.

**Borrow validation flow:**

1. `amount > 0` (else `InvalidAmount`)
2. No active loan exists for `borrower` (else `ActiveLoanExists`)
3. `registry.get_tier(borrower) >= 1` (else `NoCreditTier`)
4. `amount <= registry.get_tier_limit(tier)` (else `BorrowLimitExceeded`)
5. `amount <= pool_balance` (else `InsufficientPoolLiquidity`)

---

## 3. Backend API

**Base URL:** `http://localhost:3001/api/` (dev)

All authenticated endpoints require `Authorization: Bearer <JWT>`.

---

### 3.1 Auth Routes (`/api/auth`)

#### `POST /api/auth/challenge`

Initiates SEP-10 WebAuth challenge for a Stellar address.

**Request:**

```json
{ "stellarAddress": "G..." }
```

**Response:**

```json
{ "challengeXdr": "AAAAAQ...", "expiresIn": 300 }
```

**Notes:**

- Generates a `WebAuth.buildChallengeTx` XDR signed by `WEB_AUTH_SECRET_KEY`.
- Stores a hash of the challenge in `auth_challenges` with a 5-minute TTL.
- Rate-limited: 10 requests / minute per IP.

#### `POST /api/auth/login`

Verifies a signed challenge and issues a JWT.

**Request:**

```json
{ "signedChallengeXdr": "AAAAAQ..." }
```

**Response:**

```json
{
  "token": "eyJ...",
  "wallet": "G...",
  "isNew": true,
  "isExternal": true
}
```

**Notes:**

- Calls `WebAuth.readChallengeTx` and `WebAuth.verifyChallengeTxSigners`.
- Consumes the challenge (deletes from DB) — prevents replay attacks.
- Creates a new user row if `stellar_pub` is unseen; otherwise returns existing user.
- JWT expiry: 24 hours. Payload: `{ userId: number }`.

#### `POST /api/auth/refresh`

Refreshes a valid JWT. Returns a new token.

**Auth:** Required.

---

### 3.2 Credit Routes (`/api/credit`)

Rate-limited: 5 requests / minute for `/generate`.

#### `POST /api/credit/generate`

Reads Horizon + on-chain events, computes score, writes metrics on-chain, stores in DB.

**Auth:** Required.
**Response:** Full `ScorePayload` (see Section 3.5).
**Notes:**

- Calls `buildScoreSummary(stellar_pub)` → `updateOnChainMetrics(...)`.
- Submits two contract calls in one transaction: `update_metrics_raw` + `update_score`.
- Stores a `score_events` row.

#### `GET /api/credit/score`

Returns the latest cached score from DB, merged with on-chain state.

**Auth:** Required.
**Response:** `ScorePayload` with `source: "onchain"`.
**Notes:**

- Returns `404` if no score has been generated yet.
- Merges `score_events.score_json` (latest DB snapshot) with live on-chain query (`get_score`, `get_tier`, `get_metrics`, `get_tier_limit`).

#### `GET /api/credit/pool`

Returns current pool balance.

**Response:**

```json
{ "poolBalance": "100000.00", "poolBalanceRaw": "1000000000000000" }
```

#### `GET /api/credit/metrics`

Returns raw on-chain metrics from `credit_registry` for the authenticated user.

**Response:** `Metrics` struct as JSON.

---

### 3.3 Loan Routes (`/api/loan`)

#### `POST /api/loan/borrow`

Validates borrow eligibility. For Freighter users, returns an unsigned XDR. For internal wallets, submits the transaction directly.

**Auth:** Required.

**Request:**

```json
{ "amount": 5000.0 }
```

**Response (Freighter user):**

```json
{
  "requiresSignature": true,
  "unsignedXdr": "AAAAAQ...",
  "meta": {
    "amount": "5000.00",
    "fee": "75.00",
    "feeBps": 150,
    "totalOwed": "5075.00"
  }
}
```

**Response (internal user, direct submit):**

```json
{
  "txHash": "abc...",
  "amount": "5000.00",
  "fee": "75.00",
  "feeBps": 150,
  "totalOwed": "5075.00",
  "dueDate": "2026-05-30T...",
  "explorerUrl": "https://stellar.expert/..."
}
```

**Validation:**

1. `amount` must be a positive finite number.
2. No active loan exists on-chain.
3. `score.tier >= 1`.
4. `toStroops(amount) <= borrowLimitRaw`.

#### `POST /api/loan/repay`

Two-step flow. First call checks allowance and returns approve XDR if needed; second call (after approve is submitted) returns repay XDR.

**Auth:** Required.

**Step 1 response (allowance not set):**

```json
{
  "requiresSignature": true,
  "step": "approve",
  "unsignedXdr": "AAAAAQ...",
  "meta": { "amountRepaid": "5075.00" }
}
```

**Step 2 response (allowance sufficient):**

```json
{
  "requiresSignature": true,
  "step": "repay",
  "unsignedXdr": "AAAAAQ..."
}
```

**Validation:**

1. Loan exists on-chain.
2. Loan is not already `repaid` or `defaulted`.
3. Wallet PHPC balance `>= principal + fee` (else `400` with shortfall amount).

#### `GET /api/loan/status`

Returns current loan state for the authenticated user.

**Response (active loan):**

```json
{
  "hasActiveLoan": true,
  "walletPhpBalance": "4000.00",
  "poolBalance": "95000.00",
  "poolBalanceRaw": "...",
  "loan": {
    "principal": "5000.00",
    "fee": "75.00",
    "totalOwed": "5075.00",
    "walletBalance": "4000.00",
    "shortfall": "1075.00",
    "dueLedger": 12345678,
    "currentLedger": 12345000,
    "dueDate": "2026-05-30T...",
    "daysRemaining": 29,
    "status": "active"
  }
}
```

**Loan `status` values:** `active` | `overdue` | `repaid` | `defaulted`

---

### 3.4 Transaction Routes (`/api/tx`)

**IMPORTANT:** The frontend must call `/tx/sign-and-submit`, NOT `/loan/sign-and-submit`.

#### `POST /api/tx/sign-and-submit`

Takes a signed inner XDR from Freighter, wraps it in a fee-bump, and submits to Soroban.

**Auth:** Required.

**Request:**

```json
{
  "signedInnerXdr": ["AAAAAQ..."],
  "flow": { "action": "borrow" | "repay", "step": "approve" | "repay" }
}
```

**Response (borrow):**

```json
{
  "txHash": "abc...",
  "txHashes": ["abc..."],
  "explorerUrl": "https://...",
  "amount": "5000.00",
  "fee": "75.00",
  "feeBps": 150,
  "totalOwed": "5075.00"
}
```

**Response (repay, step=repay):**

```json
{
  "txHash": "abc...",
  "txHashes": ["abc..."],
  "explorerUrl": "https://...",
  "amountRepaid": "5075.00",
  "previousScore": 65,
  "newScore": 75,
  "newTier": "Bronze",
  "newBorrowLimit": "5000.00"
}
```

**Side effects (borrow):** Inserts into `active_loans` table. Reads post-confirmation `LoanRecord` to return confirmed fee/amount.

**Side effects (repay, step=repay):** Deletes from `active_loans` after repayment is observed on-chain. Rebuilds score summary and calls `updateOnChainMetrics`. Inserts `score_events` row.

#### `POST /api/tx/submit`

Simpler submit: takes one or more signed XDRs, wraps each in fee-bump, submits. No flow-awareness.

---

### 3.5 Score Payload Schema

```typescript
interface ScorePayload {
  walletAddress: string;
  source: "generated" | "onchain";
  score: number;
  tier: number; // 0–3
  tierNumeric: number; // alias of tier
  tierLabel: string; // "Unrated" | "Bronze" | "Silver" | "Gold"
  borrowLimit: string; // PHP string e.g. "5000.00"
  borrowLimitRaw: string; // stroops as string
  feeRate: number; // decimal e.g. 1.5 (percent)
  feeBps: number; // basis points e.g. 150
  progressToNext: number; // points needed to reach next tier
  nextTier: string | null; // e.g. "Silver"
  nextTierThreshold: number | null; // e.g. 80
  metrics: {
    txCount: number;
    repaymentCount: number;
    avgBalance: number; // XLM native balance in whole units (NOT PHPC)
    avgBalanceFactor: number; // min(avgBalance / 100, 10)
    defaultCount: number;
  };
  formula: {
    expression: string;
    txComponent: number;
    repaymentComponent: number;
    balanceComponent: number;
    defaultPenalty: number;
    total: number;
  };
  factors: ScoreFactor[];
  txHashes: { metricsTxHash?: string; scoreTxHash?: string };
}
```

---

## 4. Data Flow: Full Borrow Cycle

```
User                   Frontend                Backend               Soroban
 │                        │                       │                     │
 │──── Connect Wallet ────▶│                       │                     │
 │                        │── POST /auth/challenge ▶│                    │
 │                        │◀── challengeXdr ────────│                    │
 │                        │── Freighter sign ──────▶│ (popup)            │
 │                        │── POST /auth/login ─────▶│                   │
 │                        │◀── JWT token ───────────│                    │
 │                        │                         │                    │
 │──── Dashboard ─────────▶│                        │                    │
 │                        │── POST /credit/generate ▶│                   │
 │                        │                         │── Horizon txCount ─▶│
 │                        │                         │◀── tx history ──────│
 │                        │                         │── update_metrics_raw▶│
 │                        │                         │◀── tx confirmed ─────│
 │                        │◀── ScorePayload ─────────│                    │
 │                        │                         │                    │
 │──── Click Borrow ──────▶│                        │                    │
 │                        │── POST /loan/borrow ─────▶│                  │
 │                        │                         │── buildScoreSummary│
 │                        │                         │── prepareTransaction▶│
 │                        │◀── unsignedXdr ──────────│                   │
 │                        │── Freighter signTx ─────▶│ (popup)           │
 │                        │── POST /tx/sign-and-submit▶│                 │
 │                        │                         │── feeBumpTx ───────▶│
 │                        │                         │── pollTransaction ──▶│
 │                        │                         │◀── SUCCESS ──────────│
 │                        │                         │── getLoanRecord ────▶│
 │                        │◀── BorrowSuccess ────────│                    │
 │◀─── Success UI ─────────│                        │                    │
```

---

## 5. Data Flow: Full Repay Cycle

```
User                   Frontend                Backend               Soroban
 │                        │                       │                     │
 │──── Click Repay ───────▶│                       │                    │
 │                        │── POST /loan/repay ─────▶│                  │
 │                        │                         │── getLoanRecord ──▶│
 │                        │                         │── getWalletBalance▶│
 │                        │                         │── checkAllowance ──▶│
 │                        │◀── { step:"approve", unsignedXdr } ──────────│
 │                        │── Freighter signTx ─────▶│ (popup: approve) │
 │                        │── POST /tx/sign-and-submit▶│                 │
 │                        │    { flow: { step:"approve" } }              │
 │                        │                         │── feeBumpTx ───────▶│
 │                        │                         │── pollTransaction ──▶│
 │                        │◀── { txHash } ───────────│                   │
 │                        │                         │                    │
 │                        │── POST /loan/repay ─────▶│                  │
 │                        │                         │── checkAllowance ──▶│
 │                        │◀── { step:"repay", unsignedXdr } ────────────│
 │                        │── Freighter signTx ─────▶│ (popup: repay)   │
 │                        │── POST /tx/sign-and-submit▶│                 │
 │                        │    { flow: { action:"repay", step:"repay" } }│
 │                        │                         │── feeBumpTx ───────▶│
 │                        │                         │── pollTransaction ──▶│
 │                        │                         │── sleep(6s) ────────│
 │                        │                         │── buildScoreSummary▶│
 │                        │                         │── updateOnChainMetrics▶│
 │                        │◀── RepaySuccess ─────────│                   │
 │◀─── Success UI ─────────│                        │                    │
```

---

## 6. Fee Structure

| Tier | Label   | `tierFeeBps` (backend) | Contract `tier_fee_bps(flat=500, tier)` |
| ---- | ------- | ---------------------- | --------------------------------------- |
| 0    | Unrated | 500                    | N/A (cannot borrow)                     |
| 1    | Bronze  | 500                    | 500                                     |
| 2    | Silver  | 300                    | 300                                     |
| 3    | Gold    | 150                    | 150                                     |

**Both layers are consistent.** The contract calculates: `fee = amount × effective_fee_bps / 10_000`.

**Example:** Borrow 5,000 PHPC at Tier 1:

- `fee = 5,000 × 500 / 10,000 = 250 PHPC`
- `total_owed = 5,250 PHPC`
- The user must hold 5,250 PHPC in their wallet before calling repay.

---

## 7. Database Schema (SQLite)

### `users`

```sql
CREATE TABLE users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  email              TEXT UNIQUE NOT NULL,       -- synthetic for Freighter users
  stellar_pub        TEXT UNIQUE NOT NULL,
  stellar_enc_secret TEXT,                       -- NULL for external (Freighter) users
  is_external        BOOLEAN NOT NULL DEFAULT 0, -- 1 for Freighter users
  email_verified     BOOLEAN NOT NULL DEFAULT 0,
  otp_hash           TEXT,
  otp_expires_at     DATETIME,
  otp_attempt_count  INTEGER NOT NULL DEFAULT 0,
  otp_locked_until   DATETIME,
  last_login_at      DATETIME,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `auth_challenges`

```sql
CREATE TABLE auth_challenges (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  stellar_pub    TEXT NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  expires_at     DATETIME NOT NULL,              -- 5 minutes from creation
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `score_events`

```sql
CREATE TABLE score_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  tier            INTEGER NOT NULL,
  score           INTEGER NOT NULL,
  bootstrap_score INTEGER NOT NULL DEFAULT 0,
  stellar_score   INTEGER NOT NULL DEFAULT 0,
  score_json      TEXT NOT NULL,                 -- full ScorePayload JSON
  sbt_minted      BOOLEAN NOT NULL DEFAULT 0,
  sbt_tx_hash     TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `active_loans`

```sql
CREATE TABLE active_loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  stellar_pub TEXT NOT NULL UNIQUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Unique index on user_id (one active loan per user)
```

### `bootstrap_assessments`

Currently unused in the live flow (legacy from earlier design). No writes in current route code.

---

## 8. Environment Variables

### Backend (`.env`)

| Variable              | Required | Default                               | Description                            |
| --------------------- | -------- | ------------------------------------- | -------------------------------------- |
| `JWT_SECRET`          | ✅       | —                                     | HS256 JWT signing secret               |
| `ENCRYPTION_KEY`      | ✅       | —                                     | 64-char hex (32 bytes) for AES-256-GCM |
| `ISSUER_SECRET_KEY`   | ✅       | —                                     | Issuer Stellar keypair secret          |
| `WEB_AUTH_SECRET_KEY` | —        | `ISSUER_SECRET_KEY`                   | SEP-10 challenge signing keypair       |
| `PHPC_ID`             | ✅       | —                                     | PHPC token contract ID                 |
| `REGISTRY_ID`         | ✅       | —                                     | credit_registry contract ID            |
| `LENDING_POOL_ID`     | ✅       | —                                     | lending_pool contract ID               |
| `HORIZON_URL`         | —        | `https://horizon-testnet.stellar.org` | Horizon endpoint                       |
| `SOROBAN_RPC_URL`     | —        | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint                   |
| `NETWORK_PASSPHRASE`  | —        | Testnet passphrase                    | Stellar network passphrase             |
| `HOME_DOMAIN`         | —        | `localhost`                           | SEP-10 home domain                     |
| `WEB_AUTH_DOMAIN`     | —        | `localhost:3001`                      | SEP-10 WebAuth domain                  |
| `CORS_ORIGIN`         | —        | `http://localhost:3000`               | Comma-separated allowed origins        |
| `PORT`                | —        | `3001`                                | Backend listen port                    |
| `DATABASE_PATH`       | —        | `../kredito.db`                       | SQLite file path                       |

### Frontend (`.env.local`)

| Variable              | Required | Default                      | Description          |
| --------------------- | -------- | ---------------------------- | -------------------- |
| `NEXT_PUBLIC_API_URL` | —        | `http://localhost:3001/api/` | Backend API base URL |

---

## 9. Fee Bump Transaction Model

For all external (Freighter) user transactions:

1. Backend calls `buildUnsignedContractCall(userPublicKey, contractId, fn, args)`:
   - Gets user account from RPC.
   - Builds a `Transaction` with `invokeHostFunction` op.
   - Calls `rpcServer.prepareTransaction(tx)` (simulates and attaches auth footprint).
   - Returns XDR of the unsigned, prepared transaction.

2. Frontend calls `signTx(xdr, userAddress)` via Freighter:
   - Freighter signs the inner transaction as the user.
   - Returns `signedXdr`.

3. Frontend calls `POST /tx/sign-and-submit` with `signedXdr`.

4. Backend calls `submitSponsoredSignedXdr(signedXdr)`:
   - Deserializes the signed inner transaction.
   - Wraps it in a `FeeBumpTransaction` where the issuer pays the fee (`1,000,000 stroops`).
   - Submits the fee-bump to Soroban RPC.
   - Polls `rpcServer.getTransaction(hash)` until `SUCCESS` or `FAILED` (60 s timeout).
   - Returns `txHash`.

---

## 10. Cron Jobs

### Default Monitor (`0 */6 * * *` — every 6 hours)

- Reads all rows from `active_loans`.
- For each, queries `get_loan` on-chain.
- If `loan.repaid || loan.defaulted` → deletes from `active_loans`.
- If `currentLedger > loan.due_ledger` → calls `markLoanDefaulted` on-chain, refreshes score, inserts `score_events`, deletes from `active_loans`.

### Loan Reconciliation (`0 */2 * * *` — every 2 hours)

- Queries all users from DB.
- For each, queries `get_loan` on-chain.
- If loan exists and is active → `INSERT OR IGNORE INTO active_loans`.
- Ensures `active_loans` stays in sync even if a row was missed.

---

## 11. Frontend State Management

### `useAuthStore` (Zustand + persist)

```typescript
{ token: string | null; user: { wallet: string; isExternal: boolean } | null }
```

- Persists to `localStorage` under key `"kredito-auth"`.
- Cleared on `401` response (via `api.ts` interceptor).

### `useWalletStore` (Zustand, no persist)

```typescript
{
  (isConnected,
    publicKey,
    network,
    networkPassphrase,
    isConnecting,
    connectionError);
}
```

- Session-only; restored on mount by `WalletProvider` via `restoreSession()`.
- Restoration reads `localStorage.kredito_wallet_connected` flag, then calls `requestAccess()` to silently get the address.

### TanStack Query Cache Keys

```typescript
QUERY_KEYS.score(wallet); // ['score', wallet]
QUERY_KEYS.pool; // ['pool']
QUERY_KEYS.loanStatus(wallet); // ['loan-status', wallet]
```

- `staleTime: 5 * 60 * 1000` for score, `30 * 1000` for loan/pool.
- Invalidated after borrow and repay to force a fresh read.

---

## 12. Recommended Fixes by Priority (Cross-Reference to TODO)

| TODO ID | Files                                 | Change Summary                                                  |
| ------- | ------------------------------------- | --------------------------------------------------------------- |
| P0-1    | `borrow/page.tsx`, `repay/page.tsx`   | Change 4× `/loan/sign-and-submit` → `/tx/sign-and-submit`       |
| P0-2    | `frontend/lib/api.ts`                 | `timeout: 15000` → `timeout: 90000`                             |
| P0-3    | `frontend/next.config.ts`             | Add `${NEXT_PUBLIC_API_URL origin}` to CSP `connect-src`        |
| P1-1    | `dashboard/page.tsx`                  | "PHPC" → "XLM" for avgBalance label                             |
| P1-3    | `backend/src/cron.ts`                 | Add startup reconciliation pass                                 |
| P1-4    | `backend/src/routes/tx.ts`, `loan.ts` | Replace `setTimeout(6000)` with retry-loop on `get_loan.repaid` |
| P1-5    | `frontend/app/page.tsx`               | Handle `?session=expired` query param                           |
| P2-5    | `backend/package.json`                | Remove `resend`, `bcrypt` dependencies                          |
| P2-6    | All backend routes                    | Define `DbUser` type, replace `any` cast                        |
| P3-1    | `contracts/lending_pool/src/lib.rs`   | Add `pub fn get_flat_fee_bps(env: Env) -> u32`                  |
| P3-2    | All three contracts                   | Add `extend_ttl` calls on persistent/instance storage mutations |
| P3-3    | `contracts/lending_pool/src/lib.rs`   | Add `admin_withdraw(env, amount)` function                      |

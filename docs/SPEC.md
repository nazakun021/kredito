# Kredito — Technical Specification

> **Version:** 1.1 (post-audit)  
> **Network:** Stellar Testnet → Mainnet-ready  
> **Scope:** Frontend ↔ Backend ↔ Soroban contract integration, data flows, API contracts, and production requirements

---

## 1. System Overview

Kredito is a three-layer micro-lending system:

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 16 / React 19)                       │
│  Freighter wallet → SEP-10 auth → score UI → loan flows │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API  (JWT in Authorization header)
┌───────────────────────▼─────────────────────────────────┐
│  BACKEND (Express 5 / TypeScript)                       │
│  Auth · Score orchestration · Fee-bump sponsorship      │
│  SQLite: users · score_events · active_loans            │
└───────┬──────────────────────────┬──────────────────────┘
        │ Stellar SDK              │ Horizon / Soroban RPC
┌───────▼──────────────────────────▼──────────────────────┐
│  STELLAR TESTNET                                        │
│  credit_registry  ·  lending_pool  ·  phpc_token        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Smart Contract Specifications

### 2.1 `credit_registry`

**Address (testnet):** `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ`

#### Storage

| Key                      | Type      | Description                   |
| ------------------------ | --------- | ----------------------------- |
| `Issuer`                 | `Address` | Admin who can write scores    |
| `Tier{1,2,3}Limit`       | `i128`    | Max borrow per tier (stroops) |
| `Metrics(Address)`       | `Metrics` | Raw metrics struct per wallet |
| `Score(Address)`         | `u32`     | Computed score                |
| `CreditTier(Address)`    | `u32`     | 0–3 tier                      |
| `TierTimestamp(Address)` | `u64`     | Last update timestamp         |

#### Score Formula (canonical — Rust implementation)

```
avg_balance_factor = min(avg_balance / 100, 10)
score = (tx_count × 2) + (repayment_count × 10) + (avg_balance_factor × 5) - (default_count × 25)
```

#### Tier Thresholds

| Tier | Label   | Min Score |
| ---- | ------- | --------- |
| 0    | Unrated | —         |
| 1    | Bronze  | 40        |
| 2    | Silver  | 80        |
| 3    | Gold    | 120       |

#### Default Borrow Limits (deployed)

| Tier     | Limit (PHPC) | Stroops         |
| -------- | ------------ | --------------- |
| 1 Bronze | 5,000        | 50,000,000,000  |
| 2 Silver | 20,000       | 200,000,000,000 |
| 3 Gold   | 50,000       | 500,000,000,000 |

#### Callable Functions

| Function                                        | Auth Required | Description                         |
| ----------------------------------------------- | ------------- | ----------------------------------- |
| `initialize(issuer, t1, t2, t3)`                | issuer        | One-time init                       |
| `update_metrics(wallet, metrics)`               | issuer        | Write metrics + compute score       |
| `update_metrics_raw(wallet, tx, rep, bal, def)` | issuer        | Same, raw args                      |
| `update_score(wallet)`                          | issuer        | Recompute score from stored metrics |
| `set_tier(wallet, tier)`                        | issuer        | Override tier directly              |
| `revoke_tier(wallet)`                           | issuer        | Reset to tier 0                     |
| `get_score(wallet)` → `u32`                     | none          | Read score                          |
| `get_tier(wallet)` → `u32`                      | none          | Read tier                           |
| `get_metrics(wallet)` → `Metrics`               | none          | Read raw metrics                    |
| `get_tier_limit(tier)` → `i128`                 | none          | Read tier borrow limit              |
| `compute_score(metrics)` → `u32`                | none          | Off-chain calculation helper        |

---

### 2.2 `lending_pool`

**Address (testnet):** `CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH`

#### Storage

| Key               | Type         | Description                                           |
| ----------------- | ------------ | ----------------------------------------------------- |
| `Admin`           | `Address`    | Pool admin                                            |
| `RegistryId`      | `Address`    | credit_registry contract address                      |
| `TokenId`         | `Address`    | phpc_token contract address                           |
| `FlatFeeBps`      | `u32`        | Base fee in basis points (default: 500)               |
| `LoanTermLedgers` | `u32`        | Loan duration in ledgers (default: 518,400 ≈ 30 days) |
| `Loan(Address)`   | `LoanRecord` | Per-borrower loan record                              |
| `PoolBalance`     | `i128`       | Total PHPC held by pool                               |

#### Fee Tiers (contract-authoritative)

```rust
fn tier_fee_bps(base_fee_bps: u32, tier: u32) -> u32 {
    match tier {
        3 => base_fee_bps.saturating_sub(350),  // 500 - 350 = 150 bps (1.5%)
        2 => base_fee_bps.saturating_sub(200),  // 500 - 200 = 300 bps (3.0%)
        _ => base_fee_bps,                       //         500 bps (5.0%)
    }
}
```

> ⚠️ **Important:** The backend `tierFeeBps()` in `engine.ts` MUST mirror this function.  
> Current testnet deployment: `flat_fee_bps = 500`.

#### `LoanRecord` struct

```rust
pub struct LoanRecord {
    pub principal: i128,      // amount borrowed in stroops
    pub fee: i128,             // fee in stroops (computed at borrow time)
    pub due_ledger: u32,       // ledger sequence when loan expires
    pub repaid: bool,
    pub defaulted: bool,
}
```

#### Borrow Pre-conditions (all must pass)

1. No active loan exists for this borrower (`!loan.repaid && !loan.defaulted` fails)
2. `credit_registry.get_tier(borrower) >= 1`
3. `amount <= credit_registry.get_tier_limit(tier)`
4. `amount <= pool_balance`
5. `amount > 0`

#### Repay Pre-conditions

1. Loan exists
2. `!loan.repaid`
3. `!loan.defaulted`
4. `current_ledger <= loan.due_ledger`
5. Borrower has approved `lending_pool` to spend `principal + fee` from their PHPC balance

#### Callable Functions

| Function                                            | Auth Required         | Description                    |
| --------------------------------------------------- | --------------------- | ------------------------------ |
| `initialize(admin, registry, token, fee_bps, term)` | admin                 | One-time init                  |
| `deposit(amount)`                                   | admin                 | Fund the pool                  |
| `borrow(borrower, amount)`                          | borrower              | Disburse loan                  |
| `repay(borrower)`                                   | borrower              | Settle loan                    |
| `mark_default(borrower)`                            | none (permissionless) | Mark overdue loan as defaulted |
| `get_loan(borrower)` → `Option<LoanRecord>`         | none                  | Read loan record               |
| `get_pool_balance()` → `i128`                       | none                  | Read pool liquidity            |

---

### 2.3 `phpc_token`

**Address (testnet):** `CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR`

SEP-41 compatible token. 7 decimal places (1 PHPC = 10,000,000 stroops).

#### Relevant Functions

| Function                                   | Auth Required | Description            |
| ------------------------------------------ | ------------- | ---------------------- |
| `mint(to, amount)`                         | admin         | Create PHPC            |
| `approve(from, spender, amount, expiry)`   | from          | Authorize spending     |
| `transfer_from(spender, from, to, amount)` | spender       | Pull funds             |
| `balance(id)` → `i128`                     | none          | Read balance           |
| `allowance(from, spender)` → `i128`        | none          | Read current allowance |

#### Allowance Expiry

`expiration_ledger` must be `>= current_ledger.sequence` at the time of `approve`.  
**Backend MUST query `rpcServer.getLatestLedger()` and set `expiration_ledger = latestLedger.sequence + 500`** (≈1 hour buffer at 5s/ledger).

---

## 3. Backend API Specification

**Base URL:** `http://localhost:3001/api` (dev) / `https://api.kredito.io/api` (prod)  
**Auth:** `Authorization: Bearer <JWT>` on all protected routes  
**JWT expiry:** 24 h (to be refreshed via `/auth/refresh`)

---

### 3.1 Auth Routes

#### `POST /auth/challenge`

Request body:

```json
{ "stellarAddress": "G..." }
```

Response `200`:

```json
{
  "challengeXdr": "<base64 SEP-10 tx>",
  "expiresIn": 300
}
```

Errors: `400` Invalid address | `400` Address not Ed25519

#### `POST /auth/login`

Request body:

```json
{ "signedChallengeXdr": "<base64>" }
```

Response `200`:

```json
{
  "token": "<JWT>",
  "wallet": "G...",
  "isNew": true,
  "isExternal": true
}
```

Errors: `401` Bad signature | `401` Challenge expired/consumed

#### `POST /auth/refresh` _(to be implemented — see TODO M-9)_

Request: `Authorization: Bearer <valid JWT>`  
Response `200`: `{ "token": "<new JWT>" }`

---

### 3.2 Credit Routes

#### `POST /credit/generate`

_Auth required_  
Triggers off-chain metric fetch → score computation → on-chain `update_metrics_raw` + `update_score`.  
Response `200`: [ScorePayload](#scorePayload)

#### `GET /credit/score`

_Auth required_  
Returns cached score_json from last `score_events` row, merged with fresh on-chain snapshot.  
Response `200`: [ScorePayload](#scorePayload)  
Error `404` if no score has been generated yet.

#### `GET /credit/pool`

_Auth required_  
Response `200`:

```json
{ "poolBalance": "100000.00", "poolBalanceRaw": "1000000000000000" }
```

#### `GET /credit/metrics`

_Auth required_  
Returns raw `Metrics` struct from on-chain credit_registry.

---

### 3.3 Loan Routes

#### `POST /loan/borrow`

_Auth required_  
Request body:

```json
{ "amount": 500.0 }
```

For **external wallets** (Freighter):

```json
{
  "requiresSignature": true,
  "unsignedXdr": "<base64 prepared tx>",
  "meta": {
    "amount": "500.00",
    "fee": "7.50",
    "feeBps": 150,
    "totalOwed": "507.50"
  }
}
```

On `POST /loan/sign-and-submit` with `flow: { action: "borrow" }`, response:

```json
{
  "txHash": "abc123",
  "txHashes": ["abc123"],
  "explorerUrl": "https://stellar.expert/...",
  "amount": "500.00",
  "fee": "7.50",
  "feeBps": 150,
  "totalOwed": "507.50",
  "dueDate": "<ISO 8601 estimated from due_ledger>"
}
```

Errors: `400` Invalid amount | `400` Active loan exists | `400` No qualifying credit tier | `400` Amount exceeds tier limit

#### `POST /loan/repay`

_Auth required_  
For **external wallets** — two-phase flow:

**Phase 1 (allowance not set):**

```json
{
  "requiresSignature": true,
  "step": "approve",
  "unsignedXdr": "<base64 approve tx>",
  "meta": { "amountRepaid": "507.50" }
}
```

Client submits via `POST /loan/sign-and-submit` with `flow: { action: "repay", step: "approve" }`.

**Phase 2 (allowance confirmed on-chain):**

```json
{
  "requiresSignature": true,
  "step": "repay",
  "unsignedXdr": "<base64 repay tx>",
  "meta": { "amountRepaid": "507.50" }
}
```

Client submits via `POST /loan/sign-and-submit` with `flow: { action: "repay", step: "repay" }`, which triggers score refresh and returns:

```json
{
  "txHash": "def456",
  "amountRepaid": "507.50",
  "previousScore": 84,
  "newScore": 94,
  "newTier": "Silver",
  "newBorrowLimit": "20000.00",
  "explorerUrl": "https://stellar.expert/..."
}
```

#### `GET /loan/status`

_Auth required_  
Response `200` (no active loan):

```json
{
  "hasActiveLoan": false,
  "loan": null,
  "walletPhpBalance": "25.00",
  "poolBalance": "99500.00",
  "poolBalanceRaw": "995000000000000"
}
```

Response `200` (active loan):

```json
{
  "hasActiveLoan": true,
  "walletPhpBalance": "500.00",
  "poolBalance": "99500.00",
  "poolBalanceRaw": "...",
  "loan": {
    "principal": "500.00",
    "fee": "7.50",
    "totalOwed": "507.50",
    "walletBalance": "500.00",
    "shortfall": "7.50",
    "dueLedger": 12345678,
    "currentLedger": 12300000,
    "dueDate": "2026-05-30T00:00:00Z",
    "daysRemaining": 29,
    "status": "active"
  }
}
```

`status` values: `"active"` | `"overdue"` | `"repaid"` | `"defaulted"`

#### `POST /loan/sign-and-submit`

_Auth required_  
Request body:

```json
{
  "signedInnerXdr": ["<base64>"],
  "flow": { "action": "borrow" | "repay", "step": "approve" | "repay" | undefined }
}
```

Wraps in fee-bump, submits, polls for confirmation.  
Returns action-specific payload (see borrow / repay success shapes above).

---

### <a name="scorePayload"></a>3.4 ScorePayload Schema

```typescript
interface ScorePayload {
  walletAddress: string;
  source: "generated" | "onchain";
  score: number; // 0 – 800+
  tier: number; // 0–3
  tierNumeric: number;
  tierLabel: "Unrated" | "Bronze" | "Silver" | "Gold";
  borrowLimit: string; // PHP decimal string e.g. "5000.00"
  borrowLimitRaw: string; // stroops as string
  feeRate: number; // decimal percent e.g. 1.5
  feeBps: number; // e.g. 150
  progressToNext: number; // points needed for next tier
  nextTier: string | null;
  nextTierThreshold: number | null;
  metrics: {
    txCount: number;
    repaymentCount: number;
    avgBalance: number; // raw XLM balance floored
    avgBalanceFactor: number; // min(avgBalance/100, 10)
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

## 4. Frontend ↔ Backend Data Contract

### 4.1 Authentication Flow

```
Browser                         Backend                  Stellar
  │─── POST /auth/challenge ──────▶│                        │
  │◀── { challengeXdr } ───────────│                        │
  │                                │                        │
  │─── Freighter.signTransaction ──▶ (user signs locally)   │
  │                                │                        │
  │─── POST /auth/login ───────────▶│                       │
  │◀── { token, wallet, isNew } ───│                        │
  │                                │                        │
  │─── store token in authStore ───│                        │
  │    (Zustand persist)           │                        │
```

### 4.2 Borrow Flow (External Wallet)

```
Frontend                         Backend                  Freighter   Stellar
  │── POST /loan/borrow ──────────▶│                        │           │
  │◀── { requiresSignature, xdr } ─│                        │           │
  │                                │                        │           │
  │── signTx(xdr) ─────────────────────────────────────────▶│           │
  │◀── { signedXdr } ──────────────────────────────────────│           │
  │                                │                        │           │
  │── POST /loan/sign-and-submit ─▶│                        │           │
  │                                │── fee-bump + submit ──────────────▶│
  │                                │── pollTransaction ─────────────────▶│
  │◀── { txHash, amount, fee, totalOwed, dueDate } ─────────│           │
```

### 4.3 Repay Flow (External Wallet — Two-Phase)

```
Frontend                         Backend                  Freighter   Stellar
  │── POST /loan/repay ───────────▶│                        │           │
  │◀── { step: "approve", xdr } ───│ (checks allowance < owed)         │
  │                                │                        │           │
  │── signTx(approveXdr) ──────────────────────────────────▶│           │
  │── POST /loan/sign-and-submit ─▶│ flow.step="approve"    │           │
  │                                │── fee-bump approve ───────────────▶│
  │◀── { txHash } ─────────────────│ (polls to confirmation)            │
  │                                │                        │           │
  │── POST /loan/repay ───────────▶│                        │           │
  │◀── { step: "repay", xdr } ─────│ (allowance now set)    │           │
  │                                │                        │           │
  │── signTx(repayXdr) ────────────────────────────────────▶│           │
  │── POST /loan/sign-and-submit ─▶│ flow.step="repay"      │           │
  │                                │── fee-bump repay ─────────────────▶│
  │                                │── await 6s backoff ────────────────│
  │                                │── buildScoreSummary ───────────────▶│
  │                                │── updateOnChainMetrics ────────────▶│
  │◀── { newScore, newTier, ... } ─│                        │           │
```

---

## 5. Database Schema

**Engine:** SQLite via `better-sqlite3`

```sql
CREATE TABLE users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  email                TEXT UNIQUE NOT NULL,   -- synthetic for Freighter users
  stellar_pub          TEXT UNIQUE NOT NULL,
  stellar_enc_secret   TEXT,                   -- NULL for external wallets
  is_external          BOOLEAN NOT NULL DEFAULT 0,
  email_verified       BOOLEAN NOT NULL DEFAULT 0,
  otp_hash             TEXT,
  otp_expires_at       DATETIME,
  otp_attempt_count    INTEGER NOT NULL DEFAULT 0,
  otp_locked_until     DATETIME,
  last_login_at        DATETIME,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth_challenges (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  stellar_pub    TEXT NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  expires_at     DATETIME NOT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Index: (stellar_pub, challenge_hash)

CREATE TABLE score_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  tier             INTEGER NOT NULL,
  score            INTEGER NOT NULL,
  bootstrap_score  INTEGER NOT NULL DEFAULT 0,
  stellar_score    INTEGER NOT NULL DEFAULT 0,
  score_json       TEXT NOT NULL,
  sbt_minted       BOOLEAN NOT NULL DEFAULT 0,
  sbt_tx_hash      TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE active_loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  stellar_pub TEXT NOT NULL UNIQUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Index: UNIQUE (user_id) — one active loan per user
```

---

## 6. Scoring Engine Specification

### 6.1 Metric Sources

| Metric            | Source             | Method                                                                               |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `tx_count`        | Horizon            | `GET /accounts/{id}/transactions?limit=200&order=desc` — returns at most 200 records |
| `avg_balance`     | Horizon            | Native XLM balance, floored to integer                                               |
| `repayment_count` | Soroban RPC Events | `getEvents` filtered by `lending_pool` contract, topic `"repaid"`, address match     |
| `default_count`   | Soroban RPC Events | Same, topic `"defaulted"`                                                            |

> Fallback: if RPC events return 0 for repaid/defaulted, `get_loan` is queried directly for the most recent loan outcome.

### 6.2 Score Formula (TypeScript mirror of Rust)

```typescript
function calculateScore(metrics: WalletMetrics): number {
  const avgBalanceFactor = Math.min(Math.floor(metrics.avgBalance / 100), 10);
  return Math.max(
    0,
    metrics.txCount * 2 +
      metrics.repaymentCount * 10 +
      avgBalanceFactor * 5 -
      metrics.defaultCount * 25,
  );
}

// CANONICAL fee bps (must mirror contracts/lending_pool/src/lib.rs tier_fee_bps)
function tierFeeBps(tier: number, baseBps = 500): number {
  switch (tier) {
    case 3:
      return baseBps - 350; // 150 bps = 1.5%
    case 2:
      return baseBps - 200; // 300 bps = 3.0%
    default:
      return baseBps; // 500 bps = 5.0%
  }
}
```

### 6.3 On-Chain Update Flow

```
buildWalletMetrics(address)
  → fetchTxCount, fetchAverageBalance, fetchRepaymentMetrics (parallel)
  → calculateScore(metrics)
  → scoreToTier(score)
  → getTierLimit(tier)
  → buildScorePayload(...)

updateOnChainMetrics(address, metrics)
  → invokeIssuerContract([
      { fn: 'update_metrics_raw', args: [wallet, tx, rep, bal, def] },
      { fn: 'update_score', args: [wallet] }
    ])
  → await pollTransaction(hash)   ← MUST wait for confirmation
```

---

## 7. Fee-Bump / Sponsorship Specification

All Freighter user transactions are **sponsored by the issuer account**.

### 7.1 Unsigned Transaction Build

```
buildUnsignedContractCall(userPublicKey, contractId, fnName, args)
  1. ensureUserAccountByAddress(userPublicKey)     -- create if missing
  2. buildInvokeTransaction(sourceAccount, ...)    -- fee: 100 stroops
  3. rpcServer.prepareTransaction(tx)              -- simulate + footprint
  4. return prepared.toXDR()                       -- NOT signed
```

### 7.2 Fee-Bump Submission

```
submitSponsoredSignedXdr(signedInnerXdr)
  1. Parse inner transaction
  2. TransactionBuilder.buildFeeBumpTransaction(issuerKeypair, "1000000", innerTx, network)
  3. feeBump.sign(issuerKeypair)
  4. rpcServer.sendTransaction(feeBump)
  5. if status !== 'PENDING': throw
  6. await pollTransaction(hash, 60_000ms timeout)
  7. return hash
```

### 7.3 Sponsorship Budget

Base fee per transaction: `1,000,000 stroops` (0.1 XLM).  
For the full repay flow (approve + repay): `2,000,000 stroops` (0.2 XLM) per user action.  
The issuer account requires a minimum XLM balance sufficient for all concurrent operations.

---

## 8. Security Requirements

### 8.1 SEP-10 Implementation

- Challenge timeout: 300 s (5 minutes)
- Challenges are stored in DB and **consumed on first use** (replay-protected)
- `WebAuth.verifyChallengeTxSigners` is called server-side before issuing JWT
- The `webAuthSecretKey` may differ from `issuerSecretKey` (recommended)

### 8.2 JWT

- Algorithm: `HS256`
- Payload: `{ userId: number, iat, exp }`
- Expiry: `24h`
- **Production recommendation:** HttpOnly cookie; `SameSite=Strict`

### 8.3 Encryption at Rest

- Internal wallet secrets: `AES-256-GCM` via `crypto.ts`
- `ENCRYPTION_KEY` must be exactly 64 hex characters (32 bytes)

### 8.4 Input Validation

- All route bodies validated with `zod`
- Stellar addresses validated with `StrKey.isValidEd25519PublicKey`
- Amount must be finite, positive number

### 8.5 CORS

- `CORS_ORIGIN` env var controls allowed origins
- `credentials: true` only when origin matches allowlist

---

## 9. Environment Variables

### Backend (required)

| Variable              | Format                          | Example                               |
| --------------------- | ------------------------------- | ------------------------------------- |
| `JWT_SECRET`          | any string (≥32 chars)          | `openssl rand -hex 32`                |
| `ENCRYPTION_KEY`      | 64 hex chars                    | `openssl rand -hex 32`                |
| `ISSUER_SECRET_KEY`   | Stellar secret key `S...`       |                                       |
| `WEB_AUTH_SECRET_KEY` | Stellar secret key              | defaults to ISSUER_SECRET_KEY         |
| `HOME_DOMAIN`         | domain string                   | `kredito.io`                          |
| `WEB_AUTH_DOMAIN`     | domain:port                     | `api.kredito.io`                      |
| `HORIZON_URL`         | HTTPS URL                       | `https://horizon-testnet.stellar.org` |
| `SOROBAN_RPC_URL`     | HTTPS URL                       | `https://soroban-testnet.stellar.org` |
| `NETWORK_PASSPHRASE`  | string                          | `Test SDF Network ; September 2015`   |
| `PHPC_ID`             | Stellar contract address `C...` |                                       |
| `REGISTRY_ID`         | Stellar contract address `C...` |                                       |
| `LENDING_POOL_ID`     | Stellar contract address `C...` |                                       |

### Backend (optional)

| Variable        | Default                 | Description                     |
| --------------- | ----------------------- | ------------------------------- |
| `PORT`          | 3001                    | HTTP port                       |
| `CORS_ORIGIN`   | `http://localhost:3000` | Comma-separated allowed origins |
| `DATABASE_PATH` | `./kredito.db`          | SQLite file path                |

### Frontend (required)

| Variable                   | Example                                   |
| -------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_API_URL`      | `http://localhost:3001/api`               |
| `NEXT_PUBLIC_NETWORK`      | `testnet`                                 |
| `NEXT_PUBLIC_EXPLORER_URL` | `https://stellar.expert/explorer/testnet` |

---

## 10. Cron Jobs

### Default Monitor (`0 */6 * * *` — every 6 hours)

```
For each row in active_loans:
  1. queryContract(lendingPool, 'get_loan', [wallet])
  2. If loan.repaid or loan.defaulted: DELETE FROM active_loans
  3. If latestLedger.sequence > loan.due_ledger:
     a. markLoanDefaulted(wallet)    ← must poll for confirmation
     b. buildScoreSummary(wallet)
     c. updateOnChainMetrics(wallet, metrics)  ← must poll for confirmation
     d. INSERT INTO score_events (reason: 'default')
     e. DELETE FROM active_loans
```

### Loan Reconciliation (`0 */2 * * *` — every 2 hours) _(to be added)_

```
For each user in users table:
  1. queryContract(lendingPool, 'get_loan', [stellar_pub])
  2. If active loan found and NOT in active_loans:
     INSERT INTO active_loans
  3. If no active loan found but in active_loans:
     DELETE FROM active_loans (self-heals stale records)
```

---

## 11. Production Readiness Checklist

### Contracts

- [x] Audit `tier_fee_bps` values match backend display
- [ ] `flat_fee_bps` is queryable at runtime (add `get_flat_fee_bps` view function or store in backend config)
- [x] Verify `loan_term_ledgers` produces correct day count: 30 days × 17,280 = 518,400
- [ ] Contract storage TTL extension strategy (Soroban persistent entries expire)
- [ ] Mainnet deployment with audited seed phrase management

### Backend

- [x] Rate limiting
- [x] `pollTransaction` on all issuer-signed transactions
- [x] `expiration_ledger` computed dynamically
- [x] Startup Stellar connectivity probe
- [x] Structured logging (replace `console.log`)
- [ ] Graceful shutdown handler (`SIGTERM`)
- [ ] Database migration system (not ad-hoc `ALTER TABLE`)
- [ ] Production database: PostgreSQL with connection pooling

### Frontend

- [x] Security headers in `next.config.ts`
- [x] Remove recursive interceptor — explicit multi-step flow
- [x] `txStep` driven by pipeline events
- [x] Wallet state cleared on 401
- [x] `loanStatus` query key includes wallet address
- [x] SSR-safe `Math.random()` in particles

### Infrastructure

- [ ] TLS termination at load balancer
- [ ] Issuer key stored in HSM / secrets manager (not env var)
- [ ] SQLite WAL mode enabled for concurrent reads
- [x] Health endpoint monitored (`/health` → also probe Stellar RPC)
- [ ] Alerts on issuer XLM balance below 100 XLM

---

## 12. Known Limitations (Testnet Demo)

| Limitation                                            | Impact                              | Resolution Path                               |
| ----------------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| `tx_count` capped at 200                              | Score plateaus for power users      | Paginate Horizon or increase limit            |
| RPC event retention window (~1M ledgers)              | Old repayments not counted          | Use `get_loan` fallback (already implemented) |
| SQLite single-writer                                  | Not suitable for horizontal scaling | Migrate to PostgreSQL                         |
| `fetchAverageBalance` is a point-in-time XLM snapshot | Does not reflect historical balance | Use TWAP from Horizon balance history         |
| Fee not auto-funded on repayment                      | User must hold principal + fee      | Communicate clearly in UI (done)              |
| No multi-sig wallet support                           | Only single-key Freighter accounts  | Out of scope for v1                           |

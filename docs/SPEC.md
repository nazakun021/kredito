# SPEC.md — Kredito v2 Technical Specification

### Soroban-First · Stateless Backend · Chain as Source of Truth

**Version:** 2.0.0
**Network:** Stellar Testnet (Soroban-enabled)
**Status:** Refactor Target

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Smart Contracts](#2-smart-contracts)
3. [Backend API](#3-backend-api)
4. [Frontend](#4-frontend)
5. [Authentication Protocol](#5-authentication-protocol)
6. [Credit Scoring Model](#6-credit-scoring-model)
7. [Transaction Flows](#7-transaction-flows)
8. [Data Models](#8-data-models)
9. [Error Handling](#9-error-handling)
10. [Environment Configuration](#10-environment-configuration)
11. [Invariants & Constraints](#11-invariants--constraints)

---

## 1. System Architecture

### 1.1 High-Level Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│  USER BROWSER                                                      │
│                                                                    │
│  ┌──────────────────────┐     ┌────────────────────────────────┐  │
│  │  Next.js Frontend    │────▶│  Freighter Extension           │  │
│  │  (React 19, Zustand) │◀────│  (Signs XDR, holds private key)│  │
│  └──────────┬───────────┘     └────────────────────────────────┘  │
└─────────────│──────────────────────────────────────────────────────┘
              │ HTTPS (JSON + XDR)
              ▼
┌─────────────────────────────────────────┐
│  BACKEND (Express, Stateless)           │
│                                         │
│  Routes: auth / credit / loan / tx      │
│  Stellar SDK: TX build, query, feebump  │
│  Scoring Engine: pure function          │
│  ❌ No database                         │
│  ❌ No persistent state                 │
└────────────────┬────────────────────────┘
                 │ Soroban RPC + Horizon
                 ▼
┌────────────────────────────────────────────────────────────────┐
│  STELLAR TESTNET (Soroban)                                     │
│                                                                │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │ credit_registry │  │  lending_pool    │  │ phpc_token  │  │
│  │                 │  │                  │  │             │  │
│  │ score           │  │ borrow()         │  │ transfer()  │  │
│  │ tier            │  │ repay()          │  │ approve()   │  │
│  │ metrics         │  │ mark_default()   │  │ balance()   │  │
│  │ tier_limits     │  │ get_loan()       │  │ mint()      │  │
│  └─────────────────┘  └──────────────────┘  └─────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 Responsibility Matrix

| Concern                   | Frontend       | Backend        | Contract    |
| ------------------------- | -------------- | -------------- | ----------- |
| Wallet connection         | ✅             | ❌             | ❌          |
| Auth challenge generation | ❌             | ✅             | ❌          |
| Auth challenge signing    | ✅ (Freighter) | ❌             | ❌          |
| JWT issuance              | ❌             | ✅             | ❌          |
| Score computation         | ❌             | ✅ (off-chain) | ❌          |
| Score storage             | ❌             | ❌             | ✅          |
| Loan state                | ❌             | ❌             | ✅          |
| TX building               | ❌             | ✅             | ❌          |
| TX signing                | ✅ (Freighter) | ❌             | ❌          |
| TX sponsorship            | ❌             | ✅ (fee-bump)  | ❌          |
| TX submission             | ❌             | ✅             | ❌          |
| Rule enforcement          | ❌             | ❌             | ✅          |
| User identity             | Wallet addr    | Wallet addr    | Wallet addr |
| Data persistence          | ❌             | ❌             | ✅ (ledger) |

### 1.3 Design Principles (Non-Negotiable)

1. **Chain is the source of truth** — Any state that matters lives in a Soroban contract.
2. **Backend is replaceable** — Any stateless service with the right RPC credentials can replace it.
3. **Wallet is identity** — No email, no username, no userId. Stellar public key is the user.
4. **Contracts enforce rules** — Backend performs UX pre-checks only. Enforcement is on-chain.
5. **Frontend is a viewer + signer** — It displays chain state and triggers Freighter signatures.

---

## 2. Smart Contracts

### 2.1 Deployed Contract Addresses (Testnet)

| Contract          | Address                                                    |
| ----------------- | ---------------------------------------------------------- |
| `credit_registry` | `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ` |
| `lending_pool`    | `CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH` |
| `phpc_token`      | `CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR` |

### 2.2 `credit_registry`

**Purpose:** Stores credit score, tier, and raw metrics for each wallet address. Acts as the on-chain Credit Passport.

**Storage layout:**

| Key             | Type      | Description                                                     |
| --------------- | --------- | --------------------------------------------------------------- |
| `Admin`         | `Address` | Issuer/admin, only account authorized to call `update_metrics`  |
| `Score(addr)`   | `u32`     | Computed score, written by issuer via `update_metrics`          |
| `Tier(addr)`    | `u32`     | Tier 0–3, derived from score                                    |
| `Metrics(addr)` | `Metrics` | Raw `{ tx_count, repayment_count, avg_balance, default_count }` |
| `TierLimit(1)`  | `i128`    | Borrow ceiling for Tier 1, in 7-decimal PHPC                    |
| `TierLimit(2)`  | `i128`    | Borrow ceiling for Tier 2                                       |
| `TierLimit(3)`  | `i128`    | Borrow ceiling for Tier 3                                       |

**Initialized with:**

```
tier1_limit = 50_000_000_000   // 5,000 PHPC
tier2_limit = 200_000_000_000  // 20,000 PHPC
tier3_limit = 500_000_000_000  // 50,000 PHPC
```

**Interface:**

```rust
fn initialize(issuer: Address, tier1_limit: i128, tier2_limit: i128, tier3_limit: i128)
fn update_metrics(user: Address, metrics: Metrics) -> u32   // requires issuer auth
fn update_metrics_raw(user: Address, tx_count: u32, repayment_count: u32, avg_balance: u32, default_count: u32)
fn update_score(user: Address)
fn compute_score(metrics: Metrics) -> u32                   // view — no state change
fn get_score(user: Address) -> u32
fn get_tier(user: Address) -> u32
fn get_metrics(user: Address) -> Metrics
fn get_tier_limit(tier: u32) -> i128
fn set_tier(user: Address, tier: u32)                       // requires issuer auth (admin override)
fn revoke_tier(user: Address)                               // requires issuer auth
fn transfer(from, to, amount)                               // always panics with #6 — SBT non-transferable
fn transfer_from(spender, from, to, amount)                 // always panics with #6
```

**Score Formula (on-chain, mirrors backend):**

```
score = (tx_count × 2) + (repayment_count × 10) + (avg_balance × 5) − (default_count × 25)
score = max(0, score)
```

**Tier derivation:**

```
tier 0: score < 40
tier 1: score >= 40
tier 2: score >= 80
tier 3: score >= 120
```

**Error codes:**

```
#1 AlreadyInitialized
#2 NotInitialized
#3 InvalidLimits         (non-positive or non-ascending tier limits)
#4 DescendingLimits
#5 InvalidTier           (set_tier called with tier = 0)
#6 NonTransferable       (SBT semantics — wallet score is not transferable)
```

### 2.3 `lending_pool`

**Purpose:** Manages the PHPC liquidity pool. Enforces all loan rules. One active loan per wallet.

**Storage layout:**

| Key          | Type         | Description                                       |
| ------------ | ------------ | ------------------------------------------------- |
| `Admin`      | `Address`    | Pool admin                                        |
| `Registry`   | `Address`    | `credit_registry` contract address                |
| `PhpcToken`  | `Address`    | `phpc_token` contract address                     |
| `FlatFeeBps` | `u32`        | Default fee in basis points (overridden per tier) |
| `LoanTerm`   | `u32`        | Loan duration in ledgers (518,400 ≈ 30 days)      |
| `Loan(addr)` | `LoanRecord` | Active loan record per borrower                   |

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

**Fee per tier:**

```
Tier 1: 500 bps (5.0%)
Tier 2: 300 bps (3.0%)
Tier 3: 150 bps (1.5%)
```

**Interface:**

```rust
fn initialize(admin: Address, registry: Address, phpc: Address, fee_bps: u32, loan_term: u32)
fn deposit(amount: i128)                           // admin funds the pool
fn borrow(borrower: Address, amount: i128)         // requires borrower auth
fn repay(borrower: Address)                        // requires borrower auth via phpc approve
fn mark_default(borrower: Address)                 // requires admin auth; only on overdue loans
fn get_loan(borrower: Address) -> Option<LoanRecord>
fn get_pool_balance() -> i128
```

**Borrow enforcement (on-chain):**

1. Borrower must have a tier ≥ 1 in `credit_registry` (checks `get_tier()`)
2. No active loan exists (`get_loan()` is `None` or `repaid/defaulted`)
3. Amount ≤ `tier_limit` for borrower's current tier
4. Amount ≤ current pool balance
5. Amount > 0

**Repay enforcement (on-chain):**

1. An active loan exists for borrower
2. Loan is not defaulted
3. Loan is not yet overdue (current ledger ≤ `due_ledger`)
4. PHPC approval ≥ `principal + fee` has been granted to pool

**Error codes:**

```
#3  InvalidFeeBps          fee_bps > 10000
#4  InvalidLoanTerm        loan_term = 0
#5  InvalidAmount          amount <= 0
#6  NotInitialized
#7  ActiveLoanExists       double-borrow attempt
#8  NoSbt                  borrower has no credit tier
#9  OverLimit              amount > tier_limit
#10 InsufficientLiquidity  amount > pool_balance
#15 LoanDefaulted          repay called on defaulted loan
#16 LoanOverdue            repay called after due_ledger
#18 LoanNotOverdue         mark_default called before due_ledger
```

### 2.4 `phpc_token`

**Purpose:** SEP-41 compliant stablecoin pegged to Philippine Peso. Used as the lending currency.

**Decimals:** 7 (100_000_000 = 10 PHPC)

**Interface:** Standard SEP-41 token interface:

```rust
fn initialize(admin: Address, decimal: u32, name: String, symbol: String)
fn mint(to: Address, amount: i128)          // admin only
fn transfer(from, to, amount)
fn transfer_from(spender, from, to, amount)
fn approve(from, spender, amount, expiration_ledger)
fn balance(id: Address) -> i128
fn allowance(from, spender) -> i128
fn burn(from, amount)
fn decimals() -> u32
fn name() -> String
fn symbol() -> String
fn total_supply() -> i128
```

**Amount encoding (7 decimals):**

```
1 PHPC    = 10_000_000
100 PHPC  = 1_000_000_000
500 PHPC  = 5_000_000_000
5000 PHPC = 50_000_000_000
```

---

## 3. Backend API

### 3.1 Base Configuration

| Property       | Value                              |
| -------------- | ---------------------------------- |
| Default port   | `3001`                             |
| Base path      | `/api`                             |
| Auth mechanism | Bearer JWT                         |
| Content-Type   | `application/json`                 |
| CORS origin    | Configurable via `CORS_ORIGIN` env |

### 3.2 Authentication Routes

#### `POST /api/auth/challenge`

**Auth:** None

**Request:**

```json
{ "wallet": "G..." }
```

**Response `200`:**

```json
{
  "challenge": "<SEP-10 signed transaction XDR>",
  "expiresAt": 1700000000
}
```

**Behavior:**

- Generates a SEP-10 transaction challenge signed by `WEB_AUTH_SECRET_KEY`
- Challenge is a Stellar transaction with `manageData` operation
- TTL: 5 minutes (300 seconds)
- No DB interaction

---

#### `POST /api/auth/login`

**Auth:** None

**Request:**

```json
{ "signedChallenge": "<signed XDR from Freighter>" }
```

**Response `200`:**

```json
{
  "token": "<JWT>",
  "wallet": "G..."
}
```

**JWT Payload:**

```json
{
  "sub": "G...",
  "iat": 1700000000,
  "exp": 1700003600
}
```

**Behavior:**

- Verifies Freighter signature against the challenge
- Issues short-lived JWT (1 hour)
- No DB write
- Returns `401` on invalid or expired challenge

---

### 3.3 Credit Routes

All routes require `Authorization: Bearer <JWT>`.

#### `GET /api/credit/score`

**Response `200`:**

```json
{
  "score": 95,
  "tier": 2,
  "tierLabel": "Silver",
  "borrowLimit": "20000.00",
  "feeRate": 3.0,
  "feeBps": 300,
  "nextTier": "Gold",
  "nextTierThreshold": 120,
  "progressToNext": 25,
  "formula": {
    "expression": "score = (txCount×2) + (repaymentCount×10) + (avgBalanceFactor×5) - (defaultCount×25)",
    "txComponent": 40,
    "repaymentComponent": 40,
    "balanceComponent": 15,
    "defaultPenalty": 0,
    "total": 95
  },
  "metrics": {
    "txCount": 20,
    "repaymentCount": 4,
    "avgBalance": 350,
    "avgBalanceFactor": 3,
    "defaultCount": 0
  }
}
```

**Behavior:**

- Calls `credit_registry.get_score()`, `get_tier()`, `get_metrics()`, `get_tier_limit()` in parallel
- Returns `404` if wallet has no score (tier = 0 AND score = 0)
- In-memory cache: 60 seconds per wallet

---

#### `POST /api/credit/generate`

**Response `200`:** Same shape as `GET /api/credit/score`

**Behavior:**

1. Fetch Stellar metrics for wallet (Horizon API)
2. Compute score via `calculateScore(metrics)`
3. Call `credit_registry.update_metrics_raw()` + `update_score()` via issuer TX
4. Return full score payload with fresh on-chain data

**Rate limit:** 1 call per wallet per 60 seconds (prevent RPC spam)

---

#### `POST /api/credit/refresh`

Alias for `POST /api/credit/generate`. Identical behavior.

---

#### `GET /api/credit/pool`

**Response `200`:**

```json
{ "poolBalance": "95000.00" }
```

**Behavior:**

- Calls `lending_pool.get_pool_balance()` via `simulateTransaction`
- Returns balance formatted to 2 decimal PHPC

---

### 3.4 Loan Routes

All routes require `Authorization: Bearer <JWT>`.

#### `GET /api/loan/status`

**Response `200`:**

```json
{
  "hasActiveLoan": true,
  "poolBalance": "95000.00",
  "loan": {
    "principal": "500.00",
    "fee": "25.00",
    "totalOwed": "525.00",
    "dueLedger": 5234800,
    "daysRemaining": 28,
    "repaid": false,
    "defaulted": false,
    "status": "active"
  }
}
```

**Loan status values:** `"active"` | `"repaid"` | `"defaulted"` | `null`

**Behavior:**

- Calls `lending_pool.get_loan(wallet)` and `get_pool_balance()` in parallel
- `daysRemaining` = `((dueLedger − currentLedger) × 5) / 86400` (5 seconds per ledger)
- Returns `loan: null` and `hasActiveLoan: false` if no loan exists

---

#### `POST /api/loan/borrow`

**Request:**

```json
{ "amount": 500 }
```

**Response `200`:**

```json
{
  "requiresSignature": true,
  "unsignedXdr": "<base64-encoded XDR>",
  "preview": {
    "amount": "500.00",
    "fee": "25.00",
    "totalOwed": "525.00",
    "feeBps": 500,
    "tier": 1,
    "tierLabel": "Bronze"
  }
}
```

**Behavior:**

1. UX pre-check: `hasActiveLoan()` → `400` if true
2. UX pre-check: `get_tier(wallet)` → `400` if tier = 0
3. UX pre-check: `poolBalance >= amount` → `400` if false
4. Validate `amount` is a positive number ≤ `tierLimit`
5. Build `lending_pool.borrow(wallet, amount_i128)` TX
6. Call `rpcServer.prepareTransaction()` to simulate and get auth entries
7. Return unsigned XDR — never sign or submit here

---

#### `POST /api/loan/repay`

**Response `200`:**

```json
{
  "requiresSignature": true,
  "transactions": [
    {
      "type": "approve",
      "unsignedXdr": "<XDR>",
      "description": "Authorize pool to spend 525.00 PHPC"
    },
    {
      "type": "repay",
      "unsignedXdr": "<XDR>",
      "description": "Repay loan principal + fee"
    }
  ],
  "summary": {
    "principal": "500.00",
    "fee": "25.00",
    "totalOwed": "525.00",
    "walletPhpcBalance": "550.00"
  }
}
```

**Response `422` — Insufficient balance:**

```json
{
  "error": "InsufficientBalance",
  "shortfall": "25.00",
  "walletBalance": "500.00",
  "totalOwed": "525.00"
}
```

**Behavior:**

1. Get `get_loan(wallet)` — `400` if no active loan
2. Get `phpc_token.balance(wallet)` — if `balance < totalOwed`, return `422`
3. Get current ledger — set `approveExpiry = currentLedger + 200`
4. Build TX 1: `phpc_token.approve(wallet, lendingPool, totalOwed, approveExpiry)`
5. Build TX 2: `lending_pool.repay(wallet)`
6. Return both unsigned XDRs

---

### 3.5 Transaction Routes

All routes require `Authorization: Bearer <JWT>`.

#### `POST /api/tx/sign-and-submit`

**Request:**

```json
{
  "signedInnerXdr": ["<signed XDR>"],
  "flow": { "action": "borrow" }
}
```

OR for repay:

```json
{
  "signedInnerXdr": ["<approve XDR>", "<repay XDR>"],
  "flow": { "action": "repay" }
}
```

**Response `200`:**

```json
{
  "txHash": "abc123...",
  "explorerUrl": "https://stellar.expert/explorer/testnet/tx/abc123...",
  "amount": "500.00",
  "fee": "25.00",
  "totalOwed": "525.00",
  "feeBps": 500
}
```

**Behavior (borrow):**

1. Deserialize `signedInnerXdr[0]`
2. Wrap in fee-bump TX signed by issuer
3. Submit via `rpcServer.sendTransaction()`
4. Poll until `SUCCESS` or `FAILED`
5. Return TX hash and metadata

**Behavior (repay):**

1. Submit `signedInnerXdr[0]` (approve) as fee-bumped TX, poll to SUCCESS
2. Only if approve succeeds: submit `signedInnerXdr[1]` (repay) as fee-bumped TX, poll to SUCCESS
3. Return repay TX hash

**Fee-bump configuration:**

- Base fee: `1000 stroops` per operation (10× network minimum)
- Outer TX fee-payer: `ISSUER_SECRET_KEY`

---

### 3.6 Health Route

#### `GET /health`

**Auth:** None

**Response `200`:**

```json
{ "status": "ok" }
```

---

## 4. Frontend

### 4.1 Application Routes

| Route          | Component                  | Auth Required |
| -------------- | -------------------------- | ------------- |
| `/`            | `app/page.tsx`             | No            |
| `/dashboard`   | `app/dashboard/page.tsx`   | Yes           |
| `/loan/borrow` | `app/loan/borrow/page.tsx` | Yes           |
| `/loan/repay`  | `app/loan/repay/page.tsx`  | Yes           |

### 4.2 State Management

**Auth Store (`store/auth.ts`):**

```typescript
interface AuthState {
  user: { wallet: string; token: string } | null;
  setAuth: (wallet: string, token: string) => void;
  clearAuth: () => void;
}
```

- JWT stored in memory only (not localStorage, not cookie)
- Cleared on page reload (user must re-authenticate)
- Cleared on wallet disconnect

**Wallet Store (`store/walletStore.ts`):**

```typescript
interface WalletState {
  publicKey: string | null;
  network: string | null;
  isConnected: boolean;
  connectionError: string | null;
  isCorrectNetwork: boolean; // derived: network === 'TESTNET'
  connect: () => Promise<void>;
  disconnect: () => void;
}
```

### 4.3 API Client (`lib/api.ts`)

- Axios instance with `baseURL = NEXT_PUBLIC_API_URL`
- Injects `Authorization: Bearer <token>` from auth store on every request
- Intercepts `401` responses → calls `clearAuth()` → redirects to `/?session=expired`

### 4.4 Query Keys (`lib/queryKeys.ts`)

```typescript
const QUERY_KEYS = {
  score: (wallet: string) => ["score", wallet],
  loanStatus: (wallet: string) => ["loanStatus", wallet],
  pool: ["pool"],
};
```

### 4.5 Freighter Integration (`lib/freighter.ts`)

```typescript
async function waitForFreighter(): Promise<boolean>;
async function getPublicKey(): Promise<string | null>; // silent, no popup
async function signTx(
  xdr: string,
  wallet: string,
): Promise<{ signedXdr: string } | { error: string }>;
```

---

## 5. Authentication Protocol

### 5.1 SEP-10 Challenge Flow

```
Frontend                    Backend                     Freighter
   │                           │                            │
   │  POST /auth/challenge      │                            │
   │  { wallet: "G..." }        │                            │
   │──────────────────────────▶│                            │
   │                           │                            │
   │  { challenge: XDR }       │                            │
   │◀──────────────────────────│                            │
   │                           │                            │
   │  signTransaction(XDR)     │                            │
   │──────────────────────────────────────────────────────▶│
   │                           │                            │
   │  { signedXdr }            │                            │
   │◀──────────────────────────────────────────────────────│
   │                           │                            │
   │  POST /auth/login         │                            │
   │  { signedChallenge }      │                            │
   │──────────────────────────▶│                            │
   │                           │ verify signature           │
   │                           │ issue JWT                  │
   │  { token, wallet }        │                            │
   │◀──────────────────────────│                            │
```

### 5.2 JWT Specification

| Field         | Value                               |
| ------------- | ----------------------------------- |
| Algorithm     | `HS256`                             |
| Secret        | `JWT_SECRET` env var (min 32 chars) |
| `sub`         | Stellar public key (G...)           |
| `iat`         | Unix timestamp (seconds)            |
| `exp`         | `iat + 3600` (1 hour)               |
| Custom fields | None                                |

### 5.3 Session Lifecycle

1. JWT issued on successful `POST /auth/login`
2. JWT stored in Zustand memory store (lost on page reload)
3. All API requests include `Authorization: Bearer <token>`
4. Backend middleware validates JWT on every authenticated request
5. `401` response clears frontend state and redirects to `/?session=expired`
6. Explicit logout: clears Zustand store, disconnects wallet

---

## 6. Credit Scoring Model

### 6.1 Inputs

All inputs are derived deterministically from on-chain + Horizon data:

| Input            | Source                              | Description                                       |
| ---------------- | ----------------------------------- | ------------------------------------------------- |
| `txCount`        | Horizon `/accounts/{id}/operations` | Total operation count (capped at 200)             |
| `repaymentCount` | `lending_pool` contract events      | Count of `repay()` calls by this address          |
| `avgBalance`     | Horizon `/accounts/{id}/effects`    | Average XLM balance, rounded to nearest integer   |
| `defaultCount`   | `lending_pool` contract events      | Count of `mark_default()` events for this address |

### 6.2 Score Formula

```
avgBalanceFactor = floor(avgBalance / 100)

score = (txCount × 2)
      + (repaymentCount × 10)
      + (avgBalanceFactor × 5)
      - (defaultCount × 25)

score = max(0, score)
```

**Example:**

```
txCount = 20, repaymentCount = 4, avgBalance = 350 XLM, defaultCount = 0

avgBalanceFactor = floor(350 / 100) = 3
score = (20×2) + (4×10) + (3×5) - (0×25)
score = 40 + 40 + 15 - 0 = 95
```

### 6.3 Tier Thresholds

| Tier | Name    | Min Score | Borrow Limit | Fee Rate |
| ---- | ------- | --------- | ------------ | -------- |
| 0    | Unrated | —         | 0 PHPC       | N/A      |
| 1    | Bronze  | 40        | 5,000 PHPC   | 5.0%     |
| 2    | Silver  | 80        | 20,000 PHPC  | 3.0%     |
| 3    | Gold    | 120       | 50,000 PHPC  | 1.5%     |

### 6.4 Determinism Requirements

- Same `(txCount, repaymentCount, avgBalance, defaultCount)` inputs → same output, always
- No randomness, no time-based variation in formula
- Score is recomputable by any party with access to the inputs
- Formula is displayed verbatim in the dashboard UI

### 6.5 On-Chain Storage

Score and tier are stored in `credit_registry` contract via `update_metrics_raw()` + `update_score()`:

- Only the issuer keypair may write to the registry
- Any party can read via `get_score()`, `get_tier()`, `get_metrics()`
- Score update emits a Soroban event (queryable via Horizon)

---

## 7. Transaction Flows

### 7.1 Borrow Flow

```
Frontend             Backend                  Freighter         Soroban
   │                    │                        │                 │
   │ POST /loan/borrow  │                        │                 │
   │ { amount: 500 }    │                        │                 │
   │───────────────────▶│                        │                 │
   │                    │ pre-check: hasActiveLoan, tier, liquidity
   │                    │ build borrow TX        │                 │
   │                    │ prepareTransaction     │                 │
   │                    │───────────────────────────────────────▶│
   │                    │ { simulatedXdr }       │                 │
   │                    │◀───────────────────────────────────────│
   │                    │                        │                 │
   │ { unsignedXdr }    │                        │                 │
   │◀───────────────────│                        │                 │
   │                    │                        │                 │
   │ signTransaction(unsignedXdr)                │                 │
   │────────────────────────────────────────────▶│                 │
   │ { signedXdr }      │                        │                 │
   │◀────────────────────────────────────────────│                 │
   │                    │                        │                 │
   │ POST /tx/sign-and-submit                    │                 │
   │ { signedInnerXdr, flow: "borrow" }          │                 │
   │───────────────────▶│                        │                 │
   │                    │ feebump(signedXdr)     │                 │
   │                    │ sendTransaction        │                 │
   │                    │───────────────────────────────────────▶│
   │                    │ { hash: "PENDING" }    │                 │
   │                    │ poll(hash) until SUCCESS                  │
   │                    │◀───────────────────────────────────────│
   │ { txHash, amount, fee, totalOwed }          │                 │
   │◀───────────────────│                        │                 │
```

### 7.2 Repay Flow

```
Frontend             Backend                  Freighter         Soroban
   │                    │                        │                 │
   │ POST /loan/repay   │                        │                 │
   │───────────────────▶│                        │                 │
   │                    │ get_loan(wallet): { principal, fee }     │
   │                    │ phpc.balance(wallet): check shortfall    │
   │                    │ build TX1: approve(wallet, pool, total)  │
   │                    │ build TX2: repay(wallet)                 │
   │ { [approveXdr, repayXdr] }                  │                 │
   │◀───────────────────│                        │                 │
   │                    │                        │                 │
   │ "Step 1: Approve PHPC spend"                │                 │
   │ signTransaction(approveXdr)                 │                 │
   │────────────────────────────────────────────▶│                 │
   │ { signedApproveXdr }                        │                 │
   │◀────────────────────────────────────────────│                 │
   │                    │                        │                 │
   │ "Step 2: Confirm Repayment"                 │                 │
   │ signTransaction(repayXdr)                   │                 │
   │────────────────────────────────────────────▶│                 │
   │ { signedRepayXdr } │                        │                 │
   │◀────────────────────────────────────────────│                 │
   │                    │                        │                 │
   │ POST /tx/sign-and-submit                    │                 │
   │ { signedInnerXdr: [approve, repay], "repay"}│                 │
   │───────────────────▶│                        │                 │
   │                    │ feebump+submit approveXdr → poll SUCCESS │
   │                    │ feebump+submit repayXdr → poll SUCCESS   │
   │                    │◀───────────────────────────────────────│
   │ { txHash }         │                        │                 │
   │◀───────────────────│                        │                 │
   │ trigger score refresh                       │                 │
```

### 7.3 Score Generation Flow

```
Frontend             Backend                  Horizon           Soroban
   │                    │                        │                 │
   │ POST /credit/generate                       │                 │
   │───────────────────▶│                        │                 │
   │                    │ GET /accounts/{id}/operations            │
   │                    │───────────────────────▶│                 │
   │                    │ txCount, effects       │                 │
   │                    │◀───────────────────────│                 │
   │                    │ query lending_pool events (repayCount, defaultCount)
   │                    │─────────────────────────────────────────▶│
   │                    │ calculateScore(metrics)                   │
   │                    │ update_metrics_raw(wallet, ...) [issuer signs]
   │                    │─────────────────────────────────────────▶│
   │                    │ update_score(wallet) [issuer signs]       │
   │                    │─────────────────────────────────────────▶│
   │                    │ getOnChainCreditSnapshot(wallet)          │
   │                    │─────────────────────────────────────────▶│
   │ { score, tier, metrics, formula }           │                 │
   │◀───────────────────│                        │                 │
```

---

## 8. Data Models

### 8.1 API Response Types

**`ScoreResponse`** (returned by `GET /credit/score` and `POST /credit/generate`):

```typescript
interface ScoreResponse {
  score: number;
  tier: number; // 0–3
  tierLabel: string; // "Unrated" | "Bronze" | "Silver" | "Gold"
  borrowLimit: string; // "5000.00" formatted PHPC
  feeRate: number; // 5.0 (percent)
  feeBps: number; // 500
  nextTier: string | null; // "Silver" or null if Gold
  nextTierThreshold: number | null;
  progressToNext: number; // points needed to reach next tier
  formula: {
    expression: string;
    txComponent: number;
    repaymentComponent: number;
    balanceComponent: number;
    defaultPenalty: number;
    total: number;
  };
  metrics: {
    txCount: number;
    repaymentCount: number;
    avgBalance: number; // XLM
    avgBalanceFactor: number; // floor(avgBalance / 100)
    defaultCount: number;
  };
}
```

**`LoanStatusResponse`** (returned by `GET /loan/status`):

```typescript
interface LoanStatusResponse {
  hasActiveLoan: boolean;
  poolBalance: string; // "95000.00"
  loan: {
    principal: string; // "500.00"
    fee: string; // "25.00"
    totalOwed: string; // "525.00"
    dueLedger: number;
    daysRemaining: number;
    repaid: boolean;
    defaulted: boolean;
    status: "active" | "repaid" | "defaulted";
  } | null;
}
```

### 8.2 Internal Types

**`WalletMetrics`** (scoring engine input):

```typescript
interface WalletMetrics {
  txCount: number;
  repaymentCount: number;
  avgBalance: number;
  defaultCount: number;
}
```

**`LoanState`** (contract query result):

```typescript
interface LoanState {
  principal: bigint; // 7-decimal i128
  fee: bigint;
  dueLedger: number;
  repaid: boolean;
  defaulted: boolean;
}
```

### 8.3 JWT Payload

```typescript
interface JwtPayload {
  sub: string; // Stellar public key G...
  iat: number; // issued at (Unix seconds)
  exp: number; // expires at (iat + 3600)
}
```

---

## 9. Error Handling

### 9.1 HTTP Status Codes

| Status | When Used                                        |
| ------ | ------------------------------------------------ |
| `200`  | Success                                          |
| `400`  | Bad request (invalid input, UX pre-check failed) |
| `401`  | Unauthorized (missing/invalid/expired JWT)       |
| `404`  | Resource not found (no score for wallet)         |
| `422`  | Unprocessable entity (PHPC balance shortfall)    |
| `429`  | Rate limit exceeded                              |
| `500`  | Unexpected server error                          |
| `503`  | RPC unavailable / TRY_AGAIN_LATER exhausted      |

### 9.2 Error Response Shape

```json
{ "error": "<human readable message>" }
```

For `422` shortfall:

```json
{
  "error": "InsufficientBalance",
  "shortfall": "25.00",
  "walletBalance": "500.00",
  "totalOwed": "525.00"
}
```

### 9.3 Soroban Error Code Mapping

| Contract          | Code  | Backend Message                                   |
| ----------------- | ----- | ------------------------------------------------- |
| `lending_pool`    | `#5`  | Amount must be greater than zero                  |
| `lending_pool`    | `#7`  | You already have an active loan                   |
| `lending_pool`    | `#8`  | No credit score found — generate a score first    |
| `lending_pool`    | `#9`  | Amount exceeds your current tier limit            |
| `lending_pool`    | `#10` | Insufficient pool liquidity                       |
| `lending_pool`    | `#15` | This loan has been defaulted and cannot be repaid |
| `lending_pool`    | `#16` | This loan is overdue and cannot be repaid         |
| `credit_registry` | `#5`  | Invalid tier value                                |
| `credit_registry` | `#6`  | Credit scores are non-transferable                |
| `phpc_token`      | `#8`  | Insufficient PHPC balance                         |
| `phpc_token`      | `#9`  | Insufficient PHPC allowance                       |

### 9.4 RPC Error Handling

| RPC Status        | Backend Behavior                      |
| ----------------- | ------------------------------------- |
| `PENDING`         | Begin polling                         |
| `TRY_AGAIN_LATER` | Retry up to 3 times with 2s backoff   |
| `FAILED`          | Decode `resultXdr`, map to user error |
| `EXCEPTION`       | Return `503`                          |
| `SUCCESS`         | Return `txHash`                       |

---

## 10. Environment Configuration

### 10.1 Backend `.env`

```env
# Auth
JWT_SECRET=<min 32 char random string>

# Stellar
ISSUER_SECRET_KEY=<funded Stellar secret key S...>
WEB_AUTH_SECRET_KEY=<may be same as ISSUER_SECRET_KEY>

# Network
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Contracts
REGISTRY_ID=CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ
LENDING_POOL_ID=CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH
PHPC_ID=CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR

# Server
PORT=3001
HOME_DOMAIN=localhost
WEB_AUTH_DOMAIN=localhost:3001
CORS_ORIGIN=http://localhost:3000
```

**Removed in v2 (no longer needed):**

- `ENCRYPTION_KEY` — DB encryption, no longer applicable
- No SQLite path — no DB

### 10.2 Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_EXPLORER_URL=https://stellar.expert/explorer/testnet
```

### 10.3 Config Validation (Backend Startup)

The backend must validate the following on startup and exit with a clear error if any are missing:

```typescript
const REQUIRED_VARS = [
  "JWT_SECRET",
  "ISSUER_SECRET_KEY",
  "SOROBAN_RPC_URL",
  "HORIZON_URL",
  "NETWORK_PASSPHRASE",
  "REGISTRY_ID",
  "LENDING_POOL_ID",
  "PHPC_ID",
];
```

---

## 11. Invariants & Constraints

These invariants must hold at all times. Any code change that violates them is a bug.

### 11.1 On-Chain Invariants (enforced by contracts)

1. **Single-loan rule:** `lending_pool` allows at most one active (non-repaid, non-defaulted) loan per wallet address.
2. **Tier enforcement:** A wallet with `tier = 0` cannot borrow. Enforced by `borrow()` checking `credit_registry.get_tier()`.
3. **Limit enforcement:** Borrow amount ≤ `credit_registry.get_tier_limit(tier)`. Enforced by `borrow()`.
4. **Liquidity enforcement:** Borrow amount ≤ `get_pool_balance()`. Enforced by `borrow()`.
5. **Non-transferability:** Credit scores (SBT semantics) are non-transferable. `transfer()` always panics.
6. **Repayment deadline:** `repay()` panics if `current_ledger > due_ledger`.
7. **Default finality:** A defaulted loan cannot be repaid. `repay()` panics if `loan.defaulted`.

### 11.2 Backend Invariants

1. **No state persistence:** The backend holds no state between requests. Any data needed must come from the chain or the request itself.
2. **Wallet = identity:** `req.wallet` (from JWT `sub`) is the only identity in all route handlers.
3. **No double-signing:** Backend never signs a user transaction. Only fee-bump outer TXs are signed by the issuer.
4. **Pre-checks are non-authoritative:** Backend UX pre-checks (hasActiveLoan, tier check) are convenience only. The contract is the enforcement layer.
5. **Fee-bump required:** Every user-signed inner TX must be submitted as the inner TX of a fee-bump. Never submit raw inner TXs.

### 11.3 Frontend Invariants

1. **JWT in memory only:** Never persist JWT in localStorage, sessionStorage, or cookies.
2. **Wallet state from Freighter only:** Never construct or assume a wallet address — always read from Freighter.
3. **No phantom state:** All displayed values (score, loan, balance) must be traceable to a contract query or a backend endpoint backed by a contract query.
4. **Signing is explicit:** User must explicitly click to sign. Never trigger Freighter silently for a TX.

### 11.4 Security Constraints

1. `ISSUER_SECRET_KEY` never appears in any response, log, or error message.
2. JWT secret is at minimum 32 characters and generated with a CSPRNG.
3. Challenge TTL is enforced server-side (5 minutes). Replayed challenges are rejected.
4. All CORS origins are explicitly whitelisted — no wildcard in production.
5. Rate limiting on `POST /auth/challenge` and `POST /credit/generate` (prevents RPC abuse).

---

_End of SPEC.md_

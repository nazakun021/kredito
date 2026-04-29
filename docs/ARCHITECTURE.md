# Kredito — Architecture

This document describes the complete technical architecture of Kredito — an on-chain credit scoring and micro-lending platform built on Stellar/Soroban for Filipino SMEs. It covers the smart contracts, backend service, and frontend client, along with the data flows that connect them.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Smart Contracts (Soroban)](#2-smart-contracts-soroban)
3. [Backend Service](#3-backend-service)
4. [Frontend Client](#4-frontend-client)
5. [Data Flows](#5-data-flows)
6. [Database Schema](#6-database-schema)
7. [Security Model](#7-security-model)
8. [Infrastructure & Deployment](#8-infrastructure--deployment)
9. [CI/CD Pipeline](#9-cicd-pipeline)

---

## 1. System Overview

Kredito has three distinct layers that interact to deliver credit scores and loans:

```
┌─────────────────────────────────────────────────────────┐
│                     USER / BROWSER                       │
│              Next.js Frontend (Vercel)                   │
│         Freighter Wallet  ──  REST API client            │
└────────────────────┬────────────────────────────────────┘
                     │  HTTPS
┌────────────────────▼────────────────────────────────────┐
│                  BACKEND SERVICE                         │
│             Express 5 + TypeScript (Railway)             │
│   Auth │ Scoring Engine │ Stellar Utilities │ Cron       │
│                   SQLite (kredito.db)                    │
└────────────────────┬────────────────────────────────────┘
                     │  Soroban RPC / Horizon API
┌────────────────────▼────────────────────────────────────┐
│                STELLAR TESTNET                           │
│  credit_registry  ──  lending_pool  ──  phpc_token       │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

- **On-chain as source of truth**: Credit scores, loan records, and token balances are all stored on-chain. The backend only mirrors derived state for query efficiency.
- **Gasless UX**: The backend's issuer keypair sponsors all user transactions via fee-bump transactions, so demo users pay zero fees.
- **Dual wallet mode**: The system supports both managed wallets (demo users, where the backend holds the encrypted secret) and external wallets (Freighter users, where the backend only builds unsigned XDR for the user to sign).
- **Deterministic scoring**: The credit score formula is identical in the Rust smart contract and the TypeScript scoring engine. The backend computes off-chain, then writes the result on-chain via the issuer authority.

---

## 2. Smart Contracts (Soroban)

Three contracts form the core financial protocol, deployed as a Rust workspace (`contracts/`).

### 2.1 `credit_registry`

**Address**: `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ`

Stores on-chain credit state for each wallet: raw metrics, a computed score, and a tier assignment. Only the designated issuer address can write to it.

**Storage** (persistent per-wallet):

| Key                      | Type      | Description                                                 |
| :----------------------- | :-------- | :---------------------------------------------------------- |
| `Metrics(Address)`       | `Metrics` | `{ tx_count, repayment_count, avg_balance, default_count }` |
| `Score(Address)`         | `u32`     | Computed credit score (0–∞)                                 |
| `CreditTier(Address)`    | `u32`     | Tier 0 (Unrated), 1 (Bronze), 2 (Silver), 3 (Gold)          |
| `TierTimestamp(Address)` | `u64`     | Ledger timestamp of last tier change                        |
| `Tier1Limit`             | `i128`    | Maximum borrow limit for Bronze                             |
| `Tier2Limit`             | `i128`    | Maximum borrow limit for Silver                             |
| `Tier3Limit`             | `i128`    | Maximum borrow limit for Gold                               |

**Scoring Formula** (identical in Rust and TypeScript):

```
score = (tx_count × 2) + (repayment_count × 10) + (min(avg_balance / 100, 10) × 5) − (default_count × 25)
```

**Tier Thresholds**:

- **Bronze** (Tier 1): score ≥ 40 → borrow up to 5,000 PHPC
- **Silver** (Tier 2): score ≥ 80 → borrow up to 20,000 PHPC
- **Gold** (Tier 3): score ≥ 120 → borrow up to 50,000 PHPC

**Key Functions**:

| Function                                                                            | Auth   | Description                             |
| :---------------------------------------------------------------------------------- | :----- | :-------------------------------------- |
| `initialize(issuer, tier1_limit, tier2_limit, tier3_limit)`                         | Issuer | One-time setup                          |
| `update_metrics_raw(wallet, tx_count, repayment_count, avg_balance, default_count)` | Issuer | Write raw metrics and recompute score   |
| `update_score(wallet)`                                                              | Issuer | Recompute score from stored metrics     |
| `set_tier(wallet, tier)`                                                            | Issuer | Manually override tier                  |
| `revoke_tier(wallet)`                                                               | Issuer | Reset wallet to Unrated                 |
| `get_score(wallet)`                                                                 | Anyone | Read current score                      |
| `get_tier(wallet)`                                                                  | Anyone | Read current tier                       |
| `get_metrics(wallet)`                                                               | Anyone | Read raw metrics struct                 |
| `get_tier_limit(tier)`                                                              | Anyone | Read borrow cap for a given tier        |
| `compute_score(_env, metrics)`                                                      | Anyone | Pure score computation (no state write) |

---

### 2.2 `lending_pool`

**Address**: `CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH`

Holds PHPC liquidity and manages the full borrow/repay/default lifecycle. It calls into `credit_registry` via `contractimport!` to validate tier eligibility on-chain.

**LoanRecord struct**:

```rust
pub struct LoanRecord {
    pub principal:  i128,   // Amount borrowed (in stroops)
    pub fee:        i128,   // Flat fee charged (in stroops)
    pub due_ledger: u32,    // Ledger number at which loan expires
    pub repaid:     bool,
    pub defaulted:  bool,
}
```

**Fee Schedule** (flat fee applied at borrow time):

- Gold (Tier 3): 1% (100 bps)
- Silver (Tier 2): 3% (300 bps)
- Bronze (Tier 1): 5% (500 bps)

**Key Functions**:

| Function                                                                      | Auth   | Description                            |
| :---------------------------------------------------------------------------- | :----- | :------------------------------------- |
| `initialize(admin, registry_id, phpc_token, flat_fee_bps, loan_term_ledgers)` | Admin  | One-time setup                         |
| `deposit(amount)`                                                             | Admin  | Fund the pool with PHPC                |
| `borrow(wallet, amount)`                                                      | Wallet | Validate tier, lock fee, disburse PHPC |
| `repay(wallet)`                                                               | Wallet | Accept principal + fee, mark repaid    |
| `mark_default(wallet)`                                                        | Anyone | Mark overdue loan as defaulted         |
| `get_loan(wallet)`                                                            | Anyone | Read LoanRecord for a wallet           |
| `get_pool_balance()`                                                          | Anyone | Read total PHPC in pool                |

**Loan State Machine**:

```
           borrow()
  None ─────────────► Active
                          │
               repay() ◄──┼──► Overdue (past due_ledger)
                  │                │
               Repaid         mark_default()
                                   │
                               Defaulted
```

---

### 2.3 `phpc_token`

**Address**: `CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR`

A fully SEP-41 compliant token contract representing the Philippine Peso Coin (PHPC), 7 decimal places. Implements the standard Stellar token interface (`transfer`, `approve`, `allowance`, `mint`, `burn`). The issuer keypair controls minting.

---

### 2.4 Contract Interactions

```
lending_pool.borrow()
    └── credit_registry.get_tier()          (cross-contract read)
    └── credit_registry.get_tier_limit()    (cross-contract read)
    └── phpc_token.transfer()               (token client call)

lending_pool.repay()
    └── phpc_token.transfer_from()          (requires prior approve())
```

---

## 3. Backend Service

**Stack**: Express 5, TypeScript, `better-sqlite3`, `@stellar/stellar-sdk`

**Location**: `backend/src/`

### 3.1 Module Layout

```
backend/src/
├── index.ts          # Server bootstrap, middleware, route mounting
├── config.ts         # Environment variable validation
├── db.ts             # SQLite init and schema migrations
├── errors.ts         # AppError class, asyncRoute wrapper
├── cron.ts           # Scheduled default-monitor job
├── middleware/
│   └── auth.ts       # JWT verification middleware
├── routes/
│   ├── auth.ts       # POST /demo, POST /login
│   ├── credit.ts     # POST /generate, GET /score, GET /pool, GET /metrics
│   └── loan.ts       # POST /borrow, POST /repay, GET /status, POST /sign-and-submit
├── scoring/
│   └── engine.ts     # Off-chain score calculation, Horizon/RPC data fetching
├── stellar/
│   ├── client.ts     # RPC/Horizon server instances, issuer keypair
│   ├── demo.ts       # Demo wallet funding (Friendbot)
│   ├── feebump.ts    # Fee-bump transaction builder and submitter
│   ├── issuer.ts     # updateOnChainMetrics(), getOnChainCreditSnapshot()
│   └── query.ts      # Generic read-only contract query helper
├── utils/
│   └── crypto.ts     # AES-256-GCM encrypt/decrypt for stored secrets
└── types/
```

### 3.2 API Endpoints

#### Auth (`/api/auth`)

| Method | Path     | Auth | Description                                                                                 |
| :----- | :------- | :--- | :------------------------------------------------------------------------------------------ |
| `POST` | `/demo`  | None | Generate a new keypair, encrypt the secret, fund via Friendbot, return JWT + wallet address |
| `POST` | `/login` | None | Register or look up a Freighter wallet address, return JWT                                  |

#### Credit (`/api/credit`)

| Method | Path        | Auth | Description                                                                                                            |
| :----- | :---------- | :--- | :--------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/generate` | JWT  | Fetch on-chain metrics, compute score, call `update_metrics_raw` + `update_score` as issuer, persist to `score_events` |
| `GET`  | `/score`    | JWT  | Return latest score from DB merged with live on-chain snapshot                                                         |
| `GET`  | `/pool`     | JWT  | Return current PHPC pool balance                                                                                       |
| `GET`  | `/metrics`  | JWT  | Return raw `Metrics` struct from `credit_registry`                                                                     |

#### Loan (`/api/loan`)

| Method | Path               | Auth | Description                                                                                 |
| :----- | :----------------- | :--- | :------------------------------------------------------------------------------------------ |
| `POST` | `/borrow`          | JWT  | Validate tier/limit, call `lending_pool.borrow` (managed) or return unsigned XDR (external) |
| `POST` | `/repay`           | JWT  | Two-step for external wallets (approve → repay); single fee-bump for managed                |
| `GET`  | `/status`          | JWT  | Return active loan state, due date, and pool balance                                        |
| `POST` | `/sign-and-submit` | JWT  | Accept signed inner XDR from Freighter, wrap in fee-bump, submit                            |

### 3.3 Scoring Engine (`scoring/engine.ts`)

The off-chain engine mirrors the on-chain Rust formula exactly:

1. **`fetchTxCount(address)`**: Calls Horizon to count recent transactions (last 200).
2. **`fetchAverageBalance(address)`**: Reads the native XLM balance from Horizon.
3. **`fetchRepaymentMetrics(address)`**: Scans Soroban RPC events on `lending_pool` for `repaid` and `defaulted` events associated with the wallet.
4. **`buildWalletMetrics(address)`**: Combines all three sources in parallel.
5. **`calculateScore(metrics)`**: Applies the deterministic formula.
6. **`scoreToTier(score)`**: Maps score → tier (0–3).
7. **`buildScoreSummary(address)`**: Full pipeline — returns a rich payload with score, tier, borrow limit, fee rate, and breakdown factors.

### 3.4 Fee-Bump Transaction Flow (`stellar/feebump.ts`)

All transactions sent on behalf of users are wrapped in a fee-bump signed by the issuer. This makes the UX gasless:

```
For managed wallet (demo mode):
  1. ensureUserAccount()         — create account on-chain if needed
  2. buildInvokeTransaction()    — build the inner contract call tx
  3. rpcServer.prepareTransaction() — simulate, apply resource footprint
  4. prepared.sign(userKeypair)  — user signs the inner tx
  5. buildFeeBumpTransaction()   — issuer wraps it
  6. feeBump.sign(issuerKeypair) — issuer signs the outer
  7. rpcServer.sendTransaction() — submit
  8. pollTransaction()           — wait for SUCCESS/FAILED

For external wallet (Freighter mode):
  1. buildUnsignedContractCall() — build + prepare, return raw XDR
  → Frontend passes to Freighter for signing
  → POST /sign-and-submit with signedInnerXdr
  2. submitSponsoredSignedXdr()  — issuer fee-bumps the pre-signed inner tx
```

### 3.5 Cron Job (`cron.ts`)

Runs every 6 hours. Iterates all rows in `active_loans`:

- Queries `lending_pool.get_loan()` on-chain.
- If the loan is repaid or defaulted, removes the cache row.
- If the current ledger sequence exceeds `due_ledger`, refreshes the score snapshot on-chain (penalizing the default) and removes the row.

---

## 4. Frontend Client

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Zustand, TanStack Query

**Location**: `frontend/`

### 4.1 Application Layout

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout with QueryClientProvider
│   ├── page.tsx            # Landing page (wallet connect, demo entry)
│   ├── dashboard/
│   │   └── page.tsx        # Score overview, loan status, borrow/repay actions
│   ├── loan/
│   │   └── page.tsx        # Loan detail and repayment flow
│   ├── providers.tsx        # TanStack Query provider wrapper
│   ├── error.tsx            # Route-level error boundary
│   └── globals.css          # Design system tokens and base styles
├── components/              # Shared UI components (cards, buttons, etc.)
├── lib/
│   ├── api.ts               # Typed fetch wrappers for all backend endpoints
│   ├── freighter.ts         # Freighter wallet detection and signing
│   └── errors.ts            # Client-side error handling utilities
└── store/
    └── auth.ts              # Zustand store: JWT token, wallet address, isExternal flag
```

### 4.2 Authentication Flows

**Demo Mode**:

1. User clicks "Try Demo" on landing page.
2. Frontend calls `POST /api/auth/demo`.
3. Backend generates a keypair, funds it, returns `{ token, wallet }`.
4. Zustand `auth` store saves the JWT.
5. All subsequent requests include `Authorization: Bearer <token>`.

**Freighter Mode**:

1. User clicks "Connect Freighter".
2. Frontend detects Freighter via `getPublicKey()`.
3. Frontend calls `POST /api/auth/login` with the public key.
4. Backend returns a JWT tied to that wallet.
5. For transactions, the frontend calls the backend for unsigned XDR, signs with Freighter, then calls `POST /api/loan/sign-and-submit`.

### 4.3 Transaction Signing (Freighter)

For external wallet users, the repayment flow is two steps because PHPC requires a prior `approve` allowance:

```
1. POST /api/loan/repay → { requiresSignature: true, step: "approve", unsignedXdr }
   └─ Freighter.signTransaction(unsignedXdr)
   └─ POST /api/loan/sign-and-submit { signedInnerXdr: approveXdr }

2. POST /api/loan/repay (again) → { requiresSignature: true, step: "repay", unsignedXdr }
   └─ Freighter.signTransaction(unsignedXdr)
   └─ POST /api/loan/sign-and-submit { signedInnerXdr: repayXdr }
```

---

## 5. Data Flows

### 5.1 Credit Score Generation

```
User: "Generate my score"
  │
  ▼
Frontend: POST /api/credit/generate
  │
  ▼
Backend - buildScoreSummary(walletAddress):
  ├── Horizon: fetch tx_count (last 200 txs)
  ├── Horizon: fetch native XLM balance → avg_balance
  └── Soroban RPC: scan lending_pool events → repayment_count, default_count
  │
  ▼
calculateScore(metrics) → score, tier
  │
  ▼
Backend - updateOnChainMetrics(wallet, metrics):
  ├── Issuer signs → credit_registry.update_metrics_raw(wallet, ...)
  └── Issuer signs → credit_registry.update_score(wallet)
  │
  ▼
DB: INSERT INTO score_events (user_id, tier, score, ...)
  │
  ▼
Frontend: display score, tier, borrow limit, factor breakdown
```

### 5.2 Loan Borrow (Managed Wallet)

```
User: "Borrow 1,000 PHPC"
  │
  ▼
Frontend: POST /api/loan/borrow { amount: 1000 }
  │
  ▼
Backend:
  ├── Validate amount > 0
  ├── buildScoreSummary() → check tier ≥ 1
  ├── Check no active loan on-chain
  ├── Check amount ≤ tier limit
  ├── Calculate fee (500 bps for Bronze)
  └── buildAndSubmitFeeBump(userKeypair, lending_pool, "borrow", [...])
        ├── lending_pool.borrow() calls credit_registry.get_tier() on-chain
        └── lending_pool transfers PHPC to wallet
  │
  ▼
DB: INSERT INTO active_loans (user_id, stellar_pub)
  │
  ▼
Frontend: display txHash, amount, fee, due date
```

### 5.3 Loan Repay (Managed Wallet)

```
User: "Repay loan"
  │
  ▼
Frontend: POST /api/loan/repay
  │
  ▼
Backend:
  ├── getLoanRecord(wallet) → validate not repaid/defaulted
  ├── Calculate totalOwed = principal + fee
  ├── buildAndSubmitFeeBump(userKeypair, phpc_token, "approve", [wallet, pool, totalOwed])
  ├── buildAndSubmitFeeBump(userKeypair, lending_pool, "repay", [wallet])
  ├── DB: DELETE FROM active_loans WHERE user_id = ?
  ├── buildScoreSummary(wallet) → refreshed metrics (repaymentCount +1)
  └── updateOnChainMetrics(wallet, refreshed.metrics)
  │
  ▼
DB: INSERT INTO score_events (tier, score, ...) — new improved score
  │
  ▼
Frontend: display newScore, newTier, newBorrowLimit
```

---

## 6. Database Schema

SQLite database at `backend/kredito.db` (path configurable via `DATABASE_PATH` env var).

### `users`

| Column               | Type          | Description                                              |
| :------------------- | :------------ | :------------------------------------------------------- |
| `id`                 | `INTEGER PK`  | Auto-increment                                           |
| `email`              | `TEXT UNIQUE` | Synthetic for demo; real for Freighter                   |
| `stellar_pub`        | `TEXT UNIQUE` | Stellar wallet public key (G...)                         |
| `stellar_enc_secret` | `TEXT`        | AES-256-GCM encrypted secret (NULL for external wallets) |
| `is_external`        | `BOOLEAN`     | `1` = Freighter user, `0` = managed demo wallet          |
| `email_verified`     | `BOOLEAN`     | Always `1` in demo/Freighter flow                        |

### `score_events`

| Column        | Type         | Description                                  |
| :------------ | :----------- | :------------------------------------------- |
| `id`          | `INTEGER PK` |                                              |
| `user_id`     | `INTEGER FK` | References `users`                           |
| `tier`        | `INTEGER`    | 0–3                                          |
| `score`       | `INTEGER`    | Total score at time of event                 |
| `score_json`  | `TEXT`       | Full JSON payload from `buildScorePayload()` |
| `sbt_minted`  | `BOOLEAN`    | Whether an on-chain update was submitted     |
| `sbt_tx_hash` | `TEXT`       | Hash of the `update_metrics_raw` transaction |

### `active_loans`

| Column        | Type                | Description                        |
| :------------ | :------------------ | :--------------------------------- |
| `id`          | `INTEGER PK`        |                                    |
| `user_id`     | `INTEGER FK UNIQUE` | One active loan per user           |
| `stellar_pub` | `TEXT UNIQUE`       | Wallet address for on-chain lookup |

### `bootstrap_assessments`

| Column                | Type         | Description                               |
| :-------------------- | :----------- | :---------------------------------------- |
| `id`                  | `INTEGER PK` |                                           |
| `user_id`             | `INTEGER FK` |                                           |
| `monthly_income_band` | `TEXT`       | Income range category                     |
| `employment_type`     | `TEXT`       | Self-employed, employee, etc.             |
| `bootstrap_score`     | `INTEGER`    | Preliminary score from self-reported data |

---

## 7. Security Model

### Wallet Secret Encryption

Demo wallet secrets are encrypted with AES-256-GCM before storage. The key is a 64-hex-character value set in the `ENCRYPTION_KEY` environment variable. The IV and auth tag are stored alongside the ciphertext.

```typescript
// crypto.ts
encrypt(plaintext: string) → "iv:authTag:ciphertext" (hex-encoded)
decrypt(stored: string)    → plaintext secret
```

The decrypted secret is used in memory only for the duration of the transaction, and the variable is overwritten afterward.

### JWT Authentication

All protected routes require a `Bearer` JWT issued at login/demo time. Tokens expire after 24 hours. The `JWT_SECRET` must be a strong random value set in the environment.

### Issuer Keypair

The issuer acts as the `credit_registry` admin and fee-bump sponsor. Its secret (`ISSUER_SECRET_KEY`) must never be committed to version control and should be stored as a Railway secret. The issuer can:

- Write to `credit_registry` (update metrics and scores).
- Sponsor fee-bump transactions for any user.
- Mint PHPC tokens.

### External Wallet Trust Model

For Freighter users, the backend never sees the private key. The flow is:

1. Backend builds and simulates the transaction, returning raw XDR.
2. The user signs with Freighter in the browser.
3. Backend wraps the signed inner transaction in a fee-bump (issuer only adds fees, cannot change the inner transaction's logic).

---

## 8. Infrastructure & Deployment

### Production Environment

| Component | Platform                | URL                                         |
| :-------- | :---------------------- | :------------------------------------------ |
| Frontend  | Vercel                  | `https://kredito-iota.vercel.app`           |
| Backend   | Railway                 | `https://kredito-production.up.railway.app` |
| Database  | Railway Volume (SQLite) | Mounted at `/data/kredito.db`               |
| Contracts | Stellar Testnet         | (see deployed.json)                         |

### Backend Environment Variables

| Variable             | Required | Description                            |
| :------------------- | :------- | :------------------------------------- |
| `JWT_SECRET`         | Yes      | Signing key for JWTs                   |
| `ENCRYPTION_KEY`     | Yes      | 64 hex chars for AES-256-GCM           |
| `ISSUER_SECRET_KEY`  | Yes      | Soroban issuer/admin keypair           |
| `PHPC_ID`            | Yes      | PHPC token contract address            |
| `REGISTRY_ID`        | Yes      | credit_registry contract address       |
| `LENDING_POOL_ID`    | Yes      | lending_pool contract address          |
| `HORIZON_URL`        | No       | Defaults to testnet Horizon            |
| `SOROBAN_RPC_URL`    | No       | Defaults to testnet RPC                |
| `NETWORK_PASSPHRASE` | No       | Defaults to Stellar testnet passphrase |
| `CORS_ORIGIN`        | No       | Comma-separated allowed origins        |
| `DATABASE_PATH`      | No       | SQLite file path (Railway volume)      |

### Frontend Environment Variables

| Variable                   | Required | Description                                         |
| :------------------------- | :------- | :-------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`      | Yes      | Backend API base URL                                |
| `NEXT_PUBLIC_NETWORK`      | No       | `testnet` or `mainnet` (defaults to `testnet`)      |
| `NEXT_PUBLIC_EXPLORER_URL` | No       | Stellar Expert base URL for on-chain explorer links |

---

## 9. CI/CD Pipeline

Defined in `.github/workflows/ci.yml`. Runs on every push and pull request to `main`/`master`.

### Jobs

#### `contracts` (Smart Contracts / Rust)

1. Install Rust stable with `rustfmt`, `clippy`, and `wasm32v1-none` target.
2. Cache Cargo dependencies.
3. Install Stellar CLI.
4. `cargo fmt --all -- --check` — format check.
5. `stellar contract build` — compile WASM artifacts (**must precede tests** because `lending_pool` imports `credit_registry.wasm` via `contractimport!`).
6. `cargo clippy --all-targets --all-features -- -D warnings` — lint with zero warnings.
7. `cargo test --workspace` — run all unit tests.

#### `backend` (Node.js)

1. Install pnpm 10 + Node.js 18.
2. `pnpm install --frozen-lockfile`.
3. `pnpm run lint` — ESLint with `@typescript-eslint` rules.
4. `pnpm run build` — TypeScript compile check.

#### `frontend` (Next.js)

1. Install pnpm 10 + Node.js 20.
2. `pnpm install --frozen-lockfile`.
3. `pnpm run lint` — Next.js ESLint.
4. `pnpm exec tsc --noEmit` — type check.
5. `pnpm run build` — production build.

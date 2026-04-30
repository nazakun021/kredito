# Kredito Architecture

This document describes the repository as it exists today and is intended to be the single high-level technical reference for the project.

Kredito is a Freighter-first micro-lending application on Stellar Testnet. It combines:

- Soroban smart contracts for credit state, token balances, and loan enforcement
- A Node/Express backend for wallet authentication, score orchestration, fee sponsorship, and local persistence
- A Next.js frontend for wallet connection, score visibility, and borrow/repay flows

The implementation is optimized for a demoable, transparent "credit passport" experience where a Stellar address can:

1. authenticate with a signed SEP-10 style challenge
2. generate an on-chain score from observable wallet activity
3. borrow PHPC from a lending pool if its tier qualifies
4. repay from the same wallet and improve future scoring

## 1. System Summary

### 1.1 Primary runtime layers

```text
Browser + Freighter
  -> Next.js frontend
  -> Express API
  -> Horizon + Soroban RPC
  -> Soroban contracts on Stellar Testnet
```

### 1.2 Core design choices

- On-chain contracts are the financial source of truth.
- The backend derives metrics off-chain, then writes those metrics back on-chain through an issuer/admin authority.
- User login is wallet-based, not email/password based.
- Transactions are fee-sponsored by the backend issuer account through fee bump transactions.
- The frontend is built around external wallets, even though the backend still contains dormant support for encrypted wallet secrets.

### 1.3 Current network assumptions

- Network: Stellar Testnet
- Wallet: Freighter
- Contracts: addresses are tracked in [`contracts/deployed.json`](/Users/infinite/Programming/kredito/contracts/deployed.json)
- Explorer links: Stellar Expert testnet URLs

## 2. Repository Layout

```text
kredito/
├── backend/      Express API, SQLite persistence, Stellar integration
├── contracts/    Soroban Rust workspace
├── frontend/     Next.js App Router client
├── docs/         Setup, testing, architecture, specs
├── DEMO.md       Demo script / presenter runbook
└── README.md     Product overview and quickstart
```

### 2.1 Backend

[`backend/src`](/Users/infinite/Programming/kredito/backend/src) contains:

- `index.ts`: server bootstrap, middleware, route mounting
- `config.ts`: environment loading and validation
- `db.ts`: SQLite connection and schema creation/migration
- `errors.ts`: app error helpers and Soroban-friendly error mapping
- `cron.ts`: scheduled overdue-loan monitoring
- `middleware/auth.ts`: JWT authentication middleware
- `routes/auth.ts`: challenge issuance and Freighter login
- `routes/credit.ts`: score generation, score reads, pool info, metrics reads
- `routes/loan.ts`: borrow, repay, status, and signed XDR submission flows
- `scoring/engine.ts`: wallet metric collection and score computation
- `stellar/client.ts`: Horizon/RPC clients and issuer keypair
- `stellar/query.ts`: read-only contract simulation helper
- `stellar/issuer.ts`: privileged registry updates
- `stellar/feebump.ts`: sponsored transaction creation/submission
- `utils/crypto.ts`: AES-256-GCM helpers for stored wallet secrets

### 2.2 Frontend

[`frontend/app`](/Users/infinite/Programming/kredito/frontend/app) is an App Router app with:

- `/`: landing page and Freighter login entry
- `/dashboard`: score overview and pool snapshot
- `/loan/borrow`: borrowing UX
- `/loan/repay`: repayment UX

Supporting modules:

- `components/`: wallet controls, shell, network badge
- `lib/api.ts`: Axios client plus external-wallet auto-sign/submit logic
- `lib/freighter.ts`: Freighter connection, challenge signing, transaction signing
- `store/auth.ts`: persisted JWT/user session store
- `store/walletStore.ts`: wallet/network connection store

### 2.3 Contracts

[`contracts`](/Users/infinite/Programming/kredito/contracts) is a Rust workspace with three packages:

- `credit_registry`
- `lending_pool`
- `phpc_token`

It also includes:

- `deploy.sh`: full deploy/bootstrap script
- `redeploy.sh`: partial redeploy script for token + pool
- `deployed.json`: currently tracked deployed addresses

## 3. End-to-End Architecture

### 3.1 Runtime interaction model

```text
User
  -> connects Freighter
  -> authenticates by signing backend challenge
  -> receives JWT from backend
  -> requests score / borrow / repay through frontend

Frontend
  -> calls backend REST endpoints
  -> signs unsigned XDR in Freighter when backend requires it
  -> sends signed XDR back to backend for fee sponsorship and submission

Backend
  -> verifies auth
  -> reads Horizon and Soroban RPC data
  -> computes score off-chain
  -> updates on-chain registry using issuer authority
  -> sponsors contract calls with fee bumps
  -> stores local session/history/cache data in SQLite

Contracts
  -> store tier, score, metrics, balances, allowance, and loans
  -> enforce borrowing eligibility and repayment rules
```

### 3.2 Why both off-chain and on-chain logic exist

The system deliberately splits responsibility:

- Off-chain metric aggregation is easier for Horizon account history and event scanning.
- On-chain state is needed for transparent eligibility checks and enforceable lending rules.
- The backend acts as the bridge that converts observed wallet activity into contract state.

This means the score formula exists twice:

- in Rust inside `credit_registry`
- in TypeScript inside `backend/src/scoring/engine.ts`

That duplication is intentional and necessary for local previews plus authoritative on-chain writes, but it also creates a drift risk if only one side changes.

## 4. Smart Contract Architecture

## 4.1 `credit_registry`

Source: [`contracts/credit_registry/src/lib.rs`](/Users/infinite/Programming/kredito/contracts/credit_registry/src/lib.rs)

Purpose:

- stores wallet credit metrics
- computes and stores a numeric score
- stores wallet tier
- stores tier borrow limits

### Responsibilities

- one-time initialization with issuer and tier limits
- issuer-only mutation of metrics and tier state
- public read access to score, tier, and metrics
- non-transferable behavior to prevent treating the registry like a token

### Storage model

Instance storage:

- `Issuer`
- `Tier1Limit`
- `Tier2Limit`
- `Tier3Limit`

Persistent per-wallet storage:

- `Metrics(Address)`
- `Score(Address)`
- `CreditTier(Address)`
- `TierTimestamp(Address)`

### Metrics shape

```text
tx_count
repayment_count
avg_balance
default_count
```

### Score formula

```text
score =
  (tx_count * 2) +
  (repayment_count * 10) +
  (min(avg_balance / 100, 10) * 5) -
  (default_count * 25)
```

Important details:

- score is saturating and never becomes negative
- average balance contribution is capped at 10 units before multiplying by 5
- defaults are the main negative factor

### Tier thresholds

- Tier 0: `< 40` -> `Unrated`
- Tier 1: `>= 40` -> `Bronze`
- Tier 2: `>= 80` -> `Silver`
- Tier 3: `>= 120` -> `Gold`

### Main contract methods

- `initialize`
- `update_metrics`
- `update_metrics_raw`
- `update_score`
- `set_tier`
- `revoke_tier`
- `compute_score`
- `get_metrics`
- `get_score`
- `get_tier`
- `get_tier_limit`

### Events

- `score_upd`
- `revoked`

## 4.2 `lending_pool`

Source: [`contracts/lending_pool/src/lib.rs`](/Users/infinite/Programming/kredito/contracts/lending_pool/src/lib.rs)

Purpose:

- holds PHPC liquidity
- validates tier-based loan eligibility
- creates and tracks a single active loan per borrower
- accepts repayment and marks defaults

### Responsibilities

- admin initialization
- admin deposit of liquidity
- borrower-authenticated borrow
- borrower-authenticated repay
- public default marking for overdue loans
- cross-contract reads into `credit_registry`
- token transfers via `phpc_token`

### Storage model

Instance storage:

- `Admin`
- `RegistryId`
- `TokenId`
- `FlatFeeBps`
- `LoanTermLedgers`
- `PoolBalance`

Persistent per-wallet storage:

- `Loan(Address)` -> `LoanRecord`

### `LoanRecord`

```text
principal
fee
due_ledger
repaid
defaulted
```

### Business rules

- only one non-settled loan per borrower
- borrower must have tier `>= 1`
- amount must be `> 0`
- amount must be within the wallet's tier limit
- amount must not exceed pool liquidity
- repay must happen before `due_ledger`
- overdue loans cannot be repaid; they must first become defaulted

### Fee model

Initialization stores a base fee in basis points. The effective fee varies by tier:

- Bronze: base fee, currently `500 bps` -> `5%`
- Silver: base fee minus `200 bps` -> `3%`
- Gold: base fee minus `350 bps` -> `1.5%`

Important nuance:

- The frontend/backend display logic currently uses `1% / 3% / 5%`.
- The contract currently computes `1.5% / 3% / 5%` from `500 - 350`.

This is an architectural mismatch between display/business logic and on-chain enforcement that should be treated as a known inconsistency.

### Main contract methods

- `initialize`
- `deposit`
- `borrow`
- `repay`
- `mark_default`
- `get_loan`
- `get_pool_balance`

### Events

- `disburse`
- `repaid`
- `defaulted`

## 4.3 `phpc_token`

Source: [`contracts/phpc_token/src/lib.rs`](/Users/infinite/Programming/kredito/contracts/phpc_token/src/lib.rs)

Purpose:

- acts as the demo stable-value loan asset
- supports minting, allowances, transfers, burns, and balance reads

### Storage model

Instance storage:

- `Admin`
- `Name`
- `Symbol`
- `Decimals`

Persistent storage:

- `Balance(Address)`
- `Allowance(Address, Address)`

### Main contract methods

- `initialize`
- `mint`
- `allowance`
- `approve`
- `balance`
- `transfer`
- `transfer_from`
- `burn`
- `burn_from`
- `decimals`
- `name`
- `symbol`

### Token semantics

- decimals are initialized to `7`
- mint authority is centralized under the admin/issuer
- `transfer_from` enforces allowance and source-balance checks
- allowance expiration is ledger based

## 4.4 Contract dependency graph

```text
credit_registry   <- standalone source of credit state
phpc_token        <- standalone token contract
lending_pool      <- depends on both
```

More specifically:

- `lending_pool.borrow` reads `credit_registry.get_tier`
- `lending_pool.borrow` reads `credit_registry.get_tier_limit`
- `lending_pool.deposit` uses `phpc_token.transfer_from`
- `lending_pool.borrow` uses `phpc_token.transfer`
- `lending_pool.repay` uses `phpc_token.transfer_from`

## 5. Backend Architecture

## 5.1 Server bootstrap

Source: [`backend/src/index.ts`](/Users/infinite/Programming/kredito/backend/src/index.ts)

Startup sequence:

1. load environment
2. initialize SQLite schema
3. start cron jobs
4. configure CORS and JSON parsing
5. log requests
6. mount routes
7. expose `/health`
8. attach centralized error handler

Mounted routes:

- `/api/auth`
- `/api/credit`
- `/api/loan`
- `/api/tx`

Note:

- `/api/tx` is mounted using the same router as `/api/loan`, which is why `POST /api/tx/sign-and-submit` works even though the handler lives in `routes/loan.ts`.

## 5.2 Configuration model

Source: [`backend/src/config.ts`](/Users/infinite/Programming/kredito/backend/src/config.ts)

Required or effectively required values:

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `ISSUER_SECRET_KEY`
- `WEB_AUTH_SECRET_KEY` or fallback to issuer key
- `PHPC_ID`
- `REGISTRY_ID`
- `LENDING_POOL_ID`

Optional with defaults:

- `PORT`
- `HORIZON_URL`
- `SOROBAN_RPC_URL`
- `NETWORK_PASSPHRASE`
- `HOME_DOMAIN`
- `WEB_AUTH_DOMAIN`
- `CORS_ORIGIN`
- `DATABASE_PATH`

Important constants:

- `LEDGERS_PER_DAY = 17_280`
- `STROOPS_PER_UNIT = 10_000_000`

## 5.3 Persistence model

Source: [`backend/src/db.ts`](/Users/infinite/Programming/kredito/backend/src/db.ts)

Database: SQLite through `better-sqlite3`

Default location:

- `backend/kredito.db` unless `DATABASE_PATH` is set

### Tables

#### `users`

Fields support both the current external-wallet flow and a legacy/dormant custodial flow:

- identity: `id`, `email`, `stellar_pub`
- optional secret storage: `stellar_enc_secret`
- wallet type: `is_external`
- verification/login fields: `email_verified`, `last_login_at`
- OTP-related legacy fields: `otp_hash`, `otp_expires_at`, `otp_attempt_count`, `otp_locked_until`
- timestamps: `created_at`

Important current-state observation:

- the active Freighter login path creates users with `is_external = 1`
- no current frontend path creates custodial users
- OTP fields and encrypted-secret support exist in schema, but are not used by the current UI

#### `otp_requests`

- historical/legacy support for OTP throttling
- not part of the current Freighter-first flow

#### `auth_challenges`

- stores issued wallet login challenges
- used to prevent challenge replay

Fields:

- `stellar_pub`
- `challenge_hash`
- `expires_at`
- `created_at`

#### `bootstrap_assessments`

- intended for off-chain bootstrap scoring inputs such as income/employment/business documentation
- not currently wired into the active frontend or score generation route

#### `score_events`

- append-only score history
- records tier, score, payload JSON, and optional tx metadata

Used for:

- retrieving latest score payload quickly
- preserving scoring history independent of current on-chain state

#### `active_loans`

- local cache of loans believed to be active
- used by cron to scan for overdue/default candidates

This is explicitly a convenience/cache table, not the canonical loan source of truth. The canonical loan state remains the lending pool contract.

## 5.4 Authentication architecture

Source: [`backend/src/routes/auth.ts`](/Users/infinite/Programming/kredito/backend/src/routes/auth.ts)

### Flow

1. client posts wallet address to `POST /api/auth/challenge`
2. backend validates the Stellar public key
3. backend builds a Stellar WebAuth challenge XDR
4. backend hashes and stores the challenge in `auth_challenges`
5. user signs the challenge in Freighter
6. client posts signed XDR to `POST /api/auth/login`
7. backend verifies the signed challenge and signer
8. backend consumes the stored challenge to prevent replay
9. backend finds or creates the user
10. backend issues a JWT valid for 24 hours

### Security properties

- short-lived challenge: 5 minutes
- one-time consumption of stored challenge hash
- wallet ownership proven by signature
- no private key custody in the normal frontend flow

### Session model

- JWT payload: `{ userId }`
- all protected routes use Bearer token auth
- frontend clears session on `401`

## 5.5 Credit scoring architecture

Sources:

- [`backend/src/scoring/engine.ts`](/Users/infinite/Programming/kredito/backend/src/scoring/engine.ts)
- [`backend/src/routes/credit.ts`](/Users/infinite/Programming/kredito/backend/src/routes/credit.ts)
- [`backend/src/stellar/issuer.ts`](/Users/infinite/Programming/kredito/backend/src/stellar/issuer.ts)

### Data sources for metrics

- Horizon transaction history for transaction count
- Horizon account balances for average balance proxy
- Soroban event scanning for repayments/defaults
- a fallback `get_loan` query if event retention is insufficient

### Important implementation detail

`avg_balance` is not a historical rolling average. It is currently derived from the current native XLM balance returned by Horizon and then floored to an integer.

So "average balance" is effectively a current-balance proxy in the present implementation.

### Score generation path

`POST /api/credit/generate`

1. load authenticated user
2. derive wallet metrics off-chain
3. compute score and tier off-chain
4. query on-chain tier limit for the derived tier
5. submit issuer-authenticated `update_metrics_raw` and `update_score`
6. insert a `score_events` history row
7. return score payload plus transaction hashes

### Score read path

`GET /api/credit/score`

1. read latest cached `score_json` from SQLite
2. query live on-chain score/tier/metrics
3. merge results and return `source: "onchain"`

This combines local history with current chain data.

### Pool and metrics reads

- `GET /api/credit/pool` returns lending pool balance
- `GET /api/credit/metrics` reads raw registry metrics directly from chain

## 5.6 Borrow and repay architecture

Source: [`backend/src/routes/loan.ts`](/Users/infinite/Programming/kredito/backend/src/routes/loan.ts)

The loan route contains the most important application orchestration logic.

### Borrow path

`POST /api/loan/borrow`

1. validate requested amount
2. rebuild current score summary for the wallet
3. check current on-chain loan status
4. reject if active loan exists
5. reject if tier is unrated
6. reject if amount exceeds derived borrow limit
7. build contract arguments for `lending_pool.borrow`
8. branch based on wallet type:
   - external wallet: return unsigned XDR
   - custodial wallet: sign and submit server-side
9. cache the active loan in SQLite after successful submission

Returned metadata includes:

- amount
- fee
- fee bps
- total owed
- explorer URL

### Repay path

`POST /api/loan/repay`

1. load on-chain loan record
2. reject missing/repaid/defaulted loans
3. check wallet PHPC balance before attempting contract execution
4. compute `approve` call args for the token contract
5. compute `repay` call args for the lending pool
6. branch based on wallet type

For external wallets the flow is two-step:

1. if token allowance is insufficient, return unsigned `approve` XDR
2. once approved, return unsigned `repay` XDR

For custodial wallets the backend submits both sequentially.

After successful repayment:

- local `active_loans` cache row is deleted
- score is rebuilt
- issuer writes updated metrics to chain
- a new `score_events` row is inserted

### Loan status path

`GET /api/loan/status`

Returns:

- `hasActiveLoan`
- wallet PHPC balance
- pool balance
- loan state if active or overdue

Computed loan UI fields include:

- principal
- fee
- total owed
- shortfall
- current ledger
- due ledger
- due date estimate
- days remaining
- status

### Signed XDR submission paths

- `POST /api/loan/submit`
- `POST /api/loan/sign-and-submit`

`sign-and-submit` is the richer path used by the frontend interceptor. It:

- submits one or more already-signed inner XDRs
- fee-sponsors them with the issuer key
- optionally performs post-submit bookkeeping depending on flow metadata

For example:

- borrow flow inserts/updates `active_loans`
- repay flow refreshes score state and clears the loan cache

## 5.7 Stellar integration layer

### Clients

Source: [`backend/src/stellar/client.ts`](/Users/infinite/Programming/kredito/backend/src/stellar/client.ts)

Constructs:

- `Horizon.Server`
- `rpc.Server`
- issuer `Keypair`

### Read-only contract queries

Source: [`backend/src/stellar/query.ts`](/Users/infinite/Programming/kredito/backend/src/stellar/query.ts)

Technique:

- build a simulated contract invocation
- call `simulateTransaction`
- convert result `ScVal` to native JS values

This is used throughout the backend for:

- token balances
- allowances
- score/tier reads
- tier limits
- pool balance
- loan records

### Issuer-authenticated writes

Source: [`backend/src/stellar/issuer.ts`](/Users/infinite/Programming/kredito/backend/src/stellar/issuer.ts)

Used for registry mutation:

- `update_metrics_raw`
- `update_score`

These are packed into a single prepared transaction signed by the issuer.

### Fee sponsorship

Source: [`backend/src/stellar/feebump.ts`](/Users/infinite/Programming/kredito/backend/src/stellar/feebump.ts)

Capabilities:

- create user accounts from issuer if missing
- build unsigned prepared contract calls for external wallets
- sign and submit sponsored contract calls for custodial wallets
- wrap signed inner transactions in fee bump transactions
- poll Soroban RPC until success/failure

This layer is what gives the app its "gasless" user experience on testnet.

## 5.8 Cron and default monitoring

Source: [`backend/src/cron.ts`](/Users/infinite/Programming/kredito/backend/src/cron.ts)

Schedule:

- every 6 hours

Behavior:

1. read local `active_loans`
2. query each loan from chain
3. if repaid/defaulted, delete local cache row
4. if overdue, rebuild metrics and update registry state
5. insert a score event describing the refresh
6. delete local cache row

Important limitation:

- the cron job does not call `lending_pool.mark_default`
- it only refreshes score state when it detects an overdue loan

That means local score history can reflect a default-style refresh even if the on-chain loan has not yet been explicitly marked defaulted by a contract call.

## 5.9 Error handling

Source: [`backend/src/errors.ts`](/Users/infinite/Programming/kredito/backend/src/errors.ts)

The error layer maps common Soroban panic/error signatures into user-facing messages, including:

- active loan exists
- no tier
- over limit
- insufficient liquidity
- missing loan
- already repaid/defaulted
- overdue
- insufficient balance
- insufficient allowance
- confirmation timeout

This is important because raw Soroban simulation/runtime errors are not user-friendly.

## 6. Frontend Architecture

## 6.1 Framework and libraries

Source: [`frontend/package.json`](/Users/infinite/Programming/kredito/frontend/package.json)

Key stack:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Zustand
- TanStack Query
- Axios
- Sonner
- Lucide icons

## 6.2 App shell and route protection

Sources:

- [`frontend/app/layout.tsx`](/Users/infinite/Programming/kredito/frontend/app/layout.tsx)
- [`frontend/app/dashboard/layout.tsx`](/Users/infinite/Programming/kredito/frontend/app/dashboard/layout.tsx)
- [`frontend/app/loan/layout.tsx`](/Users/infinite/Programming/kredito/frontend/app/loan/layout.tsx)
- [`frontend/components/app-shell.tsx`](/Users/infinite/Programming/kredito/frontend/components/app-shell.tsx)

Behavior:

- global providers wrap the entire app
- wallet session restore runs on mount
- dashboard and loan areas redirect to `/` if JWT session is missing
- authenticated screens share a sidebar/topbar shell

The frontend route protection is client-side only. The actual secure boundary remains backend JWT enforcement.

## 6.3 State management

### Auth store

Source: [`frontend/store/auth.ts`](/Users/infinite/Programming/kredito/frontend/store/auth.ts)

Persists:

- `token`
- `user.wallet`
- `user.isExternal`

Persistence key:

- `kredito-auth`

### Wallet store

Source: [`frontend/store/walletStore.ts`](/Users/infinite/Programming/kredito/frontend/store/walletStore.ts)

Tracks:

- connection status
- public key
- network
- network passphrase
- connection error
- connect/disconnect/restoreSession actions

Persistence behavior:

- uses `localStorage` flag `kredito_wallet_connected`
- reconnects by re-requesting address and network details from Freighter

## 6.4 Freighter integration

Source: [`frontend/lib/freighter.ts`](/Users/infinite/Programming/kredito/frontend/lib/freighter.ts)

Capabilities:

- check whether Freighter is installed
- request wallet access
- retrieve current address
- retrieve wallet network
- sign transaction XDR
- execute login challenge flow

Important design decision:

- the frontend uses Freighter for both authentication signing and contract transaction signing
- private keys never pass through the browser app code beyond extension-mediated signing

## 6.5 API client and automatic signing

Source: [`frontend/lib/api.ts`](/Users/infinite/Programming/kredito/frontend/lib/api.ts)

This file is the core frontend orchestration layer.

### Request behavior

- injects Bearer token from Zustand auth store

### Response behavior

If a borrow/repay response contains:

- `requiresSignature: true`

then the client automatically:

1. signs returned XDR with Freighter
2. posts it to `/api/tx/sign-and-submit`
3. for repay approval, immediately calls `/api/loan/repay` again to fetch the final repay XDR
4. returns a normalized response shape to the page component

This is a major architecture choice because it keeps page-level borrow/repay components simple. They call the API once, while the interceptor quietly executes the multi-step wallet flow.

### Session expiry behavior

On `401`:

- auth state is cleared
- browser is redirected to `/?session=expired`

## 6.6 Page-level responsibilities

### Landing page

Source: [`frontend/app/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/page.tsx)

Responsibilities:

- detect Freighter installation
- trigger wallet connect
- perform backend login challenge flow
- persist JWT/user session
- redirect authenticated users to dashboard

### Dashboard

Source: [`frontend/app/dashboard/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/dashboard/page.tsx)

Responsibilities:

- fetch latest score
- auto-generate score if none exists yet
- fetch pool balance
- fetch active loan status
- display formula breakdown and raw metrics
- allow manual score refresh
- route user toward borrow or repay based on loan state

Interesting implementation detail:

- it first tries `GET /credit/score`
- if that fails and no score exists yet, it automatically calls `POST /credit/generate`

### Borrow page

Source: [`frontend/app/loan/borrow/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/loan/borrow/page.tsx)

Responsibilities:

- load score and loan state
- redirect to repay if a loan is already active
- display approved amount based on `borrowLimit`
- require user acknowledgement before borrowing
- submit borrow action

Important limitation:

- the page derives `borrowAmount` as the full borrow limit from the score response
- it does not currently expose arbitrary user-entered loan amounts

### Repay page

Source: [`frontend/app/loan/repay/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/loan/repay/page.tsx)

Responsibilities:

- load active loan status
- redirect back to dashboard if there is no active loan
- display principal, fee, total due, shortfall, due date, and days remaining
- submit repayment
- show updated score result on success

## 6.7 Network enforcement

Sources:

- [`frontend/lib/constants.ts`](/Users/infinite/Programming/kredito/frontend/lib/constants.ts)
- [`frontend/components/NetworkBadge.tsx`](/Users/infinite/Programming/kredito/frontend/components/NetworkBadge.tsx)

The frontend assumes:

- required network label: `TESTNET`
- required signing passphrase: Stellar testnet passphrase

Wallet UI warns when the wallet is on the wrong network and disables transactional flows.

## 7. Primary User Flows

## 7.1 Wallet login flow

```text
Landing page
  -> connect Freighter
  -> POST /api/auth/challenge
  -> sign challenge in Freighter
  -> POST /api/auth/login
  -> receive JWT
  -> persist JWT + wallet in Zustand
  -> redirect /dashboard
```

## 7.2 Score generation flow

```text
Dashboard load
  -> GET /api/credit/score
  -> if none exists, POST /api/credit/generate
  -> backend aggregates metrics from Horizon/RPC
  -> backend computes score
  -> backend updates credit_registry
  -> backend stores score event
  -> frontend renders on-chain score breakdown
```

## 7.3 Borrow flow

```text
Borrow page
  -> POST /api/loan/borrow
  -> backend validates amount, tier, current loan
  -> backend returns unsigned XDR for external wallet
  -> frontend interceptor signs in Freighter
  -> frontend posts signed XDR to /api/tx/sign-and-submit
  -> backend fee-sponsors and submits
  -> backend caches active loan
  -> frontend shows success state
```

## 7.4 Repay flow

```text
Repay page
  -> POST /api/loan/repay
  -> backend checks token balance and loan state
  -> if no allowance, return approve XDR
  -> frontend signs/submits approve
  -> frontend calls /api/loan/repay again
  -> backend returns repay XDR
  -> frontend signs/submits repay
  -> backend clears active loan cache
  -> backend refreshes metrics and registry
  -> frontend shows new score/tier
```

## 7.5 Overdue/default monitoring flow

```text
Cron job every 6 hours
  -> iterate active_loans cache
  -> query on-chain loan
  -> if overdue, rebuild metrics
  -> update registry via issuer
  -> insert score event
  -> clear local active loan cache entry
```

## 8. Data Model and State Boundaries

## 8.1 Canonical data locations

On-chain:

- wallet metrics
- score
- tier
- tier limits
- token balances
- token allowances
- active loan records
- pool balance

Backend SQLite:

- user identity rows
- auth challenge replay protection
- score history snapshots
- local active-loan cache
- legacy OTP/bootstrap tables

Frontend local state:

- JWT session
- wallet connection/session state
- TanStack Query caches

## 8.2 What is cached vs authoritative

Authoritative:

- contracts for financial state
- wallet signature for identity proof

Cached or derived:

- `score_events`
- `active_loans`
- query caches in the frontend
- loan due date estimates derived from current wall-clock time and ledger deltas

## 9. Security Model

## 9.1 Strong points

- Wallet-based authentication instead of password auth
- Short-lived, one-time-use login challenges
- Contract state controls borrow eligibility
- Fee sponsorship avoids requiring end-user XLM for demo usage
- Private key material is not stored for the active external-wallet flow
- Encryption support exists for any stored wallet secret path

## 9.2 Centralized trust points

The system is not trustless. It relies on a privileged issuer/admin identity for:

- minting PHPC
- funding and controlling the pool
- sponsoring user transactions
- creating missing Stellar accounts
- updating credit registry metrics

This is an acceptable architecture for the project's current demo/prototype stage, but it is a major centralization boundary.

## 9.3 Security gaps and caveats

- Score generation trusts backend metric aggregation completely.
- The registry is issuer-writable, so users do not independently submit or verify metric writes.
- The backend can create accounts with issuer funds.
- The frontend route guard is UX-only; backend JWT remains the real protection layer.
- Legacy custodial-wallet and OTP schema exists, which increases conceptual surface area even though the current UI does not expose it.

## 10. Deployment and Operations

## 10.1 Contracts

Deployment scripts:

- [`contracts/deploy.sh`](/Users/infinite/Programming/kredito/contracts/deploy.sh)
- [`contracts/redeploy.sh`](/Users/infinite/Programming/kredito/contracts/redeploy.sh)

Bootstrap steps handled by scripts:

1. deploy token
2. initialize token
3. deploy registry
4. initialize registry with tier limits
5. deploy or redeploy lending pool
6. initialize pool
7. mint PHPC to issuer
8. approve pool spending
9. deposit liquidity into pool

Tracked deployed addresses:

- see [`contracts/deployed.json`](/Users/infinite/Programming/kredito/contracts/deployed.json)

## 10.2 Backend

The backend is a single-process Express app with:

- local SQLite file storage
- outbound calls to Horizon and Soroban RPC
- in-process cron job scheduling

Operational implications:

- horizontal scaling is not straightforward with local SQLite plus in-process cron
- multiple backend instances could duplicate cron work without coordination
- filesystem persistence must be managed explicitly outside local development

## 10.3 Frontend

The frontend is a standard Next.js deployment with:

- browser-only wallet integration
- no server-side wallet custody
- environment-driven API base URL

## 10.4 Environment variables

### Backend

From [`backend/.env.example`](/Users/infinite/Programming/kredito/backend/.env.example):

- `NODE_ENV`
- `PORT`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `ISSUER_SECRET_KEY`
- `PHPC_ID`
- `REGISTRY_ID`
- `LENDING_POOL_ID`
- `HORIZON_URL`
- `SOROBAN_RPC_URL`
- `NETWORK_PASSPHRASE`
- `CORS_ORIGIN`
- optional `DATABASE_PATH`

The code also supports:

- `WEB_AUTH_SECRET_KEY`
- `HOME_DOMAIN`
- `WEB_AUTH_DOMAIN`

### Frontend

From [`frontend/.env.example`](/Users/infinite/Programming/kredito/frontend/.env.example):

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_NETWORK`
- `NEXT_PUBLIC_EXPLORER_URL`

Note:

- the frontend code actively uses `NEXT_PUBLIC_API_URL`
- network behavior is actually enforced by hardcoded constants in `frontend/lib/constants.ts`, not by `NEXT_PUBLIC_NETWORK`

That means the frontend env example is broader than what the runtime currently reads.

## 11. Testing and Verification Surface

## 11.1 Smart contracts

- unit tests exist under each contract package
- snapshot artifacts are checked into `test_snapshots/`

## 11.2 Backend

- there is no real automated backend test suite
- `pnpm test` currently prints `"No backend tests configured"`

## 11.3 Frontend

- linting is configured
- no dedicated component or E2E browser tests are present in the repo

## 11.4 Manual system verification

The project relies heavily on documented manual verification:

- [`docs/SETUP.md`](/Users/infinite/Programming/kredito/docs/SETUP.md)
- [`docs/TESTING.md`](/Users/infinite/Programming/kredito/docs/TESTING.md)
- [`DEMO.md`](/Users/infinite/Programming/kredito/DEMO.md)

## 12. Current Architectural Mismatches and Risks

These are the most important things to understand if you plan to extend the system.

### 12.1 Fee-rate mismatch

The contract fee schedule and the backend/frontend display schedule do not fully match for Gold tier.

- Contract: Gold is effectively `1.5%`
- Backend/frontend presentation: Gold is treated as `1%`

This can create user-facing inconsistencies and should be resolved before production use.

### 12.2 "Average balance" is not truly historical

The score model describes an average balance metric, but the implementation currently uses the current native XLM balance as a proxy.

### 12.3 External-wallet path is primary, custodial path is partial

The backend still contains code for encrypted wallet secrets and server-side transaction submission, but the current frontend login path always creates external-wallet users.

This means the codebase contains two identity models, but only one is really active.

### 12.4 Cron does not write on-chain defaults

Overdue monitoring refreshes score state and cache rows, but it does not invoke `mark_default` on the lending pool contract.

### 12.5 Local cache can drift from chain state

`active_loans` and `score_events` can become stale if:

- contracts are redeployed
- manual chain mutations occur
- submissions partially fail

The docs already note that clearing cache tables may be needed after redeployments.

### 12.6 SQLite and in-process cron constrain scale

The current backend architecture is appropriate for local development and demo deployment, but not yet for multi-instance production scaling.

## 13. Practical Mental Model

The simplest correct way to think about Kredito is:

- the frontend is a wallet-driven control panel
- the backend is a privileged orchestration service
- the contracts are the enforceable financial state machine

The critical boundary is not "frontend vs backend". It is:

- off-chain observation and orchestration on one side
- on-chain enforcement and state on the other

Almost every important feature crosses that boundary:

- login starts in wallet, ends in backend session state
- score starts from off-chain observation, ends in on-chain registry state
- borrow starts as an API request, ends as a sponsored contract invocation
- repay starts as a UI action, passes through token allowance management, and ends with registry refresh

## 14. Recommended Reading Order

For someone new to the codebase, the fastest accurate reading order is:

1. [`README.md`](/Users/infinite/Programming/kredito/README.md)
2. [`contracts/credit_registry/src/lib.rs`](/Users/infinite/Programming/kredito/contracts/credit_registry/src/lib.rs)
3. [`contracts/lending_pool/src/lib.rs`](/Users/infinite/Programming/kredito/contracts/lending_pool/src/lib.rs)
4. [`backend/src/routes/auth.ts`](/Users/infinite/Programming/kredito/backend/src/routes/auth.ts)
5. [`backend/src/scoring/engine.ts`](/Users/infinite/Programming/kredito/backend/src/scoring/engine.ts)
6. [`backend/src/routes/loan.ts`](/Users/infinite/Programming/kredito/backend/src/routes/loan.ts)
7. [`frontend/lib/api.ts`](/Users/infinite/Programming/kredito/frontend/lib/api.ts)
8. [`frontend/app/dashboard/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/dashboard/page.tsx)

That sequence explains the protocol, the backend control plane, and the frontend transaction UX in the order they actually matter.

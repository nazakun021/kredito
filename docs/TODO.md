# TODO.md — Kredito v2 Refactor

### Soroban-First · Stateless Backend · Chain as Source of Truth

> **Engineering Standard:** Every task is atomic, file-referenced, and test-gated.
> Complete phases in order. Do not skip ahead — later phases depend on earlier ones being clean.

---

## Phase Dependency Map

```
P1 (Remove DB) → P2 (Stateless Auth) → P3 (Scoring Refactor)
                                      ↓
P4 (On-Chain Source of Truth) → P5 (Borrow Flow) → P6 (Repay Flow)
                                                  ↓
                          P7 (Dashboard) → P8 (Wallet UX) → P9 (Sponsorship)
                                                           ↓
                                              P10 (Cleanup) → P11 (Tests)
```

---

## PHASE 1 — Remove Database Dependency

**Goal:** Eliminate all SQLite/better-sqlite3 references. The backend must start cleanly without a DB file.

### 1.1 — Delete DB Files

- [ ] **DELETE** `backend/src/db.ts`
  - Contains `better-sqlite3` initialization and all table DDL (`users`, `score_events`, `active_loans`)
  - Remove from `backend/src/index.ts` import
- [ ] **DELETE** `backend/src/users.ts`
  - Contains `upsertUser()`, `findUserByWallet()`, `getUserById()` — all must be removed
  - No replacement needed; wallet address is identity
- [ ] **DELETE** `backend/src/types/db.ts`
  - Contains `User`, `ScoreEvent`, `ActiveLoan` TypeScript types that reference DB rows
- [ ] **DELETE** `backend/src/loan-state.ts`
  - Contains `insertActiveLoan()`, `removeActiveLoan()`, `hasActiveLoan()` — all DB-backed
  - Replace with contract query at call sites (see Phase 4)
- [ ] **DELETE** `backend/src/cron.ts`
  - Cron job queries `active_loans` table for default detection
  - Default detection must move to a contract-query-driven mechanism (see Phase 10)

### 1.2 — Remove DB Imports from Routes

- [ ] **`backend/src/routes/auth.ts`**
  - Remove `upsertUser()` call after successful challenge verification
  - Remove `findUserByWallet()` call used for session lookup
  - JWT payload should contain only `{ sub: stellarPublicKey, iat, exp }` — no `userId`
- [ ] **`backend/src/routes/credit.ts`**
  - Remove any `findUserByWallet()` call used to resolve `userId` before scoring
  - Replace with `req.wallet` from JWT middleware (see Phase 2)
- [ ] **`backend/src/routes/loan.ts`**
  - Remove `hasActiveLoan()` DB check in `POST /loan/borrow`
  - Remove `insertActiveLoan()` / `removeActiveLoan()` calls
  - Replace with `get_loan()` contract query (see Phase 4)
- [ ] **`backend/src/index.ts`**
  - Remove `import db from './db'`
  - Remove any DB startup probe / migration call

### 1.3 — Remove `better-sqlite3` Package

- [ ] Run `pnpm remove better-sqlite3 @types/better-sqlite3` from `backend/`
- [ ] Confirm `backend/package.json` no longer lists either package
- [ ] Confirm `pnpm build` succeeds with zero TypeScript errors

### 1.4 — Acceptance Criteria

- `backend/` starts without any `.db` file present
- `GET /health` returns `{ status: "ok" }` with no DB errors
- No TypeScript error mentioning `db`, `users`, `active_loans`, or `score_events`

---

## PHASE 2 — Stateless Auth (JWT Reform)

**Goal:** Auth is a challenge→sign→JWT flow. No user record is created or read. Wallet address is the only identity.

### 2.1 — `backend/src/routes/auth.ts`

- [ ] **`POST /api/auth/challenge`**
  - Keep challenge generation using `WEB_AUTH_SECRET_KEY`
  - Remove any DB lookup or creation of a `User` row
  - Challenge must be a signed Stellar transaction envelope (SEP-10 compliant)
  - Challenge TTL: 5 minutes (300 seconds) — enforce in verification
- [ ] **`POST /api/auth/login`**
  - Verify the signed challenge (SEP-10 signature check)
  - Issue JWT with payload: `{ sub: <stellar_pub_key>, iat: <now>, exp: <now + 1hr> }`
  - **Do NOT** create a user record, do NOT read from DB
  - Return: `{ token: string, wallet: string }`
- [ ] Remove `/api/auth/logout` if it purges a DB session — JWT expiry is the logout mechanism

### 2.2 — `backend/src/middleware/auth.ts`

- [ ] Decode and verify JWT
- [ ] Attach `req.wallet = payload.sub` (the Stellar public key) to every authenticated request
- [ ] Remove any `req.userId` attachment — there is no user ID in a stateless system
- [ ] Return `401` on expired or malformed token
- [ ] Type augment Express `Request`: `declare global { namespace Express { interface Request { wallet: string } } }`

### 2.3 — Update All Route Handlers

- [ ] Replace every `req.userId` reference with `req.wallet` across:
  - `credit.ts`
  - `loan.ts`
  - `tx.ts`
- [ ] Update TypeScript types accordingly — remove `userId` from any shared type

### 2.4 — `frontend/store/auth.ts`

- [ ] JWT is stored in memory (Zustand store) — **not** `localStorage`
- [ ] Auth store shape: `{ token: string | null, wallet: string | null, setAuth, clearAuth }`
- [ ] On page reload, no JWT is recovered — user must re-auth (acceptable for v2)
- [ ] Session expiry: detect `401` responses in `frontend/lib/api.ts` and call `clearAuth()`, redirect to `/`

### 2.5 — Acceptance Criteria

- `POST /api/auth/login` returns token with no DB writes
- All authenticated routes resolve `req.wallet` correctly
- A tampered or expired JWT returns `401` from the middleware
- Frontend clears session and redirects on `401`

---

## PHASE 3 — Scoring Engine Refactor

**Goal:** Scoring is a pure deterministic function. Backend computes off-chain, submits on-chain. Formula is documented and testable.

### 3.1 — `backend/src/scoring/engine.ts`

- [ ] Ensure `calculateScore(metrics: WalletMetrics): number` is a **pure function** with zero side effects
  - Current formula (keep as-is, document clearly):
    ```
    score = (txCount × 2) + (repaymentCount × 10) + (avgBalanceFactor × 5) − (defaultCount × 25)
    score = max(0, score)
    ```
  - `avgBalanceFactor` = `Math.floor(avgBalance / 100)` — document this derivation
- [ ] Export `SCORE_FORMULA_DESCRIPTION` as a typed constant (used by API response)
- [ ] Export `TIER_THRESHOLDS: Record<number, number>` = `{ 1: 40, 2: 80, 3: 120 }`
- [ ] Export `TIER_LIMITS_PHPC: Record<number, number>` = `{ 0: 0, 1: 500, 2: 2000, 3: 5000 }` (7 decimals: multiply by 10^7 for contract calls)
- [ ] Export `TIER_FEE_BPS: Record<number, number>` = `{ 0: 500, 1: 500, 2: 300, 3: 150 }` — matches contract logic

### 3.2 — `backend/src/stellar/query.ts`

- [ ] Add `fetchStellarMetrics(walletAddress: string): Promise<WalletMetrics>`:
  - `txCount`: count of operations on wallet address via Horizon `/accounts/{id}/operations?limit=200`
  - `repaymentCount`: count of successful `repay()` events from `lending_pool` contract events
  - `avgBalance`: average XLM balance over the last 30 days from Horizon `/accounts/{id}/effects`
  - `defaultCount`: count of `mark_default` events for this address from `lending_pool` contract
- [ ] All Horizon requests must use `withRetry()` (already exists in `query.ts`)
- [ ] Return type must be `WalletMetrics` — same shape as scoring engine expects

### 3.3 — `backend/src/routes/credit.ts`

- [ ] **`GET /api/credit/score`** (read-only, fast):
  - Call `getOnChainCreditSnapshot(req.wallet)` — already exists in `issuer.ts`
  - Return score payload from chain, no off-chain computation
  - Cache: use a 60-second in-memory cache keyed by wallet address
- [ ] **`POST /api/credit/generate`** (compute + write, slower):
  - Fetch Stellar metrics via `fetchStellarMetrics(req.wallet)`
  - Compute score via `calculateScore(metrics)`
  - Call `updateOnChainMetrics(req.wallet, metrics)` to write to `credit_registry`
  - Return: full score payload including `formula` breakdown and `metrics`
- [ ] **`POST /api/credit/refresh`** (alias for `generate` — same implementation):
  - Used by frontend "Refresh On-Chain Score" button
  - Same logic as `generate`
- [ ] **`GET /api/credit/pool`**:
  - Query `lending_pool.get_pool_balance()` via `queryContract()`
  - Return: `{ poolBalance: string }` formatted to 2 decimal PHPC

### 3.4 — Acceptance Criteria

- `calculateScore` produces identical output for identical inputs across multiple calls
- `POST /api/credit/generate` writes a new score on-chain and returns it
- `GET /api/credit/score` reads from chain (no DB) and returns within 1 second
- Scoring engine unit tests pass (see Phase 11)

---

## PHASE 4 — On-Chain Source of Truth (Loan State)

**Goal:** All loan state comes from `lending_pool.get_loan(address)`. The backend never stores loan data.

### 4.1 — `backend/src/stellar/query.ts`

- [ ] Add `getLoanFromChain(walletAddress: string): Promise<LoanState | null>`:
  - Calls `queryContract(lendingPoolId, 'get_loan', [addressScVal])`
  - Returns `null` if no loan exists (contract returns `None`)
  - Returns typed `LoanState`:
    ```typescript
    interface LoanState {
      principal: bigint; // in stroops (7 decimals)
      fee: bigint;
      dueledger: number;
      repaid: boolean;
      defaulted: boolean;
      totalOwed: bigint; // principal + fee
    }
    ```
  - Use `scValToNative()` for deserialization
- [ ] Add `hasActiveLoan(walletAddress: string): Promise<boolean>`:
  - Calls `getLoanFromChain()`
  - Returns `true` if loan exists AND `!repaid && !defaulted`

### 4.2 — `backend/src/routes/loan.ts`

- [ ] **`GET /api/loan/status`**:
  - Call `getLoanFromChain(req.wallet)` and `queryContract(pool, 'get_pool_balance', [])`
  - Derive `hasActiveLoan` from on-chain state
  - Return:
    ```typescript
    {
      hasActiveLoan: boolean,
      poolBalance: string,       // formatted PHPC
      loan: {
        principal: string,
        fee: string,
        totalOwed: string,
        dueledger: number,
        daysRemaining: number,   // derived from (dueledger - currentLedger) × 5s / 86400
        repaid: boolean,
        defaulted: boolean,
        status: 'active' | 'repaid' | 'defaulted'
      } | null
    }
    ```
- [ ] Remove all DB-sourced loan status logic
- [ ] Remove `loan-state.ts` import from this file

### 4.3 — `frontend/lib/api.ts` / Dashboard + Borrow Page

- [ ] Update `LoanStatusResponse` type to match new backend contract-derived response
- [ ] Remove any frontend assumption that `hasActiveLoan` comes from backend DB
- [ ] `daysRemaining` should be computed on backend (current_ledger from `getLatestLedger()`)

### 4.4 — Acceptance Criteria

- `GET /api/loan/status` returns correct loan state after a `borrow()` on-chain
- `GET /api/loan/status` shows `hasActiveLoan: false` after `repay()` on-chain
- No SQL appears anywhere in the loan status path

---

## PHASE 5 — Borrow Flow (TX Builder Reform)

**Goal:** Backend builds and sponsors; user signs. No backend validation that duplicates contract enforcement.

### 5.1 — `backend/src/routes/loan.ts` — `POST /api/loan/borrow`

- [ ] **Pre-flight check (UX only, not enforcement):**
  - Call `hasActiveLoan(req.wallet)` — return `400` with `{ error: "Active loan exists" }` before building TX (saves user a signature round-trip)
  - Call `getLoanFromChain()` tier check: if `tier === 0`, return `400` with `{ error: "No active credit tier" }`
  - Check `poolBalance >= amount` — return `400` with `{ error: "Insufficient pool liquidity" }`
  - **These are UX guards only. Contract enforces all of these on-chain.**
- [ ] **Build unsigned XDR:**
  - Validate `amount` is a positive number, convert to `i128` in 7-decimal format
  - Build `Operation.invokeHostFunction` for `lending_pool.borrow(borrower, amount)`
  - Prepare transaction via `rpcServer.prepareTransaction(tx)` to get simulated auth entries
  - **Do NOT sign** — return `{ requiresSignature: true, unsignedXdr: tx.toXDR() }`
- [ ] **Remove** any backend logic that enforces borrow limits — that is the contract's job
- [ ] Request body: `{ amount: number }` (human-readable PHPC, e.g. `500`)
- [ ] Response: `{ requiresSignature: true, unsignedXdr: string }`

### 5.2 — `backend/src/routes/tx.ts` — `POST /api/tx/sign-and-submit`

- [ ] Accept: `{ signedInnerXdr: string[], flow: { action: 'borrow' | 'repay_approve' | 'repay' } }`
- [ ] For `borrow` flow:
  - Wrap the signed inner TX with a fee-bump from issuer keypair using `feebumpTransaction()`
  - Submit via `rpcServer.sendTransaction(feeBumpTx)`
  - Poll for confirmation via `pollTransaction(hash)`
  - Return `{ txHash, explorerUrl, amount, fee, totalOwed, feeBps }`
- [ ] All submission errors must map through `mapSorobanError()` in `errors.ts`
- [ ] Add retry on `TRY_AGAIN_LATER` status (up to 3 times with 2s backoff)

### 5.3 — `frontend/app/loan/borrow/page.tsx`

- [ ] Ensure borrow amount input validates against `score.borrowLimit` (client-side UX check only)
- [ ] Borrow flow steps (already mostly correct, verify each):
  1. `POST /api/loan/borrow` → get `unsignedXdr`
  2. `signTx(unsignedXdr, wallet)` via Freighter
  3. `POST /api/tx/sign-and-submit` → get confirmation
- [ ] Show explicit error if wallet is on wrong network before step 1
- [ ] Show `txHash` and Stellar Expert link on success

### 5.4 — Acceptance Criteria

- `POST /api/loan/borrow` returns unsigned XDR only — never submits on user's behalf
- A double-borrow returns contract error `#7` (mapped to user-friendly message)
- Fee-bump is applied on every submission
- Borrow success shows on-chain `txHash`

---

## PHASE 6 — Repay Flow (Two-Step Guided UX)

**Goal:** Approve + repay is a guided two-signature flow. The UI shows the exact shortfall before either TX is signed.

### 6.1 — `backend/src/routes/loan.ts` — `POST /api/loan/repay`

- [ ] **Pre-flight validation:**
  - Call `getLoanFromChain(req.wallet)` — if no active loan, return `400`
  - Call `queryContract(phpcId, 'balance', [wallet])` — check PHPC balance
  - If `balance < totalOwed`, return `422`:
    ```json
    {
      "error": "InsufficientBalance",
      "shortfall": "25.00",
      "walletBalance": "500.00",
      "totalOwed": "525.00"
    }
    ```
- [ ] **Build two unsigned XDRs:**
  - TX 1 (Approve): `phpc_token.approve(borrower, lending_pool, totalOwed, expiryLedger)`
    - `expiryLedger` = `currentLedger + 200` (roughly 16 minutes at 5s/ledger)
  - TX 2 (Repay): `lending_pool.repay(borrower)`
  - Return both as an array: `{ requiresSignature: true, transactions: [approveXdr, repayXdr] }`
- [ ] Do NOT merge into a single TX — contract requires separate approve + repay

### 6.2 — `backend/src/routes/tx.ts` — Multi-TX submit

- [ ] For `repay` flow (`flow.action === 'repay'`):
  - Accept `signedInnerXdr: [approveXdr, repayXdr]`
  - Submit `approveXdr` as fee-bumped TX, poll until confirmed
  - Submit `repayXdr` as fee-bumped TX, poll until confirmed
  - Return `{ txHash: repayTxHash, explorerUrl }`
- [ ] If approve TX fails, do NOT submit repay TX — return error

### 6.3 — `frontend/app/loan/repay/page.tsx`

- [ ] **Pre-sign display (critical):**
  - Fetch `GET /api/loan/status` — display `principal`, `fee`, `totalOwed`, `daysRemaining`
  - Fetch `GET /api/credit/score` — read wallet's PHPC balance (backend provides it in loan status)
  - Compute and display `shortfall = max(0, totalOwed − walletPhpcBalance)`
  - If `shortfall > 0`, show prominent warning and disable repay button
- [ ] **Two-step signing flow:**
  1. User clicks "Repay" → `POST /api/loan/repay` → get `[approveXdr, repayXdr]`
  2. Prompt: "Step 1 of 2 — Approve token spend" → sign `approveXdr` in Freighter
  3. Prompt: "Step 2 of 2 — Confirm repayment" → sign `repayXdr` in Freighter
  4. `POST /api/tx/sign-and-submit` with both signed XDRs
- [ ] Show `StepBreadcrumb` reflecting both signing steps
- [ ] On success: show `txHash` + trigger score refresh

### 6.4 — Acceptance Criteria

- Repay page shows exact shortfall before any signing
- Two separate Freighter prompts appear (approve, then repay)
- Attempting repay with insufficient balance returns `422` before building XDR
- After successful repay, `GET /api/loan/status` shows `hasActiveLoan: false`

---

## PHASE 7 — Dashboard (Chain-Driven)

**Goal:** Every data point on the dashboard comes from a contract query or a backend function that reads from the chain.

### 7.1 — `frontend/app/dashboard/page.tsx`

- [ ] **Score card data sources:**
  - Score, tier, tierLabel, borrowLimit, feeRate → `GET /api/credit/score` (reads from `credit_registry`)
  - Formula breakdown → derived from score endpoint response (already in `buildScorePayload`)
  - Raw metrics (txCount, repaymentCount, etc.) → included in score endpoint response
- [ ] **Loan status card:**
  - `hasActiveLoan`, `poolBalance`, loan details → `GET /api/loan/status` (reads from `lending_pool`)
- [ ] **Pool balance:**
  - `GET /api/credit/pool` → `lending_pool.get_pool_balance()`
- [ ] Remove any hardcoded or cached data that was previously sourced from DB
- [ ] `staleTime` for score: `5 * 60 * 1000` (5 min) — score changes only on generate
- [ ] `staleTime` for loanStatus: `30 * 1000` (30 sec) — loan can change

### 7.2 — Score Formula UI

- [ ] Display the score formula with live variable substitution (already exists, verify it uses on-chain values)
- [ ] Add tooltip or info section explaining `avgBalanceFactor` derivation: `floor(avgBalance / 100)`
- [ ] Add `SCORE_FORMULA_DESCRIPTION` constant from engine to the API response — display in UI

### 7.3 — Acceptance Criteria

- Dashboard loads correctly with no DB in backend
- Score displayed matches `credit_registry.get_score(wallet)` on-chain
- Loan status displayed matches `lending_pool.get_loan(wallet)` on-chain
- Pool balance displayed matches `lending_pool.get_pool_balance()` on-chain

---

## PHASE 8 — Wallet UX

**Goal:** One wallet connection per session. No forced reconnects. Graceful disconnect handling.

### 8.1 — `frontend/store/walletStore.ts`

- [ ] Wallet state: `{ publicKey, network, isConnected, connectionError }`
- [ ] `connect()`: call Freighter, set state — do NOT clear existing connection if already connected
- [ ] `disconnect()`: clear state — called only on explicit logout
- [ ] **Do NOT** call `connect()` again if `isConnected === true` and `publicKey` is already set
- [ ] Add `isCorrectNetwork: boolean` derived state: `network === 'TESTNET'`

### 8.2 — `frontend/components/WalletProvider.tsx`

- [ ] On mount, attempt `getPublicKey()` from Freighter silently (no popup) to restore state if Freighter is already authorized
- [ ] If Freighter returns a key without user prompt, set wallet state
- [ ] If Freighter throws (not authorized), set `isConnected: false` silently — do NOT show error
- [ ] Remove any forced reconnect on route changes

### 8.3 — `frontend/components/ConnectWalletButton.tsx`

- [ ] Show `connected: <truncated_key>` badge when connected
- [ ] Show `Connect Freighter` button when not connected
- [ ] Show error state only on explicit failed connection attempt

### 8.4 — `frontend/components/WalletConnectionBanner.tsx`

- [ ] Show warning banner in borrow/repay pages if:
  - `!isConnected` → "Please connect your wallet"
  - `!isCorrectNetwork` → "Switch Freighter to Testnet"
- [ ] Banner must block borrow/repay action buttons (via `disabled` prop)

### 8.5 — Acceptance Criteria

- Refreshing a page does not pop a Freighter authorization dialog
- Navigating between borrow/repay/dashboard does not trigger reconnect
- Disconnecting wallet redirects to `/` and clears JWT

---

## PHASE 9 — Transaction Sponsorship

**Goal:** Every user-signed transaction is fee-bumped by the issuer. Users pay zero XLM in fees.

### 9.1 — `backend/src/stellar/feebump.ts`

- [ ] Keep existing `feebumpTransaction(innerTx, issuerKeypair)` function
- [ ] Confirm fee-bump base fee: `1000 stroops` (10× default, appropriate for testnet)
- [ ] Add `pollTransaction(hash, maxAttempts = 30, delayMs = 2000)`:
  - Poll `rpcServer.getTransaction(hash)` until `status !== 'NOT_FOUND'`
  - On `TRY_AGAIN_LATER`: wait `delayMs` and retry
  - On `FAILED`: throw with decoded error from `resultXdr`
  - On `SUCCESS`: return full transaction result
- [ ] Add `submitWithFeeBump(signedInnerXdr: string): Promise<string>` helper:
  - Deserialize inner TX from XDR
  - Apply fee-bump
  - Submit to RPC
  - Poll for confirmation
  - Return transaction hash

### 9.2 — `backend/src/routes/tx.ts`

- [ ] All submission paths must call `submitWithFeeBump()` — never submit a raw inner TX directly
- [ ] Log submitted TX hash and final status at INFO level
- [ ] On RPC failure (`EXCEPTION`), return `503` with retry guidance

### 9.3 — Acceptance Criteria

- All submitted transactions appear with a fee-bump outer TX on Stellar Expert
- Users with 0 XLM balance can still have transactions submitted (fees paid by issuer)
- `TRY_AGAIN_LATER` is retried up to 3 times before failing

---

## PHASE 10 — Cleanup & Hardening

### 10.1 — Error Normalization

- [ ] **`backend/src/errors.ts`** — extend `mapSorobanError()` to cover all known contract errors:
      | Contract Error Code | User Message |
      |---|---|
      | `#3` (fee bps too high) | "Invalid fee configuration" |
      | `#5` (zero amount) | "Amount must be greater than zero" |
      | `#7` (active loan exists) | "You already have an active loan" |
      | `#8` (no credit tier) | "No credit score found — generate a score first" |
      | `#9` (over limit) | "Amount exceeds your current tier limit" |
      | `#10` (insufficient liquidity) | "Insufficient pool liquidity" |
      | `#15` (loan defaulted) | "This loan has been defaulted and cannot be repaid" |
      | `#16` (loan overdue) | "This loan is overdue" |
      | `#18` (mark default on current loan) | "Loan is not yet overdue" |
- [ ] All contract errors must be intercepted in `errorHandler` middleware in `index.ts`
- [ ] Frontend `frontend/lib/errors.ts` must handle `422` shortfall error specifically in repay flow

### 10.2 — Default Detection (replace `cron.ts`)

- [ ] Remove `cron.ts` entirely (DB-dependent)
- [ ] Add `GET /api/admin/check-defaults` (issuer-auth only):
  - Reads a list of wallets with active loans from a config file or environment (or from Horizon payment operations to the lending pool address)
  - Calls `getLoanFromChain()` for each
  - Calls `markLoanDefaulted()` for any overdue, non-defaulted loans
  - Protected by `ISSUER_SECRET_KEY` header validation
- [ ] Alternative: Trigger default check via webhook from Stellar horizon stream (stretch goal)

### 10.3 — Logging

- [ ] Add structured logging middleware: `express-winston` or equivalent
- [ ] Log format: `{ timestamp, method, path, statusCode, durationMs, wallet }`
- [ ] Log contract TX hashes at INFO level when submitted
- [ ] Never log JWT tokens or private keys

### 10.4 — Config Validation

- [ ] **`backend/src/config.ts`** — validate all required env vars on startup:
  - `JWT_SECRET`, `ISSUER_SECRET_KEY`, `REGISTRY_ID`, `LENDING_POOL_ID`, `PHPC_ID`, `SOROBAN_RPC_URL`
  - Throw with descriptive error on startup if any are missing
  - Remove `ENCRYPTION_KEY` — no longer needed without DB
  - Remove `WEB_AUTH_SECRET_KEY` if consolidated into `ISSUER_SECRET_KEY`

### 10.5 — Acceptance Criteria

- All Soroban contract error codes produce user-readable messages
- Backend starts and fails fast with missing env vars
- No dead code, no DB references, no unused imports

---

## PHASE 11 — Testing

### 11.1 — Contract Tests (Rust, `cargo test`)

**`contracts/lending_pool/src/test.rs`** — add missing scenarios:

- [ ] `test_tier_zero_cannot_borrow` — wallet with no credit tier is rejected with `#8`
- [ ] `test_repay_updates_repayment_count_in_registry` — after `repay()`, `credit_registry.get_metrics(borrower).repayment_count` increments
- [ ] `test_pool_balance_increases_after_repay` — pool balance = initial + fee after repay
- [ ] `test_fee_calculation_correctness_per_tier` — parametric test for tiers 1/2/3
- [ ] `test_get_loan_returns_none_before_borrow` — cold wallet returns `None`

**`contracts/credit_registry/src/test.rs`** — add:

- [ ] `test_revoke_tier_removes_score` — already exists, confirm it also zeroes `get_metrics`
- [ ] `test_tier_boundaries` — score 39 → tier 0, score 40 → tier 1, score 79 → tier 1, score 80 → tier 2

### 11.2 — Backend Tests (Vitest)

**`backend/src/scoring/engine.test.ts`** — extend existing tests:

- [ ] Test `calculateScore` with `defaultCount > 0` returns score minus penalty
- [ ] Test `calculateScore` never returns negative (`max(0, score)`)
- [ ] Test `scoreToTier` boundary values: 39 → 0, 40 → 1, 80 → 2, 120 → 3
- [ ] Test `tierFeeBps` for all 4 tier values
- [ ] Add `buildScorePayload` test — confirms `borrowLimit` is formatted correctly from `tierLimit`

**New test file: `backend/src/routes/auth.test.ts`**:

- [ ] `POST /api/auth/challenge` — returns `{ challenge }` with no DB call
- [ ] `POST /api/auth/login` with valid signed challenge — returns `{ token, wallet }`
- [ ] `POST /api/auth/login` with invalid signature — returns `401`
- [ ] Decoded JWT contains `sub = walletPublicKey` and no `userId`

**New test file: `backend/src/stellar/query.test.ts`** (with mocked RPC):

- [ ] `getLoanFromChain` returns `null` for wallet with no loan
- [ ] `getLoanFromChain` returns correct `LoanState` struct for active loan
- [ ] `hasActiveLoan` returns `false` after repaid loan

### 11.3 — Frontend Integration Tests

**New test file: `frontend/lib/freighter.test.ts`**:

- [ ] `signTx` returns `{ signedXdr }` on success
- [ ] `signTx` returns `{ error: "..." }` on user rejection

**E2E Test (manual runbook, update `docs/TESTING.md`)**:

- [ ] Full flow: connect wallet → generate score → borrow → repay → score refresh
- [ ] Verify: PHPC balance changes after borrow and repay
- [ ] Verify: `credit_registry.get_metrics(wallet).repayment_count` increments after repay
- [ ] Verify: `lending_pool.get_loan(wallet)` shows `repaid: true` after repay

### 11.4 — Acceptance Criteria

- `cargo test --workspace` passes with zero failures
- `pnpm test` in `backend/` passes with zero failures
- E2E manual flow documented in `docs/TESTING.md` completes end-to-end on testnet

---

## Final Verification Checklist

Before marking the refactor complete, every item below must be true:

- [ ] `backend/` starts with no `.db` file present — zero errors
- [ ] No `import` of `db.ts`, `users.ts`, `loan-state.ts`, or `better-sqlite3` anywhere
- [ ] `GET /api/loan/status` reads from `lending_pool` contract
- [ ] `GET /api/credit/score` reads from `credit_registry` contract
- [ ] `POST /api/auth/login` issues stateless JWT — no DB write
- [ ] Every borrow/repay TX is fee-bumped before submission
- [ ] Frontend wallet session survives navigation without reconnect
- [ ] All contract error codes produce user-readable messages
- [ ] `cargo test --workspace` — all green
- [ ] `pnpm build` in `backend/` — zero TypeScript errors
- [ ] `pnpm build` in `frontend/` — zero TypeScript errors
- [ ] Live testnet E2E: connect → score → borrow → repay → score refresh ✅

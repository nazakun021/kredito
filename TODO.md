# TODO.md — Kredito

### SEA Stellar Hackathon · Track: Payments & Financial Access

### Version 2.0 | Last Updated: 2026-04-28

---

## Legend

```
[ ]  Not started
[~]  In progress
[x]  Done
🔴   Blocking — next phase cannot begin without this
🟡   Important — needed for demo day
🟢   Nice-to-have — polish only, do last
```

## Estimated Total Build Time: 44–52 hours

---

## Critical Path (Do Not Reorder)

```
Phase 0 (Setup) → Phase 1A (phpc_token) → Phase 1B (credit_registry)
→ Phase 1C (lending_pool) → Phase 1D (deploy + verify)
→ Phase 2 (backend) → Phase 3 (frontend)
→ Phase 4 (integration testing) → Phase 5 (demo prep) → Phase 6 (submission)
```

---

## Phase 0 — Environment Setup ⏱ ~2.5 hours

### 0.1 Rust + Soroban Toolchain 🔴

- [x] Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- [x] Add Wasm target: `rustup target add wasm32-unknown-unknown`
- [x] Install Stellar CLI: `cargo install --locked stellar-cli --features opt`
- [x] Verify install: `stellar --version` (expect 22.x or latest)
- [x] Install `wasm-opt` for optional final size reduction: `cargo install wasm-opt`

### 0.2 Node.js Toolchain 🔴

- [x] Confirm Node.js 20 LTS installed: `node --version`
- [x] Install pnpm: `npm install -g pnpm`
- [x] Confirm pnpm works: `pnpm --version`

### 0.3 Stellar Testnet Keypairs 🔴

- [x] Generate issuer keypair: `stellar keys generate issuer --network testnet`
- [x] Fund issuer from friendbot: `stellar keys fund issuer --network testnet`
- [x] Verify issuer funded: `stellar keys show issuer` — note public key
- [x] Save issuer secret somewhere safe (it goes in backend `.env`)

### 0.4 Monorepo Initialization 🔴

- [x] Create root folder: `mkdir kredito && cd kredito`
- [x] Initialize git: `git init`
- [x] Create folder structure:
  ```
  mkdir -p contracts/credit_registry/src
  mkdir -p contracts/lending_pool/src
  mkdir -p contracts/phpc_token/src
  mkdir -p backend/src
  mkdir -p frontend
  ```
- [x] Create `contracts/Cargo.toml` workspace file (see SPEC.md §4.3)
- [x] Create `.gitignore` (include: `target/`, `node_modules/`, `.env`, `*.db`, `deployed.json`)
- [x] Create root `README.md` placeholder

### 0.5 Frontend Scaffold 🔴

- [x] `cd frontend && pnpm create next-app@latest . -- --typescript --tailwind --app --no-src-dir`
- [x] Verify dev server starts: `pnpm dev`
- [x] Delete example files (`app/page.tsx` content, globals.css content)
- [x] Create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3001`

### 0.6 Backend Scaffold 🔴

- [x] `cd backend && pnpm init`
- [x] Install dependencies:
  ```
  pnpm add express @stellar/stellar-sdk better-sqlite3 jsonwebtoken \
           node-cron dotenv cors zod axios
  ```
- [x] Install dev dependencies:
  ```
  pnpm add -D typescript @types/express @types/node @types/better-sqlite3 \
            @types/jsonwebtoken nodemon ts-node
  ```
- [x] Create `backend/tsconfig.json` (target: ES2020, module: commonjs, strict: true)
- [x] Create `backend/.env` from SPEC.md §5.2 (fill in issuer secret after step 0.3)
- [x] Create `backend/src/index.ts` with bare Express app on port 3001

---

## Phase 1 — Smart Contracts (Rust / Soroban) ⏱ ~16 hours

> Build in order: phpc_token → credit_registry → lending_pool
> Each must pass all 5 tests before moving to the next contract.

### 1A. `phpc_token` Contract 🔴 ⏱ ~3.5 hours

#### Setup

- [x] Create `contracts/phpc_token/Cargo.toml` (see SPEC.md §4.4 template, name = "phpc_token")
- [x] Create `contracts/phpc_token/src/lib.rs`
- [x] Create `contracts/phpc_token/src/test.rs`
- [x] Add `mod test;` reference in `lib.rs`

#### Implementation (`lib.rs`)

- [x] Add `#![no_std]` at top of file
- [x] Import: `soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, token}`
- [x] Define `DataKey` enum: `Admin`, `Balance(Address)`, `Allowance(Address, Address)`
- [x] Implement `initialize(env, admin, decimal, name, symbol)` — panic if already set
- [x] Implement `mint(env, to, amount)` — require admin auth, credit balance, emit event
- [x] Implement full SEP-41 `TokenInterface` trait:
  - [x] `balance(env, id)` → read `Balance(id)` from storage
  - [x] `transfer(env, from, to, amount)` → require from auth, deduct/credit, emit
  - [x] `transfer_from(env, spender, from, to, amount)` → check/deduct allowance, require spender auth
  - [x] `approve(env, from, spender, amount, expiration_ledger)` → require from auth, store allowance
  - [x] `allowance(env, from, spender)` → read allowance, check expiration
  - [x] `burn(env, from, amount)` → require from auth, deduct balance
  - [x] `burn_from(env, spender, from, amount)` → check/deduct allowance, burn
  - [x] `decimals(env)` → return 7
  - [x] `name(env)` → return stored name
  - [x] `symbol(env)` → return stored symbol

#### Tests (`test.rs`)

- [x] `#[cfg(test)]` module with `use soroban_sdk::{testutils::Address as _, Env};`
- [x] Test 1: Happy path mint — mint 10,000 PHPC, assert balance == 100_000_000_000
- [x] Test 2: Transfer — mint to A, transfer to B, assert both balances correct
- [x] Test 3: Unauthorized mint — non-admin mint panics (use `should_panic`)
- [x] Test 4: Allowance + transfer_from — A approves B, B transfers from A to C, assert correct
- [x] Test 5: Double initialize — second `initialize()` call panics

#### Validation

- [x] `cd contracts && cargo test -p phpc_token` → all 5 pass, zero warnings
- [x] `stellar contract build` → `.wasm` exists in `target/wasm32-unknown-unknown/release/`
- [x] Note wasm size (should be < 100KB unoptimized)

---

### 1B. `credit_registry` Contract 🔴 ⏱ ~4 hours

#### Setup

- [x] Create `contracts/credit_registry/Cargo.toml` (name = "credit_registry")
- [x] Create `contracts/credit_registry/src/lib.rs`
- [x] Create `contracts/credit_registry/src/test.rs`

#### Implementation (`lib.rs`)

- [x] Add `#![no_std]`
- [x] Import: `soroban_sdk::{contract, contractimpl, contracttype, Address, Env, symbol_short}`
- [x] Define `DataKey` enum: `Issuer`, `Tier1Limit`, `Tier2Limit`, `CreditTier(Address)`, `TierTimestamp(Address)`
- [x] Implement `initialize(env, issuer, tier1_limit, tier2_limit)`:
  - [x] Panic if `Issuer` key already exists in storage
  - [x] Store issuer, tier1_limit, tier2_limit
- [x] Implement `set_tier(env, wallet, tier)`:
  - [x] Require issuer auth: `env.storage().instance().get::<_, Address>(&DataKey::Issuer).unwrap().require_auth()`
  - [x] Validate tier is 0–2, panic if not
  - [x] Store `CreditTier(wallet) = tier`
  - [x] Store `TierTimestamp(wallet) = env.ledger().timestamp()`
  - [x] Emit event: `env.events().publish(("tier_set", wallet.clone()), (tier, env.ledger().timestamp()))`
- [x] Implement `revoke_tier(env, wallet)`:
  - [x] Require issuer auth
  - [x] Set `CreditTier(wallet) = 0`
  - [x] Emit event: `("tier_revoked", wallet)`
- [x] Implement `get_tier(env, wallet)` → return stored tier or 0 if not found
- [x] Implement `get_tier_limit(env, tier)` → match on tier, return limit or 0
- [x] Implement `transfer(...)` → `panic!("SBT: non-transferable by design")`
- [x] Implement `transfer_from(...)` → `panic!("SBT: non-transferable by design")`

#### Tests (`test.rs`)

- [x] Test 1: Issuer sets tier 1, assert `get_tier(wallet) == 1`
- [x] Test 2: Non-issuer sets tier, assert auth panic
- [x] Test 3: Call `transfer()`, assert panic with correct message
- [x] Test 4: Set tier 2, revoke, assert `get_tier() == 0`
- [x] Test 5: `get_tier_limit(1)` returns exactly the value set in `initialize()`

#### Validation

- [x] `cargo test -p credit_registry` → all 5 pass
- [x] `stellar contract build` → `.wasm` produced

---

### 1C. `lending_pool` Contract 🔴 ⏱ ~7 hours

This is the most complex contract. Budget time accordingly.

#### Setup

- [x] Create `contracts/lending_pool/Cargo.toml` (name = "lending_pool")
- [x] Create `contracts/lending_pool/src/lib.rs`
- [x] Create `contracts/lending_pool/src/test.rs`

#### Implementation (`lib.rs`)

- [x] Add `#![no_std]`
- [x] Import: `soroban_sdk::{contract, contractimpl, contracttype, Address, Env, token}`
- [x] Define `DataKey` enum (see SPEC.md §4.7 storage layout)
- [x] Define `LoanRecord` struct with `#[contracttype]`: `principal, fee, due_ledger, repaid, defaulted`
- [x] Implement `initialize(env, admin, registry_id, phpc_token, flat_fee_bps, loan_term_ledgers)`:
  - [x] Panic if admin key already in storage
  - [x] Store all config fields
- [x] Implement `deposit(env, amount)`:
  - [x] Require admin auth
  - [x] Call `phpc_token::transfer_from(admin, contract_address, amount)` via `token::TokenClient`
  - [x] Increment stored pool_balance
- [x] Implement `borrow(env, borrower, amount)` — full logic from SPEC.md §4.7:
  - [x] Check for active loan (exists AND !repaid AND !defaulted) → panic
  - [x] Cross-contract call: `registry.get_tier(borrower)` → require >= 1
  - [x] Cross-contract call: `registry.get_tier_limit(tier)` → require amount <=
  - [x] Require amount <= pool_balance
  - [x] Require amount > 0
  - [x] Compute fee, due_ledger
  - [x] Store LoanRecord
  - [x] Decrement pool_balance
  - [x] Cross-contract call: `phpc_token.transfer(contract_address, borrower, amount)`
  - [x] Emit `loan_disbursed` event
- [x] Implement `repay(env, borrower)` — full logic from SPEC.md §4.7:
  - [x] Fetch loan, validate state (exists, !repaid, !defaulted, !overdue)
  - [x] Compute total_owed
  - [x] Cross-contract call: `phpc_token.transfer_from(borrower, contract_address, total_owed)`
  - [x] Mark repaid, increment pool_balance
  - [x] Emit `loan_repaid` event
- [x] Implement `mark_default(env, borrower)` — full logic from SPEC.md §4.7:
  - [x] Validate loan state (exists, !repaid, !defaulted, IS overdue)
  - [x] Mark defaulted
  - [x] Emit `loan_defaulted` event
- [x] Implement `get_loan(env, borrower)` → `Option<LoanRecord>`
- [x] Implement `get_pool_balance(env)` → `i128`

#### Cross-Contract Wiring in Tests

- [x] In `test.rs`, use `env.register(phpc_token::WASM, ())` pattern for the token contract
- [x] In `test.rs`, use `env.register(credit_registry::WASM, ())` pattern for registry
- [x] Call `env.mock_all_auths()` at start of each test

#### Tests (`test.rs`) — cross-contract tests, highest complexity

- [x] Test 1: Happy path borrow — Tier 1 SBT wallet borrows 5,000 PHPC, assert balances
- [x] Test 2: Happy path repay — borrow then approve + repay, assert loan.repaid == true, pool balance restored with fee
- [x] Test 3: No SBT rejection — Tier 0 wallet borrow panics with "No credit tier"
- [x] Test 4: Over-limit rejection — Tier 1 borrow > tier1_limit panics
- [x] Test 5: Double borrow rejection — active loan → second borrow panics

#### Validation

- [x] `cargo test -p lending_pool` → all 5 pass (this one is harder — expect 1–2 rounds of debugging)
- [x] `stellar contract build` → `.wasm` produced for all 3 contracts
- [x] Run `cargo test --workspace` → all 15 tests pass, zero warnings across all crates

---

### 1D. Testnet Deployment & Verification 🔴 ⏱ ~1.5 hours

- [x] Run full deployment script from SPEC.md §4.8
- [x] Verify phpc_token: call `symbol()` → returns "PHPC"
- [x] Verify credit_registry: call `get_tier(random_address)` → returns 0 (safe default)
- [x] Verify lending_pool: call `get_pool_balance()` → returns 1_000_000_000_000_000 (100M PHPC)
- [x] Manual smoke test — complete borrow cycle via CLI:

  ```
  # 1. Mint SBT to test wallet
  stellar contract invoke --id $REGISTRY_ID -- set_tier --wallet <TEST_WALLET> --tier 1

  # 2. Borrow 5000 PHPC
  stellar contract invoke --id $LENDING_POOL_ID -- borrow \
    --borrower <TEST_WALLET> --amount 50000000000

  # 3. Verify disbursement on Stellar Expert
  # 4. Verify SBT transfer fails
  stellar contract invoke --id $REGISTRY_ID -- transfer \
    --_from <TEST_WALLET> --_to <OTHER_WALLET> --_amount 1
  # Expected: panic
  ```

- [x] Save all deployed contract IDs to `contracts/deployed.json`
- [x] Commit `deployed.json` to repo (testnet IDs only — never commit secret keys)

---

## Phase 2 — Backend (Node.js) ⏱ ~13 hours

### 2A. Core Infrastructure 🔴 ⏱ ~2 hours

- [ ] Create `backend/src/db.ts` — initialize SQLite, run migrations, export `db` singleton
- [ ] Run migrations: create `users` and `score_events` tables (see SPEC.md §5.3)
- [ ] Create `backend/src/stellar/client.ts`:
  - [ ] Export configured `Horizon.Server` instance using `HORIZON_URL`
  - [ ] Export configured `SorobanRpc.Server` instance using `SOROBAN_RPC_URL`
  - [ ] Export `Keypair.fromSecret(ISSUER_SECRET_KEY)` as `issuerKeypair`
- [ ] Create `backend/src/middleware/auth.ts` — JWT verification middleware, attaches `req.userId` to request
- [ ] Create `backend/src/utils/crypto.ts` — `encryptKey(secret)` and `decryptKey(encrypted)` using AES-256-GCM
- [ ] Test encryption round-trip with a sample Stellar secret key

### 2B. Auth Module 🟡 ⏱ ~1.5 hours

- [ ] Create `backend/src/routes/auth.ts`
- [ ] Implement `POST /api/auth/login`:
  - [ ] Validate email with Zod (`.email()`)
  - [ ] Check if user exists in DB by email
  - [ ] If new user: `Keypair.random()`, encrypt secret, insert into `users` table
  - [ ] Generate JWT: `sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' })`
  - [ ] Return response per SPEC.md §5.4
- [ ] Mount router on `/api/auth` in `index.ts`
- [ ] Manual test: POST with email, verify new wallet generated and encrypted in DB

### 2C. Scoring Engine 🔴 ⏱ ~3 hours

- [ ] Create `backend/src/scoring/engine.ts`
- [ ] Implement `fetchAccountAge(address: string): Promise<number>`:
  - [ ] `horizon.accounts().accountId(address).call()`
  - [ ] Parse `created_at` field, compute days from now
  - [ ] Return 0 if account not found (new account path)
- [ ] Implement `fetchTxCount(address: string): Promise<number>`:
  - [ ] `horizon.transactions().forAccount(address).limit(200).call()`
  - [ ] Return `records.length` (cap at 200 for hackathon — full pagination as V2)
- [ ] Implement `fetchRepaymentHistory(address: string): Promise<{ onTime: number, defaults: number }>`:
  - [ ] Query Soroban RPC for events on `lending_pool` contract with topic `["loan_repaid", address]`
  - [ ] Query for events with topic `["loan_defaulted", address]`
  - [ ] Return counts
- [ ] Implement `computeScore(age, txCount, repayments, defaults)`:
  - [ ] Apply full scoring formula from SPEC.md §5.5
  - [ ] Return `{ score, tier, breakdown }` object
- [ ] Implement `assignTier(score: number): 0 | 1 | 2`
- [ ] Write unit tests for `computeScore` (at least 3 test cases covering tier boundaries)

### 2D. SBT Issuer Service 🔴 ⏱ ~2 hours

- [ ] Create `backend/src/stellar/issuer.ts`
- [ ] Implement `getCurrentOnChainTier(walletAddress: string): Promise<number>`:
  - [ ] Call `credit_registry::get_tier(address)` via Soroban RPC
  - [ ] Parse return value (scval → u32)
  - [ ] Return 0 if call fails (wallet never scored)
- [ ] Implement `mintOrUpdateTier(walletAddress: string, tier: number): Promise<string>`:
  - [ ] Build `set_tier()` invocation using `stellar-sdk` `Contract` and `xdr.ScVal`
  - [ ] Sign with issuer keypair (no fee-bump needed for issuer's own calls)
  - [ ] Submit and poll for confirmation
  - [ ] Return tx hash

### 2E. Fee-Bump Transaction Service 🔴 ⏱ ~2 hours

- [ ] Create `backend/src/stellar/feebump.ts`
- [ ] Implement `buildAndSubmitFeeBump(userSecret: string, contractId: string, functionName: string, args: xdr.ScVal[]): Promise<string>`:
  - [ ] Build inner transaction from user keypair
  - [ ] Wrap in fee-bump from issuer keypair
  - [ ] Submit to Soroban RPC `sendTransaction`
  - [ ] Poll `getTransaction` every 1s up to 30s
  - [ ] On success: return tx hash
  - [ ] On failure: parse diagnostic events for error, return user-readable message
- [ ] Test with a real fee-bump on testnet using the issuer keypair

### 2F. Credit Score API Route 🟡 ⏱ ~1 hour

- [ ] Create `backend/src/routes/credit.ts`
- [ ] Implement `GET /api/credit/score` (auth middleware applied):
  - [ ] Load user from DB by `req.userId`
  - [ ] Run scoring engine for `user.stellar_pub`
  - [ ] Get current on-chain tier from registry
  - [ ] If new tier != on-chain tier: call `mintOrUpdateTier()`
  - [ ] Insert row into `score_events`
  - [ ] Return response per SPEC.md §5.4
- [ ] Mount on `/api/credit`

### 2G. Loan API Routes 🔴 ⏱ ~2 hours

- [ ] Create `backend/src/routes/loan.ts`
- [ ] Implement `POST /api/loan/borrow` (auth middleware):
  - [ ] Validate `amount` with Zod (positive number, within tier limit)
  - [ ] Decrypt user secret key (AES-256-GCM)
  - [ ] Convert amount to stroops: `BigInt(amount) * BigInt(10_000_000)`
  - [ ] Call `feebump.buildAndSubmitFeeBump()` targeting `lending_pool::borrow`
  - [ ] Zeroize decrypted key from memory after use
  - [ ] Return response per SPEC.md §5.4
- [ ] Implement `POST /api/loan/repay` (auth middleware):
  - [ ] Get current loan from contract to compute `total_owed`
  - [ ] Decrypt user secret
  - [ ] Submit `phpc_token::approve(pool, total_owed)` fee-bump
  - [ ] Submit `lending_pool::repay(borrower)` fee-bump
  - [ ] Return response
- [ ] Implement `GET /api/loan/status` (auth middleware):
  - [ ] Call `lending_pool::get_loan(address)` via Soroban RPC
  - [ ] Parse `Option<LoanRecord>` from scval
  - [ ] Compute due date from `due_ledger` (current ledger + ledger time estimate)
  - [ ] Return status response per SPEC.md §5.4
- [ ] Mount on `/api/loan`

### 2H. Default Monitor (Cron) 🟡 ⏱ ~1 hour

- [ ] Create `backend/src/cron/defaultMonitor.ts`
- [ ] Schedule with `node-cron`: `'0 */6 * * *'` (every 6 hours)
- [ ] Logic:
  - [ ] Query all `users` from DB
  - [ ] For each user: call `lending_pool::get_loan(address)`
  - [ ] If loan exists, !repaid, !defaulted, and `due_ledger < current_ledger`:
    - [ ] Call `lending_pool::mark_default(borrower)` via issuer keypair
    - [ ] Call `credit_registry::revoke_tier(borrower)` via issuer keypair
    - [ ] Insert `score_events` row with tier=0
- [ ] Import cron in `index.ts`

### 2I. Backend Validation 🔴

- [ ] Start backend: `pnpm dev`
- [ ] Test all 5 endpoints manually with curl or Postman
- [ ] Full cycle test: login → score (SBT minted) → borrow → status → repay → status
- [ ] Verify fee-bump works (issuer pays, user wallet has no XLM)
- [ ] Verify encrypted key never appears in any log output

---

## Phase 3 — Frontend (Next.js 14) ⏱ ~11 hours

### 3A. App Infrastructure 🔴 ⏱ ~1.5 hours

- [ ] Install dependencies: `pnpm add zustand @tanstack/react-query@5 lucide-react axios`
- [ ] Create `frontend/lib/api.ts` — Axios instance with base URL + JWT interceptor (reads from Zustand)
- [ ] Create `frontend/store/auth.ts` — Zustand store: `{ token, user, setAuth, clearAuth }`
- [ ] Create `frontend/app/providers.tsx` — `QueryClientProvider` + Zustand provider wrapper
- [ ] Update `frontend/app/layout.tsx` to use `Providers`
- [ ] Create `frontend/middleware.ts` — redirect unauthenticated requests to `/login`

### 3B. Login Page 🔴 ⏱ ~1 hour

- [ ] Create `frontend/app/login/page.tsx`
- [ ] Email input: `type="email"`, `inputmode="email"`, `autocomplete="email"`
- [ ] Submit handler: call `api.post('/auth/login')`, store JWT + user in Zustand, push to `/dashboard`
- [ ] Loading state: button disabled, spinner icon
- [ ] Error state: inline error message below input
- [ ] Test: new email creates account; existing email logs in

### 3C. Dashboard Page 🔴 ⏱ ~3 hours

- [ ] Create `frontend/app/dashboard/page.tsx`
- [ ] Create `frontend/components/CreditCard.tsx`:
  - [ ] Accept `{ tier, score, tierLabel, borrowLimit }` props
  - [ ] Tier badge with correct color: `tier === 0 ? 'grey' : tier === 1 ? 'green' : 'gold'`
  - [ ] Large score number, tier label, borrow limit
  - [ ] Skeleton loader while `GET /api/credit/score` is in flight (TanStack Query)
  - [ ] "See Breakdown →" link to `/score`
- [ ] Create `frontend/components/LoanStatus.tsx`:
  - [ ] Accept `{ status, loan }` props
  - [ ] Render correct state: none / active / overdue / defaulted / repaid (see SPEC.md §6.3)
  - [ ] Borrow and Repay CTA buttons with router navigation
- [ ] Create `frontend/components/WalletInfo.tsx`:
  - [ ] Collapsed by default, tap to expand
  - [ ] Truncated address + Stellar Expert link
- [ ] Wire `useQuery` for both `GET /api/credit/score` and `GET /api/loan/status` on mount
- [ ] Loading and error boundary states for whole page

### 3D. Score Breakdown Page 🟡 ⏱ ~1.5 hours

- [ ] Create `frontend/app/score/page.tsx`
- [ ] Three factor cards from `GET /api/credit/score` breakdown data:
  - [ ] Factor name, points earned, max points, detail string
  - [ ] Animated Tailwind progress bar (CSS transition on mount)
- [ ] Total score animated fill bar
- [ ] Three-question FAQ accordion:
  - [ ] "Where does my score come from?" — explain Horizon API data sources (plain language)
  - [ ] "How do I improve my score?" — explain tier upgrade mechanism
  - [ ] "Is my data private?" — explain embedded wallet model

### 3E. Borrow Page 🔴 ⏱ ~1.5 hours

- [ ] Create `frontend/app/loan/borrow/page.tsx`
- [ ] Read `borrowLimit` from score data to display in summary card
- [ ] Show: loan amount / fee / total owed / due date
- [ ] "I understand the repayment terms" checkbox — `Confirm Borrow` button disabled until checked
- [ ] On confirm: `POST /api/loan/borrow` → loading state → success or error
- [ ] Success: tx hash (copy button) + Stellar Expert deep link
- [ ] Error: user-readable message (map API error strings to friendly text)

### 3F. Repay Page 🔴 ⏱ ~1 hour

- [ ] Create `frontend/app/loan/repay/page.tsx`
- [ ] Read loan details from `GET /api/loan/status`
- [ ] Show: principal / fee / total / due date / days remaining (positive=green, negative=red OVERDUE)
- [ ] On confirm: `POST /api/loan/repay` → loading → success or error
- [ ] Success: "Loan fully repaid ✓" + tx hash + "Your score may have improved!" callout

### 3G. UI Polish 🟢 ⏱ ~1.5 hours

- [ ] Mobile max-width constraint: `mx-auto max-w-[390px]` on root layout container
- [ ] Skeleton loaders on all data-dependent cards (prevents layout shift)
- [ ] Toast notification system for success/error feedback (or inline — pick one, be consistent)
- [ ] All amounts formatted as `₱X,XXX.XX` — create `formatPHP(amount: number): string` utility
- [ ] Zero crypto jargon audit: search codebase for "PHPC", "ledger", "Soroban", "keypair" — remove from any user-visible string
- [ ] Loading spinners on all buttons during async operations
- [ ] "Try again" button on network error states (not an empty broken screen)

---

## Phase 4 — Integration & End-to-End Testing ⏱ ~5 hours

### 4A. Contract Layer ✓ (completed in Phase 1D)

### 4B. Backend E2E on Testnet 🔴 ⏱ ~2 hours

- [ ] Full happy path: login → score (SBT minted) → borrow → status → repay → status
- [ ] Verify each step on Stellar Expert:
  - [ ] SBT minted + non-transferable
  - [ ] PHPC disbursed to user wallet
  - [ ] Repayment pulled from user wallet to pool
- [ ] Tier 0 wallet: attempt borrow → confirm 400 error returned
- [ ] Over-limit borrow: attempt borrow > tier limit → confirm 400 error
- [ ] Double borrow: borrow then immediately borrow again → confirm 400 error

### 4C. Frontend E2E 🟡 ⏱ ~2 hours

- [ ] Full flow on mobile viewport (390px wide Chrome DevTools):
  - [ ] Login → dashboard → score page → borrow → verify tx hash works → repay → verify repaid state
- [ ] Test on actual mobile device (iOS Safari + Android Chrome)
- [ ] All error states visible and readable on mobile
- [ ] All touch targets usable with finger (not just mouse)

### 4D. Edge Cases 🟡 ⏱ ~1 hour

- [ ] Backend + frontend handles Horizon returning 404 for brand new wallet (scoring gracefully returns 0)
- [ ] Backend handles Soroban RPC timeout (30s poll) gracefully — returns error to frontend
- [ ] Frontend handles JWT expiry — redirects to login cleanly
- [ ] Loan status correctly shows OVERDUE state when `daysRemaining < 0`

---

## Phase 5 — Demo Preparation ⏱ ~4 hours

### 5A. Demo Environment Setup 🔴 ⏱ ~1.5 hours

- [ ] Create dedicated demo user account: email `demo@kredito.app`
- [ ] Ensure demo wallet is >45 days old and has >38 testnet transactions
  - If testnet wallet is too new: create transactions via the Stellar friendbot + manual transfers to age it
- [ ] Verify scoring computes to score 55–65 (Tier 1) for the demo wallet — adjust test transactions if needed
- [ ] Confirm pool balance: `get_pool_balance()` shows at least 1,000,000 PHPC available
- [ ] Deploy frontend to Vercel production URL
- [ ] Deploy backend to Railway production URL
- [ ] Confirm production `.env` has all correct contract IDs pointing to testnet deployed contracts
- [ ] Test full demo flow end-to-end on production deployment (not localhost)

### 5B. Demo Rehearsal 🔴 ⏱ ~1.5 hours

- [ ] Run the 60-second demo script from SPEC.md §8 three times consecutively
- [ ] Target: under 65 seconds consistently (5-second buffer for network latency)
- [ ] Practice narration while clicking — no dead air
- [ ] Prepare the exact 3 browser tabs to have open before demo begins:
  - Tab 1: Kredito app at `/dashboard`
  - Tab 2: Stellar Expert on demo wallet address
  - Tab 3: Stellar Expert on lending pool contract (shows PHPC holdings)

### 5C. Backup Preparation 🟡 ⏱ ~1 hour

- [ ] Screenshot: dashboard showing score 62/100 + Tier 1
- [ ] Screenshot: score breakdown page with 3 factors
- [ ] Screenshot: Stellar Expert showing SBT + non-transferability
- [ ] Screenshot: PHPC disbursement transaction
- [ ] Screen recording: full demo flow (60 seconds) as `.mp4`
- [ ] Save all screenshots to `demo/backups/` folder in repo
- [ ] Have backup plan if testnet is slow: show pre-recorded video + narrate live

---

## Phase 6 — Documentation & Submission ⏱ ~2 hours

### 6A. Repository Cleanup 🟡

- [ ] Confirm `contracts/deployed.json` is committed (testnet contract IDs only)
- [ ] Confirm `.env` files are NOT committed (`.gitignore` check)
- [ ] Remove all `TODO:` and `FIXME:` comments from production code
- [ ] Remove `console.log` debug statements from backend production code
- [ ] Ensure `cargo test --workspace` passes clean on a fresh `git clone`
- [ ] Ensure `pnpm build` passes for frontend with zero type errors
- [ ] Ensure `pnpm build` passes for backend (if using TypeScript compilation)

### 6B. README.md 🟡

- [ ] Project name + one-line description
- [ ] Problem statement (2 sentences)
- [ ] Solution (2 sentences)
- [ ] Live demo URL (Vercel link)
- [ ] Demo video link (Loom or YouTube)
- [ ] Architecture diagram (ASCII from SPEC.md §3)
- [ ] Deployed contract addresses (testnet)
- [ ] Local setup instructions:
  - Prerequisites: Rust, Node.js 20, Stellar CLI
  - `git clone`, `cd kredito/contracts && cargo test --workspace`
  - `cd backend && pnpm install && pnpm dev`
  - `cd frontend && pnpm install && pnpm dev`
- [ ] Tech stack table
- [ ] Track and hackathon name
- [ ] MIT License section

---

## Backlog / Stretch Goals 🟢

_Do NOT touch these until Phase 5 is complete. These are bonus points only._

- [ ] Multi-tier credit upgrade: on-time repayment automatically upgrades tier via backend cron
- [ ] Freighter wallet integration: non-custodial path alongside embedded wallet
- [ ] Real PHP anchor integration: Tempo SEA or PDAX on testnet (if available)
- [ ] Loan amount slider: let user choose any amount within tier limit
- [ ] SMS repayment reminders: Twilio + due-date cron
- [ ] Admin dashboard: pool health, total disbursed, default rate
- [ ] Multi-currency support: IDR and VND via respective anchors
- [ ] OpenGraph / social share card for demo link

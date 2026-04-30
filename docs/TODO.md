# Kredito — TODO.md

> Implementation status updated on 2026-04-30.
> The items below have now been addressed in the repository unless noted otherwise.

> Comprehensive fix list derived from a full audit of `contracts/`, `backend/`, and `frontend/`.
> This document now serves as the audit changelog for the fixes that were implemented.

---

## P0 — CRITICAL (App-Breaking Bugs)

These prevent the core borrow/repay flow from ever completing.

---

### [P0-1] WRONG API ROUTE: Frontend calls `/loan/sign-and-submit` but route is at `/tx/sign-and-submit`

**Impact:** Every Freighter borrow and repay transaction fails with HTTP 404. The app is completely broken for external wallets.

**Root cause:**

- `backend/src/routes/tx.ts` exports `router.post('/sign-and-submit', ...)`.
- `backend/src/index.ts` mounts it as `app.use('/api/tx', txRoutes)` → full path: `/api/tx/sign-and-submit`.
- Frontend `api.ts` has `baseURL = .../api/`, so `api.post('/loan/sign-and-submit', ...)` resolves to `/api/loan/sign-and-submit` — which **does not exist** in `loanRoutes`.

**Files to fix:**

```
frontend/app/loan/borrow/page.tsx   — line ~7150
frontend/app/loan/repay/page.tsx    — lines ~7852, ~7867, ~7880
```

**Fix:** Replace all occurrences of:

```ts
api.post('/loan/sign-and-submit', { ... })
```

with:

```ts
api.post('/tx/sign-and-submit', { ... })
```

There are **4 call sites** across the two pages; all must be updated.

---

### [P0-2] FRONTEND API TIMEOUT TOO SHORT FOR ON-CHAIN CONFIRMATION

**Impact:** Even after fixing P0-1, transactions may appear to time out from the frontend's perspective. The backend `pollTransaction()` in `feebump.ts` loops for up to **60 seconds** waiting for Soroban confirmation. The frontend Axios instance has a `timeout: 15000` (15 s). The frontend disconnects before the backend finishes, showing a phantom error while the transaction may have actually succeeded on-chain.

**File to fix:** `frontend/lib/api.ts`

**Fix:**

```ts
// Before
const api = axios.create({ baseURL: ..., timeout: 15000 });

// After
const api = axios.create({ baseURL: ..., timeout: 90000 }); // 90 s covers 60 s poll + buffer
```

---

### [P0-3] CONTENT SECURITY POLICY BLOCKS ALL API CALLS IN PRODUCTION

**Impact:** When the frontend is deployed to Vercel (or any CDN) and the backend is on a separate domain, **every API call is blocked** by the browser's CSP enforcement. The `connect-src` directive only allows `'self'` and Stellar infrastructure — the backend URL is absent.

**File to fix:** `frontend/next.config.ts`

**Current CSP:**

```
connect-src 'self' https://*.stellar.org https://stellar.expert
```

**Fix:** Inject the backend URL at build time and add it to `connect-src`:

```ts
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const apiOrigin = new URL(apiUrl).origin;

// In the CSP header value:
`connect-src 'self' ${apiOrigin} https://*.stellar.org https://stellar.expert https://friendbot.stellar.org`;
```

---

## P1 — HIGH (Incorrect Behavior, Data Integrity)

---

### [P1-1] `avgBalance` METRIC IS XLM NATIVE BALANCE, LABELED AS "PHPC"

**Impact:** The dashboard "Avg balance" card displays `X PHPC` but the value is the wallet's XLM (native Lumens) balance in whole units. This misleads users about what drives their score.

**Root cause:** `backend/src/scoring/engine.ts` → `fetchAverageBalance()` reads `asset_type === 'native'` (XLM) from Horizon, not the PHPC token balance.

**Files to fix:**

- `frontend/app/dashboard/page.tsx` — Change the label from `"PHPC"` to `"XLM"` in the avg balance metric card.
- `backend/src/scoring/engine.ts` — Add a JSDoc comment to `fetchAverageBalance` clarifying it returns XLM stroops/whole-units, and rename the returned property if desirable.

**Longer-term fix (see SPEC):** Replace XLM balance with PHPC balance as the `avgBalance` metric to make the scoring more meaningful for the micro-lending context.

---

### [P1-2] BORROW SUCCESS DATA SHOWS BACKEND-ESTIMATED VALUES UNTIL SIGN-AND-SUBMIT COMPLETES

**Impact (minor but confusing):** The `BorrowSuccess` state is set from `result.data` which comes from `/tx/sign-and-submit`. This is correct. But if sign-and-submit fails, the error message may reference the fee from the pre-computation (which is a float division of the borrow limit), not the contract-confirmed fee.

**Files:** `frontend/app/loan/borrow/page.tsx`

**Fix:** Ensure all fee/amount values displayed in the success state come from the `/tx/sign-and-submit` response (which reads from `getLoanRecord` post-confirmation), not from the initial `/loan/borrow` pre-computation.

---

### [P1-3] `active_loans` DB TABLE NOT POPULATED FOR EXTERNAL (FREIGHTER) USERS BEFORE SIGN-AND-SUBMIT

**Impact:** The cron job (`backend/src/cron.ts`) monitors `active_loans` for overdue detection. For Freighter users, `active_loans` is only inserted inside `/tx/sign-and-submit` (when `flow.action === 'borrow'`). Due to P0-1 (wrong route path), this insert was never reached. After fixing P0-1, verify the insert runs correctly.

**Files:**

- `backend/src/routes/tx.ts` — After fix, confirm the `INSERT INTO active_loans` block executes for `flow.action === 'borrow'`.
- `backend/src/cron.ts` — Add a fallback reconciliation pass on startup (not just scheduled) to catch any loans that exist on-chain but are missing from `active_loans`.

---

### [P1-4] HARDCODED 6-SECOND DELAY BEFORE SCORE REFRESH IS FRAGILE

**Impact:** After repayment, the backend waits `await new Promise((resolve) => setTimeout(resolve, 6000))` before calling `buildScoreSummary`. This is meant to let the on-chain state settle, but Stellar testnet block times vary. If a ledger closes slowly, the score refresh reads stale state and the on-chain metric update writes stale metrics.

**Files:**

- `backend/src/routes/tx.ts` — `sign-and-submit` repay flow.
- `backend/src/routes/loan.ts` — Internal wallet repay flow.

**Fix:** Instead of a raw sleep, re-query `get_loan` in a retry loop until `loan.repaid === true` (or up to 3 retries with 3-second gaps). Only then call `buildScoreSummary`.

---

### [P1-5] SESSION EXPIRY REDIRECT HAS NO UI FEEDBACK

**Impact:** When a JWT expires, `api.ts` interceptor redirects to `/?session=expired`. The homepage has no code to read this query parameter and show feedback. Users see the login page with no explanation.

**Files:**

- `frontend/app/page.tsx` — Add a `useSearchParams()` hook to detect `?session=expired` and show a Sonner toast on mount.

---

## P2 — MEDIUM (UX Deficiencies, Minor Logic Errors)

---

### [P2-1] SCORE ARC `maxScore` IS 850 — ACTUAL MAX IS ~200

The `ScoreArc` SVG component in `dashboard/page.tsx` uses `const maxScore = 850`, making even a Gold-tier user's arc look nearly empty. A wallet with 10 txs, 5 repayments, 1000 XLM balance, no defaults scores: `(10×2) + (5×10) + (10×5) = 120`. The visual arc should be calibrated to ~200 for a full arc.

**Fix:** `const maxScore = 200;` (or make it configurable from backend response).

---

### [P2-2] `StepBreadcrumb` ON REPAY PAGE SHOWS `step={4}` BEFORE REPAYMENT HAPPENS

The repay page renders `<StepBreadcrumb step={4} total={4} />` in the active-loan view (before repaying), which looks like the flow is already complete. The breadcrumb should reflect the current action step, not the post-success state.

**Fix:** `frontend/app/loan/repay/page.tsx` — Show `step={3}` or `step={txStep}` dynamically during the pre-repayment view.

---

### [P2-3] NO PHPC BALANCE CHECK BEFORE BORROWING

Users borrow PHPC and then must hold `principal + fee` to repay. The UI already shows a shortfall warning on the repay page, but it would be better UX to warn the user at borrow time: "After borrowing, you will need to top up P{fee} PHPC before repaying."

**Files:** `frontend/app/loan/borrow/page.tsx` — Add an informational callout in the review step.

---

### [P2-4] USERS CANNOT CHOOSE A CUSTOM BORROW AMOUNT

The borrow page always submits the user's full `borrowLimit` with no input field. Users may want to borrow less.

**Fix:** Add an amount input (number field, constrained to `0 < amount ≤ borrowLimit`) to the borrow review step and pass it to `api.post('/loan/borrow', { amount: customAmount })`.

---

### [P2-5] DEAD DEPENDENCIES IN BACKEND

`backend/package.json` includes:

- `resend` — Email sending package. No actual email send calls exist in the current codebase (all Freighter users get synthetic emails).
- `bcrypt` — Password hashing. No password auth exists (only wallet-signed SEP-10 auth).

These add build weight and attack surface for no benefit.

**Fix:** Remove from `dependencies` in `backend/package.json` and delete associated `@types` packages.

---

### [P2-6] `loadUser()` RETURNS `any` IN ALL BACKEND ROUTES

All four route files (`auth.ts`, `credit.ts`, `loan.ts`, `tx.ts`) call `loadUser()` and use the result as `any`, bypassing TypeScript's type system. A missing column in the DB schema would silently produce `undefined` values at runtime.

**Fix:** Define a `DbUser` interface and cast the result:

```ts
interface DbUser {
  id: number;
  stellar_pub: string;
  stellar_enc_secret: string | null;
  is_external: number; // SQLite booleans are integers
}
```

---

### [P2-7] NO IDEMPOTENCY ON BORROW ENDPOINT

A rapid double-click on the "Borrow" button in the UI could fire two concurrent POST `/loan/borrow` requests. Both read `currentLoan` before either write completes, potentially causing duplicate contract invocations.

**Fix (frontend):** Disable the borrow button after the first click (already done via `loading` state, but confirm the button is truly disabled during the entire flow).

**Fix (backend):** Consider a DB-level advisory lock or a short-lived in-memory Set tracking in-flight borrow pubkeys.

---

## P3 — LOW (Contracts / Architecture / Long-term)

---

### [P3-1] `lending_pool` HAS NO `get_flat_fee_bps()` PUBLIC FUNCTION

The deployed contract's fee schedule (`flat_fee_bps = 500`, with tier reductions) is opaque to the backend. The backend hardcodes `tierFeeBps()` values that currently happen to match but could drift after a redeploy with different parameters.

**Fix (contract):** Add `pub fn get_flat_fee_bps(env: Env) -> u32` to `LendingPool`. The backend should call this once at startup to verify the fee schedule matches expectations.

---

### [P3-2] NO TTL BUMP FOR SOROBAN PERSISTENT/INSTANCE STORAGE ENTRIES

Soroban `persistent` and `instance` storage entries expire after their TTL. High-value entries like `CreditTier`, `Metrics`, `Score`, `Loan`, and `PoolBalance` should have their TTL extended on every read/write.

**Fix (contract):** In `store_credit_state`, `borrow`, `repay`, and `deposit`, add:

```rust
env.storage().persistent().extend_ttl(&key, MIN_TTL, MAX_TTL);
env.storage().instance().extend_ttl(MIN_TTL, MAX_TTL);
```

Where `MIN_TTL` and `MAX_TTL` are constants (e.g., 100_000 and 200_000 ledgers).

---

### [P3-3] NO ADMIN WITHDRAWAL FROM LENDING POOL

There is no `withdraw` or `emergency_drain` function in `lending_pool`. Pool funds are locked unless a new contract is deployed. This is a liveness risk if the contract encounters a bug.

**Fix (contract):** Add an `admin_withdraw(env, amount)` function guarded by `admin.require_auth()`.

---

### [P3-4] `phpc_token` IS NOT FULLY SEP-41 COMPLIANT

The PHPC token is missing:

- `total_supply()` — standard token interface function
- `authorized()` / `set_authorized()` — for clawback/freeze support

These aren't required for the current demo but are needed for exchange listings and ecosystem integrations.

---

### [P3-5] CREDIT REGISTRY HAS NO TIER EXPIRY MECHANISM

A wallet that was active and earned Gold tier will hold that tier indefinitely, even after years of inactivity. For a real credit product, tiers should expire or degrade.

**Fix (contract):** Add a `TierExpiry(Address)` data key storing a ledger number after which the tier is considered stale. Expose `is_tier_current(env, wallet) -> bool` function.

---

### [P3-6] SCORING ENGINE USES HORIZON TRANSACTION COUNT (CAPPED AT 1000)

`fetchTxCount` in `engine.ts` caps at 1000 transactions. Highly active wallets all look the same beyond 1000 txs. The cap truncates the upper range of the score, preventing score differentiation for power users.

---

### [P3-7] FREIGHTER `getConnectedAddress` TRIGGERS PERMISSION POP-UP

`freighter.ts` `getConnectedAddress()` calls `requestAccess()` which may trigger a Freighter pop-up even during silent session restoration. This creates a jarring UX on page reload.

**Fix:** Use `getAddress()` from the Freighter API if available (silently reads the connected address without requesting new permission). Fall back to `requestAccess()` only if `getAddress()` fails.

---

### [P3-8] DEPLOY SCRIPTS USE HARDCODED ISSUER PUBLIC KEY

`contracts/deploy.sh` and `contracts/redeploy.sh` hardcode `ISSUER_PUB="GBGKIBN3..."`. If the issuer keypair rotates, the scripts will fail silently or deploy with the wrong admin.

**Fix:** Derive `ISSUER_PUB` from `ISSUER_SECRET_KEY` using `stellar keys show issuer --network testnet` at the top of both scripts.

---

## Checklist Summary

| ID   | Layer              | Status         | Priority |
| ---- | ------------------ | -------------- | -------- |
| P0-1 | Frontend + Backend | ✅ Implemented | P0       |
| P0-2 | Frontend           | ✅ Implemented | P0       |
| P0-3 | Frontend           | ✅ Implemented | P0       |
| P1-1 | Backend + Frontend | ✅ Implemented | P1       |
| P1-2 | Frontend           | ✅ Implemented | P1       |
| P1-3 | Backend            | ✅ Implemented | P1       |
| P1-4 | Backend            | ✅ Implemented | P1       |
| P1-5 | Frontend           | ✅ Implemented | P1       |
| P2-1 | Frontend           | ✅ Implemented | P2       |
| P2-2 | Frontend           | ✅ Implemented | P2       |
| P2-3 | Frontend           | ✅ Implemented | P2       |
| P2-4 | Frontend           | ✅ Implemented | P2       |
| P2-5 | Backend            | ✅ Implemented | P2       |
| P2-6 | Backend            | ✅ Implemented | P2       |
| P2-7 | Backend + Frontend | ✅ Implemented | P2       |
| P3-1 | Contract           | ✅ Implemented | P3       |
| P3-2 | Contract           | ✅ Implemented | P3       |
| P3-3 | Contract           | ✅ Implemented | P3       |
| P3-4 | Contract           | ✅ Implemented | P3       |
| P3-5 | Contract           | ✅ Implemented | P3       |
| P3-6 | Backend            | ✅ Implemented | P3       |
| P3-7 | Frontend           | ✅ Implemented | P3       |
| P3-8 | DevOps             | ✅ Implemented | P3       |

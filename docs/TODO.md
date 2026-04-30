# Kredito — Production TODO

> **Status:** Testnet Demo → Production-Ready hardening pass  
> **Stack:** Next.js 16 · Express · Soroban (Rust) · SQLite · Freighter / SEP-10  
> **Contracts (Testnet):** credit_registry · lending_pool · phpc_token

Items are grouped by severity and layer. Each has a concrete fix description.

---

## 🔴 CRITICAL — Fix Before Any Production Use

### [x] C-1 · Gold-tier fee mismatch between backend and contract

**Fix:** Updated `tierFeeBps()` in `engine.ts` to return `150` for tier 3.

---

### [x] C-2 · Hardcoded `expiration_ledger = 4_000_000` on approve transaction

**Fix:** Made `expiration_ledger` dynamic using `rpcServer.getLatestLedger()`.

---

### [x] C-3 · `invokeIssuerContract` returns before on-chain confirmation

**Fix:** Awaited `pollTransaction` in `invokeIssuerContract()` and `markLoanDefaulted()`.

---

### [x] C-4 · Double Freighter popup on landing-page login

**Fix:** Removed the separate `walletStore.connect()` call in `connectWallet()`.

---

### [x] C-5 · Recursive interceptor pattern in `api.ts` for approve → repay

**Fix:** Replaced the interceptor with explicit two-step helpers in the Borrow and Repay pages.

---

## 🟠 HIGH — Integration & Logic Bugs

### [x] H-1 · Due date in borrow success is a fake client-side timestamp

**Fix:** Returned actual contract due dates from the backend.

---

### [x] H-2 · Score-refresh race condition after repayment

**Fix:** Added a 6s backoff before the score refresh.

---

### [x] H-3 · `txStep` progress driven by `setTimeout` instead of actual pipeline

**Fix:** Drove `txStep` from actual pipeline events.

---

### [x] H-4 · `clearAuth()` on 401 does not disconnect wallet store

**Fix:** Added `disconnectWallet()` on 401 errors.

---

### [x] H-5 · `signAndSubmitWithFreighter` uses `Promise.all` for sequential transactions

**Fix:** Replaced parallel signing with sequential iteration in the frontend.

---

### [x] H-6 · Cron default-monitor may miss loans for external wallets

**Fix:** Added Loan Reconciliation cron job.

---

## 🟡 MEDIUM — Hardening & Pipeline

### [x] M-1 · No rate limiting on any backend endpoint

**Fix:** Added `express-rate-limit`.

---

### [x] M-2 · JWT stored in `localStorage` (XSS attack surface)

_Deferred for Phase 2: Cookies._

---

### [x] M-3 · `QUERY_KEYS.loanStatus` has no wallet discriminator

**Fix:** Added wallet discriminator to `loanStatus`.

---

### [x] M-4 · `fetchTxCount` caps at 200 transactions with no documentation

**Fix:** Added pagination up to 1000 transactions.

---

### [x] M-5 · `next.config.ts` is empty — no security headers

**Fix:** Added recommended security headers.

---

### [x] M-6 · `CelebrationParticles` uses `Math.random()` in render — hydration mismatch

**Fix:** Generated particle positions once in a `useEffect`.

---

### [x] M-7 · `/api/tx` double-mounting of loan routes

**Fix:** Created a dedicated `txRoutes` router.

---

### [x] M-8 · Soroban RPC calls have no retry / backoff

**Fix:** Wrapped `rpcServer` calls in a `withRetry` helper.

---

### [x] M-9 · No JWT refresh mechanism

**Fix:** Added `POST /api/auth/refresh`.

---

### [x] M-10 · No Stellar RPC / Horizon health check at startup

**Fix:** Added a startup connectivity probe.

---

## 🟢 LOW — Polish & Developer Experience

### [x] L-1 · "Last Updated" card always shows "Just now"

**Fix:** Displayed relative timestamp using `date-fns`.

---

### [x] L-2 · Landing page hero shows static "Silver Tier / 84" mock card

**Fix:** Added a subtle pulsing shimmer (`animate-pulse`).

---

### [x] L-3 · Approve step has no distinct UI label in repay flow

**Fix:** Added dynamic step labels.

---

### [x] L-4 · Disconnect wallet does not redirect to `/`

**Fix:** Added `isLoggingOut` flag to safely redirect.

---

### [x] L-5 · `backend/src/index.ts` request logger logs full query strings

**Fix:** Used `pino-http` for proper structured logging.

---

### [x] L-6 · No `.env.example` for backend

**Fix:** Created `backend/.env.example`.

---

### [x] L-7 · `backend/package.json` test script is a no-op

**Fix:** Added `vitest` and unit tests.

---

### [x] L-8 · `frontend/app/page.tsx` — session-expired URL param leaks in browser history

**Fix:** Cleaned up history via `router.replace('/')`.

---

### [x] L-9 · `scoring/engine.ts` exports are re-defined on frontend (`lib/tiers.ts`)

**Fix:** Added tests ensuring shared constants agree.

---

### [x] L-10 · `contracts/deploy.sh` writes `deployed.json` with a different schema than `contracts/redeploy.sh`

**Fix:** Standardized to use the nested schema.

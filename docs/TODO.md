Good — this is exactly the right next move. I’m going to convert your SPEC into a **clean, FAANG-style PR plan** that you can actually execute step-by-step without breaking the system.

This is structured to:

- minimize regressions
- keep the system runnable at every step
- isolate risk per PR

---

# 📦 Kredito — Implementation PR Plan

## 🧠 Strategy

We will NOT “big bang” refactor.

Instead:

> **Each PR = one invariant enforced**

Order matters. Follow this exactly.

---

# 🔴 PHASE 1 — Remove Hidden State (Critical Foundation)

## ✅ PR #1 — Remove Borrower Memory بالكامل

### 🎯 Goal

Eliminate `borrowers.ts` and all memory-based tracking.

---

### 🔧 Changes

#### 1. Delete file:

```
backend/src/borrowers.ts
```

---

#### 2. Remove imports from:

```
backend/src/routes/tx.ts
```

```ts
❌ remove:
import { addActiveBorrower, removeActiveBorrower } from '../borrowers';
```

---

#### 3. Remove ALL usages:

```ts
❌ delete:
addActiveBorrower(...)
removeActiveBorrower(...)
```

---

### ⚠️ Expected Breakage

- None (if admin already uses chain)
- If something breaks → you had hidden dependency (fix it, don’t revert)

---

### ✅ Acceptance Criteria

- [x] Project compiles
- [x] Borrow flow still submits TX
- [x] Repay flow still works
- [x] No references to `borrowers.ts`

---

---

# 🔴 PHASE 2 — Enforce On-Chain Truth

## ✅ PR #2 — Enforce Single Loan Rule (Backend)

### 🎯 Goal

Prevent duplicate loans at backend level.

---

### 🔧 Changes

#### In:

```
backend/src/routes/tx.ts
```

Before borrow TX:

```ts
const hasLoan = await hasActiveLoan(wallet);

if (hasLoan) {
  return res.status(400).json({
    error: "ACTIVE_LOAN_EXISTS",
  });
}
```

---

### ✅ Acceptance Criteria

- [x] Cannot borrow twice via API
- [x] Works even if frontend is bypassed

---

---

# 🔴 PHASE 3 — Fix Borrower Discovery

## ✅ PR #3 — Remove Dev Fallback بالكامل

### 🎯 Goal

Make borrower discovery **chain-pure**

---

### 🔧 Changes

#### In:

```
discoverBorrowersFromChain.ts
```

---

### ❌ REMOVE:

```ts
config.devKnownBorrowers;
usedDevFallback;
```

---

### ✅ ADD:

```ts
if (process.env.NODE_ENV === "production" && usedDevFallback) {
  throw new Error("Fallback borrower discovery is forbidden in production");
}
```

---

### 🧠 If no event indexing exists:

Temporary:

- allow fallback ONLY in dev
- log warning loudly

---

### ✅ Acceptance Criteria

- [x] No hardcoded borrowers used in production
- [x] Only chain-derived wallets used

---

---

# 🟡 PHASE 4 — Make Admin Idempotent & Safe

## ✅ PR #4 — Add Pre-Check Before Default

### 🎯 Goal

Prevent race condition with repay

---

### 🔧 Changes

#### In:

```
admin.ts
```

Before `mark_default`:

```ts
const latestLoan = await getLoanFromChain(wallet);

if (!latestLoan || latestLoan.repaid || latestLoan.defaulted) {
  continue;
}
```

---

### ✅ Acceptance Criteria

- [x] No default triggered after repayment
- [x] No unnecessary TX submission

---

---

## ✅ PR #5 — Add Idempotent Error Handling

### 🎯 Goal

Make admin safe to retry

---

### 🔧 Wrap TX call:

```ts
try {
  await markDefault(...)
} catch (err) {
  if (isExpectedContractError(err)) {
    continue;
  }
  throw err;
}
```

---

### Expected errors to ignore:

- already defaulted
- already repaid
- not overdue

---

### ✅ Acceptance Criteria

- [x] Multiple admin runs do not break system
- [x] No crash on known contract errors

---

---

# 🟡 PHASE 5 — Concurrency Control

## ✅ PR #6 — Parallel Admin Sweep (Controlled)

### 🎯 Goal

Speed + safety

---

### 🔧 Install:

```bash
pnpm add p-limit
```

---

### Replace:

```ts
for (...) await processLoan()
```

---

### With:

```ts
import pLimit from "p-limit";

const limit = pLimit(5);

await Promise.allSettled(loans.map((loan) => limit(() => processLoan(loan))));
```

---

### ✅ Acceptance Criteria

- [x] Faster admin execution
- [x] No RPC overload
- [x] No duplicate TX spam

---

---

# 🟡 PHASE 6 — Fix TX Reliability

## ✅ PR #7 — Add Timeout + Retry to TX Polling

### 🎯 Goal

Prevent hanging requests

---

### 🔧 In:

```
feebump.ts / tx utils
```

---

### Add:

```ts
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;
```

---

### Implement:

- timeout wrapper
- exponential backoff

---

### Behavior:

| Case               | Result |
| ------------------ | ------ |
| success            | return |
| timeout            | retry  |
| fail after retries | throw  |

---

### ✅ Acceptance Criteria

- [x] No infinite waits
- [x] API always resolves

---

---

# 🟢 PHASE 7 — Remove Weak State (Cache)

## ✅ PR #8 — Remove or Downgrade Score Cache

### 🎯 Goal

Remove hidden state

---

### Option A (Preferred):

```ts
❌ delete scoreCache
```

---

### Option B:

- TTL = 30 seconds
- wrap as optional

---

### ✅ Acceptance Criteria

- [x] No correctness depends on cache
- [x] System behaves same without it

---

---

# 🟢 PHASE 8 — Observability & Logging

## ✅ PR #9 — Add Structured Logging

### 🎯 Goal

Debuggability

---

### Add logs:

```ts
log.info("Borrow started", { wallet });
log.info("Repay confirmed", { wallet });
log.warn("Default triggered", { wallet });
log.error("TX failed", { error });
```

---

### ✅ Acceptance Criteria

- [x] All flows logged
- [x] Errors traceable

---

---

# 🔵 PHASE 9 — Testing

## ✅ PR #10 — Add Critical Tests

### 🎯 Goal

Prevent regression

---

### Tests:

- [x] cannot borrow twice
- [x] repay cancels default
- [x] concurrent admin runs safe
- [x] restart backend mid-loan safe

---

---

# 🚀 FINAL STATE (After All PRs)

Your system becomes:

### ✅ Stateless

### ✅ Deterministic

### ✅ Idempotent

### ✅ Race-safe

### ✅ Production-ready

---

# 🧠 Execution Advice (Important)

### DO NOT:

- Combine PRs
- Skip order
- “fix everything at once”

---

### DO:

- Merge each PR cleanly
- Test after each step
- Deploy incrementally (if possible)

---

# 🧠 Final Take

Right now you're transitioning from:

> “Hackathon Web3 app”

to:

> **“Production-grade distributed system”**

That transition is **not about code volume** — it's about:

- removing hidden state
- enforcing invariants
- making everything retry-safe

---

If you want next:
I can turn **PR #4–#7 into actual code patches** (drop-in replacements for your files).

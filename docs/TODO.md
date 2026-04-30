# 🚨 Remaining Issues (Real Bugs)

## ❌ 1. You STILL have hidden state in `tx.ts`

File:

```
backend/src/routes/tx.ts
```

You are still doing:

```ts
import { addActiveBorrower, removeActiveBorrower } from "../borrowers";
```

👉 That file still exists:

```ts
const activeBorrowers = new Set<string>();
```

### Why this is bad (still):

- Violates your own stateless spec
- Causes divergence from chain
- Will break under:
  - multi-instance deploy
  - restart
  - partial TX failures

👉 Even worse:
Your **admin route no longer uses it**, but **tx.ts still mutates it**

→ That creates **split-brain state**

---

## ❌ 2. `discoverBorrowersFromChain()` is a black box risk

From your implementation:

```ts
const { borrowers, latestLedger, oldestLedger, usedDevFallback } =
  await discoverBorrowersFromChain();
```

### Problem:

We don’t see its implementation, but you expose:

```ts
usedDevFallback;
```

### 🚨 This is a red flag

It means:

- Sometimes you're NOT using real on-chain data
- You might be using:
  - hardcoded wallets
  - partial logs
  - incomplete indexing

### Consequence:

- You will **miss defaults**
- Or worse → **default wrong users**

---

## ❌ 3. No concurrency protection in admin sweep

Current logic:

```ts
for (const loan of loans) {
  await buildAndSubmitFeeBump(...)
}
```

### Problem:

- Sequential execution → slow
- BUT ALSO:
- No lock / dedupe / retry strategy

### Race condition:

If:

- 2 admin calls run simultaneously

You get:

- duplicate submissions
- noisy failures

Even if contract protects, backend becomes unreliable

---

## ❌ 4. No pre-check before `mark_default`

You rely purely on:

```ts
loan.due_ledger < latestLedger;
```

### Missing:

- Re-fetch before submit
- Confirm state hasn’t changed

### Race scenario:

1. Loan is overdue
2. User repays
3. Admin sweep still submits default

→ Contract MAY reject, but:

- you waste gas
- logs become noisy

---

## ❌ 5. TX flow does NOT enforce single-loan precondition

You have:

```ts
getLoanFromChain;
waitForLoanRepayment;
```

BUT I do NOT see:

```ts
hasActiveLoan(wallet);
```

being enforced before borrow

👉 You defined it:

```ts
export async function hasActiveLoan(walletAddress: string);
```

…but not guaranteed used in route

### Risk:

- frontend bypass
- direct API call
- duplicate borrow attempts

---

## ❌ 6. No timeout / retry strategy for fee bump TX

From your TX layer:

```ts
await pollTransaction(response.hash);
```

### Missing:

- max timeout
- retry logic
- circuit breaker

### Result:

- stuck requests
- hanging API calls
- degraded UX

---

## ❌ 7. Score cache introduces soft state

File:

```ts
const scoreCache = new Map<string, ...>();
```

### Problem:

- This is still **in-memory state**
- Violates strict stateless backend

### Impact:

- Not critical (short TTL)
- But:
  - inconsistent UX across instances
  - debugging nightmare

---

# 📄 NEW TODO.md (ONLY REMAINING FIXES)

---

````markdown
# 📄 TODO.md — Kredito Final Stabilization Pass

## 🧠 Context

System is mostly correct:

- ✅ Stateless loan tracking (admin fixed)
- ✅ On-chain source of truth
- ❌ BUT still has hidden state + race conditions

---

# 🔴 CRITICAL FIXES

## 1. REMOVE borrower state بالكامل

### Delete:

- backend/src/borrowers.ts

### Remove ALL usages from:

- routes/tx.ts

### Replace with:

- NO replacement (chain is source of truth)

---

## 2. Enforce Single Loan Rule in TX Flow

### In borrow endpoint:

Before submitting TX:

```ts
if (await hasActiveLoan(wallet)) {
  throw new Error("Active loan already exists");
}
```
````

---

## 3. Fix Admin Race Conditions

### Add pre-check before submit:

```ts
const latestLoan = await getLoanFromChain(wallet);

if (!latestLoan || latestLoan.repaid || latestLoan.defaulted) {
  continue;
}
```

---

## 4. Add Idempotent Admin Execution

### Wrap TX call:

- Retry only on transient errors
- Ignore:
  - LoanAlreadyDefaulted
  - LoanNotOverdue

---

## 5. Add Concurrency Control

### Replace:

```ts
for (...) await ...
```

### With:

```ts
await Promise.allSettled(loans.map(processLoan));
```

AND limit concurrency (p-limit = 5)

---

# 🟡 HIGH PRIORITY

## 6. Fix discoverBorrowersFromChain()

### Requirements:

- MUST be deterministic
- MUST NOT rely on:
  - hardcoded wallets
  - frontend input

### Acceptable:

- contract events
- indexed logs

### If fallback used:

```ts
if (usedDevFallback) {
  log.warn("Using fallback borrower discovery");
}
```

---

## 7. Add TX Timeout + Retry

### In feebump.ts:

- max wait: 30s
- retry: 2–3 times

Fail fast after threshold

---

## 8. Remove or Refactor scoreCache

### Option A (Preferred):

- DELETE cache

### Option B:

- Keep but:
  - TTL < 30s
  - treat as non-critical

---

# 🟢 RELIABILITY

## 9. Logging

Add logs:

- borrow start/end
- repay confirmation
- default execution
- RPC failures

---

## 10. Observability

Add metrics:

- defaulted loans count
- failed TX count
- RPC latency

---

# 🔵 TESTING

## Add tests:

- [ ] double borrow attempt rejected
- [ ] repay before default prevents default
- [ ] concurrent admin sweeps safe
- [ ] backend restart mid-loan is safe

---

# 🧠 FINAL RULE

> Backend must be **stateless, deterministic, and idempotent**

If any logic depends on:

- memory
- execution order
- previous requests

👉 it is WRONG for this system

```

```

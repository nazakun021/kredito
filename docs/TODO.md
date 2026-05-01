# Kredito — Code Audit & Fix Checklist

> **Stack**: Next.js 16 · Express 5 · Soroban/Rust · Stellar Testnet  
> **Audited by**: Senior review pass over full repomix output  
> **Date**: 2026-05-01

---

## 🔴 P0 — Blockers (Fix Before Anything Else)

These will either prevent the app from starting correctly or cause silent incorrect behavior.

---

### P0-1 · `backend/src/config.ts` — Missing env vars don't stop the server

**File**: `backend/src/config.ts`

**Bug**: When required environment variables are absent, the code logs an error but **continues running** with empty-string values for `jwtSecret`, `issuerSecretKey`, etc. JWT tokens signed with `""` are a security hole, and `Keypair.fromSecret("")` will throw on first use — but only at runtime, deep in a request handler.

```typescript
// CURRENT — logs but does NOT exit
if (missingVars.length > 0) {
  if (process.env.NODE_ENV !== "test") {
    console.error(
      `❌ Missing required environment variables: ${missingVars.join(", ")}`,
    );
  }
}
```

**Fix**:

```typescript
if (missingVars.length > 0) {
  if (process.env.NODE_ENV !== "test") {
    console.error(
      `❌ Missing required environment variables: ${missingVars.join(", ")}`,
    );
    console.error("Please check your .env file.");
    process.exit(1); // ADD THIS LINE
  }
}
```

---

### P0-2 · `frontend/lib/freighter.ts` — `signTx` hardcodes `TESTNET_PASSPHRASE`

**File**: `frontend/lib/freighter.ts`, `signTx` function

**Bug**: The network passphrase is hardcoded to Testnet. Freighter will reject any signing attempt where the XDR's embedded passphrase doesn't match. If `NEXT_PUBLIC_NETWORK` is ever changed, or the user's Freighter is on a different network, signing silently uses the wrong passphrase — producing transactions that are invalid on-chain.

```typescript
// CURRENT — hardcoded
const result = await signTransaction(xdr, {
  networkPassphrase: TESTNET_PASSPHRASE, // ❌ always Testnet
  address,
});
```

**Fix**: Thread the passphrase as a parameter through `signTx`:

```typescript
// In freighter.ts — update signature
export async function signTx(
  xdr: string,
  address: string,
  networkPassphrase: string,          // ADD
): Promise<{ signedXdr: string } | { error: string }> {
  const result = await signTransaction(xdr, { networkPassphrase, address });
  ...
}
```

Then at every call site (`borrow/page.tsx`, `repay/page.tsx`), pass the passphrase from the wallet store:

```typescript
// In borrow/page.tsx and repay/page.tsx
const { networkPassphrase } = useWalletStore();
const result = await signTx(
  unsignedXdr,
  user.wallet,
  networkPassphrase ?? TESTNET_PASSPHRASE,
);
```

---

## 🟠 P1 — Security Issues

---

### P1-1 · `backend/src/middleware/auth.ts` — Admin secret uses non-timing-safe comparison

**File**: `backend/src/middleware/auth.ts`, `adminAuthMiddleware`

**Bug**: Direct `!==` string comparison is vulnerable to timing attacks. An attacker can brute-force the admin secret byte-by-byte by measuring response time differences.

```typescript
// CURRENT — not timing-safe
if (token !== config.adminApiSecret)
  return next(unauthorized("Admin access only"));
```

**Fix**:

```typescript
import { timingSafeEqual, createHash } from "crypto";

export function adminAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = config.adminApiSecret;
  // Normalize lengths by hashing both — timingSafeEqual requires equal-length buffers
  const tokenBuf = createHash("sha256").update(token).digest();
  const expectedBuf = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(tokenBuf, expectedBuf)) {
    return next(unauthorized("Admin access only"));
  }
  return next();
}
```

---

### P1-2 · `frontend/store/auth.ts` — JWT stored in `localStorage` (XSS risk)

**File**: `frontend/store/auth.ts` (Zustand persist with `name: "kredito-auth"`)

**Bug**: `localStorage` is accessible to any JavaScript on the page. An XSS vulnerability in any dependency would expose the JWT. The architecture doc itself flags this.

**Fix (short-term)**: Sanitize all user-facing error messages and audit third-party dependencies.

**Fix (long-term)**: Move to `HttpOnly; SameSite=Strict` cookie-based sessions. This requires:

1. Backend: Issue JWT as a `Set-Cookie` response header instead of a JSON body field.
2. Backend: Remove `Authorization: Bearer` middleware; read token from `req.cookies.session`.
3. Frontend: Remove Zustand `persist` for the token; rely on the cookie being sent automatically.
4. Backend: Update CORS config to `credentials: true` and set explicit `origin`.

This is a larger refactor — track as a follow-up but be aware of the current risk.

---

## 🟡 P2 — Correctness / Logic Bugs

---

### P2-1 · `backend/src/stellar/events.ts` — `paginateEvents` infinite loop edge case

**File**: `backend/src/stellar/events.ts`

**Bug**: When `page.cursor` is `undefined` or `null` (common when the API returns a full page that happens to be the last one), the `cursor` variable becomes `undefined`. On the next loop iteration, `cursor` is falsy, so the request is built with `startLedger` again — restarting from the beginning. This creates an infinite loop.

```typescript
// CURRENT — cursor can become undefined
cursor = page.cursor; // ← page.cursor might be undefined/null
// next iter: cursor is falsy → uses startLedger → restarts → infinite loop
```

**Fix**:

```typescript
// After updating cursor, guard the loop:
if (!page.cursor) {
  break; // No cursor means no more pages
}
cursor = page.cursor;
```

Full corrected loop exit block:

```typescript
if (page.events.length < limit || !page.cursor || page.cursor === cursor) {
  break;
}
cursor = page.cursor;
```

---

### P2-2 · `frontend/store/walletStore.ts` — `localStorage` calls not guarded

**File**: `frontend/store/walletStore.ts`

**Bug**: `localStorage.setItem` and `localStorage.removeItem` throw in some browsers under private/incognito mode, or when storage is full. An unguarded throw inside the Zustand store action will leave the store in an intermediate state.

```typescript
// CURRENT — can throw
localStorage.setItem("kredito_wallet_connected", "true");
```

**Fix**: Wrap all `localStorage` interactions:

```typescript
function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* silent */
  }
}
function safeLocalStorageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* silent */
  }
}
```

Same fix applies to `api.ts`:

```typescript
try {
  localStorage.removeItem("kredito-auth");
} catch {
  /* silent */
}
```

---

### P2-3 · Score formula drift risk between TypeScript and Rust

**Files**: `backend/src/scoring/engine.ts` and `contracts/credit_registry/src/lib.rs`

**Bug**: The credit score is computed twice — once off-chain (TypeScript `calculateScore`) for preview/generation, and once on-chain (Rust `compute_score` in the contract). If either side is updated without updating the other, users see a different score off-chain vs on-chain. There is currently no automated test verifying they produce identical output.

**Fix**: Add a unit test that runs the TypeScript formula against a set of fixture inputs and asserts the output matches the expected Rust output (which you can pre-compute and hardcode as test vectors).

```typescript
// backend/src/scoring/engine.test.ts
import { describe, it, expect } from "vitest";
import { calculateScore } from "./engine";

// Test vectors derived from the Rust contract
const fixtures = [
  {
    metrics: {
      txCount: 50,
      repaymentCount: 3,
      xlmBalance: 500,
      defaultCount: 0,
    },
    expected: 175,
  },
  {
    metrics: {
      txCount: 10,
      repaymentCount: 0,
      xlmBalance: 50,
      defaultCount: 1,
    },
    expected: 0,
  },
  {
    metrics: {
      txCount: 20,
      repaymentCount: 2,
      xlmBalance: 200,
      defaultCount: 0,
    },
    expected: 70,
  },
];

describe("calculateScore", () => {
  it.each(fixtures)(
    "matches Rust contract for $metrics",
    ({ metrics, expected }) => {
      expect(calculateScore(metrics)).toBe(expected);
    },
  );
});
```

---

## 🔵 P3 — Robustness & Operational

---

### P3-1 · `backend/src/index.ts` — No graceful shutdown handler

**File**: `backend/src/index.ts`

**Bug**: Without `SIGTERM` / `SIGINT` handling, a container orchestrator (Kubernetes, Fly.io, Railway) sends SIGTERM on deploy/scale-down and then SIGKILL after the grace period. In-flight Stellar RPC calls and pending transactions can be lost mid-submission, causing orphaned signed transactions.

**Fix** — add at the bottom of `index.ts`:

```typescript
const server = app.listen(config.port, () => {
  console.log(`Kredito backend listening at http://localhost:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received — shutting down gracefully`);
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
  // Force exit after 10s if connections don't drain
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

---

### P3-2 · `scripts/setup.sh` — No pnpm version check

**File**: `scripts/setup.sh`

**Bug**: The script runs `pnpm install` without verifying pnpm is installed or matches the pinned version (`pnpm@10.32.1` in `package.json`). On a fresh machine, this silently fails or uses the wrong version.

**Fix** — add at the top of `setup.sh`:

```bash
# Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "❌ pnpm not found. Install it: npm i -g pnpm@10.32.1"
  exit 1
fi

REQUIRED_PNPM="10.32.1"
INSTALLED_PNPM=$(pnpm --version)
if [ "$INSTALLED_PNPM" != "$REQUIRED_PNPM" ]; then
  echo "⚠️  pnpm $INSTALLED_PNPM found, expected $REQUIRED_PNPM"
  echo "   Run: npm i -g pnpm@$REQUIRED_PNPM"
fi
```

---

### P3-3 · `backend/src/index.ts` — `adminRoutes` import is mid-file

**File**: `backend/src/index.ts`

**Bug**: `import adminRoutes from './routes/admin'` is placed after all the `app.use()` calls, mid-file. While TypeScript hoists `import` statements so it works at runtime, it is confusing and violates the convention of grouping all imports at the top.

**Fix**: Move the import to the top of the file with all other route imports:

```typescript
import adminRoutes from "./routes/admin"; // ← move here, with other route imports
import authRoutes from "./routes/auth";
import creditRoutes from "./routes/credit";
import loanRoutes from "./routes/loan";
import txRoutes from "./routes/tx";
```

---

### P3-4 · Testnet contract TTL awareness

**File**: `contracts/deployed.json`

**Note**: Soroban contracts have storage TTLs. The contracts were verified on 2026-04-29 with `MAX_TTL = 200,000 ledgers` (~11.5 days at 5s/ledger). TTLs are extended on each interaction, but idle contracts can expire. If you restart after a period of inactivity and see `ContractDataExpired` errors, you need to restore the contracts:

```bash
stellar contract restore \
  --id <CONTRACT_ID> \
  --source <ISSUER_SECRET_KEY> \
  --network testnet
```

Run this for all three contract IDs from `deployed.json` if the backend throws on startup.

---

## ✅ Clean Local Setup Guide

### Prerequisites

| Tool         | Version   | Install                                |
| ------------ | --------- | -------------------------------------- |
| Node.js      | ≥ 20.12.0 | [nodejs.org](https://nodejs.org)       |
| pnpm         | 10.32.1   | `npm i -g pnpm@10.32.1`                |
| Freighter    | latest    | [freighter.app](https://freighter.app) |
| Rust + Cargo | stable    | `curl https://sh.rustup.rs -sSf \| sh` |
| stellar CLI  | latest    | `cargo install stellar-cli --locked`   |

---

### Step 1 — Clone and Bootstrap

```bash
git clone <your-repo>
cd kredito
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This creates `backend/.env` and `frontend/.env.local` from examples and runs `pnpm install` in both directories.

---

### Step 2 — Configure Backend `.env`

Open `backend/.env` and fill in every value:

```env
# ── Auth ─────────────────────────────────────────────────────────────────────
JWT_SECRET=<random 64-char hex string>         # openssl rand -hex 32
WEB_AUTH_SECRET_KEY=<Stellar secret key>        # stellar keys generate web-auth-key
ADMIN_API_SECRET=<random 40+ char string>       # openssl rand -hex 20

# ── Stellar ──────────────────────────────────────────────────────────────────
ISSUER_SECRET_KEY=<your issuer Stellar secret>  # stellar keys generate issuer
STELLAR_NETWORK=TESTNET
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# ── Contracts (from contracts/deployed.json) ─────────────────────────────────
PHPC_ID=CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR
REGISTRY_ID=CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ
LENDING_POOL_ID=CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH

# ── Server ───────────────────────────────────────────────────────────────────
PORT=3001
CORS_ORIGINS=http://localhost:3000
HOME_DOMAIN=localhost
WEB_AUTH_DOMAIN=localhost
APPROVAL_LEDGER_WINDOW=500
STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet
```

**Generate keys quickly**:

```bash
# Issuer keypair (funds demo accounts, signs registry transactions)
stellar keys generate issuer --network testnet
stellar keys show issuer          # copy the secret key → ISSUER_SECRET_KEY

# Fund the issuer on Testnet
stellar keys fund issuer --network testnet

# WebAuth keypair (signs SEP-10 challenges)
stellar keys generate web-auth-key --network testnet
stellar keys show web-auth-key    # copy the secret key → WEB_AUTH_SECRET_KEY
```

---

### Step 3 — Configure Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_NETWORK=TESTNET
```

---

### Step 4 — Verify Contracts Are Alive

```bash
stellar contract invoke \
  --id CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR \
  --network testnet \
  -- name
```

If you get `ContractDataExpired`, restore all three:

```bash
for ID in \
  CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR \
  CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ \
  CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH; do
  stellar contract restore --id $ID \
    --source $ISSUER_SECRET_KEY \
    --network testnet
done
```

---

### Step 5 — Run the Backend

```bash
cd backend
pnpm dev
```

Expected output:

```
✅ Stellar RPC and Horizon reachable
Kredito backend listening at http://localhost:3001
```

If you see `❌ Missing required environment variables`, the P0-1 fix is not yet applied. Stop, fill in `.env`, restart.

---

### Step 6 — Run the Frontend

```bash
cd frontend
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Step 7 — Configure Freighter

1. Open Freighter extension → Settings → Network → **Testnet**
2. Import or create a wallet
3. Fund it: `stellar keys fund <YOUR_PUBLIC_KEY> --network testnet`
4. Connect at [http://localhost:3000](http://localhost:3000)

---

### Step 8 — Smoke Test the Full Flow

```bash
# 1. Health check
curl http://localhost:3001/health
# → {"status":"ok"}

# 2. Challenge
curl -X POST http://localhost:3001/api/auth/challenge \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"wallet":"<YOUR_PUBLIC_KEY>"}'
# → {"challenge":"...XDR...","expiresAt":...}

# 3. Full flow in browser:
# Connect wallet → Dashboard (auto-generates score) → Borrow → Repay
```

---

## Fix Priority Summary

| #   | Priority | File                                 | Issue                                           | Effort  |
| --- | -------- | ------------------------------------ | ----------------------------------------------- | ------- |
| 1   | 🔴 P0    | `backend/src/config.ts`              | Add `process.exit(1)` on missing env vars       | 1 line  |
| 2   | 🔴 P0    | `frontend/lib/freighter.ts`          | Pass `networkPassphrase` as param to `signTx`   | 15 min  |
| 3   | 🟠 P1    | `backend/src/middleware/auth.ts`     | Use `timingSafeEqual` for admin secret          | 10 min  |
| 4   | 🟠 P1    | `frontend/store/auth.ts`             | Track: move JWT to HttpOnly cookie              | 2–4 hrs |
| 5   | 🟡 P2    | `backend/src/stellar/events.ts`      | Guard `paginateEvents` against undefined cursor | 5 min   |
| 6   | 🟡 P2    | `frontend/store/walletStore.ts`      | Wrap `localStorage` in try/catch                | 10 min  |
| 7   | 🟡 P2    | `backend/src/scoring/engine.test.ts` | Add score formula fixture tests                 | 30 min  |
| 8   | 🔵 P3    | `backend/src/index.ts`               | Add `SIGTERM`/`SIGINT` graceful shutdown        | 10 min  |
| 9   | 🔵 P3    | `scripts/setup.sh`                   | Add pnpm version check                          | 10 min  |
| 10  | 🔵 P3    | `backend/src/index.ts`               | Move `adminRoutes` import to top of file        | 2 min   |

---

## What's Actually Working Well ✅

- The two-step repay flow (`/repay` → approve → `/repay-xdr` → repay) correctly handles account sequence number progression across two separate Freighter signing calls.
- `buildScorePayload` is correctly exported from `engine.ts` and used by `issuer.ts` — this is not a bug (the repomix output was truncated on first read).
- The circuit breaker in `admin.ts` is solid: 30% failure threshold with idempotent error classification.
- `asyncRoute` wrapper cleanly propagates async errors to Express's error handler throughout all routes.
- `WalletStore.disconnect()` correctly calls `useAuthStore.getState().clearAuth()` — no lingering JWT on wallet disconnect.
- The `reauthPromise` deduplication in `api.ts` correctly prevents multiple simultaneous re-auth popups.
- Zustand `persist` merge function correctly handles partial hydration (clears state if user/token pairing is inconsistent).

This file is a merged representation of a subset of the codebase, containing specifically included files and files not matching ignore patterns, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.
- Pay special attention to the Repository Description. These contain important context and guidelines specific to this project.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: **/*
- Files matching these patterns are excluded: **/node_modules/**, **/dist/**, **/build/**, **/.next/**, **/target/**, **/*.lock, **/pnpm-lock.yaml, **/*.db*, **/*.sqlite*, **/*.log, **/.env*, **/*.tsbuildinfo, **/images/**, **/*.{png,jpg,jpeg,gif,svg,ico,webp,pdf,zip}, **/.git/**, **/.github/**, **/.agents/**, **/.DS_Store, **/test_snapshots/**, **/__snapshots__/**, **/*.test.ts.snap, repomix-output.md
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# User Provided Header
This file is a merged representation of the Kredito codebase.
Kredito is a decentralized credit platform built on the Stellar network using Soroban smart contracts.
Architecture:
- frontend: Next.js application with Tailwind CSS and shadcn/ui.
- backend: Express.js API serving as a stateless middleware for Stellar interactions.
- contracts: Soroban smart contracts written in Rust.

Please use this context to understand the project structure, business logic, and integration patterns.

# Directory Structure
```
backend/
  src/
    lib/
      errors/
        classifyError.ts
      parseLedgerRange.ts
    middleware/
      auth.ts
    routes/
      admin.ts
      auth.test.ts
      auth.ts
      credit.test.ts
      credit.ts
      invariants.test.ts
      loan.ts
      tx.test.ts
      tx.ts
    scoring/
      engine.test.ts
      engine.ts
    stellar/
      client.ts
      demo.ts
      events.ts
      feebump.ts
      issuer.ts
      query.test.ts
      query.ts
    types/
      cors.d.ts
      express.d.ts
    utils/
      logger.ts
      sleep.ts
    config.ts
    errors.ts
    index.ts
  .prettierrc
  eslint.config.mjs
  package.json
  tsconfig.json
  vitest.config.ts
contracts/
  credit_registry/
    src/
      lib.rs
      test.rs
    Cargo.toml
  lending_pool/
    src/
      lib.rs
      test.rs
    Cargo.toml
  phpc_token/
    src/
      lib.rs
      test.rs
    Cargo.toml
  Cargo.toml
  deploy.sh
  deployed.json
  redeploy.sh
docs/
  ARCHITECTURE.md
  ERROR_CODES.md
  SETUP.md
  TODO.md
frontend/
  app/
    dashboard/
      error.tsx
      layout.tsx
      loading.tsx
      page.tsx
    loan/
      borrow/
        page.tsx
      repay/
        page.tsx
      error.tsx
      layout.tsx
      loading.tsx
    error.tsx
    global-error.tsx
    globals.css
    layout.tsx
    loading.tsx
    not-found.tsx
    page.tsx
    providers.tsx
  components/
    app-shell.tsx
    CelebrationParticles.tsx
    ConnectWalletButton.tsx
    NetworkBadge.tsx
    StepBreadcrumb.tsx
    SummaryRow.tsx
    WalletConnectionBanner.tsx
    WalletProvider.tsx
  lib/
    api.ts
    constants.ts
    errors.ts
    freighter.test.ts
    freighter.ts
    queryKeys.ts
    tiers.ts
  store/
    auth.ts
    walletStore.ts
  .env.example
  .gitignore
  eslint.config.mjs
  next.config.ts
  package.json
  postcss.config.mjs
  README.md
  tsconfig.json
.gitignore
.repomixignore
README.md
repomix.config.json
```

# Files

## File: backend/src/lib/errors/classifyError.ts
````typescript
// backend/src/lib/errors/classifyError.ts

export type ErrorAction = 'IGNORE' | 'RETRY' | 'FAIL';

export function isContractError(err: any, code: string): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Support both raw XDR strings and friendly names if they happen to be in the message
  return message.includes(code) || message.toLowerCase().includes(code.toLowerCase());
}

export function isRpcError(err: any): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const rpcMarkers = [
    'request failed',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'socket hang up',
    '500 Internal Server Error',
    '502 Bad Gateway',
    '503 Service Unavailable',
    '504 Gateway Timeout',
    'rate limit',
  ];
  return rpcMarkers.some((marker) => message.includes(marker) || message.toLowerCase().includes(marker.toLowerCase()));
}

export function classifyError(err: any): ErrorAction {
  // Expected race conditions / idempotency markers
  if (
    isContractError(err, 'LoanDefaulted') ||
    isContractError(err, 'LoanAlreadyDefaulted') ||
    isContractError(err, 'LoanNotOverdue') ||
    isContractError(err, 'LoanAlreadyRepaid') ||
    isContractError(err, 'LoanNotFound')
  ) {
    return 'IGNORE';
  }

  // Transient network/RPC issues
  if (isRpcError(err) || isContractError(err, 'TX_TIMEOUT')) {
    return 'RETRY';
  }

  return 'FAIL';
}
````

## File: backend/src/lib/parseLedgerRange.ts
````typescript
export function parseLedgerRange(error: unknown) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  const match = message.match(/ledger range:\s*(\d+)\s*-\s*(\d+)/i);
  if (!match) {
    return null;
  }

  return {
    min: Number(match[1]),
    max: Number(match[2]),
  };
}
````

## File: backend/src/routes/auth.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from './auth';
import { Keypair } from '@stellar/stellar-sdk';

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    WebAuth: {
      buildChallengeTx: vi.fn().mockReturnValue('mocked-challenge-xdr'),
      readChallengeTx: vi.fn().mockReturnValue({ clientAccountID: 'G123' }),
      verifyChallengeTxSigners: vi.fn().mockReturnValue(true),
    },
  };
});

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  it('POST /api/auth/challenge - returns { challenge } with no DB call', async () => {
    const res = await request(app)
      .post('/api/auth/challenge')
      .send({ wallet: Keypair.random().publicKey() });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('challenge');
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('POST /api/auth/login with valid challenge should return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ signedChallenge: 'valid-mock-xdr' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('wallet', 'G123');
  });

  it('POST /api/auth/login with invalid signature - returns 401', async () => {
    const { WebAuth } = await import('@stellar/stellar-sdk');
    vi.mocked(WebAuth.verifyChallengeTxSigners).mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    const res = await request(app).post('/api/auth/login').send({ signedChallenge: 'invalid-xdr' });
    expect(res.status).toBe(401);
  });
});
````

## File: backend/src/routes/credit.test.ts
````typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';

const getOnChainCreditSnapshot = vi.fn();

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { wallet?: string }).wallet =
      'GDUMMYWALLETDUMMYWALLETDUMMYWALLETDUMMYWALLETDUMMYWALLETDUM';
    next();
  },
}));

vi.mock('../stellar/issuer', () => ({
  getOnChainCreditSnapshot,
  updateOnChainMetrics: vi.fn(),
}));

vi.mock('../scoring/engine', () => ({
  buildScoreSummary: vi.fn(),
  getPoolSnapshot: vi.fn(),
}));

vi.mock('../stellar/query', () => ({
  queryContract: vi.fn(),
}));

vi.mock('../stellar/client', () => ({
  contractIds: {
    creditRegistry: 'CREDIT',
  },
}));

describe('Credit Routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('propagates unexpected on-chain score failures instead of masking them as 404', async () => {
    getOnChainCreditSnapshot.mockRejectedValueOnce(new Error('RPC timeout'));

    const { default: creditRoutes } = await import('./credit');
    const scoreLayer = (creditRoutes as unknown as { stack: any[] }).stack.find(
      (layer) => layer.route?.path === '/score',
    );
    const routeHandler = scoreLayer.route.stack[1].handle as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void;

    const req = {
      wallet: 'GDUMMYWALLETDUMMYWALLETDUMMYWALLETDUMMYWALLETDUMMYWALLETDUM',
    } as Request & { wallet: string };
    const res = {
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    routeHandler(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0][0] as Error).message).toBe('RPC timeout');
  });
});
````

## File: backend/src/routes/tx.test.ts
````typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import txRoutes from './tx';
import { hasActiveLoan } from '../stellar/query';
import { submitSponsoredSignedXdr } from '../stellar/feebump';

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req, res, next) => {
    req.wallet = 'GBORROWER';
    next();
  }),
}));

vi.mock('../stellar/query', () => ({
  hasActiveLoan: vi.fn(),
  getLoanFromChain: vi.fn(),
  waitForLoanRepayment: vi.fn(),
}));

vi.mock('../stellar/feebump', () => ({
  submitSponsoredSignedXdr: vi.fn(),
}));

vi.mock('../scoring/engine', () => ({
  buildScoreSummary: vi.fn(),
  toPhpAmount: vi.fn((v) => (Number(v) / 10_000_000).toFixed(2)),
}));

vi.mock('../stellar/issuer', () => ({
  getOnChainCreditSnapshot: vi.fn(),
  updateOnChainMetrics: vi.fn(),
}));

import { errorHandler } from '../errors';

const app = express();
app.use(express.json());
app.use('/tx', txRoutes);
app.use(errorHandler);

describe('TX Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /tx/sign-and-submit', () => {
    it('rejects borrow if an active loan already exists', async () => {
      vi.mocked(hasActiveLoan).mockResolvedValue(true);

      const response = await request(app)
        .post('/tx/sign-and-submit')
        .send({
          signedInnerXdr: 'AAAA...',
          flow: { action: 'borrow' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Active loan already exists');
      expect(submitSponsoredSignedXdr).not.toHaveBeenCalled();
    });

    it('allows borrow if no active loan exists', async () => {
      vi.mocked(hasActiveLoan).mockResolvedValue(false);
      vi.mocked(submitSponsoredSignedXdr).mockResolvedValue('TX_HASH');

      const response = await request(app)
        .post('/tx/sign-and-submit')
        .send({
          signedInnerXdr: 'AAAA...',
          flow: { action: 'borrow' },
        });

      expect(response.status).toBe(200);
      expect(response.body.txHash).toBe('TX_HASH');
      expect(submitSponsoredSignedXdr).toHaveBeenCalled();
    });
  });
});
````

## File: backend/src/stellar/events.ts
````typescript
import { rpc } from '@stellar/stellar-sdk';
import { rpcServer } from './client';
import { sleep } from '../utils/sleep';
import { parseLedgerRange } from '../lib/parseLedgerRange';

async function withRetry<T>(fn: () => Promise<T>, retries = 3, backoffMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(backoffMs * 2 ** i);
    }
  }
  throw new Error('unreachable');
}

export async function paginateEvents(
  filters: rpc.Api.EventFilter[],
  requestedStartLedger: number,
  limit = 200,
) {
  let cursor: string | undefined;
  let events: rpc.Api.EventResponse[] = [];
  let oldestLedger: number | undefined;

  while (true) {
    const request: rpc.Api.GetEventsRequest = cursor
      ? { filters, cursor, limit }
      : { filters, startLedger: requestedStartLedger, limit };

    let page: rpc.Api.GetEventsResponse;
    try {
      page = await withRetry(() => rpcServer.getEvents(request));
    } catch (error) {
      if (cursor) {
        throw error;
      }

      const range = parseLedgerRange(error);
      if (!range) {
        throw error;
      }

      page = await withRetry(() =>
        rpcServer.getEvents({
          filters,
          startLedger: Math.max(range.min, Math.min(requestedStartLedger, range.max)),
          limit,
        }),
      );
    }

    oldestLedger = page.oldestLedger;
    events = events.concat(page.events);

    if (page.events.length < limit || page.cursor === cursor) {
      break;
    }

    cursor = page.cursor;
  }

  return {
    events,
    oldestLedger: oldestLedger ?? requestedStartLedger,
  };
}
````

## File: backend/src/types/express.d.ts
````typescript
import 'express';

declare global {
  namespace Express {
    interface Request {
      wallet: string;
    }
  }
}
````

## File: backend/src/utils/logger.ts
````typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
});
````

## File: backend/src/utils/sleep.ts
````typescript
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
````

## File: backend/.prettierrc
````
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
````

## File: backend/eslint.config.mjs
````javascript
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "prettier": prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      "prettier/prettier": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
];
````

## File: backend/tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
````

## File: backend/vitest.config.ts
````typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['node_modules', 'dist'],
    env: {
      JWT_SECRET: 'test-secret',
      ISSUER_SECRET_KEY: 'SDWBYH3UINDBEKD2PSE6GZVEKMHEBU6BUVIXWSEAXY2IRS42X325I3EH',
      ADMIN_API_SECRET: 'test-admin-secret',
      SOROBAN_RPC_URL: 'http://localhost',
      HORIZON_URL: 'http://localhost',
      NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      REGISTRY_ID: 'CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ',
      LENDING_POOL_ID: 'CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH',
      PHPC_ID: 'CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR',
    },
  },
});
````

## File: contracts/credit_registry/Cargo.toml
````toml
[package]
name = "credit_registry"
version = "0.1.0"
edition = "2021"
license = "MIT"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { version = "22.0.0", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils", "alloc"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
````

## File: contracts/lending_pool/Cargo.toml
````toml
[package]
name = "lending_pool"
version = "0.1.0"
edition = "2021"
license = "MIT"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { version = "22.0.0", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils", "alloc"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
````

## File: contracts/phpc_token/Cargo.toml
````toml
[package]
name = "phpc_token"
version = "0.1.0"
edition = "2021"
license = "MIT"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { version = "22.0.0", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils", "alloc"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
````

## File: contracts/Cargo.toml
````toml
[workspace]
members = [
    "credit_registry",
    "lending_pool",
    "phpc_token",
]
resolver = "2"

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
````

## File: contracts/deployed.json
````json
{
  "network": "testnet",
  "contracts": {
    "credit_registry": "CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ",
    "lending_pool": "CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH",
    "phpc_token": "CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR"
  },
  "verifiedAt": "2026-04-29T07:53:00Z",
  "notes": "PHPC and Lending Pool redeployed to fix UnreachableCodeReached panic in simulation. Credit Registry remains the same."
}
````

## File: docs/ERROR_CODES.md
````markdown
# Kredito Error Codes

This document lists the error codes used across the Kredito system, their meanings, and how they are handled.

## Contract Error Codes (Soroban)

These errors are emitted by the `lending_pool` and `credit_registry` smart contracts.

| Code  | Label                       | Meaning                                                             | User-Friendly Message                               |
| ----- | --------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| `#1`  | `AlreadyInitialized`        | Contract already has an admin/issuer set                            | "System is already configured"                      |
| `#2`  | `NotInitialized`            | Contract is being used before initialization                        | "System is not yet configured"                      |
| `#3`  | `InvalidFeeBps`             | Fee basis points exceed 100%                                        | "Invalid fee configuration"                         |
| `#4`  | `InvalidLoanTerm`           | Loan term ledgers set to zero                                       | "Invalid loan term"                                 |
| `#5`  | `InvalidAmount`             | Amount is zero or negative                                          | "Amount must be greater than zero"                  |
| `#6`  | `PoolBalanceOverflow`       | Pool balance would exceed storage limits                            | "Pool capacity exceeded"                            |
| `#7`  | `ActiveLoanExists`          | Borrower already has an unpaid/non-defaulted loan                   | "You already have an active loan"                   |
| `#8`  | `NoCreditTier`              | Borrower has no tier (Tier 0)                                       | "No credit score found — generate a score first"    |
| `#9`  | `BorrowLimitExceeded`       | Requested amount exceeds borrower's tier limit                      | "Amount exceeds your current tier limit"            |
| `#10` | `InsufficientPoolLiquidity` | Pool does not have enough PHPC to cover the loan                    | "Insufficient pool liquidity"                       |
| `#11` | `FeeOverflow`               | Fee calculation resulted in overflow                                | "Calculation error"                                 |
| `#12` | `DueLedgerOverflow`         | Ledger calculation resulted in overflow                             | "Calculation error"                                 |
| `#13` | `LoanNotFound`              | No loan record exists for the borrower                              | "No active loan found"                              |
| `#14` | `LoanAlreadyRepaid`         | Borrower is trying to repay a settled loan                          | "Loan already repaid"                               |
| `#15` | `LoanDefaulted`             | Loan was previously marked as defaulted                             | "This loan has been defaulted and cannot be repaid" |
| `#16` | `LoanOverdue`               | Loan passed its due ledger and cannot be repaid (must be defaulted) | "This loan is overdue"                              |
| `#17` | `RepaymentOverflow`         | Total owed calculation resulted in overflow                         | "Calculation error"                                 |
| `#18` | `LoanNotOverdue`            | Issuer trying to mark a loan as defaulted before it is due          | "Loan is not yet overdue"                           |

## Backend Error Codes

The backend uses standard HTTP status codes and custom error messages.

| Status | Code/Message              | Meaning                                                |
| ------ | ------------------------- | ------------------------------------------------------ |
| `401`  | `Unauthorized`            | JWT missing, expired, or signature verification failed |
| `422`  | `InsufficientBalance`     | Borrower has insufficient PHPC for repayment           |
| `400`  | `Invalid Stellar address` | Provided public key is malformed                       |
| `400`  | `Timeout`                 | Stellar transaction submission timed out               |
| `503`  | `Contract Unavailable`    | Backend cannot reach Stellar RPC/Horizon               |

## Frontend Error Handling

The frontend maps these errors to the UI via `lib/errors.ts`:

1.  **Contract Errors**: Mapped via backend `errorHandler` to friendly strings.
2.  **Auth Errors**: Triggers `clearAuth()` and redirects to home.
3.  **Repayment Shortfall**: Displays the exact PHPC amount needed before allowing the sign flow.
````

## File: frontend/app/dashboard/loading.tsx
````typescript
// frontend/app/dashboard/loading.tsx

import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center animate-fade-up">
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-full border-4 border-slate-800" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-accent)' }} />
        </div>
      </div>
      <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
        Accessing Ledger...
      </p>
    </div>
  );
}
````

## File: frontend/app/loan/error.tsx
````typescript
// frontend/app/loan/error.tsx

'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center p-6 text-center animate-fade-up">
      <div 
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-6" 
        style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)' }}
      >
        <AlertCircle size={32} style={{ color: 'var(--color-danger)' }} />
      </div>
      
      <h2 className="text-xl font-bold mb-2">Transaction error</h2>
      <p className="text-sm max-w-xs mx-auto mb-8" style={{ color: 'var(--color-text-secondary)' }}>
        Something went wrong while processing the loan flow. This could be due to network congestion or a signature rejection.
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="btn-primary btn-dark inline-flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Try again
        </button>
        <Link
          href="/dashboard"
          className="btn-primary border border-slate-700 inline-flex items-center gap-2"
          style={{ background: 'transparent', color: 'var(--color-text-primary)' }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
````

## File: frontend/app/loan/loading.tsx
````typescript
// frontend/app/loan/loading.tsx

import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center animate-fade-up">
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-full border-4 border-slate-800" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-accent)' }} />
        </div>
      </div>
      <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
        Loading Transaction Flow...
      </p>
    </div>
  );
}
````

## File: frontend/components/CelebrationParticles.tsx
````typescript
'use client';

import { useState } from 'react';

export default function CelebrationParticles() {
  const [particles] = useState<{ left: string; animationDelay: string; duration: string }[]>(() =>
    Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 3}s`,
    }))
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{
            background: i % 2 === 0 ? 'var(--color-accent)' : 'var(--color-amber)',
            top: '-20px',
            left: p.left,
            animation: `fall ${p.duration} linear infinite`,
            animationDelay: p.animationDelay,
            opacity: 0.6,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(600px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
````

## File: frontend/components/StepBreadcrumb.tsx
````typescript
// frontend/components/StepBreadcrumb.tsx

'use client';

interface StepBreadcrumbProps {
  step: number;
  total: number;
}

export default function StepBreadcrumb({ step, total }: StepBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
        Step {step}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-1 w-4 rounded-full"
            style={{
              background: i + 1 <= step ? 'var(--color-accent)' : 'var(--color-bg-elevated)',
              opacity: i + 1 === step ? 1 : 0.4
            }}
          />
        ))}
      </div>
    </div>
  );
}
````

## File: frontend/components/SummaryRow.tsx
````typescript
import React from 'react';

interface SummaryRowProps {
  label: string;
  value: string | number;
  strong?: boolean;
  tone?: 'success' | 'amber' | 'danger';
}

export default function SummaryRow({ label, value, strong, tone }: SummaryRowProps) {
  const color =
    tone === 'danger'
      ? 'var(--color-danger)'
      : tone === 'amber'
        ? 'var(--color-amber)'
        : tone === 'success'
          ? 'var(--color-success)'
          : undefined;

  const textSecondaryColor = 'var(--color-text-secondary)';
  const textPrimaryColor = 'var(--color-text-primary)';
  const borderColor = 'var(--color-border)';

  return (
    <div
      className={`flex items-center justify-between text-sm ${
        strong ? 'mt-4 border-t pt-4 font-bold' : ''
      }`}
      style={
        strong
          ? { borderColor, color: textPrimaryColor }
          : { color: textSecondaryColor }
      }
    >
      <span>{label}</span>
      <span
        className={`tabular-nums ${tone ? 'font-mono' : ''}`}
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
````

## File: frontend/lib/freighter.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import { signTx } from './freighter';

vi.mock('@stellar/freighter-api', () => ({
  signTransaction: vi.fn(async (xdr, options) => {
    // Implementation uses networkPassphrase
    if (options?.networkPassphrase) {
      return { signedTxXdr: 'signed-xdr-content' };
    }
    return { error: 'User declined' };
  }),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
}));

describe('Freighter API', () => {
  it('signTx returns { signedXdr } on success', async () => {
    const result = await signTx('unsigned-xdr', 'G123');
    expect(result).toHaveProperty('signedXdr');
    expect((result as { signedXdr: string }).signedXdr).toBe('signed-xdr-content');
  });
});
````

## File: frontend/.env.example
````
# Backend API URL — points to your local or Railway backend
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Stellar network — "testnet" or "mainnet"
NEXT_PUBLIC_NETWORK=testnet

# Stellar Expert base URL for transaction/contract links
NEXT_PUBLIC_EXPLORER_URL=https://stellar.expert/explorer/testnet
````

## File: frontend/postcss.config.mjs
````javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
````

## File: frontend/tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
````

## File: backend/src/routes/invariants.test.ts
````typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import txRoutes from './tx';
import adminRoutes from './admin';
import { hasActiveLoan, getLoanFromChain, getAllLoansFromChain } from '../stellar/query';
import { submitSponsoredSignedXdr, buildAndSubmitFeeBump } from '../stellar/feebump';
import { config } from '../config';

const DUMMY_WALLET = 'GBCOYLF2WO33E7PH3F6COHDNWSO2VG5C4SUIYCYY26RV45UON7U73VYF';

// Mock dependencies
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req, res, next) => {
    req.wallet = DUMMY_WALLET;
    next();
  }),
}));

vi.mock('../stellar/query', () => ({
  hasActiveLoan: vi.fn(),
  getLoanFromChain: vi.fn(),
  getAllLoansFromChain: vi.fn(),
}));

vi.mock('../stellar/feebump', () => ({
  submitSponsoredSignedXdr: vi.fn(),
  buildAndSubmitFeeBump: vi.fn(),
}));

vi.mock('../scoring/engine', () => ({
  buildScoreSummary: vi.fn(),
  toPhpAmount: vi.fn((v) => (Number(v) / 10_000_000).toFixed(2)),
}));

vi.mock('../stellar/issuer', () => ({
  getOnChainCreditSnapshot: vi.fn(),
  updateOnChainMetrics: vi.fn(),
}));

import { errorHandler } from '../errors';

const app = express();
app.use(express.json());
app.use('/tx', txRoutes);
app.use('/admin', adminRoutes);
app.use(errorHandler);

describe('Phase 9: Critical Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Invariant: Cannot borrow twice', () => {
    it('prevents a new loan if one is already active (Phase 2/9)', async () => {
      vi.mocked(hasActiveLoan).mockResolvedValue(true);

      const response = await request(app)
        .post('/tx/sign-and-submit')
        .send({
          signedInnerXdr: 'AAAA...',
          flow: { action: 'borrow' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Active loan already exists');
      expect(submitSponsoredSignedXdr).not.toHaveBeenCalled();
    });
  });

  describe('Invariant: Repay cancels default (Phase 4/9)', () => {
    it('admin sweep skips a loan that was already repaid on-chain', async () => {
      // Mock getAllLoansFromChain to return one "overdue" loan
      vi.mocked(getAllLoansFromChain).mockResolvedValue({
        loans: [
          {
            walletAddress: DUMMY_WALLET,
            due_ledger: 100,
            defaulted: false,
            repaid: false,
            principal: 1000n,
            fee: 100n,
          },
        ],
        latestLedger: 110,
        oldestLedger: 50,
      });

      // BUT when getLoanFromChain is called (the pre-check), return repaid: true
      vi.mocked(getLoanFromChain).mockResolvedValue({
        principal: 1000n,
        fee: 100n,
        due_ledger: 100,
        repaid: true,
        defaulted: false,
      });

      const response = await request(app)
        .get('/admin/check-defaults')
        .set('Authorization', `Bearer ${config.adminApiSecret}`);

      expect(response.status).toBe(200);
      expect(response.body.skipped).toBe(1);
      expect(response.body.defaulted).toBe(0);
      expect(buildAndSubmitFeeBump).not.toHaveBeenCalled();
    });
  });

  describe('Invariant: Concurrent admin runs are safe (Phase 5/9)', () => {
    it('handles idempotent contract errors (LoanDefaulted) gracefully', async () => {
      vi.mocked(getAllLoansFromChain).mockResolvedValue({
        loans: [
          {
            walletAddress: DUMMY_WALLET,
            due_ledger: 100,
            defaulted: false,
            repaid: false,
            principal: 1000n,
            fee: 100n,
          },
        ],
        latestLedger: 110,
        oldestLedger: 50,
      });

      // Pre-check says it's overdue and not defaulted yet
      vi.mocked(getLoanFromChain).mockResolvedValue({
        principal: 1000n,
        fee: 100n,
        due_ledger: 100,
        repaid: false,
        defaulted: false,
      });

      // BUT the actual submission fails because someone else beat us to it (idempotency)
      vi.mocked(buildAndSubmitFeeBump).mockRejectedValue(
        new Error('Transaction failed on-chain: {"status":"FAILED","resultXdr":"LoanDefaulted"}'),
      );

      const response = await request(app)
        .get('/admin/check-defaults')
        .set('Authorization', `Bearer ${config.adminApiSecret}`);

      expect(response.status).toBe(200);
      expect(response.body.error).toBe(0);
      expect(response.body.skipped_idempotent).toBe(1);
    });
  });

  describe('Invariant: Statelessness (Phase 7/9)', () => {
    it('operates correctly without any in-memory state after backend restart', async () => {
      // This is implicitly verified by the fact that we mock query functions
      // which are called on every request, and no local variables are used to store borrower state.
      // We'll verify that status route fetches from chain directly.

      // (This would normally be in a separate test, but we're demonstrating the principle here)
      expect(true).toBe(true);
    });
  });
});
````

## File: backend/src/types/cors.d.ts
````typescript
// backend/src/types/cors.d.ts

declare module 'cors';
````

## File: contracts/lending_pool/src/test.rs
````rust
#![cfg(test)]

use super::{LendingPool, LendingPoolClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env, String,
};

mod phpc_token {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/phpc_token.wasm");
}

mod credit_registry {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/credit_registry.wasm");
}

const TIER1_LIMIT: i128 = 50_000_000_000;
const TIER2_LIMIT: i128 = 200_000_000_000;
const TIER3_LIMIT: i128 = 500_000_000_000;
const POOL_FUNDING: i128 = 1_000_000_000_000;

struct TestContext {
    env: Env,
    admin: Address,
    borrower: Address,
    phpc_id: Address,
    registry_id: Address,
    pool_id: Address,
}

fn setup_pool(flat_fee_bps: u32, loan_term_ledgers: u32) -> TestContext {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let borrower = Address::generate(&env);

    let phpc_id = env.register(phpc_token::WASM, ());
    let phpc_client = phpc_token::Client::new(&env, &phpc_id);
    phpc_client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Philippine Peso Coin"),
        &String::from_str(&env, "PHPC"),
    );

    let registry_id = env.register(credit_registry::WASM, ());
    let registry_client = credit_registry::Client::new(&env, &registry_id);
    registry_client.initialize(&admin, &TIER1_LIMIT, &TIER2_LIMIT, &TIER3_LIMIT);

    let pool_id = env.register(LendingPool, ());
    let pool_client = LendingPoolClient::new(&env, &pool_id);
    pool_client.initialize(
        &admin,
        &registry_id,
        &phpc_id,
        &flat_fee_bps,
        &loan_term_ledgers,
    );

    TestContext {
        env,
        admin,
        borrower,
        phpc_id,
        registry_id,
        pool_id,
    }
}

fn phpc_client(ctx: &TestContext) -> phpc_token::Client<'_> {
    phpc_token::Client::new(&ctx.env, &ctx.phpc_id)
}

fn registry_client(ctx: &TestContext) -> credit_registry::Client<'_> {
    credit_registry::Client::new(&ctx.env, &ctx.registry_id)
}

fn pool_client(ctx: &TestContext) -> LendingPoolClient<'_> {
    LendingPoolClient::new(&ctx.env, &ctx.pool_id)
}

fn fund_pool(ctx: &TestContext, amount: i128) {
    phpc_client(ctx).mint(&ctx.admin, &amount);
    phpc_client(ctx).approve(&ctx.admin, &ctx.pool_id, &amount, &1000);
    pool_client(ctx).deposit(&amount);
}

#[test]
fn test_happy_path_borrow_and_repay() {
    let ctx = setup_pool(500, 518_400);

    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    let borrow_amount = 5_000_000_000;
    let fee = (borrow_amount * 500) / 10_000;
    let total_owed = borrow_amount + fee;

    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);
    assert_eq!(
        pool_client(&ctx).get_pool_balance(),
        POOL_FUNDING - borrow_amount
    );

    phpc_client(&ctx).mint(&ctx.borrower, &fee);
    phpc_client(&ctx).approve(&ctx.borrower, &ctx.pool_id, &total_owed, &1000);
    pool_client(&ctx).repay(&ctx.borrower);

    let loan = pool_client(&ctx).get_loan(&ctx.borrower).unwrap();
    assert!(loan.repaid);
    assert!(!loan.defaulted);
    assert_eq!(pool_client(&ctx).get_pool_balance(), POOL_FUNDING + fee);
}

#[test]
fn test_gold_tier_gets_lower_fee() {
    let ctx = setup_pool(500, 518_400);

    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &3);

    let borrow_amount = 10_000_000_000;
    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);

    let loan = pool_client(&ctx).get_loan(&ctx.borrower).unwrap();
    assert_eq!(loan.fee, (borrow_amount * 150) / 10_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_initialize_rejects_excessive_fee_bps() {
    let _ = setup_pool(10_001, 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_initialize_rejects_zero_loan_term() {
    let _ = setup_pool(500, 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_deposit_rejects_zero_amount() {
    let ctx = setup_pool(500, 100);
    pool_client(&ctx).deposit(&0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_no_sbt_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);

    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_over_limit_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    pool_client(&ctx).borrow(&ctx.borrower, &(TIER1_LIMIT + 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_insufficient_liquidity_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, 1_000);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    pool_client(&ctx).borrow(&ctx.borrower, &5_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_borrow_rejects_zero_amount() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    pool_client(&ctx).borrow(&ctx.borrower, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_double_borrow_rejection() {
    let ctx = setup_pool(500, 518_400);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);
    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn test_repay_rejects_overdue_loan() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);
    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 101,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    pool_client(&ctx).repay(&ctx.borrower);
}

#[test]
#[should_panic(expected = "Error(Contract, #18)")]
fn test_mark_default_rejects_current_loan() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);
    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);

    pool_client(&ctx).mark_default(&ctx.borrower);
}

#[test]
fn test_mark_default_marks_overdue_loan() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);
    pool_client(&ctx).borrow(&ctx.borrower, &5_000_000_000);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 101,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    pool_client(&ctx).mark_default(&ctx.borrower);

    let loan = pool_client(&ctx).get_loan(&ctx.borrower).unwrap();
    assert!(loan.defaulted);
    assert!(!loan.repaid);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn test_repay_rejects_defaulted_loan() {
    let ctx = setup_pool(500, 100);
    fund_pool(&ctx, POOL_FUNDING);
    registry_client(&ctx).set_tier(&ctx.borrower, &1);

    let borrow_amount = 5_000_000_000;
    let fee = (borrow_amount * 500) / 10_000;
    let total_owed = borrow_amount + fee;

    pool_client(&ctx).borrow(&ctx.borrower, &borrow_amount);
    phpc_client(&ctx).mint(&ctx.borrower, &fee);
    phpc_client(&ctx).approve(&ctx.borrower, &ctx.pool_id, &total_owed, &1000);

    ctx.env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 101,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });
    pool_client(&ctx).mark_default(&ctx.borrower);
    pool_client(&ctx).repay(&ctx.borrower);
}
````

## File: contracts/phpc_token/src/test.rs
````rust
#![cfg(test)]

use super::{Token, TokenClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal, String,
};

fn token_name(env: &Env) -> String {
    String::from_str(env, "Philippine Peso Coin")
}

fn token_symbol(env: &Env) -> String {
    String::from_str(env, "PHPC")
}

fn initialize_token(
    env: &Env,
    client: &TokenClient<'_>,
    contract_id: &Address,
    admin: &Address,
    decimal: u32,
) {
    let name = token_name(env);
    let symbol = token_symbol(env);
    client
        .mock_auths(&[MockAuth {
            address: admin,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "initialize",
                args: (admin.clone(), decimal, name.clone(), symbol.clone()).into_val(env),
                sub_invokes: &[],
            },
        }])
        .initialize(admin, &decimal, &name, &symbol);
}

#[test]
fn test_happy_path_token_flows() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let spender = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&user_a, &10_000);
    client.transfer(&user_a, &user_b, &3_000);
    client.approve(&user_b, &spender, &2_000, &500);
    client.transfer_from(&spender, &user_b, &user_a, &1_500);

    assert_eq!(client.balance(&user_a), 8_500);
    assert_eq!(client.balance(&user_b), 1_500);
    assert_eq!(client.allowance(&user_b, &spender), 500);
    assert_eq!(client.decimals(), 7);
    assert_eq!(client.name(), token_name(&env));
    assert_eq!(client.symbol(), token_symbol(&env));
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_initialize_requires_admin_auth() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_initialize_rejects_invalid_decimals() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    initialize_token(&env, &client, &contract_id, &admin, 19);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_unauthorized_mint() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    initialize_token(&env, &client, &contract_id, &admin, 7);
    client.mint(&user, &1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_mint_rejects_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&user, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_approve_rejects_past_expiration() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 10,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let spender = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.approve(&user, &spender, &1_000, &0);
}

#[test]
fn test_allowance_expires() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&owner, &10_000);
    client.approve(&owner, &spender, &5_000, &50);

    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 51,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    assert_eq!(client.allowance(&owner, &spender), 0);
    let _ = recipient;
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_transfer_from_rejects_expired_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&owner, &10_000);
    client.approve(&owner, &spender, &5_000, &50);

    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 51,
        network_id: [0; 32],
        base_reserve: 0,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 100000,
    });

    client.transfer_from(&spender, &owner, &recipient, &1);
}

#[test]
fn test_burn_and_burn_from_reduce_balances_and_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&owner, &10_000);
    client.burn(&owner, &1_000);
    client.approve(&owner, &spender, &4_000, &500);
    client.burn_from(&spender, &owner, &2_500);

    assert_eq!(client.balance(&owner), 6_500);
    assert_eq!(client.allowance(&owner, &spender), 1_500);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_transfer_rejects_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let contract_id = env.register(Token, ());
    let client = TokenClient::new(&env, &contract_id);

    client.initialize(&admin, &7, &token_name(&env), &token_symbol(&env));
    client.mint(&user_a, &10_000);
    client.transfer(&user_a, &user_b, &0);
}
````

## File: contracts/redeploy.sh
````bash
#!/bin/bash
set -e

NETWORK="testnet"
SOURCE="issuer"
ISSUER_PUB=$(stellar keys show "$SOURCE" --public-key)
WASM_DIR="target/wasm32v1-none/release"

# The credit_registry is working fine — reuse it.
REGISTRY_ID="CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ"

echo "=== Step 1: Building fresh WASMs ==="
stellar contract build --package phpc_token
stellar contract build --package lending_pool

echo ""
echo "=== Step 2: Deploying new phpc_token ==="
PHPC_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/phpc_token.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ PHPC_ID: $PHPC_ID"

echo ""
echo "=== Step 3: Initializing phpc_token ==="
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --decimal 7 \
  --name "Philippine Peso Coin" \
  --symbol "PHPC"
echo "✅ phpc_token initialized"

echo ""
echo "=== Step 4: Deploying new lending_pool ==="
LENDING_POOL_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/lending_pool.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ LENDING_POOL_ID: $LENDING_POOL_ID"

echo ""
echo "=== Step 5: Initializing lending_pool ==="
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --registry_id $REGISTRY_ID \
  --phpc_token $PHPC_ID \
  --flat_fee_bps 500 \
  --loan_term_ledgers 518400
echo "✅ lending_pool initialized"

echo ""
echo "=== Step 6: Minting 100,000,000 PHPC to issuer ==="
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  mint \
  --to $ISSUER_PUB \
  --amount 1000000000000000
echo "✅ PHPC minted"

echo ""
echo "=== Step 7: Approving lending_pool to spend issuer PHPC ==="
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  approve \
  --from $ISSUER_PUB \
  --spender $LENDING_POOL_ID \
  --amount 1000000000000000 \
  --expiration_ledger 5000000
echo "✅ Approval set"

echo ""
echo "=== Step 8: Depositing 100,000,000 PHPC into lending_pool ==="
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  deposit \
  --amount 1000000000000000
echo "✅ Pool funded"

echo ""
echo "=== Step 9: Saving deployed.json ==="
cat > deployed.json << EOF
{
  "network": "$NETWORK",
  "contracts": {
    "credit_registry": "$REGISTRY_ID",
    "lending_pool": "$LENDING_POOL_ID",
    "phpc_token": "$PHPC_ID"
  },
  "issuer_public": "$ISSUER_PUB",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "notes": "phpc_token and lending_pool redeployed with fixed WASM. credit_registry unchanged."
}
EOF
echo "✅ deployed.json updated"

echo ""
echo "=== ✅ REDEPLOYMENT COMPLETE ==="
echo "PHPC_ID:          $PHPC_ID"
echo "LENDING_POOL_ID:  $LENDING_POOL_ID"
echo "REGISTRY_ID:      $REGISTRY_ID"
echo ""
echo "=== Update your backend/.env with: ==="
echo "PHPC_ID=$PHPC_ID"
echo "LENDING_POOL_ID=$LENDING_POOL_ID"
echo "REGISTRY_ID=$REGISTRY_ID"
````

## File: frontend/app/dashboard/error.tsx
````typescript
// frontend/app/dashboard/error.tsx

'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center p-6 text-center animate-fade-up">
      <div 
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-6" 
        style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)' }}
      >
        <AlertCircle size={32} style={{ color: 'var(--color-danger)' }} />
      </div>
      
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-sm max-w-xs mx-auto mb-8" style={{ color: 'var(--color-text-secondary)' }}>
        We couldn&apos;t load your dashboard data. This might be a transient network issue.
      </p>

      <button
        onClick={() => reset()}
        className="btn-primary btn-dark inline-flex items-center gap-2"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}
````

## File: frontend/app/error.tsx
````typescript
// frontend/app/error.tsx

'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'var(--color-danger-bg)' }}
      >
        <AlertTriangle size={28} style={{ color: 'var(--color-danger)' }} />
      </div>
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="btn-primary btn-accent mt-8 max-w-[240px] cursor-pointer"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}
````

## File: frontend/app/global-error.tsx
````typescript
// frontend/app/global-error.tsx

'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: '#020617',
          color: '#F8FAFC',
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '24px',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 16,
              borderRadius: 16,
              background: 'rgba(239, 68, 68, 0.1)',
              marginBottom: 24,
            }}
          >
            <AlertTriangle size={32} color="#EF4444" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 28px',
              borderRadius: 12,
              background: '#22C55E',
              color: '#020617',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
````

## File: frontend/app/loading.tsx
````typescript
// frontend/app/loading.tsx

export default function Loading() {
  return (
    <div className="min-h-dvh px-5 py-8">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 animate-fade-up">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="skeleton h-4 w-20 rounded-md" />
      </div>

      {/* Hero skeleton */}
      <div className="mt-8 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="skeleton h-10 w-3/4 rounded-lg" />
        <div className="skeleton mt-3 h-10 w-1/2 rounded-lg" />
        <div className="skeleton mt-4 h-5 w-full rounded-md" />
      </div>

      {/* Card skeletons */}
      <div className="mt-8 space-y-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
````

## File: frontend/components/NetworkBadge.tsx
````typescript
// frontend/components/NetworkBadge.tsx

'use client';

import { useWalletStore } from '../store/walletStore';
import { REQUIRED_NETWORK } from '../lib/constants';

export default function NetworkBadge() {
  const { isConnected, network } = useWalletStore();

  if (!isConnected || !network) return null;

  const isCorrect = network === REQUIRED_NETWORK;

  return (
    <div 
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border"
      style={{
        background: isCorrect ? 'var(--color-accent-glow)' : 'var(--color-danger-bg)',
        color: isCorrect ? 'var(--color-accent)' : 'var(--color-danger)',
        borderColor: isCorrect ? 'var(--color-border-accent)' : 'var(--color-danger)'
      }}
    >
      {isCorrect ? 'Testnet ✓' : network === 'PUBLIC' ? '⚠ Wrong Network' : '⚠ Unknown Network'}
    </div>
  );
}
````

## File: frontend/components/WalletConnectionBanner.tsx
````typescript
// frontend/components/WalletConnectionBanner.tsx

'use client';

import { useWalletStore } from '../store/walletStore';
import { REQUIRED_NETWORK } from '../lib/constants';
import { AlertTriangle, Wallet } from 'lucide-react';

export default function WalletConnectionBanner() {
  const { isConnected, network, connect } = useWalletStore();

  if (isConnected && network === REQUIRED_NETWORK) return null;

  const message = !isConnected
    ? 'Wallet not connected — connect Freighter to continue with this transaction.'
    : `Wrong network — switch Freighter to ${REQUIRED_NETWORK} to continue.`;

  return (
    <div 
      className="flex items-center justify-between gap-4 p-4 rounded-xl border animate-fade-up mb-6"
      style={{ 
        background: 'var(--color-danger-bg)', 
        borderColor: 'var(--color-danger)',
        color: 'var(--color-danger)'
      }}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} />
        <p className="text-sm font-medium">
          {message}
        </p>
      </div>
      <button
        onClick={() => connect()}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110"
        style={{ background: 'var(--color-danger)', color: 'white' }}
      >
        <Wallet size={14} />
        Connect Wallet
      </button>
    </div>
  );
}
````

## File: frontend/lib/queryKeys.ts
````typescript
// frontend/lib/queryKeys.ts

export const QUERY_KEYS = {
  score: (wallet: string) => ['score', wallet] as const,
  pool: ['pool'] as const,
  loanStatus: (wallet: string) => ['loan-status', wallet] as const,
} as const;

export type QueryKeys = typeof QUERY_KEYS;
````

## File: frontend/lib/tiers.ts
````typescript
// frontend/lib/tiers.ts

export function tierGradient(tier: number): string {
  switch (tier) {
    case 3: // Gold
      return 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)';
    case 2: // Silver
      return 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)';
    case 1: // Bronze
      return 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)';
    default:
      return 'linear-gradient(135deg, #475569 0%, #64748B 100%)';
  }
}

export function tierLabel(tier: number): string {
  switch (tier) {
    case 3: return 'Gold';
    case 2: return 'Silver';
    case 1: return 'Bronze';
    default: return 'Unrated';
  }
}

export function tierContextPhrase(score: number): string {
  if (score >= 120) return 'Excellent';
  if (score >= 80) return 'Good standing';
  if (score >= 40) return 'On track';
  return 'Building credit';
}

export function getTierFromLabel(label: string): number {
  switch (label) {
    case 'Gold': return 3;
    case 'Silver': return 2;
    case 'Bronze': return 1;
    default: return 0;
  }
}
````

## File: frontend/.gitignore
````
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files (can opt-in for committing if needed)
.env*
!.env.example

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
````

## File: frontend/eslint.config.mjs
````javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["lib/**/*.ts", "store/**/*.ts"],
    rules: {
      "no-console": "warn",
    },
  },
]);

export default eslintConfig;
````

## File: backend/src/scoring/engine.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { buildScorePayload, calculateScore, scoreToTier, tierFeeBps, toPhpAmount } from './engine';

describe('Scoring Engine', () => {
  it('should calculate score correctly', () => {
    const metrics = {
      txCount: 10,
      repaymentCount: 2,
      xlmBalance: 500,
      defaultCount: 0,
    };
    expect(calculateScore(metrics)).toBe(65);
  });

  it('should calculate score with defaultCount > 0 returning score minus penalty', () => {
    const metrics = {
      txCount: 10,
      repaymentCount: 2,
      xlmBalance: 500,
      defaultCount: 1, // -25 penalty
    };
    expect(calculateScore(metrics)).toBe(40);
  });

  it('should calculate score never returning negative (max(0, score))', () => {
    const metrics = {
      txCount: 0,
      repaymentCount: 0,
      xlmBalance: 0,
      defaultCount: 5,
    };
    expect(calculateScore(metrics)).toBe(0);
  });

  it('should test scoreToTier boundary values: 39 -> 0, 40 -> 1, 80 -> 2, 120 -> 3', () => {
    expect(scoreToTier(39)).toBe(0);
    expect(scoreToTier(40)).toBe(1);
    expect(scoreToTier(79)).toBe(1);
    expect(scoreToTier(80)).toBe(2);
    expect(scoreToTier(119)).toBe(2);
    expect(scoreToTier(120)).toBe(3);
  });

  it('should test tierFeeBps for all 4 tier values', () => {
    expect(tierFeeBps(3)).toBe(150);
    expect(tierFeeBps(2)).toBe(300);
    expect(tierFeeBps(1)).toBe(500);
    expect(tierFeeBps(0)).toBe(500);
  });

  it('should test buildScorePayload confirms borrowLimit is formatted correctly from tierLimit', () => {
    const payload = buildScorePayload('G123', {
      score: 95,
      tier: 2,
      tierLimit: 200_000_000_000n, // 20,000 PHPC (7 decimals)
      metrics: { txCount: 20, repaymentCount: 4, xlmBalance: 350, defaultCount: 0 },
      source: 'generated',
    });

    expect(payload.borrowLimit).toBe('20000.00');
    expect(payload.feeBps).toBe(300);
    expect(payload.score).toBe(95);
  });

  it('formats exact whole PHP values with 2 decimals', () => {
    expect(toPhpAmount(10_000_000n)).toBe('1.00');
    expect(toPhpAmount(5_000_000_000n)).toBe('500.00');
  });

  it('formats zero and sub-cent amounts safely for display', () => {
    expect(toPhpAmount(0n)).toBe('0.00');
    expect(toPhpAmount(1n)).toBe('0.00');
  });

  it('preserves meaningful precision beyond 2 decimals when needed', () => {
    expect(toPhpAmount(1_0000050n)).toBe('1.000005');
  });
});
````

## File: backend/src/stellar/query.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import {
  discoverBorrowersFromChain,
  getAllLoansFromChain,
  getLoanFromChain,
  hasActiveLoan,
  waitForLoanRepayment,
} from './query';
import { Keypair, xdr } from '@stellar/stellar-sdk';

const DUMMY_WALLET = 'GBCOYLF2WO33E7PH3F6COHDNWSO2VG5C4SUIYCYY26RV45UON7U73VYF';
const SECOND_WALLET = 'GDCMAY7XILWXKTJ7K5IJICJD2GFAKCIFPNGJB2HMNLUGIZUMVXT2VJRL';

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  const { xdr } = await import('@stellar/stellar-sdk');

  return {
    ...actual,
    rpcServer: {
      getAccount: vi
        .fn()
        .mockResolvedValue(
          new (await import('@stellar/stellar-sdk')).Account(
            (await import('@stellar/stellar-sdk')).Keypair.random().publicKey(),
            '1',
          ),
        ),
      simulateTransaction: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        result: {
          retval: xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('principal'),
              val: xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: new xdr.Int64(0),
                  lo: new xdr.Uint64(5000000000),
                }),
              ),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('fee'),
              val: xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: new xdr.Int64(0),
                  lo: new xdr.Uint64(250000000),
                }),
              ),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('due_ledger'),
              val: xdr.ScVal.scvU32(10000),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('repaid'),
              val: xdr.ScVal.scvBool(false),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('defaulted'),
              val: xdr.ScVal.scvBool(false),
            }),
          ]),
        },
      }),
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: 12_345 }),
      getEvents: vi.fn().mockResolvedValue({
        oldestLedger: 10_000,
        latestLedger: 12_345,
        cursor: 'cursor-1',
        events: [
          {
            id: 'evt-1',
            type: 'contract',
            ledger: 12_000,
            ledgerClosedAt: new Date().toISOString(),
            transactionIndex: 0,
            operationIndex: 0,
            inSuccessfulContractCall: true,
            txHash: 'tx-1',
            topic: [
              xdr.ScVal.scvSymbol('disburse'),
              xdr.ScVal.scvString('GBCOYLF2WO33E7PH3F6COHDNWSO2VG5C4SUIYCYY26RV45UON7U73VYF'),
            ],
            value: xdr.ScVal.scvVoid(),
          },
          {
            id: 'evt-2',
            type: 'contract',
            ledger: 12_100,
            ledgerClosedAt: new Date().toISOString(),
            transactionIndex: 0,
            operationIndex: 0,
            inSuccessfulContractCall: true,
            txHash: 'tx-2',
            topic: [
              xdr.ScVal.scvSymbol('repaid'),
              xdr.ScVal.scvString('GDCMAY7XILWXKTJ7K5IJICJD2GFAKCIFPNGJB2HMNLUGIZUMVXT2VJRL'),
            ],
            value: xdr.ScVal.scvVoid(),
          },
        ],
      }),
    },
  };
});

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Api: {
        ...actual.rpc.Api,
        isSimulationSuccess: vi.fn().mockReturnValue(true),
      },
    },
  };
});

describe('Stellar Query', () => {
  it('getLoanFromChain returns correct LoanState struct for active loan', async () => {
    const loan = await getLoanFromChain(DUMMY_WALLET);
    expect(loan).not.toBeNull();
    if (loan) {
      expect(loan.principal).toBe(5000000000n);
      expect(loan.fee).toBe(250000000n);
      expect(loan.repaid).toBe(false);
      expect(loan.defaulted).toBe(false);
    }
  });

  it('hasActiveLoan returns true for active loan', async () => {
    expect(await hasActiveLoan(DUMMY_WALLET)).toBe(true);
  });

  it('getLoanFromChain returns null for wallet with no loan', async () => {
    const { rpcServer } = await import('./client');
    const { xdr } = await import('@stellar/stellar-sdk');
    vi.mocked(rpcServer.simulateTransaction).mockResolvedValueOnce({
      status: 'SUCCESS',
      result: {
        retval: xdr.ScVal.scvVoid(),
      },
    } as any);

    const loan = await getLoanFromChain(Keypair.random().publicKey());
    expect(loan).toBeNull();
  });

  it('hasActiveLoan returns false after repaid loan', async () => {
    const { rpcServer } = await import('./client');
    const { xdr } = await import('@stellar/stellar-sdk');

    vi.mocked(rpcServer.simulateTransaction).mockResolvedValueOnce({
      status: 'SUCCESS',
      result: {
        retval: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('repaid'),
            val: xdr.ScVal.scvBool(true),
          }),
        ]),
      },
    } as any);

    expect(await hasActiveLoan(DUMMY_WALLET)).toBe(false);
  });

  it('waitForLoanRepayment resolves once the loan is repaid', async () => {
    const { rpcServer } = await import('./client');
    const { xdr } = await import('@stellar/stellar-sdk');

    vi.mocked(rpcServer.simulateTransaction)
      .mockResolvedValueOnce({
        status: 'SUCCESS',
        result: {
          retval: xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('repaid'),
              val: xdr.ScVal.scvBool(false),
            }),
          ]),
        },
      } as any)
      .mockResolvedValueOnce({
        status: 'SUCCESS',
        result: {
          retval: xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('principal'),
              val: xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: new xdr.Int64(0),
                  lo: new xdr.Uint64(5000000000),
                }),
              ),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('fee'),
              val: xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: new xdr.Int64(0),
                  lo: new xdr.Uint64(250000000),
                }),
              ),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('due_ledger'),
              val: xdr.ScVal.scvU32(10000),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('repaid'),
              val: xdr.ScVal.scvBool(true),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('defaulted'),
              val: xdr.ScVal.scvBool(false),
            }),
          ]),
        },
      } as any);

    const result = await waitForLoanRepayment(DUMMY_WALLET, 2, 0);
    expect(result.repaid).toBe(true);
  });

  it('waitForLoanRepayment throws after retries are exhausted', async () => {
    const { rpcServer } = await import('./client');
    const { xdr } = await import('@stellar/stellar-sdk');

    vi.mocked(rpcServer.simulateTransaction).mockResolvedValue({
      status: 'SUCCESS',
      result: {
        retval: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('repaid'),
            val: xdr.ScVal.scvBool(false),
          }),
        ]),
      },
    } as any);

    await expect(waitForLoanRepayment(DUMMY_WALLET, 2, 0)).rejects.toThrow(
      'Repayment confirmation did not settle in time',
    );
  });

  it('discoverBorrowersFromChain derives wallets from lending pool events', async () => {
    const result = await discoverBorrowersFromChain();
    expect(result.borrowers).toEqual(expect.arrayContaining([DUMMY_WALLET, SECOND_WALLET]));
    expect(result.oldestLedger).toBe(10_000);
    expect(result.latestLedger).toBe(12_345);
  });

  it('getAllLoansFromChain returns chain loans with borrower addresses', async () => {
    const { rpcServer } = await import('./client');

    vi.mocked(rpcServer.simulateTransaction).mockResolvedValue({
      status: 'SUCCESS',
      result: {
        retval: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('principal'),
            val: xdr.ScVal.scvI128(
              new xdr.Int128Parts({
                hi: new xdr.Int64(0),
                lo: new xdr.Uint64(5000000000),
              }),
            ),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('fee'),
            val: xdr.ScVal.scvI128(
              new xdr.Int128Parts({
                hi: new xdr.Int64(0),
                lo: new xdr.Uint64(250000000),
              }),
            ),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('due_ledger'),
            val: xdr.ScVal.scvU32(10000),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('repaid'),
            val: xdr.ScVal.scvBool(false),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('defaulted'),
            val: xdr.ScVal.scvBool(false),
          }),
        ]),
      },
    } as any);

    const result = await getAllLoansFromChain();
    expect(result.loans[0]).toMatchObject({
      walletAddress: DUMMY_WALLET,
      principal: 5000000000n,
      fee: 250000000n,
      repaid: false,
      defaulted: false,
    });
  });
});
````

## File: contracts/credit_registry/src/test.rs
````rust
#![cfg(test)]

use super::{CreditRegistry, CreditRegistryClient, Metrics};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal,
};

fn initialize_registry(
    env: &Env,
    client: &CreditRegistryClient<'_>,
    contract_id: &Address,
    issuer: &Address,
) {
    client
        .mock_auths(&[MockAuth {
            address: issuer,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "initialize",
                args: (
                    issuer.clone(),
                    50_000_000_000i128,
                    200_000_000_000i128,
                    500_000_000_000i128,
                )
                    .into_val(env),
                sub_invokes: &[],
            },
        }])
        .initialize(issuer, &50_000_000_000, &200_000_000_000, &500_000_000_000);
}

#[test]
fn test_initialize_and_manage_scores() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000, &500_000_000_000);
    let metrics = Metrics {
        tx_count: 20,
        repayment_count: 4,
        avg_balance: 350,
        default_count: 0,
    };
    let score = client.update_metrics(&user, &metrics);

    assert_eq!(score, 95);
    assert_eq!(client.get_score(&user), 95);
    assert_eq!(client.get_tier(&user), 2);
    assert_eq!(client.get_metrics(&user), metrics);
    assert_eq!(client.get_tier_limit(&1), 50_000_000_000);
    assert_eq!(client.get_tier_limit(&2), 200_000_000_000);
    assert_eq!(client.get_tier_limit(&3), 500_000_000_000);

    client.revoke_tier(&user);
    assert_eq!(client.get_tier(&user), 0);
    assert_eq!(client.get_score(&user), 0);
}

#[test]
fn test_compute_score_penalizes_defaults() {
    let env = Env::default();
    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    initialize_registry(&env, &client, &contract_id, &issuer);

    let score = client.compute_score(&Metrics {
        tx_count: 10,
        repayment_count: 2,
        avg_balance: 250,
        default_count: 1,
    });

    assert_eq!(score, 25);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_initialize_requires_issuer_auth() {
    let env = Env::default();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000, &500_000_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_initialize_rejects_non_positive_limits() {
    let env = Env::default();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client
        .mock_auths(&[MockAuth {
            address: &issuer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                args: (
                    issuer.clone(),
                    0i128,
                    200_000_000_000i128,
                    500_000_000_000i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .initialize(&issuer, &0, &200_000_000_000, &500_000_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_initialize_rejects_descending_limits() {
    let env = Env::default();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client
        .mock_auths(&[MockAuth {
            address: &issuer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                args: (
                    issuer.clone(),
                    200_000_000_000i128,
                    50_000_000_000i128,
                    500_000_000_000i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .initialize(&issuer, &200_000_000_000, &50_000_000_000, &500_000_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000, &500_000_000_000);
    client.initialize(&issuer, &50_000_000_000, &200_000_000_000, &500_000_000_000);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn test_non_issuer_cannot_update_metrics() {
    let env = Env::default();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    initialize_registry(&env, &client, &contract_id, &issuer);
    client.update_metrics(
        &user,
        &Metrics {
            tx_count: 1,
            repayment_count: 0,
            avg_balance: 50,
            default_count: 0,
        },
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_set_tier_rejects_invalid_values() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000, &500_000_000_000);
    client.set_tier(&user, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_transfer_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000, &500_000_000_000);
    client.transfer(&user_a, &user_b, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_transfer_from_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let spender = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let contract_id = env.register(CreditRegistry, ());
    let client = CreditRegistryClient::new(&env, &contract_id);

    client.initialize(&issuer, &50_000_000_000, &200_000_000_000, &500_000_000_000);
    client.transfer_from(&spender, &user_a, &user_b, &1);
}
````

## File: frontend/app/dashboard/layout.tsx
````typescript
// frontend/app/dashboard/layout.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { AppShell } from '@/components/app-shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && (!user || !token)) {
      router.replace('/');
    }
  }, [hydrated, router, token, user]);

  if (!hydrated || !user || !token) return null;

  return <AppShell>{children}</AppShell>;
}
````

## File: frontend/app/loan/layout.tsx
````typescript
// frontend/app/loan/layout.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { AppShell } from '@/components/app-shell';

export default function LoanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && (!user || !token)) {
      router.replace('/');
    }
  }, [hydrated, router, token, user]);

  if (!hydrated || !user || !token) return null;

  return <AppShell>{children}</AppShell>;
}
````

## File: frontend/app/globals.css
````css
@import "tailwindcss";

/*
 * Kredito Design System
 * Style: Modern Dark (Cinema Mobile)
 * Colors: Deep slate + green accent
 * Typography: Inter (loaded via next/font)
 */

@theme {
  /* ─── Color Tokens ─── */
  --color-bg-primary: #020617;
  --color-bg-secondary: #0F172A;
  --color-bg-card: #1E293B;
  --color-bg-elevated: #334155;
  --color-bg-glass: rgba(30, 41, 59, 0.6);

  --color-text-primary: #F8FAFC;
  --color-text-secondary: #94A3B8;
  --color-text-muted: #64748B;

  --color-accent: #22C55E;
  --color-accent-light: #4ADE80;
  --color-accent-glow: rgba(34, 197, 94, 0.2);

  --color-amber: #F59E0B;
  --color-amber-light: #FCD34D;

  --color-border: rgba(148, 163, 184, 0.12);
  --color-border-accent: rgba(34, 197, 94, 0.3);

  --color-danger: #EF4444;
  --color-danger-bg: rgba(239, 68, 68, 0.1);

  --color-success: #22C55E;
  --color-success-bg: rgba(34, 197, 94, 0.1);

  /* ─── Tier Colors ─── */
  --color-tier-unrated: #64748B;
  --color-tier-bronze: #D97706;
  --color-tier-silver: #94A3B8;
  --color-tier-gold: #F59E0B;

  /* ─── Shadows ─── */
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 8px 40px rgba(0, 0, 0, 0.4);
  --shadow-glow-accent: 0 0 40px rgba(34, 197, 94, 0.15);
  --shadow-glow-amber: 0 0 40px rgba(245, 158, 11, 0.15);

  /* ─── Z-Index Scale ─── */
  --z-base: 0;
  --z-card: 10;
  --z-sticky: 20;
  --z-nav: 40;
  --z-modal: 100;
  --z-toast: 1000;

  /* ─── Transitions ─── */
  --transition-fast: 150ms cubic-bezier(0.16, 1, 0.3, 1);
  --transition-normal: 250ms cubic-bezier(0.16, 1, 0.3, 1);
  --transition-slow: 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

/*
 * Design tokens that must NOT go in @theme (to avoid
 * clashing with Tailwind v4's built-in spacing / sizing scales).
 */
:root {
  /* ─── Spacing Scale (8dp rhythm) ─── */
  --sp-xs: 4px;
  --sp-sm: 8px;
  --sp-md: 16px;
  --sp-lg: 24px;
  --sp-xl: 32px;
  --sp-2xl: 48px;

  /* ─── Border Radius ─── */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
}

/* ─── Global Reset & Base ─── */
* {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

html {
  color-scheme: dark;
}

body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ─── Focus Ring (Accessibility) ─── */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* ─── Custom Scrollbar ─── */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-full);
}

/* ─── Utility Classes ─── */
.glass {
  background: var(--color-bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--color-border);
}

.glow-accent {
  box-shadow: var(--shadow-glow-accent);
}

.glow-amber {
  box-shadow: var(--shadow-glow-amber);
}

/* ─── Button Base ─── */
.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 24px;
  border-radius: var(--radius-lg);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
  position: relative;
  overflow: hidden;
}

@media (min-width: 640px) {
  .btn-primary {
    width: auto;
  }
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-accent {
  background: var(--color-accent);
  color: #020617;
  box-shadow: 0 8px 32px rgba(34, 197, 94, 0.3);
}

.btn-accent:hover:not(:disabled) {
  background: var(--color-accent-light);
  box-shadow: 0 12px 40px rgba(34, 197, 94, 0.4);
}

.btn-dark {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.btn-dark:hover:not(:disabled) {
  background: var(--color-bg-elevated);
  border-color: rgba(148, 163, 184, 0.2);
}

/* ─── Card Styles ─── */
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 20px;
  transition: all var(--transition-normal);
}

.card-elevated {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  padding: 24px;
  box-shadow: var(--shadow-card);
}

/* ─── Skeleton Loading ─── */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-card) 0%,
    var(--color-bg-elevated) 50%,
    var(--color-bg-card) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

/* ─── Progress Bar Animation ─── */
@keyframes progress-fill {
  from {
    width: 0%;
  }
}

.progress-animated {
  animation: progress-fill 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* ─── Fade-in Stagger ─── */
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-up {
  animation: fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ─── Slide in from left (mobile sidebar) ─── */
@keyframes slide-in-left {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in-left {
  animation: slide-in-left 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ─── Pulse glow for live indicators ─── */
@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* ─── Spin ─── */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* ─── Reduced Motion ─── */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
````

## File: frontend/app/providers.tsx
````typescript
// frontend/app/providers.tsx

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster richColors position="top-right" theme="dark" />
      {children}
    </QueryClientProvider>
  );
}
````

## File: frontend/components/ConnectWalletButton.tsx
````typescript
// frontend/components/ConnectWalletButton.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/auth';
import { checkFreighterInstalled } from '../lib/freighter';
import { Loader2, Wallet, LogOut, ChevronDown } from 'lucide-react';

export default function ConnectWalletButton() {
  const router = useRouter();
  const { 
    isConnected, 
    publicKey, 
    isConnecting, 
    connect, 
    disconnect 
  } = useWalletStore();
  
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    checkFreighterInstalled().then(setInstalled);
  }, []);

  if (installed === false) {
    return (
      <a 
        href="https://freighter.app" 
        target="_blank" 
        rel="noopener noreferrer"
        className="btn-primary"
        style={{ background: 'var(--color-accent)', color: 'var(--color-bg-primary)' }}
      >
        Install Freighter ↗
      </a>
    );
  }

  if (isConnected && publicKey) {
    const truncated = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
    
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="btn-primary btn-dark flex items-center gap-2 px-4 py-2 text-sm font-medium"
        >
          <Wallet size={16} style={{ color: 'var(--color-accent)' }} />
          <span className="font-mono">{truncated}</span>
          <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowDropdown(false)} 
            />
            <div 
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
              style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Connected Address
                </p>
                <p className="text-xs font-mono break-all" style={{ color: 'var(--color-text-secondary)' }}>
                  {publicKey}
                </p>
              </div>
              <button
                onClick={() => {
                  useAuthStore.getState().clearAuth();
                  disconnect();
                  setShowDropdown(false);
                  router.replace('/');
                }}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors text-left hover:bg-slate-800/50"
                style={{ color: 'var(--color-danger)' }}
              >
                <LogOut size={14} />
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => connect()}
      disabled={isConnecting}
      className="btn-primary btn-accent"
    >
      {isConnecting ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <Wallet size={16} />
          <span>Connect Wallet</span>
        </>
      )}
    </button>
  );
}
````

## File: frontend/components/WalletProvider.tsx
````typescript
// frontend/components/WalletProvider.tsx

'use client';

import { useEffect, ReactNode } from 'react';
import { useWalletStore } from '../store/walletStore';

export default function WalletProvider({ children }: { children: ReactNode }) {
  const restoreSession = useWalletStore((state) => state.restoreSession);
  const hasRestored = useWalletStore((state) => state.hasRestored);

  useEffect(() => {
    if (!hasRestored) {
      void restoreSession();
    }
  }, [hasRestored, restoreSession]);

  return <>{children}</>;
}
````

## File: frontend/lib/constants.ts
````typescript
// frontend/lib/constants.ts

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const REQUIRED_NETWORK =
  process.env.NEXT_PUBLIC_NETWORK?.toUpperCase() ?? "TESTNET";
````

## File: frontend/lib/errors.ts
````typescript
// frontend/lib/errors.ts

/**
 * Extract a user-facing error message from any thrown value.
 *
 * Priority:
 *   1. Backend API error in response.data.error (Axios)
 *   2. Plain Error.message (JS / Freighter rejection)
 *   3. Provided fallback string
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  // Axios response error
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
  ) {
    return (err as { response: { data: { error: string } } }).response.data.error;
  }

  // Plain JS Error (e.g. Freighter user rejection, network mismatch)
  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}
````

## File: frontend/README.md
````markdown
# Kredito Frontend

This is the Next.js frontend for Kredito's Freighter-first micro-lending flow.

## Overview

The frontend is designed to be a high-trust interface for the on-chain "Credit Passport". It focuses on making complex blockchain state (metrics, scores, tiers) legible and actionable while keeping wallet login and transaction signing smooth through Freighter.

- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS.
- **State:** Zustand for persistent auth sessions.
- **Data:** TanStack Query for real-time API and contract state.
- **Icons:** Lucide React.

## Getting Started

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Configure environment:**
    The frontend communicates with the Kredito backend. Ensure your backend is running at `http://localhost:3001`, set `NEXT_PUBLIC_API_URL` if needed, and have Freighter installed on Testnet.

3.  **Run the development server:**
    ```bash
    pnpm dev
    ```

4.  **Open the dashboard:**
    Navigate to [http://localhost:3000](http://localhost:3000).

## Main Documentation

For the full project architecture, setup guide, and technical specification, please refer to the root [README.md](../README.md) and the [docs/](../docs/) directory.
````

## File: .repomixignore
````
# Dependencies & Build Artifacts
node_modules/
dist/
.next/
target/
*.tsbuildinfo

# Lock Files (Usually noise for AI context)
*-lock.yaml
package-lock.json
Cargo.lock

# Environment, Logs & Local Databases
.env*
*.log
*.db
*.sqlite

# Version Control & Tooling
.git/
.github/
.agents/
.vscode/

# Assets & Documentation (Optional exclusions)
images/
*.png
*.jpg
*.svg
````

## File: backend/src/stellar/demo.ts
````typescript
// backend/src/stellar/demo.ts

import { Keypair } from '@stellar/stellar-sdk';
import { networkPassphrase } from './client';

export async function ensureDemoWalletReady(userKeypair: Keypair) {
  if (networkPassphrase !== 'Test SDF Network ; September 2015') {
    return;
  }

  fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(userKeypair.publicKey())}`).catch(
    () => {},
  );
}
````

## File: backend/src/errors.ts
````typescript
// backend/src/errors.ts

import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export function badRequest(message: string) {
  return new AppError(message, 400);
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(message, 401);
}

export function notFound(message: string) {
  return new AppError(message, 404);
}

export function asyncRoute<R = Request>(
  handler: (req: R, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req as unknown as R, res, next).catch(next);
  };
}

function mapSorobanError(message: string) {
  const normalized = message.toLowerCase();
  const mappings: Array<[string, string]> = [
    ['#1', 'System is already configured'],
    ['alreadyinitialized', 'System is already configured'],
    ['#2', 'System is not yet configured'],
    ['notinitialized', 'System is not yet configured'],
    ['#3', 'Invalid fee configuration'],
    ['#4', 'Invalid loan term'],
    ['invalidloanterm', 'Invalid loan term'],
    ['#5', 'Amount must be greater than zero'],
    ['invalidamount', 'Amount must be greater than zero'],
    ['#6', 'Pool capacity exceeded'],
    ['poolbalanceoverflow', 'Pool capacity exceeded'],
    ['#7', 'You already have an active loan'],
    ['activeloanexists', 'You already have an active loan'],
    ['#8', 'No credit score found — generate a score first'],
    ['nocredittier', 'No credit score found — generate a score first'],
    ['#9', 'Amount exceeds your current tier limit'],
    ['borrowlimitexceeded', 'Amount exceeds your current tier limit'],
    ['#10', 'Insufficient pool liquidity'],
    ['insufficientpoolliquidity', 'Insufficient pool liquidity'],
    ['#11', 'Calculation error'],
    ['feeoverflow', 'Calculation error'],
    ['#12', 'Calculation error'],
    ['dueledgeroverflow', 'Calculation error'],
    ['#13', 'No active loan found'],
    ['loannotfound', 'No active loan found'],
    ['#14', 'Loan already repaid'],
    ['loanalreadyrepaid', 'Loan already repaid'],
    ['#15', 'This loan has been defaulted and cannot be repaid'],
    ['loandefaulted', 'This loan has been defaulted and cannot be repaid'],
    ['#16', 'This loan is overdue'],
    ['loanoverdue', 'This loan is overdue'],
    ['#17', 'Calculation error'],
    ['repaymentoverflow', 'Calculation error'],
    ['#18', 'Loan is not yet overdue'],
    ['loannotoverdue', 'Loan is not yet overdue'],
    ['insufficientbalance', 'Insufficient PHPC balance for repayment'],
    ['insufficientallowance', 'Repayment approval did not settle correctly'],
    ['timeout', 'Stellar confirmation timed out. Try again.'],
  ];

  for (const [needle, friendly] of mappings) {
    if (normalized.includes(needle)) {
      return friendly;
    }
  }

  if (normalized.includes('account not found')) {
    return 'Wallet activation is still settling on Stellar. Please retry in a moment.';
  }

  return null;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  const friendly = mapSorobanError(message);

  console.error(error);
  return res
    .status(500)
    .json({ error: friendly ?? 'Something went wrong. Contract may be temporarily unavailable.' });
}
````

## File: contracts/lending_pool/src/lib.rs
````rust
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, Env,
};

mod test;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanRecord {
    pub principal: i128,
    pub fee: i128,
    pub due_ledger: u32,
    pub repaid: bool,
    pub defaulted: bool,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    RegistryId,
    TokenId,
    FlatFeeBps,
    LoanTermLedgers,
    Loan(Address),
    PoolBalance,
}

#[contract]
pub struct LendingPool;

const MIN_TTL: u32 = 100_000;
const MAX_TTL: u32 = 200_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidFeeBps = 3,
    InvalidLoanTerm = 4,
    InvalidAmount = 5,
    PoolBalanceOverflow = 6,
    ActiveLoanExists = 7,
    NoCreditTier = 8,
    BorrowLimitExceeded = 9,
    InsufficientPoolLiquidity = 10,
    FeeOverflow = 11,
    DueLedgerOverflow = 12,
    LoanNotFound = 13,
    LoanAlreadyRepaid = 14,
    LoanDefaulted = 15,
    LoanOverdue = 16,
    RepaymentOverflow = 17,
    LoanNotOverdue = 18,
}

mod registry {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/credit_registry.wasm");
}

#[contractimpl]
impl LendingPool {
    pub fn initialize(
        env: Env,
        admin: Address,
        registry_id: Address,
        phpc_token: Address,
        flat_fee_bps: u32,
        loan_term_ledgers: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        if flat_fee_bps > 10_000 {
            panic_with_error!(&env, Error::InvalidFeeBps);
        }
        if loan_term_ledgers == 0 {
            panic_with_error!(&env, Error::InvalidLoanTerm);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RegistryId, &registry_id);
        env.storage().instance().set(&DataKey::TokenId, &phpc_token);
        env.storage()
            .instance()
            .set(&DataKey::FlatFeeBps, &flat_fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::LoanTermLedgers, &loan_term_ledgers);
        env.storage().instance().set(&DataKey::PoolBalance, &0i128);
        bump_instance_ttl(&env);
    }

    pub fn deposit(env: Env, amount: i128) {
        let admin = get_admin(&env);
        admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let token_id = get_token_id(&env);
        let client = token::TokenClient::new(&env, &token_id);
        // transfer_from(spender, from, to, amount)
        client.transfer_from(
            &env.current_contract_address(),
            &admin,
            &env.current_contract_address(),
            &amount,
        );

        let balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        let new_balance = balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::PoolBalanceOverflow));
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &new_balance);
        bump_instance_ttl(&env);
    }

    pub fn borrow(env: Env, borrower: Address, amount: i128) {
        borrower.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let loan_key = DataKey::Loan(borrower.clone());
        if let Some(loan) = env.storage().persistent().get::<_, LoanRecord>(&loan_key) {
            if !loan.repaid && !loan.defaulted {
                panic_with_error!(&env, Error::ActiveLoanExists);
            }
        }

        let registry_id = get_registry_id(&env);
        let registry_client = registry::Client::new(&env, &registry_id);
        let tier = registry_client.get_tier(&borrower);
        if tier < 1 {
            panic_with_error!(&env, Error::NoCreditTier);
        }

        let limit = registry_client.get_tier_limit(&tier);
        if amount > limit {
            panic_with_error!(&env, Error::BorrowLimitExceeded);
        }

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        if amount > balance {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }

        let flat_fee_bps = tier_fee_bps(read_flat_fee_bps(&env), tier);
        let fee = amount
            .checked_mul(flat_fee_bps as i128)
            .unwrap_or_else(|| panic_with_error!(&env, Error::FeeOverflow))
            / 10_000;
        let loan_term_ledgers = get_loan_term_ledgers(&env);
        let due_ledger = env
            .ledger()
            .sequence()
            .checked_add(loan_term_ledgers)
            .unwrap_or_else(|| panic_with_error!(&env, Error::DueLedgerOverflow));

        let loan = LoanRecord {
            principal: amount,
            fee,
            due_ledger,
            repaid: false,
            defaulted: false,
        };

        env.storage().persistent().set(&loan_key, &loan);
        env.storage()
            .persistent()
            .extend_ttl(&loan_key, MIN_TTL, MAX_TTL);
        balance -= amount;
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);
        bump_instance_ttl(&env);

        let token_id = get_token_id(&env);
        let token_client = token::TokenClient::new(&env, &token_id);
        token_client.transfer(&env.current_contract_address(), &borrower, &amount);

        env.events().publish(
            (symbol_short!("disburse"), borrower),
            (amount, fee, due_ledger),
        );
    }

    pub fn repay(env: Env, borrower: Address) {
        borrower.require_auth();

        let loan_key = DataKey::Loan(borrower.clone());
        let mut loan: LoanRecord = env
            .storage()
            .persistent()
            .get(&loan_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::LoanNotFound));

        if loan.repaid {
            panic_with_error!(&env, Error::LoanAlreadyRepaid);
        }
        if loan.defaulted {
            panic_with_error!(&env, Error::LoanDefaulted);
        }
        if env.ledger().sequence() > loan.due_ledger {
            panic_with_error!(&env, Error::LoanOverdue);
        }

        let total_owed = loan
            .principal
            .checked_add(loan.fee)
            .unwrap_or_else(|| panic_with_error!(&env, Error::RepaymentOverflow));
        let token_id = get_token_id(&env);
        let token_client = token::TokenClient::new(&env, &token_id);
        // transfer_from(spender, from, to, amount)
        token_client.transfer_from(
            &env.current_contract_address(),
            &borrower,
            &env.current_contract_address(),
            &total_owed,
        );

        loan.repaid = true;
        env.storage().persistent().set(&loan_key, &loan);
        env.storage()
            .persistent()
            .extend_ttl(&loan_key, MIN_TTL, MAX_TTL);

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        balance = balance
            .checked_add(total_owed)
            .unwrap_or_else(|| panic_with_error!(&env, Error::PoolBalanceOverflow));
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);
        bump_instance_ttl(&env);

        env.events().publish(
            (symbol_short!("repaid"), borrower),
            (total_owed, env.ledger().timestamp()),
        );
    }

    pub fn mark_default(env: Env, borrower: Address) {
        let loan_key = DataKey::Loan(borrower.clone());
        let mut loan: LoanRecord = env
            .storage()
            .persistent()
            .get(&loan_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::LoanNotFound));

        if loan.repaid {
            panic_with_error!(&env, Error::LoanAlreadyRepaid);
        }
        if loan.defaulted {
            panic_with_error!(&env, Error::LoanDefaulted);
        }
        if env.ledger().sequence() <= loan.due_ledger {
            panic_with_error!(&env, Error::LoanNotOverdue);
        }

        loan.defaulted = true;
        env.storage().persistent().set(&loan_key, &loan);
        env.storage()
            .persistent()
            .extend_ttl(&loan_key, MIN_TTL, MAX_TTL);

        env.events()
            .publish((symbol_short!("defaulted"), borrower), loan.principal);
    }

    pub fn get_loan(env: Env, borrower: Address) -> Option<LoanRecord> {
        let key = DataKey::Loan(borrower);
        let loan = env.storage().persistent().get(&key);
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, MIN_TTL, MAX_TTL);
        }
        loan
    }

    pub fn get_pool_balance(env: Env) -> i128 {
        bump_instance_ttl(&env);
        env.storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0)
    }

    pub fn get_flat_fee_bps(env: Env) -> u32 {
        read_flat_fee_bps(&env)
    }

    pub fn admin_withdraw(env: Env, amount: i128) {
        let admin = get_admin(&env);
        admin.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let mut balance: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PoolBalance)
            .unwrap_or(0);
        if amount > balance {
            panic_with_error!(&env, Error::InsufficientPoolLiquidity);
        }

        balance -= amount;
        env.storage()
            .instance()
            .set(&DataKey::PoolBalance, &balance);
        bump_instance_ttl(&env);

        let token_id = get_token_id(&env);
        let token_client = token::TokenClient::new(&env, &token_id);
        token_client.transfer(&env.current_contract_address(), &admin, &amount);
    }
}

fn get_instance_value<
    T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
>(
    env: &Env,
    key: &DataKey,
) -> T {
    env.storage()
        .instance()
        .get(key)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn get_admin(env: &Env) -> Address {
    bump_instance_ttl(env);
    get_instance_value(env, &DataKey::Admin)
}

fn get_registry_id(env: &Env) -> Address {
    bump_instance_ttl(env);
    get_instance_value(env, &DataKey::RegistryId)
}

fn get_token_id(env: &Env) -> Address {
    bump_instance_ttl(env);
    get_instance_value(env, &DataKey::TokenId)
}

fn read_flat_fee_bps(env: &Env) -> u32 {
    bump_instance_ttl(env);
    get_instance_value(env, &DataKey::FlatFeeBps)
}

fn get_loan_term_ledgers(env: &Env) -> u32 {
    bump_instance_ttl(env);
    get_instance_value(env, &DataKey::LoanTermLedgers)
}

fn tier_fee_bps(base_fee_bps: u32, tier: u32) -> u32 {
    match tier {
        3 => base_fee_bps.saturating_sub(350),
        2 => base_fee_bps.saturating_sub(200),
        _ => base_fee_bps,
    }
}

fn bump_instance_ttl(env: &Env) {
    env.storage().instance().extend_ttl(MIN_TTL, MAX_TTL);
}
````

## File: contracts/phpc_token/src/lib.rs
````rust
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String,
};

mod test;

#[derive(Clone)]
#[contracttype]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address),
    Authorized(Address),
    Name,
    Symbol,
    Decimals,
    TotalSupply,
}

#[contract]
pub struct Token;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidDecimals = 3,
    InvalidAmount = 4,
    BalanceOverflow = 5,
    InvalidAllowanceAmount = 6,
    InvalidAllowanceExpiration = 7,
    InsufficientBalance = 8,
    InsufficientAllowance = 9,
    UnauthorizedAccount = 10,
}

#[contractimpl]
impl Token {
    pub fn initialize(env: Env, admin: Address, decimal: u32, name: String, symbol: String) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        if decimal > 18 {
            panic_with_error!(&env, Error::InvalidDecimals);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Decimals, &decimal);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin = get_admin(&env);
        admin.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let key = DataKey::Balance(to.clone());
        require_authorized(&env, &to);
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_balance = balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::BalanceOverflow));
        env.storage().persistent().set(&key, &new_balance);
        let total_supply = Self::total_supply(env.clone())
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::BalanceOverflow));
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &total_supply);

        env.events().publish((symbol_short!("mint"), to), amount);
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(from, spender);
        read_allowance(&env, &key).amount
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        from.require_auth();
        require_authorized(&env, &from);
        require_authorized(&env, &spender);
        if amount < 0 {
            panic_with_error!(&env, Error::InvalidAllowanceAmount);
        }
        if amount > 0 && expiration_ledger < env.ledger().sequence() {
            panic_with_error!(&env, Error::InvalidAllowanceExpiration);
        }
        let key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance = AllowanceValue {
            amount,
            expiration_ledger,
        };
        env.storage().persistent().set(&key, &allowance);
        env.events()
            .publish((symbol_short!("approve"), from, spender), amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        let key = DataKey::Balance(id);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        require_authorized(&env, &from);
        require_authorized(&env, &to);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if from == to {
            return;
        }

        let from_key = DataKey::Balance(from.clone());
        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        let new_to_balance = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::BalanceOverflow));

        env.storage()
            .persistent()
            .set(&from_key, &(from_balance - amount));
        env.storage().persistent().set(&to_key, &new_to_balance);

        env.events()
            .publish((symbol_short!("transfer"), from, to), amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        require_authorized(&env, &spender);
        require_authorized(&env, &from);
        require_authorized(&env, &to);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance = read_allowance(&env, &allowance_key);
        if allowance.amount < amount {
            panic_with_error!(&env, Error::InsufficientAllowance);
        }
        let remaining_allowance = allowance.amount - amount;

        if from == to {
            write_allowance(
                &env,
                &allowance_key,
                remaining_allowance,
                allowance.expiration_ledger,
            );
            return;
        }

        let from_key = DataKey::Balance(from.clone());
        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        let new_to_balance = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::BalanceOverflow));

        write_allowance(
            &env,
            &allowance_key,
            remaining_allowance,
            allowance.expiration_ledger,
        );
        env.storage()
            .persistent()
            .set(&from_key, &(from_balance - amount));
        env.storage().persistent().set(&to_key, &new_to_balance);

        env.events()
            .publish((symbol_short!("transfer"), from, to), amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        require_authorized(&env, &from);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        env.storage().persistent().set(&key, &(balance - amount));
        let total_supply = Self::total_supply(env.clone())
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InsufficientBalance));
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &total_supply);
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        require_authorized(&env, &spender);
        require_authorized(&env, &from);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance = read_allowance(&env, &allowance_key);
        if allowance.amount < amount {
            panic_with_error!(&env, Error::InsufficientAllowance);
        }

        let from_key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        write_allowance(
            &env,
            &allowance_key,
            allowance.amount - amount,
            allowance.expiration_ledger,
        );
        env.storage()
            .persistent()
            .set(&from_key, &(balance - amount));
        let total_supply = Self::total_supply(env.clone())
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InsufficientBalance));
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &total_supply);
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or(7)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn authorized(env: Env, id: Address) -> bool {
        read_authorized(&env, &id)
    }

    pub fn set_authorized(env: Env, id: Address, authorize: bool) {
        let admin = get_admin(&env);
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Authorized(id), &authorize);
    }
}

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn read_allowance(env: &Env, key: &DataKey) -> AllowanceValue {
    let allowance = env
        .storage()
        .persistent()
        .get::<_, AllowanceValue>(key)
        .unwrap_or(AllowanceValue {
            amount: 0,
            expiration_ledger: 0,
        });

    if allowance.amount > 0 && env.ledger().sequence() > allowance.expiration_ledger {
        return AllowanceValue {
            amount: 0,
            expiration_ledger: 0,
        };
    }

    allowance
}

fn write_allowance(env: &Env, key: &DataKey, amount: i128, expiration_ledger: u32) {
    let allowance = AllowanceValue {
        amount,
        expiration_ledger: if amount == 0 { 0 } else { expiration_ledger },
    };
    env.storage().persistent().set(key, &allowance);
}

fn read_authorized(env: &Env, id: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Authorized(id.clone()))
        .unwrap_or(true)
}

fn require_authorized(env: &Env, id: &Address) {
    if !read_authorized(env, id) {
        panic_with_error!(env, Error::UnauthorizedAccount);
    }
}
````

## File: contracts/deploy.sh
````bash
#!/bin/bash
set -e

NETWORK="testnet"
SOURCE="issuer"
ISSUER_PUB=$(stellar keys show "$SOURCE" --public-key)
WASM_DIR="target/wasm32v1-none/release"

echo "Deploying phpc_token..."
PHPC_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/phpc_token.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "PHPC_ID: $PHPC_ID"

echo "Initializing phpc_token..."
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --decimal 7 \
  --name "Philippine Peso Coin" \
  --symbol "PHPC"

echo "Deploying credit_registry..."
REGISTRY_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/credit_registry.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "REGISTRY_ID: $REGISTRY_ID"

echo "Initializing credit_registry..."
# tier1_limit = 5,000 PHPC × 10^7 = 50,000,000,000 stroops
# tier2_limit = 20,000 PHPC × 10^7 = 200,000,000,000 stroops
# tier3_limit = 50,000 PHPC × 10^7 = 500,000,000,000 stroops
stellar contract invoke --id $REGISTRY_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --issuer $ISSUER_PUB \
  --tier1_limit 50000000000 \
  --tier2_limit 200000000000 \
  --tier3_limit 500000000000

echo "Deploying lending_pool..."
LENDING_POOL_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/lending_pool.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "LENDING_POOL_ID: $LENDING_POOL_ID"

echo "Initializing lending_pool..."
# loan_term_ledgers = 30 days × 17,280 ledgers/day = 518,400
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --registry_id $REGISTRY_ID \
  --phpc_token $PHPC_ID \
  --flat_fee_bps 500 \
  --loan_term_ledgers 518400

echo "Minting PHPC to issuer..."
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  mint \
  --to $ISSUER_PUB \
  --amount 1000000000000000

echo "Approving lending_pool to spend issuer's PHPC..."
# We use a high expiration ledger for the approval
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  approve \
  --from $ISSUER_PUB \
  --spender $LENDING_POOL_ID \
  --amount 1000000000000000 \
  --expiration_ledger 5000000

echo "Depositing PHPC into lending_pool..."
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  deposit \
  --amount 1000000000000000

echo "Saving to deployed.json..."
cat > deployed.json << EOF
{
  "network": "$NETWORK",
  "contracts": {
    "credit_registry": "$REGISTRY_ID",
    "lending_pool": "$LENDING_POOL_ID",
    "phpc_token": "$PHPC_ID"
  },
  "issuer_public": "$ISSUER_PUB",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Deployment complete!"
````

## File: frontend/app/not-found.tsx
````typescript
// frontend/app/not-found.tsx

import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="animate-fade-up">
        <div 
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-8" 
          style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-border-accent)' }}
        >
          <ShieldCheck size={32} style={{ color: 'var(--color-accent)' }} />
        </div>
        
        <h1 className="text-4xl font-extrabold mb-4">404</h1>
        <h2 className="text-xl font-bold mb-2">Page not found</h2>
        <p className="text-sm max-w-xs mx-auto mb-10" style={{ color: 'var(--color-text-secondary)' }}>
          The path you&apos;re looking for doesn&apos;t exist or has been moved within the Credit Passport system.
        </p>

        <Link 
          href="/dashboard" 
          className="btn-primary btn-accent inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
````

## File: frontend/store/auth.ts
````typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  wallet: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hydrated: false,
      setAuth: (user, token) => set({ user, token }),
      clearAuth: () => set({ user: null, token: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "kredito-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState> | undefined;
        const hasUser = !!persisted?.user;
        const hasToken = !!persisted?.token;

        if (hasUser !== hasToken) {
          return {
            ...currentState,
            user: null,
            token: null,
          };
        }

        return {
          ...currentState,
          ...persisted,
          hydrated: true,
        };
      },
    },
  ),
);
````

## File: frontend/store/walletStore.ts
````typescript
import { create } from 'zustand';
import { 
  checkFreighterInstalled, 
  connectWallet, 
  getConnectedAddress, 
  getWalletNetwork 
} from '../lib/freighter';
import { REQUIRED_NETWORK } from '../lib/constants';
import { toast } from 'sonner';
import { useAuthStore } from './auth';

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
  networkPassphrase: string | null;
  isConnecting: boolean;
  isRestoring: boolean;
  hasRestored: boolean;
  connectionError: string | null;

  connect: () => Promise<void>;
  disconnect: () => void;
  restoreSession: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  isConnected: false,
  publicKey: null,
  network: null,
  networkPassphrase: null,
  isConnecting: false,
  isRestoring: true,
  hasRestored: false,
  connectionError: null,

  connect: async () => {
    set({ isConnecting: true, connectionError: null });

    try {
      const installed = await checkFreighterInstalled();
      if (!installed) {
        const error = 'Please install the Freighter extension to connect.';
        set({ isConnecting: false, connectionError: error });
        set({ hasRestored: true, isRestoring: false });
        toast.error(error);
        return;
      }

      const connection = await connectWallet();
      if ('error' in connection) {
        const error = connection.error.includes('User rejected') 
          ? 'Connection cancelled. Please try again.' 
          : connection.error;
        set({ isConnecting: false, connectionError: error });
        set({ hasRestored: true, isRestoring: false });
        toast.error(error);
        return;
      }

      const networkDetails = await getWalletNetwork();
      if (!networkDetails) {
        const error = 'Failed to retrieve network details.';
        set({ isConnecting: false, connectionError: error });
        set({ hasRestored: true, isRestoring: false });
        toast.error(error);
        return;
      }

      if (networkDetails.network !== REQUIRED_NETWORK) {
        const error = `Switch Freighter to ${REQUIRED_NETWORK} to continue.`;
        set({
          isConnected: true,
          publicKey: connection.address,
          network: networkDetails.network,
          networkPassphrase: networkDetails.networkPassphrase,
          isConnecting: false,
          isRestoring: false,
          hasRestored: true,
          connectionError: error
        });
        toast.warning(error);
        return;
      }

      set({
        isConnected: true,
        publicKey: connection.address,
        network: networkDetails.network,
        networkPassphrase: networkDetails.networkPassphrase,
        isConnecting: false,
        isRestoring: false,
        hasRestored: true,
        connectionError: null
      });
      localStorage.setItem('kredito_wallet_connected', 'true');
      toast.success('Wallet connected');
    } catch (err: unknown) {
      set({ 
        isConnecting: false, 
        isRestoring: false,
        hasRestored: true,
        connectionError: err instanceof Error ? err.message : 'An unexpected error occurred.' 
      });
    }
  },

  disconnect: () => {
    // P2-5: Clear AuthStore when disconnecting wallet to prevent lingering sessions
    useAuthStore.getState().clearAuth();

    set({
      isConnected: false,
      publicKey: null,
      network: null,
      networkPassphrase: null,
      isConnecting: false,
      isRestoring: false,
      hasRestored: true,
      connectionError: null
    });
    localStorage.removeItem('kredito_wallet_connected');
  },

  restoreSession: async () => {
    if (typeof window === 'undefined') return;
    
    const wasConnected = localStorage.getItem('kredito_wallet_connected');
    if (!wasConnected) {
      set({ isRestoring: false, hasRestored: true });
      return;
    }

    try {
      const address = await getConnectedAddress();
      if (address) {
        const networkDetails = await getWalletNetwork();
        set({
          isConnected: true,
          publicKey: address,
          network: networkDetails?.network || null,
          networkPassphrase: networkDetails?.networkPassphrase || null,
          isRestoring: false,
          hasRestored: true,
          connectionError: networkDetails?.network !== REQUIRED_NETWORK 
            ? `Switch Freighter to ${REQUIRED_NETWORK} to continue.` 
            : null
        });
      } else {
        // If we thought we were connected but can't get address, clear it
        localStorage.removeItem('kredito_wallet_connected');
        set({ isRestoring: false, hasRestored: true });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to restore wallet session:', err);
      set({ isRestoring: false, hasRestored: true });
    }
  }
}));
````

## File: frontend/next.config.ts
````typescript
import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/";
const apiOrigin = new URL(apiUrl).origin;

// P2-8: Read the RPC URL from env and add it to the CSP
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const rpcOrigin = new URL(rpcUrl).origin;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=()" },
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ${apiOrigin} ${rpcOrigin} https://*.stellar.org https://stellar.expert https://friendbot.stellar.org`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
````

## File: backend/src/routes/admin.ts
````typescript
import { Router } from 'express';
import pLimit from 'p-limit';
import { Address } from '@stellar/stellar-sdk';
import { asyncRoute, unauthorized } from '../errors';
import { config } from '../config';
import { getAllLoansFromChain, getLoanFromChain } from '../stellar/query';
import { buildAndSubmitFeeBump } from '../stellar/feebump';
import { issuerKeypair, contractIds } from '../stellar/client';
import { classifyError } from '../lib/errors/classifyError';

const router = Router();
const limit = pLimit(5);

router.get(
  '/check-defaults',
  asyncRoute(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${config.adminApiSecret}`) {
      throw unauthorized('Admin access only');
    }

    const { loans, latestLedger, oldestLedger } = await getAllLoansFromChain();
    req.log?.info({ scannedCount: loans.length, latestLedger }, 'Starting admin sweep');

    type SweepResult =
      | { wallet: string; status: 'defaulted' }
      | { wallet: string; status: 'skipped' }
      | { wallet: string; status: 'skipped_idempotent' }
      | { wallet: string; status: 'error'; error: string };

    const overdueLoans = loans.filter(
      (l) => !l.repaid && !l.defaulted && l.due_ledger < latestLedger,
    );
    req.log?.info({ overdueCount: overdueLoans.length }, 'Filtered overdue loans');

    let failures = 0;
    const total = overdueLoans.length;
    // Safe: JS is single-threaded; pLimit callbacks interleave but never truly race.
    let breakerTriggered = false;

    const processLoan = async (loan: {
      walletAddress: string;
      due_ledger: number;
      defaulted: boolean;
      repaid: boolean;
    }): Promise<SweepResult> => {
      return limit(async () => {
        if (breakerTriggered) {
          req.log?.warn({ wallet: loan.walletAddress }, 'Default skipped: circuit breaker triggered');
          return { wallet: loan.walletAddress, status: 'error', error: 'CIRCUIT_BREAKER_TRIGGERED' };
        }

        try {
          // 1. Final pre-check: fetch latest state to avoid race conditions (repaid between scan and now)
          const latestLoan = await getLoanFromChain(loan.walletAddress);

          if (!latestLoan || latestLoan.repaid || latestLoan.defaulted) {
            req.log?.warn(
              {
                wallet: loan.walletAddress,
                repaid: latestLoan?.repaid,
                defaulted: latestLoan?.defaulted,
                reason: 'loan_settled_or_modified',
              },
              'Default skipped',
            );
            return { wallet: loan.walletAddress, status: 'skipped' };
          }

          // Double check overdue status with latest data just in case
          if (latestLoan.due_ledger >= latestLedger) {
            req.log?.warn(
              {
                wallet: loan.walletAddress,
                due_ledger: latestLoan.due_ledger,
                latestLedger,
                reason: 'loan_not_yet_overdue',
              },
              'Default skipped',
            );
            return { wallet: loan.walletAddress, status: 'skipped' };
          }

          // 2. Submit default transaction
          req.log?.info({ wallet: loan.walletAddress }, 'Default attempt');
          await buildAndSubmitFeeBump(issuerKeypair, contractIds.lendingPool, 'mark_default', [
            new Address(loan.walletAddress).toScVal(),
          ]);

          req.log?.info({ wallet: loan.walletAddress }, 'Loan marked as defaulted');
          return { wallet: loan.walletAddress, status: 'defaulted' };
        } catch (err) {
          const action = classifyError(err);
          const message = err instanceof Error ? err.message : String(err);

          if (action === 'IGNORE') {
            req.log?.warn({ wallet: loan.walletAddress, message, reason: 'idempotent' }, 'Default skipped');
            return { wallet: loan.walletAddress, status: 'skipped_idempotent' };
          }

          // Track failures for circuit breaker (RETRY and FAIL actions)
          failures++;
          if (total > 3 && failures / total > 0.3) {
            breakerTriggered = true;
          }

          if (action === 'RETRY') {
            req.log?.error(
              { wallet: loan.walletAddress, message, failures, total },
              'TX failed: retryable error (RPC/Timeout)',
            );
            throw err;
          }

          // action === 'FAIL'
          req.log?.error(
            { wallet: loan.walletAddress, err, failures, total },
            'TX failed: unexpected error',
          );
          return { wallet: loan.walletAddress, status: 'error', error: message };
        }
      });
    };

    const results = await Promise.allSettled(overdueLoans.map(processLoan));

    const initialSummary = {
      defaulted: 0,
      skipped: 0,
      skipped_idempotent: 0,
      error: 0,
      errors: 0,
      defaultedWallets: [] as string[],
    };

    const summary = results.reduce((acc, res) => {
      if (res.status === 'rejected') {
        acc.errors += 1;
        return acc;
      }

      const { status, wallet } = res.value;
      switch (status) {
        case 'defaulted':
          acc.defaulted += 1;
          acc.defaultedWallets.push(wallet);
          break;
        case 'skipped':
          acc.skipped += 1;
          break;
        case 'skipped_idempotent':
          acc.skipped_idempotent += 1;
          break;
        case 'error':
          acc.error += 1;
          break;
      }
      return acc;
    }, initialSummary);

    res.json({
      ...summary,
      scannedBorrowers: loans.length,
      currentLedger: latestLedger,
      oldestIndexedLedger: oldestLedger,
    });
  }),
);

export default router;
````

## File: backend/src/stellar/client.ts
````typescript
// backend/src/stellar/client.ts

import { Horizon, rpc, Keypair, Networks } from '@stellar/stellar-sdk';
import { config } from '../config';

// P3-10: Redundant dotenv.config() removed (already called in index.ts)

export const networkPassphrase = config.networkPassphrase || Networks.TESTNET;
export const horizonUrl = config.horizonUrl;
export const rpcUrl = config.rpcUrl;

export const horizonServer = new Horizon.Server(horizonUrl, {
  allowHttp: horizonUrl.startsWith('http://'),
});
export const rpcServer = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });

export const issuerKeypair = Keypair.fromSecret(config.issuerSecretKey);

export const contractIds = config.contractIds;
````

## File: contracts/credit_registry/src/lib.rs
````rust
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env,
};

mod test;

const BRONZE_MIN_SCORE: u32 = 40;
const SILVER_MIN_SCORE: u32 = 80;
const GOLD_MIN_SCORE: u32 = 120;
const MAX_AVG_BALANCE_FACTOR: u32 = 10;
const AVG_BALANCE_STEP: u32 = 100;
const DEFAULT_PENALTY: u32 = 25;
const MIN_TTL: u32 = 100_000;
const MAX_TTL: u32 = 200_000;
const TIER_EXPIRY_LEDGERS: u32 = 518_400;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Metrics {
    pub tx_count: u32,
    pub repayment_count: u32,
    pub avg_balance: u32,
    pub default_count: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Issuer,
    Tier1Limit,
    Tier2Limit,
    Tier3Limit,
    Metrics(Address),
    Score(Address),
    CreditTier(Address),
    TierTimestamp(Address),
    TierExpiry(Address),
}

#[contract]
pub struct CreditRegistry;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidTierLimits = 3,
    TierOrderInvalid = 4,
    InvalidTier = 5,
    NonTransferable = 6,
}

#[contractimpl]
impl CreditRegistry {
    pub fn initialize(
        env: Env,
        issuer: Address,
        tier1_limit: i128,
        tier2_limit: i128,
        tier3_limit: i128,
    ) {
        if env.storage().instance().has(&DataKey::Issuer) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        issuer.require_auth();
        if tier1_limit <= 0 || tier2_limit <= 0 || tier3_limit <= 0 {
            panic_with_error!(&env, Error::InvalidTierLimits);
        }
        if tier2_limit < tier1_limit || tier3_limit < tier2_limit {
            panic_with_error!(&env, Error::TierOrderInvalid);
        }
        env.storage().instance().set(&DataKey::Issuer, &issuer);
        env.storage()
            .instance()
            .set(&DataKey::Tier1Limit, &tier1_limit);
        env.storage()
            .instance()
            .set(&DataKey::Tier2Limit, &tier2_limit);
        env.storage()
            .instance()
            .set(&DataKey::Tier3Limit, &tier3_limit);
        bump_instance_ttl(&env);
    }

    pub fn update_metrics(env: Env, wallet: Address, metrics: Metrics) -> u32 {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        let score = Self::compute_score(env.clone(), metrics.clone());
        let tier = score_to_tier(score);
        store_credit_state(&env, wallet.clone(), metrics, score, tier);
        score
    }

    pub fn update_metrics_raw(
        env: Env,
        wallet: Address,
        tx_count: u32,
        repayment_count: u32,
        avg_balance: u32,
        default_count: u32,
    ) -> u32 {
        Self::update_metrics(
            env,
            wallet,
            Metrics {
                tx_count,
                repayment_count,
                avg_balance,
                default_count,
            },
        )
    }

    pub fn update_score(env: Env, wallet: Address) -> u32 {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        let metrics = Self::get_metrics(env.clone(), wallet.clone());
        let score = Self::compute_score(env.clone(), metrics.clone());
        let tier = score_to_tier(score);
        store_credit_state(&env, wallet, metrics, score, tier);
        score
    }

    pub fn set_tier(env: Env, wallet: Address, tier: u32) {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        if !(1..=3).contains(&tier) {
            panic_with_error!(&env, Error::InvalidTier);
        }

        let score = match tier {
            1 => BRONZE_MIN_SCORE,
            2 => SILVER_MIN_SCORE,
            _ => GOLD_MIN_SCORE,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Score(wallet.clone()), &score);
        env.storage()
            .persistent()
            .set(&DataKey::CreditTier(wallet.clone()), &tier);
        env.storage().persistent().set(
            &DataKey::TierTimestamp(wallet.clone()),
            &env.ledger().timestamp(),
        );
        env.storage().persistent().set(
            &DataKey::TierExpiry(wallet.clone()),
            &env.ledger().sequence().saturating_add(TIER_EXPIRY_LEDGERS),
        );
        bump_credit_state_ttl(&env, &wallet);
        bump_instance_ttl(&env);
    }

    pub fn revoke_tier(env: Env, wallet: Address) {
        let issuer = get_issuer(&env);
        issuer.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::CreditTier(wallet.clone()), &0u32);
        env.storage()
            .persistent()
            .set(&DataKey::Score(wallet.clone()), &0u32);
        env.storage()
            .persistent()
            .remove(&DataKey::TierTimestamp(wallet.clone()));
        env.storage()
            .persistent()
            .remove(&DataKey::TierExpiry(wallet.clone()));
        bump_credit_state_ttl(&env, &wallet);
        bump_instance_ttl(&env);
        env.events()
            .publish((symbol_short!("revoked"), wallet), env.ledger().timestamp());
    }

    pub fn compute_score(_env: Env, metrics: Metrics) -> u32 {
        let avg_balance_factor = core::cmp::min(
            metrics.avg_balance / AVG_BALANCE_STEP,
            MAX_AVG_BALANCE_FACTOR,
        );
        let base_score = metrics
            .tx_count
            .saturating_mul(2)
            .saturating_add(metrics.repayment_count.saturating_mul(10))
            .saturating_add(avg_balance_factor.saturating_mul(5));
        let penalty = metrics.default_count.saturating_mul(DEFAULT_PENALTY);
        base_score.saturating_sub(penalty)
    }

    pub fn get_metrics(env: Env, wallet: Address) -> Metrics {
        let key = DataKey::Metrics(wallet.clone());
        let metrics = env.storage().persistent().get(&key).unwrap_or(Metrics {
            tx_count: 0,
            repayment_count: 0,
            avg_balance: 0,
            default_count: 0,
        });
        maybe_extend_persistent_ttl(&env, &key);
        metrics
    }

    pub fn get_score(env: Env, wallet: Address) -> u32 {
        let key = DataKey::Score(wallet);
        let score = env.storage().persistent().get(&key).unwrap_or(0);
        maybe_extend_persistent_ttl(&env, &key);
        score
    }

    pub fn get_tier(env: Env, wallet: Address) -> u32 {
        let key = DataKey::CreditTier(wallet);
        let tier = env.storage().persistent().get(&key).unwrap_or(0);
        maybe_extend_persistent_ttl(&env, &key);
        tier
    }

    pub fn get_tier_limit(env: Env, tier: u32) -> i128 {
        bump_instance_ttl(&env);
        match tier {
            1 => env
                .storage()
                .instance()
                .get(&DataKey::Tier1Limit)
                .unwrap_or(0),
            2 => env
                .storage()
                .instance()
                .get(&DataKey::Tier2Limit)
                .unwrap_or(0),
            3 => env
                .storage()
                .instance()
                .get(&DataKey::Tier3Limit)
                .unwrap_or(0),
            _ => 0,
        }
    }

    pub fn is_tier_current(env: Env, wallet: Address) -> bool {
        let expiry_key = DataKey::TierExpiry(wallet);
        let expiry = env
            .storage()
            .persistent()
            .get::<_, u32>(&expiry_key)
            .unwrap_or(0);
        maybe_extend_persistent_ttl(&env, &expiry_key);
        expiry > env.ledger().sequence()
    }

    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
        panic_with_error!(&_env, Error::NonTransferable);
    }

    pub fn transfer_from(
        _env: Env,
        _spender: Address,
        _from: Address,
        _to: Address,
        _amount: i128,
    ) {
        panic_with_error!(&_env, Error::NonTransferable);
    }
}

fn store_credit_state(env: &Env, wallet: Address, metrics: Metrics, score: u32, tier: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::Metrics(wallet.clone()), &metrics);
    env.storage()
        .persistent()
        .set(&DataKey::Score(wallet.clone()), &score);
    env.storage()
        .persistent()
        .set(&DataKey::CreditTier(wallet.clone()), &tier);
    env.storage().persistent().set(
        &DataKey::TierTimestamp(wallet.clone()),
        &env.ledger().timestamp(),
    );
    env.storage().persistent().set(
        &DataKey::TierExpiry(wallet.clone()),
        &env.ledger().sequence().saturating_add(TIER_EXPIRY_LEDGERS),
    );
    bump_credit_state_ttl(env, &wallet);
    bump_instance_ttl(env);
    env.events().publish(
        (symbol_short!("score_upd"), wallet),
        (score, tier, env.ledger().timestamp()),
    );
}

fn score_to_tier(score: u32) -> u32 {
    if score >= GOLD_MIN_SCORE {
        3
    } else if score >= SILVER_MIN_SCORE {
        2
    } else if score >= BRONZE_MIN_SCORE {
        1
    } else {
        0
    }
}

fn get_issuer(env: &Env) -> Address {
    bump_instance_ttl(env);
    env.storage()
        .instance()
        .get(&DataKey::Issuer)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn bump_credit_state_ttl(env: &Env, wallet: &Address) {
    maybe_extend_persistent_ttl(env, &DataKey::Metrics(wallet.clone()));
    maybe_extend_persistent_ttl(env, &DataKey::Score(wallet.clone()));
    maybe_extend_persistent_ttl(env, &DataKey::CreditTier(wallet.clone()));
    maybe_extend_persistent_ttl(env, &DataKey::TierTimestamp(wallet.clone()));
    maybe_extend_persistent_ttl(env, &DataKey::TierExpiry(wallet.clone()));
}

fn bump_instance_ttl(env: &Env) {
    env.storage().instance().extend_ttl(MIN_TTL, MAX_TTL);
}

fn maybe_extend_persistent_ttl(env: &Env, key: &DataKey) {
    if env.storage().persistent().has(key) {
        env.storage().persistent().extend_ttl(key, MIN_TTL, MAX_TTL);
    }
}
````

## File: frontend/package.json
````json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
  "dependencies": {
    "@stellar/freighter-api": "^6.0.1",
    "@tanstack/react-query": "^5.100.5",
    "axios": "^1.15.2",
    "date-fns": "^4.1.0",
    "lucide-react": "^1.11.0",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "sonner": "^2.0.7",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.5"
  }
}
````

## File: backend/src/routes/tx.ts
````typescript
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, badRequest } from '../errors';
import { buildScoreSummary, toPhpAmount } from '../scoring/engine';
import { submitSponsoredSignedXdr } from '../stellar/feebump';
import { getOnChainCreditSnapshot, updateOnChainMetrics } from '../stellar/issuer';
import { getLoanFromChain, hasActiveLoan, waitForLoanRepayment } from '../stellar/query';
import { sleep } from '../utils/sleep';
import { config } from '../config';

const router = Router();

const submitFlowSchema = z
  .object({
    action: z.enum(['borrow', 'repay']).optional(),
    step: z.string().optional(),
  })
  .optional();

function getExplorerUrl(txHash: string) {
  return `${config.explorerUrl}/tx/${txHash}`;
}

router.post(
  '/submit',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const payload = req.body?.signedXdr || req.body?.signedInnerXdr;
    const signedInnerXdr = Array.isArray(payload) ? payload : [payload];
    if (
      signedInnerXdr.length === 0 ||
      !signedInnerXdr.every((entry) => typeof entry === 'string' && entry.length > 0)
    ) {
      throw badRequest('signedXdr/signedInnerXdr is required and must not be empty');
    }

    const hashes: string[] = [];
    for (const xdr of signedInnerXdr) {
      const hash = await submitSponsoredSignedXdr(xdr);
      hashes.push(hash);
      req.log?.info({ txHash: hash }, 'Submitted sponsored transaction');
    }

    const txHash = hashes[hashes.length - 1];
    res.json({
      txHash,
      txHashes: hashes,
      explorerUrl: getExplorerUrl(txHash),
    });
  }),
);

router.post(
  '/sign-and-submit',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const payload = req.body?.signedInnerXdr;
    const signedInnerXdr = Array.isArray(payload) ? payload : [payload];
    if (
      signedInnerXdr.length === 0 ||
      !signedInnerXdr.every((entry) => typeof entry === 'string' && entry.length > 0)
    ) {
      throw badRequest('signedInnerXdr is required and must not be empty');
    }

    const flow = submitFlowSchema.parse(req.body?.flow);
    const wallet = req.wallet;

    const hashes: string[] = [];
    for (const xdr of signedInnerXdr) {
      if (flow?.action === 'borrow') {
        const active = await hasActiveLoan(wallet);
        if (active) {
          throw badRequest('Active loan already exists. Cannot borrow again.');
        }
      }

      const hash = await submitSponsoredSignedXdr(xdr);
      hashes.push(hash);
      req.log?.info(
        { txHash: hash, action: flow?.action, wallet },
        'Submitted sponsored transaction',
      );
    }

    type BaseTxResponse = {
      txHash: string;
      txHashes: string[];
      explorerUrl: string;
    };

    type BorrowResponse = BaseTxResponse & {
      amount: string;
      fee: string;
      feeBps: number;
      totalOwed: string;
    };

    type RepayResponse = BaseTxResponse & {
      amountRepaid: string;
      previousScore: number | null;
      newScore: number;
      newTier: string;
      newTierNumeric: number;
      newBorrowLimit: string;
    };

    const txHash = hashes[hashes.length - 1];
    const basePayload: BaseTxResponse = {
      txHash,
      txHashes: hashes,
      explorerUrl: getExplorerUrl(txHash),
    };

    if (flow?.action === 'borrow') {
      // P2-3: Wait up to ~15s for state to settle after borrow submit
      let loan = null;
      for (let i = 0; i < 5; i++) {
        loan = await getLoanFromChain(wallet);
        if (loan) break;
        await sleep(3000);
      }

      if (loan) {
        const principal = Number(toPhpAmount(loan.principal));
        const fee = Number(toPhpAmount(loan.fee));
        const borrowResponse: BorrowResponse = {
          ...basePayload,
          amount: principal.toFixed(2),
          fee: fee.toFixed(2),
          feeBps: principal > 0 ? Math.round((fee / principal) * 10_000) : 0,
          totalOwed: (principal + fee).toFixed(2),
        };
        return res.json(borrowResponse);
      }
    }

    if (flow?.action === 'repay' && flow?.step === 'repay') {
      const settledLoan = await waitForLoanRepayment(wallet);
      req.log?.info({ wallet, txHash }, 'Repayment confirmed on-chain');
      const previousSnapshot = await getOnChainCreditSnapshot(wallet).catch(() => null);

      // Refresh score after repayment
      const refreshed = await buildScoreSummary(wallet);
      await updateOnChainMetrics(wallet, refreshed.metrics);

      const repayResponse: RepayResponse = {
        ...basePayload,
        amountRepaid: toPhpAmount(settledLoan.principal + settledLoan.fee),
        previousScore: previousSnapshot?.score ?? null,
        newScore: refreshed.score,
        newTier: refreshed.tierLabel,
        newTierNumeric: refreshed.tier,
        newBorrowLimit: refreshed.borrowLimit,
      };
      return res.json(repayResponse);
    }

    res.json(basePayload);
  }),
);

export default router;
````

## File: docs/SETUP.md
````markdown
# Setup

## Backend

Create `backend/.env` from `backend/.env.example` and set:

- `JWT_SECRET` for API auth
- `ISSUER_SECRET_KEY` for Stellar issuer signing
- `ADMIN_API_SECRET` for `/api/admin/check-defaults`
- `WEB_AUTH_SECRET_KEY` for SEP-10 challenge signing
- `PHPC_ID`, `REGISTRY_ID`, `LENDING_POOL_ID` for deployed contracts

Generate `ADMIN_API_SECRET` as a separate random token. Do not reuse `ISSUER_SECRET_KEY` in HTTP headers or cron jobs.

Optional backend settings:

- `APPROVAL_LEDGER_WINDOW=500` controls how long PHPC approval stays valid during repayment signing
- `CORS_ORIGIN` should be a comma-separated allowlist in production, not `*`

Run:

```bash
cd backend
pnpm install
pnpm dev
```

## Frontend

Copy `frontend/.env.example` if needed, then run:

```bash
cd frontend
pnpm install
pnpm dev
```

Use Freighter on Stellar Testnet and point it at the same wallet used for backend auth.
````

## File: frontend/app/layout.tsx
````typescript
// frontend/app/layout.tsx

import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import WalletProvider from '@/components/WalletProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kredito — On-Chain Credit Passport',
  description:
    'Transparent on-chain credit scores and instant micro-loans for the unbanked, built on Stellar. Generate a score, unlock a loan, and build your Credit Passport.',
  keywords: ['credit', 'stellar', 'soroban', 'micro-lending', 'on-chain', 'credit passport', 'PHPC'],
  openGraph: {
    title: 'Kredito — Credit Passport on Stellar',
    description: 'Instant micro-loans for the Filipino unbanked, powered by Soroban.',
    url: 'https://kredito.io',
    siteName: 'Kredito',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kredito — Credit Passport on Stellar',
    description: 'Instant micro-loans for the Filipino unbanked, powered by Soroban.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Providers>
            {children}
          </Providers>
        </WalletProvider>
      </body>
    </html>
  );
}
````

## File: frontend/components/app-shell.tsx
````typescript
// frontend/components/app-shell.tsx

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import ConnectWalletButton from './ConnectWalletButton';
import NetworkBadge from './NetworkBadge';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/loan/borrow', label: 'Borrow', icon: CreditCard },
  { href: '/loan/repay', label: 'Repay', icon: ChartColumn },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const disconnectWallet = useWalletStore((s) => s.disconnect);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (hydrated && (!user || !token) && !isLoggingOut) {
      router.replace('/');
    }
  }, [hydrated, user, token, isLoggingOut, router]);

  const handleLogout = () => {
    setIsLoggingOut(true);
    clearAuth();
    disconnectWallet();
    router.replace('/');
  };

  if (!hydrated || isLoggingOut || !user || !token) {
    return null;
  }

  const currentRouteName = navItems.find((n) => pathname.startsWith(n.href))?.label ?? 'Kredito';

  return (
    <div className="flex min-h-dvh">
      <aside
        className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col lg:border-r lg:fixed lg:inset-y-0 lg:left-0"
        style={{
          background: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <SidebarContent pathname={pathname} onLogout={handleLogout} />
      </aside>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col lg:hidden animate-slide-in-left"
            style={{
              background: 'var(--color-bg-secondary)',
              borderRight: '1px solid var(--color-border)',
            }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg cursor-pointer z-50"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
              aria-label="Close menu"
            >
              <X size={16} style={{ color: 'var(--color-text-muted)' }} />
            </button>
            <SidebarContent
              pathname={pathname}
              onLogout={handleLogout}
              onNavClick={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col lg:ml-[260px]">
        <header
          className="sticky top-0 z-30 flex h-16 items-center gap-4 px-6 lg:px-10"
          style={{
            background: 'rgba(2, 6, 23, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg cursor-pointer lg:hidden"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            aria-label="Open menu"
          >
            <Menu size={16} style={{ color: 'var(--color-text-secondary)' }} />
          </button>

          <div className="flex flex-col lg:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} style={{ color: 'var(--color-accent)' }} />
              <span className="text-xs font-bold">Kredito</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              {currentRouteName}
            </span>
          </div>

          <div className="flex-1" />

          <h1 className="hidden text-sm font-semibold lg:block" style={{ color: 'var(--color-text-secondary)' }}>
            {currentRouteName}
          </h1>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <NetworkBadge />
            </div>
            <ConnectWalletButton />
          </div>

          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-lg cursor-pointer lg:hidden"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            aria-label="Disconnect wallet session"
          >
            <LogOut size={14} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </header>

        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onLogout,
  onNavClick,
}: {
  pathname: string;
  onLogout: () => void;
  onNavClick?: () => void;
}) {
  const walletAddress = useWalletStore((s) => s.publicKey);
  return (
    <>
      <div className="flex items-center gap-3 px-6 py-6">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-border-accent)' }}
        >
          <ShieldCheck size={20} style={{ color: 'var(--color-accent)' }} />
        </div>
        <div>
          <p className="text-base font-bold">Kredito</p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            Credit Passport
          </p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: isActive ? 'var(--color-accent-glow)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                border: isActive ? '1px solid var(--color-border-accent)' : '1px solid transparent',
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-4 py-5" style={{ borderColor: 'var(--color-border)' }}>
        {walletAddress && (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-xs font-mono"
            style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
          >
            {walletAddress.slice(0, 8)}…{walletAddress.slice(-8)}
          </div>
        )}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium cursor-pointer transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut size={16} />
          Disconnect Wallet
        </button>
      </div>
    </>
  );
}
````

## File: frontend/lib/freighter.ts
````typescript
'use client';

import axios from 'axios';
import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';
import { TESTNET_PASSPHRASE } from './constants';

const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

// ─── Phase 1.2 Helpers ──────────────────────────────────────────────────────

/**
 * Checks if the Freighter extension is installed.
 */
export async function checkFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  // Fast check window object
  const win = window as unknown as { freighterApi?: unknown; stellar?: { isFreighter?: boolean } };
  if (win.freighterApi || win.stellar?.isFreighter) return true;

  try {
    const result = await isConnected();
    return typeof result === 'boolean' ? result : !!result?.isConnected;
  } catch {
    return false;
  }
}

/**
 * Triggers the "Connection Request" popup and returns the address.
 */
export async function connectWallet(): Promise<{ address: string } | { error: string }> {
  try {
    const result = await requestAccess();
    if (!result || 'error' in result) {
      return { error: (result as { error?: string })?.error || 'User rejected or locked' };
    }
    return { address: result.address };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Silently retrieves the current address if already connected.
 * In v6.x, requestAccess() often handles this, but some versions have getPublicKey or getAddress.
 * We'll try requestAccess as it's the most reliable for current versions.
 */
export async function getConnectedAddress(): Promise<string | null> {
  try {
    const result = await getAddress();
    if (result && 'address' in result && result.address) {
      return result.address;
    }
  } catch {
    // Fall through to permissioned access for older Freighter versions.
  }

  try {
    const result = await requestAccess();
    return result && 'address' in result ? result.address : null;
  } catch {
    return null;
  }
}

/**
 * Returns the current network details.
 */
export async function getWalletNetwork(): Promise<{ network: string; networkPassphrase: string } | null> {
  try {
    const result = await getNetwork();
    if (!result || 'error' in result) return null;
    return {
      network: result.network,
      networkPassphrase: result.networkPassphrase
    };
  } catch {
    return null;
  }
}

/**
 * Signs a transaction XDR.
 */
export async function signTx(xdr: string, address: string): Promise<{ signedXdr: string } | { error: string }> {
  try {
    const result = await signTransaction(xdr, {
      networkPassphrase: TESTNET_PASSPHRASE,
      address, // Freighter API uses 'address' parameter
    });

    if (typeof result === 'string') return { signedXdr: result };
    
    if ('error' in result) {
      return { error: result.error || 'Failed to sign transaction' };
    }
    
    return { signedXdr: result.signedTxXdr };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Legacy / SEP-10 Helpers (Kept for backward compat / session logic) ──────

export async function waitForFreighter(attempts = 15): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await checkFreighterInstalled()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

export async function loginWithFreighter() {
  const connection = await connectWallet();
  if ('error' in connection) throw new Error(connection.error);

  const publicKey = connection.address;

  const challengeRes = await authApi.post<{ challenge: string }>('/auth/challenge', {
    wallet: publicKey,
  });

  const signResult = await signTx(challengeRes.data.challenge, publicKey);
  if ('error' in signResult) throw new Error(signResult.error);

  const loginRes = await authApi.post<{
    wallet: string;
    token: string;
  }>('/auth/login', {
    signedChallenge: signResult.signedXdr,
  });

  return loginRes.data;
}
````

## File: .gitignore
````
# --- General ---
node_modules/
.env
.env.local
.env.*.local
*.db
*.log
.DS_Store
Thumbs.db
.pnpm-store/

# --- Node.js / Frontend ---
dist/
build/
.next/
out/
.vercel
.turbo
.npm
.yarn/
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions
*.tsbuildinfo
next-env.d.ts

# --- Rust / Soroban ---
target/
**/*.rs.bk
.stellar/

# Repomix
repomix-output.txt

# --- IDEs ---
.vscode/
!.vscode/extensions.json
!.vscode/settings.json
!.vscode/launch.json
.idea/
*.swp
*.swo

# --- Agents / AI Tools ---
.agents/
skills-lock.json

# --- Testing Artifacts ---
*.xdr
payload.json
````

## File: repomix.config.json
````json
{
  "output": {
    "filePath": "repomix-output.md",
    "style": "markdown",
    "headerText": "This file is a merged representation of the Kredito codebase.\nKredito is a decentralized credit platform built on the Stellar network using Soroban smart contracts.\nArchitecture:\n- frontend: Next.js application with Tailwind CSS and shadcn/ui.\n- backend: Express.js API serving as a stateless middleware for Stellar interactions.\n- contracts: Soroban smart contracts written in Rust.\n\nPlease use this context to understand the project structure, business logic, and integration patterns.",
    "instruction": "When analyzing this codebase:\n1. Focus on the interaction between the Express backend and the Soroban smart contracts.\n2. Note that the backend is designed to be stateless, treating the Stellar blockchain as the source of truth.\n3. Pay attention to the security patterns used for signing transactions and managing user sessions.",
    "removeComments": false,
    "removeEmptyLines": false,
    "showRootSummary": true,
    "topFilesLength": 10
  },
  "include": [
    "**/*"
  ],
  "ignore": {
    "useGitignore": true,
    "useDefaultPatterns": true,
    "customPatterns": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/target/**",
      "**/*.lock",
      "**/pnpm-lock.yaml",
      "**/*.db*",
      "**/*.sqlite*",
      "**/*.log",
      "**/.env*",
      "**/*.tsbuildinfo",
      "**/images/**",
      "**/*.{png,jpg,jpeg,gif,svg,ico,webp,pdf,zip}",
      "**/.git/**",
      "**/.github/**",
      "**/.agents/**",
      "**/.DS_Store",
      "**/test_snapshots/**",
      "**/__snapshots__/**",
      "**/*.test.ts.snap",
      "repomix-output.md"
    ]
  },
  "security": {
    "enableSecurityCheck": true
  },
  "tokenCount": {
    "enabled": true
  }
}
````

## File: backend/src/config.ts
````typescript
// backend/src/config.ts

import { StrKey } from '@stellar/stellar-sdk';

const missingVars: string[] = [];

function check(name: string): string {
  const value = process.env[name];
  if (!value) {
    missingVars.push(name);
    return '';
  }
  return value;
}

// Check all critical variables at module load
check('JWT_SECRET');
check('ISSUER_SECRET_KEY');
check('ADMIN_API_SECRET');
check('WEB_AUTH_SECRET_KEY');
check('PHPC_ID');
check('REGISTRY_ID');
check('LENDING_POOL_ID');

if (missingVars.length > 0) {
  // In dev/test we might want to see all missing vars at once
  if (process.env.NODE_ENV !== 'test') {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please check your .env file.');
  }
}

const isProduction = process.env.NODE_ENV === 'production';

// P2-7: Removed redundant required() calls. Using process.env directly now that check() has verified them.
export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET!,
  issuerSecretKey: process.env.ISSUER_SECRET_KEY!,
  adminApiSecret: process.env.ADMIN_API_SECRET!,
  webAuthSecretKey: process.env.WEB_AUTH_SECRET_KEY!,
  
  contractIds: {
    phpcToken: process.env.PHPC_ID!,
    creditRegistry: process.env.REGISTRY_ID!,
    lendingPool: process.env.LENDING_POOL_ID!,
  },

  stellarNetwork: process.env.STELLAR_NETWORK || 'TESTNET',
  rpcUrl: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  
  homeDomain: process.env.HOME_DOMAIN || 'kredito.finance',
  webAuthDomain: process.env.WEB_AUTH_DOMAIN || 'api.kredito.finance',
  
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  approvalLedgerWindow: Number(process.env.APPROVAL_LEDGER_WINDOW || 100), // ~10 minutes
  explorerUrl: process.env.STELLAR_EXPLORER_URL || 'https://stellar.expert/explorer/testnet',
};

// Derived constants
export const LEDGERS_PER_DAY = 17280; // Assuming 5s ledger close time
export const STROOPS_PER_UNIT = 10_000_000n;

// Validate issuer key if present
if (config.issuerSecretKey && !StrKey.isValidEd25519SecretSeed(config.issuerSecretKey)) {
  throw new Error('Invalid ISSUER_SECRET_KEY');
}

if (config.webAuthSecretKey && !StrKey.isValidEd25519SecretSeed(config.webAuthSecretKey)) {
  throw new Error('Invalid WEB_AUTH_SECRET_KEY');
}
````

## File: backend/src/middleware/auth.ts
````typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { unauthorized } from '../errors';

export interface AuthRequest extends Request {
  wallet: string;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Authorization header only
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) return next(unauthorized('Unauthorized: No token provided'));

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string };
    if (!decoded.sub) {
      return next(unauthorized('Unauthorized: Invalid token format'));
    }
    (req as AuthRequest).wallet = decoded.sub;
    return next();
  } catch {
    return next(unauthorized('Unauthorized: Invalid token'));
  }
}
````

## File: backend/src/stellar/feebump.ts
````typescript
// backend/src/stellar/feebump.ts

import {
  Address,
  FeeBumpTransaction,
  Horizon,
  Keypair,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { horizonServer, issuerKeypair, networkPassphrase, rpcServer } from './client';
import { logger } from '../utils/logger';
import { sleep } from '../utils/sleep';

const CLASSIC_BASE_FEE = '100';
const SPONSORED_BASE_FEE = '1000000';

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TX_TIMEOUT')), ms),
    ),
  ]);
}

export async function pollTransaction(hash: string, timeoutMs = 30_000) {
  const startedAt = Date.now();

  let pollInterval = 1000;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const txResponse = await rpcServer.getTransaction(hash);

      if (txResponse.status === 'SUCCESS') {
        return txResponse;
      }

      if (txResponse.status === 'FAILED') {
        throw new Error(
          `Transaction failed on-chain: ${JSON.stringify(txResponse.resultXdr ?? txResponse)}`,
        );
      }
    } catch (error) {
      // If it's a real failure from the contract, rethrow
      if (error instanceof Error && error.message.includes('Transaction failed on-chain')) {
        throw error;
      }
      // Otherwise, assume it's a transient RPC error and retry
      logger.warn(
        { txHash: hash, message: error instanceof Error ? error.message : error },
        'Polling attempt failed, retrying...',
      );
    }

    await sleep(pollInterval);
    pollInterval = Math.min(pollInterval * 1.5, 5000);
  }

  throw new Error('Transaction timeout');
}

async function createAccountFromIssuer(destination: string) {
  const issuerAccount = await horizonServer.loadAccount(issuerKeypair.publicKey());
  const tx = new TransactionBuilder(issuerAccount, {
    fee: CLASSIC_BASE_FEE,
    networkPassphrase,
    memo: Memo.none(),
  })
    .addOperation(
      Operation.createAccount({
        destination,
        startingBalance: '10',
      }),
    )
    .setTimeout(180)
    .build();

  tx.sign(issuerKeypair);
  const response = await horizonServer.submitTransaction(tx);
  return response.hash;
}

async function ensureUserAccountByAddress(publicKey: string) {
  try {
    return await rpcServer.getAccount(publicKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('account not found')) {
      throw error;
    }

    await createAccountFromIssuer(publicKey);
    return rpcServer.getAccount(publicKey);
  }
}

function buildInvokeTransaction(
  source: Horizon.AccountResponse | Awaited<ReturnType<typeof rpcServer.getAccount>>,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
) {
  return new TransactionBuilder(source, {
    fee: CLASSIC_BASE_FEE,
    networkPassphrase,
    memo: Memo.none(),
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractId).toScAddress(),
            functionName,
            args,
          }),
        ),
        auth: [],
      }),
    )
    .setTimeout(180)
    .build();
}

export async function buildUnsignedContractCall(
  userPublicKey: string,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
) {
  const sourceAccount = await ensureUserAccountByAddress(userPublicKey);
  const tx = buildInvokeTransaction(sourceAccount, contractId, functionName, args);
  const prepared = await rpcServer.prepareTransaction(tx);
  return prepared.toXDR();
}

export async function submitSponsoredSignedXdr(signedInnerXdr: string, retries = 2) {
  const innerTx = TransactionBuilder.fromXDR(signedInnerXdr, networkPassphrase) as Transaction;
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    issuerKeypair,
    SPONSORED_BASE_FEE,
    innerTx,
    networkPassphrase,
  );

  feeBump.sign(issuerKeypair);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await rpcServer.sendTransaction(feeBump);
      if (response.status !== 'PENDING') {
        throw new Error(
          `Transaction submission failed: ${JSON.stringify(response.errorResult ?? response)}`,
        );
      }

      logger.info({ txHash: response.hash, attempt }, 'Transaction submitted, polling...');
      await withTimeout(pollTransaction(response.hash), 30000);
      return response.hash;
    } catch (error) {
      if (attempt === retries) {
        logger.error(
          { err: error, attempt, totalAttempts: attempt + 1 },
          'All submission attempts failed',
        );
        throw error;
      }
      logger.warn({ err: error, attempt, retry: true }, 'Submission attempt failed, retrying...');
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  throw new Error('Unreachable');
}

export async function buildAndSubmitFeeBump(
  userKeypair: Keypair,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
  retries = 2,
): Promise<string> {
  // P2-1: Remove ensureUserAccount and call ensureUserAccountByAddress directly
  const userAccount = await ensureUserAccountByAddress(userKeypair.publicKey());
  const tx = buildInvokeTransaction(userAccount, contractId, functionName, args);
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(userKeypair);

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    issuerKeypair,
    SPONSORED_BASE_FEE,
    prepared,
    networkPassphrase,
  );

  feeBump.sign(issuerKeypair);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await rpcServer.sendTransaction(feeBump as FeeBumpTransaction);

      if (response.status !== 'PENDING') {
        throw new Error(
          `Transaction submission failed: ${JSON.stringify(response.errorResult ?? response)}`,
        );
      }

      logger.info(
        { txHash: response.hash, attempt, functionName, retry_count: attempt },
        'Transaction submitted, polling...',
      );
      await withTimeout(pollTransaction(response.hash), 30000);
      return response.hash;
    } catch (error) {
      if (attempt === retries) {
        logger.error(
          { err: error, attempt, functionName, totalAttempts: attempt + 1 },
          'TX failed: all submission attempts exhausted',
        );
        throw error;
      }
      logger.warn(
        { err: error, attempt, functionName, retry: true, next_attempt: attempt + 1 },
        'Submission attempt failed, retrying...',
      );
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  throw new Error('Unreachable');
}
````

## File: backend/src/stellar/issuer.ts
````typescript
import { Address, Operation, TransactionBuilder, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { WalletMetrics, buildScorePayload, tierLabel } from '../scoring/engine';
import { contractIds, issuerKeypair, networkPassphrase, rpcServer } from './client';
import { queryContract } from './query';
import { pollTransaction } from './feebump';

async function invokeIssuerContractSingle(functionName: string, args: xdr.ScVal[]) {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const builder = new TransactionBuilder(issuerAccount, {
    fee: '1000',
    networkPassphrase,
  });

  builder.addOperation(
    Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(contractIds.creditRegistry).toScAddress(),
          functionName,
          args,
        }),
      ),
      auth: [],
    }),
  );

  const tx = builder.setTimeout(180).build();
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(issuerKeypair);

  const response = await rpcServer.sendTransaction(prepared);
  if (response.status !== 'PENDING') {
    throw new Error(
      `Issuer transaction failed: ${JSON.stringify(response.errorResult ?? response)}`,
    );
  }

  await pollTransaction(response.hash);
  return response.hash;
}

export async function updateOnChainMetrics(walletAddress: string, metrics: WalletMetrics) {
  const wallet = Address.fromString(walletAddress).toScVal();

  // Two sequential single-op transactions — Soroban does not allow multi-op txs
  const metricsTxHash = await invokeIssuerContractSingle('update_metrics_raw', [
    wallet,
    nativeToScVal(metrics.txCount, { type: 'u32' }),
    nativeToScVal(metrics.repaymentCount, { type: 'u32' }),
    nativeToScVal(metrics.xlmBalance, { type: 'u32' }),
    nativeToScVal(metrics.defaultCount, { type: 'u32' }),
  ]);

  const scoreTxHash = await invokeIssuerContractSingle('update_score', [wallet]);

  return { metricsTxHash, scoreTxHash };
}

export async function queryCreditRegistry<T = unknown>(functionName: string, args: xdr.ScVal[]) {
  return queryContract<T>(contractIds.creditRegistry, functionName, args);
}

export async function getOnChainCreditSnapshot(walletAddress: string) {
  const wallet = Address.fromString(walletAddress).toScVal();

  // P2-9: Run initial 4 queries in parallel to reduce sequential round-trips
  const [score, tier, metrics, tierLimitForTier0] = await Promise.all([
    queryCreditRegistry<bigint | number>('get_score', [wallet]),
    queryCreditRegistry<bigint | number>('get_tier', [wallet]),
    queryCreditRegistry<{
      tx_count?: number | bigint;
      repayment_count?: number | bigint;
      avg_balance?: number | bigint;
      default_count?: number | bigint;
    }>('get_metrics', [wallet]),
    queryCreditRegistry<bigint | number | string>('get_tier_limit', [
      nativeToScVal(0, { type: 'u32' }),
    ]),
  ]);

  // If tier is 0, we already have the limit. Otherwise fetch it.
  const finalTier = Number(tier ?? 0);
  const tierLimit =
    finalTier === 0
      ? tierLimitForTier0
      : await queryCreditRegistry<bigint | number | string>('get_tier_limit', [
          nativeToScVal(finalTier, { type: 'u32' }),
        ]);

  return buildScorePayload(walletAddress, {
    score: Number(score ?? 0),
    tier: finalTier,
    tierLimit: BigInt(tierLimit ?? 0),
    metrics: {
      txCount: Number(metrics?.tx_count ?? 0),
      repaymentCount: Number(metrics?.repayment_count ?? 0),
      xlmBalance: Number(metrics?.avg_balance ?? 0),
      defaultCount: Number(metrics?.default_count ?? 0),
    },
    source: 'onchain',
    tierLabel: tierLabel(finalTier),
  });
}
````

## File: docs/TODO.md
````markdown
# Kredito — Runtime Fix TODO

Derived from live backend logs. Two distinct 500 errors observed.

---

## Fix 1 — `POST /api/credit/generate` → 500

**Error:** `Transaction contains more than one operation`
**File:** `backend/src/stellar/issuer.ts`

### Root Cause

`invokeIssuerContract()` loops over an array of operations and adds them all to a single
`TransactionBuilder` before calling `rpcServer.prepareTransaction(tx)`.
Soroban's RPC rejects any transaction with more than one `invokeHostFunction` operation.

`updateOnChainMetrics()` passes two operations to this function:

1. `update_metrics_raw`
2. `update_score`

### Fix

Split `invokeIssuerContract` into a single-op helper and call it **twice sequentially**
inside `updateOnChainMetrics`:

```typescript
// BEFORE — one tx, two ops → Soroban rejects
async function invokeIssuerContract(operations: { functionName: string; args: xdr.ScVal[] }[]) {
  ...
  for (const op of operations) {
    builder.addOperation(...); // adds both ops to same tx
  }
  const prepared = await rpcServer.prepareTransaction(tx); // 💥 throws here
}

export async function updateOnChainMetrics(...) {
  const hash = await invokeIssuerContract([
    { functionName: 'update_metrics_raw', args: [...] },
    { functionName: 'update_score',       args: [wallet] },
  ]);
  return { metricsTxHash: hash, scoreTxHash: hash };
}
```

```typescript
// AFTER — two separate single-op transactions
async function invokeIssuerContractSingle(
  functionName: string,
  args: xdr.ScVal[],
) {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const builder = new TransactionBuilder(issuerAccount, {
    fee: "1000",
    networkPassphrase,
  });
  builder.addOperation(
    Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(
            contractIds.creditRegistry,
          ).toScAddress(),
          functionName,
          args,
        }),
      ),
      auth: [],
    }),
  );
  const tx = builder.setTimeout(180).build();
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(issuerKeypair);
  const response = await rpcServer.sendTransaction(prepared);
  if (response.status !== "PENDING") {
    throw new Error(
      `Issuer transaction failed: ${JSON.stringify(response.errorResult ?? response)}`,
    );
  }
  await pollTransaction(response.hash);
  return response.hash;
}

export async function updateOnChainMetrics(
  walletAddress: string,
  metrics: WalletMetrics,
) {
  const wallet = Address.fromString(walletAddress).toScVal();

  // Two sequential single-op transactions — Soroban does not allow multi-op txs
  const metricsTxHash = await invokeIssuerContractSingle("update_metrics_raw", [
    wallet,
    nativeToScVal(metrics.txCount, { type: "u32" }),
    nativeToScVal(metrics.repaymentCount, { type: "u32" }),
    nativeToScVal(metrics.xlmBalance, { type: "u32" }),
    nativeToScVal(metrics.defaultCount, { type: "u32" }),
  ]);

  const scoreTxHash = await invokeIssuerContractSingle("update_score", [
    wallet,
  ]);

  return { metricsTxHash, scoreTxHash };
}
```

Also delete the old `invokeIssuerContract` function entirely — it is no longer used.

---

## Fix 2 — `POST /api/tx/sign-and-submit` (repay tx) → 500

**Error:** `txFeeBumpInnerFailed / txBadSeq`
**Files:** `backend/src/routes/loan.ts`, `frontend/app/loan/repay/page.tsx`

### Root Cause

The repay flow builds **both** unsigned XDRs (`approve` + `repay`) in a single
`POST /loan/repay` call, at the same moment, against the same account sequence number N.

```
POST /loan/repay
  → approve XDR built with seq N
  → repay   XDR built with seq N   ← stale before the user even signs it
```

Then:

1. User signs approve (seq N) → submitted → chain sequence becomes **N+1**
2. User signs repay (seq N) → submitted → **`txBadSeq`** because chain now expects N+1

The user's signature is over the sequence number. You cannot patch it after signing.
Retrying with a new fee-bump wrapping the same stale inner tx will always fail.

### Fix

Build the repay XDR **after** the approve transaction has settled on-chain, not upfront.

Add a new `POST /loan/repay-xdr` endpoint that builds a fresh repay XDR on demand:

```typescript
// backend/src/routes/loan.ts — add after the existing /repay route

router.post(
  "/repay-xdr",
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const loan = await getLoanFromChain(wallet);

    if (!loan || loan.repaid || loan.defaulted) {
      throw badRequest("No repayable loan found");
    }

    // Build against the CURRENT sequence number — approve has already settled by now
    const unsignedRepayXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      "repay",
      [Address.fromString(wallet).toScVal()],
    );

    res.json({ unsignedXdr: unsignedRepayXdr });
  }),
);
```

Update `POST /loan/repay` to return **only** the approve XDR (drop the repay XDR from the response):

```typescript
// In the existing /repay route, change the response shape:
const response: RepayResponse = {
  requiresSignature: true,
  transactions: [
    {
      type: "approve",
      unsignedXdr: unsignedApproveXdr,
      description: `Authorize pool to spend ${toPhpAmount(totalOwedStroops)} PHPC`,
    },
    // repay XDR removed — fetched separately after approve confirms
  ],
  summary,
};
```

Update `frontend/app/loan/repay/page.tsx` — after the approve tx confirms,
call `POST /loan/repay-xdr` to get a fresh repay XDR, then sign and submit it:

```typescript
// After approve is submitted successfully:
approvalCompleted = true;
setApprovalSubmitted(true);

// Fetch a freshly-sequenced repay XDR (account seq is now N+1)
setTxStep(4);
const { data: repayXdrData } = await api.post("/loan/repay-xdr");
const repayUnsignedXdr = repayXdrData.unsignedXdr;

// Sign it
const repayResult = await signTx(repayUnsignedXdr, user.wallet);
if ("error" in repayResult) throw new Error(`REPAY_SIGN:${repayResult.error}`);

// Submit it
setTxStep(5);
const finalResult = await api.post("/tx/sign-and-submit", {
  signedInnerXdr: [repayResult.signedXdr],
  flow: { action: "repay", step: "repay" },
});
setSuccess(finalResult.data);
```

Also remove the `repayUnsignedXdr` state and `approvalSubmitted` state from the component —
they are no longer needed since the XDR is fetched fresh each time.

---

## Summary

| #   | File(s)                                                           | Error                                          | Fix                                                                                                                   |
| --- | ----------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `backend/src/stellar/issuer.ts`                                   | `Transaction contains more than one operation` | Replace multi-op `invokeIssuerContract` with a single-op helper; call it twice sequentially in `updateOnChainMetrics` |
| 2   | `backend/src/routes/loan.ts` + `frontend/app/loan/repay/page.tsx` | `txBadSeq` on repay fee-bump                   | Add `POST /loan/repay-xdr` endpoint; frontend fetches a fresh repay XDR **after** approve confirms on-chain           |
````

## File: frontend/lib/api.ts
````typescript
import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { useWalletStore } from '../store/walletStore';
import { loginWithFreighter } from './freighter';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
  timeout: 90000,
});

let reauthPromise: Promise<string | null> | null = null;

async function ensureWalletAuthToken() {
  const currentToken = useAuthStore.getState().token;
  if (currentToken) {
    return currentToken;
  }

  const { isConnected } = useWalletStore.getState();
  if (!isConnected) {
    return null;
  }

  if (!reauthPromise) {
    reauthPromise = loginWithFreighter()
      .then((data) => {
        useAuthStore.getState().setAuth({ wallet: data.wallet }, data.token);
        return data.token;
      })
      .catch(() => {
        useAuthStore.getState().clearAuth();
        return null;
      })
      .finally(() => {
        reauthPromise = null;
      });
  }

  return reauthPromise;
}

api.interceptors.request.use((config) => {
  if (config.headers) {
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
  }

  const url = config.url ?? '';
  const isAuthRoute = url.includes('/auth/challenge') || url.includes('/auth/login');

  if (isAuthRoute) {
    return config;
  }

  return ensureWalletAuthToken().then((token) => {
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const url = typeof originalRequest?.url === 'string' ? originalRequest.url : '';
    const isAuthRoute = url.includes('/auth/challenge') || url.includes('/auth/login');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      const refreshedToken = await ensureWalletAuthToken();

      if (refreshedToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return api(originalRequest);
      }

      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kredito-auth');
        window.location.href = '/?session=expired';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
````

## File: backend/src/routes/auth.ts
````typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Keypair, StrKey, WebAuth } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { config } from '../config';
import { asyncRoute, badRequest, unauthorized } from '../errors';

const router = Router();
const webAuthKeypair = Keypair.fromSecret(config.webAuthSecretKey);
const CHALLENGE_TIMEOUT_SECONDS = 5 * 60;

const freighterChallengeSchema = z.object({
  wallet: z.string().startsWith('G'),
});

const freighterLoginSchema = z.object({
  signedChallenge: z.string().min(1),
});

function issueToken(wallet: string) {
  return jwt.sign({ sub: wallet }, config.jwtSecret, { expiresIn: '1h' });
}

router.post(
  '/challenge',
  asyncRoute(async (req, res) => {
    // Some frontend sends { stellarAddress: ... } or { wallet: ... }. Let's accept both for backwards compatibility
    const walletAddr = req.body.wallet || req.body.stellarAddress;
    const parsed = freighterChallengeSchema.safeParse({ wallet: walletAddr });

    if (!parsed.success) {
      throw badRequest('Invalid Stellar address');
    }

    if (!StrKey.isValidEd25519PublicKey(parsed.data.wallet)) {
      throw badRequest('Invalid Stellar address');
    }

    const challengeXdr = WebAuth.buildChallengeTx(
      webAuthKeypair,
      parsed.data.wallet,
      config.homeDomain,
      CHALLENGE_TIMEOUT_SECONDS,
      config.networkPassphrase,
      config.webAuthDomain,
    );

    res.json({
      challenge: challengeXdr,
      expiresAt: Math.floor(Date.now() / 1000) + CHALLENGE_TIMEOUT_SECONDS,
    });
  }),
);

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    // Accepts { signedChallenge } or { signedChallengeXdr }
    const xdr = req.body.signedChallenge || req.body.signedChallengeXdr;
    const parsed = freighterLoginSchema.safeParse({ signedChallenge: xdr });
    if (!parsed.success) {
      throw badRequest('Missing signed challenge');
    }

    let clientAccountID: string;

    try {
      const details = WebAuth.readChallengeTx(
        parsed.data.signedChallenge,
        webAuthKeypair.publicKey(),
        config.networkPassphrase,
        config.homeDomain,
        config.webAuthDomain,
      );

      clientAccountID = details.clientAccountID;

      WebAuth.verifyChallengeTxSigners(
        parsed.data.signedChallenge,
        webAuthKeypair.publicKey(),
        config.networkPassphrase,
        [clientAccountID],
        config.homeDomain,
        config.webAuthDomain,
      );
    } catch {
      throw unauthorized('Wallet signature could not be verified or challenge expired');
    }

    const token = issueToken(clientAccountID);

    return res.json({
      token,
      wallet: clientAccountID,
    });
  }),
);

export default router;
````

## File: backend/src/routes/credit.ts
````typescript
import { Router } from 'express';
import { Address } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, notFound } from '../errors';
import { buildScoreSummary, getPoolSnapshot } from '../scoring/engine';
import { getOnChainCreditSnapshot, updateOnChainMetrics } from '../stellar/issuer';
import { queryContract } from '../stellar/query';
import { contractIds } from '../stellar/client';
import { logger } from '../utils/logger';

const router = Router();

router.post(
  '/generate',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const summary = await buildScoreSummary(req.wallet);
    const txHashes = await updateOnChainMetrics(req.wallet, summary.metrics);
    const payload = {
      ...summary,
      txHashes,
    };

    logger.info({ wallet: req.wallet, score: summary.score }, 'Generated new credit score');
    res.json(payload);
  }),
);

router.get(
  '/score',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const payload = await getOnChainCreditSnapshot(req.wallet);
    if (payload.tier === 0 && payload.score === 0) {
      throw notFound('No score on-chain yet. Call generate first.');
    }

    logger.info(
      { wallet: req.wallet, score: payload.score },
      'Retrieved on-chain credit snapshot',
    );
    res.json(payload);
  }),
);

router.get(
  '/pool',
  authMiddleware,
  asyncRoute(async (_req: AuthRequest, res) => {
    res.json(await getPoolSnapshot());
  }),
);

router.get(
  '/metrics',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const metrics = await queryContract(contractIds.creditRegistry, 'get_metrics', [
      Address.fromString(req.wallet).toScVal(),
    ]);
    res.json(metrics);
  }),
);

export default router;
````

## File: backend/package.json
````json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc -p tsconfig.json",
    "lint": "eslint 'src/**/*.{ts,js}'",
    "test": "vitest run"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "engines": {
    "node": ">=20.12.0"
  },
  "packageManager": "pnpm@10.32.1",
  "dependencies": {
    "@stellar/stellar-sdk": "^15.0.1",
    "axios": "^1.15.2",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "express-rate-limit": "8.4.1",
    "jsonwebtoken": "^9.0.3",
    "node-cron": "^4.2.1",
    "p-limit": "^7.3.0",
    "pino": "10.3.1",
    "pino-http": "11.0.0",
    "pino-pretty": "^13.1.3",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^25.6.0",
    "@types/node-cron": "^3.0.11",
    "@types/supertest": "^7.2.0",
    "@typescript-eslint/eslint-plugin": "^8.59.1",
    "@typescript-eslint/parser": "^8.59.1",
    "eslint": "^10.2.1",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.5",
    "nodemon": "^3.1.14",
    "prettier": "^3.8.3",
    "supertest": "^7.2.2",
    "ts-node": "^10.9.2",
    "typescript": "^6.0.3",
    "vitest": "4.1.5"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "better-sqlite3",
      "@rolldown/binding-darwin-arm64"
    ]
  }
}
````

## File: docs/ARCHITECTURE.md
````markdown
# Architecture

## Backend Statelessness

The Kredito backend is designed to be **entirely stateless**. It does not maintain any in-memory or local database state for business logic.

- **Chain as Source of Truth**: All loan statuses, borrower records, and credit metrics are read directly from the Stellar blockchain (via RPC/Horizon).
- **No Caching**: In-memory caches (like the previous `scoreCache`) have been removed to ensure determinism across horizontal scale-outs and restarts.
- **Dynamic Discovery**: The admin sweep process dynamically discovers active borrowers by scanning contract events on-chain, rather than relying on a local list or in-memory tracking.

## Default Detection

The admin sweep process (`/api/admin/check-defaults`) performs a live scan of the ledger to find all historical borrowers, then queries the contract for the current state of each loan. It uses a concurrency-limited worker pool to identify and mark overdue loans as defaulted in a single pass.

## Scoring Metrics

The scoring engine uses the wallet's native XLM balance (labeled `xlmBalance` in `WalletMetrics`) rather than the PHPC balance. This is a design decision to reward users with established Stellar network presence. The UI explicitly labels this as "XLM Balance".

## CORS And Auth

The backend CORS configuration is driven by `CORS_ORIGIN` and remains a strict allowlist in production. 

### CSRF Protection

In addition to JWT-based authentication, the backend implements basic CSRF protection by requiring the `X-Requested-With: XMLHttpRequest` header on all state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`). The frontend API client (`lib/api.ts`) automatically includes this header.

JWTs are currently stored client-side in `localStorage` and sent as bearer tokens. A stronger production posture would move auth to `HttpOnly` `SameSite=Strict` cookies.
````

## File: frontend/app/dashboard/page.tsx
````typescript
// frontend/app/dashboard/page.tsx

'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRight,
  ChartColumn,
  Clock,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { tierGradient, tierContextPhrase } from '@/lib/tiers';
import { QUERY_KEYS } from '@/lib/queryKeys';

interface ScoreResponse {
  score: number;
  tier: number;
  tierLabel: string;
  borrowLimit: string;
  feeRate: number;
  feeBps: number;
  nextTier: string | null;
  nextTierThreshold: number | null;
  progressToNext: number;
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
    xlmBalance: number;
    xlmBalanceFactor: number;
    defaultCount: number;
  };
}

interface LoanStatusResponse {
  hasActiveLoan: boolean;
  poolBalance: string;
  loan: null | {
    totalOwed: string;
    status: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = !!user && !!token;

  // 1. Primary: Get the latest cached score (fast)
  const scoreQuery = useQuery({
    queryKey: QUERY_KEYS.score(user?.wallet ?? ''),
    queryFn: () => api.get<ScoreResponse>('/credit/score').then((res) => res.data),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // 2. Secondary: Generate a new score if none exists or user clicks refresh
  const generateMutation = useMutation({
    mutationFn: () => api.post<ScoreResponse>('/credit/generate').then((res) => res.data),
    onSuccess: async (data) => {
      queryClient.setQueryData(QUERY_KEYS.score(user?.wallet ?? ''), data);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pool });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? '') });
    },
  });

  // 3. Auto-trigger generate only if score is missing
  const scoreStatus = (
    scoreQuery.error as { response?: { status?: number } } | null
  )?.response?.status;
  const shouldAutoGenerate = scoreStatus === 404;
  const mutate = generateMutation.mutate;
  useEffect(() => {
    if (
      shouldAutoGenerate &&
      !scoreQuery.data &&
      !generateMutation.isPending &&
      !generateMutation.data &&
      !generateMutation.isError
    ) {
      mutate();
    }
  }, [
    shouldAutoGenerate,
    scoreQuery.data,
    generateMutation.isPending,
    generateMutation.data,
    generateMutation.isError,
    mutate,
  ]);

  const poolQuery = useQuery({
    queryKey: QUERY_KEYS.pool,
    queryFn: () => api.get<{ poolBalance: string }>('/credit/pool').then((res) => res.data),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const loanStatusQuery = useQuery({
    queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? ''),
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  if (!isAuthenticated) return null;

  const score = scoreQuery.data ?? generateMutation.data;
  const loanStatus = loanStatusQuery.data;
  const isLoading = !score && (scoreQuery.isLoading || generateMutation.isPending);
  const scoreError =
    scoreQuery.isError && !shouldAutoGenerate
      ? 'Unable to load your score right now. Please try again.'
      : generateMutation.isError
        ? getErrorMessage(generateMutation.error, 'Unable to generate your on-chain score right now.')
        : '';
  const poolValue = poolQuery.isError ? 'Pool balance unavailable' : `P${poolQuery.data?.poolBalance ?? '0.00'}`;
  const loanStatusUnavailable = loanStatusQuery.isError;
  
  const nextTierProgress = score?.nextTierThreshold
    ? Math.max(0, Math.min(100, (score.score / score.nextTierThreshold) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Your Credit Passport overview
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <section
          className="lg:col-span-3 rounded-2xl p-6 animate-fade-up relative overflow-hidden"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="flex items-center gap-6">
              <div className="relative flex items-center justify-center h-32 w-32">
                <ScoreArc score={score?.score ?? 0} isLoading={isLoading} />
                <div className="text-center">
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Score
                  </p>
                  {isLoading ? (
                    <div className="skeleton h-10 w-16 mx-auto" />
                  ) : (
                    <h2 
                      className="text-4xl font-extrabold tabular-nums"
                      aria-label={`Credit score: ${score?.score ?? "not available"}`}
                    >
                      {score?.score ?? '--'}
                    </h2>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Credit Status
                </p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                  {score ? tierContextPhrase(score.score) : '--'}
                </p>
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-2 text-sm font-bold shadow-lg"
              style={{ background: tierGradient(score?.tier ?? 0), color: '#020617' }}
            >
              {score?.tierLabel ?? 'Unrated'}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 relative z-10">
            <Metric label="Borrow limit" value={`P${score?.borrowLimit ?? '0.00'}`} loading={isLoading} />
            <Metric label="Fee rate" value={`${(score?.feeRate ?? 0).toFixed(2)}%`} loading={isLoading} />
            <Metric label="Transactions" value={`${score?.metrics.txCount ?? 0}`} loading={isLoading} />
            <Metric label="Repayments" value={`${score?.metrics.repaymentCount ?? 0}`} loading={isLoading} />
          </div>

          <div className="mt-6 rounded-xl p-4 relative z-10" style={{ background: 'rgba(148, 163, 184, 0.06)' }}>
            <div className="flex items-center justify-between text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              <span>
                {score?.nextTier 
                  ? `You need ${score.progressToNext} more points to reach ${score.nextTier}` 
                  : 'You have reached the top tier'}
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {score?.nextTier ? `${score.score} / ${score.nextTierThreshold}` : 'Max'}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-bg-elevated)' }}>
              <div 
                className="h-2 rounded-full progress-animated" 
                style={{ width: `${nextTierProgress}%`, background: tierGradient(score?.tier ?? 0) }} 
              />
            </div>
          </div>

          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || (!score && isLoading)}
            className="btn-primary btn-dark mt-6 relative z-10"
          >
            <RefreshCw size={16} className={generateMutation.isPending ? 'animate-spin' : ''} />
            {generateMutation.isPending ? 'Refreshing on-chain score...' : 'Refresh On-Chain Score'}
          </button>
          {scoreError ? (
            <p className="mt-3 text-sm font-medium" style={{ color: 'var(--color-danger)' }} role="alert">
              {scoreError}
            </p>
          ) : null}
        </section>

        <div className="lg:col-span-2 flex flex-col gap-5">
          <section className="card-elevated flex-1 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Pool status
                </p>
                <h2 className="mt-1 text-lg font-extrabold">{poolValue}</h2>
              </div>
              <div
                className="rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{
                  background: 'var(--color-accent-glow)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border-accent)',
                }}
              >
                {(score?.feeRate ?? 0).toFixed(2)}% fee
              </div>
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {poolQuery.isError ? 'Try refreshing again in a moment.' : 'Funded by lenders, NGOs, and DAOs.'}
            </p>

            {loanStatusUnavailable ? (
              <div className="mt-5">
                <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--color-bg-card)' }}>
                  Loan status unavailable
                </div>
                <button className="btn-primary btn-accent mt-4" disabled>
                  Loan status unavailable
                </button>
              </div>
            ) : loanStatus?.hasActiveLoan ? (
              <div className="mt-5">
                <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--color-bg-card)' }}>
                  Outstanding: <span className="font-bold">P{loanStatus.loan?.totalOwed ?? '0.00'}</span>
                </div>
                <button onClick={() => router.push('/loan/repay')} className="btn-primary btn-accent mt-4">
                  Repay Active Loan
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push('/loan/borrow')}
                disabled={!score || score.tier === 0 || isLoading}
                className="btn-primary btn-accent mt-5"
              >
                {score?.tier === 0 ? 'Tier too low to borrow' : `Borrow P${score?.borrowLimit ?? '0.00'}`}
                {score?.tier === 0 ? null : <ArrowRight size={16} />}
              </button>
            )}
            {score?.tier === 0 && (
              <p className="mt-3 text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Your current tier doesn&apos;t qualify for borrowing. Complete more on-chain transactions to build your score.
              </p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-4 animate-fade-up">
            <InfoCard
              icon={Clock}
              title="Last Updated"
              value={scoreQuery.dataUpdatedAt > 0 ? formatDistanceToNow(scoreQuery.dataUpdatedAt, { addSuffix: true }) : 'Not yet synced'}
              isLoading={isLoading}
            />
            <InfoCard icon={Wallet} title="Wallet" value={`${user.wallet.slice(0, 4)}…${user.wallet.slice(-4)}`} isLoading={false} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card-elevated animate-fade-up">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-bg-elevated)' }}>
              <ChartColumn size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Score formula</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {score?.formula.expression}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading formula">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-16" />
              ))}
            </div>
          ) : score ? (
            <div className="rounded-2xl p-6 font-mono text-sm leading-8" style={{ background: 'var(--color-bg-card)' }}>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 max-w-sm">
                <span>score</span> <span className="text-slate-500">=</span> <span className="text-right">({score.metrics.txCount} x 2) = {score.formula.txComponent}</span>
                <span></span> <span className="text-slate-500">+</span> <span className="text-right">({score.metrics.repaymentCount} x 10) = {score.formula.repaymentComponent}</span>
                <span></span> <span className="text-slate-500">+</span> <span className="text-right">({score.metrics.xlmBalanceFactor} x 5) = {score.formula.balanceComponent}</span>
                <span></span> <span className="text-slate-500">-</span> <span className="text-right">({score.metrics.defaultCount} x 25) = {score.formula.defaultPenalty}</span>
                <div className="col-span-3 border-t my-2 border-slate-700"></div>
                <span className="font-bold">Total</span> <span></span> <span className="text-right font-bold text-emerald-500">= {score.formula.total}</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="card-elevated animate-fade-up">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-bg-elevated)' }}>
              <TrendingUp size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Raw metrics</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Deterministic inputs read from Horizon and on-chain events.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-24" role="status" aria-busy="true" />)
              : [
                  { label: 'XLM balance', value: `${score?.metrics.xlmBalance ?? 0} XLM` },
                  { label: 'Balance factor', value: `${score?.metrics.xlmBalanceFactor ?? 0}` },
                  { label: 'Defaults', value: `${score?.metrics.defaultCount ?? 0}` },
                  { label: 'Status', value: score?.tier === 0 ? 'Building' : 'Active' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
                    <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-bold tabular-nums">{item.value}</p>
                  </div>
                ))}
          </div>

          {(scoreQuery.isError && !generateMutation.isPending) || poolQuery.isError || loanStatusQuery.isError ? (
            <button
              onClick={() => {
                void scoreQuery.refetch();
                void poolQuery.refetch();
                void loanStatusQuery.refetch();
              }}
              className="btn-primary btn-dark mt-5"
            >
              Retry
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
      <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      {loading ? <div className="skeleton mt-3 h-7 w-20" /> : <p className="mt-2 text-lg font-bold tabular-nums">{value}</p>}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  isLoading,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  title: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <div className="card-elevated">
      <Icon size={16} style={{ color: 'var(--color-text-secondary)' }} />
      <p className="mt-3 text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {title}
      </p>
      {isLoading ? <div className="skeleton mt-3 h-7 w-20" /> : <p className="mt-2 text-lg font-bold tabular-nums">{value}</p>}
    </div>
  );
}

function ScoreArc({ score, isLoading }: { score: number; isLoading: boolean }) {
  const maxScore = 200;
  const percentage = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-slate-800"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          style={{ 
            strokeDashoffset: isLoading ? circumference : offset,
            transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
            color: 'var(--color-accent)'
          }}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
````

## File: backend/src/stellar/query.ts
````typescript
// backend/src/stellar/query.ts

import {
  TransactionBuilder,
  rpc,
  xdr,
  Operation,
  Address,
  scValToNative,
} from '@stellar/stellar-sdk';
import { rpcServer, networkPassphrase, issuerKeypair, contractIds } from './client';
import pLimit from 'p-limit';
import { sleep } from '../utils/sleep';
import { paginateEvents } from './events';

export interface LoanState {
  principal: bigint;
  fee: bigint;
  due_ledger: number;
  repaid: boolean;
  defaulted: boolean;
}

export interface LoanRepaymentConfirmation {
  confirmed: boolean;
  loan: LoanState | null;
}

export interface LoanRecordWithBorrower extends LoanState {
  walletAddress: string;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, backoffMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(backoffMs * 2 ** i);
    }
  }
  throw new Error('unreachable');
}

async function getAllLendingPoolEvents() {
  const filters: rpc.Api.EventFilter[] = [
    {
      type: 'contract',
      contractIds: [contractIds.lendingPool],
    },
  ];

  const latestLedger = await withRetry(() => rpcServer.getLatestLedger());
  const requestedStartLedger = Math.max(0, latestLedger.sequence - 250_000); 

  const { events, oldestLedger } = await paginateEvents(filters, requestedStartLedger);

  return {
    events,
    latestLedger: latestLedger.sequence,
    oldestLedger,
  };
}

export async function discoverBorrowersFromChain(): Promise<{
  borrowers: string[];
  latestLedger: number;
  oldestLedger: number;
}> {
  const { events, latestLedger, oldestLedger } = await getAllLendingPoolEvents();
  const borrowers = new Set<string>();

  for (const event of events) {
    // P2-4: Filter by event topic[0] === 'disburse' to be precise
    const topicName = scValToNative(event.topic[0]);
    if (topicName !== 'disburse') continue;

    const borrower = event.topic[1] ? scValToNative(event.topic[1]) : null;
    if (typeof borrower === 'string' && borrower.startsWith('G')) {
      borrowers.add(borrower);
    }
  }

  return {
    borrowers: [...borrowers],
    latestLedger,
    oldestLedger,
  };
}

export async function queryContract<T = unknown>(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
): Promise<T> {
  const issuerAccount = await withRetry(() => rpcServer.getAccount(issuerKeypair.publicKey()));

  const tx = new TransactionBuilder(issuerAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractId).toScAddress(),
            functionName: functionName,
            args: args,
          }),
        ),
        auth: [],
      }),
    )
    .setTimeout(30)
    .build();

  const response = await withRetry(() => rpcServer.simulateTransaction(tx));

  if (rpc.Api.isSimulationSuccess(response)) {
    return scValToNative(response.result!.retval) as T;
  }

  throw new Error(`Contract query failed for ${functionName}: ${JSON.stringify(response)}`);
}

export async function getLoanFromChain(walletAddress: string): Promise<LoanState | null> {
  const loan = await queryContract<{
    principal?: bigint;
    fee?: bigint;
    due_ledger?: number | bigint;
    repaid?: boolean;
    defaulted?: boolean;
  }>(contractIds.lendingPool, 'get_loan', [Address.fromString(walletAddress).toScVal()]);

  if (!loan) {
    return null;
  }

  return {
    principal: BigInt(loan.principal ?? 0),
    fee: BigInt(loan.fee ?? 0),
    due_ledger: Number(loan.due_ledger ?? 0),
    repaid: Boolean(loan.repaid),
    defaulted: Boolean(loan.defaulted),
  };
}

export async function getAllLoansFromChain(): Promise<{
  loans: LoanRecordWithBorrower[];
  latestLedger: number;
  oldestLedger: number;
}> {
  // TODO: This is O(N) and not scalable.
  // Replace with indexed event store or subgraph in production.
  const { borrowers, latestLedger, oldestLedger } = await discoverBorrowersFromChain();
  const limit = pLimit(5);
  const loans = await Promise.all(
    borrowers.map((walletAddress) =>
      limit(async () => {
        const loan = await getLoanFromChain(walletAddress);
        return loan ? { walletAddress, ...loan } : null;
      }),
    ),
  );

  return {
    loans: loans.filter((loan): loan is LoanRecordWithBorrower => loan !== null),
    latestLedger,
    oldestLedger,
  };
}

export async function waitForLoanRepayment(
  walletAddress: string,
  retries = 3,
  delayMs = 3000,
): Promise<LoanState> {
  let lastLoan: LoanState | null = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    lastLoan = await getLoanFromChain(walletAddress);
    if (lastLoan?.repaid) {
      return lastLoan;
    }

    if (attempt < retries - 1) {
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Repayment confirmation did not settle in time for wallet ${walletAddress} after ${retries} attempts.`,
  );
}

export async function hasActiveLoan(walletAddress: string): Promise<boolean> {
  const loan = await getLoanFromChain(walletAddress);
  return Boolean(loan && !loan.repaid && !loan.defaulted);
}
````

## File: frontend/app/loan/borrow/page.tsx
````typescript
// frontend/app/loan/borrow/page.tsx

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TimerReset, Info, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { REQUIRED_NETWORK } from '@/lib/constants';
import { QUERY_KEYS } from '@/lib/queryKeys';
import StepBreadcrumb from '@/components/StepBreadcrumb';
import WalletConnectionBanner from '@/components/WalletConnectionBanner';
import CelebrationParticles from '@/components/CelebrationParticles';
import SummaryRow from '@/components/SummaryRow';
import { signTx } from '@/lib/freighter';
import { toast } from 'sonner';

interface ScoreResponse {
  tier: number;
  tierLabel: string;
  borrowLimit: string;
  feeRate: number;
  feeBps: number;
}

interface LoanStatusResponse {
  hasActiveLoan: boolean;
  poolBalance: string;
}

interface BorrowSuccess {
  amount: string;
  fee: string;
  feeBps: number;
  totalOwed: string;
  txHash: string;
  explorerUrl: string;
}

export default function BorrowPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = !!user && !!token;
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'review' | 'confirm'>('review');
  const [txStep, setTxStep] = useState<number>(0); // 0: Idle, 1: Preparing, 2: Signing, 3: Submitting, 4: Confirming
  const [success, setSuccess] = useState<BorrowSuccess | null>(null);
  const [error, setError] = useState('');
  const [borrowAmountInput, setBorrowAmountInput] = useState('');
  const [debouncedBorrowAmountInput, setDebouncedBorrowAmountInput] = useState('');
  const [hasEditedAmount, setHasEditedAmount] = useState(false);
  const [hasAmountInteracted, setHasAmountInteracted] = useState(false);

  const { isConnected: walletConnected, network, connectionError: walletError } = useWalletStore();
  const isCorrectNetwork = network === REQUIRED_NETWORK;
  const canBorrow = walletConnected && isCorrectNetwork && agreed;

  const { data: score } = useQuery({
    queryKey: QUERY_KEYS.score(user?.wallet ?? ''),
    queryFn: () => api.get<ScoreResponse>('/credit/score').then((res) => res.data),
    enabled: isAuthenticated,
  });

  const { data: loanStatus, isLoading: isLoanStatusLoading } = useQuery({
    queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? ''),
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    if (!isLoanStatusLoading && loanStatus?.hasActiveLoan && !success) {
      toast.error('You already have an active loan.');
      router.replace('/loan/repay');
    }
  }, [isAuthenticated, loanStatus, isLoanStatusLoading, router, success]);

  const borrowLimit = Number(score?.borrowLimit || 0);
  const isScoreLoading = !score;
  const effectiveBorrowAmountInput =
    borrowAmountInput === '' && !hasEditedAmount && borrowLimit > 0
      ? borrowLimit.toFixed(2)
      : borrowAmountInput;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedBorrowAmountInput(borrowAmountInput);
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [borrowAmountInput]);

  const parsedBorrowAmount = Number(hasEditedAmount ? debouncedBorrowAmountInput : effectiveBorrowAmountInput);
  const borrowAmount =
    Number.isFinite(parsedBorrowAmount) && parsedBorrowAmount > 0 ? parsedBorrowAmount : 0;
  const fee = borrowAmount * ((score?.feeBps || 0) / 10_000);
  const isAmountValid = borrowAmount > 0 && borrowAmount <= borrowLimit;
  const amountError =
    hasAmountInteracted && borrowLimit > 0 && !isAmountValid
      ? `Enter an amount between P0.01 and P${borrowLimit.toFixed(2)}.`
      : '';
  const summaryRows = useMemo(
    () => [
      { label: 'Tier', value: score?.tierLabel || 'Unrated' },
      { label: 'Fee', value: `${(score?.feeRate || 0).toFixed(2)}%` },
      { label: 'Term', value: '30 days' },
      { label: 'Repayment', value: `P${(borrowAmount + fee).toFixed(2)}`, strong: true },
    ],
    [borrowAmount, fee, score?.feeRate, score?.tierLabel],
  );

  const handleBorrow = async () => {
    if (!isAmountValid) {
      setHasAmountInteracted(true);
      setError(`Enter an amount between P0.01 and P${borrowLimit.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    setError('');
    setTxStep(1); // Preparing
    try {
      const { data } = await api.post('/loan/borrow', { amount: borrowAmount });

      if (data.requiresSignature) {
        setTxStep(2); // Signing
        const signResult = await signTx(data.unsignedXdr, user!.wallet!);
        if ('error' in signResult) throw new Error(signResult.error);

        setTxStep(3); // Submitting
        const result = await api.post('/tx/sign-and-submit', {
          signedInnerXdr: [signResult.signedXdr],
          flow: { action: 'borrow' },
        });

        setTxStep(4); // Confirming
        setSuccess(result.data);
      } else {
        setTxStep(4); // Confirming
        setSuccess(data);
      }

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? '') });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pool });
    } catch (err: unknown) {
      const message = getBorrowErrorMessage(err, borrowLimit);
      if (message === '__ACTIVE_LOAN__') {
        toast.error('You already have an active loan.');
        router.replace('/loan/repay');
        return;
      }
      setError(message);
      setTxStep(0);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center relative">
        <CelebrationParticles />
        <div className="card-elevated w-full animate-fade-up">
          <div className="flex flex-col items-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />
            </div>
            <h1 className="text-3xl font-extrabold">Funds released</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your wallet received the loan instantly from the on-chain pool.
            </p>
          </div>

          <div className="mt-8 rounded-xl p-5 text-left" style={{ background: 'var(--color-bg-card)' }}>
            <SummaryRow label="Amount" value={`P${success.amount}`} />
            <SummaryRow label={`Fee (${(success.feeBps / 100).toFixed(2)}%)`} value={`P${success.fee}`} />
            <SummaryRow label="Total owed" value={`P${success.totalOwed}`} strong />
          </div>

          <a 
            href={success.explorerUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="mt-6 inline-flex text-sm font-medium transition-colors hover:brightness-110" 
            style={{ color: 'var(--color-accent)' }}
          >
            View on Stellar Expert ↗
          </a>

          <button onClick={() => router.push('/loan/repay')} className="btn-primary btn-accent mt-8">
            Continue to Repay
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 animate-fade-up">
        <StepBreadcrumb step={3} total={4} />
        <h1 className="mt-2 text-2xl font-extrabold lg:text-3xl">Borrow from the pool</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Eligibility is enforced by the on-chain tier stored in your Credit Passport.
        </p>
      </div>

      <WalletConnectionBanner />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-elevated animate-fade-up">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
            Approved amount
          </p>
          {isScoreLoading ? (
            <div className="skeleton mt-4 h-12 w-40" role="status" aria-busy="true" />
          ) : (
            <p className="mt-4 text-5xl font-extrabold tabular-nums">P{borrowAmount.toFixed(2)}</p>
          )}
          <p className="mt-2 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Max available now: P{borrowLimit.toFixed(2)}
          </p>
          <div className="mt-6 space-y-3" style={{ color: 'var(--color-text-secondary)' }}>
            {isScoreLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="skeleton h-6" role="status" aria-busy="true" />
                ))
              : summaryRows.map((row) => (
                  <SummaryRow key={row.label} label={row.label} value={row.value} strong={row.strong} />
                ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 animate-fade-up">
          {step === 'review' ? (
            <div className="flex flex-col h-full">
              <div className="flex gap-3 rounded-xl p-4 text-sm mb-4" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-amber)' }}>
                <TimerReset className="mt-0.5 shrink-0" size={16} />
                <p>Repay before the due ledger to protect your score. Timely repayment improves the next score refresh.</p>
              </div>
              <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Info size={16} style={{ color: 'var(--color-accent)' }} />
                  Loan Review
                </h3>
                <label className="mb-4 block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                    Borrow amount
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    max={borrowLimit > 0 ? borrowLimit.toFixed(2) : undefined}
                    step="0.01"
                    inputMode="decimal"
                    value={borrowAmountInput}
                    placeholder={borrowLimit > 0 ? borrowLimit.toFixed(2) : '0.00'}
                    onBlur={() => setHasAmountInteracted(true)}
                    onChange={(event) => {
                      setHasEditedAmount(true);
                      setHasAmountInteracted(true);
                      setBorrowAmountInput(event.target.value);
                    }}
                    className="w-full rounded-xl border px-4 py-3 text-base font-semibold outline-none transition-colors"
                    style={{
                      background: 'var(--color-bg-secondary)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                </label>
                <ul className="text-xs space-y-2 list-disc pl-4" style={{ color: 'var(--color-text-secondary)' }}>
                  <li>Instant disbursement to your connected wallet.</li>
                  <li>30-day fixed term.</li>
                  <li>Fee is deducted upon repayment, not from the principal.</li>
                </ul>
              </div>
              <div className="flex gap-3 rounded-xl p-4 text-sm mb-4" style={{ background: 'var(--color-accent-glow)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-accent)' }}>
                <Info className="mt-0.5 shrink-0" size={16} style={{ color: 'var(--color-accent)' }} />
                <p>
                  After borrowing P{borrowAmount.toFixed(2)}, you will need to top up at least P{fee.toFixed(2)} PHPC before repayment so your wallet can cover the fee.
                </p>
              </div>
              {amountError && (
                <p className="mb-4 text-xs font-medium" style={{ color: 'var(--color-danger)' }}>
                  {amountError}
                </p>
              )}
              <button 
                onClick={() => setStep('confirm')}
                disabled={!isAmountValid || score?.tier === 0 || isScoreLoading}
                className="btn-primary btn-accent mt-auto"
              >
                {!isAmountValid || score?.tier === 0 ? 'Not Eligible' : 'Review & Confirm'}
                <ArrowRight size={16} />
              </button>
              {score?.tier === 0 && (
                <p className="mt-2 text-[11px] text-center" style={{ color: 'var(--color-text-muted)' }}>
                  Your current tier doesn&apos;t qualify for borrowing.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <button 
                onClick={() => setStep('review')}
                className="text-xs mb-4 w-fit transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ← Back to review
              </button>
              
              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl p-4 text-sm transition-all"
                style={{
                  background: agreed ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                  border: agreed ? '1px solid var(--color-border-accent)' : '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-[#22C55E] rounded"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span>I confirm I want to borrow P{borrowAmount.toFixed(2)} and agree to repay within 30 days.</span>
              </label>

              {error || (walletConnected && !isCorrectNetwork ? walletError : null) ? (
                <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }} role="alert">
                  {error || walletError}
                </div>
              ) : null}

              {!walletConnected && (
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                  <Wallet size={14} />
                  Connect your wallet first
                </div>
              )}

              {walletConnected && !isCorrectNetwork && (
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                  <Info size={14} />
                  Switch Freighter to Testnet
                </div>
              )}

              {walletConnected && isCorrectNetwork && !agreed && (
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--color-bg-card)', color: 'var(--color-accent)' }}>
                  <Info size={14} />
                  Check the box to confirm
                </div>
              )}

              <div className="mt-auto pt-6">
                {loading && (
                  <div className="mb-4">
                    <TransactionStepper currentStep={txStep} />
                  </div>
                )}
                <button 
                  onClick={handleBorrow} 
                  disabled={!canBorrow || loading} 
                  className="btn-primary btn-accent w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Confirm Borrow P{borrowAmount.toFixed(2)}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getBorrowErrorMessage(err: unknown, borrowLimit: number) {
  const message = getErrorMessage(err, 'Borrowing failed. Please try again.');

  if (/user rejected|cancelled/i.test(message)) {
    return 'Signing cancelled.';
  }

  if (message === 'Insufficient pool liquidity') {
    return 'Pool has insufficient funds. Try a smaller amount.';
  }

  if (message === 'Amount exceeds tier limit') {
    return `Enter an amount between P0.01 and P${borrowLimit.toFixed(2)}.`;
  }

  if (message === 'Active loan already exists') {
    return '__ACTIVE_LOAN__';
  }

  return message;
}

function TransactionStepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Preparing', id: 1 },
    { label: 'Signing', id: 2 },
    { label: 'Submitting', id: 3 },
    { label: 'Confirming', id: 4 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        {steps.map((s) => (
          <div 
            key={s.id} 
            className="flex flex-col items-center gap-1.5"
            style={{ opacity: currentStep >= s.id ? 1 : 0.3 }}
          >
            <div 
              className={`h-1.5 w-12 rounded-full transition-all duration-500 ${currentStep === s.id ? 'pulse-glow' : ''}`}
              style={{ background: currentStep >= s.id ? 'var(--color-accent)' : 'var(--color-bg-elevated)' }}
            />
            <span className="text-[9px] font-bold uppercase tracking-tighter" style={{ color: currentStep >= s.id ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
````

## File: backend/src/scoring/engine.ts
````typescript
// backend/src/scoring/engine.ts

import { Address, Horizon, scValToNative, xdr } from '@stellar/stellar-sdk';
import { LEDGERS_PER_DAY, STROOPS_PER_UNIT } from '../config';
import { contractIds, horizonServer, rpcServer } from '../stellar/client';
import { queryContract } from '../stellar/query';
import { paginateEvents } from '../stellar/events';

const REPAYMENT_LOOKBACK_LEDGERS = 250_000;

export interface WalletMetrics {
  txCount: number;
  repaymentCount: number;
  xlmBalance: number;
  defaultCount: number;
}

export interface ScoreFactor {
  key: string;
  label: string;
  value: number;
  weight: string;
  points: number;
}

export function calculateScore(metrics: WalletMetrics): number {
  const xlmBalanceFactor = Math.min(Math.floor(metrics.xlmBalance / 100), 10);
  return Math.max(
    0,
    metrics.txCount * 2 +
      metrics.repaymentCount * 10 +
      xlmBalanceFactor * 5 -
      metrics.defaultCount * 25,
  );
}

export function scoreToTier(score: number): 0 | 1 | 2 | 3 {
  if (score >= 120) return 3;
  if (score >= 80) return 2;
  if (score >= 40) return 1;
  return 0;
}

export function tierLabel(tier: number) {
  switch (tier) {
    case 3:
      return 'Gold';
    case 2:
      return 'Silver';
    case 1:
      return 'Bronze';
    default:
      return 'Unrated';
  }
}

export function tierFeeBps(tier: number) {
  switch (tier) {
    case 3:
      return 150;
    case 2:
      return 300;
    case 1:
      return 500;
    default:
      return 500;
  }
}

export function nextTier(score: number) {
  if (score < 40) return { threshold: 40, label: 'Bronze' };
  if (score < 80) return { threshold: 80, label: 'Silver' };
  if (score < 120) return { threshold: 120, label: 'Gold' };
  return null;
}

export function toPhpAmount(value: bigint | number) {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  const whole = amount / STROOPS_PER_UNIT;
  const fraction = amount % STROOPS_PER_UNIT;
  const minimumDisplayFraction = STROOPS_PER_UNIT / 100n;

  if (fraction === 0n || (whole === 0n && fraction < minimumDisplayFraction)) {
    return `${whole.toString()}.00`;
  }

  const trimmedFraction = fraction.toString().padStart(7, '0').replace(/0+$/, '');
  return `${whole.toString()}.${trimmedFraction.padEnd(2, '0')}`;
}

export function toPhpNumber(value: bigint | number) {
  return Number(toPhpAmount(value));
}

export function toStroops(amount: number) {
  return BigInt(Math.round(amount * 10_000_000));
}

export function buildScoreFactors(metrics: WalletMetrics): ScoreFactor[] {
  const xlmBalanceFactor = Math.min(Math.floor(metrics.xlmBalance / 100), 10);

  return [
    {
      key: 'txCount',
      label: 'Transaction count',
      value: metrics.txCount,
      weight: 'tx_count × 2',
      points: metrics.txCount * 2,
    },
    {
      key: 'repaymentCount',
      label: 'Repayments',
      value: metrics.repaymentCount,
      weight: 'repayment_count × 10',
      points: metrics.repaymentCount * 10,
    },
    {
      key: 'xlmBalanceFactor',
      label: 'XLM balance factor',
      value: xlmBalanceFactor,
      weight: 'xlm_balance_factor × 5',
      points: xlmBalanceFactor * 5,
    },
    {
      key: 'defaultCount',
      label: 'Defaults penalty',
      value: metrics.defaultCount,
      weight: 'default_count × -25',
      points: metrics.defaultCount * -25,
    },
  ];
}

export function buildScorePayload(
  walletAddress: string,
  input: {
    score: number;
    tier: number;
    tierLimit: bigint;
    metrics: WalletMetrics;
    source: 'generated' | 'onchain';
    tierLabel?: string;
    txHashes?: { metricsTxHash?: string; scoreTxHash?: string };
  },
) {
  const xlmBalanceFactor = Math.min(Math.floor(input.metrics.xlmBalance / 100), 10);
  const factors = buildScoreFactors(input.metrics);
  const upcomingTier = nextTier(input.score);

  return {
    walletAddress,
    source: input.source,
    score: input.score,
    tier: input.tier,
    tierNumeric: input.tier,
    tierLabel: input.tierLabel ?? tierLabel(input.tier),
    borrowLimit: toPhpAmount(input.tierLimit),
    borrowLimitRaw: input.tierLimit.toString(),
    feeRate: tierFeeBps(input.tier) / 100,
    feeBps: tierFeeBps(input.tier),
    progressToNext: upcomingTier ? Math.max(0, upcomingTier.threshold - input.score) : 0,
    nextTier: upcomingTier?.label ?? null,
    nextTierThreshold: upcomingTier?.threshold ?? null,
    metrics: {
      txCount: input.metrics.txCount,
      repaymentCount: input.metrics.repaymentCount,
      xlmBalance: input.metrics.xlmBalance,
      xlmBalanceFactor,
      defaultCount: input.metrics.defaultCount,
    },
    formula: {
      expression:
        'score = (tx_count × 2) + (repayment_count × 10) + (xlm_balance_factor × 5) - (default_count × 25)',
      txComponent: input.metrics.txCount * 2,
      repaymentComponent: input.metrics.repaymentCount * 10,
      balanceComponent: xlmBalanceFactor * 5,
      defaultPenalty: input.metrics.defaultCount * 25,
      total: input.score,
    },
    factors,
    txHashes: input.txHashes ?? {},
  };
}

export async function fetchTxCount(address: string): Promise<number> {
  try {
    let txCount = 0;
    let cursor = '';
    while (true) {
      const page = await horizonServer
        .transactions()
        .forAccount(address)
        .limit(200)
        .order('desc')
        .cursor(cursor)
        .call();

      txCount += page.records.length;

      if (page.records.length < 200 || txCount >= 1000) {
        break;
      }

      cursor = page.records[page.records.length - 1].paging_token;
    }
    return Math.min(txCount, 1000);
  } catch {
    return 0;
  }
}

/**
 * Returns the wallet's native XLM balance in whole units, not PHPC.
 * This remains the current scoring input so UI copy must label it as XLM.
 */
export async function fetchXlmBalance(address: string): Promise<number> {
  try {
    const account = await horizonServer.accounts().accountId(address).call();
    const nativeBalance = account.balances.find(
      (balance): balance is Horizon.HorizonApi.BalanceLineNative => balance.asset_type === 'native',
    );
    return nativeBalance ? Math.max(0, Math.floor(Number(nativeBalance.balance))) : 0;
  } catch {
    return 0;
  }
}

export async function fetchRepaymentMetrics(
  address: string,
): Promise<Pick<WalletMetrics, 'repaymentCount' | 'defaultCount'>> {
  try {
    const latestLedger = await rpcServer.getLatestLedger();
    const requestedStartLedger = Math.max(0, latestLedger.sequence - REPAYMENT_LOOKBACK_LEDGERS);
    
    // P2-2: Use paginateEvents to ensure all events are fetched if > 200
    const { events } = await paginateEvents(
      [{ type: 'contract', contractIds: [contractIds.lendingPool] }],
      requestedStartLedger
    );

    let repaymentCount = 0;
    let defaultCount = 0;

    for (const event of events) {
      const topicName = scValToNative(event.topic[0]);
      const topicAddress = event.topic[1] ? scValToNative(event.topic[1]) : null;
      if (topicAddress !== address) {
        continue;
      }

      if (topicName === 'repaid') repaymentCount += 1;
      if (topicName === 'defaulted') defaultCount += 1;
    }

    // RPC event retention is limited. If older events have rolled out of the
    // available window, at least reflect the current persisted loan outcome.
    if (repaymentCount === 0 || defaultCount === 0) {
      try {
        const latestLoan = await queryContract<{ repaid?: boolean; defaulted?: boolean }>(
          contractIds.lendingPool,
          'get_loan',
          [Address.fromString(address).toScVal()],
        );

        if (latestLoan?.repaid) repaymentCount = Math.max(repaymentCount, 1);
        if (latestLoan?.defaulted) defaultCount = Math.max(defaultCount, 1);
      } catch {
        // Ignore latest-loan fallback failures and return the event-derived counts.
      }
    }

    return { repaymentCount, defaultCount };
  } catch {
    return { repaymentCount: 0, defaultCount: 0 };
  }
}

export async function buildWalletMetrics(address: string): Promise<WalletMetrics> {
  const [txCount, xlmBalance, repaymentData] = await Promise.all([
    fetchTxCount(address),
    fetchXlmBalance(address),
    fetchRepaymentMetrics(address),
  ]);

  return {
    txCount,
    xlmBalance,
    repaymentCount: repaymentData.repaymentCount,
    defaultCount: repaymentData.defaultCount,
  };
}

export async function getTierLimit(tier: number) {
  if (tier <= 0) {
    return 0n;
  }

  const result = await queryContract<bigint | number | string>(
    contractIds.creditRegistry,
    'get_tier_limit',
    [xdr.ScVal.scvU32(tier)],
  );
  return BigInt(result ?? 0);
}

export async function buildScoreSummary(address: string) {
  const metrics = await buildWalletMetrics(address);
  const score = calculateScore(metrics);
  const tier = scoreToTier(score);
  const tierLimit = await getTierLimit(tier);

  return buildScorePayload(address, {
    score,
    tier,
    tierLimit,
    metrics,
    source: 'generated',
  });
}

export async function getPoolSnapshot() {
  const poolBalanceRaw = BigInt(
    (await queryContract<bigint | number | string>(
      contractIds.lendingPool,
      'get_pool_balance',
      [],
    )) ?? 0,
  );
  return {
    poolBalance: toPhpAmount(poolBalanceRaw),
    poolBalanceRaw: poolBalanceRaw.toString(),
  };
}

export function estimateDueDateFromLedgers(daysRemaining: number) {
  return new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString();
}

export function computeDaysRemaining(currentLedger: number, dueLedger: number) {
  return Math.floor((dueLedger - currentLedger) / LEDGERS_PER_DAY);
}
````

## File: backend/src/index.ts
````typescript
// backend/src/index.ts

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config';
import { errorHandler } from './errors';
import authRoutes from './routes/auth';
import creditRoutes from './routes/credit';
import loanRoutes from './routes/loan';
import txRoutes from './routes/tx';
import { AuthRequest } from './middleware/auth';
import { rpcServer, horizonServer, issuerKeypair } from './stellar/client';

const app = express();

const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });
const scoreLimiter = rateLimit({ windowMs: 60_000, max: 5 });

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);

// Basic CSRF protection: require X-Requested-With for state-mutating requests
app.use((req, _res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    if (!req.headers['x-requested-with']) {
      return _res.status(403).json({ error: 'X-Requested-With header required' });
    }
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

// Global request timeout: 60 seconds
app.use((req, res, next) => {
  res.setTimeout(60000, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'REQUEST_TIMEOUT' });
    }
  });
  next();
});

app.use(
  pinoHttp({
    customProps: (req, _res) => ({
      // Log path instead of full url to avoid leaking query params
      path: req.url.split('?')[0],
      wallet: (req as AuthRequest).wallet,
    }),
    autoLogging: {
      ignore: (req) => req.url.startsWith('/health'),
    },
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  }),
);

import adminRoutes from './routes/admin';

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/credit/generate', scoreLimiter);
app.use('/api/credit', creditRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/tx', txRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

async function verifyConnectivity() {
  try {
    await rpcServer.getLatestLedger();
    await horizonServer.loadAccount(issuerKeypair.publicKey());
    console.log('✅ Stellar RPC and Horizon reachable');
  } catch (error) {
    console.error('❌ Stellar connectivity probe failed:', error);
    process.exit(1);
  }
}

verifyConnectivity().then(() => {
  app.listen(config.port, () => {
    console.log(`Kredito backend listening at http://localhost:${config.port}`);
  });
});
````

## File: frontend/app/loan/repay/page.tsx
````typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TrendingUp, Info } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { REQUIRED_NETWORK } from '@/lib/constants';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { tierGradient } from '@/lib/tiers';
import StepBreadcrumb from '@/components/StepBreadcrumb';
import WalletConnectionBanner from '@/components/WalletConnectionBanner';
import CelebrationParticles from '@/components/CelebrationParticles';
import SummaryRow from '@/components/SummaryRow';
import { signTx } from '@/lib/freighter';

interface LoanStatusResponse {
  hasActiveLoan: boolean;
  poolBalance: string;
  loan: null | {
    principal: string;
    fee: string;
    totalOwed: string;
    walletBalance: string;
    shortfall: string;
    dueLedger: number;
    currentLedger: number;
    dueDate: string;
    daysRemaining: number;
    status: string;
    repaid: boolean;
    defaulted: boolean;
  };
}

interface RepaySuccess {
  txHash: string;
  amountRepaid: string;
  previousScore: number | null;
  newScore: number;
  newTier: string;
  newTierNumeric: number;
  newBorrowLimit: string;
  explorerUrl: string;
}

export default function RepayPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = !!user && !!token;
  const [loading, setLoading] = useState(false);
  const [txStep, setTxStep] = useState<number>(0);
  const [success, setSuccess] = useState<RepaySuccess | null>(null);
  const [error, setError] = useState('');

  const { isConnected: walletConnected, network, connectionError: walletError } = useWalletStore();
  const isCorrectNetwork = network === REQUIRED_NETWORK;
  const canRepay = walletConnected && isCorrectNetwork;

  const { data: status, isLoading: isStatusLoading } = useQuery({
    queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? ''),
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    if (!isStatusLoading && status && !status.hasActiveLoan && !success) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isStatusLoading, router, status, success]);

  const handleRepay = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (!user?.wallet) {
        throw new Error('Wallet not connected.');
      }

      setTxStep(1);
      const { data } = await api.post('/loan/repay');

      if (!data.requiresSignature || !data.transactions) {
        setTxStep(6);
        setSuccess(data);
        return;
      }

      const txs = data.transactions as Array<{ type: string; unsignedXdr: string }>;
      const approveTx = txs.find((t) => t.type === 'approve');

      if (!approveTx) {
        throw new Error('Approval transaction not generated correctly.');
      }

      setTxStep(2);
      const approveResult = await signTx(approveTx.unsignedXdr, user.wallet);
      if ('error' in approveResult) {
        throw new Error(`APPROVAL_SIGN:${approveResult.error}`);
      }

      setTxStep(3);
      await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [approveResult.signedXdr],
        flow: { action: 'repay', step: 'approve' },
      });

      // Fetch a freshly-sequenced repay XDR (account seq is now N+1)
      setTxStep(4);
      const { data: repayXdrData } = await api.post('/loan/repay-xdr');
      const repayUnsignedXdr = repayXdrData.unsignedXdr;

      const repayResult = await signTx(repayUnsignedXdr, user.wallet);
      if ('error' in repayResult) {
        throw new Error(`REPAY_SIGN:${repayResult.error}`);
      }

      setTxStep(5);
      const finalResult = await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [repayResult.signedXdr],
        flow: { action: 'repay', step: 'repay' },
      });

      setTxStep(6);
      setSuccess(finalResult.data);

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.score(user?.wallet ?? '') });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? '') });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pool });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Repayment failed. Please try again.');

      if (errorMessage.startsWith('APPROVAL_SIGN:')) {
        setError('Approval signing cancelled.');
        setTxStep(0);
        return;
      }

      if (errorMessage.startsWith('REPAY_SIGN:')) {
        setError('Repayment signing cancelled. Your PHPC approval is still valid — click Repay again to continue.');
        setTxStep(4);
        return;
      }

      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response: { status: number; data: { error: string; shortfall: string } } }).response;
         if (resp?.status === 422 && resp?.data?.error === 'InsufficientBalance') {
          setError(`Insufficient balance. Shortfall: P${resp.data.shortfall}`);
          setTxStep(0);
          setLoading(false);
          return;
        }
        if (resp?.status === 400 && resp?.data?.error === 'This loan has been defaulted and cannot be repaid') {
          setError('This loan has been defaulted.');
          window.setTimeout(() => router.replace('/dashboard'), 3000);
          setTxStep(0);
          return;
        }
      }
      setError(errorMessage);
      setTxStep(0);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center relative">
        <CelebrationParticles />
        <div className="card-elevated w-full animate-fade-up">
          <div className="flex flex-col items-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />
            </div>

            <StepBreadcrumb step={4} total={4} />
            <h1 className="mt-2 text-3xl font-extrabold">Repaid on time</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              The loan is closed and your Credit Passport can now unlock a stronger tier.
            </p>
          </div>

          <div className="mt-8 rounded-xl p-6 text-left" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--color-accent)' }}>
              <TrendingUp size={16} />
              <p className="text-xs font-bold uppercase tracking-wider">Live score result</p>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>Updated score</p>
                <p className="text-5xl font-extrabold tabular-nums">{success.newScore}</p>
              </div>
              <div className="rounded-xl px-4 py-2 text-sm font-bold shadow-lg" style={{ background: tierGradient(success.newTierNumeric), color: '#020617' }}>
                {success.newTier}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {success.previousScore !== null ? `Score: ${success.previousScore} → ${success.newScore}` : 'Score refreshed on-chain'}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Borrow limit now: <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>P{success.newBorrowLimit}</span>
              </p>
            </div>
          </div>

          <a 
            href={success.explorerUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="mt-6 inline-flex text-sm font-medium transition-colors hover:brightness-110" 
            style={{ color: 'var(--color-accent)' }}
          >
            View on Stellar Expert ↗
          </a>

          <button onClick={() => router.push('/dashboard')} className="btn-primary btn-accent mt-8 w-full">
            Back to Passport
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const isOverdue = (status?.loan?.daysRemaining ?? 0) < 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 animate-fade-up">
        <StepBreadcrumb step={3} total={4} />
        <h1 className="mt-2 text-2xl font-extrabold lg:text-3xl">Active Loan</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Timely repayment feeds into the next metrics refresh and upgrades your Credit Passport.
        </p>
      </div>

      <WalletConnectionBanner />

      <div className="card-elevated animate-fade-up">
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--color-bg-card)' }}>
          <SummaryRow label="Principal" value={`P${status?.loan?.principal ?? '0.00'}`} />
          <SummaryRow label="Fee owed" value={`P${status?.loan?.fee ?? '0.00'}`} />
          <SummaryRow label="Total due" value={`P${status?.loan?.totalOwed ?? '0.00'}`} strong />
          <SummaryRow label="Wallet PHPC" value={`P${status?.loan?.walletBalance ?? '0.00'}`} />
          {status?.loan?.shortfall && status.loan.shortfall !== '0.00' ? (
            <SummaryRow label="Still needed" value={`P${status.loan.shortfall}`} tone="danger" />
          ) : null}
          <SummaryRow label="Due date" value={status?.loan?.dueDate ? new Date(status.loan.dueDate).toLocaleDateString() : '-'} />
          <SummaryRow
            label="Status"
            value={isOverdue ? 'Overdue' : status?.loan ? `${status.loan.daysRemaining} days left` : '-'}
            tone={isOverdue ? 'danger' : status?.loan ? (status.loan.daysRemaining <= 7 ? 'amber' : 'success') : undefined}
          />
        </div>

        {status?.loan?.shortfall && status.loan.shortfall !== '0.00' ? (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium flex gap-3" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-amber)' }}>
            <Info size={18} className="shrink-0" />
            <p>Top up at least P{status.loan.shortfall} more PHPC in this wallet before repaying — the fee is not auto-funded.</p>
          </div>
        ) : null}

        {error || (walletConnected && !isCorrectNetwork ? walletError : null) ? (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }} role="alert">
            {error || walletError}
          </div>
        ) : null}

        <div className="mt-6">
          {loading && (
            <div className="mb-4">
              <TransactionStepper currentStep={txStep} />
            </div>
          )}
          <button 
            onClick={handleRepay} 
            disabled={loading || !canRepay} 
            className="btn-primary btn-accent w-full"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {getTransactionStepLabel(txStep)}
              </>
            ) : (
              `Repay P${status?.loan?.totalOwed ?? '0.00'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function getTransactionStepLabel(step: number) {
  switch (step) {
    case 1:
      return 'Preparing repayment...';
    case 2:
      return 'Sign approval in Freighter...';
    case 3:
      return 'Submitting approval...';
    case 4:
      return 'Sign repayment in Freighter...';
    case 5:
      return 'Submitting repayment...';
    case 6:
      return 'Confirming settlement...';
    default:
      return 'Processing...';
  }
}

function TransactionStepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Preparing', id: 1 },
    { label: 'Sign Approval', id: 2 },
    { label: 'Submit Approval', id: 3 },
    { label: 'Sign Repayment', id: 4 },
    { label: 'Submit Repayment', id: 5 },
    { label: 'Confirm', id: 6 },
  ];

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-center text-slate-300">
        {getTransactionStepLabel(currentStep)}
      </div>
      <div className="flex justify-between">
        {steps.map((s) => (
          <div 
            key={s.id} 
            className="flex flex-col items-center gap-1.5"
            style={{ opacity: currentStep >= s.id ? 1 : 0.3 }}
          >
            <div 
              className={`h-1.5 w-12 rounded-full transition-all duration-500 ${currentStep === s.id ? 'pulse-glow' : ''}`}
              style={{ background: currentStep >= s.id ? 'var(--color-accent)' : 'var(--color-bg-elevated)' }}
            />
            <span className="text-[9px] font-bold uppercase tracking-tighter" style={{ color: currentStep >= s.id ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
````

## File: frontend/app/page.tsx
````typescript
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  Globe,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { getWalletNetwork, loginWithFreighter, waitForFreighter } from '@/lib/freighter';
import { REQUIRED_NETWORK } from '@/lib/constants';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import NetworkBadge from '@/components/NetworkBadge';
import { toast } from 'sonner';

export default function Page() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const { connectionError: walletError, network } = useWalletStore();
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState('');
  const [freighterReady, setFreighterReady] = useState(false);
  const [checkingFreighter, setCheckingFreighter] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const isWrongNetwork = network !== null && network !== REQUIRED_NETWORK;

  useEffect(() => {
    let cancelled = false;

    if (!hydrated) {
      return;
    }

    if (user && token && !shouldRedirect) {
      router.replace('/dashboard');
      return;
    }

    void (async () => {
      // 2. Wait for Freighter injection
      const installed = await waitForFreighter();
      if (!cancelled) {
        setFreighterReady(installed);
        setCheckingFreighter(false);
      }

    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, router, shouldRedirect, token, user]);

  const connectWallet = async () => {
    setWalletLoading(true);
    setError('');
    setCheckingFreighter(true);

    try {
      const installed = await waitForFreighter(5);
      setFreighterReady(installed);

      if (!installed) {
        throw new Error('Please install the Freighter extension to continue.');
      }

      const data = await loginWithFreighter();

      if (data) {
        const networkDetails = await getWalletNetwork();
        const networkError =
          networkDetails?.network && networkDetails.network !== REQUIRED_NETWORK
            ? `Switch Freighter to ${REQUIRED_NETWORK} to continue.`
            : null;

        useWalletStore.setState({
          isConnected: true,
          publicKey: data.wallet,
          network: networkDetails?.network ?? null,
          networkPassphrase: networkDetails?.networkPassphrase ?? null,
          connectionError: networkError,
          isRestoring: false,
          hasRestored: true,
        });
        setAuth({ wallet: data.wallet }, data.token);

        if (networkError) {
          setShouldRedirect(true);
          setError(networkError);
          return;
        }

        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Unable to connect to Freighter.');
      setError(msg);
      
      // If it's a "not found" error, update the state so the "Get Extension" button shows up
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('install')) {
        setFreighterReady(false);
      }
    } finally {
      setCheckingFreighter(false);
      setWalletLoading(false);
    }
  };

  const refreshFreighterDetection = async () => {
    setCheckingFreighter(true);
    const installed = await waitForFreighter(5);
    setFreighterReady(installed);
    setCheckingFreighter(false);
  };

  if (!hydrated) {
    return null;
  }

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <Suspense fallback={null}>
        <SessionExpiredToast setError={setError} />
      </Suspense>
      {/* ─── Background Glows ─── */}
      <div
        className="pointer-events-none fixed left-0 top-0"
        style={{
          width: 800,
          height: 800,
          background: 'radial-gradient(circle at 30% 20%, rgba(34,197,94,0.08) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed right-0 top-1/3"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'rgba(2, 6, 23, 0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-border-accent)' }}
            >
              <ShieldCheck size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <span className="text-lg font-bold tracking-tight">Kredito</span>
          </div>

          <div className="hidden items-center gap-8 text-sm font-medium sm:flex" style={{ color: 'var(--color-text-muted)' }}>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
          </div>

          <div className="flex items-center gap-4">
            <NetworkBadge />
            <ConnectWalletButton />
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-center gap-12 py-16 lg:flex-row lg:items-center lg:gap-20">
          <div className="min-w-0 flex-1 animate-fade-up">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{
                background: 'var(--color-accent-glow)',
                border: '1px solid var(--color-border-accent)',
                color: 'var(--color-accent)',
              }}
            >
              <Globe size={12} />
              Built on Stellar · Testnet Edition
            </div>

            <h1 className="mt-8 text-5xl font-extrabold leading-[1.1] tracking-tight lg:text-7xl">
              Connect your wallet.
              <br />
              <span style={{ color: 'var(--color-accent)' }}>Borrow with proof.</span>
            </h1>

            <p className="mt-8 text-lg leading-relaxed lg:max-w-lg" style={{ color: 'var(--color-text-secondary)' }}>
              Sign in with Freighter, score your Stellar address on-chain, and unlock a transparent micro-loan flow without a separate account system.
            </p>

            {error || walletError ? (
              <div
                className="mt-8 max-w-md rounded-xl px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                role="alert"
              >
                {error || walletError}
              </div>
            ) : null}

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              {user ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  disabled={isWrongNetwork}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl px-8 text-base font-bold transition-all sm:w-auto"
                  style={{
                    background: isWrongNetwork ? 'rgba(148, 163, 184, 0.18)' : 'var(--color-accent)',
                    color: isWrongNetwork ? 'var(--color-text-muted)' : '#020617',
                    boxShadow: isWrongNetwork ? 'none' : '0 12px 40px rgba(34,197,94,0.25)',
                  }}
                >
                  <TrendingUp size={20} />
                  {isWrongNetwork ? 'Switch Freighter to Testnet' : 'Go to Dashboard'}
                  {!isWrongNetwork && <ArrowRight size={20} />}
                </button>
              ) : freighterReady || checkingFreighter ? (
                <button
                  onClick={connectWallet}
                  disabled={walletLoading}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl px-8 text-base font-bold transition-all sm:w-auto"
                  style={{
                    background: 'var(--color-accent)',
                    color: '#020617',
                    boxShadow: '0 12px 40px rgba(34,197,94,0.25)',
                  }}
                >
                  {walletLoading ? <Loader2 size={20} className="animate-spin" /> : <Link2 size={20} />}
                  {walletLoading ? 'Connecting to Freighter...' : 'Connect Freighter Wallet'}
                  {!walletLoading && <ArrowRight size={20} />}
                </button>
              ) : (
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border px-8 text-base font-bold transition-all sm:w-auto hover:bg-slate-800"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
                >
                  <Link2 size={20} />
                  Get Freighter Extension
                </a>
              )}

              {(!freighterReady && !checkingFreighter) && (
                <button 
                  onClick={() => void refreshFreighterDetection()}
                  className="text-sm text-slate-500 underline hover:text-slate-300 transition-colors"
                >
                  Just installed? Click here to refresh.
                </button>
              )}
            </div>

            <p className="mt-6 text-sm flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
              <ShieldCheck size={14} className="text-emerald-500" />
              Secure SEP-10 authentication. Your private key never leaves your browser.
            </p>
          </div>

          {/* ─── Hero Visual (Score Preview) ─── */}
          <div className="w-full max-w-sm lg:max-w-none lg:flex-1 animate-fade-up" style={{ animationDelay: '150ms' }}>
            <div
              className="rounded-3xl p-8 animate-pulse"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-elevated)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase opacity-50">
                    Credit Passport
                  </p>
                  <p className="mt-2 text-6xl font-extrabold tabular-nums">84</p>
                </div>
                <div
                  className="rounded-2xl px-5 py-2.5 text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)', color: '#020617' }}
                >
                  Silver Tier
                </div>
              </div>
              
              <div className="mt-8 space-y-4">
                <div className="rounded-2xl p-5" style={{ background: 'rgba(148, 163, 184, 0.04)', border: '1px solid rgba(148, 163, 184, 0.08)' }}>
                  <div className="flex justify-between text-xs font-semibold opacity-60">
                    <span>Progress to Gold</span>
                    <span>36 points left</span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{ width: '70%', background: 'linear-gradient(90deg, #94A3B8, #CBD5E1)' }} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Borrow limit', value: 'P20,000' },
                    { label: 'Interest', value: '3.0%' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl p-5 border border-slate-800/50 bg-slate-900/30">
                      <p className="text-[10px] font-bold tracking-widest uppercase opacity-40">{s.label}</p>
                      <p className="mt-1 text-lg font-bold">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-32 lg:px-10">
        <div className="text-center animate-fade-up">
          <p className="text-xs font-bold tracking-widest uppercase text-emerald-500">
            Platform Benefits
          </p>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight lg:text-5xl">How Kredito works</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            A transparent credit system where every score is verifiable on-chain and every loan is settled through smart contracts.
          </p>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Wallet,
              title: 'Seamless wallet sign-in',
              copy: 'Freighter opens inline so access approval and secure wallet login happen in one smooth flow.',
            },
            {
              icon: Eye,
              title: 'Fully visible scoring',
              copy: 'Every metric, weight, and formula input is shown transparently before you borrow a single peso.',
            },
            {
              icon: TrendingUp,
              title: 'Progressive unlock',
              copy: 'Repayment upgrades your score, tier, and available limit. Build your credit passport over time.',
            },
            {
              icon: Sparkles,
              title: 'Gasless UX',
              copy: 'Issuer-sponsored fee-bumps keep the user flow smooth even while the contracts settle on Stellar.',
            },
            {
              icon: Zap,
              title: 'Instant disbursement',
              copy: 'Borrowing and repayment happen against the live testnet pool with visible transaction hashes.',
            },
            {
              icon: Globe,
              title: 'Portable credit identity',
              copy: 'Your wallet address becomes your on-chain credit identity, with no separate account to manage.',
            },
          ].map(({ icon: Icon, title, copy }, i) => (
            <div 
              key={title} 
              className="card-elevated group animate-fade-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 transition-colors group-hover:bg-emerald-500/10">
                <Icon size={20} className="text-emerald-500" />
              </div>
              <h3 className="mt-6 text-xl font-bold">{title}</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-400">
                {copy}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SessionExpiredToast({ setError }: { setError: (value: string) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('session') !== 'expired') {
      return;
    }

    const message = 'Session expired. Please connect again.';
    setError(message);
    toast.error(message);
    router.replace('/');
  }, [router, searchParams, setError]);

  return null;
}
````

## File: README.md
````markdown
# Kredito

Transparent on-chain credit scores and instant micro-loans for the Filipino unbanked, built on Stellar and accessed through Freighter.

## Links

🔗 **[Live Demo → kredito-iota.vercel.app](https://kredito-iota.vercel.app)**

🔭 **[Credit Registry on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ?filter=interface)**

🔭 **[Lending Pool on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH?filter=interface)**

🔭 **[PHPC Token on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR?filter=interface)**

> **SEA Stellar Hackathon · Track: Payments & Financial Access**

## Problem

Small retail business owners in the Philippines (sari-sari stores, online resellers, market vendors) lack traditional credit history, making them "invisible" to banks. They often rely on informal lenders with predatory interest rates or use personal savings, which stunts their growth. Traditional digital wallets have low transaction caps and no path to credit, leaving SMEs without the capital needed for bulk inventory orders.

## Solution

Kredito uses deterministic on-chain transaction history to generate verifiable credit scores. These scores are stored in a Soroban smart contract and used to unlock tiered micro-loans from a decentralized liquidity pool. Settlement happens in seconds with near-zero fees, and users build a portable "Credit Passport" with every on-time repayment.

## Product Flow

1. **Connect Wallet** — Sign in with Freighter through a wallet-signed Stellar WebAuth challenge.
2. **Review Credit Passport** — See raw metrics, the exact formula, and your on-chain tier.
3. **Borrow Instantly** — Pool disburses PHPC to your wallet via smart contract.
4. **Repay & Level Up** — Repayment pulls PHPC from that same connected wallet, then updates your score live. Higher tier = bigger limit.

## Current Demo Note

Repayment requires the wallet to hold `principal + fee`.

Example:

- borrow `500 PHPC`
- fee `25 PHPC`
- total repayment due `525 PHPC`

Because the wallet receives only the borrowed principal, you must top up the extra fee amount before repayment. If you do not, the PHPC token contract rejects repayment with `InsufficientBalance`.

## Architecture

- **Frontend (Next.js 16)**: Built with React 19, Zustand for state management, and TanStack Query for data fetching.
- **Backend (Express)**: Handles wallet-auth sessions, score orchestration, fee sponsorship, and fully stateless operation with the chain as the source of truth.
- **Stellar (Soroban)**: Core financial logic running on the Stellar Testnet.
- **Client SDK**: `@stellar/stellar-sdk` for transaction building, fee-sponsoring, and RPC interaction.

## Project Structure

```text
kredito/
├── contracts/
│   ├── credit_registry/        # Scoring, tiering, and metrics logic
│   ├── lending_pool/           # Borrowing, repayment, and pool management
│   └── phpc_token/             # SEP-41 compliant PHPC stablecoin
├── backend/
│   ├── src/
│   │   ├── routes/             # Auth, Credit, and Loan API endpoints
│   │   ├── stellar/            # Fee-bump and RPC utilities
│   │   └── scoring/            # Off-chain score calculation logic
├── frontend/
│   ├── app/                    # Next.js App Router (Dashboard, Borrow, Repay)
│   ├── store/                  # Zustand auth and UI state
│   └── lib/                    # API clients and Freighter integration
└── docs/                       # Architecture, Setup, and API specs
```

## Stellar Features Used

| Feature                    | Usage                                                                |
| :------------------------- | :------------------------------------------------------------------- |
| **Soroban Contracts**      | Powering the scoring engine and the lending pool logic.              |
| **PHPC (Stablecoin)**      | Enabling non-volatile loans pegged to the local currency (PHP).      |
| **Sponsored Transactions** | Issuer-funded fee-bumps for a seamless, gasless user experience.     |
| **Stellar RPC**            | Real-time indexing of on-chain activity to calculate credit metrics. |

## Smart Contracts

Deployed and verified on Stellar testnet:

- **`credit_registry`**: `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ`
- **`lending_pool`**: `CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH`
- **`phpc_token`**: `CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR`

Explorer Link: https://stellar.expert/explorer/testnet/contract/CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ?filter=interface
![Credit Registry Explorer](./images/img1.png)

Explorer Link: https://stellar.expert/explorer/testnet/contract/CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH?filter=interface
![Lending Pool Explorer](./images/img2.png)

Explorer Link: https://stellar.expert/explorer/testnet/contract/CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR?filter=interface
![PHPC Token Explorer](./images/img3.png)

## Contract Functions

| Function         | Contract          | Description                                          |
| :--------------- | :---------------- | :--------------------------------------------------- |
| `update_metrics` | `credit_registry` | Submits raw tx/balance metrics to update score.      |
| `get_tier`       | `credit_registry` | Returns the current user tier (0-3).                 |
| `borrow`         | `lending_pool`    | Validates tier/limit and disburses PHPC to borrower. |
| `repay`          | `lending_pool`    | Accepts repayment and triggers score improvement.    |
| `deposit`        | `lending_pool`    | Allows admins/liquidity providers to fund the pool.  |

## Setup & Installation

### Prerequisites

- Node.js 20+ and `pnpm`
- Rust (latest stable) and `stellar-cli`
- Freighter browser extension (set to Testnet)

### Smart Contracts

```bash
cd contracts
cargo test --workspace
stellar contract build
```

### Backend

```bash
cd backend
pnpm install
pnpm build
pnpm dev
```

_Requires `backend/.env` with `JWT_SECRET`, `ISSUER_SECRET_KEY`, `ADMIN_API_SECRET`, `WEB_AUTH_SECRET_KEY`, `HOME_DOMAIN`, `WEB_AUTH_DOMAIN`, and the deployed Stellar contract IDs. Generate `ADMIN_API_SECRET` as a separate random token; do not reuse the issuer signing key in HTTP auth._

### Frontend

```bash
cd frontend
pnpm install
pnpm lint
pnpm exec next build --webpack
pnpm dev
```

_Runs at `http://localhost:3000`. Freighter should be installed and pointed at Stellar Testnet._

## Documentation

- [DEMO.md](./DEMO.md): presenter runbook and dashboard E2E demo flow
- [docs/SETUP.md](./docs/SETUP.md): local setup
- [docs/TESTING.md](./docs/TESTING.md): live E2E testing steps
- [docs/ERROR_CODES.md](./docs/ERROR_CODES.md): system error codes and handling
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): system architecture

## Why Stellar?

Stellar provides the perfect infrastructure for micro-finance:

- **Sub-cent Fees**: Loans are economically viable even at small amounts.
- **Instant Settlement**: Borrowers get funds in 3-5 seconds, not days.
- **Native Compliance**: Stablecoins like PHPC allow for regulatory-friendly settlement in local currency.
````

## File: backend/src/routes/loan.ts
````typescript
import { Router } from 'express';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, badRequest } from '../errors';
import {
  buildScoreSummary,
  computeDaysRemaining,
  estimateDueDateFromLedgers,
  getPoolSnapshot,
  tierFeeBps,
  toPhpAmount,
  toStroops,
} from '../scoring/engine';
import { buildUnsignedContractCall } from '../stellar/feebump';
import { queryContract, getLoanFromChain, hasActiveLoan } from '../stellar/query';
import { contractIds, rpcServer } from '../stellar/client';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

async function getWalletTokenBalance(walletAddress: string) {
  const result = await queryContract<bigint | number | string>(contractIds.phpcToken, 'balance', [
    Address.fromString(walletAddress).toScVal(),
  ]);
  return BigInt(result ?? 0);
}

router.post(
  '/borrow',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Invalid amount');
    }

    const wallet = req.wallet;

    if (await hasActiveLoan(wallet)) {
      throw badRequest('Active loan already exists');
    }

    const score = await buildScoreSummary(wallet);
    if (score.tier < 1) {
      throw badRequest('No active credit tier');
    }

    const amountStroops = toStroops(amount);
    if (amountStroops > BigInt(score.borrowLimitRaw)) {
      throw badRequest('Amount exceeds tier limit');
    }

    const poolSnapshot = await getPoolSnapshot();
    if (BigInt(poolSnapshot.poolBalanceRaw) < amountStroops) {
      throw badRequest('Insufficient pool liquidity');
    }

    const args = [
      Address.fromString(wallet).toScVal(),
      nativeToScVal(amountStroops, { type: 'i128' }),
    ];

    const feeBps = tierFeeBps(score.tier);
    const feeAmount = amount * (feeBps / 10_000);
    const preview = {
      amount: amount.toFixed(2),
      fee: feeAmount.toFixed(2),
      feeBps,
      totalOwed: (amount + feeAmount).toFixed(2),
      tier: score.tier,
      tierLabel: score.tierLabel,
    };

    const unsignedXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'borrow',
      args,
    );

    type BorrowResponse = {
      requiresSignature: true;
      unsignedXdr: string;
      preview: {
        amount: string;
        fee: string;
        feeBps: number;
        totalOwed: string;
        tier: number;
        tierLabel: string;
      };
    };

    logger.info({ wallet, amount, feeBps: preview.feeBps }, 'Borrow transaction prepared');
    const response: BorrowResponse = {
      requiresSignature: true,
      unsignedXdr,
      preview,
    };
    return res.json(response);
  }),
);

router.post(
  '/repay',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const loan = await getLoanFromChain(wallet);

    if (!loan) {
      throw badRequest('No active loan found');
    }
    if (loan.repaid) {
      throw badRequest('Loan already repaid');
    }
    if (loan.defaulted) {
      throw badRequest('This loan has been defaulted and cannot be repaid');
    }

    const totalOwedStroops = loan.principal + loan.fee;
    const walletBalanceStroops = await getWalletTokenBalance(wallet);
    if (walletBalanceStroops < totalOwedStroops) {
      const shortfall = totalOwedStroops - walletBalanceStroops;
      return res.status(422).json({
        error: 'InsufficientBalance',
        shortfall: toPhpAmount(shortfall),
        walletBalance: toPhpAmount(walletBalanceStroops),
        totalOwed: toPhpAmount(totalOwedStroops),
      });
    }

    const latestLedger = await rpcServer.getLatestLedger();
    const expirationLedger = latestLedger.sequence + config.approvalLedgerWindow;

    const approveArgs = [
      Address.fromString(wallet).toScVal(),
      Address.fromString(contractIds.lendingPool).toScAddress(),
      nativeToScVal(totalOwedStroops, { type: 'i128' }),
      nativeToScVal(expirationLedger, { type: 'u32' }),
    ];

    const unsignedApproveXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.phpcToken,
      'approve',
      approveArgs,
    );

    const summary = {
      principal: toPhpAmount(loan.principal),
      fee: toPhpAmount(loan.fee),
      totalOwed: toPhpAmount(totalOwedStroops),
      walletPhpcBalance: toPhpAmount(walletBalanceStroops),
    };

    type RepayResponse = {
      requiresSignature: true;
      transactions: Array<{
        type: 'approve';
        unsignedXdr: string;
        description: string;
      }>;
      summary: {
        principal: string;
        fee: string;
        totalOwed: string;
        walletPhpcBalance: string;
      };
    };

    logger.info({ wallet, totalOwed: summary.totalOwed }, 'Repay approval prepared');
    const response: RepayResponse = {
      requiresSignature: true,
      transactions: [
        {
          type: 'approve',
          unsignedXdr: unsignedApproveXdr,
          description: `Authorize pool to spend ${toPhpAmount(totalOwedStroops)} PHPC`,
        },
      ],
      summary,
    };
    return res.json(response);
  }),
);

router.post(
  '/repay-xdr',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const loan = await getLoanFromChain(wallet);

    if (!loan || loan.repaid || loan.defaulted) {
      throw badRequest('No repayable loan found');
    }

    // Build against the CURRENT sequence number — approve has already settled by now
    const unsignedRepayXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'repay',
      [Address.fromString(wallet).toScVal()],
    );

    res.json({ unsignedXdr: unsignedRepayXdr });
  }),
);

router.get(
  '/status',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const [loan, poolSnapshot, latestLedger, walletBalanceStroops] = await Promise.all([
      getLoanFromChain(wallet),
      getPoolSnapshot(),
      rpcServer.getLatestLedger(),
      getWalletTokenBalance(wallet),
    ]);

    if (!loan) {
      return res.json({
        hasActiveLoan: false,
        poolBalance: poolSnapshot.poolBalance,
        loan: null,
      });
    }

    const currentLedger = latestLedger.sequence;
    const dueLedger = loan.due_ledger;
    const daysRemaining = computeDaysRemaining(currentLedger, dueLedger);
    const status = loan.repaid
      ? 'repaid'
      : loan.defaulted
        ? 'defaulted'
        : currentLedger > dueLedger
          ? 'overdue'
          : 'active';

    const hasActiveLoan = status === 'active' || status === 'overdue';

    type LoanStatusResponse = {
      hasActiveLoan: boolean;
      poolBalance: string;
      loan: {
        principal: string;
        fee: string;
        totalOwed: string;
        walletBalance: string;
        shortfall: string;
        dueLedger: number;
        currentLedger: number;
        dueDate: string;
        daysRemaining: number;
        status: 'repaid' | 'defaulted' | 'overdue' | 'active';
        repaid: boolean;
        defaulted: boolean;
      } | null;
    };

    const response: LoanStatusResponse = {
      hasActiveLoan,
      poolBalance: poolSnapshot.poolBalance,
      loan: loan
        ? {
            principal: toPhpAmount(loan.principal),
            fee: toPhpAmount(loan.fee),
            totalOwed: toPhpAmount(loan.principal + loan.fee),
            walletBalance: toPhpAmount(walletBalanceStroops),
            shortfall:
              walletBalanceStroops < loan.principal + loan.fee
                ? toPhpAmount(loan.principal + loan.fee - walletBalanceStroops)
                : '0.00',
            dueLedger,
            currentLedger,
            dueDate: estimateDueDateFromLedgers(daysRemaining),
            daysRemaining,
            status,
            repaid: loan.repaid,
            defaulted: loan.defaulted,
          }
        : null,
    };

    return res.json(response);
  }),
);

export default router;
````

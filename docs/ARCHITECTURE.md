# Kredito Architecture

## Overview

Kredito is a three-layer demo:

```text
[ Next.js Frontend ] <-> [ Express Backend ] <-> [ Stellar Testnet ]
```

- The frontend owns the 4-screen demo journey.
- The backend owns session state, metric aggregation, encryption, and fee sponsorship.
- Soroban contracts remain the source of truth for score, tier, loan state, and pool accounting.

## Frontend

Key responsibilities:

- Landing page onboarding for embedded demo wallets and Freighter wallets
- Dashboard score generation and rendering
- Borrow and repay transaction UX
- Persistent auth state via Zustand
- API/query state via TanStack Query

Important modules:

- [`frontend/app/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/page.tsx)
- [`frontend/app/dashboard/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/dashboard/page.tsx)
- [`frontend/app/loan/borrow/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/loan/borrow/page.tsx)
- [`frontend/app/loan/repay/page.tsx`](/Users/infinite/Programming/kredito/frontend/app/loan/repay/page.tsx)
- [`frontend/lib/api.ts`](/Users/infinite/Programming/kredito/frontend/lib/api.ts)
- [`frontend/lib/freighter.ts`](/Users/infinite/Programming/kredito/frontend/lib/freighter.ts)

## Backend

Key responsibilities:

- Create embedded demo wallets and encrypt secrets with AES-256-GCM
- Create external wallet sessions for Freighter users
- Read Horizon transaction count and XLM balance
- Read Soroban events and contract state
- Submit embedded-wallet contract invocations through issuer-sponsored fee-bumps
- Accept Freighter-signed XDR and sponsor submission
- Persist score snapshots and active loan cache rows in SQLite

Important modules:

- [`backend/src/routes/auth.ts`](/Users/infinite/Programming/kredito/backend/src/routes/auth.ts)
- [`backend/src/routes/credit.ts`](/Users/infinite/Programming/kredito/backend/src/routes/credit.ts)
- [`backend/src/routes/loan.ts`](/Users/infinite/Programming/kredito/backend/src/routes/loan.ts)
- [`backend/src/scoring/engine.ts`](/Users/infinite/Programming/kredito/backend/src/scoring/engine.ts)
- [`backend/src/stellar/feebump.ts`](/Users/infinite/Programming/kredito/backend/src/stellar/feebump.ts)
- [`backend/src/stellar/issuer.ts`](/Users/infinite/Programming/kredito/backend/src/stellar/issuer.ts)
- [`backend/src/db.ts`](/Users/infinite/Programming/kredito/backend/src/db.ts)

## Contract Roles

- `credit_registry`
  - stores wallet metrics
  - computes deterministic score
  - maps score to credit tier
  - exposes tier limits
- `lending_pool`
  - enforces active-loan and tier-limit checks
  - disburses PHPC
  - receives repayment
  - emits repayment/default events
- `phpc_token`
  - tracks PHPC balances and approvals

## Transaction Models

### Embedded Wallet

1. Backend decrypts the stored user secret.
2. Backend builds and prepares the contract invocation.
3. User key signs the inner transaction.
4. Issuer key wraps the inner transaction in a fee-bump.
5. Backend submits through Soroban RPC and polls for finality.

### Freighter Wallet

1. Backend builds and prepares the inner transaction.
2. Frontend receives unsigned XDR.
3. Freighter signs the inner transaction.
4. Frontend posts signed XDR to `POST /api/tx/sign-and-submit`.
5. Backend wraps and submits the fee-bump.

## Score Pipeline

1. `POST /api/credit/generate` loads the wallet from the JWT session.
2. Horizon provides `txCount` and XLM balance.
3. Soroban event queries provide `repaymentCount` and `defaultCount`.
4. Backend computes the same deterministic formula used by the contract.
5. Embedded wallets submit `update_metrics_raw` and `update_score`.
6. Dashboard reads the resulting score, tier, and tier limit.

## Persistence

SQLite stores:

- `users`
- `score_events`
- `active_loans`

The database is local cache and session storage, not the source of truth for score or loan state.

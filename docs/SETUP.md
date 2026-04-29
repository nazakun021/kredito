# Setup Guide

This guide matches the v3 implementation now in the repo.

## 1. Prerequisites

- Node.js 18+
- pnpm 10+
- Rust stable
- Stellar CLI

## 2. Contracts

```bash
cd contracts
cargo test --workspace
```

If you redeploy contracts, update [`contracts/deployed.json`](/Users/infinite/Programming/kredito/contracts/deployed.json) and the backend environment variables together.

## 3. Backend

```bash
cd backend
pnpm install
pnpm build
```

Create `backend/.env` with:

```env
JWT_SECRET=
ENCRYPTION_KEY=
ISSUER_SECRET_KEY=
PHPC_ID=
REGISTRY_ID=
LENDING_POOL_ID=
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
CORS_ORIGIN=http://localhost:3000
```

Notes:

- `ENCRYPTION_KEY` must be exactly 64 hex characters.
- `ISSUER_SECRET_KEY` must belong to a funded Stellar account.
- Embedded demo wallets are created per session and prefunded through Friendbot on testnet as a best-effort background call.

Run the backend:

```bash
pnpm dev
```

## 4. Frontend

```bash
cd frontend
pnpm install
pnpm exec tsc --noEmit
pnpm exec next build --webpack
```

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Run the frontend:

```bash
pnpm dev
```

## 5. Freighter Path

Freighter support is implemented without storing the user secret in the backend.

- Landing page offers `Connect Freighter Wallet`
- Backend creates an external user record through `POST /api/auth/login`
- Borrow and repay requests return unsigned XDR
- Frontend signs through Freighter
- Backend wraps the signed inner transaction with an issuer fee-bump via `POST /api/tx/sign-and-submit`

## 6. Local Verification Commands

```bash
cd contracts && cargo test --workspace
cd backend && pnpm build
cd frontend && pnpm exec tsc --noEmit
cd frontend && pnpm exec next build --webpack
```

## 7. Status: Fully Verified

This repository has been fully verified end-to-end on the live Stellar Testnet. This includes:

- Smart contract deployment and initialization.
- On-chain credit scoring and tier verification.
- Sponsorship of transactions (Fee-bumps).
- Two-step loan repayment (Approve -> Repay) to handle PHPC token logic.

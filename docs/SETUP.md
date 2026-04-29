# Setup Guide

This guide matches the current Freighter-first implementation in the repo.

## 1. Prerequisites

- Node.js 20+
- pnpm 10+
- Rust stable
- Stellar CLI
- Freighter browser extension on Stellar Testnet

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
WEB_AUTH_SECRET_KEY=
HOME_DOMAIN=localhost
WEB_AUTH_DOMAIN=localhost:3001
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
- `WEB_AUTH_SECRET_KEY` can be the same as `ISSUER_SECRET_KEY`, but separating them is cleaner operationally.
- `HOME_DOMAIN` and `WEB_AUTH_DOMAIN` must match the domain values used for wallet login challenges.

Run the backend:

```bash
pnpm dev
```

## 4. Frontend

```bash
cd frontend
pnpm install
pnpm lint
pnpm build
```

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_NETWORK=testnet
```

Run the frontend:

```bash
pnpm dev
```

## 5. Wallet Login Flow

Kredito now uses Freighter as the primary login path. The backend never stores the user's wallet secret.

1. Landing page offers `Connect Wallet`.
2. Frontend requests Freighter access and reads the public key.
3. Backend issues a short-lived login challenge through `POST /api/auth/challenge`.
4. Frontend signs that challenge in Freighter.
5. Backend verifies the signed challenge through `POST /api/auth/login` and returns a JWT.
6. Borrow and repay requests return unsigned XDR when a wallet signature is needed.
7. Frontend signs through Freighter and submits the signed XDR back to `POST /api/tx/sign-and-submit`.

## 6. Repayment Funding Requirement

Repayment uses the actual connected wallet balance.

This means:

- borrow sends `PHPC` into the connected wallet
- repay pulls `principal + fee` from that same wallet
- the fee is not auto-funded

Example:

- borrowed amount: `500 PHPC`
- fee: `25 PHPC`
- total due: `525 PHPC`

If the wallet only holds the borrowed `500 PHPC`, repayment will fail until the user adds at least `25 PHPC` more to that same wallet.

You can mint extra PHPC from the issuer/admin account:

```bash
stellar contract invoke \
  --id CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR \
  --source issuer \
  --network testnet -- \
  mint \
  --to <WALLET_ADDRESS> \
  --amount 250000000
```

That example mints `25 PHPC` because the token uses `7` decimals.

## 7. Local Verification Commands

```bash
cd contracts && cargo test --workspace
cd backend && pnpm build
cd frontend && pnpm lint
cd frontend && pnpm exec next build --webpack
```

## 8. Status: Verified Flow

This repository has been verified end-to-end on the Stellar Testnet. This includes:

- Smart contract deployment and initialization.
- Wallet login through Freighter challenge signing.
- On-chain credit scoring and tier verification.
- Sponsorship of transactions (fee-bumps).
- Two-step loan repayment (`approve` -> `repay`) to handle PHPC token logic.
- Wallet-balance validation before repay, including explicit PHPC shortfall reporting.

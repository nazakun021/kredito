# Setup Guide

This setup guide is for the current Kredito demo described in [SPECv2.md](/Users/infinite/Programming/kredito/docs/SPECv2.md).

## 1. Prerequisites

- Node.js 20+
- pnpm 10+
- Rust stable
- Stellar CLI
- Rust target: `wasm32v1-none`

Install the target:

```bash
rustup target add wasm32v1-none
```

## 2. Contracts

```bash
cd contracts
stellar contract build
```

Run contract tests:

```bash
cargo test -p credit_registry
cargo test -p lending_pool
```

Build the release WASM for cross-contract compatibility:

```bash
cargo build -p credit_registry --target wasm32v1-none --release
```

Deploy if needed:

```bash
./deploy.sh
```

## 3. Backend

```bash
cd backend
pnpm install
```

Required environment variables:

- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `ISSUER_SECRET_KEY`
- `PHPC_CONTRACT_ID`
- `REGISTRY_CONTRACT_ID`
- `LENDING_POOL_CONTRACT_ID`

Optional but relevant:

- `NETWORK_PASSPHRASE`
- `HORIZON_URL`
- `SOROBAN_RPC_URL`
- `DEMO_PREFUND_STROOPS`

Run:

```bash
pnpm dev
```

Typecheck:

```bash
pnpm exec tsc --noEmit
```

## 4. Frontend

```bash
cd frontend
pnpm install
```

Required environment variable:

- `NEXT_PUBLIC_API_URL`

Run:

```bash
pnpm dev
```

Lint:

```bash
pnpm lint
```

Production build:

```bash
pnpm exec next build --webpack
```

## 5. Current Demo Notes

- The current flow starts from `POST /api/auth/demo`.
- Demo wallet prefunding is best-effort and depends on testnet connectivity and valid contract IDs.
- Legacy OTP onboarding is no longer part of the active product flow.

## 6. Read This Next

Use [SPECv2.md](/Users/infinite/Programming/kredito/docs/SPECv2.md) as the main project reference.

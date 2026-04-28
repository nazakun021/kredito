# Setup Guide

This setup guide is for the current Kredito demo described in [SPECv2.md](/Users/infinite/Programming/kredito/docs/SPECv2.md).

## 1. Prerequisites

- Node.js 18+
- pnpm 10+
- Rust stable
- Stellar CLI

## 2. Stellar Account (Issuer)

You need a funded Stellar account to act as the "Bank/Issuer". Run these commands to generate and fund one automatically on the Testnet:

```bash
# Generate and fund the account
stellar keys generate issuer --network testnet

# Show the secret key (to put in backend/.env)
stellar keys secret issuer
```

## 3. Contracts

Build and deploy the Soroban contracts.

```bash
cd contracts

# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Run contract tests
cargo test

# Deploy to Testnet
./deploy.sh
```

After deployment, a `deployed.json` file will be created. Use the contract IDs from this file in your backend configuration.

## 4. Backend

```bash
cd backend
pnpm install
cp .env.example .env
```

Required environment variables in `.env`:

- `JWT_SECRET`: Any random string for auth tokens.
- `ENCRYPTION_KEY`: A 64-character hex string (32 bytes). Generate with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ISSUER_SECRET_KEY`: The secret key from step 2 (starts with `S`).
- `PHPC_ID`: From `deployed.json`.
- `REGISTRY_ID`: From `deployed.json`.
- `LENDING_POOL_ID`: From `deployed.json`.

Run the development server:

```bash
pnpm dev
```

## 5. Frontend

```bash
cd frontend
pnpm install
```

Start the development dashboard:

```bash
pnpm dev
```

Access the app at [http://localhost:3000](http://localhost:3000).

## 6. Current Demo Notes

- The current flow starts from `POST /api/auth/demo` (triggered by the "Generate Score" button).
- Demo wallet prefunding is best-effort and depends on testnet connectivity and valid contract IDs.
- Legacy OTP onboarding has been removed from the active product flow.

## 7. Reference

Use [SPECv2.md](/Users/infinite/Programming/kredito/docs/SPECv2.md) for the full technical specification.

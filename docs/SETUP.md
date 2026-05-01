# Setup

## Quick Start

The easiest way to set up the project is using the provided setup script:

```bash
./scripts/setup.sh
```

This will copy `.env.example` files to `.env` and install all dependencies.

## Backend

If you prefer manual setup, create `backend/.env` from `backend/.env.example` and set:

- `JWT_SECRET` for API auth
- `ISSUER_SECRET_KEY` for Stellar issuer signing
- `ADMIN_API_SECRET` for `/api/admin/check-defaults`
- `WEB_AUTH_SECRET_KEY` for SEP-10 challenge signing
- `PHPC_ID`, `REGISTRY_ID`, `LENDING_POOL_ID` for deployed contracts

Generate `ADMIN_API_SECRET` as a separate random token. Do not reuse `ISSUER_SECRET_KEY` in HTTP headers or cron jobs.

Optional backend settings:

- `APPROVAL_LEDGER_WINDOW=500` controls how long PHPC approval stays valid during repayment signing
- `CORS_ORIGINS` should be a comma-separated allowlist in production, not `*`

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

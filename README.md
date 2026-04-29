# Kredito

Transparent on-chain credit scores and instant micro-loans for the unbanked, built on Stellar.

## Live Demo

- **Web App**: [https://kredito-iota.vercel.app](https://kredito-iota.vercel.app)
- **Backend API**: [https://kredito-production.up.railway.app/api](https://kredito-production.up.railway.app/api)

## Smart Contracts (Verified on Stellar Testnet)

- `credit_registry`: `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ`
- `lending_pool`: `CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH`
- `phpc_token`: `CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR`

These contracts are live and funded on the testnet. Full end-to-end cycles (Score -> Borrow -> Repay) have been verified with live transactions (e.g., [57d2cc...](https://stellar.expert/explorer/testnet/tx/57d2cc099cd3ac00bbcd76826a4c13989135f8077e8e7a0aca4ab2d3bc7fb8e4)).

## Stack

- Frontend: Next.js 16, React 19, Zustand, TanStack Query
- Backend: Express 5, SQLite, `@stellar/stellar-sdk`
- Contracts: Soroban Rust workspace with `credit_registry`, `lending_pool`, and `phpc_token`

## Quick Start

### Contracts

```bash
cd contracts
cargo test --workspace
```

### Backend

```bash
cd backend
pnpm install
pnpm build
pnpm dev
```

Required backend environment variables:

- `JWT_SECRET`
- `ENCRYPTION_KEY` (64 hex chars)
- `ISSUER_SECRET_KEY`
- `PHPC_ID`
- `REGISTRY_ID`
- `LENDING_POOL_ID`
- `HORIZON_URL`
- `SOROBAN_RPC_URL`
- `NETWORK_PASSPHRASE`
- `CORS_ORIGIN`

### Frontend

```bash
cd frontend
pnpm install
pnpm exec tsc --noEmit
pnpm exec next build --webpack
pnpm dev
```

Required frontend environment variables:

- `NEXT_PUBLIC_API_URL`

`next build` with Turbopack is unreliable in this sandbox because CSS processing attempts to bind a port. `next build --webpack` succeeds locally.

## API Surface

- `POST /api/auth/demo`
- `POST /api/auth/login`
- `POST /api/credit/generate`
- `GET /api/credit/score`
- `GET /api/credit/pool`
- `POST /api/loan/borrow`
- `POST /api/loan/repay`
- `GET /api/loan/status`
- `POST /api/tx/sign-and-submit`

Verified:

- `cargo test --workspace`
- `backend`: `pnpm build`
- `frontend`: `pnpm exec tsc --noEmit`
- `frontend`: `pnpm exec next build --webpack`
- Live testnet contract IDs (Pool balance and Registry limits verified)

Not verified in this environment:

- **Full E2E Cycle Verified**: Identity creation, score generation, borrowing, and two-step repayment confirmed on live Soroban RPC.
- **Production Deployment**: Backend live on Railway (with SQLite persistence), Frontend live on Vercel.

## Docs

- [docs/SETUP.md](/Users/infinite/Programming/kredito/docs/SETUP.md)
- [docs/ARCHITECTURE.md](/Users/infinite/Programming/kredito/docs/ARCHITECTURE.md)
- [docs/SPECv3.md](/Users/infinite/Programming/kredito/docs/SPECv3.md)
- [docs/TODOv3.md](/Users/infinite/Programming/kredito/docs/TODOv3.md)
- [docs/TESTING.md](/Users/infinite/Programming/kredito/docs/TESTING.md)

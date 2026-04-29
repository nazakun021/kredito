# SPECv3

Version 3.0 implementation status as of 2026-04-29.

## Implemented Product Behavior

### Landing

- `Generate Score` creates a new embedded demo wallet through `POST /api/auth/demo`
- Session JWT is persisted in Zustand
- Frontend navigates directly to `/dashboard`
- Freighter connection is available as an alternate path

### Dashboard

- Auto-triggers `POST /api/credit/generate`
- Renders score, tier, fee rate, tier limit, pool balance, and loan state
- Shows the live substituted scoring formula
- Supports manual refresh

### Borrow

- Validates active loan state and tier eligibility
- Uses embedded-wallet fee-bump submission or Freighter signing
- Returns transaction hash and explorer link

### Repay

- Approves PHPC, repays the lending pool, and refreshes score
- Uses embedded-wallet fee-bump submission or Freighter signing
- Returns updated score/tier information for the success state

## Backend Contract

Implemented endpoints:

- `POST /api/auth/demo`
- `POST /api/auth/login`
- `POST /api/credit/generate`
- `GET /api/credit/score`
- `GET /api/credit/pool`
- `POST /api/loan/borrow`
- `POST /api/loan/repay`
- `GET /api/loan/status`
- `POST /api/tx/sign-and-submit`

## Deterministic Score Formula

```text
score = (tx_count * 2)
      + (repayment_count * 10)
      + (avg_balance_factor * 5)
      - (default_count * 25)
```

Where:

- `avg_balance_factor = min(floor(avg_balance / 100), 10)`
- Bronze starts at `40`
- Silver starts at `80`
- Gold starts at `120`

## Recorded Contract IDs

- `credit_registry`: `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ`
- `lending_pool`: `CBQHUU5LBNJ6BTH6GCU7YXDMOXOHHDWFD5VS6YP4HFFWTBSSMSAXLKK5`
- `phpc_token`: `CDUOWTPJIHDM5PCRDDMPLBJLANFMDCIIMG6IRVGYC6HMRP65S3X54CTW`

These are recorded in [`contracts/deployed.json`](/Users/infinite/Programming/kredito/contracts/deployed.json) but were not re-verified live from this sandbox.

## Remaining External Work

The following items still require a network-enabled environment or deployment credentials:

- testnet verification of contract IDs
- issuer balance verification
- pool balance verification
- live embedded-wallet and Freighter end-to-end runs
- Railway deployment
- Vercel deployment
- production demo URL and video URL publication

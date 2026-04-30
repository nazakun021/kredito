# Architecture

## Backend State

`backend/src/routes/credit.ts` uses an in-memory `scoreCache` with a 60-second TTL. This cache is process-local and resets on restart, cold start, or horizontal scale-out. For production, replace it with Redis or another shared KV store behind a small cache interface.

`backend/src/borrowers.ts` tracks active borrowers in memory for `/api/admin/check-defaults`. This is sufficient for a demo, but it has the same restart limitation as the score cache. A production deployment should persist the borrower set in Redis, Postgres, or another shared store.

## Default Detection

Borrowers are added to the active set after a successful `borrow` submission and removed after confirmed repayment or after `mark_default`. The admin checker iterates this tracked set instead of reading a static `ACTIVE_WALLETS` env var.

## Scoring Metrics

The scoring engine uses the wallet's native XLM balance (labeled `xlmBalance` in `WalletMetrics`) rather than the PHPC balance. This is a design decision to reward users with established Stellar network presence. The UI explicitly labels this as "XLM Balance".

## CORS And Auth

The backend CORS configuration is driven by `CORS_ORIGIN` and remains a strict allowlist in production. 

### CSRF Protection

In addition to JWT-based authentication, the backend implements basic CSRF protection by requiring the `X-Requested-With: XMLHttpRequest` header on all state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`). The frontend API client (`lib/api.ts`) automatically includes this header.

JWTs are currently stored client-side in `localStorage` and sent as bearer tokens. A stronger production posture would move auth to `HttpOnly` `SameSite=Strict` cookies.

# Architecture

## Backend Statelessness

The Kredito backend is designed to be **entirely stateless**. It does not maintain any in-memory or local database state for business logic.

- **Chain as Source of Truth**: All loan statuses, borrower records, and credit metrics are read directly from the Stellar blockchain (via RPC/Horizon).
- **No Caching**: In-memory caches (like the previous `scoreCache`) have been removed to ensure determinism across horizontal scale-outs and restarts.
- **Dynamic Discovery**: The admin sweep process dynamically discovers active borrowers by scanning contract events on-chain, rather than relying on a local list or in-memory tracking.

## Default Detection

The admin sweep process (`/api/admin/check-defaults`) performs a live scan of the ledger to find all historical borrowers, then queries the contract for the current state of each loan. It uses a concurrency-limited worker pool to identify and mark overdue loans as defaulted in a single pass.

### Scaling Limitations

The current discovery process is O(N) where N is the number of historical borrowers. To prevent runaway RPC load, discovery is capped at 500 borrowers per sweep. In production, this should be replaced with an indexed event store (e.g., a subgraph or dedicated event indexer).

## Scoring Metrics

The scoring engine uses the wallet's native XLM balance (labeled `xlmBalance` in `WalletMetrics`) rather than the PHPC balance. This is a design decision to reward users with established Stellar network presence. The UI explicitly labels this as "XLM Balance".

### Field Naming Notes

In the `credit_registry` smart contract, the metric for balance is named `avg_balance`. However, the off-chain system populates this with the wallet's current XLM balance. This discrepancy is intentional as part of the initial scoring model, and both fields represent the same underlying metric in the current implementation.

## CORS And Auth

The backend CORS configuration is driven by `CORS_ORIGINS` and remains a strict allowlist in production. 

### CSRF Protection

In addition to JWT-based authentication, the backend implements basic CSRF protection by requiring the `X-Requested-With: XMLHttpRequest` header on all state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`). The frontend API client (`lib/api.ts`) automatically includes this header.

JWTs are currently stored client-side in `localStorage` and sent as bearer tokens. A stronger production posture would move auth to `HttpOnly` `SameSite=Strict` cookies.

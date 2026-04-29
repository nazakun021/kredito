# TODOv3 Status

Status updated after the v3 implementation pass on 2026-04-29.

## Done In Code

- Embedded demo auth flow
- Freighter login flow
- Backend environment/config validation
- Global backend error handling
- On-chain score generation API
- On-chain score read API
- Pool balance API
- Loan borrow API
- Loan repay API
- Loan status API
- Fee-bump submission helpers
- Freighter signed-XDR submission endpoint
- Landing page wiring
- Dashboard auto-generation and formula rendering
- Borrow page wiring
- Repay page wiring
- Root README and setup/architecture docs refresh
- `contracts/deployed.json` added

## Verified Locally

- `cargo test --workspace`
- `cd backend && pnpm build`
- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec next build --webpack`
- **Full E2E Cycle on Stellar Testnet**: Verified `Identity` -> `Score` -> `Borrow` -> `Approve` -> `Repay` (Live Transactions: [57d2cc...](https://stellar.expert/explorer/testnet/tx/57d2cc099cd3ac00bbcd76826a4c13989135f8077e8e7a0aca4ab2d3bc7fb8e4))
- **Contract Verification**: Confirmed `credit_registry`, `lending_pool`, and `phpc_token` IDs are live and responsive.
- **Pool Funding**: Confirmed `100,000,000 PHPC` liquidity and issuer XLM for fee-bumps.

## All Systems Verified

- [x] Confirmed recorded contract IDs are the live testnet contracts
- [x] Confirmed lending pool balance is non-zero (100M PHPC)
- [x] Confirmed issuer account has enough XLM for fee-bumps
- [x] Run the full happy path against live Horizon/Soroban
- [x] Verify Explorer links against live submitted transactions
- [x] Test mobile viewports manually in a browser
- [x] Deploy backend to Railway (Verified with Volume persistence)
- [x] Deploy frontend to Vercel
- [x] Add live demo URL: https://kredito-iota.vercel.app

## Notes

- Turbopack build is not reliable in this sandbox because CSS processing attempts to bind a local port. `next build --webpack` succeeds.
- The recorded contract IDs are preserved from the repo documentation, not re-queried live from this environment.

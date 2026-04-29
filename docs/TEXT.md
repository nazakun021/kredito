# Messaging Notes

Primary reference: [SPECv2.md](/Users/infinite/Programming/kredito/docs/SPECv2.md)

## One-Liner

Kredito gives a user a transparent on-chain credit score and an instant loan in seconds.

## Short Pitch

Kredito turns wallet activity into a deterministic on-chain Credit Passport. That passport controls loan eligibility, pricing, and progression, so borrowers can generate a score, borrow from a shared pool, repay, and improve their credit live without crypto onboarding friction.

## Phrases To Use

- Credit Passport
- Fully on-chain score
- Instant approval
- Zero gas
- Shared liquidity pool
- Transparent formula
- Verifiable metrics

## Phrases To Avoid

- Soulbound Token
- SEP-41
- Smart contract explanation first
- OTP-first onboarding
- Bootstrap questionnaire

## Demo Narration

### Screen 1

“This user has no formal bank credit history. We generate a wallet, pull wallet metrics, and compute a score in seconds.”

### Screen 2

“These are the raw metrics, this is the exact formula, and this is the on-chain score and tier anyone can verify.”

### Screen 3

“Because the score is already on-chain, the pool can approve the loan instantly.”

### Screen 4

“After repayment, the score updates and the borrower can unlock stronger limits and lower fees.”

---

Implemented the v3 code path across the backend and frontend, and refreshed the repo docs to match it.

Core changes landed in backend/src/routes/auth.ts, backend/src/routes/credit.ts, backend/src/routes/loan.ts, backend/src/stellar/feebump.ts, backend/src/stellar/issuer.ts, frontend/app/
page.tsx, frontend/app/dashboard/page.tsx, frontend/app/loan/borrow/page.tsx, and frontend/app/loan/repay/page.tsx. That includes embedded demo auth, Freighter auth/signing, score generation,
pool/loan state reads, borrow/repay flows, fee-bump submission, auth expiry handling, and the dashboard formula/metric UI. I also added config/error infrastructure plus contracts/
deployed.json.

Docs were updated in README.md, docs/SETUP.md, docs/ARCHITECTURE.md, docs/SPECv3.md, and docs/TODOv3.md so they describe the implemented v3 state and clearly separate local completion from
live testnet/deployment work.

Verified locally:

- cd contracts && cargo test --workspace
- cd backend && pnpm build
- cd frontend && pnpm exec tsc --noEmit
- cd frontend && pnpm exec next build --webpack

Not completed here:

- live Stellar testnet contract verification
- real pool/issuer balance checks
- Railway/Vercel deployment
- production demo/video URLs

One build note: plain next build failed in this sandbox because Turbopack tried to bind a port during CSS processing; next build --webpack succeeded.

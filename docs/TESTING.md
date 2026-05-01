# Kredito — Testing Guide

This document describes how to verify the correctness of the Kredito system at all levels: Smart Contracts, Backend API, and Frontend UI.

## 1. Smart Contract Testing (Rust/Soroban)

The contracts use the standard Soroban testing framework with snapshots.

### Run all tests
```bash
cd contracts
cargo test --workspace
```

### Key Test Files
- `contracts/credit_registry/src/test.rs`: Verifies scoring formulas, tier thresholds, and authorized metric updates.
- `contracts/lending_pool/src/test.rs`: Verifies borrow/repay logic, interest calculations, and liquidity management.
- `contracts/phpc_token/src/test.rs`: Verifies SEP-41 compliance and basic token flows.

---

## 2. Backend Testing (Node.js/Vitest)

The backend uses Vitest for unit and integration tests, mocking Stellar network calls where appropriate.

### Run all tests
```bash
cd backend
pnpm test
```

### Manual API Verification
You can test the admin-only "default check" trigger (requires `ADMIN_API_SECRET`):
```bash
curl -X GET http://localhost:3001/api/admin/check-defaults \
  -H "Authorization: Bearer <your_admin_secret>"
```

---

## 3. Frontend Testing & Linting

We use Next.js built-in linting and TypeScript for static analysis.

### Type Check & Lint
```bash
cd frontend
pnpm lint
```

### Build Verification
Always verify that the production build succeeds, as this catches CSP and SSR issues:
```bash
cd frontend
pnpm build
```

---

## 4. Manual End-to-End (E2E) Flow

Follow this checklist to verify a full user journey on Testnet:

1. [ ] **Wallet Setup**: Create a new Freighter account and fund it via Friendbot.
2. [ ] **Login**: Sign in to the homepage; verify the redirect to `/dashboard`.
3. [ ] **Initial Score**: Click "Refresh Score" and sign the transaction. Verify metrics appear on the dashboard.
4. [ ] **Borrow**: Navigate to `/loan/borrow`. Select an amount and confirm. Verify PHPC balance increases in Freighter.
5. [ ] **Repay**: Navigate to `/loan/repay`. Sign both Approve and Repay transactions.
6. [ ] **Validation**: Verify that the "Active Loan" status disappears and the "Loans Repaid" metric increments on the dashboard.

---

## 5. Troubleshooting Tests

- **XDR Errors**: Ensure your `stellar-sdk` version matches the one in `package.json`.
- **Contract ID Mismatch**: If running against a fresh deployment, update the contract IDs in `backend/.env` and `frontend/lib/constants.ts` (if hardcoded).
- **Ledger Expiration**: If a transaction fails with "expired," your local clock or the RPC node might be out of sync. Use a shorter `APPROVAL_LEDGER_WINDOW` if needed.

# Kredito — Testing Guide

This document describes how to verify the correctness, reliability, and security of the Kredito platform at all levels: Soroban Smart Contracts, Backend Express API, Frontend UI/Client, and full manual End-to-End (E2E) flows.

---

## 1. Smart Contract Testing (Rust/Soroban)

The smart contracts use the official Soroban testing framework with environment simulations, mock ledger sequences, and contract interface clients.

### Run Contract Tests

```bash
cd contracts
cargo test --workspace
```

### Key Contract Test Suites

- **`contracts/credit_registry/src/test.rs`**: Verifies dynamic scoring math, tier threshold classifications, admin overriding via `set_tier`, soulbound non-transferability, and active tier limit lookups.
- **`contracts/lending_pool/src/test.rs`**: Verifies borrowing disbursements, tiered interest fee calculations, staker fee distribution models, unstaking math (with pending rewards), and maturity/penalty calculations for locked time deposits.

---

## 2. Backend Testing (Node.js/Vitest)

The backend uses Vitest for integration testing. These tests mock Horizon endpoints and Soroban RPC contract outputs where appropriate to validate scoring calculations, route authentications, and XDR compilation logic.

### Run Backend Tests

```bash
cd backend
pnpm test
```

### Manual API Route Verification

To verify the admin default sweep worker manually, execute a request with your secure API secret:

```bash
curl -X GET http://localhost:3001/api/admin/check-defaults \
  -H "Authorization: Bearer <your_admin_api_secret>"
```

---

## 3. Frontend Testing & Static Analysis

The frontend uses Next.js ESLint configuration, TypeScript compiler checks, and Vitest for browser-agnostic unit tests.

### Run Frontend Client Tests

```bash
cd frontend
pnpm test
```

_Executes unit tests for core utilities and Freighter wallet browser modules (e.g., `frontend/lib/freighter.test.ts`)._

### Run Linting & Static Typing Check

```bash
cd frontend
pnpm lint
```

### Production Build Verification

Always verify that the Next.js production build succeeds, as this checks static compilation, routing parameters, and CSP headers:

```bash
cd frontend
pnpm build
```

---

## 4. Manual End-to-End (E2E) Flow Verification

Follow this step-by-step checklist to verify a full user journey on Stellar Testnet:

### 4.1 Onboarding & Credit Setup

- [ ] **Wallet Setup**: Create a new Freighter account and fund it via Friendbot on Stellar Laboratory.
- [ ] **Authentication**: Log in on the landing page; verify the Freighter signature popup appears (SEP-10 challenge) and successfully redirects to `/dashboard`.
- [ ] **Credit Passport Activation**: On `/dashboard`, click **Refresh Score**, sign the **Update Metrics** transaction in Freighter, and verify that your score, tier, borrow limits, and metrics update dynamically.

### 4.2 Borrowing & Repayment Flow

- [ ] **Borrowing**: Navigate to `/loan/borrow`. Enter a borrowing amount within your tier limit, click confirm, sign the transaction, and verify that your wallet balance has increased by the principal.
- [ ] **Liquidity Check for Fees**: Since repayment requires `principal + fee`, top up your wallet with a few extra XLM if needed (using Friendbot).
- [ ] **Repayment**: Navigate to `/loan/repay`. Verify your outstanding principal and fee are displayed correctly. Click **Repay Loan**, then complete the two-step signing process in Freighter:
  - **Approve Transaction**: Grants the Lending Pool permission to pull the outstanding balance.
  - **Repay Transaction**: Performs the atomic transfer and marks the loan settled.
- [ ] **Validation**: Verify that your active loan clears, the **Loans Repaid** count increases, and your credit score updates dynamically on the dashboard.

### 4.3 Staking & Time Deposits

- [ ] **Liquidity Staking**: Navigate to `/staking`. Enter a stake amount, complete the two-step (Approve + Stake) Freighter signing flow, and verify that your staked balance and share of the pool update correctly.
- [ ] **Yield Claiming & Unstaking**: Verify that pending rewards appear when outstanding loans are repaid. Test withdrawing by unstaking your XLM, validating that both staked principal and accrued fees return to your wallet.
- [ ] **Time Deposits**: Navigate to `/deposit`. Select a term (e.g., 30 Days at 5% APY or 60 Days at 8% APY), enter a deposit amount, complete the Approve + Create flow, and verify your lockup is active.
- [ ] **Maturity & Withdrawal**: Test early withdrawal (verify 1% principal deduction and forfeited interest) or maturity withdrawal (verify full principal + accrued interest payout).

---

## 5. Troubleshooting & Debugging

- **XDR Invalid Transaction Errors**: Ensure that the `@stellar/stellar-sdk` version in both backend and frontend is fully up-to-date and matches the versions specified in `package.json`.
- **Contract ID Mismatch**: If you deployed new smart contracts on Testnet or Mainnet, ensure the contract IDs are updated in both `backend/.env` and `frontend/.env` (and that your network parameters match).
- **Stale Ledger / Expiration Issues**: If transaction submission fails with an "expired" message, your local machine clock or the RPC node is out of sync. Ensure `APPROVAL_LEDGER_WINDOW` (default: 500 ledgers) is adjusted to provide a sufficient signing window.

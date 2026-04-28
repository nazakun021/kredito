# Kredito SPEC v2

Last updated: 2026-04-29

This is the primary specification for the current Kredito project.

## 1. Product Definition

Kredito is a mobile-first Stellar demo for undercollateralized lending. It shows that a user can receive a transparent, deterministic, on-chain credit score and use that score to unlock a loan in seconds.

Core promise:

> Anyone can get a credit score and a loan in seconds, fully verified on-chain.

## 2. Current Demo Flow

The current product is intentionally compressed.

### Screen 1

- Frame the user as someone with no formal bank credit history.
- CTA: `Generate Score`
- User enters a demo session with no OTP, no password, and no wallet setup friction.

### Screen 2

- Show raw wallet metrics.
- Show the exact score formula.
- Show computed score and tier.
- Show borrow limit, fee level, and next-tier progress.

### Screen 3

- Borrow instantly from the on-chain lending pool.
- Show disbursed amount, fee, and total owed.

### Screen 4

- Repay the active loan.
- Refresh score after repayment.
- Show improved tier / limit when applicable.

Target:

- Under 60 seconds
- No reloads
- No crypto onboarding friction
- Demo-safe, deterministic messaging

## 3. Product Principles

### 3.1 What Is On-Chain

On-chain is used for truth, verification, and enforcement.

- Credit metrics state
- Credit score
- Credit tier
- Borrow eligibility
- Loan issuance
- Loan repayment
- Default state
- Pool balance

### 3.2 What Is Off-Chain

Off-chain is used only for extraction, orchestration, and UX.

- Wallet creation for demo users
- Session management
- Horizon / RPC reads
- Aggregation of wallet metrics before submission
- Fee-bump sponsorship
- Demo prefunding attempts
- Score event history in SQLite

### 3.3 What Was Removed

The old MVP flow is no longer the main product:

- Email OTP
- Multi-step bootstrap assessment
- Income / attestation-based scoring
- Signup-heavy onboarding

Those ideas are historical. The current system is centered on on-chain metrics and a fast demo loop.

## 4. Scoring Model

The current scoring function is deterministic and intentionally simple.

```text
score =
  (tx_count * 2) +
  (repayment_count * 10) +
  (avg_balance_factor * 5) -
  (default_count * 25)
```

Where:

- `avg_balance_factor = min(floor(avg_balance / 100), 10)`
- `tx_count` is aggregated off-chain from Horizon
- `repayment_count` is derived from loan repayment history
- `avg_balance` is aggregated off-chain from wallet balance data
- `default_count` is derived from default history

Properties:

- Transparent
- Deterministic
- Easy to recompute independently
- Cheap to verify on-chain

## 5. Tiers

Current tier mapping:

- `0-39` → `Unrated`
- `40-79` → `Bronze`
- `80-119` → `Silver`
- `120+` → `Gold`

Current borrow limits:

- `Bronze` → ₱5,000
- `Silver` → ₱20,000
- `Gold` → ₱50,000

Current fee behavior:

- Bronze uses the base pool fee
- Silver gets a lower fee
- Gold gets the lowest fee

This is the current implementation direction and should be treated as canonical unless changed in code.

## 6. On-Chain Components

### 6.1 `credit_registry`

Purpose:

- Store the user's Credit Passport state
- Hold wallet metrics
- Hold score
- Hold tier
- Expose deterministic score calculation

Current stored state includes:

- issuer
- tier limits
- `Metrics`
  - `tx_count`
  - `repayment_count`
  - `avg_balance`
  - `default_count`
- score
- tier
- tier timestamp

Important functions:

- `initialize`
- `update_metrics`
- `update_metrics_raw`
- `update_score`
- `compute_score`
- `get_metrics`
- `get_score`
- `get_tier`
- `get_tier_limit`
- `set_tier`
- `revoke_tier`

Important behavior:

- Credit Passport is non-transferable
- Score and tier are recalculated from metrics
- Tier can still be issuer-managed where needed

### 6.2 `lending_pool`

Purpose:

- Hold liquidity
- Enforce eligibility
- Lend PHPC
- Accept repayment
- Handle defaults

Important functions:

- `initialize`
- `deposit`
- `borrow`
- `repay`
- `mark_default`
- `get_loan`
- `get_pool_balance`

Important behavior:

- Borrower must have a qualifying on-chain tier
- Borrow amount cannot exceed tier limit
- Pool must have sufficient liquidity
- Tier influences effective fee
- Overdue loans can be marked defaulted

### 6.3 `phpc_token`

Purpose:

- Serve as the demo loan currency
- Support approvals and transfers needed by the pool flow

## 7. Backend Responsibilities

The backend is a coordinator, not the final source of truth for credit.

Current responsibilities:

- Create demo users and demo wallets
- Encrypt wallet secrets in SQLite
- Issue JWT session tokens
- Query Horizon and Stellar RPC
- Aggregate score inputs
- Submit metrics to `credit_registry`
- Sponsor gas through fee-bump transactions
- Trigger borrow / repay flows
- Track score history and demo events
- Attempt demo wallet prefunding on testnet

Current major routes:

- `POST /api/auth/demo`
- `POST /api/auth/login`
- `POST /api/credit/generate`
- `GET /api/credit/score`
- `GET /api/credit/pool`
- `POST /api/loan/borrow`
- `POST /api/loan/repay`
- `GET /api/loan/status`

Legacy onboarding routes remain only as deprecated stubs.

## 8. Frontend Responsibilities

The frontend must make the trust engine legible.

Current UX goals:

- Show the score formula directly
- Show raw metrics directly
- Avoid crypto jargon
- Keep the flow under 4 primary screens
- Make tier progression visible
- Show pool balance
- Make borrow / repay feel immediate

Current pages:

- `/`
- `/dashboard`
- `/loan/borrow`
- `/loan/repay`

Legacy redirect pages:

- `/login`
- `/onboarding`
- `/score`

## 9. Messaging Rules

Use:

- Credit Passport
- Fully on-chain score
- Instant approval
- Zero gas
- Funded by a shared pool

Avoid leading with:

- Soulbound Token
- SEP-41
- Smart contract internals
- Multi-step identity onboarding

The demo should feel like credit infrastructure, not crypto onboarding.

## 10. Demo Capital Model

The demo now assumes a real pool narrative.

Messaging:

> Funded by lenders, NGOs, or DAOs.

The UI should show:

- Current pool balance
- Instant disbursement from the pool
- Repayment returning value to the pool

## 11. Default Handling

Defaults are part of the current product, not a future add-on.

Required behavior:

- Loans have an expiration ledger
- Overdue loans can be marked with `mark_default`
- Default history reduces score
- Default state must surface in the demo narrative and score state

The current backend cron path attempts to detect overdue loans and refresh score state after default.

## 12. Current Status Against Product Goal

Implemented:

- Frictionless demo entry
- Silent wallet creation
- Metrics-based on-chain credit registry
- Deterministic score formula
- Bronze / Silver / Gold tiering
- On-chain borrowing gate
- On-chain repayment flow
- Pool balance exposure
- Transparent UI formula and raw metrics
- Next-tier progress UI
- Tier-sensitive fees
- Score refresh after repayment

Partially implemented / environment-dependent:

- Demo wallet prefunding
- Live testnet score updates
- End-to-end default demo against real deployed contracts

Not part of the current core:

- OTP verification
- Long onboarding forms
- Off-chain bootstrap scoring

## 13. Verification Snapshot

Current local verification completed:

- `cargo test -p credit_registry`
- `cargo build -p credit_registry --target wasm32v1-none --release`
- `cargo test -p lending_pool`
- `pnpm exec tsc --noEmit` in `backend`
- `pnpm lint` in `frontend`
- `pnpm exec next build --webpack` in `frontend`

## 14. Source of Truth Rule

If `README.md`, older docs, or pitch text disagree with this file, prefer this file.

If this file disagrees with the code, the code wins and this file should be updated immediately.

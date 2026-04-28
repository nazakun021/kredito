# Kredito

Transparent on-chain credit scores and instant micro-loans for the unbanked, built on Stellar.

## Problem

Millions of micro-entrepreneurs in emerging markets have no formal credit history, making them "invisible" to traditional lenders. They are forced to rely on predatory lenders with high interest rates or wait weeks for paperwork-heavy approval processes for small, essential capital injections.

## Solution

Kredito turns wallet activity into a transparent, deterministic, on-chain **Credit Passport**. Using Soroban smart contracts, it aggregates on-chain metrics to compute a credit score and tier, unlocking instant PHPC loans from a liquidity pool with fees that reward creditworthiness.

## Demo Flow (1 minute)

1.  **Enter Demo Mode** — Auto-creates a silent wallet; no signup friction or passwords.
2.  **Generate Score** — Backend aggregates off-chain wallet metrics (balances, transactions, repayments).
3.  **Submit to Registry** — Contract computes a deterministic on-chain score and tier.
4.  **Borrow Instantly** — On-chain lending pool disburses PHPC based on tier limits.
5.  **Repay & Refresh** — Repayment updates metrics and boosts the user's score live.

## Architecture

**Browser (Next.js)**
|-- Zustand (session state)
|-- TanStack Query (API state management)
|-- Stellar SDK (transaction signing)

**Backend (Express + Node.js)**
|-- Stellar RPC + Horizon (metric aggregation)
|-- SQLite (session persistence & encrypted secrets)
|-- Fee-bump Service (gasless user transactions)

**Stellar Testnet**
|-- `credit_registry` (Credit Passport logic & scoring)
|-- `lending_pool` (Loan disbursement & repayment)
|-- `phpc_token` (Demo PHPC stablecoin)

The backend acts as an orchestrator for metric aggregation and fee-sponsorship, while the final source of truth for credit and capital remains fully on-chain.

## Project Structure

```text
kredito/
├── backend/            # Express server for coordination & fee-bumps
├── contracts/          # Soroban smart contracts (Rust)
│   ├── credit_registry/
│   ├── lending_pool/
│   └── phpc_token/
├── docs/               # Technical specs and setup guides
├── frontend/           # Next.js mobile-first dashboard
└── README.md
```

## Stellar Features Used

| Feature                     | Usage                                                       |
| :-------------------------- | :---------------------------------------------------------- |
| **Soroban smart contracts** | Deterministic scoring logic and automated lending gates     |
| **PHPC on Stellar**         | Stablecoin for loan disbursement and repayment              |
| **Fee-bump**                | Sponsors gas fees for a seamless "Zero Gas" user experience |
| **Deterministic Scoring**   | Transparent formula calculated on-chain for verifiability   |

## Smart Contracts

Deployed and initialized on Stellar Testnet:

- **Registry:** `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ`
- **Lending Pool:** `CBQHUU5LBNJ6BTH6GCU7YXDMOXOHHDWFD5VS6YP4HFFWTBSSMSAXLKK5`
- **PHPC Token:** `CDUOWTPJIHDM5PCRDDMPLBJLANFMDCIIMG6IRVGYC6HMRP65S3X54CTW`

## Contract Functions

| Function                        | Caller         | Description                                 |
| :------------------------------ | :------------- | :------------------------------------------ |
| `update_metrics(user, metrics)` | Issuer/Backend | Updates raw activity metrics on-chain       |
| `update_score(user)`            | Anyone         | Recomputes deterministic score from metrics |
| `borrow(amount)`                | Borrower       | Disburses PHPC if tier limit allows         |
| `repay(amount)`                 | Borrower       | Accepts repayment and clears loan state     |
| `mark_default(user)`            | Anyone         | Marks overdue loans and penalizes score     |

## Tier Status Lifecycle

**Score Computed** --> **Tier Assigned** (Bronze, Silver, or Gold)
--> **Loan Issued** (Disbursement from pool)
--> **Repaid** (Score increases, tier may upgrade)
--> **Defaulted** (Overdue loan, score penalty)

## Prerequisites

- **Rust (latest stable)** + **Soroban CLI**
- **Node.js 18+** & **pnpm**
- **Stellar Testnet Account** (funded via Friendbot)

## Setup

### Smart Contracts

```bash
# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Run contract tests
cargo test -p credit_registry
cargo test -p lending_pool
```

### Backend

```bash
cd backend
pnpm install
# Configure .env with your ISSUER_SECRET_KEY and Contract IDs
npm run dev
```

### Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

## Sample CLI Invocations

```bash
# Update user metrics (Admin/Issuer)
soroban contract invoke \
  --id CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ \
  --source issuer \
  --network testnet \
  -- update_metrics \
  --user <USER_ADDRESS> \
  --metrics '{ "tx_count": 10, "repayment_count": 2, "avg_balance": 500, "default_count": 0 }'

# Borrow from pool
soroban contract invoke \
  --id CBQHUU5LBNJ6BTH6GCU7YXDMOXOHHDWFD5VS6YP4HFFWTBSSMSAXLKK5 \
  --source borrower \
  --network testnet \
  -- borrow \
  --amount 5000000000
```

## Target Users

Unbanked micro-entrepreneurs, sari-sari store owners, and gig workers who have significant wallet activity but lack traditional credit scores. Kredito allows them to build a **Credit Passport** that they own and can use to access fair capital.

## Why Stellar

Stellar provides the perfect rails for micro-lending: sub-cent fees make small loans viable, 5-second finality enables "instant" approval, and Soroban allows for transparent, verifiable credit logic that anyone can audit.

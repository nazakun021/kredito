# Kredito

Uncollateralized micro-lending for unbanked Filipinos, built on Stellar.

## Problem

A sari-sari store owner in Davao City needing ₱5,000 to restock has no formal bank account or credit score. Her only option is a "5-6" loan at 20% monthly interest. Despite having a real financial history from remittances, she has no way to prove her creditworthiness to formal lenders.

## Solution

Kredito computes a transparent credit score from on-chain history and mints it as a non-transferable Soulbound Token (SBT). This SBT gates access to uncollateralized PHPC (PHP stablecoin) loans via a smart contract lending pool, with all gas fees covered by fee-bump transactions for a seamless "web2" experience.

## Demo Flow (1 minute)

1. **Sign in with email** — Embedded wallet created automatically, no seed phrases needed.
2. **Compute Score** — Credit score generated live from Horizon API transaction history.
3. **Mint SBT** — Non-transferable credit tier credential written to the `credit_registry` contract.
4. **Borrow PHPC** — `lending_pool` verifies SBT and disburses funds instantly to the wallet.
5. **Repay On-Chain** — Loan settled with a flat 5% fee; credit score updates upon successful repayment.

## Architecture

**Browser (Next.js 14 + Tailwind)**
|-- TanStack Query (loan status + score polling)
|-- Zustand (session state)
|-- Stellar SDK (transaction building)

**Backend (Node.js + Express)**
|-- Horizon Scanner (wallet age, tx count, repayment events)
|-- Fee-Bump Signer (issuer keypair absorbs all XLM gas fees)
|-- Default Monitor (cron job for loan health)
|-- SQLite (encrypted user keypairs, score history)

**Stellar Testnet (Soroban)**
|-- `credit_registry` (SBT manager — set_tier, revoke_tier)
|-- `lending_pool` (Lending engine — borrow, repay, mark_default)
|-- `phpc_token` (SEP-41 PHP stablecoin)

## Project Structure

```text
kredito/
├── contracts/
│   ├── credit_registry/        # SBT manager: set_tier, revoke_tier, transfer() trap
│   ├── lending_pool/           # Vault: borrow, repay, mark_default lifecycle
│   ├── phpc_token/             # SEP-41 PHP stablecoin (1 PHPC = 1 PHP)
│   └── Cargo.toml              # Rust workspace configuration
├── backend/
│   ├── src/scoring/            # Horizon scoring engine
│   ├── src/stellar/            # Fee-bump signer and issuer logic
│   └── src/cron/               # Loan default monitor
└── frontend/
    └── app/                    # Next.js 14 dashboard, score, and loan views
```

## Stellar Features Used

| Feature                     | Usage                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| **Soroban Smart Contracts** | All lending rules enforced on-chain across 3 composable contracts                       |
| **Soulbound Tokens (SBT)**  | Non-transferable credit credentials in `credit_registry`; `transfer()` panics by design |
| **Fee-Bump Transactions**   | Backend issuer keypair absorbs all XLM fees — users pay ₱0 in gas                       |
| **SEP-41 Token Standard**   | PHPC stablecoin follows the standard for full ecosystem compatibility                   |
| **Horizon API**             | Permissionless read access to wallet history for credit score computation               |

## Smart Contracts

Deployed on Stellar Testnet:

| Contract          | Address                                                    |
| ----------------- | ---------------------------------------------------------- |
| `credit_registry` | `CC62UK332E6DZ6GIDSUPXNEEW2BSSVWRJGRX63PJEGQVKHKFXAHRTEIT` |
| `lending_pool`    | `CCYSCTEXUMHMPLWHDTNJ2EXZSQNVAF6KLGSYR2GDWMIOXMZPDBHXMXRI` |
| `phpc_token`      | `CCBPBWE62NP5IZXN4QV26FD2E3IMKC7HCTPDNPGYWTKDJ5KYTSMC4AWJ` |

Explorer: https://stellar.expert/explorer/testnet

### Contract Functions

| Function                   | Caller   | Description                                             |
| -------------------------- | -------- | ------------------------------------------------------- |
| `set_tier(wallet, tier)`   | Issuer   | Mints or upgrades SBT in `credit_registry`              |
| `borrow(borrower, amount)` | Borrower | Cross-calls registry, checks SBT, disburses PHPC        |
| `repay(borrower)`          | Borrower | Pulls principal + fee via `transfer_from`, marks repaid |
| `mark_default(borrower)`   | Public   | Marks overdue loan defaulted after deadline             |

## Loan Lifecycle

```text
Borrowed --> Repaid     (borrower calls repay before deadline)
         --> Defaulted  (public calls mark_default after deadline)
         --> Revoked    (issuer calls revoke_tier on registry)
```

## Prerequisites

- **Rust** (latest stable) + `wasm32-unknown-unknown` target
- **Stellar CLI** v22+
- **Node.js** 20 LTS + **pnpm**

## Setup

### Smart Contracts

```bash
cd contracts
stellar contract build
cargo test --workspace
```

### Backend & Frontend

```bash
# Backend
cd backend
pnpm install
pnpm dev

# Frontend
cd frontend
pnpm install
pnpm dev
```

## Sample CLI Invocations

```bash
# Mint Tier 1 SBT to a wallet (issuer only)
stellar contract invoke --id $REGISTRY_ID --source issuer --network testnet \
  -- set_tier --wallet <ADDRESS> --tier 1

# Borrow 5,000 PHPC (50,000,000,000 stroops)
stellar contract invoke --id $POOL_ID --source borrower --network testnet \
  -- borrow --borrower <ADDRESS> --amount 50000000000

# Check pool liquidity
stellar contract invoke --id $POOL_ID --network testnet -- get_pool_balance
```

## Target Users

Unbanked and underbanked individuals in the Philippines — sari-sari store owners, market vendors, and freelancers earning ₱10,000–₱50,000/month — who have active Stellar wallet history but no access to formal credit. Kredito targets the ₱3,000–₱20,000 loan range where banks won't operate.

## Why Stellar

No other chain combines sub-cent fees, 5-second finality, and a native SEP-24 anchor ecosystem. The fee-bump mechanism is essential — a ₱0.50 gas fee would be 1% of a ₱5,000 loan, destroying the unit economics. Stellar's Soroban cross-contract calls let the credit registry act as a reusable primitive for any protocol on the network.

---

MIT © 2026 Kredito

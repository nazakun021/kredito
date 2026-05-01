# Kredito

Transparent on-chain credit scores and instant micro-loans for the Filipino unbanked, built on Stellar and accessed through Freighter.

## Links

🔗 **[Live Demo → kredito-iota.vercel.app](https://kredito-iota.vercel.app)**

🔭 **[Credit Registry on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBQV7ZIM6ZA4VIENUYDADWYWTATLXMY4RKQ67SQAZH3LWQJEITB6IOY2?filter=interface)**

🔭 **[Lending Pool on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDTASHYWGEEM7I4Z4QCQSZKZOY3KMID32RBZDTA3VOUXFWE4YXWFY26N?filter=interface)**

🔭 **[PHPC Token on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAMZB75TSS7IP7O7BTGQJVLBBPRIA3STHWPF4UUVZ5L3B5Z7J7A7T4E7?filter=interface)**

> **SEA Stellar Hackathon · Track: Payments & Financial Access**

---

## Problem

Small retail business owners in the Philippines (sari-sari stores, online resellers, market vendors) lack traditional credit history, making them "invisible" to banks. They often rely on informal lenders with predatory interest rates or use personal savings, which stunts their growth. Traditional digital wallets have low transaction caps and no path to credit, leaving SMEs without the capital needed for bulk inventory orders.

## Solution

Kredito uses deterministic on-chain transaction history to generate verifiable credit scores. These scores are stored in a Soroban smart contract and used to unlock tiered micro-loans from a decentralized liquidity pool. Settlement happens in seconds with near-zero fees, and users build a portable "Credit Passport" with every on-time repayment.

## Product Flow

1. **Connect Wallet** — Sign in with Freighter through a wallet-signed Stellar WebAuth (SEP-10) challenge.
2. **Review Credit Passport** — See raw metrics, the exact scoring formula, and your on-chain tier.
3. **Borrow Instantly** — Pool disburses PHPC to your wallet via smart contract.
4. **Repay & Level Up** — Repayment pulls PHPC from that same connected wallet, then updates your score live. Higher tier = bigger limit.

---

## ✅ Submission Checklist

| Requirement                        | Status                                                        |
| :--------------------------------- | :------------------------------------------------------------ |
| Public GitHub repository           | ✅                                                            |
| README with complete documentation | ✅                                                            |
| Minimum 8+ meaningful commits      | ✅                                                            |
| Live demo link                     | ✅ [kredito-iota.vercel.app](https://kredito-iota.vercel.app) |
| Mobile responsive view             | ✅ See screenshot below                                       |
| CI/CD pipeline running             | ✅ See badge & screenshot below                               |
| Inter-contract calls working       | ✅ See section below                                          |
| Custom token deployed              | ✅ PHPC (`CAMZB75T...`)                                       |
| Pool deployed                      | ✅ Lending Pool (`CDTASHYW...`)                               |
| Contract addresses                 | ✅ See section below                                          |

---

## 📱 Mobile Responsive

![Mobile View](./images/mobile.png)

The frontend is built with Tailwind CSS and Next.js App Router, with responsive layouts across all screens: landing page, dashboard, borrow flow, and repay flow.

---

## 🔄 CI/CD Pipeline

![CI Pipeline](./images/ci.png)

All checks pass on every push to `main`:

- **Backend** (Node.js) — lint + build
- **Frontend** (Next.js) — lint + build
- **Smart Contracts** (Rust) — cargo test
- **Vercel** — auto-deploy on merge
- **Railway** — run after every other CI check is done and passed

---

## 🔗 Inter-Contract Calls

Kredito implements **inter-contract calls** between all three Soroban contracts:

### Call Graph

```
Frontend / Backend
      │
      ▼
lending_pool::borrow(borrower, amount)
      │
      ├──► credit_registry::get_tier(borrower)             ← reads tier eligibility
      │
      └──► phpc_token::transfer(pool, borrower, amt)       ← disburses funds

lending_pool::repay(borrower, amount)
      │
      ├──► phpc_token::transfer_from(borrower, pool)       ← collects repayment
      │
      └──► credit_registry::update_metrics(borrower)       ← updates score on-chain
```

### Example Transaction Hash (Inter-Contract Call)

Borrow + Repay transactions:
https://stellar.expert/explorer/testnet/contract/CDTASHYWGEEM7I4Z4QCQSZKZOY3KMID32RBZDTA3VOUXFWE4YXWFY26N

Sample Borrow Transaction:
![Borrow](./images/borrow.png)

Sample Repay Transaction:
![Repay](./images/repay.png)

---

## 🪙 Custom Token & Pool

### PHPC — Philippine Peso Coin (Custom Stablecoin)

PHPC is a **SEP-41 compliant custom token** representing the Philippine Peso on Stellar Testnet. It is used as the loan currency throughout the Kredito platform.

| Property         | Value                                                                                                                                                |
| :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract Address | `CAMZB75TSS7IP7O7BTGQJVLBBPRIA3STHWPF4UUVZ5L3B5Z7J7A7T4E7`                                                                                           |
| Standard         | SEP-41 (Stellar token interface)                                                                                                                     |
| Explorer         | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAMZB75TSS7IP7O7BTGQJVLBBPRIA3STHWPF4UUVZ5L3B5Z7J7A7T4E7?filter=interface) |

### Lending Pool

A decentralized liquidity pool that manages loan disbursements and repayments.

| Property         | Value                                                                                                                                                |
| :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract Address | `CDTASHYWGEEM7I4Z4QCQSZKZOY3KMID32RBZDTA3VOUXFWE4YXWFY26N`                                                                                           |
| Pool Capacity    | ₱100,000,000 PHPC                                                                                                                                    |
| Explorer         | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDTASHYWGEEM7I4Z4QCQSZKZOY3KMID32RBZDTA3VOUXFWE4YXWFY26N?filter=interface) |

---

## Smart Contracts

All three contracts are deployed and verified on **Stellar Testnet**:

| Contract          | Address                                                    |
| :---------------- | :--------------------------------------------------------- |
| `credit_registry` | `CBQV7ZIM6ZA4VIENUYDADWYWTATLXMY4RKQ67SQAZH3LWQJEITB6IOY2` |
| `lending_pool`    | `CDTASHYWGEEM7I4Z4QCQSZKZOY3KMID32RBZDTA3VOUXFWE4YXWFY26N` |
| `phpc_token`      | `CAMZB75TSS7IP7O7BTGQJVLBBPRIA3STHWPF4UUVZ5L3B5Z7J7A7T4E7` |

Explorer Link: https://stellar.expert/explorer/testnet/contract/CBQV7ZIM6ZA4VIENUYDADWYWTATLXMY4RKQ67SQAZH3LWQJEITB6IOY2?filter=interface
![Credit Registry Explorer](./images/img1.png)

Explorer Link: https://stellar.expert/explorer/testnet/contract/CDTASHYWGEEM7I4Z4QCQSZKZOY3KMID32RBZDTA3VOUXFWE4YXWFY26N?filter=interface
![Lending Pool Explorer](./images/img2.png)

Explorer Link: https://stellar.expert/explorer/testnet/contract/CAMZB75TSS7IP7O7BTGQJVLBBPRIA3STHWPF4UUVZ5L3B5Z7J7A7T4E7?filter=interface
![PHPC Token Explorer](./images/img3.png)

---

## Contract Functions

| Function         | Contract          | Description                                                                                    |
| :--------------- | :---------------- | :--------------------------------------------------------------------------------------------- |
| `update_metrics` | `credit_registry` | Submits raw tx/balance metrics to update score.                                                |
| `get_tier`       | `credit_registry` | Returns the current user tier (0–3).                                                           |
| `borrow`         | `lending_pool`    | Validates tier/limit and disburses PHPC to borrower. Calls `credit_registry` and `phpc_token`. |
| `repay`          | `lending_pool`    | Accepts repayment, triggers score improvement. Calls `phpc_token` and `credit_registry`.       |
| `deposit`        | `lending_pool`    | Allows admins/liquidity providers to fund the pool.                                            |
| `transfer`       | `phpc_token`      | SEP-41 token transfer used internally by `lending_pool`.                                       |

---

## Architecture

- **Frontend (Next.js 16)**: Built with React 19, Zustand for state management, and TanStack Query for data fetching.
- **Backend (Express)**: Handles wallet-auth sessions, score orchestration, fee sponsorship, and fully stateless operation with the chain as the source of truth.
- **Stellar (Soroban)**: Core financial logic running on Stellar Testnet with inter-contract calls between all three contracts.
- **Client SDK**: `@stellar/stellar-sdk` for transaction building, fee-sponsoring, and RPC interaction.

## Project Structure

```text
kredito/
├── contracts/
│   ├── credit_registry/        # Scoring, tiering, and metrics logic
│   ├── lending_pool/           # Borrowing, repayment, pool management + inter-contract calls
│   └── phpc_token/             # SEP-41 compliant PHPC stablecoin
├── backend/
│   ├── src/
│   │   ├── routes/             # Auth, Credit, and Loan API endpoints
│   │   ├── stellar/            # Fee-bump and RPC utilities
│   │   └── scoring/            # Off-chain score calculation logic
├── frontend/
│   ├── app/                    # Next.js App Router (Dashboard, Borrow, Repay)
│   ├── store/                  # Zustand auth and UI state
│   └── lib/                    # API clients and Freighter integration
└── docs/                       # Architecture, Setup, and API specs
```

## Stellar Features Used

| Feature                    | Usage                                                                        |
| :------------------------- | :--------------------------------------------------------------------------- |
| **Soroban Contracts**      | Powering the scoring engine and the lending pool logic.                      |
| **Inter-Contract Calls**   | `lending_pool` calls `credit_registry` and `phpc_token` during borrow/repay. |
| **PHPC (Stablecoin)**      | Enabling non-volatile loans pegged to the local currency (PHP).              |
| **Sponsored Transactions** | Issuer-funded fee-bumps for a seamless, gasless user experience.             |
| **Stellar RPC**            | Real-time indexing of on-chain activity to calculate credit metrics.         |
| **SEP-10 WebAuth**         | Secure, keyless wallet authentication via Freighter.                         |

---

## Current Demo Note

Repayment requires the wallet to hold `principal + fee`.

Example:

- borrow `100 PHPC`
- fee `5 PHPC` (500 bps)
- total repayment due `105 PHPC`

Because the wallet receives only the borrowed principal, you must top up the extra fee amount before repayment. If you do not, the PHPC token contract rejects repayment with `InsufficientBalance`.

---

## Setup & Installation

### Prerequisites

- Node.js 20+ and `pnpm`
- Rust (latest stable) and `stellar-cli`
- Freighter browser extension (set to Testnet)

### Quick Start

```bash
# Clone the repo and run the setup script
./scripts/setup.sh

# Start the Backend (in one terminal)
cd backend && pnpm dev

# Start the Frontend (in another terminal)
cd frontend && pnpm dev
```

### Smart Contracts

```bash
cd contracts
cargo test --workspace
stellar contract build
```

### Backend

```bash
cd backend
pnpm install
pnpm build
pnpm dev
```

_Requires `backend/.env` (see `backend/.env.example`). Generate `ADMIN_API_SECRET` as a separate random token; do not reuse the issuer signing key in HTTP auth._

### Frontend

```bash
cd frontend
pnpm install
pnpm lint
pnpm build
pnpm dev
```

_Runs at `http://localhost:3000`. Freighter should be installed and pointed at Stellar Testnet._

---

## Documentation

- [DEMO.md](./DEMO.md): presenter runbook and dashboard E2E demo flow
- [docs/SETUP.md](./docs/SETUP.md): local setup
- [docs/TESTING.md](./docs/TESTING.md): live E2E testing steps
- [docs/ERROR_CODES.md](./docs/ERROR_CODES.md): system error codes and handling
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): system architecture

## Why Stellar?

Stellar provides the perfect infrastructure for micro-finance:

- **Sub-cent Fees**: Loans are economically viable even at small amounts.
- **Instant Settlement**: Borrowers get funds in 3–5 seconds, not days.
- **Native Compliance**: Stablecoins like PHPC allow for regulatory-friendly settlement in local currency.
- **Composable Contracts**: Inter-contract calls let the lending pool, credit registry, and token work together atomically.

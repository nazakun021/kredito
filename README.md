# Kredito

Uncollateralized micro-lending for unbanked Filipinos, built on Stellar.

## Problem

A sari-sari store owner in Davao City needing ₱5,000 to restock has no formal bank account or credit score. Her only option is a "5-6" loan at 20% monthly interest. Despite having a real financial history from remittances, she has no way to prove her creditworthiness to formal lenders.

## Solution

Kredito computes a transparent credit score from a two-layer model (on-chain history + off-chain bootstrap signals) and mints it as a non-transferable Soulbound Token (SBT). This SBT gates access to uncollateralized PHPC (PHP stablecoin) loans via a smart contract lending pool, with all gas fees covered by fee-bump transactions for a seamless "web2" experience.

## Demo Flow (1 minute)

1. **Sign in with email** — Embedded wallet created automatically, no seed phrases needed.
2. **Verify Identity** — Quick email OTP verification via Resend.
3. **Compute Score** — Credit score generated from a mix of financial profile and Stellar transaction history.
4. **Mint SBT** — Non-transferable credit tier credential written to the `credit_registry` contract.
5. **Borrow PHPC** — `lending_pool` verifies SBT and disburses funds instantly to the wallet.
6. **Repay On-Chain** — Loan settled with a flat 5% fee; credit score updates upon successful repayment.

## Architecture

**Browser (Next.js 14 + Tailwind)**
|-- TanStack Query (loan status + score polling)
|-- Zustand (session state)
|-- Lucide Icons (mobile-first UI)

**Backend (Node.js + Express)**
|-- Two-Layer Scoring Engine (Horizon + Bootstrap signals)
|-- Fee-Bump Signer (issuer keypair absorbs all XLM gas fees)
|-- Resend Integration (Email OTP service)
|-- SQLite (encrypted user keypairs, score history)

**Stellar Testnet (Soroban)**
|-- `credit_registry` (SBT manager — set_tier, revoke_tier)
|-- `lending_pool` (Lending engine — borrow, repay, mark_default)
|-- `phpc_token` (SEP-41 PHP stablecoin)

## Stellar Features Used

| Feature                     | Usage                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------- |
| **Soroban Smart Contracts** | All lending rules enforced on-chain across 3 composable contracts                       |
| **Soulbound Tokens (SBT)**  | Non-transferable credit credentials in `credit_registry`; `transfer()` panics by design |
| **Fee-Bump Transactions**   | Backend issuer keypair absorbs all XLM fees — users pay ₱0 in gas                       |
| **SEP-41 Token Standard**   | PHPC stablecoin follows the standard for full ecosystem compatibility                   |
| **Horizon API**             | Permissionless read access to wallet history for credit score computation               |

## Setup

### Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v10 or higher
- **Rust**: Latest stable with `wasm32-unknown-unknown` target
- **Stellar CLI**: For contract deployment and interaction

### 1. Smart Contracts

```bash
cd contracts
# Build the WASM binaries
stellar contract build
# Deploy to Testnet (requires a configured 'issuer' identity)
./deploy.sh
```

### 2. Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   pnpm install
   ```

2. Create a `.env` file based on the following template:
   ```env
   PORT=3001
   JWT_SECRET=your_jwt_secret
   ENCRYPTION_KEY=your_32_byte_hex_encryption_key
   RESEND_API_KEY=your_resend_api_key
   ISSUER_SECRET_KEY=S... (Stellar Secret Key)
   PHPC_ID=CC...
   REGISTRY_ID=CC...
   LENDING_POOL_ID=CC...
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

### 3. Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   pnpm install
   ```

2. Create a `.env` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

## Smart Contracts

Deployed on Stellar Testnet:

| Contract          | Address                                                    |
| ----------------- | ---------------------------------------------------------- |
| `credit_registry` | `CC62UK332E6DZ6GIDSUPXNEEW2BSSVWRJGRX63PJEGQVKHKFXAHRTEIT` |
| `lending_pool`    | `CCYSCTEXUMHMPLWHDTNJ2EXZSQNVAF6KLGSYR2GDWMIOXMZPDBHXMXRI` |
| `phpc_token`      | `CCBPBWE62NP5IZXN4QV26FD2E3IMKC7HCTPDNPGYWTKDJ5KYTSMC4AWJ` |

Explorer: https://stellar.expert/explorer/testnet

---

MIT © 2026 Kredito

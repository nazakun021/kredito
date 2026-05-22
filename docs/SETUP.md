# Kredito — Setup & Installation Guide

This document provides a comprehensive guide for setting up the Kredito platform locally for development, testing, and production deployment on both Stellar Testnet and Mainnet.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Node.js**: Version `20.12.0` or higher.
- **pnpm**: Version `10.32.1` (strictly required, as specified in the monorepo configuration).
- **Rust**: Latest stable toolchain (for smart contract development).
- **Stellar CLI**: Version `22.0.0` or higher (for Soroban contract builds and deployments).
- **Freighter Extension**: Installed in your browser and configured for **Testnet** (for local development) or **Mainnet** (for live testing).

---

## 2. Quick Start (Automated Setup)

The easiest way to initialize the repository, install all dependencies, and prepare default configuration files is by running the automated setup script from the root directory:

```bash
chmod +x ./scripts/setup.sh
./scripts/setup.sh
```

This script will automatically:

1. Verify that `pnpm 10.32.1` is installed (warning if there is a version mismatch).
2. Copy `backend/.env.example` to `backend/.env` (if it doesn't already exist).
3. Install all dependencies in the `backend` directory.
4. Copy `frontend/.env.example` to `frontend/.env` (if it doesn't already exist).
5. Install all dependencies in the `frontend` directory.

---

## 3. Configuration & Environment Variables

If you prefer manual setup or need to customize credentials, configure the following files:

### 3.1 Backend Configuration (`backend/.env`)

Create `backend/.env` and update the following values:

```ini
# JWT / Session Authentication
JWT_SECRET=your_random_jwt_signing_secret_here
WEB_AUTH_SECRET_KEY=your_stellar_private_key_for_sep10_challenge_signing

# Domains for SEP-10 Auth WebAuth Challenge
HOME_DOMAIN=localhost
WEB_AUTH_DOMAIN=localhost:3001

# Stellar Network Configuration
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
# Network Passphrase:
# - Testnet: "Test SDF Network ; September 2015"
# - Mainnet: "Public Global Stellar Network ; September 2015"
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Deployed Contract IDs (copied from contracts/deployed.json or deployed-mainnet.json)
REGISTRY_ID=CDBVJNDU6AI6TOE3CHSEK54LQXJQVEBD2EHMKJIENWDHQCZ4CUHFONCI
LENDING_POOL_ID=CDF5CP4X46RDVQAFBH4CWRTUFMXTMDXXB5TTIJWZEGGTYRFT6Y774KOA
XLM_SAC_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

# Fee-Bump Sponsorship Secret Key (MUST contain enough XLM to pay for sponsored gas)
ISSUER_SECRET_KEY=your_sponsoring_issuer_wallet_secret_seed

# Secure Admin Sweep Secret (For check-defaults cron triggers)
ADMIN_API_SECRET=your_secure_32_character_api_token_here

# Server Server Configuration
PORT=3001
CORS_ORIGINS=http://localhost:3000

# Optional Settings
LOG_LEVEL=info
APPROVAL_LEDGER_WINDOW=500
STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet
```

> [!WARNING]
> Do not reuse `ISSUER_SECRET_KEY` as your `ADMIN_API_SECRET` token or expose it in HTTP headers/cron requests. Keep it strictly private.

### 3.2 Frontend Configuration (`frontend/.env`)

Create `frontend/.env` and set:

```ini
# Backend API Base URL
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Stellar Target Network ("testnet" or "mainnet")
NEXT_PUBLIC_NETWORK=testnet

# Stellar Expert base URL for transaction/contract links
NEXT_PUBLIC_EXPLORER_URL=https://stellar.expert/explorer/testnet
```

---

## 4. Running the Application Locally

After completing configuration, open two terminal windows to run both services simultaneously:

### Step 1: Start the Backend Service

```bash
cd backend
pnpm dev
```

The API server will launch at `http://localhost:3001`.

### Step 2: Start the Frontend Application

```bash
cd frontend
pnpm dev
```

The Next.js user interface will start at `http://localhost:3000`. Open your browser and connect your Freighter wallet to get started!

---

## 5. Smart Contract Setup & Deployment

If you make changes to the Soroban contracts in the `contracts/` directory, follow these commands:

### 5.1 Build & Test Contracts

```bash
cd contracts
cargo test --workspace
stellar contract build
```

### 5.2 Deploying to Testnet

To redeploy and initialize a fresh set of contracts to Stellar Testnet:

```bash
cd contracts
chmod +x ./redeploy.sh
./redeploy.sh
```

This will compile the contracts, deploy them, initialize their parameters, deposit seeding liquidity, and automatically save the new contract IDs to `contracts/deployed.json`. Remember to update your `backend/.env` values with these new IDs!

### 5.3 Deploying to Mainnet

When ready for production deployment on Stellar Mainnet:

```bash
cd contracts
chmod +x ./deploy-mainnet.sh
# Ensure you have your STELLAR_SOURCE_ACCOUNT private key set in the terminal
./deploy-mainnet.sh
```

This will deploy and initialize the contracts on Stellar Mainnet, saving the records to `contracts/deployed-mainnet.json`. Ensure your backend and frontend `.env` configs are updated to point to `mainnet` and the corresponding mainnet contract IDs.

# Kredito 💸

### Your credit score. Your loan. No bank required.

> **Built for the SEA Stellar Hackathon · Track: Payments & Financial Access**

---

## The Problem (In Plain English)

Meet Maria. She runs a sari-sari store in Quezon City.

She needs ₱5,000 to restock before the weekend rush. She has no credit card. No formal bank account. No credit bureau score. The only option available to her today is a _5-6_ loan — ₱5,000 borrowed, ₱6,000 returned in 30 days. That's **20% monthly interest.**

Meanwhile, her GCash transfers, remittances, and daily payments have been happening digitally for years. She has a real financial track record. Banks just don't look at it.

**Kredito does.**

---

## What Kredito Does

Kredito reads your real transaction history, gives you a credit score based on it, and lets you borrow PHP instantly — right from your phone, with no bank account required.

That's it. No jargon. No crypto wallet setup. No seed phrases.

Just:

1. **Sign in with your email**
2. **See your credit score** — built from your real transaction history
3. **Borrow ₱5,000** — funds hit your account in seconds
4. **Repay when you're ready** — on-time payments improve your score for next time

---

## Who This Is For

| Person                      | Their Problem                                                           | How Kredito Helps                                                               |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Sari-sari store owner       | Needs working capital to restock. Loan shark charges 20%/month.         | Borrow ₱5,000 instantly at 5% flat. Score improves with each on-time repayment. |
| Freelancer between projects | Client is 2 weeks late on payment. Rent is due.                         | Emergency loan in seconds. No collateral. No paperwork.                         |
| Market vendor               | Needs to buy inventory for the weekend. Bank requires 3-day processing. | Borrow at 8am, restock by 9am.                                                  |
| Student                     | No income history. Can't get a credit card. Needs laptop for school.    | Build a credit score from scratch via Stellar wallet activity.                  |

---

## How It Works (No Tech Speak)

```
You open the app → enter your email → Kredito reads your
transaction history → computes your credit score → shows
you how much you can borrow → you tap Borrow → money
arrives in seconds → you repay when due → your score
improves → next time you can borrow more.
```

**Your data belongs to you.** Your credit score is computed from your own public transaction history. It's stored on a public ledger that nobody can change, forge, or take away from you — not even Kredito.

**You never pay gas fees.** We absorb the network cost. Your loan amount is your loan amount. No hidden deductions.

---

## Live Demo

🔗 **[Try Kredito →](https://kredito.vercel.app)**  
📹 **[Watch the 60-second demo →](https://loom.com/kredito-demo)**

> _Test credentials: use any email. The demo wallet is pre-loaded with history and a Tier 1 credit score._

---

## The 60-Second Demo

| Step | What You Do         | What Happens                                                              |
| ---- | ------------------- | ------------------------------------------------------------------------- |
| 1    | Enter your email    | Account created. Secure wallet set up automatically.                      |
| 2    | Dashboard loads     | Your credit score appears — built from real transaction data.             |
| 3    | Tap "See Breakdown" | Three factors shown: account age, transaction volume, repayment history.  |
| 4    | Tap "Borrow ₱5,000" | Flat fee disclosed upfront. You confirm.                                  |
| 5    | Confirmation        | Funds arrive in your account. Transaction verifiable publicly in seconds. |

---

## Why Your Score Is Trustworthy

Traditional credit bureaus are controlled by private companies. They decide what counts, they hold your data, and they can be wrong with no recourse.

Your Kredito score is built from **three transparent factors**, all sourced from public data:

| Factor             | What It Measures                              | Max Points |
| ------------------ | --------------------------------------------- | ---------- |
| Account Age        | How long your Stellar account has been active | 30 pts     |
| Transaction Volume | Number of transactions on your account        | 40 pts     |
| Repayment History  | Prior Kredito loans repaid on time            | 30 pts     |

**Score 40–69** → Basic Credit → Borrow up to ₱5,000  
**Score 70–100** → Trusted Credit → Borrow up to ₱20,000

Every borrower can see exactly why they scored what they scored. No black box.

---

## Pricing

|                    | Amount            |
| ------------------ | ----------------- |
| Flat borrowing fee | 5% of loan amount |
| On a ₱5,000 loan   | ₱250 flat fee     |
| You repay          | ₱5,250 total      |
| Loan term          | 30 days           |
| Hidden fees        | None              |

Compare that to the alternative: a _5-6_ loan at ₱1,000 interest on the same amount, same term.

---

## Roadmap to Real Money

Kredito is currently on Stellar Testnet. The path to real PHP is one integration:

| Now (Testnet)          | Next (Mainnet)                                                               |
| ---------------------- | ---------------------------------------------------------------------------- |
| PHPC test token        | Real PHP via [Tempo](https://tempo.eu.com) or [PDAX](https://pdax.ph) anchor |
| Embedded server wallet | Optional Freighter self-custody wallet                                       |
| Philippines only       | IDR, VND, and other SEA currencies                                           |

The smart contracts require **zero changes** for mainnet. Only the token address changes.

---

---

# Technical Documentation

_For developers, judges, and contributors._

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER (Mobile Browser)                        │
│                         Next.js 14 Frontend                          │
│              /login  /dashboard  /score  /loan/borrow  /loan/repay   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ HTTPS REST + JWT
┌───────────────────────────▼──────────────────────────────────────────┐
│                      Node.js / Express Backend                       │
│   Auth · Horizon Scoring Engine · Fee-Bump Signer · Default Monitor  │
└───────┬───────────────────────────────┬──────────────────────────────┘
        │ Horizon API (read history)    │ Soroban RPC (invoke contracts)
        ▼                               ▼
┌──────────────────┐      ┌─────────────────────────────────────────┐
│  Horizon API     │      │   Stellar Testnet                       │
│  (testnet)       │      │   credit_registry · lending_pool · PHPC │
└──────────────────┘      └─────────────────────────────────────────┘
```

## Smart Contracts

Three Soroban contracts deployed on Stellar Testnet:

| Contract          | Address | Description                                                             |
| ----------------- | ------- | ----------------------------------------------------------------------- |
| `credit_registry` | `C...`  | Non-transferable SBT credit tiers. `transfer()` unconditionally panics. |
| `lending_pool`    | `C...`  | PHPC vault. Borrow/repay/default lifecycle. Cross-calls registry.       |
| `phpc_token`      | `C...`  | SEP-41 PHP stablecoin. 1 PHPC = 1 PHP (testnet peg).                    |

## Stellar Features Used

| Feature                     | How Kredito Uses It                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------- |
| **Soroban Smart Contracts** | All lending rules enforced on-chain. No counterparty risk.                            |
| **Soulbound Tokens (SBT)**  | Credit tier stored as a non-transferable token — scores cannot be sold or transferred |
| **Fee-Bump Transactions**   | Backend issuer pays all XLM network fees. Users pay ₱0 in gas.                        |
| **SEP-41 Token Standard**   | PHPC works with any Stellar-compatible wallet and DEX out of the box                  |
| **Horizon API**             | Free, permissionless read access to all wallet transaction history                    |

## Project Structure

```
kredito/
├── contracts/
│   ├── Cargo.toml               ← Rust workspace (resolver = "2")
│   ├── deployed.json            ← Testnet contract addresses
│   ├── credit_registry/src/     ← SBT contract (lib.rs + test.rs)
│   ├── lending_pool/src/        ← Vault contract (lib.rs + test.rs)
│   └── phpc_token/src/          ← SEP-41 token (lib.rs + test.rs)
├── backend/
│   └── src/
│       ├── scoring/             ← Horizon scoring engine
│       ├── stellar/             ← Fee-bump + Soroban RPC
│       ├── routes/              ← auth, credit, loan
│       └── cron/                ← Default monitor (runs every 6h)
└── frontend/
    └── app/                     ← Next.js App Router pages
        ├── login/
        ├── dashboard/
        ├── score/
        └── loan/borrow + repay
```

## Prerequisites

- Rust (latest stable) + `wasm32-unknown-unknown` target
- Stellar CLI v22+: `cargo install --locked stellar-cli --features opt`
- Node.js 20 LTS + pnpm

## Local Setup

### Contracts

```bash
# Install Wasm target
rustup target add wasm32-unknown-unknown

# Build all 3 contracts
cd contracts && stellar contract build

# Run all 15 tests across the workspace
cargo test --workspace
```

### Backend

```bash
cd backend
pnpm install
cp .env.example .env
# Fill in ISSUER_SECRET_KEY and deployed contract IDs in .env
pnpm dev
# → http://localhost:3001
```

### Frontend

```bash
cd frontend
pnpm install
# .env.local already set to http://localhost:3001
pnpm dev
# → http://localhost:3000
```

## Deploying Contracts to Testnet

```bash
# Generate and fund issuer keypair
stellar keys generate issuer --network testnet
stellar keys fund issuer --network testnet

# Deploy (repeat for each contract)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/phpc_token.wasm \
  --source issuer \
  --network testnet

# Full deployment script with initialization
# See: contracts/scripts/deploy.sh
```

## Sample Contract Invocations

```bash
# Check a wallet's credit tier
stellar contract invoke --id $REGISTRY_CONTRACT_ID --network testnet \
  -- get_tier --wallet GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Check pool liquidity
stellar contract invoke --id $LENDING_POOL_CONTRACT_ID --network testnet \
  -- get_pool_balance

# Manually set a credit tier (issuer only)
stellar contract invoke --id $REGISTRY_CONTRACT_ID --source issuer --network testnet \
  -- set_tier --wallet GXXXXXXX... --tier 1
```

## Hackathon Track

**SEA Stellar Hackathon · Payments & Financial Access**

Kredito directly addresses every criterion in the track brief:

- ✅ User-facing financial application (mobile-first, email login)
- ✅ Payment app people can actually use (full borrow/repay lifecycle)
- ✅ Connects users to their local economy (PHPC / PHP anchor path)
- ✅ Composability (credit_registry is a reusable primitive any protocol can query)
- ✅ Real product, not a prototype (on-chain state, repayment enforcement, default handling)

---

## License

MIT © 2026 Kredito Team

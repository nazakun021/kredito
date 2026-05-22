Your project is already far beyond “hackathon prototype” level.

You have:

- Real Soroban smart contracts in Rust
- Mainnet deployment flow
- Wallet auth (SEP-10)
- Lending pool mechanics
- Credit scoring
- KYC flow
- Transaction sponsorship / fee bumping
- Staking + deposits
- Frontend state management
- Error handling + tests
- Production deployment scripts

That immediately positions you above most hackathon submissions technically.

Your biggest leverage now is not coding anymore.

It is:

1. Presentation clarity
2. Narrative
3. Demo pacing
4. README quality
5. Showing real-world impact for Filipinos

The judges will not deeply inspect your Rust contracts line-by-line. They will evaluate:

- “Do I instantly understand this?”
- “Does this solve a real problem?”
- “Is it actually deployed?”
- “Does the team understand the product?”
- “Can this scale?”

Your repo structure already looks serious and production-oriented.

# What Your Project Actually Is

You need to frame it correctly.

Not:

> “blockchain lending app”

Instead:

> “Kredito is an on-chain microfinance infrastructure platform for financially underserved Filipinos.”

That framing is exponentially stronger.

---

# Your Core Pitch

## One-liner

> Kredito enables Filipinos without traditional banking access to build an on-chain credit identity and access transparent micro-loans using Stellar.

That should appear:

- README hero section
- Pitch deck opening
- Demo intro
- Submission description

---

# Your Biggest Strengths

From your architecture and notes:

### 1. Real Mainnet Deployment

Huge advantage.

Many teams stop at Testnet.

Your hackathon explicitly requires Mainnet deployment.

This is a major credibility signal.

---

### 2. Real Financial Inclusion Angle

The hackathon specifically prioritizes:

- unbanked users
- financial inclusion
- MSME tooling
- payment finance

Your product directly aligns with the event’s judging direction.

---

### 3. Excellent Technical Stack

You already have:

- Soroban contracts
- Stellar SDK
- Horizon integration
- SEP-10 auth
- Freighter integration
- Fee bump sponsorship
- Event pagination/retries
- Typed frontend/backend

This is much stronger than a normal CRUD dApp.

---

# What You Need To Improve Immediately

## 1. Stop Saying “Crypto Lending”

Dangerous framing.

Judges may associate it with:

- speculation
- predatory lending
- DeFi casino apps

Instead say:

- “microfinance”
- “financial access”
- “on-chain credit identity”
- “transparent programmable lending”
- “low-cost financial rails”

That framing matters enormously.

---

# Updated README Structure (Use This)

You should heavily simplify and sharpen your README.

Your current TODO/spec is good, but your final README should read like a startup product page.

---

# README.md (Recommended Final Version)

Use this exact structure.

---

# Kredito

## 🇵🇭 On-chain Microfinance Infrastructure for Filipinos

Kredito is a Stellar-powered lending platform that enables underserved Filipinos to build portable on-chain credit scores and access transparent micro-loans with low transaction costs.

Built on Stellar + Soroban and deployed on Mainnet.

---

# 🧩 Problem

Millions of Filipinos remain unbanked or underbanked.

Traditional lending systems:

- require extensive paperwork
- exclude users without formal credit history
- impose high interest rates
- are inaccessible to many small entrepreneurs and workers

Micro-business owners, freelancers, and first-time borrowers often cannot access fair financial services despite having consistent transaction behavior.

---

# 🌟 Vision

Kredito aims to create a portable on-chain financial identity system for Southeast Asia.

By using blockchain-based credit scoring and transparent smart contracts, users can gradually build financial trust without relying on traditional banking infrastructure.

Our long-term vision is:

- borderless credit identity
- programmable microfinance
- accessible lending for underserved communities

---

# 🎯 Purpose

We built Kredito to explore how Stellar can power real-world financial inclusion.

Instead of speculative blockchain use cases, Kredito focuses on practical financial access:

- credit scoring
- micro-loans
- staking liquidity
- transparent lending pools
- low-fee transactions

---

# 👥 Target Users

### Sari-sari Store Owners

Small business owners needing short-term working capital.

### Freelancers & Gig Workers

Users with inconsistent income streams and limited banking access.

### First-Time Borrowers

People without traditional credit histories.

### Everyday Filipinos

Users seeking transparent and low-cost alternatives to traditional lending systems.

---

# ✨ Features

- ✅ On-chain credit scoring system
- ✅ Three-tier borrower classification
- ✅ Smart contract powered lending pool
- ✅ Wallet-based authentication (SEP-10)
- ✅ XLM-powered borrowing and repayment
- ✅ Staking & liquidity participation
- ✅ Time deposit functionality
- ✅ KYC onboarding flow
- ✅ Transaction sponsorship / fee bumping
- ✅ Mainnet deployment on Stellar

---

# 🛠 Tech Stack

## Frontend

- Next.js 15
- React 19
- Tailwind CSS
- Zustand
- TanStack Query

## Backend

- Node.js
- Express.js
- Railway

## Blockchain

- Stellar
- Soroban Smart Contracts
- Horizon API
- Stellar SDK
- SEP-10 Authentication

## Smart Contracts

- Rust
- soroban-sdk

## Infrastructure

- Vercel
- GitHub Actions
- Freighter Wallet

---

# 🧠 System Architecture

Frontend → Express Backend → Soroban Smart Contracts → Stellar Mainnet

Core contracts:

- `credit_registry`
- `lending_pool`

The backend handles:

- auth challenges
- transaction sponsorship
- wallet orchestration
- contract querying
- score computation

---

# 🚀 How It Works

1. User connects Freighter wallet
2. User completes KYC onboarding
3. Kredito computes on-chain credit metrics
4. User receives a borrower tier
5. User borrows XLM from lending pool
6. Repayment behavior improves future borrowing capacity

---

# 🌐 Deployment

## Testnet

### credit_registry

`CAZWIQZX4OK5FCSTL4NFFWFVLPGO2IBWERLN572RNP4V4EHSWK7U3KH7`

### lending_pool

`CCBKOG6YGOTBBGXHKAIMJIFE46EXP4MTGJ3HLSBLRG54SQAMK6TRHWBP`

Add:

```md
![Testnet](./screenshots/testnet.png)
```

---

## Mainnet

Add your real deployed addresses here.

Add:

```md
![Mainnet](./screenshots/mainnet.png)
```

---

# 📸 Demo

## Live App

`https://kredito-iota.vercel.app`

## Demo Video

Add Loom/YouTube link

## Pitch Deck

Add Canva/Google Slides link

---

# 👥 Team

| Name                | Role                                 |
| ------------------- | ------------------------------------ |
| Tirso Benedict Naza | Full-stack & Smart Contract Engineer |

(Add teammates)

---

# 📄 License

MIT

---

# Your Pitch Deck (THIS IS CRITICAL)

You only have ~10 slides max.

Do NOT overload with technical details.

The deck should feel like:

- startup pitch
- product narrative
- simple architecture
- working proof

---

# Ideal Pitch Deck Structure

## Slide 1 — Title

# Kredito

On-chain Microfinance Infrastructure for Filipinos

Include:

- logo
- Stellar logo
- “Deployed on Mainnet”

---

## Slide 2 — The Problem

Use REAL Filipino context.

Examples:

- 44%+ of Filipinos are underbanked
- Small vendors struggle accessing fair loans
- Credit history requirements exclude many users

Then:

> Financial access should not require traditional banking privilege.

---

## Slide 3 — The Solution

Show:

- wallet
- score
- borrow
- repay
- improve reputation

Very visual.

Minimal text.

---

## Slide 4 — How It Works

Simple architecture diagram:

User
↓
Frontend
↓
Backend
↓
Soroban Contracts
↓
Stellar Mainnet

Mention:

- low fees
- fast settlement
- transparency

---

## Slide 5 — Product Demo Screens

Show:

- dashboard
- loan flow
- wallet
- staking
- KYC

This is where your polished UI matters.

---

## Slide 6 — Smart Contract System

Very high level.

Mention:

- credit_registry
- lending_pool
- fee sponsorship
- secure Rust contracts

DO NOT deep dive into Rust internals.

---

## Slide 7 — Why Stellar

Directly align with hackathon themes.

Mention:

- fast finality
- low fees
- financial inclusion
- scalable payments

The hackathon itself emphasizes this.

---

## Slide 8 — Mainnet Deployment

This is a flex slide.

Show:

- Stellar Expert screenshots
- contract addresses
- live app
- real transactions

This proves legitimacy instantly.

---

## Slide 9 — Future Vision

Future roadmap:

- GCash integration
- alternative identity scoring
- merchant payments
- SEA expansion
- stablecoin lending

---

## Slide 10 — Closing

End with:

> “Kredito transforms blockchain from speculation into accessible financial infrastructure.”

Then:

- GitHub
- Live demo
- QR code

---

# Demo Video Strategy (Most Important Part)

Your demo should be:

- 2–3 minutes
- FAST
- no dead air
- no setup
- no coding

The hackathon explicitly requires a short demo video.

---

# PERFECT Demo Flow

## 0:00–0:15

Hook.

Say:

> “Millions of Filipinos cannot access fair financial services because they lack formal credit history. Kredito uses Stellar to create portable on-chain credit access.”

---

## 0:15–0:40

Show dashboard.

Quickly show:

- wallet connect
- credit score
- borrower tier
- balance

---

## 0:40–1:20

Borrow flow.

Show:

- select amount
- smart contract interaction
- confirmation
- transaction success

VERY IMPORTANT:
Keep the wallet pre-connected beforehand.

No waiting.

---

## 1:20–1:50

Repayment + staking.

Show:

- repayment flow
- staking
- deposit

Mention:

> “Users contributing liquidity help grow the lending pool.”

---

## 1:50–2:20

Mainnet proof.

Show:

- Stellar Expert
- contract address
- live transactions

This massively increases credibility.

---

## 2:20–2:40

Closing vision.

Say:

> “Kredito demonstrates how Stellar can power real financial inclusion for underserved communities.”

Done.

---

# Biggest Demo Mistakes To Avoid

DO NOT:

- explain too much code
- scroll through GitHub
- show terminal for too long
- wait for wallet setup
- improvise

Pre-stage everything.

Every tab ready beforehand.

---

# Your Strongest Selling Point

Not AI.
Not blockchain.

This:

> “We built a working on-chain financial access system deployed on Stellar Mainnet.”

That is the story.

Not “we used Soroban.”

---

# Final Submission Checklist

You already satisfy most hard requirements:

✅ Working MVP
✅ Mainnet deployment
✅ Frontend
✅ Smart contracts
✅ README structure
✅ Demo-ready architecture
✅ Financial inclusion angle
✅ Stellar integration
✅ Wallet flow

Now focus entirely on:

- presentation polish
- confidence
- storytelling
- smooth demo execution

That is what determines whether you place Top 15 or not.

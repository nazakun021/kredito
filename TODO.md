# TODO.md — Kredito

### SEA Stellar Hackathon · Track: Payments & Financial Access

### Version 2.0 | Last Updated: 2026-04-28

---

## Legend

```
[ ]  Not started
[~]  In progress
[x]  Done
🔴   Blocking — next phase cannot begin without this
🟡   Important — needed for demo day
🟢   Nice-to-have — polish only, do last
```

## Estimated Total Build Time: 44–52 hours

---

## Critical Path (Do Not Reorder)

```
Phase 0 (Setup) [x]
Phase 1 (Smart Contracts) [x]
Phase 2 (Backend) [x]
Phase 3 (Frontend) [x]
Phase 4 (Integration Testing) [x]
Phase 5 (Demo Prep) [x]
Phase 6 (Submission) [ ]
```

---

## Phase 0 — Environment Setup 🔴 [x]
## Phase 1 — Smart Contracts (Rust / Soroban) 🔴 [x]

---

## Phase 2 — Backend (Node.js) 🔴 [x]

### 2A. Core Infrastructure [x]
- [x] Create `backend/src/db.ts` — initialize SQLite with SPECv2 schema.
- [x] Create `backend/src/stellar/client.ts` — Horizon and Soroban RPC setup.
- [x] Create `backend/src/middleware/auth.ts` — JWT middleware.
- [x] Create `backend/src/utils/crypto.ts` — AES-256-GCM encryption.

### 2B. Auth Module [x]
- [x] Implement `POST /api/auth/login` with embedded wallet generation.

### 2C. Scoring Engine [x]
- [x] Implement two-layer scoring in `backend/src/scoring/engine.ts`.
- [x] Layer 1: Bootstrap signals (email, income, attestations).
- [x] Layer 2: On-chain history (account age, tx volume).

### 2D. SBT Issuer Service [x]
- [x] Implement `mintOrUpdateTier` in `backend/src/stellar/issuer.ts`.

### 2E. Fee-Bump Transaction Service [x]
- [x] Implement gasless transaction submission in `backend/src/stellar/feebump.ts`.

### 2F. Credit Score API Route [x]
- [x] Implement `GET /api/credit/score`.

### 2G. Loan API Routes [x]
- [x] Implement `POST /api/loan/borrow`.
- [x] Implement `POST /api/loan/repay`.
- [x] Implement `GET /api/loan/status`.

---

## Phase 3 — Frontend (Next.js 14) 🔴 [x]

### 3A. App Infrastructure [x]
- [x] Setup Zustand, TanStack Query, and Axios.

### 3B. Login Page [x]
- [x] Email-only login screen.

### 3C. Onboarding Flow (SPECv2) [x]
- [x] Implement Email OTP verification.
- [x] Implement Financial Profile step.
- [x] Implement Community Attestation step.
- [x] Implement Score Reveal & Gap Analysis.

### 3D. Dashboard Page [x]
- [x] Credit card component with score and tier.
- [x] Loan status and action buttons.
- [x] Wallet info with Stellar Expert link.

### 3E. Score Breakdown Page [x]
- [x] Detailed view of all scoring factors.

### 3F. Borrow & Repay Pages [x]
- [x] Borrow confirmation with fee disclosure.
- [x] Repayment processing screen.

---

## Phase 4 — Integration & End-to-End Testing 🔴 [x]

- [x] Backend E2E on Testnet.
- [x] Frontend E2E on mobile viewport.
- [x] Edge case handling (Horizon 404, RPC timeouts).

---

## Phase 5 — Demo Preparation 🔴 [x]
- [x] Scripts for 60-second demo.
- [x] Pre-seeded demo accounts and funded pool.

---

## Phase 6 — Documentation & Submission 🟡 [ ]
- [ ] Record demo video.
- [ ] Prepare pitch deck.
- [ ] Final SPEC review.

# SPEC.md — Kredito Production State

### SEA Stellar Hackathon · Track: Payments & Financial Access

### Version 4.0 | Last Updated: 2026-04-29

### This reflects what is currently live, not what was planned.

---

## 0. Production URLs

| Asset               | URL                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Live Demo**       | https://kredito-iota.vercel.app                                                                                            |
| **GitHub Repo**     | https://github.com/nazakun021/kredito                                                                                      |
| **Backend API**     | Railway (URL in `.env`)                                                                                                    |
| **Credit Registry** | https://stellar.expert/explorer/testnet/contract/CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ?filter=interface |
| **Lending Pool**    | https://stellar.expert/explorer/testnet/contract/CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH?filter=interface |
| **PHPC Token**      | https://stellar.expert/explorer/testnet/contract/CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR?filter=interface |

---

## 1. Deployed Contract IDs (Canonical)

```
credit_registry:  CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ
lending_pool:     CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH
phpc_token:       CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR
```

These must match exactly in `backend/.env` on Railway. These are the IDs shown on the
live README and in Stellar Expert screenshots. Any previous IDs from earlier deploy.sh runs
are superseded by these.

---

## 2. Product Definition

Kredito is a mobile-first Stellar demo for uncollateralized micro-lending. A user clicks
one button, gets an on-chain credit score derived from real wallet metrics, and borrows
PHP-denominated stablecoins from a liquidity pool — all in under 60 seconds, with zero
gas fees and no crypto onboarding friction.

**Core promise:**

> Anyone can get a credit score and a loan in seconds, fully verified on-chain.

**Hackathon track:** Payments & Financial Access

---

## 3. The Four-Screen Demo Flow

Everything that matters happens in this loop. Judges should be able to complete it in
under 60 seconds from a fresh incognito tab.

```
[/]               [/dashboard]           [/loan/borrow]     [/loan/repay]
Landing      →    Credit Passport    →    Confirm Loan   →   Repay & Upgrade
─────────────     ─────────────────       ─────────────      ────────────────
Generate Score    Score + Metrics         Amount + Fee        Repay button
button click      Formula display         Confirm button      Score refreshes
                  Tier + Limit            Tx hash             Tier may upgrade
                  Pool balance            Explorer link       New limit shown
                  Borrow CTA
```

---

## 4. Scoring Model (Live in `credit_registry`)

```
score = (tx_count × 2) + (repayment_count × 10) + (avg_balance_factor × 5) - (default_count × 25)

avg_balance_factor = min(floor(avg_balance / 100), 10)
```

**Tier mapping (canonical):**
| Tier | Score | Borrow Limit | Fee Rate |
|---|---|---|---|
| Unrated | 0–39 | No access | — |
| Bronze | 40–79 | ₱5,000 | 5.00% |
| Silver | 80–119 | ₱20,000 | 3.00% |
| Gold | 120+ | ₱50,000 | 1.00% |

**Formula verification (demo card shows score=84, Silver, tx=12, repayments=2):**

```
avg_balance_factor must = 8 for score to equal 84:
(12 × 2) + (2 × 10) + (8 × 5) - 0 = 24 + 20 + 40 = 84 ✓
→ avg_balance must be 800–899 units for the demo wallet
```

This must be confirmed against what the live contract actually returns. If the demo
preview card is hardcoded to 84, that's fine for the landing page. But the dashboard
must show the real contract-computed score.

---

## 5. Smart Contract Architecture

### `credit_registry` — The Credit Passport

Stores per-wallet `Metrics` struct and exposes deterministic scoring.

**Key functions:**
| Function | Caller | What it does |
|---|---|---|
| `initialize` | Deployer | Sets issuer, tier limits, fee rates |
| `update_metrics` | Issuer only | Submits `{ tx_count, repayment_count, avg_balance, default_count }` |
| `update_metrics_raw` | Issuer only | Updates individual metric fields |
| `update_score` | Anyone | Recomputes score from stored metrics using the formula |
| `compute_score` | Anyone (read) | Returns what the score would be without writing |
| `get_metrics` | Anyone | Returns the full `Metrics` struct for a wallet |
| `get_score` | Anyone | Returns current stored score |
| `get_tier` | Anyone | Returns current tier (0=Unrated, 1=Bronze, 2=Silver, 3=Gold) |
| `get_tier_limit` | Anyone | Returns max borrow amount in stroops for a tier |
| `set_tier` | Issuer only | Manual tier override (for admin correction) |
| `revoke_tier` | Issuer only | Resets tier to 0 (used on default) |

**Non-transferable:** The Credit Passport is bound to the wallet address. There is no
transfer function. The passport cannot be sold or assigned to another wallet.

---

### `lending_pool` — The Vault

Holds PHPC liquidity and enforces tier-gated borrowing.

**Key functions:**
| Function | Caller | What it does |
|---|---|---|
| `initialize` | Deployer | Sets admin, registry ID, PHPC token ID, fee config, loan term |
| `deposit` | Admin | Funds the pool with PHPC |
| `borrow` | Borrower | Cross-calls registry, checks tier, disburses PHPC |
| `repay` | Borrower | Pulls principal + fee from borrower via `transfer_from` |
| `mark_default` | Anyone | Marks overdue unpaid loans as defaulted |
| `get_loan` | Anyone | Returns `Option<LoanRecord>` for a wallet |
| `get_pool_balance` | Anyone | Returns current PHPC balance of pool |

**Borrow gate (ordered checks):**

1. No active unreturned loan for this wallet
2. Wallet tier >= 1 (Bronze or above)
3. Amount <= tier limit
4. Amount <= pool balance

**Tier-sensitive fees:**

- Bronze: base pool fee rate (5%)
- Silver: reduced fee rate (3%)
- Gold: lowest fee rate (1%)

---

### `phpc_token` — The Currency

SEP-41 compliant stablecoin. 1 PHPC = 1 PHP (testnet peg).

**Standard SEP-41 interface** — compatible with any Stellar-aware wallet or DEX.
`transfer()` and `transfer_from()` are fully functional (unlike the registry's non-transferable passport).

---

## 6. Backend API (Express, deployed on Railway)

### Auth

**`POST /api/auth/demo`**
Creates a demo session. Silent wallet creation. Non-blocking Friendbot prefund.

```
Response: { token, wallet, isNew: true }
```

This endpoint must respond in < 500ms. Friendbot is fire-and-forget.

**`POST /api/auth/login`** (Freighter path)

```
Request:  { stellarAddress: "G..." }
Response: { token, wallet, isExternal: true }
```

---

### Credit

**`POST /api/credit/generate`** _(auth required)_
Aggregates Horizon metrics, submits to `credit_registry`, returns full score state.

```
Steps:
  1. Query Horizon /accounts/{wallet}/transactions → tx_count
  2. Query Horizon /accounts/{wallet} → native XLM balance → avg_balance
  3. Query lending_pool events for loan_repaid → repayment_count
  4. Query lending_pool events for loan_defaulted → default_count
  5. Fee-bump: credit_registry::update_metrics(wallet, metrics)
  6. Fee-bump: credit_registry::update_score(wallet)
  7. Read back: get_score, get_tier, get_tier_limit, get_metrics
  8. Return full score response

Response: {
  score, tier, tierLabel, borrowLimit, feeRate,
  progressToNext, nextTier,
  metrics: { txCount, repaymentCount, avgBalance, avgBalanceFactor, defaultCount },
  formula: { txComponent, repaymentComponent, balanceComponent, defaultPenalty, total },
  walletAddress
}
```

**`GET /api/credit/score`** _(auth required)_
Read-only score from contract. No re-computation.

**`GET /api/credit/pool`** _(auth required)_

```
Response: { poolBalance: "95000.00", poolBalanceRaw: "950000000000000" }
```

---

### Loans

**`POST /api/loan/borrow`** _(auth required)_

```
Request:  { amount: number }   ← in PHPC units
Steps:
  1. Validate: no active loan, tier >= 1, amount <= limit, pool has liquidity
  2. Convert to stroops, decrypt keypair, build inner tx
  3. Fee-bump wrap, submit, poll (30s timeout)
  4. Return tx hash, amounts, due date, explorer URL
```

**`POST /api/loan/repay`** _(auth required)_

```
Steps:
  1. Fetch loan state from contract
  2. Fee-bump: phpc_token::approve(pool, total_owed)
  3. Fee-bump: lending_pool::repay(wallet)
  4. Immediately trigger generate to refresh score
  5. Return tx hash, newScore, previousScore, newTier
```

**`GET /api/loan/status`** _(auth required)_

```
Response: {
  hasActiveLoan: bool,
  loan: { principal, fee, totalOwed, dueDate, daysRemaining, status } | null
}
```

---

## 7. Fee-Bump Architecture

Every user contract call is fee-bumped by the issuer. Users pay ₱0 in gas.

```
For embedded wallet (default path):
  1. Decrypt user secret (AES-256-GCM from SQLite)
  2. Build inner tx: source = user keypair, op = invokeHostFunction
  3. Sign inner tx with user secret
  4. Wrap in FeeBumpTransaction: feeSource = issuer keypair
  5. Sign fee-bump with issuer secret
  6. Submit to Soroban RPC → sendTransaction
  7. Poll getTransaction (1s interval, 30s timeout)
  8. Zeroize decrypted key from memory immediately after signing

For Freighter wallet:
  1. Build unsigned inner tx XDR
  2. Return to frontend with { requiresSignature: true, unsignedXdr }
  3. Frontend calls freighter.signTransaction(xdr, { network: "TESTNET" })
  4. Frontend POSTs signed XDR to POST /api/tx/sign-and-submit
  5. Backend wraps in fee-bump, submits
```

---

## 8. Frontend Architecture (Next.js 14, deployed on Vercel)

### Stack

- Next.js 14 App Router
- Zustand (auth session — JWT + wallet address + isExternal flag)
- TanStack Query v5 (score, pool, loan status)
- Tailwind CSS (dark theme, confirmed from screenshots)
- Lucide React (icons)
- `@stellar/freighter-api` (installed, "Get Freighter" fallback confirmed working)

### Routes

| Route          | Purpose                            | Auth Required         |
| -------------- | ---------------------------------- | --------------------- |
| `/`            | Landing page, CTAs                 | No                    |
| `/dashboard`   | Credit Passport, score, borrow CTA | Yes → redirect to `/` |
| `/loan/borrow` | Borrow confirmation                | Yes + no active loan  |
| `/loan/repay`  | Repay confirmation                 | Yes + active loan     |
| `/login`       | Legacy redirect                    | → `/`                 |
| `/onboarding`  | Legacy redirect                    | → `/`                 |
| `/score`       | Legacy redirect                    | → `/dashboard`        |

### TanStack Query Keys

```
["score"]     → GET /api/credit/score     staleTime: 30s
["pool"]      → GET /api/credit/pool      staleTime: 10s
["loan"]      → GET /api/loan/status      staleTime: 10s
```

After repay mutation: invalidate `["score"]` and `["loan"]` immediately.

### Zustand Auth Store

```
{ token, wallet, isExternal, freighterConnected }
setAuth(token, wallet, isExternal)
clearAuth()
```

Persisted to localStorage. Survives page refresh (important for demo continuity).

---

## 9. Demo Prefunding Strategy

Demo wallets need account activation (minimum 1 XLM reserve) before fee-bumps work.

```
1. Friendbot (primary, async):
   GET https://friendbot.stellar.org?addr={wallet}
   → Fire immediately on wallet creation, do not await, do not block response

2. Issuer transfer (fallback):
   → If inner tx build fails with "account not found":
   → Send 2 XLM from issuer to demo wallet
   → Retry the original operation

3. Graceful degradation:
   → If both fail: surface "Wallet activating — retry in 10 seconds"
   → Show retry button
   → Do not show a generic error
```

---

## 10. Error Handling — User-Facing Messages

| Contract / Network Error     | User-Facing Message                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| No qualifying tier           | "Your score isn't high enough to borrow yet. Keep transacting to improve it."                          |
| Active loan exists           | "You already have an active loan. Repay it first."                                                     |
| Amount exceeds tier limit    | "This amount exceeds your current credit limit."                                                       |
| Insufficient pool liquidity  | "The pool is temporarily low. Try a smaller amount."                                                   |
| Account not found on Stellar | "Your wallet is being activated. Please retry in a few seconds."                                       |
| Soroban RPC timeout (30s)    | "The network is taking longer than usual. Check Stellar Expert — your transaction may have processed." |
| Freighter not installed      | _(Already handled — shows "Get Freighter" link, no error state)_                                       |
| Freighter rejected           | "Connection declined. You can still use the demo."                                                     |
| Any 401                      | Clear session, redirect to `/`, no error message shown                                                 |

---

## 11. Environment Variables

### Backend (`backend/.env` on Railway)

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<random 64+ chars>
ENCRYPTION_KEY=<64 hex chars = 32 bytes>
ISSUER_SECRET_KEY=S...
PHPC_ID=CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR
REGISTRY_ID=CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ
LENDING_POOL_ID=CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
CORS_ORIGIN=https://kredito-iota.vercel.app,http://localhost:3000
```

### Frontend (`frontend/.env.local` on Vercel)

```env
NEXT_PUBLIC_API_URL=https://<railway-backend-url>
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_EXPLORER_URL=https://stellar.expert/explorer/testnet
```

---

## 12. What Was Removed From Earlier Specs (Not Part of Current Product)

These ideas were explored and deliberately cut in favor of a faster, cleaner demo:

| Removed Feature                    | Why Removed                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Email OTP verification             | Added friction to the demo — contradicts "zero onboarding" promise                         |
| Multi-step bootstrap assessment    | Too slow for 60-second demo; off-chain scoring contradicts on-chain transparency narrative |
| Income / attestation-based scoring | Replaced by deterministic on-chain metric scoring                                          |
| BOOTSTRAP_SPEC.md                  | Historical — not the current system                                                        |
| Two-layer score model              | Replaced by single deterministic formula in the contract                                   |
| Semaphore SMS OTP                  | Not needed once bootstrap flow was removed                                                 |

The current product scores based purely on on-chain wallet activity. This is cleaner,
more honest, and more compelling for judges: "Every metric is on-chain. Anyone can
recompute the score from the same inputs and get the same number."

---

## 13. Hackathon Judging Alignment

| Criterion                         | How Kredito Addresses It                                        | Confidence                       |
| --------------------------------- | --------------------------------------------------------------- | -------------------------------- |
| User-facing financial application | 4-screen flow, email-less, mobile-first, zero jargon            | High ✅                          |
| Real utility, not a prototype     | Full borrow + repay lifecycle, on-chain state, default handling | High ✅                          |
| Local economy integration         | PHPC (PHP stablecoin), Filipino unbanked narrative              | Medium ⚠️ (PHPC is testnet mock) |
| Stellar-specific features         | Soroban cross-contract, SEP-41, fee-bump, Horizon API           | High ✅                          |
| Composability                     | credit_registry is a standalone reusable primitive              | High ✅                          |
| Technical depth                   | 3 contracts, deterministic scoring, cross-contract calls        | High ✅                          |
| Demo quality                      | 60s flow, real tx hashes, Stellar Expert verification           | High ✅ (if backend works)       |

**One sentence for judges on the PHPC mock:**

> "PHPC mirrors the interface of any SEP-24 PHP anchor. On mainnet, replacing PHPC with
> a Tempo or PDAX anchor requires changing one contract address — no code changes."

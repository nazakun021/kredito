# Kredito Demo Guide

This document is a practical runbook for demonstrating Kredito end to end.

It is written for the current product behavior in this repository:

- `Freighter` wallet login
- on-chain credit score generation
- dashboard review
- borrowing from the lending pool
- repaying from the same connected wallet
- score improvement after repayment

It also includes the current operational caveat:

- repayment requires the wallet to hold `principal + fee`
- the borrowed amount alone is not enough to repay

## 1. Demo Goal

Show a complete user journey in the Kredito dashboard:

1. User connects a real Freighter wallet.
2. Kredito authenticates the wallet with a signed challenge.
3. Kredito generates an on-chain credit score.
4. The user sees their Credit Passport, tier, and borrow limit.
5. The user borrows PHPC into the same connected wallet.
6. The user repays from that same wallet.
7. The score refresh reflects the repayment.

## 2. Product Story

Use this framing during the demo:

`Kredito turns a wallet into a portable on-chain credit identity. Instead of relying on a bank credit file, the user connects Freighter, Kredito evaluates their Stellar activity, stores a score and tier on-chain, and uses that tier to unlock a micro-loan from a PHPC liquidity pool. Repayment also happens on-chain from the same wallet, and timely repayment improves the user’s next score refresh.`

## 3. Architecture Summary

Kredito has three parts working together:

- `Frontend`: Next.js dashboard and flow UI
- `Backend`: Express API for auth, score generation, sponsored transactions, and orchestration
- `Contracts`: Soroban `credit_registry`, `lending_pool`, and `phpc_token`

Current deployed testnet contracts:

- `credit_registry`: `CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ`
- `lending_pool`: `CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH`
- `phpc_token`: `CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR`

Explorer links:

- Credit Registry: https://stellar.expert/explorer/testnet/contract/CDP3FEVG46ZUH73VZLDFQWHZHEIHITM3FVG26ZR4I3RY34HSWVNWHVPZ?filter=interface
- Lending Pool: https://stellar.expert/explorer/testnet/contract/CDRE2MZVSHOWEITL7UBBTNIHRH6IC5USDKY5K5AFELPJZ7VMEV5LQVWH?filter=interface
- PHPC Token: https://stellar.expert/explorer/testnet/contract/CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR?filter=interface

## 4. Demo Prerequisites

### Local services

Start the backend:

```bash
cd backend
pnpm dev
```

Start the frontend:

```bash
cd frontend
pnpm dev
```

Open:

- frontend: `http://localhost:3000`
- backend health: `http://localhost:3001/health`

### Wallet setup

Prepare a Freighter wallet on `Testnet`.

The wallet should have:

- enough `XLM` to exist cleanly on testnet
- enough on-chain activity to generate a usable score
- enough `PHPC` for repayment if you want a full borrow+repay demo

### Important repayment note

If the user borrows `500 PHPC` and the fee is `5%`, the total due is `525 PHPC`.

That means:

- the loan sends `500 PHPC` to the wallet
- repayment tries to pull `525 PHPC` from the wallet
- the user must add the extra `25 PHPC` before repayment

Without that extra PHPC, repayment fails with `InsufficientBalance` in the token contract.

## 5. Recommended Demo Wallet State

For the smoothest live demo, prepare a wallet with:

- an existing `Bronze`, `Silver`, or `Gold`-qualifying score
- no active loan at the start
- enough PHPC to cover any intended repayment fee

Two good demo options:

### Option A: Borrow-only demo

Use a wallet with no active loan and no extra PHPC.  
Show connect, score, borrow, and the repayment warning as a product truth.

### Option B: Full borrow-and-repay demo

Use a wallet with no active loan and mint extra PHPC ahead of time so repayment succeeds.

For example:

- borrow: `500 PHPC`
- fee: `25 PHPC`
- top-up needed: at least `25 PHPC`

## 6. If You Need More PHPC

Only the issuer/admin can mint `PHPC`.

Mint to a wallet with:

```bash
stellar contract invoke \
  --id CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR \
  --source issuer \
  --network testnet -- \
  mint \
  --to <WALLET_ADDRESS> \
  --amount <AMOUNT_IN_7_DECIMALS>
```

Examples:

- `25 PHPC` = `250000000`
- `100 PHPC` = `1000000000`
- `1000 PHPC` = `10000000000`

Check balance:

```bash
stellar contract invoke \
  --id CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR \
  --source issuer \
  --network testnet -- \
  balance \
  --id <WALLET_ADDRESS>
```

## 7. Demo Flow Overview

The dashboard flow is:

1. Landing page
2. Connect Freighter
3. Redirect to dashboard
4. Auto-generate score
5. Review Credit Passport
6. Borrow flow
7. Repay flow
8. Score refresh and upgraded standing

## 8. Detailed E2E User Flow

### Step 1: Landing Page

Open `http://localhost:3000`.

What to say:

`The user starts with just a wallet. There is no separate username and password. Kredito treats the wallet as the identity and signs the user in with a wallet challenge.`

What to show:

- `Connect Freighter Wallet` CTA
- `Testnet` badge
- hero copy about on-chain credit

### Step 2: Connect Freighter Wallet

Click `Connect Freighter Wallet`.

The app will:

- connect to Freighter
- verify the wallet is on `TESTNET`
- request a backend auth challenge
- ask Freighter to sign the challenge
- exchange the signed challenge for a JWT session

What to say:

`Authentication is wallet-native. The private key never leaves the wallet. The backend only accepts a valid signed challenge.`

### Step 3: Enter Dashboard

After login, the app redirects to `/dashboard`.

On first load, the dashboard triggers score generation.

Backend flow:

- fetch transaction count from Stellar
- fetch average wallet balance
- fetch repayment/default signals
- compute score off-chain
- write updated metrics and score on-chain to `credit_registry`

What to show:

- score number
- tier badge
- borrow limit
- fee rate
- transactions
- repayments
- progress to next tier

What to say:

`This dashboard is not just cosmetic. The score and tier being displayed are reflected on-chain, and the borrow limit comes from those results.`

### Step 4: Explain the Credit Passport

Pause on the dashboard.

Talk through:

- `Score`
- `Tier`
- `Borrow limit`
- `Fee rate`
- `Score formula`
- `Progress to next tier`

Current formula:

```text
score = (tx_count × 2) + (repayment_count × 10) + (avg_balance_factor × 5) - (default_count × 25)
```

Tier thresholds:

- `Bronze`: score `>= 40`
- `Silver`: score `>= 80`
- `Gold`: score `>= 120`

What to say:

`Kredito makes the credit model legible. The user can see exactly what drives the score and what they need to improve.`

### Step 5: Borrow Flow

Click `Borrow`.

On `/loan/borrow`, the user sees:

- approved amount
- current tier
- fee rate
- repayment amount
- 30-day term

The user confirms the loan in Freighter.

Backend and contract flow:

1. frontend calls `POST /api/loan/borrow`
2. backend checks current tier and no active loan
3. backend builds unsigned borrow transaction
4. Freighter signs it
5. backend sponsors and submits it
6. `lending_pool.borrow()` disburses PHPC into the connected wallet

What to say:

`The loan is sent to the actual connected wallet. The wallet is not just used for login; it is the source of truth for the user’s credit state and the destination for loan funds.`

What to show after success:

- borrow success screen
- tx hash
- Stellar Expert link

### Step 6: Verify the Wallet Now Holds the Loan

This is an important demo moment.

Say explicitly:

`The borrowed PHPC now sits in the same wallet that connected to the app. The user’s wallet is the place where funds arrive and from which repayment will later be pulled.`

Ways to validate:

- open the Stellar Expert transaction link
- inspect the wallet balance in your tools
- return to the dashboard and show active loan state

### Step 7: Dashboard Reflects Active Loan

Back on the dashboard:

- `loan-status` switches to active
- the call-to-action changes from borrow to repay
- the dashboard shows outstanding amount

What to say:

`The UI now recognizes the active obligation and prevents a second borrow while the loan is still outstanding.`

### Step 8: Repay Flow

Open `/loan/repay`.

The page shows:

- principal
- fee owed
- total due
- wallet PHPC balance
- shortfall if underfunded
- due date
- days remaining

Current real behavior:

- if wallet PHPC is less than total due, repayment is blocked logically even if the user tries
- the backend now returns a precise error telling the user how much more PHPC is needed

What to say:

`Repayment is also wallet-native. The contract does not pull from an internal app balance. It pulls from the connected wallet itself.`

### Step 9: Explain the Repayment Approval

Repayment for external wallets is a two-step contract interaction:

1. approve PHPC spending
2. execute repay

The frontend now handles this sequence automatically for Freighter users.

What to say:

`This is a real token spend flow, not a fake button state. The wallet first authorizes the pool to spend the repayment amount, then the pool settles the loan.`

### Step 10: If Repayment Fails

The most common reason is insufficient PHPC balance.

Typical case:

- borrowed amount: `500 PHPC`
- fee: `25 PHPC`
- total due: `525 PHPC`

If the wallet only has the borrowed `500 PHPC`, it still needs `25 PHPC` more.

Current UI behavior:

- shows wallet PHPC balance
- shows `Still needed`
- explains that the fee is not auto-funded

What to say:

`This is actually a good product truth to show: the wallet received the principal, but repayment requires principal plus fee. The app now makes that explicit instead of failing with a raw contract error.`

### Step 11: Complete Repayment

Once the wallet has enough `PHPC`, click `Repay`.

Backend and contract flow:

1. backend validates wallet balance
2. frontend signs approve in Freighter
3. backend sponsors and submits approve
4. frontend requests repay
5. frontend signs repay in Freighter
6. backend sponsors and submits repay
7. backend refreshes on-chain metrics and score
8. dashboard reflects the new score

What to show:

- success screen
- updated score
- updated tier
- new borrow limit
- transaction explorer link

### Step 12: Show Score Improvement

This is the conclusion of the demo.

What to say:

`The user’s repayment feeds back into the credit model. This closes the loop: connect wallet, borrow, repay, improve score, unlock better borrowing power.`

## 9. Suggested Presenter Script

Use this condensed script live:

1. `Kredito starts with a wallet, not an account form.`
2. `I connect Freighter and sign a challenge to authenticate.`
3. `Kredito reads wallet activity, computes a score, and writes the result on-chain.`
4. `The dashboard shows my Credit Passport, tier, and borrow limit.`
5. `I borrow PHPC directly into the same connected wallet.`
6. `The dashboard now treats me as an active borrower.`
7. `Repayment is pulled from the real wallet, so the wallet must hold principal plus fee.`
8. `After repayment, the score refreshes and my on-chain credit profile improves.`

## 10. Live Demo Checklist

Before demo:

- backend starts cleanly
- frontend loads cleanly
- Freighter is installed
- Freighter is on `TESTNET`
- wallet has enough XLM
- contracts are reachable
- wallet has required PHPC for repayment if doing full E2E

During demo:

- connect wallet
- wait for score generation
- show dashboard metrics
- show borrow confirmation
- show active loan state
- show repay screen
- show wallet PHPC balance and shortfall if relevant
- complete repay or explain shortfall with mint top-up
- show final updated score

After demo:

- open Stellar Expert transaction
- show contract IDs if asked
- show on-chain score update if needed

## 11. Operational Caveats

### Repayment fee trap

This is the most important known behavior:

- borrowed principal arrives in wallet
- fee does not arrive automatically
- user must hold enough extra PHPC to cover fee

### RPC `TRY_AGAIN_LATER`

Sometimes Soroban RPC may return temporary congestion or retry responses during score refresh.  
This is an infrastructure issue, not a business-logic issue.

If that happens:

- wait a few seconds
- refresh score again

### Contract redeploy drift

If contracts are redeployed but the local DB still reflects older activity:

```bash
sqlite3 backend/kredito.db "DELETE FROM active_loans; DELETE FROM score_events;"
```

## 12. Command Snippets

### Start backend

```bash
cd backend
pnpm dev
```

### Start frontend

```bash
cd frontend
pnpm dev
```

### Mint PHPC

```bash
stellar contract invoke \
  --id CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR \
  --source issuer \
  --network testnet -- \
  mint \
  --to <WALLET_ADDRESS> \
  --amount <AMOUNT_IN_7_DECIMALS>
```

### Check PHPC balance

```bash
stellar contract invoke \
  --id CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR \
  --source issuer \
  --network testnet -- \
  balance \
  --id <WALLET_ADDRESS>
```

## 13. What the Demo Proves

If the demo completes successfully, it proves:

- wallet-native authentication works
- frontend, backend, and contracts are integrated
- scoring is reflected on-chain
- tier-based borrow gating works
- loan funds are disbursed into the actual user wallet
- repayment is pulled from the actual user wallet
- successful repayment feeds back into the credit profile

That is the full Kredito loop.

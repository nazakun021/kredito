# Kredito — System Architecture & Design Document

This document provides a detailed overview of the system architecture, design decisions, smart contract integrations, and security models of the Kredito microfinance platform.

---

## 1. Architectural Overview

Kredito is designed with a **fully stateless backend, non-custodial wallet management, and blockchain-native truth**. The Stellar blockchain serves as the single, immutable database for all financial states, user scores, and contract parameters.

```
+-------------------------------------------------------------------------------+
|                             User Browser Client                               |
|              (Freighter Wallet / Next.js 15 / React 19 / Zustand)             |
+--------------------------------──────┬────────────────────────────────────────+
                                       │ Secure HTTPS API (JWT)
                                       ▼
+-------------------------------------------------------------------------------+
|                      Stateless Express.js Backend API                         |
|     (SEP-10 challenge verification, Dynamic off-chain scoring assembly,       |
|      Inner XDR builder, Sponsored fee-bump signer, Overdue sweeper workers)   |
+----------------───────┬──────────────┼────────────────────────┬───────────────+
                        │              │                        │
             Horizon REST API     Soroban RPC              Stellar Network
             (tx metrics scan)    (contract queries)       (tx submission)
                        │              │                        │
                        ▼              ▼                        ▼
+-------------------------------------------------------------------------------+
|                           Soroban Smart Contracts                             |
|  +---------------------------+        +------------------------------------+  |
|  |      credit_registry      |        |            lending_pool            |  |
|  | - Metrics persistence     |<-------| - Borrow & Repay controller        |  |
|  | - Multi-tier classification|        | - MasterChef LP staking controller |  |
|  | - Expiry sequences        |        | - Fixed-term savings controller    |  |
|  +---------------------------+        +-----------------┬------------------+  |
|                                                         │                     |
|                                                         ▼                     |
|                                       +------------------------------------+  |
|                                       |           Native XLM SAC           |  |
|                                       |     (Stellar Asset Contract)       |  |
|                                       +------------------------------------+  |
+-------------------------------------------------------------------------------+
```

---

## 2. Smart Contract Abstractions

The core financial and identity logic is separated into two secure Soroban contracts:

### 2.1 Credit Registry (`credit_registry`)

- **Portable Identity**: Stores borrower metrics and computes scores dynamically.
- **Fail-Safe Expiry**: Tiers have a strict block-ttl limit (≈365 days). If a user does not refresh their score within this window, their tier reverts to 0. This prevents outdated transaction histories from being used for active loans.
- **Soulbound Nature**: The contract is completely non-transferable. Any execution of `transfer` or `transfer_from` will explicitly panic, ensuring reputational scores are forever bound to the creating public address.

### 2.2 Lending Pool (`lending_pool`)

- **Atomic Disbursements**: Uses inter-contract calls to query `credit_registry::get_active_tier_and_limit` and execute `xlm_token::transfer` in a single transactional step. If the borrower is ineligible or requests more than their tier allows, the entire transaction reverts.
- **KYC Enforcements**: Silver, Gold, and Platinum tiers (Tiers 2-4) require a validated KYC flag in the `credit_registry` before borrowing is permitted, while Bronze (Tier 1) remains accessible to unbanked first-time borrowers.

---

## 3. Advanced Financial Algorithms

### 3.1 MasterChef Staking Rewards Model

To incentivize decentralized liquidity providers (LPs), Kredito implements a reward-per-share algorithm based on the classic MasterChef pool design:

- When borrowers repay loans, 50% of the loan interest fees are set aside as LP staker rewards, and the other 50% remains in the pool as organic lending liquidity.
- Whenever a staker joins, unstakes, or queries their position, the contract updates their reward accumulation:
  $$\text{acc\_reward\_per\_share} \mathrel{+}= \frac{\text{staker\_fee} \times \text{REWARD\_SCALE}}{\text{total\_staked}}$$
  $$\text{pending\_rewards}[\text{staker}] = \frac{\text{staker\_balance} \times \text{acc\_reward\_per\_share}}{\text{REWARD\_SCALE}} - \text{reward\_debt}[\text{staker}]$$
- `REWARD_SCALE` is set to $10,000,000$ ($10^7$) to completely eliminate floating-point precision loss in integer-based Soroban assembly.

### 3.2 Pre-Allocated Time Deposit Savings

Locked Time Deposits allow savers to deposit XLM for guaranteed interest returns (5% APY for 30 days, 8% APY for 60 days):

- **Liquidity Lockup**: Upon creation, the contract computes the projected interest at maturity and immediately deducts it from the pool's free balance, moving it to `ReservedInterest`. This guarantees that maturity payouts are always fully funded and cannot be lent out to borrowers.
- **Early Withdrawal Penalty**: To discourage premature liquidity drains, early withdrawals forfeit all accrued interest and incur a strict 1% penalty on the principal, which is returned to the pool balance.

---

## 4. Backend Design & Statelessness

### 4.1 Chain as the Single Source of Truth

The Express API acts as a stateless gateway orchestrator. It does not utilize any database caches or local sessions for business logic. Every API request dynamically queries Stellar RPC nodes or Horizon REST endpoints:

- In-memory cache structures have been removed. This eliminates replication bugs and ensures instant consistency when scaling backend instances horizontally (e.g., across Railway clusters).

### 4.2 Dynamic Sweeper & Default Detection

The `/admin/check-defaults` route is a cron-triggered administrative sweep:

- Rather than maintaining an off-chain database list of active borrowers, the backend dynamically scans contract events emitted by the `lending_pool` over history to discover all wallets that have ever borrowed.
- The discovered addresses are processed through a concurrency-limited worker pool (`p-limit`) that queries `lending_pool::get_loan` for each borrower.
- If a loan term is past the current ledger sequence and `repaid == false`, the sweeper signs and submits a `mark_default` transaction on-chain.
- **Scalability Constraint**: The event scanning discovery is capped at 500 historical borrowers per sweep. In a large-scale production setup, this would be delegated to a dedicated indexed data layer (e.g., a subgraph or event-store indexer).

---

## 5. Security & Transaction Models

### 5.1 Gasless User Experience (Sponsored Fee-Bumps)

To make Kredito viable for non-technical users without XLM balances, the backend supports transaction fee sponsorship:

1. The frontend initiates a request to the backend to build a specific action (e.g., `borrow` or `repay`).
2. The backend builds the unsigned transaction, simulates it on-chain to determine fee footprints, and returns the XDR.
3. The user signs the inner transaction using Freighter.
4. The signed inner XDR is sent back to `/tx/sign-and-submit`. The backend wraps the transaction inside a **sponsored fee-bump envelope** (`TransactionBuilder.buildFeeBumpTransaction`), signs it with the `ISSUER_SECRET_KEY`, and submits it to the Stellar network.
5. The sponsoring issuer account pays the network fee, while the user only pays the principal/fee specified inside the inner transaction.

### 5.2 Strict CORS Allowlist & CSRF Protection

- **CORS Allowlist**: Driven by the `CORS_ORIGINS` environment variable, ensuring that the backend only communicates with recognized frontend origins (never wildcarded `*` in production).
- **CSRF Mitigation**: In addition to JWT bearer tokens in the HTTP authorization headers, all state-mutating routes (`POST`, `PUT`, `DELETE`) require a custom header: `X-Requested-With: XMLHttpRequest`. Because standard browser forms or script-injected cross-site requests cannot set custom headers without prior pre-flight options, this effectively blocks cross-site request forgery attacks.

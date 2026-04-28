# SPEC.md — Kredito [IMPLEMENTED]

### SEA Stellar Hackathon · Track: Payments & Financial Access

### Version 2.0 | Last Updated: 2026-04-28

---

## 0. Brutal Self-Score vs. Stellar Hackathon Criteria

> Scored before build. Use this as your north star throughout development.

| Criterion                                    | Weight | Raw Score | Weighted | Notes                                                                                               |
| -------------------------------------------- | ------ | --------- | -------- | --------------------------------------------------------------------------------------------------- |
| **User-facing financial application**        | 20%    | 9/10      | 1.80     | Full borrow/repay lifecycle, email login, zero crypto friction                                      |
| **Real utility, not just a prototype**       | 20%    | 7/10      | 1.40     | Repayment + default logic = real protocol; testnet-only loses pts                                   |
| **Local economy integration**                | 15%    | 6/10      | 0.90     | PHPC mirrors PHP anchor structure but is mocked — state the mainnet upgrade path explicitly in demo |
| **Stellar-specific features used correctly** | 15%    | 9/10      | 1.35     | Soroban cross-contract, SEP-41, fee-bump, event emission — all validated                            |
| **Composability**                            | 10%    | 8/10      | 0.80     | Registry SBT contract is a standalone reusable primitive any protocol can query                     |
| **Technical depth & correctness**            | 10%    | 8/10      | 0.80     | 3 Soroban contracts, on-chain scoring, correct soroban-sdk 22.0.0 patterns                          |
| **Demo quality & clarity**                   | 10%    | 9/10      | 0.90     | 60-second scripted flow, all states pre-seeded                                                      |

### **Final Weighted Score: 8.0 / 10**

**What lifts this above 8.5:** In your demo pitch, explicitly name Tempo or PDAX as the mainnet PHP anchor replacement for PHPC. One sentence. It signals ecosystem awareness and a real product path. Without it, judges treat PHPC as fictional and dock the local-economy score.

---

## 1. Project Overview

**Kredito** is an uncollateralized micro-lending protocol on Stellar's Soroban smart contract platform. It targets unbanked and underbanked users across Southeast Asia — specifically the Philippines — who have no formal credit history with traditional banks.

Kredito solves this by reading a user's real on-chain Stellar wallet history via the Horizon API, computing a transparent credit score from three objective factors, and minting a non-transferable Soulbound Token (SBT) representing their credit tier. A Soroban lending pool contract checks that SBT before disbursing a PHP-denominated stablecoin loan. Repayment is enforced on-chain with a flat fee. On-time repayment can upgrade the borrower's tier over time. The entire experience is presented through a Web2-style mobile-first frontend — no wallet extension, no seed phrases, no blockchain knowledge required.

### One-Sentence Pitch

> _Kredito gives unbanked Filipinos their first credit line by turning their Stellar transaction history into a non-transferable on-chain credit score, then disbursing PHP stablecoin loans instantly through a FinTech-style mobile app._

### Problem Statement

A sari-sari store owner in Quezon City needs ₱5,000 for restocking. She has no credit card, no formal bank account, and no credit bureau score. She pays 20% weekly interest to a loan shark. Her real financial activity — remittances, transfers, payments — happens on-chain but no lender reads it. She exists on Stellar but no protocol gives her credit for it.

### Why Stellar Specifically

- **Soroban smart contracts** enforce lending rules on-chain with no counterparty risk
- **Fee-bump transactions** let the backend absorb all gas costs so the borrower pays nothing upfront
- **5-second finality at sub-cent fees** makes micro-loans economically viable at the ₱5,000 scale
- **SEP-41 token standard** ensures PHPC is composable with any Stellar wallet or DEX from day one
- **Horizon API** provides free, permissionless read access to all wallet history — the raw material for the credit score

---

## 2. Hackathon Track Alignment

**Track: Payments & Financial Access**

| Hackathon Requirement                     | How Kredito Addresses It                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| User-facing financial application         | Email-only login, mobile-first UI mimicking a standard FinTech app                             |
| Payment app people can actually use       | PHP stablecoin disbursed to embedded wallet, repayable in-app in one click                     |
| Connects users to their local economy     | PHPC mirrors PHP anchor structure; explicit mainnet upgrade path to Tempo/PDAX                 |
| Integrate with local anchors (encouraged) | PHPC designed as a drop-in for any SEP-24 PHP anchor on mainnet — zero contract changes needed |
| Use local assets                          | PHPC (Philippine Peso Coin), 1:1 testnet peg with PHP                                          |
| Build with composability in mind          | Registry SBT contract is standalone and queryable by any other Stellar protocol                |
| Plug into existing wallets                | SEP-41 PHPC is compatible with Freighter, Lobstr, and any SEP-41-aware wallet                  |
| Real product, not just a prototype        | Full borrow → repay → default lifecycle with real, verifiable on-chain state                   |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER (Mobile Browser)                        │
│                         Next.js 14 Frontend                          │
│              /login  /dashboard  /score  /loan/borrow  /loan/repay   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ HTTPS REST + JWT
┌───────────────────────────▼──────────────────────────────────────────┐
│                      Node.js / Express Backend                       │
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │  Auth Module    │  │  Scoring Engine  │  │   Loan Module      │  │
│  │  (email→wallet) │  │  (Horizon API)   │  │  (borrow/repay)    │  │
│  └─────────────────┘  └──────────────────┘  └────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │  Issuer Service │  │  Fee-Bump Signer │  │  Default Monitor   │  │
│  │  (SBT minting)  │  │  (gasless UX)    │  │  (cron job)        │  │
│  └─────────────────┘  └──────────────────┘  └────────────────────┘  │
└───────┬───────────────────────────────┬──────────────────────────────┘
        │ Horizon REST API              │ @stellar/stellar-sdk (Soroban RPC)
        │ (read wallet history)         │ (invoke contracts, submit tx)
┌───────▼──────────────┐     ┌──────────▼──────────────────────────────┐
│  Horizon API         │     │          Stellar Testnet                 │
│  horizon-testnet     │     │                                          │
│  .stellar.org        │     │  ┌────────────────────────────────────┐ │
└──────────────────────┘     │  │  credit_registry (SBT Contract)    │ │
                             │  │  · stores tier per wallet          │ │
                             │  │  · transfer() always panics        │ │
                             │  │  · issuer-only set_tier()          │ │
                             │  └────────────────────────────────────┘ │
                             │  ┌────────────────────────────────────┐ │
                             │  │  lending_pool (Vault Contract)     │ │
                             │  │  · cross-contract calls registry   │ │
                             │  │  · holds PHPC liquidity            │ │
                             │  │  · enforces borrow/repay/default   │ │
                             │  └────────────────────────────────────┘ │
                             │  ┌────────────────────────────────────┐ │
                             │  │  phpc_token (SEP-41 Token)         │ │
                             │  │  · 1 PHPC = 1 PHP (testnet peg)    │ │
                             │  │  · admin-mintable                  │ │
                             │  │  · full SEP-41 interface           │ │
                             │  └────────────────────────────────────┘ │
                             └─────────────────────────────────────────┘
```

---

## 4. Smart Contracts (Rust / Soroban)

### 4.1 Technology Stack & Tooling

| Item               | Specification                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Language           | Rust (`#![no_std]`)                                                                       |
| SDK                | `soroban-sdk = "22.0.0"` with `features = ["alloc"]`                                      |
| Dev SDK            | `soroban-sdk = "22.0.0"` with `features = ["testutils", "alloc"]`                         |
| Build target      | `wasm32v1-none` (preferred for Soroban) or `wasm32-unknown-unknown` |

| CLI                | `stellar-cli` (latest, installed via `cargo install --locked stellar-cli --features opt`) |
| Testnet RPC        | `https://soroban-testnet.stellar.org`                                                     |
| Network passphrase | `Test SDF Network ; September 2015`                                                       |

### 4.2 Monorepo Structure

```
contracts/
├── Cargo.toml                    ← workspace root (members = all 3 contracts)
├── deployed.json                 ← written post-deploy with all contract IDs
├── credit_registry/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       └── test.rs
├── lending_pool/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       └── test.rs
└── phpc_token/
    ├── Cargo.toml
    └── src/
        ├── lib.rs
        └── test.rs
```

### 4.3 Workspace `Cargo.toml`

```toml
[workspace]
members = [
    "credit_registry",
    "lending_pool",
    "phpc_token",
]
resolver = "2"
```

### 4.4 Per-Contract `Cargo.toml` Template

```toml
[package]
name = "<contract_name>"       # credit_registry | lending_pool | phpc_token
version = "0.1.0"
edition = "2021"
license = "MIT"

[lib]
crate-type = ["cdylib", "rlib"]
# cdylib = WASM output for deployment
# rlib   = enables `cargo test` to work — REQUIRED, do not remove

[dependencies]
soroban-sdk = { version = "22.0.0", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils", "alloc"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
```

---

### 4.5 Contract 1: `phpc_token`

**Deploy order: FIRST.** Both other contracts depend on its address.

**Purpose:** A fully standards-compliant SEP-41 fungible token representing the Philippine Peso on testnet. This is the asset that flows through the entire protocol — borrowers receive it, repay it, and the pool holds it. On mainnet, this contract is replaced by a real SEP-24 PHP anchor (Tempo or PDAX) with zero changes to any other contract, because the interface is identical.

**Key design decisions:**

- Implements the full `soroban_sdk::token::TokenInterface` trait, making it composable with any Stellar wallet, DEX, or third-party contract
- Uses `soroban_token_sdk::metadata` helpers to write name/symbol/decimals in the standard ledger format — wallets can read metadata without a contract call
- `mint()` is restricted to the admin (the backend issuer keypair). The pool is pre-funded during setup.
- All amounts in stroops (1 PHPC = 10,000,000 stroops, matching Stellar's 7-decimal standard)

**Storage layout:**
| Key | Type | Description |
|---|---|---|
| `Admin` | `Address` | The authorized minter (issuer keypair) |
| `TokenMetadata` | `{ name, symbol, decimals }` | Written by soroban_token_sdk helpers |
| `Balance(addr)` | `i128` | PHPC balance per address |
| `Allowance(from, spender)` | `{ amount: i128, expiration_ledger: u32 }` | SEP-41 allowances |

**Complete public interface:**
| Function | Arguments | Auth Required | Description |
|---|---|---|---|
| `initialize` | `admin: Address, decimal: u32, name: String, symbol: String` | None (one-time) | Sets metadata and admin. Panics if already initialized. |
| `mint` | `to: Address, amount: i128` | Admin | Creates PHPC and credits `to`. Used to fund the pool during setup. |
| `balance` | `id: Address` | None | Returns PHPC balance in stroops. |
| `transfer` | `from: Address, to: Address, amount: i128` | `from` | Standard push transfer. |
| `transfer_from` | `spender: Address, from: Address, to: Address, amount: i128` | `spender` | Allowance-based pull transfer. Used by lending pool in `repay()`. |
| `approve` | `from: Address, spender: Address, amount: i128, expiration_ledger: u32` | `from` | Sets or updates allowance. Borrower calls this before repaying. |
| `allowance` | `from: Address, spender: Address` | None | Returns current allowance. |
| `burn` | `from: Address, amount: i128` | `from` | Destroys tokens. Available but not used in MVP flow. |
| `decimals` | — | None | Returns `7`. |
| `name` | — | None | Returns `"Philippine Peso Coin"`. |
| `symbol` | — | None | Returns `"PHPC"`. |

**Required tests (5):**

1. **Happy path mint:** Admin mints 10,000 PHPC to address A — assert `balance(A) == 100_000_000_000` (10,000 × 10^7)
2. **Transfer:** Mint to A, transfer 3,000 PHPC to B — assert A balance decreased, B balance increased correctly
3. **Unauthorized mint:** Non-admin calling `mint()` — assert panic with auth failure
4. **Allowance + transfer_from:** A approves B for 1,000 PHPC, B calls `transfer_from(A → C, 1000)` — assert C balance and remaining allowance correct
5. **Double initialize:** Second call to `initialize()` — assert panic

---

### 4.6 Contract 2: `credit_registry`

**Deploy order: SECOND.** The lending pool depends on this contract's address.

**Purpose:** The on-chain source of truth for creditworthiness. Stores a non-transferable credit tier (0/1/2) per Stellar wallet address. Designed as a standalone, reusable primitive — any other Stellar protocol can call `get_tier()` to gate access, without needing to rebuild their own credit infrastructure.

**Soulbound mechanism:** The contract's `transfer()` and `transfer_from()` functions unconditionally panic. This is not a bug — it is the core security guarantee. The SBT is permanently bound to the wallet it was issued to, making it impossible to sell, lend, or transfer credit reputation. This is verifiable on-chain, which is a key demo talking point.

**Storage layout:**
| Key | Type | Description |
|---|---|---|
| `Issuer` | `Address` | The only address authorized to set/revoke tiers |
| `Tier1Limit` | `i128` | Max borrow amount in stroops for Tier 1 (e.g. 50_000_000_000 = 5,000 PHPC) |
| `Tier2Limit` | `i128` | Max borrow amount in stroops for Tier 2 (e.g. 200_000_000_000 = 20,000 PHPC) |
| `CreditTier(addr)` | `u32` | Current tier: 0=unscored, 1=basic, 2=trusted |
| `TierTimestamp(addr)` | `u64` | Ledger timestamp of last tier change (for audit trail) |

**Complete public interface:**
| Function | Arguments | Auth Required | Description |
|---|---|---|---|
| `initialize` | `issuer: Address, tier1_limit: i128, tier2_limit: i128` | None (one-time) | Sets issuer and tier limits. Panics if called twice. |
| `set_tier` | `wallet: Address, tier: u32` | Issuer | Mints or updates SBT. `tier` must be 0–2. Emits `tier_set`. |
| `revoke_tier` | `wallet: Address` | Issuer | Sets tier to 0. Called by backend when default detected. Emits `tier_revoked`. |
| `get_tier` | `wallet: Address` | None | Returns current tier. Returns 0 for any unknown wallet (safe default). |
| `get_tier_limit` | `tier: u32` | None | Returns max borrow amount in stroops for this tier. |
| `transfer` | `_from, _to: Address, _amount: i128` | — | Always panics: `"SBT: non-transferable by design"` |
| `transfer_from` | `_spender, _from, _to: Address, _amount: i128` | — | Always panics: `"SBT: non-transferable by design"` |

**Events emitted:**
| Topics | Data | Trigger |
|---|---|---|
| `["tier_set", wallet]` | `{ tier: u32, timestamp: u64 }` | `set_tier()` succeeds |
| `["tier_revoked", wallet]` | `{ timestamp: u64 }` | `revoke_tier()` succeeds |

**Required tests (5):**

1. **Happy path:** Issuer calls `set_tier(wallet, 1)` — assert `get_tier(wallet) == 1`
2. **Unauthorized set:** Non-issuer calls `set_tier()` — assert auth panic
3. **Transfer trap:** Any caller invokes `transfer()` on a wallet with a tier — assert panic with correct message
4. **Revocation cycle:** Set tier 2, then revoke — assert `get_tier() == 0`
5. **Tier limit correctness:** `get_tier_limit(1)` returns exactly the value passed to `initialize()`

---

### 4.7 Contract 3: `lending_pool`

**Deploy order: THIRD.** Depends on both `credit_registry` and `phpc_token` addresses.

**Purpose:** The lending engine. Holds PHPC liquidity, enforces SBT-gated borrowing, tracks active loans per wallet, and enforces repayment on-chain. Every public function maps directly to a user action visible in the frontend.

**Cross-contract calls made:**

- `credit_registry::get_tier(borrower)` — verify eligibility in `borrow()`
- `credit_registry::get_tier_limit(tier)` — enforce per-tier cap in `borrow()`
- `phpc_token::transfer(pool → borrower, amount)` — disburse loan in `borrow()`
- `phpc_token::transfer_from(borrower → pool, total_owed)` — collect repayment in `repay()`

**Repayment pattern (important):** The lending pool uses the SEP-41 allowance pattern for repayment. Before calling `repay()`, the borrower must call `phpc_token::approve(lending_pool_address, total_owed)`. The pool then calls `transfer_from()` to pull funds. The backend handles both steps sequentially and presents it as a single "Repay" button to the user.

**Storage layout:**
| Key | Type | Description |
|---|---|---|
| `Admin` | `Address` | Backend issuer keypair — can call `deposit()` and `mark_default()` |
| `RegistryContractId` | `Address` | Address of deployed `credit_registry` |
| `PhpcTokenContractId` | `Address` | Address of deployed `phpc_token` |
| `FlatFeeBps` | `u32` | Fee in basis points (500 = 5%) |
| `LoanTermLedgers` | `u32` | Repayment window in ledger count (518,400 = ~30 days at 5s/ledger) |
| `Loan(borrower)` | `LoanRecord` | Active loan record keyed by borrower address |

**`LoanRecord` struct:**
| Field | Type | Description |
|---|---|---|
| `principal` | `i128` | Amount borrowed in stroops |
| `fee` | `i128` | Flat fee owed in stroops (principal × fee_bps / 10,000) |
| `due_ledger` | `u32` | Ledger sequence number of the repayment deadline |
| `repaid` | `bool` | True once repay() succeeds |
| `defaulted` | `bool` | True once mark_default() succeeds |

**Complete public interface:**
| Function | Arguments | Auth Required | Description |
|---|---|---|---|
| `initialize` | `admin: Address, registry_id: Address, phpc_token: Address, flat_fee_bps: u32, loan_term_ledgers: u32` | None (one-time) | Sets all config. Panics if called twice. |
| `deposit` | `amount: i128` | Admin | Admin deposits PHPC into pool. Calls `phpc_token::transfer_from(admin → pool, amount)`. Admin must pre-approve. |
| `borrow` | `borrower: Address, amount: i128` | Borrower | Full borrow flow. Emits `loan_disbursed`. |
| `repay` | `borrower: Address` | Borrower | Full repay flow. Borrower must have pre-approved pool. Emits `loan_repaid`. |
| `mark_default` | `borrower: Address` | Permissionless | Marks overdue unpaid loan as defaulted. Callable by anyone after `due_ledger` passes. Emits `loan_defaulted`. |
| `get_loan` | `borrower: Address` | None | Returns `Option<LoanRecord>`. Returns `None` if no loan exists. |
| `get_pool_balance` | — | None | Returns current tracked PHPC balance of pool. |

**`borrow()` execution logic — ordered:**

```
1. Require: no existing LoanRecord for borrower where repaid=false AND defaulted=false
   → panic "Active loan already exists"

2. tier = credit_registry::get_tier(borrower)
   Require: tier >= 1
   → panic "No credit tier — apply for a score first"

3. limit = credit_registry::get_tier_limit(tier)
   Require: amount <= limit
   → panic "Amount exceeds tier borrow limit"

4. Require: amount <= pool_balance
   → panic "Insufficient pool liquidity"

5. Require: amount > 0
   → panic "Amount must be positive"

6. fee = (amount * flat_fee_bps as i128) / 10_000

7. due_ledger = env.ledger().sequence() + loan_term_ledgers

8. Store LoanRecord {
     principal: amount,
     fee,
     due_ledger,
     repaid: false,
     defaulted: false
   }

9. pool_balance -= amount

10. phpc_token::transfer(pool_contract_address, borrower, amount)

11. emit event ["loan_disbursed", borrower] → { amount, fee, due_ledger }
```

**`repay()` execution logic — ordered:**

```
1. Fetch LoanRecord for borrower
   → panic "No loan found" if missing

2. Require: loan.repaid == false
   → panic "Loan already repaid"

3. Require: loan.defaulted == false
   → panic "Loan has defaulted — contact support"

4. Require: env.ledger().sequence() <= loan.due_ledger
   → panic "Loan overdue — call mark_default first"

5. total_owed = loan.principal + loan.fee

6. phpc_token::transfer_from(borrower, pool_contract_address, total_owed)
   (borrower must have pre-approved pool for total_owed)

7. loan.repaid = true (update stored record)

8. pool_balance += total_owed

9. emit event ["loan_repaid", borrower] → { total_owed, timestamp: env.ledger().timestamp() }
```

**`mark_default()` execution logic — ordered:**

```
1. Fetch LoanRecord for borrower
   → panic "No loan found" if missing

2. Require: loan.repaid == false
   → panic "Loan already repaid"

3. Require: loan.defaulted == false
   → panic "Loan already marked as defaulted"

4. Require: env.ledger().sequence() > loan.due_ledger
   → panic "Loan not yet overdue"

5. loan.defaulted = true (update stored record)

6. emit event ["loan_defaulted", borrower] → { principal: loan.principal }

Note: revoke_tier() on the registry is called by the backend when it detects
this event — not from within this contract. This decouples the contracts.
```

**Events emitted:**
| Topics | Data | Trigger |
|---|---|---|
| `["loan_disbursed", borrower]` | `{ amount: i128, fee: i128, due_ledger: u32 }` | `borrow()` succeeds |
| `["loan_repaid", borrower]` | `{ total_owed: i128, timestamp: u64 }` | `repay()` succeeds |
| `["loan_defaulted", borrower]` | `{ principal: i128 }` | `mark_default()` succeeds |

**Required tests (5):**

1. **Happy path borrow:** Wallet with Tier 1 SBT borrows 5,000 PHPC — assert pool balance decreased by 5,000 PHPC and borrower balance increased by 5,000 PHPC
2. **Happy path repay:** After borrow, borrower approves pool for `total_owed`, calls `repay()` — assert loan marked repaid, pool balance restored with fee included
3. **No SBT rejection:** Wallet with Tier 0 (no SBT) calls `borrow()` — assert panic with `"No credit tier"`
4. **Over-limit rejection:** Tier 1 wallet tries to borrow more than `tier1_limit` — assert panic
5. **Double borrow rejection:** Tier 1 wallet borrows, immediately tries to borrow again — assert panic with `"Active loan already exists"`

---

### 4.8 Deployment Order & Post-Deploy Setup Script

```
# 0. Prerequisites
stellar keys generate issuer --network testnet
stellar keys fund issuer --network testnet

# 1. Build all contracts
cd contracts
stellar contract build   # outputs all 3 .wasm files to target/

# 2. Deploy phpc_token
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/phpc_token.wasm \
  --source issuer \
  --network testnet
# → Save output as PHPC_CONTRACT_ID

# 3. Initialize phpc_token
stellar contract invoke --id $PHPC_CONTRACT_ID --source issuer --network testnet \
  -- initialize \
  --admin <ISSUER_PUBLIC_KEY> \
  --decimal 7 \
  --name "Philippine Peso Coin" \
  --symbol "PHPC"

# 4. Deploy credit_registry
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/credit_registry.wasm \
  --source issuer \
  --network testnet
# → Save output as REGISTRY_CONTRACT_ID

# 5. Initialize credit_registry
# tier1_limit = 5,000 PHPC × 10^7 = 50_000_000_000 stroops
# tier2_limit = 20,000 PHPC × 10^7 = 200_000_000_000 stroops
stellar contract invoke --id $REGISTRY_CONTRACT_ID --source issuer --network testnet \
  -- initialize \
  --issuer <ISSUER_PUBLIC_KEY> \
  --tier1_limit 50000000000 \
  --tier2_limit 200000000000

# 6. Deploy lending_pool
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/lending_pool.wasm \
  --source issuer \
  --network testnet
# → Save output as LENDING_POOL_CONTRACT_ID

# 7. Initialize lending_pool
# loan_term_ledgers = 30 days × 17,280 ledgers/day (at ~5s/ledger) = 518,400
stellar contract invoke --id $LENDING_POOL_CONTRACT_ID --source issuer --network testnet \
  -- initialize \
  --admin <ISSUER_PUBLIC_KEY> \
  --registry_id $REGISTRY_CONTRACT_ID \
  --phpc_token $PHPC_CONTRACT_ID \
  --flat_fee_bps 500 \
  --loan_term_ledgers 518400

# 8. Mint PHPC to pool (100,000,000 PHPC = enough for ~20,000 demo loans)
stellar contract invoke --id $PHPC_CONTRACT_ID --source issuer --network testnet \
  -- mint \
  --to $LENDING_POOL_CONTRACT_ID \
  --amount 1000000000000000

# 9. Save all addresses
cat > contracts/deployed.json << EOF
{
  "network": "testnet",
  "phpc_token": "$PHPC_CONTRACT_ID",
  "credit_registry": "$REGISTRY_CONTRACT_ID",
  "lending_pool": "$LENDING_POOL_CONTRACT_ID",
  "issuer_public": "<ISSUER_PUBLIC_KEY>",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

---

## 5. Backend (Node.js / Express)

### 5.1 Tech Stack

| Layer       | Choice                                  | Rationale                                             |
| ----------- | --------------------------------------- | ----------------------------------------------------- |
| Runtime     | Node.js 20 LTS                          | `@stellar/stellar-sdk` is JS-native; best SDK support |
| Framework   | Express 4                               | Minimal, fast to ship                                 |
| Database    | SQLite via `better-sqlite3`             | Zero-config file DB; enough for hackathon             |
| Auth        | JWT (`jsonwebtoken`)                    | Stateless; works cleanly with embedded wallets        |
| Encryption  | AES-256-GCM (`node:crypto`)             | Encrypt user secret keys at rest; never logged        |
| Scheduler   | `node-cron`                             | Default monitor cron                                  |
| Validation  | Zod                                     | Runtime type safety on all API inputs                 |
| HTTP client | None (Horizon via SDK, Soroban via SDK) | —                                                     |

### 5.2 Environment Variables

```env
# Network
STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Credentials
ISSUER_SECRET_KEY=S...              # Backend Stellar keypair — admin, issuer, fee-bump source
ENCRYPTION_KEY=<32-byte-hex>        # AES-256 key for encrypting user secret keys at rest

# Contract IDs (set after deployment)
PHPC_CONTRACT_ID=C...
REGISTRY_CONTRACT_ID=C...
LENDING_POOL_CONTRACT_ID=C...

# Server
JWT_SECRET=<long-random-string>
PORT=3001
NODE_ENV=production
```

### 5.3 Database Schema

```sql
CREATE TABLE users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    email                TEXT UNIQUE NOT NULL,
    stellar_pub          TEXT NOT NULL,
    stellar_enc_secret   TEXT NOT NULL,    -- AES-256-GCM encrypted; never logged or returned
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE score_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    tier         INTEGER NOT NULL,         -- 0, 1, or 2
    score        INTEGER NOT NULL,         -- 0–100
    score_json   TEXT NOT NULL,            -- full breakdown as JSON string
    sbt_minted   BOOLEAN NOT NULL DEFAULT 0,
    sbt_tx_hash  TEXT,                     -- null if no SBT action taken
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.4 API Endpoints

All protected routes require `Authorization: Bearer <jwt>` header.

---

#### `POST /api/auth/login`

Creates user if new (generates Stellar keypair, AES-encrypts secret key, stores in DB). Returns JWT on every call.

```
Request body:  { "email": "string" }

Response 200:  {
  "token": "jwt...",
  "user": {
    "email": "user@example.com",
    "stellarAddress": "G...",
    "isNew": true
  }
}

Error 400:  { "error": "Invalid email format" }
```

---

#### `GET /api/credit/score` _(auth required)_

Fetches Horizon data, computes score using the scoring algorithm below, compares new tier to current on-chain tier, mints/upgrades SBT if tier changed, logs score event.

```
Response 200: {
  "tier": 0 | 1 | 2,
  "score": number,          -- 0-100
  "breakdown": {
    "accountAge": {
      "score": number,
      "max": 30,
      "detail": "Account is 45 days old"
    },
    "txVolume": {
      "score": number,
      "max": 40,
      "detail": "38 transactions on record"
    },
    "repaymentHistory": {
      "score": number,
      "max": 30,
      "detail": "1 prior loan repaid on time"
    }
  },
  "tierLabel": "Basic Credit",
  "borrowLimit": "5,000.00",     -- in PHPC (shown as PHP to user)
  "sbtMinted": true,
  "sbtTxHash": "abc123..." | null
}
```

---

#### `POST /api/loan/borrow` _(auth required)_

Decrypts user keypair in memory, builds `borrow()` Soroban invocation, wraps in fee-bump envelope, submits.

```
Request body:  { "amount": number }   -- in PHPC units (e.g. 5000)

Response 200: {
  "txHash": "abc123...",
  "amount": "5,000.00",
  "fee": "250.00",
  "totalOwed": "5,250.00",
  "dueDate": "2026-05-28T00:00:00Z",
  "explorerUrl": "https://stellar.expert/explorer/testnet/tx/abc123"
}

Error 400: { "error": "Active loan already exists" }
Error 400: { "error": "No credit tier — request a score first" }
Error 400: { "error": "Insufficient pool liquidity" }
```

---

#### `POST /api/loan/repay` _(auth required)_

Builds two sequential fee-bumped transactions: `phpc_token::approve(pool, total_owed)` then `lending_pool::repay(borrower)`. Handles both in one backend call.

```
Response 200: {
  "txHash": "def456...",
  "amountRepaid": "5,250.00",
  "explorerUrl": "https://stellar.expert/explorer/testnet/tx/def456"
}

Error 400: { "error": "No active loan found" }
Error 400: { "error": "Loan already repaid" }
Error 400: { "error": "Loan is overdue — mark_default must be called first" }
```

---

#### `GET /api/loan/status` _(auth required)_

Reads `lending_pool::get_loan(address)` from contract, computes time state, returns structured object.

```
Response 200: {
  "hasActiveLoan": true,
  "loan": {
    "principal": "5,000.00",
    "fee": "250.00",
    "totalOwed": "5,250.00",
    "dueDate": "2026-05-28T00:00:00Z",
    "daysRemaining": 29,          -- negative = overdue
    "status": "active" | "overdue" | "repaid" | "defaulted"
  }
}

Response 200 (no loan): { "hasActiveLoan": false, "loan": null }
```

---

### 5.5 On-Chain Credit Scoring Algorithm

Fully deterministic and auditable. Every factor is explainable to the user on the Score Breakdown screen.

**Data sources:**

- `GET https://horizon-testnet.stellar.org/accounts/{address}` → account creation ledger
- `GET https://horizon-testnet.stellar.org/accounts/{address}/transactions?limit=200&order=asc` → transaction count
- Soroban event query on `lending_pool` for `loan_repaid` and `loan_defaulted` topics involving this wallet

**Scoring formula:**

```
TOTAL SCORE (0–100) = AccountAge + TxVolume + RepaymentHistory

AccountAge (0–30 pts):
  < 7 days old      →  0 pts  →  "Account too new to score"
  7–30 days         → 10 pts  →  "Account is {N} days old"
  31–90 days        → 20 pts  →  "Account is {N} days old"
  > 90 days         → 30 pts  →  "Account is {N} days old"

TxVolume (0–40 pts):
  0–5 transactions  →  0 pts  →  "Only {N} transactions on record"
  6–20              → 15 pts  →  "{N} transactions on record"
  21–50             → 25 pts  →  "{N} transactions on record"
  > 50              → 40 pts  →  "{N} transactions on record"

RepaymentHistory (0–30 pts, floor at 0):
  No prior loans    →  0 pts  →  "No prior loan history"
  Any default       → -20 pts →  "Default on record"
  1 on-time repay   → 15 pts  →  "1 loan repaid on time"
  2+ on-time repays → 30 pts  →  "{N} loans repaid on time"

Tier Assignment:
  0–39   → Tier 0 → "Unscored"       → No loan access
  40–69  → Tier 1 → "Basic Credit"   → Borrow up to ₱5,000
  70–100 → Tier 2 → "Trusted Credit" → Borrow up to ₱20,000
```

### 5.6 Fee-Bump Transaction Architecture

User embedded wallets hold no XLM. The issuer (backend wallet) pays all network fees. This is the mechanism that enables the Web2-style UX.

```
For every contract invocation from a user wallet:

1. BUILD inner transaction
   Source account:   user's embedded keypair (G...)
   Operation:        invokeHostFunction → target contract + function + args
   Base fee:         100 stroops (placeholder — will be overridden)
   Sequence number:  fetched live from Horizon for user's account

2. SIGN inner tx with user's decrypted secret key
   (key is decrypted from DB in memory only, never written to any log)

3. BUILD fee-bump envelope
   Fee source:  issuer keypair (ISSUER_SECRET_KEY)
   Max fee:     1,000,000 stroops (~$0.001 USD at current XLM price)
   Inner tx:    the signed inner transaction from step 2

4. SIGN fee-bump with issuer key

5. SUBMIT to Soroban RPC sendTransaction endpoint

6. POLL for confirmation
   Endpoint: getTransaction
   Interval: 1 second
   Timeout:  30 seconds
   On SUCCESS: return tx hash
   On FAILURE: parse error code from Soroban diagnostic events, return user-readable message
```

### 5.7 Default Monitor (Cron Job)

Runs every 6 hours via `node-cron`. Scans all wallets with a loan in the DB (a lightweight cache of active borrowers), reads their `LoanRecord` from the contract, checks if `due_ledger < current_ledger` and `repaid == false`.

On detection of an overdue unpaid loan:

1. Calls `lending_pool::mark_default(borrower)` via issuer keypair
2. On success, calls `credit_registry::revoke_tier(borrower)` via issuer keypair
3. Logs a `score_events` row with `tier=0`

---

## 6. Frontend (Next.js 14)

### 6.1 Tech Stack

| Layer                        | Choice                                            |
| ---------------------------- | ------------------------------------------------- |
| Framework                    | Next.js 14, App Router                            |
| Styling                      | Tailwind CSS                                      |
| Global state                 | Zustand                                           |
| Server state / data fetching | TanStack Query v5                                 |
| API client                   | Axios with request interceptor for JWT            |
| Icons                        | Lucide React                                      |
| Fonts                        | Inter (system font stack — no external font load) |

### 6.2 Route Map

```
/                   → redirect: /dashboard if JWT valid, else /login
/login              → email-only entry
/dashboard          → main app screen
/score              → credit score breakdown
/loan/borrow        → borrow confirmation screen
/loan/repay         → repayment screen
```

### 6.3 Page Specifications

#### `/login`

- Single `<input type="email">` with `inputmode="email"` and `autocomplete="email"`
- "Continue →" button, disabled during loading
- On submit: `POST /api/auth/login` → store JWT in Zustand + localStorage → push to `/dashboard`
- Error: inline message below input field

#### `/dashboard`

Three stacked sections:

**`<CreditCard />`** (always visible)

- Animated tier badge pill: grey/Tier 0, green/Tier 1, gold/Tier 2
- Large numeric score display (e.g. "62")
- Tier label ("Basic Credit")
- Available borrow limit ("Up to ₱5,000.00")
- "See Score Breakdown →" link to `/score`
- Triggers `GET /api/credit/score` on mount; fires SBT mint automatically if tier changed
- Skeleton loader during API fetch

**`<LoanStatus />`** (conditional on loan state from `GET /api/loan/status`)

- **No loan:** Borrow available amount display + blue "Borrow ₱5,000" CTA → `/loan/borrow`
- **Active loan:** Principal + fee + total owed + due date + days remaining countdown + "Repay Now" → `/loan/repay`
- **Overdue:** Red "OVERDUE" badge + days overdue + total owed + "Repay Now" button
- **Defaulted:** Red warning card — "Your credit has been suspended"
- **Repaid:** Green success card "Loan repaid ✓" + "Apply for another loan" link

**`<WalletInfo />`** (collapsed, tap to expand)

- Truncated Stellar address (first 4 + last 4 chars)
- "View on Stellar Expert ↗" link (opens in new tab)
- "What is this?" tooltip with one-sentence explanation

#### `/score`

- Page title: "Your Credit Score"
- Three factor cards with animated fill progress bars:
  - Factor name + points earned + max possible + explanation string from API
- Total score animated fill bar (0 → actual score on mount)
- Expandable FAQ section:
  - "Where does my score come from?" → explains Horizon data sources
  - "How do I improve my score?" → explains tier upgrade logic
  - "Is my data private?" → explains embedded wallet model

#### `/loan/borrow`

- Disclosure card:
  - Loan amount: `₱5,000.00`
  - Flat fee (5%): `₱250.00`
  - Total to repay: `₱5,250.00`
  - Due by: `[30 days from today, human-readable date]`
- "I understand the repayment terms" checkbox — button disabled until checked
- "Confirm Borrow" button → `POST /api/loan/borrow`
- **Loading:** Spinner + "Submitting to Stellar network..."
- **Success:** Green checkmark + tx hash (truncated, copy button) + "View on Stellar Expert" link
- **Error:** Descriptive error message (no raw blockchain errors shown to user)

#### `/loan/repay`

- Summary card: principal / fee / total / due date
- `daysRemaining > 0`: green countdown "{N} days remaining"
- `daysRemaining <= 0`: red "OVERDUE by {N} days"
- "Repay ₱5,250.00" button → `POST /api/loan/repay`
- **Loading:** Spinner + "Processing repayment..."
- **Success:** "Loan fully repaid ✓" + tx hash + "Your score may have improved!"
- **Error:** Descriptive message

### 6.4 Global UX Rules

- Max content width: 390px (iPhone frame) — centered on desktop with subtle card shadow
- All touch targets: minimum 44×44px per Apple HIG
- **Zero crypto jargon visible to the user** — no "ledger", "stroop", "Soroban", "keypair", "PHPC"
- All amounts displayed as `₱X,XXX.XX` (Philippine Peso sign)
- Network errors show "Try again" retry button, not a broken empty screen
- On any unrecoverable error (revoked tier, defaulted loan): show support contact link

---

## 7. Infrastructure & Deployment

| Component       | Service                | Tier      | Cost   |
| --------------- | ---------------------- | --------- | ------ |
| Smart contracts | Stellar Testnet        | —         | Free   |
| Backend API     | Railway.app            | Free tier | Free   |
| Frontend        | Vercel                 | Hobby     | Free   |
| Database        | SQLite file on Railway | —         | Free   |
| Domain          | Vercel subdomain       | —         | Free   |
| **Total**       |                        |           | **$0** |

**Deployment commands:**

```bash
# Frontend
vercel --prod

# Backend (Railway via GitHub integration — push to main = redeploy)
git push origin main

# Contracts — see §4.8 deployment script
```

---

## 8. Demo Script (60 Seconds)

**Pre-demo checklist:**

- [ ] Demo wallet ready: testnet account >45 days old, >38 transactions in history
- [ ] Lending pool pre-funded with 100,000,000 PHPC
- [ ] App deployed and accessible via Vercel URL on a mobile viewport
- [ ] Stellar Expert tab pre-loaded on demo wallet address
- [ ] Score computes to ~62 (Tier 1) for demo wallet — verify before demo

| Time   | Action                                                                                                  | What Judges See                                                   |
| ------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0–8s   | Narrate: _"This is Maria. Sari-sari store owner. No bank account. Needs ₱5,000."_ Open app, type email. | Email login. No seed phrase, no extension.                        |
| 8–18s  | Dashboard loads. Point to score: 62/100, Tier 1. Click "See Breakdown."                                 | 3 real Horizon data-sourced factors. Transparent, auditable.      |
| 18–28s | Back. _"Kredito has already minted her credential on Stellar."_ Tap wallet, open Stellar Expert.        | SBT visible. Transfer button greyed out. Non-transferable proven. |
| 28–42s | Tap "Borrow ₱5,000." Show fee disclosure. Check agreement. Confirm.                                     | Loading spinner → tx hash.                                        |
| 42–55s | Click "View on Stellar Expert."                                                                         | PHPC transfer visible. Amount. Wallet. Timestamp.                 |
| 55–60s | _"₱5,000 to Maria in under a minute. No bank. No collateral. Just her history on Stellar."_             | —                                                                 |

---

## 9. Mainnet Upgrade Path (Say This to Judges)

The testnet architecture maps 1:1 to mainnet with these substitutions only:

| Testnet                       | Mainnet Replacement                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| PHPC mock token               | Tempo PHP anchor (SEP-24) or PDAX stablecoin — same SEP-41 interface, zero contract changes |
| Embedded wallet (server-side) | WalletConnect + Freighter integration for self-custody path                                 |
| Hardcoded tier limits         | Admin multisig or governance contract for decentralized parameter updates                   |
| SQLite                        | Postgres (Railway production tier)                                                          |
| Testnet Horizon history       | Mainnet Horizon — richer, longer-term, more signal-dense history                            |

---

## 10. Known Limitations (State These Proactively — It Builds Credibility)

| Limitation                               | Why It Exists                                       | V2 Upgrade Path                                   |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| PHPC is not a live PHP anchor            | Testnet-only hackathon scope                        | Tempo or PDAX SEP-24 anchor on mainnet            |
| User keys stored server-side (custodial) | Embedded wallet UX requirement for non-crypto users | WalletConnect / Freighter for self-custody option |
| Fixed borrow amount (no slider)          | Reduces demo surface area                           | Amount slider with real-time fee calculation      |
| No SMS/push repayment reminders          | Out of hackathon scope                              | Twilio + cron for due-date notifications          |
| Single-currency only (PHP)               | Philippines focus for hackathon                     | Multi-currency via additional anchors (IDR, VND)  |

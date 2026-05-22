# Kredito — End-to-End Demo Script & Presentation Runbook

This runbook outlines a step-by-step presentation script for conducting a live demonstration of the Kredito platform. It is optimized to showcase all core features smoothly within a 2-3 minute window, highlighting the user onboarding, micro-lending lifecycle, liquidity staking, and secure locked savings.

---

## 1. Prerequisites & Staging

To avoid live demo delays, pre-stage the following components:

1. **Network**: Ensure your Freighter wallet extension is set to **Testnet** (or pointed at the correct mainnet if doing a mainnet flex).
2. **Tab Staging**: Open the following tabs in your browser:
   - Tab 1: Kredito Landing Page (`http://localhost:3000` or `https://kredito-iota.vercel.app`).
   - Tab 2: Stellar Expert Explorer for your contract addresses.
3. **Wallet Balance**: Ensure your demonstrating wallet has a starting balance of at least **150 XLM** (use Friendbot via Stellar Laboratory to fund it if needed).
4. **Pre-connected Wallet**: Have the wallet pre-connected in Freighter beforehand so you can sign instantly.

---

## 2. Step-by-Step Presentation Script

### Part 1: Secure Wallet Sign-in (0:00–0:20)

- **Action**:
  1. Open the landing page (`http://localhost:3000`).
  2. Click **Connect Freighter Wallet**.
  3. Approve the SEP-10 Authentication Challenge in the Freighter popup.
  4. Redirection to the Dashboard occurs automatically.
- **Speaker Script**:
  > "Welcome to Kredito. We are building on-chain microfinance infrastructure for the financially underserved in the Philippines. Instead of a complex email/password registration, users sign in securely in seconds using their non-custodial Freighter wallet via standard SEP-10 WebAuth. Private keys never leave the user's browser."

---

### Part 2: Establish Credit Passport & scoring (0:20–0:50)

- **Action**:
  1. Show the user's starting "Unrated" dashboard.
  2. Click **Refresh Score**.
  3. Sign the **Update Metrics** transaction in Freighter.
  4. The Dashboard reloads, presenting the beautiful **Credit Passport** card displaying their score, Tier, and borrow limit.
- **Speaker Script**:
  > "Once logged in, the user creates or refreshes their Credit Passport. The Kredito backend dynamically sweeps the wallet's public history on Stellar (transaction counts, inbound payments, current balances, and ages) to compute a transparent, deterministic credit score. We sign this score on-chain to our Credit Registry contract, assigning a Bronze, Silver, Gold, or Platinum tier limit with zero manual paperwork."

---

### Part 3: Borrowing from the Pool (0:50–1:20)

- **Action**:
  1. Click **Borrow Funds** in the sidebar.
  2. Enter a borrow amount within the tier limit (e.g., **5 XLM** for Silver tier).
  3. Point out the clear terms: 30-day fixed term, dynamic fee rate discounted by tier, and no hidden charges.
  4. Click **Confirm Borrow** and sign the Soroban transaction.
  5. The success page appears, displaying the transaction hash.
- **Speaker Script**:
  > "With a Credit Passport established, borrowing is instant. The borrower inputs their desired amount. Kredito automatically pulls their tier limit and applies a corresponding interest discount. Clicking borrow triggers an atomic Soroban transaction: the pool validates the tier, checks KYC flags, and disburses the XLM directly to the user's wallet in under 5 seconds, all sponsored gasless without needing XLM for network fees."

---

### Part 4: Staking & Earning Yield (1:20–1:50)

- **Action**:
  1. Navigate to the **Staking** page (`/staking`).
  2. Explain that the pool is community-backed. Enter **20 XLM** to stake.
  3. Sign the Approve and Stake transactions.
  4. Point out the updated staked balance and share percentage.
- **Speaker Script**:
  > "Kredito's lending pool is backed by decentralized liquidity. Anyone can navigate to our Staking dashboard and deposit XLM. When borrowers repay their loans, 50% of the interest fees go directly to stakers. Yield is calculated and distributed continuously using a robust, on-chain reward-share mechanism."

---

### Part 5: Secured Fixed-Term Savings (1:50–2:10)

- **Action**:
  1. Navigate to the **Time Deposits** page (`/deposit`).
  2. Select the **30-Day Term (5% APY)** or **60-Day Term (8% APY)** option.
  3. Deposit **10 XLM** and complete the signing. Show the active savings deposit card.
- **Speaker Script**:
  > "For users seeking guaranteed passive returns, Kredito offers locked Time Deposits. Users can lock their XLM for 30 or 60 days to earn 5% or 8% APY. The smart contract locks the principal and pre-allocates the interest from the pool liquidity, guaranteeing the return upon maturity."

---

### Part 6: Repayment & Reputation Level Up (2:10–2:40)

- **Action**:
  1. Navigate to the **Repay** page (`/loan/repay`).
  2. Click **Repay Loan**, then complete the Approve and Repay steps in Freighter.
  3. Once confirmed, go back to the **Dashboard** and show that the score has successfully increased (e.g., Silver -> Gold limit expansion) as the repayment metric incremented.
- **Speaker Script**:
  > "Finally, let's look at repayment. Outstanding loans are settled via our two-step repayment flow. Once completed, the lending pool updates the reputation metrics on-chain. The borrower's score immediately increases, unlocking a higher borrow limit and lower interest rates for their next loan, creating a sustainable cycle of portable credit reputation."

---

## 3. Core Value Talking Points (Presentation Takeaways)

Whenever presenting, emphasize these three key architectural advantages:

1. **Deterministic & Transparent**: Credit scores are computed entirely from public, immutable ledger metrics. There are no black-box algorithms or subjective exclusions.
2. **Gasless UX**: By utilizing sponsored fee-bump transactions, we remove a major hurdle for Web3 adoption. Borrowers sign transactions but never pay network gas fees.
3. **Decentralized & Secure**: The platform is entirely non-custodial and stateless. User funds are held securely in Soroban contracts with strict mathematical constraints, and private keys never leave Freighter.

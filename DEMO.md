# Kredito — End-to-End Demo Script

This runbook outlines the steps for a live demonstration of the Kredito platform, from wallet connection to loan repayment and score improvement.

## 1. Prerequisites

- **Network**: Ensure Freighter is set to **Testnet**.
- **Services**: Both `backend` and `frontend` must be running locally (or pointing to staging).
- **Wallet Balance**: The demonstrating wallet should have some Testnet XLM (use Friendbot if needed).

---

## 2. Step-by-Step Flow

### Step 1: Secure Wallet Sign-in
1. Navigate to the Kredito homepage (`http://localhost:3000`).
2. Click **Connect Freighter Wallet**.
3. Approve the connection request in Freighter.
4. Sign the SEP-10 Auth Challenge when prompted. This establishes a secure session with the Kredito backend.
5. You should be redirected to the **Dashboard**.

### Step 2: Establish Credit Identity (Initial Scoring)
1. On the Dashboard, you'll see "Unrated" or a low score if it's a new wallet.
2. Click **Refresh Score** (or **Calculate Score**).
3. The backend will sweep the last 10,000 ledgers for your address history (payments, XLM balance, age).
4. A transaction window will appear. Sign the **Update Metrics** transaction. This persists your credit metadata on-chain.
5. The Dashboard should now display your **Credit Passport** with a Tier (e.g., Bronze, Silver, Gold) and a Borrow Limit.

### Step 3: Borrow from the Pool
1. Click **Borrow Funds** in the sidebar or from the dashboard card.
2. Review the loan terms:
   - 30-day fixed term.
   - Fixed fee based on your Tier.
   - Instant disbursement.
3. Select an amount (staying within your tier limit).
4. Click **Review & Confirm**.
5. Check the confirmation box and click **Confirm Borrow**.
6. Sign the Soroban transaction in Freighter.
7. **Success!** Particles will appear, and you can view the transaction on Stellar Expert. Your wallet now contains the borrowed PHPC.

### Step 4: Top-up for Repayment (Demo Tip)
*Note: Since Kredito is a pure micro-loan flow, you only received the principal. To repay, you need `principal + fee`.*
1. Explain that for the demo, we need a few extra PHPC to cover the interest/fee.
2. Use the "issuer" or a script to send a small amount of PHPC to the demo wallet, or explain that in a real-world scenario, the user would already have some balance or top up via an anchor.

### Step 5: Repay and Level Up
1. Navigate to the **Repay** page.
2. You will see your active loan details and the due date.
3. Click **Repay Loan**.
4. Two steps will happen:
   - **Approve**: You sign a transaction allowing the Lending Pool to pull the PHPC.
   - **Repay**: You sign the actual repayment transaction.
5. Once confirmed, the UI shows a success state.
6. Return to the **Dashboard**. Note that your score/metrics have updated (specifically `loans_repaid` incremented), which may have increased your limit for the next loan!

---

## 3. Key Talking Points

- **Transparency**: Every scoring metric is derived from public ledger data.
- **On-Chain Truth**: The Credit Passport is a smart contract, not a private database record.
- **Efficiency**: No manual credit checks, no physical paperwork.
- **Non-Custodial**: We never touch your private keys; everything is signed via Freighter.

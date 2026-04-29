# E2E Testing Guide: Kredito on Stellar Testnet

This guide provides a step-by-step walkthrough to test the full Kredito lifecycle—from identity creation to borrowing and repaying—using the live Stellar Testnet.

> [!IMPORTANT]
> Since Zsh (the default Mac shell) often misinterprets the long XDR strings in Stellar transactions, this guide uses a **File-Based Method** for signing and submission. This is the only way to avoid "unknown sort specifier" and "missing end of string" errors.

## 1. Prerequisites

- **Backend Running**: Ensure your backend is running on `http://localhost:3001`.
  ```bash
  cd backend && pnpm dev
  ```
- **Stellar CLI**: Installed and available in your terminal.
- **JQ**: Required for parsing JSON and safely building payloads.

---

## 2. Setup Test Identity

First, create a fresh Stellar account on the testnet and fund it via Friendbot.

```bash
# 1. Generate a new keypair
stellar keys generate e2e-tester --network testnet

# 2. Fund it with 10,000 XLM (Friendbot)
stellar keys fund e2e-tester --network testnet

# 3. Save your public key for the next steps
PUBKEY=$(stellar keys address e2e-tester)
echo "Tester Pubkey: $PUBKEY"
```

---

## 3. Authenticate with Kredito

Authenticate with the actual Freighter-style challenge flow.

```bash
# 1. Request challenge XDR
CHALLENGE_XDR=$(curl -s -X POST http://localhost:3001/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d "{\"stellarAddress\": \"$PUBKEY\"}" | jq -r '.challengeXdr')

# 2. Sign it from file to avoid shell escaping issues
printf '%s' "$CHALLENGE_XDR" > challenge.xdr
stellar tx sign challenge.xdr --sign-with-key e2e-tester --network testnet --quiet > signed_challenge.xdr

# 3. Exchange signed challenge for JWT
AUTH_RESPONSE=$(jq -n --rawfile xdr signed_challenge.xdr '{"signedChallengeXdr": $xdr | sub("\n$"; "")}' \
  | curl -s -X POST http://localhost:3001/api/auth/login \
      -H "Content-Type: application/json" \
      -d @-)

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')
echo "JWT Token: $TOKEN"

rm challenge.xdr signed_challenge.xdr
```

---

## 4. Generate On-Chain Credit Score

The contract needs to know your credit tier before you can borrow.

```bash
# Trigger score generation
curl -s -X POST http://localhost:3001/api/credit/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
```

---

## 5. The Borrow Flow

### A. Initiate Borrow

Request a loan of 500 PHPC.

```bash
# 1. Get Unsigned XDR
curl -s -X POST http://localhost:3001/api/loan/borrow \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500}' | jq -r '.unsignedXdr' > unsigned.xdr

# 2. Sign (Reading from file to avoid Zsh errors)
stellar tx sign unsigned.xdr --sign-with-key e2e-tester --network testnet --quiet > signed.xdr

# 3. Build Payload & Submit
jq -n --rawfile xdr signed.xdr '{"signedInnerXdr": $xdr | sub("\n$"; "")}' > payload.json
curl -s -X POST http://localhost:3001/api/tx/sign-and-submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @payload.json | jq .

# 4. Clean up
rm unsigned.xdr signed.xdr payload.json
```

---

## 6. The Repay Flow (Two-Step)

Repayment is split into two steps: `Approve` and `Repay`.

> [!WARNING]
> **The Fee Trap**: To repay a loan of 500 PHPC, you need **525 PHPC** in your wallet (500 principal + 25 fee). Since you only borrowed 500, you must have some extra PHPC to cover the fee, or the contract will return an "Insufficient Balance" error.

Before repayment, confirm the wallet balance:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/loan/status | jq .
```

If `walletPhpBalance` is below `loan.totalOwed`, mint more PHPC to that same wallet before continuing.

### Step 1: Approve PHPC Spending

```bash
# 1. Get Approve XDR
curl -s -X POST http://localhost:3001/api/loan/repay \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq -r '.unsignedXdr' > approve_unsigned.xdr

# 2. Sign
stellar tx sign approve_unsigned.xdr --sign-with-key e2e-tester --network testnet --quiet > approve_signed.xdr

# 3. Submit
jq -n --rawfile xdr approve_signed.xdr '{"signedInnerXdr": $xdr | sub("\n$"; "")}' > payload.json
curl -s -X POST http://localhost:3001/api/tx/sign-and-submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @payload.json | jq .

rm approve_unsigned.xdr approve_signed.xdr payload.json
```

### Step 2: Finalize Repayment

Wait ~5 seconds for the ledger to close before running this.

```bash
# 1. Get Repay XDR
curl -s -X POST http://localhost:3001/api/loan/repay \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq -r '.unsignedXdr' > repay_unsigned.xdr

# 2. Sign
stellar tx sign repay_unsigned.xdr --sign-with-key e2e-tester --network testnet --quiet > repay_signed.xdr

# 3. Submit
jq -n --rawfile xdr repay_signed.xdr '{"signedInnerXdr": $xdr | sub("\n$"; "")}' > payload.json
curl -s -X POST http://localhost:3001/api/tx/sign-and-submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @payload.json | jq .

rm repay_unsigned.xdr repay_signed.xdr payload.json
```

---

## 7. Troubleshooting & Lessons Learned

### Ghost Loans & Database Desync

If you redeploy your contracts, the backend database (`kredito.db`) might still think you have an active loan from the old contract.

- **Symptoms**: Borrow request returns `{"error": "Active loan already exists"}`.
- **Solution**: Clear the `active_loans` table:
  ```bash
  sqlite3 backend/kredito.db "DELETE FROM active_loans; DELETE FROM score_events;"
  ```

### Shell Errors (Zsh)

If you see `unknown sort specifier` or `missing end of string`, it means you are using variables instead of files. **Always use the file-based method** shown in Section 5 and 6.

### Insufficient Balance on Repay

If repay returns an insufficient balance error, mint more PHPC into the same wallet:

```bash
stellar contract invoke \
  --id CD2GKG5HM5FMFCN4OMPXKTBHC23N2EFIQGESQV46WJGZAD76FP7SLPJR \
  --source issuer \
  --network testnet -- \
  mint \
  --to $PUBKEY \
  --amount 250000000
```

That example mints `25 PHPC`.

The current backend also exposes the shortfall directly through `GET /api/loan/status` and returns a clearer error message from `POST /api/loan/repay`.

### Soroban RPC Retry Responses

If score generation fails with `TRY_AGAIN_LATER`, the RPC is congested. Wait a few seconds and retry:

```bash
curl -s -X POST http://localhost:3001/api/credit/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
```

---

## 8. Final Verification

Check status to ensure `hasActiveLoan` is `false` and `loan` is `null`.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/loan/status | jq .
```

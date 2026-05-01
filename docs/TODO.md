# Kredito — Runtime Fix TODO

Derived from live backend logs. Two distinct 500 errors observed.

---

## Fix 1 — `POST /api/credit/generate` → 500

**Error:** `Transaction contains more than one operation`
**File:** `backend/src/stellar/issuer.ts`

### Root Cause

`invokeIssuerContract()` loops over an array of operations and adds them all to a single
`TransactionBuilder` before calling `rpcServer.prepareTransaction(tx)`.
Soroban's RPC rejects any transaction with more than one `invokeHostFunction` operation.

`updateOnChainMetrics()` passes two operations to this function:

1. `update_metrics_raw`
2. `update_score`

### Fix

Split `invokeIssuerContract` into a single-op helper and call it **twice sequentially**
inside `updateOnChainMetrics`:

```typescript
// BEFORE — one tx, two ops → Soroban rejects
async function invokeIssuerContract(operations: { functionName: string; args: xdr.ScVal[] }[]) {
  ...
  for (const op of operations) {
    builder.addOperation(...); // adds both ops to same tx
  }
  const prepared = await rpcServer.prepareTransaction(tx); // 💥 throws here
}

export async function updateOnChainMetrics(...) {
  const hash = await invokeIssuerContract([
    { functionName: 'update_metrics_raw', args: [...] },
    { functionName: 'update_score',       args: [wallet] },
  ]);
  return { metricsTxHash: hash, scoreTxHash: hash };
}
```

```typescript
// AFTER — two separate single-op transactions
async function invokeIssuerContractSingle(
  functionName: string,
  args: xdr.ScVal[],
) {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const builder = new TransactionBuilder(issuerAccount, {
    fee: "1000",
    networkPassphrase,
  });
  builder.addOperation(
    Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(
            contractIds.creditRegistry,
          ).toScAddress(),
          functionName,
          args,
        }),
      ),
      auth: [],
    }),
  );
  const tx = builder.setTimeout(180).build();
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(issuerKeypair);
  const response = await rpcServer.sendTransaction(prepared);
  if (response.status !== "PENDING") {
    throw new Error(
      `Issuer transaction failed: ${JSON.stringify(response.errorResult ?? response)}`,
    );
  }
  await pollTransaction(response.hash);
  return response.hash;
}

export async function updateOnChainMetrics(
  walletAddress: string,
  metrics: WalletMetrics,
) {
  const wallet = Address.fromString(walletAddress).toScVal();

  // Two sequential single-op transactions — Soroban does not allow multi-op txs
  const metricsTxHash = await invokeIssuerContractSingle("update_metrics_raw", [
    wallet,
    nativeToScVal(metrics.txCount, { type: "u32" }),
    nativeToScVal(metrics.repaymentCount, { type: "u32" }),
    nativeToScVal(metrics.xlmBalance, { type: "u32" }),
    nativeToScVal(metrics.defaultCount, { type: "u32" }),
  ]);

  const scoreTxHash = await invokeIssuerContractSingle("update_score", [
    wallet,
  ]);

  return { metricsTxHash, scoreTxHash };
}
```

Also delete the old `invokeIssuerContract` function entirely — it is no longer used.

---

## Fix 2 — `POST /api/tx/sign-and-submit` (repay tx) → 500

**Error:** `txFeeBumpInnerFailed / txBadSeq`
**Files:** `backend/src/routes/loan.ts`, `frontend/app/loan/repay/page.tsx`

### Root Cause

The repay flow builds **both** unsigned XDRs (`approve` + `repay`) in a single
`POST /loan/repay` call, at the same moment, against the same account sequence number N.

```
POST /loan/repay
  → approve XDR built with seq N
  → repay   XDR built with seq N   ← stale before the user even signs it
```

Then:

1. User signs approve (seq N) → submitted → chain sequence becomes **N+1**
2. User signs repay (seq N) → submitted → **`txBadSeq`** because chain now expects N+1

The user's signature is over the sequence number. You cannot patch it after signing.
Retrying with a new fee-bump wrapping the same stale inner tx will always fail.

### Fix

Build the repay XDR **after** the approve transaction has settled on-chain, not upfront.

Add a new `POST /loan/repay-xdr` endpoint that builds a fresh repay XDR on demand:

```typescript
// backend/src/routes/loan.ts — add after the existing /repay route

router.post(
  "/repay-xdr",
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const loan = await getLoanFromChain(wallet);

    if (!loan || loan.repaid || loan.defaulted) {
      throw badRequest("No repayable loan found");
    }

    // Build against the CURRENT sequence number — approve has already settled by now
    const unsignedRepayXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      "repay",
      [Address.fromString(wallet).toScVal()],
    );

    res.json({ unsignedXdr: unsignedRepayXdr });
  }),
);
```

Update `POST /loan/repay` to return **only** the approve XDR (drop the repay XDR from the response):

```typescript
// In the existing /repay route, change the response shape:
const response: RepayResponse = {
  requiresSignature: true,
  transactions: [
    {
      type: "approve",
      unsignedXdr: unsignedApproveXdr,
      description: `Authorize pool to spend ${toPhpAmount(totalOwedStroops)} PHPC`,
    },
    // repay XDR removed — fetched separately after approve confirms
  ],
  summary,
};
```

Update `frontend/app/loan/repay/page.tsx` — after the approve tx confirms,
call `POST /loan/repay-xdr` to get a fresh repay XDR, then sign and submit it:

```typescript
// After approve is submitted successfully:
approvalCompleted = true;
setApprovalSubmitted(true);

// Fetch a freshly-sequenced repay XDR (account seq is now N+1)
setTxStep(4);
const { data: repayXdrData } = await api.post("/loan/repay-xdr");
const repayUnsignedXdr = repayXdrData.unsignedXdr;

// Sign it
const repayResult = await signTx(repayUnsignedXdr, user.wallet);
if ("error" in repayResult) throw new Error(`REPAY_SIGN:${repayResult.error}`);

// Submit it
setTxStep(5);
const finalResult = await api.post("/tx/sign-and-submit", {
  signedInnerXdr: [repayResult.signedXdr],
  flow: { action: "repay", step: "repay" },
});
setSuccess(finalResult.data);
```

Also remove the `repayUnsignedXdr` state and `approvalSubmitted` state from the component —
they are no longer needed since the XDR is fetched fresh each time.

---

## Summary

| #   | File(s)                                                           | Error                                          | Fix                                                                                                                   |
| --- | ----------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `backend/src/stellar/issuer.ts`                                   | `Transaction contains more than one operation` | Replace multi-op `invokeIssuerContract` with a single-op helper; call it twice sequentially in `updateOnChainMetrics` |
| 2   | `backend/src/routes/loan.ts` + `frontend/app/loan/repay/page.tsx` | `txBadSeq` on repay fee-bump                   | Add `POST /loan/repay-xdr` endpoint; frontend fetches a fresh repay XDR **after** approve confirms on-chain           |

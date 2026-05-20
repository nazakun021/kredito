#!/bin/bash
set -e

NETWORK="testnet"
SOURCE="issuer"
ISSUER_PUB=$(stellar keys address "$SOURCE")
WASM_DIR="target/wasm32v1-none/release"

XLM_SAC_TESTNET="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
XLM_SAC_MAINNET="CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
if [ "$NETWORK" == "mainnet" ]; then
  XLM_SAC="$XLM_SAC_MAINNET"
else
  XLM_SAC="$XLM_SAC_TESTNET"
fi

# Step 1: Building fresh WASMs
stellar contract build --package lending_pool
stellar contract build --package credit_registry

echo ""
echo "=== Step 2: Deploying new credit_registry ==="
REGISTRY_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/credit_registry.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ REGISTRY_ID: $REGISTRY_ID"

echo ""
echo "=== Step 3: Initializing credit_registry ==="
stellar contract invoke --id $REGISTRY_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --issuer $ISSUER_PUB \
  --tier1_limit 10000000 \
  --tier2_limit 50000000 \
  --tier3_limit 200000000 \
  --kyc_tier_limit 1000000000
echo "✅ credit_registry initialized"

echo ""
echo "=== Step 4: Deploying new lending_pool ==="
LENDING_POOL_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/lending_pool.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ LENDING_POOL_ID: $LENDING_POOL_ID"

echo ""
echo "=== Step 5: Initializing lending_pool ==="
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --registry_id $REGISTRY_ID \
  --xlm_token $XLM_SAC \
  --flat_fee_bps 500 \
  --loan_term_ledgers 518400
echo "✅ lending_pool initialized"

echo ""
echo "=== Step 6: Approving lending_pool to spend issuer XLM ==="
CURRENT_LEDGER=$(stellar ledger latest --network $NETWORK --output json | jq -r '.sequence')
EXPIRY_LEDGER=$((CURRENT_LEDGER + 2000000))

stellar contract invoke --id $XLM_SAC --source $SOURCE --network $NETWORK -- \
  approve \
  --from $ISSUER_PUB \
  --spender $LENDING_POOL_ID \
  --amount 10000000000 \
  --expiration_ledger $EXPIRY_LEDGER
echo "✅ Approval set"

echo ""
echo "=== Step 7: Depositing 1,000 XLM into lending_pool ==="
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  deposit \
  --amount 10000000000
echo "✅ Pool funded"

echo ""
echo "=== Step 8: Saving deployed.json ==="
cat > deployed.json << EOF
{
  "network": "$NETWORK",
  "contracts": {
    "credit_registry": "$REGISTRY_ID",
    "lending_pool": "$LENDING_POOL_ID"
  },
  "xlm_sac": "$XLM_SAC",
  "issuer_public": "$ISSUER_PUB",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "notes": "lending_pool and credit_registry redeployed for Hackathon 2026."
}
EOF
echo "✅ deployed.json updated"

echo ""
echo "=== ✅ REDEPLOYMENT COMPLETE ==="
echo "LENDING_POOL_ID:  $LENDING_POOL_ID"
echo "REGISTRY_ID:      $REGISTRY_ID"
echo "XLM_SAC:          $XLM_SAC"
echo ""
echo "=== Update your backend/.env with: ==="
echo "LENDING_POOL_ID=$LENDING_POOL_ID"
echo "REGISTRY_ID=$REGISTRY_ID"
echo "XLM_SAC_ID=$XLM_SAC"

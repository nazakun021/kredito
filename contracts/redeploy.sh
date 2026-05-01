#!/bin/bash
set -e

NETWORK="testnet"
SOURCE="issuer"
ISSUER_PUB=$(stellar keys address "$SOURCE")
WASM_DIR="target/wasm32v1-none/release"

# Step 1: Building fresh WASMs
stellar contract build --package phpc_token
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
  --tier1_limit 50000000000 \
  --tier2_limit 200000000000 \
  --tier3_limit 500000000000
echo "✅ credit_registry initialized"

echo ""
echo "=== Step 4: Deploying new phpc_token ==="
PHPC_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/phpc_token.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ PHPC_ID: $PHPC_ID"

echo ""
echo "=== Step 5: Initializing phpc_token ==="
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --decimal 7 \
  --name "Philippine Peso Coin" \
  --symbol "PHPC"
echo "✅ phpc_token initialized"

echo ""
echo "=== Step 6: Deploying new lending_pool ==="
LENDING_POOL_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/lending_pool.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ LENDING_POOL_ID: $LENDING_POOL_ID"

echo ""
echo "=== Step 7: Initializing lending_pool ==="
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --registry_id $REGISTRY_ID \
  --phpc_token $PHPC_ID \
  --flat_fee_bps 500 \
  --loan_term_ledgers 518400
echo "✅ lending_pool initialized"

echo ""
echo "=== Step 8: Minting 100,000,000 PHPC to issuer ==="
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  mint \
  --to $ISSUER_PUB \
  --amount 1000000000000000
echo "✅ PHPC minted"

echo ""
echo "=== Step 9: Approving lending_pool to spend issuer PHPC ==="
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  approve \
  --from $ISSUER_PUB \
  --spender $LENDING_POOL_ID \
  --amount 1000000000000000 \
  --expiration_ledger 5000000
echo "✅ Approval set"

echo ""
echo "=== Step 10: Depositing 100,000,000 PHPC into lending_pool ==="
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  deposit \
  --amount 1000000000000000
echo "✅ Pool funded"

echo ""
echo "=== Step 11: Saving deployed.json ==="
cat > deployed.json << EOF
{
  "network": "$NETWORK",
  "contracts": {
    "credit_registry": "$REGISTRY_ID",
    "lending_pool": "$LENDING_POOL_ID",
    "phpc_token": "$PHPC_ID"
  },
  "issuer_public": "$ISSUER_PUB",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "notes": "phpc_token and lending_pool redeployed with fixed WASM. credit_registry unchanged."
}
EOF
echo "✅ deployed.json updated"

echo ""
echo "=== ✅ REDEPLOYMENT COMPLETE ==="
echo "PHPC_ID:          $PHPC_ID"
echo "LENDING_POOL_ID:  $LENDING_POOL_ID"
echo "REGISTRY_ID:      $REGISTRY_ID"
echo ""
echo "=== Update your backend/.env with: ==="
echo "PHPC_ID=$PHPC_ID"
echo "LENDING_POOL_ID=$LENDING_POOL_ID"
echo "REGISTRY_ID=$REGISTRY_ID"

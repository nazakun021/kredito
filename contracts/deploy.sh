#!/bin/bash
set -e

NETWORK="testnet"
SOURCE="issuer"
ISSUER_PUB="GBGKIBN3WUKPLUZIODCL7CS3L7QCTU7MAVXHMRX5DGPCTHBGMST47ABV"
WASM_DIR="target/wasm32v1-none/release"

echo "Deploying phpc_token..."
PHPC_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/phpc_token.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "PHPC_ID: $PHPC_ID"

echo "Initializing phpc_token..."
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --decimal 7 \
  --name "Philippine Peso Coin" \
  --symbol "PHPC"

echo "Deploying credit_registry..."
REGISTRY_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/credit_registry.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "REGISTRY_ID: $REGISTRY_ID"

echo "Initializing credit_registry..."
# tier1_limit = 5,000 PHPC × 10^7 = 50,000,000,000 stroops
# tier2_limit = 20,000 PHPC × 10^7 = 200,000,000,000 stroops
# tier3_limit = 50,000 PHPC × 10^7 = 500,000,000,000 stroops
stellar contract invoke --id $REGISTRY_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --issuer $ISSUER_PUB \
  --tier1_limit 50000000000 \
  --tier2_limit 200000000000 \
  --tier3_limit 500000000000

echo "Deploying lending_pool..."
LENDING_POOL_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/lending_pool.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "LENDING_POOL_ID: $LENDING_POOL_ID"

echo "Initializing lending_pool..."
# loan_term_ledgers = 30 days × 17,280 ledgers/day = 518,400
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --registry_id $REGISTRY_ID \
  --phpc_token $PHPC_ID \
  --flat_fee_bps 500 \
  --loan_term_ledgers 518400

echo "Minting PHPC to issuer..."
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  mint \
  --to $ISSUER_PUB \
  --amount 1000000000000000

echo "Approving lending_pool to spend issuer's PHPC..."
# We use a high expiration ledger for the approval
stellar contract invoke --id $PHPC_ID --source $SOURCE --network $NETWORK -- \
  approve \
  --from $ISSUER_PUB \
  --spender $LENDING_POOL_ID \
  --amount 1000000000000000 \
  --expiration_ledger 5000000

echo "Depositing PHPC into lending_pool..."
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  deposit \
  --amount 1000000000000000

echo "Saving to deployed.json..."
cat > deployed.json << EOF
{
  "network": "$NETWORK",
  "phpc_token": "$PHPC_ID",
  "credit_registry": "$REGISTRY_ID",
  "lending_pool": "$LENDING_POOL_ID",
  "issuer_public": "$ISSUER_PUB",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Deployment complete!"

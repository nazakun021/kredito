#!/bin/bash
set -e
set -o pipefail  

NETWORK="testnet"
SOURCE="${STELLAR_SOURCE_ACCOUNT:-issuer}"
ISSUER_PUB=$(stellar keys address "$SOURCE")
WASM_DIR="target/wasm32v1-none/release"

XLM_SAC_TESTNET="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
XLM_SAC_MAINNET="CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
if [ "$NETWORK" == "mainnet" ]; then
  XLM_SAC="$XLM_SAC_MAINNET"
else
  XLM_SAC="$XLM_SAC_TESTNET"
fi

echo "Deploying credit_registry..."
REGISTRY_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/credit_registry.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "REGISTRY_ID: $REGISTRY_ID"

echo "Initializing credit_registry..."
stellar contract invoke --id $REGISTRY_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --issuer $ISSUER_PUB \
  --tier1_limit 10000000 \
  --tier2_limit 50000000 \
  --tier3_limit 200000000 \
  --kyc_tier_limit 1000000000

echo "Deploying lending_pool..."
LENDING_POOL_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/lending_pool.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "LENDING_POOL_ID: $LENDING_POOL_ID"

echo "Initializing lending_pool..."
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --registry_id $REGISTRY_ID \
  --xlm_token $XLM_SAC \
  --flat_fee_bps 500 \
  --loan_term_ledgers 518400

echo "Fetching current ledger..."
CURRENT_LEDGER=$(stellar ledger latest --network $NETWORK --output json | jq -r '.sequence')

if [[ -z "$CURRENT_LEDGER" || ! "$CURRENT_LEDGER" =~ ^[0-9]+$ ]]; then
  echo "❌ Failed to fetch current ledger. Check your network connection."
  exit 1
fi

EXPIRY_LEDGER=$((CURRENT_LEDGER + 2000000))
echo "Current ledger: $CURRENT_LEDGER → expiry: $EXPIRY_LEDGER"

echo "Approving lending_pool to spend issuer's XLM..."
stellar contract invoke --id $XLM_SAC --source $SOURCE --network $NETWORK -- \
  approve \
  --from $ISSUER_PUB \
  --spender $LENDING_POOL_ID \
  --amount 10000000000 \
  --expiration_ledger $EXPIRY_LEDGER

echo "Depositing XLM into lending_pool..."
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  deposit \
  --amount 10000000000

echo "Saving to deployed.json..."
cat > deployed.json << EOF
{
  "network": "$NETWORK",
  "contracts": {
    "credit_registry": "$REGISTRY_ID",
    "lending_pool": "$LENDING_POOL_ID"
  },
  "xlm_sac": "$XLM_SAC",
  "issuer_public": "$ISSUER_PUB",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Deployment complete!"

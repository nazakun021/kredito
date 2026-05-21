#!/bin/bash
set -e
set -o pipefail  

NETWORK="mainnet"
SOURCE="${STELLAR_SOURCE_ACCOUNT:-issuer}"
ISSUER_PUB=$(stellar keys address "$SOURCE")
WASM_DIR="target/wasm32v1-none/release"

XLM_SAC="CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"

# Change to contracts directory
cd "$(dirname "$0")"

echo "🚀 Starting Mainnet Deployment..."
echo "Issuer/Admin address: $ISSUER_PUB"

echo ""
echo "=== Step 1: Deploying credit_registry ==="
REGISTRY_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/credit_registry.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ REGISTRY_ID: $REGISTRY_ID"

echo ""
echo "=== Step 2: Initializing credit_registry ==="
stellar contract invoke --id $REGISTRY_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --issuer $ISSUER_PUB \
  --tier1_limit 10000000 \
  --tier2_limit 50000000 \
  --tier3_limit 200000000 \
  --kyc_tier_limit 1000000000
echo "✅ credit_registry initialized!"

echo ""
echo "=== Step 3: Deploying lending_pool ==="
LENDING_POOL_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/lending_pool.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ LENDING_POOL_ID: $LENDING_POOL_ID"

echo ""
echo "=== Step 4: Initializing lending_pool ==="
stellar contract invoke --id $LENDING_POOL_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --admin $ISSUER_PUB \
  --registry_id $REGISTRY_ID \
  --xlm_token $XLM_SAC \
  --flat_fee_bps 500 \
  --loan_term_ledgers 518400
echo "✅ lending_pool initialized!"

echo ""
echo "=== Step 5: Updating deployed-mainnet.json ==="
cat > deployed-mainnet.json << EOF
{
  "network": "$NETWORK",
  "contracts": {
    "credit_registry": "$REGISTRY_ID",
    "lending_pool": "$LENDING_POOL_ID"
  },
  "xlm_sac": "$XLM_SAC",
  "issuer_public": "$ISSUER_PUB",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "notes": "Mainnet deployment for Kredito (Hackathon PH 2026)."
}
EOF
echo "✅ deployed-mainnet.json saved!"

echo ""
echo "=== ✨ MAINNET DEPLOYMENT COMPLETE ==="
echo "REGISTRY_ID:      $REGISTRY_ID"
echo "LENDING_POOL_ID:  $LENDING_POOL_ID"
echo "XLM_SAC:          $XLM_SAC"
echo "======================================"

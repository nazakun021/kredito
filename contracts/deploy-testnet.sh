#!/bin/bash
set -e

# Phase 4A: Testnet Deployment Script
# Deploys credit_registry and lending_pool to Stellar Testnet

NETWORK="testnet"
SOURCE="issuer"
ISSUER_PUB=$(stellar keys address "$SOURCE")
WASM_DIR="target/wasm32v1-none/release"

# Native XLM SAC ID for Testnet
XLM_SAC="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# Change to contracts directory if not already there
cd "$(dirname "$0")"

echo "🚀 Starting Testnet Deployment..."
echo "Issuer: $ISSUER_PUB"

# Step 1: Building fresh WASMs
echo ""
echo "=== Step 1: Building Contracts ==="
stellar contract build --package lending_pool
stellar contract build --package credit_registry

echo ""
echo "=== Step 2: Deploying credit_registry ==="
REGISTRY_ID=$(stellar contract deploy \
  --wasm $WASM_DIR/credit_registry.wasm \
  --source $SOURCE \
  --network $NETWORK)
echo "✅ REGISTRY_ID: $REGISTRY_ID"

echo ""
echo "=== Step 3: Initializing credit_registry ==="
# Tier limits: 1 XLM, 5 XLM, 20 XLM, and 100 XLM (KYC)
stellar contract invoke --id $REGISTRY_ID --source $SOURCE --network $NETWORK -- \
  initialize \
  --issuer $ISSUER_PUB \
  --tier1_limit 10000000 \
  --tier2_limit 50000000 \
  --tier3_limit 200000000 \
  --kyc_tier_limit 1000000000
echo "✅ credit_registry initialized"

echo ""
echo "=== Step 4: Deploying lending_pool ==="
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
# Get current ledger for expiration
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
  "notes": "Testnet deployment for Hackathon 2026."
}
EOF
echo "✅ deployed.json updated"

echo ""
echo "=== ✨ TESTNET DEPLOYMENT COMPLETE ==="
echo "LENDING_POOL_ID:  $LENDING_POOL_ID"
echo "REGISTRY_ID:      $REGISTRY_ID"
echo "XLM_SAC:          $XLM_SAC"
echo ""
echo "=== Next: Update your .env files ==="

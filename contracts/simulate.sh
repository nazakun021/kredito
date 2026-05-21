#!/bin/bash
set -e

# Change to contracts directory
cd "$(dirname "$0")"

echo "🔨 Building fresh WASMs..."
stellar contract build --package credit_registry
stellar contract build --package lending_pool

echo "📦 Generating Transaction XDRs via testnet dry-run..."
XDR_REGISTRY=$(stellar contract upload --wasm target/wasm32v1-none/release/credit_registry.wasm --source issuer --network testnet --build-only)
XDR_POOL=$(stellar contract upload --wasm target/wasm32v1-none/release/lending_pool.wasm --source issuer --network testnet --build-only)

simulate_rpc() {
  local url=$1
  local xdr=$2
  curl -s -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"simulateTransaction\",\"params\":{\"transaction\":\"$xdr\"}}"
}

echo "🌐 Simulating on Mainnet RPC..."
RESP_REGISTRY_MAINNET=$(simulate_rpc "https://mainnet.sorobanrpc.com" "$XDR_REGISTRY")
RESP_POOL_MAINNET=$(simulate_rpc "https://mainnet.sorobanrpc.com" "$XDR_POOL")

echo "🌐 Simulating on Testnet RPC..."
RESP_REGISTRY_TESTNET=$(simulate_rpc "https://soroban-testnet.stellar.org" "$XDR_REGISTRY")
RESP_POOL_TESTNET=$(simulate_rpc "https://soroban-testnet.stellar.org" "$XDR_POOL")

parse_fee() {
  local resp=$1
  local name=$2
  local network=$3
  
  local error=$(echo "$resp" | jq -r '.error.message // empty')
  if [ -n "$error" ]; then
    echo "❌ $network - $name error: $error"
    return
  fi
  
  local minFee=$(echo "$resp" | jq -r '.result.minResourceFee // empty')
  if [ -z "$minFee" ] || [ "$minFee" = "null" ]; then
    local err_detail=$(echo "$resp" | jq -c '.error // empty')
    if [ -z "$err_detail" ]; then
      err_detail=$(echo "$resp" | jq -c '.result.error // empty')
    fi
    echo "❌ $network - $name failed to simulate: $err_detail"
  else
    # Stroops to XLM (divide by 10,000,000 using bc or awk)
    local xlm=$(awk "BEGIN {print $minFee / 10000000}")
    echo "✅ $network - $name: $minFee stroops = $xlm XLM"
  fi
}

echo ""
echo "=== SIMULATION RESULTS ==="
parse_fee "$RESP_REGISTRY_MAINNET" "credit_registry" "Mainnet"
parse_fee "$RESP_POOL_MAINNET" "lending_pool" "Mainnet"
echo "-----------------------------------"
parse_fee "$RESP_REGISTRY_TESTNET" "credit_registry" "Testnet"
parse_fee "$RESP_POOL_TESTNET" "lending_pool" "Testnet"

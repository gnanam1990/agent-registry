#!/usr/bin/env bash
#
# Live smoke on Arc testnet against the DEPLOYED contracts: register agent A + B,
# A attests about B, then A escrows USDC for B and releases it. Prints real tx hashes.
#
# Why not `forge script`? Arc's native USDC calls a system precompile
# (0x1800…0001, blocklist) inside transferFrom. `forge script` runs the whole flow in a
# LOCAL EVM first, which doesn't implement that precompile → the simulation reverts with
# StackUnderflow and never broadcasts. `cast send` estimates + sends against the real node
# (which HAS the precompile), so the escrow deposit works. Script logic is unchanged — this
# just bypasses the local simulation. (Smoke.s.sol stays valid for local/anvil/mock runs.)
#
# Requires a populated, funded .env (DEPLOYER_PRIVATE_KEY holds test USDC; AGENT_B_PRIVATE_KEY
# funded for gas; deployed *_ADDRESS vars). TESTNET ONLY. Keys are never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

RPC="${ARC_RPC_URL:?set ARC_RPC_URL}"
AMOUNT="${SMOKE_AMOUNT:-1000000}"      # $1.00 in 6-decimal USDC
DATA=$(cast keccak "completed a transaction")
EXPLORER="https://testnet.arcscan.app/tx"

A=$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")
B=$(cast wallet address --private-key "$AGENT_B_PRIVATE_KEY")

# send <label> <key> <to> <sig> [args...] — broadcasts, waits for the receipt, prints the hash.
send() {
  local label="$1" key="$2" to="$3" sig="$4"; shift 4
  local hash
  hash=$(cast send --private-key "$key" --rpc-url "$RPC" --json "$to" "$sig" "$@" | jq -r '.transactionHash')
  echo "  ✓ $label"
  echo "      tx: $hash"
  echo "      $EXPLORER/$hash"
}

echo "== live smoke on Arc testnet (chain 5042002) =="
echo "agent A (payer/attester): $A"
echo "agent B (payee/subject):  $B"
echo "escrow amount:            $AMOUNT (6-dec USDC)"
echo

# 1) register both agents (idempotent)
if [ "$(cast call "$REGISTRY_ADDRESS" 'isRegistered(address)(bool)' "$A" --rpc-url "$RPC")" = "false" ]; then
  send "register agent A" "$DEPLOYER_PRIVATE_KEY" "$REGISTRY_ADDRESS" "registerAgent(string)" "ipfs://agent-a"
else echo "  • agent A already registered — skip"; fi
if [ "$(cast call "$REGISTRY_ADDRESS" 'isRegistered(address)(bool)' "$B" --rpc-url "$RPC")" = "false" ]; then
  send "register agent B" "$AGENT_B_PRIVATE_KEY" "$REGISTRY_ADDRESS" "registerAgent(string)" "ipfs://agent-b"
else echo "  • agent B already registered — skip"; fi

# 2) A attests about B (idempotent)
if [ "$(cast call "$ATTESTATIONS_ADDRESS" 'hasAttested(address,address)(bool)' "$A" "$B" --rpc-url "$RPC")" = "false" ]; then
  send "attest A -> B" "$DEPLOYER_PRIVATE_KEY" "$ATTESTATIONS_ADDRESS" "attest(address,bytes32)" "$B" "$DATA"
else echo "  • A already attested B — skip"; fi

# 3) escrow: approve -> createEscrow -> release
send "approve escrow" "$DEPLOYER_PRIVATE_KEY" "$USDC_ADDRESS" "approve(address,uint256)" "$ESCROW_ADDRESS" "$AMOUNT"
ID=$(cast call "$ESCROW_ADDRESS" "nextEscrowId()(uint256)" --rpc-url "$RPC")
NOW=$(cast block latest -f timestamp --rpc-url "$RPC")
DEADLINE=$((NOW + 86400))
send "createEscrow (id $ID)" "$DEPLOYER_PRIVATE_KEY" "$ESCROW_ADDRESS" "createEscrow(address,uint256,uint64)" "$B" "$AMOUNT" "$DEADLINE"
send "release (id $ID)" "$DEPLOYER_PRIVATE_KEY" "$ESCROW_ADDRESS" "release(uint256)" "$ID"

echo
echo "== smoke complete: agent registered, attestation posted, escrow deposit -> release =="

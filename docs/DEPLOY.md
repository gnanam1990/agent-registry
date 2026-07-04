# DEPLOY — Arc testnet (Stage 4)

Deploy `AgentRegistry` + `AgentAttestations` + `AgentEscrow` to **Arc testnet** (chain `5042002`),
verify their source on the Arcscan (Blockscout) explorer, and run a live smoke. **Testnet only — never
mainnet.** Deploying is a **human step** (it needs a funded key and is irreversible — the contracts are
immutable), so a maintainer runs the commands below.

## 0. Prerequisites

- **Funded deployer key** — on Arc, gas is paid in **native USDC**, so the deployer address needs
  testnet gas from <https://faucet.circle.com>. This is `DEPLOYER_PRIVATE_KEY` (agent A / payer).
- **Test USDC (ERC-20)** for the escrow smoke — the payer must hold ≥ `SMOKE_AMOUNT` (default `$1.00`)
  of the 6-decimal USDC at `0x3600…0000`.
- **A second funded key** — `AGENT_B_PRIVATE_KEY` (agent B / payee / subject), needs gas only.
- `.env` filled (copy `.env.example`). **The key values are never committed and never printed.**

```bash
cp .env.example .env    # then fill DEPLOYER_PRIVATE_KEY, AGENT_B_PRIVATE_KEY
git check-ignore .env   # must print ".env"  → confirms it is gitignored before you add a key
```

## 1. Deploy (+ verify in one step)

`forge script` reads `USDC_ADDRESS` + `DEPLOYER_PRIVATE_KEY` from `.env` (the USDC address is a
constructor arg — never hardcoded). Verification uses Blockscout (`--verifier blockscout`), whose URL
was confirmed as `https://testnet.arcscan.app/api/` (API key optional).

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.testnet.arc.network \
  --broadcast \
  --verify --verifier blockscout --verifier-url https://testnet.arcscan.app/api/
```

The run prints the three deployed addresses. If verification is skipped or fails inline, verify each
contract on its own (constructor args must be ABI-encoded):

```bash
forge verify-contract $REGISTRY_ADDRESS src/AgentRegistry.sol:AgentRegistry \
  --rpc-url https://rpc.testnet.arc.network --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api/ --watch

forge verify-contract $ATTESTATIONS_ADDRESS src/AgentAttestations.sol:AgentAttestations \
  --rpc-url https://rpc.testnet.arc.network --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" $REGISTRY_ADDRESS) --watch

forge verify-contract $ESCROW_ADDRESS src/AgentEscrow.sol:AgentEscrow \
  --rpc-url https://rpc.testnet.arc.network --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address)" $USDC_ADDRESS $REGISTRY_ADDRESS) --watch
```

## 2. Record the deployment

Fill `deployments/arc-testnet.json` (`contracts.*.address`, `.txHash`, `deployer`, `deployedAt`) and
the `*_ADDRESS` vars in `.env`. Tx hashes are in `broadcast/Deploy.s.sol/5042002/run-latest.json`. ABIs
are already checked in under `deployments/abi/`. Confirm each contract shows **Verified** at
`https://testnet.arcscan.app/address/<address>`.

## 3. Live smoke (register → attest → escrow deposit→release)

Run it with **`script/smoke.sh`** (cast) — NOT `forge script`:

```bash
bash script/smoke.sh
```

It registers agent A + B, has A attest about B, then A escrows `SMOKE_AMOUNT` USDC for B and releases
it, printing each real tx hash + explorer link.

> Why not `forge script` here? Arc's native USDC calls a system precompile (`0x1800…0001`, blocklist)
> inside `transferFrom`. `forge script` runs the whole flow in a **local** EVM first, which doesn't
> implement that precompile → it reverts with `StackUnderflow` and never broadcasts. `cast` sends
> straight to the real node (which has the precompile), so the escrow deposit works. `Smoke.s.sol`
> stays valid for local/anvil/mock runs.

## Safety

- `.env`/keys are gitignored and never committed or printed. Nothing here runs in CI (CI has no keys).
- The deploy refuses a non-6-decimal `USDC_ADDRESS` (a decimals mistake on an immutable escrow is
  unrecoverable). **No mainnet.**

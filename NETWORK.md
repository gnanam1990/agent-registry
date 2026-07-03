# NETWORK.md — Arc testnet deploy config

Verified values for deploying `agent-registry` to the Arc **public testnet**. Carried over from the
`arcpayments` project's verified `NETWORK.md` (Stage 0, 2026-07-03). All values are read by code from
env / config — **never hardcoded** in a contract. **Testnet only; no mainnet in v1.**

## Arc testnet

| Key | Value | Source | Status |
|-----|-------|--------|--------|
| RPC URL | `https://rpc.testnet.arc.network` | <https://docs.arc.io/arc/references/connect-to-arc> | ✅ verified |
| Chain ID | `5042002` | <https://docs.arc.io/arc/references/connect-to-arc> | ✅ verified |
| Explorer | `https://testnet.arcscan.app` | <https://docs.arc.io/arc/references/connect-to-arc> | ✅ verified |
| Faucet | `https://faucet.circle.com` | <https://docs.arc.io/arc/references/connect-to-arc> | ✅ verified |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | <https://docs.arc.io/arc/references/contract-addresses> | ✅ verified |
| USDC decimals (ERC-20) | **6** | Arc contract-addresses page + arcpayments NETWORK.md | ✅ verified |

**Decimals caveat (carried lesson):** Arc uses USDC as the *native gas token* with **18-decimal**
gas-math representation, but the USDC **ERC-20 token is 6 decimals**. The escrow (Stage 3) deals in the
**6-decimal ERC-20**. Never conflate the two; never assume 18.

## Solc / EVM

- **Solidity:** pinned `0.8.24` (`foundry.toml`).
- **evm_version:** `paris` — a conservative floor (no PUSH0 / transient-storage assumptions). **Confirm
  Arc's supported EVM version before the Stage 4 deploy** and bump to `shanghai`/`cancun` only once
  verified. Deterministic bytecode (`bytecode_hash = "none"`, `cbor_metadata = false`) for clean source
  verification on the explorer.

## Deploy config → env

Deploy scripts (Stage 4) read these from env (`.env`, gitignored). See `.env.example`:

| Env var | Purpose |
|---------|---------|
| `ARC_RPC_URL` | Arc testnet RPC (also `foundry.toml` `[rpc_endpoints] arc_testnet`) |
| `ARC_CHAIN_ID` | `5042002` |
| `ARC_EXPLORER_URL` | explorer base for verification/links |
| `USDC_ADDRESS` | USDC ERC-20 — a **constructor arg** to the escrow, not a hardcoded constant |
| `USDC_DECIMALS` | `6` |
| `DEPLOYER_PRIVATE_KEY` | testnet deploy key — filled locally, **never committed** |

> Not affiliated with, or endorsed by, Circle or Arc. Community primitive for the Arc ecosystem.

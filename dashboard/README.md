# agent-registry dashboard

A **read-only** view of the three verified `agent-registry` contracts on Arc testnet — registered
agents, their attestations/reputation, and escrow status (open / released / refunded).

**No wallet, no keys, no writes.** It only calls view methods and reads event logs via viem, then
serves a self-contained dark/violet page from `node:http`. Addresses, ABIs, RPC, and the deploy block
all come from [`../deployments/`](../deployments/) — nothing is re-hardcoded here.

## Run

```bash
bun install
bun run src/index.ts          # → http://127.0.0.1:4025
```

Overrides (both optional):

```bash
ARC_RPC_URL=https://rpc.testnet.arc.network PORT=4025 bun run src/index.ts
```

State refreshes every 15s in the browser and is cached server-side for 8s.

## Test / typecheck

```bash
bun test          # pure model-assembly unit tests (src/read.ts)
bun run typecheck # tsc --noEmit
```

## Layout

| File | Role |
| --- | --- |
| `src/config.ts` | Loads addresses/ABIs/RPC/deployBlock from `../deployments`; builds the viem client. |
| `src/read.ts` | `assembleModel` (pure, tested) + `readOnChain` (chunked `getLogs` under Arc's 10k-block cap). |
| `src/page.ts` | Self-contained HTML/CSS/JS for the dashboard page. |
| `src/server.ts` | `node:http` server: `/` serves the page, `/api/state` serves the model as JSON. |
| `src/index.ts` | Entry point. |
| `test/read.test.ts` | Unit tests for the model assembly. |

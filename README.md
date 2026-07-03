# agent-registry

**A composable on-chain primitive for the agent economy on Arc** — an agent identity + reputation
registry (Know-Your-Agent) plus a minimal USDC escrow, as clean, reusable Solidity that other Arc
projects can import. Contracts are the product; a small read-only dashboard is the shop window.

> ⚠️ **Testnet only** — deployed to the Arc **public testnet**; all USDC is test-value. **Not affiliated
> with, or endorsed by, Circle or Arc.** Community primitive for the Arc ecosystem. (Working name
> `agent-registry`; rename-safe.)

## Why the extra rigor

Deployed contracts are **immutable** — a bug can't be patched and security flaws lose funds. So:
**Slither** runs every stage and a finding is treated like a failing test; tests are written first (TDD);
and only known-safe patterns are used (checks-effects-interactions, `ReentrancyGuard`, `SafeERC20`, no
`tx.origin`, pull-over-push). USDC on Arc is **6 decimals** — never assumed 18, never hardcoded.

## Stack

- **Foundry** (forge/cast/anvil), Solidity `0.8.24`, `forge-std`, `forge fmt`.
- **Slither** static analysis in CI.
- Arc testnet (chain `5042002`), USDC at the verified 6-decimal ERC-20 address (see `NETWORK.md`).

## Develop

```bash
forge build
forge test
forge fmt --check
slither .            # static analysis — must be clean
```

## Status

Built in public, stage by stage (each stage = a git tag; TDD + Slither every stage).

- **Stage 0 — scaffold + verify** (this): Foundry + CI (build + test + Slither), Arc testnet deploy
  config recorded, one trivial passing test. Next: `AgentRegistry` (Stage 1).

## License

MIT — see `LICENSE`.

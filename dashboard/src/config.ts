import { createPublicClient, defineChain, http, type PublicClient } from "viem";
import registryAbi from "../../deployments/abi/AgentRegistry.json";
import attestationsAbi from "../../deployments/abi/AgentAttestations.json";
import escrowAbi from "../../deployments/abi/AgentEscrow.json";
import deployment from "../../deployments/arc-testnet.json";

/**
 * Read-only dashboard config. Everything comes from the on-chain deployment record
 * (`deployments/arc-testnet.json`) + the checked-in ABIs — addresses are never
 * re-hardcoded here. The RPC can be overridden with `ARC_RPC_URL`.
 */

export const rpcUrl = process.env.ARC_RPC_URL?.trim() || deployment.rpcUrl;
export const explorer = deployment.explorer;
// Lower bound for log scanning — the block the contracts were deployed at (nothing before it).
export const deployBlock = BigInt(deployment.deployBlock);
// Arc's Blockscout RPC caps eth_getLogs to a 10,000-block range; stay safely under it.
export const LOG_RANGE = 9000n;

export const addresses = {
  registry: deployment.contracts.AgentRegistry.address as `0x${string}`,
  attestations: deployment.contracts.AgentAttestations.address as `0x${string}`,
  escrow: deployment.contracts.AgentEscrow.address as `0x${string}`,
  usdc: deployment.usdc.address as `0x${string}`,
} as const;

export const usdcDecimals = deployment.usdc.decimals;

export const abis = { registry: registryAbi, attestations: attestationsAbi, escrow: escrowAbi } as const;

export const arcTestnet = defineChain({
  id: deployment.chainId,
  name: "Arc Testnet",
  // Arc uses USDC as the native gas token (18-decimal gas representation).
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "Arcscan", url: explorer } },
});

export function createClient(): PublicClient {
  return createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
}

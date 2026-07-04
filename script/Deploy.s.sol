// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AgentAttestations } from "../src/AgentAttestations.sol";
import { AgentEscrow } from "../src/AgentEscrow.sol";
import { AgentRegistry } from "../src/AgentRegistry.sol";
import { IAgentRegistry } from "../src/IAgentRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Script, console2 } from "forge-std/Script.sol";

/// @notice Deploy the agent-registry primitive to Arc testnet: AgentRegistry, then
/// AgentAttestations + AgentEscrow wired to it and to the configured USDC. All config comes
/// from env — the USDC address is NEVER hardcoded, and the deployer key is read from `.env`
/// (never printed). Run with `--broadcast` to actually deploy. TESTNET ONLY — no mainnet.
contract Deploy is Script {
    function run() external {
        // ---- config (from .env; USDC address is not hardcoded) ----
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Refuse to wire the escrow to a token that isn't the 6-decimal USDC — a decimals mistake
        // on an immutable, funds-holding contract is unrecoverable.
        require(IERC20Metadata(usdc).decimals() == 6, "USDC_ADDRESS must be a 6-decimal token");

        vm.startBroadcast(deployerKey);

        AgentRegistry registry = new AgentRegistry();
        AgentAttestations attestations = new AgentAttestations(IAgentRegistry(address(registry)));
        AgentEscrow escrow = new AgentEscrow(IERC20(usdc), IAgentRegistry(address(registry)));

        vm.stopBroadcast();

        console2.log("== Deployed to Arc testnet (chain 5042002) ==");
        console2.log("USDC (config):    %s", usdc);
        console2.log("AgentRegistry:    %s", address(registry));
        console2.log("AgentAttestations:%s", address(attestations));
        console2.log("AgentEscrow:      %s", address(escrow));
    }
}

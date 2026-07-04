// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AgentAttestations } from "../src/AgentAttestations.sol";
import { AgentEscrow } from "../src/AgentEscrow.sol";
import { AgentRegistry } from "../src/AgentRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Script, console2 } from "forge-std/Script.sol";

/// @notice Live smoke on Arc testnet against the DEPLOYED contracts: agent A registers, agent B
/// registers, A attests about B, then A escrows USDC for B and releases it. Idempotent (safe to
/// re-run — registration/attestation are skipped if already present; each escrow is a fresh id).
///
/// Requires (in `.env`): the deployed addresses, USDC_ADDRESS, and TWO funded testnet keys —
/// DEPLOYER_PRIVATE_KEY (agent A / payer, must hold >= SMOKE_AMOUNT test USDC) and
/// AGENT_B_PRIVATE_KEY (agent B / payee, funded for gas). TESTNET ONLY.
contract Smoke is Script {
    function run() external {
        AgentRegistry registry = AgentRegistry(vm.envAddress("REGISTRY_ADDRESS"));
        AgentAttestations attestations = AgentAttestations(vm.envAddress("ATTESTATIONS_ADDRESS"));
        AgentEscrow escrow = AgentEscrow(vm.envAddress("ESCROW_ADDRESS"));
        IERC20 usdc = IERC20(vm.envAddress("USDC_ADDRESS"));

        uint256 keyA = vm.envUint("DEPLOYER_PRIVATE_KEY"); // agent A / payer / attester
        uint256 keyB = vm.envUint("AGENT_B_PRIVATE_KEY"); // agent B / payee / subject
        address agentA = vm.addr(keyA);
        address agentB = vm.addr(keyB);
        uint256 amount = vm.envOr("SMOKE_AMOUNT", uint256(1_000_000)); // $1.00 (6 decimals) default

        // 1) register both agents
        vm.startBroadcast(keyA);
        if (!registry.isRegistered(agentA)) registry.registerAgent("ipfs://agent-a");
        vm.stopBroadcast();

        vm.startBroadcast(keyB);
        if (!registry.isRegistered(agentB)) registry.registerAgent("ipfs://agent-b");
        vm.stopBroadcast();

        // 2) A attests about B ("completed a transaction")
        vm.startBroadcast(keyA);
        if (!attestations.hasAttested(agentA, agentB)) {
            attestations.attest(agentB, keccak256("completed a transaction"));
        }
        vm.stopBroadcast();

        // 3) A escrows USDC for B, then releases it to B
        vm.startBroadcast(keyA);
        usdc.approve(address(escrow), amount);
        uint256 id = escrow.createEscrow(agentB, amount, uint64(block.timestamp + 1 days));
        escrow.release(id);
        vm.stopBroadcast();

        console2.log("== Smoke complete on Arc testnet ==");
        console2.log("agent A (payer/attester): %s", agentA);
        console2.log("agent B (payee/subject):  %s", agentB);
        console2.log("escrow id:                %s", id);
        console2.log("amount (USDC base units): %s", amount);
    }
}

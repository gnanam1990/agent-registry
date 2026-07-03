// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AgentRegistry } from "../src/AgentRegistry.sol";
import { Test } from "forge-std/Test.sol";

contract AgentRegistryTest is Test {
    AgentRegistry internal registry;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    string internal constant URI = "ipfs://agent-alice";

    // Mirror the contract's events so `vm.expectEmit` can match them.
    event AgentRegistered(address indexed agent, string metadataURI, uint256 timestamp);
    event AgentUpdated(address indexed agent, string metadataURI, uint256 timestamp);

    function setUp() public {
        registry = new AgentRegistry();
    }

    function test_RegisterAgent_setsRecordAndEmits() public {
        vm.expectEmit(true, false, false, true);
        emit AgentRegistered(alice, URI, block.timestamp);

        vm.prank(alice);
        registry.registerAgent(URI);

        assertTrue(registry.isRegistered(alice));
        AgentRegistry.Agent memory a = registry.getAgent(alice);
        assertEq(a.metadataURI, URI);
        assertEq(a.registeredAt, uint64(block.timestamp));
        assertEq(a.updatedAt, uint64(block.timestamp));
    }

    function test_DuplicateRegister_reverts() public {
        vm.startPrank(alice);
        registry.registerAgent(URI);
        vm.expectRevert(AgentRegistry.AlreadyRegistered.selector);
        registry.registerAgent(URI);
        vm.stopPrank();
    }

    function test_EmptyMetadata_reverts() public {
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.EmptyMetadata.selector);
        registry.registerAgent("");
    }

    function test_UpdateMetadata_bySelf_updatesAndEmits() public {
        vm.prank(alice);
        registry.registerAgent(URI);

        vm.warp(block.timestamp + 100); // so updatedAt differs from registeredAt
        string memory newURI = "ipfs://agent-alice-v2";

        vm.expectEmit(true, false, false, true);
        emit AgentUpdated(alice, newURI, block.timestamp);
        vm.prank(alice);
        registry.updateMetadata(newURI);

        AgentRegistry.Agent memory a = registry.getAgent(alice);
        assertEq(a.metadataURI, newURI);
        assertEq(a.updatedAt, uint64(block.timestamp));
        assertGt(a.updatedAt, a.registeredAt);
    }

    function test_UpdateByUnregistered_reverts() public {
        vm.prank(bob);
        vm.expectRevert(AgentRegistry.NotRegistered.selector);
        registry.updateMetadata(URI);
    }

    /// @dev Ownership: an agent can only ever touch its OWN record (all mutations key
    /// on msg.sender), so alice updating cannot affect bob's record.
    function test_AgentCannotAffectAnother() public {
        vm.prank(alice);
        registry.registerAgent("ipfs://alice");
        vm.prank(bob);
        registry.registerAgent("ipfs://bob");

        vm.prank(alice);
        registry.updateMetadata("ipfs://alice-v2");

        assertEq(registry.getAgent(bob).metadataURI, "ipfs://bob"); // bob untouched
    }

    function test_UnregisteredReads() public {
        assertFalse(registry.isRegistered(bob));
        vm.expectRevert(AgentRegistry.NotRegistered.selector);
        registry.getAgent(bob);
    }
}

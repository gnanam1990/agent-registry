// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AgentAttestations } from "../src/AgentAttestations.sol";
import { AgentRegistry } from "../src/AgentRegistry.sol";
import { IAgentRegistry } from "../src/IAgentRegistry.sol";
import { Test } from "forge-std/Test.sol";

contract AgentAttestationsTest is Test {
    AgentRegistry internal registry;
    AgentAttestations internal attestations;

    address internal alice;
    uint256 internal alicePk;
    address internal bob;
    uint256 internal bobPk;
    address internal relayer = makeAddr("relayer");

    bytes32 internal constant DATA = keccak256("completed a transaction");

    bytes32 internal constant ATTEST_TYPEHASH = keccak256(
        "Attest(address attester,address subject,bytes32 data,uint256 nonce,uint256 deadline)"
    );

    event Attested(
        address indexed attester, address indexed subject, bytes32 data, uint256 timestamp
    );

    function setUp() public {
        registry = new AgentRegistry();
        attestations = new AgentAttestations(IAgentRegistry(address(registry)));
        (alice, alicePk) = makeAddrAndKey("alice");
        (bob, bobPk) = makeAddrAndKey("bob");
        vm.prank(alice);
        registry.registerAgent("ipfs://alice");
        vm.prank(bob);
        registry.registerAgent("ipfs://bob");
    }

    // ---- helpers -----------------------------------------------------------

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("AgentAttestations")),
                keccak256(bytes("1")),
                block.chainid,
                address(attestations)
            )
        );
    }

    function _sign(
        uint256 pk,
        address attester,
        address subject,
        bytes32 data,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(ATTEST_TYPEHASH, attester, subject, data, nonce, deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ---- direct attest -----------------------------------------------------

    function test_Attest_direct_storesAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit Attested(alice, bob, DATA, block.timestamp);

        vm.prank(alice);
        attestations.attest(bob, DATA);

        assertTrue(attestations.hasAttested(alice, bob));
        AgentAttestations.Attestation[] memory list = attestations.getAttestations(bob);
        assertEq(list.length, 1);
        assertEq(list[0].attester, alice);
        assertEq(list[0].subject, bob);
        assertEq(list[0].data, DATA);
    }

    function test_SelfAttest_blocked() public {
        vm.prank(alice);
        vm.expectRevert(AgentAttestations.SelfAttestation.selector);
        attestations.attest(alice, DATA);
    }

    function test_Duplicate_blocked() public {
        vm.startPrank(alice);
        attestations.attest(bob, DATA);
        vm.expectRevert(AgentAttestations.AlreadyAttested.selector);
        attestations.attest(bob, DATA);
        vm.stopPrank();
    }

    function test_UnregisteredSubject_blocked() public {
        address stranger = makeAddr("stranger");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AgentAttestations.NotRegistered.selector, stranger));
        attestations.attest(stranger, DATA);
    }

    function test_UnregisteredAttester_blocked() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(AgentAttestations.NotRegistered.selector, stranger));
        attestations.attest(bob, DATA);
    }

    // ---- EIP-712 signed attest --------------------------------------------

    function test_AttestWithSig_valid() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(alicePk, alice, bob, DATA, 0, deadline);

        vm.expectEmit(true, true, false, true);
        emit Attested(alice, bob, DATA, block.timestamp);

        // a relayer (not alice) submits alice's signed attestation
        vm.prank(relayer);
        attestations.attestWithSig(alice, bob, DATA, 0, deadline, sig);

        assertTrue(attestations.hasAttested(alice, bob));
        assertEq(attestations.nonces(alice), 1);
        assertEq(attestations.getAttestations(bob).length, 1);
    }

    function test_AttestWithSig_replay_blocked() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(alicePk, alice, bob, DATA, 0, deadline);

        vm.prank(relayer);
        attestations.attestWithSig(alice, bob, DATA, 0, deadline, sig);

        // resubmitting the SAME signed message must fail (nonce consumed)
        vm.prank(relayer);
        vm.expectRevert(AgentAttestations.InvalidNonce.selector);
        attestations.attestWithSig(alice, bob, DATA, 0, deadline, sig);
    }

    function test_AttestWithSig_badSignature_blocked() public {
        uint256 deadline = block.timestamp + 1 hours;
        // bob signs an attestation that CLAIMS to be from alice → invalid for alice
        bytes memory sig = _sign(bobPk, alice, bob, DATA, 0, deadline);

        vm.prank(relayer);
        vm.expectRevert(AgentAttestations.InvalidSignature.selector);
        attestations.attestWithSig(alice, bob, DATA, 0, deadline, sig);
    }

    function test_AttestWithSig_expired_blocked() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(alicePk, alice, bob, DATA, 0, deadline);
        vm.warp(deadline + 1);

        vm.prank(relayer);
        vm.expectRevert(AgentAttestations.ExpiredSignature.selector);
        attestations.attestWithSig(alice, bob, DATA, 0, deadline, sig);
    }

    function test_AttestWithSig_selfAttest_blocked() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(alicePk, alice, alice, DATA, 0, deadline);
        vm.prank(relayer);
        vm.expectRevert(AgentAttestations.SelfAttestation.selector);
        attestations.attestWithSig(alice, alice, DATA, 0, deadline, sig);
    }

    function test_DirectThenSig_duplicate_blocked() public {
        vm.prank(alice);
        attestations.attest(bob, DATA);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(alicePk, alice, bob, DATA, 0, deadline);
        vm.prank(relayer);
        vm.expectRevert(AgentAttestations.AlreadyAttested.selector);
        attestations.attestWithSig(alice, bob, DATA, 0, deadline, sig);
    }
}

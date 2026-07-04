// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAgentRegistry } from "./IAgentRegistry.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title AgentAttestations
/// @notice The reputation layer: registered agents attest about one another (e.g. "completed a
/// transaction", a score/flag encoded in `data`). Attestations can be made directly by the attester
/// or submitted by anyone as an **EIP-712 signature** the attester produced off-chain — cheaper and
/// composable (the attester needs no gas; a smart-account attester works via ERC-1271).
/// @dev Composes with {IAgentRegistry}: both attester and subject must be registered. Guards:
/// no self-attestation, one attestation per (attester → subject) pair (no duplicate spam), and
/// per-attester nonces so a signed attestation cannot be replayed. Holds no funds. All external
/// calls are `view`/`staticcall` (registry reads + ERC-1271 checks) — no reentrancy surface.
contract AgentAttestations is EIP712 {
    /// @notice A single attestation about `subject`, made by `attester`.
    struct Attestation {
        address attester;
        address subject;
        bytes32 data;
        uint64 timestamp;
    }

    /// @notice The registry attester/subject must be registered in (set once at deploy).
    IAgentRegistry public immutable registry;

    /// @dev subject => attestations about it.
    mapping(address => Attestation[]) private _bySubject;
    /// @dev attester => subject => already attested (one per pair).
    mapping(address => mapping(address => bool)) private _hasAttested;
    /// @notice Per-attester nonce for EIP-712 replay protection.
    mapping(address => uint256) public nonces;

    /// @dev EIP-712 type hash for a signed attestation.
    bytes32 private constant ATTEST_TYPEHASH = keccak256(
        "Attest(address attester,address subject,bytes32 data,uint256 nonce,uint256 deadline)"
    );

    /// @notice Emitted when an attestation is recorded.
    event Attested(
        address indexed attester, address indexed subject, bytes32 data, uint256 timestamp
    );

    /// @notice `account` is not a registered agent.
    error NotRegistered(address account);
    /// @notice An agent cannot attest about itself.
    error SelfAttestation();
    /// @notice This (attester → subject) attestation already exists.
    error AlreadyAttested();
    /// @notice The EIP-712 signature is not valid for the claimed attester.
    error InvalidSignature();
    /// @notice The signed attestation's deadline has passed.
    error ExpiredSignature();
    /// @notice The supplied nonce does not match the attester's current nonce.
    error InvalidNonce();

    constructor(IAgentRegistry registry_) EIP712("AgentAttestations", "1") {
        registry = registry_;
    }

    /// @notice Attest about `subject` as `msg.sender`.
    /// @param subject The agent being attested about.
    /// @param data Opaque claim (e.g. a score/flag or a hashed statement).
    function attest(address subject, bytes32 data) external {
        _attest(msg.sender, subject, data);
    }

    /// @notice Submit an attestation `attester` signed off-chain (EIP-712). Anyone may relay it.
    /// @param attester The agent whose signature authorizes the attestation.
    /// @param subject The agent being attested about.
    /// @param data Opaque claim.
    /// @param nonce Must equal the attester's current {nonces} value.
    /// @param deadline Unix time after which the signature is no longer valid.
    /// @param signature EIP-712 signature over the attestation (EOA or ERC-1271).
    function attestWithSig(
        address attester,
        address subject,
        bytes32 data,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        // `deadline` is a caller-chosen signature validity window; block.timestamp is the intended
        // clock and a few seconds of validator drift is irrelevant to an expiry check (this is the
        // standard EIP-2612/permit pattern, not a security-sensitive equality).
        // slither-disable-next-line timestamp
        if (block.timestamp > deadline) revert ExpiredSignature();
        if (nonce != nonces[attester]) revert InvalidNonce();

        bytes32 structHash =
            keccak256(abi.encode(ATTEST_TYPEHASH, attester, subject, data, nonce, deadline));
        bytes32 digest = _hashTypedDataV4(structHash);
        if (!SignatureChecker.isValidSignatureNow(attester, digest, signature)) {
            revert InvalidSignature();
        }

        // Consume the nonce (effect) before recording; a revert in _attest rolls this back.
        nonces[attester] = nonce + 1;
        _attest(attester, subject, data);
    }

    /// @dev Shared checks + effects for both entry points.
    function _attest(address attester, address subject, bytes32 data) private {
        if (attester == subject) revert SelfAttestation();
        if (!registry.isRegistered(attester)) revert NotRegistered(attester);
        if (!registry.isRegistered(subject)) revert NotRegistered(subject);
        if (_hasAttested[attester][subject]) revert AlreadyAttested();

        _hasAttested[attester][subject] = true;
        _bySubject[subject].push(
            Attestation({
                attester: attester, subject: subject, data: data, timestamp: uint64(block.timestamp)
            })
        );

        emit Attested(attester, subject, data, block.timestamp);
    }

    /// @notice All attestations recorded about `subject`.
    function getAttestations(address subject) external view returns (Attestation[] memory) {
        return _bySubject[subject];
    }

    /// @notice Number of attestations about `subject`.
    function attestationCount(address subject) external view returns (uint256) {
        return _bySubject[subject].length;
    }

    /// @notice Whether `attester` has already attested about `subject`.
    function hasAttested(address attester, address subject) external view returns (bool) {
        return _hasAttested[attester][subject];
    }
}

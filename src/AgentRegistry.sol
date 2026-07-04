// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAgentRegistry } from "./IAgentRegistry.sol";

/// @title AgentRegistry
/// @notice A minimal, composable Know-Your-Agent registry for the Arc agent economy.
/// An address registers itself as an agent with a pointer to off-chain metadata
/// (a URI or content hash) and can later update it. Only the agent can touch its own
/// record — every mutation keys on `msg.sender`, so there is no admin override and no
/// way to edit another agent's record.
/// @dev Holds no funds and makes no external calls (no reentrancy surface). NEVER store
/// PII on-chain: identity here is `address` + a metadata pointer, not personal data.
contract AgentRegistry is IAgentRegistry {
    /// @notice An agent's on-chain record. `metadataURI` is a pointer to off-chain data.
    struct Agent {
        string metadataURI;
        uint64 registeredAt;
        uint64 updatedAt;
        bool exists;
    }

    /// @dev agent address => record. Private; read via {getAgent}/{isRegistered}.
    mapping(address => Agent) private _agents;

    /// @notice Emitted when an address first registers as an agent.
    event AgentRegistered(address indexed agent, string metadataURI, uint256 timestamp);
    /// @notice Emitted when a registered agent updates its metadata pointer.
    event AgentUpdated(address indexed agent, string metadataURI, uint256 timestamp);

    /// @notice The caller is already registered.
    error AlreadyRegistered();
    /// @notice The caller (or queried address) is not a registered agent.
    error NotRegistered();
    /// @notice A metadata pointer must be non-empty.
    error EmptyMetadata();

    /// @notice Register `msg.sender` as an agent with an off-chain `metadataURI`.
    /// @param metadataURI Pointer to off-chain metadata (URI/hash). Must be non-empty and NOT PII.
    function registerAgent(string calldata metadataURI) external {
        if (_agents[msg.sender].exists) revert AlreadyRegistered();
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();

        uint64 nowTs = uint64(block.timestamp);
        _agents[msg.sender] = Agent({
            metadataURI: metadataURI, registeredAt: nowTs, updatedAt: nowTs, exists: true
        });

        emit AgentRegistered(msg.sender, metadataURI, block.timestamp);
    }

    /// @notice Update the caller's own metadata pointer. Only the agent can update its record.
    /// @param metadataURI New off-chain metadata pointer. Must be non-empty.
    function updateMetadata(string calldata metadataURI) external {
        Agent storage a = _agents[msg.sender];
        if (!a.exists) revert NotRegistered();
        if (bytes(metadataURI).length == 0) revert EmptyMetadata();

        a.metadataURI = metadataURI;
        a.updatedAt = uint64(block.timestamp);

        emit AgentUpdated(msg.sender, metadataURI, block.timestamp);
    }

    /// @inheritdoc IAgentRegistry
    function isRegistered(address agent) external view override returns (bool) {
        return _agents[agent].exists;
    }

    /// @notice Fetch `agent`'s record. Reverts {NotRegistered} if the address is unknown.
    function getAgent(address agent) external view returns (Agent memory) {
        Agent memory a = _agents[agent];
        if (!a.exists) revert NotRegistered();
        return a;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IAgentRegistry
/// @notice The read surface other primitives compose against. `AgentRegistry` satisfies
/// this without modification, and the escrow (Stage 3) uses the same interface.
interface IAgentRegistry {
    /// @notice Whether `agent` is a registered agent.
    function isRegistered(address agent) external view returns (bool);
}

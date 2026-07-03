// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Sanity
/// @notice A trivial contract that exists only to prove the toolchain (forge build +
/// forge test + Slither) is wired end to end for CI. It holds no funds, stores no
/// state, and takes no config. It is removed once AgentRegistry lands in Stage 1.
contract Sanity {
    /// @notice The fixed answer asserted by the scaffold's sanity test.
    /// @return The constant 42.
    function answer() external pure returns (uint256) {
        return 42;
    }
}

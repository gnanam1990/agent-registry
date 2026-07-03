// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Sanity } from "../src/Sanity.sol";
import { Test } from "forge-std/Test.sol";

/// @dev Scaffold sanity check — proves the toolchain (build + test + Slither) is wired
/// end to end. Replaced by real AgentRegistry tests in Stage 1.
contract SanityTest is Test {
    Sanity internal sanity;

    function setUp() public {
        sanity = new Sanity();
    }

    function test_ReportsTheExpectedAnswer() public view {
        assertEq(sanity.answer(), 42);
    }
}

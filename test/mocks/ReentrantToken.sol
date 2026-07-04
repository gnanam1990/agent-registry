// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AgentEscrow } from "../../src/AgentEscrow.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev A MALICIOUS 6-decimal ERC-20 for the reentrancy test. It re-enters the escrow on its
/// outgoing `transfer` (the call `release`/`refund` make to pay out). It acts as the escrow's
/// *payer* so the re-entrant `release` passes the payer check — meaning ONLY the ReentrancyGuard
/// (and checks-effects-interactions) can stop the double-withdrawal. Never deployed.
contract ReentrantToken is ERC20 {
    AgentEscrow private _escrow;
    uint256 private _targetId;
    bool private _armed;

    constructor() ERC20("Reentrant USDC", "rUSDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Open an escrow where THIS contract is the payer.
    function openEscrow(AgentEscrow escrow_, address payee, uint256 amount, uint64 deadline)
        external
        returns (uint256 id)
    {
        _escrow = escrow_;
        _mint(address(this), amount);
        _approve(address(this), address(escrow_), amount);
        id = escrow_.createEscrow(payee, amount, deadline);
        _targetId = id;
    }

    /// @notice Trigger the attack: release the escrow; the re-entry fires inside {transfer}.
    function attackRelease() external {
        _armed = true;
        _escrow.release(_targetId);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (_armed) {
            _armed = false;
            // Attempt a second withdrawal mid-transfer — the guard must revert this.
            _escrow.release(_targetId);
        }
        return super.transfer(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AgentEscrow } from "../src/AgentEscrow.sol";
import { AgentRegistry } from "../src/AgentRegistry.sol";
import { IAgentRegistry } from "../src/IAgentRegistry.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";
import { ReentrantToken } from "./mocks/ReentrantToken.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Test } from "forge-std/Test.sol";

contract AgentEscrowTest is Test {
    AgentRegistry internal registry;
    MockUSDC internal usdc;
    AgentEscrow internal escrow;

    address internal payer = makeAddr("payer");
    address internal payee = makeAddr("payee");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant ONE_USDC = 1_000_000; // 6 decimals
    uint256 internal constant AMOUNT = 100 * ONE_USDC; // 100 USDC
    uint64 internal deadline;

    event EscrowCreated(
        uint256 indexed id,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint64 deadline
    );
    event EscrowReleased(uint256 indexed id, address indexed payee, uint256 amount);
    event EscrowRefunded(uint256 indexed id, address indexed payer, uint256 amount);

    function setUp() public {
        registry = new AgentRegistry();
        usdc = new MockUSDC();
        escrow = new AgentEscrow(IERC20(address(usdc)), IAgentRegistry(address(registry)));

        vm.prank(payee);
        registry.registerAgent("ipfs://payee"); // payee must be a registered agent

        usdc.mint(payer, 1000 * ONE_USDC);
        deadline = uint64(block.timestamp + 1 days);
    }

    function _open(uint256 amount) internal returns (uint256 id) {
        vm.startPrank(payer);
        usdc.approve(address(escrow), amount);
        id = escrow.createEscrow(payee, amount, deadline);
        vm.stopPrank();
    }

    // ---- happy path --------------------------------------------------------

    function test_CreateEscrow_pullsFunds_storesRecord_emits() public {
        vm.startPrank(payer);
        usdc.approve(address(escrow), AMOUNT);

        vm.expectEmit(true, true, true, true);
        emit EscrowCreated(0, payer, payee, AMOUNT, deadline);
        uint256 id = escrow.createEscrow(payee, AMOUNT, deadline);
        vm.stopPrank();

        assertEq(id, 0);
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT); // funds pulled in
        assertEq(usdc.balanceOf(payer), 900 * ONE_USDC);

        (address p, address py, uint256 amt, uint64 dl, AgentEscrow.Status st) = escrow.escrows(id);
        assertEq(p, payer);
        assertEq(py, payee);
        assertEq(amt, AMOUNT);
        assertEq(dl, deadline);
        assertEq(uint256(st), uint256(AgentEscrow.Status.Open));
    }

    function test_Release_paysPayee_emits() public {
        uint256 id = _open(AMOUNT);

        vm.expectEmit(true, true, false, true);
        emit EscrowReleased(id, payee, AMOUNT);
        vm.prank(payer);
        escrow.release(id);

        assertEq(usdc.balanceOf(payee), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        (,,,, AgentEscrow.Status st) = escrow.escrows(id);
        assertEq(uint256(st), uint256(AgentEscrow.Status.Released));
    }

    function test_Refund_afterTimeout_paysPayer_emits() public {
        uint256 id = _open(AMOUNT);
        vm.warp(deadline + 1);

        vm.expectEmit(true, true, false, true);
        emit EscrowRefunded(id, payer, AMOUNT);
        vm.prank(payer);
        escrow.refund(id);

        assertEq(usdc.balanceOf(payer), 1000 * ONE_USDC); // fully restored
        assertEq(usdc.balanceOf(address(escrow)), 0);
        (,,,, AgentEscrow.Status st) = escrow.escrows(id);
        assertEq(uint256(st), uint256(AgentEscrow.Status.Refunded));
    }

    // ---- access / state guards --------------------------------------------

    function test_DoubleRelease_blocked() public {
        uint256 id = _open(AMOUNT);
        vm.startPrank(payer);
        escrow.release(id);
        vm.expectRevert(AgentEscrow.EscrowNotOpen.selector);
        escrow.release(id);
        vm.stopPrank();
    }

    function test_ReleaseByWrongParty_reverts() public {
        uint256 id = _open(AMOUNT);
        vm.prank(stranger);
        vm.expectRevert(AgentEscrow.NotPayer.selector);
        escrow.release(id);
    }

    function test_RefundBeforeTimeout_reverts() public {
        uint256 id = _open(AMOUNT);
        vm.prank(payer);
        vm.expectRevert(AgentEscrow.NotYetRefundable.selector);
        escrow.refund(id);
    }

    function test_RefundByWrongParty_reverts() public {
        uint256 id = _open(AMOUNT);
        vm.warp(deadline + 1);
        vm.prank(stranger);
        vm.expectRevert(AgentEscrow.NotPayer.selector);
        escrow.refund(id);
    }

    function test_ReleaseAfterRefund_blocked() public {
        uint256 id = _open(AMOUNT);
        vm.warp(deadline + 1);
        vm.startPrank(payer);
        escrow.refund(id);
        vm.expectRevert(AgentEscrow.EscrowNotOpen.selector);
        escrow.release(id);
        vm.stopPrank();
    }

    // ---- input validation --------------------------------------------------

    function test_Decimals_oneDollarIsOneMillionUnits() public {
        assertEq(usdc.decimals(), 6);
        uint256 id = _open(ONE_USDC); // $1.00
        (,, uint256 amt,,) = escrow.escrows(id);
        assertEq(amt, 1_000_000); // exactly 1e6 base units
        vm.prank(payer);
        escrow.release(id);
        assertEq(usdc.balanceOf(payee), 1_000_000);
    }

    function test_ZeroAmount_reverts() public {
        vm.startPrank(payer);
        usdc.approve(address(escrow), 0);
        vm.expectRevert(AgentEscrow.ZeroAmount.selector);
        escrow.createEscrow(payee, 0, deadline);
        vm.stopPrank();
    }

    function test_ZeroAddressPayee_reverts() public {
        vm.startPrank(payer);
        usdc.approve(address(escrow), AMOUNT);
        vm.expectRevert(AgentEscrow.ZeroAddress.selector);
        escrow.createEscrow(address(0), AMOUNT, deadline);
        vm.stopPrank();
    }

    function test_UnregisteredPayee_reverts() public {
        vm.startPrank(payer);
        usdc.approve(address(escrow), AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(AgentEscrow.PayeeNotRegistered.selector, stranger));
        escrow.createEscrow(stranger, AMOUNT, deadline);
        vm.stopPrank();
    }

    function test_InvalidDeadline_reverts() public {
        vm.startPrank(payer);
        usdc.approve(address(escrow), AMOUNT);
        vm.expectRevert(AgentEscrow.InvalidDeadline.selector);
        escrow.createEscrow(payee, AMOUNT, uint64(block.timestamp)); // not in the future
        vm.stopPrank();
    }

    // ---- ADVERSARIAL: reentrancy cannot drain -----------------------------

    function test_Reentrancy_cannotDrain() public {
        ReentrantToken bad = new ReentrantToken();
        AgentEscrow badEscrow =
            new AgentEscrow(IERC20(address(bad)), IAgentRegistry(address(registry)));

        // A legitimate escrow funds the contract with tokens the attacker will try to steal.
        bad.mint(address(this), AMOUNT);
        bad.approve(address(badEscrow), AMOUNT);
        badEscrow.createEscrow(payee, AMOUNT, deadline); // id 0, payer = this test

        // The attacker's escrow: the malicious token itself is the payer.
        uint256 attackId = bad.openEscrow(badEscrow, payee, AMOUNT, deadline); // +100 → 200 held
        assertEq(bad.balanceOf(address(badEscrow)), 2 * AMOUNT);

        // Releasing re-enters release() mid-transfer → the ReentrancyGuard must revert it.
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        bad.attackRelease();

        // No drain: the contract still holds BOTH escrows' funds; the attacker escrow is still Open.
        assertEq(bad.balanceOf(address(badEscrow)), 2 * AMOUNT);
        (,,,, AgentEscrow.Status st) = badEscrow.escrows(attackId);
        assertEq(uint256(st), uint256(AgentEscrow.Status.Open));
    }
}

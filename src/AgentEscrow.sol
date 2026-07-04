// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAgentRegistry } from "./IAgentRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AgentEscrow
/// @notice A minimal, composable USDC escrow for the agent economy. A payer deposits an ERC-20
/// (USDC — **6 decimals** on Arc) into an escrow held for a registered agent (the payee). The payer
/// releases it to the payee, or reclaims it after a deadline (timeout refund).
/// @dev SECURITY FIRST — deployed contracts are immutable:
/// - Every state-changing external function is `nonReentrant` AND follows strict
///   checks-effects-interactions (status is written before any token transfer).
/// - All token movement uses {SafeERC20} (`safeTransferFrom`/`safeTransfer`).
/// - The token and registry are constructor args (read from config — never hardcoded). No
///   arbitrary external calls, no `delegatecall`, all inputs validated.
/// - The contract is decimals-agnostic (it moves raw base units); callers use USDC's 6 decimals
///   (`$1.00 == 1_000_000`). Assumes a standard, non-fee-on-transfer token (true for USDC).
contract AgentEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None, // 0 — unset / non-existent escrow
        Open,
        Released,
        Refunded
    }

    struct Escrow {
        address payer;
        address payee;
        uint256 amount;
        uint64 deadline;
        Status status;
    }

    /// @notice The ERC-20 held in escrow (USDC on Arc; set once at deploy).
    IERC20 public immutable token;
    /// @notice The registry the payee must be registered in (set once at deploy).
    IAgentRegistry public immutable registry;

    /// @notice Escrow records by id.
    mapping(uint256 => Escrow) public escrows;
    /// @notice The id the next created escrow will use.
    uint256 public nextEscrowId;

    event EscrowCreated(
        uint256 indexed id,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint64 deadline
    );
    event EscrowReleased(uint256 indexed id, address indexed payee, uint256 amount);
    event EscrowRefunded(uint256 indexed id, address indexed payer, uint256 amount);

    /// @notice Deposit amount must be non-zero.
    error ZeroAmount();
    /// @notice Payee address must be non-zero.
    error ZeroAddress();
    /// @notice The payee is not a registered agent.
    error PayeeNotRegistered(address payee);
    /// @notice The deadline must be in the future.
    error InvalidDeadline();
    /// @notice The escrow is not Open (already released/refunded, or non-existent).
    error EscrowNotOpen();
    /// @notice Caller is not the escrow's payer.
    error NotPayer();
    /// @notice The escrow's deadline has not passed yet.
    error NotYetRefundable();

    constructor(IERC20 token_, IAgentRegistry registry_) {
        if (address(token_) == address(0) || address(registry_) == address(0)) {
            revert ZeroAddress();
        }
        token = token_;
        registry = registry_;
    }

    /// @notice Create and fund an escrow for `payee` that expires at `deadline`.
    /// @param payee A registered agent to be paid on release.
    /// @param amount USDC base units (6 decimals) to escrow. Pulled from the caller.
    /// @param deadline Unix time after which the payer may refund.
    /// @return id The new escrow's id.
    function createEscrow(address payee, uint256 amount, uint64 deadline)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (amount == 0) revert ZeroAmount();
        if (payee == address(0)) revert ZeroAddress();
        if (!registry.isRegistered(payee)) revert PayeeNotRegistered(payee);
        // slither-disable-next-line timestamp
        if (deadline <= block.timestamp) revert InvalidDeadline();

        // Effects: record the escrow before pulling funds.
        id = nextEscrowId++;
        escrows[id] = Escrow({
            payer: msg.sender, payee: payee, amount: amount, deadline: deadline, status: Status.Open
        });
        emit EscrowCreated(id, msg.sender, payee, amount, deadline);

        // Interaction: pull the deposit from the payer.
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Release an open escrow to its payee. Only the payer may call.
    function release(uint256 id) external nonReentrant {
        Escrow storage e = escrows[id];
        if (e.status != Status.Open) revert EscrowNotOpen();
        if (msg.sender != e.payer) revert NotPayer();

        // Effects before interaction (and the guard) — a re-entrant call finds the escrow closed.
        e.status = Status.Released;
        address payee = e.payee;
        uint256 amount = e.amount;
        emit EscrowReleased(id, payee, amount);

        token.safeTransfer(payee, amount);
    }

    /// @notice Refund an open escrow to its payer after the deadline. Only the payer may call.
    function refund(uint256 id) external nonReentrant {
        Escrow storage e = escrows[id];
        if (e.status != Status.Open) revert EscrowNotOpen();
        if (msg.sender != e.payer) revert NotPayer();
        // slither-disable-next-line timestamp
        if (block.timestamp < e.deadline) revert NotYetRefundable();

        e.status = Status.Refunded;
        address payer = e.payer;
        uint256 amount = e.amount;
        emit EscrowRefunded(id, payer, amount);

        token.safeTransfer(payer, amount);
    }
}

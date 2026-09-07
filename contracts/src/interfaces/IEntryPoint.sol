// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PackedUserOperation} from "./PackedUserOperation.sol";

/**
 * @title IEntryPoint
 * @notice Canonical ERC-4337 v0.7 EntryPoint interface for account interactions.
 */
interface IEntryPoint {
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;
    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32);
    function depositTo(address account) external payable;
    function getNonce(address sender, uint192 key) external view returns (uint256 nonce);
    function balanceOf(address account) external view returns (uint256);
}

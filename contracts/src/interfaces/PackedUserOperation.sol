// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PackedUserOperation
 * @notice Canonical ERC-4337 v0.7 UserOperation struct packed for gas efficiency.
 */
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

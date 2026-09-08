// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {PackedUserOperation} from "./PackedUserOperation.sol";

/**
 * @title IAccount
 * @notice Standard ERC-4337 v0.7 smart account interface.
 */
interface IAccount {
    /**
     * @notice Validate user's signature and nonce.
     * @dev MUST return SIG_VALIDATION_FAILED (1) on signature failure, or 0 on success.
     * @param userOp The operation that is about to be executed.
     * @param userOpHash Hash of the user's request data.
     * @param missingAccountFunds Missing funds on the account's deposit in the EntryPoint.
     * @return validationData Packed validation data (authorizer, validUntil, validAfter).
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

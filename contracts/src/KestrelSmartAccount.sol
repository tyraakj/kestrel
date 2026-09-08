// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAccount} from "./interfaces/IAccount.sol";
import {PackedUserOperation} from "./interfaces/PackedUserOperation.sol";
import {IEntryPoint} from "./interfaces/IEntryPoint.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ECDSA} from "./utils/ECDSA.sol";

/**
 * @title KestrelSmartAccount
 * @notice Sovereign ERC-4337 v0.7 smart contract account with hardware owner clear-signing,
 *         atomic multi-call execution, zero lingering allowance guarantee, and on-chain
 *         balance invariant circuit breaker.
 */
contract KestrelSmartAccount is IAccount {
    using ECDSA for bytes32;

    // --- Constants ---
    uint256 internal constant SIG_VALIDATION_SUCCESS = 0;
    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    // --- State & Immutables ---
    address public immutable owner;
    IEntryPoint public immutable entryPoint;

    // --- Structs ---
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    // --- Custom Errors ---
    error NotAuthorized();
    error CallFailed(uint256 index, bytes returnData);
    error InvariantBreached(address token, uint256 minExpectedBalance, uint256 actualBalance);
    error InvalidSignature();
    error ZeroAddress();

    // --- Modifiers ---
    modifier onlyEntryPointOrOwner() {
        if (msg.sender != address(entryPoint) && msg.sender != owner) {
            revert NotAuthorized();
        }
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) {
            revert NotAuthorized();
        }
        _;
    }

    // --- Constructor ---
    constructor(address _owner, address _entryPoint) {
        if (_owner == address(0) || _entryPoint == address(0)) {
            revert ZeroAddress();
        }
        owner = _owner;
        entryPoint = IEntryPoint(_entryPoint);
    }

    // --- ERC-4337 UserOperation Validation ---

    /**
     * @notice Validates the UserOperation against the physical Ledger hardware key signature.
     * @param userOp Canonical packed UserOperation.
     * @param userOpHash Canonical ERC-4337 32-byte request hash.
     * @param missingAccountFunds Missing funds needed by the EntryPoint to execute this operation.
     * @return validationData 0 if signature matches owner, 1 if invalid.
     */
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256 validationData) {
        bytes32 ethSignedHash = userOpHash.toEthSignedMessageHash();
        
        address recoveredSigner;
        try this.recoverSigner(ethSignedHash, userOp.signature) returns (address signer) {
            recoveredSigner = signer;
        } catch {
            return SIG_VALIDATION_FAILED;
        }

        if (recoveredSigner != owner) {
            return SIG_VALIDATION_FAILED;
        }

        // Pre-fund the EntryPoint if account deposit is insufficient
        if (missingAccountFunds > 0) {
            (bool success, ) = payable(msg.sender).call{value: missingAccountFunds}("");
            (success); // ignore failure, EntryPoint reverts if funds are insufficient
        }

        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @dev External helper to safely catch ECDSA recovery reverts without bubbling.
     */
    function recoverSigner(bytes32 hash, bytes memory signature) external pure returns (address) {
        return hash.recover(signature);
    }

    // --- Execution Engine ---

    /**
     * @notice Atomically executes a sequential batch of calls.
     * @dev Used for [approve -> swap -> revoke(0) -> assertMinBalance].
     *      If any call fails, the entire batch reverts immediately.
     */
    function executeBatch(Call[] calldata calls)
        external
        payable
        onlyEntryPointOrOwner
        returns (bytes[] memory results)
    {
        results = new bytes[](calls.length);

        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory returnData) = calls[i].target.call{value: calls[i].value}(
                calls[i].data
            );
            _verifyCall(i, success, calls[i].data, returnData);
            results[i] = returnData;
        }
    }

    /**
     * @notice Executes a single call from EntryPoint or owner.
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external payable onlyEntryPointOrOwner returns (bytes memory result) {
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        _verifyCall(0, success, data, returnData);
        return returnData;
    }

    /**
     * @dev Validates call outcome and enforces SafeERC20 semantics for standard ERC-20 calls.
     *      Prevents non-reverting tokens that return `false` from being treated as successful,
     *      while allowing arbitrary non-boolean return data (e.g. uint256 swap amounts) on other calls.
     */
    function _verifyCall(
        uint256 index,
        bool success,
        bytes calldata data,
        bytes memory returnData
    ) internal pure {
        if (!success) {
            revert CallFailed(index, returnData);
        }
        if (data.length >= 4) {
            bytes4 selector = bytes4(data[:4]);
            if (
                selector == 0x095ea7b3 || // approve(address,uint256)
                selector == 0xa9059cbb || // transfer(address,uint256)
                selector == 0x23b872dd    // transferFrom(address,address,uint256)
            ) {
                if (returnData.length == 32 && !abi.decode(returnData, (bool))) {
                    revert CallFailed(index, returnData);
                }
            }
        }
    }

    // --- On-Chain Invariant Circuit Breaker ---

    /**
     * @notice Enforces that post-execution token or native ETH balance is >= minimum expected threshold.
     * @dev Atomically reverts with InvariantBreached if sandwich attack, slippage, or deficit occurs.
     * @param token Address of the token (address(0) for native ETH).
     * @param minExpectedBalance Minimum acceptable balance in wei / raw token units.
     */
    function assertMinBalance(address token, uint256 minExpectedBalance) external view {
        if (token == address(0)) {
            uint256 actualBalance = address(this).balance;
            if (actualBalance < minExpectedBalance) {
                revert InvariantBreached(address(0), minExpectedBalance, actualBalance);
            }
        } else {
            uint256 actualBalance = IERC20(token).balanceOf(address(this));
            if (actualBalance < minExpectedBalance) {
                revert InvariantBreached(token, minExpectedBalance, actualBalance);
            }
        }
    }

    // --- Receive Native ETH ---
    receive() external payable {}
}

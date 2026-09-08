// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {KestrelSmartAccount} from "./KestrelSmartAccount.sol";

/**
 * @title KestrelAccountFactory
 * @notice CREATE2 Counterfactual deployment factory for KestrelSmartAccount.
 *         Allows discovering deterministic addresses and funding them prior to on-chain deployment.
 */
contract KestrelAccountFactory {
    // --- State & Immutables ---
    address public immutable entryPoint;

    // --- Events ---
    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    // --- Custom Errors ---
    error ZeroAddress();

    // --- Constructor ---
    constructor(address _entryPoint) {
        if (_entryPoint == address(0)) {
            revert ZeroAddress();
        }
        entryPoint = _entryPoint;
    }

    /**
     * @notice Predicts deterministic counterfactual address for an account.
     */
    function getAddress(address owner, uint256 salt) external view returns (address) {
        bytes memory initCode = abi.encodePacked(
            type(KestrelSmartAccount).creationCode,
            abi.encode(owner, entryPoint)
        );
        bytes32 initCodeHash = keccak256(initCode);

        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            bytes32(salt),
                            initCodeHash
                        )
                    )
                )
            )
        );
    }

    /**
     * @notice Deploys or returns an existing counterfactual smart account.
     * @param owner Hardware Ledger owner address.
     * @param salt Deterministic salt.
     * @return ret Instance of KestrelSmartAccount.
     */
    function createAccount(address owner, uint256 salt) external returns (KestrelSmartAccount ret) {
        address addr = this.getAddress(owner, salt);
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(addr)
        }

        if (codeSize > 0) {
            return KestrelSmartAccount(payable(addr));
        }

        ret = new KestrelSmartAccount{salt: bytes32(salt)}(owner, entryPoint);
        emit AccountCreated(address(ret), owner, salt);
    }
}

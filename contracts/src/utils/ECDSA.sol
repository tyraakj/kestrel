// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ECDSA
 * @notice Elliptic Curve Digital Signature Algorithm (ECDSA) operations with malleability protection.
 */
library ECDSA {
    error InvalidSignatureLength();
    error InvalidSignatureS();
    error InvalidSignatureV();
    error InvalidSigner();

    /**
     * @dev Recovers the signer address from a hash and 65-byte signature.
     */
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) {
            revert InvalidSignatureLength();
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        // EIP-2 malleable signature protection
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignatureS();
        }

        if (v != 27 && v != 28) {
            revert InvalidSignatureV();
        }

        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) {
            revert InvalidSigner();
        }

        return signer;
    }

    /**
     * @dev Prefix a hash with "\x19Ethereum Signed Message:\n32".
     */
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}

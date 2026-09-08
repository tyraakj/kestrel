// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function deal(address who, uint256 newBalance) external;
    function assume(bool) external pure;
    function expectRevert() external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function sign(uint256 privateKey, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external pure returns (address);
}

/**
 * @title Test
 * @notice Self-contained base test contract providing Foundry cheatcodes and standard assertions
 *         without requiring external git submodules or npm dependencies.
 */
abstract contract Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertTrue(bool condition) internal pure {
        require(condition, "Assertion failed: expected true, got false");
    }

    function assertFalse(bool condition) internal pure {
        require(!condition, "Assertion failed: expected false, got true");
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "Assertion failed: uint256 mismatch");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "Assertion failed: address mismatch");
    }

    function assertEq(bytes32 a, bytes32 b) internal pure {
        require(a == b, "Assertion failed: bytes32 mismatch");
    }

    function assertEq(string memory a, string memory b) internal pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), "Assertion failed: string mismatch");
    }
}

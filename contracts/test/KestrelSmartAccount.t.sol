// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "./utils/Test.sol";
import {KestrelSmartAccount} from "../src/KestrelSmartAccount.sol";
import {PackedUserOperation} from "../src/interfaces/PackedUserOperation.sol";
import {ECDSA} from "../src/utils/ECDSA.sol";

contract KestrelSmartAccountTest is Test {
    using ECDSA for bytes32;

    KestrelSmartAccount internal account;

    address internal constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    uint256 internal constant OWNER_KEY = 0xA11CE;
    address internal owner;

    uint256 internal constant ATTACKER_KEY = 0xB0B;
    address internal attacker;

    function setUp() public {
        owner = vm.addr(OWNER_KEY);
        attacker = vm.addr(ATTACKER_KEY);

        account = new KestrelSmartAccount(owner, ENTRY_POINT);
        vm.deal(address(account), 2 ether);
    }

    // --- UserOp Validation Tests ---

    function test_ValidateUserOp_Success() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        userOp.nonce = 0;

        bytes32 opHash = keccak256(abi.encode(userOp.sender, userOp.nonce, block.chainid, ENTRY_POINT));
        bytes32 ethHash = opHash.toEthSignedMessageHash();

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_KEY, ethHash);
        userOp.signature = abi.encodePacked(r, s, v);

        vm.prank(ENTRY_POINT);
        uint256 validationData = account.validateUserOp(userOp, opHash, 0);

        assertEq(validationData, 0); // SIG_VALIDATION_SUCCESS
    }

    function test_ValidateUserOp_PreFundsGas() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        userOp.nonce = 0;

        bytes32 opHash = keccak256(abi.encode(userOp.sender, userOp.nonce));
        bytes32 ethHash = opHash.toEthSignedMessageHash();

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_KEY, ethHash);
        userOp.signature = abi.encodePacked(r, s, v);

        uint256 prefundAmount = 0.05 ether;
        uint256 balanceBefore = ENTRY_POINT.balance;

        vm.prank(ENTRY_POINT);
        account.validateUserOp(userOp, opHash, prefundAmount);

        assertEq(ENTRY_POINT.balance, balanceBefore + prefundAmount);
    }

    function test_ValidateUserOp_Revert_Unauthorized() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(account);

        bytes32 opHash = bytes32(uint256(1));

        vm.prank(attacker);
        vm.expectRevert(KestrelSmartAccount.NotAuthorized.selector);
        account.validateUserOp(userOp, opHash, 0);
    }

    function test_ValidateUserOp_InvalidSignature() public {
        PackedUserOperation memory userOp;
        userOp.sender = address(account);
        userOp.nonce = 0;

        bytes32 opHash = keccak256(abi.encode(userOp.sender, userOp.nonce));
        bytes32 ethHash = opHash.toEthSignedMessageHash();

        // Signed by non-owner attacker key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ATTACKER_KEY, ethHash);
        userOp.signature = abi.encodePacked(r, s, v);

        vm.prank(ENTRY_POINT);
        uint256 validationData = account.validateUserOp(userOp, opHash, 0);

        assertEq(validationData, 1); // SIG_VALIDATION_FAILED
    }

    // --- Execution Engine Tests ---

    function test_Execute_SingleCall() public {
        address recipient = address(0xCAFE);
        uint256 amount = 0.5 ether;

        vm.prank(owner);
        account.execute(recipient, amount, "");

        assertEq(recipient.balance, amount);
    }

    function test_ExecuteBatch_SequentialCalls() public {
        address recipient1 = address(0xCAFE1);
        address recipient2 = address(0xCAFE2);

        KestrelSmartAccount.Call[] memory calls = new KestrelSmartAccount.Call[](2);
        calls[0] = KestrelSmartAccount.Call({target: recipient1, value: 0.25 ether, data: ""});
        calls[1] = KestrelSmartAccount.Call({target: recipient2, value: 0.75 ether, data: ""});

        vm.prank(owner);
        account.executeBatch(calls);

        assertEq(recipient1.balance, 0.25 ether);
        assertEq(recipient2.balance, 0.75 ether);
    }

    function test_ExecuteBatch_RevertsIfAnyCallFails() public {
        KestrelSmartAccount.Call[] memory calls = new KestrelSmartAccount.Call[](1);
        // Exceeds account balance
        calls[0] = KestrelSmartAccount.Call({target: address(0xCAFE), value: 100 ether, data: ""});

        vm.prank(owner);
        vm.expectRevert();
        account.executeBatch(calls);
    }

    function test_ExecuteBatch_AllowsCallsReturningUint256() public {
        MockSwapRouter router = new MockSwapRouter();
        KestrelSmartAccount.Call[] memory calls = new KestrelSmartAccount.Call[](1);
        calls[0] = KestrelSmartAccount.Call({
            target: address(router),
            value: 0,
            data: abi.encodeWithSelector(MockSwapRouter.exactInputSingle.selector, 500)
        });

        vm.prank(owner);
        bytes[] memory results = account.executeBatch(calls);
        assertEq(results.length, 1);
        uint256 returnedAmount = abi.decode(results[0], (uint256));
        assertEq(returnedAmount, 1000);
    }

    function test_ExecuteBatch_RevertsOnERC20FalseReturn() public {
        MockFailingERC20 token = new MockFailingERC20();
        KestrelSmartAccount.Call[] memory calls = new KestrelSmartAccount.Call[](1);
        calls[0] = KestrelSmartAccount.Call({
            target: address(token),
            value: 0,
            data: abi.encodeWithSelector(MockFailingERC20.approve.selector, address(0xCAFE), 1000)
        });

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                KestrelSmartAccount.CallFailed.selector,
                0,
                abi.encode(false)
            )
        );
        account.executeBatch(calls);
    }

    function test_Execute_RevertsOnERC20FalseReturn() public {
        MockFailingERC20 token = new MockFailingERC20();
        bytes memory data = abi.encodeWithSelector(MockFailingERC20.approve.selector, address(0xCAFE), 1000);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                KestrelSmartAccount.CallFailed.selector,
                0,
                abi.encode(false)
            )
        );
        account.execute(address(token), 0, data);
    }

    // --- On-Chain Invariant Circuit Breaker Tests (Native ETH) ---

    function test_AssertMinBalance_Success() public view {
        account.assertMinBalance(address(0), 2 ether);
        account.assertMinBalance(address(0), 1 ether);
    }

    function test_AssertMinBalance_RevertsOnDeficit() public {
        uint256 actual = address(account).balance;
        uint256 excessive = actual + 1 ether;

        vm.expectRevert(
            abi.encodeWithSelector(
                KestrelSmartAccount.InvariantBreached.selector,
                address(0),
                excessive,
                actual
            )
        );
        account.assertMinBalance(address(0), excessive);
    }

    // --- Property-Based Fuzz Testing ---

    function testFuzz_AssertMinBalance_Positive(uint256 balance, uint256 minRequired) public {
        vm.assume(balance >= minRequired);
        vm.assume(balance <= 10_000 ether);

        vm.deal(address(account), balance);
        account.assertMinBalance(address(0), minRequired);
    }

    function testFuzz_AssertMinBalance_Breach(uint256 balance, uint256 deficit) public {
        vm.assume(deficit > 0);
        vm.assume(balance <= 10_000 ether);
        vm.assume(deficit <= 10_000 ether);

        vm.deal(address(account), balance);
        uint256 expected = balance + deficit;

        vm.expectRevert(
            abi.encodeWithSelector(
                KestrelSmartAccount.InvariantBreached.selector,
                address(0),
                expected,
                balance
            )
        );
        account.assertMinBalance(address(0), expected);
    }
}

contract MockSwapRouter {
    function exactInputSingle(uint256 amountIn) external pure returns (uint256 amountOut) {
        return amountIn * 2;
    }
}

contract MockFailingERC20 {
    function approve(address, uint256) external pure returns (bool) {
        return false;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

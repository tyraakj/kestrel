// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "./utils/Test.sol";
import {KestrelAccountFactory} from "../src/KestrelAccountFactory.sol";
import {KestrelSmartAccount} from "../src/KestrelSmartAccount.sol";
contract KestrelAccountFactoryTest is Test {
    KestrelAccountFactory internal factory;

    address internal constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    address internal constant OWNER = address(0xA11CE);

    function setUp() public {
        factory = new KestrelAccountFactory(ENTRY_POINT);
    }

    function test_GetAddress_MatchesDeployed() public {
        uint256 salt = 42;
        address predicted = factory.getAddress(OWNER, salt);

        KestrelSmartAccount deployed = factory.createAccount(OWNER, salt);

        assertEq(address(deployed), predicted);
        assertEq(deployed.owner(), OWNER);
        assertEq(address(deployed.entryPoint()), address(entryPoint));
    }

    function test_CreateAccount_Idempotent() public {
        uint256 salt = 999;
        KestrelSmartAccount first = factory.createAccount(OWNER, salt);
        KestrelSmartAccount second = factory.createAccount(OWNER, salt);

        assertEq(address(first), address(second));
    }
}

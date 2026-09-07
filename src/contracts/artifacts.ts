import { parseAbi, toFunctionSelector } from "viem";

/**
 * @notice Canonical Viem ABIs for Kestrel ERC-4337 Smart Account and Factory contracts.
 */

export const kestrelSmartAccountAbi = parseAbi([
  "function owner() view returns (address)",
  "function entryPoint() view returns (address)",
  "function validateUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingAccountFunds) returns (uint256 validationData)",
  "function executeBatch((address target, uint256 value, bytes data)[] calls) payable returns (bytes[] results)",
  "function execute(address target, uint256 value, bytes data) payable returns (bytes result)",
  "function assertMinBalance(address token, uint256 minExpectedBalance) view",
  "error NotAuthorized()",
  "error CallFailed(uint256 index, bytes returnData)",
  "error InvariantBreached(address token, uint256 minExpectedBalance, uint256 actualBalance)",
  "error InvalidSignature()",
  "error ZeroAddress()",
]);

export const kestrelAccountFactoryAbi = parseAbi([
  "function entryPoint() view returns (address)",
  "function getAddress(address owner, uint256 salt) view returns (address)",
  "function createAccount(address owner, uint256 salt) returns (address)",
  "event AccountCreated(address indexed account, address indexed owner, uint256 salt)",
  "error ZeroAddress()",
]);

export const entryPointAbi = parseAbi([
  "function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary)",
  "function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)",
  "function depositTo(address account) payable",
  "function getNonce(address sender, uint192 key) view returns (uint256 nonce)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const erc20Abi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

// Standard 4-byte custom error selectors for decoding Anvil pre-flight reverts
export const ERROR_SELECTORS = {
  CALL_FAILED: toFunctionSelector("CallFailed(uint256,bytes)"),
  INVARIANT_BREACHED: toFunctionSelector("InvariantBreached(address,uint256,uint256)"),
  NOT_AUTHORIZED: toFunctionSelector("NotAuthorized()"),
  INVALID_SIGNATURE: toFunctionSelector("InvalidSignature()"),
  ZERO_ADDRESS: toFunctionSelector("ZeroAddress()"),
} as const;

import {
  type Address,
  type Hex,
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  pad,
  parseAbiParameters,
  toHex,
} from "viem";
import { erc20Abi, kestrelSmartAccountAbi } from "./artifacts.js";

export interface Call {
  target: Address;
  value: bigint;
  data: Hex;
}

export interface BuildAtomicSwapBatchParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  ammRouter: Address;
  swapCalldata: Hex;
  smartAccountAddress: Address;
}

import { type PackedUserOperation } from "../types.js";

export interface CreateUserOpParams {
  sender: Address;
  nonce?: bigint;
  initCode?: Hex;
  callData: Hex;
  verificationGasLimit?: bigint;
  callGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
  paymasterAndData?: Hex;
  signature?: Hex;
}

/**
 * @notice Packs two 128-bit unsigned integers into a 32-byte hex string (ERC-4337 v0.7).
 */
export function packUint128Pair(high: bigint, low: bigint): Hex {
  const highHex = pad(toHex(high), { size: 16 });
  const lowHex = pad(toHex(low), { size: 16 });
  return concat([highHex, lowHex]);
}

/**
 * @notice Constructs an atomic 4-call batch ensuring zero lingering allowance and balance invariant assertion.
 */
export function buildAtomicSwapBatch({
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut,
  ammRouter,
  swapCalldata,
  smartAccountAddress,
}: BuildAtomicSwapBatchParams): Call[] {
  // 1. Approve exact amount
  const approveCall: Call = {
    target: tokenIn,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [ammRouter, amountIn],
    }),
  };

  // 2. Execute AMM swap
  const swapCall: Call = {
    target: ammRouter,
    value: 0n,
    data: swapCalldata,
  };

  // 3. Immediately wipe allowance to strictly 0 (zero lingering allowance guarantee)
  const revokeCall: Call = {
    target: tokenIn,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [ammRouter, 0n],
    }),
  };

  // 4. Assert minimum received balance (on-chain circuit breaker)
  const assertBalanceCall: Call = {
    target: smartAccountAddress,
    value: 0n,
    data: encodeFunctionData({
      abi: kestrelSmartAccountAbi,
      functionName: "assertMinBalance",
      args: [tokenOut, minAmountOut],
    }),
  };

  return [approveCall, swapCall, revokeCall, assertBalanceCall];
}

/**
 * @notice Encodes executeBatch(Call[]) calldata for KestrelSmartAccount.
 */
export function encodeExecuteBatch(calls: Call[]): Hex {
  return encodeFunctionData({
    abi: kestrelSmartAccountAbi,
    functionName: "executeBatch",
    args: [calls],
  });
}

/**
 * @notice Creates a canonical ERC-4337 v0.7 PackedUserOperation struct with defaults.
 */
export function createPackedUserOp(params: CreateUserOpParams): PackedUserOperation {
  const verificationGasLimit = params.verificationGasLimit ?? 150_000n;
  const callGasLimit = params.callGasLimit ?? 300_000n;
  const maxPriorityFeePerGas = params.maxPriorityFeePerGas ?? 1_000_000_000n; // 1 gwei
  const maxFeePerGas = params.maxFeePerGas ?? 20_000_000_000n; // 20 gwei

  return {
    sender: params.sender,
    nonce: params.nonce ?? 0n,
    initCode: params.initCode ?? "0x",
    callData: params.callData,
    accountGasLimits: packUint128Pair(verificationGasLimit, callGasLimit),
    preVerificationGas: params.preVerificationGas ?? 50_000n,
    gasFees: packUint128Pair(maxPriorityFeePerGas, maxFeePerGas),
    paymasterAndData: params.paymasterAndData ?? "0x",
    signature: params.signature ?? "0x",
  };
}

/**
 * @notice Computes the canonical ERC-4337 v0.7 UserOp 32-byte hash.
 */
export function getUserOpHash(
  entryPoint: Address,
  userOp: PackedUserOperation,
  chainId: number
): Hex {
  const packedUserOpHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters("address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32"),
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.accountGasLimits,
        userOp.preVerificationGas,
        userOp.gasFees,
        keccak256(userOp.paymasterAndData),
      ]
    )
  );

  return keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, address, uint256"), [
      packedUserOpHash,
      entryPoint,
      BigInt(chainId),
    ])
  );
}

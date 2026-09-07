import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Address, type Hex } from "viem";
import {
  kestrelSmartAccountAbi,
  kestrelAccountFactoryAbi,
  entryPointAbi,
  erc20Abi,
  ERROR_SELECTORS,
} from "../../src/contracts/artifacts.js";
import {
  buildAtomicSwapBatch,
  encodeExecuteBatch,
  packUint128Pair,
  createPackedUserOp,
  getUserOpHash,
} from "../../src/contracts/userop.js";

describe("Smart Contract Artifacts & ABIs", () => {
  it("exports valid Viem ABIs for all smart contracts", () => {
    expect(kestrelSmartAccountAbi.length).toBeGreaterThan(0);
    expect(kestrelAccountFactoryAbi.length).toBeGreaterThan(0);
    expect(entryPointAbi.length).toBeGreaterThan(0);
    expect(erc20Abi.length).toBeGreaterThan(0);
  });

  it("exports correct 4-byte custom error selectors", () => {
    expect(ERROR_SELECTORS.CALL_FAILED).toMatch(/^0x[0-9a-f]{8}$/);
    expect(ERROR_SELECTORS.INVARIANT_BREACHED).toMatch(/^0x[0-9a-f]{8}$/);
    expect(ERROR_SELECTORS.NOT_AUTHORIZED).toMatch(/^0x[0-9a-f]{8}$/);
    expect(ERROR_SELECTORS.INVALID_SIGNATURE).toMatch(/^0x[0-9a-f]{8}$/);
    expect(ERROR_SELECTORS.ZERO_ADDRESS).toMatch(/^0x[0-9a-f]{8}$/);
  });
});

describe("UserOp Builder & Atomic Swap Batch", () => {
  const dummyTokenIn: Address = "0x0000000000000000000000000000000000000001";
  const dummyTokenOut: Address = "0x0000000000000000000000000000000000000002";
  const dummyRouter: Address = "0x0000000000000000000000000000000000000003";
  const dummyAccount: Address = "0x0000000000000000000000000000000000000004";
  const dummyEntryPoint: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  it("builds atomic 4-call swap batch with zero lingering allowance and circuit breaker", () => {
    const amountIn = 1_000_000n; // 1 USDC
    const minAmountOut = 300_000_000_000_000n; // 0.0003 ETH
    const dummySwapCalldata: Hex = "0x12345678";

    const calls = buildAtomicSwapBatch({
      tokenIn: dummyTokenIn,
      tokenOut: dummyTokenOut,
      amountIn,
      minAmountOut,
      ammRouter: dummyRouter,
      swapCalldata: dummySwapCalldata,
      smartAccountAddress: dummyAccount,
    });

    expect(calls.length).toBe(4);

    // Call 1: approve(router, amountIn)
    expect(calls[0].target).toBe(dummyTokenIn);
    expect(calls[0].value).toBe(0n);
    const decodedApprove = decodeFunctionData({
      abi: erc20Abi,
      data: calls[0].data,
    });
    expect(decodedApprove.functionName).toBe("approve");
    expect(decodedApprove.args[0]).toBe(dummyRouter);
    expect(decodedApprove.args[1]).toBe(amountIn);

    // Call 2: router swap
    expect(calls[1].target).toBe(dummyRouter);
    expect(calls[1].value).toBe(0n);
    expect(calls[1].data).toBe(dummySwapCalldata);

    // Call 3: approve(router, 0n) -> Zero lingering allowance guarantee!
    expect(calls[2].target).toBe(dummyTokenIn);
    expect(calls[2].value).toBe(0n);
    const decodedRevoke = decodeFunctionData({
      abi: erc20Abi,
      data: calls[2].data,
    });
    expect(decodedRevoke.functionName).toBe("approve");
    expect(decodedRevoke.args[0]).toBe(dummyRouter);
    expect(decodedRevoke.args[1]).toBe(0n);

    // Call 4: assertMinBalance(tokenOut, minAmountOut) -> On-chain circuit breaker!
    expect(calls[3].target).toBe(dummyAccount);
    expect(calls[3].value).toBe(0n);
    const decodedAssert = decodeFunctionData({
      abi: kestrelSmartAccountAbi,
      data: calls[3].data,
    });
    expect(decodedAssert.functionName).toBe("assertMinBalance");
    expect(decodedAssert.args[0]).toBe(dummyTokenOut);
    expect(decodedAssert.args[1]).toBe(minAmountOut);
  });

  it("encodes executeBatch calldata correctly", () => {
    const calls = [
      {
        target: dummyTokenIn,
        value: 0n,
        data: "0x" as Hex,
      },
    ];

    const encoded = encodeExecuteBatch(calls);
    expect(encoded.startsWith("0x")).toBe(true);

    const decoded = decodeFunctionData({
      abi: kestrelSmartAccountAbi,
      data: encoded,
    });
    expect(decoded.functionName).toBe("executeBatch");
    if (decoded.functionName === "executeBatch") {
      const [batchCalls] = decoded.args;
      expect(batchCalls.length).toBe(1);
      expect(batchCalls[0]?.target).toBe(dummyTokenIn);
    }
  });

  it("packUint128Pair formats two uint128 into a 32-byte hex", () => {
    const high = 150_000n;
    const low = 300_000n;
    const packed = packUint128Pair(high, low);

    expect(packed.length).toBe(66); // 0x + 64 hex chars (32 bytes)
    expect(packed.startsWith("0x")).toBe(true);
  });

  it("creates packed UserOp with defaults and generates 32-byte hash", () => {
    const userOp = createPackedUserOp({
      sender: dummyAccount,
      callData: "0x1234",
    });

    expect(userOp.sender).toBe(dummyAccount);
    expect(userOp.callData).toBe("0x1234");
    expect(userOp.accountGasLimits.length).toBe(66);
    expect(userOp.gasFees.length).toBe(66);

    const hash = getUserOpHash(dummyEntryPoint, userOp, 8453); // Base mainnet chainId
    expect(hash.length).toBe(66);
    expect(hash.startsWith("0x")).toBe(true);
  });
});

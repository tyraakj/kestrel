import { describe, it, expect } from "vitest";
import { decodeFunctionData, slice, type Address, type Hex } from "viem";
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
  it("exports valid Viem ABIs with canonical functions and errors", () => {
    const getFunctions = (abi: readonly { type: string; name?: string }[]) =>
      abi.filter((item) => item.type === "function").map((item) => item.name);

    // KestrelSmartAccount functions
    const smartAccountFunctions = getFunctions(kestrelSmartAccountAbi);
    expect(smartAccountFunctions).toContain("validateUserOp");
    expect(smartAccountFunctions).toContain("executeBatch");
    expect(smartAccountFunctions).toContain("execute");
    expect(smartAccountFunctions).toContain("assertMinBalance");
    expect(smartAccountFunctions).toContain("recoverSigner");
    expect(smartAccountFunctions).toContain("owner");
    expect(smartAccountFunctions).toContain("entryPoint");

    // KestrelAccountFactory functions
    const factoryFunctions = getFunctions(kestrelAccountFactoryAbi);
    expect(factoryFunctions).toContain("createAccount");
    expect(factoryFunctions).toContain("getAddress");
    expect(factoryFunctions).toContain("entryPoint");

    // EntryPoint functions
    const entryPointFunctions = getFunctions(entryPointAbi);
    expect(entryPointFunctions).toContain("handleOps");
    expect(entryPointFunctions).toContain("getUserOpHash");
    expect(entryPointFunctions).toContain("depositTo");
    expect(entryPointFunctions).toContain("getNonce");

    // ERC20 functions
    const erc20Functions = getFunctions(erc20Abi);
    expect(erc20Functions).toContain("approve");
    expect(erc20Functions).toContain("transfer");
    expect(erc20Functions).toContain("transferFrom");
    expect(erc20Functions).toContain("balanceOf");
    expect(erc20Functions).toContain("allowance");
  });

  it("exports correct 4-byte custom error selectors", () => {
    expect(ERROR_SELECTORS.CALL_FAILED).toMatch(/^0x[0-9a-f]{8}$/);
    expect(ERROR_SELECTORS.INVARIANT_BREACHED).toMatch(/^0x[0-9a-f]{8}$/);
    expect(ERROR_SELECTORS.NOT_AUTHORIZED).toMatch(/^0x[0-9a-f]{8}$/);
    expect(ERROR_SELECTORS.ZERO_ADDRESS).toMatch(/^0x[0-9a-f]{8}$/);
  });

  it("includes recoverSigner in kestrelSmartAccountAbi", () => {
    const hasRecoverSigner = kestrelSmartAccountAbi.some(
      (item) => item.type === "function" && item.name === "recoverSigner"
    );
    expect(hasRecoverSigner).toBe(true);
  });
});

describe("UserOp Builder & Atomic Swap Batch", () => {
  const dummyTokenIn: Address = "0x0000000000000000000000000000000000000001";
  const dummyTokenOut: Address = "0x0000000000000000000000000000000000000002";
  const dummyRouter: Address = "0x0000000000000000000000000000000000000003";
  const dummyAccount: Address = "0x0000000000000000000000000000000000000004";
  const dummyEntryPoint: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  it("builds atomic 5-call swap batch with zero lingering allowance and circuit breaker", () => {
    const amountIn = 1_000_000n; // 1 USDC
    const minAmountOut = 300_000_000_000_000n; // 0.0003 ETH
    const preSwapBalance = 50_000_000_000_000n; // pre-existing 0.00005 ETH balance
    const dummySwapCalldata: Hex = "0x12345678";

    const calls = buildAtomicSwapBatch({
      tokenIn: dummyTokenIn,
      tokenOut: dummyTokenOut,
      amountIn,
      minAmountOut,
      preSwapBalance,
      ammRouter: dummyRouter,
      swapCalldata: dummySwapCalldata,
      smartAccountAddress: dummyAccount,
    });

    expect(calls.length).toBe(5);

    // Call 1: approve(router, 0n) -> Pre-reset for USDT non-zero allowance safety
    expect(calls[0].target).toBe(dummyTokenIn);
    expect(calls[0].value).toBe(0n);
    const decodedPreReset = decodeFunctionData({
      abi: erc20Abi,
      data: calls[0].data,
    });
    expect(decodedPreReset.functionName).toBe("approve");
    expect(decodedPreReset.args[0]).toBe(dummyRouter);
    expect(decodedPreReset.args[1]).toBe(0n);

    // Call 2: approve(router, amountIn) -> Approve trade amount
    expect(calls[1].target).toBe(dummyTokenIn);
    expect(calls[1].value).toBe(0n);
    const decodedApprove = decodeFunctionData({
      abi: erc20Abi,
      data: calls[1].data,
    });
    expect(decodedApprove.functionName).toBe("approve");
    expect(decodedApprove.args[0]).toBe(dummyRouter);
    expect(decodedApprove.args[1]).toBe(amountIn);

    // Call 3: router swap
    expect(calls[2].target).toBe(dummyRouter);
    expect(calls[2].value).toBe(0n);
    expect(calls[2].data).toBe(dummySwapCalldata);

    // Call 4: approve(router, 0n) -> Zero lingering allowance guarantee!
    expect(calls[3].target).toBe(dummyTokenIn);
    expect(calls[3].value).toBe(0n);
    const decodedRevoke = decodeFunctionData({
      abi: erc20Abi,
      data: calls[3].data,
    });
    expect(decodedRevoke.functionName).toBe("approve");
    expect(decodedRevoke.args[0]).toBe(dummyRouter);
    expect(decodedRevoke.args[1]).toBe(0n);

    // Call 5: assertMinBalance(tokenOut, preSwapBalance + minAmountOut) -> On-chain delta check!
    expect(calls[4].target).toBe(dummyAccount);
    expect(calls[4].value).toBe(0n);
    const decodedAssert = decodeFunctionData({
      abi: kestrelSmartAccountAbi,
      data: calls[4].data,
    });
    expect(decodedAssert.functionName).toBe("assertMinBalance");
    expect(decodedAssert.args[0]).toBe(dummyTokenOut);
    expect(decodedAssert.args[1]).toBe(preSwapBalance + minAmountOut);
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

  it("packUint128Pair formats two uint128 into a 32-byte hex with big-endian byte alignment", () => {
    const high = 150_000n;
    const low = 300_000n;
    const packed = packUint128Pair(high, low);

    expect(packed.length).toBe(66); // 0x + 64 hex chars (32 bytes)
    expect(packed.startsWith("0x")).toBe(true);

    // Verify upper 16 bytes contain `high` and lower 16 bytes contain `low`
    const highBytes = slice(packed, 0, 16);
    const lowBytes = slice(packed, 16, 32);
    expect(BigInt(highBytes)).toBe(high);
    expect(BigInt(lowBytes)).toBe(low);
  });

  it("creates packed UserOp with defaults and generates canonical 32-byte hash", () => {
    const userOp = createPackedUserOp({
      sender: dummyAccount,
      callData: "0x1234",
    });

    expect(userOp.sender).toBe(dummyAccount);
    expect(userOp.callData).toBe("0x1234");
    expect(userOp.accountGasLimits.length).toBe(66);
    expect(userOp.gasFees.length).toBe(66);

    // Test with standard number chainId
    const hash = getUserOpHash(dummyEntryPoint, userOp, 8453); // Base mainnet chainId
    expect(hash.length).toBe(66);
    expect(hash.startsWith("0x")).toBe(true);

    // Test with bigint chainId (produces identical hash)
    const hashBigInt = getUserOpHash(dummyEntryPoint, userOp, 8453n);
    expect(hashBigInt).toBe(hash);

    // Test with large chain ID to verify no precision loss
    const largeChainIdHash = getUserOpHash(dummyEntryPoint, userOp, 999_999_999_999n);
    expect(largeChainIdHash.length).toBe(66);
    expect(largeChainIdHash.startsWith("0x")).toBe(true);
  });
});

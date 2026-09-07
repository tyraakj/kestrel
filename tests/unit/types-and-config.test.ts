import { describe, it, expect } from "vitest";
import {
  jsonStringifyWithBigInt,
  jsonParseWithBigInt,
  bigIntReplacer,
  bigIntReviver,
  toPoolAddress,
  toTokenAddress,
  toExecutionId,
  generateExecutionId,
  poolAddressSchema,
  tokenAddressSchema,
  executionIdSchema,
  theGraphPoolSchema,
  x402ChallengeSchema,
  x402PaymentReceiptSchema,
  simulationResultSchema,
  selfHealingAttemptSchema,
  broadcastResultSchema,
  querySubgraphInputSchema,
  settleX402OutputSchema,
  requestLedgerSignOutputSchema,
  KestrelError,
} from "../../src/types.js";
import { appConfigSchema, loadConfig } from "../../src/config.js";

describe("Native BigInt Serialization Helpers", () => {
  it("serializes and deserializes BigInt primitives without precision loss", () => {
    const original = {
      zero: 0n,
      positive: 1000000000000000000n, // 1 ether
      maxUint256: 115792089237316195423570985008687907853269984665640564039457584007913129639935n,
      negativeTick: -887272n,
      nested: {
        amount: 5000000n,
        label: "USDC",
      },
    };

    const json = jsonStringifyWithBigInt(original);
    const parsed = jsonParseWithBigInt<typeof original>(json);

    expect(parsed.zero).toBe(0n);
    expect(parsed.positive).toBe(1000000000000000000n);
    expect(parsed.maxUint256).toBe(
      115792089237316195423570985008687907853269984665640564039457584007913129639935n
    );
    expect(parsed.negativeTick).toBe(-887272n);
    expect(parsed.nested.amount).toBe(5000000n);
    expect(parsed.nested.label).toBe("USDC");
  });

  it("bigIntReplacer converts bigints to strings", () => {
    expect(bigIntReplacer("amount", 123456n)).toBe("123456");
    expect(bigIntReplacer("string", "test")).toBe("test");
  });

  it("bigIntReviver safely handles non-integer strings and multi-key objects", () => {
    expect(bigIntReviver("key", { __bigint: "not-an-int" })).toEqual({ __bigint: "not-an-int" });
    expect(bigIntReviver("key", { __bigint: "123", extra: "field" })).toEqual({
      __bigint: "123",
      extra: "field",
    });
    expect(bigIntReviver("key", { __bigint: "123" })).toBe(123n);
    expect(bigIntReviver("key", { other: "data" })).toEqual({ other: "data" });
  });
});

describe("Branded Types & Validation", () => {
  const validAddress = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"; // Uniswap v3 USDC/ETH pool

  it("creates and validates PoolAddress and TokenAddress with checksums", () => {
    const pool = toPoolAddress(validAddress);
    expect(pool).toBe("0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640");

    const token = toTokenAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    expect(token).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  });

  it("rejects invalid Ethereum addresses", () => {
    expect(() => toPoolAddress("0xinvalid")).toThrow();
    expect(() => toTokenAddress("not-an-address")).toThrow();
  });

  it("creates and validates ExecutionId format (corr_...)", () => {
    const id = toExecutionId("corr_1757034900_abc123");
    expect(id).toBe("corr_1757034900_abc123");

    expect(() => toExecutionId("invalid_id")).toThrow(/must start with 'corr_'/);

    const generated = generateExecutionId();
    expect(generated.startsWith("corr_")).toBe(true);
  });

  it("Zod schemas parse branded types correctly", () => {
    const parsedPool = poolAddressSchema.parse(validAddress);
    expect(parsedPool).toBe("0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640");

    const parsedToken = tokenAddressSchema.parse("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    expect(parsedToken).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");

    const parsedExecId = executionIdSchema.parse("corr_test_123");
    expect(parsedExecId).toBe("corr_test_123");
  });
});

describe("Environment Configuration (src/config.ts)", () => {
  it("loads valid configuration with defaults applied", () => {
    const validEnv = {
      THE_GRAPH_API_KEY: "test-studio-key-123",
      DAILY_SPEND_LIMIT_USD: "25.50",
    };

    const config = loadConfig(validEnv);
    expect(config.THE_GRAPH_API_KEY).toBe("test-studio-key-123");
    expect(config.DAILY_SPEND_LIMIT_USD).toBe(25.5);
    expect(config.ETH_RPC_URL).toBe("http://127.0.0.1:8545");
    expect(config.BASE_RPC_URL).toBe("https://mainnet.base.org");
    expect(config.X402_MODE).toBe("SIMULATED");
    expect(config.LEDGER_TRANSPORT_MODE).toBe("VIRTUAL");
    expect(config.ANVIL_BIN_PATH).toBe("anvil");
    expect(config.TRANSACTION_FRESHNESS_TTL_SECONDS).toBe(120);

    const directParse = appConfigSchema.safeParse(validEnv);
    expect(directParse.success).toBe(true);
  });

  it("fails when THE_GRAPH_API_KEY is missing", () => {
    const missingKeyEnv = {
      DAILY_SPEND_LIMIT_USD: "10.00",
    };

    expect(() => loadConfig(missingKeyEnv)).toThrow(KestrelError);
    try {
      loadConfig(missingKeyEnv);
    } catch (err) {
      expect(err).toBeInstanceOf(KestrelError);
      const kerr = err as KestrelError;
      expect(kerr.code).toBe("CONFIG_VALIDATION_FAILED");
      expect(kerr.message).toContain("THE_GRAPH_API_KEY");
    }
  });

  it("strictly requires DAILY_SPEND_LIMIT_USD with no silent default", () => {
    const missingLeashEnv = {
      THE_GRAPH_API_KEY: "test-studio-key",
    };

    expect(() => loadConfig(missingLeashEnv)).toThrow(KestrelError);
    try {
      loadConfig(missingLeashEnv);
    } catch (err) {
      expect(err).toBeInstanceOf(KestrelError);
      const kerr = err as KestrelError;
      expect(kerr.message).toContain("DAILY_SPEND_LIMIT_USD");
      expect(kerr.message).toContain("No default spend leash is permitted");
    }
  });

  it("rejects non-positive DAILY_SPEND_LIMIT_USD", () => {
    const negativeLeashEnv = {
      THE_GRAPH_API_KEY: "test-studio-key",
      DAILY_SPEND_LIMIT_USD: "-5.00",
    };

    expect(() => loadConfig(negativeLeashEnv)).toThrow(KestrelError);
  });
});

describe("Domain Schemas & Discriminated Unions", () => {
  it("validates TheGraphPool schema", () => {
    const poolData = {
      poolAddress: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
      token0: {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        symbol: "USDC",
        decimals: 6,
      },
      token1: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        symbol: "WETH",
        decimals: 18,
      },
      feeTier: 500,
      liquidity: 15420392819283n,
      sqrtPriceX96: 182947192837192384719283n,
      tick: 201294,
      tvlUSD: 15200340.5,
    };

    const parsed = theGraphPoolSchema.parse(poolData);
    expect(parsed.token0.symbol).toBe("USDC");
    expect(parsed.liquidity).toBe(15420392819283n);
  });

  it("validates X402PaymentReceipt discriminated union", () => {
    const simReceipt = {
      mode: "simulated" as const,
      receiptId: "rcpt_sim_001",
      idempotencyKey: "idem_001",
      amountPaid: "0.004",
      settledAt: 1757034900000,
      latencyMs: 1.2,
    };

    const parsedSim = x402PaymentReceiptSchema.parse(simReceipt);
    expect(parsedSim.mode).toBe("simulated");

    const liveReceipt = {
      mode: "live_broadcast" as const,
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      idempotencyKey: "idem_002",
      payerAddress: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      blockNumber: "21049281",
      explorerUrl: "https://basescan.org/tx/0x123",
    };

    const parsedLive = x402PaymentReceiptSchema.parse(liveReceipt);
    expect(parsedLive.mode).toBe("live_broadcast");
  });

  it("validates x402ChallengeSchema with strict tokenAddress enforcement", () => {
    const validChallenge = {
      resourceUri: "https://gateway.thegraph.com/api/query",
      requiredAmount: "0.004",
      recipientAddress: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      facilitatorUrl: "https://x402.org/pay",
      challengeNonce: "nonce_123",
      network: "base" as const,
      tokenAddress: "0x0000000000000000000000000000000000000001",
    };
    const parsed = x402ChallengeSchema.parse(validChallenge);
    expect(parsed.tokenAddress).toBe("0x0000000000000000000000000000000000000001");

    const invalidChallenge = {
      ...validChallenge,
      tokenAddress: "malformed-not-an-address",
    };
    expect(() => x402ChallengeSchema.parse(invalidChallenge)).toThrow(
      /Must be a valid Ethereum address/
    );
  });

  it("validates SimulationResult discriminated union (success vs reverted)", () => {
    const successResult = {
      status: "success" as const,
      executionId: "corr_1234",
      gasUsed: 142000n,
      logs: ["Transfer(from, to, value)"],
      preBalances: { "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": 1000000000n },
      postBalances: { "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": 0n },
      netBalanceDeltas: { "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": -1000000000n },
    };

    const parsedSuccess = simulationResultSchema.parse(successResult);
    expect(parsedSuccess.status).toBe("success");

    const revertResult = {
      status: "reverted" as const,
      executionId: "corr_1234",
      gasUsed: 21000n,
      revertTrace: {
        errorSelector: "0x08c379a0",
        errorName: "PriceSlippageExceeded",
        decodedArgs: [1000n, 980n],
        revertedBytecodeOffset: 142,
        opcodeTrace: ["JUMP", "REVERT"],
      },
    };

    const parsedRevert = simulationResultSchema.parse(revertResult);
    expect(parsedRevert.status).toBe("reverted");
  });

  it("validates SelfHealingAttempt discriminated union (slippage vs approval)", () => {
    const slippageAttempt = {
      type: "slippage_recalibration" as const,
      executionId: "corr_1234",
      iteration: 1,
      oldMinOut: 990000n,
      newMinOut: 985000n,
      newSlippageBps: 50,
      healedCalldata: "0x0402",
    };

    const parsedSlippage = selfHealingAttemptSchema.parse(slippageAttempt);
    expect(parsedSlippage.type).toBe("slippage_recalibration");

    const approvalAttempt = {
      type: "approval_injection" as const,
      executionId: "corr_1234",
      token: "0x0000000000000000000000000000000000000001",
      spender: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      neededAllowance: 1000000000n,
      batchCalldata: "0x095ea7b3",
    };

    const parsedApproval = selfHealingAttemptSchema.parse(approvalAttempt);
    expect(parsedApproval.type).toBe("approval_injection");
  });

  it("validates BroadcastResult discriminated union", () => {
    const confirmed = {
      status: "confirmed" as const,
      txHash: "0x123",
      blockNumber: 21000000n,
      gasUsed: 120000n,
      effectiveGasPrice: 20000000000n,
      executionId: "corr_5678",
    };

    const parsed = broadcastResultSchema.parse(confirmed);
    expect(parsed.status).toBe("confirmed");
  });
});

describe("Pi ExtensionAPI Tool Schemas", () => {
  it("validates querySubgraphInputSchema", () => {
    const input = {
      executionId: "corr_test_01",
      poolId: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
    };

    const parsed = querySubgraphInputSchema.parse(input);
    expect(parsed.executionId).toBe("corr_test_01");
  });

  it("validates settleX402OutputSchema (settled vs failed)", () => {
    const settled = {
      status: "settled" as const,
      receipt: {
        mode: "simulated" as const,
        receiptId: "r1",
        idempotencyKey: "k1",
        amountPaid: "0.004",
        settledAt: 1757034900,
        latencyMs: 2,
      },
      remainingDailyBudgetUsd: 9.996,
    };

    const parsedSettled = settleX402OutputSchema.parse(settled);
    expect(parsedSettled.status).toBe("settled");

    const failed = {
      status: "failed" as const,
      reason: "Daily spend budget exceeded",
      errorCode: "POLICY_EXCEEDED",
      executionId: "corr_01",
    };

    const parsedFailed = settleX402OutputSchema.parse(failed);
    expect(parsedFailed.status).toBe("failed");
  });

  it("validates requestLedgerSignOutputSchema", () => {
    const signed = {
      status: "signed" as const,
      signature: "0x38472918237192837192837",
      signedSummary: "Swap 1000 USDC -> min 0.310 ETH",
    };

    const parsedSigned = requestLedgerSignOutputSchema.parse(signed);
    expect(parsedSigned.status).toBe("signed");

    const declined = {
      status: "declined" as const,
      reason: "User denied transaction on Ledger screen",
      code: "0x6985",
    };

    const parsedDeclined = requestLedgerSignOutputSchema.parse(declined);
    expect(parsedDeclined.status).toBe("declined");
  });
});

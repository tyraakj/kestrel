import { z } from "zod";
import { getAddress, isAddress } from "viem";

// ============================================================================
// 1. Native BigInt Serialization Helpers
// ============================================================================

export const bigIntReplacer = (_key: string, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;

export const bigIntReviver = (_key: string, value: unknown): unknown => {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    "__bigint" in value
  ) {
    const raw = (value as { __bigint: unknown }).__bigint;
    if (typeof raw === "string" && /^-?\d+$/.test(raw)) {
      try {
        return BigInt(raw);
      } catch {
        return value;
      }
    }
  }
  return value;
};

export function jsonStringifyWithBigInt(value: unknown, indent?: number): string {
  return JSON.stringify(
    value,
    (_key, val) => (typeof val === "bigint" ? { __bigint: val.toString() } : val),
    indent
  );
}

export function jsonParseWithBigInt<T = unknown>(text: string): T {
  return JSON.parse(text, bigIntReviver) as T;
}

// ============================================================================
// 2. Branded Types & Builders
// ============================================================================

declare const BrandSymbol: unique symbol;

export type Branded<T, B> = T & { readonly [BrandSymbol]: B };

export type PoolAddress = Branded<string, "PoolAddress">;
export type TokenAddress = Branded<string, "TokenAddress">;
export type ChallengeNonce = Branded<string, "ChallengeNonce">;
export type IdempotencyKey = Branded<string, "IdempotencyKey">;
export type ExecutionId = Branded<`corr_${string}`, "ExecutionId">;

export function toPoolAddress(address: string): PoolAddress {
  if (!isAddress(address)) {
    throw new Error(`Invalid PoolAddress: not an Ethereum address (${address})`);
  }
  return getAddress(address) as unknown as PoolAddress;
}

export function toTokenAddress(address: string): TokenAddress {
  if (!isAddress(address)) {
    throw new Error(`Invalid TokenAddress: not an Ethereum address (${address})`);
  }
  return getAddress(address) as unknown as TokenAddress;
}

export function toChallengeNonce(nonce: string): ChallengeNonce {
  if (!nonce || nonce.trim().length === 0) {
    throw new Error("Invalid ChallengeNonce: nonce cannot be empty");
  }
  return nonce as ChallengeNonce;
}

export function toIdempotencyKey(key: string): IdempotencyKey {
  if (!key || key.trim().length === 0) {
    throw new Error("Invalid IdempotencyKey: key cannot be empty");
  }
  return key as IdempotencyKey;
}

export function toExecutionId(id: string): ExecutionId {
  if (!id.startsWith("corr_")) {
    throw new Error(`Invalid ExecutionId: must start with 'corr_' (received '${id}')`);
  }
  return id as ExecutionId;
}

export function generateExecutionId(): ExecutionId {
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return `corr_${timestamp}_${randomSuffix}` as ExecutionId;
}

export const ethereumAddressSchema = z
  .string()
  .refine(isAddress, { message: "Must be a valid Ethereum address" })
  .transform((addr) => getAddress(addr));

// Zod schemas for branded types
export const poolAddressSchema = z
  .string()
  .refine(isAddress, { message: "Must be a valid Ethereum address" })
  .transform((addr) => getAddress(addr) as unknown as PoolAddress);

export const tokenAddressSchema = z
  .string()
  .refine(isAddress, { message: "Must be a valid Ethereum address" })
  .transform((addr) => getAddress(addr) as unknown as TokenAddress);

export const challengeNonceSchema = z
  .string()
  .min(1, { message: "Challenge nonce cannot be empty" })
  .transform((val) => val as ChallengeNonce);

export const idempotencyKeySchema = z
  .string()
  .min(1, { message: "Idempotency key cannot be empty" })
  .transform((val) => val as IdempotencyKey);

export const executionIdSchema = z
  .string()
  .regex(/^corr_.+$/, { message: "ExecutionId must begin with 'corr_'" })
  .transform((val) => val as ExecutionId);

// ============================================================================
// 3. Unified Error Interface & Class
// ============================================================================

export interface KestrelErrorDetails {
  [key: string]: unknown;
}

export interface IKestrelError {
  code: string;
  message: string;
  details?: KestrelErrorDetails;
}

export class KestrelError extends Error implements IKestrelError {
  public readonly code: string;
  public readonly details?: KestrelErrorDetails;

  constructor(code: string, message: string, details?: KestrelErrorDetails) {
    super(message);
    this.name = "KestrelError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, KestrelError.prototype);
  }
}

// ============================================================================
// 4. Subgraph Schemas & Inferred Types
// ============================================================================

export const tokenInfoSchema = z.object({
  address: tokenAddressSchema,
  symbol: z.string(),
  decimals: z.number().int().nonnegative(),
});
export type TokenInfo = z.infer<typeof tokenInfoSchema>;

export const theGraphPoolSchema = z.object({
  poolAddress: poolAddressSchema,
  token0: tokenInfoSchema,
  token1: tokenInfoSchema,
  inputTokens: z.array(tokenInfoSchema).optional(),
  feeTier: z.number().int().optional(),
  liquidity: z.bigint(),
  sqrtPriceX96: z.bigint().optional(),
  tick: z.number().int().optional(),
  tvlUSD: z.number().nonnegative(),
});
export type TheGraphPool = z.infer<typeof theGraphPoolSchema>;

export const agent0RegistrationSchema = z.object({
  agentId: z.string(),
  chainId: z.number().int(),
  owner: ethereumAddressSchema,
  name: z.string(),
  description: z.string(),
  mcpEndpoint: z.string().optional(),
  a2aEndpoint: z.string().optional(),
  x402Support: z.boolean(),
  reputationScore: z.number().optional(),
});
export type Agent0Registration = z.infer<typeof agent0RegistrationSchema>;

export const schemaStandardEnum = z.enum(["UNISWAP_V3", "MESSARI_DEX_AMM", "AGENT0_ERC8004"]);
export type SchemaStandard = z.infer<typeof schemaStandardEnum>;

export const prunedSubgraphResponseSchema = z.object({
  tokenCountSavingsRatio: z.number(),
  queryLatencyMs: z.number(),
  schemaStandard: schemaStandardEnum,
  payload: z.unknown(),
});
export type PrunedSubgraphResponse = z.infer<typeof prunedSubgraphResponseSchema>;

// ============================================================================
// 5. x402 Micropayment Schemas & Inferred Types
// ============================================================================

export const x402ChallengeSchema = z.object({
  resourceUri: z.string(),
  requiredAmount: z.string(),
  recipientAddress: ethereumAddressSchema,
  facilitatorUrl: z.string(),
  challengeNonce: challengeNonceSchema,
  network: z.enum(["base", "base-sepolia"]).optional(),
  tokenAddress: tokenAddressSchema.optional(),
});
export type X402Challenge = z.infer<typeof x402ChallengeSchema>;

export const simulatedPaymentReceiptSchema = z.object({
  mode: z.literal("simulated"),
  receiptId: z.string(),
  idempotencyKey: idempotencyKeySchema,
  amountPaid: z.string(),
  settledAt: z.number(),
  latencyMs: z.number(),
});
export type SimulatedPaymentReceipt = z.infer<typeof simulatedPaymentReceiptSchema>;

export const livePaymentReceiptSchema = z.object({
  mode: z.literal("live_broadcast"),
  txHash: z.string(),
  idempotencyKey: idempotencyKeySchema,
  payerAddress: ethereumAddressSchema,
  blockNumber: z.string(),
  explorerUrl: z.string(),
});
export type LivePaymentReceipt = z.infer<typeof livePaymentReceiptSchema>;

export const x402PaymentReceiptSchema = z.discriminatedUnion("mode", [
  simulatedPaymentReceiptSchema,
  livePaymentReceiptSchema,
]);
export type X402PaymentReceipt = z.infer<typeof x402PaymentReceiptSchema>;

// ============================================================================
// 6. Pre-Flight Sandbox & Revert Decoder Schemas
// ============================================================================

export const preflightBundleSchema = z.object({
  executionId: executionIdSchema,
  caller: ethereumAddressSchema,
  targetContract: ethereumAddressSchema,
  value: z.bigint(),
  calldata: z.string().regex(/^0x[0-9a-fA-F]*$/, "Calldata must be a 0x-prefixed hex string"),
  gasLimit: z.bigint(),
});
export type PreflightBundle = z.infer<typeof preflightBundleSchema>;

export const revertTraceSchema = z.object({
  errorSelector: z
    .string()
    .regex(
      /^0x[0-9a-fA-F]{8}$/,
      "Error selector must be 4 bytes hex (0x followed by 8 characters)"
    ),
  errorName: z.string(),
  decodedArgs: z.array(z.unknown()),
  revertedBytecodeOffset: z.number(),
  opcodeTrace: z.array(z.string()),
});
export type RevertTrace = z.infer<typeof revertTraceSchema>;

export const simulationSuccessSchema = z.object({
  status: z.literal("success"),
  executionId: executionIdSchema,
  gasUsed: z.bigint(),
  logs: z.array(z.string()),
  preBalances: z.record(z.string(), z.bigint()),
  postBalances: z.record(z.string(), z.bigint()),
  netBalanceDeltas: z.record(z.string(), z.bigint()),
});
export type SimulationSuccess = z.infer<typeof simulationSuccessSchema>;

export const simulationRevertedSchema = z.object({
  status: z.literal("reverted"),
  executionId: executionIdSchema,
  gasUsed: z.bigint(),
  revertTrace: revertTraceSchema,
});
export type SimulationReverted = z.infer<typeof simulationRevertedSchema>;

export const simulationResultSchema = z.discriminatedUnion("status", [
  simulationSuccessSchema,
  simulationRevertedSchema,
]);
export type SimulationResult = z.infer<typeof simulationResultSchema>;

// ============================================================================
// 7. Self-Healing Trajectory & Event Schemas
// ============================================================================

export const poolStateSchema = z.object({
  sqrtPriceX96: z.bigint(),
  tick: z.number().int(),
  liquidity: z.bigint(),
});
export type PoolState = z.infer<typeof poolStateSchema>;

export const executionTrajectorySchema = z.object({
  executionId: executionIdSchema,
  iteration: z.number().int().nonnegative(),
  snapshotId: z.string(),
  originalCalldata: z.string().regex(/^0x[0-9a-fA-F]*$/),
  calldataHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "Calldata hash must be a 32-byte 0x-prefixed hex string"),
  expiresAt: z.string(), // ISO-8601 string
  invariants: z.record(z.string(), z.unknown()),
  revertTrace: revertTraceSchema,
  poolState: poolStateSchema,
});
export type ExecutionTrajectory = z.infer<typeof executionTrajectorySchema>;

export const slippageRecalibrationAttemptSchema = z.object({
  type: z.literal("slippage_recalibration"),
  executionId: executionIdSchema,
  iteration: z.number().int().min(1).max(2),
  oldMinOut: z.bigint(),
  newMinOut: z.bigint(),
  newSlippageBps: z.number().min(0).max(200),
  healedCalldata: z.string().regex(/^0x[0-9a-fA-F]*$/),
});
export type SlippageRecalibrationAttempt = z.infer<typeof slippageRecalibrationAttemptSchema>;

export const approvalInjectionAttemptSchema = z.object({
  type: z.literal("approval_injection"),
  executionId: executionIdSchema,
  token: tokenAddressSchema,
  spender: ethereumAddressSchema,
  neededAllowance: z.bigint(),
  batchCalldata: z.string().regex(/^0x[0-9a-fA-F]*$/),
});
export type ApprovalInjectionAttempt = z.infer<typeof approvalInjectionAttemptSchema>;

export const selfHealingAttemptSchema = z.discriminatedUnion("type", [
  slippageRecalibrationAttemptSchema,
  approvalInjectionAttemptSchema,
]);
export type SelfHealingAttempt = z.infer<typeof selfHealingAttemptSchema>;

export const selfHealingEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("attempt_started"),
    executionId: executionIdSchema,
    iteration: z.number().int(),
    strategy: z.string(),
  }),
  z.object({
    type: z.literal("param_diff"),
    executionId: executionIdSchema,
    parameter: z.string(),
    oldValue: z.string(),
    newValue: z.string(),
  }),
  z.object({
    type: z.literal("simulation_result"),
    executionId: executionIdSchema,
    status: z.enum(["passed", "reverted"]),
    gasUsed: z.bigint(),
  }),
  z.object({
    type: z.literal("converged"),
    executionId: executionIdSchema,
    iterationsUsed: z.number().int(),
    finalCalldata: z.string(),
  }),
  z.object({
    type: z.literal("aborted"),
    executionId: executionIdSchema,
    reason: z.string(),
    revertTrace: revertTraceSchema.optional(),
  }),
]);
export type SelfHealingEvent = z.infer<typeof selfHealingEventSchema>;

// ============================================================================
// 8. Telemetry & Tracing Schemas
// ============================================================================

export const telemetryEventNameEnum = z.enum([
  "execution_started",
  "subgraph_hydrated",
  "x402_challenged",
  "x402_settled",
  "simulation_executed",
  "revert_caught",
  "self_healing_attempted",
  "balance_invariant_verified",
  "trajectory_sealed",
  "trajectory_verified",
  "policy_leash_checked",
  "ledger_sign_completed",
  "signing_declined",
  "freshness_expired",
  "signature_destroyed",
  "broadcast_submitted",
  "execution_completed",
]);
export type TelemetryEventName = z.infer<typeof telemetryEventNameEnum>;

export const telemetryEventSchema = z.object({
  event: telemetryEventNameEnum,
  executionId: executionIdSchema,
  timestamp: z.number(),
  payload: z.record(z.string(), z.unknown()),
});
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export const executionSpanSchema = z.object({
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  executionId: executionIdSchema,
  name: z.string(),
  durationMs: z.number(),
  attributes: z.record(z.string(), z.unknown()),
});
export type ExecutionSpan = z.infer<typeof executionSpanSchema>;

// ============================================================================
// 9. Ledger Key Ring & Broadcast Schemas
// ============================================================================

export const policyLeashStatusEnum = z.enum(["PASS", "WARN", "BLOCKED"]);
export type PolicyLeashStatus = z.infer<typeof policyLeashStatusEnum>;

export const ledgerSignRequestSchema = z.object({
  executionId: executionIdSchema,
  targetContract: ethereumAddressSchema,
  functionName: z.string(),
  sanitizedParams: z.array(z.unknown()),
  netBalanceDelta: z.string(),
  dailySpendUsd: z.number(),
  policyLeashStatus: policyLeashStatusEnum,
});
export type LedgerSignRequest = z.infer<typeof ledgerSignRequestSchema>;

export const policyLedgerEntrySchema = z.object({
  txHash: z.string(),
  amountUsd: z.number(),
  timestamp: z.number(),
});
export type PolicyLedgerEntry = z.infer<typeof policyLedgerEntrySchema>;

export const policyLedgerSchema = z.object({
  dailySpendLimitUsd: z.number().positive(),
  currentDaySpendUsd: z.number().nonnegative(),
  lastResetUtc: z.string(),
  transactionHistory: z.array(policyLedgerEntrySchema),
});
export type PolicyLedger = z.infer<typeof policyLedgerSchema>;

export const broadcastAcceptedSchema = z.object({
  status: z.literal("accepted"),
  txHash: z.string(),
  executionId: executionIdSchema,
});
export type BroadcastAccepted = z.infer<typeof broadcastAcceptedSchema>;

export const broadcastRejectedSchema = z.object({
  status: z.literal("rejected"),
  reason: z.string(),
  errorCode: z.string(),
  executionId: executionIdSchema,
});
export type BroadcastRejected = z.infer<typeof broadcastRejectedSchema>;

export const broadcastConfirmedSchema = z.object({
  status: z.literal("confirmed"),
  txHash: z.string(),
  blockNumber: z.bigint(),
  gasUsed: z.bigint(),
  effectiveGasPrice: z.bigint(),
  executionId: executionIdSchema,
});
export type BroadcastConfirmed = z.infer<typeof broadcastConfirmedSchema>;

export const broadcastRevertedOnChainSchema = z.object({
  status: z.literal("reverted_on_chain"),
  txHash: z.string(),
  revertReason: z.string().optional(),
  executionId: executionIdSchema,
});
export type BroadcastRevertedOnChain = z.infer<typeof broadcastRevertedOnChainSchema>;

export const broadcastResultSchema = z.discriminatedUnion("status", [
  broadcastAcceptedSchema,
  broadcastRejectedSchema,
  broadcastConfirmedSchema,
  broadcastRevertedOnChainSchema,
]);
export type BroadcastResult = z.infer<typeof broadcastResultSchema>;

// ============================================================================
// 10. ERC-4337 Smart Account & On-Chain Invariant Schemas
// ============================================================================

export const callStructSchema = z.object({
  target: ethereumAddressSchema,
  value: z.bigint(),
  data: z.string().regex(/^0x[0-9a-fA-F]*$/),
});
export type CallStruct = z.infer<typeof callStructSchema>;

export const packedUserOperationSchema = z.object({
  sender: ethereumAddressSchema,
  nonce: z.bigint(),
  initCode: z.string().regex(/^0x[0-9a-fA-F]*$/),
  callData: z.string().regex(/^0x[0-9a-fA-F]*$/),
  accountGasLimits: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  preVerificationGas: z.bigint(),
  gasFees: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  paymasterAndData: z.string().regex(/^0x[0-9a-fA-F]*$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]*$/),
});
export type PackedUserOperation = z.infer<typeof packedUserOperationSchema>;

export const invariantBreachedSchema = z.object({
  token: ethereumAddressSchema,
  minExpectedBalance: z.bigint(),
  actualBalance: z.bigint(),
});
export type InvariantBreached = z.infer<typeof invariantBreachedSchema>;

// ============================================================================
// 11. Pi ExtensionAPI Tool Input & Output Schema Pairs
// ============================================================================

export const querySubgraphInputSchema = z.object({
  executionId: executionIdSchema,
  poolId: poolAddressSchema,
  tokenFilter: tokenAddressSchema.optional(),
});
export type QuerySubgraphInput = z.infer<typeof querySubgraphInputSchema>;

export const querySubgraphOutputSchema = z.object({
  pool: theGraphPoolSchema,
  savingsRatio: z.number(),
  latencyMs: z.number(),
});
export type QuerySubgraphOutput = z.infer<typeof querySubgraphOutputSchema>;

export const settleX402InputSchema = z.object({
  executionId: executionIdSchema,
  challenge: x402ChallengeSchema,
  bypassLive: z.boolean().optional(),
});
export type SettleX402Input = z.infer<typeof settleX402InputSchema>;

export const settleX402SettledOutputSchema = z.object({
  status: z.literal("settled"),
  receipt: x402PaymentReceiptSchema,
  remainingDailyBudgetUsd: z.number(),
});
export type SettleX402SettledOutput = z.infer<typeof settleX402SettledOutputSchema>;

export const settleX402FailedOutputSchema = z.object({
  status: z.literal("failed"),
  reason: z.string(),
  errorCode: z.string(),
  executionId: executionIdSchema,
});
export type SettleX402FailedOutput = z.infer<typeof settleX402FailedOutputSchema>;

export const settleX402OutputSchema = z.discriminatedUnion("status", [
  settleX402SettledOutputSchema,
  settleX402FailedOutputSchema,
]);
export type SettleX402Output = z.infer<typeof settleX402OutputSchema>;

export const simulatePreflightInputSchema = z.object({
  bundle: preflightBundleSchema,
});
export type SimulatePreflightInput = z.infer<typeof simulatePreflightInputSchema>;

export const simulatePreflightOutputSchema = z.object({
  result: simulationResultSchema,
});
export type SimulatePreflightOutput = z.infer<typeof simulatePreflightOutputSchema>;

export const selfHealCalldataInputSchema = z.object({
  trajectory: executionTrajectorySchema,
});
export type SelfHealCalldataInput = z.infer<typeof selfHealCalldataInputSchema>;

export const selfHealCalldataOutputSchema = z.object({
  healedAttempt: selfHealingAttemptSchema,
  canRetry: z.boolean(),
});
export type SelfHealCalldataOutput = z.infer<typeof selfHealCalldataOutputSchema>;

export const requestLedgerSignInputSchema = z.object({
  executionId: executionIdSchema,
  targetContract: ethereumAddressSchema,
  calldata: z.string().regex(/^0x[0-9a-fA-F]*$/),
  expectedDelta: z.string(),
  intentDescription: z.string(),
});
export type RequestLedgerSignInput = z.infer<typeof requestLedgerSignInputSchema>;

export const ledgerSignSignedOutputSchema = z.object({
  status: z.literal("signed"),
  signature: z.string(),
  signedSummary: z.string(),
});
export type LedgerSignSignedOutput = z.infer<typeof ledgerSignSignedOutputSchema>;

export const ledgerSignDeclinedOutputSchema = z.object({
  status: z.literal("declined"),
  reason: z.string(),
  code: z.string(),
});
export type LedgerSignDeclinedOutput = z.infer<typeof ledgerSignDeclinedOutputSchema>;

export const ledgerSignExpiredOutputSchema = z.object({
  status: z.literal("expired"),
  reason: z.string(),
});
export type LedgerSignExpiredOutput = z.infer<typeof ledgerSignExpiredOutputSchema>;

export const ledgerSignTimeoutOutputSchema = z.object({
  status: z.literal("timeout"),
  reason: z.string(),
});
export type LedgerSignTimeoutOutput = z.infer<typeof ledgerSignTimeoutOutputSchema>;

export const requestLedgerSignOutputSchema = z.discriminatedUnion("status", [
  ledgerSignSignedOutputSchema,
  ledgerSignDeclinedOutputSchema,
  ledgerSignExpiredOutputSchema,
  ledgerSignTimeoutOutputSchema,
]);
export type RequestLedgerSignOutput = z.infer<typeof requestLedgerSignOutputSchema>;

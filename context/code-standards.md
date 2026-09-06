# Code Standards: Kestrel

> **Implementation Rules, Cryptographic Conventions, Pi Prompt Architecture, and Zero-Shortcut Invariants**

---

## 1. General Principles

- **Real Computation Only:** Never hardcode return values, responses, or outputs to make tests or demos pass. Every function must compute its result from actual runtime inputs.
- **Fix Root Causes:** Never layer workarounds, swallow exceptions, or mask failing logic.
- **Single Responsibility:** One module per file. Keep boundaries strictly separated between Zone 1 (Untrusted Pi Agent), Zone 2 (Deterministic Sandbox), and Zone 3 (Ledger Key Ring).
- **Respect System Invariants:** Adhere to all invariants detailed in `architecture-context.md`.

---

## 2. TypeScript & Strict Type Safety

- **Strict Mode Mandatory:** `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true` in `tsconfig.json`. Weakening config or turning off rules is strictly prohibited.
- **Zero Suppression Policy:**
  - Never use `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `// eslint-disable`, or `as any`.
  - Type errors must be solved by creating correct interfaces, discriminated unions, or narrow type guards.
- **Type Contracts via Zod:**
  - All external data entering the application (Subgraph responses, x402 headers, RPC calldata, Pi tool inputs) must be validated with Zod at the boundary.
  - Export inferred TypeScript types alongside every Zod schema (`export type SimulationResult = z.infer<typeof SimulationResultSchema>`).
  - Never write manual types that drift from runtime schema validators.
- **Discriminated Unions for Multi-State Results:**
  - Never model divergent runtime states with optional/nullable fields. Use explicit tagged unions (`status: 'success' | 'reverted'`, `type: 'slippage_recalibration' | 'approval_injection'`) to enable exhaustive compile-time narrowing.
- **Branded Types for Critical Identifiers:**
  - Use branded types (`PoolAddress`, `TokenAddress`, `ChallengeNonce`, `IdempotencyKey`) to prevent accidental parameter transposition in financial and cryptographic operations.
- **Unified Error Shape (`KestrelError`):**
  - All subsystem exceptions and tool failure envelopes must implement a consistent structure: machine-readable `code` (`UPPER_SNAKE` enum), human-readable `message`, and strongly-typed `details`.
- **Intent-Derived Idempotency & Atomic Claims:**
  - State-changing operations (micropayments, spend ledger deductions) must derive idempotency keys strictly from intent (`sha256(resourceUri + nonce)`), never from retry attempt timestamps.
  - Claims must be executed atomically (mutex/lock) to eliminate TOCTOU race conditions. Reused keys with identical payload return cached receipts; altered payloads fail with `IDEMPOTENCY_PAYLOAD_MISMATCH`.

---

## 3. EVM & Crypto Standards (Viem)

- **Viem Preferred:** Use `viem` exclusively for all EVM encodings, decodings, ABI interactions, and RPC communications.
- **Strict BigInt Safety & Serialization:**
  - All token amounts, gas limits, pool ticks, and wei values must use native JavaScript `bigint` (e.g. `parseEther('0.31')`, `parseUnits('1000', 6)`).
  - Never convert `bigint` to standard JavaScript `number` where precision loss can occur.
  - For JSON serialization, use explicit hex strings (`0x${string}`) or string representations with decimal scaling.
  - Custom BigInt JSON replacer and reviver helpers:
    ```typescript
    export const bigIntReplacer = (_key: string, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value;
    ```
- **Address Normalization:**
  - All Ethereum addresses must be validated with `isAddress(addr)` and formatted using `getAddress(addr)` (EIP-55 checksummed).
- **Solidity Revert Decoding:**
  - Custom errors must be decoded using ABI definitions via `decodeErrorResult({ abi, data })`.
  - Standard error selectors must be recognized:
    - `0x08c379a0`: `Error(string)`
    - `0x4e487b71`: `Panic(uint256)`
  - Known DeFi custom error selectors:
    - `PriceSlippageExceeded(uint256 expected, uint256 actual)`
    - `InsufficientOutputAmount()`
    - `ERC20InsufficientAllowance(address spender, uint256 currentAllowance, uint256 needed)`
  - Typed error handlers in `src/sandbox/revert-decoder.ts` must parse these parameters for the self-healing loop.

---

## 4. Pi Agent Architecture & Prompt Engineering (5-Layer Modular Structure)

All agent prompts in Kestrel must follow the **5-layer modular structure** to maximize prompt caching, precision, and deterministic tool execution:

1. **Layer 1: Static System Prompt (Prefix)**
   - Defined in root `SYSTEM.md`. Role definition: _Sovereign DeFi Quantitative Execution Agent_.
   - Invariants: Cannot sign transactions directly, cannot bypass pre-flight sandbox, must verify net balance invariant $\Delta B \ge minOut$.
   - Includes `<skills>` index linking to subagent skill guides.
2. **Layer 2: Static Examples (Few-Shot)**
   - Concrete examples of converting user intent into tool calls:
     - `User: "Swap 1000 USDC for WETH on Uniswap v3"` $\rightarrow$ `Tools: query_subgraph(pool_id) -> settle_x402() -> simulate_preflight()`.
   - Examples of handling slippage reverts and adjusting parameters.
3. **Layer 3: Tools & Output Schema Specification (Static)**
   - Explicit JSON schemas for `query_subgraph`, `settle_x402`, `simulate_preflight`, and `request_clear_sign`.
   - Validation expectations and error recovery instructions.
4. **Layer 4: Dynamic Market & Simulation Context (Dynamic)**
   - Live hydrated pool state from Subgraph Studio (pruned to -95% tokens).
   - In-memory simulation result deltas (`gasUsed`, `balanceDeltas`, opcode traces).
5. **Layer 5: User Intent & Immediate Directive (Dynamic)**
   - The user's prompt in the TUI (`kestrel ❯ ...`).

_Note: Keeping Layers 1–3 strictly static allows LLMs with prompt caching (Gemini, Anthropic, OpenAI) to execute tool reasoning with sub-second latency._

### Pi Extension & Subagent Layout

- **Root Prompt Override (`SYSTEM.md`):** Definitive persona and `<skills>` directory index.
- **Skill Manifests (`skills/kestrel-*/SKILL.md`):** Specialized guides for `kestrel-scout` (The Graph & x402), `kestrel-verifier` (Anvil simulation & self-healing), and `kestrel-guardian` (Ledger clear-signing & daily leash).
- **Extension Entrypoint (`src/extensions/kestrel.ts`):** Registers typed tools via `ExtensionAPI`, slash commands (`/leash`, `/reset`), and CLI flags (`--daily-leash`).
- **Process Wrapper (`src/cli/client.ts`) & CLI Mode Dispatcher (`src/cli/main.ts`):** Supports `interactive` (Split-Screen TUI), `rpc` (headless JSON-RPC), and `print` (diagnostic).

---

## 5. The Graph Studio Integration (Lean Native Fetch)

- **No Heavy GraphQL Libraries:** Do not import `@urql/core`, `@apollo/client`, or `graphql-tag`. Query Subgraph Studio endpoints directly via native Node.js `fetch` using HTTP POST.
- **Live Studio Endpoints:** All Subgraph queries must target live Subgraph Studio endpoints with an active API key (`THE_GRAPH_API_KEY`). Static, mocked JSON files are strictly banned.
- **Schema Pruning Pipeline (`src/graph/pruner.ts`):**
  - Strip GraphQL introspection comments (`# ...`), descriptions (`"""..."""`), and non-essential fields before passing schema context to the LLM.
  - Must achieve $>90\%$ token payload reduction.
- **Query Latency & Caching:**
  - Record query start/end timestamps and surface latency metrics to the right pane of the TUI.
  - In-memory LRU cache with a 30-second TTL prevents duplicate network hits during rapid self-healing retries.
- **Querying Best Practices & Static Operations:**
  - Author all queries as static document strings with typed variables (`$id: ID!`, `$first: Int`); dynamic query string concatenation/interpolation is strictly prohibited to enable server-side caching and static validation.
  - Combine multiple operations in a single GraphQL request (e.g. pool reserves + recent swaps) to reduce network roundtrips.
  - Support both `subgraphs/id/<SUBGRAPH_ID>` (latest) and pinned `deployments/id/<DEPLOYMENT_ID>` endpoints.
- **Composable & Standardized Subgraph Support:**
  - Support native Uniswap v3/v4 queries, Messari Standardized Subgraph schemas (`DexAmm` / `LiquidityPool`), Agent0 `ERC-8004` Trustless Agents schemas, and Composable Subgraphs (`specVersion >= 1.3.0`, combining up to 5 source subgraphs with immutable entities).
  - Enables single-query composition across heterogeneous DEX protocols (Uniswap, Curve, Balancer) and cross-protocol data aggregation without changing consumer logic.
- **The Graph x402 Pay-Per-Query & Gateway Alignment:**
  - Standard API Key access uses `Authorization: Bearer <API_KEY>` targeting `https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>`, `https://gateway-arbitrum.network.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`, or pinned `/api/deployments/id/<DEPLOYMENT_ID>`.
  - Autonomous agent x402 access uses `https://gateway.thegraph.com/api/x402/subgraphs/id/<SUBGRAPH_ID>` or `/api/x402/deployments/id/<DEPLOYMENT_ID>` with USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) or Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`), fully compatible with `@graphprotocol/client-x402` via single HTTP roundtrip payment retry.
- **Subgraph Forking & Simulation Parity:**
  - Kestrel's pre-flight simulation sandbox mirrors The Graph's local debugging forking architecture (`graph deploy --debug-fork <DeploymentID>` with `startBlock`), lazily fetching live chain state and subgraph entities to execute in-memory zero-revert simulations in <10ms without full sync or testnet wait times.
- **Subgraph Linter Safety Invariants:**
  - All pricing and hydrator calculations (`src/graph/hydrator.ts`) must enforce static safety invariants derived from Subgraph Linter:
    - `division-guard`: explicitly guard all arithmetic divisions against zero denominators before calculation.
    - `unexpected-null` & `uncheckednonnull-`: explicitly validate that entities and properties (`token0`, `token1`, `liquidity`, `tick`) exist before accessing; non-null assertion operators (`!`) are strictly prohibited.
- **The Graph 6 Core Subgraph Performance Best Practices:**
  - **BP1 - Pruning with `indexerHints`:** Use `indexerHints: prune: auto` to retain minimal historical states and optimize query throughput; coordinate block retention with Time Travel Queries and Grafting requirements.
  - **BP2 - Large Arrays with `@derivedFrom`:** Strictly replace unbounded mutable arrays with `@derivedFrom` virtual 1-to-many relationships, eliminating duplicate database writes and unlocking derived field loaders.
  - **BP3 - Immutable Entities & Bytes IDs:** Annotate event entities with `@entity(immutable: true)` and use `Bytes!` IDs (concatenating via `.concatI32()` instead of string formatting); provide auxiliary `BigInt!` fields for sequential ordering since Bytes IDs sort lexicographically by hex representation. Delivers up to +28% query and +48% indexing performance gains.
  - **BP4 - Eliminating & Declaring `eth_calls`:** Emit needed data in contract events whenever possible; when unavoidable, declare `calls:` in manifest event handlers (`specVersion >= 1.2.0`) to enable parallel execution and in-memory caching in `graph-node`.
  - **BP5 - Timeseries & Aggregations:** Structure high-volume temporal data using `@entity(timeseries: true)` with auto `Int8!` IDs and `Timestamp!`; compute summaries via `@aggregation(intervals: [...])` with dimension grouping to offload calculation to the database.
  - **BP6 - Grafting for Hotfixes:** Support rapid hotfix deployments via `graft: base: <DeploymentID>, block: <N>` to continue indexing from the error block without genesis re-indexing; pin queries by Deployment ID (`deployments/id/...`) for deterministic versioning.
- **Dual-Format Agent SKILL Packaging:**
  - Provide `skills/kestrel-scout/SKILL.md` (Claude Code / Cursor / Pi) and `openclaw/subgraph-kestrel-scout/SKILL.md` (OpenClaw / Clawdbot) formatted according to the official `subgraphs-skills` repository standard, incorporating AST schema pruning (-95%), Subgraph Linter static check guidelines, the 6 core performance best practices, and autonomous pay-per-query micropayments.

---

## 6. x402 Micropayment Standards

- **Two Explicit Transport Modes:**
  1. `LocalSimulationMode` (Zero-Testnet Harness): Routes to an in-memory mock facilitator that validates EIP-712 signatures and settles in 0ms without external HTTP calls.
  2. `LiveBroadcastMode`: Routes to The Graph's live x402 payment gateway on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) or Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) using EIP-712 signatures via `@graphprotocol/client-x402`.
- **Strict Mode Isolation:** Code must explicitly check `config.x402Mode`—no silent fallback or ambiguous execution state.
- **Budget Tracking Invariant:** Every x402 payment must increment the daily spend counter. If the daily spend leash is unset, or if `dailySpend + paymentAmount > policy.maxDailySpend` (strictly user-configured via `DAILY_SPEND_LIMIT_USD` or `--daily-leash`; no silent default is permitted), the payment MUST be rejected immediately with `PolicyExceededError`.

---

## 7. Ledger Key Ring & Hardware Isolation Standards

- **Dual-Transport Architecture:**
  - `NodeHidTransport`: Communicates with physical Ledger Stax/Flex/Nano via USB.
  - `VirtualLedgerTransport`: In-memory simulator for automated tests and headless environments with interactive terminal screen buffer.
- **Clear-Signing Requirement:**
  - Transactions sent to the Ledger transport must include a complete, human-readable summary:
    - Target contract name and EIP-55 checksummed address (`getAddress(targetContract)`).
    - Asset in, exact amount (scaled from native `bigint`), and decimal symbol.
    - Guaranteed minimum asset out and decimal symbol.
    - Destination chain ID.
    - Maximum slippage tolerance (bps).
    - Computed and verified net balance delta ($\Delta B$).
- **Zone 2 $\rightarrow$ Zone 3 Payload Integrity & Freshness Verification:**
  - Pi Guardian must independently verify the simulation trajectory payload before allowing calldata to reach the Ledger transport:
    - Asserts `sha256(calldata) === trajectory.calldataHash` to guarantee in-transit calldata integrity.
    - Asserts `Date.now() < trajectory.expiresAt` (120s window).
    - Asserts simulation passed with mathematical balance invariant verified ($\Delta B_{out} \ge minOut$).
  - Pi Commander (Zone 1) acts as an orchestrator; any discrepancy between synthesized calldata, target contract, or invariant proof triggers immediate rejection with `TrajectoryIntegrityError`.
- **Operator Decline & Timeout Handling:**
  - Explicitly catch device denial (`0x6985`) and USB transport timeouts, returning a typed `SigningDeclined` result carrying `executionId` and reason. Never throw unhandled exceptions or crash the TUI on user cancellation.
- **Freshness Gate & Stale Signature Destruction:**
  - Pi Guardian must assert `Date.now() < trajectory.expiresAt` (120s window; configurable via `TRANSACTION_FRESHNESS_TTL_SECONDS`).
  - If signing delay exceeds 120 seconds (2 minutes), the signed bytecode MUST be immediately destroyed from memory (`destroy_stale_signature()`).
  - Guardian returns `FreshnessExpiredError`, invalidating the trajectory.
  - The transaction must be re-simulated by Pi Verifier against current block state, producing a fresh trajectory that **must undergo a complete Phase 3 clear-signing loop on the Ledger device with fresh parameters**. Stale signatures can never be reused or broadcast.
- **Zero Software Private Keys Invariant:**
  - Private keys, seed phrases, or unencrypted mnemonic words must NEVER exist in Node.js process memory. Zero software signing keys are generated or stored in any subagent.
  - The physical Ledger hardware device (Zone 3) is the SOLE cryptographic root of trust in the system. The Node.js application only sends decoded payload summaries and unsigned hashes to the Ledger transport; the secure element handles private key storage and signing.
- **Ledger Agent Stack, `wallet-cli ring` & No-USB Host Support:**
  - Official Tooling Integration: Incorporates `@ledgerhq/wallet-cli` and DMK skills (`ledgerhq/agent-skills`).
  - Capability Broker Pattern: Sensitive credentials (e.g. `THE_GRAPH_API_KEY`) are encrypted via `wallet-cli ring encrypt`. Pi Guardian brokers scoped capabilities; raw secrets are never passed in plain text to the LLM agent reasoning context (Pi Commander).
  - No-USB Host Enrollment: For environments with no physical USB port (VPS, CI runners, or local developers), Kestrel supports `wallet-cli ring` headless enrollment mode alongside the on-screen ASCII OLED terminal simulator, enabling seamless automated workflows with zero key leakage.

---

## 8. Error Handling & Testing Non-Negotiables

- **No Empty Catch Blocks:** Never write `catch (e) {}` or log-and-drop. Catch blocks must either meaningfully recover, trigger self-healing, or rethrow.
- **Test Real Code Paths:** Tests must exercise real functions with real inputs. No `assert true`, no trivial passes, and no skipped tests counted as done.
- **No Unauthorized Mocking:** The core sandbox engine, revert decoder, schema pruner, and policy evaluator must run with real logic—only external network APIs (when offline) or physical USB hardware may use designated simulators.

---

## 9. Observability, Telemetry & Redaction Standards

- **The 4 Core Operator Questions:**
  1. _Did the Anvil simulation pass or revert, and what was the decoded reason?_
  2. _Did the mathematical net balance invariant hold ($\Delta B_{out} \ge minOut$)?_
  3. _What was the x402 payment status and remaining daily spend leash balance?_
  4. _Where did latency go across the subagent pipeline (Graph $\rightarrow$ x402 $\rightarrow$ Sandbox $\rightarrow$ Ledger)?_
- **Structured NDJSON Logging:**
  - All runtime events must be recorded as single-line JSON objects in `.kestrel/runs/<executionId>.ndjson`.
  - No unstructured `console.log` statements in production code.
  - Every log record must carry an `executionId` (`corr_${string}`), stable `event` name, ISO timestamp, and machine-readable payload.
- **Mechanical Redaction:**
  - Telemetry loggers must sanitize payloads against an allowlist: mnemonic seed words, Ledger PINs, and HTTP `Authorization` headers must never be emitted to disk or stdout.
- **RED Metrics & Bounded Cardinality:**
  - Track Rate, Errors, and Duration histograms (p50/p95/p99) for Subgraph queries, Anvil pre-flight, and x402 payments.
  - Labels must come from bounded sets (`tool_name`, `error_type`, `network`, `status`). Never use prompt text, user IDs, or dynamic addresses as metric labels.

---

## 10. Prime-Style Self-Healing & Trajectory Protocols

- **Trajectory Evidence Formulation:**
  - Healing strategies must consume structured `ExecutionTrajectory` evidence packets (including `executionId`, `expiresAt`, `calldataHash`, decoded error selector, ABI args, pool tick, and snapshot ID), never raw error strings.
- **Clean-Room State Rollbacks:**
  - Before every re-simulation attempt, Anvil must execute `evm_revert(snapshotId)` to return to pristine baseline state, eliminating accumulated retry debris.
- **Dedicated Allowance Recovery Branch (No Conflation):**
  - Errors decoded as `ERC20InsufficientAllowance` or `SafeTransferFailed` route strictly to `src/sandbox/strategies/approval.ts`.
  - Synthesizes an atomic multi-call batch containing an ERC-20 `approve(spender, needed)` call prepended to the swap calldata.
  - Strictly limited to a single retry attempt (`maxAllowanceRetries = 1`).
  - Does NOT touch the slippage retry budget and does NOT re-query Scout for price quotes.
  - If the synthesized approval batch fails, immediately emits `ApprovalInjectionFailedError` and aborts to the operator with clear diagnostic details.
- **Slippage Recalibration Loop & State Re-Hydration:**
  - Errors decoded as `PriceSlippageExceeded` or `TooLittleReceived` route strictly to `src/sandbox/strategies/slippage.ts`.
  - Before recalibrating parameters (e.g. bumping slippage or recalculating `minOut`), Pi Verifier MUST request fresh `SubgraphPoolState` from Pi Scout (`request_fresh_state(poolId)`). Blind tolerance widening without re-checking actual pool state is strictly prohibited.
  - Self-healing is strictly bounded: maximum 2 recovery iterations (3 total runs) and a hard 2.00% (200 bps) slippage ceiling.
  - If attempts are exhausted or the ceiling breached, throw `SelfHealingExhaustedError` carrying `executionId`, attempted strategies, and terminal revert trace.
- **Explicit Non-Recoverable Classification:**
  - Non-recoverable errors (`ERC20InsufficientBalance`, unauthorized contract, paused pool) must call `mark_non_recoverable()` and immediately trigger a diagnostic halt to the operator without burning retry iterations or making autonomous trade-size cuts.
- **Trajectory Integrity & Invariant Sealing (Zone 2 $\rightarrow$ Zone 3):**
  - Upon clean simulation convergence and invariant pass, Pi Verifier computes `calldataHash = sha256(calldata)` and seals the canonical `ExecutionTrajectory` with simulation proof deltas ($\Delta B_{out}$, gas used) and a 120-second (2-minute) TTL (`expiresAt`) before handing the trajectory to Commander and Guardian.
- **Zero Invisible Refinement:**
  - Every step of the healing loop must emit a typed `SelfHealingEvent` (`attempt_started`, `param_diff`, `simulation_result`, `converged`, `aborted`) rendered directly to the TUI diff callout and PreflightTracer card.
- **Deterministic Calldata Synthesis:**
  - Zone 1 LLMs do not synthesize raw hex calldata. Calibrated parameters are synthesized deterministically in Zone 2 using Viem ABI encoders.

---

## 11. Herdr Workspace & Terminal Multiplexer Standards

- **Environment Awareness:**
  - Code must inspect `process.env.HERDR_ENV === '1'` to detect when Kestrel is hosted inside a Herdr workspace.
  - When absent, all Herdr reporting must be a no-op; Kestrel runs strictly in standalone TUI mode without errors or missing dependency crashes.
- **Non-Negotiable `blocked` State on Hardware Clear-Signing:**
  - Whenever Pi Guardian enters the clear-signing confirmation loop, it MUST report `state: blocked` to Herdr (`pane.report_agent --state blocked`) so Herdr's sidebar rolls up a visual "Needs Attention" alert across tabs and workspaces.
  - Upon receiving hardware signature or user cancellation, Guardian must immediately transition state to `working` (broadcasting) or `idle` (cancelled).
- **Display Token Hygiene:**
  - Display metadata tokens (`pane.report_metadata`) must be normalized: max 80 characters, trimmed whitespace, and stripped control sequences.
  - Never emit private keys, mnemonic seeds, API secrets, or unredacted HTTP authorization headers in Herdr metadata tokens.
- **Subagent In-Process Execution:**
  - Subagents run in-process within the main Node.js process to ensure sub-10ms simulation performance and context isolation, while projecting their lifecycle states to Herdr without launching detached terminal processes.

---

## 12. Git Governance & Mechanical Suppression Standards

- **Author Identity Invariant:**
  - All Git commits must strictly use author `tyraakj <tyra191712@gmail.com>`.
- **Mechanical Pre-Commit Suppression Checks:**
  - The repository enforces `scripts/check-suppressions.sh` via pre-commit hooks. Any attempt to commit `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`, `as any`, `--no-verify`, `SKIP_TESTS`, or skipped tests is mechanically rejected unless explicitly approved with `// APPROVED-SUPPRESSION: <reason>`.
- **CODEOWNERS Access Control:**
  - Critical financial and cryptographic paths (`src/ledger/`, `src/sandbox/`, `src/x402/`) are governed by `.github/CODEOWNERS` requiring review from `@tyraakj`.

---

## 13. Smart Contract & Foundry Standards (`contracts/`)

- **Solidity Compiler & EVM Target:**
  - Target Solidity version `^0.8.24` using Shanghai/Cancun EVM semantics.
  - Optimizer enabled with 200 runs in `foundry.toml`.
- **Two-Tier Testing Convention:**
  - Tier 1: All smart contract code in `contracts/src/` must be tested natively in pure Solidity under `contracts/test/` using Foundry (`forge test`).
  - Tier 2: Agent runtime and pre-flight simulation integration must be tested in TypeScript using `vitest` against local Anvil.
- **Mandatory Property-Based Fuzzing:**
  - Any mathematical invariant or balance assertion (such as `assertMinBalance`) must have a corresponding `testFuzz_` test verifying that the assertion holds over arbitrary `uint256` token quantities without math overflow/underflow, and reverts whenever a deficit exists.
- **Explicit Custom Reverts Over Strings:**
  - Never use raw `revert("string")` or generic `require`. Always declare and emit custom errors (`InvariantBreached`, `NotAuthorized`, `CallFailed`) with typed arguments to facilitate sub-10ms decoding by the Pi Verifier.
- **Zero npm Contract Framework Bloat:**
  - Do not install Hardhat, Truffle, or ethers-based contract frameworks. Foundry (`forge`) is the single source of truth for contract compilation and artifact generation.

# Kestrel Subagent Execution Pipeline

This document details the deterministic, sequential safety pipeline connecting **Pi Commander**, **Pi Scout**, **Pi Verifier**, and **Pi Guardian** with the in-memory Anvil pre-flight sandbox and Ledger hardware key ring.

---

## 1. Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Operator / TUI
    participant Commander as Pi Commander
    participant Scout as Pi Scout
    participant Verifier as Pi Verifier
    participant Guardian as Pi Guardian
    participant Anvil as In-Memory Anvil Fork
    participant Ledger as Ledger Key Ring

    Operator->>Commander: Swap 1000 USDC for WETH
    Commander->>Commander: Generate correlationId (corr_01J...)

    rect rgb(20, 30, 45)
    note right of Scout: Phase 1: Live Market Data and x402 Micropayments
    Commander->>Scout: dispatch_scout(poolId, correlationId)
    Scout->>Scout: query_subgraph() (Studio Live and AST Pruning)
    Scout->>Scout: settle_x402() (0ms Mock or Base Gateway)
    alt Settlement Succeeded
        Scout-->>Commander: Hydrated SubgraphPoolState
    else Settlement Failed or Timeout
        Scout-->>Commander: SettlementFailed(reason)
        Commander-->>Operator: Abort: Micropayment Settlement Failed
    end
    end

    rect rgb(35, 30, 20)
    note right of Verifier: Phase 2: Pre-Flight Simulation and Specialized Recovery
    Commander->>Verifier: dispatch_verifier(calldata, poolState, correlationId)
    Verifier->>Anvil: evm_snapshot()
    Verifier->>Anvil: simulate_preflight()
    alt Simulation Succeeded First Run
        Anvil-->>Verifier: Success (Delta B at least minOut)
    else Simulation Reverted
        Anvil-->>Verifier: Revert (errorSelector, args)
        Verifier->>Anvil: evm_revert(snapshotId) (Clean-Room Rollback)
        Verifier->>Verifier: classify_revert()

        alt Case A: ERC20InsufficientAllowance (Dedicated Allowance Recovery)
            Verifier->>Verifier: synthesize_approval_batch(spender, needed)
            Verifier->>Anvil: simulate_preflight() (Retry 1 with [approve, swap] batch)
            alt Approval Batch Succeeded
                Anvil-->>Verifier: Success (Delta B at least minOut)
            else Approval Batch Failed
                Anvil-->>Verifier: Revert
                Verifier-->>Commander: ApprovalInjectionFailedError(diagnostic)
                Commander-->>Operator: Abort: Missing Token Approval Could Not Be Resolved
            end

        else Case B: PriceSlippageExceeded (Slippage Recalibration Loop, max 2 retries)
            loop Slippage Recovery (attempt <= 2)
                Verifier->>Scout: request_fresh_state(poolId) (Re-Hydrate State)
                Scout-->>Verifier: Fresh SubgraphPoolState
                Verifier->>Verifier: recalibrate_parameters() (Ceiling 200 bps)
                Verifier->>Anvil: evm_snapshot()
                Verifier->>Anvil: simulate_preflight()
                alt Retry Succeeded
                    Anvil-->>Verifier: Success (Delta B at least minOut)
                else Retry Failed
                    Anvil-->>Verifier: Revert
                    Verifier->>Anvil: evm_revert(snapshotId)
                end
            end
            alt Slippage Retries Exhausted
                Verifier-->>Commander: SelfHealingExhaustedError()
                Commander-->>Operator: Abort: Slippage Ceiling / Retry Budget Exhausted
            end

        else Case C: Non-Recoverable (e.g. ERC20InsufficientBalance, Paused)
            Verifier-->>Commander: NonRecoverableRevert(reason, diagnostic)
            Commander-->>Operator: Abort: Non-Recoverable Revert (Diagnostic logged)
        end
    end
    Verifier->>Verifier: compute calldataHash and expiresAt (now + 120s)
    Verifier-->>Commander: Verified ExecutionTrajectory and Invariant Proof
    end

    rect rgb(20, 35, 30)
    note right of Guardian: Phase 3: Spend Policy and Hardware Clear-Signing
    Commander->>Guardian: dispatch_guardian(trajectory, calldata, correlationId)
    Guardian->>Guardian: verify_calldata_hash(sha256(calldata) === trajectory.calldataHash)
    Guardian->>Guardian: Policy Leash Check (User limit verified; blocked if unset)
    Guardian->>Ledger: request_ledger_sign(clearSignSummary)
    Ledger-->>Operator: Display Clear-Sign Summary (Asset, Amount, MinOut, Dest, ChainID)
    alt Operator Approves
        Operator->>Ledger: Press Both Buttons (Confirm on Physical Device)
        Ledger-->>Guardian: Signed Bytecode (Keys Never Leave Hardware)
        Guardian->>Guardian: Freshness Gate Check (now < trajectory.expiresAt)
        alt Freshness Gate Passed
            Guardian-->>Commander: SignedTx Ready for Broadcast
        else Freshness Gate Expired
            Guardian->>Guardian: destroy_stale_signature() (Wipe from Memory)
            Guardian-->>Commander: FreshnessExpiredError (Signature Destroyed)
            Commander-->>Operator: Notice: Signing window expired (120s). Re-verifying...
            Commander->>Verifier: Re-simulate trajectory against current block
            Verifier-->>Commander: Fresh ExecutionTrajectory (Fresh expiresAt and calldataHash)
            Commander->>Guardian: dispatch_guardian(freshTrajectory) (Mandatory Re-Sign on Ledger)
        end
    else Operator Declines or Timeout
        Operator->>Ledger: Reject or Timeout (0x6985)
        Ledger-->>Guardian: SigningDeclined(reason)
        Guardian-->>Commander: SigningDeclined
        Commander-->>Operator: Abort: Signing Declined by Operator
    end
    end

    rect rgb(25, 25, 45)
    note right of Commander: Phase 4: Broadcast, Receipt Watching, and Confirmation
    Commander->>Anvil: broadcast_raw_transaction(signedTx)
    alt Broadcast Accepted by Node
        Anvil-->>Commander: Transaction Hash (Mempool Included)
        Commander->>Anvil: watch_transaction_receipt(txHash)
        alt Receipt Status: Success (Mined)
            Anvil-->>Commander: TransactionReceipt (Status: 1)
            Commander->>Operator: Transaction Confirmed (Zero-Revert Guarantee Proven)
        else Receipt Status: Reverted On-Chain (Status: 0)
            Anvil-->>Commander: TransactionReceipt (Status: 0, Reverted)
            Commander-->>Operator: Alert: On-Chain Revert Detected (Diagnostic Logged)
        end
    else Broadcast Rejected (Mempool / RPC Error)
        Anvil-->>Commander: RPC Error (Rejected)
        Commander-->>Operator: Abort: Broadcast Rejected by Node
    end
    end
```

---

## 2. Phase-by-Phase Breakdown

### Phase 1: Live Market Data and x402 Micropayments (Pi Scout)

1. **Trigger and Correlation:** Operator submits an intent (e.g. swap USDC for WETH). Commander generates a globally unique correlation ID (`corr_${string}`) passed to all subagent tasks for end-to-end auditability.
2. **Delegation:** Commander dispatches **Pi Scout** with target pool identifier and correlation ID.
3. **Subgraph Hydration:** Scout calls `query_subgraph()` targeting The Graph's Subgraph Studio. The AST schema pruner strips GraphQL introspection comments and redundant fields, reducing token payload by >90%.
4. **x402 Settlement:** Scout negotiates the HTTP 402 challenge via `settle_x402()`:
   - In simulation mode, settlement resolves in <1ms locally via the mock facilitator.
   - In live mode, it authorizes Base USDC micropayments via The Graph's official x402 gateway.
   - **Failure / Timeout Path:** If micropayment negotiation fails or the gateway times out, Scout returns `SettlementFailed(reason)`. Commander aborts execution and notifies the operator without risking subsequent pipeline operations.
5. **Output:** On success, returns clean, typed `SubgraphPoolState` (reserves, tick depth, fee tier) to Commander.

---

### Phase 2: Pre-Flight Simulation and Specialized Recovery (Pi Verifier)

1. **Delegation:** Commander builds the initial calldata bundle and dispatches **Pi Verifier** with pool state and correlation ID.
2. **Pre-Flight Sandbox:** Verifier creates a clean Anvil state snapshot (`evm_snapshot()`) and executes `simulate_preflight()` (<5ms).
3. **Specialized Revert Classification (No Conflation):** If simulation reverts, Verifier immediately issues `evm_revert(snapshotId)` for a clean-room state rollback (zero accumulated retry debris) and routes to specialized recovery:
   - **Branch A: Allowance Recovery (`ERC20InsufficientAllowance`, `SafeTransferFailed`):**
     - Verifier extracts token address, spender address, and needed allowance from the decoded revert trace.
     - Synthesizes an atomic multi-call batch containing an ERC-20 `approve(spender, needed)` prepended to the swap calldata.
     - Verifier re-simulates the multi-call batch once (`maxAllowanceRetries = 1`).
     - **Crucial Rule:** It does NOT call Scout for price re-hydration, nor does it consume the slippage retry budget.
     - If the batch succeeds, the trajectory records the multi-call payload. If it reverts (e.g. paused token), it emits `ApprovalInjectionFailedError` and aborts to the operator with actionable diagnostics.
   - **Branch B: Slippage Recalibration Loop (`PriceSlippageExceeded`, `TooLittleReceived`):**
     - Verifier calls back to Scout (`request_fresh_state(poolId)`) to retrieve current on-chain pool reserves and price ticks. This eliminates blind tolerance widening and protects against moving market fills and stale quotes.
     - Recalculates parameters (+0.50% slippage bump) bounded by a strict dual ceiling: **maximum 2 recovery iterations (3 total runs)** and a **hard 2.00% (200 bps) slippage ceiling**.
     - Each attempt takes a fresh snapshot and re-simulates. If attempts are exhausted or the ceiling is breached, Verifier emits `SelfHealingExhaustedError` and aborts to the operator.
   - **Branch C: Non-Recoverable Errors (`ERC20InsufficientBalance`, unauthorized contract, invalid caller):**
     - Verifier calls `mark_non_recoverable()`, returns `NonRecoverableRevert` with complete opcode and stack diagnostics, and aborts to the operator without burning retry attempts or making unauthorized trade-size cuts.
4. **Mathematical Net Balance Invariant Proof:** Upon clean simulation convergence, Verifier asserts the mathematical net balance invariant ($\Delta B_{out} \ge minOut$) and proves zero unauthorized balance deductions.
5. **Calldata Hash & Freshness Binding:**
   - Verifier computes `calldataHash = sha256(calldata)` and sets `expiresAt = Date.now() + 120_000` (120-second / 2-minute freshness TTL; configurable via `TRANSACTION_FRESHNESS_TTL_SECONDS`).
   - Zero software private keys exist in this process; the physical Ledger hardware remains the sole cryptographic authority.
6. **Output:** Returns verified `ExecutionTrajectory` and deterministic summary to Commander.

---

### Phase 3: Spend Policy and Hardware Clear-Signing (Pi Guardian)

1. **Delegation:** Commander dispatches **Pi Guardian** with the verified trajectory, calldata, and correlation ID.
2. **Calldata Hash Verification:**
   - Guardian independently asserts `sha256(calldata) === trajectory.calldataHash` to ensure the calldata bundle has not suffered memory corruption in transit.
3. **Autonomous Spend Leash Check:** Guardian checks the local spend ledger (`.kestrel/policy-ledger.json`). If the daily limit is unset or if `cumulativeDailySpend + txSpend > dailyLimitUsd`, execution unconditionally halts with `PolicyLeashExceededError`.
4. **Hardware Clear-Signing Prompt (The Root of Trust):**
   - Guardian calls `request_ledger_sign()` with a comprehensive, deterministic summary explicitly showing:
     - Target action (including explicit multi-step breakdown if an approval was injected: "Step 1: Approve Spender", "Step 2: Swap Asset")
     - Destination contract address (EIP-55 checksummed) and name
     - Input asset symbol and exact amount (scaled from BigInt)
     - Guaranteed minimum output asset symbol and amount
     - Destination chain ID
     - Verified net balance delta ($\Delta B$)
   - **Physical Defense:** The operator visually reviews the decoded parameters on the Ledger device's physical screen. Private keys remain strictly locked inside the secure element and never touch process memory.
5. **Operator Approval or Decline:**
   - **Operator Approves:** User reviews clear-sign details and presses both physical buttons (or spacebar in Virtual Simulator). Ledger signs the payload and returns signed bytecode.
   - **Operator Declines / Timeout:** If the operator rejects on-device (`0x6985`) or the transport times out, Ledger returns `SigningDeclined(reason)`. Guardian propagates this to Commander, which halts the pipeline cleanly and resets state without error cascades.
6. **Freshness Gate Check & Full Loop Re-Signing Lifecycle:**
   - Because hardware clear-signing introduces human-speed latency, Guardian checks `Date.now() < trajectory.expiresAt` immediately upon receiving the signature:
   - **Fresh (`now < expiresAt`):** Hand signed transaction to Commander for broadcast.
   - **Expired (`now >= expiresAt`):**
     1. Guardian **immediately destroys the signed bytecode from memory** (`destroy_stale_signature()`), ensuring stale signatures can never be broadcast or reused.
     2. Guardian returns `FreshnessExpiredError` with `executionId`.
     3. Commander informs operator: _"Signing delay exceeded 120-second freshness window. Re-verifying pool liquidity against current block..."_
     4. Commander dispatches Verifier for fresh simulation and invariant proof against current block state.
     5. Verifier issues a **new `ExecutionTrajectory`** with a fresh `expiresAt` and fresh `calldataHash`.
     6. **Commander MUST dispatch Pi Guardian for a full Phase 3 clear-signing loop from scratch**—prompting the operator on the Ledger device with fresh parameters and requiring explicit dual-button confirmation. Stale signatures are never reused.

---

### Phase 4: Broadcast, Receipt Watching, and Confirmation

1. **Mempool Submission:** Commander broadcasts the raw signed transaction bytecode to the RPC node.
2. **Submission Gate:**
   - **Rejected by Node:** If mempool admission fails (RPC error, nonce collision, gas underpriced), Commander logs diagnostic details and returns `BroadcastRejected(reason)` to the operator.
   - **Accepted by Node:** Receives transaction hash and transitions to receipt watching.
3. **On-Chain Receipt Verification:** Commander monitors `watch_transaction_receipt(txHash)`:
   - **Mined and Confirmed (Status 1):** The transaction succeeded on-chain, mathematically verifying the Zero-Revert Guarantee. Commander displays the confirmation badge and transaction hash.
   - **Reverted On-Chain (Status 0):** In the rare event of a block re-organization or hostile sandwich attack between simulation and inclusion, Commander catches status 0, logs the on-chain revert reason, and surfaces an emergency diagnostic to the operator.
4. **State Reset:** Local in-memory fork snapshot and transient session cache reset in <10ms, returning Kestrel to `idle` for the next intent.

---

## 3. UI Projection: The Master Hybrid View

The in-process subagent pipeline drives both **Kestrel's 4 Telemetry Cards** and **Herdr's Agent Sidebar** simultaneously:

| Subagent Phase          | What Updates in Kestrel TUI (Right Pane)                                                                                                                                                                                                                                                                                                       | What Updates in Herdr Sidebar                                                                                                                                  |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pi Scout**            | **Card 1 (The Graph):** Pool reserves hydrated (-95% pruned)<br>**Card 2 (Base USDC x402):** Challenge settled (0ms mock / Base USDC gateway). On failure: Card 2 flashes Red (`SettlementFailed`)                                                                                                                                             | `scout` row marks `working` $\rightarrow$ `done` with `$summary="Hydrated Subgraph"`. On failure: marks `failed`                                               |
| **Pi Verifier**         | **Card 3 (EVM Pre-Flight Sandbox):**<br>• On `ERC20InsufficientAllowance`: Synthesizes approval batch callout `[approve + swap]`<br>• On `PriceSlippageExceeded`: Flashes Amber, shows re-hydration from Scout, auto-tunes slippage (+0.50%)<br>• On Invariant Passed: Flashes Emerald ($\Delta B_{out} \ge minOut$) with verified delta proof | `verifier` row marks `working` (re-hydrating / self-healing) $\rightarrow$ `done`. On exhausted/fatal revert: marks `failed`                                   |
| **Pi Guardian**         | **Card 4 (Ledger Key Ring):** Renders ASCII OLED clear-signing screen (multi-call steps, asset, amount, minOut, destination, chain ID); prompts `[PRESS BOTH BUTTONS TO CLEAR-SIGN]`. On decline: flashes Amber `SigningDeclined`                                                                                                              | **`guardian` row turns Amber/Red (`BLOCKED`)**, visually alerting that hardware confirmation is required. Clears to `working` on approval or `idle` on decline |
| **Freshness Gate**      | If signing exceeds 120s, Card 3 and Card 4 flash Amber (`FreshnessExpired`), wiping stale signature and restarting full simulation + Ledger clear-signing loop                                                                                                                                                                                 | `verifier` and `guardian` repeat `working` $\rightarrow$ `BLOCKED` cycle                                                                                       |
| **Broadcast & Confirm** | Card 4 flashes Confirmed with tx hash; on receipt mined (Status 1), displays verified badge; all cards reset to idle in <10ms                                                                                                                                                                                                                  | Herdr rolls up to **`DONE`** across the workspace                                                                                                              |

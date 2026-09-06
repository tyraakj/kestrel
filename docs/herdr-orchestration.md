# Herdr Workspace & Master Hybrid Architecture Guide

This operational guide details how **Kestrel** integrates with **Herdr** (`herdr.dev`), an agent-aware terminal multiplexer and workspace manager, to deliver the **"Best of Both Worlds"**: an institutional, unified split-screen terminal interface alongside live multi-agent fleet tracking in Herdr's sidebar.

---

## 1. The "Best of Both Worlds" Master Layout

Rather than forcing a choice between a cohesive Bloomberg-style terminal and multi-agent visibility, Kestrel runs the complete **Master Hybrid Layout**:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  HERDR SIDEBAR        PANE 1: KESTREL UNIFIED TUI (Full Master Dashboard)              │
├────────────────────┬───────────────────────────────────┬───────────────────────────────┤
│ ▼ KESTREL-QUANT    │ LEFT: Pi Console & Stream (60%)   │ RIGHT: All 4 Sponsor Cards    │
│                    │                                   │                               │
│  ● commander       │ kestrel ❯ Swap 1000 USDC -> WETH  │ ◆ [CARD 1: THE GRAPH STUDIO]  │
│    working         │                                   │ Pool: 0x88e6... (-95% Pruned) │
│                    │ ✦ Reasoning:                      │                               │
│  ● scout           │ Hydrating Subgraph Studio...      │ ⚡ [CARD 2: BASE USDC x402]   │
│    done            │ Pre-flight simulation caught      │ Fee: 0.004 USDC | Leash Gauge │
│                    │ PriceSlippageExceeded.            │                               │
│  ● verifier        │ Recalibrating slippage (+0.50%)...│ ▲ [CARD 3: EVM PRE-FLIGHT]    │
│    done            │ Invariant mathematically proven!  │ Fork #21049281 | ΔETH >= +0.31│
│                    │                                   │                               │
│  ■ guardian        │ Prompting Ledger clear-signing... │ 🛡️ [CARD 4: LEDGER KEY RING]   │
│    BLOCKED         │                                   │ ┌───────────────────────────┐ │
│    Needs Sign! ◄──┐│ [Space] Confirm  [Ctrl+R] Reset   │ │ [PRESS BUTTONS TO SIGN]   │ │
│                   ││ [Tab] Switch     [q] Quit         │ └───────────────────────────┘ │
└───────────────────┼┴───────────────────────────────────┴───────────────────────────────┘
                    │
                    └─► Herdr's Sidebar automatically alerts:
                        "Guardian is BLOCKED awaiting physical Ledger sign-off!"
```

### Key Capabilities of the Hybrid Layout:

1. **Full 4-Card Sponsor Presentation:** The right pane keeps Card 1 (The Graph Studio), Card 2 (Base USDC x402), Card 3 (EVM Pre-Flight Sandbox), and Card 4 (Ledger Key Ring) constantly visible and updating in real time.
2. **True Multi-Agent Fleet Transparency:** Herdr's sidebar tracks `commander`, `scout`, `verifier`, and `guardian` independently, proving that tasks are delegated across role-scoped subagents.
3. **Hardware Safety Hero Moment (`BLOCKED` Alert):** When Card 4 prompts for Ledger button confirmation, Herdr's sidebar turns **Amber/Red (`BLOCKED: Needs Attention`)**, visually demonstrating that autonomous execution is halted pending physical human sign-off.
4. **Diagnostic Drill-Down (Tab 2):** Operators can flip to Tab 2 (`Ctrl+B n`) at any moment to inspect raw NDJSON run-logs (`.kestrel/runs/<executionId>.ndjson`) or Anvil opcode traces.

---

## 2. First-Class Pi Integration

Herdr includes native out-of-the-box support for Pi. Install the official integration:

```bash
herdr integration install pi
herdr integration status
```

### State Authority & Session Identity

- **Lifecycle Authority:** Herdr recognizes Pi's lifecycle hooks as the authoritative source for `state` (`working`, `blocked`, `idle`, `done`) and `sessionStatus`. Herdr skips screen manifest heuristics when Pi's lifecycle reporting is active.
- **Native Session Restore:** If the Herdr server restarts or is updated, Herdr automatically resumes Pi agent panes using Pi's native session command:
  ```bash
  pi --session <path-or-id>
  ```

---

## 3. Environment Detection & Semantic State Reporting

When running inside a Herdr-managed pane, Herdr injects standard environment variables:

- `HERDR_ENV=1`: Confirms the process is running inside Herdr.
- `HERDR_PANE_ID`: The unique identifier of the hosting pane (e.g. `w1:p1`).
- `HERDR_SOCKET_PATH`: Local Unix domain socket or Windows named pipe for the Herdr API.

### State Mapping & Hardware Clear-Signing Alerts

Kestrel maps its deterministic pipeline to Herdr semantic states:

| Pipeline Phase                    | Semantic State  | Trigger in Kestrel                                                  | Herdr Visual Behavior                           |
| :-------------------------------- | :-------------- | :------------------------------------------------------------------ | :---------------------------------------------- |
| **Idle**                          | `idle` / `done` | Process started, prompt `kestrel ❯` waiting                         | Dimmed/normal row in Herdr sidebar              |
| **Market Hydration & Pre-Flight** | `working`       | Subgraph hydration, x402 settlement, Anvil simulation, self-healing | Active pulsing spinner; workspace marked active |
| **Ledger Clear-Signing**          | `blocked`       | Verification passed; waiting for hardware dual-button confirmation  | **Sidebar turns amber/red ("Needs Attention")** |
| **Broadcast Confirmed**           | `done`          | Zero-revert transaction confirmed on chain                          | Displays completed indicator until reviewed     |

### The Critical Role of the `blocked` State

In Herdr, a `blocked` state indicates that an agent is paused awaiting human approval. When **Pi Guardian** prompts:

```text
[PRESS BOTH BUTTONS TO CLEAR-SIGN]
```

Kestrel immediately reports its state as `blocked`:

```bash
herdr pane report-agent "$HERDR_PANE_ID" \
  --source kestrel:guardian \
  --agent guardian \
  --state blocked \
  --message "Awaiting physical Ledger confirmation"
```

**Impact:** Herdr's sidebar automatically rolls this status up to the tab and workspace level. An operator managing multiple desks immediately sees that Kestrel requires a physical hardware signature.

Once the operator confirms on the Ledger device, Guardian reports:

```bash
herdr pane report-agent "$HERDR_PANE_ID" \
  --source kestrel:guardian \
  --agent guardian \
  --state working \
  --message "Broadcasting signed transaction"
```

---

## 4. Real-Time Telemetry Metadata Tokens

In addition to semantic states, Kestrel reports display-only metadata tokens via `pane.report_metadata`. These populate custom fields in Herdr's Agent sidebar rows without disrupting state rollups:

```bash
herdr pane report-metadata "$HERDR_PANE_ID" \
  --source kestrel:telemetry \
  --title "Uniswap v3 1000 USDC -> WETH" \
  --token summary="Pre-flight Passed (+0.310 ETH)" \
  --token leash="$0.042 / $USER_LEASH" \
  --ttl-ms 60000
```

- **`$summary`**: Displays verified net balance deltas (`+0.310 ETH`) or self-healing adjustments (`Slippage: 0.50%`).
- **`$leash`**: Displays current daily spend versus the user-configured budget ceiling.

---

## 5. Live Demo Execution (`pnpm demo`)

For hackathon submissions, live judging, and video recording, running the demo gives judges the complete picture:

```bash
pnpm demo
```

### Demo Script Progression (What Judges See):

1. **Workspace Launch:** Herdr mounts Kestrel in the master pane with its 60/40 Split-Screen TUI; the sidebar registers the 4 subagents (`commander`, `scout`, `verifier`, `guardian`).
2. **Act 1 (Scout Hydration):** Card 1 renders The Graph Studio pool reserves with -95% AST schema pruning; Card 2 displays x402 settlement. Herdr sidebar marks `scout: done`.
3. **Act 2 & 3 (Sandbox Simulation & Self-Healing):** Card 3 catches `PriceSlippageExceeded`, auto-tunes slippage to 0.50%, rolls back state in-memory (`evm_revert`), and turns emerald green as the net balance invariant ($\Delta B_{out} \ge +0.310\text{ ETH}$) is proven. Herdr sidebar marks `verifier: done`.
4. **Act 4 (Hardware Gate Hero Moment):** Card 4 renders the ASCII OLED clear-signing screen. **Herdr's sidebar instantly turns Amber/Red (`BLOCKED: Needs Attention`)** on the `guardian` row!
5. **Confirmation:** The presenter presses the spacebar. Guardian signs, Card 4 flashes Confirmed, the transaction is broadcast with the Zero-Revert Guarantee, and Herdr's sidebar turns **`DONE`**.

---

## 6. Remote Attach & Persistence

For automated quantitative desks running in the cloud or remote servers:

1. **Launch on Remote Host:**
   ```bash
   ssh quant-server "herdr --session live-trading"
   ```
2. **Attach Thin-Client from Local Terminal:**
   ```bash
   herdr --remote ssh://user@quant-server:2222 --session live-trading
   ```
3. **Detach Safely:**
   Press `Ctrl+b q` to detach. Kestrel's pre-flight simulation, Anvil forks, and telemetry monitors continue running uninhibited on the server. Reattaching instantly streams live ANSI frames and restores the full dashboard.

---

## 7. Safety Invariant: Hardware Boundary Preservation

Even when orchestrated inside Herdr:

- **Private keys NEVER leave Zone 3 (`src/ledger/`).**
- **Autonomous spend leash is strictly enforced.** If the user has not configured `DAILY_SPEND_LIMIT_USD` or `--daily-leash`, transactions are unconditionally blocked.
- **No unsimulated bytecode is ever sent to the Ledger transport.**

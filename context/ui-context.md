# UI Context: Kestrel

> **Terminal Design, Component Conventions, Typography, and ANSI Palette**

---

## 1. Design Philosophy: Sovereign, Technical & Real-Time

Kestrel's interface is a **Local Sovereign Terminal UI (TUI)** built to project institutional-grade security, mathematical rigor, and real-time observability. It intentionally rejects web browser wrappers to eliminate phishing skepticism, proving to judges that keys are locked in local hardware.

---

## 2. Layout Structure (60 / 40 Split)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  HEADER: App Title, Chain Fork Indicator, The Graph Live Pill, x402 Pill, Ledger USB Status     │
├────────────────────────────────────────────────────┬─────────────────────────────────────────────┤
│  LEFT PANE (60% Width): Pi Agent Console           │  RIGHT PANE (40% Width): Live Telemetry     │
│  • Prompt Input (`kestrel ❯`)                      │  • Card 1: 🌐 The Graph Subgraph Inspector  │
│  • Inner Reasoning Stream (dimmed italic)          │  • Card 2: ⚡ Base USDC x402 Gauge       │
│  • Typed Tool Call Badges (cyan/amber boxes)       │  • Card 3: 🔬 EVM Pre-Flight Revert Tracer  │
│  • Self-Healing Calldata Diff                      │  • Card 4: 🛡️ Ledger Hardware Clear-Sign     │
├────────────────────────────────────────────────────┴─────────────────────────────────────────────┤
│  FOOTER: Keybindings (`[Tab]`, `[Ctrl+R]` 10ms Reset, `[Ctrl+C]`, `[Space]` Approve, `[q]` Quit) │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Specifications

### Header Status Bar

- **Chain Status:** `● ETH Fork #21049281` (Green pulsing dot indicates local automine ready).
- **The Graph Status:** `● Studio Live` (Cyan dot indicates active Subgraph Studio connection).
- **x402 Status:** `● x402 Armed` (Gold dot indicates local 0ms facilitator active).
- **Hardware Status:** `🛡️ Ledger USB [Connected]` (Blue shield indicates hardware transport or Virtual Simulator ready).

### Left Pane: Pi Agent Console

- **Prompt Box:** User intent input with blinking cursor.
- **Reasoning Stream:** Formatted model thoughts displayed with `✦ Reasoning: ...` in dimmed text.
- **Tool Dispatch Badges:** Bordered boxes displaying tool name, input arguments, and execution latency.
- **Self-Healing Box:** Highlighted amber box detailing caught reverts and auto-recalibrated parameters.

### Right Pane: Telemetry Cards

- **Card 1 (The Graph):** Displays active Subgraph target, pool reserves, 24h volume, query latency (3ms), and schema pruning ratio (-95%).
- **Card 2 (Base USDC x402):** Displays HTTP 402 challenge status, 0ms local settlement confirmation, per-query fee, and daily budget spend bar `[▓▓░░░░░░░░] $0.004 / $USER_LEASH` (strictly user-configured; blocked if unset).
- **Card 3 (EVM Pre-Flight):** Opcode call-tree, revert error selector, self-healing status, and net balance delta assertion (`+0.310 ETH`).
- **Card 4 (Ledger Key Ring):** Autonomous policy leash verification, deterministic transaction summary, and interactive `[PRESS BOTH BUTTONS TO CLEAR-SIGN]` prompt.

---

## 4. ANSI Color System & Typography

| Element                 | Color Hex / ANSI                    | Role & Meaning                                    |
| :---------------------- | :---------------------------------- | :------------------------------------------------ |
| **The Graph**           | `#00F0FF` / Cyan                    | Semantic data queries, live liquidity feeds.      |
| **Base USDC / x402**    | `#FFD700` / Gold                    | Micropayments, fee settlements, budget gauges.    |
| **Revert Detected**     | `#EF4444` / Red & `#F59E0B` / Amber | Caught EVM errors, self-healing in progress.      |
| **Invariant Passed**    | `#10B981` / Emerald Green           | Pre-flight 100% success, verified balance deltas. |
| **Ledger Boundary**     | `#3B82F6` / Royal Blue              | Hardware security, device prompts, key isolation. |
| **Background / Panels** | `#0F172A` / `#1E293B`               | Dark slate, rounded Unicode borders (`┌─┐│└─┘`).  |

- **Typography:** Monospace only (`Fira Code`, `JetBrains Mono`, or native terminal font). All tables and cards align via strict character widths.

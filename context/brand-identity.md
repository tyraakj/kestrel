# Brand Identity: Kestrel

> **Kestrel // Visual Language, ANSI Aesthetic, and Cryptographic Voice**

---

## 1. Core Ethos: The Sovereign Falcon

The **Kestrel** (Falco tinnunculus) is renowned for its uncanny ability to hover motionless in turbulent air while locking onto high-value targets, diving with pinpoint mathematical accuracy.

In the chaotic turbulence of DeFi—where MEV bots front-run, slippage spikes, and transactions revert—**Kestrel** is the sovereign agent that hovers above the mempool, simulates every millisecond of execution in a local pre-flight sandbox, verifies balance invariants, and strikes only when 100% success is mathematically guaranteed.

Kestrel rejects flimsy web dApp wrappers, disposable browser extensions, and cloud-hosted agent black boxes. It lives directly on the user's local machine inside a high-speed, data-dense Terminal User Interface (TUI), anchored by physical hardware security (Ledger).

---

## 2. Visual Theme: Matte Obsidian & Tactical ANSI

Kestrel operates on a strict **Sovereign Dark / Tactical Terminal** palette. Backgrounds are matte obsidian, borders are clean single/double-line box drawing characters, and telemetry pulses with vivid ANSI status indicators.

### Primary Palette Tokens

| Token             | Hex       | ANSI Code                | Semantic Role                                |
| :---------------- | :-------- | :----------------------- | :------------------------------------------- |
| **Obsidian Base** | `#0B0E14` | `\x1b[48;2;11;14;20m`    | Deep terminal background                     |
| **Panel Surface** | `#141923` | `\x1b[48;2;20;25;35m`    | Telemetry card & console container surface   |
| **Muted Border**  | `#263042` | `\x1b[38;2;38;48;66m`    | Subtle box-drawing grid dividers             |
| **Text Primary**  | `#F8FAFC` | `\x1b[38;2;248;250;252m` | Main readouts, commands, calldata            |
| **Text Muted**    | `#64748B` | `\x1b[38;2;100;116;139m` | Timestamps, secondary labels, reasoning logs |

---

## 3. Sponsor & Subsystem Color Accents

Each sponsor subsystem and functional state owns an immutable accent color across the TUI:

### 1. The Graph (Semantic Cyan)

- **Color:** `#00F0FF` / ANSI Cyan (`\x1b[36m` / `\x1b[38;2;0;240;255m`)
- **Role:** Subgraph Studio queries, GraphQL schema hydration, pool liquidity metrics, 95% token pruning badges.
- **Symbol:** `◆ [The Graph]`

### 2. Base USDC / x402 (Sovereign Gold)

- **Color:** `#FBBF24` / ANSI Gold (`\x1b[33m` / `\x1b[38;2;251;191;36m`)
- **Role:** x402 HTTP 402 challenge negotiation, machine-to-machine micropayments on Base USDC, strictly user-configured spend budget leashes.
- **Symbol:** `⚡ [Base USDC x402]`

### 3. EVM Pre-Flight Simulation (Amber Alert & Revert Crimson)

- **Revert Alert:** `#EF4444` / ANSI Crimson (`\x1b[31m` / `\x1b[38;2;239;68;68m`)
- **Self-Healing:** `#F59E0B` / ANSI Amber (`\x1b[38;2;245;158;11m`)
- **Role:** Custom Solidity revert decoding (`PriceSlippageExceeded`), in-memory opcode tracing, automated parameter recalibration.
- **Symbol:** `⚙ [EVM Sandbox]`

### 4. Zero-Revert Invariant (Emerald Guarantee)

- **Color:** `#10B981` / ANSI Emerald (`\x1b[32m` / `\x1b[38;2;16;185;129m`)
- **Role:** 100% pre-flight simulation pass, proven net balance deltas (`+0.310 ETH`), zero-revert green light.
- **Symbol:** `✓ [Zero-Revert]`

### 5. Ledger Key Ring (Hardware Cobalt)

- **Color:** `#3B82F6` / ANSI Cobalt (`\x1b[34m` / `\x1b[38;2;59;130;246m`)
- **Role:** Physical USB-HID transport, Virtual Ledger Simulator screen, clear-signing deterministic prompt.
- **Symbol:** `🛡 [Ledger Key Ring]`

---

## 4. Typography & ASCII Art Standards

### Primary Font Stack

- **Coding & TUI:** JetBrains Mono, Geist Mono, Fira Code, or standard system monospace.
- **Numeral Formatting:** Tabular numerals with fixed widths (e.g. `0.310420 ETH`, `$1,420.50`) to prevent jitter in live telemetry updates.

### Official ASCII Banner

Used in header and launch sequence:

```text
  ██╗  ██╗███████╗███████╗████████╗██████╗ ███████╗██╗
  ██║ ██╔╝██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║
  █████═╝ █████╗  ███████╗   ██║   ██████╔╝█████╗  ██║
  ██╔═██╗ ██╔══╝  ╚════██║   ██║   ██╔══██╗██╔══╝  ██║
  ██║ ╚██╗███████╗███████║   ██║   ██║  ██║███████╗███████╗
  ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝
  >> SOVEREIGN AUTONOMOUS DEFI AGENT & PRE-FLIGHT RUNTIME <<
```

---

## 5. Voice & Tone

- **Institutional & Cryptographic:** No hand-waving "AI magic". Output exact transaction hashes, revert selectors (`0x1b37d4a2`), opcode steps, and satoshi/wei-level balance deltas.
- **Defensive by Default:** Treat all external agent inputs and unverified calldata as hostile until proven invariant-safe in the sandbox.
- **Uncompromising Speed:** Telemetry highlights sub-10ms latencies (`5ms simulation`, `0ms local x402`, `10ms reset`).

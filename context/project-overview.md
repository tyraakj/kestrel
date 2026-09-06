# Project Overview: Kestrel

> **Kestrel // Sovereign Autonomous DeFi Agent & Pre-Flight Simulation Runtime**  
> Built on Pi, The Graph, Base USDC (x402), and the Ledger Agent Stack (`wallet-cli ring`).

---

## 1. Executive Summary

**Kestrel** is an autonomous on-chain DeFi agent and local pre-flight simulation runtime built on **Pi** (`@earendil-works/pi-coding-agent`) and the **Ledger Agent Stack** (`@ledgerhq/wallet-cli ring`). It is engineered to solve the multi-billion-dollar problem of on-chain transaction reverts and the slow, capital-draining cycle of testnet debugging.

Running inside a native split-screen terminal interface (TUI), Kestrel streams live market intelligence from **The Graph's 15,000+ Subgraphs**, autonomously settles machine-to-machine data queries per-request via **The Graph x402 micropayments (Base USDC)** with zero human subscriptions, and executes multi-step DeFi actions with a mathematical **Zero-Revert Guarantee** powered by its embedded 10ms local pre-flight sandbox and on-chain **`KestrelSmartAccount.sol` (ERC-4337)**. Private keys and sensitive API secrets remain physically isolated behind a **Ledger Key Ring** hardware boundary (`wallet-cli ring` broker pattern), supporting both USB devices and hosts with no USB port (VPS, CI, dev), requiring clear-signing approval before any transaction is broadcast to mainnet.

---

## 2. Problem Statement

Building and deploying autonomous Web3 AI agents today is broken:

1. **The $1.2B Revert Tax:** Over 8% of all DeFi transactions (and >25% of agent transactions) revert on-chain due to dynamic slippage, stale oracle ticks, gas underestimation, or missing token allowances. Millions of dollars in gas are burned for zero outcome.
2. **The Testnet Desert:** Testnets (Sepolia) have 12-15 second block times, zero liquidity depth, no active production Subgraphs, no live x402 payment gateways, and permanently dirty state with zero rollback capabilities.
3. **The Blind-Signing Security Risk:** Giving autonomous agents raw private keys in `.env` files risks total wallet drainage via prompt injection or logic bugs.

---

## 3. The Solution & Unique Selling Proposition (USP)

### Core USP: The Zero-Revert Agent

Kestrel introduces an **Embedded Pre-Flight Simulation Sandbox & Execution Architecture** that sits between the untrusted agent LLM and the blockchain:

- Simulates multi-call transactions in **5 milliseconds** using live state hydrated from The Graph.
- Catches custom Solidity reverts (e.g. `PriceSlippageExceeded`, `KestrelInvariantBreached`) and **autonomously self-heals transaction parameters** (recalibrating slippage, injecting `approve()` calls) in memory.
- Proves mathematical net balance invariants (e.g., `USDC -1,000, WETH >= +0.310, Allowance == 0`) locally before prompting for hardware signature.
- Delivers an **instant 10-millisecond state reset (`sandbox.reset()`)** allowing the agent to fail fast and retry with zero gas and zero testnet lag.
- Enforces on-chain invariant assertions and zero lingering allowances through **`KestrelSmartAccount.sol` (ERC-4337)**.

### The Specialized Subagent Fleet (In-Process Delegation)

Kestrel executes across four specialized, context-isolated subagents coordinated by an in-process orchestrator:

1. **Pi Commander:** Handles operator interaction, intent parsing, session status authority, and end-to-end task delegation.
2. **Pi Scout:** Fetches live liquidity and pool reserves from The Graph Studio via AST schema pruning and settles machine-to-machine x402 micropayments on Base USDC.
3. **Pi Verifier:** Controls the in-memory Anvil fork, executes 0ms pre-flight simulation, decodes custom Solidity errors, self-heals transaction parameters, and verifies mathematical net balance invariants.
4. **Pi Guardian:** Enforces the zero-default daily spend leash, generates human-readable clear-signing summaries, drives the Ledger USB-HID / Virtual Simulator boundary, and reports `state: blocked` during hardware confirmation.

---

## 4. Sponsor Track Alignment ($15,000 Target)

| Sponsor & Track                                                 | Bounty | Exact Load-Bearing Role in Kestrel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :-------------------------------------------------------------- | :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The Graph** (Best AI Tooling or AI Use Case - From Scratch)   | $5,000 | **Autonomous Pre-Flight Trading Agent & x402 Tooling:** Uses live Subgraph Studio data as the load-bearing source for EVM simulation and balance invariant proofs. Features autonomous Base USDC x402 pay-per-query micropayment settlement, -95% token AST schema pruning, and open-source agent SKILL manifests (`skills/kestrel-scout/SKILL.md` and `openclaw/subgraph-kestrel-scout/SKILL.md`).                                                                                                                                                |
| **The Graph** (Best Use of Composable or Standardized Products) | $5,000 | **Messari Standardized Subgraph (`DexAmm`) & Composable Subgraphs Integration:** Queries standardized DEX subgraphs across multiple protocols (Uniswap, Curve, Balancer) and Composable Subgraphs (`specVersion >= 1.3.0`) using a single schema pattern, layered with x402 pay-per-query micropayments.                                                                                                                                                                                                                                           |
| **Ledger** (AI Agents x Ledger Track)                           | $5,000 | **Hardware Security & Key Ring Stack:** Integrates the official Ledger Agent Stack (`@ledgerhq/wallet-cli ring`) and DMK skills (`ledgerhq/agent-skills`). Implements the capability broker pattern (agents hold secrets they cannot leak), supports hosts with no USB port (VPS/CI enrollment + virtual ASCII OLED terminal emulator), enforces a strictly user-configured daily spend leash, executes via `KestrelSmartAccount.sol` (ERC-4337 single-signature atomic multicall + zero lingering allowance), and drives on-device clear-signing. |

---

## 5. Product Scope & Delivery

- **Primary Interface:** Native split-screen Terminal UI (TUI) powered by Pi (Left: Pi reasoning & typed tool calls; Right: Real-time telemetry cards for The Graph, Base x402, EVM sandbox, and Ledger), designed for the **Master Hybrid Layout** inside **Herdr** (`herdr.dev`) with subagent fleet tracking and sidebar status rollups.
- **CLI Modes:** Interactive TUI (`pnpm demo` / `pnpm demo:standalone`), Headless RPC (`--mode rpc`), and Print diagnostic (`--mode print`).
- **Delivery Artifacts:**
  1. Open-source public GitHub repository with comprehensive README, root `SYSTEM.md`, subagent skill manifests (`skills/kestrel-*/SKILL.md`), `docs/herdr-orchestration.md`, `docs/subagent-pipeline.md`, and `docs/ledger-dx-feedback.md` (addressing the mandatory judging criterion for Ledger DX feedback).
  2. 2-to-3 minute high-production demo video showcasing the live failure, self-healing, x402 settlement, and Ledger signoff in the Master Hybrid Layout (`pnpm demo`).

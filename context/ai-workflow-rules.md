# AI Workflow Rules: Kestrel

> **Development Workflow, Gated Spec Execution, Scoping Rules, and Delivery Standards**

---

## 1. Approach: Spec-Driven Development

Kestrel is engineered strictly through **Spec-Driven Development (SDD)**. Every feature, contract, and subsystem begins with a formal numbered specification in `context/specs/`. Code is written to fulfill the spec, not by speculative guessing.

### Reading Order Before Any Architecture or Code Change

Read the following context and operational documentation files in order:

1. `context/project-overview.md` — Product definition, problem, USP, sponsor alignment, and scope.
2. `context/architecture-context.md` — System structure, boundaries, invariants, and sequence flows.
3. `context/brand-identity.md` — Visual voice, ANSI aesthetic, color tokens, and ASCII standards.
4. `context/ui-context.md` — Terminal UI layout, telemetry cards, and typography.
5. `context/code-standards.md` — Implementation rules, strict TypeScript, viem rules, and banned shortcuts.
6. `context/ai-workflow-rules.md` — This file (scoping rules, phase gates, and delivery approach).
7. `context/progress-tracker.md` — Master status tracker, active unit, completed work, and open questions.
8. `docs/herdr-orchestration.md` — Master Hybrid Layout, Pi lifecycle authority, and terminal orchestration.
9. `docs/subagent-pipeline.md` — In-process subagent sequence flows and UI telemetry card projection.

---

## 2. Gated Implementation Cycle

Development advances through four sequential, gated phases:

```
[SPECIFY] ──> [PLAN & BREAKDOWN] ──> [IMPLEMENT INCREMENTALLY] ──> [VERIFY & TRACK]
    │                 │                           │                        │
  Review            Review                      Review                   Review
  Spec &            Task Graph &                One Unit at              Real Output &
  Contracts         Dependencies                a Time                   Update Tracker
```

1. **Phase 1: Specify**
   - Ensure the relevant spec unit in `context/specs/` is complete, defining objective, interfaces, commands, scope limits, and acceptance criteria.
2. **Phase 2: Plan & Breakdown**
   - Identify dependencies and slice tasks vertically before writing code.
3. **Phase 3: Implement Incrementally**
   - Implement only the files defined in the active unit.
   - Never implement two unrelated units in a single step.
4. **Phase 4: Verify & Track**
   - Execute real tests, inspect real compiler/runtime outputs, and update `context/progress-tracker.md`.

---

## 3. Scoping Rules & Discipline

- **One Unit at a Time:** Focus exclusively on the active spec unit. Do not jump ahead or implement speculative scaffolding for future units.
- **Vertical Slicing:** Build a complete vertical slice of functionality (schema → engine → tool → test) rather than wide horizontal layers.
- **When to Split Work:**
  - If a change touches both the Pi agent shell and the EVM Anvil sandbox engine, split it.
  - If a change touches both the The Graph GraphQL client and the Ledger USB transport, split it.
  - If a task cannot be verified with a concrete command or test in <3 minutes, it is too large—split it into sub-tasks.
- **Scope Discipline:** Only touch files required for the task. If unrelated improvements are spotted, log them in `progress-tracker.md` instead of making silent edits.
- **Git & Author Governance:**
  - All commits must strictly use author `tyraakj <tyra191712@gmail.com>`.
  - Sequential atomic commits with descriptive titles matching the feature slice.
  - Never bypass git commit hooks with `--no-verify`.

---

## 4. Handling Missing or Ambiguous Requirements

- **Never Guess Core Invariants:** If a transaction parameter, sponsor API contract, or error recovery behavior is ambiguous, do NOT silently invent behavior.
- **Document and Surface:** Add the issue to the **Open Questions** table in `context/progress-tracker.md` and present explicit options for review.

---

## 5. Definition of Done (DoD)

A spec unit or task is marked **Complete** only when:

- [ ] Code strictly follows `code-standards.md` with zero TypeScript errors or suppressions.
- [ ] No hardcoded outputs or fake returns were introduced.
- [ ] All unit and integration tests for the unit pass with real execution output.
- [ ] Mechanical pre-commit suppression gate passes (`scripts/check-suppressions.sh`).
- [ ] Git commit author is strictly verified as `tyraakj <tyra191712@gmail.com>`.
- [ ] `context/progress-tracker.md` has been updated to reflect the new state.

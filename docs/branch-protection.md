# Branch Protection & Merge Criteria: Kestrel

> **Governance, Protected Branches, CI Gating, and CODEOWNERS Enforcement**

---

## 1. Protected Branches

The repository enforces branch protection across two permanent branches:

1. **`dev` (Active Integration Branch):**
   - Receives all feature branches (`feat/*`) and bugfixes (`fix/*`).
   - Gated by mandatory CI verification and PR review before merge.
2. **`main` (Production Release Branch):**
   - Receives releases promoted from `dev` via release Pull Requests.
   - All direct commits to both `main` and `dev` are restricted.

---

## 2. Mandatory CI Quality Gates

Every Pull Request targeting `main` or `dev` must pass all sequential checks in `.github/workflows/ci.yml`:

| Status Check            | Command                              | Enforcement Standard                                                                                               |
| :---------------------- | :----------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **`typecheck`**         | `pnpm typecheck`                     | Strict mode TypeScript compilation (`tsc --noEmit`) with **0 errors**.                                             |
| **`lint`**              | `pnpm lint --max-warnings 0`         | ESLint static analysis with **zero warnings** policy.                                                              |
| **`format:check`**      | `pnpm format:check`                  | Prettier code formatting check across all repository files.                                                        |
| **`suppression-check`** | `bash scripts/check-suppressions.sh` | Mechanically rejects unapproved `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `as any`, `.skip`, or `.only`. |
| **`secret-scan`**       | `bash scripts/scan-secrets.sh`       | Blocks commits containing raw private keys, mnemonic seeds, or API tokens.                                         |
| **`test`**              | `pnpm test`                          | All unit & integration test suites must pass (`vitest run`).                                                       |
| **`evals`**             | `pnpm test:evals`                    | Golden-set zero-revert simulation scenarios must succeed with 0 reverts.                                           |
| **`scan-secrets`**      | Gitleaks (CI)                        | Full-repository Gitleaks scan blocks PRs containing private keys or credentials.                                   |
| **`security-audit`**    | `pnpm audit` (CI)                    | Dependency vulnerability audit for high and critical CVEs.                                                         |

---

## 3. CODEOWNERS Review Approval

In accordance with `.github/CODEOWNERS`:

- **Default Owner:** All repository paths (`*`) fall under `@tyraakj`.
- **Sensitive Subsystem Boundaries:** Any modifications to:
  - `src/ledger/` (Ledger Key Ring, USB-HID transport, clear-signing, spend policy leash)
  - `src/sandbox/` (Pre-flight simulation engine, revert decoder, self-healer)
  - `src/x402/` (Base USDC micropayment gateway, relayer, spend ledger)
  - `.github/workflows/` (CI pipelines and release workflows)
    **strictly require at least one approving review from `@tyraakj`** before the pull request can be merged.

---

## 4. Branch & Git Governance Rules

1. **Strict Linear History:** Merge commits are prohibited on `main`. Pull requests must be merged via **Squash & Merge** or **Rebase & Merge** to maintain a clean linear commit graph.
2. **No Force Pushes:** Force-pushes (`git push --force` or `git push --force-with-lease`) are permanently disabled on `main`.
3. **No Branch Deletions:** Deletion of `main` is restricted.
4. **Commit Author Identity:** All commits must use the verified author identity:
   ```text
   tyraakj <tyra191712@gmail.com>
   ```
5. **Branch Naming Conventions:**
   - Feature branches: `feat/<unit-number>-<short-description>` (e.g. `feat/02-ansi-tokens`)
   - Bugfix branches: `fix/<short-description>`
   - Documentation branches: `docs/<short-description>`

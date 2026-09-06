#!/usr/bin/env bash
# ============================================================================
# Kestrel Mechanical Suppression Gate
# Enforces zero unapproved type/lint/test suppressions across codebase
# ============================================================================

set -euo pipefail

PROHIBITED_PATTERNS=(
  "@ts-ignore"
  "@ts-expect-error"
  "@ts-nocheck"
  "eslint-disable"
  "as any"
  "--no-verify"
  "SKIP_TESTS"
  "describe.only"
  "it.only"
  "test.only"
  "describe.skip"
  "it.skip"
  "test.skip"
  "xit("
  "xdescribe("
)

MODE="staged"
if [[ "${1:-}" == "--all" ]]; then
  MODE="all"
fi

VIOLATIONS=0

echo "🔍 Running Kestrel Suppression Check (mode: ${MODE})..."

if [[ "${MODE}" == "staged" ]]; then
  # Check staged changes
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM || true)
  if [[ -z "${STAGED_FILES}" ]]; then
    echo "✅ No staged files to check."
    exit 0
  fi

  for file in ${STAGED_FILES}; do
    # Skip non-code files, scripts directory, and lockfiles
    if [[ "${file}" == scripts/* ]] || [[ "${file}" == *.lock ]] || [[ "${file}" == *.json ]] || [[ "${file}" == *.md ]]; then
      continue
    fi

    # Read added lines from staged diff
    while IFS= read -r line; do
      if [[ "${line}" =~ ^\+[^\+] ]]; then
        added_content="${line:1}"
        for pattern in "${PROHIBITED_PATTERNS[@]}"; do
          if [[ "${added_content}" == *"${pattern}"* ]]; then
            # Check if APPROVED-SUPPRESSION comment is present on the same line
            if [[ ! "${added_content}" =~ //[[:space:]]*APPROVED-SUPPRESSION: ]]; then
              echo "❌ Prohibited suppression '${pattern}' in ${file}:"
              echo "   --> ${added_content}"
              echo "   To approve with explicit authorization, append: // APPROVED-SUPPRESSION: <reason>"
              VIOLATIONS=$((VIOLATIONS + 1))
            fi
          fi
        done
      fi
    done < <(git diff --cached -U0 "${file}" 2>/dev/null || true)
  done

else
  # Scan all source/test files in repository
  TARGET_DIRS=("src" "tests")
  for dir in "${TARGET_DIRS[@]}"; do
    if [[ -d "${dir}" ]]; then
      for file in $(find "${dir}" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \)); do
        line_no=0
        while IFS= read -r line; do
          line_no=$((line_no + 1))
          for pattern in "${PROHIBITED_PATTERNS[@]}"; do
            if [[ "${line}" == *"${pattern}"* ]]; then
              if [[ ! "${line}" =~ //[[:space:]]*APPROVED-SUPPRESSION: ]]; then
                echo "❌ Prohibited suppression '${pattern}' at ${file}:${line_no}"
                echo "   --> ${line}"
                echo "   To approve with explicit authorization, append: // APPROVED-SUPPRESSION: <reason>"
                VIOLATIONS=$((VIOLATIONS + 1))
              fi
            fi
          done
        done < "${file}"
      done
    fi
  done
fi

if [[ ${VIOLATIONS} -gt 0 ]]; then
  echo ""
  echo "🚫 Mechanical Suppression Gate FAILED: ${VIOLATIONS} unapproved suppression(s) detected."
  echo "   Per project standards, suppressions are forbidden unless explicitly authorized."
  exit 1
fi

echo "✅ Mechanical Suppression Gate PASSED: Zero unapproved suppressions detected."
exit 0

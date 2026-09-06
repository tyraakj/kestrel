#!/usr/bin/env bash
# ============================================================================
# Kestrel Secret Scanner Gate
# Prevents accidental staging or committing of private keys, seeds, and tokens
# ============================================================================

set -euo pipefail

MODE="staged"
if [[ "${1:-}" == "--all" ]]; then
  MODE="all"
fi

VIOLATIONS=0

echo "🛡️  Running Kestrel Secret Scanner (mode: ${MODE})..."

SUSPICIOUS_PATTERNS=(
  "BEGIN RSA PRIVATE KEY"
  "BEGIN EC PRIVATE KEY"
  "BEGIN OPENSSH PRIVATE KEY"
  "BEGIN PRIVATE KEY"
  "ghp_[A-Za-z0-9]{36}"
  "AKIA[0-9A-Z]{16}"
)

if [[ "${MODE}" == "staged" ]]; then
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM || true)
  if [[ -z "${STAGED_FILES}" ]]; then
    echo "✅ No staged files to scan."
    exit 0
  fi

  for file in ${STAGED_FILES}; do
    # Skip scripts directory, binary and test snapshot files
    if [[ "${file}" == scripts/* ]] || [[ "${file}" == *.png ]] || [[ "${file}" == *.ico ]] || [[ "${file}" == *.lock ]]; then
      continue
    fi

    while IFS= read -r line; do
      if [[ "${line}" =~ ^\+[^\+] ]]; then
        added_content="${line:1}"
        for pattern in "${SUSPICIOUS_PATTERNS[@]}"; do
          if [[ "${added_content}" =~ ${pattern} ]]; then
            echo "🚨 Potential secret detected matching '${pattern}' in ${file}:"
            echo "   --> [REDACTED LINE]"
            VIOLATIONS=$((VIOLATIONS + 1))
          fi
        done
      fi
    done < <(git diff --cached -U0 "${file}" 2>/dev/null || true)
  done

else
  TARGET_DIRS=("src" "contracts")
  for dir in "${TARGET_DIRS[@]}"; do
    if [[ -d "${dir}" ]]; then
      for file in $(find "${dir}" -type f); do
        for pattern in "${SUSPICIOUS_PATTERNS[@]}"; do
          if grep -q -E "${pattern}" "${file}" 2>/dev/null; then
            echo "🚨 Potential secret detected matching '${pattern}' in ${file}"
            VIOLATIONS=$((VIOLATIONS + 1))
          fi
        done
      done
    fi
  done
fi

if [[ ${VIOLATIONS} -gt 0 ]]; then
  echo ""
  echo "🚫 Secret Scanner Gate FAILED: ${VIOLATIONS} potential secret(s) detected!"
  echo "   Remove credentials or use simulated key rings before proceeding."
  exit 1
fi

echo "✅ Secret Scanner Gate PASSED: No secrets detected."
exit 0

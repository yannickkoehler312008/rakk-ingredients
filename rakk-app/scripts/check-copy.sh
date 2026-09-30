#!/usr/bin/env bash
# Positioning guard for Rakk Ingredients (§1, §9).
#
# Two rules, both non-negotiable:
#   1. No score, grade, rating, or verdict — in UI, data model, or internal
#      naming. Not even as a WIP placeholder.
#   2. No adjectives of judgment in any copy, including placeholder text.
#
# Run from the project root:  bash scripts/check-copy.sh
# Exits non-zero on any hit, so it can gate CI later.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

# supabase/ sits at the repo root (one level up) so Supabase's GitHub
# integration finds it without configuration. The chat endpoint's copy is
# still held to the same rules as the app's.
#
# pipeline/ builds the ingredient database, and its vocabulary (lib/vocab.mjs)
# writes the explanation of every bulk row, so it is held to the same rules.
# Its downloaded sources (pipeline/sources/) and provenance excerpts
# (pipeline/out/) are regulators' own text, not our copy, and are not scanned;
# the data it emits is, via ../supabase/migrations and src/data/catalog.
SCAN_DIRS=(src scripts ../supabase ../pipeline/lib ../pipeline/parse ../pipeline/build.ts ../pipeline/verify.ts ../pipeline/emit.ts ../pipeline/fetch.mjs ../pipeline/sources.mjs)

# Files whose JOB is to name the banned words, and which therefore cannot obey
# the rule they enforce. Excluded BY PATH, never by pattern, so the list stays
# short and auditable and no violation can hide behind a clever match:
#   check-copy.sh                 — this file: the rule definitions
#   guardrails.ts                 — the server-side filter list + system prompt
#   fixtures/guardrail-cases.json — replies that MUST be blocked, as test input
#   live-guardrail-check.mjs      — adversarial probes aimed AT the model
RULE_FILES='scripts/check-copy\.sh|supabase/functions/ingredient-chat/guardrails\.ts|scripts/fixtures/guardrail-cases\.json|scripts/live-guardrail-check\.mjs'
fail=0

# ── Rule 1: verdict-shaped identifiers ───────────────────────────────────────
# `risk_assessment_refs` is Appendix A's own field name and holds citation links
# to published FDA/EFSA/JECFA assessments — it is a source list, not a rating —
# so it is allowed by exact name only. Any other identifier containing "risk"
# still trips the guard.
NAMING='(risk|safety|health)(_?)(score|rating|grade|level|index)|(score|grade|rating|verdict|severity|hazard)[A-Za-z_]*[[:space:]]*[:=]|[a-zA-Z_]+(Score|Grade|Rating|Verdict|Severity)\b'

echo "── Rule 1: no score / grade / rating / verdict in naming"
hits=$(grep -rnE "$NAMING" "${SCAN_DIRS[@]}" 2>/dev/null \
  | grep -vE "$RULE_FILES" \
  | grep -vE 'risk_assessment_refs' \
  | grep -vE '^\s*[^:]+:[0-9]+:\s*(\*|//)' || true)
if [ -n "$hits" ]; then
  echo "$hits"
  fail=1
else
  echo "   clean"
fi

# ── Rule 2: adjectives of judgment in copy ───────────────────────────────────
# Matched case-insensitively as whole words. The guard's own documentation is
# excluded by path, not by pattern, so the list itself stays greppable.
ADJECTIVES='harmful|toxic|toxin|dangerous|unsafe|bad for you|hazardous|carcinogen|poison|nasty|scary|risky|avoid this'

echo "── Rule 2: no adjectives of judgment in copy (incl. the chat endpoint)"
hits=$(grep -rniE "\b(${ADJECTIVES})\b" "${SCAN_DIRS[@]}" 2>/dev/null \
  | grep -vE "$RULE_FILES" || true)
if [ -n "$hits" ]; then
  echo "$hits"
  fail=1
else
  echo "   clean"
fi

# ── Rule 3: colour discipline ────────────────────────────────────────────────
# Every colour must come from src/theme/tokens.ts. A stray hex in a component is
# how a red/amber/green scale gets in by accident.
echo "── Rule 3: no colour literals outside the token file"
hits=$(grep -rnE "#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(" src \
  | grep -v 'src/theme/tokens.ts' \
  | grep -vE '^\s*[^:]+:[0-9]+:\s*(\*|//)' || true)
if [ -n "$hits" ]; then
  echo "$hits"
  fail=1
else
  echo "   clean"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "PASS — positioning constraints hold."
else
  echo "FAIL — see hits above."
fi
exit "$fail"

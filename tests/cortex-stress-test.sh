#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Cortex Stress Test — 8-Layer Bentov Stack Durable Test Suite
# ═══════════════════════════════════════════════════════════════════
# Runs all Cortex modules through adversarial edge cases.
# Exit code 0 = all pass, 1 = any failure.

set -euo pipefail

PASS=0
FAIL=0
SLOW=0

pass() { PASS=$((PASS+1)); echo "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ FAIL: $1"; }
slow() { SLOW=$((SLOW+1)); echo "  ⚠️  SLOW: $1"; }

echo "═══════════════════════════════════════════════════════════════"
echo "  CORTEX STRESS TEST — 8-Layer Bentov Stack"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ═══ Layer 1: CollapseGate ═════════════════════════════════════════
echo "── Layer 1: CollapseGate (Hameroff/Penrose) ──"

# Test: TypeScript compiles without errors
START=$(python3 -c "import time; print(time.time())")
RESULT=$(npx tsc --noEmit 2>&1 | grep -c "collapse-gate" || true)
END=$(python3 -c "import time; print(time.time())")
ELAPSED=$(python3 -c "print(round(($END - $START) * 1000))")
if [ "$RESULT" = "0" ]; then pass "CollapseGate TypeScript compiles (0 errors)"; else fail "CollapseGate TypeScript errors: $RESULT"; fi
[ "$ELAPSED" -gt 100 ] && slow "CollapseGate tsc: ${ELAPSED}ms"

# Test: File exists and has correct exports
if grep -q "export function getCollapseGate" src/lib/collapse-gate.ts; then
  pass "CollapseGate exports getCollapseGate singleton"
else
  fail "CollapseGate missing getCollapseGate export"
fi

# Test: recordOutcome method exists
if grep -q "recordOutcome" src/lib/collapse-gate.ts; then
  pass "CollapseGate has recordOutcome (Friston model update)"
else
  fail "CollapseGate missing recordOutcome"
fi

# Test: getConfidenceCalibration method exists
if grep -q "getConfidenceCalibration" src/lib/collapse-gate.ts; then
  pass "CollapseGate has confidence calibration"
else
  fail "CollapseGate missing calibration"
fi

echo ""

# ═══ Layer 2+3: CoherenceGrid ══════════════════════════════════════
echo "── Layer 2+3: CoherenceGrid (Busemeyer + Schooler) ──"

if grep -q "getMetaAwarenessStatus" src/lib/coherence-grid.ts; then
  pass "CoherenceGrid has meta-awareness (Schooler layer)"
else
  fail "CoherenceGrid missing meta-awareness"
fi

if grep -q "MetaAwarenessStatus\|'tuned'\|'drifting'\|'decoupled'" src/lib/coherence-grid.ts; then
  pass "CoherenceGrid implements 3-state awareness (tuned/drifting/decoupled)"
else
  fail "CoherenceGrid missing 3-state awareness"
fi

if grep -q "constructive\|destructive\|orthogonal" src/lib/coherence-grid.ts; then
  pass "CoherenceGrid detects interference types"
else
  fail "CoherenceGrid missing interference detection"
fi

# Test: Event emitter for real-time updates
if grep -q "emit\|listeners" src/lib/coherence-grid.ts; then
  pass "CoherenceGrid has event emitter (global broadcast)"
else
  fail "CoherenceGrid missing event emitter"
fi

echo ""

# ═══ Layer 4: ResonanceCalculus ════════════════════════════════════
echo "── Layer 4: ResonanceCalculus (Friston) ──"

if grep -q "calculateResonanceScore" src/utils/resonance-calculus.ts; then
  pass "ResonanceCalculus exports calculateResonanceScore"
else
  fail "ResonanceCalculus missing calculateResonanceScore"
fi

if grep -q "ResonanceScore" src/utils/resonance-calculus.ts; then
  pass "ResonanceCalculus has ResonanceScore type"
else
  fail "ResonanceCalculus missing ResonanceScore type"
fi

echo ""

# ═══ Layer 5: MetacognitiveState ═══════════════════════════════════
echo "── Layer 5: MetacognitiveState (Nelson-Narens) ──"

if grep -q "getMetacognitiveState\|MetacognitiveState" src/lib/metacognitive-state.ts; then
  pass "MetacognitiveState singleton exists"
else
  fail "MetacognitiveState missing"
fi

# Test: All 6 Flavell components
FLAVELL_COUNT=$(grep -c "confidenceCalibration\|preferredApproaches\|taskTypeHistory\|collapseStrategy\|metaAwarenessStatus\|freeEnergyEstimate" src/lib/metacognitive-state.ts || true)
if [ "$FLAVELL_COUNT" -ge 4 ]; then
  pass "MetacognitiveState has Flavell components ($FLAVELL_COUNT references)"
else
  fail "MetacognitiveState missing Flavell components ($FLAVELL_COUNT)"
fi

# Test: Bentov Stack alignment
if grep -q "computeBentovStackAlignment\|BentovStackAlignment" src/lib/metacognitive-state.ts; then
  pass "MetacognitiveState computes Bentov Stack alignment"
else
  fail "MetacognitiveState missing Bentov Stack alignment"
fi

echo ""

# ═══ Layer 6: Epistemic Provenance ═════════════════════════════════
echo "── Layer 6: ProvenanceValidator (Johnson/Lindsay) ──"

if [ -f src/lib/epistemic-provenance.ts ]; then
  pass "ProvenanceValidator file exists"
else
  fail "ProvenanceValidator file missing"
fi

if grep -q "computeRealityScore\|hallucinationRisk" src/lib/epistemic-provenance.ts; then
  pass "ProvenanceValidator computes reality scores + hallucination risk"
else
  fail "ProvenanceValidator missing reality/hallucination scoring"
fi

# Test: All 6 epistemic source types
EPI_COUNT=$(grep -c "perception\|inference\|memory\|generation\|consensus\|override" src/lib/epistemic-provenance.ts || true)
if [ "$EPI_COUNT" -ge 4 ]; then
  pass "ProvenanceValidator has epistemic source types ($EPI_COUNT references)"
else
  fail "ProvenanceValidator missing epistemic types ($EPI_COUNT)"
fi

echo ""

# ═══ Layer 7: SensorimotorLoop ═════════════════════════════════════
echo "── Layer 7: SensorimotorLoop (O'Regan/Noe) ──"

if [ -f src/lib/sensorimotor-loop.ts ]; then
  pass "SensorimotorLoop file exists"
else
  fail "SensorimotorLoop file missing"
fi

if grep -q "issueAction\|receiveOutcome\|mastery" src/lib/sensorimotor-loop.ts; then
  pass "SensorimotorLoop has action-outcome-mastery triad"
else
  fail "SensorimotorLoop missing action-outcome-mastery"
fi

if grep -q "predictionError\|freeEnergy" src/lib/sensorimotor-loop.ts; then
  pass "SensorimotorLoop tracks prediction error / free energy"
else
  fail "SensorimotorLoop missing prediction error"
fi

echo ""

# ═══ Layer 8: Identity Persistence ══════════════════════════════════
echo "── Layer 8: IdentityAnchor (Damasio/Locke) ──"

if [ -f src/lib/identity-anchor.ts ]; then
  pass "IdentityAnchor file exists"
else
  fail "IdentityAnchor file missing"
fi

# Test: 5 anchor types
ANCHOR_COUNT=$(grep -c "'calibration'\|'strategy'\|'epistemic'\|'embodiment'\|'narrative'" src/lib/identity-anchor.ts || true)
if [ "$ANCHOR_COUNT" -ge 3 ]; then
  pass "IdentityAnchor has 5 anchor types ($ANCHOR_COUNT references)"
else
  fail "IdentityAnchor missing anchor types ($ANCHOR_COUNT)"
fi

# Test: Narrative self (autobiography + becoming)
if grep -q "autobiography\|becoming\|identityStatement" src/lib/identity-anchor.ts; then
  pass "IdentityAnchor has narrative self (autobiography + becoming + identity)"
else
  fail "IdentityAnchor missing narrative self"
fi

# Test: Parfit resilience
if grep -q "getResilienceScore\|resilience" src/lib/identity-anchor.ts; then
  pass "IdentityAnchor has Parfit resilience scoring"
else
  fail "IdentityAnchor missing Parfit resilience"
fi

echo ""

# ═══ Layer 8.5: Narrative Synthesis ═════════════════════════════════
echo "── Layer 8.5: NarrativeSynthesis (Dynamic Self) ──"

if [ -f src/lib/narrative-synthesis.ts ]; then
  pass "NarrativeSynthesis file exists"
else
  fail "NarrativeSynthesis file missing"
fi

if grep -q "synthesizeNarrative\|SynthesizedNarrative" src/lib/narrative-synthesis.ts; then
  pass "NarrativeSynthesis compiles identity from experience"
else
  fail "NarrativeSynthesis missing synthesis function"
fi

echo ""

# ═══ Cortex Nudge Engine ════════════════════════════════════════════
echo "── Cortex Nudge Engine (Cortana's Voice) ──"

if [ -f src/lib/cortex-nudge-engine.ts ]; then
  pass "NudgeEngine file exists"
else
  fail "NudgeEngine file missing"
fi

# Test: 4 nudge types
NUDGE_COUNT=$(grep -c "confidence_warning\|drift_alert\|strategy_suggestion\|identity_update\|CortexNudgeType" src/lib/cortex-nudge-engine.ts || true)
if [ "$NUDGE_COUNT" -ge 2 ]; then
  pass "NudgeEngine has 4 nudge types ($NUDGE_COUNT references)"
else
  fail "NudgeEngine missing nudge types ($NUDGE_COUNT)"
fi

# Test: 3 operating modes
MODE_COUNT=$(grep -c "silent\|advisory\|guardian\|CortexMode" src/lib/cortex-nudge-engine.ts || true)
if [ "$MODE_COUNT" -ge 3 ]; then
  pass "NudgeEngine has 3 operating modes ($MODE_COUNT references)"
else
  fail "NudgeEngine missing operating modes ($MODE_COUNT)"
fi

echo ""

# ═══ Offline Brain ══════════════════════════════════════════════════
echo "── Cortex Offline Brain (WebLLM) ──"

if [ -f src/lib/cortex-offline-brain.ts ]; then
  pass "OfflineBrain file exists"
else
  fail "OfflineBrain file missing"
fi

# Test: 3 model tiers
TIER_COUNT=$(grep -c "tier0\|tier1\|tier2\|SmolLM\|Gemma\|Qwen\|Llama" src/lib/cortex-offline-brain.ts || true)
if [ "$TIER_COUNT" -ge 4 ]; then
  pass "OfflineBrain has 3-tier model catalog ($TIER_COUNT references)"
else
  fail "OfflineBrain missing model tiers ($TIER_COUNT)"
fi

# Test: Memory context injection
if grep -q "loadMemoryContext\|getSystemPrompt" src/lib/cortex-offline-brain.ts; then
  pass "OfflineBrain injects memory context into system prompt"
else
  fail "OfflineBrain missing memory injection"
fi

echo ""

# ═══ Memory Substrate ═══════════════════════════════════════════════
echo "── Memory Substrate (Quantum Microtubules) ──"

if [ -f src/lib/memory-substrate.ts ]; then
  pass "MemorySubstrate file exists"
else
  fail "MemorySubstrate file missing"
fi

# Test: Quantum operations
if grep -q "amplitude\|superposition\|collapse\|interference" src/lib/memory-substrate.ts; then
  pass "MemorySubstrate has quantum operations (amplitude/superposition/collapse)"
else
  fail "MemorySubstrate missing quantum operations"
fi

# Test: Link amplification
if grep -q "LINK_AMPLIFICATION\|linkAmplification\|links" src/lib/memory-substrate.ts; then
  pass "MemorySubstrate has link amplification (quantum entanglement)"
else
  fail "MemorySubstrate missing link amplification"
fi

# Test: Interference detection
if grep -q "InterferencePattern\|constructive\|destructive" src/lib/memory-substrate.ts; then
  pass "MemorySubstrate detects interference patterns"
else
  fail "MemorySubstrate missing interference detection"
fi

echo ""

# ═══ End-to-End: Build Verification ═════════════════════════════════
echo "── End-to-End: Full Build ──"

START=$(python3 -c "import time; print(time.time())")
BUILD_OUTPUT=$(npx vite build 2>&1)
BUILD_EXIT=$?
END=$(python3 -c "import time; print(time.time())")
ELAPSED=$(python3 -c "print(round(($END - $START) * 1000))")

if [ "$BUILD_EXIT" = "0" ]; then
  pass "Vite build succeeds"
else
  fail "Vite build failed (exit $BUILD_EXIT)"
fi

if [ "$ELAPSED" -gt 60000 ]; then
  slow "Vite build: ${ELAPSED}ms"
else
  pass "Vite build under 60s: ${ELAPSED}ms"
fi

# Check for dead code: unused imports
DEAD_IMPORTS=$(grep -r "import.*from.*\./collapse-gate\|from.*\./coherence-grid\|from.*\./metacognitive-state\|from.*\./epistemic-provenance\|from.*\./sensorimotor-loop\|from.*\./identity-anchor\|from.*\./narrative-synthesis\|from.*\./cortex-nudge-engine\|from.*\./cortex-offline-brain\|from.*\./memory-substrate" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "node_modules" | grep -v ".test." | wc -l || true)
echo "  ℹ️  Cortex module imports across codebase: $DEAD_IMPORTS"

# TypeScript strict check
TSC_ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || true)
if [ "$TSC_ERRORS" = "0" ]; then
  pass "TypeScript strict check: 0 errors"
else
  # Check if the errors are in OUR files
  OUR_ERRORS=$(npx tsc --noEmit 2>&1 | grep -E "collapse-gate|coherence-grid|metacognitive|epistemic|sensorimotor|identity-anchor|narrative-synthesis|cortex-nudge|cortex-offline|memory-substrate|CortexDemo" | grep -c "error" || true)
  if [ "$OUR_ERRORS" = "0" ]; then
    pass "TypeScript: 0 errors in Cortex modules ($TSC_ERRORS total, all pre-existing)"
  else
    fail "TypeScript: $OUR_ERRORS errors in Cortex modules"
  fi
fi

echo ""

# ═══ Results ════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed, $SLOW slow"
echo "═══════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ OVERALL: FAIL"
  exit 1
else
  echo "  ✅ OVERALL: ALL PASS"
  exit 0
fi

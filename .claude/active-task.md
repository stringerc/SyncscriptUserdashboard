# Active task — claim-check gate (ironclad grounding) (2026-11-24)
STATUS: DONE — pending commit.

src/lib/cortex-agent/claim-check.ts — deterministic post-generation fact
gate. Scans every agentic reply for CHECKABLE live-state claims and
appends a deterministic correction when they mismatch measured truth:
- port claims vs actual server port
- "N/M SLOs" / "N SLOs passing" vs resilience-report.json
- "N dirty/modified files" vs git status --porcelain
- "N% free/headroom" vs memory_pressure (honest macOS metric)
- file-exists claims vs workspace-root resolution (incl. one-level
  subdirectory scan, case-insensitive)
- file-missing claims ("X doesn't exist", "no X file") — inverse check:
  flags when the file DOES exist under a known root
Vitals cached 30s; every scan logged to .cortex-runtime/claim-check.jsonl.
Ambiguous prose ("provider degraded") deliberately unchecked — false
corrections would be their own dishonesty.

Wired at both reply paths: inbound bridge (reply corrected before
cache store + audit) and voice SSE (correction rides the token stream).

Verified:
- Unit: synthetic replay of Cortex's actual bad reply flagged ALL 5
  errors (port 5180, 10/10 SLOs, 26 dirty, 98% mem, launch_plan.md
  missing) with correct actuals; clean text → 0 flags.
- Live E2E: inbound "status check" → she called system_vitals +
  list_dir unprompted and answered CORRECTLY (5173, 13/13 SLOs,
  LAUNCH_PLAN.md in cortex-repos). claim-check logged flagged:0.
- Typecheck clean, resilience 13/13.

The loop is now: prompt rules steer → tools give truth → gate catches
what slips. Three layers, last one deterministic.

updated: 2026-11-24T03:10:00Z
cwd: /Users/Apple/syncscript

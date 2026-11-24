# Active task — tenant key rotation + grounding fixes (2026-11-24)
STATUS: DONE — pending commit.

SECURITY: tenant key rotated after Cortex printed the live cxk_ key in a
chat reply (transcripts + possible Hindsight retention). Added
rotateTenantKey() to tenants.ts; new key live-verified via
/api/cortex/dispatch (contract+quota returned), old key returns
"invalid or missing API key". Plaintext stored once at
.cortex-runtime/tenant1.key (0600); /tmp/tenant-create.json deleted.
NOTE: do NOT put tenant keys in .env — auth is SHA-256 hash lookup in
tenants.json by design; env is for provider keys only.

Failure-mode fixes (both diagnosed from Cortex's stale/incorrect reply):
1. Filesystem blindness → WORKSPACE_NOTE (both agentic + inbound paths)
   now lists .cortex-runtime/ contents explicitly and adds RULES:
   never claim a file missing without a list_dir/read_file check in the
   named roots; never ask the user for on-disk data that lives there.
2. Stale telemetry → new system_vitals tool (src/lib/cortex-agent/
   system-vitals.ts): live port, uptime, git branch+dirty count,
   resilience report freshness (pass/slos/age/stale), model fleet
   byStatus, memory_pressure free% (os.freemem reads near-zero on
   macOS — memory_pressure is the honest metric), workspaceRoots map.
   Tool description instructs: call BEFORE citing any system number.
   Verified live via tools/execute: port 5173, 13/13 SLOs age 7min,
   mem 38%, models 8 healthy/5 degraded.

Honest limits: prompt rules reduce but don't eliminate stale narration —
the deterministic fix would be a metacog check that flags uncited numbers.
system_vitals is opt-in per turn; the tool description carries the rule.

updated: 2026-11-24T02:50:00Z
cwd: /Users/Apple/syncscript

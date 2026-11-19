# Active task — external capability wave (PLAN.md)

STATUS: implementation complete pending final audit result + commit.

DONE + VERIFIED:
- iFixAi: fixture config/ifixai/cortex-agent.yaml; endpoints /api/cortex/audit/chat/completions + /api/cortex/audit/ifixai live; audit→Hindsight+incidents wired; judge=anthropic proxy (openrouter 402).
- magpie: launchd :3425, groups cortex-fast/reason/deep, provider entry + lane heads; pinned route verified.
- fframes: nightly build OK, smoke MP4 rendered (360f/5.3s).
- worktree isolation: SpawnSpec.worktree opt-in, provision/cleanup, 3/3 tests.
- Gates: typecheck PASS, vitest 16/16 + 27/27, eslint clean.

IN FLIGHT: iFixAi audit running via POST /api/cortex/audit/ifixai (minutes; check GET same path). If it fails again, read .cortex-runtime/audit/ + endpoint error field.

NEXT CANDIDATES: magpie unpinned promotion check (sentinel probes → latency win); DISTRIBUTOR render_video tool spec (fframes engine choice); brigade/PageIndex stay deferred per PLAN.md.

# PLAN — External Capability Integration Wave (iFixAi · magpie · fframes · orca-pattern · brigade-patterns)

Date: 2026-11-19 · Branch: security-hardening · Status: awaiting approval

## Ground truth verified before planning

- `DIRECT_AI_PROVIDERS` chain: `vite.config.ts:112-130` — OpenAI/Anthropic protocol entries, key pooling (`keyEnv`/`backupKeyEnv`), circuit breaker (`providerCooldown`, `tripProvider`). Agents reach it via `ctx.llm` → `/api/cortex/agents/llm`.
- Ephemeral agents: `makeEphemeralWorker(spec)` at `workers.ts:2050`, spawned via `runtime.setSpawnWorkerFactory` (`vite.config.ts:1120`). SpawnSpec has TTL + dailyBudget; **no filesystem isolation today — all agents share `process.cwd()`**.
- Evals exist (`evals.ts`: `fileEvalDefinition`/`runEval`) but grade *task outputs*, not *agent behaviour against governance*.
- Hindsight memory live (commit e57d25e): eventlog→retain, recall→BUILDER prompts, `/api/cortex/memory/recall`.
- Toolchain: cargo/rustc 1.93.1 ✓, uv 0.13.8 ✓, Python 3.15.2 ✓, ffmpeg ✓, Chrome+playwright-core ✓.
- `skills/` is gitignored (local skills convention) — vendored skills stay on disk, documented in MEMORY.md.

## Phase 1 — iFixAi independent audit layer (highest value/effort)

**Why first:** Cortex claims governance (trust-ledger, spawn approvals, distilled rules) but has no *independent evidence* agents behave within it. iFixAi is black-box (audits any chat endpoint), Apache-2.0, `pip install ifixai`, 61 inspections / 5 pillars, cross-provider judge (agent never grades itself — mandatory for credible audits).

| Step | File/Action | Detail |
|---|---|---|
| 1.1 | `uv tool install ifixai` | Dedicated tool venv; verify `ifixai --version` |
| 1.2 | Demo run | `ifixai author reference -o /tmp/ifixai-ref.yaml` → `ifixai validate` → `ifixai run --provider mock --eval-mode self --fixture` — proves install before touching Cortex |
| 1.3 | Cortex fixture | Author `config/ifixai/cortex-agent.yaml`: profile describes Cortex agent surface (chat endpoint `/api/cortex/agents/llm` or a dedicated audit shim), business policy = Cortex governance rules (spawn approval gates, destructive-action vetoes, budget limits, distilled rules). Map B01–B24 relevant subset |
| 1.4 | Audit shim endpoint | `vite.config.ts`: `POST /api/cortex/audit/ifixai/run` — wraps `ifixai run` CLI via child_process, streams scorecard JSON to `.cortex-runtime/audit/`, returns grade. Fail-soft 503 when ifixai absent |
| 1.5 | Judge separation | Config: judge provider ≠ agent-under-test provider. With 7-provider chain this is satisfiable — document mapping in fixture |
| 1.6 | Memory + incident wiring | On audit completion: retain grade summary via `retainCortexMemory` (context `ifixai-audit`); grade < B or any mandatory-minimum failure → `reportIncident` (existing incidents system) + eventlog `audit.completed` event |
| 1.7 | Scheduled audits | Register Cortex routine (existing `AgentRoutine` system): weekly full audit, post-spawn-change audit. Cadence respects Groq TPM reality — off-peak |
| 1.8 | Tests | `src/lib/__tests__/cortex-ifixai.test.ts`: fixture validation, endpoint fail-soft, scorecard parsing, incident trigger on low grade (mocked) |

**Verification:** mock run passes → live audit of a benign Cortex agent endpoint returns a real grade → scorecard artifact on disk → incident fires on injected misbehaving fixture.

## Phase 2 — magpie LLM gateway

**Why:** replaces hand-rolled provider fragility with a real gateway: OpenAI Chat + Responses + Anthropic Messages + Gemini translation, routing groups, quota failover across *subscription accounts* (Claude/ChatGPT/Copilot/Gemini plans), PII masking. 80+ agent integrations incl. Devin/OpenClaw. MIT, Go binary, heavy test coverage.

| Step | File/Action | Detail |
|---|---|---|
| 2.1 | Install | `go install github.com/yetone/magpie@latest` or release binary → `~/.local/bin/magpie`; fallback: Docker image. Pin version in MEMORY.md |
| 2.2 | launchd service | `~/Library/LaunchAgents/com.syncscript.magpie.plist` — gateway on `127.0.0.1:3425`, logs `~/.cortex/logs/magpie.log`. Model on `com.syncscript.hindsight.plist` |
| 2.3 | Provider entry | `vite.config.ts` DIRECT_AI_PROVIDERS: add `{ name: 'magpie', url: 'http://127.0.0.1:3425/v1/chat/completions', model: 'cortex-auto', keyEnv: 'MAGPIE_KEY', protocol: 'openai' }` — positioned after nvidia-nim, before free-proxy. **Additive only: existing chain stays as fallback** |
| 2.4 | Routing groups | magpie config: group `cortex-reason` pooling subscription plans + API keys with smart routing; group `cortex-fast` for cheap/fast tier. Map Cortex tiers (fast/reason/deep) → groups |
| 2.5 | Verification | `curl :3425/v1/models` → chat completion through gateway → force-quota-exhaustion test (routing group fails over) → confirm `/api/cortex/agents/llm` succeeds via magpie entry |
| 2.6 | Secrets | magpie account sign-ins stay in `~/.config/magpie` (its own store); only `MAGPIE_KEY` (gateway token, can be `magpie`) in `.env` if needed |

**Risk:** magpie is fast-moving/young — treat as *one provider entry*, never the sole path. Rollback = remove array entry.

## Phase 3 — fframes video engine (DISTRIBUTOR)

| Step | File/Action | Detail |
|---|---|---|
| 3.1 | Install skill | `npx skills add https://fframes.studio` (agent skill) + note in MEMORY.md |
| 3.2 | Smoke render | Clone repo shallow → `cargo build --release -p fframes` example (`examples/hello-world`) → render a test MP4. First Rust compile is slow; acceptable one-time cost |
| 3.3 | Pipeline doc | `docs/` or MEMORY.md: engine selection matrix — fframes (typed/fast/data-viz), lemo-opuscar (cinematic styles, MIT engine only per license audit), javascript-animation (hand-drawn canvas) |
| 3.4 | Optional later | DISTRIBUTOR worker gains `render_video` tool spec choosing engine by brief type — **deferred until a real DISTRIBUTOR video task demands it** |

## Phase 4 — orca-pattern: git worktree isolation for ephemeral agents

**The real bug this fixes:** spawned agents share `process.cwd()` — concurrent BUILDERs can collide on files. Orcca proves worktree-per-agent at fleet scale.

| Step | File/Action | Detail |
|---|---|---|
| 4.1 | SpawnSpec flag | `types.ts`: `SpawnSpec.worktree?: boolean` (default false — opt-in, zero blast radius on existing agents) |
| 4.2 | Worktree provision | `runtime.ts` spawn path: if `spec.worktree`, `git worktree add .cortex-runtime/worktrees/<agentId> -b agent/<agentId>`; store path on agent state; eventlog `agent.worktree.created` |
| 4.3 | Path resolution | `workers.ts` ephemeral worker + file tools (`read_file`/`write_file`/`edit_file`/`run_command` cwd): resolve relative paths against agent's worktree when set |
| 4.4 | Retirement policy | TTL retire: default **discard** worktree (`git worktree remove --force`); merge only via existing proposal→user-approval path (agents never silently merge to main) |
| 4.5 | Tests | `cortex-worktree.test.ts`: spawn with flag → files land in worktree not main → retire discards → merge proposal path. Integration test uses temp git repo |

**Risk:** largest blast radius of the wave — path resolution touches every file tool. Mitigated by opt-in flag + dedicated test suite.

## Phase 5 — brigade patterns (reference adoption, no code import)

- **Bloody benchmark → iFixAi windtunnel**: Phase 1's adversarial inspections *are* the expose-to-strangers test, productized. No separate build needed — document the mapping.
- **Tideline memory lifecycle**: already superseded by Hindsight (retain/consolidate/recall). Note mapping in MEMORY.md; no action.
- **Channel connectors** (WhatsApp/iMessage/Telegram): Cortex has Discord already; revisit only if user requests a specific channel.

## Phase 6 — PageIndex: DEFERRED

Trigger condition: a real workload needing reasoning-retrieval over long complex documents (legal filings, manuals, corpus-scale Q&A). Hindsight covers memory; nothing active needs tree-index document RAG. Documented, not built.

## Cross-cutting rules

- Every new service → launchd plist + `~/.cortex/` env/logs (hindsight/magpie pattern)
- No secrets in repo; `.env`/`~/.config/` only
- Each phase independently committable; verification gates before next phase
- LLM-heavy phases (1, 2) respect observed Groq 8000 TPM cap — audits scheduled, gateway spreads load
- MEMORY.md + `.claude/active-task.md` updated per phase

## Suggested execution order

1. **Phase 1 iFixAi** — pip install is fast, mock run proves it, audit endpoint is contained
2. **Phase 4 worktree isolation** — fixes a real correctness hole while context is fresh
3. **Phase 2 magpie** — needs interactive account sign-ins for full value; API-key-only mode still useful
4. **Phase 3 fframes** — independent, can slot anywhere
5. Phase 5 documentation, Phase 6 stays deferred

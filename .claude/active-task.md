# Active task — capability-map utilization + custody-case-ops skill (2026-11-23)
STATUS: DONE — pending commit of cortex-side diff.

Utilization tracking (supply-chain measurement half):
- recordCapabilityUse() wired into agentRuntime.setTaskFinishedHook —
  every terminal task (completed/failed; vetoed/cancelled excluded)
  with a goal-stamped input.goalId appends {ts,goalId,asset} to
  .cortex-runtime/capability-usage.jsonl (512KB bounded rotation).
- assessGoal now annotates each capability: measurable (has dispatchable
  cortexAssets lane), uses30d, lastUsedAt, stale (covered+measurable+
  unused 30d on goal declared >14d ago).
- fileCapabilityGaps now also surfaces stale coverage as decay/prune
  candidates in the same deduped proposal.
- Verified via tsx: vetoed + ungoaled events correctly skipped;
  openclaw:gateway_task use counted on external-comms (uses30d:1,
  stale:false) while unmatched lanes stayed 0/stale:true. Live GET shows
  utilization fields on all capabilities; stale:0 (goals <14d old —
  grace period working). Resilience 13/13 pass.

custody-case-ops skill (OpenClaw side, ~/.openclaw/skills/):
- Operational layer for the custody goal: case-file notebook structure,
  deadline/document/attorney-log/filing/evidence workflows, grounded in
  real ready skills (himalaya, gog, apple-reminders/notes, nano-pdf,
  libreoffice, evidence-hygiene). Hard rules: no legal advice, dates
  require source docs, all sends route through cortex-bridge/Libet.
- Verified: `openclaw skills list` shows it ready (85/102).

Honest limits:
- Utilization measurable ONLY for agent lanes — skill/tool invocations
  aren't goal-attributed yet (measurable=false marks this).
- Stale is a flag, not auto-prune — proposals mention decay candidates;
  removal still goes through the approve-each ledger.

updated: 2026-11-23T20:05:00Z
cwd: /Users/Apple/syncscript

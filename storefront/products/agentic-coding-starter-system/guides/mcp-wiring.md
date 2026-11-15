# MCP Wiring Guide

MCP (Model Context Protocol) is how agents stop guessing and start *looking
things up*. This guide covers the wiring pattern that works — not every
server that exists.

## The mental model

Your agent has three knowledge sources:

1. **The repo** — code, configs, docs. Already covered by file tools.
2. **Live external state** — GitHub PRs, DB rows, deployed URLs, docs sites.
   This is what MCP adds.
3. **The conversation** — what you've told it. Unreliable, lossy.

Every MCP failure mode comes from confusing these. The agent "knows" the
codebase but not that the PR was already merged, the migration already ran,
or the API now returns a different shape.

## Which servers are actually worth it

| Server | Worth it? | Why |
|---|---|---|
| filesystem | Maybe | Only if you need cross-directory access. Usually redundant. |
| github | Yes | PRs, issues, CI status, code search. Agents hallucinate repo state constantly. |
| postgres/sql | Yes, read-only | Schema lookups kill a whole class of "wrong column" bugs. |
| fetch | Yes | Docs lookup. Cheap, prevents stale-knowledge answers. |
| puppeteer/browser | Sometimes | For JS-heavy docs or verifying deployed UI. Heavyweight. |
| everything-else | No | Slack, email, calendars — scope creep until governance exists. |

Rule of thumb: wire MCP for **state the agent can't see from the repo**.
If the answer is in the code, MCP adds latency and attack surface for nothing.

## Setup pattern (Cursor / Claude Code)

1. Add the server to your client's MCP config (`configs/cursor/mcp-config.example.json`).
2. **Secrets via env vars, never inline.** `${GITHUB_TOKEN}`, `${DATABASE_URL}`.
3. Start with READ-ONLY scopes. GitHub: read PRs/issues, not write. Postgres:
   a read-only role, not the app's write credentials.
4. Give the agent a rule: "check live state via MCP before claiming X about
   external systems." This belongs in CLAUDE.md/.cursorrules.

## The failure modes (and fixes)

**Agent ignores MCP and guesses.** Fix: rules file + one example in context.
"Before saying a PR is open, call github.list_pull_requests."

**Stale context.** MCP returns current state; the model's training doesn't.
Prefer MCP results over priors, always.

**Token bloat.** MCP tool schemas eat context. Don't wire 10 servers
"just in case" — each one's tool list competes with your actual task.

**Write access accidents.** An agent with github write + a sloppy prompt can
merge PRs. Start read-only; grant write per-task, not per-install.

## Verification

After wiring, test with a question that requires live state:
"What PRs are open against main?" — if the agent answers from memory
instead of calling the tool, your rules file isn't working.

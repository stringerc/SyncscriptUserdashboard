# Agentic Coding Starter System

Stop babysitting AI. This is the production system for running coding agents
(Claude Code, Cursor, MCP-connected tools) like a senior engineer — not a
prompt pack, a working setup.

## What's inside

```
agentic-coding-starter-system/
├── README.md                        ← you are here
├── configs/
│   ├── claude-code/
│   │   ├── CLAUDE.md.template       ← project rules that survive long sessions
│   │   ├── reviewer.agent.md        ← adversarial review subagent
│   │   ├── test-runner.agent.md     ← runs tests, reports real failures only
│   │   ├── debugger.agent.md        ← root-cause debugging specialist
│   │   └── docs.agent.md            ← keeps docs in sync with code
│   └── cursor/
│       ├── .cursorrules.template    ← Cursor rules file
│       └── mcp-config.example.json  ← MCP server wiring
├── guides/
│   ├── mcp-wiring.md                ← connect agents to GitHub, DBs, docs, browsers
│   ├── debugging-playbook.md        ← when agents loop, hallucinate, or fake "done"
│   └── task-decomposition.md        ← how to give agents work that survives reality
└── examples/
    └── before-after-transcripts.md  ← shipped vs. flailed agent runs
```

## Quick start (10 minutes)

1. Copy `configs/claude-code/CLAUDE.md.template` to your repo root as
   `CLAUDE.md`. Fill in the bracketed sections.
2. Copy the `.agent.md` files into `.claude/agents/` (Claude Code) — they
   become callable subagents.
3. If you use Cursor, adapt `configs/cursor/.cursorrules.template`.
4. Read `guides/task-decomposition.md` before your next non-trivial task.
   This is the single highest-leverage file in the kit.

## The core idea

Agents fail for predictable reasons: vague tasks, no verification loop,
unbounded context, and no adversarial review. This kit fixes each with a
specific mechanism — decomposition patterns, a test-runner that refuses to
report success without evidence, a reviewer that tries to break the work, and
rules files that keep the agent honest about what "done" means.

## Who it's for

Developers already using Claude Code, Cursor, or similar tools who are stuck
at "it writes code but I can't trust it to finish jobs." If you've ever had an
agent claim success on broken code, start with `guides/debugging-playbook.md`.

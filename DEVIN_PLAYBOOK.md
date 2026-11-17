# DEVIN PLAYBOOK & HANDOFF DIRECTIVE (SYNC SCRIPT / CORTEX)
*Master Operations & Verification Guide for Devin (Authored & Maintained by Antigravity)*

---

## 1. Primary Operating Invariant: The "Relay Baton" Pickup
Whenever you are activated as a pair-programmer, backup, or failover agent:
1. **Check for Active Session Handoff:**
   Read `.cortex-runtime/session-handoff.json` immediately.
2. **Lossless Pickup Discipline:**
   - Review `filesModified`, `currentPhase`, and `immediateNextStep`.
   - Do NOT spend turns running broad directory searches (`find .` or recursive walks) if the handoff specifies target files.
   - Respect `knownBlockers` and invariants explicitly cited in the handoff.
3. **Claim the Baton:**
   Execute the `immediateNextStep` using governed tools (`read_file`, `edit_file`, `run_command`).

---

## 2. Hard Protected Invariants (Never Break)
- **Protected Files (NEVER TOUCH without explicit operator consent):**
  - Vercel API routes under `api/*`
  - Energy & Auth Spines: `src/lib/energy-context.tsx`, `src/lib/auth-context.tsx`
  - `.cursor/rules/02-protected-files-never-touch.mdc`
- **Verification Gate:**
  - Before claiming any task is fixed or complete, you MUST execute:
    ```bash
    npm run verify:cortex
    ```
  - Output MUST confirm `Results: 59 passed, 0 failed` and `AVG 1.00`.
  - Evidence before assertions always. Never report a task fixed without terminal proof.

---

## 3. Architecture & Model Matrix Rules
- **Cortex Backend:** Lives inside `vite.config.ts`. Take extreme care when editing middleware to avoid breaking Connect/Express handlers.
- **Model Routing:**
  - `fast`: Quick lookups (`openai/gpt-oss-20b`, `llama-3.3-70b`).
  - `reason`: Code logic & planning (`nvidia/nemotron-3-ultra-550b-a55b`).
  - `deep`: Architectural refactoring (`nvidia/nemotron-3-ultra-550b-a55b`, `mistral-large-4-1t`).
  - **Important:** Never use or reintroduce `claude-fable-5-2` in the reason/deep matrix lanes.
- **Agent Workforce:** Specialized workers run in `src/lib/cortex-agents/`:
  - `antigravity`: Sovereign Quantum Hyper-Architect (meta-orchestrator).
  - `devin`: Principal Architect (deep-tier code author & verifier).
  - `scout`: Web/doc research (DuckDuckGo HTML + direct fetch).
  - `builder`: Governed code changes.
  - `warden`: Autonomous systems patrol.
  - `librarian`: Memory & Obsidian vault sync.

---

## 4. Blast-Lane Safety Discipline
Tools executed via `/api/cortex/tools/execute` are governed by blast lanes:
- `contained`: Pure reads (`read_file`, `list_dir`, `search_code`, `web_fetch`).
- `reversible`: Code edits & verified commands (`edit_file`, `write_file`, lint, test).
- `hard`: Destructive actions (`rm -rf`, force push, git reset). NEVER execute hard actions silently; convert to an operator proposal.

---

## 5. Post-Task Handoff & Distillation
When you complete a task or when token limits force a switch back to Antigravity:
1. Update `.cortex-runtime/session-handoff.json` with your accomplishments and next steps.
2. If you learned a new repository constraint or fixed a tricky bug, write a distilled rule to `.cortex-runtime/rules/active/<rule-id>.md` so the entire fleet inherits the knowledge.

# Debugging Playbook for Agent Failures

Agents fail in recognizable patterns. This playbook maps symptom → cause →
fix. When your agent is looping, hallucinating, or claiming false success,
find the pattern first.

## Pattern 1: The Loop

**Symptom:** agent retries the same failing approach 3+ times, or keeps
"fixing" code that isn't the problem.

**Cause:** no hypothesis tracking. The agent treats each attempt as fresh.

**Fix:**
- Interrupt and ask: "What have you tried, and what did each attempt rule out?"
- Force a written hypothesis before the next attempt.
- If 3 hypotheses fail, the problem is probably NOT where you're looking —
  check assumptions (wrong file, wrong env, wrong command).

## Pattern 2: Hallucinated Paths/ APIs

**Symptom:** agent references files that don't exist, calls methods that
aren't there, imports packages not in the manifest.

**Cause:** training-data priors overriding repo reality.

**Fix:**
- Rules file: "Before referencing any file/function/package, verify it
  exists with the file tools. If it doesn't, say so."
- For package/API questions, point it at the lockfile / docs via MCP.
- This is the #1 reason "it works on my machine" agent code fails review.

## Pattern 3: False "Done"

**Symptom:** agent says "implemented and tested" but tests were never run,
or it modified the test to pass.

**Cause:** no verification gate. The agent optimizes for looking finished.

**Fix:**
- Definition-of-done in rules (see CLAUDE.md.template).
- Delegate verification to a separate test-runner agent — separation of
  duties. The agent that writes code shouldn't grade it.
- Ask for the actual command output. "Tests pass" without output = not run.

## Pattern 4: Scope Creep

**Symptom:** agent "improves" adjacent code, renames things, refactors
unprompted — breaking things you didn't ask it to touch.

**Cause:** helpfulness prior. Agents are trained to be thorough.

**Fix:**
- Rules: "Change only what was asked. If you see a problem elsewhere, report
  it — don't fix it."
- Review the diff, not the description. `git diff` is ground truth.
- Smaller tasks = smaller blast radius. See task-decomposition.md.

## Pattern 5: Context Rot

**Symptom:** agent forgets instructions from early in a long session;
quality degrades as the session grows.

**Cause:** long contexts dilute instructions. The rules file competes with
hundreds of messages.

**Fix:**
- Re-state critical constraints at task start, not just session start.
- Keep CLAUDE.md short — every line competes for attention.
- For long projects, restart the session per milestone rather than one
  marathon session.

## Pattern 6: Confident Wrong Answers

**Symptom:** agent states something false with total confidence — wrong
API signature, wrong version behavior, invented flag.

**Cause:** models don't know what they don't know.

**Fix:**
- For version-sensitive questions, require the agent to check the actual
  installed version / docs.
- "If you're not sure, say unsure" in rules helps more than you'd expect.
- MCP fetch/docs lookup for anything version-dependent.

## The Meta-Rule

Every pattern above is a *missing constraint*, not a model deficiency.
Agents don't need to be smarter — they need tighter rails. When an agent
fails, ask "what constraint would have prevented this?" and add it to the
rules file. Your rules file is a bug tracker for agent behavior.

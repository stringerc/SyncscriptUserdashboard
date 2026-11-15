# Task Decomposition: Giving Agents Work That Survives Reality

The difference between an agent that ships and an agent that flails is almost
never the model — it's the task. This guide is the highest-leverage thing in
the kit.

## The golden rule

**An agent can only succeed at tasks a senior engineer could verify in one
sitting.** If you can't check its work quickly, it can't check its own work
either.

## Bad task → Good task

**Bad:** "Add authentication to the app."
**Good:** "Add JWT auth to `src/api/`. Requirements: login endpoint at
`POST /auth/login` returning `{token}`, middleware verifying Bearer tokens on
all routes except `/health`, tests in `tests/auth.test.ts` covering valid,
expired, and missing tokens. Match the error-response shape used in
`src/api/errors.ts`."

The good version has: exact location, exact interface, exact edge cases,
existing conventions to match, and a verification path.

## The decomposition pattern

For anything non-trivial, break work into stages with checkpoints:

1. **Explore** — "Map how X currently works. Report file:line for the key
   functions. Don't change anything." (read-only, builds shared context)
2. **Plan** — "Given this map, propose the minimal change set. List files
   to touch and why." (still no code — catches bad plans cheap)
3. **Implement** — one focused change per task. Never "do the whole feature."
4. **Verify** — separate task: "Run tests, check the diff, report honestly."

Each stage is verifiable before the next begins. A bad plan costs minutes,
not a rewritten feature.

## Constraint checklist (put in every non-trivial task)

- **Scope:** which files/dirs may be touched. "Only src/api/ and tests/."
- **Conventions:** "Match error handling in src/api/errors.ts."
- **Verification:** the exact command that proves it works.
- **Stop conditions:** "If the existing pattern doesn't fit, stop and ask
  rather than inventing a new one."
- **Definition of done:** restate it. Agents drift; repetition anchors.

## Sizing

- **Too big:** "refactor the auth system" → agent loses the plot, touches
  everything, breaks everything.
- **Right:** "extract token validation from auth.ts into verify.ts, update
  the two callers, keep the public API identical."
- **Too small:** "add a comment" → fine, but don't pay orchestration overhead
  for trivial edits; just do them yourself.

Heuristic: if the task needs more than ~5 files changed or has more than
one reasonable approach, decompose further.

## Parallel vs. sequential

- **Parallel-safe:** independent modules, separate test files, docs.
- **Must be sequential:** anything sharing a file, a schema, or a public API.
  Two agents editing the same file = merge conflict at best, silent
  overwrites at worst.

## The transcript test

Before sending a task, read it as if you're the agent with zero context:
- Do I know where to look?
- Do I know what "done" means?
- Do I know what I may NOT touch?
- Could I verify my own work?

If any answer is no, the task isn't ready.

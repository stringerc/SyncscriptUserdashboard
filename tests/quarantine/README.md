# Quarantined contract tests

These test files assert the **production Vercel deployment layout** —
`api/` serverless routes, `api/_lib/*`, `deploy/nexus-agent-runner/`,
`.github/workflows/agent-runner-image.yml`, `vercel.json`, Supabase edge
functions, and spec docs (`SYNCSCRIPT_AGENT_MAP.md`,
`integrations/ENGRAM_EDGE.md`, `integrations/research/nexus-concierge-playbooks.md`).

None of those paths exist in this repository. The same functionality
was ported into the Vite dev-server middleware (`vite.config.ts` +
`src/server/`), so the *behavior* is covered elsewhere — but these
file-content contract tests cannot pass without fabricating the old
tree, which would be dishonest.

They are kept here (not deleted) so they can be revived if the
production `api/` layout is ever restored or ported back.

To re-enable: move the file back to `tests/` and restore the
corresponding `api/` sources it asserts.

Files quarantined 2026-11-21 during the post-Phase-5 stress test
(26 failing assertions, all ENOENT on absent deployment paths).

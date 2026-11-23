# Active task — observability + voice naturalness pass (2026-11-23)
STATUS: DONE — four gap fixes shipped pending commit:
1. TTS technical-token lexicon (src/utils/tts-lexicon.ts) wired into both sanitizeForTTS (voice) and sanitizeForNexusTTS (landing): dotenvx→"dotenv x", vite.config.ts→"vite dot config dot ts", snake_case/env vars→spaced, paths→"slash", acronyms spelled, IPv4/versions/ports spoken. Verified via tsx.
2. WORKSPACE_NOTE now names sibling roots (cortex-repos + LAUNCH_PLAN.md, openclaw-node, ~/.openclaw) in both agentic + inbound paths — prevents filesystem-hunt deadline deaths.
3. Model health persistence: sentinel writes .cortex-runtime/model-health-history.jsonl on failures + status transitions; probe contract returns {latencyMs,keyIndex}; 401/402/403 → permanent cooldown; tailModelHealthHistory() exported. Verified live: 66 records, NIM keyIndex:1, deepseek/openrouter 402s marked permanent.
4. Tenant #1 key moved /tmp/tenant1.key → .cortex-runtime/tenant1.key (0600, gitignored).

updated: 2026-11-23T18:55:00Z
cwd: /Users/Apple/syncscript

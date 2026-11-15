# Cortex on Oracle Cloud — always-on deployment

Cortex runs 24/7 on the Always Free Ampere VM (`syncscript-a1-retry-2`,
157.151.235.143, 4 OCPU / 24 GB) so the mind stays alive when the Mac is
closed. The Mac becomes an optional voice/window client.

## Architecture

```
Mac browser ──HTTPS──> Cloudflare quick tunnel (*.trycloudflare.com)
                            │
                     cloudflared (:443 edge)
                            │ http://127.0.0.1:5173
                     cortex-app.service (vite dev, loopback only)
                            │ /api/cortex/stt ──> whisper-server :8178
                            │ /api/ai/*      ──> NIM → Groq → … (env keys)
                            │ /api/ai/tts    ──> KOKORO_TTS_URL :8880 (docker)
                            │ /api/cortex/ambient/pending ──> .cache/cortex-ambient.jsonl
```

| Piece | Location | Notes |
|---|---|---|
| App code | `/opt/cortex-app` | rsync of `package.json`, `vite.config.ts`, `index.html`, `tsconfig.json`, `tailwind.config.ts`, `.npmrc`, `.env`, `src/`, `public/` |
| Runtime env | `/opt/cortex-app/.env.cortex` | `CORTEX_EDGE_TOKEN` (systemd EnvironmentFile) |
| Provider keys | `/opt/cortex-app/.env` | same file the Mac dev server uses |
| STT | `~/whisper.cpp` + `~/.cortex/models/ggml-base.en.bin` | whisper.cpp built from source (aarch64, CPU) |
| Tunnel state | `~/cortex-oracle/tunnel-url` | written by watchdog every 60s |
| Bark push | docker `bark-server` on 127.0.0.1:8081 + `bark-tunnel` | iOS notifications that reach the phone with no client connected; URL at `~/cortex-oracle/bark-url` |

## Services (systemd, all `Restart=always`)

- `cortex-app.service` — `npm run dev` → vite on 127.0.0.1:5173
- `whisper-server.service` — whisper.cpp on 127.0.0.1:8178
- `cortex-tunnel.service` — cloudflared quick tunnel → 127.0.0.1:5173
- `bark-tunnel.service` — cloudflared quick tunnel → 127.0.0.1:8081 (Bark)
- `bark-server` (docker) — self-hosted iOS push, ~20 MB RAM
- `cortex-tunnel-watchdog.timer` — publishes both tunnel URLs every 60s

## Ops

```bash
ssh oracle "sudo systemctl status cortex-app whisper-server cortex-tunnel"
ssh oracle "sudo journalctl -u cortex-app -n 50 --no-pager"
ssh oracle "cat ~/cortex-oracle/tunnel-url"          # current public URL
ssh oracle "tail -f ~/cortex-oracle/tunnel.log"      # tunnel logs
```

## Auth

`CORTEX_EDGE_TOKEN` gates EVERYTHING when set: first visit to
`https://<tunnel>/?key=<token>` sets an HttpOnly cookie and redirects to a
clean URL. API calls without the cookie get 401. The token lives in
`/opt/cortex-app/.env.cortex` on the VM and `~/.cortex/edge-token` on the
Mac (chmod 600) — never commit it.

## Ambient proactive queue + phone reach (Phase 2)

`vite.config.ts` runs a 10-minute server-side tick: host vitals + service
probes (whisper, Kokoro) + disk trend + one LLM observation → notices
appended to `.cache/cortex-ambient.jsonl`. Clients poll
`GET /api/cortex/ambient/pending` (leader-elected, 60s) and speak through
the shared voice policy.

Daily jobs (timezone `CORTEX_TZ`, default America/Los_Angeles; hours
overridable via `CORTEX_CONSOLIDATE_HOUR`/`CORTEX_BRIEF_HOUR`/
`CORTEX_SELFTEST_HOUR`):
- **03:00** memory consolidation — last 200 chat messages → LLM daily note
  → `~/.cortex/vault/01 - Daily Notes/YYYY-MM-DD.md`
- **04:00** self-test — `npm run guard:cortex-typecheck`
  (`CORTEX_OVERNIGHT_FULL_TEST=1` also runs `verify:cortex`, which needs
  :18880 free — conflicts with Hermes on this VM)
- **07:00** morning brief — LLM spoken-style summary → ambient queue

**Phone reach (Bark):** `kind:'system'` notices and the brief/consolidation
notices also POST to the self-hosted Bark server. Set `CORTEX_BARK_KEY` in
`.env.cortex` after registering the iPhone Bark app against the bark tunnel
URL (`cat ~/cortex-oracle/bark-url`). Manual test:
`POST /api/cortex/ping {"text":"...","call":true}` (call=1 rings 30s).

**PSTN voice calls (Telnyx):** `cortex-voice-bridge.mjs` runs the full
duplex call loop server-side — Telnyx Call Control → WebSocket PCM →
Silero-style RMS VAD → whisper.cpp → Groq LLM → Kokoro TTS → back to the
caller, with barge-in. Mac stays asleep.

- `cortex-voice-bridge.service` — bridge on 127.0.0.1:8790 + WS media
- `voice-tunnel.service` — cloudflared → bridge `/media` endpoint
- API: `POST /dial {"to":"4046980574","greeting":"..."}` · `GET /health`
  · `GET /calls` · `POST /hangup`
- DID: **+1 831 204 4972** · Call Control app `cortex-voice`
- **Cost (metered, disclosed):** ~$0.005/min carrier + ~$1/mo DID —
  PSTN is the only paid dependency. STT/TTS/LLM are free-tier or
  self-hosted. `/health` reports `metered.calls_today`; `/dial` returns a
  `cost_note`. Set `VOICE_MAX_CALL_MS`/daily guards before autonomous use.
- Consent: outbound calls to third parties should announce Cortex identity;
  recording policy is jurisdiction-sensitive — document before scaling.

## Mac client (Phase 3)

- `scripts/cortex-oracle-redirect.mjs` — stable `http://127.0.0.1:8799`
  that 302s to the current tunnel URL (launchd: `com.syncscript.cortex-redirect`).
- `scripts/cortex-oracle-kiosk.sh` — opens the face page in app-mode Chrome.
- `scripts/cortex-oracle-install.sh` — installs launchd agents + token file.

## Known limits

- **Quick tunnel URL is ephemeral** — changes when cloudflared restarts.
  The watchdog republishes within 60s and the redirect re-resolves per
  request, but an open page must reload after a tunnel rotation.
  Upgrade path: named tunnel `cortex.syncscript.app` (needs one-time
  `cloudflared tunnel login` on the VM — see MEMORY.md § Oracle).
- **Tools execute on the VM**, not the Mac — `run_command`/`read_file` act
  on the Oracle host while Cortex is remote.
- **localStorage stays client-side** — voice policy, wake word, leader
  election live in the browser. Server-side memory persistence is future
  work; chat history already has `/api/cortex/chat-history`.
- **No audio on the VM** — Cortex thinks/speaks only when a client (Mac
  face page, phone, kiosk) is connected and unlocked.

## Free phone calls — FaceTime Audio bridge

Cortex can place real phone calls for $0 via the always-on Mac:

- `POST /api/cortex/call {"number":"...","channel":"facetime|imessage|bark","reason":"..."}`
  queues a call request (`.cache/cortex-call-queue.jsonl`). Auth: edge
  cookie or `x-cortex-key` header.
- `GET /api/cortex/call-pending?since=<ms>` drains the queue for pollers.
- Mac: `scripts/cortex-call-bridge.mjs` under launchd
  (`com.syncscript.cortex-call-bridge`) polls every 5s and runs
  `open facetime-audio://<number>` (FaceTime Audio — rings the iPhone
  natively, free, unlimited) or osascript iMessage.
- `channel:"bark"` is handled server-side via the Bark tunnel — the only
  channel that reaches the iPhone when the Mac is closed/asleep.
- facetime/imessage require the Mac awake; FaceTime Audio requires the
  destination to be on the user's Apple ID / have FaceTime enabled.

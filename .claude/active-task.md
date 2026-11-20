# Active task — splat visualizer + voice arbitration (2026-11-20)

STATUS: GPU splat visualizer shipped + verified; cross-tab TTS mutex shipped (11ea1a3).

DONE + VERIFIED:
- ?splat=1: 140k GPU ping-pong physics splats (core+ring), 35k CPU boids swarm,
  custom temporal-feedback motion trails, voice-reactive envelope
  (speak/listen/think), solar gusts, zoom-inside, counter-spinning ring.
  Commits through 1ac5a86. Headless probes: init clean, ~36-42fps under load.
- Duplicate-voice fix: src/lib/cortex-tts-arbiter.ts — localStorage speech
  lock (8s stale, heartbeat, verify-after-write). Wired into
  speakStreamSentence in useVoiceStream (covers visualizer + /cortex/chat +
  proactive). Verified via node VM two-tab simulation 10/10; eslint clean;
  zero new tsc errors (repo has ~2400 pre-existing).

ALSO SHIPPED:
- Voice root-cause chain (971d93e, 45e16e8, d82ed69, d57f110, d70d629):
  per-instance speech arbiter + auto-heartbeat, turn-level dedupe
  (cortex-turn-arbiter), all bypass paths gated (drawer read-aloud,
  mobile companion, MissionRail briefing, Nexus call lock). PCM
  microchunk scheduling fixed (was 27% fast + 72ms overlap per chunk =
  "shaken sentence"); TTS warmup + 1.0s head prebuffer. Verified live:
  26 sources, advance/duration 1.0000, zero overlap.
- Visualizer perf prune (aa22d03): quality buttons removed, auto
  governor kept, phi-driven postfx capped at 1.2.
- Day/night toggle (d8f9041, corrected c95a413): nav button replaced
  CORE V1/V2 switcher. Night = BrightnessContrast(-0.30) pre-bloom
  crush + threshold 0.25 + agent orb glow x1.45 — verified via
  pixel-grid probe (night field ~0-11 lum, core cells 29-44).
  NOTE: gl.toneMappingExposure is bypassed by EffectComposer —
  darkness must live in composer effects.

- Cross-tab chat sync (2fc07b6): cortex-chat-store envelope {v,epoch,msgs}
  + storage-event union-merge by id; epoch bump = authoritative replace
  for clears. CortexDemo subscribes + merges with echo guard. Verified
  two-tab Playwright probe: turn on tab A rendered live in tab B drawer.

ALSO SHIPPED:
- Voice arbitration v2 (971d93e): full voice-branch audit — 6
  useVoiceStream instances + proactive + drawer read-aloud + mobile
  companion mapped. Arbiter is now per-instance factory with steal()
  barge-in and heartbeat 'stolen' yield. speak() gated too (was bypass).
  bargeSpeech() at all 4 user-turn entries. Verified 13/13 arbiter sim.

ALSO SHIPPED:
- Turn-level dedupe + full voice-path gating (45e16e8):
  src/lib/cortex-turn-arbiter.ts — localStorage turn board, claimTurn(text)
  gives one surface ownership of a normalized input; duplicates skip
  generation, reply arrives via shared chat store. Wired into all 4 turn
  producers (useVisualizerVoice runTurn, CortexDemo sendMessage,
  CortexFacePage runAgentTurn, VoiceConversationEngine handleUserMessage).
  Verified 7/7 two-context vm sim.
- cortex-tts-arbiter gained speakUtteranceArbitrated + playAudioArbitrated
  (yield/barge priority, heartbeat, stolen yield, guaranteed release).
  Gated: DashboardBriefing, DailyOpsModal, MissionCockpitPage alerts,
  NexusProactiveBriefing, MissionRail morning briefing (Kokoro bm_lewis +
  speechSynthesis fallback), FoundryNav voice-test. Nexus call context
  holds dedicated 'nexus-call' session lock for call duration.
  cortex-native-phone.ts is server-side Node synthesis — out of browser
  mutex scope by design. Full sweep: no ungated speechSynthesis.speak /
  new Audio() remains in src/.

ALSO SHIPPED:
- Voice glitch fix (4a92336): root cause was 35k CPU swarm saturating
  main thread (~15-30ms/frame: boids + Math.sin + texture writeback)
  starving Web Audio TTS queue. Fixes: 30Hz physics substep (~1.9ms/frame
  amortized), sine LUT, allocation-free top-K neighbor build (13.1s->1.4s).
  Merged 3 duplicated briefing speak blocks into useBriefingSpeech hook.
  Benchmarked in node: build 1.4s, step 3.7ms@30Hz.

ALSO SHIPPED:
- "Shaken sentence" fix (d82ed69): root cause = speech lock freshness
  depended on playback paths heartbeating; speak()/gapless tails/browser
  fallback ran >8s silent -> stale takeover -> two voices interleaved.
  Arbiter now auto-heartbeats every 2s while held (freshness automatic
  for ALL paths). Added stolen-watch to speak(), heartbeat poll to
  speakBrowserFallback, per-8-chunk check in schedulePcmQueue for
  barge-in yield. Verified live: auto-beat refresh, mutual exclusion,
  stale takeover, stolen detection all pass.

ALSO SHIPPED:
- "Shaken sentence" ROOT fix (d57f110): the real cause was NOT voice
  overlap — streaming PCM path (f47b048) applied the 72ms sentence-blob
  tail trim to ~340ms micro-chunks. Each chunk advanced the gapless
  timeline by duration-0.072 → speech ran ~27% fast AND every boundary
  overlapped 72ms of dual audio ~3.7x/sec = warbly/shaken speech on
  every cortana utterance. Fix: PCM chunks schedule exactly back-to-back
  (when + duration); added ~0.7s stream-head prebuffer (pocket-tts
  delivers PCM in bursts — first-chunk start guaranteed underrun).
  Verified live in Chrome: 26 chunks, advance/duration ≈1.0, zero
  overlaps. Audited all other trim sites — NexusVoiceCallContext +
  landing playback + scheduleStreamBlob use multi-second segments where
  72ms trim is correct. Residual: rare mid-stream gap if pocket-tts
  generation dips below realtime (server-side, not client-fixable).

ALSO SHIPPED:
- Cold-start + buffer hardening (d70d629): warmTtsEngine() fires one tiny
  "Ready." synthesis on first voice-hook mount (module-guarded) — cold
  pocket-tts measured ~15-21s vs ~1s warm, which was the page-load
  one-off glitch. Head prebuffer 0.7s->1.0s PCM for early-hole cover.
  Verified: warmup req fires on mount, advance/duration=1.0000, 0 overlap.

ALSO SHIPPED:
- Weather artifact v2 (uncommitted->this commit): NWS get_weather now
  emits weather scene + stat + hourly chart + forecast table + lat/lon.
  WeatherBody rebuilt: tsParticles v4 canvas sky (rain/snow/storm/fog/
  stars/motes via loadFull singleton — Engine ctor does NOT exist in v4),
  hand-animated SVG icon, uPlot hourly temp+precip strip (lazy-loaded),
  WxRadar = RainViewer tile mosaic (z7, 3x2 tiles, ~2h frame stepper,
  location marker, LIVE badge; silent-fail when no lat/lon or fetch dies).
  Verified: Playwright probe — scene/particles/icon/uPlot all mount,
  radar canvas 768x512 with real echo coverage (0.7% lit px over Gulf
  storm test), zero pageerrors. tsc: only pre-existing 897 format error.
  eslint: 0 errors (2 pre-existing unused-import warnings). Deps:
  @tsparticles/engine + tsparticles + uplot added; @tsparticles/slim
  removed (unused). NOTE: src/server/ is gitignored — cortex-tools.ts
  weather changes live on disk only, not in git.

UNVERIFIED / OPEN:
- Real-browser two-tab typed turn (unit-level arbiter sim only).
- Morning briefing auto-play: handleTogglePlayBrief is manual; if an
  auto-speak path exists elsewhere it still needs audit.
- Residual PCM starvation gaps during pocket-tts generation holes —
  monitor user reports; bump prebuffer or add adaptive buffering if seen.

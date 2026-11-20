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

UNVERIFIED / OPEN:
- Real-browser two-tab typed-chat repro of the mutex (unit-level only).
- OLED tuning: center luminance ~230 may read as blob; bloom/exposure knobs
  in CortexSplatScene if user reports washout.
- Vitest harness could not simulate two tabs (module re-import artifact);
  arbiter covered by node VM test instead — no vitest file committed.
- Typecheck: full `npx tsc --noEmit` not clean repo-wide (pre-existing);
  scoped check shows no new errors from these changes.

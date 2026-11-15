# The Voice Agent Latency Budget

Read this before writing code. Most "laggy" voice agents aren't slow models —
they're slow *pipelines*. Perceived latency is the sum of every stage between
"user stops talking" and "agent starts speaking."

## The 800ms ceiling

Humans perceive a response as instant under ~300ms, natural under ~800ms,
awkward beyond ~1200ms. Budget accordingly:

| Stage | Budget | How to hit it |
|---|---|---|
| STT endpointing (detecting user finished) | 200–400ms | Streaming STT with aggressive endpointing; don't wait for punctuation |
| LLM time-to-first-token | 200–500ms | Streaming LLM, low-latency model tier for voice, short system prompts |
| First sentence → TTS start | <50ms | Sentence-level TTS chunking; never wait for full response |
| TTS time-to-first-audio | 100–300ms | Streaming TTS provider; pre-warm connections |
| Network round-trips | included | Colocated regions; persistent WebSocket connections, not per-request HTTP |

**Total target: <800ms from end-of-speech to first audio out.**

## The three sins that blow the budget

### 1. Waiting for the full utterance

Batch STT (record → send → transcribe) adds 1–3s alone. Use streaming STT
that emits partial transcripts live; endpoint on silence, not on a fixed
duration.

### 2. Waiting for the full LLM response

A 300-token response at 50 tok/s = 6 seconds before TTS even starts. Stream
the LLM and start TTS on the first complete sentence — typically under 500ms.

### 3. Non-streaming TTS

Synthesize-then-play means the user waits for the entire reply's audio.
Streaming TTS emits audio frames as they're generated.

## Turn-taking: the part everyone gets wrong

Latency isn't just speed — it's *responsiveness*. Users interrupt. Your
agent must:

- **Detect barge-in in <200ms** of user speech while it's talking
- **Stop speaking immediately** — kill TTS playback, don't finish the sentence
- **Discard the interrupted response** — don't append half-sentences to history
- **Treat the interruption as a new turn**, incorporating what the user said

The included `voice_agent.py` implements this pattern. The barge-in detector
needs sustained energy (3+ frames) to avoid coughs and background noise
triggering false interruptions — tune `BARGE_IN_RMS_THRESHOLD` for your mic.

## Measuring it

Add timing to every stage (the `Turn.timings` dict in the reference does
this). Log `stt_ms`, `llm_ttft_ms`, `tts_ttfb_ms`, `total_ms` per turn.
When users say "it feels laggy," you want numbers, not guesses.

## Provider notes

- **STT:** Deepgram and AssemblyAI have the lowest endpointing latency.
  Whisper API is accurate but batch-oriented — adds 1s+.
- **LLM:** Use the fastest tier that answers adequately. Voice ≠ deep
  reasoning; a 70B model's extra quality isn't worth +2s.
- **TTS:** ElevenLabs and Cartesia stream well. OpenAI TTS is convenient but
  slower to first byte. Pre-synthesize common phrases (greetings, hold
  messages) to skip TTS entirely.

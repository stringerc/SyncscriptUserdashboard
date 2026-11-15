# Voices & Models Reference

Quick-selection guide. Prices/latency change — verify current provider docs.

## STT (Speech-to-Text)

| Provider | Streaming | Endpointing | Notes |
|---|---|---|---|
| Deepgram Nova | Yes, WS | Best-in-class | Lowest latency; good accuracy |
| AssemblyAI | Yes, WS | Good | Strong on noisy audio |
| Whisper (API/local) | Batch mostly | Poor | Best accuracy, wrong tool for live |
| Google STT | Yes | Good | Cheap, decent latency |

**Pick:** Deepgram for lowest latency, AssemblyAI for noisy environments.

## LLM

Voice agents want: fast TTFT, concise output, instruction-following.

| Tier | Use for | Trade-off |
|---|---|---|
| Fast/small (Haiku, GPT-4o-mini, Gemini Flash) | Most voice turns | Occasionally shallower answers |
| Mid (Sonnet, GPT-4o) | Complex queries | +200-500ms TTFT |
| Large/deep reasoning | Rare escalation | Too slow for conversation |

**Pattern that works:** fast model for the conversation, escalate to a
bigger model only when the query needs it (and tell the user "let me
check on that" while it thinks — buying thinking time with speech).

## TTS (Text-to-Speech)

| Provider | Streaming | Voice quality | Notes |
|---|---|---|---|
| ElevenLabs | Yes | Highest | Best expressiveness; costs more |
| Cartesia | Yes | Very good | Fastest TTFB; sonic models |
| PlayHT | Yes | Good | Mid-tier option |
| OpenAI TTS | Yes | Good | Convenient if already on OpenAI |
| Piper (local) | Yes | Robotic | Free, offline, sounds like 2010 |

**Pick:** ElevenLabs for quality-critical (companions, premium support),
Cartesia for latency-critical (receptionists, high-volume).

## Voice selection tips

- **Match the brand:** a bank shouldn't have a playful voice. B2B →
  neutral professional; consumer → warmer.
- **Test at real latency:** a beautiful voice with 2s TTFB is worse than
  a plain voice at 200ms.
- **Pre-synthesize:** greetings, hold messages, common closings — cache
  the audio, skip TTS entirely for the highest-frequency phrases.
- **SSML/prosody:** most providers support pace/pitch/emphasis controls.
  Flat monotone is the #1 "sounds like a robot" tell — use them.

## The honest summary

There is no single best stack — there's a best *budget allocation*. Spend
the most on whichever stage your users notice first: STT accuracy if they
repeat themselves, LLM if answers feel dumb, TTS if it sounds robotic.
Measure per-stage latency, fix the worst offender, iterate.

# Production Pitfalls: The 5 Failure Modes That Kill Voice Agents

Ordered by how often they actually kill deployments.

## 1. The agent talks over the user (no real barge-in)

**Symptom:** user interrupts, agent keeps talking for 2 more seconds.
Feels broken instantly — worse than slow.

**Cause:** TTS playback isn't wired to a cancel signal. The LLM stops
generating but the audio buffer keeps playing.

**Fix:** barge-in must cancel at THREE levels: stop audio playback, cancel
LLM generation, reset STT. The reference pipeline's `cancel` event does
this. Test by literally talking over the agent — if it doesn't stop within
200ms, it's not done.

## 2. Background noise triggers phantom turns

**Symptom:** agent responds to TV, keyboard clicks, or the user's own
echo.

**Cause:** VAD/endpointing threshold too sensitive, or no echo cancellation.

**Fix:**
- Require sustained speech (3+ consecutive loud frames) before endpointing
- Use the audio layer's echo cancellation if available (most telephony
  stacks have it; raw mic input doesn't)
- Add a noise gate before STT — don't send silence/noise to the provider
- Consider a dedicated VAD model (Silero VAD is fast and free)

## 3. The agent "hears" itself (echo loop)

**Symptom:** agent responds to its own TTS output through the mic.

**Cause:** speaker output leaks into mic input; STT transcribes the agent.

**Fix:** hardware/platform echo cancellation FIRST (browser getUserMedia
has it, telephony has it). Software fallback: pause STT while TTS plays
(except for barge-in detection on a separate channel), or use
acoustic echo cancellation libs.

## 4. Context dies between turns

**Symptom:** agent forgets what was said 3 turns ago; answers feel
amnesiac.

**Cause:** history not maintained, or maintained wrong — full TTS text
appended including filler, interrupted turns left half-recorded.

**Fix:**
- Maintain a rolling history of user/assistant turns
- On barge-in, discard the partial assistant turn entirely — don't record
  half a sentence the user never heard as "what the agent said"
- Keep a summary for long calls; raw history blows the context window

## 5; Timeout cascades (one stuck stage freezes the call)

**Symptom:** agent goes silent mid-conversation and never recovers.

**Cause:** no per-stage timeouts. A hung STT connection or slow LLM stream
deadlocks the pipeline.

**Fix:** every stage gets `STAGE_TIMEOUT_S`. On timeout: apologize briefly
("sorry, I lost you"), reset the turn, continue. A voice agent that
gracefully degrades beats one that freezes. Also: reconnect logic for
WebSocket drops — streaming connections die; that's normal, not exceptional.

## Deployment checklist

- [ ] Barge-in tested by a human talking over the agent
- [ ] Noise test: TV/keyboard nearby, no phantom turns
- [ ] Echo test: agent doesn't respond to itself
- [ ] 10-turn conversation: context retained
- [ ] Kill network mid-call: agent recovers, doesn't freeze
- [ ] Latency logged per stage; p95 under budget

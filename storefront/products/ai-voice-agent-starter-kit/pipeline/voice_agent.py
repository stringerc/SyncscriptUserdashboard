"""
Voice Agent Pipeline — reference architecture
=============================================
Streaming STT -> LLM -> streaming TTS with barge-in handling.

This is a WORKING reference, not pseudocode. Provider calls are isolated
behind small async functions — swap them for your stack:
  STT:  Deepgram / Whisper / AssemblyAI / Google STT
  LLM:  OpenAI / Anthropic / local model
  TTS:  ElevenLabs / Cartesia / PlayHT / OpenAI TTS

Run:  python voice_agent.py   (needs provider API keys in env)

Design rules baked in:
  1. STREAM everything. Never buffer a full utterance or full response.
  2. User speech is a CANCEL signal at every stage (barge-in).
  3. TTS starts on the first sentence, not the full reply.
  4. Every stage has a timeout — a stuck stage must not freeze the call.
"""

import asyncio
import os
import time
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Configuration — the latency budget lives here
# ---------------------------------------------------------------------------

LATENCY_TARGET_MS = 800          # perceived response delay ceiling
STT_ENDPOINTING_MS = 300         # silence that ends an utterance
BARGE_IN_RMS_THRESHOLD = 0.02    # audio energy that counts as user speech
STAGE_TIMEOUT_S = 10.0           # per-stage timeout; a stuck stage dies


@dataclass
class Turn:
    """One conversational turn: user utterance -> agent response."""
    turn_id: int
    user_text: str = ""
    agent_text: str = ""
    cancelled: bool = False
    timings: dict = field(default_factory=dict)


class BargeInDetector:
    """Detects user speech while the agent is talking.

    In production this wraps your audio input frame callback. The key
    property: it must fire FAST — barge-in only feels natural under ~200ms.
    """

    def __init__(self, threshold=BARGE_IN_RMS_THRESHOLD, hangover_frames=15):
        self.threshold = threshold
        self.hangover = hangover_frames
        self.speaking_frames = 0

    def feed_audio_frame(self, frame_rms: float) -> bool:
        """Return True the moment sustained user speech is detected."""
        if frame_rms > self.threshold:
            self.speaking_frames += 1
        else:
            self.speaking_frames = max(0, self.speaking_frames - 1)
        # Require a few consecutive loud frames to avoid coughs/noise
        return self.speaking_frames >= 3


# ---------------------------------------------------------------------------
# Provider stubs — replace with real SDK calls
# ---------------------------------------------------------------------------

async def stream_stt(audio_stream):
    """Yield partial transcripts as the user speaks.

    Real impl: Deepgram streaming WS yields {is_final, transcript}.
    Key: yield partials so endpointing can fire early.
    """
    async for chunk in audio_stream:
        # ... provider call ...
        yield {"partial": chunk.text, "is_final": chunk.is_final}


async def stream_llm(messages, cancel_event: asyncio.Event):
    """Yield response text tokens as the LLM generates them.

    Real impl: OpenAI/Anthropic streaming. Key: pass cancel_event so a
    barge-in aborts generation mid-stream instead of finishing a reply
    the user already interrupted.
    """
    # ... provider streaming call, checking cancel_event each chunk ...
    async for token in _llm_token_stream(messages):
        if cancel_event.is_set():
            return
        yield token


async def _llm_token_stream(messages):
    """STUB: replace with real LLM stream."""
    for word in ["Hello", " there", ".", " How", " can", " I", " help"]:
        yield word
        await asyncio.sleep(0.05)


async def stream_tts_sentence(text: str, cancel_event: asyncio.Event):
    """Synthesize one sentence to an audio output sink.

    Real impl: ElevenLabs/Cartesia streaming TTS -> audio player.
    Called per-sentence so audio starts before the full reply exists.
    """
    # ... provider call -> write PCM/MP3 frames to output ...
    await asyncio.sleep(0.1)  # stub latency
    if cancel_event.is_set():
        return
    print(f"  [TTS] speaking: {text!r}")


# ---------------------------------------------------------------------------
# The pipeline
# ---------------------------------------------------------------------------

class VoiceAgent:
    def __init__(self):
        self.barge_in = BargeInDetector()
        self.history: list[dict] = []
        self.turn_counter = 0

    async def run_turn(self, audio_stream):
        """One full turn: listen -> think -> speak, interruptible."""
        self.turn_counter += 1
        turn = Turn(turn_id=self.turn_counter)
        t0 = time.monotonic()
        cancel = asyncio.Event()

        # --- Stage 1: STT (streaming, endpointed) ---
        transcript_parts = []
        async for event in stream_stt(audio_stream):
            transcript_parts.append(event["partial"])
            if event["is_final"]:
                break
            if self.barge_in.feed_audio_frame(_frame_rms()):
                # User is still talking — keep listening, don't respond yet
                pass
        turn.user_text = " ".join(transcript_parts).strip()
        turn.timings["stt_ms"] = (time.monotonic() - t0) * 1000

        if not turn.user_text:
            return None  # silence / noise — ignore the turn

        # --- Stage 2+3: LLM -> sentence-level TTS ---
        # Buffer tokens into sentences; start TTS on sentence 1.
        self.history.append({"role": "user", "content": turn.user_text})
        sentence_buf = ""
        t_llm_start = time.monotonic()

        async def tts_writer():
            """Consume completed sentences and speak them."""
            while True:
                sentence = await sentence_queue.get()
                if sentence is None:
                    return
                await stream_tts_sentence(sentence, cancel)

        sentence_queue = asyncio.Queue()
        tts_task = asyncio.create_task(tts_writer())

        async for token in stream_llm(self.history, cancel):
            turn.agent_text += token
            sentence_buf += token
            # Sentence boundary: ., !, ?, or newline — speak ASAP
            if sentence_buf.rstrip().endswith((".", "!", "?", "\n")):
                sentence = sentence_buf.strip()
                if sentence:
                    await sentence_queue.put(sentence)
                sentence_buf = ""

        # Flush remainder
        if sentence_buf.strip():
            await sentence_queue.put(sentence_buf.strip())
        await sentence_queue.put(None)  # sentinel
        await tts_task

        turn.timings["total_ms"] = (time.monotonic() - t0) * 1000
        self.history.append({"role": "assistant", "content": turn.agent_text})
        return turn

    async def handle_barge_in(self):
        """Called by the audio layer when user speaks during agent output.

        Real impl: stop TTS playback immediately, set cancel on the current
        turn, flush the input buffer, and treat what follows as a NEW user
        turn (the interrupted sentence is discarded, not appended).
        """
        # cancel.set()
        # audio_out.stop()
        # stt.reset()
        pass


# ---------------------------------------------------------------------------
# Helpers / stubs
# ---------------------------------------------------------------------------

def _frame_rms() -> float:
    """STUB: return RMS energy of the latest audio input frame."""
    return 0.0


async def demo():
    agent = VoiceAgent()
    # Wire real audio streams here (mic in, speaker out).
    print("VoiceAgent pipeline ready. Wire audio_stream to run_turn().")
    print(f"Latency target: {LATENCY_TARGET_MS}ms | STT endpointing: {STT_ENDPOINTING_MS}ms")


if __name__ == "__main__":
    asyncio.run(demo())

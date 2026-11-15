# AI Voice Agent Starter Kit

Chatbots are easy. Voice agents that don't sound like robots are not. This
is the production pipeline — streaming STT, interruption handling, natural
TTS, and the latency budget that makes it feel alive.

## What's inside

```
ai-voice-agent-starter-kit/
├── README.md                     ← you are here
├── pipeline/
│   └── voice_agent.py            ← complete async pipeline:
│                                  streaming STT → LLM → streaming TTS,
│                                  with barge-in/interruption handling
├── guides/
│   ├── latency-budget.md         ← where the 800ms goes and how to win it
│   └── production-pitfalls.md    ← the 5 failure modes that kill voice agents
└── config/
    └── voices-and-models.md      ← model/voice selection reference
```

## Quick start

1. Read `guides/latency-budget.md` FIRST — it explains why most voice
   agents feel laggy before you write a line of code.
2. Open `pipeline/voice_agent.py` — it's a working reference architecture
   with real barge-in logic, not pseudocode.
3. Swap the provider stubs (Deepgram/Whisper, OpenAI/Anthropic, ElevenLabs/
   Cartesia/PlayHT) for your stack — the pipeline structure doesn't change.

## The core idea

Voice agents fail on latency and turn-taking, not on LLM quality. The
pipeline is built around two rules: stream everything (never wait for a
full utterance or full response), and treat user speech as a cancel signal
at every stage. `voice_agent.py` implements both.

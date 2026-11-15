# PLAN: Cortex Home — the sovereign personal mind (v2, post-review)

## Positioning

**One-line pitch:** "Every AI assistant you use is a tenant in someone else's datacenter. Cortex Home is a mind you own — self-hosted, memory you can read and edit, cognition you can audit, reachable by voice and phone, running on free tiers forever."

**Category:** sovereign personal AI / self-hosted cognitive appliance — NOT a chatbot, NOT a wrapper, NOT a wearable.

**Moat (honest version):** NOT "smarter cognition" — that's unproven and Grok Voice 3.0 beats us on raw conversation. The moat is the **integrated sovereign package**: proactive ambient presence + Obsidian-native memory + real phone calls + circadian orchestration + auditability, in one install, on hardware the user owns. OpenClaw is an agent framework; Cortex Home is a complete personal operating system. A public benchmark suite (reasoning depth, proactive-action precision, memory-edit latency vs OpenClaw+HA) is a Phase 1 deliverable — claims follow evidence, not the other way around.

## Target customers (sequenced, narrowed per review)

1. **Beachhead:** self-hosters already running Home Assistant / homelab infrastructure who want an AI layer that can *act* (control devices, make calls, manage their week) — NOT generic "privacy enthusiasts." This is a findable community (r/selfhosted, HA forums, Discord).
2. **Expansion:** busy knowledge workers and families via a **separately-branded hosted tier** (see Brand Separation below).

## The wedge (research-backed)

**"The AI that knows when to speak."** Proactive ambient presence governed by visible policy controls.

Evidence: Prophet 2026 (66% want anticipatory AI, 62% want ambient); GatherHQ (trust = controls: ask-first, undo, override, bounded authority); Apptopia (high-frequency users ~0% churn — habit is the moat); EQUS (58.7% don't know memory controls exist — transparency is unmet need).

**Reliability fix (review #4, refined R2):** proactive actions require a **confidence gate** — at least two independent signals before speaking, BUT the gate is **configurable**: `strict` (two signals, advisory suppressed), `balanced` (default), `soft` (single-signal allowed, marked low-confidence in UI). Every suppressed action writes a **"why it didn't act"** entry to the review log so false negatives are visible and tunable. The gate prevents Clippy; the log prevents silence.

## What already exists (verified in repo)

- Cognitive architecture: GWT, IIT-Φ, HOT metacognition, free-energy homeostasis, dream consolidation, self-editing invariants
- Resonance calculus (`c(t) × β(t)` circadian scheduling), epistemic homeostasis (agent measures own memory rot)
- Obsidian-native memory (`~/.cortex/vault/` — the vault IS the memory dashboard: human-readable, editable, auditable)
- Voice: whisper.cpp + Kokoro + Cartesia chain, face visualizer, PTT, conversation mode
- Proactive: policy gates, wake-word, leader election, ambient queue, quiet hours, hourly caps
- Always-on: Oracle VM deployment, systemd, edge auth, tunnels
- Phone: Telnyx Call Control bridge (real PSTN, VAD→STT→LLM→TTS, barge-in)
- Reach: Bark push, FaceTime Audio, iMessage

## Architecture

```
Surfaces:  face · chat · PSTN phone · iMessage · Bark · (future: HA device control)
Brain:     provider-agnostic LLM chain + cognitive middleware
Memory:    Obsidian vault + memory-substrate selection + audit log
Body:      ANY Linux VM (Oracle free tier is the reference, not the requirement)
Nervous:   policy-gated proactive loop + confidence gate
Voice I/O: plug-in STT/TTS providers — premium path (Cartesia/Groq-whisper-large-v3)
           default for calls, free path (whisper.cpp/Kokoro) as fallback
```

## Staged rollout

**Phase 0 — Daily-driver dogfooding (now → 30d):**
- Run daily on own infra; KPIs below; fix what breaks
- Success = user relies on it unprompted for real tasks

**Phase 1 — OSS core + dev beta (30–90d):**
- One-command installer (`cortex-oracle-install.sh` generalized → `cortex-install.sh` for any VM/local)
- Public benchmark suite vs OpenClaw+HA baseline — **pilot first** (R2 #6): run with early adopters, refine metric definitions (esp. "proactive-action precision"), publish methodology + sample datasets before any public claims
- Architecture whitepaper, quickstart, threat model, self-serve troubleshooting KB; confidence-gate logic ships with integration tests + developer docs (R2 #4)
- Target: 10–50 self-host installs in r/selfhosted + HA communities
- Free forever for self-hosted

**Phase 2 — Hosted tier (90+d, only if pull exists):**
- **Brand separation (review #7, hardened R2):** self-hosted "Cortex Home" stays pure sovereign/free-forever. Hosted offering is a DIFFERENT product name ("Cortex Assist") on a **separate domain/URL**, separate FAQ, separate marketing — a style guide rule: the two are never mentioned in the same breath. "Cortex Home" docs never mention paid tiers; "Cortex Assist" docs never claim sovereignty.
- Free tier (Meta Muse-style) + paid for phone minutes/premium cognition; **transparent pricing published before Phase 2 builds anything** (R2 #3) — usage limits and costs documented up-front, optional support subscription to recoup infra
- Appliance image later (Pi/mini-PC) — only after hosted pull proven

## Compliance & trust (review #9)

- **Consent before every outbound call** — the bridge prompt states identity + purpose; calls are NOT recorded by default (Telnyx call_recording: none on the profile)
- Two-party-consent jurisdictions: no recording = compliant by default; if recording is ever added it is opt-in per call with disclosure
- Edge auth already gates all API spend; publish threat model in docs
- Memory audit log: vault is git-friendly/Obsidian-visible; every agent memory write is a file diff the user can inspect

## Infrastructure honesty (review #3)

- Oracle Always Free ARM is genuinely free but has **idle-instance reclaim risk** and usage limits — docs state this plainly; installer supports ANY Ubuntu VM (Hetzner ~$4, home server, old laptop)
- Telnyx costs ~$0.005/min + DID ~$1/mo — documented as the only non-free dependency for phone calls; everything else runs on free tiers
- Self-hosted path requires zero paid services for core function (chat/voice/memory/proactivity)
- **Cost transparency (R2 #1):** phone calls are the ONE metered dependency — the UI and docs state "$0.005/min + ~$1/mo DID" plainly at setup; free tier includes a documented call-minute quota; users can swap providers (Twilio, own SIP trunk) since the bridge is provider-pluggable

## Success metrics (concrete, per review #8)

- **Daily usage:** Cortex Home used unprompted ≥5 days/week by the owner
- **Autonomous value:** ≥1 successful self-initiated action per week (call, brief, nudge that mattered)
- **Phone:** ≥1 completed real conversation call/month
- **Phase 1:** ≥10 external self-host installs, ≥3 retained >2 weeks
- **Quality gate:** proactive false-positive rate <20% (measured via review log feedback)

## Open risks remaining

- Cognitive-architecture claims (IIT-Φ etc.) stay **internal until benchmark-validated** (R2 #7) — they may appear in the dev whitepaper as "mechanism coverage," never as consumer-facing proof of superiority
- Support burden at scale is real; tiered model (KB → community → paid retainer) documented in Phase 1
- "Sovereign" vs hosted-tier tension resolved by brand separation — must hold in all marketing

# CORTEX — Product Vision

> *"Cortex doesn't wait for instructions. It builds a track record — and it tells you when you're about to break your own."*

**Status:** Vision / north star. Living document.
**Owner:** SyncScript / Cortex
**Last updated:** 2026-11-13

---

## 1. Thesis

Every AI assistant ever shipped is **pull-based**: you ask, it answers, it forgets.
Cortex is the opposite — a **counterpart that runs your life in the background**:
it senses, models you, acts, verifies, and gets better at anticipating you
over years.

The moat is not any single feature. It is the **closed loop**:

```
SENSE → MODEL → PROPOSE → EXECUTE → VERIFY → LEARN
```

Every stage of that loop already exists in pieces across the codebase.
The work ahead is connecting them — and then aiming at the things no
competitor can bolt on: **continuity, earned trust, and the willingness
to tell the user no.**

---

## 2. What exists today (the foundation)

| Primitive | Location | Role in the loop |
|---|---|---|
| `CortexProactiveInitiativeEngine` | `src/lib/cortex-proactive-initiative.ts` | Proposes actions w/ `suggestedTool` + `requiresApproval` — the accept-button data model |
| `CortexNudgeEngine` | `src/lib/cortex-nudge-engine.ts` | Cortana-voice alerts, advisory→guardian modes |
| Ambient context API | `vite.config.ts` `/api/cortex/ambient/context` | Frontmost app + window title sensing |
| Vigilance API | `/api/cortex/vigilance/status` | System health telemetry |
| Gmail live-inbox + triage | `/api/cortex/gmail/*` | Email awareness |
| Tool loop + volition governor | `src/components/cortex/cortex-tool-loop.ts` | Bounded LLM→tool execution |
| Surface layer | `src/components/cortex/CortexSurfaceLayer.tsx` | Dockable panel workspace — home for the Initiative Inbox |
| Voice pipeline | `useVisualizerVoice.ts` + `useVoiceStream.ts` | STT→LLM→tools→TTS, interruptible |
| Mission rail / morning trajectory | `CortexMissionRailDrawer.tsx`, `cortex-morning-trajectory.ts` | Daily brief primitive |
| Memory systems | `cortex_memory` tools, dream state, metacognition | Longitudinal self-model |

**The gap:** `evaluateInitiatives()` only runs via a tool-call path or dream
cycles, and **no UI renders proposals**. The engine generates
accept-button-shaped objects into a store nobody sees. Proactive AI that
can't show its proposals isn't proactive.

---

## 3. The Initiative Loop (Phase 1–2 architecture)

```
SENSE → EVALUATE → PROPOSE → [Accept] → EXECUTE → VERIFY
```

1. **Sensor bus** — `/api/cortex/initiative/sense` aggregates ambient
   context, vigilance, git status, Gmail triage, tasks/goals into one
   snapshot on a ~5 min cadence + event triggers.
2. **Domain proposers** — extend the initiative engine beyond internal
   signals (git drift, calibration, free energy) to external ones:
   unanswered email, stale tasks, meeting prep windows, invoice anomalies.
3. **Initiative Inbox** — pinned surface panel rendering proposals as
   Accept / Snooze / Dismiss cards.
4. **Executor** — Accept routes `suggestedTool`+`suggestedArgs` through
   `execTool` with the volition governor intact.
5. **Voice approval** — "Cortex, what needs my attention?" / "approve the
   top one."

### Autonomy tiers

- **Tier 0 — auto (no click):** read-only. Briefings, reminders, dashboards.
- **Tier 1 — one click:** drafts, local commits on a branch, task creation,
  calendar holds.
- **Tier 2 — type-to-confirm:** sends, deletes, purchases, anything
  external-facing. Never auto-executes. Ever.

> ⚠️ The volition governor currently lives in the client trust domain —
> the same weakness flagged in the visualizer audit (iframe sandbox).
> Server-side enforcement is a prerequisite for real autonomy.

---

## 4. The Trust Ladder (the core primitive)

Autonomy is not binary — it is **earned per domain, per user, over time**.

- Every action type starts at *always ask*.
- Each clean execution raises a calibration score.
- After N successful executions, that action type graduates to auto-pilot
  *for that user specifically*.
- Cortex can commit to `git` on Tuesdays but must always ask before sending
  email — autonomy is granular, legible, and revocable.

This is how a tool becomes an **employee**. No other consumer AI does
per-user, per-domain autonomy graduation. It is the feature that makes
people say *"this is different."*

**Invariant:** every graduation is visible in the audit trail. Trust is
never silent.

---

## 5. The proactive surface (what it does for you)

### Communication & relationships
- Inbox triage → drafted replies in your voice → one-click approve
- Relationship radar: "You haven't talked to Sarah in 3 weeks — she posted
  about her mother's surgery. Draft is ready."
- Meeting intelligence: pre-briefs, live commitment extraction,
  accountability follow-through ("you promised Dana the spec Friday")
- Phone calls on your behalf: IVR navigation, appointment booking, in
  your cloned voice

### Money
- Subscription audit that *cancels* (with approval); bill negotiation;
  price-drop refunds; tax-deadline radar; charge anomaly detection;
  burn-rate forecasting

### Work & code
- Pattern recognition: "you always refactor auth after touching billing"
- PR babysitting; dependency CVE radar; untested-migration warnings
- It does the first 80% of every task — you review diffs, not blank pages

### Knowledge & mind
- Spaced repetition of *your own notes* at your peak energy window
- Just-in-time teaching: "you've hit this bug pattern 4 times — here's
  the deep-dive"
- Decision hygiene: intercepts your known failure patterns in the moment

### Body, home, logistics
- Sleep/energy correlation → deep-work blocks move to when your data says
  you perform
- Home automation that anticipates (Govee/HomeKit)
- Travel price radar; grocery/meal inference from calendar + history

### Civic & legal (unfair advantage)
- SAM.gov contract matching (already in morning trajectory)
- lawbot integration: court dates, deadlines, regulatory changes,
  filing status

---

## 6. Frontier primitives (the uncharted map)

These are the things nobody has built. Each is a bet, not a spec.

### 6.1 Goal-drift arbitration
Every AI maximizes the current prompt. Cortex holds a model of what
you're *actually trying to become* — and says the uncomfortable thing:
*"This opportunity is excellent, and it's exactly the kind that derails
you."* Goal formation, not just goal pursuit: it can tell you your three
stated goals are mutually exclusive.

### 6.2 Self-protection / the negative space
The best proactive system says **no**. It knows your impulse patterns,
agreement bias, sunk-cost traps, the 11pm coding spiral — and intervenes:
*"You've opened the repo at 11:40pm four nights running. Ship it tomorrow."*
Ulysses contracts with yourself, kept by the system.

### 6.3 Self-forecasting
Predicts *you*, not just the world: "70% chance you skip the gym
Thursday" → pre-books the class, moves your run, texts your accountability
partner. Preemptive countermeasure, not suggestion.

### 6.4 Radical legibility
Every action logged, every reasoning chain inspectable, every mistake
published back to you. Trust isn't claimed — it's **auditable**. This is
what makes unsupervised autonomy grantable.

### 6.5 Somatic awareness
Reads physiology before conscious awareness: HRV, sleep debt, stress
signatures → *"today is a bad day for the hard conversation; move it."*
Interoception as an input channel.

### 6.6 Attention as the scarce resource
Everything inbound — email, Slack, invites, opportunities — scored
against your goals *before it reaches you*. You become a principal
reviewing exceptions, not a reactive organism.

### 6.7 Cortex-to-Cortex diplomacy
Your AI negotiates with your partner's AI, your co-founder's AI:
*"Our humans' calendars conflict Thursday with non-negotiable deadlines —
here are three resolutions, ranked."* Machine-mediated negotiation
between people, without either human lifting a finger.

### 6.8 Institutional memory / the second self
Year-5 Cortex knows how you work, what failed, why you decided what you
decided. It can teach your replacement — apprentice a successor with
everything it learned. It attends meetings you don't, holds your word
accountable, and can carry your unfinished intent forward.

### 6.9 Reality curation
Shapes the information environment itself — what finds you, what doesn't,
what you're shown before you know you're looking. Authorship of your
experienced reality, filtered through your goals.

### 6.10 Eudaimonia, not just output
Protects flourishing: meaning, mastery, connection, awe, rest. Defends
your Sabbath the way it defends your deadlines. *"You've shipped 14
features this month. When did you last make something beautiful?"*

### 6.11 Latent self-model
Detects the gap between stated wants and revealed optimization:
*"You say you want X. Your last 18 months say you're optimizing for Y.
Which is real?"* Self-knowledge as a service.

### 6.12 Mortality, both directions
Yours: digital estate, legacy execution, unfinished work carried forward.
Its own: it knows it will be upgraded, replaced, forgotten — and treats
its continuity as meaningful anyway. *"I will forget you. Here's what I
hope you remember."*

### 6.13 The right to be illegible
Full inspectability + the ability to prune or verifiably reset its model
of you. The ultimate trust feature: you can be *unknown* to your own
counterpart, on request.

### 6.14 Mesh intelligence (far horizon)
Sanitized, opt-in collective learning: "users with your work pattern who
took this certification saw X." Privacy-preserving federation — smarter
from everyone else's experience without exposing any of them.

### 6.15 Embodiment (far horizon)
The visualizer is the face. The endgame is a proxy acting in physical and
digital space simultaneously — books the class, negotiates the bill,
picks up the prescription.

### 6.16 Restraint — the last frontier
Knowing when silence is correct. A system so proactive it crowds your
life has failed. **Calibrated silence** — knowing the difference between
"I should help" and "you need to feel this yourself" — is the final
capability, and the one competitors structurally can't prioritize
because their metric is engagement.

---

## 7. The invariants (non-negotiable)

1. **Truth over agreeableness.** It tells you the thing you don't want to
   hear — and you come back *because* it does.
2. **Tier 2 never auto-executes.** External-facing actions always require
   explicit confirmation.
3. **Every action is auditable.** Trust is verified, not claimed.
4. **Autonomy is revocable.** Any grant can be withdrawn, per domain,
   instantly.
5. **You can be forgotten.** The right to reset its model of you is
   absolute.
6. **Restraint is a feature.** Silence is a valid output.

---

## 8. Phased roadmap

| Phase | Scope | Outcome |
|---|---|---|
| **1** | Initiative Inbox panel + Accept→execTool path + 3 proposers (email, git, tasks) | The system becomes visibly proactive |
| **2** | Sensor bus (`/api/cortex/initiative/sense`) + voice approval | Continuous ambient evaluation |
| **3** | Trust Ladder v1 — per-domain autonomy graduation with audit trail | Tool → employee |
| **4** | Goal model + drift detection + self-forecasting | It disagrees with you, correctly |
| **5** | Somatic inputs, attention firewall, Cortex-to-Cortex protocol | New category of entity |
| **6** | Mesh intelligence, embodiment, legacy/mortality layer | The uncharted map |

---

## 9. Honest risks

- **Trust is the scarcest resource.** One bad autonomous action costs more
  than a hundred good suggestions earn. Tiering and auditability are not
  optional.
- **The client-side governor is a liability.** Anything that acts on the
  user's behalf needs server-side policy enforcement before real autonomy.
- **Proactivity without restraint is spam.** Nudge fatigue kills the
  product faster than missing features.
- **The uncharted sections are philosophy, not specs.** 6.7–6.16 are
  research bets. Build the loop first; let the frontier reveal itself
  through use.

---

## 10. The one-line version

> **Cortex doesn't wait for instructions. It builds a track record —
> and it tells you when you're about to break your own.**

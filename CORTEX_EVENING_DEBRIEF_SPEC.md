# CORTEX EVENING DEBRIEF SPEC
## The Shutdown Brief — night protocol that closes the day and hands off tomorrow

> Status: SPEC — implementation prompt for agent fleet.
> Companion to `CORTEX_MORNING_PROTOCOL_SPEC.md` (the Chief's Brief).
> Research basis: Scullin et al. 2018 (polysomnography RCT, Baylor),
> Cal Newport's shutdown-ritual experiments, Gollwitzer implementation-
> intention research, Leroy 2018 attention-residue studies, US Army/NASA/
> APQC After-Action Review doctrine, Goldman-Wetzler's Nightly Review,
> Pennebaker expressive-writing research, detachment/recovery literature.

---

## 0. Design principles (research-grounded, non-negotiable)

1. **The debrief is a shutdown ritual, not a report.** Newport's finding:
   the ritual works because it produces a *trusted handoff* — every open
   item gets a credible specific next step, and the brain accepts that as
   closure. The debrief's job is to make rumination unnecessary, not to
   summarize the day.
2. **Specific tomorrow beats reflective yesterday.** Scullin et al.
   (2018, polysomnography): people who wrote a *specific* to-do list for
   the next day fell asleep faster; people who journaled *in detail* about
   completed activities took LONGER to fall asleep. The debrief allocates
   its weight accordingly: tomorrow's plan is specific and concrete;
   yesterday's review is brief and question-shaped.
3. **Every open loop gets an if-then, not a worry.** Gollwitzer's
   implementation intentions roughly double follow-through. "Work on the
   appeal" is a goal; "when I open my laptop at 9:30, first action: draft
   the Justin White call agenda" is an implementation intention. The
   debrief writes the second kind for the top items.
4. **Questions are tailored by evidence, not generic.** AAR doctrine:
   "what was supposed to happen / what actually happened / why the
   difference / what do we sustain or change." Cortex is uniquely able to
   ask these *informed* — it knows what was planned (morning brief),
   what was verified (task archive, accomplishments log, incidents), and
   what is still open (proposals, queue, forecasts). The debrief asks
   about the *actual gaps*, not "how was your day?"
5. **Verified wins only.** Same evidence contract as the morning brief:
   accomplishments must carry verification. Unverified work is labeled
   or excluded — a debrief that inflates the day teaches the wrong
   lesson.
6. **Blameless AAR framing.** AAR ground rules: no praise-and-blame, the
   gap between plan and outcome is data, not judgment. The debrief asks
   "what got in the way?" not "why did you fail?"
7. **One closing signal.** Newport's "schedule shutdown complete" — a
   fixed-format sign-off line that tells the operator's brain the handoff
   is done. The debrief ends with it every night.
8. **Reflection is optional and lightweight.** The debrief asks 3–4
   questions the operator can answer in bed, in their head, or ignore.
   It never blocks on answers. Pennebaker: writing helps, but the prompt
   itself does the work — the questions are the intervention.
9. **Tomorrow is already prepared.** The debrief points at existing prep
   artifacts (prep briefs, engagement plans, radar proposals awaiting
   approval) rather than regenerating them. If prep is missing for a
   tomorrow event, the debrief says so honestly — that's a gap signal.
10. **Length cap, harder than the brief.** Evening attention is scarce.
    Phone payload ≤ ~2,500 chars. The debrief is a page, not a packet.

---

## 1. SCHEDULE

| Time | Actor | Action |
|---|---|---|
| ~21:00 | launchd → PREP agent | `prep_sweep` (already shipped — P3) |
| ~21:30 | Routine → DEBRIEF agent (new) | Assemble debrief from day's verified state |
| ~21:45 | DEBRIEF agent | Deliver Discord + iMessage |
| On-demand | `/cortex debrief` (Discord) | Regenerate anytime |

Rationale: 21:30 clears the prep sweep, leaves wind-down room before
~22:30 target sleep, and lands while the day is still memorable (AAR
doctrine: debrief while memory is fresh).

---

## 2. CONTENT SPEC — fixed section order

Same contract as the morning brief: sections render only when non-empty,
order never changes, hard cap ~2,500 chars for the phone payload.

### §2.1 THE LEDGER (what the day actually was)

- **Verified done** — accomplishments from `accomplishments-log` /
  task archive with `verified:true`, count + top 3 named items.
- **Missed/aging** — items that were on the morning plan or in-flight
  and did NOT verify: stale incidents, unanswered proposals older than
  N hours, queue items that failed. Framed neutrally: "still open, not
  failed."
- One line, honest: `Day score: N verified / M attempted` — Cortex's own
  reliability number, no spin.

### §2.2 THE GAP (AAR core — the section that makes this elite)

For each significant plan-vs-outcome gap, ONE question, evidence-attached:

- Proposal sat unanswered 6h → *"The BUILDER budget card waited 6h —
  what was the blocker?"*
- Incident fired and resolved → *"Reddit queue stalled at 14:20 — did
  the alert reach you?"*
- Calendar event happened but no prep existed → *"The 15:00 call had no
  prep brief — want me to flag prep gaps louder?"*
- Prep artifact existed but task shows no evidence it was used → skip;
  Cortex can't know attention, don't pretend.

Max 3 gap questions, ranked by consequence. If the day was clean: one
line — *"No significant gaps today. The machine ran as designed."*

### §2.3 TOMORROW, CONCRETELY (the sleep aid — weighted heaviest)

- **Calendar preview** — tomorrow's events, each with prep status
  (`prep ready` / `no prep yet` / `engagement plan ready`).
- **Top 3 priorities** — pulled from: unanswered proposals, aging
  incidents, forecasted risks, and the operator's own stated intentions
  captured in prior debriefs. Each rendered as an **implementation
  intention**: *"When you sit down tomorrow, first action on X: ___"*
  — Cortex proposes the first action from task context; operator can
  veto by ignoring.
- **Specific to-do offload** — every open loop that has no next step
  gets one written down. This is the Scullin mechanism: the list is the
  sleep aid. Cap at 7 items; overflow rolls to "also on deck."

### §2.4 TONIGHT'S ONE THING (optional micro-prompt)

One question, rotated, never repeated within 7 days — drawn from:

- *"What's one thing today you're glad happened?"* (wins reflection)
- *"What's tomorrow you're mildly dreading?"* (anxiety naming —
  Goldman-Wetzler)
- *"Did you use the prep brief for the 6pm call? What did you change?"*
  (evidence-linked when a prep artifact exists for a past event)
- *"What did you learn today that isn't in any system yet?"*
  (capture prompt — feeds memory if answered)

### §2.5 SHUTDOWN

Fixed-format sign-off, rotating pool (same anti-repeat engine as the
greeting):

- *"Debrief complete. Tomorrow is planned. Sleep well."*
- *"Day closed. Loops handed off. Rest well, Chief."*
- Halo-flavored ~1-in-7, e.g. *"The fight is scheduled for tomorrow.
  Tonight, sleep."*

---

## 3. AGENT DESIGN — `DEBRIEF` (new worker, mirrors BRIEF)

### 3.1 Registration

- `agentId: 'debrief'`, tier `reason` for assembly (cheap enough for
  `fast`? — assembly is templated like BRIEF; LLM only for the gap
  questions' phrasing and tomorrow's first-action proposals → `reason`
  for quality, `fast` fallback).
- Budget: ~6 tasks/day cap (1 scheduled + manual + retries).

### 3.2 Inputs (all existing state)

- `task-archive.jsonl` — today's tasks: status, verified flags, durations
- `accomplishments-log` — verified wins
- `incidents.json` — fired/resolved/aging incidents
- `strategy-proposals.json` — proposals filed/answered/dismissed + latency
- `forecasts.jsonl` — what was forecast vs. what verified
- `calendar-upcoming.json` + `.cortex-runtime/prep-briefs/` — tomorrow's
  events + which have prep
- `briefs/YYYY-MM-DD.json` — this morning's brief (the "supposed to
  happen" side of the AAR)
- `life-events.json` — radar proposals pending approval

### 3.3 Output

- `.cortex-runtime/debriefs/YYYY-MM-DD.json` + `.md` — full artifact
- Phone/Discord payload — capped render of the same
- Optional: append to daily memory note (`memory/YYYY-MM-DD.md`) so the
  debrief becomes searchable context for future briefs — P2.

### 3.4 Delivery

- Discord: dedicated briefs channel (same as morning brief).
- iMessage: same `imsg` path as morning delivery.
- Print: NO — evening print is waste; the morning packet carries prep.
- Delivery status recorded honestly (`delivery-status.json` pattern) —
  if the Mac is asleep at 21:45, the debrief is marked `missed`, not
  silently dropped. WARDEN patrol can escalate repeated misses.

---

## 4. THE CLOSED LOOP (why this makes Cortex elite)

The morning brief and evening debrief form a daily AAR cycle that no
consumer product has:

```
04:45  Brief:   "here's the plan, here's what's verified from overnight"
  ↓    Day happens — Cortex records evidence continuously
21:30  Debrief: "here's plan-vs-verified, the 3 real gaps, tomorrow's
                if-then plan, one question for you"
  ↓    Operator answers (optional) or ignores
04:45  Brief:   learns — unanswered gap questions resurface if the
                underlying condition persists; tomorrow's priorities
                reflect what the debrief surfaced
```

This is the OODA loop at personal scale: observe (radar+brief) → orient
(debrief reconciliation) → decide (approvals + tomorrow's if-thens) →
act (the day) → observe again. The debrief is the "orient" step that
most systems skip entirely.

### 4.1 Feedback into the morning brief (P2)

- Debrief answers (if captured) become memory entries tagged
  `debrief-answer` → searchable by BRIEF/LIBRARIAN.
- Repeated unanswered gap questions escalate: if the same proposal type
  sits unanswered 3 nights running, the morning brief promotes it to
  the decisions section with a staleness flag.
- Tomorrow's priority ranking in the debrief feeds the next morning
  brief's "top priorities" ordering — the operator's debrief choices
  literally reorder tomorrow's brief.

---

## 5. HONESTY CONTRACT (inherited, restated)

- Never claim the operator "did" something — Cortex verifies work it
  performed, not attention the operator paid. Prep-used is unknowable;
  don't score it.
- `verified:false` accomplishments are excluded from "done" and may
  appear in "attempted."
- If state sources are missing (Mac asleep → no iMessage delivery, no
  fresh calendar feed), the debrief says so in one line — degraded
  coverage is reported, not papered over.
- The debrief never creates calendar events, sends messages to third
  parties, or mutates anything. Read → compose → deliver. All writes
  stay behind existing approval gates.

---

## 6. BUILD ORDER

| Phase | Scope |
|---|---|
| P0 | DEBRIEF worker: assemble from existing state files, fixed sections, evidence contract, artifact write, Discord+iMessage delivery, launchd 21:30 job |
| P1 | Gap-question engine: rank plan-vs-outcome gaps from proposals/incidents/archive latency; question pool with 7-day anti-repeat |
| P2 | Debrief answers → memory capture; morning-brief priority reordering; debrief→brief learning loop |
| P3 | Weekly debrief rollup (Sunday): week-level AAR, streaks, recurring gap patterns → STRATEGIST input |

---

## 7. RESEARCH CITATIONS

- Scullin, Krueger, Ballard, Pruett, Bliwise (2018). "The Effects of
  Bedtime Writing on Difficulty Falling Asleep." *Journal of Experimental
  Psychology: General* — specific to-do lists before bed → faster sleep
  onset; detailed completed-activity journaling → slower onset.
- Newport, C. "Work Less to Work Better: My Experiments with Shutdown
  Routines" (calnewport.com, 2009) — shutdown ritual design; rumination
  reduction via trusted handoff + closing signal.
- Gollwitzer, P. & Sheeran, P. (2006). "Implementation Intentions and
  Goal Achievement: A Meta-analysis." *Advances in Experimental Social
  Psychology* — if-then plans ~2x follow-through.
- Leroy, S. (2018). "Why is it so hard to do my work? The challenge of
  attention residue." *OBHDP* — unfinished-task residue; ready-to-resume
  plans aid detachment.
- US Army / NASA / APQC After-Action Review doctrine — four-question
  structure (supposed to happen / actually happened / why / what to
  learn), blameless framing, sustain+improve dual output.
- Goldman-Wetzler, J. "The Nightly Review" — worked / differently /
  looking-forward / nervous-about prompt set.
- Pennebaker, J.W. — expressive writing about daily experience improves
  processing and well-being.
- Detachment literature (Sonnentag & Fritz) — evening psychological
  detachment predicts recovery and next-day functioning.

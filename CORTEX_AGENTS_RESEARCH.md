# Cortex Agents Research — Forecaster & Prep Landscape

Date: 2026-11-15 · Prompt: `CORTEX_AGENTS_RESEARCH_PROMPT.md`
Method: web research across vendor docs, comparison sites, user complaints
(Reddit/HN/G2-class sources via aggregators), and interruption science.
Every non-obvious claim cites its source.

---

## A. Forecasting & anticipatory agents — who claims this?

### The honest landscape

"Forecasting agent" as a consumer product **barely exists**. What exists:

| System | What it actually does | Forecast quality signals |
|---|---|---|
| **Infosys multiagent risk system** (consulting, not product) | Watches project comms (email/chat/transcripts), predicts failure 6–8 weeks out, claims ~90% accuracy; a "cultural intelligence" sub-agent claims 94% conflict-escalation prediction from tone shifts | Vendor claims only; bespoke enterprise deployment; pattern-matching on historical failures |
| **Procbay Predictive Analytics Agent** | Procurement: forecasts savings timing, flags approval/supplier bottlenecks | Explicitly "explainable forecasts," confidence levels shown, **human decides**, audit trail |
| **Tellius agentic finance** | 24/7 KPI monitoring, anomaly detection + automated root-cause decomposition, alerts while intervention still possible | Continuous monitoring + investigation, not point predictions |
| **Rhythms.ai Radar** | Cross-signal correlation across CRM/Jira/Slack mapped to OKRs; threshold-configured alerts; playbooks on detection | Signal topics → thresholds → playbooks; human sets what matters |
| **Lindy / 11x / Artisan / Sintra** | Task automation (inbox, scheduling, outbound), NOT prediction. Lindy does daily briefs + meeting prep but reactive to your setup | No forecast claims; credit-metered execution |
| **Motion / Reclaim / Clockwise** | Calendar optimization: Motion = deterministic constraint satisfaction; Reclaim = ML pattern learning; **Clockwise shut down March 27, 2026** | Scheduling, not forecasting; known failure = technically-valid but context-blind placements |

**Verdict:** The credible pattern across every trustworthy system is the
same four-part contract: **explainable forecast + visible confidence +
human decision + audit trail.** Cortex's evidence-required ForecastSignal
+ tiered routing + ledger is already aligned — and nobody in the consumer
space renders forecasts spatially on a live globe. That remains NOVEL.

### Forecast UX patterns worth stealing

- Procbay: confidence shown per forecast; warnings "inform, don't act."
- Rhythms: user-defined signal topics mapped to goals — probes should be
  user-tunable, not hardcoded.
- Tellius: pair every anomaly with automated root-cause investigation —
  FORECASTER probes should attach "why" evidence, not just "what."

## B. Meeting-prep agents — what exists, where they fail

### Feature matrix (vendor docs, read Nov 2026)

| Tool | Prep exists? | Scope | Sources | Plan gate |
|---|---|---|---|---|
| **Granola** | Yes — best-in-class citations | **External meetings only**, ~2–3 bullets, overnight | Past notes w/ same people, shared notes, open web/LinkedIn, calendar, Gmail (optional) | Business $14+/mo, Google Calendar only |
| **Fireflies** | Yes | Internal + external ≥5min w/ calendar | Previous meetings w/ same attendees | **Privacy leak: prep email defaults to ALL participants** — your prep lands in the client's inbox 1h before recurring meetings |
| **Read AI** | Yes — "Prepare" pre-reads | Needs calendar + video link; skips solo/>20-attendee/low-history meetings | Meetings + connected apps (email, CRM, Slack); appears ~36h ahead, refreshes ~1h before | Plan not stated |
| **Fathom / Otter / tl;dv / MeetGeek** | **No native prep** | — | Chat-over-past-calls only (must remember to ask) | — |
| **Sentra** | Yes — org memory | Team-wide permissioned knowledge base | Meetings + Slack + email + calendar + CRM + tickets + docs | Enterprise |
| **Lindy** | Yes | Per-call brief + notes + recap | Connected apps | Credit-metered |

### Observed failure modes (from comparisons + docs)

1. **Citation gap**: briefs pull from open web/LinkedIn — content nobody on
   the call said. Granola's "every fact is cited" is the differentiator;
   competitors' uncited claims force users to fact-check manually.
2. **Privacy leak**: Fireflies' all-participants default is the canonical
   "prep agent" horror story. Cortex prep must be local-only unless the
   user explicitly shares.
3. **Coverage gaps**: Granola skips internal meetings; Fireflies skips
   one-time meetings for email briefs; Read skips low-history meetings.
   Each tool's blind spots are silent.
4. **No scheduled brief**: Fathom/Otter users must *remember to ask* —
   prep that requires recall isn't prep.
5. **Brief ≠ dossier**: Granola's 2–3 bullets are honest about being a
   briefing, not research. Overstuffed briefs get skimmed.

## C. Alert fatigue & interruption science

Hard numbers found:

- **~3–5 unsolicited AI updates/day is the ceiling across ALL sources**
  combined — the "notification budget." The agent shipping its 10th
  notification of the week gets muted by Friday.
- Users already get **46–63 push notifications/day**; ~**23 minutes**
  recovery per interruption; interruptions as short as **5 seconds triple
  error rates** in complex work; **62% of alerts ignored**; ~half of users
  who disable notifications churn from the app.
- **Dismissed-without-reading is worse than no notification** — it spends
  budget AND produces negative trust.
- Best-practice modes: **Notify** (inform, no action — cheapest trust),
  **Question** (specific, time-bounded, answer matters), **Interrupt**
  (rare, true emergency). Consolidate related items; respect
  calendar-blocked time; batch to designated review windows.
- Calibration/abstention research (medical ML): the ability to say "I
  don't know" and abstain is a *required* capability for safe deployment;
  well-calibrated probabilities must precede any reject/accept threshold.

**Design consequence for FORECASTER:** Tier-3 spoken budget starts at
**≤3/day total across Cortex** (not per-probe), with self-demotion when
over budget. Tier-2 initiative proposals are the workhorse. Tier-1 ambient
visuals are unlimited because they cost zero attention.

## D. Gap analysis → Cortex kill/win table

| Capability | Verdict | Basis |
|---|---|---|
| Evidence-cited forecasts (every claim → source) | **NOVEL** | Only Granola does this for prep; nobody does it for forecasts. Procbay/Rhythms do confidence+audit but enterprise-locked |
| Spatial forecast rendering on live globe | **NOVEL** | No surveyed product renders predictions geographically in real time |
| Tiered action routing (ambient→proposal→spoken) | **STEAL pattern** | Notify/Question/Interrupt modes from ambient-AI architecture research |
| Interruption budget + self-demotion | **STEAL** | Notification-budget ceiling ~3–5/day; Cortex should enforce internally |
| Cross-signal correlation probes | **STEAL** | Rhythms/Tellius pattern — Cortex already has the pipes (fleet, calendar, gmail, GEV layers) |
| Prep brief w/ citations | **STEAL + extend** | Granola's citation model, but add internal-meeting coverage they skip and Gmail open-items |
| Prep privacy (local-only default) | **STEAL anti-pattern** | Fireflies' all-participants leak is the cautionary tale |
| Deterministic constraint scheduling | **AVOID scope** | Motion/Reclaim solve a different problem; Cortex's resonance-calculus timing is the differentiator, not a scheduler |
| Vendor accuracy claims (90–94%) | **AVOID** | Unverifiable marketing; Cortex logs real outcomes and calibrates per-probe instead |
| "Forecast everything" as one model | **AVOID** | Modular probes only — matches every credible system's architecture |

## E. What this means for the specs

**FORECASTER spec updates:**
- Tier-3 budget: hard cap ~3 spoken/day system-wide, self-demoting.
- Probes emit "why" evidence (root-cause attachment), not just claims.
- Add `userDefinedTopics` — probes expose tunable signal topics like Rhythms.
- Calibration: per-probe precision/recall from outcome log; floor raises on
  false-positive streaks (already in spec — confirmed by abstention research).

**PREP spec (new):**
- v1 brief = cited bullets: attendees + relationship history (Gmail/doc
  sources), open items/commitments, suggested agenda, each line cited.
- Cover internal AND external meetings (beat Granola's external-only gap).
- Local-only artifact by default; explicit share action required to send.
- Trigger: FORECASTER calendar probe ("meeting in N hours, no brief") or
  manual "prep me for X."
- Honest scope: brief only in v1 — no decks/video until citation accuracy
  is proven on real meetings.

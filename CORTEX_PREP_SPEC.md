# PREP Agent — Spec

Status: SPEC (not yet implemented)
Tier: standard
Depends on: FORECASTER calendar probe, calendar-linked-api, Gmail triage,
LIBRARIAN/memory (knowledge graph, obsidian memory), cortex artifacts,
initiative inbox.
Research basis: `CORTEX_AGENTS_RESEARCH.md` §B.

## Mission

PREP turns "meeting in N hours" into a cited, local brief — who is coming,
what was last said, what's owed, what to ask. It fires before the meeting
exists in working memory, so the user never starts a call cold.

## What the research says we must do differently

- **Cite everything.** Granola's "every fact is cited" is the only prep
  feature users trust. Every line in a Cortex brief carries an EvidenceRef
  (email id, doc path, calendar event, prior brief). Uncited claims are
  dropped at write time — same evidence-or-silence contract as FORECASTER.
- **Cover internal meetings.** Granola skips them (external-only). Cortex
  preps ANY meeting with ≥1 other attendee — internal is where open items
  actually live.
- **Never leak.** Fireflies' all-participants prep-email default is the
  canonical failure. Cortex briefs are local artifacts; sharing is an
  explicit user action, never automatic.
- **Scheduled, not recalled.** Fathom/Otter require you to remember to ask.
  PREP fires on the FORECASTER calendar probe: "meeting X in ~2h, no brief
  exists" → build one automatically.
- **Brief, not dossier.** Granola's honest 2–3 bullets beat stuffed
  summaries. v1 targets ~8–12 cited lines max.

## Pipeline

```
calendar probe signal (meeting in horizon, no brief)
  → PREP task (agent runtime, librarian-assisted gather)
    1. Event: title, time, attendees, recurring?
    2. Attendee history: Gmail threads w/ attendees (last 90d),
       prior briefs/notes mentioning them, open commitments
    3. Open items: unresolved action items from prior meetings/emails
    4. Compose brief → every claim carries EvidenceRef
    5. Persist as cortex artifact + initiative proposal
       "Prep brief ready: <meeting> — review/open"
  → User reviews; brief can be pinned to surface or spoken summary
```

## Brief format (v1)

```
# Prep — <meeting title> · <when>
Attendees: <names> (org/internal flag)

History (cited):
- <fact> — src: gmail:<id> | doc:<path> | brief:<id>
Open items:
- <commitment + owner + age> — src: ...
Suggested agenda:
- <3–5 bullets, derived only from cited material>
Watch for:
- <risks/tensions evidenced in threads — cited, never speculated>
```

## Honesty contract

- Zero uncited claims. A brief line without a source is dropped, not
  softened.
- "No history found" is stated plainly — silence about an attendee is
  honest; invented familiarity is not.
- Web-sourced claims (LinkedIn etc.) are labeled `src: web` and kept out of
  the default brief unless the user opts in — they describe the person,
  not the relationship.
- Prep quality is logged per meeting; briefs the user never opens count
  against the calendar probe's precision (feeds FORECASTER calibration).

## Agent runtime registration

```ts
{
  id: 'prep',
  name: 'PREP',
  role: 'Meeting Ready-Writer',
  blurb: 'Builds cited prep briefs before meetings — attendee history, open items, suggested agenda — local artifacts only, every claim sourced.',
  concurrency: 1,
  dailyBudget: 16,
  modelPin: { tier: 'reason' },  // synthesis quality matters
}
```

## Build phases

1. Skeleton: PREP worker handler, brief schema + citation validator,
   artifact persistence, initiative proposal emission.
2. Context gatherers: calendar event → Gmail thread search → memory/kg
   lookup → prior briefs. Each returns EvidenceRefs.
3. Calendar-probe trigger wiring (FORECASTER → PREP handoff) + manual
   "prep me for X" command path.
4. Review surface: artifact card in Cortex + spoken 3-line summary on
   request.
5. (v2, gated on v1 accuracy) leave-behind one-pager generation; only
   after briefs prove citation-clean on real meetings.

## Verification

- Unit: citation validator rejects uncited lines; dedupe; horizon gating;
  "no history" path produces honest empty sections.
- Live: real calendar event → brief cites actual Gmail/doc sources only;
  internal meeting covered; no external send occurs without explicit action.

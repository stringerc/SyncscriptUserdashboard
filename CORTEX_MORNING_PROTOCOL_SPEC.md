# CORTEX MORNING PROTOCOL SPEC
## The Chief's Brief + Life Radar + Prep Pipeline

> Status: SPEC — implementation prompt for agent fleet.
> Research basis: chief-of-staff briefing design (OpenAI Academy CoS brief,
> chiefofstaff.io Daily Brief, Otto EA playbook, PDB tradecraft),
> personal-CRM agents (Duly, Voyance/Clair, Cogni), EA family-management
> practice, and the Daily Dover Method (Whitney Stefko's working 4am
> AI chief-of-staff build).

---

## 0. Design principles (research-grounded, non-negotiable)

1. **BLUF.** Every brief leads with what needs a decision or action TODAY,
   not a summary of what happened. PDB tradecraft: what → why → what's next,
   in the first lines. A reader who sees only the first screen must still
   walk away ready.
2. **"So what?" in <3 seconds.** Every line earns its place or gets cut.
   Fewer items with the full decision beats many items with a topic.
   (chiefofstaff.io: "Budget, don't summarise.")
3. **Fixed section order, every day.** The reader learns where things are
   and reads faster. Sections render only when non-empty; order never
   changes.
4. **Hard length caps.** Phone brief ≤ ~4,000 chars (iMessage/Discord).
   Print brief ≤ 2 pages. The cap IS the editorial policy.
5. **Decisions framed as decisions.** "Appeal call with Justin White 10:00 —
   ask: status update + next filing window?" not "Call Justin White."
6. **Personal = professional.** Family/personal blocks get equal billing
   and their own section. (EA research: "the section that stops work eating
   dinner"; Ek/Abdaal: plan the private calendar harder than the work one.)
7. **Evidence-or-silence.** Every factual claim carries a source ref or is
   dropped — same contract as FORECASTER/PREP. Verified accomplishments
   only; `verified:false` items are labeled as such or excluded from the
   "accomplished" section.
8. **Facts vs inference, labeled.** Extracted dates are *inferred* until
   confirmed. The brief marks confidence; calendar writes require approval.
9. **Assembled overnight, delivered at wake time.** The brief is a
   finished product at ~5:30–6:00am, not generated when the user asks.
10. **Variety without chaos.** The greeting varies daily (see §1.4) but the
    structure never does. Consistency is what makes it feel like a ritual,
    not a notification.

---

## 1. PART A — THE CHIEF'S BRIEF (daily morning protocol)

### 1.1 Schedule

| Time | Actor | Action |
|---|---|---|
| ~04:30 | Routine → BRIEF agent | Assemble brief from overnight state |
| ~05:30 | BRIEF agent | Render Discord + iMessage payloads, print packet |
| 06:00 | launchd/CUPS (Mac) | Print fires — Mac must be awake (user decision) |
| On-demand | `/cortex brief` (Discord) | Regenerate/refresh anytime |

Implementation: agent runtime routine (`POST /api/cortex/agents/routines`,
`everyMinutes` is interval-based — for a wall-clock 4:30am fire, add a
`runAt`/`dailyAt` option OR a thin launchd/cron shim that POSTs an agent
task; recommend the shim for exact timing, routine for the poller pattern).

### 1.2 Content spec — fixed section order

```
1. GREETING + DATELINE        one line, varies daily (§1.4)
2. DECISIONS NEEDED           ≤5 items, each a real decision w/ deadline
3. TODAY'S SHAPE              calendar timeline, conflicts flagged,
                              energy-aligned focus blocks (existing
                              cortex-energy-spine acrophase data)
4. PREP STATUS                which events already have briefs;
                              "prep running" for pending ones
5. OVERNIGHT ACCOMPLISHMENTS  VERIFIED agent work only, counted honestly
                              ("12 tasks completed, 2 failed" — never
                              inflated; failures named, not buried)
6. WATCH ITEMS                incidents aging, budget caps near,
                              model-lane degradation, proposal backlog
7. PERSONAL BLOCKS            family/personal events equal billing —
                              daughter's call gets its own prep packet
                              (§3), not a footnote
8. RADAR HITS                 new Life Radar finds awaiting approval
                              (calendar proposals, commitment alerts)
9. SPOTLIGHT                  exactly ONE aged/forgotten item rotated
                              daily (research: keeps the long tail honest)
10. SIGN-OFF                  one line: what Cortex needs from you
```

**Word budget:** ≤600 words phone / ≤2 pages print. Depth goes to appendix
files (`.cortex-runtime/briefs/YYYY-MM-DD.md` + print packet dir).

### 1.3 Data sources (all already exist or specced below)

- Agent task archive → verified accomplishments (status=completed AND
  evidence present; failed tasks counted separately, honestly)
- FORECASTER ledger → today's routed signals (already evidence-gated)
- Initiative/proposal ledgers → pending decisions, aging incidents
- Calendar feed (`/api/cortex/calendar/upcoming`) → today's shape
- Gmail live-inbox summary → waiting-on-you count
- Model health matrix → lane degradation watch items
- Life Radar ledger (§2) → new findings + approval queue

### 1.4 Greeting engine

Daily varied greeting, Halo-inspired *occasionally* (~1 in 7 days), never
mandatory. Implementation: deterministic pick from a curated pool keyed by
date + a "halo mode" rotation; pool lives in code, ~40+ entries across
registers (military-quiet, warm, dry wit, Halo-flavored, seasonal).
Examples of register: "Good morning, Chief." / "Morning. The fleet ran
clean overnight — here's what needs you." / "Wake window open. Brief
inside." / Halo-rotations: "Sir, your morning sitrep." / "Chief, systems
nominal." Must NEVER repeat the same greeting two days running — enforced
by checking the last 7 days' picks in brief state.

### 1.5 Delivery

- **Discord:** rich embed/cards via existing `cortex-discord.ts`
  (`discordApi`, push-state dedupe). Full brief as embed + "Prep packets
  ready" thread. Buttons: [Approve calendar adds] [Snooze spotlight]
  reusing `sx`-prefixed component routing (fixed in 0ab9ec4).
- **iMessage:** `/opt/homebrew/bin/imsg send --to <num> --text <brief>`
  (verified installed, v0.4.0). Requires Mac awake + Messages signed in.
  Plain-text condensed version ≤4k chars — the SAME content, tighter
  formatting. Failure = honest "iMessage unreachable" line in Discord
  copy, never silent skip.
- **Print:** render brief → PDF/HTML → `lp`/CUPS at 06:00 via launchd
  `StartCalendarInterval`. Mac-awake constraint is accepted (user
  decision). Print packet = brief + prep sheets for each event (§3).
  If printer unreachable: save PDF to `~/Desktop/Cortex-Briefs/` +
  Discord note "print failed — PDF on Desktop."

---

## 2. PART B — LIFE RADAR (date & commitment discovery)

### 2.1 What it hunts

| Category | Examples | Extraction signals |
|---|---|---|
| Hard dates | court dates, filing deadlines, appointments | explicit dates + legal/medical terms |
| Deadlines | appeal windows, response-by dates, bill due | "by Friday", "within 30 days", "deadline" |
| People events | birthdays, anniversaries | names + birthday/anniversary context |
| Commitments | "I'll call Justin", "send Hall & Lampros the…" | first-person promise + temporal anchor |
| Logistics | call times, meeting places, what-to-bring | event details in threads |

### 2.2 Sources (user-approved: ALL)

| Source | Access path | Notes |
|---|---|---|
| Gmail | existing live-inbox + sent-mail fetch | sent mail = commitments YOU made |
| iMessage | `~/Library/Messages/chat.db` (SQLite, read-only copy) | requires Mac awake + Full Disk Access; 35MB active db confirmed |
| Memory/Obsidian | `cortex_memory` search + obsidian-memory lib | existing |
| Apple Notes | AppleScript `osascript` Notes suite (Mac) | read-only v1 |
| Files | targeted: Desktop/Documents recent files, names+content grep for date patterns | bounded scope, no home-dir crawl |

**Honesty rule:** each source reports coverage in the radar ledger —
"scanned: gmail ✓, imessage ✓ (3 threads), notes ✓, files ✓ (42 files)" —
so a silent source is visible, not assumed.

### 2.3 Pipeline

```
RADAR sweep (daily ~04:00 + on-demand)
  → per-source extractors → raw date/commitment mentions
  → normalize → LifeEvent records:
      { id, kind, title, dateStart, dateEnd?, confidence,
        evidence: [{source, ref, quote}], people: [], recurrence,
        status: candidate|proposed|approved|dismissed|expired }
  → confidence floor (≥0.6 auto-propose; below → review queue only)
  → dedupe vs existing calendar feed + prior radar ledger
  → emit calendar PROPOSALS (existing proposal infra, approve-each)
  → approved → calendar write (§2.4)
```

**Extraction approach:** reason-tier LLM pass per source chunk with a
strict JSON schema + the quote-or-drop evidence contract (every extracted
item must carry the verbatim source span). Deterministic pre-filter
(regex for dates/keywords) bounds what reaches the LLM — cost control.

### 2.4 Calendar writes — APPROVE-EACH (user decision)

- Every discovered event becomes a proposal card: "Add to calendar:
  Call Justin White re: appeal — tomorrow 10:00? [source: gmail thread
  abc123]" with Approve/Dismiss/Snooze buttons.
- Approval dispatches a `calendar_create` governed task.
- Write paths (in reliability order):
  1. **Apple Calendar** via `osascript` Calendar.app (Mac, local,
     reliable, no OAuth) — primary for personal events.
  2. **Google Calendar** — replace fragile `gcal-create.mjs` browser
     automation with Calendar API IF OAuth creds exist; else keep
     browser path as fallback, clearly marked fragile.
- Recurrence: birthdays/anniversaries auto-renew yearly on approval.
- Dedupe: never propose an event matching an existing calendar entry
  (title+date fuzzy match) or a previously approved radar item.

### 2.5 The Justin White / Hall & Lampros examples

These are exactly the radar→proposal→prep flow: "call Justin White
tomorrow re: appeal" extracted from gmail/iMessage → proposal → approve →
event on calendar → PREP sweep (§3) builds the call brief overnight →
printed + iMessaged by 6am.

---

## 3. PART C — PREP PIPELINE EXTENSION

### 3.1 Existing (keep)

FORECASTER calendarProbe → PREP brief for meetings <3h out, cited
sources, local artifact. Works today.

### 3.2 New: Night-Before Prep Sweep

At ~21:00 daily: enumerate ALL of tomorrow's events (not just <3h),
dispatch PREP for each that lacks a brief. Briefs ready before sleep,
printed with the morning packet.

### 3.3 New brief type: PERSONAL ENGAGEMENT PLAN

The daughter-call example is NOT a meeting brief — it's generative
planning. New PREP mode `engagement_plan`:

```
Input: event (call with daughter, 30min, 6pm) + person context
       (age 2, relationship notes from memory/iMessage)
Output: minute-by-minute engagement plan:
  - opening ritual (how to start a call with a 2-year-old)
  - 3-4 activity blocks filling 30min (songs, peekaboo prompts,
    show-and-tell props to have ready)
  - wind-down/closing routine
  - "if she fades" fallback + "questions to ask her" prompts
  - items to have ready BEFORE the call (prop list, quiet room)
```

Contract differences from meeting briefs: engagement plans MAY include
recommendations without citations (they're plans, not facts) but every
*claim about the person/situation* stays cited. Stored alongside meeting
briefs in `.cortex-runtime/prep-briefs/`, rendered into the print packet
and iMessage digest.

### 3.4 Output routing

- Meeting briefs → print packet + available in Discord thread
- Engagement plans → print packet + iMessage (personal = phone-first)
- All briefs → `.cortex-runtime/prep-briefs/` + initiative proposal
  "Prep ready: <event>" (existing pattern)

---

## 4. AGENT ASSIGNMENTS

| Role | Agent | Work |
|---|---|---|
| Radar extraction | SCOUT (fast lane) + LIBRARIAN (memory/gmail gather) | source sweeps, raw mentions |
| Normalization/dedupe | new `radar` logic in forecaster-style probe OR STRATEGIST | LifeEvent ledger |
| Brief composition | new BRIEF worker (reason tier, deep for print edition) | assemble → render → deliver |
| Prep briefs | PREP (existing) + engagement_plan mode | per-event packets |
| Calendar writes | governed task → osascript/Calendar API | approve-each only |
| Patrol | WARDEN | brief-sent verification, radar coverage, print success/fail honesty |

New agent `brief` (Chief's Brief writer) registers in Foundry — reason
tier for phone edition, deep tier optional for print edition if budget
allows. Daily budget ~4 tasks (assemble, render×2, print verify).

---

## 5. GOVERNANCE & HONESTY

- Calendar writes: approve-each, always. No auto-add.
- iMessage/Discord sends: brief is operator-addressed (user's own
  number/channel) — allowed; NEVER brief content to third parties.
- Print: local only. Failure → PDF fallback + honest Discord note.
- Radar: read-only on all sources. iMessage db opened read-only copy
  (sqlite `file:...?mode=ro` or copied to tmp) — never writes to chat.db.
- Every brief carries a footer: sources scanned, items dropped for low
  confidence, generation timestamp. Silent coverage is a bug.
- WARDEN check: "brief delivered today?" — if 6:30am passes with no
  Discord/iMessage evidence, incident → Inbox. Same for print.

---

## 6. PHASES

- **P0 — Brief v1 (1-2 days):** BRIEF worker assembles from EXISTING
  sources (agent ledger, forecasts, calendar feed, proposals), Discord +
  iMessage delivery, fixed sections, greeting engine, print via launchd.
  Proves the ritual end-to-end.
- **P1 — Radar Gmail:** sent+received extraction → LifeEvent ledger →
  calendar proposals (approve-each) → Apple Calendar write on approve.
- **P2 — Radar expansion:** iMessage chat.db, Apple Notes, memory,
  files. Coverage reporting live.
- **P3 — Prep sweep + engagement plans:** night-before sweep, personal
  plan mode, print packet integration.
- **P4 — Polish:** spotlight rotation learning, brief feedback loop
  ("was this useful?" → adjust weights), Google Calendar API if OAuth
  materializes.

## 7. OPEN QUESTIONS

- Exact iMessage target number (user's own — confirm before P0 send).
- Printer name/queue on the Mac (`lpstat -p` at build time).
- Google Calendar OAuth: does a token exist anywhere, or Apple
  Calendar-only for v1?
- iMessage Full Disk Access: granted to whatever process reads chat.db?
- Brief tone dial: how much Halo-flavored vs purely professional?

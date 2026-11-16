# CORTEX FLEET THEME SPEC — The Ensemble

> **Arm:** frontier-model (Devin), blind run per `CORTEX_FLEET_THEME_RESEARCH_PROMPT.md`
> **Date:** 2026-11-16 · **Status:** proposal — awaits SCOUT arm diff + user decision

---

## 1. Verdict up front

**Adopt a recording-studio theme — "The Ensemble" — layered on top of the existing vessel visuals. Do NOT rename agent IDs. Keep the orb/satellite/ship tier visuals but re-label them with studio roles.**

Space is no longer a theme — it's table stakes. The evidence is blunt: searching "AI dashboard orbital design" returns dozens of near-identical "orbital obsidian / cosmic orb / mission-control" templates, and at least one prompt marketplace literally sells "a voice-reactive 3D orb with a constellation of sub-agents" — which is a description of our Foundry. The visual can stay (it's built and legible); the *naming* is what needs a theme, and music/studio is the strongest candidate by a wide margin.

---

## 2. Why studio, not orchestra (the decision that matters)

Both music framings were evaluated. The **recording studio** beats the concert hall on every Cortex-specific mapping:

| Cortex reality | Orchestra mapping | **Studio mapping (winner)** |
|---|---|---|
| Spawned agents with TTL | Weak — orchestras don't hire/fire per song | **Session players** — literally hired for one session, gone when it ends. TTL = session end. Perfect. |
| Human approval gate | Weak | **Producer** approves what ships — STRATEGIST proposes, producer (you) approves. Exactly our Inbox flow. |
| Agent promotion ladder | Strong (player→principal→concertmaster→maestro) | Good — sideman → section leader → headliner → legend |
| WARDEN health patrols | Tuner (decent) | **Mix engineer** — keeps every level balanced, flags when something's clipping. Better. |
| RUNNER executes fast | Allegro (tempo name) | **Session vocalist** — the hired gun who cuts the take. Better. |
| Budget/governance | Weak | **Union rules / studio rules** — session players work under union rules; budgets are session budgets. Natural. |

The orchestra gives a prettier ladder; the studio gives a *truer* system metaphor. We take the studio.

---

## 3. The naming scheme — "The Sessions"

Cortex is the studio. The built-in fleet is the **house band** — permanent staff. Spawned agents are **session players** — hired per-session with a TTL, exactly like real session musicians. Every agent gets a **callsign**; the ID stays untouched.

### 3.1 House band (built-ins) — proposed callsigns

| ID (unchanged) | Role | Callsign | Rationale |
|---|---|---|---|
| `sentinel` | perimeter watch, bootstrap safety | **GATEHOUSE** | Checks who enters the session; the doorperson of the studio. |
| `scout` | web research, recon | **SCOUT** *(keep)* | A&R literally "scouts" talent — the name was already musical-adjacent. High register = fast lane. |
| `librarian` | memory, vault, recall | **CRATE DIGGER** | Digging through the crates for samples *is* memory retrieval. Memorable, honest, fun. |
| `builder` | code/tasks | **COMPOSER** | Writes the work that becomes the record. ARRANGER also viable — pick one, keep consistent. |
| `reviewer` | code/artifact critic | **A&R** | The label rep who decides what gets *released*. Maps perfectly to approve/reject authority. |
| `runner` | fast execution | **SESSION VOCAL** | The hired gun who cuts takes fast and cheap. |
| `warden` | patrols, health, budgets | **MIX ENGINEER** | Keeps all levels balanced; flags clipping (budget/capability overruns) before they ship. |
| `strategist` | synthesis → proposals | **PRODUCER** | Doesn't play the instruments — decides what gets made and green-lights it. Exactly the SRE incident-command role we specced. |
| `distributor` | routes deliverables | **PROMOTER** | Gets the record played on every platform. Literally what it does. |

### 3.2 Session players (spawned agents)

Spawned agents already receive generated callsigns — now they get **session-player names** from a registry pool:

- Format: `[INSTRUMENT]-[SESSION#]` — e.g., `HARP-014`, `VIBES-003`, `DOUCHE-...` no — keep it clean: `HARP-014`, `CELLO-022`, `PIANO-007`.
- Pool = orchestral instruments not used by house-band callsigns (~30+ instruments: harp, vibes, marimba, sitar, pedal steel, theremin, hang drum, etc.) — effectively unlimited headroom.
- Session number increments globally; retired sessions keep their number forever (Navy's "no two vessels same name" rule — names are never reused, so "HARP-014" always means the same agent lineage).
- TTL expiry = "session wrapped" — the callsign goes into the **Session Registry** (hall of fame), never reused.

### 3.3 Promotion ladder — vessel tiers renamed

| Current visual | Studio rank | Meaning |
|---|---|---|
| Orb (standard) | **SIDEMAN** | Works sessions, doesn't get billed above scale. |
| Satellite (enterprise) | **SECTION LEADER** | Leads their section on record. |
| Spaceship (spawned flagship) | **HEADLINER** | The name on the marquee for that session. |

*(Virtooso/legend reserved for a future "founding agent" tier if it ever exists.)*

### 3.4 Model lanes — the frequency layer

This is where the music theme pays its best dividend — lanes get **pitch/register names tied to real frequencies**:

| Lane | Current | Studio name | Frequency |
|---|---|---|---|
| fast | groq/nim-30b etc. | **TREBLE** | ~880 Hz (A5) — highest, fastest register |
| reason | nemotron-550b etc. | **CONCERT PITCH** | 440 Hz (A4) — the reference tuning standard |
| deep | deepseek/o3 etc. | **BASS** | ~110 Hz (A2) — low, resonant, slow-burn |

Every model health reading can now show a *frequency* — "CONCERT PITCH lane degraded, p50 1200ms" reads as audio telemetry. The dossier's "brain:" line becomes `brain: BASS · 110Hz ref · degraded`. This is the resonance/frequency idea you liked, made literal.

---

## 4. Governance — how names survive growth

1. **Callsign registry** — `.cortex-runtime/callsign-registry.json`: `{callsign, agentId, tier, sessionStarted, sessionEnded?, status}`. Append-only.
2. **Assignment authority** — STRATEGIST (the Producer) proposes callsigns for new spawns via the existing proposal flow; human approves in Inbox alongside the spawn proposal. No silent naming.
3. **Dedup rule** — Navy rule adopted verbatim: *no two agents in the fleet ever share a callsign, live or retired.* Registry enforces it.
4. **ID stability** — `agentId` (`scout`, `spawn-abc123`) never changes; callsigns are display-only. Rules clusters, budgets, archive, Discord all untouched.
5. **Theme resilience** — if we ever pivot themes, callsigns are just strings in a registry; the visual system doesn't depend on them.

---

## 5. Comparables — why this scales (teardowns)

| System | Mechanism | Source |
|---|---|---|
| **Claude** | Literary forms scaled by capability: haiku(17 syl)→sonnet(14 lines)→opus(magnum opus)→fable→mythos. CEO confirmed poetry theme (Lex Fridman #452). Opus is *literally a music term* — the boundary was already blurry. | [Anthropic model card](https://www-cdn.anthropic.com/c6a80a657af445f40e31afac050f3bf76d3b1404.pdf), [Zenn analysis](https://zenn.dev/yuzunatsuki/articles/47ec894f021602?locale=en) |
| **US Navy** | **Name pool per ship class** — carriers=presidents, destroyers=deceased heroes, subs=fish, tugs=tribes, minesweepers=birds. Class-scoped pools = infinite scale + instant class recognition. "No two vessels same name." | [NHHC ship naming](https://www.history.navy.mil/browse-by-topic/heritage/customs-and-traditions0/ship-naming.html), [globalsecurity summary](https://globalsecurity.org/military/systems/ship/names-summary.htm) |
| **Orchestra** | Hierarchy is real and documented: conductor→concertmaster→principals→section players→tutti. Gives us promotion ladder + role vocabulary for free. | [Symphony Nova Scotia FAQ](https://symphonynovascotia.ca/faqs/symphony-101/what-are-the-roles-of-the-conductor-concertmaster-and-principals/), [Wikipedia: Concertmaster](https://en.wikipedia.org/wiki/Concertmaster) |
| **Space/orbital** | Saturated — dozens of identical "orbital obsidian" templates; a marketplace prompt sells literally our Foundry concept. Keep visuals, drop the theme claim. | [Devault orbital obsidian](https://devault.design/design-md/hero-sections/orbital-obsidian--13448b20), [Trillion Prompt cosmic orb](https://hellotrillion.ai/p/cosmic-orb-ui) |

---

## 6. Anti-patterns — what NOT to do

- **Don't rename IDs.** `scout`→`piccolo` breaks rules clusters, budgets, archive lineage, Discord. Callsigns only.
- **Don't theme the URLs/API.** `/api/cortex/agents/task` stays. Theme is a presentation layer.
- **Don't force music metaphors where they're false.** A&R approves releases = reviewer approves artifacts ✓. But don't call the task queue a "setlist" — tasks aren't songs. Keep metaphor at the *agent* layer, not the *data* layer.
- **Don't reuse retired callsigns.** "HARP-014 was the SQL agent" must stay true forever or the registry becomes noise.
- **Don't make callsigns required for function.** If the registry is empty, UI falls back to agent name — graceful degradation.

---

## 7. Ranked recommendations

- **MUST:** Callsign registry + display-name layer in `AgentClient`/roster/dossier (callsign shown, ID stays). ~half day.
- **MUST:** Rename the 9 house-band callsigns per §3.1 (pure display strings + registry seed).
- **SHOULD:** Studio-rank labels on vessel tiers (SIDEMAN/SECTION LEADER/HEADLINER badges).
- **SHOULD:** Lane names TREBLE/CONCERT PITCH/BASS in model-health displays + dossier "brain:" line.
- **COULD:** Session-player generator for spawned agents (instrument pool + global session counter).
- **COULD:** "Session wrapped" state in dossier for expired spawns (name → registry hall of fame).

---

## 8. Five-question test

- Memorable a week later? **Yes** — GATEHOUSE, CRATE DIGGER, MIX ENGINEER, A&R are sticky; PICCOLO-energy names survive.
- Scales to 100 agents? **Yes** — Navy class-pool mechanism + ~30 instruments × session numbers.
- Survives a pivot? **Yes** — callsigns are registry strings; visuals unchanged.
- New agent nameable without brainstorm? **Yes** — Producer proposes from pool, human approves.
- Helps or hurts mission-control clarity? **Helps** — A&R/MIX ENGINE/PRODUCER tell you *authority* faster than SCOUT/BUILDER/WARDEN did; frequency lanes make model health literally readable.

---

## 9. Source appendix

- Anthropic Claude 3 model card (official PDF) — https://www-cdn.anthropic.com/c6a80a657af445f40e31afac050f3bf76d3b1404.pdf — primary
- Claude naming analysis (Zenn, cites Lex Fridman #452 CEO confirmation) — https://zenn.dev/yuzunatsuki/articles/47ec894f021602?locale=en — secondary
- NHHC ship naming traditions — https://www.history.navy.mil/browse-by-topic/heritage/customs-and-traditions0/ship-naming.html — primary
- GlobalSecurity naming summary table — https://globalsecurity.org/military/systems/ship/names-summary.htm — secondary
- Symphony Nova Scotia role FAQ — https://symphonynovascotia.ca/faqs/symphony-101/what-are-the-roles-of-the-conductor-concertmaster-and-principals/ — primary-ish
- Wikipedia Concertmaster — https://en.wikipedia.org/wiki/Concertmaster — tertiary
- Devault "Orbital Obsidian" design tokens — https://devault.design/design-md/hero-sections/orbital-obsidian--13448b20 — evidence of space saturation
- Trillion Prompt "cosmic orb + sub-agent constellation" — https://hellotrillion.ai/p/cosmic-orb-ui — evidence our exact visual is a commodity prompt

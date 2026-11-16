# RESEARCH PROMPT — Agent Fleet Theme & Naming System

> **Purpose:** Produce `CORTEX_FLEET_THEME_SPEC.md` — an elite, fact-based specification for a naming/theme system for Cortex's agent fleet: theme candidates, callsign taxonomy, promotion-ladder naming, model-lane naming, and governance for adding agents over time.
> **Standard:** .01% research. Every factual claim needs a primary source URL. No SEO listicles as evidence. Unverifiable claims go in an explicit gap list, not the body.
> **Independent-run protocol:** If you are an external model/agent executing this prompt, do NOT read prior Cortex specs first. Save output as `CORTEX_FLEET_THEME_SPEC.<model-name>.md`. Blind independence is what makes A/B comparison meaningful.

---

## 0. The case study that motivates this

Cortex is a multi-agent mission-control system. Its fleet currently has 9 built-in agents with **functional role names** (SENTINEL, SCOUT, LIBRARIAN, BUILDER, REVIEWER, RUNNER, WARDEN, STRATEGIST, DISTRIBUTOR) plus **spawned enterprise agents** that receive generated callsigns. The visual system already encodes tier spatially: agents render as vessels — orb → satellite → spaceship promotion, orbital mechanics, dark HUD aesthetic.

The user loves naming themes (cites Claude's model naming — opus/sonnet/haiku — and "resonance and frequency" concepts) and is deciding between:
- **Music theme** (orchestra sections, pitch/frequency lanes, conductor, tuning)
- **Space theme** (already partially built visually)
- **Other themes** we haven't considered

Constraints that any proposal must respect:
- Agent **IDs are load-bearing** (`scout`, `warden`, etc.) — they appear in the task archive, distilled-rules clusters (`fail|scout|provider`), budgets, Discord routing, spawn lineage. IDs cannot change; only display names/callsigns can.
- The fleet **will keep growing** — spawned agents need a naming scheme that scales to dozens/hundreds without collisions or meaningless names.
- There is a **promotion ladder** (orb → satellite → ship) that needs thematic naming at each tier.
- There are **model lanes** (fast / reason / deep) that could carry thematic naming.
- The system's own language is biological/ecological: "self-healing ecosystem," "organism," "immune system" — the user says this constantly.

---

## 1. Research domains (all required, primary sources only)

### Domain A — How elite products name AI agents & models
Claude (Anthropic), OpenAI (GPT naming history, o-series), Google DeepMind (Gemini, AlphaGo/AlphaFold naming logic), Meta (Llama), Mistral, Cohere (Command), Cursor/Anysphere, Devin (Cognition), Manus, Lindy, Relevance AI, Harvey, Sierra, Decagon, Copilot Studio agent naming, Zapier Agents, Lindy personas. For each: what is the naming *logic* (poetry, function, mythology, nature, music), does it scale, did it age well, what do users actually call the agents?

### Domain B — Theme systems that scaled (and ones that didn't)
Android versions (desserts → now years?), Ubuntu releases (adjectives+animals), JavaScript frameworks, Bond films, hurricane naming, NATO phonetic alphabet, aviation callsigns (e.g., "NASA astronaut call signs"), naval vessel naming conventions (US Navy ship classes: carriers=presidents, destroyers=states), superhero naming, Dwarf Fortress/DF legends, Warframe weapon names, Magic: The Gathering sets. For each: the *mechanism* that let it scale, and documented failures (names that aged badly, collided, or confused users).

### Domain C — Music as a naming/theme system for computing
Orchestra sections and section-player→principal→concertmaster→maestro ladders; jazz combo roles (trio/quartet/big band); music production session naming (tracks, buses, mastering chains); synthesizer/preset naming (Moog, Serum, Vital); frequency/pitch/resonance metaphors already in computing (radio, DSP, audio plugins, "carrier wave," FFT bins); musical form names (overture, prelude, interlude, finale, coda) as lifecycle names; solfège; mode names (dorian, phrygian, lydian). Does music theory provide enough distinct, meaningful names for 9+ agents plus spawned extras? What's the headroom?

### Domain D — Memorability & usability research on names/callsigns
What makes a callsign memorable and unambiguous (phonetic distinctiveness, length, syllable count, imagery)? Research on working-memory limits for name lists (Miller's 7±2 and modern replications), why phonetic alphabets exist (ICAO spelling alphabet history), avatar/agent naming studies in games (WoW class names, MMO guild/officer titles), and enterprise software naming heuristics. Any documented UX research on agent/persona naming.

### Domain E — Space & military metaphor saturation
How saturated is the "space/orbital/mission-control" aesthetic in AI dashboards (v0, vapi, elevenlabs, character.ai, deck.gl demos, every "AI OS" landing page)? Is a space theme now a cliché? What do the *best-regarded* agent UIs actually look like (Devin's UI, Manus, ChatGPT agent mode, Claude artifacts, Linear, Raycast, Vercel v0)? Honest assessment: does vessel/orbital visual language still differentiate, or is it table stakes?

### Domain F — Anti-patterns & failure modes
Documented naming failures: names that became embarrassing (tech products renamed), trademark collisions, names that don't translate, themes that confused users about function (e.g., cutesy names for infrastructure), gendered/ cultural pitfalls, names too opaque to guess function. Also: theming systems that collapsed when the product pivoted.

---

## 2. Required deliverables in `CORTEX_FLEET_THEME_SPEC.md`

1. **Theme candidate slate** — 4–6 candidate themes (music, space, biology/ecosystem, naval, something better you find), each scored on: scalability to 50+ agents, promotion-ladder fit, model-lane fit, memorability, visual distinctiveness, and risk.
2. **Naming taxonomy** — for the recommended theme: the full callsign scheme (how names are formed, syllable/length rules, collision handling, how spawned agents get names), plus the promotion ladder names and model-lane names.
3. **Per-system teardown table** — the ~10 best comparators: naming logic, scale mechanism, aging, sources.
4. **Cortex mapping** — proposed display names for the 9 existing agents (IDs unchanged), proposed names for orb/satellite/ship tiers, proposed names for fast/reason/deep lanes. Mark each as KEEP / RENAME / NEW.
5. **Governance spec** — how new agents get named going forward: who/what assigns callsigns, dedup registry, retirement naming, how the theme survives pivots.
6. **Five-question test** — does every recommendation answer: is it memorable a week later, does it scale to 100 agents, does it survive a pivot, can a new agent be named without a human brainstorm, does it help or hurt the mission-control clarity?
7. **Ranked recommendations** — MUST / SHOULD / COULD.
8. **Anti-patterns** — specific things NOT to do, with sources.
9. **Source appendix** — every URL, labeled primary/secondary.

---

## 3. Hard rules

- No claim without a URL.
- Distinguish documented mechanism from marketing.
- If a domain yields thin primary sources, say "thin coverage" — do not pad.
- This is a naming/branding spec — be concrete: actual proposed names, not "use a music theme."
- The deliverable is a spec, not an essay. Tables over prose.

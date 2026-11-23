// prospective-memory.ts — persistent intentions bound to future cues.
//
// Episodic memory is PAST; simulation is counterfactual FUTURE. This is
// prospective memory: an intention that survives sessions and fires when
// a perceptual cue arrives — "remind me to check the build when the
// patrol finishes" — not a timer, a TRIGGER.
//
// An Intention = { cue: {kinds?, pattern}, note, armedAt, status }.
// When attention produces a candidate or a broadcast ignites, cues are
// matched; a hit fires the intention into inner speech + returns it so
// the caller can act (surface a reminder, arm a follow-up).
//
// Honest bounds: firing is a notification + monologue entry, not silent
// autonomous action — prospective memory REMINDS, it doesn't command.
// State: .cortex-runtime/prospective-memory.json
import fs from 'node:fs';
import path from 'node:path';
import { speakInner } from './inner-speech';

const RUNTIME = path.resolve(process.cwd(), '.cortex-runtime');
const FILE = path.join(RUNTIME, 'prospective-memory.json');
const MAX_OPEN = 50;

export interface Intention {
  id: string;
  /** Cue spec: attention/broadcast kinds to watch + regex on text. */
  cue: { kinds?: string[]; pattern: string };
  /** What to do when it fires — surfaced as a reminder. */
  note: string;
  armedAt: number;
  status: 'armed' | 'fired' | 'cancelled';
  firedAt?: number;
  firedBy?: string; // what cue text triggered it
}

function load(): Intention[] {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}
function save(list: Intention[]) {
  try { fs.mkdirSync(RUNTIME, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(list.slice(-200), null, 2)); } catch {}
}

export function armIntention(cue: { kinds?: string[]; pattern: string }, note: string): Intention {
  const list = load();
  const open = list.filter((i) => i.status === 'armed');
  if (open.length >= MAX_OPEN) throw new Error(`prospective memory full (${MAX_OPEN} open intentions)`);
  const intention: Intention = {
    id: `int-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    cue: { kinds: cue.kinds?.map((k) => k.toLowerCase()), pattern: cue.pattern.slice(0, 200) },
    note: note.slice(0, 300),
    armedAt: Date.now(),
    status: 'armed',
  };
  list.push(intention);
  save(list);
  try { speakInner({ kind: 'commitment', source: 'prospective-memory', text: `Armed intention: "${note.slice(0, 80)}" — waiting for /${intention.cue.pattern}/`, surprise: 0.3, valence: 0.1 }); } catch {}
  return intention;
}

export function cancelIntention(id: string): boolean {
  const list = load();
  const i = list.find((x) => x.id === id);
  if (!i || i.status !== 'armed') return false;
  i.status = 'cancelled';
  save(list);
  return true;
}

export function listIntentions(status?: Intention['status']): Intention[] {
  const list = load();
  return status ? list.filter((i) => i.status === status) : list;
}

/** Match a percept against armed intentions. Returns fired intentions. */
export function checkCue(percept: { kind?: string; text: string }): Intention[] {
  const armed = load().filter((i) => i.status === 'armed');
  if (!armed.length || !percept.text) return [];
  const text = percept.text.toLowerCase();
  const kind = percept.kind?.toLowerCase();
  const fired: Intention[] = [];
  for (const i of armed) {
    if (i.cue.kinds?.length && (!kind || !i.cue.kinds.includes(kind))) continue;
    let re: RegExp;
    try { re = new RegExp(i.cue.pattern, 'i'); } catch { continue; }
    if (re.test(text) || text.includes(i.cue.pattern.toLowerCase())) {
      i.status = 'fired';
      i.firedAt = Date.now();
      i.firedBy = percept.text.slice(0, 120);
      fired.push(i);
      try {
        speakInner({
          kind: 'attention', source: 'prospective-memory',
          text: `Prospective memory fired: "${i.note.slice(0, 80)}" — triggered by "${percept.text.slice(0, 60)}"`,
          surprise: 0.6, valence: 0.2,
        });
      } catch {}
    }
  }
  if (fired.length) save(load().map((x) => armed.find((a) => a.id === x.id) || x));
  return fired;
}

/** Check all armed intentions against a broadcast ignition. */
export function checkBroadcast(percept: { kind: string; text: string }): Intention[] {
  return checkCue({ kind: percept.kind, text: percept.text });
}

/**
 * cortex-live-tools.ts — live external-repo integrations for Cortex agent tools.
 *
 * Wires adopted OSS components into the governed tool executor:
 *  - notify:        ntfy.sh / Apprise push notifications (env-configured)
 *  - calendar:      macOS EventKit via osascript (list/create/delete events)
 *  - vision:        mlx-vlm sidecar (tools/perception-server.py :8940) — Qwen3-VL
 *  - emotion:       emotion2vec+ via funasr sidecar — speech affect
 *  - speaker:       sherpa-onnx speaker diarization/identification sidecar
 *
 * Everything fails soft: unconfigured integrations return { ok:false, reason }.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const SIDECAR = process.env.CORTEX_PERCEPTION_URL || 'http://127.0.0.1:8940';
const EMOTION_SIDECAR = process.env.CORTEX_EMOTION_URL || 'http://127.0.0.1:8941';

function sidecarFetch(route: string, init?: RequestInit, timeoutMs = 120_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(`${SIDECAR}${route}`, { ...init, signal: ctrl.signal })
    .finally(() => clearTimeout(t));
}

// ---------------------------------------------------------------- notify

/** Push notification via ntfy (topic from env) or Apprise (APPRISE_URL). */
export async function notify(args: Record<string, any>) {
  const title = String(args?.title || 'Cortex').slice(0, 200);
  const message = String(args?.message || args?.body || '').slice(0, 4000);
  const priority = Math.min(5, Math.max(1, Number(args?.priority) || 3));
  const tags = String(args?.tags || '').slice(0, 200);
  if (!message) return { ok: false, reason: 'message required' };

  const ntfyTopic = process.env.NTFY_TOPIC || process.env.NTFY_URL?.replace(/\/$/, '').split('/').pop();
  const appriseUrl = process.env.APPRISE_URL;

  const sent: string[] = [];
  const errors: string[] = [];

  if (ntfyTopic) {
    try {
      const base = process.env.NTFY_URL || 'https://ntfy.sh';
      const res = await fetch(`${base.replace(/\/$/, '')}/${encodeURIComponent(ntfyTopic)}`, {
        method: 'POST',
        headers: {
          Title: encodeURIComponent(title),
          Priority: String(priority),
          Tags: tags,
        },
        body: message,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) sent.push('ntfy'); else errors.push(`ntfy HTTP ${res.status}`);
    } catch (e: any) { errors.push(`ntfy: ${e?.message || e}`); }
  }

  if (appriseUrl) {
    try {
      const res = await fetch(appriseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: message, type: 'info' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) sent.push('apprise'); else errors.push(`apprise HTTP ${res.status}`);
    } catch (e: any) { errors.push(`apprise: ${e?.message || e}`); }
  }

  if (!sent.length && !errors.length) {
    return { ok: false, reason: 'no notification channel configured (set NTFY_TOPIC or APPRISE_URL)' };
  }
  return { ok: sent.length > 0, sent, errors: errors.length ? errors : undefined };
}

// ---------------------------------------------------------------- calendar

function osascript(script: string, timeoutMs = 15_000) {
  return execFileP('osascript', ['-e', script], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
}

const CAL_ESC = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Calendar actions via EventKit AppleScript: list | today | create | delete. */
export async function calendar(args: Record<string, any>) {
  const action = String(args?.action || 'today').trim();

  if (action === 'list' || action === 'today' || action === 'week') {
    const days = action === 'week' ? 7 : action === 'list' ? Number(args?.days) || 7 : 1;
    const script = `
      set startDate to (current date)
      set endDate to startDate + (${days} * days)
      tell application "Calendar"
        set out to ""
        repeat with c in calendars
          try
            if not (writable of c) then error number -1
            set evs to (every event of c whose start date is greater than or equal to startDate and start date is less than endDate)
            repeat with e in evs
              set out to out & (summary of e) & "|" & ((start date of e) as string) & "|" & (name of c) & linefeed
            end repeat
          end try
        end repeat
        return out
      end tell`;
    const { stdout } = await osascript(script);
    const events = String(stdout).split('\n').filter(Boolean).map((line) => {
      const [summary, when, cal] = line.split('|');
      return { summary, start: when, calendar: cal };
    });
    return { ok: true, action, count: events.length, events };
  }

  if (action === 'create') {
    const summary = String(args?.title || args?.summary || '').trim();
    if (!summary) return { ok: false, reason: 'title required' };
    const start = String(args?.start || args?.datetime || '');
    const durationMin = Number(args?.durationMinutes ?? args?.duration) || 60;
    const calendarName = String(args?.calendar || '');
    const notes = String(args?.notes || args?.description || '');
    const startExpr = start
      ? `(date "${CAL_ESC(start)}")`
      : '(current date)';
    const calClause = calendarName ? `calendar "${CAL_ESC(calendarName)}"` : 'calendar 1';
    const script = `
      tell application "Calendar"
        set calObj to ${calClause}
        set newEvent to make new event at end of events of calObj with properties {summary:"${CAL_ESC(summary)}", start date:${startExpr}, end date:(${startExpr}) + (${durationMin} * minutes)${notes ? `, description:"${CAL_ESC(notes)}"` : ''}}
        return summary of newEvent
      end tell`;
    const { stdout } = await osascript(script);
    return { ok: true, action, created: String(stdout).trim() };
  }

  if (action === 'delete') {
    const title = String(args?.title || '').trim();
    if (!title) return { ok: false, reason: 'title required' };
    const script = `
      tell application "Calendar"
        set matched to {}
        repeat with c in calendars
          try
            set evs to (every event of c whose summary contains "${CAL_ESC(title)}")
            repeat with e in evs
              set end of matched to e
            end repeat
          end try
        end repeat
        set n to count of matched
        repeat with e in matched
          delete e
        end repeat
        return n
      end tell`;
    const { stdout } = await osascript(script);
    return { ok: true, action, deleted: Number(String(stdout).trim()) || 0 };
  }

  return { ok: false, reason: `unknown action "${action}" (list|today|week|create|delete)` };
}

// ---------------------------------------------------------------- perception sidecar

async function sidecarHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SIDECAR}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

function safeLocalPath(p: string): string | null {
  const resolved = path.resolve(ROOT, p);
  return resolved.startsWith(ROOT) ? resolved : null;
}

/** Vision: describe/answer questions about a local image via mlx-vlm sidecar. */
export async function vision(args: Record<string, any>) {
  const image = String(args?.image || args?.path || '').trim();
  const question = String(args?.question || args?.prompt || 'Describe this image in detail.');
  if (!image) return { ok: false, reason: 'image path required' };
  const local = safeLocalPath(image);
  if (!local || !fs.existsSync(local)) return { ok: false, reason: `image not found or outside workspace: ${image}` };
  if (!(await sidecarHealth())) return { ok: false, reason: `perception sidecar not running at ${SIDECAR} (tools/perception-server.py)` };

  const res = await sidecarFetch('/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: local, prompt: question }),
  });
  if (!res.ok) return { ok: false, reason: `sidecar HTTP ${res.status}` };
  const data: any = await res.json();
  return { ok: true, model: data.model, answer: data.answer, raw: data.raw };
}

/** Emotion: speech affect analysis via emotion2vec+ sidecar. */
export async function emotion(args: Record<string, any>) {
  const audio = String(args?.audio || args?.path || '').trim();
  if (!audio) return { ok: false, reason: 'audio path required' };
  const local = safeLocalPath(audio);
  if (!local || !fs.existsSync(local)) return { ok: false, reason: `audio not found or outside workspace: ${audio}` };
  try {
    const h = await fetch(`${EMOTION_SIDECAR}/health`, { signal: AbortSignal.timeout(2000) });
    if (!h.ok) throw new Error('down');
  } catch { return { ok: false, reason: `emotion sidecar not running at ${EMOTION_SIDECAR} (tools/emotion-server.py, needs python<=3.13 venv)` }; }

  const res = await fetch(`${EMOTION_SIDECAR}/emotion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: local }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return { ok: false, reason: `sidecar HTTP ${res.status}` };
  const data: any = await res.json();
  return { ok: data.ok !== false, ...data };
}

/** Speaker: diarization/identification via sherpa-onnx sidecar. */
export async function speaker(args: Record<string, any>) {
  const audio = String(args?.audio || args?.path || '').trim();
  if (!audio) return { ok: false, reason: 'audio path required' };
  const local = safeLocalPath(audio);
  if (!local || !fs.existsSync(local)) return { ok: false, reason: `audio not found or outside workspace: ${audio}` };
  if (!(await sidecarHealth())) return { ok: false, reason: `perception sidecar not running at ${SIDECAR}` };

  const res = await sidecarFetch('/speaker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: local, numSpeakers: args?.numSpeakers ? Number(args.numSpeakers) : undefined }),
  });
  if (!res.ok) return { ok: false, reason: `sidecar HTTP ${res.status}` };
  return { ok: true, ...(await res.json()) };
}

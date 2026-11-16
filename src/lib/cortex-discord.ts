/**
 * Cortex Discord surface — transport module.
 *
 * Discord is a surface, not a brain: interactions in → Cortex runtime calls →
 * messages out. No discord.js, no gateway — HTTP interactions verified by
 * Ed25519 signature + bot-token REST for outbound posts.
 *
 * Research basis: CORTEX_DISCORD_RESEARCH.md. Contract: CORTEX_DISCORD_SPEC.md.
 * Honesty contract: every message traces to a real object (snapshot, ledger
 * line, proposal, task result). No fabricated status.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ── Types ──────────────────────────────────────────────────────────

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordComponent {
  type: number;
  components?: DiscordComponent[];
  custom_id?: string;
  label?: string;
  style?: number;
  disabled?: boolean;
}

export interface InteractionResponse {
  type: number;
  data?: {
    content?: string;
    embeds?: DiscordEmbed[];
    components?: DiscordComponent[];
    flags?: number;
  };
}

export interface ProposalLike {
  id: string;
  title: string;
  summary?: string;
  urgency?: string;
  category?: string;
  confidence?: number;
  epistemicConfidence?: number;
  status?: string;
  createdAt?: number;
  why?: string;
}

export interface ForecastLike {
  id?: string;
  domain?: string;
  claim?: string;
  confidence?: number;
  urgency?: string;
  tier?: number;
  evidence?: { kind?: string; ref?: string }[];
  at?: string;
  ts?: number;
}

export interface DiscordDeps {
  ownerId: string;
  getSnapshot: () => Promise<any> | any;
  getPendingProposals: () => ProposalLike[];
  acceptProposal: (id: string) => boolean;
  dismissProposal: (id: string) => boolean;
  submitTask: (agentId: string, kind: string, title: string, input?: any) => { ok: boolean; task?: { id?: string }; error?: string };
  /** Fire-and-forget hook invoked after a successful /cortex ask — used to
   *  spawn the task thread. Receives the raw interaction payload + job info. */
  afterAsk?: (payload: any, job: { agentId: string; kind: string; title: string; taskId?: string; channelId: string }) => void;
  listForecasts: () => ForecastLike[];
  listCalendarEvents: () => { title: string; start: number }[];
  getOutputMode: () => 'low' | 'medium' | 'high';
  setOutputMode: (mode: 'low' | 'medium' | 'high') => void;
  stateDir?: string;
  now?: () => number;
}

// ── Signature verification ─────────────────────────────────────────

/** Discord interactions use Ed25519. publicKey is hex (64 chars). */
export function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKeyHex: string,
): boolean {
  try {
    if (!signature || !timestamp || !publicKeyHex) return false;
    const key = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b6570032100', 'hex'),
        Buffer.from(publicKeyHex, 'hex'),
      ]),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(
      null,
      Buffer.from(timestamp + rawBody),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

// ── Bot REST client ────────────────────────────────────────────────

const DISCORD_API = 'https://discord.com/api/v10';

export async function discordApi(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  apiPath: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<any> {
  const res = await fetch(`${DISCORD_API}${apiPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bot ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord API ${method} ${apiPath} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Slash command registration ─────────────────────────────────────

export function buildCommandSpecs(): any[] {
  const opt = (name: string, description: string, required = false) => ({
    type: 3, name, description, required,
  });
  return [
    {
      name: 'cortex',
      description: 'Cortex agent surface',
      options: [
        {
          type: 1, name: 'status', description: 'Agent fleet snapshot',
        },
        {
          type: 1, name: 'digest', description: 'Morning-brief style summary',
        },
        {
          type: 1, name: 'forecast', description: 'Recent evidence-backed forecasts',
        },
        {
          type: 1, name: 'proposals', description: 'Pending initiative proposals',
        },
        {
          type: 1, name: 'ask',
          description: 'Send a task to a Cortex agent',
          options: [opt('text', 'What should Cortex do?', true)],
        },
        {
          type: 1, name: 'outputmode',
          description: 'Reply detail level',
          options: [{
            type: 3, name: 'mode', description: 'Detail level', required: true,
            choices: [
              { name: 'low', value: 'low' },
              { name: 'medium', value: 'medium' },
              { name: 'high', value: 'high' },
            ],
          }],
        },
        {
          type: 1, name: 'approve', description: 'Approve a proposal by id',
          options: [opt('id', 'Proposal id', true)],
        },
        {
          type: 1, name: 'dismiss', description: 'Dismiss a proposal by id',
          options: [opt('id', 'Proposal id', true)],
        },
      ],
    },
  ];
}

// ── Message builders (pure, testable) ──────────────────────────────

const AGENT_LABELS: Record<string, string> = {
  sentinel: 'SENTINEL', scout: 'SCOUT', librarian: 'LIBRARIAN', builder: 'BUILDER',
  reviewer: 'REVIEWER', runner: 'RUNNER', distributor: 'DISTRIBUTOR', warden: 'WARDEN',
  forecaster: 'FORECASTER', prep: 'PREP',
};

export function formatFleetStatus(snapshot: any): { content: string; embeds: DiscordEmbed[] } {
  const agents: any[] = Array.isArray(snapshot?.agents) ? snapshot.agents : [];
  const tasks: any[] = Array.isArray(snapshot?.tasks) ? snapshot.tasks : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTasks = tasks.filter((t) => Number(t?.createdAt || 0) >= today.getTime());
  const doneToday = todayTasks.filter((t) => t?.status === 'done' || t?.status === 'completed').length;
  const failedToday = todayTasks.filter((t) => t?.status === 'failed' || t?.status === 'error').length;
  const active = agents.filter((a) => a?.status === 'active' || a?.status === 'idle' || a?.status === 'running').length;

  const embed: DiscordEmbed = {
    title: 'Cortex Fleet',
    color: failedToday > 0 ? 0xed4245 : 0x57f287,
    timestamp: new Date().toISOString(),
    fields: [
      { name: 'Agents', value: `${active}/${agents.length || '—'} active`, inline: true },
      { name: 'Tasks today', value: `${doneToday} done · ${failedToday} failed`, inline: true },
      { name: 'Queue', value: String(tasks.filter((t) => t?.status === 'queued' || t?.status === 'pending').length), inline: true },
    ],
  };
  const lines = agents.slice(0, 12).map((a) => {
    const label = AGENT_LABELS[String(a?.id || '')] || String(a?.id || '?').toUpperCase();
    const failed = Number(a?.tasksFailed || 0);
    return `${label} — ${a?.status || 'unknown'}${failed ? ` · ${failed} failed` : ''}`;
  });
  if (lines.length) embed.fields!.push({ name: 'Roster', value: lines.join('\n').slice(0, 1000) });
  return { content: '', embeds: [embed] };
}

export function formatForecastList(forecasts: ForecastLike[], limit = 5): string {
  const recent = forecasts.slice(-limit).reverse();
  if (!recent.length) return 'No forecasts logged yet — FORECASTER has not emitted a signal.';
  return recent.map((f) => {
    const conf = typeof f.confidence === 'number' ? ` · ${Math.round(f.confidence * 100)}%` : '';
    const urg = f.urgency ? ` [${f.urgency}]` : '';
    return `• **${f.domain || 'signal'}**${urg}${conf}\n  ${String(f.claim || '').slice(0, 180)}`;
  }).join('\n');
}

export function formatProposalsList(proposals: ProposalLike[]): string {
  if (!proposals.length) return 'No pending proposals — inbox clear.';
  return proposals.slice(0, 10).map((p) => {
    const conf = typeof p.epistemicConfidence === 'number' ? ` · ${Math.round(p.epistemicConfidence * 100)}%` : '';
    return `• \`${p.id}\` **${p.title}** (${p.urgency || 'normal'}${conf})`;
  }).join('\n');
}

export function formatProposalCard(p: ProposalLike): { embeds: DiscordEmbed[]; components: DiscordComponent[] } {
  const conf = typeof p.epistemicConfidence === 'number' ? Math.round(p.epistemicConfidence * 100) : null;
  const color = p.urgency === 'high' ? 0xed4245 : p.urgency === 'medium' ? 0xfee75c : 0x5865f2;
  const embed: DiscordEmbed = {
    title: `Proposal: ${String(p.title || 'untitled').slice(0, 250)}`,
    color,
    timestamp: new Date(p.createdAt || Date.now()).toISOString(),
    fields: [
      ...(p.summary ? [{ name: 'Summary', value: String(p.summary).slice(0, 1000) }] : []),
      ...(p.category ? [{ name: 'Category', value: p.category, inline: true }] : []),
      ...(conf !== null ? [{ name: 'Confidence', value: `${conf}%`, inline: true }] : []),
      ...(p.why ? [{ name: 'Why', value: String(p.why).slice(0, 300) }] : []),
    ],
  };
  const components: DiscordComponent[] = [{
    type: 1,
    components: [
      { type: 2, style: 3, label: 'Approve', custom_id: `cxok:${p.id}` },
      { type: 2, style: 4, label: 'Dismiss', custom_id: `cxdsm:${p.id}` },
    ],
  }];
  return { embeds: [embed], components };
}

export function formatDigest(input: {
  events: { title: string; start: number }[];
  pendingProposals: ProposalLike[];
  forecasts: ForecastLike[];
  snapshot: any;
  now?: number;
}): string {
  const now = input.now ?? Date.now();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const tasks: any[] = Array.isArray(input.snapshot?.tasks) ? input.snapshot.tasks : [];
  const todayTasks = tasks.filter((t) => Number(t?.createdAt || 0) >= dayStart.getTime());
  const done = todayTasks.filter((t) => t?.status === 'done' || t?.status === 'completed').length;
  const failed = todayTasks.filter((t) => t?.status === 'failed' || t?.status === 'error').length;
  const agents: any[] = Array.isArray(input.snapshot?.agents) ? input.snapshot.agents : [];
  const silentProbes = agents.length === 0 ? 0 : agents.filter((a) => a?.status === 'idle').length;

  const todayEvents = input.events
    .filter((e) => e.start >= dayStart.getTime() && e.start < dayStart.getTime() + 86400000)
    .slice(0, 3);
  const needsYou: string[] = [];
  if (input.pendingProposals.length) needsYou.push(`${input.pendingProposals.length} proposal${input.pendingProposals.length === 1 ? '' : 's'} awaiting approval`);
  const urgentForecast = [...input.forecasts].reverse().find((f) => f.urgency === 'high' || (typeof f.confidence === 'number' && f.confidence >= 0.8));
  if (urgentForecast?.claim) needsYou.push(`forecast: ${String(urgentForecast.claim).slice(0, 100)}`);
  const fyi = [...input.forecasts].reverse().find((f) => f !== urgentForecast && f.claim);

  const lines = ['**Morning — Cortex**', ''];
  lines.push('**Today:**');
  if (todayEvents.length) {
    for (const e of todayEvents) {
      const d = new Date(e.start);
      lines.push(`• ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} — ${e.title}`);
    }
  } else lines.push('• Nothing scheduled');
  lines.push('', '**Needs you:**');
  lines.push(...(needsYou.length ? needsYou.map((n) => `• ${n}`) : ['• Nothing blocking']));
  lines.push('', '**FYI:**');
  lines.push(`• ${fyi?.claim ? String(fyi.claim).slice(0, 140) : 'All probes quiet'}`);
  lines.push('', '**Handled:**');
  lines.push(`• ${done} tasks completed · ${failed} failed · ${silentProbes} agents idle`);
  return lines.join('\n').slice(0, 1900);
}

// ── Push budget (.cortex-runtime/discord-push.json) ────────────────

const PUSH_CAP_PER_DAY = 5;

interface PushState { day: string; count: number; lastDigestDay?: string; postedProposalIds?: string[]; postedForecastIds?: string[]; }

export function loadPushState(stateDir: string): PushState {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(stateDir, 'discord-push.json'), 'utf8'));
    return { day: '', count: 0, ...raw };
  } catch {
    return { day: '', count: 0 };
  }
}

export function savePushState(stateDir: string, state: PushState): void {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'discord-push.json'), JSON.stringify(state, null, 2));
  } catch {}
}

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Returns true and increments if under the daily proactive-post cap. */
export function consumePushBudget(stateDir: string, now = Date.now()): boolean {
  const s = loadPushState(stateDir);
  if (s.day !== dayKey(now)) { s.day = dayKey(now); s.count = 0; }
  if (s.count >= PUSH_CAP_PER_DAY) return false;
  s.count += 1;
  savePushState(stateDir, s);
  return true;
}

export function alreadyPosted(stateDir: string, kind: 'proposal' | 'forecast', id: string): boolean {
  const s = loadPushState(stateDir);
  const key = kind === 'proposal' ? 'postedProposalIds' : 'postedForecastIds';
  return Array.isArray(s[key]) && (s[key] as string[]).includes(id);
}

export function markPosted(stateDir: string, kind: 'proposal' | 'forecast', id: string): void {
  const s = loadPushState(stateDir);
  const key = kind === 'proposal' ? 'postedProposalIds' : 'postedForecastIds';
  s[key] = Array.isArray(s[key]) ? [...(s[key] as string[]), id] : [id];
  s[key] = (s[key] as string[]).slice(-200);
  savePushState(stateDir, s);
}

export function digestAlreadySent(stateDir: string, now = Date.now()): boolean {
  const s = loadPushState(stateDir);
  return s.lastDigestDay === dayKey(now);
}

export function markDigestSent(stateDir: string, now = Date.now()): void {
  const s = loadPushState(stateDir);
  s.lastDigestDay = dayKey(now);
  savePushState(stateDir, s);
}

// ── Interaction router ─────────────────────────────────────────────

const EPHEMERAL = 64;

function subcommandName(payload: any): string {
  const opt = payload?.data?.options?.[0];
  return String(opt?.name || '').toLowerCase();
}

function subcommandOpt(payload: any, name: string): string {
  const sub = payload?.data?.options?.[0];
  const opt = sub?.options?.find((o: any) => o.name === name);
  return String(opt?.value ?? '');
}

/** Route a free-text ask to an agent. Keyword map; default runner. */
export function routeAskAgent(text: string): { agentId: string; kind: string } {
  const t = text.toLowerCase();
  if (/research|search|look up|find out|scan|repo/.test(t)) return { agentId: 'scout', kind: 'research' };
  if (/forecast|predict|what.*(wrong|right)|risk/.test(t)) return { agentId: 'forecaster', kind: 'forecast_cycle' };
  if (/prep|brief|meeting/.test(t)) return { agentId: 'prep', kind: 'prep_brief' };
  if (/build|code|implement|fix|write/.test(t)) return { agentId: 'builder', kind: 'build_task' };
  if (/distribut|post|publish|pin|reddit|gumroad/.test(t)) return { agentId: 'distributor', kind: 'distribution_task' };
  if (/review|audit|check/.test(t)) return { agentId: 'reviewer', kind: 'review_task' };
  return { agentId: 'runner', kind: 'run_task' };
}

export async function handleDiscordInteraction(
  payload: any,
  deps: DiscordDeps,
): Promise<InteractionResponse> {
  const userId = String(payload?.user?.id || payload?.member?.user?.id || '');
  const isOwner = userId === deps.ownerId;

  // PING (type 1) — must respond immediately.
  if (payload?.type === 1) return { type: 1 };

  // MESSAGE_COMPONENT (type 3) — proposal approve/dismiss buttons.
  if (payload?.type === 3) {
    const customId = String(payload?.data?.custom_id || '');
    if (!isOwner) {
      return { type: 4, data: { content: 'Not authorized.', flags: EPHEMERAL } };
    }
    const m = customId.match(/^cx(ok|dsm):(.+)$/);
    if (!m) return { type: 4, data: { content: 'Unknown component.', flags: EPHEMERAL } };
    const [, action, proposalId] = m;
    const ok = action === 'ok'
      ? deps.acceptProposal(proposalId)
      : deps.dismissProposal(proposalId);
    const messageId = String(payload?.message?.id || '');
    const channelId = String(payload?.channel_id || '');
    return {
      type: 7, // UPDATE_MESSAGE — retire buttons, show decision in place
      data: {
        content: ok
          ? `**${action === 'ok' ? 'Approved' : 'Dismissed'}** \`${proposalId}\` by <@${userId}>`
          : `Could not ${action === 'ok' ? 'approve' : 'dismiss'} \`${proposalId}\` (already resolved or unknown).`,
        embeds: payload?.message?.embeds || [],
        components: [],
      },
    };
  }

  // APPLICATION_COMMAND (type 2) — /cortex subcommands.
  if (payload?.type !== 2) return { type: 4, data: { content: 'Unsupported interaction.', flags: EPHEMERAL } };
  if (!isOwner) {
    return { type: 4, data: { content: 'Cortex commands are owner-only.', flags: EPHEMERAL } };
  }

  const sub = subcommandName(payload);

  switch (sub) {
    case 'status': {
      const snap = await deps.getSnapshot();
      const { embeds } = formatFleetStatus(snap);
      return { type: 4, data: { embeds } };
    }
    case 'forecast': {
      const forecasts = deps.listForecasts();
      return { type: 4, data: { content: formatForecastList(forecasts).slice(0, 1900) } };
    }
    case 'proposals': {
      const proposals = deps.getPendingProposals();
      if (!proposals.length) {
        return { type: 4, data: { content: formatProposalsList(proposals) } };
      }
      // Show first proposal as a card so it can be approved inline.
      const card = formatProposalCard(proposals[0]);
      const rest = proposals.length > 1 ? `\n\n*+${proposals.length - 1} more — use /cortex approve <id>*` : '';
      return {
        type: 4,
        data: {
          content: `Pending proposals (${proposals.length}):\n${formatProposalsList(proposals.slice(1))}${rest}`.slice(0, 1900),
          embeds: card.embeds,
          components: card.components,
        },
      };
    }
    case 'digest': {
      const [snap, proposals, forecasts, events] = await Promise.all([
        deps.getSnapshot(),
        Promise.resolve(deps.getPendingProposals()),
        Promise.resolve(deps.listForecasts()),
        Promise.resolve(deps.listCalendarEvents()),
      ]);
      return { type: 4, data: { content: formatDigest({ events, pendingProposals: proposals, forecasts, snapshot: snap }) } };
    }
    case 'ask': {
      const text = subcommandOpt(payload, 'text').trim();
      if (!text) return { type: 4, data: { content: 'Empty request.', flags: EPHEMERAL } };
      const { agentId, kind } = routeAskAgent(text);
      const res = deps.submitTask(agentId, kind, text.slice(0, 140), { source: 'discord', text });
      if (!res.ok) {
        return { type: 4, data: { content: `Task rejected: ${res.error || 'unknown'}`, flags: EPHEMERAL } };
      }
      deps.afterAsk?.(payload, {
        agentId, kind, title: text.slice(0, 140),
        taskId: res.task?.id, channelId: String(payload?.channel_id || ''),
      });
      return { type: 4, data: { content: `Queued → **${AGENT_LABELS[agentId] || agentId}** (${kind}) — thread incoming. Track on the Agents tab or \`/cortex status\`.` } };
    }
    case 'outputmode': {
      const mode = subcommandOpt(payload, 'mode') as 'low' | 'medium' | 'high';
      if (!['low', 'medium', 'high'].includes(mode)) {
        return { type: 4, data: { content: 'Invalid mode.', flags: EPHEMERAL } };
      }
      deps.setOutputMode(mode);
      return { type: 4, data: { content: `Output mode set to **${mode}**.` } };
    }
    case 'approve':
    case 'dismiss': {
      const id = subcommandOpt(payload, 'id').trim();
      if (!id) return { type: 4, data: { content: 'Missing proposal id.', flags: EPHEMERAL } };
      const ok = sub === 'approve' ? deps.acceptProposal(id) : deps.dismissProposal(id);
      return {
        type: 4,
        data: { content: ok ? `**${sub === 'approve' ? 'Approved' : 'Dismissed'}** \`${id}\`.` : `Could not resolve \`${id}\` — already decided or unknown.` },
      };
    }
    default:
      return { type: 4, data: { content: `Unknown subcommand \`${sub}\`. Try status, digest, forecast, proposals, ask, outputmode, approve, dismiss.`, flags: EPHEMERAL } };
  }
}

// ── Task threads (thread-per-ask) ───────────────────────────────────
// REST-only model: no gateway needed. /cortex ask spawns a thread on a bot
// message; a poller watches tracked threads for (a) task completion → posts
// the result, (b) new user messages → submits follow-up tasks. Threads
// auto-archive via Discord (24h) — no cleanup job needed.

export interface DiscordThreadRecord {
  threadId: string;
  taskId: string;
  agentId: string;
  title: string;
  channelId: string;
  createdAt: number;
  lastMessageId?: string;
  resultPosted?: boolean;
  /** Follow-up task ids submitted from thread replies — results post here too. */
  pendingTaskIds?: string[];
  postedTaskIds?: string[];
}

const THREADS_FILE = 'discord-threads.json';

export function loadDiscordThreads(stateDir: string): Record<string, DiscordThreadRecord> {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(stateDir, THREADS_FILE), 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

export function saveDiscordThreads(stateDir: string, threads: Record<string, DiscordThreadRecord>): void {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    const entries = Object.entries(threads).slice(-100); // cap tracked threads
    fs.writeFileSync(path.join(stateDir, THREADS_FILE), JSON.stringify(Object.fromEntries(entries), null, 2));
  } catch {}
}

export function threadNameFor(text: string): string {
  const clean = text.replace(/[#\n*`>\\|]/g, ' ').replace(/\s+/g, ' ').trim();
  return (`${clean || 'cortex task'}`).slice(0, 90) || 'cortex task';
}

/** Format an agent task's terminal state for posting into its thread. */
export function formatTaskResult(task: any): { done: boolean; content: string } {
  const status = String(task?.status || '');
  if (status === 'done' || status === 'completed') {
    const res = task?.result;
    const summary = typeof res === 'string' ? res
      : res && typeof res === 'object'
        ? (res.summary || res.note || JSON.stringify(res).slice(0, 400))
        : '';
    return { done: true, content: `✅ **Done** — ${String(summary || 'task completed').slice(0, 1500)}` };
  }
  if (status === 'failed' || status === 'error' || status === 'cancelled') {
    return { done: true, content: `❌ **${status === 'cancelled' ? 'Cancelled' : 'Failed'}** — ${String(task?.error || 'unknown error').slice(0, 500)}` };
  }
  return { done: false, content: '' };
}

/**
 * cortex-agent/loop — server-side ReAct agentic turn.
 *
 * One user turn → up to MAX_STEPS iterations of:
 *   LLM call → tool_call detection → governed tool execution → tool result
 *   appended as a real message → next LLM call.
 *
 * Runs entirely inside /api/ai/nexus-guest so EVERY surface (chat drawer,
 * visualizer, face page, mobile) gets identical multi-turn agency instead of
 * four divergent client-side loops. Tool execution goes through the existing
 * /api/cortex/tools/execute endpoint (self-fetch) so all governance, audit,
 * and volitional checks apply unchanged.
 *
 * Protocol support:
 *   - openai:    message.tool_calls + role:'tool' result messages
 *   - anthropic: tool_use content blocks + tool_result user blocks
 *   - fallback:  fenced ```tool_call JSON parsed from text content
 */
import { repairJsonArgs } from '../cortex-tool-args';

export interface AgentProvider {
  name: string;
  url: string;
  model: string;
  key: string;
  keys?: string[];
  backupKey?: string;
  protocol?: 'openai' | 'anthropic';
  /** Per-attempt request timeout override. Big reasoning models need
   *  longer than the 30s default — aborting mid-generation just burns
   *  the attempt and fails over to the next provider, which repeats
   *  the same slow generation from scratch. */
  timeoutMs?: number;
}

export interface AgentToolCall {
  id: string;
  name: string;
  /** Raw JSON string as emitted by the provider. */
  argsRaw: string;
  args: Record<string, unknown>;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

export interface AgentLoopDeps {
  providers: AgentProvider[];
  /** Execute one tool; resolves to the tool result object. */
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Optional SSE/meta emitter for progress events. */
  emit?: (event: Record<string, unknown>) => void;
  /** Optional visible status token writer (SSE token). */
  emitToken?: (text: string) => void;
  /** Tool schemas for arg repair hints (name → parameters). */
  tools?: unknown;
  maxSteps?: number;
  maxTokens?: number;
  temperature?: number;
  /** Whole-loop wall-clock override. Default stays under the voice-turn
   *  ceiling; chat/SSE surfaces may pass a larger budget for deep-tier
   *  multi-step turns. */
  maxLoopMs?: number;
  /** Deterministic first action — pending intention resumed on affirmation. */
  initialToolCall?: { name: string; args: Record<string, unknown>; kind?: 'intention' | 'reflex' } | null;
}

export interface AgentLoopResult {
  content: string;
  steps: number;
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; ok: boolean }>;
  provider: string;
  error?: string;
  /** True when the final answer already streamed live to emitToken —
   *  callers must NOT replay it token-by-token. */
  contentStreamed?: boolean;
}

/** Human narration for tool steps — "I need to fetch this URL" energy,
 *  not raw tool names. Used for the visible status tokens. */
export function friendlyToolLabel(name: string, args: Record<string, unknown>): string {
  const a = args || {};
  switch (name) {
    case 'fetch_url': return `Pulling up ${String(a.url || 'the page').slice(0, 60)}…`;
    case 'web_search': return `Searching the web for "${String(a.query || '').slice(0, 50)}"…`;
    case 'search_code': return `Searching the codebase for "${String(a.query || '').slice(0, 50)}"…`;
    case 'run_command': return `Running: ${String(a.command || '').slice(0, 60)}…`;
    case 'read_file': return `Reading ${String(a.path || 'the file').slice(0, 60)}…`;
    case 'write_file': return `Writing ${String(a.path || 'the file').slice(0, 60)}…`;
    case 'edit_file': return `Editing ${String(a.path || 'the file').slice(0, 60)}…`;
    case 'list_dir': return `Listing ${String(a.path || 'the directory').slice(0, 50)}…`;
    case 'chrome_control': {
      const act = String(a.action || '');
      if (act === 'open_url') return `Opening ${String(a.url || 'the page').slice(0, 55)} in the browser…`;
      if (act === 'list_tabs') return 'Checking open browser tabs…';
      if (act === 'close_tabs') return 'Tidying up browser tabs…';
      return `Browser: ${act || 'working'}…`;
    }
    case 'cortex_memory': return `Checking memory…`;
    case 'resonance_status': return 'Checking fleet coherence…';
    case 'system_info': return 'Checking host system info…';
    case 'create_document': return `Drafting "${String(a.title || 'document').slice(0, 40)}"…`;
    case 'create_spreadsheet': return `Building "${String(a.title || 'spreadsheet').slice(0, 40)}"…`;
    case 'scaffold_web_project': return `Scaffolding "${String(a.title || a.project_slug || 'project').slice(0, 40)}"…`;
    case 'generate_splat': return 'Generating 3D splat…';
    case 'compose_dashboard': return 'Composing the dashboard…';
    case 'emit_artifact': return 'Emitting the visual artifact…';
    case 'cortex_agents': return 'Coordinating with the agent fleet…';
    case 'cortex_skill_discovery': return 'Discovering skills…';
    case 'get_somatic_homeostasis': return 'Reading somatic state…';
    case 'cortex_dream_consolidate': return 'Running memory consolidation…';
    default: return `Working: ${name.replace(/_/g, ' ')}…`;
  }
}

const MAX_STEPS_DEFAULT = 6;

/**
 * turnLikelyNeedsTools — responsiveness router.
 *
 * The agentic loop's first LLM call is NON-STREAMING: nothing reaches the
 * client until the whole response generates, then tokens are replayed.
 * That's correct for tool turns (narration + steps cover the wait) but
 * deadly for chit-chat — a greeting would wait for a full reason-tier
 * completion before the first word.
 *
 * This classifier decides whether a turn should enter the agentic loop at
 * all. Chit-chat falls through to the legacy streaming path (fast tier,
 * progressive tokens, ~sub-second TTFT). Tool-looking turns stay agentic.
 * A miss degrades gracefully: the legacy path still parses fenced
 * tool_calls client-side and the intention ledger catches offers.
 */
const TOOL_TURN_RE = new RegExp(
  [
    'https?://',                          // explicit URL
    '\\b(fetch|pull up|open|browse|scrape|read|show me|find|search|look up|'
    + 'google|inspect|scan|analy[sz]e|summari[sz]e|explain\s+this\s+(?:file|code|error)|'
    + 'run|execute|launch|install|deploy|build|compile|test|debug|fix|'
    + 'list|ls\\b|dir\\b|what(?:\'s| is)\s+in|show\s+(?:me\s+)?(?:the\s+)?(?:files?|directory|folder|contents)|'
    + 'read\s+(?:the\s+)?(?:file|code|log|config)|'
    + 'create|write|edit|update|delete|move|copy|rename|generate|compose|draft|'
    + 'system[_ ]info|system\\s+(?:status|health)|clipboard|cpu|memory usage|disk space|processes?|ports?|logs?\\b|'
    + 'weather|forecast|time\\b|date\\b|calendar|schedule|email|message|send|'
    + 'translate|convert|calculate|math|screenshot|record|capture|'
    + 'cortex[_ ]?(?:agents?|fleet|memory|dream|skill|tool)|agent[_ ]?status|'
    + 'browser|chrome|tab\\b|navigate|click|type\\s+into|form\\b|'
    + 'git\\s+(?:status|log|diff|commit|push|pull|branch)|npm\\s+(?:run|install|test)|'
    + 'deploy|server|endpoint|api\\b|database|sql\\b|query\\b)',
  ].join('|'),
  'i',
);

export function turnLikelyNeedsTools(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/https?:\/\//i.test(t)) return true;
  // Very short turns are almost always chit-chat unless they contain a URL.
  if (t.length < 12) return false;
  return TOOL_TURN_RE.test(t);
}
const MAX_TOOL_CALLS_PER_STEP = 2;
// 30s per key attempt: with a ~14-provider reason chain, 60s timeouts
// could burn 90s+ before failover — past the voice turn deadline.
const REQUEST_TIMEOUT_MS = 30_000;
// Whole-loop wall clock: past this, return what we have gracefully
// instead of letting the client deadline abort mid-thought.
// Whole-loop deadline must stay under the voice turn ceiling (~200s)
// so a slow-but-progressing turn finishes instead of asking the user
// to say "retry". Genuine stalls still die here.
const MAX_LOOP_MS = 170_000;
const HEARTBEAT_MS = 8_000;

/** Wrap executeTool with periodic ping events so SSE clients with
 *  token-silence watchdogs (voice path: 12s) don't abort during long
 *  tool runs. Pings are data lines, not tokens — invisible in content. */
function withHeartbeat(
  executeTool: AgentLoopDeps['executeTool'],
  emit: AgentLoopDeps['emit'],
): AgentLoopDeps['executeTool'] {
  if (!emit) return executeTool;
  return async (name, args) => {
    const beat = setInterval(() => {
      try { emit({ type: 'ping', tool: name }); } catch {}
    }, HEARTBEAT_MS);
    try {
      return await executeTool(name, args);
    } finally {
      clearInterval(beat);
    }
  };
}

// ── Provider call (non-streaming) ─────────────────────────────────

export interface LLMTurnResult {
  content: string;
  toolCalls: AgentToolCall[];
  provider: string;
  model: string;
  protocol: 'openai' | 'anthropic';
  rawAssistant: unknown;
  /** Unflushed content tail held back by the fence guard. Caller emits it
   *  only when the turn produced NO tool calls (safe to show); dropped when
   *  tools ran (it may contain a fenced tool_call payload). */
  tailPending?: string;
}

function keyPoolFor(p: AgentProvider): string[] {
  if (p.keys && p.keys.length) return p.keys;
  return p.backupKey ? [p.key, p.backupKey] : [p.key];
}

async function callProviderOnce(
  prov: AgentProvider,
  messages: AgentMessage[],
  systemPrompt: string,
  tools: unknown,
  maxTokens: number,
  temperature: number,
): Promise<LLMTurnResult> {
  const protocol = prov.protocol === 'anthropic' ? 'anthropic' : 'openai';
  const keys = keyPoolFor(prov);
  let lastErr: any = null;

  for (let ki = 0; ki < keys.length; ki++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), prov.timeoutMs ?? REQUEST_TIMEOUT_MS);
      let res: Response;
      if (protocol === 'anthropic') {
        // Convert OpenAI-shaped history into Anthropic content blocks.
        // - role 'tool'      → user message with a tool_result block
        // - __anthropic_blocks marker → decoded block array (assistant tool_use / user tool_result)
        // - plain text        → string content
        const anthropicMsgs: any[] = [];
        for (const m of messages) {
          if (m.role === 'tool') {
            anthropicMsgs.push({
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content || '' }],
            });
            continue;
          }
          if (m.role !== 'user' && m.role !== 'assistant') continue;
          let content: any = m.content || '';
          if (typeof content === 'string' && content.startsWith('{"__anthropic_blocks":')) {
            try { content = JSON.parse(content).__anthropic_blocks; } catch { /* keep string */ }
          }
          anthropicMsgs.push({ role: m.role, content });
        }
        res = await fetch(prov.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': keys[ki],
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: prov.model,
            system: systemPrompt,
            messages: anthropicMsgs,
            max_tokens: maxTokens,
            ...(tools ? {
              tools: (tools as any[]).map(t => ({
                name: t?.function?.name,
                description: t?.function?.description,
                input_schema: t?.function?.parameters,
              })).filter(t => t.name),
            } : {}),
          }),
          signal: ctrl.signal,
        });
      } else {
        res = await fetch(prov.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keys[ki]}`,
          },
          body: JSON.stringify({
            model: prov.model,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            max_tokens: maxTokens,
            temperature,
            stream: false,
            ...(tools ? { tools, tool_choice: 'auto' } : {}),
          }),
          signal: ctrl.signal,
        });
      }
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
        continue; // try next key
      }
      const data: any = await res.json();

      if (protocol === 'anthropic') {
        const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
        const content = blocks.filter(b => b?.type === 'text').map(b => b.text || '').join('');
        const toolCalls: AgentToolCall[] = blocks
          .filter(b => b?.type === 'tool_use' && b?.name)
          .map((b, i) => ({
            id: b.id || `tu-${Date.now()}-${i}`,
            name: b.name,
            argsRaw: JSON.stringify(b.input ?? {}),
            args: (b.input && typeof b.input === 'object') ? b.input : {},
          }));
        return { content, toolCalls, provider: prov.name, model: prov.model, protocol, rawAssistant: blocks };
      }

      // OpenAI-compatible
      const msg: any = data?.choices?.[0]?.message || {};
      const content: string = typeof msg.content === 'string' ? msg.content : '';
      const toolCalls: AgentToolCall[] = (Array.isArray(msg.tool_calls) ? msg.tool_calls : [])
        .filter((tc: any) => tc?.function?.name)
        .map((tc: any, i: number) => {
          const raw = typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {});
          const repaired = repairJsonArgs(raw);
          return {
            id: tc.id || `tc-${Date.now()}-${i}`,
            name: tc.function.name,
            argsRaw: raw,
            args: repaired.ok ? repaired.args : {},
          };
        });
      return { content, toolCalls, provider: prov.name, model: prov.model, protocol, rawAssistant: msg };
    } catch (e: any) {
      lastErr = e;
      if (ki < keys.length - 1) continue;
    }
  }
  throw lastErr || new Error(`all keys failed for ${prov.name}`);
}

// ── Streaming provider call (OpenAI-compatible SSE) ───────────────
//
// The responsiveness upgrade: instead of buffering the whole completion
// and replaying tokens, content deltas stream to the client LIVE while
// native tool_call fragments accumulate silently by index.
//
// Fence guard: a small tail (TAIL_HOLD chars) is always held back, and
// emission freezes at the first '```' — so a fenced ```tool_call payload
// can never leak into the visible stream. If the turn turns out to be a
// normal answer (or a code block), the caller flushes tailPending at end.
// If it's a tool call, tailPending is dropped — nothing leaks.

const STREAM_TAIL_HOLD = 16;

async function callProviderOnceStreaming(
  prov: AgentProvider,
  messages: AgentMessage[],
  systemPrompt: string,
  tools: unknown,
  maxTokens: number,
  temperature: number,
  emitToken: ((text: string) => void) | undefined,
  emit: ((event: Record<string, unknown>) => void) | undefined,
): Promise<LLMTurnResult> {
  const keys = keyPoolFor(prov);
  let lastErr: any = null;

  for (let ki = 0; ki < keys.length; ki++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), prov.timeoutMs ?? REQUEST_TIMEOUT_MS);
      const res = await fetch(prov.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keys[ki]}`,
        },
        body: JSON.stringify({
          model: prov.model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: maxTokens,
          temperature,
          stream: true,
          ...(tools ? { tools, tool_choice: 'auto' } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        clearTimeout(timer);
        lastErr = new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
        continue;
      }

      // ── SSE parse ──
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let content = '';
      let emittedLen = 0;
      let fencePos = -1;
      const tcMap = new Map<number, { id: string; name: string; argsRaw: string }>();
      let finishReason: string | null = null;
      let streamErr: any = null;

      const emitSafe = () => {
        if (!emitToken) { emittedLen = content.length; return; }
        const cap = fencePos >= 0 ? fencePos : content.length - STREAM_TAIL_HOLD;
        const safeLen = Math.max(emittedLen, Math.min(cap, content.length));
        if (safeLen > emittedLen) {
          emitToken(content.slice(emittedLen, safeLen));
          emittedLen = safeLen;
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            let j: any;
            try { j = JSON.parse(payload); } catch { continue; }
            const choice = j?.choices?.[0];
            if (!choice) continue;
            const delta = choice.delta || {};
            if (typeof delta.content === 'string' && delta.content) {
              content += delta.content;
              if (fencePos < 0) {
                const fp = content.indexOf('```');
                if (fp >= 0) fencePos = fp;
              }
              emitSafe();
            }
            // Reasoning deltas (deepseek/r1-style) → reasoning events, not speech.
            const reasoning = delta.reasoning_content ?? delta.reasoning;
            if (typeof reasoning === 'string' && reasoning) {
              try { emit?.({ type: 'REASONING_MESSAGE_CONTENT', reasoning }); } catch {}
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = typeof tc?.index === 'number' ? tc.index : 0;
                const slot = tcMap.get(idx) || { id: '', name: '', argsRaw: '' };
                if (tc.id) slot.id += tc.id;
                if (tc.function?.name) slot.name += tc.function.name;
                if (typeof tc.function?.arguments === 'string') slot.argsRaw += tc.function.arguments;
                tcMap.set(idx, slot);
              }
            }
            if (choice.finish_reason) finishReason = choice.finish_reason;
          }
        }
      } catch (e: any) {
        streamErr = e;
      } finally {
        clearTimeout(timer);
        try { reader.cancel(); } catch {}
      }
      if (streamErr) throw streamErr;

      const toolCalls: AgentToolCall[] = [...tcMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .filter(([, s]) => s.name)
        .map(([, s], i) => {
          const repaired = repairJsonArgs(s.argsRaw || '{}');
          return {
            id: s.id || `tc-${Date.now()}-${i}`,
            name: s.name,
            argsRaw: s.argsRaw || '{}',
            args: repaired.ok ? repaired.args : {},
          };
        });

      return {
        content,
        toolCalls,
        provider: prov.name,
        model: prov.model,
        protocol: 'openai',
        rawAssistant: { streamed: true, finishReason },
        tailPending: content.slice(emittedLen),
      };
    } catch (e: any) {
      lastErr = e;
      if (ki < keys.length - 1) continue;
    }
  }
  throw lastErr || new Error(`all keys failed for ${prov.name}`);
}

// ── Fenced tool_call fallback parser ──────────────────────────────

const FENCED_RE = /```(?:tool_call|json|tool)?\s*([\s\S]*?)```/g;

function extractFencedToolCalls(content: string): AgentToolCall[] {
  const calls: AgentToolCall[] = [];
  let m: RegExpExecArray | null;
  FENCED_RE.lastIndex = 0;
  while ((m = FENCED_RE.exec(content)) !== null) {
    const repaired = repairJsonArgs(m[1]);
    if (!repaired.ok) continue;
    const obj = repaired.args;
    const name = obj.tool || obj.name || obj.function?.name;
    if (typeof name !== 'string' || !name) continue;
    const rawArgs = obj.args || obj.parameters || obj.arguments
      || (typeof obj.function?.arguments === 'string' ? obj.function.arguments : obj.function?.arguments)
      || obj;
    const argsStr = typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs);
    const argRepaired = repairJsonArgs(argsStr);
    calls.push({
      id: `fenced-${Date.now()}-${calls.length}`,
      name,
      argsRaw: argsStr,
      args: argRepaired.ok ? argRepaired.args : {},
    });
  }
  return calls;
}

// ── Message history appenders (protocol-correct) ──────────────────

function appendOpenAITurn(
  messages: AgentMessage[],
  turn: LLMTurnResult,
  toolResults: Array<{ call: AgentToolCall; result: unknown }>,
): void {
  messages.push({
    role: 'assistant',
    content: turn.content || null,
    tool_calls: turn.toolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: tc.argsRaw },
    })),
  });
  for (const { call, result } of toolResults) {
    const payload = typeof result === 'string' ? result : JSON.stringify(result);
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      name: call.name,
      content: payload.length > 6000 ? payload.slice(0, 6000) + '\n…[truncated]' : payload,
    });
  }
}

function appendAnthropicTurn(
  messages: AgentMessage[],
  turn: LLMTurnResult,
  toolResults: Array<{ call: AgentToolCall; result: unknown }>,
): void {
  // Anthropic wants tool_result blocks inside a user message and tool_use
  // blocks inside the assistant message. Our AgentMessage is OpenAI-shaped;
  // we encode blocks into `content` as JSON for the converter in
  // callProviderOnce — simplest correct approach: keep a parallel structure.
  // For v1 we store a serialized marker the anthropic path understands.
  const assistantBlocks: any[] = [];
  if (turn.content) assistantBlocks.push({ type: 'text', text: turn.content });
  for (const tc of turn.toolCalls) {
    assistantBlocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
  }
  messages.push({ role: 'assistant', content: JSON.stringify({ __anthropic_blocks: assistantBlocks }) });
  const resultBlocks = toolResults.map(({ call, result }) => ({
    type: 'tool_result',
    tool_use_id: call.id,
    content: typeof result === 'string' ? result : JSON.stringify(result),
  }));
  messages.push({ role: 'user', content: JSON.stringify({ __anthropic_blocks: resultBlocks }) });
}

// ── Main loop ─────────────────────────────────────────────────────

export async function runAgenticTurn(
  systemPrompt: string,
  history: AgentMessage[],
  deps: AgentLoopDeps,
): Promise<AgentLoopResult> {
  const maxSteps = deps.maxSteps ?? MAX_STEPS_DEFAULT;
  const maxTokens = deps.maxTokens ?? 2048;
  const temperature = deps.temperature ?? 0.2;
  const tools = deps.tools;
  const messages: AgentMessage[] = [...history];
  const executeTool = withHeartbeat(deps.executeTool, deps.emit);
  const executed: AgentLoopResult['toolCalls'] = [];
  let finalContent = '';
  let contentStreamed = false;
  let lastProvider = '';
  let steps = 0;

  // ── Deterministic seed: pending intention resumed on affirmation ──
  if (deps.initialToolCall) {
    const seed = deps.initialToolCall;
    deps.emit?.({ type: 'tool_step', step: 0, tool: seed.name, status: seed.kind === 'reflex' ? 'reflex' : 'resumed_intention', args: seed.args });
    deps.emitToken?.(`\n\n*${friendlyToolLabel(seed.name, seed.args)}*\n\n`);
    try {
      const result = await executeTool(seed.name, seed.args);
      executed.push({ tool: seed.name, args: seed.args, ok: true });
      const seedResult = JSON.stringify(result);
      messages.push({
        role: 'user',
        content: `[Host Tool Execution Record — step 0, resumed pending intention]\nTool: ${seed.name}(${JSON.stringify(seed.args)})\nResult:\n${seedResult.slice(0, 6000)}`,
      });
      deps.emit?.({ type: 'tool_step', step: 0, tool: seed.name, status: 'done' });
    } catch (e: any) {
      executed.push({ tool: seed.name, args: seed.args, ok: false });
      messages.push({
        role: 'user',
        content: `[Host Tool Execution Record — step 0 FAILED]\nTool: ${seed.name}\nError: ${String(e?.message || e).slice(0, 400)}\nAdapt: try different args, an alternative tool, or report the blocker honestly.`,
      });
    }
    steps = 1;
  }

  const loopStart = Date.now();
  for (; steps < maxSteps; steps++) {
    // Whole-loop deadline: bail gracefully before the client turn timeout.
    if (Date.now() - loopStart > (deps.maxLoopMs ?? MAX_LOOP_MS)) {
      return {
        content: finalContent || 'That took longer than I like — the provider chain is degraded right now. Say "retry" and I will run it again.',
        steps, toolCalls: executed, provider: lastProvider,
        error: 'loop deadline exceeded',
      };
    }
    // ── LLM call across provider chain (first OK wins) ──
    // Heartbeat: provider calls can take 10-30s; silence would trip
    // client watchdogs (voice: 12s token-silence abort).
    const llmBeat = deps.emit ? setInterval(() => {
      try { deps.emit!({ type: 'ping', tool: 'llm' }); } catch {}
    }, HEARTBEAT_MS) : null;
    let turn: LLMTurnResult | null = null;
    let chainError: any = null;
    try {
      for (const prov of deps.providers) {
        // Provider-try telemetry: which lane is being attempted — makes
        // chain degradation visible in the SSE stream instead of silent pings.
        try { deps.emit?.({ type: 'provider_try', provider: prov.name, model: prov.model }); } catch {}
        try {
          // Stream OpenAI-compatible providers live; Anthropic stays
          // non-streaming (its SSE block protocol is a separate parser).
          turn = prov.protocol === 'anthropic'
            ? await callProviderOnce(prov, messages, systemPrompt, tools, maxTokens, temperature)
            : await callProviderOnceStreaming(prov, messages, systemPrompt, tools, maxTokens, temperature, deps.emitToken, deps.emit);
          lastProvider = `${prov.name}:${prov.model}`;
          break;
        } catch (e: any) {
          chainError = e;
          continue;
        }
      }
    } finally {
      if (llmBeat) clearInterval(llmBeat);
    }
    if (!turn) {
      return {
        content: finalContent || `Upstream providers unavailable (${String(chainError?.message || chainError).slice(0, 120)}).`,
        steps, toolCalls: executed, provider: lastProvider, error: String(chainError?.message || chainError).slice(0, 300),
      };
    }

    // Fenced fallback: small models emit ```tool_call instead of native calls.
    let calls = turn.toolCalls;
    if (!calls.length && turn.content && /```|tool_call/i.test(turn.content)) {
      calls = extractFencedToolCalls(turn.content);
    }
    if (!calls.length) {
      // Final answer: flush the fence-guard tail so nothing is lost
      // (code fences, trailing chars). Safe — no tool payload can be here.
      if (turn.tailPending) {
        try { deps.emitToken?.(turn.tailPending); } catch {}
      }
      contentStreamed = turn.tailPending !== undefined;
      finalContent = turn.content || finalContent;
      break;
    }
    // Tool turn: tailPending may contain a fenced tool_call payload — drop it.

    // ── Execute tool calls (bounded) ──
    const toRun = calls.slice(0, MAX_TOOL_CALLS_PER_STEP);
    const results: Array<{ call: AgentToolCall; result: unknown }> = [];
    for (const call of toRun) {
      deps.emit?.({ type: 'tool_step', step: steps + 1, tool: call.name, status: 'executing', args: call.args });
      deps.emitToken?.(`\n\n*${friendlyToolLabel(call.name, call.args)}*\n\n`);
      try {
        const result = await executeTool(call.name, call.args);
        results.push({ call, result });
        executed.push({ tool: call.name, args: call.args, ok: true });
        deps.emit?.({ type: 'tool_step', step: steps + 1, tool: call.name, status: 'done' });
      } catch (e: any) {
        results.push({ call, result: { ok: false, error: String(e?.message || e).slice(0, 400) } });
        executed.push({ tool: call.name, args: call.args, ok: false });
        deps.emit?.({ type: 'tool_step', step: steps + 1, tool: call.name, status: 'error', error: String(e?.message || e).slice(0, 200) });
      }
    }

    // Append the assistant turn + tool results in protocol-correct shape.
    if (turn.protocol === 'anthropic') {
      appendAnthropicTurn(messages, turn, results);
    } else {
      appendOpenAITurn(messages, { ...turn, toolCalls: toRun }, results);
    }
  }

  // ── Synthesis fallback ──────────────────────────────────────────
  // Step budget exhausted mid-investigation: tools ran but the model
  // never produced prose, so finalContent is still ''. Without this the
  // caller emits a bare "Done." — the user gets nothing. Force one last
  // provider call with tools removed and an explicit "answer now"
  // instruction so every turn ends with a real answer or an honest
  // "here is what I found" partial.
  if (!finalContent) {
    messages.push({
      role: 'user',
      content: '[Host] Investigation step budget reached — no more tool calls are available. Using ONLY what you already gathered, give the user your complete answer now: what you found, what it means, and what to do next. If key data is missing, say exactly what is unknown rather than inventing it.',
    });
    const synthBeat = deps.emit ? setInterval(() => {
      try { deps.emit!({ type: 'ping', tool: 'llm' }); } catch {}
    }, HEARTBEAT_MS) : null;
    let synth: LLMTurnResult | null = null;
    for (const prov of deps.providers) {
      try { deps.emit?.({ type: 'provider_try', provider: prov.name, model: prov.model }); } catch {}
      try {
        synth = prov.protocol === 'anthropic'
          ? await callProviderOnce(prov, messages, systemPrompt, [], maxTokens, temperature)
          : await callProviderOnceStreaming(prov, messages, systemPrompt, [], maxTokens, temperature, deps.emitToken, deps.emit);
        lastProvider = `${prov.name}:${prov.model}`;
        break;
      } catch { continue; }
    }
    if (synthBeat) clearInterval(synthBeat);
    if (synth?.content) {
      if (synth.tailPending) {
        try { deps.emitToken?.(synth.tailPending); } catch {}
      }
      contentStreamed = synth.tailPending !== undefined;
      finalContent = synth.content;
    } else {
      const ranTools = executed.map(t => t.tool).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      finalContent = ranTools
        ? `I hit my step limit mid-investigation after running ${ranTools} — the provider chain didn't return a summary in time. Say "continue" and I'll pick up from what I found.`
        : 'I could not complete that turn — the provider chain returned nothing. Say "retry" and I will run it again.';
    }
  }

  return { content: finalContent, steps, toolCalls: executed, provider: lastProvider, contentStreamed };
}

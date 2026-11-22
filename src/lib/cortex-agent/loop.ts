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
  /** Deterministic first action — pending intention resumed on affirmation. */
  initialToolCall?: { name: string; args: Record<string, unknown> } | null;
}

export interface AgentLoopResult {
  content: string;
  steps: number;
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; ok: boolean }>;
  provider: string;
  error?: string;
}

const MAX_STEPS_DEFAULT = 6;
const MAX_TOOL_CALLS_PER_STEP = 2;
const REQUEST_TIMEOUT_MS = 60_000;
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

interface LLMTurnResult {
  content: string;
  toolCalls: AgentToolCall[];
  provider: string;
  model: string;
  protocol: 'openai' | 'anthropic';
  rawAssistant: unknown;
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
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
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
  let lastProvider = '';
  let steps = 0;

  // ── Deterministic seed: pending intention resumed on affirmation ──
  if (deps.initialToolCall) {
    const seed = deps.initialToolCall;
    deps.emit?.({ type: 'tool_step', step: 0, tool: seed.name, status: 'resumed_intention', args: seed.args });
    deps.emitToken?.(`\n\n*⚡ Resuming: ${seed.name}…*\n\n`);
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

  for (; steps < maxSteps; steps++) {
    // ── LLM call across provider chain (first OK wins) ──
    let turn: LLMTurnResult | null = null;
    let chainError: any = null;
    for (const prov of deps.providers) {
      try {
        turn = await callProviderOnce(prov, messages, systemPrompt, tools, maxTokens, temperature);
        lastProvider = `${prov.name}:${prov.model}`;
        break;
      } catch (e: any) {
        chainError = e;
        continue;
      }
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
      finalContent = turn.content || finalContent;
      break;
    }

    // ── Execute tool calls (bounded) ──
    const toRun = calls.slice(0, MAX_TOOL_CALLS_PER_STEP);
    const results: Array<{ call: AgentToolCall; result: unknown }> = [];
    for (const call of toRun) {
      deps.emit?.({ type: 'tool_step', step: steps + 1, tool: call.name, status: 'executing', args: call.args });
      deps.emitToken?.(`\n\n*⚡ ${call.name}…*\n\n`);
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

  return { content: finalContent, steps, toolCalls: executed, provider: lastProvider };
}

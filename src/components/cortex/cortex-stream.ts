/**
 * Cortex SSE stream reader — single source of truth for /api/ai/nexus-guest parsing.
 *
 * Strict schema: only `data: {"token"|"content"|"message"|"toolCall"|"finishReason"}`
 * lines are consumed. Unparseable chunks are protocol noise and are skipped —
 * never guess-appended (prevents duplicated/garbled tokens like "Paris.**Paris.**").
 */

export interface CortexToolCallPayload {
  tool: string;
  args: Record<string, any>;
}

export interface CortexStreamResult {
  content: string;
  reasoning?: string;
  toolCall: CortexToolCallPayload | null;
  finishReason: string | null;
  /** Server-side agentic loop progress events (tool_step) — informational. */
  toolSteps: Array<Record<string, unknown>>;
  /** Agentic loop summary emitted with finishReason (steps/tools/provider). */
  agentic?: Record<string, unknown> | null;
}

interface NexusSSEEvent {
  token?: string;
  content?: string;
  message?: string;
  reasoning?: string;
  reasoning_content?: string;
  toolCall?: CortexToolCallPayload;
  finishReason?: string | null;
  type?: string;
  tool_step?: Record<string, unknown>;
  toolStep?: Record<string, unknown>;
  agentic?: Record<string, unknown>;
}

export async function readCortexSSE(
  body: ReadableStream<Uint8Array> | null | undefined,
  opts: {
    onToken?: (token: string, accumulated: string) => void;
    onReasoning?: (reasoningToken: string, accumulatedReasoning: string) => void;
    onToolCall?: (toolCall: CortexToolCallPayload) => void;
  } = {},
): Promise<CortexStreamResult> {
  const result: CortexStreamResult = { content: '', reasoning: '', toolCall: null, finishReason: null, toolSteps: [], agentic: null };
  const reader = body?.getReader();
  if (!reader) return result;

  const decoder = new TextDecoder();
  let buffer = '';

  const handleEvent = (parsed: NexusSSEEvent) => {
    const stepEvent = parsed.tool_step || parsed.toolStep
      || (parsed.type === 'tool_step' ? parsed as unknown as Record<string, unknown> : null);
    if (stepEvent) result.toolSteps.push(stepEvent);
    if (parsed.agentic) result.agentic = parsed.agentic;
    if (parsed.toolCall) {
      result.toolCall = parsed.toolCall;
      opts.onToolCall?.(parsed.toolCall);
    }
    const reasoningToken = parsed.reasoning ?? parsed.reasoning_content;
    if (reasoningToken) {
      result.reasoning = (result.reasoning || '') + reasoningToken;
      opts.onReasoning?.(reasoningToken, result.reasoning);
    }
    const token = parsed.token ?? parsed.content ?? parsed.message;
    if (token) {
      result.content += token;
      opts.onToken?.(token, result.content);
    }
    if (parsed.finishReason) {
      result.finishReason = parsed.finishReason;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          handleEvent(JSON.parse(jsonStr));
        } catch {
          // Strict SSE schema: unparseable chunks are protocol noise — skip, never guess-append.
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  // Flush a trailing buffered event (stream ended mid-line).
  const tail = buffer.trim();
  if (tail.startsWith('data:')) {
    const jsonStr = tail.slice(5).trim();
    if (jsonStr && jsonStr !== '[DONE]') {
      try { handleEvent(JSON.parse(jsonStr)); } catch {}
    }
  }

  // Last-resort: if the whole body was a single JSON object (non-SSE fallback).
  if (!result.content && !result.toolCall && tail && !tail.startsWith('<')) {
    try {
      const rawObj = JSON.parse(tail.replace(/^data:\s*/, ''));
      if (rawObj.content || rawObj.token || rawObj.message) {
        result.content = String(rawObj.content ?? rawObj.token ?? rawObj.message);
        if (rawObj.toolCall) result.toolCall = rawObj.toolCall;
      }
    } catch {
      const plain = tail.replace(/^data:\s*/, '');
      if (plain && !plain.startsWith('<')) result.content = plain;
    }
  }

  return result;
}

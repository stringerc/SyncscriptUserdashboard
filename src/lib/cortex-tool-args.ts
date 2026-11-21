/**
 * cortex-tool-args — structured-output hardening for streamed tool calls.
 *
 * Local models (mlx-lm, small cloud rungs) occasionally emit malformed
 * tool_call argument JSON: markdown fences, trailing commas, truncated
 * streams. Before this module the proxy silently coerced failures to `{}`,
 * so tools ran with missing params and failed opaquely downstream.
 *
 * mlx-lm 0.32.x exposes logits_processors in its Python API but the
 * OpenAI-compatible server does not surface grammar/json_schema decoding,
 * so true GBNF constraint isn't available on that rung. This module is the
 * middleware-layer equivalent (Instructor-style): deterministic repair +
 * schema validation + an explicit error marker instead of silent {}.
 */

export interface ToolArgRepairResult {
  ok: boolean;
  /** Parsed args object when ok; {} otherwise. */
  args: Record<string, any>;
  /** true when the raw string needed sanitizing before it parsed. */
  repaired: boolean;
  /** Human-readable reason when ok === false. */
  error?: string;
}

/** Strip markdown fences and trailing commas, then retry JSON.parse. */
export function repairJsonArgs(raw: string): ToolArgRepairResult {
  const attempts: string[] = [];
  const original = String(raw ?? '').trim();

  // Attempt 1: as-is
  attempts.push(original);

  // Attempt 2: unwrap ```json ... ``` fences models sometimes emit
  const unfenced = original
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  if (unfenced !== original) attempts.push(unfenced);

  // Attempt 3: drop trailing commas before } or ]
  const noTrailing = unfenced.replace(/,\s*([}\]])/g, '$1');
  if (noTrailing !== unfenced) attempts.push(noTrailing);

  // Attempt 4: truncate to the last balanced closing brace (truncated stream)
  const lastBrace = Math.max(noTrailing.lastIndexOf('}'), noTrailing.lastIndexOf(']'));
  if (lastBrace > 0 && lastBrace < noTrailing.length - 1) {
    attempts.push(noTrailing.slice(0, lastBrace + 1));
  }

  for (let i = 0; i < attempts.length; i++) {
    try {
      const parsed = JSON.parse(attempts[i]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ok: true, args: parsed, repaired: i > 0 };
      }
      return { ok: false, args: {}, repaired: i > 0, error: 'tool arguments parsed to a non-object' };
    } catch { /* try next repair */ }
  }
  return { ok: false, args: {}, repaired: attempts.length > 1, error: 'unparseable tool arguments after repair attempts' };
}

/**
 * Minimal schema check against the CORTEX_TOOLS parameter format
 * (`{ param: 'type' | 'type?' }` — trailing ? marks optional).
 * Returns names of required params missing or empty in args.
 */
export function missingRequiredArgs(
  parameters: Record<string, string> | undefined,
  args: Record<string, any>,
): string[] {
  if (!parameters) return [];
  const missing: string[] = [];
  for (const [name, spec] of Object.entries(parameters)) {
    const optional = typeof spec === 'string' && spec.trimEnd().endsWith('?');
    if (optional) continue;
    const v = args?.[name];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      missing.push(name);
    }
  }
  return missing;
}

export interface ToolCallParseResult extends ToolArgRepairResult {
  /** Set when required params are absent even though JSON parsed. */
  missingParams?: string[];
}

/**
 * Full pipeline: repair JSON → validate required params against the tool
 * schema. ok=false means the toolCall should carry an explicit error marker
 * rather than executing with silently-empty args.
 */
export function parseToolCallArgs(
  toolName: string,
  rawArgs: string,
  toolsDef: ReadonlyArray<{ name: string; parameters?: Record<string, string> }>,
): ToolCallParseResult {
  const repaired = repairJsonArgs(rawArgs);
  if (!repaired.ok) return { ...repaired, ok: false };

  const tool = toolsDef.find(t => t.name === toolName);
  const missing = missingRequiredArgs(tool?.parameters, repaired.args);
  if (missing.length) {
    return {
      ...repaired,
      ok: false,
      missingParams: missing,
      error: `missing required params: ${missing.join(', ')}`,
    };
  }
  return repaired;
}

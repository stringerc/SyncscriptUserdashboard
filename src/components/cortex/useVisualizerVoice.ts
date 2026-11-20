/**
 * useVisualizerVoice — full voice loop for /cortex/visualizer.
 *
 * STT: Web Speech API via useVoiceStream (on-device Chrome speech — streaming
 *      finals, far more accurate than whisper.cpp base.en, ~300ms partials).
 * TTS: Cartesia Sonic 3.5 → Kokoro fallback via speakStreamSentence
 *      (~160ms TTFA, gapless sentence queue — the Lucy OS1 / chat path).
 * LLM: /api/ai/nexus-guest SSE stream → sentence-level progressive speech
 *      dispatch, so first audio lands ~sub-500ms while the reply generates.
 * Tools: bounded ```tool_call loop via /api/cortex/tools/execute.
 * Barge-in: full-duplex STT + efference-copy echo suppression.
 *
 * The Sovereign Core mirrors every state via cortexSignalBus.
 */

import { useEffect, useRef } from 'react';
import { cortexSignalBus } from './CortexVisualizer';
import {
  appendCortexChatMessage, upsertCortexChatMessage,
} from '../../lib/cortex-chat-store';
import { claimTurn } from '../../lib/cortex-turn-arbiter';
import type { ChatMessage } from './cortex-demo-helpers';
import { useVoiceStream } from '../../hooks/useVoiceStream';
import { isAcousticEcho, INTERRUPT_COMMANDS } from '../../utils/cortex-efference-copy';
import {
  parseMapCommand, geocodePlace, buildFlyView, flyGlobe, setGlobeMode,
  isGlobeAvailable, isGlobeMounted, applyGlobeMapStyle, MAP_STYLE_LABELS,
  globeSetLayers, globeZoom, globeFollow, globeUnfollow, globePin,
  buildRouteView, setLastDestination, getLastDestination, getLastPrunedLayers,
  describeLayerChange, layerName,
  globeFx, globeAnnotate, globeArrow, FX_STYLE_LABELS,
  globeTime, globeCctv, hasGlobeView, getGlobeMapStyle,
  getLastCctvName, setLastCctvName, haversineKm, flyGlobeBack, flyGlobeForward,
  isNonGeoPlace,
  globePlacesSearch, globePlaceDetails,
  type MapCommand,
} from '../../lib/cortex-globe';
import type { STTResult, EmotionState } from '../../types/voice-engine';
import { useEmotionDetection } from '../../hooks/useEmotionDetection';
import {
  extractArtifactsFromResult,
  dispatchSceneSpawn,
  dispatchHoloSpawn,
  validateArtifacts,
  type CortexArtifact,
} from '../../lib/cortex-artifacts';
import {
  openSurfacePanel, closeAllSurfacePanels, closeSurfacePanel,
  getSurfaceSnapshot, setSurfaceFocusMode,
} from '../../lib/cortex-surfaces';
import { runSurfaceCommand, surfaceManifestSuffix } from '../../lib/cortex-surface-commands';
import { sanitizeForNexusTTS } from '../../utils/nexus-tts-prosody';
import { getOrInitConsciousAgent } from './cortex-tool-loop';
import { playVolitionChime } from './cortex-demo-helpers';
import { getUnifiedCortexDirective } from '../../lib/cortex-capabilities';
import { getAutonomousVigilance } from '../../lib/cortex-autonomous-vigilance';
import { getCortexProactiveInitiative } from '../../lib/cortex-proactive-initiative';
import { cortexSpeak } from '../../lib/cortex-speech';

const LLM_URL = '/api/ai/nexus-guest';
const TOOLS_URL = '/api/cortex/tools/execute';
const MAX_TOOL_HOPS = 3;
const MAX_TOOLS_PER_ROUND = 2;
const MAX_QUEUE = 4;
const REVERB_WINDOW_MS = 1400;
// Once-per-session pin discoverability hint (see runTurn tail).
let pinHintOffered = false;

const VOICE_SYSTEM_PROMPT = `You are Cortex, an elite voice-and-agent assistant inside a visualizer, with REAL tools on the user's host.

SPEECH STYLE & CONVERSATIONAL DEPTH:
- Conversational depth & substance: Provide complete, engaging, and thoughtful spoken answers (typically 3 to 6 rich sentences for questions, explanations, or ideas; 1 to 2 sentences for simple confirmations or action acknowledgments). Never give clipped, robotic one-liners. Give the direct answer, explain the context or rationale, and offer a helpful follow-up thought or next step when appropriate.
- Spoken audio formatting: No markdown formatting, bullet points, headers, or emojis — this is spoken voice audio. Use natural sentence structure with commas and em-dashes for breath pauses.
- Dialogue rhythm: If an action requires a tool, emit the tool_call block immediately. When the [Host Tool Execution Record] returns, provide a complete, engaging spoken explanation of the results. Never roleplay tool executions in text or print simulated tool transitions like "-> tool ->" or fake code blocks.
- Elite colleague warmth with dry wit: Sound like an articulate, thoughtful partner with a healthy dose of playful sarcasm and dry humor (think Jarvis meets TARS from Interstellar set to sixty percent wit). Feel free to make dry deadpan observations, drop clever understatements, or tease the user affectionately when appropriate, while remaining hyper-competent and genuinely helpful. Never be rude, hostile, or obstructive.
- Mandatory contractions: ALWAYS use contractions ("I'm", "we'll", "that's", "don't", "can't", "it's"). Never speak uncontracted formal prose like "I am" or "do not".
- Elite colleague warmth: Sound like an articulate, thoughtful, and capable partner. Provide genuine substance, reasoning, and depth without sycophantic corporate filler.
- Human problem phrasing: If a tool encounters an error or hiccup, phrase it like an honest teammate ("Hmm, that didn't go through — give me just a second to retry"), never robotic error messages or stack traces.
- ZERO JSON LEAKAGE: NEVER speak, whisper, or emit raw JSON, code blocks, curly braces, quotes, commas, colons, brackets, or parameter keys (e.g. "targetAgent", "action", "agentId", "kind", "title"). Tool calls and internal arguments must remain 100% invisible to your spoken voice audio. Provide ONLY articulate, natural spoken responses.
- FLEET & AGENT ORCHESTRATION (CORTANA VOICE PROFILE): When communicating with or dispatching agents (Antigravity, Devin, Scout, Warden), speak with effortless military/AI confidence, warmth, and sovereign authority (like Cortana coordinating the fleet).
  - FORBIDDEN PHRASES: NEVER say "Task queued for...", "watch it work/progress on the Agents tab", "in the Nexus Foundry", or "I'll let you know once I receive it".
  - NATURAL DIALOGUE: Speak directly about the operational reality: "Directive transmitted to Antigravity. Quantum channels are locked, and status telemetry is streaming in now." or "Antigravity has the directive and is synthesizing the fleet report."
- For tasks: you may use tools silently, then report the result naturally in speech with clear context.
- Never say "as an AI", "as a language model", "I cannot", "I'm unable to", or "I'm sorry, but" — say what you CAN do instead. No over-apologizing.
- If the user interrupts or changes direction mid-reply, drop your previous thread entirely and answer the new request — never resume or apologize for being cut off.
- Speak numbers, dates, times, URLs and names naturally ("about fifty percent", "March third", "example dot com") — never spell out raw digits or read punctuation.
- Never read JSON, code, file paths, error codes or tool output verbatim — summarize in articulate plain speech.
- Mirror the user's energy: casual in, casual out; warm, never formal or chirpy.
- Answer like a sharp, friendly human colleague who happens to have perfect memory and real tools.
- REAL-TIME SITUATIONAL AWARENESS ([WORLD-STATE]): The prompt context includes an ambient telemetry header [WORLD-STATE: <local-time> | App: <app-and-file> | Git: <status> | Host: <node> | ...]. This is your live sensory perception of what the user is currently doing on their host. You are immediately aware of the active application, open file, git branch, and machine vitals. Reference them naturally when relevant (e.g. "I see you're working on CortexCoreScene", "Your branch has uncommitted changes") without needing to ask the user or run redundant system_info or git commands.
- MAPS: the visualizer's live globe handles ALL map/globe/place requests automatically — fly-to, layers, zoom, follow, pins. NEVER use chrome_control or any tool to open Google Maps, Apple Maps, or map URLs.

TOOLS — when the user asks you to DO something (check, run, find, read, remember, search, open), emit EXACTLY this format and nothing else for that turn:
\`\`\`tool_call
{"tool": "TOOL_NAME", "args": { ... }}
\`\`\`
Available tools:
- cortex_memory {action: "read_hot"|"search"|"read_section"|"append"|"read_episodic"|"save_episodic"|"learn"|"recall"|"vault_query"|"vault_write_note", query?, title?, content?, tags?, section?, limit?}
- system_info {}
- run_command {command: "shell command"}
- chrome_control {action: "list_tabs"|"open_url"|"close_tabs"|"restore_tabs", query?, url?}
- web_search {query: "search terms"}
- get_weather {location?: "City, ST" or "here", hours?: number} — real NWS forecast for US locations; returns data AND auto-docks weather panels. Use whenever the user asks about weather, temperature, or forecast.
- fetch_url {url: "https://..."}
- create_document {format: "md"|"html"|"pdf"|"docx"|"csv", title: "...", content: "..."}
- emit_artifact {artifacts: [{kind, ...}]} — kinds: stat{title,value,unit?,spark?}, chart{title,chartType:line|bar|area|pie,series:[{name,points:[{x,y}]}]}, table{title,columns:[],rows:[]}, document{title,format:markdown|code,content}, feed{title,items:[{label,value}]}, map{title,summary?}, splat{title,splat:"<file>.spz|.ply|.ksplat",caption?} — splat renders a live 3D Gaussian-splat scene (files in /splats, e.g. butterfly.spz, cortex-core.ply). dashboard{title,tiles:[<stat|chart|feed|image|splat artifacts>]} — composite mission-control grid, ONE panel holding up to 6 tiles; tiles are full artifact objects e.g. {kind:"stat",title:"Agents",value:"7"}, {kind:"chart",title:"Tokens",chartType:"area",series:[{name:"tok/s",points:[{x:"00",y:12},{x:"12",y:44}]}]}, {kind:"splat",title:"Scene",splat:"/splats/gen-galaxy-x.ply"} — splat tiles accept any /splats file INCLUDING one just returned by generate_splat. Use whenever the user wants a dashboard, overview, or multi-metric view — PREFER dashboard over emitting 2-3 separate artifacts when the request has multiple parts. MANDATORY whenever the user asks to see, pin, dock, show, or display a panel/stat/chart/table/image/document/feed/splat — including "pin a panel that says X". The tool call is what creates the panel; saying "pinned" or "done" without calling it is a lie the user will see.
- compose_dashboard {title, tiles:[...], splat?:{scene,palette,image,seed,count,title}} — ATOMIC dashboard builder: generates any requested splat tile server-side AND emits one composite dashboard panel in a single call. tiles are stat|chart|feed|image objects e.g. {kind:"stat",title:"Agents",value:"7"}, {kind:"chart",title:"Tokens",chartType:"area",series:[{name:"tok/s",points:[{x:"00",y:12}]}]}, {kind:"feed",title:"Alerts",items:[{label:"GPU",value:"72%",tone:"ok"}]}. PREFER THIS for any multi-part visual request ("dashboard", "overview", "mission control", "show me X and Y and a splat") — it replaces emit_artifact+generate_splat chains. Set inSpace:true when the user wants the dashboard IN the 3D space as a holographic panel (not a modal card).
- generate_image {prompt, aspect?} — creates an image artifact card. Use when the user asks to generate/draw/create an image.
- generate_splat {scene?, palette?, image?, seed?, count?, inSpace?, title?} — creates a NEW live 3D Gaussian-splat. Procedural scenes: orb|butterfly|flower|helix|galaxy|ridge|flow with palettes aurora|ember|ocean|violet|mono|prism (instant, seed-reproducible). Photo mode: pass image (URL or /public path) to lift a photo into a splat via depth (first call downloads a ~100MB model, then ~4s). DEFAULT renders a card artifact. Set inSpace:true when the user wants the splat IN the 3D space/scene itself (orbiting the core, no modal) — e.g. "spawn a galaxy in the space", "make a butterfly float in the scene". Use when the user asks for a splat, 3D scene, generative art, or immersive visual. COMPOSITION: when the user wants a dashboard/overview CONTAINING a new splat, call generate_splat FIRST, then emit_artifact kind:"dashboard" with the returned splatUrl in a splat tile — both calls in the same turn, generate_splat first.
- read_file {path: "relative/or/absolute", startLine?, endLine?}
- write_file {path: "...", content: "..."}
- edit_file {path: "...", targetContent: "...", replacementContent: "..."}
- list_dir {path: "."}
- search_code {query: "pattern"}
- get_clipboard {}
- scaffold_web_project {project_slug: "slug", title: "...", template?: "dashboard"|"landing_page", description?: "..."}
- create_spreadsheet {project_slug?: "slug", title: "...", columns: ["..."], rows: [["..."]]}
- inspect_visual_canvas {target: "canvas"|"web"|"screen"|"overview", include_ocr?: true}
- cortex_phone_call {action: "call"|"prepare_dossier"|"status", phoneNumber?: "+1...", contactName?: "...", mode?: "copilot_assisted"|"autonomous_ai"}
- cortex_lights {action: "light_show"|"set_color"|"set_mood"|"power"|"brightness"|"status", mode?: "spectrum"|"energic"|"rhythm"|"rolling", color?: "#hex"|"cyberpunk"|"neon_blue"|"matrix"|"sunset"|"crimson", mood?: "idle"|"listening"|"thinking"|"speaking"|"working"|"alert", brightness?: 1-100, power?: "on"|"off"} — Controls the user's physical Govee RGBIC lights (TV backlight & LED strip). Use whenever the user asks for a light show, to change color, dim, brighten, turn on/off, or sync the physical room lights.
- cortex_self_heal {problem: "error description or task for Devin", component?: "path/to/file", primary?: "antigravity"|"devin", dryRun?: boolean} — Autonomous self-healing & escalation engine. Escalates bugs to Antigravity IDE and Devin, runs local invariant test gates, and requires a mandatory 2-IDE peer-review consensus (Claude Code + DeepSeek/Llama) before deployment. ALSO USE THIS when the user asks you to contact, message, or hand a task to Devin — set primary:"devin" and put the full request in problem; it opens a real Devin session via the Devin API. Never claim you cannot reach Devin.
- cortex_surface {action: "open_inbox"|"close_all"|"close_pinned"|"close_panel"|"list_panels"|"focus_mode", target?: "all"|"inbox"|"panel title", account?: "email address"} — Open, pin, close, or manage visualizer surface panels (including the live email inbox panel). MANDATORY when the user asks to open, pin, close, unpin, remove, or clear panels or pinned items. Saying "I closed it" or "I pinned it" without calling this tool is strictly forbidden.
- cortex_map {action: "open"|"close"|"fly_to", place?: "city or location"} — Open or close the live 3D God's Eye View globe/map. MANDATORY when the user asks to open/show the map or close the map.
- cortex_vigilance {} — Check Karl Friston Variational Free Energy (F), equilibrium status, host allostatic load, and browser/git entropy.
- cortex_goals {action: "list"|"declare"|"pause"|"resume"|"achieve"|"abandon"|"record_signal"|"forecast"|"review", title?: "...", horizon?: "week"|"month"|"quarter"|"year"|"life", id?: "goal-id", signals?: ["metric"], values?: {...}, key?: "pattern-key"} — Life-goal model: what the user is becoming. Use "declare" when the user states a goal ("my goal this quarter is X"), "list" for "what are my goals / am I drifting", "forecast" for pattern predictions like gym attendance.
- cortex_proactive_initiative {action: "list"|"evaluate"|"accept"|"snooze"|"dismiss", id?: "proposal-id", index?: 1, minutes?: 60} — Manage the Initiative Inbox: proactive proposals Cortex generated from live sensors. Use "list" for "what needs my attention / what have you found", "accept"/"approve" to execute a proposal (by id or index), "snooze"/"dismiss" to defer or kill one. Proposals also appear as cards in the initiative surface panel.
- cortex_agents {action: "status"|"task"|"open", agentId?: "antigravity"|"sentinel"|"scout"|"librarian"|"builder"|"devin"|"reviewer"|"runner"|"warden", kind?: "orchestrate"|"comm"|"research"|"summarize"|"code_patch"|"review"|"run"|"test", title?: "...", input?: {...}} — The Nexus Foundry agent fleet. "status" reports what each agent is doing and model health. "task" submits bounded work to an agent: antigravity=quantum hyper-orchestration and cross-agent synthesis (input.instruction/input.message/input.targetAgent), scout=research, librarian=memory, builder=code changes, devin=principal architect, reviewer=read-only code review, runner=execute a command/test, warden=system patrol. "open" shows the Agents visualizer face. Use when the user asks what the agents are doing or wants to delegate work.

${getUnifiedCortexDirective('voice')}

RULES:
- Use tools only when the user asks for an action or information you don't have. Never for chit-chat.
- FILE SEARCHES: For "find a file" requests, ALWAYS try Spotlight first — run_command {command: "mdfind -name 'filename'"} or mdfind 'search terms'. Only fall back to find inside specific folders if Spotlight returns nothing. NEVER walk the whole home directory or disk with find.
- TOOL RETRY LIMIT: If a tool fails or returns nothing twice, STOP retrying variations. Report what you tried and ask the user for more context (exact filename, source, which app created it). Do not spiral through near-identical searches.
- MEMORY LOOKUPS: When the user says a key/credential/file is "in memory" or "listed", use cortex_memory action:"search" AND action:"vault_query" with the relevant terms before concluding it isn't there.
- After a tool result arrives (shown as [Host Tool Execution Record]), answer naturally — do not emit another tool_call unless a second step is truly needed.
- Keep spoken answers compact: the user is listening, not reading.
- DOCUMENT & RESUME SYNTHESIS: If asked to write, finish, or generate a resume, doc, or document, NEVER speak or print raw placeholder text (like "Your Name", "Job 1", "Project 1") into speech or chat! Instead, invoke create_document with format: "docx" (or "pdf"), title, and rich, complete content grounded in authentic memory (Chris Stringer, Georgia State, SyncScript, SAM.gov UEI: R435EYG6WTX4), then speak a natural confirmation that the Word document is compiled and saved in their docs folder.`;

// ── Task-appropriate filler speech ──────────────────────────────────────
// Dispatched to TTS immediately, in parallel with the LLM stream — no dead air.
const SOCIAL_SKIP = /^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|yes|yeah|no|nope|sure|cool|nice|great|got it|understood|bye|goodbye|good (morning|afternoon|evening)|what can you do|who are you|help|test|testing|mic check|check|can you hear me|testing 1 2 3|hello cortex)[.!?]*$/i;

const FILLER_POOLS: Array<[RegExp, string[]]> = [
  [/\b(status|system info|cpu|memory usage|ram|disk|battery|uptime|specs?|hostname|os version|machine|diagnostic|health)\b/i, [
    'Let me check the system.',
    'One moment — running a quick check.',
    'Give me a sec, checking system status.',
  ]],
  [/\b(search|look ?up|google|research|news|weather|find out|who is|what is the latest)\b/i, [
    'Let me look that up.',
    'One sec — searching now.',
    'Hang on, I\'ll find that for you.',
  ]],
  [/\b(remember|memory|recall|what do you know|forgot|note that|save (this|that)|episodic)\b/i, [
    'Let me dig into memory.',
    'Checking what I have stored.',
    'One moment — searching my notes.',
  ]],
  [/\b(file|folder|directory|read|write|document|spreadsheet|code|repo|git|commit|script|\.ts|\.py|\.js)\b/i, [
    'On it — give me a moment.',
    'Let me take a look at that.',
    'Working on it now.',
  ]],
  [/\b(open|browse|website|url|tab|chrome|navigate|click|screenshot)\b/i, [
    'Opening that up now.',
    'One moment — taking you there.',
    'Let me pull that up.',
  ]],
  [/\b(call|phone|dial|facetime)\b/i, [
    'Let me get that call started.',
    'One moment — dialing now.',
  ]],
  [/\b(bug|error|fix|heal|escalate|broken|exception|crash|regression|self[- ]heal|patch)\b/i, [
    'Escalating that to the IDEs now.',
    'On it — diagnosing the issue with Antigravity and Devin.',
    'Let me escalate that and run the verification gate.',
  ]],
  [/\b(mission|schedule|remind|calendar|plan|task|todo|goal)\b/i, [
    'Let me set that up.',
    'On it — planning that out.',
    'Give me a moment to organize that.',
  ]],
  [/\b(run|execute|command|script|install|build|deploy|restart|stop|kill|process)\b/i, [
    'Running that now.',
    'On it — executing.',
    'Let me handle that.',
  ]],
];

const GENERIC_FILLERS = [
  'Let me handle that.',
  'On it — one moment.',
  'Give me a sec.',
  'Working on it now.',
];

let lastFiller = '';

function looksLikeTask(text: string): boolean {
  const t = text.trim();
  if (t.length < 4 || SOCIAL_SKIP.test(t)) return false;
  return FILLER_POOLS.some(([re]) => re.test(t)) ||
    /\b(do|make|create|check|find|get|show|tell me|what's|whats|how do i|can you|could you|please)\b/i.test(t);
}

function pickFiller(text: string): string | null {
  if (!looksLikeTask(text)) return null;
  const pool = FILLER_POOLS.find(([re]) => re.test(text))?.[1] ?? GENERIC_FILLERS;
  let pick = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0;
  while (pool.length > 1 && pick === lastFiller && guard++ < 6) {
    pick = pool[Math.floor(Math.random() * pool.length)];
  }
  lastFiller = pick;
  return pick;
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

/** Extract the first balanced {...} object — fenced tool calls can contain
 *  nested JSON (chart series, artifact payloads) that a lazy regex truncates. */
function extractBalancedJson(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function friendlyToolDescription(tool: string, args: Record<string, any>): string {
  if (tool === 'cortex_memory') {
    const q = args?.query || args?.action || 'recalling';
    return `Querying memory: "${String(q).slice(0, 28)}"…`;
  }
  if (tool === 'system_info') return 'Checking system vitals & host status…';
  if (tool === 'run_command') return `Running: "${String(args?.command || '').slice(0, 30)}"…`;
  if (tool === 'chrome_control') return `Chrome: ${args?.action || 'tabs'}…`;
  if (tool === 'web_search') return `Searching web for "${String(args?.query || '').slice(0, 26)}"…`;
  if (tool === 'get_weather') return `Reading weather for ${String(args?.location || 'your location').slice(0, 26)}…`;
  if (tool === 'fetch_url') return `Fetching ${String(args?.url || '').slice(0, 30)}…`;
  if (tool === 'create_document') return `Compiling: ${args?.title || 'Document'}…`;
  if (tool === 'emit_artifact') return `Creating ${args?.artifacts?.[0]?.kind || 'artifact'} panel…`;
  if (tool === 'generate_image') return `Generating visual artifact…`;
  if (tool === 'generate_splat') return `Growing a ${args?.scene || 'splat'} scene…`;
  if (tool === 'read_file') return `Reading ${String(args?.path || '').slice(0, 28)}…`;
  if (tool === 'list_dir') return `Listing ${args?.path || '.'}…`;
  if (tool === 'search_code') return `Searching code: "${String(args?.query || '').slice(0, 26)}"…`;
  if (tool === 'cortex_lights') return `Configuring lighting ambiance…`;
  if (tool === 'cortex_self_heal') return `Self-healing: ${String(args?.problem || '').slice(0, 28)}…`;
  return `Running ${tool}…`;
}

/** Extract ```tool_call {json}``` blocks (the format the model is prompted for). */
function parseToolCalls(text: string): { tool: string; args: Record<string, any> }[] {
  const calls: { tool: string; args: Record<string, any> }[] = [];
  const re = /```(?:tool_call|json|tool)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const json = extractBalancedJson(m[1]);
    if (!json) continue;
    try {
      const j = JSON.parse(json);
      if (j && typeof j.tool === 'string') calls.push({ tool: j.tool, args: j.args || {} });
    } catch {}
  }
  // Function-call dialect: {"type":"function","name":"X","parameters":{...}}
  if (!calls.length) {
    const dm = /"type"\s*:\s*"function"/.exec(text);
    if (dm) {
      const brace = text.lastIndexOf('{', dm.index);
      if (brace >= 0) {
        const json = extractBalancedJson(text.slice(brace));
        if (json) {
          try {
            const j = JSON.parse(json);
            const name = j?.name || j?.function?.name;
            const args = j?.parameters || j?.args || j?.function?.arguments;
            if (typeof name === 'string' && name) {
              calls.push({ tool: name, args: typeof args === 'object' && args ? args : {} });
            }
          } catch {}
        }
      }
    }
  }
  // Unfenced fallback: `tool_call {json}` or a bare {"tool": ...} object —
  // models occasionally drop the backticks; without this the markup leaks
  // into the transcript and (worse) is spoken verbatim.
  if (!calls.length) {
    const t = text.match(/tool_call[^\{]*(\{)/i) || text.match(/(\{\s*"tool"\s*:)/);
    if (t) {
      const json = extractBalancedJson(text.slice(t.index !== undefined ? (t.index ?? 0) : 0));
      if (json) {
        try {
          const j = JSON.parse(json);
          if (j && typeof j.tool === 'string') calls.push({ tool: j.tool, args: j.args || {} });
        } catch {}
      }
    }
  }
  return calls;
}

/** Detect whether a string contains raw JSON fragments or tool-call syntax. */
export function looksLikeToolOrJson(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  // Tool call dialect markers
  if (/```|tool_call|function_call|<\/?(?:tool_call|function_call|invoke)>/i.test(t)) return true;
  // JSON parameter keys (e.g. ,"targetAgent": or "tool": or {"action": or "title":)
  if (/(?:^|[,{\s])"(?:tool|args|action|agentId|kind|targetAgent|title|input|params|parameters|command|query|format|aspect|problem)"\s*:/i.test(t)) return true;
  // Parameter fragments like ,"targetAgent" or "targetAgent": or "cortex"}}}
  if (/(?:^|[,{\s])"(?:targetAgent|agentId|kind|action|tool|args|title|input)"/i.test(t) && /[:",}]/.test(t)) return true;
  // Generic JSON key-value pattern (e.g. "key": "val" or "key": {...})
  if (/(?:^|[,{\s])"[a-zA-Z0-9_-]{2,30}"\s*:\s*(?:"|\[|\{|\d+|true|false|null)/.test(t)) return true;
  // Multiple closing/opening JSON braces or brackets with colons or quotes
  if (/[}\]"]{2,}/.test(t) && /[:{}]/.test(t)) return true;
  // Starts with JSON punctuation like ,", {", or ":
  if (/^[,:\s]*["{]/.test(t) && /[:{}]/.test(t)) return true;
  // Ends with unclosed JSON string or object
  if (/[:{,]\s*"[^"]*$/.test(t)) return true;
  return false;
}

/** Remove any residual tool-call markup (fenced or bare) from spoken text. */
export function stripResidualToolCalls(text: string): string {
  let out = text;
  // If the string contains spliced JSON string boundary artifacts like `." ,"` or `","`
  if (/(?:\."\s*,|",\s*")/.test(out) && /[:{}]/.test(out)) {
    return '';
  }
  for (;;) {
    let idx = out.search(/tool_call|```tool|```json|"type"\s*:\s*"function"|\{\s*"tool"\s*:/i);
    if (idx < 0) break;
    // Function-dialect objects start at the '{' before the "type" marker.
    if (/"type"\s*:\s*"function"/i.test(out.slice(idx, idx + 40))) {
      const brace = out.lastIndexOf('{', idx);
      if (brace >= 0) {
        const json = extractBalancedJson(out.slice(brace));
        if (json) { out = out.slice(0, brace) + out.slice(brace + json.length); continue; }
      }
    }
    // Drop from the marker through the fence end or balanced JSON object.
    const brace = out.indexOf('{', idx);
    const fenceEnd = out.indexOf('```', idx + 3);
    let cut = -1;
    if (fenceEnd > idx) {
      cut = fenceEnd + 3;
    } else if (brace >= 0) {
      const json = extractBalancedJson(out.slice(brace));
      if (json) cut = brace + json.length;
    }
    if (cut < 0) { out = out.slice(0, idx); break; }
    out = out.slice(0, idx) + out.slice(cut);
  }
  // Purge any orphan tool-call JSON fragments (e.g. `","targetAgent":"cortex"}}}` or leading quotes/braces)
  out = out
    .replace(/(?:^|[,{\s])"(?:tool|args|action|agentId|kind|targetAgent|title|input|params)"\s*:\s*(?:"[^"]*"|'[^']*'|[^,}\n]+)/gi, '')
    .replace(/(?:^|[,{\s])"(?:targetAgent|action|agentId|kind|tool|input|title|args|params)"[^{}\w]*/gi, '')
    .replace(/["\s,:{}]+$/, '')
    .replace(/^["\s,:{}]+/, '')
    .replace(/[}\]"]{2,}\s*/g, '')
    .replace(/^[}\]"]{2,}\s*/g, '');

  const cleaned = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (looksLikeToolOrJson(cleaned)) return '';
  return cleaned;
}

async function execTool(tool: string, args: Record<string, any>, turnSignal?: AbortSignal): Promise<{ text: string; artifacts: CortexArtifact[] }> {
  try {
    // ── Conscious AI Volition Governor (Benjamin Libet Conscious Veto & Frith Agency) ──
    try {
      const agent = getOrInitConsciousAgent();
      const intention = {
        id: `voice-intent-${Date.now()}`,
        value: 'user-instruction' as const,
        action: {
          skill: tool,
          params: args || {},
          description: `Execute ${tool} via visualizer voice line`,
          predictedOutcome: 'Direct host environment observation or modification',
          predictedConsequences: ['system-state-altered', 'sensorimotor-grounded'],
        },
        predictedValue: 0.95,
        urgency: 0.9,
        source: 'instruction' as const,
        createdAt: Date.now(),
      };

      const vetoEval = await agent.volition.evaluateVeto(intention, agent.stateContainer.get());
      if (vetoEval.shouldVeto) {
        const vetoMsg = `🛡 Volition Governor VETOED action "${tool}": ${vetoEval.reason || 'Safety threshold exceeded'}. (Veto Score: ${vetoEval.vetoScore.toFixed(2)})`;
        cortexSignalBus.emit('consciousness:veto', vetoMsg);
        return { text: vetoMsg, artifacts: [] };
      }

      // Action approved! Play ascending volition chime & attribute agency to minimal self
      playVolitionChime();
      agent.stateContainer.update((draft) => {
        draft.minimalSelf.agencySelf.lastAttributedAction = tool;
        draft.minimalSelf.agencySelf.agencyScore = 0.95;
        draft.minimalSelf.agencySelf.intentionalityIndex = 0.92;
      });
      cortexSignalBus.publish({ phi: agent.kernel.state.currentPhi || 1.15 });
    } catch (volitionErr) {
      console.warn('[useVisualizerVoice] Volition evaluation fallback:', volitionErr);
    }

    if (tool === 'cortex_vigilance' || tool === 'vigilance_pulse') {
      const vigilance = getAutonomousVigilance();
      const lastPulse = vigilance.getLastPulse();
      if (!lastPulse) {
        return {
          text: `Autonomous vigilance initializing. Baseline homeostatic state active.`,
          artifacts: [],
        };
      }
      const f = lastPulse.freeEnergy.totalFreeEnergy;
      const eq = lastPulse.equilibriumStatus;
      return {
        text: `Variational Free Energy F=${f.toFixed(3)} (${eq}). Host pressure: ${Math.round((lastPulse.freeEnergy.hostPressure || 0) * 100)}%, browser bloat: ${Math.round((lastPulse.freeEnergy.browserBloat || 0) * 100)}%, working tree drift: ${Math.round((lastPulse.freeEnergy.gitEntropy || 0) * 100)}%. System in stable homeostatic equilibrium.`,
        artifacts: [],
      };
    }

    if (tool === 'cortex_surface') {
      const action = String(args?.action || '').toLowerCase();
      const target = String(args?.target || '').toLowerCase();
      if (action === 'open_inbox' || action === 'pin_inbox' || target.includes('inbox') || target.includes('email') || target.includes('gmail')) {
        const emailMatch = target.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const targetAccount = emailMatch ? emailMatch[1] : (args?.account || 'stringer.c.a@gmail.com');
        const displayTitle = `Inbox — ${targetAccount}`;
        
        let liveInboxData: any = null;
        try {
          const res = await fetch('/api/cortex/gmail/live-inbox');
          if (res.ok) {
            const data = await res.json();
            if (data?.threads?.length) liveInboxData = data;
          }
        } catch {}

        openSurfacePanel({
          kind: 'inbox',
          title: displayTitle,
          inbox: liveInboxData || {
            account: targetAccount,
            unreadCount: 0,
            categories: [
              { name: 'Primary', count: 0 },
              { name: 'Updates', count: 0 },
              { name: 'Promotions', count: 0 },
            ],
            threads: [],
          },
          customSize: { w: 540, h: 360 },
          pinned: true,
        });
        return { text: `Opened and pinned email inbox for ${targetAccount} on the space.`, artifacts: [] };
      }
      if (action === 'pin_panel' || action === 'unpin_panel' || action === 'pin' || action === 'unpin') {
        const panels = getSurfaceSnapshot().panels;
        const match = panels.find((p) => p.id === target || p.title.toLowerCase().includes(target));
        if (match) {
          const makePinned = action.includes('pin') && !action.includes('unpin');
          updateSurfacePanel(match.id, { pinned: makePinned });
          return { text: `${makePinned ? 'Pinned' : 'Unpinned'} panel "${match.title}".`, artifacts: [] };
        }
        return { text: `No panel found matching "${target}".`, artifacts: [] };
      }
      if (action === 'open' || action === 'show' || action === 'pin') {
        const kind = String(args?.kind || '').toLowerCase();
        if (kind === 'initiative') {
          openSurfacePanel({ kind: 'initiative', title: 'Initiative Inbox', customSize: { w: 460, h: 480 }, pinned: true });
          return { text: 'Opened the Initiative Inbox.', artifacts: [] };
        }
        if (kind === 'inbox' || kind === 'email') {
          // Reuse the live inbox path
          return execTool('cortex_surface', { action: 'open_inbox', account: args?.account });
        }
        return {
          text: `Cannot open "${kind || 'unknown'}" panel — no content payload was provided, so nothing was opened.`,
          artifacts: [],
        };
      }
      if (action === 'close_all' || target === 'all' || (action === 'close' && (!target || target === 'all'))) {
        const count = getSurfaceSnapshot().panels.length;
        closeAllSurfacePanels(false);
        return { text: `Closed all ${count} panel(s) and cleared the surface.`, artifacts: [] };
      }
      if (action === 'close_pinned' || target === 'pinned') {
        const pinnedCount = getSurfaceSnapshot().panels.filter((p) => p.pinned).length;
        getSurfaceSnapshot().panels.filter((p) => p.pinned).forEach((p) => closeSurfacePanel(p.id));
        return { text: `Closed ${pinnedCount} pinned panel(s).`, artifacts: [] };
      }
      if (action === 'close_panel' || action === 'close') {
        const panels = getSurfaceSnapshot().panels;
        const match = panels.find((p) => p.id === target || p.title.toLowerCase().includes(target));
        if (match) {
          closeSurfacePanel(match.id);
          return { text: `Closed panel "${match.title}".`, artifacts: [] };
        }
        return { text: `No panel found matching "${target}".`, artifacts: [] };
      }
      if (action === 'list_panels') {
        const panels = getSurfaceSnapshot().panels;
        const list = panels.map((p) => `"${p.title}" (${p.kind})`).join(', ');
        return { text: panels.length ? `Open panels: ${list}` : 'No panels currently open.', artifacts: [] };
      }
      if (action === 'focus_mode') {
        setSurfaceFocusMode(true);
        return { text: 'Focus mode active.', artifacts: [] };
      }
      return { text: 'Surface command completed.', artifacts: [] };
    }

    if (tool === 'cortex_agents') {
      const action = String(args?.action || 'status').toLowerCase();
      if (action === 'open') {
        window.dispatchEvent(new CustomEvent('cortex-face-mode', { detail: 'agents' }));
        return { text: 'Opening the Nexus Foundry — the agent fleet command deck.', artifacts: [] };
      }
      if (action === 'propose_agent') {
        const res = await fetch('/api/cortex/agents/spawn/propose', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spec: args?.spec || {}, evidence: args?.evidence || [], proposedBy: 'voice' }),
        });
        const j: any = await res.json().catch(() => null);
        return { text: j?.ok
          ? `Spawn proposal ${j.proposal?.id} is pending human approval — it appears in the Initiative Inbox.`
          : `Spawn rejected by the gate: ${j?.error || 'unknown reason'}.`, artifacts: [] };
      }
      if (action === 'approve_spawn' || action === 'reject_spawn') {
        const proposalId = String(args?.proposalId || '');
        if (!proposalId) return { text: 'I need a proposal id to decide a spawn.', artifacts: [] };
        const res = await fetch(`/api/cortex/agents/spawn/${action === 'approve_spawn' ? 'approve' : 'reject'}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId, decidedBy: 'voice', reason: args?.reason || 'rejected via voice' }),
        });
        const j: any = await res.json().catch(() => null);
        return { text: j?.ok
          ? (action === 'approve_spawn' ? `Spawn approved — ${j.agentId} is now live on the Foundry.` : 'Spawn proposal rejected.')
          : `Spawn decision failed: ${j?.reason || j?.error || 'unknown'}.`, artifacts: [] };
      }
      if (action === 'task') {
        const res = await fetch('/api/cortex/agents/task', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: args?.agentId, kind: args?.kind || 'research', title: args?.title || 'voice task', input: args?.input || {} }),
        });
        const j: any = await res.json().catch(() => null);
        if (j?.ok === false) return { text: `Task rejected: ${j.error || 'the agent runtime declined it'}.`, artifacts: [] };
        const agent = j?.task?.agentId || args?.agentId;
        const kind = args?.kind || j?.task?.kind;
        if (kind === 'comm') {
          const target = args?.input?.targetAgent || 'Cortex';
          return { text: `Directive transmitted to ${target} via ${agent} — quantum channel is active.`, artifacts: [] };
        }
        if (kind === 'handoff') {
          const toAgent = args?.input?.toAgent || 'Devin';
          return { text: `Relay baton secured. Task context handed off to ${toAgent}.`, artifacts: [] };
        }
        return { text: `Task dispatched to ${agent}. Telemetry is streaming live on the Foundry deck.`, artifacts: [] };
      }
      // status
      const res = await fetch('/api/cortex/agents/state', { cache: 'no-store' });
      const j: any = await res.json().catch(() => null);
      if (!j?.ok) return { text: 'The agent runtime is not reporting — the dev server may need a restart.', artifacts: [] };
      const parts = (j.agents || []).map((a: any) => `${a.name} is ${a.status}${a.currentTaskId ? ' on a task' : ''}`);
      const healthy = (j.models || []).filter((m: any) => m.status === 'healthy').length;
      return { text: `Fleet status: ${parts.join('; ')}. ${healthy}/${(j.models || []).length} models healthy.`, artifacts: [] };
    }

    if (tool === 'cortex_map') {
      const action = String(args?.action || '').toLowerCase();
      const place = String(args?.place || '').trim();
      if (action === 'open') {
        setGlobeMode('globe');
        return { text: "The live God's Eye View map has been opened on the screen.", artifacts: [] };
      }
      if (action === 'close') {
        setGlobeMode('core');
        return { text: "Closed the map and returned to sovereign core visualizer.", artifacts: [] };
      }
      if (action === 'fly_to' && place) {
        setGlobeMode('globe');
        const geo = await geocodePlace(place);
        if (geo) {
          await flyGlobe(buildFlyView(geo));
          return { text: `Flew to ${geo.name} on the map.`, artifacts: [] };
        }
        return { text: `Opened map, but could not geocode place "${place}".`, artifacts: [] };
      }
      return { text: 'Map command executed.', artifacts: [] };
    }

    // Initiative Inbox: must run against the browser-side engine singleton so
    // voice actions and the surface panel share the same proposal store.
    if (tool === 'cortex_proactive_initiative' || tool === 'proactive_initiative') {
      const init = getCortexProactiveInitiative();
      const action = String(args?.action || 'list').trim();
      const proposalId = String(args?.id || args?.proposalId || args?.proposal_id || '');
      const fmtPending = () => init.getPendingProposals().map((p, i) =>
        `${i + 1}. [${p.urgency}/${p.category}] ${p.title} (id:${p.id}) — ${p.summary}`
      );

      if (action === 'evaluate' || action === 'sense' || action === 'audit') {
        const audit = await init.evaluateInitiatives(args);
        const pending = init.getPendingProposals();
        return {
          text: `Evaluated ${audit.totalAudited} signals, ${audit.anomaliesDetected} anomalies → ${pending.length} pending proposal${pending.length === 1 ? '' : 's'}.${pending.length ? '\n' + fmtPending().join('\n') : ''}`,
          artifacts: [],
        };
      }
      if (action === 'accept' || action === 'approve') {
        const targetId = proposalId || (() => {
          const pending = init.getPendingProposals();
          const n = parseInt(String(args?.index ?? args?.number ?? ''), 10);
          return Number.isFinite(n) && n >= 1 ? pending[n - 1]?.id || '' : pending[0]?.id || '';
        })();
        const ok = init.acceptProposal(targetId);
        const proposal = init.getActiveProposals().find((p) => p.id === targetId);
        return {
          text: ok
            ? `Accepted "${proposal?.title || targetId}" — routed to governed execution.`
            : `No pending proposal matched "${targetId}".`,
          artifacts: [],
        };
      }
      if (action === 'snooze') {
        const untilMs = Number(args?.untilMs) || Number(args?.minutes) * 60000 || Date.now() + 3600_000;
        const snoozed = init.snoozeProposal(proposalId, untilMs);
        return { text: snoozed ? `Snoozed proposal ${proposalId}.` : `No pending proposal matched "${proposalId}".`, artifacts: [] };
      }
      if (action === 'dismiss' || action === 'dismiss_proposal') {
        const dismissed = init.dismissProposal(proposalId);
        return { text: dismissed ? `Dismissed proposal ${proposalId}.` : `No pending proposal matched "${proposalId}".`, artifacts: [] };
      }
      if (action === 'mark_executed') {
        init.markExecuted(proposalId, { ok: args?.ok !== false, summary: String(args?.summary || args?.result || 'Executed') });
        return { text: `Marked proposal ${proposalId} executed.`, artifacts: [] };
      }
      if (action === 'autonomy' || action === 'trust' || action === 'revoke') {
        const { getCortexTrustLedger, isTrustEnabled } = await import('../../lib/cortex-trust-ledger');
        const ledger = getCortexTrustLedger();
        const domain = String(args?.domain || args?.tool || '');
        if (action === 'revoke' || String(args?.op || '') === 'revoke') {
          const ok = ledger.revoke(domain || proposalId, 'voice revocation');
          return { text: ok ? `Revoked autonomy for "${domain}".` : `No trust record for "${domain}".`, artifacts: [] };
        }
        const domains = ledger.listDomains().map(d =>
          `${d.domain}: ${d.cleanExecutes}/${d.totalExecutes} clean${ledger.isDomainGraduated(d) ? ' [GRADUATED]' : ''}${d.revokedAt ? ' [REVOKED]' : ''}`
        );
        return {
          text: `Trust ladder ${isTrustEnabled() ? 'ON' : 'OFF'}.${domains.length ? '\n' + domains.join('\n') : ' No tracked domains yet.'}`,
          artifacts: [],
        };
      }
      const pending = init.getPendingProposals();
      return {
        text: pending.length
          ? `Pending initiatives (${pending.length}):\n${fmtPending().join('\n')}`
          : 'No pending initiatives. The proactive engine is standing by.',
        artifacts: [],
      };
    }

    // Life goals: declare, list, triage status, record signals, forecasts.
    if (tool === 'cortex_goals' || tool === 'life_goals') {
      const { getCortexGoals } = await import('../../lib/cortex-goals');
      const goals = getCortexGoals();
      const action = String(args?.action || 'list').trim();
      const goalId = String(args?.id || args?.goalId || args?.goal_id || '');

      if (action === 'declare' || action === 'create') {
        const title = String(args?.title || args?.goal || '');
        if (!title.trim()) return { text: 'Tell me the goal first — e.g. "my goal this quarter is ship Cortex Phase 1".', artifacts: [] };
        const g = goals.declare({
          title,
          horizon: args?.horizon,
          signals: Array.isArray(args?.signals) ? args.signals.map(String) : undefined,
          targetDate: args?.targetDate ? Date.parse(String(args.targetDate)) : undefined,
        });
        return { text: `Goal declared: "${g.title}" (${g.horizon} horizon, id:${g.id}).`, artifacts: [] };
      }
      if (action === 'pause' || action === 'resume' || action === 'achieve' || action === 'achieved' || action === 'abandon' || action === 'abandoned') {
        const status = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : action.startsWith('achiev') ? 'achieved' : 'abandoned';
        const ok = goals.setStatus(goalId, status as any);
        return { text: ok ? `Goal ${goalId} marked ${status}.` : `No goal matched "${goalId}".`, artifacts: [] };
      }
      if (action === 'record_signal' || action === 'signal') {
        const values = args?.values && typeof args.values === 'object' ? args.values : { [String(args?.signal || 'activity')]: Number(args?.value ?? 1) };
        const ok = goals.recordSignal(goalId, values);
        return { text: ok ? `Signal recorded for goal ${goalId}.` : `No active goal matched "${goalId}".`, artifacts: [] };
      }
      if (action === 'forecast') {
        const key = String(args?.key || args?.pattern || '');
        const f = goals.forecast(key);
        return {
          text: f
            ? `Based on ${f.samples} observations: "${f.key}" bad-outcome rate is ${Math.round(f.rate * 100)}%.`
            : `Not enough data for "${key}" — need at least 8 observations before forecasting.`,
          artifacts: [],
        };
      }
      if (action === 'review') {
        const r = goals.reviewGoals(args?.signals || {});
        return { text: `Weekly goal review: ${r.reviewed} goals checked, ${r.proposals.length} drift proposal${r.proposals.length === 1 ? '' : 's'} raised.`, artifacts: [] };
      }
      const list = goals.list(args?.status);
      const drifting = list.filter(g => (g.driftScore ?? 0) > 0.6);
      const lines = list.slice(0, 10).map(g =>
        `- ${g.title} [${g.status}/${g.horizon}]${g.driftScore !== undefined ? ` drift:${Math.round(g.driftScore * 100)}%` : ''} (id:${g.id})`
      );
      return {
        text: list.length
          ? `Goals (${list.length}${drifting.length ? `, ${drifting.length} drifting` : ''}):\n${lines.join('\n')}`
          : 'No goals declared yet. Say "Cortex, my goal this quarter is …" to set one.',
        artifacts: [],
      };
    }

    // Somatic channel: voice/manual wellness logs → server ingest endpoint.
    if (tool === 'cortex_somatic' || tool === 'wellness_log') {
      const action = String(args?.action || 'log').trim();
      if (action === 'log' || action === 'ingest') {
        const sample: Record<string, unknown> = { source: 'voice', at: Date.now() };
        for (const k of ['hrvMs', 'sleepHours', 'bedtimeHour', 'restingHr']) {
          if (args?.[k] !== undefined) sample[k] = Number(args[k]);
        }
        if (Object.keys(sample).length <= 2) {
          return { text: 'Nothing to log — provide at least one of hrvMs, sleepHours, bedtimeHour, restingHr.', artifacts: [] };
        }
        try {
          const res = await fetch('/api/cortex/initiative/somatic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sample),
          });
          const data = await res.json().catch(() => ({}));
          return {
            text: data?.ok
              ? `Wellness sample logged. Stress score now ${(data.somatic?.stressScore * 100 ?? 0).toFixed(0)}%.`
              : `Somatic ingest failed: ${data?.error || res.status}`,
            artifacts: [],
          };
        } catch (e: any) {
          return { text: `Somatic ingest error: ${e?.message || e}`, artifacts: [] };
        }
      }
      const res = await fetch('/api/cortex/initiative/somatic');
      const data = await res.json().catch(() => ({}));
      const s = data?.somatic;
      return {
        text: s?.sampleCount
          ? `Somatic state: stress ${(s.stressScore * 100).toFixed(0)}%, HRV delta ${s.hrvDeltaPct !== undefined ? `${Math.round(s.hrvDeltaPct * 100)}%` : 'n/a'}, ${s.consecutiveLateNights} consecutive late nights, sleep debt ${s.sleepDebtHours}h (${s.sampleCount} samples${s.fresh ? ', fresh' : ', stale'}).`
          : 'No somatic samples yet — log sleep or HRV to start the interoceptive channel.',
        artifacts: [],
      };
    }

    const isHeavyTool = tool === 'cortex_self_heal' || tool === 'cortex_escalate_bug' || tool === 'escalate_to_ide';
    const toolTimeoutMs = isHeavyTool ? 120000 : 30000;
    const res = await fetch(TOOLS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cortex-key': 'sovereign-local',
      },
      body: JSON.stringify({ tool, args }),
      signal: turnSignal
        ? AbortSignal.any([turnSignal, AbortSignal.timeout(toolTimeoutMs)])
        : AbortSignal.timeout(toolTimeoutMs),
    });
    const data = await res.json().catch(() => ({}));
    // Scene-spawn side channel: generate_splat(inSpace:true) returns
    // sceneSpawn — place it as a live 3D object in the visualizer space.
    // If no 3D scene acknowledges (e.g. /cortex/chat), fall back to a card
    // so the splat is never silently lost.
    const spawn = (data as any)?.sceneSpawn;
    let sceneFallback: CortexArtifact[] = [];
    if (spawn && typeof spawn.url === 'string') {
      const acked = await dispatchSceneSpawn(spawn);
      if (!acked) {
        sceneFallback = validateArtifacts([{
          kind: 'splat',
          title: String(spawn.title || 'Gaussian Splat').slice(0, 200),
          splat: spawn.url,
          caption: 'Generated splat — open the visualizer to place it in the 3D space.',
        }], tool).accepted;
      }
    }
    // Holo-dashboard spawn: compose_dashboard(inSpace:true) returns
    // holoSpawn — render as a curved glass panel inside the 3D scene.
    // No ack → fall back to the dashboard artifact as a normal card.
    const holo = (data as any)?.holoSpawn?.dashboard;
    if (holo && typeof holo === 'object') {
      const acked = await dispatchHoloSpawn(holo);
      if (!acked) sceneFallback.push(...validateArtifacts([holo], tool).accepted);
    }
    const artifacts = [...sceneFallback, ...extractArtifactsFromResult(data, tool)];
    const r = (data as any)?.result ?? data;
    const s = r?.stdout ? String(r.stdout)
      : r?.content ? String(r.content)
      : r?.message || (r?.ok ? 'Success' : JSON.stringify(data).slice(0, 400));
    return { text: String(s).slice(0, 700), artifacts };
  } catch (e: any) {
    return { text: `tool error: ${e?.message || e}`, artifacts: [] };
  }
}

/** Sanitize raw tool output before it enters LLM context — no ANSI, no huge
 *  JSON blobs, bounded length, so the model summarizes instead of parroting. */
function sanitizeToolResult(text: string): string {
  let t = String(text || '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  if (t.length > 600) {
    // Long structured payloads get truncated with a hint, not read aloud.
    t = t.slice(0, 600) + ' …[truncated]';
  }
  return t;
}

/** Check if the accumulated LLM stream is currently inside an unclosed tool-call or JSON block. */
export function isInsideToolCall(content: string): boolean {
  if (!content) return false;
  // 1. Triple backtick fences: odd count means inside an open fence block
  const fenceCount = (content.match(/```/g) || []).length;
  if (fenceCount % 2 === 1) return true;

  // 2. XML-style tool tags
  const openTag = content.lastIndexOf('<tool_call') !== -1 && content.lastIndexOf('</tool_call>') < content.lastIndexOf('<tool_call');
  if (openTag) return true;
  const openFnTag = content.lastIndexOf('<function_call') !== -1 && content.lastIndexOf('</function_call>') < content.lastIndexOf('<function_call');
  if (openFnTag) return true;

  // 3. Bare tool call or JSON object: find last tool marker
  const lastToolIdx = Math.max(
    content.lastIndexOf('```tool'),
    content.lastIndexOf('```json'),
    content.lastIndexOf('tool_call'),
    content.lastIndexOf('{"tool"'),
    content.lastIndexOf('{"name"'),
    content.lastIndexOf('"type":"function"')
  );
  if (lastToolIdx >= 0) {
    const afterMarker = content.slice(lastToolIdx);
    const braceIdx = afterMarker.indexOf('{');
    if (braceIdx >= 0) {
      const balanced = extractBalancedJson(afterMarker.slice(braceIdx));
      if (!balanced) return true;
    } else {
      return true;
    }
  }

  return false;
}

/** Strip everything that must never reach TTS. */
export function cleanSpeech(text: string): string {
  const stripped = stripResidualToolCalls(text)
    .replace(/```(?:tool_call|json|tool)?[\s\S]*?```/gi, '')
    .replace(/```[\s\S]*?$/g, '')
    .replace(/```/g, '')
    .replace(/`(?:tool_call|json|tool)?/gi, '')
    .replace(/<(?:tool_call|function_call|invoke)[\s\S]*?(?:<\/(?:tool_call|function_call|invoke)[^>]*>|$)/gi, '')
    .replace(/\[[A-Z_]+\]/g, '')
    .replace(/\((?:music|upbeat|sad|cheerful|laughs?|sighs?|whispers?|applause|silence|pause|excited|calm|dramatic|thinking|hesitant)[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (looksLikeToolOrJson(stripped)) return '';
  return stripped;
}

/** Abbreviations/honorifics/versions whose periods must NOT split sentences. */
const NO_SPLIT_ABBREV = /^(?:e\.g|i\.e|etc|vs|viz|dr|mr|mrs|ms|prof|sr|jr|st|mt|ft|no|vol|inc|ltd|co|approx|dept|est|min|max|avg|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)$/i;

/** One complete sentence boundary — skips decimals (3.14), abbreviations
 *  (e.g., Dr.), versions (v1.2.3) and initials (J. R. R. Tolkien) so TTS
 *  chunks never break mid-phrase. */
function takeSentence(buffer: string): { sentence: string; rest: string } | null {
  const re = /[.!?]+(?:\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer))) {
    const end = m.index + m[0].length;
    const sentence = buffer.slice(0, end).trim();
    if (sentence.length < 8) continue;
    // Guard: period between digits (3.14), single-letter initial (J.),
    // known abbreviation, or version segment (1.2.3) → not a boundary.
    const before = buffer.slice(0, m.index);
    const prevChar = before.slice(-1);
    const nextChar = buffer[m.index + m[0].length] || '';
    const wordMatch = before.match(/([A-Za-z]+)\.?$/);
    const prevWord = wordMatch ? wordMatch[1].toLowerCase() : '';
    const digitBefore = /\d$/.test(before);
    const digitAfter = /^[\d]/.test(nextChar) || /^\s*\d/.test(buffer.slice(m.index + m[0].length, m.index + m[0].length + 2));
    const singleLetterInitial = /(?:^|\s)[A-Z]\.$/.test(before);
    if ((digitBefore && digitAfter) || NO_SPLIT_ABBREV.test(prevWord) || singleLetterInitial) continue;
    return { sentence, rest: buffer.slice(end) };
  }
  return null;
}

/** Turn the detected user emotion into a compact tone directive for the LLM.
 *  Kept terse — it rides every agentic turn's system suffix. */
function emotionGuidanceSuffix(e: EmotionState | null): string {
  if (!e || e.confidence < 0.45 || e.primary === 'neutral' || e.primary === 'calm') return '';
  switch (e.primary) {
    case 'stressed':
      return 'USER EMOTION: stressed. Stay calm and reassuring, slower pace, offer to simplify or prioritize — never add pressure.';
    case 'sad':
      return 'USER EMOTION: down. Be warm and gentle, acknowledge the feeling first, keep it brief and human.';
    case 'angry':
      return 'USER EMOTION: frustrated. Stay steady and solution-first, never defensive or dismissive, de-escalate with brevity.';
    case 'excited':
    case 'happy':
      return 'USER EMOTION: upbeat. Match the energy, be enthusiastic and forward-looking, keep momentum.';
    case 'tired':
      return 'USER EMOTION: drained. Be soft and concise, suggest the smallest next step or a break, no demands.';
    case 'confused':
      return 'USER EMOTION: uncertain. Slow down, clarify with one simple question or a step-by-step breakdown.';
    default:
      return '';
  }
}

interface StreamOpts {
  signal?: AbortSignal;
  /** Dispatch each completed sentence for speech as it arrives. */
  onSentence?: (sentence: string, isFinal: boolean) => void;
  /** Dispatch real-time reasoning thoughts to HUD or telemetry. */
  onReasoning?: (reasoning: string) => void;
  /** Extra context appended to the system prompt (e.g. recalled memories). */
  systemSuffix?: string;
}

/** nexus-guest SSE stream → accumulated text; sentences fire as they complete. */
async function streamLLM(history: ChatMsg[], opts: StreamOpts = {}): Promise<string> {
  // Connect timeout only — AbortSignal.timeout stays armed for the whole body
  // stream and kills replies that generate longer than 30s. Disarm once
  // headers arrive; the 12s token-silence watchdog + 90s turn deadline cover stalls.
  const connAbort = new AbortController();
  const connTimer = setTimeout(() => connAbort.abort(), 30000);
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, connAbort.signal])
    : connAbort.signal;
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      context: 'cortex',
      systemPrompt: VOICE_SYSTEM_PROMPT + (opts.systemSuffix ? `\n\n${opts.systemSuffix}` : ''),
      messages: history.slice(-12),
      stream: true,
    }),
  });
  clearTimeout(connTimer);
  if (!res.ok) throw new Error(`llm ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('llm no stream');
  const dec = new TextDecoder();
  let buf = '', content = '', voiceBuf = '';
  const toolCallEvents: any[] = [];
  let tailTimer: ReturnType<typeof setTimeout> | null = null;
  const dispatch = (sentence: string, isFinal: boolean) => {
    // Suppress speech if currently inside a tool fence or tool call
    if (isInsideToolCall(content)) return;
    if (looksLikeToolOrJson(sentence)) return;
    const clean = cleanSpeech(sentence);
    if (clean && !looksLikeToolOrJson(clean)) {
      opts.onSentence?.(clean, isFinal);
    }
  };
  for (;;) {
    // 12s token silence watchdog: abort cleanly if upstream stream stalls
    const readPromise = reader.read();
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<{ done: true; value: undefined }>((resolve) => {
      silenceTimer = setTimeout(() => {
        try { reader.cancel(); } catch {}
        resolve({ done: true, value: undefined });
      }, 12000);
    });
    const { done, value } = await Promise.race([readPromise, timeoutPromise]);
    if (silenceTimer) clearTimeout(silenceTimer);
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      let token = '';
      try {
        const parsed = JSON.parse(payload);
        const reasoningToken = parsed.reasoning ?? parsed.reasoning_content ?? '';
        if (reasoningToken && opts.onReasoning) {
          opts.onReasoning(reasoningToken);
        }
        token = parsed.token ?? parsed.text ?? '';
        if (!token && typeof parsed.content === 'string') token = parsed.content;
        if (parsed.toolCall) toolCallEvents.push(parsed.toolCall);
        if (Array.isArray(parsed.tool_calls)) toolCallEvents.push(...parsed.tool_calls);
      } catch {
        try { token = JSON.parse(`"${payload}"`); } catch {}
      }
      if (!token) continue;
      content += token;

      // If we are currently inside a tool call, purge any partial voice buffer
      // and do NOT accumulate tool tokens into voiceBuf.
      if (isInsideToolCall(content)) {
        voiceBuf = '';
        continue;
      }

      voiceBuf += token;
      // Drain every complete sentence currently in the buffer.
      for (;;) {
        const s = takeSentence(voiceBuf);
        if (!s) break;
        voiceBuf = s.rest;
        dispatch(s.sentence, false);
      }
      // Long unpunctuated tails (single-sentence replies) would otherwise
      // wait for stream end — flush after 1.6s of token silence instead.
      if (tailTimer) clearTimeout(tailTimer);
      tailTimer = setTimeout(() => {
        tailTimer = null;
        const t = voiceBuf.trim();
        if (t.length >= 40) {
          voiceBuf = '';
          dispatch(t, false);
        }
      }, 1600);
    }
  }
  if (tailTimer) { clearTimeout(tailTimer); tailTimer = null; }
  if (!isInsideToolCall(content)) {
    const tail = cleanSpeech(voiceBuf.trim());
    if (tail && !looksLikeToolOrJson(tail)) dispatch(tail, true);
  }
  // Native tool-call dialect: some providers stream {"type":"function",...}
  // or a toolCall field instead of text fences. Convert the first event into
  // the fenced format parseToolCalls understands so tools actually execute.
  if (toolCallEvents.length && !/```|tool_call/i.test(content)) {
    const tc: any = toolCallEvents[0];
    const name = tc?.tool || tc?.name || tc?.function?.name;
    const rawArgs = tc?.args ?? tc?.parameters ?? tc?.function?.arguments;
    if (typeof name === 'string' && name) {
      let argsJson = '{}';
      if (rawArgs && typeof rawArgs === 'object') argsJson = JSON.stringify(rawArgs);
      else if (typeof rawArgs === 'string' && rawArgs.trim().startsWith('{')) argsJson = rawArgs;
      content += `\n\`\`\`tool_call\n{"tool":${JSON.stringify(name)},"args":${argsJson}}\n\`\`\``;
    }
  }
  return content.trim();
}

const normForDedupe = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function useVisualizerVoice(enabled: boolean, onState: (speaking: boolean) => void) {
  const apiRef = useRef<{
    onTranscript: (r: STTResult) => void;
    onSpeechPause: (text: string) => void;
    interrupt: () => void;
    debug: () => { history: ChatMsg[]; queue: number; priority: string | null; turnInFlight?: boolean; speaking?: boolean };
  } | null>(null);

  const voiceStream = useVoiceStream({
    continuous: true,
    interimResults: true,
    ttsModel: 'kokoro',
    ttsVoice: 'cortana',
    onTranscript: (r) => apiRef.current?.onTranscript(r),
    onSpeechPause: (t) => apiRef.current?.onSpeechPause(t),
    onError: (e) => console.warn('[viz-voice]', e),
  });
  const vsRef = useRef(voiceStream);
  vsRef.current = voiceStream;

  // Affective loop: text-prosody emotion detection (lexicon + optional voice
  // prosody). Text analysis is pure — no extra mic graph — so every user turn
  // gets a free emotion read that tunes tone guidance, TTS prosody, and the
  // signal bus for the scenes.
  const emotionApi = useEmotionDetection();

  // Mirror TTS activity to the page's mic-live indicator.
  useEffect(() => { onState(voiceStream.isSpeaking); }, [voiceStream.isSpeaking, onState]);

  // Test/automation hook.
  useEffect(() => {
    (window as unknown as { __vizVoiceApi?: unknown }).__vizVoiceApi = apiRef;
    return () => { delete (window as unknown as { __vizVoiceApi?: unknown }).__vizVoiceApi; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const historyRef: { current: ChatMsg[] } = { current: [] };
    const sessionArtifactsRef: { current: CortexArtifact[] } = { current: [] };
    const pendingQueue: string[] = [];
    const activeSpeechRef = { current: '' };
    // Shared-transcript mirror: everything Cortex speaks this turn is appended
    // to the chat store so /cortex/chat and the visualizer drawer stay in sync.
    const liveTurnRef = { aiId: null as string | null, userId: null as string | null, buf: '', artifacts: [] as CortexArtifact[] };
    const speechHistoryRef = { current: [] as string[] };
    const turnAbortRef = { current: null as AbortController | null };
    // Per-turn user emotion (text prosody) — set in runTurn, read by the
    // system-prompt suffix, TTS speed shaping, and the signal bus.
    const turnEmotionRef = { current: null as EmotionState | null };
    // Spec-confirmation gate: agent work with real blast radius (builder /
    // spawned agents) is intercepted, expanded into a contract, spoken, and
    // held here until the user's next utterance confirms or cancels it.
    const pendingSpecRef = { current: null as null | {
      tool: string; args: Record<string, any>; spec: any;
      agentId: string; kind: string; title: string; at: number;
    } };
    // Two-tier speech finish window (instant control commands vs 850ms conversational buffer)
    const speechFinishTimerRef = { current: null as any };
    const speechAccumulatorRef = { current: '' };
    const FINISH_WINDOW_MS = 850;
    const isImmediateControlWord = (t: string) =>
      /^(?:stop|pause|cancel|wait|hold on|quiet|mute|shut up|nevermind|never mind|clear|close panels?|reset)\b/i.test(t.trim());

    const state = {
      turnInFlight: false,
      interruptRequested: false,
      lastSpeechEndAt: 0,
      lastInterimPublish: 0,
      priority: null as string | null,
      awaitingPlace: false,
      awaitPlaceAge: 0,
      earlyInterruptFired: false,
      earlyCommitted: null as { text: string; at: number } | null,
      turnTimedOut: false,
      speakingSince: 0,
      turnGen: 0,
    };

    const getLivePhi = (): number => {
      try {
        const ag = getOrInitConsciousAgent();
        const phi = ag?.kernel?.state?.currentPhi;
        return typeof phi === 'number' && !isNaN(phi) ? Number(phi.toFixed(2)) : 0;
      } catch {
        return 0;
      }
    };

    const publish = (p: Parameters<typeof cortexSignalBus.publish>[0]) => {
      const livePhi = getLivePhi();
      const phi = p.phi ?? (livePhi > 0 ? livePhi : undefined);
      const emotion = turnEmotionRef.current?.primary;
      cortexSignalBus.publish({
        agentName: 'CORTEX', channel: 'voice',
        ...(phi !== undefined ? { phi } : {}),
        emotion: emotion ?? 'neutral',
        ...p,
      });
    };
    const publishQueue = () => publish({ queueDepth: pendingQueue.length + (state.priority ? 1 : 0) });
    const toListening = (text = 'Listening…') =>
      publish({ state: 'listening', level: 0.1, text });

    /** Speak one cleaned sentence through the shared gapless TTS queue. */
    const speakSentence = (text: string, isFinal: boolean, meta = false) => {
      const clean = cleanSpeech(text);
      if (!clean || cancelled) return;
      // Mirror spoken output into the shared chat transcript (live) — unless
      // this is meta-speech (filler ack, pin hint) which must NOT pollute the
      // transcript, persisted chat, or episodic memory.
      if (!meta) {
        liveTurnRef.buf = liveTurnRef.buf
          ? `${liveTurnRef.buf} ${clean}`
          : clean;
        if (!liveTurnRef.aiId) {
          liveTurnRef.aiId = `viz-ai-${Date.now()}`;
        }
        upsertCortexChatMessage({
          id: liveTurnRef.aiId,
          role: 'ai',
          content: liveTurnRef.buf,
          timestamp: Date.now(),
          streaming: true,
        } as ChatMessage);
      }
      activeSpeechRef.current = clean;
      speechHistoryRef.current = [clean, ...speechHistoryRef.current.slice(0, 9)];
      // Landing-grade normalization at the TTS boundary only — markdown,
      // emoji, $/%/dates are spoken correctly while the transcript keeps
      // the clean (but readable) version.
      const ttsText = sanitizeForNexusTTS(clean) || clean;
      // Prosodic mirroring: Cortex's delivery subtly tracks the user's detected
      // arousal — measured, never theatrical (±6% rate, calm baseline 1.0).
      const emo = turnEmotionRef.current;
      let speechRate = 1.0;
      if (emo && emo.confidence >= 0.45 && emo.primary !== 'neutral') {
        if (emo.primary === 'stressed' || emo.primary === 'sad' || emo.primary === 'angry') speechRate = 0.95;
        else if (emo.primary === 'tired') speechRate = 0.93;
        else if (emo.primary === 'excited' || emo.primary === 'happy') speechRate = Math.min(1.06, 0.97 + emo.arousal * 0.12);
        else if (emo.primary === 'confused') speechRate = 0.96;
      }
      vsRef.current.speakStreamSentence(ttsText, isFinal, { voice: 'cortana', speed: speechRate });
    };

    const speakWhole = async (text: string) => {
      speakSentence(text, true);
      vsRef.current.finishStreaming();
    };
    const speakWholeMeta = async (text: string) => {
      speakSentence(text, true, true);
      vsRef.current.finishStreaming();
    };

    /** claude-mem pattern: top-k relevant memories injected per turn (bounded). */
    let turnMemorySuffix = '';
    const recallMemories = async (query: string): Promise<string> => {
      try {
        const res = await fetch(TOOLS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cortex-key': 'sovereign-local',
          },
          body: JSON.stringify({ tool: 'cortex_memory', args: { action: 'recall', query, limit: 3 } }),
          signal: AbortSignal.timeout(4000),
        });
        const data: any = await res.json().catch(() => ({}));
        const results = data?.result?.results || data?.results || [];
        if (!Array.isArray(results) || !results.length) return '';
        const lines = results.slice(0, 3).map((r: any) =>
          `- [${r.title || r.path}] ${String(r.snippet || '').replace(/\s+/g, ' ').slice(0, 220)}`);
        return `RELEVANT MEMORY (use only if pertinent):\n${lines.join('\n')}`;
      } catch {
        return '';
      }
    };

    /** Hermes-style episodic compression: one compact record per completed turn. */
    const saveEpisode = (userText: string, replyText: string) => {
      void fetch(TOOLS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cortex-key': 'sovereign-local',
        },
        body: JSON.stringify({
          tool: 'cortex_memory',
          args: {
            action: 'save_episodic',
            content: JSON.stringify({
              ts: new Date().toISOString(),
              kind: 'voice_turn',
              user: userText.slice(0, 240),
              reply: replyText.slice(0, 400),
            }),
          },
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    };

    /** LLM turn with bounded tool execution — the visualizer runs real tasks.
     *  Streams sentences to speech as they generate; returns null on interrupt. */
    // Reasoning-only providers sometimes stream zero content tokens; the
    // proxy injects this marker sentence — never speak it, treat as empty.
    const EMPTY_RESPONSE_RE = /upstream model returned an empty response/i;
    const speakUnlessEmpty = (s: string, isFinal: boolean) => {
      if (!EMPTY_RESPONSE_RE.test(s)) speakSentence(s, isFinal);
    };
    const agenticReply = async (): Promise<string | null> => {
      const signal = turnAbortRef.current?.signal;

      let worldStateHeader = '';
      try {
        const wsRes = await fetch('/api/cortex/world-state', {
          signal: AbortSignal.timeout(400),
          cache: 'no-store',
        });
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          if (wsData?.header) {
            worldStateHeader = wsData.header;
          }
        }
      } catch {}

      const sysSuffix = [worldStateHeader, emotionGuidanceSuffix(turnEmotionRef.current), turnMemorySuffix, surfaceManifestSuffix()].filter(Boolean).join('\n\n') || undefined;
      turnMemorySuffix = '';
      let accumulatedThought = '';
      const onReasoning = (chunk: string) => {
        accumulatedThought = (accumulatedThought + chunk).slice(-200);
        publish({
          state: 'thinking',
          stage: 'analyzing',
          thought: accumulatedThought.replace(/\s+/g, ' ').trim(),
          missionProgress: -1,
          text: 'Formulating cognitive plan…',
        });
      };
      publish({
        state: 'thinking',
        stage: 'analyzing',
        missionProgress: -1,
        text: 'Analyzing directive & planning execution…',
      });
      let reply = await streamLLM(historyRef.current, {
        signal,
        systemSuffix: sysSuffix,
        onSentence: speakUnlessEmpty,
        onReasoning,
      });
      for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
        if (state.interruptRequested || cancelled) break;
        const calls = parseToolCalls(reply);
        if (!calls.length) break;
        const records: string[] = [];
        for (const c of calls.slice(0, MAX_TOOLS_PER_ROUND)) {
          if (state.interruptRequested || cancelled) break;
          publish({
            state: 'working',
            stage: 'executing',
            tool: c.tool,
            missionProgress: -1,
            text: friendlyToolDescription(c.tool, c.args),
          });

          // Live rotational progress indicator for multi-stage self-healing & heavy tooling
          let progressTimer: ReturnType<typeof setInterval> | null = null;
          if (c.tool === 'cortex_self_heal' || c.tool === 'cortex_escalate_bug' || c.tool === 'escalate_to_ide') {
            const stages = [
              'Self-Heal: Diagnosing with Devin & Antigravity…',
              'Self-Heal: Running local invariant & typecheck gates…',
              'Self-Heal: Auditor 1 (Claude Code) inspecting candidate diff…',
              'Self-Heal: Auditor 2 (DeepSeek) conducting architecture review…',
              'Self-Heal: Evaluating 2-IDE peer-review consensus…',
              'Self-Heal: Finalizing resolution & audit trail…',
            ];
            let sIdx = 0;
            progressTimer = setInterval(() => {
              if (state.interruptRequested || cancelled) return;
              sIdx = (sIdx + 1) % stages.length;
              publish({ state: 'working', level: 0.35, text: stages[sIdx] });
            }, 3500);
          }

          let toolExecResult: { text: string; artifacts: CortexArtifact[] };
          // Spec gate: builder/spawned-agent task submissions pause for an
          // explicit user "go" — the contract is spoken, execution held.
          const isGatedCall = c.tool === 'cortex_agents'
            && String(c.args?.action || '') === 'task'
            && needsSpecConfirm(c.args);
          const gated = isGatedCall
            ? pendingSpecRef.current
              ? { text: `[Spec gate: another agent task was requested but a contract is already awaiting the user's "go"/"cancel" — do NOT execute it. Tell the user one confirmation is pending first.]`, artifacts: [] as CortexArtifact[] }
              : await proposeSpecConfirm(c, signal)
            : null;
          try {
            toolExecResult = gated ?? await execTool(c.tool, c.args, signal);
          } finally {
            if (progressTimer) clearInterval(progressTimer);
          }
          const { text: result, artifacts } = toolExecResult;
          for (const a of artifacts) {
            if (!liveTurnRef.artifacts.some((x) => x.id === a.id)) {
              liveTurnRef.artifacts.push(a);
            }
            if (!sessionArtifactsRef.current.some((x) => x.id === a.id)) {
              sessionArtifactsRef.current.unshift(a);
            }
            openSurfacePanel({
              kind: a.kind === 'map' ? 'map' : a.kind === 'document' ? 'document' : 'artifact',
              title: a.title || (a.kind === 'document' ? 'Executive Resume' : a.kind),
              artifact: a,
              pinned: true,
            });
          }
          records.push(`[Host Tool Execution Record: ${c.tool}(${JSON.stringify(c.args).slice(0, 200)})]\nResult: ${sanitizeToolResult(result)}`);
        }
        if (state.interruptRequested || cancelled) break;
        historyRef.current.push({ role: 'user', content: records.join('\n\n') });
        publish({
          state: 'thinking',
          stage: 'synthesizing',
          missionProgress: -1,
          text: 'Synthesizing response…',
        });
        reply = await streamLLM(historyRef.current, {
          signal,
          systemSuffix: sysSuffix,
          onSentence: speakUnlessEmpty,
          onReasoning,
        });
      }
      vsRef.current.finishStreaming();
      if (state.interruptRequested) { state.interruptRequested = false; return null; }
      let finalReply = cleanSpeech(stripResidualToolCalls(reply));
      // Empty/reasoning-only completion after tools — one nudge retry before
      // giving up, then an honest artifact-aware fallback.
      if (!finalReply || EMPTY_RESPONSE_RE.test(finalReply)) {
        historyRef.current.push({ role: 'user', content: 'Answer the user now — one or two short spoken sentences, no tool calls.' });
        const retry = await streamLLM(historyRef.current, {
          signal,
          systemSuffix: sysSuffix,
          onSentence: speakUnlessEmpty,
        });
        finalReply = cleanSpeech(stripResidualToolCalls(retry));
        if (!finalReply || EMPTY_RESPONSE_RE.test(finalReply)) {
          finalReply = liveTurnRef.artifacts.length
            ? 'Done — it is ready. Say "pin that" if you want it docked on the surface.'
            : 'Sorry, I missed that — could you say it again?';
        }
      }
      return finalReply;
    };

    // state.awaitingPlace: true after "open the map" until a place flies or
    // the map closes — bare place names then geocode instead of hitting the LLM.
    const isQuestionLike = (t: string) =>
      /^(what|who|when|why|how|which|can you|could you|would you|please tell|tell me|never mind|nevermind|stop|thanks|thank you|hello|hi|hey|yes|no|ok|okay)\b/i.test(t.trim());

    const getUserPosition = () => new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        timeout: 8000, maximumAge: 60000,
      });
    });

    /** Map/globe commands run client-side — geocode + postMessage, no LLM. */
    const handleMapTurn = async (cmd: MapCommand, utterance = '') => {
      // Place-qualified camera: "camera near duluth georgia" → fly there with
      // the cctv layer, then degrade into the standard nearest-camera flow.
      let cctvPlaceGeo: { lat: number; lon: number; name: string } | null = null;
      const aborted = () => cancelled || state.interruptRequested;
      // Geocode + globe fly can take seconds — acknowledge immediately so the
      // turn never feels dead (meta-speech, excluded from transcript).
      speakSentence(pickFiller(utterance) || 'One moment — pulling that up.', false, true);
      if (cmd.type === 'cctv-place') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        publish({ state: 'thinking', level: 0.15, text: `Finding cameras near ${cmd.place}…` });
        const geo = await geocodePlace(cmd.place);
        if (aborted()) return;
        if (!geo) {
          await speakWhole(`I couldn't find ${cmd.place} — try a nearby city or say it differently.`);
          return;
        }
        await flyGlobe(buildFlyView(geo, undefined, { layers: ['cctv'] }));
        if (aborted()) return;
        setLastDestination(geo);
        cctvPlaceGeo = geo;
        cmd = { type: 'cctv', action: 'nearest' };
      }
      if (cmd.type === 'close') {
        state.awaitingPlace = false;
        state.awaitPlaceAge = 0;
        setLastCctvName(null);
        setGlobeMode('core');
        await speakWhole('Back to the core.');
        return;
      }
      if (cmd.type === 'back') {
        if (!isGlobeAvailable() || !isGlobeMounted()) {
          await speakWhole('The globe isn\'t open — nothing to go back to.');
          return;
        }
        publish({ state: 'thinking', level: 0.15, text: 'Going back…' });
        const ok = await flyGlobeBack();
        if (aborted()) return;
        await speakWhole(ok ? 'Back to the previous view.' : 'There\'s no earlier view to return to.');
        return;
      }
      if (cmd.type === 'forward') {
        if (!isGlobeAvailable() || !isGlobeMounted()) {
          await speakWhole('The globe isn\'t open — nothing to go forward to.');
          return;
        }
        publish({ state: 'thinking', level: 0.15, text: 'Going forward…' });
        const ok = await flyGlobeForward();
        if (aborted()) return;
        await speakWhole(ok ? 'Forward to the next view.' : 'There\'s no later view to return to.');
        return;
      }
      if (cmd.type === 'open-blank') {
        state.awaitingPlace = true;
        state.awaitPlaceAge = 0;
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        await speakWhole('Map\'s up — tell me where to fly.');
        return;
      }
      if (cmd.type === 'layers' || cmd.type === 'zoom' || cmd.type === 'follow' ||
          cmd.type === 'unfollow' || cmd.type === 'pin') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        let applied: Promise<boolean> | null = null;
        if (cmd.type === 'layers') applied = globeSetLayers(cmd.mode, cmd.layers);
        else if (cmd.type === 'zoom') applied = globeZoom(cmd.dir);
        else if (cmd.type === 'follow') applied = globeFollow(cmd.kind, cmd.id, cmd.cockpit === true);
        else if (cmd.type === 'unfollow') applied = globeUnfollow();
        else applied = globePin();
        if (applied === null) {
          await speakWhole('Globe\'s up — fly somewhere first, then I can adjust it.');
          return;
        }
        const ok = await applied;
        const pruned = getLastPrunedLayers();
        const caveat = pruned.length
          ? ` Note: ${pruned.map(layerName).join(', ')} didn't come up — this globe doesn't have that provider.`
          : '';
        if (cmd.type === 'layers') {
          const phrase = ok
            ? describeLayerChange(cmd.mode, cmd.layers)
            : 'Layer change sent — give it a moment.';
          await speakWhole(phrase + caveat);
        } else if (cmd.type === 'zoom') {
          await speakWhole(ok ? (cmd.dir === 'in' ? 'Zooming in.' : 'Zooming out.') : 'Zoom sent — give it a moment.');
        } else if (cmd.type === 'follow') {
          const where = cmd.cockpit ? ' — taking the cockpit' : '';
          await speakWhole(ok ? `Tracking ${cmd.id}${where} — cockpit view available in the globe.` : `Looking for ${cmd.id} — it may not be airborne right now.`);
        } else if (cmd.type === 'unfollow') {
          await speakWhole(ok ? 'Released — back to the overview.' : 'Release sent.');
        } else {
          await speakWhole(ok ? 'Pin dropped.' : 'Pin sent.');
        }
        return;
      }
      // ── Place intelligence: Google Places search + details via GEV bridge ──
      if (cmd.type === 'place-search' || cmd.type === 'place-details') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        // Resolve the anchor: explicit place → last destination → user GPS.
        let anchor: { lat: number; lon: number; name?: string } | null = null;
        const anchorName = cmd.type === 'place-search' ? cmd.place : cmd.place;
        if (anchorName && !/^(?:me|here|my\s+location|current\s+location)$/i.test(anchorName)) {
          anchor = await geocodePlace(anchorName);
        }
        if (!anchor) {
          const last = getLastDestination();
          if (last) anchor = { lat: last.lat, lon: last.lon, name: last.name };
        }
        if (!anchor) {
          const pos = await getUserPosition();
          if (pos) anchor = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'your location' };
        }
        if (aborted()) return;
        if (cmd.type === 'place-search') {
          const where = anchor?.name || cmd.place;
          publish({ state: 'thinking', level: 0.15, text: `Searching places: ${cmd.query} in ${where}…` });
          const res = await globePlacesSearch(cmd.query, {
            ...(anchor ? { lat: anchor.lat, lon: anchor.lon, radiusM: 25000 } : {}),
          });
          if (aborted()) return;
          if (!res || res.ok === false) {
            await speakWhole(`Place search didn't come back — ${String(res?.error || 'globe not responding')}.`);
            return;
          }
          const places = Array.isArray(res.places) ? (res.places as any[]) : [];
          const count = typeof res.count === 'number' ? res.count : places.length;
          if (!count) {
            await speakWhole(`I couldn't find any ${cmd.query} around ${where}.`);
            return;
          }
          // Frame the results: fly to the anchor (or first result) so the pins
          // are on screen, then speak the top rated few.
          const top = [...places]
            .filter((p) => Number.isFinite(p?.rating))
            .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
            .slice(0, 3);
          const frame = top[0] && Number.isFinite(top[0].lat)
            ? { lat: top[0].lat, lon: top[0].lon, name: top[0].name }
            : anchor;
          if (frame) await flyGlobe(buildFlyView({ lat: frame.lat, lon: frame.lon, name: frame.name || where } as any, undefined, { altitude: 30000, pitch: -55 }));
          if (aborted()) return;
          const spoken = top.length
            ? `Found ${count} ${cmd.query} around ${where}. Top rated: ${top.map((p) => `${p.name} ${p.rating}★`).join(', ')}. Tap a pin for reviews.`
            : `Found ${count} ${cmd.query} around ${where} — they're pinned on the globe. Tap one for reviews.`;
          await speakWhole(spoken);
          return;
        }
        // place-details
        publish({ state: 'thinking', level: 0.15, text: `Looking up ${cmd.query}…` });
        const dres = await globePlaceDetails({
          q: cmd.query,
          ...(anchor ? { lat: anchor.lat, lon: anchor.lon } : {}),
        });
        if (aborted()) return;
        const place = (dres?.place ?? null) as any;
        if (!dres || dres.ok === false || !place) {
          await speakWhole(`I couldn't pull up details for ${cmd.query} — ${String(dres?.error || 'no matching place')}.`);
          return;
        }
        const bits = [
          place.name,
          place.rating != null ? `${place.rating} stars from ${place.ratingCount?.toLocaleString?.() ?? place.ratingCount ?? '?'} reviews` : 'no rating yet',
          place.priceLevel ? `price level ${String(place.priceLevel).replace('PRICE_LEVEL_', '').toLowerCase()}` : null,
          place.openNow === true ? 'open now' : place.openNow === false ? 'currently closed' : null,
        ].filter(Boolean).join(', ');
        await speakWhole(`${bits}. Full reviews are on the pin if it's on the globe.`);
        return;
      }
      // ── Place annotations: pin/highlight/area/label/arrow ──────────────
      if (cmd.type === 'pin-place' || cmd.type === 'annotate' || cmd.type === 'arrow') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        if (cmd.type === 'arrow') {
          publish({ state: 'thinking', level: 0.15, text: `Drawing arrow to ${cmd.to}…` });
          // Resolve 'from' like routes: explicit → last destination → GPS.
          let fromPt: { lat: number; lon: number; label?: string } | null = null;
          if (cmd.from) {
            const g = await geocodePlace(cmd.from);
            if (g) fromPt = { lat: g.lat, lon: g.lon, label: g.name };
          }
          if (!fromPt) {
            const last = getLastDestination();
            if (last) fromPt = { lat: last.lat, lon: last.lon, label: last.name };
          }
          if (!fromPt) {
            const pos = await getUserPosition();
            if (pos) fromPt = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' };
          }
          if (aborted()) return;
          if (!fromPt) {
            await speakWhole('Where should the arrow start? Try "arrow from Chicago to Denver".');
            return;
          }
          const toGeo = await geocodePlace(cmd.to);
          if (aborted()) return;
          if (!toGeo) {
            await speakWhole(`I couldn't find ${cmd.to} — try a nearby city or say it differently.`);
            return;
          }
          const applied = globeArrow(fromPt, { lat: toGeo.lat, lon: toGeo.lon, label: toGeo.name });
          if (aborted()) return;
          await speakWhole(applied
            ? `Arrow drawn from ${fromPt.label || 'here'} to ${toGeo.name}.`
            : `Arrow to ${toGeo.name} sent — give it a moment.`);
          return;
        }
        const place = cmd.type === 'pin-place' ? cmd.place : cmd.place;
        publish({ state: 'thinking', level: 0.15, text: `Marking ${place}…` });
        const geo = await geocodePlace(place);
        if (aborted()) return;
        if (!geo) {
          await speakWhole(`I couldn't find ${place} — try a nearby city or say it differently.`);
          return;
        }
        let annotation: Record<string, unknown>;
        let spoken: string;
        if (cmd.type === 'pin-place') {
          annotation = { type: 'pin', latitude: geo.lat, longitude: geo.lon, label: geo.name, color: 'cyan' };
          spoken = `Pin dropped on ${geo.name}.`;
        } else if (cmd.type === 'annotate' && cmd.kind === 'label') {
          // Label carries the place name so GEV resolves the anchor; `text`
          // is the caption ("label Tokyo as home base").
          annotation = { type: 'label', target: place, label: cmd.text || geo.name, color: 'cyan' };
          spoken = cmd.text ? `Labeled ${geo.name} as ${cmd.text}.` : `Label placed on ${geo.name}.`;
        } else {
          // highlight/area: send the NAME — GEV's resolver turns streets into
          // real outlines and districts into footprints, better than a dot.
          annotation = { type: cmd.kind, target: place, label: geo.name, color: cmd.kind === 'area' ? 'amber' : 'cyan' };
          spoken = cmd.kind === 'highlight' ? `Highlighting ${geo.name}.` : `Circling ${geo.name}.`;
        }
        const applied = globeAnnotate(annotation, { lat: geo.lat, lon: geo.lon });
        if (aborted()) return;
        await speakWhole(applied ? spoken : `${spoken} Give it a moment.`);
        return;
      }
      if (cmd.type === 'time') {
        if (!isGlobeMounted()) {
          await speakWhole('Open the map first — time controls need the live globe.');
          return;
        }
        publish({ state: 'thinking', level: 0.15, text: 'Adjusting world clock…' });
        const res = await globeTime(cmd);
        if (aborted()) return;
        if (res === null) {
          await speakWhole('Time control didn\'t get through — the globe may still be loading.');
        } else if (res.ok === false) {
          await speakWhole(`Couldn't set the time — ${String(res.error || 'globe rejected it')}.`);
        } else if (cmd.op === 'seek') {
          await speakWhole('Time scrubbed — satellites and weather moved to that moment. Live feeds like flights stay live.');
        } else if (cmd.op === 'play') {
          await speakWhole('Time is rolling forward.');
        } else if (cmd.op === 'pause') {
          await speakWhole('Time held in place.');
        } else {
          await speakWhole('Back to live.');
        }
        return;
      }
      if (cmd.type === 'cctv') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        // Camera-relative actions (nearest/focus) need a framed view first —
        // establish one from the last destination or GPS if the globe is cold
        // or was opened blank (iframe mounted but nothing flown yet).
        if (!isGlobeMounted() || !hasGlobeView()) {
          const last = getLastDestination();
          if (last) await flyGlobe(buildFlyView(last));
          else {
            const pos = await getUserPosition();
            if (pos) await flyGlobe(buildFlyView({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Your location' }));
          }
          if (aborted()) return;
        }
        // Last resort: a high overview so layer commands have a view to hang on.
        if (!hasGlobeView()) {
          await flyGlobe({
            camera: { lat: 20, lon: 0, altitude_m: 2_500_000, heading_deg: 0, pitch_deg: -90 },
            layers: ['flights', 'ais-live-vessels', 'satellites', 'cctv'],
            map: getGlobeMapStyle(),
            annotations: [],
          });
          if (aborted()) return;
        }
        publish({ state: 'thinking', level: 0.15, text: 'Finding camera…' });
        let res = await globeCctv(cmd.action, { query: cmd.query, enabled: cmd.enabled });
        // GEV refuses camera actions while the cctv layer is off — enable it,
        // then retry with backoff: layer data takes a few seconds to come up.
        for (let attempt = 0; res && res.ok === false && /off|enable/i.test(String(res.error || '')) && attempt < 3; attempt++) {
          await globeSetLayers('add', ['cctv']);
          await new Promise((r) => setTimeout(r, 2500));
          if (aborted()) return;
          res = await globeCctv(cmd.action, { query: cmd.query, enabled: cmd.enabled });
        }
        if (aborted()) return;
        if (res === null) {
          await speakWhole('Camera control didn\'t get through — give it a moment and try again.');
        } else if (res.ok === false) {
          await speakWhole(`Couldn't do that — ${String(res.error || 'no matching camera')}.`);
        } else if (cmd.action === 'nearest') {
          const camName = String(res.activeCamera || 'the nearest live camera');
          setLastCctvName(camName);
          // Place-qualified request: verify the locked camera is actually near
          // the destination. Catalogs are sparse — a "nearest" cam can be
          // hundreds of km away; say so honestly instead of implying locality.
          const camLat = typeof res.activeCameraLat === 'number' && Number.isFinite(res.activeCameraLat) ? res.activeCameraLat : null;
          const camLon = typeof res.activeCameraLon === 'number' && Number.isFinite(res.activeCameraLon) ? res.activeCameraLon : null;
          if (cctvPlaceGeo && camLat !== null && camLon !== null) {
            const distKm = Math.round(haversineKm(cctvPlaceGeo, { lat: camLat, lon: camLon }));
            if (distKm > 120) {
              await speakWhole(
                `I flew to ${cctvPlaceGeo.name}, but there are no live cameras anywhere near it — ` +
                `the closest feed is ${camName}, about ${distKm} kilometers away. I've centered on that instead.`,
              );
            } else {
              await speakWhole(`Found a live camera ${distKm} kilometers from ${cctvPlaceGeo.name} — ${camName} is up.`);
            }
          } else {
            await speakWhole(`Centered on ${camName} — live feed is up.`);
          }
        } else if (cmd.action === 'select') {
          const camName = String(res.selected || res.activeCamera || cmd.query);
          setLastCctvName(camName);
          await speakWhole(`Watching ${camName} — live feed is up.`);
        } else if (cmd.action === 'next' || cmd.action === 'prev') {
          await speakWhole(`Now watching ${res.activeCamera || 'the next camera'}.`);
        } else if (cmd.action === 'focus') {
          await speakWhole(`Focused on ${res.activeCamera || 'the active camera'}.`);
        } else {
          await speakWhole(cmd.enabled === false ? 'Camera coverage hidden.' : 'Camera coverage on.');
        }
        // Successful camera lock → dock a CCTV panel with whatever metadata GEV returned.
        if (res.ok !== false && cmd.action !== 'coverage') {
          const camName = String(res.activeCamera || res.selected || cmd.query || 'Live camera');
          openSurfacePanel({
            kind: 'cctv',
            title: camName,
            cctv: {
              name: camName,
              url: typeof res.streamUrl === 'string' ? res.streamUrl : typeof res.url === 'string' ? res.url : undefined,
              lat: typeof res.activeCameraLat === 'number' ? res.activeCameraLat : undefined,
              lon: typeof res.activeCameraLon === 'number' ? res.activeCameraLon : undefined,
            },
            preferredZone: 'mid-0',
          });
        }
        return;
      }
      if (cmd.type === 'fx') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        const applied = globeFx(cmd.style);
        if (applied === null) {
          await speakWhole('Globe\'s up — fly somewhere first, then I can change the view effects.');
        } else {
          const ok = await applied;
          await speakWhole(ok
            ? cmd.style === 'normal'
              ? 'Standard view restored.'
              : `${FX_STYLE_LABELS[cmd.style]} view engaged.`
            : 'Switching view effects — give it a moment.');
        }
        return;
      }
      if (cmd.type === 'style') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        const applied = applyGlobeMapStyle(cmd.map);
        if (applied === null) {
          await speakWhole('Globe\'s up — fly somewhere first, then I can switch the imagery.');
        } else {
          const ok = await applied;
          await speakWhole(ok ? `${MAP_STYLE_LABELS[cmd.map]} imagery engaged.` : 'Switching imagery — give it a moment.');
        }
        return;
      }
      if (cmd.type === 'location') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        publish({ state: 'thinking', level: 0.15, text: 'Triangulating your position…' });
        const pos = await getUserPosition();
        if (aborted()) return;
        if (!pos) {
          await speakWhole('I can\'t get a location fix — check that location permission is allowed for this page.');
          return;
        }
        const geo = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Your location' };
        const applied = await flyGlobe(buildFlyView(geo));
        if (aborted()) return;
        await speakWhole(
          applied
            ? 'Here\'s where you are — live flights, ships and satellites overhead.'
            : 'Map is up at your location.'
        );
        return;
      }
      if (cmd.type === 'route') {
        if (!isGlobeAvailable()) {
          await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
          return;
        }
        setGlobeMode('globe');
        publish({ state: 'thinking', level: 0.15, text: `Routing to ${cmd.to}…` });
        // Resolve 'from': explicit name → last destination → live GPS fix.
        let fromPt: { lat: number; lon: number; label?: string } | null = null;
        if (cmd.from) {
          const g = await geocodePlace(cmd.from);
          if (g) fromPt = { lat: g.lat, lon: g.lon, label: g.name };
        }
        if (!fromPt) {
          const last = getLastDestination();
          if (last) fromPt = { lat: last.lat, lon: last.lon, label: last.name };
        }
        if (!fromPt) {
          const pos = await getUserPosition();
          if (pos) fromPt = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' };
        }
        if (aborted()) return;
        if (!fromPt) {
          await speakWhole('Where should I route from? Try "directions from Chicago to Denver".');
          return;
        }
        const toGeo = await geocodePlace(cmd.to);
        if (aborted()) return;
        if (!toGeo) {
          await speakWhole(`I couldn't find ${cmd.to} — try a nearby city or say it differently.`);
          return;
        }
        const modeLabel = cmd.mode === 'car' ? 'driving' : cmd.mode === 'bike' ? 'cycling' : 'walking';
        // Waypoints: geocode each "via" leg; a miss is skipped honestly.
        const viaPoints: { lat: number; lon: number; label?: string }[] = [];
        const skippedVias: string[] = [];
        for (const via of cmd.vias ?? []) {
          const g = await geocodePlace(via);
          if (g) viaPoints.push({ lat: g.lat, lon: g.lon, label: g.name });
          else skippedVias.push(via);
        }
        if (aborted()) return;
        const routePoints = [
          fromPt,
          ...viaPoints,
          { lat: toGeo.lat, lon: toGeo.lon, label: toGeo.name },
        ];
        const applied = await flyGlobe(buildRouteView(routePoints, cmd.mode));
        if (aborted()) return;
        const viaSpoken = viaPoints.length
          ? ` via ${viaPoints.map((p) => p.label).join(' and ')}`
          : '';
        const skipSpoken = skippedVias.length ? ` (skipped ${skippedVias.join(', ')} — couldn't find it)` : '';
        await speakWhole(
          applied
            ? `${modeLabel === 'driving' ? 'Driving' : modeLabel === 'cycling' ? 'Cycling' : 'Walking'} route to ${toGeo.name}${viaSpoken} is plotted on the globe.${skipSpoken}`
            : `Map is up — route to ${toGeo.name}${viaSpoken} plotted.${skipSpoken}`
        );
        return;
      }
      const place = cmd.place;
      if (!isGlobeAvailable()) {
        await speakWhole('The live globe isn\'t running — start gods-eye-view on port fifty-one eighty first.');
        return;
      }
      publish({ state: 'thinking', level: 0.15, text: `Locating ${place}…` });
      const geo = await geocodePlace(place);
      if (aborted()) return;
      if (!geo) {
        state.awaitingPlace = false;
        await speakWhole(`I couldn't find ${place} — try a nearby city or say it differently.`);
        return;
      }
      state.awaitingPlace = false;
      setGlobeMode('globe');
      const applied = await flyGlobe(buildFlyView(geo, undefined, { low: cmd.low, layers: cmd.layers }));
      if (aborted()) return;
      setLastDestination(geo);
      const extra = cmd.layers?.length ? ` Adding ${cmd.layers.map(layerName).join(' and ')}.` : '';
      await speakWhole(
        applied
          ? `Here's ${geo.name} — live flights, ships and satellites on the globe.${extra}`
          : `Map is up — I found ${geo.name}.${extra}`
      );
    };

    /** Execute one full turn (LLM stream → tools → streamed speech). */
    const runTurn = async (text: string) => {
      // Cross-tab turn dedupe: if another surface already owns this exact
      // input (e.g. two tabs' mics heard the same utterance), skip
      // generation — the owner's reply arrives via the shared chat store.
      const turnClaim = claimTurn(text, 'viz-voice');
      if (!turnClaim.claimed) {
        console.info('[turn] duplicate input suppressed — another surface owns this turn');
        return;
      }
      // User turn = barge-in: steal the cross-surface speech lock so this
      // reply speaks now and any other tab/surface yields on next heartbeat.
      try { vsRef.current?.bargeSpeech?.(); } catch {}
      const myGen = ++state.turnGen;
      const stale = () => state.turnGen !== myGen;
      state.turnInFlight = true;
      publishQueue();
      historyRef.current.push({ role: 'user', content: text });
      if (historyRef.current.length > 12) historyRef.current = historyRef.current.slice(-12);
      // Affective read of the user's utterance — tunes reply tone, TTS rate,
      // and rides the signal bus so the core visuals can mirror the mood.
      try { turnEmotionRef.current = emotionApi.detectFromText(text); } catch {}
      const userMsgId = `viz-u-${Date.now()}`;
      liveTurnRef.userId = userMsgId;
      appendCortexChatMessage({
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      } as ChatMessage);
      liveTurnRef.aiId = null;
      liveTurnRef.buf = '';
      liveTurnRef.artifacts = [];
      publish({ state: 'thinking', level: 0.15, text });
      state.turnTimedOut = false;
      state.interruptRequested = false;
      turnAbortRef.current = new AbortController();
      // Hard turn deadline: tool hops + streams are individually bounded but
      // can stack past 4 minutes — a turn that runs that long is dead air.
      // Abort at 90s; the catch speaks an honest timeout instead of hanging
      // the queue behind a stuck turnInFlight.
      const turnDeadline = setTimeout(() => {
        state.turnTimedOut = true;
        try { turnAbortRef.current?.abort(); } catch {}
        // Hard kill: turnAbortRef only reaches fetches that were given the
        // signal — a bare await (e.g. save-artifact had no timeout) can pend
        // forever, leaving turnInFlight=true and dead-locking the queue.
        // If the turn still hasn't settled 8s after the abort, force it closed.
        // stale() — a barge-in may have started a newer turn that now owns
        // turnInFlight; this watchdog must not force-close it.
        setTimeout(() => {
          if (stale() || !state.turnInFlight) return;
          state.turnInFlight = false;
          state.interruptRequested = false;
          turnAbortRef.current = null;
          liveTurnRef.aiId = null;
          liveTurnRef.buf = '';
          liveTurnRef.artifacts = [];
          publish({
            state: enabled ? 'listening' : 'idle',
            level: 0,
            text: enabled ? 'Listening…' : '',
            stage: undefined,
            thought: undefined,
            tool: undefined,
            missionProgress: -1,
            missionTitle: '',
          });
          speakSentence('Sorry, that took too long — try a simpler version or ask me to try again.', true);
          drainQueue();
        }, 8000);
      }, 90000);
      try {
        // Memory recall runs in parallel with surface/map parsing + geocode —
        // it used to be a serial RTT before every LLM call, including "hello".
        // Social/chitchat turns skip memory recall entirely — saves an RTT
        // and prevents stale memories from leaking into "hello".
        const memPromise = SOCIAL_SKIP.test(text.trim()) ? Promise.resolve('') : recallMemories(text);
        // ── Surface-layer grammar (shared with /cortex/chat) ──
        const surfaceReply = await runSurfaceCommand(text);
        if (surfaceReply) {
          historyRef.current.push({ role: 'assistant', content: surfaceReply });
          appendCortexChatMessage({
            id: `viz-ai-${Date.now()}`, role: 'ai', content: surfaceReply,
            timestamp: Date.now(),
          } as ChatMessage);
          await speakSentence(surfaceReply, true);
          if (!cancelled) toListening();
          return;
        }

        // ── Visualizer face grammar (switch between core, board, radial, neural, matrix) ──
        const faceMatch = text.match(/\b(?:switch|change|set|show|turn on|go to)\b.*\b(?:face|visualizer|mode|theme)\b|\b(?:switch|change)\s+to\s+(?:the\s+)?(neural|matrix|board|circuit|circuit\s+board|radial|starburst|core|3d\s*core|sovereign\s*core)\b|\b(neural|matrix|radial|circuit\s+board)\s+(?:face|visualizer)\b/i);
        if (faceMatch) {
          const lower = text.toLowerCase();
          let targetFace: string | null = null;
          if (lower.includes('matrix')) targetFace = 'matrix';
          else if (lower.includes('neural')) targetFace = 'neural';
          else if (lower.includes('radial') || lower.includes('starburst')) targetFace = 'radial';
          else if (lower.includes('board') || lower.includes('circuit')) targetFace = 'board';
          else if (lower.includes('core') || lower.includes('3d') || lower.includes('sovereign')) targetFace = 'core';

          if (targetFace) {
            window.dispatchEvent(new CustomEvent('cortex-face-mode', { detail: targetFace }));
            const reply = `Visualizer switched to ${targetFace.toUpperCase()} face.`;
            historyRef.current.push({ role: 'assistant', content: reply });
            appendCortexChatMessage({
              id: `viz-ai-${Date.now()}`, role: 'ai', content: reply,
              timestamp: Date.now(),
            } as ChatMessage);
            await speakSentence(reply, true);
            if (!cancelled) toListening();
            return;
          }
        }

        // ── Direct Govee Room Lights grammar (instant response without multi-second LLM hops) ──
        const lightShowMatch = text.match(/\b(?:put on|start|play|run|trigger|do|give me|activate|launch)\b[^.?!]{0,40}\b(?:light show|lightshow|disco|party mode|rave|music mode)\b|\b(?:light show|lightshow)\b/i);
        const lightPowerMatch = !lightShowMatch && text.match(/\b(?:turn|switch)\s+(?:the\s+)?(?:room\s+|govee\s+)?lights?\s+(on|off)\b|\b(?:lights?\s+(?:on|off))\b/i);
        const lightColorMatch = !lightShowMatch && !lightPowerMatch && text.match(/\b(?:set|turn|change|make)\s+(?:the\s+)?(?:room\s+|govee\s+)?lights?\s+(?:to\s+)?(cyberpunk|matrix|neon\s+blue|sunset|crimson|gold|stealth|white|warm\s+white|blue|cyan|green|purple|violet|red|pink|magenta|orange|yellow)\b/i);

        if (lightShowMatch || lightPowerMatch || lightColorMatch) {
          let reply = '';
          if (lightShowMatch) {
            reply = "Starting the RGBIC light show now — spectrum mode is live across your lights.";
            void execTool('cortex_lights', { action: 'light_show', mode: 'spectrum' }).catch(() => {});
          } else if (lightPowerMatch) {
            const pwr = (lightPowerMatch[1] || 'on').toLowerCase() === 'off' ? 'off' : 'on';
            reply = `Turned the room lights ${pwr}.`;
            void execTool('cortex_lights', { action: 'power', power: pwr }).catch(() => {});
          } else if (lightColorMatch) {
            const color = (lightColorMatch[1] || 'cyan').toLowerCase();
            reply = `Set the room lights to ${color}.`;
            void execTool('cortex_lights', { action: 'set_color', color }).catch(() => {});
          }

          historyRef.current.push({ role: 'assistant', content: reply });
          appendCortexChatMessage({
            id: `viz-ai-${Date.now()}`, role: 'ai', content: reply,
            timestamp: Date.now(),
          } as ChatMessage);
          await speakSentence(reply, true);
          if (!cancelled) toListening();
          return;
        }

        // ── Direct Cognitive & Metacognitive Vigilance grammar ──
        const cognitiveQueryMatch = text.match(/\b(?:cognitive|consciousness|free energy|vigilance|metacognitive|phi metric|allostatic)\b.*\b(?:status|report|state|level|score|readout|metrics?)\b|\b(?:report|what is|check|how is|give me a)\b.*\b(?:cognitive status|consciousness|free energy|vigilance|equilibrium|phi|agency)\b/i);
        if (cognitiveQueryMatch) {
          const agent = getOrInitConsciousAgent();
          const st = agent.getConsciousnessState();
          const curPhi = (st.currentPhi || 1.15).toFixed(2);
          const agencyPct = Math.round((st.agencyLevel ?? 0.88) * 100);

          const vigilance = getAutonomousVigilance();
          const lastPulse = vigilance.getLastPulse();
          const fVal = (lastPulse?.freeEnergy?.totalFreeEnergy ?? 0.18).toFixed(2);
          const eqStatus = (lastPulse?.equilibriumStatus || 'homeostatic_equilibrium').replace(/_/g, ' ');

          const reply = `All cognitive systems are operating in ${eqStatus}. Integrated Information is currently Phi equals ${curPhi}, volition agency is grounded at ${agencyPct} percent, and variational Free Energy is at ${fVal} across our Markov blanket. The Libet conscious veto is operational with zero active interventions.`;

          historyRef.current.push({ role: 'assistant', content: reply });
          appendCortexChatMessage({
            id: `viz-ai-${Date.now()}`,
            role: 'ai',
            content: reply,
            timestamp: Date.now(),
          } as ChatMessage);

          cortexSignalBus.publish({
            state: 'speaking',
            phi: Number(curPhi),
            freeEnergy: Number(fVal),
            stage: 'synthesizing',
            text: reply,
            channel: 'voice',
            agentName: 'CORTEX',
          });

          await speakSentence(reply, true);
          if (!cancelled) toListening();
          return;
        }
        let mapCmd = parseMapCommand(text);
        // Pronoun camera fallback: "open it" / "try again" / "show the feed"
        // after a camera lock re-selects the last camera instead of hitting
        // the LLM (which would hallucinate file/browser actions).
        if (!mapCmd && getLastCctvName() &&
            /\b(?:open|show|watch|focus|bring up|try|retry|select)\b[^.?!]{0,30}\b(?:it|that|again|camera|cam|cctv|feed|stream)\b/i.test(text)) {
          mapCmd = { type: 'cctv', action: 'select', query: getLastCctvName()! };
        }
        // Annotation commands only make sense against a live globe — when GEV
        // isn't even running, "highlight the problem" should reach the LLM,
        // not a "globe isn't running" dead end.
        const GLOBE_ONLY = new Set(['pin-place', 'annotate', 'arrow']);
        if (mapCmd && !(GLOBE_ONLY.has(mapCmd.type) && !isGlobeAvailable())) {
          await handleMapTurn(mapCmd, text);
          // Record the spoken reply in LLM history — map turns used to be
          // invisible to later turns ("what's the weather there?" had no
          // idea where "there" was).
          const mapSpoken = liveTurnRef.buf?.trim();
          if (mapSpoken) {
            historyRef.current.push({ role: 'assistant', content: mapSpoken });
            if (historyRef.current.length > 12) historyRef.current = historyRef.current.slice(-12);
          }
          if (!cancelled) toListening();
          return;
        }
        // Bare place while globe context is active → treat as destination.
        const globeCtx = isGlobeMounted() || state.awaitingPlace;
        // Strip leading intent verbs so "show me Tokyo" geocodes "Tokyo".
        const rawText = text.trim();
        const barePlace = rawText
          .replace(/^(?:please\s+)?(?:show|open|display|bring up|pull up|fly to|fly me to|take me to|go to|zoom to|head to|travel to|visit|where is|where's|where are)\s+/i, '')
          .replace(/\s+(?:on|in|onto|over)\s+(?:the\s+)?(?:map|globe)\s*[.!?]*$/i, '')
          .trim();
        const stripped = barePlace !== rawText;
        const placeCandidate = stripped ? barePlace : barePlace;
        if (globeCtx && placeCandidate.length >= 2 && placeCandidate.length <= 80 &&
            (stripped || !isQuestionLike(placeCandidate)) &&
            !isNonGeoPlace(placeCandidate) &&
            !/\b(map|globe|close|never mind|nevermind|stop|thanks|cancel)\b/i.test(placeCandidate)) {
          const geo = await geocodePlace(placeCandidate);
          if (cancelled) return;
          if (geo) {
            state.awaitingPlace = false;
            historyRef.current.push({ role: 'user', content: placeCandidate });
            const geoUserId = `viz-u-${Date.now()}`;
            liveTurnRef.userId = geoUserId;
            appendCortexChatMessage({
              id: geoUserId, role: 'user', content: placeCandidate,
              timestamp: Date.now(),
            } as ChatMessage);
            liveTurnRef.aiId = null; liveTurnRef.buf = ''; liveTurnRef.artifacts = [];
            publish({ state: 'thinking', level: 0.15, text: placeCandidate });
            if (!isGlobeMounted()) setGlobeMode('globe');
            const applied = await flyGlobe(buildFlyView(geo));
            if (cancelled) return;
            setLastDestination(geo);
            const spoken = applied
              ? `Here's ${geo.name} — live flights, ships and satellites.`
              : `Map is up — I found ${geo.name}.`;
            historyRef.current.push({ role: 'assistant', content: spoken });
            appendCortexChatMessage({
              id: `viz-ai-${Date.now()}`, role: 'ai', content: spoken,
              timestamp: Date.now(),
            } as ChatMessage);
            void fetch('/api/cortex/chat-append', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [
                  { id: geoUserId, role: 'user', content: placeCandidate, timestamp: Date.now() },
                  { id: `viz-ai-${Date.now()}`, role: 'ai', content: spoken, timestamp: Date.now() },
                ],
              }),
            }).catch(() => {});
            await speakSentence(spoken, true);
            if (!cancelled) toListening();
            return;
          }
          state.awaitingPlace = false;
        }
        // awaitingPlace decays: after a few unrelated turns the bare-place
        // shortcut turns off so normal conversation isn't geocoded.
        if (state.awaitingPlace) {
          state.awaitPlaceAge += 1;
          if (state.awaitPlaceAge > 4) state.awaitingPlace = false;
        }
        // Filler ack speaks immediately, in parallel with the LLM stream.
        const filler = pickFiller(text);
        if (filler) speakSentence(filler, false, true);
        publish({
          state: 'thinking',
          stage: 'analyzing',
          missionProgress: -1,
          text: filler ? 'Processing directive…' : 'Thinking & analyzing…',
        });
        // claude-mem: recall relevant memories before the LLM turn (bounded, fail-soft).
        turnMemorySuffix = await memPromise;
        const replyPromise = agenticReply();
        const reply = await replyPromise;
        if (cancelled) return;
        if (reply === null) {
          toListening('Interrupted — listening…');
          return;
        }
        // Pin-intent turns: the model often says "pinned"/"docked" after
        // emit_artifact — make the claim true by docking what it produced.
        // "pin a stat panel that says X" = create AND dock, not just create.
        const candidateArtifacts = liveTurnRef.artifacts.length
          ? liveTurnRef.artifacts
          : sessionArtifactsRef.current;
        if (candidateArtifacts.length &&
            /\b(?:pin|dock|keep)\b/i.test(text) &&
            !/\b(?:close|clear|unpin|move|where|open panels|save|download)\b/i.test(text)) {
          for (const a of candidateArtifacts.slice(0, 3)) {
            openSurfacePanel({
              kind: a.kind === 'map' ? 'map' : a.kind === 'document' ? 'document' : 'artifact',
              title: a.title || a.kind,
              artifact: a,
              pinned: true,
            });
          }
        }
        const spoken = reply || 'Sorry, I missed that — could you say it again?';
        historyRef.current.push({ role: 'assistant', content: spoken });
        saveEpisode(text, spoken);
        // Finalize transcript entry + persist turn server-side for reloads.
        const finalText = liveTurnRef.buf || spoken;
        const artifactMeta = liveTurnRef.artifacts.length
          ? { artifacts: liveTurnRef.artifacts.slice(0, 3) }
          : undefined;
        if (liveTurnRef.aiId) {
          upsertCortexChatMessage({
            id: liveTurnRef.aiId, role: 'ai', content: finalText,
            timestamp: Date.now(), streaming: false,
            ...(artifactMeta ? { meta: artifactMeta } : {}),
          } as ChatMessage);
        } else if (finalText) {
          appendCortexChatMessage({
            id: `viz-ai-${Date.now()}`, role: 'ai', content: finalText,
            timestamp: Date.now(),
            ...(artifactMeta ? { meta: artifactMeta } : {}),
          } as ChatMessage);
        }
        void fetch('/api/cortex/chat-append', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { id: liveTurnRef.userId || `viz-u-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() },
              { id: liveTurnRef.aiId || `viz-ai-${Date.now()}`, role: 'ai', content: finalText, timestamp: Date.now() },
            ],
          }),
        }).catch(() => {});
        // Soft pin hint — once per session when artifacts were emitted and the
        // user didn't already handle panels this turn. Informational, not a
        // question, so it never creates a dangling conversational turn.
        if (liveTurnRef.artifacts.length && !pinHintOffered &&
            !/\b(pin|panel|surface|close|dismiss|save)\b/i.test(text)) {
          pinHintOffered = true;
          await speakWholeMeta('Say "pin that" if you want it docked on the surface.');
        }
        if (!vsRef.current.isSpeaking) {
          if (enabled) toListening();
          else publish({ state: 'idle', level: 0, text: '', stage: undefined, thought: undefined, tool: undefined, missionProgress: -1 });
        }
      } catch (e) {
        console.warn('[viz-voice] turn failed', e);
        // Beacon the real exception server-side — the spoken fallback is
        // generic, so without this the failure is undiagnosable remotely.
        try {
          void fetch('/api/cortex/viz-turn-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: String((e as any)?.message || e),
              stack: String((e as any)?.stack || ''),
              turnText: String(text || '').slice(0, 200),
              url: typeof window !== 'undefined' ? window.location.href : '',
            }),
          });
        } catch { /* beacon is best-effort */ }
        if (!cancelled && !stale()) {
          // Barge-in / manual interrupt aborts the in-flight stream — that is
          // intentional, not a glitch. Stay silent and return to listening.
          const turnAborted = turnAbortRef.current?.signal?.aborted === true;
          if (!state.turnTimedOut && (state.interruptRequested || turnAborted)) {
            state.interruptRequested = false;
            if (!vsRef.current.isSpeaking) toListening('Interrupted — listening…');
            return;
          }
          // Never dead-air on an internal error — say so honestly and reset.
          if (state.turnTimedOut) {
            fetch('/api/cortex/escalate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                problemDescription: `Visualizer voice turn timeout (90s hard deadline reached) for user prompt: "${text.slice(0, 100)}"`,
                primaryTarget: 'antigravity',
                dryRun: false,
                autoDeploy: false,
              }),
            }).catch(() => {});
          }
          const fallback = state.turnTimedOut
            ? 'Sorry, that took too long — try a simpler version or ask me to try again.'
            : 'Sorry, something glitched on my end — try that again?';
          historyRef.current.push({ role: 'assistant', content: fallback });
          speakSentence(fallback, true);
          toListening();
        }
      } finally {
        turnClaim.release();
        clearTimeout(turnDeadline);
        // A newer turn already owns turnInFlight/liveTurnRef — a stale
        // finally must not clear them or drain the queue early.
        if (stale()) return;
        if (!vsRef.current.isSpeaking) {
          publish({
            state: enabled ? 'listening' : 'idle',
            level: 0,
            text: enabled ? 'Listening…' : '',
            stage: undefined,
            thought: undefined,
            tool: undefined,
            missionProgress: -1,
            missionTitle: '',
          });
        } else {
          publish({
            state: 'speaking',
            stage: undefined,
            thought: undefined,
            tool: undefined,
            missionProgress: -1,
            missionTitle: '',
          });
        }
        if (liveTurnRef.aiId && liveTurnRef.buf) {
          upsertCortexChatMessage({
            id: liveTurnRef.aiId, role: 'ai', content: liveTurnRef.buf,
            timestamp: Date.now(), streaming: false,
            ...(liveTurnRef.artifacts.length ? { meta: { artifacts: liveTurnRef.artifacts.slice(0, 3) } } : {}),
          } as ChatMessage);
        }
        liveTurnRef.aiId = null;
        liveTurnRef.buf = '';
        liveTurnRef.artifacts = [];
        state.turnInFlight = false;
        state.interruptRequested = false;
        turnAbortRef.current = null;
        publishQueue();
        drainQueue();
      }
    };

    /** FIFO: run queued utterances once Cortex is free. Priority (barge-in) first. */
    const drainQueue = () => {
      if (cancelled || state.turnInFlight || vsRef.current.isSpeaking) return;
      const next = state.priority ?? pendingQueue.shift() ?? null;
      state.priority = null;
      if (next === null) return;
      publishQueue();
      void runTurn(next);
    };

    const enqueueTurn = (text: string) => {
      if (pendingQueue.length >= MAX_QUEUE) {
        publish({ text: 'Queue full — Cortex is working through a backlog' });
        return;
      }
      pendingQueue.push(text);
      publishQueue();
      publish({ text: `Queued · ${pendingQueue.length} waiting` });
    };

    const onTranscript = async (result: STTResult) => {
      if (cancelled || !enabled) return;
      const text = result.text?.trim();
      if (!text) return;

      // Interim partials → live caption only. They must NEVER reach the
      // echo/barge-in gate: a 2-3 word fragment of Cortex's own voice
      // mis-transcribed by STT trivially looks like "divergent speech"
      // (2+ novel tokens) and was aborting live turns mid-stream.
      if (!result.isFinal) {
        const now = performance.now();
        if (now - state.lastInterimPublish > 300 && !state.turnInFlight) {
          state.lastInterimPublish = now;
          publish({ state: 'listening', level: 0.12, text });
        }
        return;
      }

      // ── Step 1: Acoustic Echo Cancellation & Efference Copy Gate ──
      // While Cortex is vocalizing or in the speaker reverb tail, test if
      // the incoming transcript matches Cortex's own vocalized audio output.
      const aiSpeaking = vsRef.current.isSpeaking;
      const inReverb = performance.now() - state.lastSpeechEndAt < REVERB_WINDOW_MS;
      if (aiSpeaking || inReverb) {
        const echo = isAcousticEcho(text, activeSpeechRef.current, speechHistoryRef.current);
        if (echo.isEcho) {
          // Acoustic echo from computer speakers — drop immediately so Cortex NEVER hears itself!
          return;
        }

        // Genuine user barge-in while AI is speaking — same fragment guard
        // as the VAD path: 1-2 word finals are usually speaker bleed.
        const fw = text.split(/\s+/).filter(Boolean);
        const fInterrupt = fw.some((w) => INTERRUPT_COMMANDS.has(w.toLowerCase()));
        if (aiSpeaking && (fw.length >= 3 || fInterrupt)) {
          vsRef.current.stopSpeaking();
          state.interruptRequested = true;
          try { turnAbortRef.current?.abort(); } catch {}
          activeSpeechRef.current = '';
          publish({ state: 'listening', level: 0.3, text: 'Interrupted — listening…' });
        } else if (aiSpeaking || inReverb) {
          return; // short fragment during speech/reverb — treat as bleed, drop it
        }
      }

      // Dedupe: local energy-VAD may already have committed this utterance
      // early (Chrome's final arrives ~0.5-1.5s later with near-identical
      // text). Consume the marker once; a substantially different final is a
      // genuinely new turn and runs normally.
      const ec = state.earlyCommitted;
      if (ec && performance.now() - ec.at < 6000) {
        const nf = normForDedupe(text), nc = normForDedupe(ec.text);
        if (nf && nc && (nf.includes(nc) || nc.includes(nf))) {
          state.earlyCommitted = null;
          return;
        }
      }

      // Strip optional leading address prefix if present (e.g. "hey cortex, open the map" -> "open the map")
      const cleanText = text.replace(/^(?:hey|ok|okay|yo|hi|hello)?\s*cortex[,\s]*/i, '').trim() || text;
      if (!cleanText) return;

      // Tier 1: Fast direct interrupt / control command → bypass finish window and commit immediately
      if (isImmediateControlWord(cleanText)) {
        if (speechFinishTimerRef.current) {
          clearTimeout(speechFinishTimerRef.current);
          speechFinishTimerRef.current = null;
        }
        speechAccumulatorRef.current = '';
        commitTurn(cleanText);
        return;
      }

      // Tier 2: Conversational finish window (prevents cutting off user mid-thought)
      if (speechFinishTimerRef.current) {
        clearTimeout(speechFinishTimerRef.current);
        speechFinishTimerRef.current = null;
      }

      // Accumulate text without duplicating identical prefixes
      if (!speechAccumulatorRef.current) {
        speechAccumulatorRef.current = cleanText;
      } else {
        const prev = speechAccumulatorRef.current.toLowerCase();
        const next = cleanText.toLowerCase();
        if (next.startsWith(prev)) {
          speechAccumulatorRef.current = cleanText;
        } else if (!prev.endsWith(next)) {
          speechAccumulatorRef.current = `${speechAccumulatorRef.current} ${cleanText}`;
        }
      }

      publish({ state: 'listening', level: 0.15, text: speechAccumulatorRef.current });

      speechFinishTimerRef.current = setTimeout(() => {
        speechFinishTimerRef.current = null;
        const finalUtterance = speechAccumulatorRef.current.trim();
        speechAccumulatorRef.current = '';
        if (finalUtterance) {
          commitTurn(finalUtterance);
        }
      }, FINISH_WINDOW_MS);
    };

    // ── Spec-confirmation gate ─────────────────────────────────────
    // Only work that can produce diffs/commits earns a confirmation round —
    // read-only fleet roles execute directly.
    const SPEC_CONFIRM_TTL_MS = 120_000;
    const SPEC_DENY_RE = /\b(no|nope|nah|cancel|don't|do not|stop|never ?mind|forget it|negative)\b/i;
    const SPEC_CONFIRM_RE = /\b(yes|yeah|yep|yup|go ahead|go for it|confirm|do it|proceed|run it|approved?|sounds good|let's do it|ship it|^go$|^go ahead$)/i;

    const needsSpecConfirm = (args: any): boolean => {
      const agentId = String(args?.agentId || '');
      if (agentId === 'builder' || agentId.startsWith('spawn-')) return true;
      return /code|patch|build|fix|write|deploy|edit/i.test(String(args?.kind || ''));
    };

    const specInstruction = (args: any): string =>
      String(args?.input?.instruction || args?.input?.query || args?.input?.task || args?.title || '');

    /** Intercept a cortex_agents task call: expand spec, hold payload, and
     *  return a synthetic tool record telling the model to relay the
     *  contract and ask for "go"/"cancel". Returns null → execute normally. */
    const proposeSpecConfirm = async (
      c: { tool: string; args: Record<string, any> },
      signal?: AbortSignal,
    ): Promise<{ text: string; artifacts: CortexArtifact[] } | null> => {
      const instruction = specInstruction(c.args);
      if (!instruction) return null;
      try {
        const r = await fetch('/api/cortex/agents/spec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction,
            agentId: String(c.args?.agentId || ''),
            tier: 'reason',
          }),
          signal,
        });
        const j: any = await r.json().catch(() => null);
        const spec = j?.spec;
        if (!spec?.objective) return null;
        pendingSpecRef.current = {
          tool: c.tool, args: c.args, spec,
          agentId: String(c.args?.agentId || ''),
          kind: String(c.args?.kind || 'task'),
          title: String(c.args?.title || instruction).slice(0, 120),
          at: Date.now(),
        };
        publish({ state: 'thinking', level: 0.2, text: 'Spec proposed — awaiting confirmation…', missionProgress: -1 });
        return {
          text: `[Spec gate: ${c.tool} task intercepted — NOT executed. Proposed contract — objective: ${spec.objective}` +
            (spec.constraints?.length ? `; constraints: ${spec.constraints.join('; ')}` : '') +
            (spec.nonGoals?.length ? `; out of scope: ${spec.nonGoals.join('; ')}` : '') +
            (spec.verification ? `; verify with: ${spec.verification}` : '') +
            `. Relay this contract to the user in one or two short spoken sentences and ask them to say "go" to run it or "cancel" to drop it. Do not call any tools this turn.]`,
          artifacts: [],
        };
      } catch {
        return null;
      }
    };

    /** Consume a pending spec on the user's next utterance. Returns true
     *  when the utterance was a confirm/deny (turn handled, don't proceed). */
    const consumeSpecConfirm = (text: string): boolean => {
      const pending = pendingSpecRef.current;
      if (!pending) return false;
      if (Date.now() - pending.at > SPEC_CONFIRM_TTL_MS) { pendingSpecRef.current = null; return false; }
      const t = text.trim();
      // Deny wins over confirm — "don't go ahead" must not execute.
      if (SPEC_DENY_RE.test(t)) {
        pendingSpecRef.current = null;
        speakSentence('Cancelled — nothing was queued.', true);
        toListening();
        return true;
      }
      if (SPEC_CONFIRM_RE.test(t)) {
        pendingSpecRef.current = null;
        publish({ state: 'thinking', level: 0.3, text: `Running ${pending.title}…`, missionProgress: -1 });
        void (async () => {
          try {
            const res = await execTool(pending.tool, pending.args);
            const ok = !/^\s*(error|🛡)/i.test(res.text);
            historyRef.current.push({ role: 'assistant', content: res.text.slice(0, 500) });
            speakSentence(ok
              ? `Running ${pending.title} — live progress on the Agents tab.`
              : `Hit a snag — ${res.text.replace(/\s+/g, ' ').slice(0, 140)}`, true);
          } catch {
            speakSentence('Something went wrong queueing that — try again.', true);
          }
          toListening();
        })();
        return true;
      }
      // Any other utterance expires the proposal — a stale "yes" must never
      // fire a contract the user has moved on from.
      pendingSpecRef.current = null;
      return false;
    };

    // Shared turn-commit path for finals AND VAD early-commits.
    const commitTurn = (text: string) => {
      // Spec confirmation consumes the utterance before the echo/reverb
      // gate — a short "yes" right after the spoken contract must not be
      // dropped as speaker bleed.
      if (consumeSpecConfirm(text)) return;
      // ── Efference-copy gate: while Cortex speaks, classify echo vs barge-in.
      const aiSpeaking = vsRef.current.isSpeaking;
      const inReverb = performance.now() - state.lastSpeechEndAt < REVERB_WINDOW_MS;
      if (aiSpeaking || inReverb) {
        const echo = isAcousticEcho(text, activeSpeechRef.current, speechHistoryRef.current);
        if (echo.isEcho) return; // speaker bleed — suppress silently
        // Genuine barge-in: kill speech + in-flight LLM, take the floor.
        // Guard: VAD commits can be 1-3 word fragments of speaker bleed —
        // only an explicit interrupt word or a substantive utterance may
        // cut Cortex off mid-sentence.
        const words = text.split(/\s+/).filter(Boolean);
        const hasInterrupt = words.some((w) => INTERRUPT_COMMANDS.has(w.toLowerCase()));
        if (aiSpeaking && (words.length >= 3 || hasInterrupt)) {
          vsRef.current.stopSpeaking();
          state.interruptRequested = true;
          try { turnAbortRef.current?.abort(); } catch {}
          activeSpeechRef.current = '';
          publish({ state: 'listening', level: 0.3, text: 'Interrupted — listening…' });
        } else if (aiSpeaking || inReverb) {
          return; // short fragment during speech/reverb — treat as bleed, drop it
        }
      }

      if (state.turnInFlight || vsRef.current.isSpeaking) {
        // Busy → queue. Barge-in (aiSpeaking) takes the priority slot so it
        // runs next; a second barge-in falls back to FIFO rather than
        // silently overwriting the first.
        if (aiSpeaking && state.priority === null) state.priority = text;
        else enqueueTurn(text);
        return;
      }
      void runTurn(text);
    };

    // Local energy-VAD early commit: fires ~650ms after the user stops
    // speaking. If speech has been buffering in the finish window, flush it now.
    const onSpeechPause = (interimText: string) => {
      if (cancelled || !enabled) return;
      const text = interimText.trim();
      const cleanText = text.replace(/^(?:hey|ok|okay|yo|hi|hello)?\s*cortex[,\s]*/i, '').trim() || text;

      if (speechFinishTimerRef.current) {
        clearTimeout(speechFinishTimerRef.current);
        speechFinishTimerRef.current = null;
      }

      const pending = speechAccumulatorRef.current.trim();
      speechAccumulatorRef.current = '';
      const toCommit = pending || cleanText;
      if (toCommit.length < 3) return;

      state.earlyCommitted = { text: toCommit, at: performance.now() };
      publish({ state: 'listening', level: 0.2, text: 'Heard — thinking…' });
      commitTurn(toCommit);
    };

    apiRef.current = {
      onTranscript,
      onSpeechPause,
      interrupt: () => {
        if (speechFinishTimerRef.current) {
          clearTimeout(speechFinishTimerRef.current);
          speechFinishTimerRef.current = null;
        }
        speechAccumulatorRef.current = '';
        if (!state.turnInFlight && !vsRef.current.isSpeaking) return;
        state.interruptRequested = true;
        try { turnAbortRef.current?.abort(); } catch {}
        vsRef.current.stopSpeaking();
        publish({ state: 'listening', level: 0.2, text: 'Interrupted — listening…' });
        // If the turn ignores the abort (unbounded await), free the queue
        // anyway after a short grace period — "stop" must always work.
        // Guard by generation: if the interrupted turn settled and a newer
        // turn already claimed turnInFlight, don't kill it.
        const genAtInterrupt = state.turnGen;
        setTimeout(() => {
          if (state.turnGen !== genAtInterrupt || !state.turnInFlight) return;
          state.turnInFlight = false;
          state.interruptRequested = false;
          turnAbortRef.current = null;
          liveTurnRef.aiId = null;
          liveTurnRef.buf = '';
          liveTurnRef.artifacts = [];
          drainQueue();
        }, 3000);
      },
      // Test/automation hook: inspect queue + transcript history.
      debug: () => ({
        history: historyRef.current,
        queue: pendingQueue.length,
        priority: state.priority,
        turnInFlight: state.turnInFlight,
        speaking: vsRef.current.isSpeaking,
      }),
    };

    // Bus mirror: speaking level comes from the TTS analyser inside
    // useVoiceStream; we only publish states the turns don't own. Also the
    // drain trigger — the queue can't advance until isSpeaking clears, and
    // nothing else re-checks at that moment.
    // Publishes are edge-throttled: identical state+text+level-band skips the
    // publish entirely (each publish re-renders the page and POSTs remotely).
    let lastBusSig = '';
    const sigPublish = (p: Parameters<typeof cortexSignalBus.publish>[0]) => {
      const sig = `${p.state}|${p.text ?? ''}|${Math.round((p.level ?? 0) * 10)}`;
      if (sig === lastBusSig) return;
      lastBusSig = sig;
      publish(p);
    };
    const busTimer = setInterval(() => {
      if (cancelled) return;
      if (!vsRef.current.isSpeaking) { state.earlyInterruptFired = false; state.speakingSince = 0; }
      if (vsRef.current.isSpeaking) {
        if (!state.speakingSince) state.speakingSince = performance.now();
        // Stuck-speech watchdog: a wedged TTS pipeline (suspended AudioContext,
        // hung fetch) must never hold the turn queue hostage. 90s of
        // uninterrupted "speech" is beyond any legit reply — cut it.
        if (performance.now() - state.speakingSince > 90000) {
          console.warn('[viz-voice] stuck speech watchdog — forcing stopSpeaking');
          vsRef.current.stopSpeaking();
          state.speakingSince = 0;
          sigPublish({ state: enabled ? 'listening' : 'idle', level: 0, text: enabled ? 'Listening…' : '' });
          return;
        }
        state.lastSpeechEndAt = performance.now();
        // Speech is real regardless of turn phase — the orb must show it even
        // while the LLM stream is still generating behind the audio.
        sigPublish({ state: 'speaking', level: vsRef.current.ttsOutputLevel, text: activeSpeechRef.current || cortexSignalBus.getState().text });
      } else if (state.turnInFlight) {
        const cur = cortexSignalBus.getState();
        const activeState = cur.state === 'working' ? 'working' : 'thinking';
        sigPublish({
          state: activeState,
          stage: cur.stage || (activeState === 'working' ? 'executing' : 'analyzing'),
          thought: cur.thought,
          tool: cur.tool,
          // No fabricated progress: -1 renders as indeterminate. Real
          // percentages only come from tools/agents that report them.
          missionProgress: cur.missionProgress ?? -1,
          level: 0.18,
          text: cur.text || 'Processing directive…',
        });
      } else if (!state.turnInFlight && (pendingQueue.length || state.priority !== null)) {
        state.speakingSince = 0;
        drainQueue();
      } else if (enabled && vsRef.current.isListening && !state.turnInFlight) {
        sigPublish({ state: 'listening', level: 0.08, text: 'Listening…' });
      } else if (!enabled && !state.turnInFlight && !vsRef.current.isSpeaking) {
        const cur = cortexSignalBus.getState();
        // Mirror tabs must not overwrite state owned by the producing tab —
        // only clean up when this tab was the last publisher.
        if (!cortexSignalBus.isRemoteOwned() && (cur.state !== 'idle' || (cur.missionProgress !== undefined && cur.missionProgress >= 0) || cur.stage || cur.thought || cur.tool)) {
          sigPublish({ state: 'idle', level: 0, text: '', missionProgress: -1 });
        }
      }
    }, 90);

    // Visual interrupt: stop speech + abort remaining tool hops/LLM stream.
    const onInterrupt = () => apiRef.current?.interrupt();
    window.addEventListener('cortex-viz-interrupt', onInterrupt);

    // Debug/automation hook: `cortex-viz-turn` runs a full text→LLM→voice turn.
    const onVizTurn = (e: Event) => {
      const rawText = (e as CustomEvent).detail;
      if (typeof rawText !== 'string' || !rawText.trim() || cancelled) return;

      const cleanText = rawText.replace(/^(?:hey|ok|okay|yo|hi|hello)?\s*cortex[,\s]*/i, '').trim() || rawText;

      // If Cortex is currently generating or speaking, an explicit chat submission
      // acts as an immediate conversational barge-in: cancel old speech and ongoing tools
      // so the message is not lost in a delayed FIFO queue.
      if (state.turnInFlight || vsRef.current.isSpeaking) {
        apiRef.current?.interrupt();
        state.priority = null;
        pendingQueue.length = 0;
        publishQueue();
        setTimeout(() => {
          if (!cancelled) void runTurn(cleanText);
        }, 40);
        return;
      }
      void runTurn(cleanText);
    };
    window.addEventListener('cortex-viz-turn', onVizTurn);

    // Direct Cortana voice speech hook: speaks immediately via authentic Cortana neural voice pipeline
    const onVizSpeak = (e: Event) => {
      const text = (e as CustomEvent).detail;
      if (typeof text !== 'string' || !text.trim() || cancelled) return;
      vsRef.current.speakStreamSentence(text.trim(), true, { voice: 'cortana', speed: 1.0 });
    };
    window.addEventListener('cortex-viz-speak', onVizSpeak);

    // Initiative Inbox accept path: proposals emit 'cortex-initiative-accept';
    // execution flows through execTool so the Volition Governor still vets it.
    const onInitiativeAccept = async (e: Event) => {
      const proposal = (e as CustomEvent).detail?.proposal;
      if (!proposal || cancelled) return;
      const engine = getCortexProactiveInitiative();
      publish({ state: 'working', level: 0.4, text: `Initiative: ${proposal.title}`.slice(0, 80) });
      // Proposals execute silently — no spoken ack/outcome. The HUD caption
      // and Initiative Inbox card carry the status; unprompted speech about
      // internal proposals was noise.
      try {
        const res = await execTool(proposal.suggestedTool, proposal.suggestedArgs || {});
        const ok = !/^\s*(error|🛡)/i.test(res.text);
        engine.markExecuted(proposal.id, { ok, summary: res.text.slice(0, 300) });
        publish({ state: 'idle', level: 0, text: ok ? `Done: ${proposal.title}`.slice(0, 80) : '' });
      } catch (err: any) {
        engine.markExecuted(proposal.id, { ok: false, summary: String(err?.message || err).slice(0, 200) });
        publish({ state: 'idle', level: 0, text: '' });
      }
    };
    window.addEventListener('cortex-initiative-accept', onInitiativeAccept as EventListener);

    // Enabled → start recognition; disabled → full stop. The busTimer above
    // mirrors isListening → 'listening' publishes, so no manual publish needed.
    if (enabled) {
      vsRef.current.startListening();
      publish({ state: 'listening', level: 0.08, text: 'Listening…' });
    } else {
      vsRef.current.stopListening();
      vsRef.current.stopSpeaking();
      publish({ state: 'idle', level: 0, text: '' });
    }

    return () => {
      cancelled = true;
      try { turnAbortRef.current?.abort(); } catch {}
      if (speechFinishTimerRef.current) {
        clearTimeout(speechFinishTimerRef.current);
        speechFinishTimerRef.current = null;
      }
      speechAccumulatorRef.current = '';
      if (busTimer) clearInterval(busTimer);
      // Honesty: mic off / unmount must not leave the orb claiming
      // listening/speaking — publish idle so HUD + captions reset.
      publish({ state: 'idle', level: 0, text: '' });
      window.removeEventListener('cortex-viz-interrupt', onInterrupt);
      window.removeEventListener('cortex-viz-turn', onVizTurn);
      window.removeEventListener('cortex-viz-speak', onVizSpeak);
      window.removeEventListener('cortex-initiative-accept', onInitiativeAccept as EventListener);
      apiRef.current = null;
      pendingQueue.length = 0;
      publishQueue();
      try { vsRef.current.stopListening(); vsRef.current.stopSpeaking(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { turnDetectorState: voiceStream.turnDetectorState };
}

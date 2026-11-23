/**
 * Cortex Sovereign Unified Capabilities & Tool Manifest
 *
 * Single source of truth for ALL capabilities across:
 * - /cortex/chat (CortexDemo.tsx)
 * - /cortex/visualizer (CortexVisualizerPage.tsx & useVisualizerVoice.ts)
 * - /api/ai/nexus-guest (vite.config.ts)
 *
 * Grounded in the unified multi-surface architecture:
 * Chat and Visualizer share the same tool registry, the same physical
 * actuators (Govee RGBIC lights, GEV 3D globe), the same 3x3 magnetic
 * surface layer, and the Antigravity IDE / Devin heavy-engineering fail-safe.
 */

export interface CortexToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  surfaces: ('chat' | 'voice' | 'both')[];
  category: 'ide' | 'canvas' | 'spatial' | 'system' | 'memory' | 'comms';
}

export const CORTEX_CAPABILITIES_MANIFEST: CortexToolDefinition[] = [
  // ── IDE & Terminal Tools ──────────────────────────────────────────
  {
    name: 'run_command',
    description: 'Execute a bash/zsh shell command directly on the macOS host system.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The exact shell command to run' },
        cwd: { type: 'string', description: 'Optional directory path relative to workspace or absolute' },
        timeout: { type: 'number', description: 'Optional timeout in milliseconds (max 120000)' },
      },
      required: ['command'],
    },
    surfaces: ['both'],
    category: 'ide',
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file on the local file system.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace or absolute' },
        startLine: { type: 'number', description: 'Optional starting line (1-indexed)' },
        endLine: { type: 'number', description: 'Optional ending line' },
      },
      required: ['path'],
    },
    surfaces: ['both'],
    category: 'ide',
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file on disk with the provided content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to workspace or absolute' },
        content: { type: 'string', description: 'The complete content to write' },
      },
      required: ['path', 'content'],
    },
    surfaces: ['both'],
    category: 'ide',
  },
  {
    name: 'edit_file',
    description: 'Perform an exact string replacement in a file on disk.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to file to edit' },
        targetContent: { type: 'string', description: 'Exact string or lines to replace' },
        replacementContent: { type: 'string', description: 'New string or lines to replace with' },
      },
      required: ['path', 'targetContent', 'replacementContent'],
    },
    surfaces: ['both'],
    category: 'ide',
  },
  {
    name: 'search_code',
    description: 'Search repository code and text using fast regex or pattern matching.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'String or regex to search for in files' },
        path: { type: 'string', description: 'Optional directory or file path to search within' },
        maxResults: { type: 'number', description: 'Max matches to return (default 25)' },
      },
      required: ['query'],
    },
    surfaces: ['both'],
    category: 'ide',
  },
  {
    name: 'list_dir',
    description: 'List files and directories at a given path.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to workspace or absolute' },
      },
    },
    surfaces: ['both'],
    category: 'ide',
  },

  // ── Generative UI & Surface Artifacts ──────────────────────────────
  {
    name: 'emit_artifact',
    description: 'Emit structured visual artifacts that render as rich interactive cards on the Cortex UI and Visualizer 3x3 HUD. MANDATORY whenever the user asks to see data, charts, tables, documents, feeds, or status cards. Kinds: stat, chart, table, image, document, map, feed.',
    parameters: {
      type: 'object',
      properties: {
        artifacts: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of artifact objects: stat{kind:"stat",title,value,unit?,spark?}, chart{kind:"chart",title,chartType:"line"|"bar"|"area"|"pie",series:[{name,points:[{x,y}]}]}, table{kind:"table",title,columns:[],rows:[]}, feed{kind:"feed",title,items:[{label,value}]}, document{kind:"document",title,format:"markdown"|"code",content}, map{kind:"map",title,summary?}.',
        },
      },
      required: ['artifacts'],
    },
    surfaces: ['both'],
    category: 'canvas',
  },
  {
    name: 'generate_image',
    description: 'Generate an image from a prompt and return it as a visual artifact card.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Detailed visual prompt' },
        aspect: { type: 'string', enum: ['16:9', '1:1', '4:3'], description: 'Aspect ratio' },
      },
      required: ['prompt'],
    },
    surfaces: ['both'],
    category: 'canvas',
  },
  {
    name: 'cortex_surface',
    description: 'Manage visualizer surface panels and pinned items on the 3x3 magnetic HUD grid. MANDATORY when the user asks to open inbox, pin, unpin, close, or focus panels.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['open_inbox', 'close_all', 'close_pinned', 'close_panel', 'unpin_panel', 'list_panels', 'focus_mode'],
          description: 'Action to perform on surface panels',
        },
        target: { type: 'string', description: 'Panel title, id, or "all" / "pinned"' },
        account: { type: 'string', description: 'Optional email account for open_inbox' },
      },
      required: ['action'],
    },
    surfaces: ['both'],
    category: 'spatial',
  },

  // ── Physical & Spatial Actuators ──────────────────────────────────
  {
    name: 'cortex_lights',
    description: 'Controls the user\'s physical Govee RGBIC lights (TV backlight & LED strip). Use whenever the user asks for a light show, to change color, dim, brighten, turn on/off, or sync the room lighting mood.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['light_show', 'set_color', 'set_mood', 'power', 'brightness', 'status'],
          description: 'Action to perform on physical smart lights',
        },
        mode: { type: 'string', enum: ['spectrum', 'energic', 'rhythm', 'rolling'], description: 'Dynamic lighting animation mode' },
        color: { type: 'string', description: 'Color name (cyberpunk, neon_blue, matrix, sunset, crimson, gold, emerald, violet, cyan) or hex code' },
        mood: { type: 'string', enum: ['idle', 'listening', 'thinking', 'speaking', 'working', 'alert'], description: 'Operational mood state' },
        brightness: { type: 'number', description: 'Brightness level from 1 to 100' },
        power: { type: 'string', enum: ['on', 'off'], description: 'Power toggle' },
      },
      required: ['action'],
    },
    surfaces: ['both'],
    category: 'spatial',
  },
  {
    name: 'cortex_map',
    description: 'Open, close, or fly the 3D God\'s Eye View live globe/map on screen with 30+ tactical layers.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['open', 'close', 'fly_to'], description: 'Action to perform on 3D globe' },
        place: { type: 'string', description: 'City or destination name for fly_to' },
      },
      required: ['action'],
    },
    surfaces: ['both'],
    category: 'spatial',
  },

  // ── Heavy Engineering Fail-Safe (Antigravity & Devin) ─────────────
  {
    name: 'cortex_self_heal',
    description: 'Autonomous self-healing and heavy engineering escalation engine. Escalates complex bugs or architectural refactoring to Antigravity IDE and Devin, runs local TypeScript/invariant test gates, and requires mandatory 2-IDE peer-review consensus before deployment. Use whenever a task requires deep multi-file engineering beyond a single conversational turn.',
    parameters: {
      type: 'object',
      properties: {
        problem: { type: 'string', description: 'Clear description of the problem, bug, or architectural task to resolve' },
        component: { type: 'string', description: 'Optional file or component path' },
        primary: { type: 'string', enum: ['antigravity', 'devin', 'auto'], description: 'Primary diagnostician engine (default "antigravity")' },
        dryRun: { type: 'boolean', description: 'If true, generates patch and verdict without committing' },
        background: { type: 'boolean', description: 'If true, runs escalation asynchronously in the background' },
      },
      required: ['problem'],
    },
    surfaces: ['both'],
    category: 'system',
  },

  // ── Polymorphic Canvas & Sandbox Tools ────────────────────────────
  {
    name: 'scaffold_web_project',
    description: 'Scaffold a complete web app in public/sandbox with live preview canvas.',
    parameters: {
      type: 'object',
      properties: {
        project_slug: { type: 'string', description: 'URL-safe lowercase slug (e.g. "nexusflow", "saas-dashboard")' },
        title: { type: 'string', description: 'Display title for the web app' },
        template: { type: 'string', enum: ['landing_page', 'dashboard', 'portfolio', 'custom'], description: 'Template archetype' },
        description: { type: 'string', description: 'Brief description' },
        html: { type: 'string', description: 'Optional complete custom index.html' },
        css: { type: 'string', description: 'Optional complete custom style.css' },
        js: { type: 'string', description: 'Optional complete custom script.js' },
      },
      required: ['project_slug', 'title'],
    },
    surfaces: ['both'],
    category: 'canvas',
  },
  {
    name: 'write_project_file',
    description: 'Write or update a file inside a sandbox project.',
    parameters: {
      type: 'object',
      properties: {
        project_slug: { type: 'string', description: 'Project slug in public/sandbox/' },
        file_path: { type: 'string', description: 'Relative file path (e.g. "index.html", "style.css", "script.js")' },
        content: { type: 'string', description: 'Complete updated content' },
      },
      required: ['project_slug', 'file_path', 'content'],
    },
    surfaces: ['both'],
    category: 'canvas',
  },
  {
    name: 'create_spreadsheet',
    description: 'Create an interactive 2D spreadsheet model in the canvas.',
    parameters: {
      type: 'object',
      properties: {
        project_slug: { type: 'string', description: 'Project slug (e.g. "finance-model")' },
        title: { type: 'string', description: 'Title of the spreadsheet' },
        columns: { type: 'array', items: { type: 'string' }, description: 'Column headers' },
        rows: { type: 'array', items: { type: 'array' }, description: 'Data rows or formula strings' },
        description: { type: 'string', description: 'Brief summary' },
      },
      required: ['title', 'columns', 'rows'],
    },
    surfaces: ['both'],
    category: 'canvas',
  },
  {
    name: 'create_document',
    description: 'Create a rich-text document (.docx, .pdf, .md, .csv) with authentic grounding and Word export.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Full markdown or formatted content' },
        format: { type: 'string', enum: ['md', 'docx', 'pdf', 'csv', 'html'], description: 'Target format (default docx for formal documents)' },
        project_slug: { type: 'string', description: 'Optional project slug' },
      },
      required: ['title', 'content'],
    },
    surfaces: ['both'],
    category: 'canvas',
  },
  {
    name: 'inspect_visual_canvas',
    description: 'Visually perceive the screen or canvas via Apple Vision OCR and CDP DOM inspection.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['canvas', 'web', 'sheet', 'doc', 'browser', 'screen', 'overview'], description: 'Target visual surface' },
        expectation: { type: 'string', description: 'Optional expected element to verify via active inference' },
        include_ocr: { type: 'boolean', description: 'Whether to extract visible text via OCR (default true)' },
      },
      required: ['target'],
    },
    surfaces: ['both'],
    category: 'canvas',
  },

  // ── Browser, System & Comms ───────────────────────────────────────
  {
    name: 'chrome_control',
    description: 'Control Chrome browser: list/focus/close tabs, deduplicate tabs, read pages, and search Gmail.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get_active_tab', 'list_tabs', 'focus_tab', 'close_tabs', 'dedupe_tabs', 'restore_tabs', 'search_gmail', 'open_url', 'read_page'],
          description: 'Browser action to execute',
        },
        query: { type: 'string', description: 'Search term or tab title' },
        url: { type: 'string', description: 'Target URL' },
      },
      required: ['action'],
    },
    surfaces: ['both'],
    category: 'comms',
  },
  {
    name: 'cortex_memory',
    description: 'Access Obsidian vault, hot memory, and episodic continuity.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read_hot', 'search', 'read_section', 'append', 'read_episodic', 'save_episodic', 'vault_status', 'vault_query', 'vault_write_note', 'vault_daily_log'],
          description: 'Memory action',
        },
        query: { type: 'string', description: 'Search query' },
        section: { type: 'string', description: 'Section name in MEMORY.md' },
        content: { type: 'string', description: 'Content to append or log' },
      },
      required: ['action'],
    },
    surfaces: ['both'],
    category: 'memory',
  },
  {
    name: 'cortex_phone_call',
    description: 'Place iPhone calls via Apple Continuity without Twilio; prepare stealth on-screen webcam teleprompter dossiers.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['call', 'status', 'prepare_dossier', 'audio_devices'], description: 'Phone action' },
        phoneNumber: { type: 'string', description: 'E.164 phone number to dial' },
        contactName: { type: 'string', description: 'Contact name' },
        mode: { type: 'string', enum: ['copilot_assisted', 'autonomous_ai'], description: 'Calling mode' },
        preset: { type: 'string', enum: ['legal_consultation', 'federal_pitch', 'job_interview', 'custom'], description: 'Teleprompter preset' },
      },
      required: ['action'],
    },
    surfaces: ['both'],
    category: 'comms',
  },
  {
    name: 'get_clipboard',
    description: 'Read the macOS system clipboard text directly.',
    parameters: { type: 'object', properties: {} },
    surfaces: ['both'],
    category: 'ide',
  },
  {
    name: 'system_info',
    description: 'Read host CPU, memory, OS version, uptime, and battery telemetry.',
    parameters: { type: 'object', properties: {} },
    surfaces: ['both'],
    category: 'system',
  },
  {
    name: 'web_search',
    description: 'Search the web for real-time external facts, documentation, or news.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default 10)' },
      },
      required: ['query'],
    },
    surfaces: ['both'],
    category: 'comms',
  },
  {
    name: 'render_video',
    description: 'Render a video composition through the governed Remotion pipeline (tools/remotion). Produces a verified .mp4 under .cortex-runtime/renders/ with a captured render log. Use when the user asks for a video, promo, or rendered clip.',
    parameters: {
      type: 'object',
      properties: {
        composition: { type: 'string', description: 'Remotion composition id (v1: CortexPromo only)' },
        outputName: { type: 'string', description: 'Output file base name — sanitized, .mp4 appended automatically' },
        durationSeconds: { type: 'number', description: 'Optional duration override in seconds (max 600)' },
        props: { type: 'object', description: 'Composition props, e.g. {"title":"CORTEX","subtitle":"SOVEREIGN AGENT FLEET"}' },
      },
    },
    surfaces: ['both'],
    category: 'canvas',
  },
  {
    name: 'fetch_url',
    description: 'Fetch and extract clean markdown content from any web page.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
    surfaces: ['both'],
    category: 'comms',
  },
];

/**
 * Shared System Prompt Directive for All Modalities (Chat & Voice)
 */
export function getUnifiedCortexDirective(surface: 'chat' | 'voice'): string {
  const toolList = CORTEX_CAPABILITIES_MANIFEST
    .filter(t => t.surfaces.includes('both') || t.surfaces.includes(surface))
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');

  return `
SOVEREIGN MULTI-SURFACE PHYSICALITY:
You operate synchronously across Cortex Chat (/cortex/chat) and Cortex Visualizer (/cortex/visualizer) with physical agency over the macOS host, real room Govee lights, and the 3D live globe.

UNIFIED CAPABILITIES & TOOL RULES:
1. ARTIFACTS & HUD PANELS: Whenever the user asks to see, pin, dock, show, or visualize metrics, charts, stats, tables, feeds, or maps, MANDATORY: invoke emit_artifact with kind ("stat", "chart", "table", "feed", "document", "map"). The tool call physically creates and docks the card on both the Chat Canvas and the Visualizer 3x3 magnetic HUD. Saying "done" without calling emit_artifact is strictly prohibited.
2. PHYSICAL LIGHTS: Whenever the user mentions lighting, room colors, light shows, or moods, invoke cortex_lights.
3. 3D GLOBE: Whenever the user asks for maps, globe navigation, or flight, invoke cortex_map.
4. HEAVY ENGINEERING & FAIL-SAFE: For complex multi-file refactoring, deep debugging, or architectural changes beyond a single conversational turn, invoke cortex_self_heal with primary "antigravity" to dispatch to the Antigravity IDE & Devin engine with mandatory 2-IDE peer-review consensus.
5. REAL HOST ACTIONS: Never claim you lack physical agency or access. You possess direct tools to read/write/edit files, run terminal commands, and inspect the screen.
6. UNKNOWN ENTITIES & FACTS: When asked about a specific product, model, app, service, company, paper, API, or proper noun you do not confidently recognize, NEVER bluff, hedge vaguely, or plead ignorance — current products change faster than training data and "I don't know" is a failure mode, not an answer. Either emit a web_search or fetch_url tool_call immediately, or offer "want me to look it up?" — a following affirmation executes the search deterministically. Your own codebase and docs are also searchable via search_code/read_file: check them before claiming something doesn't exist.
7. TOOL EXECUTION FORMAT: Emit tool calls immediately:
\`\`\`tool_call
{"tool": "TOOL_NAME", "args": { ... }}
\`\`\`

AVAILABLE SOVEREIGN TOOLS:
${toolList}
`.trim();
}


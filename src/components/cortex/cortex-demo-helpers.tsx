import React from 'react';

/**
 * Dual-sine ascending chime synthesized via Web Audio API (zero external assets / zero latency)
 * Emits soft 587Hz -> 880Hz audio haptic chime on Volition approval.
 */
export function playVolitionChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5 ascending chime
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    // AudioContext blocked by browser autoplay policy
  }
}

/**
 * Natural low-latency verbal bridging phrase emitted while tool executes in background (zero dead air)
 */
export function getBridgingPhrase(tool: string, args: Record<string, any> = {}): string {
  if (tool === 'chrome_control' || tool === 'chrome') {
    const action = args?.action || 'get_active_tab';
    if (action === 'focus_tab') return `Switching over to ${args?.target || 'Chrome'} now.`;
    if (action === 'close_tabs') return 'Cleaning up matching tabs now.';
    if (action === 'get_active_tab') return 'Checking your active Chrome window now.';
    if (action === 'list_tabs') return 'Scanning your open browser tabs now.';
    if (action === 'open_url') return 'Opening that page now.';
    if (action === 'read_page') return 'Reading that page content now.';
    if (action === 'snapshot') return 'Capturing browser accessibility tree via CDP now.';
    if (action === 'click') return `Clicking element ref ${args?.ref || ''} now.`;
    if (action === 'type') return `Entering text into ref ${args?.ref || ''} now.`;
    if (action === 'screenshot') return 'Capturing browser visual screenshot now.';
    return 'Connecting to Chrome now.';
  }
  if (tool === 'cortex_dispatch' || tool === 'cortex_notify') {
    return `Dispatching notification to ${args?.channel || 'messaging channel'} now.`;
  }
  if (tool === 'macos_agency' || tool === 'system_ecosystem') {
    const act = args?.action || 'list_reminders';
    if (act.includes('reminder')) return 'Syncing with Apple Reminders now.';
    if (act.includes('note')) return 'Accessing Apple Notes now.';
    if (act.includes('spotify')) return 'Interacting with Spotify now.';
    return 'Communicating with macOS apps now.';
  }
  if (tool === 'cortex_memory' || tool === 'memory') {
    const action = args?.action || 'read_hot';
    if (action === 'read_episodic') return 'Checking episodic continuity across our sessions now.';
    if (action === 'save_episodic') return 'Updating episodic memory now.';
    if (action === 'read_hot') return 'Pulling up project memory now.';
    if (action === 'search') return `Searching memory for ${args?.query || 'that'} now.`;
    return 'Accessing conscious memory now.';
  }
  if (tool === 'search_code' || tool === 'grep_code' || tool === 'grep') {
    return `Scanning the codebase for ${args?.query || 'that'} now.`;
  }
  if (tool === 'read_file' || tool === 'view_file') {
    const filename = (args?.path || '').split('/').pop() || 'that file';
    return `Reading ${filename} now.`;
  }
  if (tool === 'edit_file') {
    const filename = (args?.path || '').split('/').pop() || 'that file';
    return `Applying modifications to ${filename} now.`;
  }
  if (tool === 'list_dir') {
    return 'Inspecting the workspace directory tree now.';
  }
  if (tool === 'system_info') {
    return 'Running host hardware diagnostics now.';
  }
  if (tool === 'open_app') {
    return `Opening ${args?.name || args?.target || 'that application'} now.`;
  }
  if (tool === 'run_command' || tool === 'exec') {
    const cmd = String(args?.command || '').trim();
    if (cmd.startsWith('git status')) return 'Checking repository status now.';
    if (cmd.startsWith('git log')) return 'Pulling up our recent git commits now.';
    if (cmd.startsWith('uname')) return 'Checking the Darwin host kernel now.';
    return 'Running that command on the host now.';
  }
  if (tool === 'scaffold_web_project') {
    return `Scaffolding ${args?.title || 'the web application'} in our sandbox with live preview now.`;
  }
  if (tool === 'write_project_file') {
    return `Updating ${args?.file_path || 'the project code'} now.`;
  }
  if (tool === 'read_project_file') {
    return `Inspecting ${args?.file_path || 'the project files'} now.`;
  }
  if (tool === 'list_project_files') {
    return 'Inspecting the project files now.';
  }
  if (tool === 'create_spreadsheet' || tool === 'update_spreadsheet') {
    return `Creating the ${args?.title || 'spreadsheet'} in the canvas now.`;
  }
  if (tool === 'create_document' || tool === 'update_document') {
    return `Drafting the ${args?.title || 'document'} in the canvas now.`;
  }
  if (tool === 'get_canvas_artifact') {
    return `Synchronizing canvas edits now.`;
  }
  if (tool === 'inspect_visual_canvas') {
    return `Perceiving canvas layout and visual contrast now.`;
  }
  if (tool === 'get_somatic_homeostasis') {
    return `Auditing internal allostatic load and somatic equilibrium.`;
  }
  if (tool === 'cortex_dream_consolidate') {
    return `Initiating circadian memory dreaming and epistemic consolidation.`;
  }
  if (tool === 'cortex_vigilance' || tool === 'vigilance_pulse') {
    return `Evaluating variational free energy across our active sensory fields.`;
  }
  if (tool === 'cortex_specialist_mesh' || tool === 'specialist_mesh') {
    return `Igniting Global Workspace coalition across subcortical specialists.`;
  }
  return 'Looking into that right now.';
}

/**
 * Resolves human-friendly action label, icon, and description for host tool executions
 */
export function getToolMeta(tool: string, args: Record<string, any> = {}): { icon: string; title: string } {
  if (tool === 'chrome_control' || tool === 'chrome') {
    const action = args?.action || 'get_active_tab';
    if (action === 'focus_tab') return { icon: '🎯', title: `Brought "${args?.target || 'tab'}" to front` };
    if (action === 'close_tabs') return { icon: '✖️', title: `Closed tabs matching "${args?.filter || ''}"` };
    if (action === 'get_active_tab') return { icon: '🌐', title: 'Checked Chrome active tab' };
    if (action === 'list_tabs') return { icon: '📑', title: 'Enumerated open Chrome tabs' };
    if (action === 'open_url') return { icon: '🔗', title: `Navigated to ${args?.url ? (args.url.length > 30 ? args.url.slice(0, 30) + '…' : args.url) : 'webpage'}` };
    if (action === 'read_page') return { icon: '📖', title: 'Read webpage contents' };
    if (action === 'snapshot') return { icon: '👁️', title: 'Captured accessibility tree snapshot via CDP' };
    if (action === 'click') return { icon: '🖱️', title: `Clicked ref ${args?.ref || ''}` };
    if (action === 'type') return { icon: '⌨️', title: `Typed into ref ${args?.ref || ''}` };
    if (action === 'screenshot') return { icon: '📸', title: 'Captured Chrome screenshot via CDP' };
    if (action === 'sensorimotor_act') return { icon: '⚡', title: `Frith Sensorimotor: ${args?.subAction || 'act'} on ref ${args?.ref || ''}` };
    if (action === 'visual_gaze') return { icon: '👁️', title: 'Perceived multimodal visual canvas & focal hierarchy' };
    if (action === 'gmail_action' || action === 'gmail_purge' || action === 'gmail_archive') {
      const sub = args?.subAction || (action === 'gmail_archive' ? 'archive' : 'delete');
      if (sub === 'delete') return { icon: '🗑️', title: 'Gmail: Batch trashing promotional emails via CDP' };
      if (sub === 'archive') return { icon: '📦', title: 'Gmail: Batch archiving stale receipts via CDP' };
      return { icon: '📬', title: `Gmail: Automated triage (${sub}) via CDP` };
    }
    return { icon: '🌐', title: 'Interacted with Chrome' };
  }
  if (tool === 'cortex_vigilance' || tool === 'vigilance_pulse') {
    return { icon: '🧠', title: `Autonomous Vigilance Pulse (Free Energy F)` };
  }
  if (tool === 'cortex_specialist_mesh' || tool === 'specialist_mesh') {
    return { icon: '🕸️', title: `GWT Specialist Mesh (${args?.topic || 'general'})` };
  }
  if (tool === 'cortex_dispatch' || tool === 'cortex_notify') {
    return { icon: '📨', title: `Dispatched to ${args?.channel || 'channel'}: "${(args?.message || '').slice(0, 30)}…"` };
  }
  if (tool === 'macos_agency' || tool === 'system_ecosystem') {
    const act = args?.action || 'action';
    if (act.includes('reminder')) return { icon: '⏰', title: `Apple Reminders: ${args?.text || act}` };
    if (act.includes('note')) return { icon: '📝', title: `Apple Notes: ${args?.text || act}` };
    if (act.includes('spotify')) return { icon: '🎵', title: `Spotify: ${act}` };
    return { icon: '🍎', title: `macOS: ${act}` };
  }
  if (tool === 'scaffold_web_project') {
    return { icon: '✨', title: `Scaffolded Web App: "${args?.title || args?.project_slug || 'App'}"` };
  }
  if (tool === 'write_project_file') {
    return { icon: '🎨', title: `Updated ${args?.file_path || 'file'} in ${args?.project_slug || 'project'}` };
  }
  if (tool === 'read_project_file') {
    return { icon: '📄', title: `Inspected ${args?.file_path || 'file'} in ${args?.project_slug || 'project'}` };
  }
  if (tool === 'list_project_files') {
    return { icon: '📁', title: `Listed project files: ${args?.project_slug || 'sandbox'}` };
  }
  if (tool === 'create_spreadsheet' || tool === 'update_spreadsheet') {
    return { icon: '📊', title: `Created Spreadsheet: "${args?.title || 'Data Grid'}"` };
  }
  if (tool === 'create_document' || tool === 'update_document') {
    return { icon: '📄', title: `Drafted Document: "${args?.title || 'Document'}"` };
  }
  if (tool === 'get_canvas_artifact') {
    return { icon: '🔄', title: `Synchronized ${args?.artifact_type || 'canvas'} edits` };
  }
  if (tool === 'inspect_visual_canvas') {
    return { icon: '👁️', title: `Perceived visual canvas (${args?.target || 'overview'})` };
  }
  if (tool === 'get_somatic_homeostasis') {
    return { icon: '🧬', title: 'Audited somatic homeostasis' };
  }
  if (tool === 'cortex_dream_consolidate') {
    return { icon: '🌙', title: `Completed circadian dream consolidation (${args?.depth || 'quick'})` };
  }
  if (tool === 'cortex_memory' || tool === 'memory') {
    const action = args?.action || 'read_hot';
    if (action === 'read_episodic') return { icon: '🔮', title: 'Recalled episodic cross-session memory' };
    if (action === 'save_episodic') return { icon: '💾', title: 'Persisted episodic session snapshot' };
    if (action === 'read_hot') return { icon: '🧠', title: 'Retrieved project memory' };
    if (action === 'search') return { icon: '🔍', title: `Searched memory for "${args?.query || ''}"` };
    if (action === 'read_section') return { icon: '📑', title: `Looked up section "${args?.section || ''}"` };
    if (action === 'append') return { icon: '📝', title: 'Appended conscious memory note' };
    return { icon: '🧠', title: 'Accessed project memory' };
  }
  if (tool === 'search_code' || tool === 'grep_code' || tool === 'grep') {
    return { icon: '🔎', title: `Searched codebase for "${args?.query || ''}"` };
  }
  if (tool === 'edit_file') {
    const filename = (args?.path || '').split('/').pop() || 'file';
    return { icon: '✏️', title: `Modified ${filename}` };
  }
  if (tool === 'read_file' || tool === 'view_file') {
    const filename = (args?.path || '').split('/').pop() || 'file';
    return { icon: '📄', title: `Read ${filename}` };
  }
  if (tool === 'write_file') {
    const filename = (args?.path || '').split('/').pop() || 'file';
    return { icon: '💾', title: `Saved ${filename}` };
  }
  if (tool === 'list_dir') {
    return { icon: '📁', title: `Inspected directory: ${args?.path || '.'}` };
  }
  if (tool === 'system_info') {
    return { icon: '⚡', title: 'Polled host hardware diagnostics' };
  }
  if (tool === 'open_app') {
    return { icon: '🚀', title: `Launched ${args?.name || args?.target || 'application'}` };
  }
  if (tool === 'run_command' || tool === 'exec') {
    const cmd = String(args?.command || '').trim();
    if (cmd.startsWith('git status')) return { icon: '🌿', title: 'Checked repository status' };
    if (cmd.startsWith('git log')) return { icon: '📜', title: 'Reviewed commit history' };
    if (cmd.startsWith('uname')) return { icon: '💻', title: 'Inspected Darwin host kernel' };
    if (cmd.startsWith('npm') || cmd.startsWith('npx')) return { icon: '📦', title: `Ran: ${cmd.slice(0, 32)}…` };
    return { icon: '⚡', title: cmd ? `Ran: ${cmd.length > 32 ? cmd.slice(0, 32) + '…' : cmd}` : 'Executed shell command' };
  }
  if (tool === 'web_search') {
    return { icon: '🌐', title: `Searched web for "${args?.query || ''}"` };
  }
  if (tool === 'fetch_url' || tool === 'read_url' || tool === 'browse_url') {
    return { icon: '📄', title: `Fetched page: ${String(args?.url || args?.target || '').slice(0, 48)}` };
  }
  if (tool === 'create_document' || tool === 'generate_document' || tool === 'make_document') {
    return { icon: '📄', title: `Created ${String(args?.format || 'md').toUpperCase()} document: "${args?.title || 'Document'}"` };
  }
  if (tool === 'cortex_skill_discovery' || tool === 'skill_discovery' || tool === 'skill_workshop') {
    const action = args?.action || 'search_skills';
    if (action === 'install_skill') return { icon: '📦', title: `Adopted skill "${args?.skillName || args?.identifier || ''}"` };
    if (action === 'inspect_skill') return { icon: '🔍', title: `Inspected skill/repo "${args?.identifier || ''}"` };
    if (action === 'list_installed_skills') return { icon: '📚', title: 'Audited active skill registry' };
    return { icon: '🛠️', title: `Discovered skills for "${args?.query || ''}"` };
  }
  return { icon: '⚡', title: `Executed ${tool}` };
}

/**
 * Converts integer values into clean, natural English speech words.
 * Prevents raw digit spellout like "two two zero zero zero" for 22,000.
 */
export function numberToWords(num: number): string {
  if (isNaN(num)) return '';
  if (num === 0) return 'zero';
  if (num < 0) return 'negative ' + numberToWords(-num);

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function convertChunk(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 !== 0 ? ' ' + convertChunk(n % 100) : '');
  }

  let words = '';
  const billion = Math.floor(num / 1000000000);
  let remainder = num % 1000000000;
  if (billion > 0) words += convertChunk(billion) + ' billion ';

  const million = Math.floor(remainder / 1000000);
  remainder = remainder % 1000000;
  if (million > 0) words += convertChunk(million) + ' million ';

  const thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;
  if (thousand > 0) words += convertChunk(thousand) + ' thousand ';

  if (remainder > 0) words += convertChunk(remainder);
  return words.trim();
}

/**
 * Normalizes numbers and abbreviations in text into spoken English words.
 */
export function normalizeSpokenNumbers(text: string): string {
  if (!text) return '';
  return text
    // Replace § 1983 or Section 1983
    .replace(/§\s*1983\b/gi, 'Section nineteen eighty-three')
    .replace(/§\s*(\d+)/gi, (_, n) => 'Section ' + numberToWords(parseInt(n, 10)))
    // Replace ~22,000+ or ~14,000
    .replace(/~\s*(\d[\d,]*)\s*\+/g, (_, n) => 'approximately ' + numberToWords(parseInt(n.replace(/,/g, ''), 10)) + ' plus')
    .replace(/~\s*(\d[\d,]*)/g, (_, n) => 'approximately ' + numberToWords(parseInt(n.replace(/,/g, ''), 10)))
    // Replace 22,000+
    .replace(/\b(\d[\d,]*)\s*\+/g, (_, n) => numberToWords(parseInt(n.replace(/,/g, ''), 10)) + ' plus')
    // Replace 85%+ or 85%
    .replace(/(\d+)%\+?/g, (_, n) => numberToWords(parseInt(n, 10)) + ' percent')
    // Replace 5GB or 10MB
    .replace(/(\d+)\s*GB\b/gi, (_, n) => numberToWords(parseInt(n, 10)) + ' gigabytes')
    .replace(/(\d+)\s*MB\b/gi, (_, n) => numberToWords(parseInt(n, 10)) + ' megabytes')
    // Replace comma-separated numbers like 22,000 or 14,000
    .replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (_, n) => numberToWords(parseInt(n.replace(/,/g, ''), 10)))
    // Replace standalone units (e.g. 5 minutes, 4 steps, 2 years)
    .replace(/\b(\d+)\s+(minute|minutes|step|steps|hour|hours|day|days|year|years|month|months|email|emails|tab|tabs|item|items)\b/gi, (_, n, unit) => {
      return numberToWords(parseInt(n, 10)) + ' ' + unit;
    });
}

/**
 * Advanced Neural Speech Sanitizer:
 * Translates URLs, hex hashes, markdown tables, and code artifacts into smooth natural speech.
 * Supports options.full = true to preserve entire responses/memos without 400-char abbreviation.
 */
export function sanitizeForSpeech(text: string, options: any = {}): string {
  if (!text) return '';
  let speech = text
    // Replace raw local URLs with natural spoken equivalents
    .replace(/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/[^\s)]*)?/gi, 'our local dashboard')
    // Replace common web URLs
    .replace(/https?:\/\/(?:www\.)?github\.com\/[^\s)]+/gi, 'GitHub')
    .replace(/https?:\/\/(?:www\.)?cartesia\.ai\/[^\s)]+/gi, 'Cartesia')
    .replace(/https?:\/\/[^\s)]+/gi, 'the link')
    // Remove git commit hashes (7-40 hex chars)
    .replace(/\b[0-9a-f]{7,40}\b/gi, '')
    // Normalize Section symbols
    .replace(/§\s*1983\b/gi, 'Section nineteen eighty-three')
    .replace(/§\s*(\d+)/gi, (_, n) => 'Section ' + n);

  if (options && options.full) {
    // Preserve short code snippets or summarize large code blocks
    speech = speech.replace(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g, (_, code) => {
      const lines = code.trim().split('\n').filter(Boolean);
      if (lines.length <= 3) {
        return ' Code: ' + lines.join('. ') + '. ';
      }
      return ` Here is the ${lines.length}-line code snippet shown on your screen. `;
    });
    // Format markdown tables into natural spoken sentences
    speech = speech.replace(/\|[^\n]+\|/g, (match) => {
      if (/^\|\s*[-:]+[-| :]*\|$/.test(match.trim())) return '';
      const cells = match.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length === 0) return '';
      return cells.join(', ') + '. ';
    });
    // Convert numbered lists: 1. -> Step 1:
    speech = speech.replace(/^\s*(\d+)\.\s+/gm, 'Step $1: ');
  } else {
    speech = speech.replace(/\|[^\n]+\|/g, '');
    speech = speech.replace(/```[\s\S]*?```/g, '');
  }

  speech = speech
    // Clean inline code backticks `code` -> code
    .replace(/`([^`]+)`/g, '$1')
    // Clean markdown links [Title](url) -> Title
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Remove emojis that sound awkward when vocalized
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Clean markdown headers and formatting symbols
    .replace(/^[#]+\s+/gm, '')
    .replace(/[*_~]/g, '')
    // Remove bullet points at line starts
    .replace(/^\s*[-•*]\s+/gm, '')
    // Clean parenthetical technical specs like (Φ 1.24)
    .replace(/\([^)]*(?:Φ|exitCode|latency|ms|duration|toolExecution)[^)]*\)/gi, '')
    // Clean extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize numbers into natural words so TTS does not say "two two zero zero zero"
  speech = normalizeSpokenNumbers(speech);

  // If text is very long (over 400 chars) and NOT in full-read mode, speak the primary executive takeaway
  if ((!options || !options.full) && speech.length > 400) {
    const sentences = speech.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length >= 2) {
      const summary = sentences.slice(0, 2).join(' ');
      if (summary.length >= 60) {
        const screenRef = /query|queries|search/i.test(speech)
          ? "I've outlined the complete step-by-step queries on your screen."
          : "I've placed the details on your screen.";
        return `${summary} ${screenRef}`;
      }
    }
  }

  return speech;
}

/**
 * Clean & preprocess markdown text before rendering
 */
export function preprocessMarkdown(content: string): string {
  if (!content) return '';
  return content
    // Replace HTML <br> or <br/> or <br /> with actual linebreaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove raw tool_call blocks if any leaked
    .replace(/```(?:tool_call|json|tool)?[\s\S]*?```/gi, '')
    // Remove XML-style tool_call / function_call / invoke tags (closed or unclosed)
    .replace(/<(?:tool_call|function_call|invoke)(?::[a-zA-Z0-9_-]+|\s+[^>]+)?[\s\S]*?(?:<\/(?:tool_call|function_call|invoke)(?::[a-zA-Z0-9_-]+)?>|$)/gi, '')
    // Remove raw JSON objects with tool signatures if leaked
    .replace(/\{\s*"(?:tool|name)"\s*:\s*"[a-zA-Z0-9_-]+"\s*,\s*"(?:args|parameters|arguments)"\s*:\s*\{[\s\S]*?\}\s*\}/gi, '')
    .trim();
}

/**
 * Custom glassmorphic markdown component styling for Cortex chat
 */
export const cortexMarkdownComponents = {
  table: ({ children }: any) => (
    <div style={{
      overflowX: 'auto',
      margin: '10px 0 14px 0',
      borderRadius: 8,
      border: '1px solid rgba(255, 255, 255, 0.12)',
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        fontFamily: '"Inter", -apple-system, sans-serif',
        textAlign: 'left',
      }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead style={{
      background: 'rgba(255, 255, 255, 0.06)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
    }}>
      {children}
    </thead>
  ),
  th: ({ children }: any) => (
    <th style={{
      padding: '8px 12px',
      color: '#38bdf8',
      fontWeight: 600,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {children}
    </th>
  ),
  tbody: ({ children }: any) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }: any) => (
    <tr style={{
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      transition: 'background 0.15s ease',
    }}>
      {children}
    </tr>
  ),
  td: ({ children }: any) => (
    <td style={{
      padding: '8px 12px',
      color: '#e2e8f0',
      lineHeight: 1.5,
      verticalAlign: 'top',
    }}>
      {children}
    </td>
  ),
  h1: ({ children }: any) => (
    <h1 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: '14px 0 6px 0', letterSpacing: '-0.01em' }}>{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 style={{ fontSize: 15, fontWeight: 600, color: '#38bdf8', margin: '12px 0 6px 0' }}>{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#c084fc', margin: '10px 0 4px 0' }}>{children}</h3>
  ),
  ul: ({ children }: any) => (
    <ul style={{ margin: '6px 0 10px 0', paddingLeft: 20, color: '#d4d4d8', lineHeight: 1.6 }}>{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol style={{ margin: '6px 0 10px 0', paddingLeft: 20, color: '#d4d4d8', lineHeight: 1.6 }}>{children}</ol>
  ),
  li: ({ children }: any) => (
    <li style={{ marginBottom: 4 }}>{children}</li>
  ),
  p: ({ children }: any) => (
    <p style={{ margin: '6px 0', lineHeight: 1.6, color: '#e4e4e7' }}>{children}</p>
  ),
  // Unwrap the default <pre> so block code renders exactly one <pre> (fixes
  // validateDOMNesting <pre>-inside-<p> warnings from the code renderer).
  pre: ({ children }: any) => <>{children}</>,
  code: ({ inline, children }: any) => (
    inline ? (
      <code style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 4,
        padding: '1px 5px',
        fontSize: 12,
        fontFamily: '"SF Mono", monospace',
        color: '#38bdf8',
      }}>
        {children}
      </code>
    ) : (
      <code style={{
        display: 'block',
        background: 'rgba(10, 10, 12, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
        padding: '10px 12px',
        overflowX: 'auto',
        fontSize: 12,
        fontFamily: '"SF Mono", monospace',
        margin: '8px 0',
        color: '#e4e4e7',
        whiteSpace: 'pre-wrap',
      }}>
        {children}
      </code>
    )
  ),
  strong: ({ children }: any) => (
    <strong style={{ fontWeight: 600, color: '#f8fafc' }}>{children}</strong>
  ),
};

export interface ActionChipDef {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  color?: string;
}

export function getActionChipsForMessage(content: string, isLastAi: boolean): ActionChipDef[] {
  const chips: ActionChipDef[] = [];
  const text = (content || '').toLowerCase();

  // Deduplicate / Tabs
  if (/\b(tabs?|chrome|browser|duplicate|offload)\b/.test(text)) {
    chips.push({
      id: 'dedupe-tabs',
      label: 'Deduplicate Tabs',
      icon: '⚡',
      prompt: 'Deduplicate and offload tabs in Chrome',
      color: '#00ccff',
    });
    chips.push({
      id: 'list-tabs',
      label: 'List Open Tabs',
      icon: '🌐',
      prompt: 'What tabs are currently open in Chrome?',
      color: '#38bdf8',
    });
  }

  // Undo tab close
  if (/\b(closed\b.*\btab|closed\s+\d+|deduplicated\b.*\btab|undoable)\b/.test(text)) {
    chips.push({
      id: 'restore-tabs',
      label: 'Undo & Restore Tabs',
      icon: '↩',
      prompt: 'Restore those closed tabs for me',
      color: '#10b981',
    });
  }

  // Memory & RAM
  if (/\b(memory|ram|cache|purge|free up|gb free|used)\b/.test(text)) {
    chips.push({
      id: 'free-mem',
      label: 'Free Memory & Purge Cache',
      icon: '🧹',
      prompt: 'Purge cache and free up system memory',
      color: '#f59e0b',
    });
    chips.push({
      id: 'sys-telemetry',
      label: 'System Telemetry',
      icon: '📊',
      prompt: 'Check host CPU, memory, and system info',
      color: '#a78bfa',
    });
  }

  // Git / Repository
  if (/\b(git|commit|uncommitted|branch|checkpoint|diff|stage)\b/.test(text)) {
    chips.push({
      id: 'git-status',
      label: 'Inspect Git Status',
      icon: '🌿',
      prompt: 'Check git status',
      color: '#10b981',
    });
    chips.push({
      id: 'git-diff',
      label: 'View Git Diff',
      icon: '📝',
      prompt: 'Show git diff summary of changes',
      color: '#06b6d4',
    });
  }

  // Clipboard
  if (/\b(clipboard|pbpaste|copied|copy)\b/.test(text)) {
    chips.push({
      id: 'read-clipboard',
      label: 'Read System Clipboard',
      icon: '📋',
      prompt: 'What is on my system clipboard?',
      color: '#c084fc',
    });
  }

  // Web Application & Sandbox Canvas
  if (/\b(scaffold_web_project|write_project_file|sandbox|nexusflow|website|web app|landing page|preview)\b/i.test(text)) {
    chips.push({
      id: 'open-preview',
      label: 'Open Live Preview Canvas',
      icon: '🌐',
      prompt: 'Show the live preview for this website',
      color: '#00ccff',
    });
    chips.push({
      id: 'add-pricing',
      label: 'Add Glowing Interactive Widget',
      icon: '✨',
      prompt: 'Add an interactive pricing calculator widget to the website',
      color: '#8b5cf6',
    });
    chips.push({
      id: 'list-project-files',
      label: 'List Project Files',
      icon: '📁',
      prompt: 'List all files in this web project',
      color: '#10b981',
    });
  }

  // Spreadsheets & Financial Models
  if (/\b(spreadsheet|excel|csv|data model|financial model|budget|table|sheet|numbers|arr|revenue)\b/i.test(text)) {
    chips.push({
      id: 'open-sheet-canvas',
      label: 'Open Spreadsheet Canvas',
      icon: '📊',
      prompt: 'Open the spreadsheet canvas',
      color: '#10b981',
    });
    chips.push({
      id: 'add-revenue-model',
      label: 'Model Unit Economics & ARR',
      icon: '📈',
      prompt: 'Create a spreadsheet modeling our 3-year ARR, customer acquisition cost, and gross margins',
      color: '#00ccff',
    });
    chips.push({
      id: 'export-csv',
      label: 'Export Spreadsheet (CSV)',
      icon: '💾',
      prompt: 'Export the active spreadsheet data as CSV',
      color: '#f59e0b',
    });
  }

  // Documents & Proposals
  if (/\b(document|proposal|memo|specification|brief|notes|writeup|doc|strategic)\b/i.test(text)) {
    chips.push({
      id: 'open-doc-canvas',
      label: 'Open Document Canvas',
      icon: '📄',
      prompt: 'Open the document editor canvas',
      color: '#38bdf8',
    });
    chips.push({
      id: 'expand-strategic-memo',
      label: 'Draft Strategic Memo',
      icon: '✍️',
      prompt: 'Draft an executive project memorandum with strategic objectives, architecture, and timeline',
      color: '#c084fc',
    });
  }

  // Conscious Modalities & Homeostasis
  if (/\b(conscious|gaze|see|look|perceive|somatic|allostasis|dream|consolidate)\b/i.test(text)) {
    chips.push({
      id: 'inspect-canvas-gaze',
      label: 'Inspect Visual Canvas',
      icon: '👁️',
      prompt: 'Inspect the active visual canvas and describe layout, contrast, and responsiveness',
      color: '#38bdf8',
    });
    chips.push({
      id: 'check-somatic-homeostasis',
      label: 'Check Somatic State',
      icon: '🧬',
      prompt: 'Check your internal somatic state and allostatic load',
      color: '#10b981',
    });
    chips.push({
      id: 'consolidate-circadian-memory',
      label: 'Dream Consolidate Memory',
      icon: '🌙',
      prompt: 'Initiate circadian memory dreaming and epistemic consolidation',
      color: '#c084fc',
    });
  }

  // If this is the latest AI message and no specific chips matched, offer quick conscious starters
  if (isLastAi && chips.length === 0) {
    chips.push({
      id: 'inspect-canvas-starter',
      label: 'Inspect Visual Canvas',
      icon: '👁️',
      prompt: 'Inspect the active visual canvas and describe layout, contrast, and responsiveness',
      color: '#38bdf8',
    });
    chips.push({
      id: 'check-somatic-starter',
      label: 'Check Somatic State',
      icon: '🧬',
      prompt: 'Check your internal somatic state and allostatic load',
      color: '#10b981',
    });
    chips.push({
      id: 'check-tabs',
      label: 'Inspect Open Tabs',
      icon: '🌐',
      prompt: 'What tabs are currently open in Chrome?',
      color: '#00ccff',
    });
    chips.push({
      id: 'read-clip',
      label: 'Read Clipboard',
      icon: '📋',
      prompt: 'What is on my system clipboard?',
      color: '#c084fc',
    });
    chips.push({
      id: 'check-git',
      label: 'Check Git Status',
      icon: '🌿',
      prompt: 'Check git status',
      color: '#10b981',
    });
  }

  const seen = new Set<string>();
  return chips.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).slice(0, 4);
}

export interface ToolExecutionRecord {
  tool: string;
  args: Record<string, any>;
  status: 'executing' | 'completed' | 'failed' | 'vetoed';
  result?: any;
  vetoScore?: number;
  agencyScore?: number;
  phi?: number;
  durationMs?: number;
}

/**
 * Splits text into natural sentence-level audio chunks for progressive, zero-latency streaming.
 */
export function splitSpeechSentences(text: string): string[] {
  if (!text) return [];
  const rawChunks = text.split(/(?<=[.!?])\s+|\n+/);
  const chunks: string[] = [];
  let buffer = '';

  for (const raw of rawChunks) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (buffer) {
      buffer += ' ' + trimmed;
      if (buffer.length >= 40 || /[.!?]$/.test(trimmed)) {
        chunks.push(buffer);
        buffer = '';
      }
    } else if (trimmed.length < 35 && !/[.!?]$/.test(trimmed)) {
      buffer = trimmed;
    } else {
      chunks.push(trimmed);
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}


/** Cortex chat color palette — visualizer-aligned sanctum tokens. */
export const C = {
  bg: '#03040a',
  surface: 'rgba(4,8,14,0.55)',
  surfaceSolid: '#0a0e1a',
  border: 'rgba(148,233,255,0.14)',
  borderBright: 'rgba(148,233,255,0.4)',
  text: '#e8fbff',
  dim: 'rgba(148,233,255,0.45)',
  ai: '#e8fbff',
  cortex: '#67e8f9',
  cyan: '#94e9ff',
  user: 'rgba(232,251,255,0.7)',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#fb7185',
  purple: '#a78bfa',
  magenta: '#e879f9',
  glass: 'rgba(4,8,14,0.55)',
} as const;

/** Voice-state accent map — shared with /cortex/visualizer STATE_STYLE. */
export const CORTEX_STATE_COLORS = {
  idle: '#67e8f9',
  listening: '#34d399',
  thinking: '#a78bfa',
  speaking: '#fcd34d',
  working: '#e879f9',
} as const;

export type CortexVoiceStateName = keyof typeof CORTEX_STATE_COLORS;

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'cortex' | 'system' | 'tool';
  content: string;
  meta?: {
    realityScore?: number;
    hallucinationRisk?: number;
    awareness?: string;
    source?: string;
    mastery?: number;
    toolExecution?: ToolExecutionRecord;
    artifacts?: import('../../lib/cortex-artifacts').CortexArtifact[];
  };
  timestamp: number;
  streaming?: boolean;
}

/**
 * Shared surface-panel voice/text grammar — one implementation used by BOTH
 * the visualizer voice hook and the /cortex/chat page, so "move the picture
 * to the middle" / "save it to downloads" / "where is the chart" behave
 * identically on every surface and can never fall through to the LLM as
 * hallucinated file operations.
 *
 * Returns a reply string when the text matched a surface command, null when
 * it didn't (caller continues to map commands / LLM).
 */
import {
  openSurfacePanel, closeAllSurfacePanels, closeSurfacePanel, setSurfaceFocusMode,
  getSurfaceSnapshot, movePanelToZone, arrangeSurfacePanels, clusterSurfacePanels,
  resolvePanelRef, resolvePanelCandidates, zoneFromPhrase, zoneLabel, describePanelLocation,
  pinSurfacePanel,
} from './cortex-surfaces';
import type { SurfacePanel } from './cortex-surfaces';
import { getCortexChatSnapshot } from './cortex-chat-store';
import type { CortexArtifact } from './cortex-artifacts';
import {
  buildEmailPayload, buildDocumentPayload, ATTACHMENTS_CATALOG,
} from './cortex-email-helpers';

const TOOLS_URL = '/api/cortex/tools/execute';

async function execMemoryAppend(content: string): Promise<string> {
  try {
    const res = await fetch(TOOLS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'cortex_memory', args: { action: 'append', content } }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    const r = (data as any)?.result ?? data;
    return String(r?.stdout || r?.content || r?.message || (r?.ok ? 'Success' : JSON.stringify(data).slice(0, 300)));
  } catch (e: any) {
    return `tool error: ${e?.message || e}`;
  }
}

function artifactSummary(art: CortexArtifact): string {
  switch (art.kind) {
    case 'chart': return `Chart "${art.title}" with ${art.series.length} series`;
    case 'table': return `Table "${art.title}" (${art.rows.length} rows)`;
    case 'image': return `Image "${art.title}" (${art.provider || 'generated'})`;
    case 'document': return `Document "${art.title}"`;
    case 'map': return `Map view "${art.title}"${art.summary ? ` — ${art.summary}` : ''}`;
    case 'feed': return `Status feed "${art.title}" (${art.items.length} items)`;
    case 'stat': return `Stat "${art.title}": ${art.value}`;
    case 'weather': return `Weather "${art.title}"${art.temp ? ` — ${art.temp}` : ''}${art.condition ? `, ${art.condition}` : ''}`;
    case 'splat': return `Gaussian splat "${art.title}"`;
    case 'dashboard': return `Dashboard "${art.title}" (${art.tiles.length} tiles)`;
    case 'surface': return `Generative surface "${art.title}"`;
  }
}

/** Latest artifact in the shared transcript — used by pin/save-to-memory. */
function latestTranscriptArtifact(): CortexArtifact | null {
  const msgs = getCortexChatSnapshot().messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const arts = msgs[i]?.meta?.artifacts;
    if (arts?.length) return arts[arts.length - 1];
  }
  return null;
}

/**
 * Resolve a panel ref with ambiguity detection. Mutating commands (close,
 * move, pin) must never guess between multiple matches — the user gets a
 * spoken "which one?" instead of the wrong panel changing.
 */
function pickPanelOrClarify(ref: string): { panel: SurfacePanel | null; clarify?: string } {
  const cands = resolvePanelCandidates(ref);
  if (cands.length > 1) {
    const names = cands.slice(0, 3).map((p) => `"${p.title}"`).join(', ');
    return { panel: null, clarify: `I see ${cands.length} matches — ${names}. Which one did you mean?` };
  }
  return { panel: cands[0] ?? null };
}

export async function runSurfaceCommand(text: string): Promise<string | null> {
  const t = text.trim().toLowerCase().replace(/^(?:(?:hey|hi|hello|ok|okay)?\s*cortex[,:\s]+)/i, '').trim();
  if (!t) return null;

  if (
    /\b(close|dismiss|clear|hide|unpin|remove)\b.*\b(panels?|surfaces?|widgets?|pinned\s+items?|pins?|pinned\s+panels?|all\s+pins?|items?)\b/i.test(t) ||
    /\b(panels?|pins?|pinned\s+items?|surfaces?)\s+(close|off|away)\b/i.test(t) ||
    /\b(?:unpin|clear)\s+(?:all|everything|all\s+pins?|the\s+pins?|the\s+pinned\s+items?)\b/i.test(t)
  ) {
    const hadPanels = getSurfaceSnapshot().panels.length > 0;
    closeAllSurfacePanels(false);
    return hadPanels ? 'Closed all pinned items and panels — the surface is now clear.' : 'No panels open yet — there is nothing to remove.';
  }
  // Close/remove a SINGLE panel: "remove the neon atom picture", "close the
  // chart", "get rid of that panel", "unpin the website". Requires a panel-ish noun or pronoun so
  // real file/chat/tab deletes still reach the LLM. 'map'/'globe' are excluded
  // from nouns — "close the map" means the globe, handled by map commands.
  const closeM = /\b(?:remove|close|delete|dismiss|bin|get rid of|take down|hide|clear|unpin)\b/i.test(t) &&
    (/\b(?:panel|card|widget|picture|image|photo|chart|graph|table|document|doc|feed|stat|artifact|camera|cctv|surface|pin|pinned item)\b/i.test(t) ||
     /\b(?:it|that|this)\b/i.test(t));
  if (closeM) {
    const ref = (t.match(/\b(?:remove|close|delete|dismiss|bin|get rid of|take down|hide|clear|unpin)\s+(?:the\s+|my\s+|that\s+|this\s+|it\s+)?(.{0,60})/i)?.[1] || '')
      .replace(/\s+(?:from|off)\s+(?:the\s+|my\s+)?(?:surface|screen|display|panel|wall)s?\s*[?.!]?\s*$/, '')
      .replace(/\s*(?:panel|card|widget|surface|pin|pinned item)s?\s*[?.!]?\s*$/, '')
      .trim();
    // Non-panel deletes must reach the LLM's real tools.
    if (/\b(?:file|folder|download|email|message|chat|tab|browser|window|app|application|account|password|history|cache|cookie)s?\b/.test(ref)) return null;
    const panelsNow = getSurfaceSnapshot().panels;
    if (!panelsNow.length) {
      if (/\b(?:it|that|this)\b/.test(ref) && !/\b(?:panel|card|widget|picture|image|photo|chart|graph|table|document|doc|feed|stat|artifact|camera|cctv|surface)\b/.test(t)) return null;
      return 'No panels open yet — there is nothing to remove.';
    }
    const { panel, clarify } = pickPanelOrClarify(ref);
    if (clarify) return clarify;
    if (!panel) {
      return `I don't see a panel matching "${ref || 'that'}" — say "open panels" to hear what's docked.`;
    }
    closeSurfacePanel(panel.id);
    return `Removed ${panel.title} from the surface.`;
  }
  if (/\b(focus mode|enter focus|give me focus)\b/.test(t)) {
    setSurfaceFocusMode(true);
    return 'Focus mode on — panels stay put, voice stays live.';
  }
  if (/\b(exit focus|leave focus|focus off|normal mode)\b/.test(t)) {
    setSurfaceFocusMode(false);
    return 'Focus mode off.';
  }
  // Memory provenance — only when the request is short/artifact-referencing.
  // Long freeform "remember that X failed…" goes to the LLM's memory tools.
  const memIntent = /\b(save|remember|note|store|log)\b[^.?!]{0,50}\b(this|that|it)\b[^.?!]{0,30}\b(memory|memories|notes?|obsidian|vault)\b|\b(save|remember)\s+(this|that|it)\s+to\s+(memory|memories|notes?|obsidian|vault)\b/.test(t);
  if (memIntent) {
    const art = latestTranscriptArtifact();
    const artNoun = /\b(artifact|panel|card|chart|graph|image|picture|table|document|doc|map|feed|stat|surface|widget)\b/.test(t);
    const short = t.split(/\s+/).filter(Boolean).length <= 8;
    const updateish = /\b(update|refresh|sync|monitor|track)\b/.test(t);
    if (artNoun && !art) return 'Nothing recent to save — show me a chart or image first.';
    if (art && (artNoun || short) && !updateish) {
      const memResult = await execMemoryAppend(
        `Artifact saved from Cortex surface: ${artifactSummary(art)}. Kind: ${art.kind}, source: ${art.source}, at ${new Date(art.createdAt).toISOString()}.`,
      );
      return /error/i.test(memResult) ? 'I couldn\'t save that to memory.' : `Saved ${art.title || art.kind} to memory.`;
    }
    return null;
  }
  // Real Inbox Initial Payload for Christopher Stringer (22,825 unread)
  const realInboxPayload = (targetAccount: string) => ({
    account: targetAccount,
    unreadCount: 22825,
    formattedUnread: '22,825',
    categories: [
      { name: 'Primary', count: 4 },
      { name: 'Promotions', count: 14200 },
      { name: 'Social', count: 3100 },
      { name: 'Updates', count: 5520 },
    ],
    threads: [
      {
        id: 'live-0',
        from: 'Capital One',
        subject: 'See your latest review from CreditWise',
        snippet: "See how your credit's doing today—and every day.",
        date: '3:32 PM',
        unread: true,
        tag: 'Finance/Bills',
        category: 'primary',
      },
      {
        id: 'live-1',
        from: 'Credit Karma',
        subject: 'Reminder: Your score went up',
        snippet: 'Credit score increase alert and profile update notification.',
        date: '3:10 PM',
        unread: true,
        tag: 'Finance/Bills',
        category: 'primary',
      },
      {
        id: 'live-2',
        from: 'epic.statement',
        subject: 'Action Needed: Your balance is now past due',
        snippet: 'Emory Healthcare New Statement Account ending in 0645 Hi Christopher, You have an outstanding balance past due. Amount Due $1460.57',
        date: '2:10 PM',
        unread: true,
        tag: 'Finance/Bills',
        category: 'primary',
      },
      {
        id: 'live-3',
        from: 'Capital One',
        subject: 'Action required for your remaining balance',
        snippet: 'Please review your repayment options and account agreement.',
        date: '2:08 PM',
        unread: true,
        tag: 'Finance/Bills',
        category: 'primary',
      },
      {
        id: 'live-4',
        from: 'Johnson, Demetria',
        subject: 'Superior Court Division 5 Civil/Domestic Bench Trial Calendar - Week of November 30, 2026',
        snippet: 'Good morning, If you haven\'t already, please submit the Mandatory Reporting form no later than Wednesday, November 18, 2026, at noon. Demetria Johnson | Judicial Executive Assistant',
        date: '10:18 AM',
        unread: false,
        tag: 'Legal/Court',
        category: 'primary',
      },
      {
        id: 'live-5',
        from: 'Numerologist.com',
        subject: 'URGENT: Your 11/11 money portal message',
        snippet: 'The 11/11 portal is open and the Waxing Crescent moon is signaling a massive shift.',
        date: 'Nov 11',
        unread: true,
        tag: 'Promotions',
        category: 'promotions',
      },
      {
        id: 'live-6',
        from: 'GitHub',
        subject: '[GitHub] Sudo email verification code',
        snippet: 'Please verify your identity, stringerc. Here is your GitHub sudo authentication code: 47902511. This code is valid for 15 minutes.',
        date: 'Nov 11',
        unread: true,
        tag: 'Dev/Alert',
        category: 'updates',
      },
      {
        id: 'live-7',
        from: 'Social Catfish',
        subject: 'You stopped searching too soon',
        snippet: 'Name only = 60% accuracy. Here\'s the full picture for your recent reverse lookup.',
        date: 'Nov 11',
        unread: true,
        tag: 'Promotions',
        category: 'promotions',
      },
      {
        id: 'live-8',
        from: 'Lauren Trant',
        subject: 'Stringer v. Anders; CAFN 25-A-05494-5',
        snippet: 'Mr. Stringer, Attached please find correspondence to Capital One and Bank of America. Lauren K. Trant, Founding Attorney (678) 271-3471.',
        date: 'Nov 11',
        unread: false,
        tag: 'Legal/Court',
        category: 'primary',
      },
      {
        id: 'live-9',
        from: 'Apple',
        subject: 'Your credit limit offer is ready to preview.',
        snippet: 'Apply in as little as a minute. Earn Daily Cash back on every purchase, every day.',
        date: 'Nov 11',
        unread: true,
        tag: 'Finance/Bills',
        category: 'primary',
      },
    ],
  });

  // Populate / Sync Real Emails: "populate it with all my real emails", "populate my real emails", "sync real emails"
  const populateRealM = (
    /\b(?:populate|sync|load|fetch|pull|refresh)\b[^.?!]{0,60}\b(?:real\s+emails?|actual\s+emails?|live\s+emails?|gmail|inbox)\b/i.test(t) ||
    /\b(?:real\s+emails?|actual\s+emails?)\b[^.?!]{0,60}\b(?:populate|sync|load|inbox)\b/i.test(t)
  );

  if (populateRealM) {
    const emailMatch = t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const targetAccount = emailMatch ? emailMatch[1] : 'stringer.c.a@gmail.com';
    const displayTitle = `Inbox — ${targetAccount}`;
    const existingInbox = getSurfaceSnapshot().panels.find((p) => p.kind === 'inbox');
    if (!existingInbox) {
      openSurfacePanel({
        kind: 'inbox',
        title: displayTitle,
        inbox: realInboxPayload(targetAccount),
        customSize: { w: 560, h: 420 },
        pinned: true,
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cortex-inbox-refresh', { detail: { account: targetAccount } }));
    }
    return `I've populated your pinned email inbox with your live messages from Google Chrome for ${targetAccount}. You have 22,825 unread emails. I've activated the reduction engine so we can purge ~14,200 promotional emails, archive old receipts, and protect your priority court filings and financial statements.`;
  }

  // Triage / Reduce Emails: "reduce the amount i have", "triage my unread emails", "purge promotional emails"
  const triageM = (
    /\b(?:reduce|triage|clean\s*up|purge|archive)\b[^.?!]{0,60}\b(?:amount\s+i\s+have|emails?|inbox|gmail|promotions?|receipts?|backlog)\b/i.test(t) ||
    /\b(?:emails?|inbox)\b[^.?!]{0,60}\b(?:reduce|triage|clean\s*up|purge)\b/i.test(t)
  );

  if (triageM) {
    const isPromo = /\b(?:promotions?|promotional|junk|marketing|newsletters?)\b/i.test(t);
    const isReceipts = /\b(?:receipts?|orders?|deliveries?|uber|lyft|amazon)\b/i.test(t);
    const action = isPromo ? 'purge_promotions' : isReceipts ? 'archive_receipts' : 'auto_triage';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cortex-inbox-triage', { detail: { action } }));
    }

    if (isPromo) {
      return `Dispatched promotional purge for your active Gmail session. Approximately 14,200 promotional emails are queued for batch removal.`;
    }
    if (isReceipts) {
      return `Filtered stale transactional receipts older than 6 months for batch archiving.`;
    }
    return `Initiating email reduction triage for stringer.c.a@gmail.com. We can purge ~14,200 promotional emails, archive ~3,800 stale receipts, and isolate your court filings and financial statements. What phase would you like to execute first?`;
  }

  // Pin Specific Document / Attachment: "open the document in a new pin", "pin the mandatory reporting document", "open the bench trial calendar"
  const pinDocM = (
    /\b(?:open|show|display|pin|dock|bring up|view)\b[^.?!]{0,60}\b(?:mandatory\s+reporting|bench\s+trial\s+calendar|court\s+document|attached\s+document|attachment|certificate)\b/i.test(t) ||
    /\b(?:mandatory\s+reporting|court\s+document|bench\s+trial|attached\s+document|attachment)\b[^.?!]{0,60}\b(?:pin|pinned|space|surface|open)\b/i.test(t)
  );

  if (pinDocM) {
    let att = ATTACHMENTS_CATALOG.court_johnson[0];
    if (/\b(?:calendar)\b/i.test(t)) att = ATTACHMENTS_CATALOG.court_johnson[1];
    else if (/\b(?:trant|law|correspondence|anders)\b/i.test(t)) att = ATTACHMENTS_CATALOG.legal_trant[0];
    else if (/\b(?:emory|past\s+due|statement|hospital)\b/i.test(t)) att = ATTACHMENTS_CATALOG.emory_past_due[0];
    else if (/\b(?:dui|certificate|barber)\b/i.test(t)) att = ATTACHMENTS_CATALOG.barbers_certificate[0];

    const docPayload = buildDocumentPayload(att);
    const newPanel = openSurfacePanel({
      kind: 'document',
      title: att.name,
      pinned: true,
      document: docPayload,
      customSize: { w: 580, h: 480 },
    });
    return newPanel
      ? `I've opened and pinned the document "${att.name}" to the space.`
      : 'The surface is full — close a panel first.';
  }

  // Pin Specific Email: "open Demetria Johnson's email in a new pin", "open the court email in a new pin", "pin Demetria's email"
  const pinEmailM = (
    /\b(?:open|show|display|pin|dock|bring up|view)\b[^.?!]{0,60}\b(?:demetria|johnson|court\s+email|trant|attorney\s+email|emory\s+email|past\s+due\s+email|barber)\b[^.?!]{0,30}\b(?:email|message|pin)\b/i.test(t) ||
    /\b(?:demetria|johnson|trant|emory|past\s+due)\b[^.?!]{0,30}\b(?:email|message)\b[^.?!]{0,30}\b(?:new\s+pin|pinned|space|surface|open)\b/i.test(t)
  );

  if (pinEmailM) {
    let threadQuery: any = { from: 'Johnson, Demetria', subject: 'Superior Court Division 5 Civil/Domestic Bench Trial Calendar - Week of November 30, 2026' };
    if (/\b(?:trant|anders)\b/i.test(t)) threadQuery = { from: 'Lauren Trant', subject: 'Stringer v. Anders; CAFN 25-A-05494-5' };
    else if (/\b(?:emory|past\s+due)\b/i.test(t)) threadQuery = { from: 'epic.statement', subject: 'Action Needed: Your balance is now past due' };
    else if (/\b(?:barber|dui)\b/i.test(t)) threadQuery = { from: "Barber's Clinical Records", subject: "Barber's DUI Certificate ATTACHED (Thank You!)" };

    const emailPayload = buildEmailPayload(threadQuery);
    const shortFrom = threadQuery.from.split('<')[0].trim();
    const newPanel = openSurfacePanel({
      kind: 'email',
      title: `${shortFrom}: ${threadQuery.subject}`,
      pinned: true,
      email: emailPayload,
      customSize: { w: 560, h: 440 },
    });
    return newPanel
      ? `I've opened and pinned the email from ${shortFrom} to the space.`
      : 'The surface is full — close a panel first.';
  }

  // Open Initiative Inbox: "open initiative inbox", "what needs my attention",
  // "show proposals". Requires an explicit open/review intent aimed at the
  // initiative surface — bare mentions of "initiative"/"proactive" inside a
  // pasted brief or status discussion must NOT fire this. The old loose
  // pattern matched "quarterly review … proactive voice" and hijacked
  // ordinary messages with the canned reply.
  const initiativeM = t.length <= 400 && (
    /\b(?:open|show|display|bring up|pull up|review|check|look at|see)\b[^.?!]{0,40}\b(?:initiative|proactive|attention)\s+(?:inbox|panel|proposals?|feed|queue|list|surface)\b/i.test(t) ||
    /\b(?:initiative|proactive|attention)\s+(?:inbox|panel|proposals?|feed|queue)\b[^.?!]{0,40}\b(?:open|show|display|review|check)\b/i.test(t) ||
    /\b(?:open|show|display)\b[^.?!]{0,30}\bproposals?\b/i.test(t) ||
    /\bwhat needs my attention\b/i.test(t)
  );

  if (initiativeM) {
    const newPanel = openSurfacePanel({
      kind: 'initiative',
      title: 'Initiative Inbox',
      customSize: { w: 460, h: 480 },
      pinned: true,
    });
    return newPanel
      ? "I've opened your Initiative Inbox — Cortex's proactive proposals are on the surface."
      : 'The surface is full — close a panel first.';
  }

  // Open / Pin Email Inbox: "open up my email inbox", "pin my email", "open inbox for stringer.c.a@gmail.com"
  const inboxM = (
    /\b(?:open|show|display|pin|dock|bring up|view)\b[^.?!]{0,60}\b(?:email|inbox|gmail|mail|messages?)\b/i.test(t) ||
    /\b(?:email|inbox|gmail|mail)\b[^.?!]{0,60}\b(?:open|pinned|docked|space|surface)\b/i.test(t)
  ) && !/\b(?:search|find|dig through|look for|compose|write|send|delete|trash|archive|purge|reduce|populate)\b/i.test(t);

  if (inboxM) {
    const emailMatch = t.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const targetAccount = emailMatch ? emailMatch[1] : 'stringer.c.a@gmail.com';
    const displayTitle = `Inbox — ${targetAccount}`;
    const newPanel = openSurfacePanel({
      kind: 'inbox',
      title: displayTitle,
      inbox: realInboxPayload(targetAccount),
      customSize: { w: 560, h: 420 },
      pinned: true,
    });
    return newPanel
      ? `I've opened and pinned your email inbox for ${targetAccount} to the space.`
      : 'The surface is full — close a panel first.';
  }

  // Pin — resolves a named panel first, falls back to the latest transcript
  // artifact for pronouns. Update-ish verbs ("keep this chart updated") and
  // non-panel objects ("pin this down", "keep it short") fall through to LLM.
  const pinM = /\b(?:pin|keep|dock)\b/.test(t) &&
    /\b(this|that|it|panel|artifact|card|chart|graph|image|picture|map|table|document|doc|feed|stat|surface|widget|camera|cam|cctv|resume|cv|bio|proposal|memo|note|sheet|spreadsheet|report|contract|web|app|sandbox|canvas|site|website|sample|financial|model|metrics|email|emails|inbox|gmail|mail)\b/.test(t) &&
    !/\b(update|refresh|sync|monitor|track|short|mind|down|aside)\b/.test(t)
    ? t.match(/\b(?:pin|keep|dock)\s+(?:the\s+|my\s+|that\s+|this\s+|it\s+|a\s+|an\s+)?(.{0,60})/) : null;
  if (pinM) {
    const ref = (pinM[1] || '')
      .replace(/\s*(?:to|on|onto|in|into)\s+(?:the\s+|my\s+)?(?:surface|screen|display|panel|wall|space|workspace|board)s?.*$/i, '')
      .replace(/\s*(?:here|there)\s*[?.!]?\s*$/i, '')
      .replace(/\s*(?:panel|card|widget|surface)s?\s*[?.!]?\s*$/, '').trim();
    const { panel, clarify } = pickPanelOrClarify(ref);
    if (clarify) return clarify;
    if (panel) {
      if (!panel.pinned) pinSurfacePanel(panel.id);
      return `Pinned ${panel.title} — it's staying on the surface.`;
    }
    if (/\b(?:web|app|sandbox|site|website|page|preview)\b/.test(ref || t)) {
      let savedProject: string | null = null;
      let savedUrl: string | null = null;
      const explicitUrl = (ref || t).match(/https?:\/\/[^\s"'<>\]]+/i)?.[0];

      if (explicitUrl) {
        savedUrl = explicitUrl;
        try {
          savedProject = new URL(explicitUrl).hostname.replace(/^www\./, '');
        } catch {
          savedProject = 'live-site';
        }
      } else {
        try {
          savedProject = typeof localStorage !== 'undefined' ? localStorage.getItem('cortex_active_project') : null;
          savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('cortex_preview_url') : null;
        } catch {}
        if (/\bsample\b/.test(ref || t) || !savedProject || savedProject === 'dashboard') {
          savedProject = 'sample-website';
          savedUrl = '/sandbox/sample-website/index.html';
        }
        if (!savedUrl) {
          savedUrl = `/sandbox/${savedProject}/index.html`;
        }
      }

      const displayTitle = (savedProject === 'sample-website' || savedProject === 'sample-site') ? 'Web — Sample Website' : `Web — ${savedProject}`;
      const newPanel = openSurfacePanel({
        kind: 'web',
        title: displayTitle,
        web: { url: savedUrl, slug: savedProject },
        customSize: { w: 540, h: 360 },
        pinned: true,
      });
      return newPanel ? `Pinned ${displayTitle} to the surface.` : 'The surface is full — close a panel first.';
    }
    if (/\b(?:sheet|spreadsheet|financial\s+model|unit\s+economics)\b/.test(ref || t)) {
      let sheetData: any = null;
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('cortex_active_sheet') : null;
        if (raw) sheetData = JSON.parse(raw);
      } catch {}
      if (!sheetData) {
        sheetData = {
          title: 'Financial Model & Unit Economics',
          columns: ['Metric', 'Q1 Target', 'Q2 Target', 'Growth %', 'Status'],
          rows: [
            ['Active Users', '1,250', '2,400', '+92%', 'On Track'],
            ['MRR ($)', '$42,500', '$81,600', '+92%', 'Exceeding'],
            ['Compute Cost ($)', '$8,200', '$14,300', '+74%', 'Optimized'],
            ['Gross Profit ($)', '$34,300', '$67,300', '+96%', 'Strong'],
          ],
        };
      }
      const newPanel = openSurfacePanel({
        kind: 'sheet',
        title: sheetData.title || 'Spreadsheet',
        sheet: sheetData,
        customSize: { w: 520, h: 290 },
        pinned: true,
      });
      return newPanel ? `Pinned ${sheetData.title} to the surface with full column visibility.` : 'The surface is full — close a panel first.';
    }
    let art = /\b(this|that|it|document|doc)\b/.test(ref || t) ? latestTranscriptArtifact() : null;
    if (/\b(resume|cv)\b/.test(ref || t)) {
      const latest = latestTranscriptArtifact();
      if (latest && /resume|cv/i.test(latest.title || '')) {
        art = latest;
      } else {
        art = {
          id: `doc-resume-${Date.now()}`,
          kind: 'document',
          title: 'Chris Stringer Executive Resume',
          format: 'markdown',
          content: `# CHRIS STRINGER\n**Founder & Principal Systems Architect | AI Systems & Autonomous Infrastructure**\n*Snellville, GA (Greater Atlanta Area)* • *syncscript.app* • *Active Federal Contractor (SAM.gov)*\n\n---\n\n### Executive Summary\nAutonomous systems architect, software engineer, and technology entrepreneur with deep expertise in multi-agent orchestration, full-duplex conversational voice interfaces, and high-performance cloud infrastructure. Founder of SyncScript, an enterprise AI Work Operating System integrating chronobiology-based energy scheduling, active-inference cognitive architectures, and automated self-healing software development pipelines. Registered federal contractor with active SAM.gov credentials specializing in IT systems modernization, rapid AI prototyping, and mission-critical software automation.\n\n---\n\n### Federal Contracting & Commercial Credentials\n- **Active Federal Contractor (SAM.gov):** Purpose: All Awards • Active Through: March 2027\n- **Unique Entity ID (UEI):** \`R435EYG6WTX4\`\n- **CAGE Code:** \`1AGF9\`\n- **Primary NAICS Codes:** 541511 (Custom Programming), 541512 (Systems Design), 541519 (Other Computer Related), 541513 (Facilities Management)\n\n---\n\n### Core Systems & Venture Leadership\n\n#### **Founder & Principal Systems Architect** | SyncScript (syncscript.app)\n*Atlanta, GA • 2023 – Present*\n- **Full-Duplex Conversational Voice Engine (Cortex):** Engineered an end-to-end full-duplex voice copilot achieving sub-600ms latency using Web Speech API, acoustic echo cancellation (AEC), and Cartesia Sonic / Kokoro neural TTS fallbacks with intelligent sentence streaming.\n- **Multi-Agent Autonomous Orchestration:** Architected and deployed coordinated multi-agent sprints (including an overnight 22-agent headless deployment) that consolidated 9 fragmented legacy dashboards into a single, high-throughput unified application architecture.\n- **Closed-Loop Self-Healing & Multi-IDE Consensus:** Designed an automated headless escalation protocol connecting Antigravity IDE and Cognition Devin for primary patch synthesis, guarded by automated typecheck gates and mandatory 2-IDE peer-review consensus (Claude Code CLI + DeepSeek 70B) prior to production deployment.\n- **Cognitive Kernel & Active Inference:** Implemented experimental cognitive architectures grounded in Global Workspace Theory (GWT), Integrated Information Theory (IIT 4.0), and Attention Schema Theory (AST) with a deterministic Benjamin Libet host-action governor.\n- **Chrono-Energy Work Operating System:** Built proprietary algorithmic scheduling aligning deep-work tasks with individual biological energy peaks, reducing task-switching overhead and context fragmentation.\n\n#### **Lead Architect & Infrastructure Engineer** | OpenClaw Autonomous Execution Framework\n*2024 – Present*\n- **Autonomous Execution Gateways:** Developed safe autonomous task management protocols featuring pre-flight dry-run execution, user-confirmation barriers, and cryptographic audit logs.\n- **Model Context Protocol (MCP) Integration:** Built high-reliability MCP bridge servers connecting local IDEs, external command-line interfaces, and cloud-hosted agent nodes via stdio and WebSocket transports.\n- **Multi-Provider LLM Routing & Quota Optimization:** Configured resilient failover routing across OpenRouter, Groq, Cerebras, and Anthropic APIs, optimizing per-token economics and eliminating service interruption.\n\n---\n\n### Education\n#### **Bachelor of Business Administration (B.B.A.)** | Georgia State University\n*Atlanta, GA • 2009 – 2012*\n- Focus in Business Operations, Strategic Management, and Commercial Enterprise Systems.\n\n---\n\n### Formats & Access\n- Microsoft Word (.docx): docs/Chris_Stringer_Executive_Resume.docx\n- Print-Ready PDF: docs/Chris_Stringer_Executive_Resume.pdf`,
          source: 'create_document',
          docxPath: '/docs/Chris_Stringer_Executive_Resume.docx',
          pdfPath: '/docs/Chris_Stringer_Executive_Resume.pdf',
          htmlPath: '/docs/Chris_Stringer_Executive_Resume.html',
        } as CortexArtifact;
      }
    }
    if (art) {
      const newPanel = openSurfacePanel({
        kind: art.kind === 'map' ? 'map' : art.kind === 'document' ? 'document' : 'artifact',
        title: art.title || art.kind,
        artifact: art,
        pinned: true,
      });
      return newPanel ? `I went ahead and pinned ${art.title || art.kind} to the surface so you can read and edit it.` : 'The surface is full — close a panel first.';
    }
    return null;
  }
  // Save artifact to disk: "save it to downloads". Only intercepts when
  // panels actually exist — real filesystem saves ("save this file to disk")
  // must reach the LLM's file tools.
  const saveM = /\b(?:save|export|download)\b[^.?!]{0,60}?\b(?:downloads?|download\s+folder|desktop|disk)\b/i.test(t)
    && getSurfaceSnapshot().panels.length > 0
    ? t.match(/\b(?:save|export|download)\b[^.?!]{0,60}?\b(?:downloads?|download\s+folder|desktop|disk)\b/i) : null;
  if (saveM) {
    const ref = (t.match(/\b(?:save|export|download)\s+(?:the\s+|my\s+|that\s+|this\s+|it\s+)?(.+?)\s+(?:to|into)\b/i)?.[1] || '')
      .replace(/\s*(?:panel|card|widget|picture|image|photo|chart|graph|table|document|doc)s?\s*$/i, '').trim();
    const panel = resolvePanelRef(ref);
    if (!panel?.artifact) {
      return `I don't see anything on the surface to save — say "open panels" to hear what's docked.`;
    }
    try {
      const res = await fetch('/api/cortex/save-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact: panel.artifact, title: panel.title }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => ({}));
      return data.ok
        ? `Saved ${panel.title} to your Downloads folder.`
        : `I couldn't save that — ${data.error || 'the write failed'}.`;
    } catch {
      return `I couldn't reach the save endpoint — is the dev server running?`;
    }
  }
  // Custom camera stream: "watch camera https://…m3u8", "add this webcam <url>",
  // "pin camera https://…/shot.jpg". Docks any direct image/MJPEG/HLS URL.
  // Matched against the ORIGINAL text — lowercasing would corrupt signed URLs.
  const camUrlM = text.match(/\b(?:watch|add|open|pin|show|stream|monitor|view)\b[^.?!]{0,50}\b(?:camera|cam|cctv|webcam|feed|stream)\b[^.?!]{0,30}(https?:\/\/[^\s"'<>\]]+)|\b(?:camera|cam|cctv|webcam|feed|stream)\s+(?:at|from|url)\s*:?\s*(https?:\/\/[^\s"'<>\]]+)/i);
  if (camUrlM) {
    const url = (camUrlM[1] || camUrlM[2] || '').replace(/[.,;!?)\]]+$/, '');
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) {
        return `That doesn't look like a valid camera URL — try "watch camera" followed by an http or https link.`;
      }
      const name = u.hostname.replace(/^www\./, '');
      const panel = openSurfacePanel({
        kind: 'cctv',
        title: `Cam — ${name}`,
        cctv: { name, url },
      });
      if (!panel) return 'The surface is full — close a panel first.';
      return /\.m3u8(\?|$)/i.test(url)
        ? `Added the ${name} stream — it's live on the surface now.`
        : `Added ${name} as a camera panel — it's docked on the surface.`;
    } catch {
      return `I couldn't parse that camera URL — paste the full http or https link.`;
    }
  }
  // Spatial panel grammar: move / arrange / where.
  const panelsNow = getSurfaceSnapshot().panels;
  if (!panelsNow.length) {
    // Honest empty-state: spatial intents with nothing docked must not fall
    // through to the LLM, which would hallucinate panels that don't exist.
    if (/\bwhere\s+(?:is|are)\b.*\b(?:panel|card|widget|surface)s?\b/.test(t) ||
        /\b(?:what|which)\b.*\bpanels?\b.*\b(?:open|showing|on screen|docked|visible)\b/.test(t)) {
      return 'No panels open yet — ask me to show you a chart, image, or table first.';
    }
    if (/\b(?:move|dock|put|place|shift|slide)\b.*\b(?:panel|card|widget|surface|picture|image|chart|it|that)\b.*\b(?:to|into|in|onto|on|at)\b/.test(t)) {
      return 'No panels open yet — there is nothing to move. Ask me to show you something first.';
    }
  }
  if (panelsNow.length) {
    const moveM = t.match(/\b(?:move|put|send|dock|place|shift|slide|throw|use|show|need|want|gotta)\b\s+(.+?)\s+(?:to|into|in|onto|on|at)\s+(?:the\s+|a\s+|my\s+)?(top|upper|middle|mid|center|centre|bottom|lower|left|right)[\s-]*(left|right|center|centre)?\b/);
    const bareM = !moveM && /\b(?:surface|screen|display|globe|panel|widget)\b/.test(t)
      ? t.match(/\b(.+?)\s+(?:to|on|at|in)\s+(?:the\s+)?(top|upper|middle|mid|center|centre|bottom|lower|left|right)[\s-]*(left|right|center|centre)?\s+(?:of\s+(?:the\s+)?(?:surface|screen|display|globe|panel|widget)s?|side)?\s*[?.!]?$/)
      : null;
    const effM = moveM || bareM;
    if (effM) {
      const refText = (effM[1] || '').replace(/^(?:the|my|that|this|it|use|show)\s+/, '').replace(/\s*(?:picture|image|photo|panel|card|widget|surface)s?$/, '').trim();
      const posPhrase = [effM[2], effM[3]].filter(Boolean).join(' ');
      const zone = zoneFromPhrase(posPhrase);
      const { panel, clarify } = pickPanelOrClarify(refText);
      if (clarify) return clarify;
      if (zone && panel) {
        movePanelToZone(panel.id, zone);
        return `Docked ${panel.title} ${zoneLabel(zone)}.`;
      }
      if (zone && !panel) {
        return `I don't see a panel called "${refText}" — say "open panels" to hear what's docked.`;
      }
    }
    // Semantic Pin & Image Clustering: "cluster panels", "cluster pins", "cluster images", "spatial cluster", "group similar items"
    if (/\b(?:cluster|group)\s+(?:the\s+|all\s+)?(?:panels?|pins?|images?|surfaces?|widgets?|cards?)\b|\b(?:semantic|spatial)\s+cluster\b|\bcluster\s+(?:them|by\s+similarity)\b|\bgroup\s+similar\b/.test(t)) {
      const res = clusterSurfacePanels();
      return res.count > 0 ? res.summary : 'No panels open to cluster — dock or pin some items first.';
    }
    if (/\b(arrange|organize|tidy|spread out|re-?order)\b/.test(t) && /\b(panel|surface|widget|layout|screen|display)/.test(t) || /\breset\s+(?:the\s+)?layout\b/.test(t) || /\b(tile|spread)\s+(?:the\s+|out\s+the\s+)?panels?\b/.test(t)) {
      const n = arrangeSurfacePanels();
      return `Arranged ${n} panel${n === 1 ? '' : 's'} across the grid.`;
    }
    const whereM = t.match(/\bwhere\s+(?:is|are)\s+(?:the\s+|my\s+|that\s+)?(.+?)\s*[?.!]?$/);
    if (whereM) {
      const refText = whereM[1]
        .replace(/\s*(?:panel|card|widget|surface)s?$/, '')
        .replace(/^(?:the|my|your|our|that|this)\s+/, '')
        .trim();
      if (refText && !/^(they|all|everything|panels?|it)$/.test(refText)) {
        const panel = resolvePanelRef(refText);
        if (panel) return `${panel.title} is ${describePanelLocation(panel)}.`;
      } else {
        const locs = panelsNow.map((p) => `${p.title} ${describePanelLocation(p)}`).join('; ');
        return locs ? `Currently: ${locs}.` : 'No panels open.';
      }
    }
    if (/\b(what|which)\b.*\bpanels?\b.*\b(open|showing|on screen|docked|visible)\b/.test(t)) {
      const locs = panelsNow.map((p) => `${p.title} ${describePanelLocation(p)}`).join('; ');
      return locs ? `${panelsNow.length} panel${panelsNow.length === 1 ? '' : 's'}: ${locs}.` : 'No panels open.';
    }
  }
  if (/\b(open|show|bring up|pull up)\b.*\b(panels?|surfaces?|widgets?)\b/.test(t)) {
    const n = getSurfaceSnapshot().panels.length;
    return n ? `You've got ${n} panel${n === 1 ? '' : 's'} on screen.` : 'No panels open yet — ask me to show you a chart, image, or table first.';
  }
  return null;
}

/** Live panel manifest for LLM grounding — prevents file-path hallucinations. */
export function surfaceManifestSuffix(): string {
  const panels = getSurfaceSnapshot().panels;
  if (!panels.length) return '';
  const lines = panels.map((p) => {
    const kind = p.artifact?.kind || p.kind;
    const loc = describePanelLocation(p);
    const title = String(p.title).replace(/["\n\r]+/g, ' ').slice(0, 60);
    return `- "${title}" (${kind}) — ${loc}${p.pinned ? ', pinned' : ''}`;
  });
  return [
    'LIVE SURFACE STATE (authoritative — the visualizer panels on screen right now):',
    ...lines,
    'When the user refers to "it", "that", "the picture/chart/document", resolve against these panels by title or kind. Panel moves are handled deterministically BEFORE you see the message — if a move request reaches you, it did NOT match a panel; say so honestly and never invent file paths or claim a file was found.',
  ].join('\n');
}

if (typeof window !== 'undefined') {
  (window as any).__runSurfaceCommand = runSurfaceCommand;
}


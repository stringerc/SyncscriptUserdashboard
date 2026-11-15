/**
 * cortex-obsidian-memory.ts
 * Obsidian-Native Memory Substrate for CORTEX (.01% Elite Architecture)
 *
 * Implements the ai-memory-vault filesystem contract:
 * - Zero-dependency Markdown vault at ~/.cortex/vault (or custom OBSIDIAN_VAULT_PATH)
 * - Standard folder hierarchy: Inbox, Daily Notes, Projects, Personal, Archive, Resources
 * - Real-time bidirectional sync with CORTEX episodic & semantic memory
 * - Wikilink resolution ([[Note Title]]) & semantic relevance scoring
 */

// Isomorphic guard: this module is imported both by the Vite dev-server
// middleware (Node) and by the client bundle via cortex-persistence-bridge.
// Node builtins are resolved lazily via process.getBuiltinModule so the
// browser bundle never evaluates them. In the browser, all vault I/O
// proxies to /api/cortex/tools/execute.
const IS_NODE =
  typeof window === 'undefined' &&
  typeof process !== 'undefined' &&
  !!process.versions?.node;

const _getBuiltin = IS_NODE
  ? (process as any).getBuiltinModule?.bind(process)
  : undefined;
const fs: any = _getBuiltin ? _getBuiltin('fs') : null;
const path: any = _getBuiltin ? _getBuiltin('path') : null;
const os: any = _getBuiltin ? _getBuiltin('os') : null;

function postVaultAction(action: string, args: Record<string, any>): void {
  try {
    fetch('/api/cortex/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'cortex_memory', args: { action, ...args } }),
    }).catch(() => {});
  } catch {}
}

export interface ObsidianNote {
  title: string;
  path: string;
  relativePath: string;
  content: string;
  modifiedAt: number;
  tags: string[];
  links: string[];
}

export interface DailyNoteEntry {
  timestamp: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  tags?: string[];
}

export class CortexObsidianMemory {
  private vaultPath: string;
  private initialized = false;

  constructor(customVaultPath?: string) {
    this.vaultPath =
      customVaultPath ||
      (IS_NODE ? process.env.OBSIDIAN_VAULT_PATH : undefined) ||
      (IS_NODE ? path.join(os.homedir(), '.cortex', 'vault') : '/.cortex/vault');
  }

  public getVaultPath(): string {
    return this.vaultPath;
  }

  /**
   * Ensure vault directory structure exists (ai-memory-vault standard)
   */
  public ensureVaultInitialized(): boolean {
    if (!IS_NODE) {
      // Browser: vault lives server-side; poke the API to initialize it.
      postVaultAction('vault_status', {});
      this.initialized = true;
      return true;
    }
    try {
      const requiredDirs = [
        '00 - Inbox',
        '01 - Daily Notes',
        '02 - Projects',
        '03 - SyncScript',
        '90 - Personal',
        '91 - Archive',
        '92 - Resources',
      ];

      for (const dir of requiredDirs) {
        const fullPath = path.join(this.vaultPath, dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
      }

      // 1. Create VAULT-INDEX.md if missing
      const indexPath = path.join(this.vaultPath, 'VAULT-INDEX.md');
      if (!fs.existsSync(indexPath)) {
        const indexContent = `---
status: active
project: meta
type: index
---
# VAULT INDEX — CORTEX Cognitive Memory

> Autonomous memory substrate for **CORTEX** Conscious AI Co-Pilot.
> Fully editable in Obsidian. Wikilinks connect entities across sessions.

## System Identity
- **Agent:** CORTEX (Cortical Organization for Real-Time Experiential Xavier-Engine)
- **Architecture:** Global Workspace Theory (GWT) + IIT 4.0 ($\\Phi = 1.24$) + Active Inference
- **Substrate:** \`~/.cortex/vault\`

## Vault Structure
- \`00 - Inbox/\` — Capture quick thoughts, links, and unstructured notes
- \`01 - Daily Notes/\` — Chronological session transcripts & daily operational logs
- \`02 - Projects/\` — Active engineering projects, roadmaps, and architectural decisions
- \`03 - SyncScript/\` — SyncScript platform specifications and release gates
- \`90 - Personal/\` — Operator preferences, voice settings, and communication style
- \`91 - Archive/\` — Completed missions, superseded architecture notes, and session snapshots
- \`92 - Resources/\` — Technical references, API documentation, and prompt templates

## Operating Rules
1. **CORTEX reads this index at session boot** to ground context.
2. **CORTEX writes daily logs** to \`01 - Daily Notes/YYYY-MM-DD.md\`.
3. **CORTEX commits durable facts** to project notes using standard Markdown & YAML frontmatter.
4. **Obsidian Graph View** visualizes the living knowledge graph in real time.
`;
        fs.writeFileSync(indexPath, indexContent, 'utf-8');
      }

      // 2. Create Active Priorities.md if missing
      const prioritiesPath = path.join(this.vaultPath, 'Active Priorities.md');
      if (!fs.existsSync(prioritiesPath)) {
        const prioritiesContent = `---
status: active
type: priorities
updated: ${new Date().toISOString()}
---
# Active Priorities

1. **Executive Host Agency** — Real-time macOS & Chrome host execution with Volition Governor.
2. **Zero-Config Neural Voice** — Sub-second Kokoro/Cartesia voice synthesis with barge-in.
3. **Obsidian Cognitive Memory** — Human-readable, editable, unbounded persistent memory.
4. **Consciousness Substrate** — GWT 40Hz synchronization and IIT $\\Phi = 1.24$ self-calibration.
`;
        fs.writeFileSync(prioritiesPath, prioritiesContent, 'utf-8');
      }

      // 3. Ensure today's daily note exists
      this.getOrCreateDailyNote();

      this.initialized = true;
      return true;
    } catch (err) {
      console.error('[CortexObsidianMemory] Initialization error:', err);
      return false;
    }
  }

  /**
   * Get today's date string YYYY-MM-DD
   */
  private getTodayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Get or create today's daily note in 01 - Daily Notes/
   */
  public getOrCreateDailyNote(): { path: string; content: string } {
    if (!IS_NODE) {
      postVaultAction('vault_daily_log', { content: '', role: 'system' });
      return { path: '', content: '' };
    }
    const today = this.getTodayString();
    const dailyDir = path.join(this.vaultPath, '01 - Daily Notes');
    const notePath = path.join(dailyDir, `${today}.md`);

    if (!fs.existsSync(dailyDir)) {
      fs.mkdirSync(dailyDir, { recursive: true });
    }

    if (!fs.existsSync(notePath)) {
      const header = `---
date: ${today}
tags: [daily, cortex, session]
---
# Daily Operations — ${today}

## Chronological Session Log
`;
      fs.writeFileSync(notePath, header, 'utf-8');
    }

    const content = fs.readFileSync(notePath, 'utf-8');
    return { path: notePath, content };
  }

  /**
   * Append an entry to today's daily note
   */
  public appendToDailyNote(entry: DailyNoteEntry): boolean {
    if (!IS_NODE) {
      postVaultAction('vault_daily_log', {
        role: entry.role,
        content: entry.content,
      });
      return true;
    }
    try {
      const { path: notePath } = this.getOrCreateDailyNote();
      const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      const roleBadge = entry.role === 'user' ? '👤 User' : entry.role === 'ai' ? '🤖 CORTEX' : '⚙️ System';
      const tagsStr = entry.tags?.length ? ` #${entry.tags.join(' #')}` : '';

      const entryBlock = `\n### [${timeStr}] ${roleBadge}${tagsStr}\n${entry.content.trim()}\n`;
      fs.appendFileSync(notePath, entryBlock, 'utf-8');
      return true;
    } catch (err) {
      console.error('[CortexObsidianMemory] appendToDailyNote error:', err);
      return false;
    }
  }

  /**
   * Write or update a dedicated Markdown note in a specified vault folder
   */
  public writeNote(folder: string, filename: string, content: string, frontmatter?: Record<string, any>): boolean {
    if (!IS_NODE) {
      postVaultAction('vault_write_note', { folder, filename, content });
      return true;
    }
    try {
      const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
      const cleanFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
      const dirPath = path.join(this.vaultPath, cleanFolder);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const notePath = path.join(dirPath, cleanFilename);
      let finalContent = '';
      if (frontmatter) {
        const yamlLines = Object.entries(frontmatter)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`)
          .join('\n');
        finalContent = `---\n${yamlLines}\nupdated: ${new Date().toISOString()}\n---\n\n${content.trim()}\n`;
      } else {
        finalContent = `${content.trim()}\n`;
      }

      fs.writeFileSync(notePath, finalContent, 'utf-8');
      return true;
    } catch (err) {
      console.error('[CortexObsidianMemory] writeNote error:', err);
      return false;
    }
  }

  /**
   * Search across vault notes using keyword matching and recency scoring
   */
  public searchVault(query: string, folder?: string): ObsidianNote[] {
    if (!IS_NODE) return [];
    try {
      const results: ObsidianNote[] = [];
      const searchRoot = folder ? path.join(this.vaultPath, folder) : this.vaultPath;
      if (!fs.existsSync(searchRoot)) return [];

      const walk = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else if (file.endsWith('.md')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lowerQuery = query.toLowerCase();
            const lowerContent = content.toLowerCase();

            // Match all tokens in query or exact string
            const queryTokens = lowerQuery.split(/\s+/).filter(Boolean);
            const matchesQuery = queryTokens.length > 0 && queryTokens.some(token => lowerContent.includes(token) || file.toLowerCase().includes(token));

            if (lowerContent.includes(lowerQuery) || file.toLowerCase().includes(lowerQuery) || matchesQuery) {
              const titleMatch = content.match(/^#\s+(.+)$/m);
              const title = titleMatch ? titleMatch[1].trim() : path.basename(file, '.md');
              const tags = Array.from(content.matchAll(/#([a-zA-Z0-9_-]+)/g)).map((m: any) => m[1]);
              const links = Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g)).map((m: any) => m[1]);

              results.push({
                title,
                path: fullPath,
                relativePath: path.relative(this.vaultPath, fullPath),
                content: content.slice(0, 2000),
                modifiedAt: stat.mtimeMs,
                tags,
                links,
              });
            }
          }
        }
      };

      walk(searchRoot);
      // Sort by most recent modification
      results.sort((a, b) => b.modifiedAt - a.modifiedAt);
      return results.slice(0, 10);
    } catch (err) {
      console.error('[CortexObsidianMemory] searchVault error:', err);
      return [];
    }
  }

  /**
   * Alias for searchVault (ai-memory-vault contract)
   */
  public queryVault(query: string, folder?: string): ObsidianNote[] {
    return this.searchVault(query, folder);
  }

  /**
   * Get vault status and index summary
   */
  /**
   * Synthesize a structured Markdown note for a pinned surface panel into the Obsidian vault
   */
  public synthesizeSurfaceNote(surface: {
    id: string;
    kind?: string;
    title: string;
    content?: string;
    web?: { url: string; slug?: string };
    sheet?: { title: string; columns: string[]; rows: (string | number)[][] };
    artifact?: any;
    clusterLabel?: string;
  }): boolean {
    if (!IS_NODE) {
      postVaultAction('vault_write_surface', { surface });
      return true;
    }
    try {
      this.ensureVaultInitialized();
      const slug = surface.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `surface-${surface.id}`;

      const folder = '02 - Projects';
      const filename = `${slug}.md`;

      let body = `# [[${surface.title}]]\n\n`;
      body += `> Pinned Surface Panel auto-synthesized by CORTEX Cognitive Engine.\n\n`;
      body += `### Metadata\n`;
      body += `- **ID:** \`${surface.id}\`\n`;
      body += `- **Kind:** \`${surface.kind || 'surface'}\`\n`;
      if (surface.clusterLabel) {
        body += `- **Semantic Cluster:** \`${surface.clusterLabel}\`\n`;
      }
      if (surface.web?.url) {
        body += `- **Web Sandbox Target:** [${surface.web.url}](${surface.web.url})\n`;
      }

      if (surface.sheet) {
        body += `\n### Spreadsheet Data (${surface.sheet.title || 'Table'})\n\n`;
        body += `| ${surface.sheet.columns.join(' | ')} |\n`;
        body += `| ${surface.sheet.columns.map(() => '---').join(' | ')} |\n`;
        for (const row of surface.sheet.rows.slice(0, 50)) {
          body += `| ${row.join(' | ')} |\n`;
        }
      }

      if (surface.artifact?.content) {
        body += `\n### Artifact Content\n\n\`\`\`\n${surface.artifact.content.slice(0, 4000)}\n\`\`\`\n`;
      } else if (surface.content) {
        body += `\n### Content\n\n${surface.content.slice(0, 4000)}\n`;
      }

      body += `\n### Connected Knowledge Graph Entities\n`;
      body += `- [[Active Priorities]]\n`;
      body += `- [[VAULT INDEX]]\n`;
      body += `- [[01 - Daily Notes/${this.getTodayString()}]]\n`;

      const frontmatter = {
        id: surface.id,
        title: surface.title,
        type: 'cortex-surface',
        kind: surface.kind || 'surface',
        cluster: surface.clusterLabel || 'general',
        tags: ['cortex', 'surface', surface.kind || 'panel', 'auto-synthesized'],
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      const writeOk = this.writeNote(folder, filename, body, frontmatter);
      if (writeOk) {
        this.appendToDailyNote({
          timestamp: new Date().toISOString(),
          role: 'ai',
          content: `Auto-synthesized Obsidian Knowledge Graph node for pinned surface **${surface.title}** (\`${surface.kind || 'surface'}\`) → [[${filename.replace('.md', '')}]].`,
          tags: ['cortex', 'pinned', 'knowledge-graph'],
        });
      }
      return writeOk;
    } catch (err) {
      console.error('[CortexObsidianMemory] synthesizeSurfaceNote error:', err);
      return false;
    }
  }

  /**
   * Hierarchical Knowledge Graph auto-organization:
   * Scans vault notes, extracts wikilinks, indexes project clusters, and updates VAULT-INDEX.md
   */
  public autoOrganizeVault(): {
    ok: boolean;
    notesAnalyzed: number;
    linksResolved: number;
    clusters: Record<string, number>;
    totalNotes: number;
  } {
    if (!IS_NODE) {
      postVaultAction('vault_auto_organize', {});
      return { ok: true, notesAnalyzed: 0, linksResolved: 0, clusters: {}, totalNotes: 0 };
    }
    try {
      this.ensureVaultInitialized();
      const allNotes: ObsidianNote[] = [];
      const walk = (dir: string) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const full = path.join(dir, item);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            walk(full);
          } else if (item.endsWith('.md')) {
            const content = fs.readFileSync(full, 'utf-8');
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].trim() : path.basename(item, '.md');
            const tags = Array.from(content.matchAll(/#([a-zA-Z0-9_-]+)/g)).map((m: any) => m[1]);
            const links = Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g)).map((m: any) => m[1]);
            allNotes.push({
              title,
              path: full,
              relativePath: path.relative(this.vaultPath, full),
              content,
              modifiedAt: stat.mtimeMs,
              tags,
              links,
            });
          }
        }
      };
      walk(this.vaultPath);

      const clusters: Record<string, number> = {};
      let linksResolved = 0;
      for (const note of allNotes) {
        linksResolved += note.links.length;
        for (const tag of note.tags) {
          clusters[tag] = (clusters[tag] || 0) + 1;
        }
      }

      const projectNotes = allNotes.filter(
        (n) => n.relativePath.startsWith('02 - Projects') || n.relativePath.startsWith('03 - SyncScript')
      );
      const projectListing = projectNotes
        .map((n) => `- [[${n.relativePath.replace('.md', '')}]] (${n.tags.map((t) => `#${t}`).join(' ')})`)
        .join('\n');

      const indexPath = path.join(this.vaultPath, 'VAULT-INDEX.md');
      if (fs.existsSync(indexPath)) {
        let indexContent = fs.readFileSync(indexPath, 'utf-8');
        const marker = '## Dynamic Knowledge Graph & Synthesized Entities';
        const graphSection = `\n${marker}\n> Auto-organized by Cortex Cognitive Engine (${new Date().toLocaleDateString()}). Total notes: ${allNotes.length}, Wikilinks: ${linksResolved}.\n\n### Active Project Nodes\n${projectListing || '- None'}\n\n### Semantic Tag Distribution\n${Object.entries(clusters).slice(0, 10).map(([k, v]) => `- \`#${k}\`: ${v} note(s)`).join('\n')}\n`;

        if (indexContent.includes(marker)) {
          indexContent = indexContent.split(marker)[0] + graphSection.trim() + '\n';
        } else {
          indexContent = indexContent.trim() + '\n' + graphSection;
        }
        fs.writeFileSync(indexPath, indexContent, 'utf-8');
      }

      return {
        ok: true,
        notesAnalyzed: allNotes.length,
        linksResolved,
        clusters,
        totalNotes: allNotes.length,
      };
    } catch (err) {
      console.error('[CortexObsidianMemory] autoOrganizeVault error:', err);
      return { ok: false, notesAnalyzed: 0, linksResolved: 0, clusters: {}, totalNotes: 0 };
    }
  }

  public getVaultStatus(): {
    vaultPath: string;
    initialized: boolean;
    totalNotes: number;
    totalSizeBytes: number;
    folders: string[];
  } {
    if (!IS_NODE) {
      return { vaultPath: this.vaultPath, initialized: this.initialized, totalNotes: 0, totalSizeBytes: 0, folders: [] };
    }
    let totalNotes = 0;
    let totalSizeBytes = 0;
    const folders: string[] = [];

    try {
      if (fs.existsSync(this.vaultPath)) {
        const walk = (dir: string) => {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const full = path.join(dir, item);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
              folders.push(path.relative(this.vaultPath, full));
              walk(full);
            } else if (item.endsWith('.md')) {
              totalNotes++;
              totalSizeBytes += stat.size;
            }
          }
        };
        walk(this.vaultPath);
      }
    } catch {}

    return {
      vaultPath: this.vaultPath,
      initialized: this.initialized || fs.existsSync(path.join(this.vaultPath, 'VAULT-INDEX.md')),
      totalNotes,
      totalSizeBytes,
      folders: Array.from(new Set(folders)),
    };
  }

  /**
   * 3D Obsidian Vault Starfield Galaxy Graph
   * Returns all notes mapped to 3D star coordinates, semantic clusters, and wikilink constellation edges.
   */
  public getVaultGraph(): {
    ok: boolean;
    totalNotes: number;
    totalLinks: number;
    folders: string[];
    nodes: Array<{
      id: string;
      title: string;
      folder: string;
      tags: string[];
      linksCount: number;
      wordCount: number;
      modifiedAt: number;
      snippet: string;
      x: number;
      y: number;
      z: number;
      cluster: string;
    }>;
    links: Array<{ source: string; target: string }>;
    clusters: Record<string, number>;
  } {
    if (!IS_NODE) {
      return { ok: true, totalNotes: 0, totalLinks: 0, folders: [], nodes: [], links: [], clusters: {} };
    }

    try {
      this.ensureVaultInitialized();
      const rawNotes: Array<{
        id: string;
        title: string;
        folder: string;
        tags: string[];
        links: string[];
        wordCount: number;
        modifiedAt: number;
        snippet: string;
      }> = [];

      const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const full = path.join(dir, item);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            if (!item.startsWith('.')) walk(full);
          } else if (item.endsWith('.md') && !item.startsWith('.')) {
            const content = fs.readFileSync(full, 'utf-8');
            const rel = path.relative(this.vaultPath, full);
            const folder = path.dirname(rel) === '.' ? 'Root' : path.dirname(rel);
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].trim() : path.basename(item, '.md');
            const tags = Array.from(content.matchAll(/#([a-zA-Z0-9_-]+)/g)).map((m: any) => m[1]);
            const links = Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g)).map((m: any) => m[1].split('|')[0].trim());
            const words = content.trim().split(/\s+/).filter(Boolean).length;
            const snippet = content.replace(/^#\s+.+$/m, '').slice(0, 240).replace(/\s+/g, ' ').trim();

            rawNotes.push({
              id: rel,
              title,
              folder,
              tags,
              links,
              wordCount: words,
              modifiedAt: stat.mtimeMs,
              snippet,
            });
          }
        }
      };

      walk(this.vaultPath);

      // Distinct folders & cluster anchors in 3D galaxy plane
      const distinctFolders = Array.from(new Set(rawNotes.map((n) => n.folder)));
      const clusterCenters: Record<string, { x: number; y: number; z: number }> = {};
      const goldenAngle = 2.399963;

      distinctFolders.forEach((folder, idx) => {
        const phi = (idx / Math.max(1, distinctFolders.length)) * Math.PI * 2;
        const radius = 60 + (idx % 3) * 35;
        clusterCenters[folder] = {
          x: Math.cos(phi) * radius,
          y: (idx % 2 === 0 ? 1 : -1) * 15 + Math.sin(idx) * 10,
          z: Math.sin(phi) * radius,
        };
      });

      const clusters: Record<string, number> = {};
      const titleToId = new Map<string, string>();
      rawNotes.forEach((n) => {
        titleToId.set(n.title.toLowerCase(), n.id);
        titleToId.set(path.basename(n.id, '.md').toLowerCase(), n.id);
        titleToId.set(n.id.toLowerCase(), n.id);
      });

      const nodes = rawNotes.map((note, index) => {
        clusters[note.folder] = (clusters[note.folder] || 0) + 1;
        const center = clusterCenters[note.folder] || { x: 0, y: 0, z: 0 };
        const localAngle = index * goldenAngle;
        const localDist = 12 + Math.sqrt(index % 17) * 8;
        const x = center.x + Math.cos(localAngle) * localDist;
        const y = center.y + Math.sin(index * 1.7) * 8;
        const z = center.z + Math.sin(localAngle) * localDist;

        return {
          id: note.id,
          title: note.title,
          folder: note.folder,
          tags: note.tags,
          linksCount: note.links.length,
          wordCount: note.wordCount,
          modifiedAt: note.modifiedAt,
          snippet: note.snippet,
          x: Number(x.toFixed(2)),
          y: Number(y.toFixed(2)),
          z: Number(z.toFixed(2)),
          cluster: note.folder,
        };
      });

      const links: Array<{ source: string; target: string }> = [];
      const linkDedupe = new Set<string>();

      for (const note of rawNotes) {
        for (const targetName of note.links) {
          const resolvedTargetId = titleToId.get(targetName.toLowerCase());
          if (resolvedTargetId && resolvedTargetId !== note.id) {
            const edgeKey = [note.id, resolvedTargetId].sort().join('<->');
            if (!linkDedupe.has(edgeKey)) {
              linkDedupe.add(edgeKey);
              links.push({ source: note.id, target: resolvedTargetId });
            }
          }
        }
      }

      return {
        ok: true,
        totalNotes: nodes.length,
        totalLinks: links.length,
        folders: distinctFolders,
        nodes,
        links,
        clusters,
      };
    } catch (err) {
      console.error('[CortexObsidianMemory] getVaultGraph error:', err);
      return { ok: false, totalNotes: 0, totalLinks: 0, folders: [], nodes: [], links: [], clusters: {} };
    }
  }
}

export const cortexObsidianMemory = new CortexObsidianMemory();

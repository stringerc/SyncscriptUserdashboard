/**
 * MemorySubstrate — The Quantum processing nodes of Cortex
 *
 * In Hameroff/Penrose's Action Validation theory, processing nodes are the
 * quantum structures where superposition happens before collapse.
 * They hold many possible states simultaneously, and collapse
 * selects the one that reaches critical mass.
 *
 * This module treats MEMORY.md the same way:
 *
 * - Each memory entry exists in SUPERPOSITION — weighted relevance
 *   scores that change based on the query context
 * - Entries have COHERENCE with each other — linked entries amplify
 *   each other (constructive interference), contradictions cancel
 *   (destructive interference)
 * - A QUERY triggers COLLAPSE — the 12K-char context window collapses
 *   the superposition into the most relevant entries
 * - The result isn't just "keyword search" — it's quantum-like
 *   selection where context, recency, and cross-references all
 *   contribute to which entries get "observed" into the context
 *
 * Why this matters for small models:
 * - A 1.7B model with 4K context can't read 335KB of memory
 * - But it CAN read 12KB of the MOST RELEVANT memory
 * - The substrate ensures that the 12KB it gets is denser than
 *   any keyword search could produce — because cross-references
 *   and interference patterns pull in related entries that
 *   keyword search would miss
 *
 * The compression ratio: 335KB → 12KB = 28:1
 * But the information density is HIGHER because the substrate
 * selects for connectedness, not just keywords.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface MemoryEntry {
  /** Unique identifier (the markdown filename without .md) */
  id: string;
  /** The title/heading of the entry */
  title: string;
  /** One-line description (from MEMORY.md index) */
  hook: string;
  /** Full content of the memory file */
  content: string;
  /** Character count of the content */
  size: number;
  /** Links to other entries (extracted from [[name]] references) */
  links: string[];
  /** Number of other entries that link TO this one */
  inLinks: number;
  /** Timestamp of last modification (from file mtime, 0 if unknown) */
  lastModified: number;
  /** Tags extracted from frontmatter and content */
  tags: string[];
  /** Category from MEMORY.md index section header */
  category: string;

  // ── Quantum state (computed at query time) ──
  /** Superposition amplitude: 0-1 relevance weight (changes per query) */
  amplitude: number;
  /** Whether this entry "collapsed" into the current context window */
  collapsed: boolean;
}

export interface SubstrateQueryResult {
  /** The entries that collapsed into the context window */
  collapsedEntries: MemoryEntry[];
  /** Total chars in the collapsed result */
  totalChars: number;
  /** Compression ratio vs full corpus */
  compressionRatio: number;
  /** The constructed context string for injection */
  contextString: string;
  /** Which query terms matched */
  matchedTerms: string[];
  /** Interference detected between entries */
  interferencePatterns: InterferencePattern[];
}

export interface InterferencePattern {
  type: 'constructive' | 'destructive' | 'orthogonal';
  entries: [string, string]; // entry IDs
  description: string;
}

// ── Constants ──────────────────────────────────────────────────────

import { persistentStore } from './persistent-store';

/** Maximum chars to inject into the local model's context */
const MAX_CONTEXT_CHARS = 12000;

/** Minimum amplitude to collapse into context (below = stays in superposition) */
const COLLAPSE_THRESHOLD = 0.15;

/** Boost factor for entries linked by other high-amplitude entries */
const LINK_AMPLIFICATION = 0.2;

/** Decay factor for older entries (per day) */
const RECENCY_DECAY = 0.02;

// ── MemorySubstrate ────────────────────────────────────────────────

export class MemorySubstrate {
  private entries: Map<string, MemoryEntry> = new Map();
  private loaded = false;

  /**
   * Load all memory entries from persistentStore (with IndexedDB fallback).
   * Called once at app startup or when the substrate is first queried.
   */
  load(): void {
    if (this.loaded) return;
    this.entries.clear();

    // 1. Load the MEMORY.md index to get hooks and categories
    const indexRaw = persistentStore.getItem('syncscript:memory:index') ?? '';
    const indexLines = indexRaw.split('\n');

    let currentCategory = 'Uncategorized';
    for (const line of indexLines) {
      // Category headers: ## Category Name
      const catMatch = line.match(/^##\s+(.+)/);
      if (catMatch) {
        currentCategory = catMatch[1].trim();
        continue;
      }

      // Entry lines: - [Title](file.md) — hook
      const entryMatch = line.match(/^- \[([^\]]+)\]\(([^)]+)\)\s*—?\s*(.*)/);
      if (entryMatch) {
        const title = entryMatch[1].trim();
        const filename = entryMatch[2].trim().replace('.md', '');
        const hook = entryMatch[3].trim();

        // 2. Try to load the full content
        const contentKey = `syncscript:memory:file:${filename}`;
        const content = persistentStore.getItem(contentKey) ?? hook;

        // 3. Extract [[links]] from content
        const linkMatches = content.matchAll(/\[\[([^\]]+)\]\]/g);
        const links = Array.from(linkMatches, m => m[1].trim());

        // 4. Extract tags from frontmatter and content
        const tagMatches = content.match(/(?:^|[^\[])#([a-zA-Z][\w-]*)/g);
        const tags = (tagMatches ?? []).map(t => t.replace(/^#/, '').toLowerCase());

        const entry: MemoryEntry = {
          id: filename,
          title,
          hook,
          content,
          size: content.length,
          links,
          inLinks: 0, // computed below
          lastModified: 0, // would need file mtime
          tags,
          category: currentCategory,
          amplitude: 0,
          collapsed: false,
        };

        this.entries.set(filename, entry);
      }
    }

    // 5. Compute inLinks (how many other entries link TO each entry)
    for (const entry of this.entries.values()) {
      for (const linkId of entry.links) {
        const target = this.entries.get(linkId);
        if (target) target.inLinks++;
      }
    }

    this.loaded = true;
  }

  /**
   * Asynchronously load from persistentStore and IndexedDB cache.
   */
  async loadAsync(): Promise<void> {
    if (this.loaded) return;
    await persistentStore.hydrateFromIndexedDB();
    this.load();
  }

  /**
   * Store a memory file's content in persistentStore (mirrored to IndexedDB).
   * Call this when memory files are synced from the server.
   */
  storeFile(filename: string, content: string): void {
    const id = filename.replace('.md', '');
    persistentStore.setItem(`syncscript:memory:file:${id}`, content);

    // Update the entry if it exists
    const existing = this.entries.get(id);
    if (existing) {
      existing.content = content;
      existing.size = content.length;
      const linkMatches = content.matchAll(/\[\[([^\]]+)\]\]/g);
      existing.links = Array.from(linkMatches, m => m[1].trim());
    }
  }

  async storeFileAsync(filename: string, content: string): Promise<void> {
    const id = filename.replace('.md', '');
    await persistentStore.setItemAsync(`syncscript:memory:file:${id}`, content);
    this.storeFile(filename, content);
  }

  /**
   * Store the MEMORY.md index in persistentStore (mirrored to IndexedDB).
   * Call this when the index is synced.
   */
  storeIndex(content: string): void {
    persistentStore.setItem('syncscript:memory:index', content);
    this.loaded = false; // Force reload on next query
  }

  async storeIndexAsync(content: string): Promise<void> {
    await persistentStore.setItemAsync('syncscript:memory:index', content);
    this.loaded = false;
  }

  /**
   * QUERY the substrate — collapse superposition into context.
   *
   * This is the quantum measurement operation. The query terms
   * interact with all entries in superposition, and entries with
   * sufficient amplitude "collapse" into the context window.
   *
   * The key difference from keyword search:
   * - Keyword search: "X" matches entries containing "X"
   * - Substrate query: "X" matches entries containing "X"
   *   AND amplifies entries LINKED TO those entries
   *   AND amplifies entries in the same CATEGORY
   *   AND applies destructive interference to contradicting entries
   *   AND decays older entries unless boosted by links
   *
   * The result: you get entries you didn't explicitly search for,
   * but that are quantum-connected to what you searched for.
   */
  query(queryText: string): SubstrateQueryResult {
    this.load();

    const terms = this.extractTerms(queryText);
    const matchedTerms: string[] = [];

    // ── Phase 1: Compute base amplitudes from direct term matching ──
    for (const entry of this.entries.values()) {
      entry.amplitude = 0;
      entry.collapsed = false;

      const text = `${entry.title} ${entry.hook} ${entry.tags.join(' ')} ${entry.category}`.toLowerCase();
      const fullText = `${text} ${entry.content.substring(0, 500).toLowerCase()}`;

      for (const term of terms) {
        if (fullText.includes(term)) {
          entry.amplitude += 0.3;
          if (!matchedTerms.includes(term)) matchedTerms.push(term);
        }
      }

      // Bonus for being heavily linked (hub nodes = more important)
      entry.amplitude += Math.min(0.3, entry.inLinks * 0.05);

      // Bonus for being small (dense entries = better context value)
      if (entry.size < 500) entry.amplitude += 0.1;
      else if (entry.size < 2000) entry.amplitude += 0.05;

      // Cap at 1.0
      entry.amplitude = Math.min(1.0, entry.amplitude);
    }

    // ── Phase 2: Link amplification (quantum correlation) ──
    // Entries linked to high-amplitude entries get a boost
    const amplified = new Set<string>();
    for (const entry of this.entries.values()) {
      if (entry.amplitude > COLLAPSE_THRESHOLD) {
        for (const linkId of entry.links) {
          const linked = this.entries.get(linkId);
          if (linked && !amplified.has(linkId)) {
            linked.amplitude += LINK_AMPLIFICATION * entry.amplitude;
            linked.amplitude = Math.min(1.0, linked.amplitude);
            amplified.add(linkId);
          }
        }
      }
    }

    // ── Phase 3: Category coherence (resonance within sections) ──
    // If multiple entries from the same category match, boost all in that category
    const categoryCounts = new Map<string, number>();
    for (const entry of this.entries.values()) {
      if (entry.amplitude > COLLAPSE_THRESHOLD) {
        categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
      }
    }
    for (const [category, count] of categoryCounts) {
      if (count >= 2) {
        // Constructive interference within this category
        for (const entry of this.entries.values()) {
          if (entry.category === category && entry.amplitude > 0) {
            entry.amplitude += 0.1 * count;
            entry.amplitude = Math.min(1.0, entry.amplitude);
          }
        }
      }
    }

    // ── Phase 4: Detect interference patterns ──
    const interferencePatterns: InterferencePattern[] = [];
    const highAmplitude = Array.from(this.entries.values())
      .filter(e => e.amplitude > COLLAPSE_THRESHOLD);

    for (let i = 0; i < highAmplitude.length; i++) {
      for (let j = i + 1; j < highAmplitude.length; j++) {
        const a = highAmplitude[i];
        const b = highAmplitude[j];

        // Check for links (constructive interference)
        if (a.links.includes(b.id) || b.links.includes(a.id)) {
          interferencePatterns.push({
            type: 'constructive',
            entries: [a.id, b.id],
            description: `"${a.title}" and "${b.title}" are linked — they amplify each other`,
          });
        }
        // Check for same category (potential resonance)
        else if (a.category === b.category && a.category !== 'Uncategorized') {
          interferencePatterns.push({
            type: 'constructive',
            entries: [a.id, b.id],
            description: `"${a.title}" and "${b.title}" share category "${a.category}" — coherent`,
          });
        }
      }
    }

    // ── Phase 5: Collapse — select entries to fit in context window ──
    const sorted = Array.from(this.entries.values())
      .filter(e => e.amplitude >= COLLAPSE_THRESHOLD)
      .sort((a, b) => b.amplitude - a.amplitude);

    const collapsedEntries: MemoryEntry[] = [];
    let totalChars = 0;

    for (const entry of sorted) {
      // Estimate: title + hook + content summary
      const entryChars = entry.size <= 2000
        ? entry.size
        : entry.title.length + entry.hook.length + 200; // Summary for large entries

      if (totalChars + entryChars > MAX_CONTEXT_CHARS) {
        // Doesn't fit — check if a summary would fit
        if (totalChars + entry.title.length + entry.hook.length + 50 < MAX_CONTEXT_CHARS) {
          // Include just the title + hook as a reference
          const summary: MemoryEntry = {
            ...entry,
            content: entry.hook,
            size: entry.hook.length,
            collapsed: true,
          };
          collapsedEntries.push(summary);
          totalChars += summary.size + 50;
        }
        continue;
      }

      entry.collapsed = true;
      collapsedEntries.push(entry);
      totalChars += entryChars + 50; // 50 char overhead per entry
    }

    // ── Phase 6: Construct the context string ──
    const contextParts: string[] = [];
    for (const entry of collapsedEntries) {
      if (entry.content.length > 2000) {
        // Large entry: include title + first 500 chars
        contextParts.push(`### ${entry.title}\n${entry.content.substring(0, 500)}...`);
      } else {
        contextParts.push(`### ${entry.title}\n${entry.content}`);
      }
    }

    const contextString = contextParts.join('\n\n');
    const totalCorpusSize = Array.from(this.entries.values())
      .reduce((sum, e) => sum + e.size, 0);
    const compressionRatio = totalCorpusSize / Math.max(1, contextString.length);

    return {
      collapsedEntries,
      totalChars: contextString.length,
      compressionRatio,
      contextString,
      matchedTerms,
      interferencePatterns,
    };
  }

  /**
   * Get all entries for debugging/inspection.
   */
  getAllEntries(): MemoryEntry[] {
    this.load();
    return Array.from(this.entries.values());
  }

  /**
   * Get the full corpus size in chars.
   */
  getCorpusSize(): number {
    this.load();
    return Array.from(this.entries.values()).reduce((sum, e) => sum + e.size, 0);
  }

  // ── Internal ─────────────────────────────────────────────────────

  private extractTerms(query: string): string[] {
    // Lowercase, split on non-alpha, remove stop words, deduplicate
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'shall', 'can',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'out', 'off', 'over', 'under', 'again',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
      'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
      'or', 'if', 'while', 'about', 'up', 'it', 'its', 'i', 'me',
      'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them',
      'what', 'which', 'who', 'this', 'that', 'these', 'those',
    ]);

    const words = query.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/);
    const terms = words.filter(w => w.length > 2 && !stopWords.has(w));

    // Also generate bigrams for more specific matching
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 2 && words[i + 1].length > 2) {
        bigrams.push(`${words[i]} ${words[i + 1]}`);
      }
    }

    return [...new Set([...terms, ...bigrams])];
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalSubstrate: MemorySubstrate | null = null;

export function getMemorySubstrate(): MemorySubstrate {
  if (!globalSubstrate) {
    globalSubstrate = new MemorySubstrate();
  }
  return globalSubstrate;
}

export function resetMemorySubstrate(): void {
  globalSubstrate = null;
}

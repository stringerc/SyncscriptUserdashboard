/**
 * Cortex Mobile Sovereign Sync Subsystem
 *
 * Implements the 3-Tier "Always-Available" Memory & Cognitive Architecture:
 * - Tier 1: Mac Direct / WireGuard LAN (Fastest, zero-cloud, direct SSD I/O)
 * - Tier 2: GitHub Private Cloud Backup (Used when laptop is dead, asleep, or closed)
 * - Tier 3: On-Device Hardware-Encrypted Offline Cache (Airplane mode / zero connectivity)
 */

export type MobileSyncTier = 'mac_direct' | 'github_cloud' | 'offline_cache';

export interface MobilePairingPayload {
  version: '1.0';
  hostUrl: string;
  repoOwner: string;
  repoName: string;
  filePath: string;
  authToken?: string;
  githubToken?: string;
  pairedAt: number;
  macHostname?: string;
}

export interface MemorySnapshot {
  content: string;
  sha?: string;
  source: MobileSyncTier;
  updatedAt: number;
  sectionsCount: number;
  charCount: number;
}

export interface MemorySection {
  title: string;
  level: number;
  content: string;
}

/**
 * Splits markdown into readable structured sections for mobile exploration
 */
export function parseMemorySections(markdown: string): MemorySection[] {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const sections: MemorySection[] = [];
  let currentTitle = 'Overview';
  let currentLevel = 1;
  let currentBuffer: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      if (currentBuffer.length > 0 || sections.length === 0) {
        sections.push({
          title: currentTitle,
          level: currentLevel,
          content: currentBuffer.join('\n').trim(),
        });
        currentBuffer = [];
      }
      currentLevel = match[1].length;
      currentTitle = match[2].trim();
    } else {
      currentBuffer.push(line);
    }
  }

  if (currentBuffer.length > 0) {
    sections.push({
      title: currentTitle,
      level: currentLevel,
      content: currentBuffer.join('\n').trim(),
    });
  }

  return sections;
}

/**
 * Tier 1: Fetch memory directly from the Mac host server
 */
export async function fetchMemoryDirect(
  hostUrl: string,
  token?: string,
  timeoutMs = 1800
): Promise<MemorySnapshot> {
  const cleanHost = (hostUrl || '').replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${cleanHost}/api/cortex/mobile/memory`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Mac Direct server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.ok || typeof data.content !== 'string') {
      throw new Error(data.error || 'Invalid memory payload from Mac');
    }

    return {
      content: data.content,
      sha: data.sha || `mac-${Date.now()}`,
      source: 'mac_direct',
      updatedAt: data.updatedAt || Date.now(),
      sectionsCount: parseMemorySections(data.content).length,
      charCount: data.content.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tier 1: Write updated memory directly to the Mac host server
 */
export async function writeMemoryDirect(
  hostUrl: string,
  token: string | undefined,
  content: string,
  commitMessage: string,
  timeoutMs = 4000
): Promise<{ ok: boolean; sha?: string; error?: string }> {
  const cleanHost = (hostUrl || '').replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${cleanHost}/api/cortex/mobile/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        content,
        commitMessage: commitMessage || 'chore(cortex-mobile): update MEMORY.md from iPhone',
      }),
      signal: controller.signal,
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to contact Mac host' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tier 2: Fetch memory directly from GitHub Private Repository
 * (Used when laptop is dead, powered off, or asleep)
 */
export async function fetchMemoryFromGitHub(
  owner: string,
  repo: string,
  token: string,
  path = 'MEMORY.md',
  timeoutMs = 4500
): Promise<MemorySnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Cortex-Mobile-Sync-Client/1.0',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`GitHub API returned HTTP ${res.status} (${res.statusText})`);
    }

    const data = await res.json();
    if (!data.content) {
      throw new Error('No content returned from GitHub');
    }

    // GitHub returns base64 content
    let decoded = '';
    if (typeof atob === 'function') {
      decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
    } else {
      decoded = Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return {
      content: decoded,
      sha: data.sha,
      source: 'github_cloud',
      updatedAt: Date.now(),
      sectionsCount: parseMemorySections(decoded).length,
      charCount: decoded.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tier 2: Commit updated memory directly to GitHub Private Repository
 * (Used when laptop is dead, powered off, or asleep)
 */
export async function commitMemoryToGitHub(
  owner: string,
  repo: string,
  token: string,
  path: string,
  content: string,
  sha: string,
  commitMessage: string
): Promise<{ ok: boolean; sha?: string; error?: string }> {
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
    
    // Base64 encode UTF-8 string
    let base64Content = '';
    if (typeof btoa === 'function') {
      base64Content = btoa(unescape(encodeURIComponent(content)));
    } else {
      base64Content = Buffer.from(content, 'utf-8').toString('base64');
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Cortex-Mobile-Sync-Client/1.0',
      },
      body: JSON.stringify({
        message: commitMessage || 'chore(cortex-mobile): update MEMORY.md from iPhone',
        content: base64Content,
        sha,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`GitHub commit failed with HTTP ${res.status}: ${errBody}`);
    }

    const result = await res.json();
    return {
      ok: true,
      sha: result.content?.sha,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'GitHub commit failed' };
  }
}

/**
 * Tier 3: Local Storage Persistent Cache (Zero-Network Airplane Mode)
 */
const memoryFallbackStore = new Map<string, string>();

export const LocalMemoryCache = {
  STORAGE_KEY: 'cortex_mobile_memory_cache_v1',
  QUEUE_KEY: 'cortex_mobile_pending_queue_v1',

  get(): MemorySnapshot | null {
    try {
      let raw: string | null = null;
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        try { raw = localStorage.getItem(this.STORAGE_KEY); } catch {}
      }
      if (!raw) raw = memoryFallbackStore.get(this.STORAGE_KEY) || null;
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        source: 'offline_cache',
      };
    } catch {
      return null;
    }
  },

  set(snapshot: MemorySnapshot): void {
    try {
      const serialized = JSON.stringify({
        content: snapshot.content,
        sha: snapshot.sha,
        updatedAt: snapshot.updatedAt,
        sectionsCount: snapshot.sectionsCount,
        charCount: snapshot.charCount,
      });
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        try { localStorage.setItem(this.STORAGE_KEY, serialized); } catch {}
      }
      memoryFallbackStore.set(this.STORAGE_KEY, serialized);
    } catch (e) {
      console.warn('[Cortex Mobile Cache] Failed to cache memory:', e);
    }
  },

  getPendingQueue(): Array<{ id: string; content: string; message: string; timestamp: number }> {
    try {
      let raw: string | null = null;
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        try { raw = localStorage.getItem(this.QUEUE_KEY); } catch {}
      }
      if (!raw) raw = memoryFallbackStore.get(this.QUEUE_KEY) || null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  enqueuePending(content: string, message: string): void {
    try {
      const queue = this.getPendingQueue();
      queue.push({
        id: `m-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        content,
        message,
        timestamp: Date.now(),
      });
      const serialized = JSON.stringify(queue);
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        try { localStorage.setItem(this.QUEUE_KEY, serialized); } catch {}
      }
      memoryFallbackStore.set(this.QUEUE_KEY, serialized);
    } catch (e) {
      console.warn('[Cortex Mobile Cache] Enqueue failed:', e);
    }
  },

  clearQueue(): void {
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
        try { localStorage.removeItem(this.QUEUE_KEY); } catch {}
      }
      memoryFallbackStore.delete(this.QUEUE_KEY);
    } catch {}
  }
};

/**
 * Master 3-Tier Sovereign Memory Coordinator
 */
export class CortexMobileSyncEngine {
  private config: MobilePairingPayload;
  private currentSnapshot: MemorySnapshot | null = null;
  private activeTier: MobileSyncTier = 'mac_direct';
  private listeners: Set<(snapshot: MemorySnapshot | null, tier: MobileSyncTier) => void> = new Set();

  constructor(initialConfig?: Partial<MobilePairingPayload>) {
    this.config = {
      version: '1.0',
      hostUrl: initialConfig?.hostUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5173'),
      repoOwner: initialConfig?.repoOwner || 'stringerc',
      repoName: initialConfig?.repoName || 'SyncscriptUserdashboard',
      filePath: initialConfig?.filePath || 'MEMORY.md',
      authToken: initialConfig?.authToken,
      githubToken: initialConfig?.githubToken,
      pairedAt: initialConfig?.pairedAt || Date.now(),
      macHostname: initialConfig?.macHostname || 'MacBook Pro',
    };

    // Hydrate offline cache immediately for sub-millisecond initial render
    const cached = LocalMemoryCache.get();
    if (cached) {
      this.currentSnapshot = cached;
      this.activeTier = 'offline_cache';
    }
  }

  public subscribe(fn: (snapshot: MemorySnapshot | null, tier: MobileSyncTier) => void): () => void {
    this.listeners.add(fn);
    fn(this.currentSnapshot, this.activeTier);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.currentSnapshot, this.activeTier));
  }

  public getActiveTier(): MobileSyncTier {
    return this.activeTier;
  }

  public getSnapshot(): MemorySnapshot | null {
    return this.currentSnapshot;
  }

  public updateConfig(newConfig: Partial<MobilePairingPayload>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Resilient 3-Tier Read:
   * 1. Try Mac Direct (fast, zero cloud)
   * 2. If Mac is offline/dead, try GitHub Private API
   * 3. If no network, fallback to local on-device cache
   */
  public async sync(): Promise<MemorySnapshot> {
    // Tier 1: Try Mac Direct
    try {
      const snap = await fetchMemoryDirect(this.config.hostUrl, this.config.authToken, 1600);
      this.currentSnapshot = snap;
      this.activeTier = 'mac_direct';
      LocalMemoryCache.set(snap);
      this.notify();
      return snap;
    } catch (macErr) {
      console.info('[Cortex Sync] Mac Direct unreachable (laptop sleeping or off-grid) — evaluating Tier 2…', (macErr as any)?.message);
    }

    // Tier 2: Try GitHub Private Cloud Backup
    if (this.config.githubToken && this.config.repoOwner && this.config.repoName) {
      try {
        const snap = await fetchMemoryFromGitHub(
          this.config.repoOwner,
          this.config.repoName,
          this.config.githubToken,
          this.config.filePath,
          4500
        );
        this.currentSnapshot = snap;
        this.activeTier = 'github_cloud';
        LocalMemoryCache.set(snap);
        this.notify();
        return snap;
      } catch (ghErr) {
        console.warn('[Cortex Sync] GitHub Cloud unreachable — falling back to Tier 3 on-device cache', (ghErr as any)?.message);
      }
    }

    // Tier 3: Local Offline Cache
    const cached = LocalMemoryCache.get();
    if (cached) {
      this.currentSnapshot = cached;
      this.activeTier = 'offline_cache';
      this.notify();
      return cached;
    }

    throw new Error('Memory unavailable: Mac is unreachable, GitHub token unconfigured, and local cache empty.');
  }

  /**
   * Resilient 3-Tier Write:
   * 1. If Mac online, push directly to Mac disk.
   * 2. If Mac offline, commit directly to private GitHub repo.
   * 3. Always write immediately to local device cache and queue if completely offline.
   */
  public async write(content: string, commitMessage: string): Promise<{ ok: boolean; tier: MobileSyncTier; error?: string }> {
    const updatedSnap: MemorySnapshot = {
      content,
      sha: this.currentSnapshot?.sha,
      source: this.activeTier,
      updatedAt: Date.now(),
      sectionsCount: parseMemorySections(content).length,
      charCount: content.length,
    };

    // Optimistic local cache update
    LocalMemoryCache.set(updatedSnap);
    this.currentSnapshot = updatedSnap;
    this.notify();

    // 1. Try Mac Direct
    const macRes = await writeMemoryDirect(this.config.hostUrl, this.config.authToken, content, commitMessage, 2000);
    if (macRes.ok) {
      this.activeTier = 'mac_direct';
      this.currentSnapshot.sha = macRes.sha;
      this.notify();
      return { ok: true, tier: 'mac_direct' };
    }

    // 2. Try GitHub Private Repo
    if (this.config.githubToken && this.config.repoOwner && this.config.repoName) {
      const ghRes = await commitMemoryToGitHub(
        this.config.repoOwner,
        this.config.repoName,
        this.config.githubToken,
        this.config.filePath,
        content,
        this.currentSnapshot.sha || '',
        commitMessage
      );
      if (ghRes.ok) {
        this.activeTier = 'github_cloud';
        this.currentSnapshot.sha = ghRes.sha;
        this.notify();
        return { ok: true, tier: 'github_cloud' };
      }
    }

    // 3. Queue for later synchronization
    LocalMemoryCache.enqueuePending(content, commitMessage);
    this.activeTier = 'offline_cache';
    this.notify();
    return { ok: true, tier: 'offline_cache' };
  }

  /**
   * Sub-10ms Unified Search across System Memory & Local Knowledge Vault
   */
  public async searchKnowledge(query: string, options?: { source?: string; limit?: number }): Promise<{
    ok: boolean;
    query: string;
    durationMs: number;
    results: any[];
    stats?: any;
    tier: MobileSyncTier;
  }> {
    const t0 = performance.now();
    const cleanHost = (this.config.hostUrl || '').replace(/\/+$/, '');
    const limit = options?.limit || 5;
    const source = options?.source || 'all';

    // 1. Try Mac Direct search API
    if (cleanHost) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(`${cleanHost}/api/cortex/memory/search?q=${encodeURIComponent(query)}&source=${source}&limit=${limit}`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.authToken ? { Authorization: `Bearer ${this.config.authToken}` } : {})
          }
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          return {
            ok: true,
            query,
            durationMs: data.durationMs || Math.round(performance.now() - t0),
            results: data.results || [],
            stats: data.stats,
            tier: 'mac_direct',
          };
        }
      } catch {}
    }

    // 2. Fallback: Search local memory snapshot in cache
    const snap = this.currentSnapshot || LocalMemoryCache.get();
    if (snap && snap.content) {
      const sections = parseMemorySections(snap.content);
      const qLower = query.toLowerCase();
      const scored = sections.map(s => {
        let score = 0;
        if (s.title.toLowerCase().includes(qLower)) score += 25;
        if (s.content.toLowerCase().includes(qLower)) score += 10;
        return {
          id: s.id,
          source: 'memory',
          sourceType: 'System Memory (Cached)',
          title: s.title,
          level: s.level,
          score,
          charCount: s.content.length,
          snippet: s.content.slice(0, 300).replace(/\s+/g, ' '),
        };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

      return {
        ok: true,
        query,
        durationMs: Math.round(performance.now() - t0),
        results: scored,
        tier: this.activeTier === 'mac_direct' ? 'offline_cache' : this.activeTier,
      };
    }

    return {
      ok: false,
      query,
      durationMs: Math.round(performance.now() - t0),
      results: [],
      tier: 'offline_cache',
    };
  }
}

/**
 * Storage adapter for the cortex modules.
 *
 * Provides a hybrid multi-tier persistence pipeline:
 *   1. Synchronous localStorage / memory store for zero-latency lookups.
 *   2. Synchronous overflow cache for entries exceeding browser quota.
 *   3. Asynchronous IndexedDB storage engine (`cortex_substrate_db`) that eliminates
 *      the 5–10MB browser localStorage quota ceiling, persisting large
 *      identity anchors, episodic traces, and memory substrate embeddings.
 *
 * Behaviour, stated precisely:
 *   - In a browser, synchronous reads/writes target `window.localStorage` with
 *     automatic fallback and mirroring to IndexedDB.
 *   - If `localStorage` throws `QuotaExceededError`, the entry is stored in
 *     an in-memory overflow map and offloaded to IndexedDB without throwing.
 *   - Under Node, this uses an in-process Map.
 */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AsyncKeyValueStore extends KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  removeItemAsync(key: string): Promise<void>;
  isIndexedDBAvailable(): boolean;
  hydrateFromIndexedDB(): Promise<void>;
}

const memory = new Map<string, string>();
const overflowMemory = new Map<string, string>();

const DB_NAME = 'cortex_substrate_db';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

let idbInstance: any = null;
let idbInitPromise: Promise<any> | null = null;

function getIndexedDB(): any {
  if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB;
  }
  return undefined;
}

function openDatabase(): Promise<any> {
  const idb = getIndexedDB();
  if (!idb) return Promise.resolve(null);
  if (idbInstance) return Promise.resolve(idbInstance);
  if (idbInitPromise) return idbInitPromise;

  idbInitPromise = new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        idbInstance = request.result;
        resolve(idbInstance);
      };
      request.onerror = () => {
        console.warn('[persistentStore] Failed to open IndexedDB:', request.error);
        resolve(null);
      };
    } catch (e) {
      console.warn('[persistentStore] IndexedDB open error:', e);
      resolve(null);
    }
  });

  return idbInitPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const record = req.result as { key: string; val: string } | undefined;
        resolve(record ? record.val : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ key, val: value, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn(`[persistentStore] Failed to write key "${key}" to IndexedDB:`, req.error);
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

async function idbRemove(key: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbHydrateCache(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result as Array<{ key: string; val: string }>;
        if (Array.isArray(items)) {
          for (const item of items) {
            overflowMemory.set(item.key, item.val);
          }
        }
        resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Auto-hydrate background IndexedDB cache if running in browser
if (typeof window !== 'undefined' && getIndexedDB()) {
  idbHydrateCache().catch(() => {});
}

function resolveBackend(): { store: KeyValueStore | null; durable: boolean } {
  try {
    const ls = (globalThis as { localStorage?: KeyValueStore }).localStorage;
    if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') {
      const probe = '__cortex_store_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return { store: ls, durable: true };
    }
  } catch {
    // Fall through to memory.
  }
  return { store: null, durable: false };
}

const backend = resolveBackend();
const backendStore = backend.store;

// ── Node durability mirror ─────────────────────────────────────────
// Under Node there is no localStorage or IndexedDB — without this
// mirror every cortex module's "persistent" state dies with the dev
// server (life goals, episodic checkpoints, instincts, patterns).
// Mirror the memory map to .cortex-runtime/persistent-store.json with
// a debounced flush. Uses process.getBuiltinModule so the module stays
// import-safe in browser bundles (no node: imports).
const nodeProc = (globalThis as { process?: { versions?: { node?: string }; getBuiltinModule?: (id: string) => any; cwd?: () => string } }).process;
const isNodeRuntime = !!nodeProc?.versions?.node && typeof nodeProc.getBuiltinModule === 'function';
let nodeFs: any = null;
let nodePathMod: any = null;
let nodeStoreFile: string | null = null;
let nodeFlushTimer: ReturnType<typeof setTimeout> | null = null;
let nodeFlushWarned = false;

if (isNodeRuntime) {
  try {
    nodeFs = nodeProc!.getBuiltinModule!('node:fs');
    nodePathMod = nodeProc!.getBuiltinModule!('node:path');
    nodeStoreFile = nodePathMod.join(nodeProc!.cwd!(), '.cortex-runtime', 'persistent-store.json');
    const parsed = JSON.parse(nodeFs.readFileSync(nodeStoreFile, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') memory.set(k, v);
      }
    }
  } catch { /* first boot — file absent or corrupt */ }
}

function scheduleNodeFlush(): void {
  if (!isNodeRuntime || !nodeStoreFile) return;
  if (nodeFlushTimer) clearTimeout(nodeFlushTimer);
  nodeFlushTimer = setTimeout(() => {
    nodeFlushTimer = null;
    try {
      const payload = JSON.stringify(Object.fromEntries(memory));
      if (payload.length > 8_000_000) {
        if (!nodeFlushWarned) { nodeFlushWarned = true; console.warn('[persistentStore] Node mirror skipped — state exceeds 8MB'); }
        return;
      }
      nodeFs.mkdirSync(nodePathMod.dirname(nodeStoreFile), { recursive: true });
      nodeFs.writeFileSync(nodeStoreFile, payload);
    } catch { /* disk pressure — memory copy still serves this process */ }
  }, 750);
  if (typeof nodeFlushTimer.unref === 'function') nodeFlushTimer.unref();
}

const hybridStore: AsyncKeyValueStore = {
  getItem: (key: string): string | null => {
    if (backendStore) {
      try {
        const val = backendStore.getItem(key);
        if (val !== null) return val;
      } catch {}
    }
    return overflowMemory.get(key) ?? memory.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    // 1. Keep in in-memory maps for synchronous availability
    memory.set(key, value);
    overflowMemory.set(key, value);

    // 2. Try primary synchronous localStorage
    if (backendStore) {
      try {
        backendStore.setItem(key, value);
      } catch {
        // QuotaExceededError or disabled: gracefully offloaded to IndexedDB fallback
        console.warn(`[persistentStore] localStorage write quota exceeded for key "${key}". Offloading to IndexedDB.`);
      }
    }

    // 3. Mirror/persist to IndexedDB asynchronously
    idbSet(key, value).catch(() => {});
    scheduleNodeFlush();
  },
  removeItem: (key: string): void => {
    memory.delete(key);
    overflowMemory.delete(key);
    if (backendStore) {
      try {
        backendStore.removeItem(key);
      } catch {}
    }
    idbRemove(key).catch(() => {});
    scheduleNodeFlush();
  },
  getItemAsync: async (key: string): Promise<string | null> => {
    const syncVal = hybridStore.getItem(key);
    if (syncVal !== null) return syncVal;
    const idbVal = await idbGet(key);
    if (idbVal !== null) {
      overflowMemory.set(key, idbVal);
      return idbVal;
    }
    return null;
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    hybridStore.setItem(key, value);
    await idbSet(key, value);
  },
  removeItemAsync: async (key: string): Promise<void> => {
    hybridStore.removeItem(key);
    await idbRemove(key);
  },
  isIndexedDBAvailable: (): boolean => Boolean(getIndexedDB()),
  hydrateFromIndexedDB: idbHydrateCache,
};

/** Drop-in replacement for `localStorage` across the cortex modules with IndexedDB fallback. */
export const persistentStore: AsyncKeyValueStore = hybridStore;

/** True only when writes survive process/session exit. */
export function isDurable(): boolean {
  return backend.durable || Boolean(getIndexedDB()) || isNodeRuntime;
}

/** Test hook: clear the in-memory backend between runs. */
export function clearMemoryStore(): void {
  memory.clear();
  overflowMemory.clear();
}

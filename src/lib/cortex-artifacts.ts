/**
 * Cortex Generative Surfaces — typed artifact schema + validation.
 *
 * Artifacts are structured visual objects the agent emits via the
 * `emit_artifact` / `generate_image` tools (or attaches to tool results).
 * They ride on `ChatMessage.meta.artifacts`, render through the
 * ArtifactRenderer registry in both transcript surfaces, and become
 * dockable panels in Phase 2.
 */

export const MAX_ARTIFACTS_PER_MESSAGE = 3;
export const MAX_VISIBLE_PANELS = 14;

export type ArtifactAspect = '16:9' | '1:1' | '4:3';
export type ChartType = 'line' | 'bar' | 'area' | 'pie';

export interface ArtifactBase {
  id: string;
  createdAt: number;
  /** Tool or path that produced this artifact (provenance). */
  source: string;
  /** Phase 3: artifact subscribes to a live data source and updates in place. */
  live?: boolean;
  /** Optional live-data binding, e.g. 'telemetry'. */
  liveSource?: string;
}

export interface StatArtifact extends ArtifactBase {
  kind: 'stat';
  title: string;
  value: string;
  unit?: string;
  delta?: string;
  /** Optional sparkline points (oldest → newest). */
  spark?: number[];
}

export interface ChartSeries {
  name: string;
  points: { x: string | number; y: number }[];
}

export interface ChartArtifact extends ArtifactBase {
  kind: 'chart';
  title: string;
  chartType: ChartType;
  series: ChartSeries[];
  xLabel?: string;
  yLabel?: string;
}

export interface TableArtifact extends ArtifactBase {
  kind: 'table';
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ImageArtifact extends ArtifactBase {
  kind: 'image';
  title: string;
  url: string;
  prompt?: string;
  provider?: string;
  aspect?: ArtifactAspect;
}

export interface DocumentArtifact extends ArtifactBase {
  kind: 'document';
  title: string;
  format: 'markdown' | 'code';
  content: string;
  lang?: string;
  docxPath?: string;
  pdfPath?: string;
  htmlPath?: string;
}

export interface MapArtifact extends ArtifactBase {
  kind: 'map';
  title: string;
  /** Human summary of the view, e.g. "Route: Duluth → Atlanta, 42 km, 36 min". */
  summary?: string;
  /** Optional structured view descriptor for re-opening on the globe. */
  view?: Record<string, unknown>;
}

export interface FeedItem {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'alert' | 'info';
}

export interface FeedArtifact extends ArtifactBase {
  kind: 'feed';
  title: string;
  items: FeedItem[];
}

export type CortexArtifact =
  | StatArtifact
  | ChartArtifact
  | TableArtifact
  | ImageArtifact
  | DocumentArtifact
  | MapArtifact
  | FeedArtifact;

export const ARTIFACT_KINDS = ['stat', 'chart', 'table', 'image', 'document', 'map', 'feed'] as const;

const MAX_STRING = 4000;
const MAX_TITLE = 200;
const MAX_ROWS = 100;
const MAX_SERIES = 6;
const MAX_POINTS = 500;
const MAX_FEED_ITEMS = 50;
const MAX_SPARK = 120;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = MAX_STRING): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function sanitizeBase(raw: Record<string, unknown>, source: string): ArtifactBase {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 80) : crypto.randomUUID(),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    source: str(raw.source || source, 80) || source,
    ...(raw.live === true ? { live: true } : {}),
    ...(typeof raw.liveSource === 'string' && raw.liveSource ? { liveSource: raw.liveSource.slice(0, 60) } : {}),
  };
}

function sanitizeChartSeries(v: unknown): ChartSeries[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_SERIES).map((s) => {
    const o = isObj(s) ? s : {};
    const pts = Array.isArray(o.points) ? o.points : [];
    return {
      name: str(o.name, MAX_TITLE) || 'series',
      points: pts.slice(0, MAX_POINTS).map((p) => {
        const po = isObj(p) ? p : {};
        const x = po.x;
        const y = Number(po.y);
        return {
          x: typeof x === 'number' ? x : str(x, 80),
          y: Number.isFinite(y) ? y : 0,
        };
      }),
    };
  }).filter((s) => s.points.length > 0);
}

/**
 * Validate + normalize an arbitrary artifact list. Returns accepted
 * artifacts (schema-complete, capped at MAX_ARTIFACTS_PER_MESSAGE) and a
 * rejected count. Never throws.
 */
export function validateArtifacts(input: unknown, source = 'emit_artifact'): {
  accepted: CortexArtifact[];
  rejected: number;
} {
  const accepted: CortexArtifact[] = [];
  let rejected = 0;
  if (!Array.isArray(input)) return { accepted, rejected: input == null ? 0 : 1 };

  for (const item of input) {
    if (accepted.length >= MAX_ARTIFACTS_PER_MESSAGE) { rejected++; continue; }
    if (!isObj(item)) { rejected++; continue; }
    const kind = item.kind;
    if (typeof kind !== 'string' || !(ARTIFACT_KINDS as readonly string[]).includes(kind)) {
      rejected++;
      continue;
    }
    const base = sanitizeBase(item, source);
    const title = str(item.title, MAX_TITLE);

    switch (kind) {
      case 'stat': {
        if (!title || typeof item.value !== 'string' && typeof item.value !== 'number') { rejected++; continue; }
        const spark = Array.isArray(item.spark)
          ? item.spark.slice(-MAX_SPARK).map((n) => Number(n)).filter(Number.isFinite)
          : undefined;
        accepted.push({
          ...base, kind: 'stat', title,
          value: String(item.value).slice(0, 200),
          ...(typeof item.unit === 'string' ? { unit: item.unit.slice(0, 40) } : {}),
          ...(typeof item.delta === 'string' ? { delta: item.delta.slice(0, 80) } : {}),
          ...(spark && spark.length ? { spark } : {}),
        });
        break;
      }
      case 'chart': {
        const series = sanitizeChartSeries(item.series);
        const ct = item.chartType;
        if (!title || !series.length || !['line', 'bar', 'area', 'pie'].includes(String(ct))) { rejected++; continue; }
        accepted.push({
          ...base, kind: 'chart', title, chartType: ct as ChartType, series,
          ...(typeof item.xLabel === 'string' ? { xLabel: item.xLabel.slice(0, 80) } : {}),
          ...(typeof item.yLabel === 'string' ? { yLabel: item.yLabel.slice(0, 80) } : {}),
        });
        break;
      }
      case 'table': {
        const cols = Array.isArray(item.columns) ? item.columns.map((c) => str(c, 80)).filter(Boolean) : [];
        const rows = Array.isArray(item.rows)
          ? item.rows.slice(0, MAX_ROWS).map((r) =>
              (Array.isArray(r) ? r : []).slice(0, cols.length || 8).map((c) =>
                typeof c === 'number' ? c : str(c, 200)))
          : [];
        if (!title || !cols.length || !rows.length) { rejected++; continue; }
        accepted.push({ ...base, kind: 'table', title, columns: cols, rows });
        break;
      }
      case 'image': {
        const url = str(item.url, 2000);
        // http(s) URLs or same-origin paths (/api/...) both render in <img>.
        if (!title || !(/^(https?:\/\/|\/)/i.test(url))) { rejected++; continue; }
        const aspect = ['16:9', '1:1', '4:3'].includes(String(item.aspect)) ? item.aspect as ArtifactAspect : undefined;
        accepted.push({
          ...base, kind: 'image', title, url,
          ...(typeof item.prompt === 'string' ? { prompt: item.prompt.slice(0, MAX_STRING) } : {}),
          ...(typeof item.provider === 'string' ? { provider: item.provider.slice(0, 60) } : {}),
          ...(aspect ? { aspect } : {}),
        });
        break;
      }
      case 'document': {
        const fmt = item.format === 'code' ? 'code' : 'markdown';
        const content = str(item.content);
        if (!title || !content) { rejected++; continue; }
        accepted.push({
          ...base, kind: 'document', title, format: fmt, content,
          ...(typeof item.lang === 'string' ? { lang: item.lang.slice(0, 40) } : {}),
          ...(typeof (item as any).docxPath === 'string' ? { docxPath: (item as any).docxPath } : {}),
          ...(typeof (item as any).pdfPath === 'string' ? { pdfPath: (item as any).pdfPath } : {}),
          ...(typeof (item as any).htmlPath === 'string' ? { htmlPath: (item as any).htmlPath } : {}),
        });
        break;
      }
      case 'map': {
        if (!title) { rejected++; continue; }
        accepted.push({
          ...base, kind: 'map', title,
          ...(typeof item.summary === 'string' ? { summary: item.summary.slice(0, MAX_STRING) } : {}),
          ...(isObj(item.view) ? { view: item.view } : {}),
        });
        break;
      }
      case 'feed': {
        const items = Array.isArray(item.items)
          ? item.items.slice(0, MAX_FEED_ITEMS).map((f) => {
              const fo = isObj(f) ? f : {};
              const tone = ['ok', 'warn', 'alert', 'info'].includes(String(fo.tone)) ? fo.tone as FeedItem['tone'] : undefined;
              return { label: str(fo.label, MAX_TITLE), value: str(fo.value, 200), ...(tone ? { tone } : {}) };
            }).filter((f) => f.label || f.value)
          : [];
        if (!title || !items.length) { rejected++; continue; }
        accepted.push({ ...base, kind: 'feed', title, items });
        break;
      }
    }
  }
  return { accepted, rejected };
}

export function artifactTitle(a: CortexArtifact): string {
  return a.title || a.kind;
}

/** Extract artifact list from a tool-execution result payload (any nesting). */
export function extractArtifactsFromResult(result: unknown, source: string): CortexArtifact[] {
  if (!isObj(result)) return [];
  const candidates = [result.artifacts, (result.result as any)?.artifacts, (result.data as any)?.artifacts];
  for (const c of candidates) {
    if (Array.isArray(c)) return validateArtifacts(c, source).accepted;
  }
  // Single artifact object (e.g. generate_image returns one)
  const single = result.artifact ?? (result.result as any)?.artifact;
  if (isObj(single)) return validateArtifacts([single], source).accepted;
  return [];
}

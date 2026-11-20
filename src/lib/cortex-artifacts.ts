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

/** One hour of forecast — drives the inline temperature/precip strip. */
export interface WxHourPoint {
  /** Short hour label, e.g. "2 PM". */
  t: string;
  /** Temperature in °F. */
  temp: number;
  /** Precipitation probability 0-100, null when NWS omits it. */
  precip: number | null;
  /** NWS shortForecast for this hour — drives per-hour icon. */
  cond?: string;
  /** True when this hour is daytime (icon sun vs moon). */
  day?: boolean;
}

/** Weather scene artifact — renders an animated condition-graded sky panel
 *  (canvas particles + animated SVG icon + hourly strip, no image assets). */
export interface WeatherArtifact extends ArtifactBase {
  kind: 'weather';
  title: string;
  city?: string;
  /** e.g. "53°F" */
  temp?: string;
  /** NWS shortForecast text — drives the scene grade. */
  condition?: string;
  wind?: string;
  /** Current period name ("Today", "Tonight", "Friday"). */
  period?: string;
  /** One-line spoken-style summary. */
  summary?: string;
  /** Relative humidity %, current conditions. */
  humidity?: number;
  /** Current precipitation probability 0-100. */
  precipNow?: number;
  /** Whether the current period is daytime. */
  isDay?: boolean;
  /** Hourly forecast points for the strip chart (next ~18h). */
  hourly?: WxHourPoint[];
  /** Coordinates for the radar overlay (WeatherArtifact only). */
  lat?: number;
  lon?: number;
  /** Multi-day forecast strip (day/night paired hi/lo). */
  days?: WxDayPoint[];
}

export interface WxDayPoint {
  /** Period label, e.g. "Today", "Friday". */
  d: string;
  hi?: number;
  lo?: number;
  cond?: string;
  /** Max precipitation probability 0-100 across day+night. */
  precip?: number | null;
}

export interface SplatArtifact extends ArtifactBase {
  kind: 'splat';
  title: string;
  /** `/splats/<file>` (.ply/.splat/.spz/.ksplat) or an https asset URL. */
  splat: string;
  caption?: string;
}

/** Composite mission-control surface — one modal containing a grid of
 *  light artifact tiles (stat/chart/feed/image/splat). This is how Cortex
 *  ships "a dashboard" instead of three separate panels. */
export interface DashboardArtifact extends ArtifactBase {
  kind: 'dashboard';
  title: string;
  /** Up to 6 tiles; heavy kinds (weather/document/map/table) are filtered out. */
  tiles: CortexArtifact[];
}

export type CortexArtifact =
  | StatArtifact
  | ChartArtifact
  | TableArtifact
  | ImageArtifact
  | DocumentArtifact
  | MapArtifact
  | FeedArtifact
  | WeatherArtifact
  | SplatArtifact
  | DashboardArtifact;

export const ARTIFACT_KINDS = ['stat', 'chart', 'table', 'image', 'document', 'map', 'feed', 'weather', 'splat', 'dashboard'] as const;

/** Tile kinds allowed inside a dashboard — light renderers only. */
export const DASHBOARD_TILE_KINDS = new Set(['stat', 'chart', 'feed', 'image', 'splat']);

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
export function validateArtifacts(input: unknown, source = 'emit_artifact', max = MAX_ARTIFACTS_PER_MESSAGE): {
  accepted: CortexArtifact[];
  rejected: number;
} {
  const accepted: CortexArtifact[] = [];
  let rejected = 0;
  if (!Array.isArray(input)) return { accepted, rejected: input == null ? 0 : 1 };

  for (const item of input) {
    if (accepted.length >= max) { rejected++; continue; }
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
      case 'weather': {
        const condition = str(item.condition, 200);
        const temp = str(item.temp, 40);
        if (!title && !condition && !temp) { rejected++; continue; }
        const hourly = Array.isArray(item.hourly)
          ? item.hourly.slice(0, 24).map((h: any) => {
              const ho = isObj(h) ? h : {};
              const ht = Number(ho.temp);
              if (!Number.isFinite(ht)) return null;
              return {
                t: str(ho.t, 24) || '',
                temp: Math.round(ht),
                precip: Number.isFinite(Number(ho.precip)) ? Math.max(0, Math.min(100, Math.round(Number(ho.precip)))) : null,
                ...(typeof ho.cond === 'string' && ho.cond ? { cond: ho.cond.slice(0, 120) } : {}),
                ...(typeof ho.day === 'boolean' ? { day: ho.day } : {}),
              } as WxHourPoint;
            }).filter(Boolean) as WxHourPoint[]
          : undefined;
        accepted.push({
          ...base, kind: 'weather', title: title || condition || 'Weather',
          ...(typeof item.city === 'string' ? { city: item.city.slice(0, 120) } : {}),
          ...(temp ? { temp } : {}),
          ...(condition ? { condition } : {}),
          ...(typeof item.wind === 'string' ? { wind: item.wind.slice(0, 80) } : {}),
          ...(typeof item.period === 'string' ? { period: item.period.slice(0, 60) } : {}),
          ...(typeof item.summary === 'string' ? { summary: item.summary.slice(0, MAX_STRING) } : {}),
          ...(Number.isFinite(Number(item.humidity)) ? { humidity: Math.max(0, Math.min(100, Math.round(Number(item.humidity)))) } : {}),
          ...(Number.isFinite(Number(item.precipNow)) ? { precipNow: Math.max(0, Math.min(100, Math.round(Number(item.precipNow)))) } : {}),
          ...(typeof item.isDay === 'boolean' ? { isDay: item.isDay } : {}),
          ...(hourly && hourly.length >= 2 ? { hourly } : {}),
          ...(Number.isFinite(Number(item.lat)) && Math.abs(Number(item.lat)) <= 90
            ? { lat: Number(item.lat) } : {}),
          ...(Number.isFinite(Number(item.lon)) && Math.abs(Number(item.lon)) <= 180
            ? { lon: Number(item.lon) } : {}),
          ...(Array.isArray(item.days)
            ? {
                days: item.days.slice(0, 8).map((dd: any) => {
                  const o = isObj(dd) ? dd : {};
                  const hi = Number(o.hi), lo = Number(o.lo);
                  return {
                    d: str(o.d, 30) || '',
                    ...(Number.isFinite(hi) ? { hi: Math.round(hi) } : {}),
                    ...(Number.isFinite(lo) ? { lo: Math.round(lo) } : {}),
                    ...(typeof o.cond === 'string' && o.cond ? { cond: o.cond.slice(0, 120) } : {}),
                    ...(Number.isFinite(Number(o.precip)) ? { precip: Math.max(0, Math.min(100, Math.round(Number(o.precip)))) } : {}),
                  } as WxDayPoint;
                }).filter((dd: WxDayPoint) => dd.d),
              }
            : {}),
        });
        break;
      }
      case 'splat': {
        const splatRaw = str(item.splat, 300);
        if (!title && !splatRaw) { rejected++; continue; }
        // Allow /splats/<file>, bare filenames (normalized into /splats/),
        // or absolute https asset URLs. Everything else is rejected.
        const safe = /^\/splats\/[a-zA-Z0-9._/-]+$/.test(splatRaw) ? splatRaw
          : /^[a-zA-Z0-9._-]+\.(?:ply|splat|spz|ksplat)$/i.test(splatRaw) ? `/splats/${splatRaw}`
          : /^https:\/\/[a-zA-Z0-9._~:/?#@!$&'()*+,;=%-]+\.(?:ply|splat|spz|ksplat)$/i.test(splatRaw) ? splatRaw
          : '';
        if (!safe) { rejected++; continue; }
        accepted.push({
          ...base, kind: 'splat', title: title || 'Gaussian Splat', splat: safe,
          ...(typeof item.caption === 'string' && item.caption ? { caption: item.caption.slice(0, MAX_STRING) } : {}),
        });
        break;
      }
      case 'dashboard': {
        if (!title) { rejected++; continue; }
        // Tiles are recursively sanitized through the same validator, then
        // filtered to light kinds — nested dashboards and heavy bodies
        // (weather/document/map/table) never reach the grid.
        const sub = validateArtifacts(item.tiles, source, 6);
        const tiles = sub.accepted.filter((t) => DASHBOARD_TILE_KINDS.has(t.kind)).slice(0, 6);
        if (!tiles.length) { rejected++; continue; }
        accepted.push({ ...base, kind: 'dashboard', title, tiles });
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

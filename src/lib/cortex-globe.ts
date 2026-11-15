/**
 * Cortex ↔ God's Eye View bridge.
 *
 * GEV runs as a sibling app (`/Users/Apple/src/gods-eye-view`, vite :5180)
 * embedded via `?embed=1`. It accepts `{type:'gev:view', id, view}` postMessages
 * and answers `{type:'gev:view-applied', id, ok}`; it announces `{type:'gev:ready'}
 * once live. Views use the share-link schema: camera {lat,lon,altitude_m,
 * heading_deg,pitch_deg}, layers[], style?, map?, annotations[].
 *
 * Voice map commands are parsed here so both the voice hook and tests share
 * one intent contract. Geocoding uses Photon (keyless, same provider the app
 * itself falls back to).
 */

// 127.0.0.1 (not localhost): GEV binds IPv4-only; `localhost` can resolve to
// ::1 first in some browsers → refused connection. Pin the literal IP.
// The base is runtime-configurable: on Oracle the page learns the GEV tunnel
// URL from /api/cortex/gev-url (quick-tunnel URLs rotate, so it can't be baked).
const DEFAULT_GEV_BASE = 'http://127.0.0.1:5180';
let gevBase = DEFAULT_GEV_BASE;
export function configureGlobeBase(url: string) {
  try {
    const u = new URL(url);
    gevBase = u.origin;
  } catch { /* keep current */ }
}
export function getGlobeEmbedUrl(): string { return `${gevBase}/?embed=1`; }
export function getGlobeOrigin(): string { return gevBase; }
/** @deprecated use getGlobeEmbedUrl() — kept for import compatibility */
export const GEV_URL = getGlobeEmbedUrl();
export const GEV_IFRAME_SELECTOR = 'iframe[data-gev-globe]';
/** Window event the page listens to: detail is 'globe' | 'core'. */
export const GLOBE_MODE_EVENT = 'cortex-globe-mode';

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
const FLY_LAYERS = ['flights', 'ais-live-vessels', 'satellites'];

// ── Map imagery styles (GEV view.map enum) ────────────────────────────────
// 'photoreal' = Google 3D Tiles (the "Google Earth" look). Tactical default is
// ESRI satellite imagery — always available, keyless, keeps the HUD aesthetic.
export type GlobeMapStyle = 'photoreal' | 'bing-aerial' | 'bing-labels' | 'esri-imagery' | 'osm';
export const GLOBE_MAP_STYLES: readonly GlobeMapStyle[] = [
  'photoreal', 'bing-aerial', 'bing-labels', 'esri-imagery', 'osm',
];
const MAP_STYLE_KEY = 'cortex-globe-map';
export const MAP_STYLE_LABELS: Record<GlobeMapStyle, string> = {
  photoreal: 'photoreal 3D',
  'bing-aerial': 'Bing aerial',
  'bing-labels': 'Bing labels',
  'esri-imagery': 'tactical satellite',
  osm: 'OpenStreetMap',
};

export function getGlobeMapStyle(): GlobeMapStyle {
  try {
    const v = localStorage.getItem(MAP_STYLE_KEY);
    if (v && (GLOBE_MAP_STYLES as readonly string[]).includes(v)) return v as GlobeMapStyle;
  } catch {}
  return 'esri-imagery';
}
export function setGlobeMapStylePref(style: GlobeMapStyle) {
  try { localStorage.setItem(MAP_STYLE_KEY, style); } catch {}
}

// ── Map command parsing ──────────────────────────────────────────────────

const CLOSE_RE =
  /\b(?:close|dismiss|exit|hide|get rid of|shut)\b[^.?!]*\b(?:map|globe|earth|world)\b|\bback to (?:the )?(?:core|home|visualizer|sanctum)\b/i;

// Bare globe requests with no place: "open the map", "bring up the globe",
// "show me the map", "I can go ahead and open up the map". Must not swallow place commands — checked after OPEN_RES.
const OPEN_BLANK_RE =
  /^(?:(?:hey|hi|hello|ok|okay)?\s*cortex[,:\s]+)?(?:please\s+)?(?:can\s+(?:you|we|cortex)\s+|could\s+(?:you|we)\s+|i\s+can\s+|we\s+can\s+|let'?s\s+|lets\s+)?(?:go\s+ahead\s+and\s+)?(?:open|show|bring up|pull up|display|launch|load|call up|put up|turn on|fire up|wake|look at)\s+(?:me\s+|up\s+)?(?:the\s+|a\s+|an\s+|my\s+)?(?:map|globe|earth|world|gev|god'?s eye(?:\s+view)?)\s*[.!?]*$/i;

const OPEN_RES: RegExp[] = [
  /\b(?:fly|zoom|travel|head)\s+(?:to|into|over|towards?)\s+(.+?)(?:\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world))?[.!?]*$/i,
  /\b(?:take me to|go to|visit|show me around)\s+(.+?)(?:\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world))?[.!?]*$/i,
  /\bwhere\s+(?:is|'s|are)\s+(.+?)(?:\s+(?:on|in)\s+(?:the\s+)?(?:map|globe|earth|world))?[.!?]*$/i,
  /\b(?:bring up|pull up|show(?: me)?|open|display|call up|put up|load|bring up)\s+(.+?)\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)[.!?]*$/i,
  /\b(?:map|globe)\s+(?:of|for|showing|centered on)\s+(.+?)[.!?]*$/i,
];

const PLACE_NOISE =
  /^(?:the|a|an|some|my|our|your|that|this|it|there|here)\s+/i;

export type MapCommand =
  | { type: 'open'; place: string; low?: boolean; layers?: string[] }
  | { type: 'open-blank' }
  | { type: 'location' }
  | { type: 'close' }
  | { type: 'style'; map: GlobeMapStyle }
  | { type: 'fx'; style: GlobeFxStyle }
  | { type: 'layers'; mode: 'set' | 'add' | 'remove'; layers: string[] }
  | { type: 'zoom'; dir: 'in' | 'out' }
  | { type: 'follow'; kind: 'aircraft' | 'satellite' | 'military_aircraft'; id: string; cockpit?: boolean }
  | { type: 'unfollow' }
  | { type: 'pin' }
  | { type: 'pin-place'; place: string }
  | { type: 'annotate'; kind: 'highlight' | 'area' | 'label'; place: string; text?: string }
  | { type: 'arrow'; from: string | null; to: string }
  | { type: 'route'; from: string | null; to: string; vias?: string[]; mode: 'car' | 'bike' | 'foot' }
  | { type: 'time'; op: 'seek'; at: number } | { type: 'time'; op: 'play' | 'pause' | 'live' }
  | { type: 'cctv'; action: 'nearest' | 'next' | 'prev' | 'focus' | 'select' | 'coverage'; query?: string; enabled?: boolean }
  | { type: 'cctv-place'; place: string }
  | { type: 'place-search'; query: string; place: string }
  | { type: 'place-details'; query: string; place?: string }
  | { type: 'back' }
  | { type: 'forward' };

// Style switches are checked BEFORE place parsing so "use photoreal mode"
// never geocodes "photoreal mode" as a place.
const STYLE_RES: [RegExp, GlobeMapStyle][] = [
  [/\b(?:photoreal|photo[\s-]?real|google\s+earth|3d\s+(?:tiles?|buildings?|view)|realistic)\b/i, 'photoreal'],
  [/\bbing\s+labels?\b/i, 'bing-labels'],
  [/\bbing\b/i, 'bing-aerial'],
  [/\b(?:tactical|satellite\s+(?:view|imagery)|esri|night\s+ops|top\s*secret)\b/i, 'esri-imagery'],
  [/\b(?:openstreetmap|osm|street\s*map)\b/i, 'osm'],
];
const STYLE_HINT_RE = /\b(?:mode|style|switch|use|imagery|view|tiles?|map)\b/i;

// ── Visual post-FX styles (GEV view.style — separate from map imagery) ────
// GEV renders these as shader/post passes over the whole scene: CRT scanlines,
// night-vision green, FLIR thermal, anime cel-shading, film noir.
export type GlobeFxStyle = 'normal' | 'retro' | 'surveillance' | 'thermal' | 'anime' | 'noir';
export const GLOBE_FX_STYLES: readonly GlobeFxStyle[] = [
  'normal', 'retro', 'surveillance', 'thermal', 'anime', 'noir',
];
export const FX_STYLE_LABELS: Record<GlobeFxStyle, string> = {
  normal: 'standard',
  retro: 'CRT retro',
  surveillance: 'night vision',
  thermal: 'thermal FLIR',
  anime: 'anime',
  noir: 'film noir',
};
// Requires a mode-ish hint word so "I love noir films" never triggers a view
// change — same guard pattern as the imagery STYLE_RES above.
const FX_HINT_RE = /\b(?:mode|view|look|style|switch|make\s+it|turn\s+on|engage|vision|filter|effect)\b/i;
const FX_RES: [RegExp, GlobeFxStyle][] = [
  [/\b(?:night[\s-]?vision|nvg|green\s+vision|surveillance\s+mode)\b/i, 'surveillance'],
  [/\b(?:thermal|flir|heat[\s-]?vision|infrared)\b/i, 'thermal'],
  [/\b(?:crt|retro|vintage|old\s+school)\b/i, 'retro'],
  [/\b(?:noir|film\s+noir|black\s+and\s+white|monochrome)\b/i, 'noir'],
  [/\b(?:anime|cel[\s-]?shaded)\b/i, 'anime'],
  [/\b(?:normal|regular|default|standard|clear\s+(?:the\s+)?(?:fx|filter|style|effect))\b/i, 'normal'],
];

// ── GEV layer commands ──────────────────────────────────────────────────
// Layer ids are GEV's REGISTERED_LAYER_IDS. Aliases cover natural speech.
const LAYER_ALIASES: Array<[RegExp, string]> = [
  [/\b(flights?|airplanes?|aircraft|planes?|aviation|jets?)\b/i, 'flights'],
  [/\b(ships?|vessels?|boats?|maritime|sea\s*traffic|naval)\b/i, 'ais-live-vessels'],
  [/\b(satellites?|sats?|orbital)\b/i, 'satellites'],
  [/\b(military|armed forces|defense|pentagon|bases?)\b/i, 'military'],
  [/\b(earthquakes?|quakes?|seismic)\b/i, 'earthquakes'],
  [/\b(wildfires?|fires?|blazes?|burn\s*scars?)\b/i, 'fire-perimeters'],
  [/\b(radar|precipitation)\b/i, 'weather-radar'],
  [/\b(cyclones?|hurricanes?|typhoons?)\b/i, 'weather-cyclones'],
  [/\b(lightning|thunderstorms?)\b/i, 'weather-lightning'],
  [/\b(satellite\s+weather|weather\s+sat)\b/i, 'weather-satellite'],
  [/\b(cctv|cct|surveillance\s+cameras?|camera\s+network)\b/i, 'cctv'],
  [/\b(traffic|road\s+conditions?)\b/i, 'traffic'],
  [/\b(transit|subway|metro|trains?|public\s+transport)\b/i, 'transit'],
  [/\b(wildlife|animal\s+sightings?)\b/i, 'wildlife-sightings'],
  [/\b(rocket\s*launch(?:es)?|launch\s+sites?)\b/i, 'rocket-launches'],
  [/\b(submarine\s+cables?|seabed\s+cables?)\b/i, 'telegeography-submarine-cables'],
  [/\b(datacenters?|data\s+centers?|server\s+farms?)\b/i, 'local-datacenters'],
  [/\b(dams?)\b/i, 'local-dams'],
  [/\b(radio|signal\s+monitoring)\b/i, 'radio'],
  [/\b(drones?|uas|airspace)\b/i, 'drone-airspace'],
  [/\b(bikeshare|bikes?|bicycles?|bike\s+share)\b/i, 'bikeshare'],
  [/\b(alpr|license\s+plate)\b/i, 'alpr-cameras'],
  [/\b(recent\s+imagery|latest\s+imagery|new\s+imagery)\b/i, 'recent-imagery'],
  [/\b(wind(?:\s+speed)?|wind\s+map)\b/i, 'wind'],
  [/\b(air\s+quality|aqi|pollution)\b/i, 'air-quality'],
  [/\b(street\s*level|street\s*view|ground\s*level)\b/i, 'street-level'],
  [/\b(military\s+awareness|awareness)\b/i, 'military-awareness'],
  // Layers that shipped without aliases in the first pass.
  [/\b(?:directions?|route\s+lines?)\b/i, 'directions'],
  [/\b(?:military\s+)?installations?\b/i, 'military-installations'],
  [/\b(?:sea\s*marks?|nautical\s+marks?)\b/i, 'sea-marks'],
  [/\b(?:ski\s+resorts?|ski\s+runs?|pistes?|ski(?:ing)?)\b/i, 'ski-pistes'],
  [/\b(?:gps\s+integrity|signal\s+integrity|gnss(?:\s+integrity)?)\b/i, 'gnss-integrity'],
  [/\b(?:ghost\s*maps?|s2\s+ghost)\b/i, 's2-ghostmaps'],
  [/\b(?:active\s+fires?|firms|hotspots?|thermal\s+hot\s*spots?)\b/i, 'local-firms'],
  [/\b(?:bhote[\s-]?koshi|koshi)\b/i, 'bhote-koshi-2026'],
  [/\b(?:map\s+)?search\s+results?|place\s+results?|osm\s+places?\b/i, 'osm-places'],
];

const LAYER_VERB_RE = /\b(show|display|enable|turn\s+on|add|overlay|layer\s+on|bring\s+up)\b/i;
const LAYER_HIDE_RE = /\b(hide|disable|turn\s+off|remove|layer\s+off|drop|get\s+rid\s+of)\b/i;
const LAYER_ONLY_RE = /^(?:only|just)\s+/i;

// Spoken names for layer ids — used to narrate changes ("adding satellite
// view") instead of the generic "Layers updated."
const LAYER_NAMES: Record<string, string> = {
  flights: 'live flights',
  'ais-live-vessels': 'ship traffic',
  satellites: 'satellites',
  military: 'military assets',
  earthquakes: 'earthquake activity',
  'fire-perimeters': 'wildfires',
  'weather-radar': 'weather radar',
  'weather-cyclones': 'cyclones',
  'weather-lightning': 'lightning strikes',
  'weather-satellite': 'satellite weather',
  cctv: 'CCTV cameras',
  traffic: 'traffic',
  transit: 'transit',
  'wildlife-sightings': 'wildlife sightings',
  'rocket-launches': 'rocket launches',
  'telegeography-submarine-cables': 'submarine cables',
  'local-datacenters': 'data centers',
  'local-dams': 'dams',
  radio: 'radio signals',
  'drone-airspace': 'drone airspace',
  bikeshare: 'bike share',
  'alpr-cameras': 'license-plate cameras',
  'recent-imagery': 'recent imagery',
  wind: 'wind',
  'air-quality': 'air quality',
  'street-level': 'street level',
  'military-awareness': 'military awareness',
  directions: 'route lines',
  'military-installations': 'military installations',
  'sea-marks': 'sea marks',
  'ski-pistes': 'ski runs',
  'gnss-integrity': 'GNSS integrity',
  's2-ghostmaps': 'ghost maps',
  'local-firms': 'active fire detections',
  'bhote-koshi-2026': 'Bhote Koshi flood',
  'bhote-koshi-locator': 'Bhote Koshi locator',
  'osm-places': 'map search results',
};
export function layerName(id: string): string {
  return LAYER_NAMES[id] ?? id.replace(/-/g, ' ');
}
/** Natural narration for a layer change, e.g. "Adding satellites." */
export function describeLayerChange(mode: 'set' | 'add' | 'remove', ids: string[]): string {
  const names = ids.map(layerName);
  const list = names.length <= 3 ? names.join(' and ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
  if (mode === 'add') return `Adding ${list} to the view.`;
  if (mode === 'remove') return `Removing ${list} from the view.`;
  return names.length <= 3
    ? `Setting the view to ${list} only.`
    : 'Setting a custom layer set.';
}

const ZOOM_RE = /\bzoom\s+(in|closer|out|further|farther|way\s+out|all\s+the\s+way\s+out)\b/i;
const UNFOLLOW_RE = /\b(?:stop|quit|end|cancel|drop|lose)\s+(?:following|tracking|the\s+follow|tracking\s+it)|\bunfollow\b/i;
const PIN_RE = /\b(?:drop|place|mark|plant|flag)\s+(?:a\s+|the\s+)?(?:pin|marker|flag|annotation)|\bmark\s+(?:this|here|the\s+spot|this\s+spot)\b|\bdrop\s+a\s+pin\b/i;
// Pin at a NAMED place: "drop a pin on Tokyo", "pin Duluth Georgia".
const PIN_PLACE_RES: RegExp[] = [
  /\b(?:drop|place|plant|mark|stick|flag)\s+(?:a\s+|the\s+)?(?:pin|marker|flag)\s+(?:on|at|in|near)\s+(.{2,80}?)[.!?]*$/i,
  /\bpin\s+(?:on\s+|at\s+|in\s+)?(.{2,80}?)[.!?]*$/i,
];
// GEV resolves `target` names itself — highlight/area get real outlines
// (a highlighted street becomes an area ask inside GEV's resolver).
const HIGHLIGHT_RE = /\bhighlight\s+(?:the\s+|that\s+|this\s+)?(.{2,80}?)[.!?]*$/i;
const AREA_RE = /\b(?:draw\s+)?(?:a\s+)?circle\s+(?:around\s+|of\s+)?(.{2,80}?)[.!?]*$/i;
const LABEL_RE = /\blabel\s+(?:the\s+|that\s+|this\s+)?(.+?)(?:\s+as\s+(.+?))?[.!?]*$/i;
const ARROW_RES: RegExp[] = [
  /\barrow\s+from\s+(.+?)\s+to\s+(.+?)[.!?]*$/i,
  /\bdraw\s+an?\s+arrow\s+from\s+(.+?)\s+to\s+(.+?)[.!?]*$/i,
];
// "arrow to Miami" / "draw an arrow to Miami" — origin resolves like routes.
const ARROW_TO_RES: RegExp[] = [
  /\barrow\s+to\s+(.+?)[.!?]*$/i,
  /\bdraw\s+an?\s+arrow\s+to\s+(.+?)[.!?]*$/i,
];
const FOLLOW_RE = /\b(?:follow|track|lock\s+onto|chase)\s+(?:the\s+|that\s+|a\s+)?(military\s+(?:aircraft|jet|plane|airliner)|satellite|sat|flight|plane|aircraft|jet|airliner|drone|vessel|ship|boat|uav)\s+([A-Za-z0-9][A-Za-z0-9-]{1,14})\b/i;
const COCKPIT_RE = /\bcockpit\b/i;

// ── World-clock (time scrub) + CCTV camera control ────────────────────────
const TIME_CMD_RE = /\b(?:world\s+)?(?:time|clock)\b|\btime\s+travel\b/i;
const CCTV_NEAREST_RE =
  /\b(?:nearest|closest|nearby)\b[^.?!]{0,40}\b(?:camera|cam|cctv|cct|webcam)\b|\b(?:camera|cam|cctv|cct|webcam)\b[^.?!]{0,40}\b(?:nearest|closest|nearby)\b/i;
const CCTV_CYCLE_RES: [RegExp, 'next' | 'prev'][] = [
  [/\b(?:next|forward)\s+(?:camera|cam|cctv|cct|webcam)\b|\b(?:camera|cam|cctv|cct|webcam)\s+next\b/i, 'next'],
  [/\b(?:previous|prev|last)\s+(?:camera|cam|cctv|cct|webcam)\b|\b(?:camera|cam|cctv|cct|webcam)\s+(?:previous|prev|last)\b/i, 'prev'],
];
const CCTV_FOCUS_RE =
  /\b(?:focus|center\s+on|centre\s+on|zero\s+in\s+on|watch|pull\s+up)\s+(?:the\s+|that\s+|this\s+|a\s+|an\s+)?(?:active\s+|current\s+|selected\s+)?(?:camera|cam|cctv|cct|webcam)(?:\s+(?:feed|view|stream))?\b/i;
const CCTV_SELECT_RE = /\b(?:camera|cam|cctv|cct)\s+(?:named|called)\s+(.{2,60}?)[.!?]*$/i;
const CCTV_COVERAGE_RE = /\b(?:camera\s+|cctv\s+|cct\s+)?coverage\b/i;
// "camera near duluth", "cctv in london", "open the cam around tokyo",
// "near duluth georgia camera" — place-qualified camera lock.
const CCTV_PLACE_RES: RegExp[] = [
  /\b(?:camera|cam|cctv|cct|webcam|cctv\s+camera)s?\b[^.?!]{0,50}?\b(?:near|around|in|at|by|close\s+to|next\s+to)\s+(.{2,80})[.!?]*$/i,
  /\b(?:near|around|in|at|by|close\s+to)\s+(.{2,60}?)\s+(?:camera|cam|cctv|cct|webcam)s?\b[.!?]*$/i,
];
const CCTV_PLACE_NOISE = /^(?:the|a|an|my|some|any|live|available|feed|stream|view|on\s+the\s+(?:globe|map|earth|world)|please|there)\s+/i;
const CCTV_PLACE_BAD = /^(?:me|here|this|that|it|now|please|available|feed|stream|view|one|offline|online)$/i;
// Spoken trailing politeness that isn't part of the place name.
const CCTV_PLACE_TRAIL = /\s+(?:please|thanks|thank\s+you|for\s+me|if\s+you\s+can|if\s+possible)$/i;

/** Everyday non-geographic words. A place consisting ENTILLY of these is
 *  almost certainly conversation ("go to sleep", "where is the bathroom"),
 *  not a fly-to — refuse so the LLM handles it. Mixed phrases still pass:
 *  "central park" survives because 'central' isn't in the set. */
const NON_GEO_WORDS = new Set([
  // places-as-activities / rooms
  'sleep', 'bathroom', 'restroom', 'meeting', 'bed', 'office', 'work', 'home',
  'store', 'shop', 'gym', 'class', 'dinner', 'lunch', 'party', 'date',
  'interview', 'appointment', 'shift', 'doctor', 'dentist', 'movie', 'movies',
  'show', 'shows', 'game', 'games', 'practice', 'rehearsal', 'church', 'park',
  'school', 'hospital', 'restaurant', 'bar', 'club', 'court', 'jail', 'prison',
  'hotel', 'airport', 'station', 'stop', 'gate', 'floor', 'room', 'kitchen',
  'garage', 'yard',
  // digital objects — "where is the file", "open the document"
  'file', 'files', 'folder', 'folders', 'document', 'documents', 'doc',
  'code', 'error', 'errors', 'bug', 'bugs', 'issue', 'issues', 'ticket',
  'tickets', 'email', 'emails', 'mail', 'message', 'messages', 'text',
  'song', 'songs', 'book', 'books', 'photo', 'photos', 'picture', 'pictures',
  'video', 'videos', 'app', 'apps', 'application', 'applications', 'program',
  'software', 'password', 'passwords', 'account', 'accounts', 'profile',
  'profiles', 'post', 'posts', 'article', 'articles', 'blog', 'blogs',
  'website', 'websites', 'page', 'pages', 'link', 'links', 'url', 'urls',
  'screenshot', 'screenshots', 'recording', 'recordings', 'transcript',
  'transcripts', 'wallpaper', 'wallpapers', 'spreadsheet', 'spreadsheets',
  'note', 'notes', 'reminder', 'reminders', 'alarm', 'alarms', 'timer',
  'timers', 'calendar', 'calendars', 'schedule', 'schedules', 'agenda',
  'agendas', 'plan', 'plans', 'list', 'lists', 'todo', 'todos', 'task',
  'tasks', 'project', 'projects', 'report', 'reports', 'presentation',
  'presentations', 'deadline', 'deadlines', 'blame', 'intern', 'interns',
  // artifact nouns that must never geocode
  'chart', 'charts', 'graph', 'graphs', 'table', 'tables', 'image', 'images',
  'artifact', 'artifacts', 'panel', 'panels', 'widget', 'widgets', 'card',
  'cards', 'stat', 'stats', 'metric', 'metrics', 'feed', 'feeds', 'stream',
  'streams', 'camera', 'cameras', 'cam', 'cams', 'cctv', 'webcam', 'webcams',
  // reporting verbs — "pin a panel that says X" is artifact intent, not geo
  'say', 'says', 'said', 'tell', 'tells', 'told', 'read', 'reads', 'reading',
  'display', 'displays', 'displayed', 'contain', 'contains', 'contained',
  'include', 'includes', 'included', 'mean', 'means', 'meant', 'called',
  'named', 'titled', 'description', 'descriptions', 'summary', 'summaries',
  'content', 'contents', 'body', 'detail', 'details', 'showing',
  // content nouns — "TEST VALUE 42", "my score", "the total"
  'test', 'tests', 'testing', 'value', 'values', 'result', 'results',
  'output', 'outputs', 'status', 'data', 'number', 'numbers', 'amount',
  'amounts', 'score', 'scores', 'count', 'counts', 'total', 'totals',
  'name', 'names', 'title', 'titles', 'label', 'labels', 'caption',
  'captions', 'heading', 'headings', 'subtitle', 'subtitles',
  // time nouns — "my week", "today's numbers"
  'week', 'weeks', 'day', 'days', 'month', 'months', 'year', 'years',
  'hour', 'hours', 'minute', 'minutes', 'second', 'seconds', 'today',
  'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'tonight',
  // UI chrome nouns
  'dashboard', 'monitor', 'screen', 'screens', 'display', 'displays',
  'desktop', 'browser', 'window', 'windows', 'dialog', 'popup',
  'notification', 'notifications', 'banner', 'sidebar', 'menu', 'menus',
  'toolbar', 'theme', 'themes', 'icon', 'icons', 'logo', 'avatar',
  'badge', 'chip', 'chips', 'form', 'forms', 'input', 'inputs', 'button',
  'buttons', 'field', 'fields', 'slider', 'toggle', 'gauge', 'meter',
  'meters', 'indicator', 'indicators', 'signal', 'signals', 'wave',
  'waves', 'pulse',
  // demo/verification filler — "VISUAL CHECK 99", "demo panel"
  'visual', 'check', 'checks', 'demo', 'demos', 'sample', 'samples',
  'example', 'examples', 'verify', 'verified', 'verification',
  // document & career artifacts — never geographic places
  'resume', 'resumes', 'cv', 'cvs', 'bio', 'bios', 'proposal', 'proposals',
  'memo', 'memos', 'note', 'notes', 'file', 'files', 'spreadsheet', 'spreadsheets',
  'sheet', 'sheets', 'contract', 'contracts', 'report', 'reports', 'draft', 'drafts',
  'letter', 'letters', 'document', 'documents',
]);
const PLACE_FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 'for', 'and', 'or', 'my',
  'your', 'our', 'near', 'around', 'by', 'from', 'with', 'over', 'up',
  // demonstratives / pronouns / question words — ignored when deciding
  // whether a captured place is really geographic
  'that', 'this', 'these', 'those', 'there', 'here', 'it', 'its', 'they',
  'them', 'we', 'us', 'you', 'he', 'she', 'i', 'me', 'him', 'her', 'who',
  'whom', 'whose', 'which', 'what', 'when', 'where', 'why', 'how', 'all',
  'any', 'some', 'every', 'each', 'both', 'few', 'more', 'most', 'other',
  'another', 'such', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'now', 'also', 'really', 'actually', 'thing', 'things', 'stuff', 'way',
  'ways', 'lot', 'lots', 'kind', 'sort', 'type', 'types', 'something',
  'anything', 'everything', 'nothing', 'someone', 'anyone', 'everyone',
]);
// Surface-artifact nouns — "pin a stat PANEL that says X" or "pin that resume here" is surface intent
// even when other words in the phrase aren't in NON_GEO_WORDS ("visual",
// "check"). A real place name won't contain these as whole words.
const ARTIFACT_NOUN_RE = /\b(?:panels?|cards?|charts?|graphs?|stats?|widgets?|artifacts?|dashboards?|tables?|documents?|docs?|feeds?|metrics?|resumes?|cvs?|bios?|proposals?|memos?|notes?|spreadsheets?|sheets?|files?|drafts?)\b/i;

export function isNonGeoPlace(place: string): boolean {
  const words = place.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/)
    .filter((w) => /[a-z]/.test(w) && !PLACE_FUNCTION_WORDS.has(w));
  if (!words.length) return true; // "50%", "the", "!!!" — nothing geographic
  return words.every((w) => NON_GEO_WORDS.has(w));
}

/** Natural-language world time → epoch ms, 'live', or null (not a time cmd). */
export function parseWorldTimeMs(text: string): number | 'live' | null {
  const s = text.toLowerCase().trim();
  if (s.length > 80) return null;
  if (/\b(?:live|real\s*time|back\s+to\s+live|current\s+time|now)\b/.test(s) && s.length < 45) return 'live';
  const now = new Date();
  const at = (h: number, m = 0, dayOffset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const yesterday = /\byesterday\b/.test(s);
  const dayOffset = yesterday ? -1 : 0;
  if (/\bnoon\b/.test(s)) return at(12, 0, dayOffset);
  if (/\bmidnight\b/.test(s)) return at(0, 0, dayOffset);
  if (/\blast\s+night\b/.test(s)) return at(22, 0, -1);
  if (/\btonight\b/.test(s)) return at(20);
  if (/\bevening\b|\bdusk\b/.test(s)) return at(18);
  if (/\bmorning\b|\bdawn\b/.test(s)) return at(9);
  if (/\byesterday\b/.test(s)) return now.getTime() - 86_400_000;
  if (/\btomorrow\b/.test(s)) return now.getTime() + 86_400_000;
  const ago = s.match(/(\d+|a|an)\s+(minute|hour|day|week)s?\s+ago/);
  if (ago) {
    const n = ago[1] === 'a' || ago[1] === 'an' ? 1 : parseInt(ago[1], 10);
    const mult = { minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000 }[ago[2] as 'minute' | 'hour' | 'day' | 'week'];
    return now.getTime() - n * mult;
  }
  const hm = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ||
    (/\bat\b/.test(s) ? s.match(/(\d{1,2}):(\d{2})\b/) : null);
  if (hm) {
    let h = parseInt(hm[1], 10);
    const m = parseInt(hm[2] || '0', 10);
    const ap = hm[3];
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m <= 59) return at(h, m, dayOffset);
  }
  return null;
}

// "where am I", "take me home", "my location" — fly to the user's GPS fix.
const LOCATION_RE =
  /\b(?:where\s+am\s+i|my\s+(?:current\s+)?location|locate\s+me|find\s+me|take\s+me\s+home|go\s+home|head\s+home)\b/i;
// Compound zoom+place: "zoom in to duluth georgia", "zoom in on my location".
const ZOOM_PLACE_RE =
  /\bzoom\s+(in|closer|out|back|further|farther)?\s*(?:to|into|on|towards?|over|at|near)\s+(.{2,80}?)\s*[.!?]*$/i;
const LOCATION_PLACE_RE = /^(?:my\s+location|my\s+current\s+location|home|where\s+am\s+i|me|here)$/i;
// Directions: "directions to X", "route from A to B", "navigate me to X",
// "how do I get to X". Mode words pick car/bike/foot (GEV /api/route profiles).
const ROUTE_RE =
  /\b(?:directions?|route|navigate(?:\s+me)?|how\s+(?:do|can|would)\s+i\s+(?:get|go|drive|walk|cycle|bike)(?:\s+there)?|(?:walk|hike|drive|bike|cycle)\s+from)\b/i;
const ROUTE_FROM_TO_RE = /\bfrom\s+(.+?)\s+to\s+(.+?)\s*[.!?]*$/i;
const ROUTE_TO_RE = /\bto\s+(.+?)\s*[.!?]*$/i;
const ROUTE_MODE_RES: [RegExp, 'car' | 'bike' | 'foot'][] = [
  [/\b(?:drive|driving|car|automobile|vehicle)\b/i, 'car'],
  [/\b(?:bike|bicycle|cycle|cycling|ebike)\b/i, 'bike'],
  [/\b(?:walk|walking|foot|hike|hiking|pedestrian)\b/i, 'foot'],
];

/** Last successfully flown destination — default 'from' for directions. */
let lastDestination: { name: string; lat: number; lon: number } | null = null;
export function setLastDestination(g: { name: string; lat: number; lon: number }) {
  lastDestination = g;
}
export function getLastDestination() { return lastDestination; }

/** Camera position that puts `lat/lon` at screen center for an oblique
 *  view (heading 0 = north, pitch<0 = looking down-forward). The camera's
 *  ground subpoint must sit ~alt*tan(|pitch|) SOUTH of the target or the
 *  target drifts below frame — the "have to scroll to see it" bug. */
function cameraForTarget(
  lat: number, lon: number, altitudeM: number, pitchDeg: number,
): { lat: number; lon: number } {
  // Cesium pitch: 0 = horizon, -90 = nadir. Angle OFF VERTICAL is
  // 90-|pitch|, so ground look-ahead = alt * tan(90-|pitch|).
  // (pitch -62 → 28° off vertical → ~0.53×alt, NOT tan(62°)=1.88×alt —
  //  the first fix overshot ~3.5× south, this is the corrected value.)
  const offVerticalDeg = 90 - Math.abs(pitchDeg);
  const lookAheadM = altitudeM * Math.tan((offVerticalDeg * Math.PI) / 180);
  return { lat: lat - lookAheadM / 111_320, lon };
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Frame a route through 2+ points — bbox-midpoint camera sized so the whole
 *  path fills the view. Altitude ≈ path length (the old degree-span formula
 *  overshot transcontinental routes to ~3000 km where the line vanished). */
export function buildRouteView(
  points: Array<{ lat: number; lon: number; label?: string }>,
  mode: 'car' | 'bike' | 'foot',
  map: GlobeMapStyle = getGlobeMapStyle(),
) {
  const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (pts.length < 2) throw new TypeError('A route view needs at least two points');
  let pathKm = 0;
  for (let i = 1; i < pts.length; i++) pathKm += haversineKm(pts[i - 1], pts[i]);
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
  // ~0.9× path distance puts endpoints near the frame edges at pitch -55;
  // floor keeps short hops readable, cap keeps ocean crossings sane.
  const altitude = Math.min(5_000_000, Math.max(80_000, Math.round(pathKm * 1000 * 0.9)));
  const pitch = -55;
  const cam = cameraForTarget(lat, lon, altitude, pitch);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return {
    camera: { lat: cam.lat, lon: cam.lon, altitude_m: altitude, heading_deg: 0, pitch_deg: pitch },
    layers: [...FLY_LAYERS],
    map,
    annotations: [{
      type: 'route',
      points: pts.map((p) => ({
        latitude: p.lat,
        longitude: p.lon,
        ...(p.label ? { name: p.label } : {}),
      })),
      mode,
      color: 'cyan',
      label: `${first.label || 'Start'} → ${last.label || 'Destination'}`,
    }],
  };
}

/** Strip layer aliases + command verbs to find a trailing place in compounds
 *  like "show me the street view and duluth georgia" → "duluth georgia". */
function compoundPlace(t: string): string | null {
  let rest = ` ${t} `;
  for (const [re] of LAYER_ALIASES) rest = rest.replace(new RegExp(re.source, 'gi'), ' ');
  const FILLER =
    /\b(?:can|could|would|will|you|please|show|me|the|a|an|and|in|at|on|for|to|of|with|up|my|view|layer|layers|overlay|display|enable|turn|add|bring|pull|open|find|live|near|around|watch|search|locate|check|what|is|are|there|active|resorts?|integrity|detections?|hotspots?|marks?|runs?|pistes?|cameras?|cam|cctv|cct|feeds?|streams?)\b/gi;
  for (let i = 0; i < 4; i++) {
    const next = rest.replace(FILLER, ' ').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (next === rest.trim()) break;
    rest = next;
  }
  const place = rest.trim().replace(/[.!?]+$/, '').trim();
  if (place.length < 3 || place.length > 80) return null;
  if (/^(?:map|globe|earth|world|it|this|that|now|please)$/i.test(place)) return null;
  return place;
}

// Place search: "burger places in Duluth", "find coffee shops near me",
// "popular restaurants in Austin", "top rated tacos around Denver".
// group 1 = free-text query (may be empty → the category noun is the query),
// group 2 = anchor place.
const PLACE_SEARCH_RE =
  /^(?:(?:can|could|would|will)\s+you\s+|please\s+)?(?:(?:find|show|search(?:\s+for)?|look\s+for|get|list|discover|locate|what\s+are|where\s+are|i\s+want|i'?d\s+like|need)\s+)?(?:me\s+)?(?:(?:the|some|any|good|best|top|popular|cheap|local|nearest|nearby|famous|highest[\s-]rated|well[\s-]rated|new|open|currently)\s+)*(.*?)\s*(places?|restaurants?|eateries|food|diners?|grills?|bistros?|cafes?|coffee(?:\s+shops?)?|bars?|pubs?|breweries|brewpubs|pizzerias?|sushi|tacos?|bbq|burgers?|steakhouses?|wineries|distilleries|hotels?|motels?|lodging|resorts?|gyms?|fitness|salons?|barbershops?|spas?|pharmacies|drugstores?|grocery|supermarkets?|malls?|stores?|shops?|bookstores?|bakeries|bowling|theaters?|museums?|parks?|campgrounds?|gas\s+stations?|mechanics?|dentists?|doctors?|veterinarians?|vets?|pet\s+stores?|florists?|hardware|furniture|jewelers?|banks?|libraries|churches)\s+(?:in|near|around|by|close\s+to|within\s+\d+\s*(?:miles?|km|blocks?)\s+of)\s+(.{2,80}?)[.!?]*$/i;

// Place details: "reviews for LR Burger", "is the diner in duluth any good",
// "what do people say about that taco place". Keyword presence + subject
// extraction; a trailing "in/near <place>" splits anchor from subject.
const PLACE_REVIEW_HINT_RE =
  /\b(?:reviews?|ratings?|rated|recommend(?:ed|ations?)?|any\s+good|worth\s+(?:it|a\s+visit|visiting|eating|trying)|how\s+(?:is|are)\s+\S+\s+(?:rated|reviewed)|what\s+do\s+people\s+say)\b/i;
const PLACE_PIN_GUARD_RE =
  /^(?:(?:can|could|would|will)\s+you\s+|please\s+)?(?:drop|pin|mark|flag|stick|plant)\b|\b(?:drop|put|place|stick)\s+(?:a\s+|the\s+)?pin\b/i;

function splitPlaceAnchor(rest: string): { query: string; place?: string } | null {
  const cleaned = rest.replace(PLACE_NOISE, '').replace(/[.!?]+$/, '').trim();
  if (cleaned.length < 2 || cleaned.length > 140) return null;
  // Split at the LAST geo preposition so "burger joints in duluth" keeps
  // "burger joints" as the query and "duluth" as the anchor.
  const m = cleaned.match(/^(.*\S)\s+(?:in|near|around|by|close\s+to)\s+(.{2,60})$/i);
  if (m?.[1] && m?.[2]) {
    const query = m[1].trim();
    const place = m[2].trim();
    if (query.length >= 2 && place.length >= 2) return { query, place };
  }
  if (isNonGeoPlace(cleaned)) return null;
  return { query: cleaned };
}

function layerIdsIn(text: string): string[] {
  const ids = new Set<string>();
  for (const [re, id] of LAYER_ALIASES) if (re.test(text)) ids.add(id);
  return [...ids];
}

/** Returns a map command for utterances like "bring up Tokyo on the map". */
export function parseMapCommand(text: string): MapCommand | null {
  const t = text.trim().replace(/^(?:(?:hey|hi|hello|ok|okay)?\s*cortex[,:\s]+)/i, '').trim();
  if (!t) return null;
  // Surface / panel / artifact / resume pinning MUST NEVER be treated as a globe command
  if (/\b(?:pin|dock|keep|put)\b/i.test(t) && (ARTIFACT_NOUN_RE.test(t) || /\b(?:that|this|it|here|surface|space)\b/i.test(t))) {
    if (!/\b(?:map|globe|earth|world|route|flight|satellite|cctv)\b/i.test(t)) {
      return null;
    }
  }
  if (CLOSE_RE.test(t)) return { type: 'close' };
  if (/\b(?:go back|back to (?:the )?(?:map|globe|previous|last)(?: view| screen)?|return to (?:the )?(?:map|globe|previous|last)(?: view| screen)?|undo (?:that|the )?(?:fly|flight|move|zoom)|take me back)\b/i.test(t)) {
    return { type: 'back' };
  }
  if (/\b(?:go\s+forward|move\s+forward|forward\s+(?:view|fly|again)|redo)\b/i.test(t)) {
    return { type: 'forward' };
  }
  // Style commands only trigger on short imperatives — a long sentence that
  // merely mentions "satellite" (e.g. "show me satellite photos of Paris")
  // should still geocode.
  if (t.length <= 60 && STYLE_HINT_RE.test(t)) {
    for (const [re, map] of STYLE_RES) {
      if (re.test(t)) return { type: 'style', map };
    }
  }
  // Visual post-FX (CRT / night vision / thermal / noir) — the view.style
  // field, distinct from map imagery. Same short-utterance + hint guard.
  if (t.length <= 60 && FX_HINT_RE.test(t)) {
    for (const [re, style] of FX_RES) {
      if (re.test(t)) return { type: 'fx', style };
    }
  }
  // World-clock commands: "set the time to noon", "time travel to yesterday",
  // "pause time", "back to live". Only fires when a time target parses —
  // "what time is it" falls through to the LLM.
  if (TIME_CMD_RE.test(t) && t.length <= 80) {
    const low = t.toLowerCase();
    if (/\b(?:pause|hold)\b[^.?!]*\b(?:time|clock)\b|\b(?:time|clock)\b[^.?!]*\b(?:pause|hold)\b/i.test(low)) {
      return { type: 'time', op: 'pause' };
    }
    if (/\b(?:play|resume|unpause|start|roll)\b[^.?!]*\b(?:time|clock)\b|\b(?:time|clock)\b[^.?!]*\b(?:play|resume|roll)\b/i.test(low)) {
      return { type: 'time', op: 'play' };
    }
    const target = parseWorldTimeMs(t);
    if (target === 'live') return { type: 'time', op: 'live' };
    if (typeof target === 'number') return { type: 'time', op: 'seek', at: target };
  }
  // Compound zoom+place BEFORE bare zoom: "zoom in to duluth georgia".
  {
    const zp = t.match(ZOOM_PLACE_RE);
    if (zp?.[2]) {
      if (LOCATION_PLACE_RE.test(zp[2].trim())) return { type: 'location' };
      const place = zp[2].replace(PLACE_NOISE, '').trim();
      if (place.length >= 2 && place.length <= 80 && !isNonGeoPlace(place)) {
        const dir = (zp[1] || 'in').toLowerCase();
        return { type: 'open', place, low: dir === 'in' || dir === 'closer' };
      }
    }
  }
  if (LOCATION_RE.test(t)) return { type: 'location' };
  // Place-qualified camera: "camera near duluth georgia" → fly + nearest cam.
  // Runs BEFORE the layer block so "cctv ... near X" isn't eaten as a bare
  // layer toggle, but AFTER style/fx/time/zoom-place so those still win.
  // Explicit camera commands win over place parsing: "focus the camera in the
  // kitchen" is a focus, not a geocode of 'kitchen'. 'nearest' is NOT excluded
  // so "nearest camera near duluth" still resolves the place qualifier.
  const cctvExplicit = CCTV_SELECT_RE.test(t) || CCTV_COVERAGE_RE.test(t) || CCTV_FOCUS_RE.test(t);
  if (!cctvExplicit) {
    for (const re of CCTV_PLACE_RES) {
      const m = t.match(re);
      if (m?.[1]) {
        const place = m[1]
          .replace(CCTV_PLACE_NOISE, '')
          .replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:globe|map|earth|world|screen|display)[\s.!?]*$/i, '')
          .replace(CCTV_PLACE_TRAIL, '')
          .replace(/[.!?]+$/, '').trim();
        if (place.length >= 2 && place.length <= 80 && !CCTV_PLACE_BAD.test(place)) {
          return { type: 'cctv-place', place };
        }
      }
    }
  }
  // Place intelligence: reviews/details and category search ("burger places
  // in Duluth"). AFTER cctv-place so camera commands keep priority, BEFORE
  // layer toggles and pin/place parsing so category nouns aren't geocoded.
  // Pin-verbed utterances are excluded — "pin a restaurant in downtown" is
  // annotation intent, not a search.
  if (!PLACE_PIN_GUARD_RE.test(t)) {
    if (PLACE_REVIEW_HINT_RE.test(t)) {
      // Strip leading question/command scaffolding, keep the subject.
      const subject = t
        .replace(/^(?:hey|hi|hello|ok|okay)?\s*cortex[,:\s]*/i, '')
        .replace(/^(?:can|could|would|will)\s+you\s+|please\s+|i\s+want\s+to\s+know\s+|tell\s+me\s+/i, '')
        .replace(/^(?:what\s+(?:are|is|do|does)|how\s+(?:is|are)|where\s+are)\b[^?]*?\b(?:for|on|of|about)\s+/i, '')
        .replace(/\b(?:reviews?|ratings?|rated|recommend(?:ed|ations?)?|any\s+good|worth\s+(?:it|a\s+visit|visiting|eating|trying))\b/gi, ' ')
        .replace(/\s+/g, ' ').trim();
      const parsed = splitPlaceAnchor(subject);
      if (parsed) return { type: 'place-details', query: parsed.query, place: parsed.place };
    }
    const sm = t.match(PLACE_SEARCH_RE);
    if (sm) {
      const category = (sm[2] || '').toLowerCase();
      const query = (sm[1] || '').trim() || category;
      const place = (sm[3] || '').replace(/[.!?]+$/, '').trim();
      if (query.length >= 2 && place.length >= 2 && place.length <= 80) {
        return { type: 'place-search', query, place };
      }
    }
  }
  // Layer toggles — only when a known layer alias AND a layer verb appear.
  // If a place survives verb-stripping too, it's a compound: fly there AND
  // set the layer ("show me street view and duluth georgia").
  {
    const ids = layerIdsIn(t);
    if (ids.length) {
      const cleaned = t.replace(LAYER_ONLY_RE, '');
      const place = compoundPlace(t);
      const isOnly = /^(?:only|just)\b/i.test(t) || /\bonly\b/i.test(t);
      if (!isOnly && place && !isNonGeoPlace(place) && LAYER_VERB_RE.test(t) && !LAYER_HIDE_RE.test(t)) {
        return { type: 'open', place, layers: ids };
      }
      if (isOnly) return { type: 'layers', mode: 'set', layers: ids };
      if (LAYER_HIDE_RE.test(cleaned) && !LAYER_VERB_RE.test(cleaned.replace(LAYER_HIDE_RE, ''))) {
        return { type: 'layers', mode: 'remove', layers: ids };
      }
      if (LAYER_HIDE_RE.test(t)) return { type: 'layers', mode: 'remove', layers: ids };
      if (LAYER_VERB_RE.test(t)) return { type: 'layers', mode: 'add', layers: ids };
    }
  }
  // CCTV camera control — AFTER the layer block so "show me cctv cameras"
  // still toggles the layer; these need an explicit control verb.
  if (CCTV_NEAREST_RE.test(t)) return { type: 'cctv', action: 'nearest' };
  for (const [re, action] of CCTV_CYCLE_RES) {
    if (re.test(t)) return { type: 'cctv', action };
  }
  {
    const cm = t.match(CCTV_SELECT_RE);
    if (cm?.[1]) {
      const query = cm[1].replace(/[.!?]+$/, '').trim();
      if (query.length >= 2) return { type: 'cctv', action: 'select', query };
    }
  }
  if (CCTV_COVERAGE_RE.test(t) && /\b(?:show|display|enable|turn\s+on|hide|disable|turn\s+off)\b/i.test(t)) {
    return { type: 'cctv', action: 'coverage', enabled: !/\b(?:hide|disable|turn\s+off)\b/i.test(t) };
  }
  if (CCTV_FOCUS_RE.test(t)) return { type: 'cctv', action: 'focus' };
  {
    const zm = t.match(ZOOM_RE);
    if (zm) {
      const w = zm[1].toLowerCase();
      return { type: 'zoom', dir: (w === 'in' || w === 'closer') ? 'in' : 'out' };
    }
  }
  if (UNFOLLOW_RE.test(t)) return { type: 'unfollow' };
  // Pin/place annotations BEFORE bare PIN_RE — "drop a pin on Tokyo" contains
  // "drop a pin" and would otherwise pin the camera target instead.
  for (const re of PIN_PLACE_RES) {
    const m = t.match(re);
    if (m?.[1]) {
      const place = m[1].replace(PLACE_NOISE, '').replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)$/i, '').replace(/[.!?]+$/, '').trim();
      if (place.length >= 2 && place.length <= 80 && !isNonGeoPlace(place) && !ARTIFACT_NOUN_RE.test(place)) return { type: 'pin-place', place };
    }
  }
  if (PIN_RE.test(t)) return { type: 'pin' };
  {
    const fm = t.match(FOLLOW_RE);
    if (fm) {
      const w = fm[1].toLowerCase();
      const kind = /sat/.test(w) ? 'satellite' : /military/.test(w) ? 'military_aircraft' : 'aircraft';
      return { type: 'follow', kind, id: fm[2].toUpperCase(), cockpit: COCKPIT_RE.test(t) || undefined };
    }
  }
  for (const re of ARROW_RES) {
    const m = t.match(re);
    if (m?.[1] && m?.[2]) {
      const from = m[1].replace(PLACE_NOISE, '').trim();
      const to = m[2].replace(PLACE_NOISE, '').replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)$/i, '').replace(/[.!?]+$/, '').trim();
      if (from.length >= 2 && to.length >= 2 && to.length <= 80 && from.length <= 80) {
        return { type: 'arrow', from, to };
      }
    }
  }
  for (const re of ARROW_TO_RES) {
    const m = t.match(re);
    if (m?.[1]) {
      const to = m[1].replace(PLACE_NOISE, '').replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)$/i, '').replace(/[.!?]+$/, '').trim();
      if (to.length >= 2 && to.length <= 80 && !isNonGeoPlace(to)) return { type: 'arrow', from: null, to };
    }
  }
  {
    const hm = t.match(HIGHLIGHT_RE);
    if (hm?.[1]) {
      const place = hm[1].replace(PLACE_NOISE, '').replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)$/i, '').replace(/[.!?]+$/, '').trim();
      if (place.length >= 2 && place.length <= 80 && !isNonGeoPlace(place)) return { type: 'annotate', kind: 'highlight', place };
    }
    const am = t.match(AREA_RE);
    if (am?.[1]) {
      const place = am[1].replace(PLACE_NOISE, '').replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)$/i, '').replace(/[.!?]+$/, '').trim();
      if (place.length >= 2 && place.length <= 80 && !isNonGeoPlace(place)) return { type: 'annotate', kind: 'area', place };
    }
    const lm = t.match(LABEL_RE);
    if (lm?.[1]) {
      const place = lm[1].replace(PLACE_NOISE, '').replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)$/i, '').replace(/[.!?]+$/, '').trim();
      const labelText = lm[2]?.replace(PLACE_NOISE, '').replace(/[.!?]+$/, '').trim() || undefined;
      if (place.length >= 2 && place.length <= 80 && !isNonGeoPlace(place)) return { type: 'annotate', kind: 'label', place, text: labelText };
    }
  }
  if (ROUTE_RE.test(t)) {
    let mode: 'car' | 'bike' | 'foot' = 'car';
    for (const [re, m] of ROUTE_MODE_RES) if (re.test(t)) { mode = m; break; }
    // "via"/"through"/"and then" split waypoint chains: "from A through B
    // to C via D" → origin A, vias [B, D], destination C.
    const VIA_SPLIT_RE = /\b(?:via|through|and\s+then|stopping\s+at|stop\s+at)\b/i;
    const cleanLeg = (s: string) => s
      .replace(PLACE_NOISE, '')
      .replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)$/i, '')
      .replace(/[.!?]+$/, '').trim();
    const legs = (s: string) => s.split(VIA_SPLIT_RE).map(cleanLeg).filter((x) => x.length >= 2);
    const ft = t.match(ROUTE_FROM_TO_RE);
    if (ft?.[1] && ft?.[2]) {
      const fromLegs = legs(ft[1]);
      const toLegs = legs(ft[2]);
      const from = fromLegs[0] || '';
      // toLegs[0] is the destination; the rest are waypoints before it.
      const to = toLegs[0] || '';
      const vias = [...fromLegs.slice(1), ...toLegs.slice(1)].filter((x) => x.length <= 80);
      if (from.length >= 2 && to.length >= 2 && to.length <= 80 && from.length <= 80
          && !isNonGeoPlace(from) && !isNonGeoPlace(to)) {
        return { type: 'route', from, to, ...(vias.length ? { vias } : {}), mode };
      }
    }
    const tt = t.match(ROUTE_TO_RE);
    if (tt?.[1]) {
      const toLegs = legs(tt[1]);
      const to = toLegs[0] || '';
      const vias = toLegs.slice(1).filter((x) => x.length <= 80);
      if (to.length >= 2 && to.length <= 80 && !isNonGeoPlace(to)) {
        return { type: 'route', from: null, to, ...(vias.length ? { vias } : {}), mode };
      }
    }
  }
  for (const re of OPEN_RES) {
    const m = t.match(re);
    if (m?.[1]) {
      let place = m[1].trim()
        .replace(/\s+(?:on|in|onto)\s+(?:the\s+)?(?:map|globe|earth|world)$/i, '')
        .replace(/[.!?]+$/, '')
        .trim();
      place = place.replace(PLACE_NOISE, '').trim();
      if (place.length >= 2 && place.length <= 120 && !isNonGeoPlace(place)) return { type: 'open', place };
    }
  }
  if (OPEN_BLANK_RE.test(t)) return { type: 'open-blank' };
  return null;
}

// ── Geocoding (Photon + Nominatim fallback) ──────────────────────────────

export interface GeoResult { lat: number; lon: number; name: string }

const GEO_STOPWORDS = new Set(['the','a','an','in','on','at','to','of','for','and','or','my','your','show','me','map','globe','near','around','please']);

function geoTokens(query: string): string[] {
  return query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter((w) => w.length >= 2 && !GEO_STOPWORDS.has(w));
}

export async function geocodePlace(query: string): Promise<GeoResult | null> {
  try {
    const url = `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}&limit=6`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const features = (data?.features || []).filter((f: any) => f?.geometry?.coordinates);
      if (features.length) {
        const qTokens = geoTokens(query);
        const firstTok = qTokens[0] || '';
        const pick = (pred: (p: any) => boolean) =>
          features.find((f: any) => pred(f.properties || {}));
        const f =
          pick((p) => p.osm_key === 'place' || p.osm_key === 'building' || p.type === 'house') ||
          (firstTok
            ? pick((p) => {
                const full = [p.name, p.housenumber, p.street].filter(Boolean).join(' ').toLowerCase();
                return full.startsWith(firstTok) || full.includes(firstTok);
              })
            : undefined) ||
          features[0];
        const p = f.properties || {};
        const allProps = [
          p.name,
          p.housenumber,
          p.street,
          p.locality,
          p.district,
          p.city,
          p.state,
          p.country,
          p.postcode,
        ].filter(Boolean).join(' ').toLowerCase();
        const isAddressOrBuilding =
          p.osm_key === 'place' ||
          p.osm_key === 'building' ||
          p.type === 'house' ||
          !!p.housenumber ||
          !!p.street;
        const placeLike =
          isAddressOrBuilding ||
          (firstTok && allProps.includes(firstTok)) ||
          (qTokens.length >= 2 && qTokens.every((tok) => allProps.includes(tok)));
        if (placeLike) {
          const [lon, lat] = f.geometry.coordinates;
          const streetAddress = [p.housenumber, p.street].filter(Boolean).join(' ');
          const parts = [p.name, streetAddress, p.city || p.district, p.state, p.country].filter(Boolean);
          const name = [...new Set(parts)].slice(0, 3).join(', ') || query;
          return { lat, lon, name };
        }
      }
    }
  } catch {
    // continue to Nominatim fallback
  }

  // Fallback to OpenStreetMap Nominatim for exact street addresses / POIs
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const nomRes = await fetch(nomUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'CortexGlobe/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length && nomData[0].lat && nomData[0].lon) {
        const item = nomData[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const name = item.display_name?.split(', ').slice(0, 3).join(', ') || query;
        return { lat, lon, name };
      }
    }
  } catch {}

  return null;
}

// ── View construction + postMessage fly-to ───────────────────────────────

/** Cinematic oblique view framing a point, live layers on, pin annotation. */
export function buildFlyView(
  geo: GeoResult,
  map: GlobeMapStyle = getGlobeMapStyle(),
  opts: { low?: boolean; layers?: string[]; altitude?: number; pitch?: number } = {},
) {
  const isAddress =
    opts.altitude !== undefined
      ? false
      : opts.low ||
        /\b(?:\d+[a-z]?\s+[a-z]+|[a-z]+\s+st(?:reet)?|[a-z]+\s+ave(?:nue)?|[a-z]+\s+rd|[a-z]+\s+blvd|building|tower|center)\b/i.test(
          geo.name,
        );
  const altitude = opts.altitude ?? (isAddress ? 800 : opts.low ? 14000 : 90000);
  const pitch = opts.pitch ?? (isAddress ? -48 : opts.low ? -72 : -62);
  const cam = cameraForTarget(geo.lat, geo.lon, altitude, pitch);
  return {
    camera: {
      lat: cam.lat,
      lon: cam.lon,
      altitude_m: altitude,
      heading_deg: 0,
      pitch_deg: pitch,
    },
    // Merge the session's active set: every fly re-sends a full layer list and
    // GEV applies it authoritatively, so dropping to FLY_LAYERS here would
    // switch off anything the user enabled since the last view.
    layers: [...new Set([...(opts.layers ?? []), ...activeLayers])],
    map,
    annotations: [
      { type: 'pin', latitude: geo.lat, longitude: geo.lon, label: geo.name, color: 'cyan' },
    ],
  };
}

let viewSeq = 0;
const appliedWaiters = new Map<number, { finish: (ok: boolean) => void; view: unknown; retried: boolean }>();
const pendingViews: { id: number; view: unknown }[] = [];
let readySource: MessageEventSource | null = null;

function postView(iframe: HTMLIFrameElement, id: number, view: unknown) {
  let targetOrigin = '*';
  try { targetOrigin = new URL(iframe.src).origin; } catch {}
  iframe.contentWindow?.postMessage({ type: 'gev:view', id, view }, targetOrigin);
}

function currentIframe(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>(GEV_IFRAME_SELECTOR);
}

function iframeIsReady(iframe: HTMLIFrameElement): boolean {
  return readySource !== null && iframe.contentWindow === readySource;
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'gev:ready') {
      readySource = e.source;
      const iframe = currentIframe();
      if (iframe && iframe.contentWindow === e.source) {
        for (const p of pendingViews.splice(0)) postView(iframe, p.id, p.view);
      }
    } else if (d.type === 'gev:view-applied') {
      const w = appliedWaiters.get(d.id);
      if (w) {
        appliedWaiters.delete(d.id);
        // Self-heal provider-gated layers: GEV names the layerId on failed
        // set_layer_visibility steps — drop it and retry the view once without.
        const bad = (Array.isArray(d.steps) ? d.steps : [])
          .filter((st: any) => st?.step === 'set_layer_visibility' && st?.ok === false && st?.layerId)
          .map((st: any) => String(st.layerId));
        const v = w.view as { layers?: unknown } | null;
        if (bad.length && v && Array.isArray(v.layers) &&
            bad.some((id: string) => (v.layers as string[]).includes(id)) && !w.retried) {
          for (const id of bad) { activeLayers.delete(id); lastPrunedLayers.push(id); }
          const fixed = { ...(v as object), layers: (v.layers as string[]).filter((l) => !bad.includes(l)) };
          lastView = fixed as Record<string, unknown>;
          flyGlobe(fixed, 30000, { record: false }).then((ok2) => w.finish(ok2));
          return;
        }
        w.finish(!!d.ok);
      }
    } else if (d.type === 'gev:time-applied' || d.type === 'gev:cctv-applied' || d.type === 'gev:places-applied') {
      cmdWaiters.get(`${d.type}:${d.id}`)?.(d);
    }
  });
}

// ── Non-view commands (world clock, CCTV) ────────────────────────────────
// Same postMessage channel as views but a separate request/reply pair —
// GEV answers gev:time-applied / gev:cctv-applied with the action result.
const cmdWaiters = new Map<string, (msg: Record<string, unknown>) => void>();
let cmdSeq = 0;

function postGlobeCommand(
  type: 'gev:time' | 'gev:cctv' | 'gev:places',
  replyType: 'gev:time-applied' | 'gev:cctv-applied' | 'gev:places-applied',
  payload: Record<string, unknown>,
  timeoutMs = 15000,
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const id = ++cmdSeq;
    let done = false;
    const finish = (msg: Record<string, unknown> | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      cmdWaiters.delete(`${replyType}:${id}`);
      resolve(msg);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    cmdWaiters.set(`${replyType}:${id}`, finish);
    const attempt = () => {
      const iframe = currentIframe();
      if (!iframe) return false;
      let targetOrigin = '*';
      try { targetOrigin = new URL(iframe.src).origin; } catch {}
      iframe.contentWindow?.postMessage({ type, id, ...payload }, targetOrigin);
      return true;
    };
    // The iframe mounts asynchronously after setGlobeMode('globe') — poll for
    // it the same way flyGlobe does instead of dropping the command.
    const poll = setInterval(() => { if (done || attempt()) clearInterval(poll); }, 500);
    attempt();
  });
}

/** World-clock control. `seek` takes epoch ms; play/pause/live are ops. */
export function globeTime(
  cmd: { op: 'seek'; at: number } | { op: 'play' | 'pause' | 'live' },
): Promise<Record<string, unknown> | null> {
  if (cmd.op === 'seek') return postGlobeCommand('gev:time', 'gev:time-applied', { op: 'seek', at: cmd.at });
  return postGlobeCommand('gev:time', 'gev:time-applied', { op: cmd.op });
}

/** Last successfully locked CCTV camera — powers "open it" follow-ups. */
let lastCctvName: string | null = null;
export function getLastCctvName(): string | null { return lastCctvName; }
export function setLastCctvName(name: string | null) { lastCctvName = name; }

/** Google Places search via the embed bridge → osm-places pins on the globe. */
export function globePlacesSearch(
  query: string,
  opts: { lat?: number; lon?: number; radiusM?: number } = {},
): Promise<Record<string, unknown> | null> {
  return postGlobeCommand('gev:places', 'gev:places-applied', {
    action: 'search',
    query,
    ...(opts.lat !== undefined ? { lat: opts.lat } : {}),
    ...(opts.lon !== undefined ? { lon: opts.lon } : {}),
    ...(opts.radiusM !== undefined ? { radiusM: opts.radiusM } : {}),
  }, 30000);
}

/** Google Place Details (rating, reviews, hours) via the embed bridge. */
export function globePlaceDetails(
  opts: { id?: string; q?: string; lat?: number; lon?: number },
): Promise<Record<string, unknown> | null> {
  return postGlobeCommand('gev:places', 'gev:places-applied', {
    action: 'details',
    ...opts,
  });
}

/** CCTV camera control via GEV's own control_cctv action. */
export function globeCctv(
  action: 'nearest' | 'next' | 'prev' | 'focus' | 'select' | 'coverage',
  opts: { query?: string; enabled?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  return postGlobeCommand('gev:cctv', 'gev:cctv-applied', {
    action,
    ...(opts.query ? { cameraQuery: opts.query } : {}),
    ...(typeof opts.enabled === 'boolean' ? { enabled: opts.enabled } : {}),
  });
}

/**
 * Fly the embedded globe to a view. Resolves true when GEV confirms the view
 * applied; queues behind `gev:ready` while the iframe boots. Times out → false
 * (the map is still shown, just not yet aimed).
 */
let lastView: Record<string, unknown> | null = null;
let activeLayers = new Set<string>(FLY_LAYERS);
/** Layer ids GEV refused on the last view (provider-gated) — surfaced to voice. */
let lastPrunedLayers: string[] = [];
export function getLastPrunedLayers(): string[] { return [...lastPrunedLayers]; }

// View history for "go back"/"go forward". Only *destination* flies record —
// layer/style/fx/zoom/annotation mutations re-fly the same view and would
// otherwise pollute the stack (and make back ping-pong between two views).
const viewHistory: Record<string, unknown>[] = [];
const forwardHistory: Record<string, unknown>[] = [];
const MAX_VIEW_HISTORY = 8;

export function flyGlobe(view: unknown, timeoutMs = 30000, opts: { record?: boolean } = {}): Promise<boolean> {
  lastPrunedLayers = [];
  const incoming = view as Record<string, unknown>;
  const record = opts.record !== false;
  if (record && lastView && JSON.stringify(lastView) !== JSON.stringify(incoming)) {
    viewHistory.push(lastView);
    if (viewHistory.length > MAX_VIEW_HISTORY) viewHistory.shift();
    forwardHistory.length = 0; // a new destination cancels the forward trail
  }
  lastView = incoming;
  if (Array.isArray((view as { layers?: unknown }).layers)) {
    activeLayers = new Set((view as { layers: string[] }).layers);
  }
  return new Promise((resolve) => {
    const id = ++viewSeq;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      appliedWaiters.delete(id);
      const idx = pendingViews.findIndex((p) => p.id === id);
      if (idx >= 0) pendingViews.splice(idx, 1);
      resolve(ok);
    };
    appliedWaiters.set(id, { finish, view, retried: false });
    setTimeout(() => finish(false), timeoutMs);

    const attempt = () => {
      if (done) return;
      const iframe = currentIframe();
      if (!iframe) { setTimeout(attempt, 400); return; }
      if (iframeIsReady(iframe)) {
        postView(iframe, id, view);
      } else if (!pendingViews.some((p) => p.id === id)) {
        pendingViews.push({ id, view });
        setTimeout(attempt, 600); // re-check until ready or timeout
      } else {
        setTimeout(attempt, 600);
      }
    };
    attempt();
  });
}

/**
 * Switch map imagery on the live globe. Re-sends the last flown view with the
 * new `map` (GEV requires a full view — camera is mandatory). Resolves null
 * when no view has been flown yet.
 */
export function applyGlobeMapStyle(style: GlobeMapStyle): Promise<boolean> | null {
  setGlobeMapStylePref(style);
  if (!lastView) return null;
  return flyGlobe({ ...lastView, map: style }, 30000, { record: false });
}

export function isGlobeMounted(): boolean {
  return currentIframe() !== null;
}

/** Whether any view has been flown — layer/fx/cctv commands need one. */
export function hasGlobeView(): boolean {
  return lastView !== null;
}

/** "Go back" — re-fly the previous *destination*. The view being left moves
 *  to the forward stack so "go forward" can retrace it; the back-fly itself
 *  does not record (that's what caused the two-view ping-pong). */
export function flyGlobeBack(): Promise<boolean> | null {
  const prev = viewHistory.pop();
  if (!prev) return null;
  if (lastView) forwardHistory.push(lastView);
  if (forwardHistory.length > MAX_VIEW_HISTORY) forwardHistory.shift();
  return flyGlobe(prev, 30000, { record: false });
}

/** "Go forward" — retrace a "go back". */
export function flyGlobeForward(): Promise<boolean> | null {
  const next = forwardHistory.pop();
  if (!next) return null;
  if (lastView) viewHistory.push(lastView);
  if (viewHistory.length > MAX_VIEW_HISTORY) viewHistory.shift();
  return flyGlobe(next, 30000, { record: false });
}

/** Debug/test hook — history depths + current camera for verification. */
export function debugViewHistory(): { back: number; forward: number; camera: unknown } {
  return {
    back: viewHistory.length,
    forward: forwardHistory.length,
    camera: (lastView?.camera as unknown) ?? null,
  };
}

function baseView(): Record<string, unknown> | null {
  return lastView;
}

/** Re-fly the current view with a modified layer set. */
export function globeSetLayers(mode: 'set' | 'add' | 'remove', ids: string[]): Promise<boolean> | null {
  const v = baseView();
  if (!v) return null;
  let next: Set<string>;
  if (mode === 'set') next = new Set(ids);
  else if (mode === 'add') next = new Set([...activeLayers, ...ids]);
  else next = new Set([...activeLayers].filter((l) => !ids.includes(l)));
  if (next.size === 0) return null; // GEV wants ≥1? keep at least empty set is fine, but guard anyway
  activeLayers = next;
  return flyGlobe({ ...v, layers: [...next] }, 30000, { record: false });
}

/** Inverse of cameraForTarget: recover the look-at target from a stored
 *  camera (heading 0 → look-ahead is due north). Needed because zoom must
 *  re-frame the SAME target — keeping the offset camera position slides the
 *  center south as altitude drops ("zoom goes to a lower region" bug). */
function targetFromCamera(cam: { lat: number; lon: number; altitude_m: number; pitch_deg: number }): { lat: number; lon: number } {
  const offVerticalDeg = 90 - Math.abs(cam.pitch_deg);
  const lookAheadM = cam.altitude_m * Math.tan((offVerticalDeg * Math.PI) / 180);
  return { lat: cam.lat + lookAheadM / 111_320, lon: cam.lon };
}

/** Zoom by scaling altitude while keeping the same look-at target centered. */
export function globeZoom(dir: 'in' | 'out'): Promise<boolean> | null {
  const v = baseView();
  if (!v) return null;
  const cam = (v.camera ?? {}) as Record<string, unknown>;
  const alt = typeof cam.altitude_m === 'number' ? cam.altitude_m : 90000;
  const pitch = typeof cam.pitch_deg === 'number' ? cam.pitch_deg : -62;
  const clat = typeof cam.lat === 'number' ? cam.lat : null;
  const clon = typeof cam.lon === 'number' ? cam.lon : null;
  if (clat === null || clon === null) return null;
  const nextAlt = Math.min(20_000_000, Math.max(500, Math.round(alt * (dir === 'in' ? 0.35 : 2.8))));
  // Re-derive the camera offset for the new altitude so the target stays put.
  const target = targetFromCamera({ lat: clat, lon: clon, altitude_m: alt, pitch_deg: pitch });
  const next = cameraForTarget(target.lat, target.lon, nextAlt, pitch);
  return flyGlobe({
    ...v,
    camera: { ...cam, lat: next.lat, lon: next.lon, altitude_m: nextAlt },
  }, 30000, { record: false });
}

/** Switch visual post-FX (CRT / night vision / thermal / noir / anime).
 *  Re-sends the last view with `style` set; 'normal' clears it. */
export function globeFx(style: GlobeFxStyle): Promise<boolean> | null {
  const v = baseView();
  if (!v) return null;
  return flyGlobe({ ...v, style }, 30000, { record: false });
}

/** Merge one annotation into the live view — GEV replaces the annotation set
 *  on every view, so we carry the previous list forward (cap 24 like GEV).
 *  `frame` recentres the camera on a place; without it the camera stays put.
 *  Works before any fly-to: builds a standalone view from `frame` + defaults. */
export function globeAnnotate(
  annotation: Record<string, unknown>,
  frame?: { lat: number; lon: number; altitudeM?: number; pitchDeg?: number } | null,
): Promise<boolean> | null {
  const v = baseView();
  const prev = v && Array.isArray(v.annotations) ? (v.annotations as unknown[]) : [];
  const annotations = [...prev, annotation].slice(-24);
  const view: Record<string, unknown> = v
    ? { ...v, annotations }
    : {
        camera: { lat: 0, lon: 0, altitude_m: 800000, heading_deg: 0, pitch_deg: -90 },
        layers: [...FLY_LAYERS],
        map: getGlobeMapStyle(),
        annotations,
      };
  if (frame) {
    const cam = (view.camera ?? {}) as Record<string, unknown>;
    const alt = frame.altitudeM ?? (typeof cam.altitude_m === 'number' ? cam.altitude_m : 90000);
    const pitch = frame.pitchDeg ?? (typeof cam.pitch_deg === 'number' ? cam.pitch_deg : -62);
    const c = cameraForTarget(frame.lat, frame.lon, alt, pitch);
    view.camera = { ...cam, lat: c.lat, lon: c.lon, altitude_m: alt, pitch_deg: pitch };
  }
  return flyGlobe(view, 30000, { record: !!frame });
}

/** Arrow annotation between two geocoded points, camera framed on both. */
export function globeArrow(
  from: { lat: number; lon: number; label?: string },
  to: { lat: number; lon: number; label?: string },
): Promise<boolean> | null {
  const distKm = haversineKm(from, to);
  const altitude = Math.min(5_000_000, Math.max(80_000, Math.round(distKm * 1000 * 0.9)));
  return globeAnnotate(
    {
      type: 'arrow',
      latitude: from.lat,
      longitude: from.lon,
      toLatitude: to.lat,
      toLongitude: to.lon,
      label: `${from.label || 'Start'} → ${to.label || 'Destination'}`,
      color: 'amber',
    },
    {
      lat: (from.lat + to.lat) / 2,
      lon: (from.lon + to.lon) / 2,
      altitudeM: altitude,
      pitchDeg: -55,
    },
  );
}

/** Follow an entity — GEV resolves the id within the layer (callsign/name).
 *  `cockpit` puts the camera inside the aircraft (aircraft kinds only). */
export function globeFollow(
  kind: 'aircraft' | 'satellite' | 'military_aircraft',
  id: string,
  cockpit = false,
): Promise<boolean> | null {
  const v = baseView();
  if (!v) return null;
  return flyGlobe({
    ...v,
    follow: { kind, id, ...(cockpit && kind !== 'satellite' ? { cockpit: true } : {}) },
  }, 30000, { record: false });
}

/** Stop following; camera returns to the last flown view. */
export function globeUnfollow(): Promise<boolean> | null {
  const v = baseView();
  if (!v) return null;
  const { follow: _omit, ...rest } = v;
  return flyGlobe(rest, 30000, { record: false });
}

/** Drop a pin at the current camera target. */
export function globePin(): Promise<boolean> | null {
  const v = baseView();
  if (!v) return null;
  const cam = (v.camera ?? {}) as Record<string, unknown>;
  const lat = typeof cam.lat === 'number' ? cam.lat : null;
  const lon = typeof cam.lon === 'number' ? cam.lon : null;
  if (lat === null || lon === null) return null;
  const annotations = [
    ...((v.annotations as unknown[]) ?? []),
    { type: 'pin', latitude: lat, longitude: lon, label: 'MARK', color: 'cyan' },
  ].slice(-24);
  return flyGlobe({ ...v, annotations }, 30000, { record: false });
}

/** Ask the page to enter/leave map mode. */
export function setGlobeMode(mode: 'globe' | 'core') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GLOBE_MODE_EVENT, { detail: mode }));
  }
}

// ── Availability flag (page probes the sibling app on mount) ─────────────
let globeAvailableFlag = false;
export function setGlobeAvailable(v: boolean) { globeAvailableFlag = v; }
export function isGlobeAvailable() { return globeAvailableFlag; }

// Test/debug hook — lets tooling drive the bridge without a microphone.
if (typeof window !== 'undefined') {
  (window as unknown as { __cortexGlobe?: unknown }).__cortexGlobe = {
    parseMapCommand, geocodePlace, buildFlyView, flyGlobe, applyGlobeMapStyle,
    getGlobeMapStyle, setGlobeMapStylePref, setGlobeMode, isGlobeMounted,
    globeSetLayers, globeZoom, globeFollow, globeUnfollow, globePin,
    globeFx, globeAnnotate, globeArrow, FX_STYLE_LABELS, GLOBE_FX_STYLES,
    globeTime, globeCctv, parseWorldTimeMs, hasGlobeView,
    flyGlobeBack, flyGlobeForward, debugViewHistory,
    buildRouteView, setLastDestination, getLastDestination,
  };
}

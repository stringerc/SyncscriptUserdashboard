/**
 * ArtifactRenderer — renders CortexArtifact objects as HUD instrument cards.
 * Shared by /cortex/chat message list, the visualizer chat drawer, and the
 * Phase-2 surface layer. Design language: 1px hairline borders, corner ticks,
 * 9px mono uppercase labels, state-color accents, spring entrance.
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { ExternalLink, Pin, X } from 'lucide-react';
import { C } from '../cortex-demo-helpers';
import type { CortexArtifact, ChartArtifact, TableArtifact, ImageArtifact, DocumentArtifact, FeedArtifact, StatArtifact } from '../../../lib/cortex-artifacts';

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

interface TelemetrySample { state: string; level: number; text: string; ts: number }
let telemetryCache: TelemetrySample | null = null;
const telemetrySubs = new Set<(t: TelemetrySample) => void>();
let telemetryTimer: ReturnType<typeof setInterval> | null = null;

/** Shared poller for Cortex's own signal bus — live artifacts subscribe here. */
function useTelemetry(): TelemetrySample | null {
  const [t, setT] = useState<TelemetrySample | null>(telemetryCache);
  useEffect(() => {
    const sub = (v: TelemetrySample) => setT(v);
    telemetrySubs.add(sub);
    if (!telemetryTimer) {
      const poll = async () => {
        try {
          const r = await fetch('/api/cortex/bus/state', { cache: 'no-store' });
          const d = await r.json();
          telemetryCache = {
            state: String(d?.state || 'idle'),
            level: Number(d?.level ?? 0),
            text: String(d?.text || ''),
            ts: Date.now(),
          };
          telemetrySubs.forEach((f) => f(telemetryCache!));
        } catch {}
      };
      void poll();
      telemetryTimer = setInterval(poll, 2000);
    }
    return () => {
      telemetrySubs.delete(sub);
      // Last subscriber gone → stop polling so closed panels don't leak timers.
      if (!telemetrySubs.size && telemetryTimer) {
        clearInterval(telemetryTimer);
        telemetryTimer = null;
      }
    };
  }, []);
  return t;
}

/** Live value overlay for stat artifacts bound to liveSource 'telemetry'. */
function useLiveStatValue(a: StatArtifact): { value: string; stale: boolean } | null {
  const t = useTelemetry();
  if (!a.live || a.liveSource !== 'telemetry' || !t) return null;
  const stale = Date.now() - t.ts > 30_000;
  const pct = Math.round(Math.min(100, Math.max(0, t.level)));
  return { value: `${pct}%`, stale };
}

const TONE_COLOR: Record<string, string> = {
  ok: C.green, warn: C.amber, alert: C.red, info: C.cyan,
};

const CHART_COLORS = [C.cyan, C.purple, C.magenta, C.green, C.amber, '#67e8f9'];

function CornerTicks() {
  const t = { position: 'absolute' as const, width: 7, height: 7, borderColor: C.borderBright, borderStyle: 'solid' as const, opacity: 0.8 };
  return (
    <>
      <span style={{ ...t, top: -1, left: -1, borderWidth: '1px 0 0 1px' }} />
      <span style={{ ...t, top: -1, right: -1, borderWidth: '1px 1px 0 0' }} />
      <span style={{ ...t, bottom: -1, left: -1, borderWidth: '0 0 1px 1px' }} />
      <span style={{ ...t, bottom: -1, right: -1, borderWidth: '0 1px 1px 0' }} />
    </>
  );
}

export function ArtifactShell({
  title, source, createdAt, live, children, onExpand, onPin, onClose, compact,
}: {
  title: string;
  source?: string;
  createdAt?: number;
  live?: boolean;
  children: React.ReactNode;
  onExpand?: () => void;
  onPin?: () => void;
  onClose?: () => void;
  compact?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onExpand}
      style={{
        position: 'relative',
        background: 'linear-gradient(160deg, rgba(103,232,249,0.045), rgba(167,139,250,0.025) 60%, rgba(4,8,14,0.6))',
        border: `1px solid ${hover ? C.borderBright : C.border}`,
        borderRadius: 6,
        padding: compact ? '8px 10px' : '10px 12px',
        cursor: onExpand ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease',
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      <CornerTicks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {live && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: 'pulse 1.4s infinite', flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', color: C.cyan,
          fontFamily: MONO, textTransform: 'uppercase', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: 4, opacity: hover ? 1 : 0.35, transition: 'opacity 0.15s' }}
          onClick={(e) => e.stopPropagation()}>
          {onPin && (
            <button onClick={onPin} title="Pin to surface" style={iconBtn}><Pin size={10} /></button>
          )}
          {onExpand && (
            <button onClick={onExpand} title="Expand" style={iconBtn}><ExternalLink size={10} /></button>
          )}
          {onClose && (
            <button onClick={onClose} title="Close" style={iconBtn}><X size={10} /></button>
          )}
        </div>
      </div>
      {children}
      {(source || createdAt) && (
        <div style={{
          marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.border}`,
          fontSize: 8.5, letterSpacing: '0.14em', color: C.dim, fontFamily: MONO,
          display: 'flex', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source || ''}</span>
          {createdAt && (
            <span style={{ flexShrink: 0 }}>
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: C.dim,
  padding: 3, display: 'flex', alignItems: 'center', borderRadius: 3,
};

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 120, h = 28, min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: 6, opacity: 0.9 }}>
      <polyline points={pts} fill="none" stroke={C.cyan} strokeWidth="1.2" />
    </svg>
  );
}

function StatBody({ a }: { a: StatArtifact }) {
  const live = useLiveStatValue(a);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{
          fontSize: 26, fontWeight: 300, color: live?.stale ? C.dim : C.text,
          fontFamily: MONO, letterSpacing: '-0.02em', transition: 'color 0.4s',
        }}>
          {live ? live.value : a.value}
        </span>
        {live && <span style={{ fontSize: 9, color: live.stale ? C.amber : C.green, fontFamily: MONO, letterSpacing: '0.16em' }}>{live.stale ? 'STALE' : 'LIVE'}</span>}
        {a.unit && <span style={{ fontSize: 11, color: C.dim, fontFamily: MONO }}>{a.unit}</span>}
        {a.delta && (
          <span style={{
            fontSize: 10, fontFamily: MONO, marginLeft: 'auto',
            color: a.delta.startsWith('-') ? C.red : a.delta.startsWith('+') ? C.green : C.dim,
          }}>{a.delta}</span>
        )}
      </div>
      {a.spark && <Sparkline data={a.spark} />}
    </div>
  );
}

function ChartBody({ a }: { a: ChartArtifact }) {
  // Merge all series into one row set keyed by x.
  const merged = new Map<string | number, Record<string, any>>();
  for (const s of a.series) {
    for (const p of s.points) {
      const key = String(p.x);
      const row = merged.get(key) ?? { x: p.x };
      row[s.name || 'value'] = p.y;
      merged.set(key, row);
    }
  }
  const rows = Array.from(merged.values()).slice(0, 200);
  const tooltipStyle = {
    background: 'rgba(4,8,14,0.92)', border: `1px solid ${C.borderBright}`, borderRadius: 4,
    fontSize: 10, fontFamily: MONO, color: C.text,
  } as const;

  if (a.chartType === 'pie') {
    const pieData = a.series[0]?.points.map((p, i) => ({ name: String(p.x), value: p.y, fill: CHART_COLORS[i % CHART_COLORS.length] })) ?? [];
    return (
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={28} outerRadius={58} paddingAngle={2} strokeWidth={0}>
              {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const common = (
    <>
      <CartesianGrid stroke="rgba(148,233,255,0.07)" vertical={false} />
      <XAxis dataKey="x" tick={{ fontSize: 9, fill: C.dim, fontFamily: MONO }} tickLine={false} axisLine={{ stroke: C.border }} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 9, fill: C.dim, fontFamily: MONO }} tickLine={false} axisLine={false} width={34} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(148,233,255,0.25)' }} />
    </>
  );
  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        {a.chartType === 'bar' ? (
          <BarChart data={rows}>{common}
            {a.series.map((s, i) => <Bar key={i} dataKey={s.name || `s${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[2, 2, 0, 0]} maxBarSize={22} />)}
          </BarChart>
        ) : a.chartType === 'area' ? (
          <AreaChart data={rows}>{common}
            {a.series.map((s, i) => <Area key={i} type="monotone" dataKey={s.name || `s${i}`} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.12} strokeWidth={1.5} />)}
          </AreaChart>
        ) : (
          <LineChart data={rows}>{common}
            {a.series.map((s, i) => <Line key={i} type="monotone" dataKey={s.name || `s${i}`} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={1.6} dot={false} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function TableBody({ a }: { a: TableArtifact }) {
  return (
    <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: MONO }}>
        <thead>
          <tr>
            {a.columns.map((c, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '5px 8px', color: C.cyan,
                fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                borderBottom: `1px solid ${C.borderBright}`, whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {a.rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: '5px 8px', color: C.text, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImageBody({ a, fitHeight, fitSize }: { a: ImageArtifact; fitHeight?: number; fitSize?: { w: number; h: number } }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const aspect = a.aspect === '16:9' ? '16 / 9' : a.aspect === '4:3' ? '4 / 3' : '1 / 1';
  // Exact-size mode (hug panels): container matches the image's own aspect
  // ratio at the given pixel size — nothing is cropped, nothing letterboxed.
  if (fitSize) {
    return (
      <div style={{
        position: 'relative', width: fitSize.w, height: fitSize.h,
        borderRadius: 4, overflow: 'hidden', background: 'rgba(148,233,255,0.04)',
        border: `1px solid ${C.border}`, margin: '0 auto',
      }}>
        {state === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, letterSpacing: '0.22em', color: C.dim, fontFamily: MONO, textTransform: 'uppercase',
          }}>
            <span style={{ animation: 'pulse 1.2s infinite' }}>Materializing…</span>
          </div>
        )}
        {state === 'error' ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: C.red, fontFamily: MONO, padding: 12, textAlign: 'center',
          }}>Image unavailable</div>
        ) : (
          <img
            src={a.url}
            alt={a.prompt || a.title}
            onLoad={() => setState('ready')}
            onError={() => setState('error')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: state === 'ready' ? 'block' : 'none' }}
          />
        )}
      </div>
    );
  }
  const img = (
    <img
      src={a.url}
      alt={a.prompt || a.title}
      onLoad={() => setState('ready')}
      onError={() => setState('error')}
      style={fitHeight
        ? { maxWidth: '100%', maxHeight: fitHeight, objectFit: 'contain', display: state === 'ready' ? 'block' : 'none' }
        : { width: '100%', height: '100%', objectFit: 'cover', display: state === 'ready' ? 'block' : 'none' }}
    />
  );
  const prompt = a.prompt && (
    <div style={{ marginTop: 6, fontSize: 10, color: C.dim, fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
      “{a.prompt}”
    </div>
  );
  // Panel-constrained mode: show the WHOLE image fitted inside fitHeight
  // (letterboxed) instead of cropping a slice of a fixed-aspect box.
  if (fitHeight) {
    return (
      <div>
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 60, maxHeight: fitHeight, borderRadius: 4, overflow: 'hidden',
          background: 'rgba(148,233,255,0.04)', border: `1px solid ${C.border}`,
        }}>
          {state === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, letterSpacing: '0.22em', color: C.dim, fontFamily: MONO, textTransform: 'uppercase',
            }}>
              <span style={{ animation: 'pulse 1.2s infinite' }}>Materializing…</span>
            </div>
          )}
          {state === 'error' ? (
            <div style={{
              padding: 16, fontSize: 10, color: C.red, fontFamily: MONO, textAlign: 'center',
            }}>Image unavailable</div>
          ) : img}
        </div>
        {prompt}
      </div>
    );
  }
  return (
    <div>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: aspect,
        borderRadius: 4, overflow: 'hidden', background: 'rgba(148,233,255,0.04)',
        border: `1px solid ${C.border}`,
      }}>
        {state === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, letterSpacing: '0.22em', color: C.dim, fontFamily: MONO, textTransform: 'uppercase',
          }}>
            <span style={{ animation: 'pulse 1.2s infinite' }}>Materializing…</span>
          </div>
        )}
        {state === 'error' ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: C.red, fontFamily: MONO, padding: 12, textAlign: 'center',
          }}>Image unavailable</div>
        ) : img}
      </div>
      {prompt}
    </div>
  );
}

function renderStyledMarkdown(markdownText: string, onToggleTodo?: (lineIndex: number) => void) {
  const lines = markdownText.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (inList && listItems.length > 0) {
      renderedElements.push(
        <ul key={key} style={{ margin: '4px 0 8px 8px', padding: 0, listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
    let lastIndex = 0;
    let match;
    let counter = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={counter++} style={{ color: '#f8fafc', fontWeight: 700 }}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code key={counter++} style={{ background: 'rgba(103,232,249,0.12)', color: '#38bdf8', padding: '1px 5px', borderRadius: 3, fontFamily: MONO, fontSize: 10 }}>
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={counter++} style={{ color: '#94a3b8', fontStyle: 'italic' }}>{token.slice(1, -1)}</em>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushList(`list-flush-${i}`);
      continue;
    }

    if (line === '---' || line === '***') {
      flushList(`list-hr-${i}`);
      renderedElements.push(
        <div key={`hr-${i}`} style={{ height: 1, background: 'linear-gradient(90deg, rgba(103,232,249,0.4), rgba(232,121,249,0.3) 60%, transparent)', margin: '10px 0' }} />
      );
      continue;
    }

    // Federal / SAM.gov Credentials Badge Box
    if (line.includes('SAM.gov') && (line.includes('UEI:') || line.includes('CAGE') || line.includes('Contractor'))) {
      flushList(`fed-badge-${i}`);
      renderedElements.push(
        <div key={`fed-${i}`} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,10,18,0.7))',
          border: '1px solid rgba(16,185,129,0.35)', borderRadius: 4, margin: '6px 0',
          fontSize: 9, fontFamily: MONO, color: '#34d399',
        }}>
          <span style={{ fontSize: 10 }}>🛡️</span>
          <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>ACTIVE FEDERAL CREDENTIAL:</span>
          <span>{parseInline(line.replace(/^[*-]\s+/, ''))}</span>
        </div>
      );
      continue;
    }

    // H1 Header
    if (line.startsWith('# ')) {
      flushList(`h1-${i}`);
      renderedElements.push(
        <div key={`h1-${i}`} style={{
          fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: '#f8fafc',
          textTransform: 'uppercase', paddingBottom: 4, marginTop: 4, marginBottom: 2,
          borderBottom: '2px solid rgba(103,232,249,0.5)',
        }}>
          {line.slice(2)}
        </div>
      );
      continue;
    }

    // H2 / H3 Header
    if (line.startsWith('## ') || line.startsWith('### ')) {
      flushList(`h3-${i}`);
      const text = line.replace(/^#{2,3}\s+/, '');
      renderedElements.push(
        <div key={`h3-${i}`} style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.cyan,
          textTransform: 'uppercase', marginTop: 10, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: C.magenta, fontSize: 10 }}>◈</span>
          <span>{text}</span>
        </div>
      );
      continue;
    }

    // H4 Header
    if (line.startsWith('#### ')) {
      flushList(`h4-${i}`);
      renderedElements.push(
        <div key={`h4-${i}`} style={{
          fontSize: 10.5, fontWeight: 600, color: '#e2e8f0', marginTop: 6, marginBottom: 2,
        }}>
          {parseInline(line.slice(5))}
        </div>
      );
      continue;
    }

    // Interactive Task / Checkbox item: - [ ] or - [x]
    const todoMatch = line.match(/^[-*•]\s+\[([ xX])\]\s+(.*)$/);
    if (todoMatch) {
      inList = true;
      const isChecked = todoMatch[1].toLowerCase() === 'x';
      const itemText = todoMatch[2];
      const lineIdx = i;
      listItems.push(
        <li
          key={`todo-${i}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleTodo?.(lineIdx);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10.5,
            lineHeight: 1.5,
            color: isChecked ? '#64748b' : '#e2e8f0',
            textDecoration: isChecked ? 'line-through' : 'none',
            cursor: onToggleTodo ? 'pointer' : 'default',
            padding: '3px 6px',
            borderRadius: 4,
            background: isChecked ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
            transition: 'all 0.15s ease',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1.5px solid ${isChecked ? '#10b981' : 'rgba(148, 233, 255, 0.5)'}`,
              background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: '#10b981',
              fontSize: 10,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {isChecked ? '✓' : ''}
          </span>
          <div style={{ flex: 1 }}>{parseInline(itemText)}</div>
        </li>
      );
      continue;
    }

    // Bullet item
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      inList = true;
      const itemText = line.replace(/^[-*•]\s+/, '');
      listItems.push(
        <li key={`li-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 10, lineHeight: 1.5, color: '#cbd5e1' }}>
          <span style={{ color: C.cyan, fontSize: 8, marginTop: 3 }}>▪</span>
          <div style={{ flex: 1 }}>{parseInline(itemText)}</div>
        </li>
      );
      continue;
    }

    // Normal paragraph
    flushList(`p-${i}`);
    renderedElements.push(
      <p key={`p-${i}`} style={{ margin: '3px 0 6px 0', fontSize: 10.5, lineHeight: 1.55, color: '#94a3b8' }}>
        {parseInline(line)}
      </p>
    );
  }
  flushList('final-flush');
  return renderedElements;
}

function DocumentBody({ a }: { a: DocumentArtifact }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'compiled' | 'raw'>('compiled');
  const [content, setContent] = useState(a.content);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const isHtml = a.format === 'html' || a.lang === 'html' || /<html[\s>]|<!DOCTYPE\s+html/i.test(content);
  const isPlaceholderHtml = content.trim() === '<html>...</html>' || content.trim() === '<html />' || (isHtml && content.trim().length < 50);
  const isSampleSite = isHtml && (a.title?.toLowerCase().includes('sample') || isPlaceholderHtml);

  const docxUrl = a.docxPath || (a.title.toLowerCase().includes('resume') ? '/docs/Chris_Stringer_Executive_Resume.docx' : null);
  const pdfUrl = a.pdfPath || (a.title.toLowerCase().includes('resume') ? '/docs/Chris_Stringer_Executive_Resume.pdf' : null);

  const handleToggleTodo = (lineIndex: number) => {
    const lines = content.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      let updatedLine = line;
      let isDone = false;
      let taskTitle = '';
      if (line.includes('- [ ]') || line.includes('* [ ]') || line.includes('• [ ]')) {
        updatedLine = line.replace(/([-*•]\s+)\[ \]/, '$1[x]');
        isDone = true;
        taskTitle = line.replace(/^[-*•]\s+\[ \]\s+/, '').trim();
      } else if (/[-*•]\s+\[[xX]\]/.test(line)) {
        updatedLine = line.replace(/([-*•]\s+)\[[xX]\]/, '$1[ ]');
        isDone = false;
        taskTitle = line.replace(/^[-*•]\s+\[[xX]\]\s+/, '').trim();
      }
      lines[lineIndex] = updatedLine;
      const updated = lines.join('\n');
      setContent(updated);
      a.content = updated;

      // Update surface panels in localStorage so it persists across views/reloads
      try {
        const raw = localStorage.getItem('cortex-surface-panels-v1');
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data?.panels)) {
            const panel = data.panels.find((p: any) => p?.artifact?.id === a.id || p?.id === a.id);
            if (panel && panel.artifact) {
              panel.artifact.content = updated;
              localStorage.setItem('cortex-surface-panels-v1', JSON.stringify(data));
            }
          }
        }
      } catch {}

      // Dispatch event for UI or calendar synchronization
      if (typeof window !== 'undefined' && taskTitle) {
        window.dispatchEvent(new CustomEvent('cortex-task-toggle', {
          detail: { title: taskTitle, done: isDone, line: lineIndex }
        }));
      }
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cortex-key': 'sovereign-local' },
        body: JSON.stringify({
          tool: 'create_document',
          args: {
            title: a.title || 'Document',
            format: 'docx',
            content,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveStatus('SAVED & RECOMPILED');
        setTimeout(() => {
          setEditing(false);
          setSaveStatus(null);
        }, 1200);
      } else {
        setSaveStatus('SAVE FAILED');
      }
    } catch {
      setSaveStatus('SAVE FAILED');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: 280,
              maxHeight: 480,
              fontSize: 11,
              lineHeight: 1.55,
              color: '#f8fafc',
              fontFamily: MONO,
              background: 'rgba(5, 10, 20, 0.95)',
              borderRadius: 4,
              padding: '10px 12px',
              border: `1px solid ${C.cyan}`,
              outline: 'none',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                ...iconBtn,
                padding: '4px 10px',
                borderRadius: 3,
                background: 'rgba(34, 211, 238, 0.2)',
                border: `1px solid ${C.cyan}`,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.14em',
                fontFamily: MONO,
                color: C.cyan,
              }}
            >
              {saving ? 'COMPILING DOCX…' : saveStatus || 'SAVE & RECOMPILE'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(false); }}
              style={{
                ...iconBtn,
                padding: '4px 8px',
                borderRadius: 3,
                border: `1px solid ${C.border}`,
                fontSize: 9,
                fontFamily: MONO,
                color: C.dim,
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'compiled' ? (
            isHtml ? (
              <div
                style={{
                  width: '100%',
                  height: expanded ? '65vh' : 280,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: `1px solid ${C.border}`,
                  background: '#0b0f19',
                }}
              >
                <iframe
                  src={isSampleSite ? '/sandbox/sample-website/index.html' : undefined}
                  srcDoc={isSampleSite ? undefined : content}
                  title={a.title || 'HTML Application'}
                  sandbox="allow-scripts allow-forms"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: C.text,
                  fontFamily: "'DM Sans', sans-serif",
                  maxHeight: expanded ? '65vh' : 220,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 4,
                  padding: '10px 12px',
                  border: `1px solid ${C.border}`,
                }}
              >
                {renderStyledMarkdown(content, handleToggleTodo)}
              </div>
            )
          ) : (
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.55,
                color: C.text,
                fontFamily: MONO,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: expanded ? '65vh' : 220,
                overflow: 'auto',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 4,
                padding: '10px 12px',
                border: `1px solid ${C.border}`,
              }}
            >
              {content}
            </pre>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {content.length > 400 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  style={{ ...iconBtn, fontSize: 9, letterSpacing: '0.14em', fontFamily: MONO, color: C.cyan }}
                >
                  {expanded ? 'COLLAPSE' : 'EXPAND'}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setViewMode(viewMode === 'compiled' ? 'raw' : 'compiled'); }}
                style={{ ...iconBtn, fontSize: 9, letterSpacing: '0.14em', fontFamily: MONO, color: C.dim }}
              >
                {viewMode === 'compiled' ? 'RAW' : 'COMPILED'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                style={{ ...iconBtn, fontSize: 9, letterSpacing: '0.14em', fontFamily: MONO, color: C.green }}
              >
                EDIT IN PLACE
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {docxUrl && (
                <a
                  href={docxUrl}
                  download
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 9,
                    fontFamily: MONO,
                    color: '#38bdf8',
                    textDecoration: 'none',
                    padding: '2px 6px',
                    borderRadius: 3,
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    background: 'rgba(56, 189, 248, 0.08)',
                  }}
                >
                  DOWNLOAD .DOCX
                </a>
              )}
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 9,
                    fontFamily: MONO,
                    color: '#a78bfa',
                    textDecoration: 'none',
                    padding: '2px 6px',
                    borderRadius: 3,
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                    background: 'rgba(167, 139, 250, 0.08)',
                  }}
                >
                  VIEW PDF
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FeedBody({ a }: { a: FeedArtifact }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {a.items.slice(0, 8).map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE_COLOR[it.tone || 'info'] || C.cyan, flexShrink: 0 }} />
          <span style={{ color: C.dim, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <span style={{ color: C.text, fontFamily: MONO, fontSize: 10.5 }}>{it.value}</span>
        </div>
      ))}
      {a.items.length > 8 && (
        <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, letterSpacing: '0.14em', marginTop: 2 }}>
          +{a.items.length - 8} MORE
        </div>
      )}
    </div>
  );
}

function MapBody({ a, onOpenGlobe }: { a: Extract<CortexArtifact, { kind: 'map' }>; onOpenGlobe?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        border: `1px solid ${C.borderBright}`,
        background: 'radial-gradient(circle at 35% 35%, rgba(103,232,249,0.25), rgba(4,8,14,0.8))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: C.cyan,
      }}>◎</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {a.summary || 'Map view updated'}
        </div>
        <div style={{ fontSize: 9, color: C.dim, fontFamily: MONO, letterSpacing: '0.16em', marginTop: 2 }}>
          GLOBE // LIVE VIEW
        </div>
      </div>
      {onOpenGlobe && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenGlobe(); }}
          style={{
            ...iconBtn, border: `1px solid ${C.border}`, borderRadius: 4, padding: '5px 10px',
            fontSize: 9, letterSpacing: '0.2em', fontFamily: MONO, color: C.cyan,
          }}
        >OPEN</button>
      )}
    </div>
  );
}

export function ArtifactRenderer({
  artifact, onExpand, onPin, onClose, onOpenGlobe, compact, fitHeight, fitSize, bare,
}: {
  artifact: CortexArtifact;
  onExpand?: (a: CortexArtifact) => void;
  onPin?: (a: CortexArtifact) => void;
  onClose?: (a: CortexArtifact) => void;
  onOpenGlobe?: (a: CortexArtifact) => void;
  compact?: boolean;
  /** Panel-constrained image fit: whole image letterboxed to this px height. */
  fitHeight?: number;
  /** Hug-panel exact image box in px (aspect-matched, no crop/letterbox). */
  fitSize?: { w: number; h: number };
  /** When true, renders body directly without outer duplicate ArtifactShell title bar */
  bare?: boolean;
}) {
  const shell = (title: string, children: React.ReactNode) => (
    bare ? <div style={{ width: '100%' }}>{children}</div> : (
      <ArtifactShell
        title={title}
        source={artifact.source}
        createdAt={artifact.createdAt}
        live={artifact.live}
        compact={compact}
        onExpand={onExpand ? () => onExpand(artifact) : undefined}
        onPin={onPin ? () => onPin(artifact) : undefined}
        onClose={onClose ? () => onClose(artifact) : undefined}
      >
        {children}
      </ArtifactShell>
    )
  );

  switch (artifact.kind) {
    case 'stat': return shell(artifact.title, <StatBody a={artifact} />);
    case 'chart': return shell(artifact.title, <ChartBody a={artifact} />);
    case 'table': return shell(artifact.title, <TableBody a={artifact} />);
    case 'image': return fitSize
      ? <ImageBody a={artifact} fitSize={fitSize} />
      : shell(artifact.title, <ImageBody a={artifact} fitHeight={fitHeight} />);
    case 'document': return shell(artifact.title, <DocumentBody a={artifact} />);
    case 'feed': return shell(artifact.title, <FeedBody a={artifact} />);
    case 'map': return shell(artifact.title, <MapBody a={artifact} onOpenGlobe={onOpenGlobe ? () => onOpenGlobe(artifact) : undefined} />);
    default: return null;
  }
}

export default ArtifactRenderer;

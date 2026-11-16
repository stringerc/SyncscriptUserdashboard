import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, X, Volume2, ArrowDown } from 'lucide-react';
import {
  C, preprocessMarkdown, cortexMarkdownComponents,
  type ChatMessage,
} from './cortex-demo-helpers';
import type { CortexArtifact } from '../../lib/cortex-artifacts';

const ArtifactRenderer = lazy(() => import('./artifacts/ArtifactRenderer'));
import { useCortexChatMessages, setCortexChatMessages, getCortexChatSnapshot } from '../../lib/cortex-chat-store';
import type { CortexSignalBusPayload } from './CortexVisualizer';
import { fetchCartesiaTtsAudio } from '../../utils/cartesia-tts';

const DRAWER_CSS = `
  @keyframes cx-drawer-in {
    from { transform: translateX(48px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes cx-caret-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.15; }
  }
  @keyframes cx-shimmer-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @keyframes cx-wave-bar {
    0%, 100% { height: 4px; opacity: 0.45; }
    50% { height: 16px; opacity: 1; }
  }
  .cx-drawer-scroll::-webkit-scrollbar { width: 5px; }
  .cx-drawer-scroll::-webkit-scrollbar-thumb { background: rgba(148,233,255,0.18); border-radius: 3px; }
`;

const STATE_LABEL: Record<string, { label: string; color: string }> = {
  idle: { label: 'STANDBY', color: '#67e8f9' },
  listening: { label: 'LISTENING', color: '#34d399' },
  thinking: { label: 'PROCESSING', color: '#a78bfa' },
  speaking: { label: 'SPEAKING', color: '#67e8f9' },
  working: { label: 'WORKING', color: '#e879f9' },
};

function InlineProcessingBubble({ payload }: { payload: CortexSignalBusPayload }) {
  const isWorking = payload.state === 'working';
  const color = isWorking ? '#e879f9' : '#a78bfa';
  const badgeLabel = isWorking ? 'WORKING' : 'PROCESSING';
  const statusText = payload.text || (isWorking ? 'Executing system tools…' : 'Synthesizing response…');

  return (
    <div style={{ marginBottom: 14 }} className="cx-drawer-msg cx-inline-processing">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.28em',
          color: C.cyan,
          fontFamily: '"IBM Plex Mono", monospace',
        }}>
          CORTEX
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', borderRadius: 10,
          background: `${color}18`, border: `1px solid ${color}44`,
          fontSize: 8.5, fontWeight: 700, letterSpacing: '0.2em',
          color: color, fontFamily: '"IBM Plex Mono", monospace',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: color, boxShadow: `0 0 6px ${color}`,
            animation: 'pulse 1s infinite',
          }} />
          {badgeLabel}
        </span>
        {payload.tool && (
          <span style={{
            fontSize: 8.5, padding: '1px 5px', borderRadius: 2,
            background: 'rgba(232,121,249,0.18)', border: '1px solid rgba(232,121,249,0.45)',
            color: '#f0abfc', fontFamily: '"IBM Plex Mono", monospace', letterSpacing: '0.08em',
          }}>
            {payload.tool}()
          </span>
        )}
      </div>

      <div style={{
        padding: '10px 14px', borderRadius: 10,
        background: `linear-gradient(135deg, ${color}14, rgba(4,8,14,0.7) 65%)`,
        border: `1px solid ${color}35`,
        boxShadow: `0 4px 20px ${color}14`,
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Shimmer line across top border */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: 1,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation: 'cx-shimmer-slide 2.2s infinite ease-in-out',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Animated 3-bar audio/computation waveform */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 16 }}>
            <span style={{ width: 3, borderRadius: 2, background: color, animation: 'cx-wave-bar 0.9s infinite ease-in-out', animationDelay: '0ms' }} />
            <span style={{ width: 3, borderRadius: 2, background: color, animation: 'cx-wave-bar 0.9s infinite ease-in-out', animationDelay: '180ms' }} />
            <span style={{ width: 3, borderRadius: 2, background: color, animation: 'cx-wave-bar 0.9s infinite ease-in-out', animationDelay: '360ms' }} />
          </div>

          <div style={{
            fontSize: 12.5, lineHeight: 1.5,
            color: '#e8fbff', fontFamily: '"IBM Plex Mono", monospace',
            display: 'flex', alignItems: 'center', gap: 4, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span>{statusText}</span>
            <span style={{ color, animation: 'cx-caret-blink 0.8s infinite' }}>▌</span>
          </div>
        </div>

        {/* Real-time thought stream ticker */}
        {payload.thought && (
          <div style={{
            fontSize: 9.5, color: '#bae6fd', fontFamily: '"IBM Plex Mono", monospace',
            background: 'rgba(2, 6, 23, 0.7)', padding: '3px 8px', borderRadius: 3,
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex', gap: 6, alignItems: 'center',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#38bdf8', fontWeight: 700, letterSpacing: '0.1em' }}>THOUGHT:</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload.thought}</span>
            <span style={{ color: '#38bdf8' }}>▮</span>
          </div>
        )}

        {/* Cognitive Multi-Stage Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, height: 4, background: 'rgba(15,23,42,0.85)', borderRadius: 2,
            border: `1px solid ${color}35`, overflow: 'hidden',
          }}>
            {typeof payload.missionProgress === 'number' && payload.missionProgress >= 0 ? (
              <div style={{
                width: `${Math.round(payload.missionProgress * 100)}%`, height: '100%',
                background: `linear-gradient(90deg, #38bdf8, ${color})`,
                transition: 'width 0.4s ease',
              }} />
            ) : (
              <div style={{
                width: '40%', height: '100%',
                background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                animation: 'cx-shimmer-slide 1.4s infinite ease-in-out',
              }} />
            )}
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', fontFamily: '"IBM Plex Mono", monospace',
          }}>
            {typeof payload.missionProgress === 'number' && payload.missionProgress >= 0
              ? `${Math.round(payload.missionProgress * 100)}%`
              : isWorking ? '70%' : '35%'}
          </span>
        </div>
      </div>
    </div>
  );
}

const stripMarkdown = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Split long replies into TTS-sized chunks on sentence boundaries so playback
// reads the ENTIRE message — matching what Cortex speaks live.
const chunkForSpeech = (text: string, size = 1800): string[] => {
  if (text.length <= size) return text ? [text] : [];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('. ', size);
    if (cut < size * 0.5) cut = rest.lastIndexOf(' ', size);
    if (cut < size * 0.4) cut = size;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
};

interface TranscriptMessageProps {
  msg: ChatMessage;
  speaking: boolean;
  onSpeak: (msgId: string, text: string) => void;
}

function TranscriptMessage({ msg, speaking, onSpeak }: TranscriptMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const isAi = msg.role === 'ai' || msg.role === 'cortex';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { }
  };

  if (msg.role === 'system' || msg.role === 'tool') {
    return (
      <div style={{ marginBottom: 10, opacity: 0.75 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.24em', color: C.dim, marginBottom: 3 }}>
          {msg.role === 'tool' ? '◈ TOOL' : '◈ SYSTEM'}
        </div>
        <div style={{ fontSize: 11, color: C.dim, fontFamily: '"IBM Plex Mono", monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg.content.slice(0, 600)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }} className="cx-drawer-msg">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.28em',
          color: isUser ? 'rgba(148,233,255,0.55)' : C.cyan,
          fontFamily: '"IBM Plex Mono", monospace',
        }}>
          {isUser ? 'YOU' : 'CORTEX'}
        </span>
        {msg.streaming && (
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: C.cyan,
            boxShadow: `0 0 6px ${C.cyan}`, animation: 'pulse 1s infinite',
          }} />
        )}
        {isAi && !msg.streaming && (
          <button
            onClick={() => onSpeak(msg.id, msg.content)}
            title={speaking ? 'Stop playback' : 'Play response aloud'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: speaking ? '#67e8f9' : 'rgba(148,233,255,0.4)', padding: 2,
              display: 'flex', alignItems: 'center',
            }}
          >
            <Volume2 size={11} />
          </button>
        )}
        <button
          onClick={copy}
          title="Copy"
          style={{
            marginLeft: isAi && !msg.streaming ? 0 : 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: copied ? '#34d399' : 'rgba(148,233,255,0.4)', padding: 2,
            display: 'flex', alignItems: 'center',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>
      {isUser ? (
        <div style={{
          display: 'inline-block', maxWidth: '92%',
          background: 'rgba(148,233,255,0.08)',
          border: '1px solid rgba(148,233,255,0.16)',
          borderRadius: '12px 12px 3px 12px',
          padding: '8px 12px',
          fontSize: 13, lineHeight: 1.55, color: C.user,
        }}>
          {msg.content}
        </div>
      ) : (
        <div style={{
          fontSize: 13.5, lineHeight: 1.65, color: C.ai,
          padding: '10px 14px', borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(103,232,249,0.05), rgba(167,139,250,0.03) 55%, transparent)',
          border: '1px solid rgba(148,233,255,0.10)',
        }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={cortexMarkdownComponents}>
            {preprocessMarkdown(msg.content)}
          </ReactMarkdown>
          {!msg.streaming && msg.meta?.artifacts && msg.meta.artifacts.length > 0 && (
            <Suspense fallback={null}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {msg.meta.artifacts.map((a: CortexArtifact) => (
                  <ArtifactRenderer
                    key={a.id}
                    artifact={a}
                    compact
                    onExpand={(art) => window.dispatchEvent(new CustomEvent('cortex-open-artifact', { detail: art }))}
                    onPin={(art) => window.dispatchEvent(new CustomEvent('cortex-pin-artifact', { detail: art }))}
                  />
                ))}
              </div>
            </Suspense>
          )}
          {msg.streaming && msg.content && (
            <span style={{ display: 'inline-block', width: 8, height: 15, background: C.cortex, borderRadius: 1, marginLeft: 2, verticalAlign: 'middle', animation: 'cx-caret-blink 0.9s steps(1) infinite' }} />
          )}
        </div>
      )}
    </div>
  );
}

interface CortexChatDrawerProps {
  open: boolean;
  onClose: () => void;
  payload: CortexSignalBusPayload;
  onSubmitText?: (text: string) => void;
}

export function CortexChatDrawer({ open, onClose, payload, onSubmitText }: CortexChatDrawerProps) {
  const messages = useCortexChatMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechCancelRef = useRef<(() => void) | null>(null);
  const st = STATE_LABEL[payload.state] ?? STATE_LABEL.idle;
  const hydratedRef = useRef(false);
  const hydrateAttemptsRef = useRef(0);

  // Merge server-side history (disk backup) into the store by id — runs once
  // per mount, and retries (max 3) whenever the drawer opens with an empty
  // transcript, so a proxy restart mid-fetch doesn't lose the session.
  const hydrate = () => {
    if (hydratedRef.current && hydrateAttemptsRef.current > 0) return;
    if (hydrateAttemptsRef.current >= 3) return;
    hydrateAttemptsRef.current += 1;
    fetch('/api/cortex/chat-history', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        hydratedRef.current = true;
        const msgs = Array.isArray(d?.messages) ? d.messages : [];
        if (!msgs.length) return;
        const current = getCortexChatSnapshot().messages;
        const existingIds = new Set(current.map((m) => m.id));
        const newHistory = msgs
          .filter((m: any) => !existingIds.has(m.id))
          .map((m: any) => ({ ...m, streaming: false }));
        if (newHistory.length) {
          // Server holds the durable tail — prepend anything we're missing.
          setCortexChatMessages([...newHistory, ...current]);
        }
      })
      .catch(() => { /* retry on next open */ });
  };

  useEffect(() => {
    if (hydratedRef.current) return;
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-attempt hydration when the drawer opens and the transcript is empty
  // (e.g. first fetch raced a proxy restart).
  useEffect(() => {
    if (open && messages.length === 0) hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isCortexBusy = payload.state === 'thinking' || payload.state === 'working';
  const lastMsg = messages[messages.length - 1];
  const isStreamingWithoutContent = Boolean(lastMsg && lastMsg.streaming && !lastMsg.content);
  const isWaitingAfterUser = Boolean(lastMsg && lastMsg.role === 'user');
  const isProcessing = isCortexBusy || isStreamingWithoutContent || isWaitingAfterUser;

  // Auto-scroll on new content / streaming growth / state transitions
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom || isWaitingAfterUser) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, open, payload.text, payload.state, isProcessing, isWaitingAfterUser]);

  // Stop any in-flight playback when the drawer closes
  useEffect(() => {
    if (open) return;
    speechCancelRef.current?.();
    speechCancelRef.current = null;
    audioRef.current?.pause();
    speechSynthesis.cancel();
    setSpeakingId(null);
  }, [open]);

  useEffect(() => () => {
    speechCancelRef.current?.();
    audioRef.current?.pause();
    speechSynthesis.cancel();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const stopSpeech = () => {
    speechCancelRef.current?.();
    speechCancelRef.current = null;
    audioRef.current?.pause();
    setSpeakingId(null);
  };

  const handleSpeak = async (msgId: string, rawText: string) => {
    if (speakingId === msgId) { stopSpeech(); return; }
    stopSpeech();
    const text = stripMarkdown(rawText);
    const chunks = chunkForSpeech(text);
    if (!chunks.length) return;
    const urls: string[] = [];
    let idx = 0;
    let dead = false;
    speechCancelRef.current = () => {
      dead = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.length = 0;
    };
    const cleanup = () => {
      if (speechCancelRef.current) { speechCancelRef.current(); speechCancelRef.current = null; }
      setSpeakingId(null);
    };
    const playNext = async () => {
      if (dead) return;
      if (idx >= chunks.length) { cleanup(); return; }
      try {
        // Same voice path as live Cortex speech: Cartesia Sonic cortana →
        // speakStreamSentence falls back to Kokoro internally.
        const blob = await fetchCartesiaTtsAudio(chunks[idx], { voiceId: 'cortana' });
        if (!blob || blob.size < 100) throw new Error('tts empty');
        if (dead) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { idx += 1; void playNext(); };
        audio.onerror = () => { idx += 1; void playNext(); };
        await audio.play();
      } catch {
        if (dead) return;
        // Cartesia unavailable — try the server TTS chain (Pocket Cortana clone)
        // before degrading to browser speech.
        try {
          const res = await fetch('/api/cortex/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunks[idx], voice: 'cortana' }),
          });
          if (res.ok) {
            const blob2 = await res.blob();
            if (blob2.size > 200) {
              const url2 = URL.createObjectURL(blob2);
              urls.push(url2);
              const audio2 = new Audio(url2);
              audioRef.current = audio2;
              audio2.onended = () => { idx += 1; void playNext(); };
              audio2.onerror = () => { idx += 1; void playNext(); };
              await audio2.play();
              return;
            }
          }
        } catch { }
        // TTS unreachable — read the remainder via browser speech, whole reply
        const rest = chunks.slice(idx).join(' ');
        try {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(rest.slice(0, 4000));
          u.rate = 1.02;
          u.onend = cleanup;
          speechSynthesis.speak(u);
        } catch { cleanup(); }
      }
    };
    setSpeakingId(msgId);
    void playNext();
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
  };

  if (!open) return null;

  const submitDraft = () => {
    const q = draft.trim();
    if (!q) return;
    setDraft('');
    if (onSubmitText) {
      onSubmitText(q);
    } else {
      window.location.href = `/cortex/chat?q=${encodeURIComponent(q)}`;
    }
  };

  return (
    <div
      data-cortex-chat-drawer=""
      role="dialog"
      aria-modal="true"
      aria-label="Cortex Uplink Chat"
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(400px, 88vw)',
        zIndex: 30, display: 'flex', flexDirection: 'column',
        background: 'rgba(3,4,10,0.92)',
        borderLeft: `1px solid ${C.borderBright}55`,
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        boxShadow: '-24px 0 60px rgba(0,0,0,0.55), inset 1px 0 0 rgba(148,233,255,0.06)',
        animation: 'cx-drawer-in 0.35s cubic-bezier(0.16,1,0.3,1) both',
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
      }}>
      <style>{DRAWER_CSS}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, boxShadow: `0 0 8px ${st.color}`, animation: 'pulse 1.6s infinite' }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: C.cyan, fontFamily: '"IBM Plex Mono", monospace' }}>
          CORTEX // UPLINK
        </span>
        <span style={{ fontSize: 9, letterSpacing: '0.22em', color: st.color, fontFamily: '"IBM Plex Mono", monospace' }}>
          {st.label}
        </span>
        <div style={{ flex: 1 }} />
        <a
          href="/cortex/chat"
          style={{
            textDecoration: 'none', padding: '4px 10px', borderRadius: 2,
            border: `1px solid ${C.borderBright}`, color: C.cyan,
            fontSize: 9, fontWeight: 600, letterSpacing: '0.2em',
            fontFamily: '"IBM Plex Mono", monospace',
            transition: 'all 0.2s',
          }}
        >
          FULL CHAT →
        </a>
        <button
          onClick={onClose}
          title="Close transcript"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.dim, padding: 4, display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Transcript */}
      <div className="cx-drawer-scroll" style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {messages.length === 0 && !isProcessing ? (
          <div style={{ padding: '40px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.34em', color: C.dim, marginBottom: 8 }}>— SILENT CHANNEL —</div>
            <div style={{ fontSize: 12, color: 'rgba(232,251,255,0.6)', lineHeight: 1.7 }}>
              No transcript yet. Speak or open full chat — everything Cortex says appears here live.
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <TranscriptMessage
                key={m.id}
                msg={m}
                speaking={speakingId === m.id}
                onSpeak={handleSpeak}
              />
            ))}
            {isProcessing && <InlineProcessingBubble payload={payload} />}
          </>
        )}
        </div>
        {showJump && (
          <button
            onClick={scrollToBottom}
            title="Jump to latest"
            style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 12, cursor: 'pointer',
              background: 'rgba(4,8,14,0.85)', border: `1px solid ${C.borderBright}`,
              color: C.cyan, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
              fontFamily: '"IBM Plex Mono", monospace',
              backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <ArrowDown size={10} /> LATEST
          </button>
        )}
      </div>

      {/* Live caption — what Cortex is saying right now */}
      <div style={{
        padding: '10px 16px',
        borderTop: `1px solid ${C.border}`,
        background: 'rgba(4,8,14,0.6)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 8, letterSpacing: '0.32em', color: 'rgba(148,233,255,0.4)', marginBottom: 5 }}>
          ── LIVE TRANSMISSION ──
        </div>
        <div style={{
          fontSize: 12, lineHeight: 1.55, minHeight: 20,
          color: payload.text ? '#e8fbff' : 'rgba(148,233,255,0.35)',
          fontFamily: '"IBM Plex Mono", monospace',
          textShadow: payload.text ? `0 0 14px ${st.color}44` : 'none',
        }}>
          {payload.text || 'Awaiting signal'}
          {payload.text && <span style={{ color: st.color }}> ▌</span>}
        </div>
      </div>

      {/* Composer — hands off to full chat */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 14px 14px',
        borderTop: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitDraft(); }}
          placeholder="Ask Cortex — voice & tools run here…"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12,
            background: C.glass, border: `1px solid ${C.border}`,
            color: C.text, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={submitDraft}
          style={{
            padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(103,232,249,0.10)', border: `1px solid ${C.borderBright}`,
            color: C.cyan, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
            fontFamily: '"IBM Plex Mono", monospace',
          }}
        >
          SEND →
        </button>
      </div>
    </div>
  );
}

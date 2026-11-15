import React, { Suspense, lazy } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Volume2, VolumeX, Copy, Check } from 'lucide-react';
import {
  C, type ChatMessage,
  preprocessMarkdown, cortexMarkdownComponents,
  getToolMeta, getActionChipsForMessage,
} from './cortex-demo-helpers';
import type { CortexArtifact } from '../../lib/cortex-artifacts';

const ArtifactRenderer = lazy(() => import('./artifacts/ArtifactRenderer'));

interface CortexMessageListProps {
  messages: ChatMessage[];
  copiedMessageId: string | null;
  speakingMessageId: string | null;
  expandedTools: Record<string, boolean>;
  autoExpandTools: boolean;
  handleCopyMessage: (msgId: string, content: string) => void;
  handleToggleReadMessage: (msgId: string, content: string) => void;
  toggleToolExpanded: (id: string) => void;
  sendMessage: (overrideText?: string) => void;
}

// Tool results arrive as arbitrary JSON — arrays/objects must be stringified,
// never rendered as React children (web_search returns [{title,url,snippet}]).
function formatToolResultText(result: any): string {
  if (!result || typeof result !== 'object') return String(result ?? '');
  const fmtList = (arr: any[], fmt: (x: any) => string) =>
    arr.map(fmt).join('\n\n');
  if (Array.isArray(result.results)) {
    return fmtList(result.results, (r: any) =>
      typeof r === 'string' ? r : `• ${r.title ?? r.name ?? 'result'}\n  ${r.url ?? ''}\n  ${r.snippet ?? r.content ?? ''}`.trim());
  }
  if (Array.isArray(result.matches)) {
    return fmtList(result.matches, (m: any) =>
      typeof m === 'string' ? m : `• ${m.path ?? m.file ?? ''}:${m.line ?? ''}\n  ${m.text ?? m.content ?? m.snippet ?? ''}`.trim());
  }
  if (Array.isArray(result.tabs)) {
    return fmtList(result.tabs, (t: any) => `• ${t.title}\n  ${t.url}`);
  }
  for (const key of ['stdout', 'stderr', 'content', 'hotLayer', 'excerpt']) {
    if (typeof result[key] === 'string' && result[key]) return result[key];
  }
  if (result.targetTab) {
    return `✔ Focused Chrome tab: "${result.targetTab.title}"\n  ${result.targetTab.url}`;
  }
  if (result.closedCount != null) return `✔ Closed ${result.closedCount} tabs matching filter`;
  if (result.replaced) return `✔ Successfully updated ${result.path}`;
  if (result.bytesWritten != null) return `✔ Successfully wrote ${result.bytesWritten} bytes to ${result.path}`;
  if (result.episodic) return `✔ Episodic Memory (${result.action}):\n${JSON.stringify(result.episodic, null, 2)}`;
  if (result.ok === false && result.error) return `✘ ${result.error}`;
  return JSON.stringify(result, null, 2);
}

export function CortexMessageList({
  messages,
  copiedMessageId,
  speakingMessageId,
  expandedTools,
  autoExpandTools,
  handleCopyMessage,
  handleToggleReadMessage,
  toggleToolExpanded,
  sendMessage,
}: CortexMessageListProps) {
  return (
    <>
        <style>{`
          .cortex-msg .cortex-msg-actions { opacity: 0; transition: opacity 0.15s ease; }
          .cortex-msg:hover .cortex-msg-actions,
          .cortex-msg .cortex-msg-actions:focus-within,
          .cortex-msg-actions.always { opacity: 1; }
          .cortex-msg-ai {
            padding: 12px 16px;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(103,232,249,0.05), rgba(167,139,250,0.03) 55%, transparent);
            border: 1px solid rgba(148,233,255,0.10);
            box-shadow: inset 0 1px 0 rgba(232,251,255,0.03);
          }
          .cortex-msg-user { display: flex; flex-direction: column; align-items: flex-end; }
          .cortex-user-bubble {
            background: rgba(148,233,255,0.08);
            border: 1px solid rgba(148,233,255,0.16);
            border-radius: 14px;
            padding: 9px 14px;
            max-width: 85%;
            box-shadow: inset 0 1px 0 rgba(232,251,255,0.04);
          }
        `}</style>
        {messages.map((msg) => (
          <div key={msg.id} className="cortex-msg" style={{ marginBottom: 16, maxWidth: 680 }}>
            {msg.role === 'user' && (
              <div className="cortex-msg-user">
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4, width: '100%' }}>
                  <span style={{ fontSize: 10, color: C.dim }}>You</span>
                  <button
                    id={`copy-user-btn-${msg.id}`}
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    title="Copy message to clipboard"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: 'none',
                      color: copiedMessageId === msg.id ? '#34d399' : C.dim,
                      fontSize: 10,
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: 4,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = copiedMessageId === msg.id ? '#34d399' : '#e2e8f0';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = copiedMessageId === msg.id ? '#34d399' : C.dim;
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    {copiedMessageId === msg.id ? (
                      <>
                        <Check size={11} className="text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="cortex-user-bubble" style={{ fontSize: 14, color: C.user }}>{msg.content}</div>
              </div>
            )}

            {msg.role === 'ai' && (
              <div className="cortex-msg-ai">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    color: msg.streaming ? (msg.content ? C.cortex : '#c084fc') : '#94a3b8',
                  }}>
                    {msg.streaming && !msg.content ? (
                      <>
                        <span style={{
                          display: 'inline-block',
                          width: 6, height: 6,
                          borderRadius: '50%',
                          background: '#c084fc',
                          boxShadow: '0 0 6px #c084fc',
                          animation: 'pulse 1.2s infinite',
                        }} />
                        <span>Thinking...</span>
                      </>
                    ) : msg.streaming ? (
                      <>
                        <span style={{
                          display: 'inline-block',
                          width: 6, height: 6,
                          borderRadius: '50%',
                          background: C.cortex,
                          boxShadow: `0 0 6px ${C.cortex}`,
                          animation: 'pulse 1s infinite',
                        }} />
                        <span>CORTEX</span>
                      </>
                    ) : (
                      <span>CORTEX</span>
                    )}
                  </span>

                  {msg.meta && !msg.streaming && (
                    <span style={{
                      fontFamily: '"IBM Plex Mono", "SF Mono", monospace', fontSize: 9,
                      color: (msg.meta.realityScore ?? 1) > 0.5 ? C.green
                        : (msg.meta.realityScore ?? 1) > 0.3 ? C.amber : C.red,
                    }}>
                      ◉ {msg.meta.realityScore != null ? `${Math.round(msg.meta.realityScore * 100)}%` : ''}
                      {msg.meta.source && <span style={{ color: C.dim }}> · {msg.meta.source}</span>}
                    </span>
                  )}
                  {msg.streaming && msg.content && (
                    <span style={{
                      width: 4, height: 13,
                      background: C.cortex,
                      borderRadius: 1,
                      animation: 'blink 0.8s infinite',
                      display: 'inline-block',
                      verticalAlign: 'middle',
                    }} />
                  )}
                </div>
                <div style={{ fontSize: 14, color: C.ai }}>
                  {msg.streaming && !msg.content ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      padding: '12px 16px',
                      borderRadius: 8,
                      background: 'rgba(139, 92, 246, 0.06)',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      backdropFilter: 'blur(8px)',
                      margin: '6px 0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 18 }}>
                          <span style={{ width: 3, height: 14, background: '#c084fc', borderRadius: 2, animation: 'waveBounce 1s ease-in-out infinite' }} />
                          <span style={{ width: 3, height: 18, background: '#38bdf8', borderRadius: 2, animation: 'waveBounce 1s ease-in-out 0.2s infinite' }} />
                          <span style={{ width: 3, height: 10, background: '#a78bfa', borderRadius: 2, animation: 'waveBounce 1s ease-in-out 0.4s infinite' }} />
                        </div>
                        <span style={{
                          fontSize: 12,
                          color: '#c084fc',
                          fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                          letterSpacing: '0.02em',
                        }}>
                          Deliberating in Global Workspace (40Hz Gamma · Φ 1.24)...
                        </span>
                      </div>
                      <div style={{
                        width: '85%', height: 7, borderRadius: 4,
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(192,132,252,0.25) 50%, rgba(255,255,255,0.03) 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.8s infinite',
                      }} />
                      <div style={{
                        width: '60%', height: 7, borderRadius: 4,
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(56,189,248,0.25) 50%, rgba(255,255,255,0.03) 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.8s infinite 0.3s',
                      }} />
                    </div>
                  ) : !msg.content ? (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <span>⚠️ Cognitive stream produced an empty response.</span>
                      <button
                        onClick={() => sendMessage()}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          borderRadius: 4,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={cortexMarkdownComponents}
                      >
                        {preprocessMarkdown(msg.content)}
                      </ReactMarkdown>

                      {/* Generative UI artifacts */}
                      {!msg.streaming && msg.meta?.artifacts && msg.meta.artifacts.length > 0 && (
                        <Suspense fallback={null}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginTop: 10 }}>
                            {msg.meta.artifacts.map((a: CortexArtifact) => (
                              <ArtifactRenderer
                                key={a.id}
                                artifact={a}
                                onExpand={(art) => window.dispatchEvent(new CustomEvent('cortex-open-artifact', { detail: art }))}
                                onPin={(art) => window.dispatchEvent(new CustomEvent('cortex-pin-artifact', { detail: art }))}
                              />
                            ))}
                          </div>
                        </Suspense>
                      )}

                      {/* Interactive 1-Click Action Chips */}
                      {!msg.streaming && msg.content && (() => {
                        const isLastAi = messages.filter(m => m.role === 'ai').slice(-1)[0]?.id === msg.id;
                        const chips = getActionChipsForMessage(msg.content, isLastAi);
                        if (chips.length === 0) return null;
                        return (
                          <div
                            className="cortex-action-chips"
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 6,
                              marginTop: 10,
                              paddingTop: 8,
                              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            }}
                          >
                            {chips.map(chip => (
                              <button
                                key={chip.id}
                                id={`action-chip-${chip.id}`}
                                data-action={chip.prompt}
                                onClick={() => sendMessage(chip.prompt)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 10px',
                                  borderRadius: 16,
                                  fontSize: 11,
                                  fontWeight: 500,
                                  fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  border: `1px solid ${chip.color ? `${chip.color}40` : 'rgba(255, 255, 255, 0.12)'}`,
                                  color: chip.color || '#e2e8f0',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = chip.color ? `${chip.color}18` : 'rgba(255, 255, 255, 0.08)';
                                  e.currentTarget.style.borderColor = chip.color ? `${chip.color}90` : 'rgba(255, 255, 255, 0.25)';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                  e.currentTarget.style.borderColor = chip.color ? `${chip.color}40` : 'rgba(255, 255, 255, 0.12)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <span>{chip.icon}</span>
                                <span>{chip.label}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Response Utility Toolbar: hover-reveal icon actions */}
                      {!msg.streaming && msg.content && (
                        <div
                          className={`cortex-msg-actions${speakingMessageId === msg.id ? ' always' : ''}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 8,
                          }}
                        >
                          <button
                            id={`read-response-btn-${msg.id}`}
                            onClick={() => handleToggleReadMessage(msg.id, msg.content)}
                            title={speakingMessageId === msg.id ? 'Stop reading aloud' : 'Read response aloud'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 26, height: 26,
                              borderRadius: 6,
                              background: speakingMessageId === msg.id ? 'rgba(103, 232, 249, 0.16)' : 'transparent',
                              border: `1px solid ${speakingMessageId === msg.id ? 'rgba(103, 232, 249, 0.45)' : 'transparent'}`,
                              color: speakingMessageId === msg.id ? '#38bdf8' : '#64748b',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {speakingMessageId === msg.id ? (
                              <VolumeX size={13} className="text-cyan-400 animate-pulse" />
                            ) : (
                              <Volume2 size={13} />
                            )}
                          </button>
                          <button
                            id={`copy-response-btn-${msg.id}`}
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            title={copiedMessageId === msg.id ? 'Copied' : 'Copy response'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 26, height: 26,
                              borderRadius: 6,
                              background: copiedMessageId === msg.id ? 'rgba(16, 185, 129, 0.14)' : 'transparent',
                              border: `1px solid ${copiedMessageId === msg.id ? 'rgba(16, 185, 129, 0.4)' : 'transparent'}`,
                              color: copiedMessageId === msg.id ? '#34d399' : '#64748b',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {copiedMessageId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {msg.role === 'tool' && msg.meta?.toolExecution && (() => {
              const isExpanded = autoExpandTools || Boolean(expandedTools[msg.id]);
              const meta = getToolMeta(msg.meta.toolExecution.tool, msg.meta.toolExecution.args);
              const status = msg.meta.toolExecution.status;
              const isSuccess = status === 'completed' && msg.meta.toolExecution.result?.ok !== false;
              const isFail = status === 'failed' || msg.meta.toolExecution.result?.ok === false;

              return (
                <div style={{
                  margin: '6px 0 12px 0',
                  maxWidth: 680,
                  background: 'rgba(17, 17, 19, 0.75)',
                  border: `1px solid ${isSuccess ? 'rgba(34, 197, 94, 0.25)' : isFail ? 'rgba(239, 68, 68, 0.3)' : 'rgba(103, 232, 249, 0.3)'}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                }}>
                  {/* Sleek Action Pill Header */}
                  <div
                    onClick={() => toggleToolExpanded(msg.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 12px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isExpanded ? 'rgba(22, 22, 26, 0.95)' : 'rgba(22, 22, 26, 0.5)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 13 }}>{meta.icon}</span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: isSuccess ? '#e4e4e7' : isFail ? '#f87171' : C.cortex,
                      }}>
                        {meta.title}
                      </span>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isSuccess ? C.green : isFail ? C.red : C.cortex,
                        boxShadow: `0 0 6px ${isSuccess ? C.green : C.cortex}`,
                        display: 'inline-block',
                      }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {msg.meta.toolExecution.durationMs != null && (
                        <span style={{
                          fontSize: 10,
                          fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                          color: '#71717a',
                        }}>
                          {msg.meta.toolExecution.durationMs}ms
                        </span>
                      )}
                      <span style={{
                        fontSize: 9,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: 'rgba(103, 232, 249, 0.1)',
                        color: C.cortex,
                        border: `1px solid ${C.cortex}33`,
                        fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                      }}>
                        Φ {msg.meta.toolExecution.phi?.toFixed(2) ?? '1.24'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleToolExpanded(msg.id);
                        }}
                        style={{
                          background: isExpanded ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 4,
                          color: isExpanded ? C.cortex : '#a1a1aa',
                          fontSize: 10,
                          padding: '2px 7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                        }}
                      >
                        {isExpanded ? 'Details ▴' : 'Details ▾'}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Inspection Drawer */}
                  {isExpanded && (
                    <div style={{
                      padding: '10px 12px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      background: '#09090b',
                      fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                    }}>
                      {msg.meta.toolExecution.args?.command && (
                        <div style={{ color: '#a1a1aa', fontSize: 11, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: C.green }}>$</span>
                          <span style={{ color: '#f4f4f5' }}>{String(msg.meta.toolExecution.args.command)}</span>
                        </div>
                      )}
                      {msg.meta.toolExecution.result?.diff ? (
                        <div style={{
                          margin: '2px 0 6px 0',
                          padding: 10,
                          background: '#040405',
                          borderRadius: 6,
                          border: '1px solid #1c1c20',
                          fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                          fontSize: 11,
                        }}>
                          <div style={{ color: '#a1a1aa', fontSize: 10, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>📄 Diff Applied: <strong style={{ color: '#f4f4f5' }}>{msg.meta.toolExecution.result.diff.path}</strong></span>
                            <span style={{ color: C.green, fontSize: 10, fontWeight: 600 }}>✔ Replaced</span>
                          </div>
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderLeft: '3px solid #ef4444',
                            padding: '6px 8px',
                            margin: '4px 0',
                            color: '#fca5a5',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: 120,
                            overflowY: 'auto',
                          }}>
                            <div style={{ fontSize: 9, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>- Target Removed:</div>
                            {msg.meta.toolExecution.result.diff.targetContent}
                          </div>
                          <div style={{
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderLeft: '3px solid #22c55e',
                            padding: '6px 8px',
                            margin: '4px 0',
                            color: '#86efac',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: 120,
                            overflowY: 'auto',
                          }}>
                            <div style={{ fontSize: 9, color: '#4ade80', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>+ Replacement Inserted:</div>
                            {msg.meta.toolExecution.result.diff.replacementContent}
                          </div>
                        </div>
                      ) : (
                        msg.meta.toolExecution.result && (
                          <pre style={{
                            margin: 0,
                            padding: 10,
                            background: '#040405',
                            borderRadius: 5,
                            border: '1px solid #1c1c20',
                            color: isSuccess ? '#e4e4e7' : '#f87171',
                            fontSize: 11,
                            lineHeight: 1.5,
                            maxHeight: 220,
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}>
                            {formatToolResultText(msg.meta.toolExecution.result)}
                          </pre>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {(msg.role === 'cortex' || msg.role === 'system') && (
              <div style={{
                padding: '10px 14px', marginLeft: msg.role === 'cortex' ? 16 : 0, borderRadius: 8,
                background: msg.content.startsWith('⛔') ? 'rgba(239,68,68,0.06)'
                  : msg.content.startsWith('⚠') ? 'rgba(245,158,11,0.06)'
                  : msg.content.startsWith('🛡') ? 'rgba(124,58,237,0.06)'
                  : 'rgba(103,232,249,0.06)',
                borderLeft: `2px solid ${
                  msg.content.startsWith('⛔') ? C.red
                    : msg.content.startsWith('⚠') ? C.amber
                    : msg.content.startsWith('🛡') ? C.purple
                    : msg.content.startsWith('🧠') ? C.green
                    : C.cortex
                }`,
                fontSize: 13,
                color: msg.content.startsWith('⛔') ? C.red
                  : msg.content.startsWith('⚠') ? C.amber
                  : msg.content.startsWith('❌') ? C.red
                  : C.ai,
                lineHeight: 1.5,
              }}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
    </>
  );
}

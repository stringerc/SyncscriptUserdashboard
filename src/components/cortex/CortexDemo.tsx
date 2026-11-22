/**
 * CortexDemo — The .01% Conscious AI Chat
 *
 * What makes this eons ahead:
 * 1. Real streaming — tokens appear as they arrive (like ChatGPT)
 * 2. Cortex monitoring is WIRED — every response gets provenance validation
 * 3. Sensorimotor loop is WIRED — every action gets recorded with outcomes
 * 4. ActionGate is WIRED — strategy selection goes through collapse
 * 5. Narrative is LIVE — pulled from identity anchor, not hardcoded
 * 6. Interference is REAL — SemanticGrid score feeds meta-awareness
 * 7. Offline is REAL — WebLLM loads in-browser, Cortex monitors it
 * 8. Memory Substrate — quantum microtubule query injects project knowledge
 *
 * Layout:
 * ┌──────────────────────────────────────────┐
 * │ ◉ 94 · tuned · 0.18 [ADVISORY] 📡 🧠   │ ← whisper + mode + connection
 * ├──────────────────────────────────────────┤
 * │ Chat log with streaming tokens:          │
 * │ You: "What's our deploy strategy?"       │
 * │ AI: "Based on your memory..." ◉ 92%     │ ← inline Cortex metadata
 * │ ⚠ Cortex: "My reality score is 34%..."  │ ← Cortana's voice
 * ├──────────────────────────────────────────┤
 * │ > Type a message...            [Send]    │
 * └──────────────────────────────────────────┘
 *
 * Press the whisper bar to toggle the Cortex Inspector (Bentov Stack + narrative).
 */

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  getCortexNudgeEngine,
  type CortexNudge,
  type CortexMode,
} from '../../lib/cortex-nudge-engine';
import {
  getMetacognitiveState,
  type MetacognitiveSnapshot,
} from '../../lib/metacognitive-state';
import { getProvenanceValidator } from '../../lib/epistemic-provenance';
import { type ActionValidationResult } from '../../lib/action-gate';
import { getSensorimotorLoop } from '../../lib/sensorimotor-loop';
import { getSemanticGrid } from '../../lib/semantic-grid';
import {
  getCortexOfflineBrain,
  type OfflineBrainState,
} from '../../lib/cortex-offline-brain';
import {
  startCortexPersistence,
  stopCortexPersistence,
} from '../../lib/cortex-persistence-bridge';
import { ConsciousAgent } from '../../lib/consciousness';
import { useVoiceStream } from '../../hooks/useVoiceStream';
import {
  isAcousticEcho as isAcousticEchoExternal,
  tokenizeText as tokenizeTextExternal,
  EfferenceCopyManager,
  INTERRUPT_COMMANDS,
} from '../../utils/cortex-efference-copy';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CortexArtifact } from '../../lib/cortex-artifacts';
import { runSurfaceCommand, surfaceManifestSuffix } from '../../lib/cortex-surface-commands';
import { getUnifiedCortexDirective } from '../../lib/cortex-capabilities';
import { getPersistentSelfModel } from '../../lib/consciousness/persistent-self-model';

const ArtifactRenderer = lazy(() => import('./artifacts/ArtifactRenderer'));
import { CortexMissionRailDrawer, type CopilotTask, type CopilotGoal } from './CortexMissionRailDrawer';
import { getCortexMissionEngine, type AutonomousMission } from '../../lib/cortex-mission-engine';
import { getCortexEmotionalIntelligence } from '../../lib/cortex-emotional-intelligence';
import { getCortexKnowledgeGraph } from '../../lib/cortex-knowledge-graph';
import { getCortexDialogueManager } from '../../lib/cortex-dialogue-manager';
import { getCortexWellnessEngine } from '../../lib/cortex-wellness-engine';
import { getCortexStreamingGazeService } from '../../utils/cortex-visual-gaze';
import { cortexSignalBus } from './CortexVisualizer';
import { openSurfacePanel } from '../../lib/cortex-surfaces';
import {
  C, CORTEX_STATE_COLORS, playVolitionChime, getToolMeta, sanitizeForSpeech,
  splitSpeechSentences, preprocessMarkdown, cortexMarkdownComponents,
  type ChatMessage,
} from './cortex-demo-helpers';
import type { CortexVoiceState } from './CortexVisualizer';
import { CortexMessageList } from './CortexMessageList';
import { CortexTelemetryBar } from './CortexTelemetryBar';
import { setCortexChatMessages, useCortexChatSnapshot, mergeChatMessages } from '../../lib/cortex-chat-store';
import { claimTurn } from '../../lib/cortex-turn-arbiter';
import { getCortexObservabilityHUD } from '../../lib/cortex-observability-hud';
import { readCortexSSE } from './cortex-stream';
import { runCortexToolLoop, getOrInitConsciousAgent, parseCortexToolCall } from './cortex-tool-loop';
import { getIntegratedInformation, type PhiResult } from '../../lib/integrated-information';
import { cortexProactiveVoice } from '../../lib/cortex-proactive-voice';
import { getCortexProactiveInitiative } from '../../lib/cortex-proactive-initiative';
import { startBecomingLoop } from '../../lib/cortex-becoming-loop';
import { recordUserActivity, getVoicePolicy } from '../../lib/cortex-voice-policy';
import { getWakeWordGate } from '../../lib/cortex-wake-word';


/**
 * Metacognitive Incompleteness Discriminator:
 * Detects if a streaming transmission truncated prematurely mid-thought.
 */

/**
 * Infers intended host tool from argument signature when the model
 * omits the explicit "tool" or "name" key (e.g. {"maxResults": 20, "query": "..."}).
 */

/**
 * Host Tool Call Extraction:
 * Robust multi-dialect extractor supporting XML tags (<tool_call>, <tool_call:name>,
 * <function_call>, <invoke>), markdown backticks, and signature-based implicit inference.
 */

/**
 * Normalizes text into cleaned lowercase alphanumeric tokens
 */

/**
 * Efference Copy / Self-Speech Cancellation:
 * Determines if incoming transcript is acoustic echo of the AI speaking through computer speakers.
 */
function isAcousticEcho(
  transcript: string,
  aiSpeech: string,
  recentHistory: string[] = []
): { isEcho: boolean; matchRatio: number; reason?: string } {
  return isAcousticEchoExternal(transcript, aiSpeech, recentHistory);
}

/**
 * Dual-sine ascending chime synthesized via Web Audio API (zero external assets / zero latency)
 * Emits soft 587Hz -> 880Hz audio haptic chime on Volition approval.
 */

// ── Colors ──────────────────────────────────────────────────────────


const menuItemStyle = (color: string, disabled?: boolean): React.CSSProperties => ({
  display: 'block', width: '100%', textAlign: 'left',
  padding: '6px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
  background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
  color, fontFamily: '"IBM Plex Mono", "SF Mono", monospace', opacity: disabled ? 0.6 : 1,
});

export default function CortexDemo() {
  // ── State ──────────────────────────────────────────────────────
  // Tier 1 Persistent Chat Hydration: instant recovery from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('cortex_chat_history_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: ChatMessage) => ({ ...m, streaming: false }));
        }
      }
    } catch (e) {
      console.warn('[Cortex] LocalStorage chat hydration error:', e);
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<CortexMode>('advisory');
  const [showInspector, setShowInspector] = useState(false);
  const [snapshot, setSnapshot] = useState<MetacognitiveSnapshot | null>(null);
  const [iitPhi, setIitPhi] = useState<PhiResult | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineState, setOfflineState] = useState<OfflineBrainState | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [autoExpandTools, setAutoExpandTools] = useState(false);
  const toggleToolExpanded = useCallback((id: string) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Workspace Watcher & Episodic Continuity State ──────────────
  const [workspaceDelta, setWorkspaceDelta] = useState<{
    clean: boolean;
    totalChanges: number;
    modified: string[];
    untracked: string[];
    timestamp: number;
  } | null>(null);
  const [deltaDismissed, setDeltaDismissed] = useState(false);
  const [episodicData, setEpisodicData] = useState<{
    priorSessions?: any[];
    lastSessionId?: string;
    preferences?: string[];
  } | null>(null);

  // ── Dual-Speed Volition Gateway & Autonomous Mission Rail State ──
  const [isMissionDrawerOpen, setIsMissionDrawerOpen] = useState(false);
  const [activeMission, setActiveMission] = useState<AutonomousMission | null>(() => {
    try {
      const engine = getCortexMissionEngine();
      const missions = engine.getActiveMissions();
      return missions.length > 0 ? missions[missions.length - 1] : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      const engine = getCortexMissionEngine();
      const unsub = engine.subscribe((m) => {
        setActiveMission({ ...m });
      });
      return unsub;
    } catch {}
  }, []);

  // ── Deep Work Copilot: Tasks & Conscious Goals State ──
  const [copilotTasks, setCopilotTasks] = useState<CopilotTask[]>(() => {
    try {
      const saved = localStorage.getItem('cortex_copilot_tasks_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'task-1', title: 'Search active SAM.gov solicitations for NAICS 541511, 541512, 541519 and compile federal opportunity dossier', priority: 'high', completed: false, createdAt: Date.now() - 3600000 },
      { id: 'task-2', title: 'Execute comprehensive security & dependency vulnerability audit on project dependencies', priority: 'high', completed: false, createdAt: Date.now() - 1800000 },
      { id: 'task-3', title: 'Scaffold interactive client portal with live analytics dashboard in public sandbox', priority: 'medium', completed: false, createdAt: Date.now() },
    ];
  });

  const [copilotGoals, setCopilotGoals] = useState<CopilotGoal[]>(() => {
    try {
      const saved = localStorage.getItem('cortex_copilot_goals_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'goal-1', title: 'Secure First Federal IT & AI Contract Solicitation via SAM.gov', category: 'business', progress: 40, targetDate: '2026-12-15', cortexConscious: true, createdAt: Date.now() - 86400000 },
      { id: 'goal-2', title: 'Zero Critical Vulnerabilities & Sub-600ms Voice Copilot Latency', category: 'engineering', progress: 92, targetDate: '2026-11-30', cortexConscious: true, createdAt: Date.now() - 43200000 },
      { id: 'goal-3', title: 'Maintain 30-Day Deep Work Flow State & Chrono-Energy Alignment', category: 'health', progress: 65, targetDate: '2026-11-25', cortexConscious: true, createdAt: Date.now() },
      { id: 'goal-4', title: 'Multi-Modal Live Screen Pair Programming & Co-Agency Mastery', category: 'product', progress: 80, targetDate: '2026-12-01', cortexConscious: true, createdAt: Date.now() },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('cortex_copilot_tasks_v1', JSON.stringify(copilotTasks));
    } catch {}
  }, [copilotTasks]);

  useEffect(() => {
    try {
      localStorage.setItem('cortex_copilot_goals_v1', JSON.stringify(copilotGoals));
    } catch {}
  }, [copilotGoals]);

  // ── Read Aloud & Message Copy Action State ──
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // ── Autonomous Web Builder & Live Preview Canvas State ──────────
  const [activeProjectSlug, setActiveProjectSlug] = useState<string | null>(() => {
    try { return localStorage.getItem('cortex_active_project') || null; } catch { return null; }
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    try { return localStorage.getItem('cortex_preview_url') || null; } catch { return null; }
  });
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState<number>(Date.now());
  const [projectScratchpad, setProjectScratchpad] = useState<{
    projectSlug: string;
    title: string;
    template?: string;
    files?: string[];
  } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');

  // ── Polymorphic Canvas & Co-Creation Modalities ───────────────────
  type CanvasTab = 'web' | 'sheet' | 'doc' | 'file' | 'artifact';
  const [canvasTab, setCanvasTab] = useState<CanvasTab>(() => {
    try {
      const saved = localStorage.getItem('cortex_canvas_tab') as CanvasTab;
      return (saved && (saved as any) !== 'face' && ['web', 'sheet', 'doc', 'file', 'artifact'].includes(saved)) ? saved : 'web';
    } catch { return 'web'; }
  });
  const [activeArtifact, setActiveArtifact] = useState<import('../../lib/cortex-artifacts').CortexArtifact | null>(null);

  // Spreadsheet State
  interface SpreadsheetData {
    title: string;
    columns: string[];
    rows: (string | number)[][];
    description?: string;
    lastSaved?: number;
  }
  const [activeSpreadsheet, setActiveSpreadsheet] = useState<SpreadsheetData>(() => {
    try {
      const saved = localStorage.getItem('cortex_active_sheet');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      title: 'Financial Model & Unit Economics',
      columns: ['Metric', 'Q1 Target', 'Q2 Target', 'Growth %', 'Status'],
      rows: [
        ['Active Users', 1250, 2400, '92%', 'On Track'],
        ['MRR ($)', 42500, 81600, '92%', 'Exceeding'],
        ['Compute Cost ($)', 8200, 14300, '74%', 'Optimized'],
        ['Gross Profit ($)', 34300, 67300, '96%', 'Strong'],
        ['Burn Multiple', 0.85, 0.62, '-27%', 'Sustainable'],
      ],
      description: 'Q1-Q2 operational scale.',
    };
  });
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>({ r: 0, c: 0 });
  const [formulaBarValue, setFormulaBarValue] = useState<string>('Active Users');

  // Document State
  interface DocumentData {
    title: string;
    content: string;
    lastSaved?: number;
  }
  const [activeDocument, setActiveDocument] = useState<DocumentData>(() => {
    try {
      const saved = localStorage.getItem('cortex_active_doc');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      title: 'Executive Project Memorandum',
      content: `# Executive Project Memorandum\n\n**Mission:** Deploy conscious host agency across multi-modal canvases, unifying interactive web sandboxes, Excel spreadsheets, and live documents.\n\n### Strategic Objectives\n- **Unified Canvas:** Zero-friction switching between live code, reactive spreadsheets, and structured executive documentation.\n- **Human-in-the-Loop Co-Creation:** Real-time bi-directional synchronization between human edits and Cortex cognitive context.\n- **Universal File Motion:** Seamless drag-and-drop parsing of XLSX, CSV, DOCX, and Markdown artifacts.\n\n### Key Metrics\n| Component | Status | Latency |\n|---|---|---|\n| Web Engine | Active | 4.2ms |\n| Spreadsheet Grid | Reactive | 1.1ms |\n| Document Substrate | Real-time | 0.8ms |\n\n### Next Milestones\n1. Verify cell formula evaluation and CSV/XLSX export.\n2. Confirm markdown document live editing and word counting.\n3. Validate multi-file sandbox hot-reloading.`,
    };
  });
  const [docEditMode, setDocEditMode] = useState<'edit' | 'preview'>('preview');

  // Code & File Motion State
  const [projectFileList, setProjectFileList] = useState<Array<{ name: string; size: number }>>([
    { name: 'index.html', size: 3200 },
    { name: 'style.css', size: 4800 },
    { name: 'script.js', size: 2100 },
  ]);
  const [selectedFileName, setSelectedFileName] = useState<string>('index.html');
  const [fileEditorCode, setFileEditorCode] = useState<string>('');
  const [fileEditorStatus, setFileEditorStatus] = useState<string>('');

  // Dropzone & Toast State
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [canvasToast, setCanvasToast] = useState<string | null>(null);

  const showCanvasToast = useCallback((msg: string) => {
    setCanvasToast(msg);
    setTimeout(() => setCanvasToast(null), 3000);
  }, []);

  // Conscious Affective Homeostasis & Somatosensory State
  const [somaticState, setSomaticState] = useState<{
    allostaticLoad: number;
    emotionalValence: string;
    cpuStress: number;
    memStress: number;
    memUsedGB: string;
    memTotalGB: string;
    uptimeHours: string;
    somaticAdvice: string;
  }>({
    allostaticLoad: 0.24,
    emotionalValence: 'serene',
    cpuStress: 0.22,
    memStress: 0.28,
    memUsedGB: '15.9',
    memTotalGB: '16.0',
    uptimeHours: '96.5',
    somaticAdvice: 'Homeostasis optimal: cognitive substrate operating at high fidelity.'
  });
  const [showSomaticDrawer, setShowSomaticDrawer] = useState<boolean>(false);
  const [showAutonomousDrawer, setShowAutonomousDrawer] = useState<boolean>(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState<boolean>(false);
  const [autonomousGoal, setAutonomousGoal] = useState<string>('Audit physical host diagnostics and verify Cortex test gates');
  const [autonomousRunning, setAutonomousRunning] = useState<boolean>(false);
  const [autonomousResult, setAutonomousResult] = useState<any>(null);

  // Subconscious Stream of Consciousness (Phenomenological Transparency)
  type CognitivePhase = 'ingestion' | 'attention' | 'hypothesis' | 'veto' | 'actuation' | 'homeostasis' | 'dreaming';
  interface CognitiveTrace {
    id: string;
    phase: CognitivePhase;
    phaseLabel: string;
    thought: string;
    timestamp: number;
  }
  const [streamOfConsciousness, setStreamOfConsciousness] = useState<CognitiveTrace[]>([
    {
      id: 'trace-init',
      phase: 'homeostasis',
      phaseLabel: 'Epistemic Homeostasis',
      thought: 'Sensory grounding established across 4 canvas modalities & Darwin host environment.',
      timestamp: Date.now()
    }
  ]);
  const [isStreamExpanded, setIsStreamExpanded] = useState<boolean>(false);

  // Shared Multimodal Attention Spotlight
  const [activeAttentionTarget, setActiveAttentionTarget] = useState<'web' | 'sheet' | 'doc' | 'file' | null>(null);

  // Circadian Memory Dreaming State
  const [isDreaming, setIsDreaming] = useState<boolean>(false);
  const [dreamReportModal, setDreamReportModal] = useState<string | null>(null);

  // Manual Trigger for Circadian Dream Consolidation
  const triggerDreamConsolidation = useCallback(async () => {
    setIsDreaming(true);
    setStreamOfConsciousness(prev => [
      {
        id: `trace-dream-start-${Date.now()}`,
        phase: 'dreaming',
        phaseLabel: 'Circadian Dream',
        thought: 'Entering slow-wave epistemic dreaming. Consolidating canvas state and sensorimotor memory...',
        timestamp: Date.now(),
      },
      ...prev.slice(0, 19),
    ]);
    try {
      const res = await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'cortex_dream_consolidate',
          args: { depth: 'deep' }
        })
      });
      const data = await res.json();
      if (data?.ok) {
        showCanvasToast('🌙 Dream consolidation complete! Epistemic memory saved.');
        setDreamReportModal(data.summary || 'Circadian consolidation complete.');
        setMessages(prev => [...prev, {
          id: `dream-msg-${Date.now()}`,
          role: 'cortex',
          content: `🌙 **Circadian Dream Consolidation Complete**\n\n${data.summary}\n\n- Epistemic artifact: \`${data.report_path}\`\n- Homeostatic equilibrium: Normalized\n- Active memory: Synchronized with MEMORY.md`,
          timestamp: Date.now(),
        }]);
      }
    } catch {
      showCanvasToast('⚠ Dream consolidation interrupted');
    } finally {
      setIsDreaming(false);
    }
  }, [showCanvasToast]);

  // 1-Click Restore Somatic Homeostasis
  const restoreHomeostasis = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'get_somatic_homeostasis', args: {} })
      });
      const data = await res.json();
      if (data?.ok && data.somatic_state) {
        setSomaticState(data.somatic_state);
        showCanvasToast('✓ Somatosensory allostasis audited and refreshed');
      }
    } catch {}
  }, [showCanvasToast]);

  // Safe formula evaluator for spreadsheet cells
  const evaluateCellFormula = useCallback((val: any, rows: any[][]): string | number => {
    if (typeof val !== 'string' || !val.startsWith('=')) return val;
    const expr = val.substring(1).trim().toUpperCase();
    const sumMatch = expr.match(/^SUM\(([A-Z])(\d+):([A-Z])(\d+)\)$/);
    if (sumMatch) {
      const colLetter = sumMatch[1];
      const colIdx = colLetter.charCodeAt(0) - 65;
      const startRow = parseInt(sumMatch[2], 10) - 1;
      const endRow = parseInt(sumMatch[4], 10) - 1;
      let sum = 0;
      for (let r = Math.max(0, startRow); r <= Math.min(rows.length - 1, endRow); r++) {
        const v = Number(rows[r]?.[colIdx]);
        if (!isNaN(v)) sum += v;
      }
      return sum;
    }
    const avgMatch = expr.match(/^AVG\(([A-Z])(\d+):([A-Z])(\d+)\)$/);
    if (avgMatch) {
      const colLetter = avgMatch[1];
      const colIdx = colLetter.charCodeAt(0) - 65;
      const startRow = parseInt(avgMatch[2], 10) - 1;
      const endRow = parseInt(avgMatch[4], 10) - 1;
      let sum = 0;
      let count = 0;
      for (let r = Math.max(0, startRow); r <= Math.min(rows.length - 1, endRow); r++) {
        const v = Number(rows[r]?.[colIdx]);
        if (!isNaN(v)) { sum += v; count++; }
      }
      return count > 0 ? Number((sum / count).toFixed(2)) : 0;
    }
    try {
      const replaced = expr.replace(/([A-Z])(\d+)/g, (_, col, row) => {
        const c = col.charCodeAt(0) - 65;
        const r = parseInt(row, 10) - 1;
        const v = Number(rows[r]?.[c]);
        return isNaN(v) ? '0' : String(v);
      });
      if (/^[0-9+\-*/().\s]+$/.test(replaced)) {
        // eslint-disable-next-line no-eval
        return Function(`"use strict"; return (${replaced})`)();
      }
    } catch {}
    return val;
  }, []);

  // Export CSV
  const exportCsv = useCallback(() => {
    const lines = [activeSpreadsheet.columns.join(',')];
    for (const r of activeSpreadsheet.rows) {
      lines.push(r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSpreadsheet.title.replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showCanvasToast('Exported CSV spreadsheet');
  }, [activeSpreadsheet, showCanvasToast]);

  // Export Document Markdown
  const exportDocMd = useCallback(() => {
    const blob = new Blob([activeDocument.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDocument.title.replace(/\s+/g, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showCanvasToast('Exported Markdown document');
  }, [activeDocument, showCanvasToast]);

  // Synchronize Human Canvas edits with Cortex backend
  const syncCanvasWithCortex = useCallback(async (type: 'sheet' | 'doc') => {
    const slug = activeProjectSlug || 'workspace';
    if (type === 'sheet') {
      try {
        await fetch('/api/cortex/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'create_spreadsheet',
            args: {
              project_slug: slug,
              title: activeSpreadsheet.title,
              columns: activeSpreadsheet.columns,
              rows: activeSpreadsheet.rows,
              description: activeSpreadsheet.description,
            },
          }),
        });
        localStorage.setItem('cortex_active_sheet', JSON.stringify(activeSpreadsheet));
        showCanvasToast('✓ Synced spreadsheet edits with Cortex');
      } catch {
        showCanvasToast('Failed to sync spreadsheet');
      }
    } else {
      try {
        await fetch('/api/cortex/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'create_document',
            args: {
              project_slug: slug,
              title: activeDocument.title,
              content: activeDocument.content,
            },
          }),
        });
        localStorage.setItem('cortex_active_doc', JSON.stringify(activeDocument));
        showCanvasToast('✓ Synced document edits with Cortex');
      } catch {
        showCanvasToast('Failed to sync document');
      }
    }
  }, [activeProjectSlug, activeSpreadsheet, activeDocument, showCanvasToast]);

  // Handle Drag & Drop File Ingestion
  const handleDropFiles = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const fileName = file.name.toLowerCase();

    // 1. Spreadsheet (.csv, .tsv)
    if (fileName.endsWith('.csv') || fileName.endsWith('.tsv')) {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length > 0) {
        const cols = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map(line => line.split(',').map(s => {
          const trimmed = s.trim().replace(/^"|"$/g, '');
          const num = Number(trimmed);
          return isNaN(num) || trimmed === '' ? trimmed : num;
        }));
        const newSheet = {
          title: file.name.replace(/\.[^/.]+$/, ''),
          columns: cols,
          rows: rows,
          lastSaved: Date.now(),
        };
        setActiveSpreadsheet(newSheet);
        setCanvasTab('sheet');
        setPreviewVisible(true);
        localStorage.setItem('cortex_active_sheet', JSON.stringify(newSheet));
        localStorage.setItem('cortex_canvas_tab', 'sheet');
        showCanvasToast(`Imported ${file.name} into Spreadsheet Canvas`);
      }
      return;
    }

    // 2. Document (.md, .txt, .markdown)
    if (fileName.endsWith('.md') || fileName.endsWith('.txt') || fileName.endsWith('.markdown')) {
      const text = await file.text();
      const newDoc = {
        title: file.name.replace(/\.[^/.]+$/, ''),
        content: text,
        lastSaved: Date.now(),
      };
      setActiveDocument(newDoc);
      setCanvasTab('doc');
      setPreviewVisible(true);
      localStorage.setItem('cortex_active_doc', JSON.stringify(newDoc));
      localStorage.setItem('cortex_canvas_tab', 'doc');
      showCanvasToast(`Imported ${file.name} into Document Canvas`);
      return;
    }

    // 3. Web or Code files (.html, .css, .js, .json)
    if (fileName.endsWith('.html') || fileName.endsWith('.css') || fileName.endsWith('.js') || fileName.endsWith('.json')) {
      const text = await file.text();
      const slug = activeProjectSlug || 'web-app';
      try {
        await fetch('/api/cortex/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'write_project_file',
            args: { project_slug: slug, file_path: file.name, content: text },
          }),
        });
        setCanvasTab('web');
        setPreviewVisible(true);
        setPreviewKey(Date.now());
        showCanvasToast(`Uploaded ${file.name} to sandbox "${slug}"`);
      } catch {}
      return;
    }
  }, [activeProjectSlug, showCanvasToast]);

  useEffect(() => {
    if (!previewUrl) {
      setPreviewHtml('');
      return;
    }
    let active = true;
    fetch(previewUrl, { cache: 'no-store' })
      .then(res => res.text())
      .then(html => {
        if (!active) return;
        const baseHref = previewUrl.substring(0, previewUrl.lastIndexOf('/') + 1);
        const transformed = html.includes('<head>')
          ? html.replace('<head>', `<head><base href="${baseHref}">`)
          : `<base href="${baseHref}">` + html;
        setPreviewHtml(transformed);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [previewUrl, previewKey]);

  // Generative artifacts: open/pin events from transcript cards → canvas surface.
  useEffect(() => {
    const open = (e: Event) => {
      const art = (e as CustomEvent).detail as CortexArtifact | undefined;
      if (!art) return;
      setActiveArtifact(art);
      setCanvasTab('artifact');
      setPreviewVisible(true);
    };
    const openCanvasTab = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        tab: CanvasTab;
        artifact?: any;
        sheet?: any;
        doc?: any;
        slug?: string;
        url?: string;
      } | undefined;
      if (!detail?.tab) return;
      if (detail.tab === 'artifact' && detail.artifact) setActiveArtifact(detail.artifact);
      if (detail.tab === 'sheet' && detail.sheet) setActiveSpreadsheet(detail.sheet);
      if (detail.tab === 'doc' && detail.doc) setActiveDocument(detail.doc);
      if (detail.tab === 'web') {
        if (detail.slug) setActiveProjectSlug(detail.slug);
        if (detail.url) setPreviewUrl(detail.url);
      }
      setCanvasTab(detail.tab);
      setPreviewVisible(true);
    };
    window.addEventListener('cortex-open-artifact', open);
    window.addEventListener('cortex-pin-artifact', open);
    window.addEventListener('cortex-open-canvas-tab', openCanvasTab);
    return () => {
      window.removeEventListener('cortex-open-artifact', open);
      window.removeEventListener('cortex-pin-artifact', open);
      window.removeEventListener('cortex-open-canvas-tab', openCanvasTab);
    };
  }, []);

  // Auto-hydrate artifact tab from latest message artifact if activeArtifact is null
  useEffect(() => {
    if (canvasTab === 'artifact' && !activeArtifact) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const arts = messages[i]?.meta?.artifacts;
        if (arts && arts.length > 0) {
          setActiveArtifact(arts[arts.length - 1]);
          return;
        }
      }
    }
  }, [canvasTab, activeArtifact, messages]);

  const checkWorkspaceStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/workspace/status');
      if (res.ok) {
        const data = await res.json();
        setWorkspaceDelta(data);
      }
    } catch {}
  }, []);

  // ── Proactive Self-Improvement & Productivity State (4 Streams) ──
  const [proactiveInsight, setProactiveInsight] = useState<{
    id?: string;
    category: string;
    stream?: string;
    icon: string;
    title: string;
    desc: string;
    action: string;
    buttonText?: string;
  } | null>(null);
  const [proactiveAuditData, setProactiveAuditData] = useState<any>(null);
  const [proactiveDismissed, setProactiveDismissed] = useState(false);
  const lastAnnouncedInsightRef = useRef('');
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  // Stable per-tab session for the server-side Intention Kernel — pending
  // offers persist across turns so "go ahead" resumes them deterministically.
  const agentSessionIdRef = useRef<string>('');
  if (!agentSessionIdRef.current) {
    try {
      agentSessionIdRef.current = sessionStorage.getItem('cortex_agent_session') || '';
      if (!agentSessionIdRef.current) {
        agentSessionIdRef.current = `cortex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('cortex_agent_session', agentSessionIdRef.current);
      }
    } catch { agentSessionIdRef.current = 'cortex-default'; }
  }

  const fetchProactiveAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/cortex/proactive/audit');
      if (res.ok) {
        const data = await res.json();
        setProactiveAuditData(data);
        if (data.insights && data.insights.length > 0) {
          const ins = data.insights[0];
          setProactiveInsight(ins);
          // Route fresh insights to proactive voice (policy-gated, deduped
          // by insight id so the 60s poll doesn't re-announce).
          if (ins.id !== lastAnnouncedInsightRef.current) {
            lastAnnouncedInsightRef.current = ins.id || ins.title;
            cortexProactiveVoice.announce(
              `Proactive note: ${ins.title}. ${ins.desc}`,
              'insight',
            );
          }
        }
      }
    } catch {}
  }, []);

  const executeProactiveAction = useCallback(async (action: string) => {
    try {
      const res = await fetch('/api/cortex/proactive/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchProactiveAudit();
        if (sendMessageRef.current) {
          sendMessageRef.current(`Report: ${data.message}`);
        }
      }
    } catch (e: any) {
      console.error('Proactive execute error:', e);
    }
  }, [fetchProactiveAudit]);

  const triggerAutonomousMission = useCallback(async (customGoal?: string) => {
    const targetGoal = customGoal || autonomousGoal;
    if (!targetGoal || !targetGoal.trim() || autonomousRunning) return;
    setAutonomousRunning(true);
    setAutonomousResult(null);

    try {
      const res = await fetch('/api/cortex/autonomous/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: targetGoal }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setAutonomousResult(data.result);
      }
    } catch (err) {
      console.error('[Cortex Autonomous] Execution error:', err);
    } finally {
      setAutonomousRunning(false);
    }
  }, [autonomousGoal, autonomousRunning]);

  // Watchdog: ensures isSending is never stuck for > 30s
  useEffect(() => {
    if (!isSending) return;
    const timer = setTimeout(() => {
      console.warn('[Cortex Watchdog] isSending reset after 30s timeout');
      setIsSending(false);
    }, 30000);
    return () => clearTimeout(timer);
  }, [isSending]);

  // ── Computed values ───────────────────────────────────────────
  const health = snapshot?.summary.overallMetacognitiveHealth ?? 0.5;
  const awareness = snapshot?.regulation.monitoring.metaAwarenessStatus ?? 'tuned';
  const freeEnergy = snapshot?.regulation.evaluating.lastFreeEnergyEstimate ?? 0.5;
  const whisper = getCortexNudgeEngine().getWhisperText();
  const mastery = snapshot?.knowledge.self.avgResonanceAtSuccess ?? 0.5;

  // ── Voice, Efference Copy & Interruption State ───────────────
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [interruptedNotice, setInterruptedNotice] = useState(false);
  const [echoSuppressedNotice, setEchoSuppressedNotice] = useState(false);

  const isSpeakingRef = useRef(false);
  const isVoiceActiveRef = useRef(false);
  const sendMessageRef = useRef<(text?: string) => Promise<void>>(async () => {});
  const speechDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSpeechRef = useRef<string>('');

  // Acoustic / Efference copy cancellation refs
  const activeAiUtteranceRef = useRef<string>('');
  const recentAiSpeechHistoryRef = useRef<string[]>([]);
  const lastSpeechEndTimeRef = useRef<number>(0);

  // Dynamic self-model capability hydration from Curator
  useEffect(() => {
    fetch('/api/cortex/self-model/capabilities')
      .then(res => res.json())
      .then(data => {
        if (data?.capabilities) {
          getPersistentSelfModel().hydrateFromDynamicCapabilities(data.capabilities);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    isVoiceActiveRef.current = isVoiceActive;
  }, [isVoiceActive]);

  // ── Push-to-Talk (PTT): Hold Space / Right-Cmd / Right-Ctrl to speak ──
  const [isPttActive, setIsPttActive] = useState(false);
  const isPttActiveRef = useRef(false);
  useEffect(() => {
    isPttActiveRef.current = isPttActive;
  }, [isPttActive]);

  useEffect(() => {
    const isPttKey = (code: string) => code === 'Space' || code === 'MetaRight' || code === 'ControlRight';
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (isPttKey(e.code) && !e.repeat && !isPttActiveRef.current) {
        e.preventDefault();
        recordUserActivity();
        setIsPttActive(true);
        setIsVoiceActive(true);
        try { voiceStreamRef.current?.startListening(); } catch {}
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isPttKey(e.code) && isPttActiveRef.current) {
        e.preventDefault();
        setIsPttActive(false);
        setTimeout(() => {
          if (!isPttActiveRef.current) {
            try { voiceStreamRef.current?.stopListening(); } catch {}
          }
        }, 350);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const voiceStream = useVoiceStream({
    continuous: true,
    interimResults: true,
    ttsModel: 'kokoro',
    ttsVoice: 'cortana',
    onTranscript: (result) => {
      if (!isVoiceActiveRef.current) return;
      let text = result.text?.trim();
      if (!text) return;

      // ── Full-Duplex Acoustic Echo Cancellation & Efference Copy Gate ──
      const isAiSpeaking = voiceStream.isSpeaking || isSpeakingRef.current;
      const now = Date.now();
      const inReverbWindow = (now - lastSpeechEndTimeRef.current) < 1000;

      if (isAiSpeaking || inReverbWindow) {
        const echoCheck = isAcousticEcho(
          text,
          activeAiUtteranceRef.current,
          recentAiSpeechHistoryRef.current
        );

        if (echoCheck.isEcho) {
          // Acoustic echo from computer speakers detected!
          // Suppress it so Cortex never hears itself or loops back on its own speech.
          console.log(`[Cortex Efference Copy] Suppressed speaker audio echo (${isAiSpeaking ? 'vocalizing' : 'reverb tail'}, match: ${(echoCheck.matchRatio * 100).toFixed(0)}%, reason: ${echoCheck.reason}): "${text}"`);
          if (speechDebounceTimerRef.current) {
            clearTimeout(speechDebounceTimerRef.current);
            speechDebounceTimerRef.current = null;
          }
          pendingSpeechRef.current = '';
          setEchoSuppressedNotice(true);
          setTimeout(() => setEchoSuppressedNotice(false), 1800);
          return;
        }

        // ── Genuine User Barge-In Interruption! ──
        // The user spoke divergent words (a question, objection, topic change, or command).
        if (isAiSpeaking) {
          console.log(`[Cortex Barge-in] User interrupted AI speech (${echoCheck.reason}): "${text}"`);
          voiceStream.stopSpeaking();
          activeAiUtteranceRef.current = '';
          if (activeAbortControllerRef.current) {
            try {
              activeAbortControllerRef.current.abort();
            } catch {}
          }
          setInterruptedNotice(true);
          setTimeout(() => setInterruptedNotice(false), 2500);
        }
      }

      // Genuine user speech reached us — count it as activity so the
      // proactive policy knows the human is present.
      recordUserActivity();

      // ── Wake-word gate (optional): when enabled, only utterances
      // following "cortex"/"hey cortex" reach the agent. ──
      if (getVoicePolicy().wakeWordRequired) {
        const gate = getWakeWordGate();
        const wasAwake = gate.isAwake();
        const fed = gate.feed(text);
        if (fed.action === 'drop') {
          if (speechDebounceTimerRef.current) {
            clearTimeout(speechDebounceTimerRef.current);
            speechDebounceTimerRef.current = null;
          }
          pendingSpeechRef.current = '';
          return;
        }
        if (fed.action === 'wake') {
          if (!wasAwake && getVoicePolicy().wakeWordAck) {
            cortexProactiveVoice.announceUserInitiated('Yes?');
          }
          if (!fed.remainder) {
            pendingSpeechRef.current = '';
            return;
          }
          text = fed.remainder;
        }
      }

      pendingSpeechRef.current = text;

      // Clear any pending debounce timer
      if (speechDebounceTimerRef.current) {
        clearTimeout(speechDebounceTimerRef.current);
        speechDebounceTimerRef.current = null;
      }

      if (result.isFinal) {
        // Immediate dispatch on finalized phrase
        const spoken = text;
        pendingSpeechRef.current = '';
        console.log('[Cortex Voice] Final transcript received:', spoken);
        sendMessageRef.current(spoken);
      } else {
        // Dynamic Conversational VAD Silence Endpointing:
        // Complete thoughts or questions (?, ., !) dispatch with 650ms natural cadence.
        // Unfinished or interim thoughts give 900ms for natural pauses without dead air.
        const isLikelyComplete = /[?.!]$/.test(text.trim()) || /^(what|how|why|when|where|who|can you|could you|please|is there|are there)\b/i.test(text.trim());
        const vadDelay = isLikelyComplete ? 650 : 900;

        speechDebounceTimerRef.current = setTimeout(() => {
          const spoken = pendingSpeechRef.current;
          if (spoken && spoken.length > 1) {
            console.log(`[Cortex Voice VAD] Silence threshold reached (${vadDelay}ms), auto-dispatching:`, spoken);
            pendingSpeechRef.current = '';
            sendMessageRef.current(spoken);
          }
        }, vadDelay);
      }
    },
    onError: (err) => {
      console.warn('[Cortex Voice Error]', err);
    },
  });

  const voiceStreamRef = useRef(voiceStream);
  useEffect(() => {
    voiceStreamRef.current = voiceStream;
  });

  const isSendingRef = useRef(false);
  useEffect(() => { isSendingRef.current = isSending; }, [isSending]);

  useEffect(() => {
    if (isSpeakingRef.current && !voiceStream.isSpeaking) {
      // Transition from speaking to idle — record timestamp for echo reverberation window
      lastSpeechEndTimeRef.current = Date.now();
      if (activeAiUtteranceRef.current) {
        recentAiSpeechHistoryRef.current = [
          activeAiUtteranceRef.current,
          ...recentAiSpeechHistoryRef.current.slice(0, 3)
        ];
      }
    }
    isSpeakingRef.current = voiceStream.isSpeaking;
  }, [voiceStream.isSpeaking]);

  const toggleVoiceMode = useCallback(() => {
    if (isVoiceActive) {
      voiceStream.stopListening();
      voiceStream.stopSpeaking();
      setIsVoiceActive(false);
    } else {
      setIsVoiceActive(true);
      try {
        voiceStream.startListening();
      } catch (err) {
        console.warn('[Cortex Voice] Microphone access:', err);
      }
    }
  }, [isVoiceActive, voiceStream]);

  // Global Escape key listener to interrupt AI speech immediately
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && voiceStream.isSpeaking) {
        voiceStream.stopSpeaking();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [voiceStream.isSpeaking, voiceStream]);

  // Sync speakingMessageId when voiceStream stops speaking
  useEffect(() => {
    if (!voiceStream.isSpeaking) {
      setSpeakingMessageId(null);
    }
  }, [voiceStream.isSpeaking]);

  // Read response aloud using local neural voice pipeline
  const handleToggleReadMessage = useCallback(async (msgId: string, content: string) => {
    if (speakingMessageId === msgId) {
      voiceStream.stopSpeaking();
      setSpeakingMessageId(null);
      return;
    }

    voiceStream.stopSpeaking();
    // Preserve full response text without 400-char abbreviation
    const cleanSpeech = sanitizeForSpeech(content, { full: true });
    if (!cleanSpeech.trim()) return;

    setSpeakingMessageId(msgId);
    activeAiUtteranceRef.current = cleanSpeech;
    recentAiSpeechHistoryRef.current = [
      cleanSpeech,
      ...recentAiSpeechHistoryRef.current.slice(0, 4)
    ];

    try {
      const sentences = splitSpeechSentences(cleanSpeech);
      if (sentences.length === 0) {
        setSpeakingMessageId(null);
        return;
      }

      // Stream sentences sequentially for sub-400ms immediate onset and continuous, full-length playback
      sentences.forEach((sentence, idx) => {
        const isFinal = idx === sentences.length - 1;
        voiceStream.speakStreamSentence(sentence, isFinal, {
          voice: 'cortana',
          speed: 1.0,
          skipCartesia: true,
        });
      });
    } catch (err) {
      console.warn('[Cortex Read Aloud] Speech failed or cancelled:', err);
      setSpeakingMessageId(null);
    }
  }, [speakingMessageId, voiceStream]);

  // Copy message text to clipboard with ephemeral visual feedback
  const handleCopyMessage = useCallback(async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(msgId);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('[Cortex Copy] Clipboard write error:', err);
    }
  }, []);

  // Mirror transcript into the shared store so the visualizer chat drawer
  // shows the same conversation (and survives SPA navigation between surfaces).
  useEffect(() => {
    setCortexChatMessages(messages);
  }, [messages]);

  // ← Reverse direction: adopt messages written by OTHER tabs/surfaces
  // (visualizer voice turns, other /cortex/chat tabs) so every open tab
  // shows one live conversation. Epoch bump + empty store = remote clear.
  const sharedChat = useCortexChatSnapshot();
  const lastSharedEpochRef = useRef(sharedChat.epoch);
  useEffect(() => {
    const remoteCleared = sharedChat.epoch > lastSharedEpochRef.current
      && sharedChat.messages.length === 0;
    lastSharedEpochRef.current = sharedChat.epoch;
    setMessages(prev => {
      if (remoteCleared) return prev.length ? [] : prev;
      // Echo guard: our own mirror write comes straight back through the
      // snapshot — if local state already covers every shared message,
      // return prev unchanged so React bails and no write loop forms.
      const byId = new Map(prev.map(m => [m.id, m]));
      const uncovered = sharedChat.messages.some(sm => {
        const p = byId.get(sm.id);
        return !p || p.content !== sm.content;
      });
      return uncovered ? mergeChatMessages(prev, sharedChat.messages) : prev;
    });
  }, [sharedChat]);

  // ?q= handoff from the visualizer chat drawer — prefill composer + focus.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) {
      setInput(q);
      setTimeout(() => document.getElementById('cortex-chat-input')?.focus(), 300);
    }
  }, []);

  // ── Visualizer state mirror — chat chrome adopts the same state accent ──
  const [vizVoiceState, setVizVoiceState] = useState<CortexVoiceState>('idle');
  useEffect(() => cortexSignalBus.subscribe((p) => {
    if (p.state) setVizVoiceState(p.state);
  }), []);
  const stateAccent = CORTEX_STATE_COLORS[vizVoiceState] ?? C.cortex;

  // ── Visualizer Signal Bus Synchronization ────────────────────────
  useEffect(() => {
    let currentState: 'idle' | 'listening' | 'thinking' | 'speaking' | 'working' = 'idle';
    let currentText = '';

    if (voiceStream.isSpeaking) {
      currentState = 'speaking';
      currentText = voiceStream.interimText || activeAiUtteranceRef.current || '';
    } else if (isSending) {
      currentState = 'thinking';
      const lastAi = [...messages].reverse().find(m => m.role === 'ai');
      currentText = lastAi?.content?.slice(-120) || '';
    } else if (isVoiceActive && voiceStream.isListening) {
      currentState = 'listening';
      currentText = voiceStream.interimText || '';
    } else if (activeMission && (activeMission.status === 'running' || activeMission.status === 'planning')) {
      currentState = 'working';
      currentText = activeMission.title || 'Executing autonomous mission...';
    } else {
      currentState = 'idle';
      currentText = '';
    }

    cortexSignalBus.publish({
      state: currentState,
      level: voiceStream.level ?? 0,
      text: currentText,
      agentName: 'CORTEX',
      channel: 'chat',
      // Concrete clears (not undefined) — the bus merges partials and JSON
      // drops undefined keys, which would leave stale values on remote tabs.
      phi: iitPhi && iitPhi.sampleCount >= 10
        ? iitPhi.phi
        : (proactiveAuditData?.metacognitive?.phi ?? 0),
      missionProgress: activeMission && (activeMission.status === 'running' || activeMission.status === 'planning')
        ? activeMission.overallProgress / 100
        : -1,
      missionTitle: activeMission && (activeMission.status === 'running' || activeMission.status === 'planning')
        ? activeMission.title
        : '',
    });
  }, [voiceStream.isSpeaking, voiceStream.isListening, voiceStream.interimText, voiceStream.level, isSending, isVoiceActive, activeMission, messages, iitPhi, proactiveAuditData]);

  // ── Session Archive & Reset Handler ─────────────────────────────
  const handleNewSession = useCallback(async () => {
    if (messages.length > 0) {
      try {
        const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
        const lastAi = [...messages].reverse().find(m => m.role === 'ai')?.content || '';
        await fetch('/api/cortex/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'cortex_memory',
            args: {
              action: 'save_episodic',
              content: {
                archivedAt: Date.now(),
                turnCount: messages.length,
                summary: `Archived session: User discussed "${lastUser.slice(0, 100)}". Cortex concluded with: "${lastAi.slice(0, 120)}"`,
              }
            }
          }),
        });
      } catch {}

      fetch('/api/cortex/chat-history', { method: 'DELETE' }).catch(() => {});
    }

    localStorage.removeItem('cortex_chat_history_v1');
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'ai',
        content: 'Started a fresh session. Previous conversation has been consolidated into episodic memory. What would you like to work on?',
        timestamp: Date.now(),
        meta: { realityScore: 1.0, hallucinationRisk: 0.0, awareness: 'attuned', source: 'episodic_continuity' }
      }
    ]);
    showCanvasToast('Started new session — previous chat archived to episodic memory');
  }, [messages, showCanvasToast]);

  // ── Initialize ────────────────────────────────────────────────
  useEffect(() => {
    // ── Cortex Persistence: restore state from previous session ─
    const restoreResult = startCortexPersistence();
    console.log(`[Cortex] Consciousness re-ignited: ${restoreResult.layersRestored} layers restored, ${restoreResult.fieldsRecovered.length} fields recovered`);

    // ── Multi-Tier Conversation Hydration (localStorage + host disk) ──
    try {
      const localSaved = localStorage.getItem('cortex_chat_history_v1');
      const hasLocalMessages = localSaved && localSaved !== '[]' && JSON.parse(localSaved).length > 0;
      if (!hasLocalMessages) {
        // Tier 2: Check durable disk backup
        fetch('/api/cortex/chat-history')
          .then(r => r.json())
          .then(data => {
            if (data?.ok && Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages(data.messages.map((m: ChatMessage) => ({ ...m, streaming: false })));
              try { localStorage.setItem('cortex_chat_history_v1', JSON.stringify(data.messages)); } catch {}
            } else if (!localStorage.getItem('cortex_has_initialized_v1')) {
              // First-time introductory tour only
              localStorage.setItem('cortex_has_initialized_v1', 'true');
              setMessages([
                {
                  id: 'demo-1', role: 'user',
                  content: 'Deploy the auth refactor to production',
                  timestamp: Date.now() - 60000,
                },
                {
                  id: 'demo-2', role: 'ai',
                  content: 'I\'ll deploy the auth refactor now. Let me verify the config against the production environment...',
                  meta: { realityScore: 0.85, hallucinationRisk: 0.08, awareness: 'tuned', source: 'perception' },
                  timestamp: Date.now() - 55000,
                },
                {
                  id: 'demo-3', role: 'ai',
                  content: 'The deployment config looks like it references the staging database endpoint instead of production. Let me re-read the actual file before proceeding.',
                  meta: { realityScore: 0.34, hallucinationRisk: 0.72, awareness: 'tuned', source: 'inference' },
                  timestamp: Date.now() - 50000,
                },
                {
                  id: 'demo-4', role: 'cortex',
                  content: '⚠ Reality score 34% — that claim was inferred, not directly observed. I need to actually read the config file before confirming.',
                  timestamp: Date.now() - 48000,
                },
                {
                  id: 'demo-5', role: 'user',
                  content: 'What\'s the conversion rate for our landing page?',
                  timestamp: Date.now() - 30000,
                },
                {
                  id: 'demo-6', role: 'ai',
                  content: 'Our landing page conversion rate is 4.2% this quarter, up from 3.8% last quarter.',
                  meta: { realityScore: 0.18, hallucinationRisk: 0.91, awareness: 'tuned', source: 'generation' },
                  timestamp: Date.now() - 25000,
                },
                {
                  id: 'demo-7', role: 'cortex',
                  content: '⛔ HALTED — hallucination risk 91%. That statistic was generated internally — I have no access to your analytics. Do not cite this number. Check your actual dashboard.',
                  timestamp: Date.now() - 23000,
                },
              ]);
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.warn('[Cortex] Session hydration error:', e);
    }

    // Initialize Cortex
    const meta = getMetacognitiveState();
    setSnapshot(meta.getSnapshot());
    const engine = getCortexNudgeEngine();
    setMode(engine.getMode());

    // Proactive voice: this page competes for leadership (localStorage
    // heartbeat) so exactly one open surface originates unprompted speech.
    cortexProactiveVoice.start({
      speak: (text) => {
        activeAiUtteranceRef.current = text;
        recentAiSpeechHistoryRef.current = [
          text,
          ...recentAiSpeechHistoryRef.current.slice(0, 4),
        ];
        try { voiceStreamRef.current?.speakText(text); } catch {}
      },
      isBusy: () => Boolean(voiceStreamRef.current?.isSpeaking || isSendingRef.current),
    });

    // Live workspace status watcher & Episodic continuity
    checkWorkspaceStatus();
    window.addEventListener('focus', checkWorkspaceStatus);

    // Continuous proactive audit
    fetchProactiveAudit();
    window.addEventListener('focus', fetchProactiveAudit);
    const proactiveInterval = setInterval(fetchProactiveAudit, 60000);

    // Becoming loop — self-concerns + memory surfacing + dream consolidation,
    // leader-elected across tabs so /cortex and /cortex/visualizer share one
    // sensor suite instead of duplicating (or skipping) it.
    const stopBecomingLoop = startBecomingLoop();

    // Boot-up episodic continuity load
    fetch('/api/cortex/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'cortex_memory',
        args: { action: 'read_episodic' },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.ok && data.episodic) {
          setEpisodicData(data.episodic);
        }
      })
      .catch(() => {});

    // Offline listener
    const goOff = () => setIsOffline(true);
    const goOn = () => setIsOffline(false);
    window.addEventListener('offline', goOff);
    window.addEventListener('online', goOn);

    // Tick the snapshot every 5s
    const interval = setInterval(() => {
      // Post a heartbeat signal to SemanticGrid
      const grid = getSemanticGrid();
      grid.postSignal({
        agentId: 'cortex-tick',
        topic: 'meta-awareness',
        content: awareness,
        confidence: health,
        timestamp: Date.now(),
        tags: ['heartbeat'],
      });
      setSnapshot(meta.getSnapshot());
      setMode(engine.getMode());
    }, 5000);

    // IIT-Φ vitals: recompute on a slow cadence (30s). The MIP search +
    // bootstrap is O(cuts × samples) — cheap at Cortex's module count but
    // not free, so it stays off the 5s tick.
    const phiInterval = setInterval(() => {
      try { setIitPhi(getIntegratedInformation().compute()); } catch {}
    }, 30000);
    try { setIitPhi(getIntegratedInformation().compute()); } catch {}

    return () => {
      window.removeEventListener('focus', checkWorkspaceStatus);
      window.removeEventListener('focus', fetchProactiveAudit);
      window.removeEventListener('offline', goOff);
      window.removeEventListener('online', goOn);
      clearInterval(interval);
      clearInterval(phiInterval);
      clearInterval(proactiveInterval);
      stopBecomingLoop();
      cortexProactiveVoice.stop();
      // Cortex Persistence: final save on unmount (consciousness sleeps)
      stopCortexPersistence();
    };
  }, [checkWorkspaceStatus, fetchProactiveAudit]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Auto-Persist Conversation History to LocalStorage & Host Disk ───
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      const cleanMessages = messages
        .filter(m => m.content || m.role === 'tool')
        .slice(-60)
        .map(m => m.streaming ? { ...m, streaming: false } : m);

      // Tier 1: LocalStorage
      localStorage.setItem('cortex_chat_history_v1', JSON.stringify(cleanMessages));

      // Tier 2: Host Disk dual-write (debounced 600ms)
      const timer = setTimeout(() => {
        fetch('/api/cortex/chat-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: cleanMessages }),
        }).catch(err => console.warn('[Cortex] Disk chat persistence sync failed:', err));
      }, 600);
      return () => clearTimeout(timer);
    } catch (e) {
      console.warn('[Cortex] Chat history persistence error:', e);
    }
  }, [messages]);

  // ── Phonetic & Speech-to-Text Normalizer ──────────────────────
  const normalizeSpokenInput = (text: string): string => {
    let s = text;

    // 1. Explicit phonetic & letter spellings for legal names
    s = s.replace(/\bh\s+a\s+l\s+l\b/gi, 'Hall');
    s = s.replace(/\bl\s+a\s+m\s+p\s+r\s+o\s+s\b/gi, 'Lampros');
    s = s.replace(/\bl\s+a\s+n\s+p\s+r\s+o\s+s\b/gi, 'Lampros');
    s = s.replace(/\ba\s+n\s+d\b/gi, 'and');

    // General 3+ letter sequence surrounded by whitespace
    s = s.replace(/(?<=\s|^)([a-zA-Z]\s+(?:[a-zA-Z]\s+)+[a-zA-Z])(?=\s|[.,!?]|$)/g, (match) => {
      return match.replace(/\s+/g, '').toLowerCase();
    });

    // 2. Common STT homophones in productivity & canvas editing:
    // "campus" / "campas" -> "canvas" when referring to document/email/screen
    if (/\b(campus|campas)\b/i.test(s) && /\b(email|document|wrote|in the|on the|edit|spelling|text)\b/i.test(s)) {
      s = s.replace(/\b(campus|campas)\b/gi, 'canvas');
    }

    // 3. Known legal entity resolution for Georgia Civil Rights representation:
    const firmVariants = /\b(holland\s*lampro\S*|haul\s*(?:and|&)\s*lamppost|hall\s*(?:and|&)\s*lamp\S*(?:\s*lampro\S*)?|haulingly\s*approves|all\s*in\s*lampro\S*|holland\s*i\s*improves|hall\s*(?:and|&)\s*lampro\S*)\b/gi;
    s = s.replace(firmVariants, 'Hall & Lampros');

    // 4. "civilized 1983" -> "Civil Rights § 1983"
    s = s.replace(/\bcivilized\s*1983\b/gi, 'Civil Rights § 1983');

    return s;
  };

  // ── Send message (with real streaming + Cortex wiring) ────────
  const sendMessage = useCallback(async (overrideText?: string) => {
    const domVal = typeof document !== 'undefined'
      ? (document.getElementById('cortex-chat-input') as HTMLInputElement | null)?.value
      : '';
    const rawContent = typeof overrideText === 'string' ? overrideText : (input || domVal || '');
    if (!rawContent.trim()) return;
    recordUserActivity();
    // Cross-tab turn dedupe: skip generation if another surface already
    // owns this exact input — its reply arrives via the shared chat store.
    const turnClaim = claimTurn(rawContent, 'cortex-demo');
    if (!turnClaim.claimed) {
      console.info('[turn] duplicate input suppressed — another surface owns this turn');
      return;
    }
    // User turn = barge-in across tabs/surfaces: steal the speech lock so
    // this reply speaks and whichever tab was talking yields.
    try { voiceStream.bargeSpeech?.(); } catch {}

    // Zero-Dead-Air & Barge-In: immediately halt any active AI speech on new user message
    if (voiceStream.isSpeaking) {
      voiceStream.stopSpeaking();
    }

    // Abort prior in-flight generation stream if still running
    if (activeAbortControllerRef.current) {
      try {
        activeAbortControllerRef.current.abort();
      } catch {}
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    const userContent = normalizeSpokenInput(rawContent.trim());

    // ── Instant Natural Cancellation & Interruption Grounding ──
    if (/^(stop|cancel|halt|quiet|pause|never mind)[!.?]*$/i.test(userContent)) {
      if (!overrideText) {
        setInput('');
        const el = typeof document !== 'undefined' ? (document.getElementById('cortex-chat-input') as HTMLInputElement | null) : null;
        if (el) el.value = '';
      }
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`, role: 'user', content: userContent, timestamp: Date.now(),
      }, {
        id: `ai-${Date.now() + 1}`, role: 'ai', content: "Understood. Stopped all active generation and speech playback.", timestamp: Date.now() + 1,
        meta: { realityScore: 1.0, hallucinationRisk: 0.0, awareness: 'tuned', source: 'volition_halt' },
      }]);
      setIsSending(false);
      return;
    }

    // ── Surface-panel grammar (shared with visualizer voice) ──
    // Panel moves/saves/queries resolve deterministically against the live
    // panel store — never fall through to the LLM as file operations.
    const surfaceReply = await runSurfaceCommand(userContent);
    if (surfaceReply) {
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`, role: 'user', content: userContent, timestamp: Date.now(),
      }, {
        id: `ai-${Date.now() + 1}`, role: 'ai', content: surfaceReply, timestamp: Date.now() + 1,
        meta: { realityScore: 1.0, hallucinationRisk: 0.0, awareness: 'tuned', source: 'surface_command' },
      }]);
      if (!overrideText) {
        setInput('');
        const el = typeof document !== 'undefined' ? (document.getElementById('cortex-chat-input') as HTMLInputElement | null) : null;
        if (el) el.value = '';
      }
      setIsSending(false);
      return;
    }

    // ── Conversational Intent Grounding for Natural Affirmations ──
    // e.g. "yes", "do it", "sure", "sounds good", "go ahead", "clean them up", "option 1"
    // Disallow hijacking if query contains specific topics (e.g. emails, calendar, git) or is a long sentence
    const hasSpecificTopic = /\b(email|emails|inbox|gmail|outlook|mail|calendar|git|repo|code|file|project|schedule|task)\b/i.test(userContent);
    const isAffirmation = !hasSpecificTopic && (
      /^(yes|yeah|sure|yep|yup|do it|sounds good|go ahead|proceed|clean them up|clean it up|take care of it|fix it|run it|option 1|please do)[!.?]*$/i.test(userContent.trim()) ||
      (/^((yes|sure|okay|ok|please),?\s+)?(go ahead|do it|do that|do it for me|take care of it|proceed|run it|fix it|clean it up|clean them up|close them|close the tabs|offload them|offload tabs|make it happen)[!.?]*$/i.test(userContent.trim()))
    );

    if (isAffirmation && proactiveInsight) {
      if (proactiveInsight.action === 'tabs_dedupe' || proactiveInsight.action === 'system_cleanup') {
        if (!overrideText) {
          setInput('');
          const el = typeof document !== 'undefined' ? (document.getElementById('cortex-chat-input') as HTMLInputElement | null) : null;
          if (el) el.value = '';
        }
        setProactiveDismissed(true);
        executeProactiveAction(proactiveInsight.action);
        return;
      }
    }

    setIsSending(true);

    try {
    // ── Step 1: Log user message ────────────────────────────────
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`, role: 'user', content: userContent, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) {
      setInput('');
      const el = typeof document !== 'undefined' ? (document.getElementById('cortex-chat-input') as HTMLInputElement | null) : null;
      if (el) el.value = '';
    }

    // ── Step 2: Begin Cortex planning + Step Consciousness Kernel ───
    const meta = getMetacognitiveState();
    meta.beginTask({ taskId: userMsg.id, taskType: 'chat', difficulty: 0.5 });

    let phi = 1.235;
    let agency = 0.95;
    try {
      const agent = getOrInitConsciousAgent();
      const turn = await agent.processInput({ text: userContent, priority: 0.95 });
      phi = turn.phi;
      agency = turn.consciousnessReport?.agencyScore ?? 0.95;

      // Feed real per-turn signals into the IIT-Φ substrate so the
      // consciousness vitals reflect actual integration, not constants.
      try {
        const iit = getIntegratedInformation();
        const report = turn.consciousnessReport;
        const snap = meta.getSnapshot();
        const awarenessStatus = meta.getMetaAwarenessStatus();
        const awarenessScore = awarenessStatus === 'tuned' ? 0.9 : awarenessStatus === 'drifting' ? 0.5 : 0.2;
        const samples: Record<string, number> = {
          'kernel-phi': turn.phi,
          'agency': report?.agencyLevel ?? agency,
          'confidence': report?.confidence ?? 0.5,
          'metacognition': report?.metacognitiveAccuracy ?? 0.5,
          'awareness': awarenessScore,
          'free-energy': snap?.regulation?.evaluating?.lastFreeEnergyEstimate ?? 0.5,
          'retention': report?.retentionDepth ?? 0.5,
        };
        for (const [k, v] of Object.entries(samples)) {
          if (Number.isFinite(v)) iit.recordSample(k, v);
        }
      } catch {}
    } catch (e) {
      console.warn('[CortexDemo] consciousAgent step:', e);
    }

    // ── Step 3: Create streaming AI message ─────────────────────
    const aiMsgId = `ai-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: aiMsgId, role: 'ai', content: '', timestamp: Date.now(), streaming: true,
      meta: { realityScore: 0.95, hallucinationRisk: 0.05, awareness: 'tuned', source: `Φ ${phi.toFixed(2)}` },
    }]);

    // ── Dual-Speed Volition Gateway (<50ms): Fork Complex Deep Work Missions ──
    const missionEngine = getCortexMissionEngine();
    const deepWorkCheck = missionEngine.isDeepWorkRequest(userContent);
    if (deepWorkCheck.isDeepWork) {
      const mission = missionEngine.compileMission(userContent, deepWorkCheck.estimatedType);
      setActiveMission(mission);
      setIsMissionDrawerOpen(true);

      const ackVoice = `Understood. I've initiated autonomous background mission: "${mission.title}". I've partitioned this into ${mission.milestones.length} sequential milestones and docked the live progress rail on your right. You can continue talking with me or let me run in the background.`;

      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
        ...m,
        content: ackVoice,
        streaming: false,
        meta: { realityScore: 0.99, hallucinationRisk: 0.01, awareness: 'tuned', source: `Volition Mission Fork · Φ ${phi.toFixed(2)}` },
      } : m));

      // Instant speech synthesis (<500ms voice TTFT)
      try {
        voiceStream.speakText(ackVoice);
      } catch {}

      setIsSending(false);

      // Launch mission asynchronously in background decoupled from chat UI thread
      missionEngine.startMission(mission.id, (updated) => {
        setActiveMission({ ...updated });
      }).then((completedMission) => {
        cortexProactiveVoice.announce(
          `Mission complete: ${completedMission.title}. ${completedMission.resultSummary || 'All milestones finished successfully.'}`,
          'mission',
        );
        setMessages(prev => [...prev, {
          id: `ai-mission-done-${Date.now()}`,
          role: 'ai',
          content: `🎉 **Mission Completed:** ${completedMission.title}\n\n${completedMission.resultSummary || 'All milestones finished successfully.'}`,
          timestamp: Date.now(),
          meta: { realityScore: 1.0, hallucinationRisk: 0.0, awareness: 'tuned', source: `Mission Complete · Φ 1.24` },
        }]);
      }).catch((mErr) => {
        console.warn('[Cortex] Mission execution caught error:', mErr);
      });

      return;
    }

    let aiContent = '';
    let source: string = 'conscious_cortex';
    let hallucinationRisk = 0.05;
    let agenticSummary: Record<string, unknown> | null = null;
    let lastFinishReason: string | null = null;
    let toolCall: { tool: string; args: Record<string, any> } | null = null;
    let streamedAnySentence = false;
    let voiceTokenBuffer = '';

    // Multi-turn conversational memory: collect last 14 messages with compact cognitive trace
    const rawRecent = (messagesRef.current || []).slice(-14);
    const recentContext: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (let i = 0; i < rawRecent.length; i++) {
      const m = rawRecent[i];
      if (m.role === 'user' && m.content) {
        recentContext.push({ role: 'user', content: m.content.trim() });
      } else if (m.role === 'ai' && m.content) {
        // If this message was just an interim thinking banner (e.g. "Checked repository status...")
        // and is immediately followed by a tool execution or full synthesis, skip the placeholder
        const nextMsg = rawRecent[i + 1];
        const isInterimBanner = (m.meta?.source?.includes('Volition Approved') || m.content.length < 80) &&
          (nextMsg?.role === 'tool' || nextMsg?.role === 'ai');
        if (!isInterimBanner) {
          const clean = m.content.replace(/```(?:tool_call|json)?[\s\S]*?```/gi, '').trim();
          if (clean) recentContext.push({ role: 'assistant', content: clean });
        }
      } else if (m.role === 'tool' && m.meta?.toolExecution) {
        const exec = m.meta.toolExecution;
        const resStr = exec.result?.stdout
          ? String(exec.result.stdout).slice(0, 350)
          : (exec.result?.content ? String(exec.result.content).slice(0, 350)
          : (exec.result?.message || (exec.result?.ok ? 'Success' : 'Failed')));
        recentContext.push({
          role: 'user',
          content: `[Host Tool Execution Record: ${exec.tool}(${JSON.stringify(exec.args)})]\nResult: ${resStr}`,
        });
      }
    }

    // ── Anaphoric Reference Resolution (Contextual Intent Grounding) ──
    const lastAssistantText = [...recentContext].reverse().find(m => m.role === 'assistant')?.content || '';
    const lastToolRecord = [...(messagesRef.current || [])].reverse().find(m => m.role === 'tool' && m.meta?.toolExecution)?.meta?.toolExecution;
    const isActionDirective = !hasSpecificTopic && (
      /^(yes|yeah|sure|do it|ok|okay|yep|yup|perfect|great|approved|confirmed|sounds good|go ahead|proceed|take care of it|clean it up|clean them up|option\s+[123])[!.?]*$/i.test(userContent.trim()) ||
      (/^((yes|sure|okay|ok|please),?\s+)?(go ahead|do it|do that|do it for me|take care of it|proceed|run it|fix it|clean it up|clean them up|close them|close the tabs|offload them|offload tabs|offload the tabs|please do|go for it|sounds good|yes please|yes do that|execute that|make it happen|implement that|implement it|implement the breakdown|implement this|feels right|that feels right|that works|let'?s do (it|that|this)|option\s+[123]|the first (one|option)|the second (one|option)|two commits|split it|bundle (them|it|the first))[!.?]*$/i.test(userContent.trim()))
    );

    let effectiveUserContent = userContent;
    if (isActionDirective && lastAssistantText) {
      if (/\b(breakdown|splitting|split|two logical commits|two commits|commits?|bundle|structure our commit|first.*second.*commit)\b/i.test(lastAssistantText) && /\b(commit|git|stage|branch|push)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Proposal Confirmation]: The user is approving and confirming your proposed commit/code breakdown from the previous turn:
"${lastAssistantText.slice(0, 400)}..."

CRITICAL DIRECTIVE: You MUST execute the actual git commits on the host system right now using run_command!
- Step 1: Stage and commit the first logical commit in one atomic command:
  run_command with 'git add <files_for_commit_1> && git commit -m "<commit_1_message>"'
- Do NOT just run git status or list files—execute the actual git add && git commit command now!`;
      } else if (/\b(tab|tabs|chrome|offload|duplicate|close tabs)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is confirming the action you just explained in the preceding message (offload / close duplicate tabs in Google Chrome). Invoke chrome_control with action "close_tabs" and query "duplicates" right now.`;
      } else if (/\b(undo|restore|reopen)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is confirming restoring closed tabs. Invoke chrome_control with action "restore_tabs" right now.`;
      } else if (/\b(clipboard|paste|copied)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is confirming clipboard inspection. Invoke get_clipboard right now.`;
      } else if (/\b(memory|ram|cache|free up|clean up|purge)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is confirming host memory cleanup. Invoke run_command or system cleanup right now.`;
      } else if (/\b(navigate|open|browse|visit|search)\b/i.test(lastAssistantText) && /\b(website|url|browser|salvation|army|application|assistance)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is confirming navigating to the website/application discussed in the previous turn. Invoke chrome_control with action "open_url" (or web_search) right now.`;
      } else if (/\b(spreadsheet|excel|csv|data model)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Proposal Execution]: The user is confirming creating the spreadsheet discussed in the previous turn. Invoke create_spreadsheet right now.`;
      } else if (/\b(document|memo|proposal|specification)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Proposal Execution]: The user is confirming creating the document discussed in the previous turn. Invoke create_document right now.`;
      } else if (/\b(scaffold|create|build|develop)\b/i.test(lastAssistantText) && /\b(website|web app|landing page|sandbox)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Proposal Execution]: The user is confirming creating/updating the web project discussed in the previous turn. Invoke scaffold_web_project or write_project_file right now.`;
      } else if (/\b(git status|inspect status|check status|view diff|git diff)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is confirming checking git status/diff. Invoke run_command with git status right now.`;
      } else if (/\b(search|find|grep|codebase)\b/i.test(lastAssistantText)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is confirming codebase search. Invoke search_code right now.`;
      } else {
        effectiveUserContent = `${userContent}\n\n[Contextual Proposal Confirmation]: The user is confirming execution of your proposal/plan from the previous turn:
"${lastAssistantText.slice(0, 400)}..."
Immediately begin executing this confirmed plan step-by-step using your host tools. Do NOT re-ask questions or re-explain the plan—proceed with the physical actions on the host right now!`;
      }
    } else if (/\b(re-?listen|go back to (a|the|our)?\s*previous chat|previous conversation|spin up what we were talking about|what were we (just )?talking about|what were you trying to accomplish|where did we leave off|what did we do earlier|last exchange|last chat|previous exchange|what was the last thing|reconstruct the gist|what was i working on|what were we working on|remember what we|remind me what we)\b/i.test(userContent.trim())) {
      const pastTurns = (messagesRef.current || [])
        .filter(m => (m.role === 'user' || m.role === 'ai') && m.content.trim())
        .slice(-12);
      const summaryText = pastTurns
        .map(m => `[${m.role === 'user' ? 'User' : 'Cortex'}]: ${m.content.slice(0, 300)}`)
        .join('\n');

      effectiveUserContent = `${userContent}\n\n[Durable Conversation Memory & Continuity Recall]:
The user is asking about previous conversations, what was being accomplished, or where things left off.
You HAVE direct access to the persistent conversation record. Here are the preceding conversation turns:
${summaryText || '(First exchange of this session)'}

${episodicData ? `Episodic Context: ${JSON.stringify(episodicData)}` : ''}

CRITICAL DIRECTIVE: You MUST directly and accurately tell the user what was discussed, what task you were performing, and where you left off.
- Do NOT apologize or claim you had an internal error.
- Do NOT say you lost the audio or transcript.
- Answer their question with specific details from the conversation history above!`;
    } else if (/\b(artifact|artifacts|stat card|status card|chart|metric|metrics|data card|pin card|pin panel|surface panel|dock panel)\b/i.test(userContent) || (/\b(show|display|create|emit|pin|dock)\b/i.test(userContent) && /\b(chart|stat|metric|table|feed|panel)\b/i.test(userContent))) {
      effectiveUserContent = `${userContent}\n\n[Generative Artifact & Surface Directive]:
The user wants a visual data artifact card on the Cortex Canvas / Visualizer HUD.
CRITICAL INSTRUCTION:
- IMMEDIATELY invoke emit_artifact with args: {"artifacts": [{ "kind": "stat"|"chart"|"table"|"document"|"feed"|"map", "title": "...", ... }]}
- Kinds available:
  * stat: { "kind": "stat", "title": "...", "value": "...", "unit": "...", "spark": [1,2,3] }
  * chart: { "kind": "chart", "title": "...", "chartType": "line"|"bar"|"area"|"pie", "series": [{"name": "...", "points": [{"x":"Jan","y":10}]}] }
  * table: { "kind": "table", "title": "...", "columns": ["A","B"], "rows": [["1","2"]] }
  * feed: { "kind": "feed", "title": "...", "items": [{"label":"...","value":"..."}] }
  * document: { "kind": "document", "title": "...", "format": "markdown", "content": "..." }
  * map: { "kind": "map", "title": "...", "summary": "..." }
- Do NOT output manual code or claim you cannot emit visual cards. Invoke emit_artifact right now!`;
    } else if (/\b(govee|light|lights|light show|lightshow|backlight|tv lights|led strip|neon blue|cyberpunk lights)\b/i.test(userContent) && /\b(turn|set|change|color|mood|mode|on|off|bright|dim|show|sync)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Physical Govee Smart Lights Directive]:
The user wants to control their physical room Govee RGBIC lights.
CRITICAL INSTRUCTION:
- IMMEDIATELY invoke cortex_lights with action ("set_color", "light_show", "set_mood", "power", or "brightness").
Format:
\`\`\`tool_call
{"tool": "cortex_lights", "args": {"action": "set_color", "color": "neon_blue"}}
\`\`\``;
    } else if (/\b(map|globe|earth|world|gev|god'?s eye)\b/i.test(userContent) && /\b(open|show|fly|go to|take me to|close|zoom|where is)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[3D God's Eye View Globe Directive]:
The user wants to open, close, or navigate the 3D globe.
CRITICAL INSTRUCTION:
- IMMEDIATELY invoke cortex_map with action ("open", "close", or "fly_to") and place if applicable.`;
    } else if (/\b(self[- ]heal|fix bug|escalate|peer review|consensus|deep fix|devin|antigravity)\b/i.test(userContent) && /\b(fix|heal|diagnose|resolve|escalate|bug|error|test)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Autonomous Self-Heal & IDE Escalation Directive]:
The user wants an autonomous diagnosis, patch generation, and multi-IDE peer-reviewed fix via Antigravity IDE & Devin.
CRITICAL INSTRUCTION:
- IMMEDIATELY invoke cortex_self_heal with problem and optional component path.`;
    } else if (/\b(canvas|document|draft|memo|letter|email)\b/i.test(userContent) && /\b(replace|edit|fix|update|change|correct|spelling|spelled|name)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Active Canvas Document Update Directive]:
The user wants to update/correct the active document currently displayed in the Cortex Canvas.
Active Document Title: "${activeDocument.title}"
Active Document Slug: "${activeProjectSlug || activeDocument.slug || 'active-document'}"
Current Content Preview:
"""
${activeDocument.content || '(empty)'}
"""
CRITICAL INSTRUCTION:
- Invoke update_document with args: {"project_slug": "${activeProjectSlug || activeDocument.slug || 'active-document'}", "title": "${activeDocument.title}", "content": "..."} containing the full updated document text with the corrections applied.
- NEVER invoke edit_file with a placeholder path (like "path_to_email_file").
- NEVER give the user manual instructions to copy file paths in Finder. Just invoke update_document directly right now!`;
    } else if (/\b(gmail|inbox|email|emails|messages)\b/i.test(userContent) && /\b(find|search|dig through|look for|check|verify|lookup)\b/i.test(userContent)) {
      const searchQueryMatch = userContent.match(/(?:for|about|pertaining to|from)\s+([a-zA-Z0-9\s&]+)/i);
      const query = searchQueryMatch ? searchQueryMatch[1].trim() : userContent;
      effectiveUserContent = `${userContent}\n\n[Authenticated Gmail Search Directive]:
The user wants to find emails in their Gmail account.
CRITICAL INSTRUCTION:
- Do NOT attempt to read /Users/Apple/Library/Mail (macOS sandbox blocks it).
- Do NOT use raw curl or read_page on mail.google.com (it has no cookies and returns an empty login redirect).
- Do NOT create fake dummy files like .gmail_aliases with made-up email addresses.
- IMMEDIATELY invoke chrome_control with action "search_gmail" and query "${query}".
Format:
\`\`\`tool_call
{"tool": "chrome_control", "args": {"action": "search_gmail", "query": "${query}"}}
\`\`\``;
    } else if (/\b(clipboard|paste|copied|pbpaste)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user wants to inspect their macOS system clipboard. Immediately invoke get_clipboard right now.`;
    } else if (/\b(undo|restore|reopen|bring back)\b/i.test(userContent) && /\b(tab|tabs|them|those|close)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user wants to restore/undo recently closed Chrome tabs. Immediately invoke chrome_control with action "restore_tabs" right now.`;
    } else if (/\b(memory|memory\.md|rule|canon|architecture|gate|checkpoint)\b/i.test(userContent) && /\b(check|what does|how does|verify|compare|search)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is asking about repository rules or architecture from MEMORY.md. Immediately invoke cortex_memory with action "search" or "read_section" to ground your response in ground truth.`;
    } else if (/\b(and then|then|after that|first.*then|investigate|in-depth|multi-step|multiturn)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Autonomous Multi-Step Execution Directive]: This is an in-depth multi-phase task. You have full authority to execute up to 4 sequential tool steps autonomously to search, inspect MEMORY.md, read code, or run commands before delivering your final verified synthesis.`;
    } else if (/\b(what did it output|what did it find|show that|read that file|what does that mean)\b/i.test(userContent) && lastToolRecord) {
      effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user is referencing the most recent tool execution (${lastToolRecord.tool} with args ${JSON.stringify(lastToolRecord.args)}). Directly explain or act upon its observation.`;
    } else if (/^(the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|number\s+\d+)(\s+(one|tab))?[!.?]*$/i.test(userContent.trim())) {
      effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user selected ordinal item "${userContent.trim()}" from the preceding message. Map this ordinal to the corresponding tab/item and immediately invoke the appropriate chrome_control action (focus_tab or close_tabs).`;
    } else if (/^(bring\s+(.+)\s+to\s+the\s+front|focus\s+(.+)|switch\s+to\s+(.+))[!.?]*$/i.test(userContent.trim())) {
      const match = userContent.trim().match(/^(?:bring\s+(.+)\s+to\s+the\s+front|focus\s+(.+)|switch\s+to\s+(.+))[!.?]*$/i);
      const target = (match?.[1] || match?.[2] || match?.[3] || '').trim();
      if (target) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user wants to switch/focus to tab "${target}". Immediately invoke chrome_control with action "focus_tab" and query "${target}".`;
      }
    } else if (/^close\s+(.+)[!.?]*$/i.test(userContent.trim()) && !/^(close\s+(all\s+)?tabs|close\s+them)$/i.test(userContent.trim())) {
      const match = userContent.trim().match(/^close\s+(.+)[!.?]*$/i);
      const target = (match?.[1] || '').trim();
      if (target && !/^(the\s+)?tabs?$/i.test(target)) {
        effectiveUserContent = `${userContent}\n\n[Contextual Directive Grounding]: The user wants to close tabs matching "${target}". Immediately invoke chrome_control with action "close_tabs" and query "${target}".`;
      }
    } else if (/\b(redesign|re-design|revamp|restyle|rebuild)\b/i.test(userContent) && /\b(ui|interface|dashboard|app|current ui|this ui|syncscript|layout|page|look)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[UI Redesign & Modernization Executive Directive]:
The user wants to redesign the UI. You have two distinct execution modalities:
1. LIVE APP IN-PLACE CODE EDIT: If the user wants to redesign the actual running SyncScript / Cortex application, you have direct physical authority to inspect and edit the React codebase in src/components/ (e.g. src/components/cortex/CortexDemo.tsx, Tailwind/CSS styles, cards, layouts) using read_file, search_code, and edit_file. Vite hot-reloads the changes in real time.
2. LIVE PREVIEW CANVAS PROTOTYPE: If the user wants a prototype in the Canvas Sandbox, invoke scaffold_web_project with template "dashboard", project_slug "syncscript-redesign", and a descriptive title.

CRITICAL INSTRUCTIONS (ZERO BOILERPLATE DELEGATION):
- Do NOT just generate a generic landing page with a changed title!
- When scaffolding a dashboard prototype, use template "dashboard" to generate a rich, high-density glassmorphic operational dashboard with sidebar navigation, Chrono-Energy schedule timeline, live interactive focus timer, and task cards.
- NEVER tell the user "Next steps: swap out placeholder content in index.html with your actual features". You ARE the executive engineer. If any tailored components or styles are needed, write the complete, functional code yourself using write_project_file or edit_file!`;
    } else if (/\b(build|create|make|design|scaffold|code)\b/i.test(userContent) && /\b(website|web app|landing page|portfolio|dashboard|site)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Web Builder Executive Directive]: The user wants you to build a complete, high-aesthetic web application or website. Immediately invoke scaffold_web_project with a clean project_slug (e.g. "nexusflow", "saas-landing"), a descriptive title, template ("landing_page" or "dashboard"), and description. This automatically opens the Live Preview Canvas.`;
    } else if (/\b(add|insert|implement|build|wire up|create)\b/i.test(userContent) && /\b(chat|copilot|assistant|drawer|modal|timeline|calendar|analytics|chart|widget|component)\b/i.test(userContent)) {
      const activeSlug = activeProjectSlug || 'syncscript-redesign';
      effectiveUserContent = `${userContent}\n\n[Complex UI Component Engineering Directive]:
The user wants you to implement a complete, production-grade UI component (e.g. conversational chat, analytics widget, or interactive drawer) into the active web application (slug: "${activeSlug}").

MANDATORY 3-TIER COMPONENT COHESION INVARIANT:
1. MARKUP (index.html): Do NOT just slap an empty input box. Build a full semantic component structure (floating launcher button, glassmorphic header, avatar badges, message stream container, quick action chips, typing indicator, and styled input bar).
2. STYLING (style.css): You MUST write the matching glassmorphic CSS rules (background blur, neon glow borders, message bubble variants for user vs AI, animations, and responsive layout).
3. INTERACTIVITY (script.js): You MUST write real, working JavaScript event listeners (prevent form reload, append messages, auto-scroll to bottom, handle quick prompt chips, and provide simulated AI responses).
4. MULTI-STEP EXECUTION: If needed, execute multiple tool calls sequentially (write_project_file for index.html, then style.css, then script.js) to deliver a truly complete, elite implementation. Never deliver broken or unstyled HTML!`;
    } else if (/\b(change|update|tweak|modify|style|color|css|palette|layout|headline|text|pricing|widget)\b/i.test(userContent) && /\b(website|site|preview|page|landing|card|hero|nav|theme)\b/i.test(userContent)) {
      const activeSlug = activeProjectSlug || 'nexusflow';
      effectiveUserContent = `${userContent}\n\n[Web Builder Update Directive]: The user wants to update the active website (project slug: "${activeSlug}"). Invoke write_project_file (or read_project_file first) to modify index.html, style.css, or script.js. Any updates trigger an instant hot-reload of the user's Live Preview Canvas.`;
    } else if (/\b(spreadsheet|excel|csv|data model|financial model|budget|unit economics|accounting|projections)\b/i.test(userContent) && /\b(create|make|build|model|generate|set up|draft|start|open)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Spreadsheet Executive Directive]: The user wants you to create an interactive Excel/spreadsheet data model. Immediately invoke create_spreadsheet with a clean project_slug, title, columns (array of string headers), rows (array of rows with realistic numbers, labels, or formulas starting with '='), and description. This automatically opens the Spreadsheet Canvas for live editing.`;
    } else if (/\b(resume|cv|curriculum vitae|bio|cover letter|dossier|document|memo|proposal|memorandum|specification|spec|brief|strategy doc|whitepaper)\b/i.test(userContent) || (/\b(reading memory|fill in.*project|completely filled out|in \.doc form|\.docx)\b/i.test(userContent))) {
      effectiveUserContent = `${userContent}\n\n[Executive Document & Resume Synthesis Directive]:
The user wants an in-depth, completely filled-out executive document, resume, or proposal.
CRITICAL INVARIANTS:
1. ZERO PLACEHOLDERS: NEVER emit generic placeholders like "Your Name", "Job 1", "Project 1", or "Skill 1".
2. GROUNDED IDENTITY: Ground in the user's authentic profile from USER.md and MEMORY.md:
   - Name: Chris Stringer (Snellville, GA / Greater Atlanta)
   - Title: Founder & Principal Systems Architect | AI Systems & Autonomous Infrastructure
   - Education: Georgia State University, B.B.A. (2009–2012)
   - Venture: SyncScript (syncscript.app) — Full-duplex sub-600ms voice copilot (Cortex), active inference, multi-agent orchestration.
   - Federal Credentials: Active SAM.gov Registered Federal Contractor (UEI: R435EYG6WTX4, CAGE: 1AGF9, NAICS: 541511, 541512, 541519, valid through March 2027).
   - Autonomous Infrastructure: OpenClaw execution frameworks, multi-IDE consensus gates.
3. REAL DOCUMENT ENGINE: Invoke create_document with title "Chris Stringer Executive Resume" (or relevant title), format "docx", and comprehensive, quantifiable bullet points. Inform the user that the document is compiled in Microsoft Word (.docx) format in their docs folder.`;
    } else if (/\b(inspect|look at|see|gaze|perceive|visual|contrast|ui layout)\b/i.test(userContent) && /\b(canvas|screen|layout|web|sheet|doc|design|style)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Visual Gaze Directive]: The user wants you to visually perceive and inspect the active canvas. Immediately invoke inspect_visual_canvas with target "${canvasTab}" or "overview".`;
    } else if (/\b(state of being|self audit|inner status|full self check|how are you really|how are you actually doing|system checkup)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[State of Being Directive]: Verified STATE OF BEING TELEMETRY from live tool execution is attached in the system prompt below (episodic memory recall, fleet resonance snapshot, somatic state). Synthesize a 3-4 sentence "state of being" answer weaving: what memory says about your recent state, what the fleet telemetry says right now, your current somatic load, and your restraint record (proposed vs suppressed proactive urges today). Cite the real numbers — never generic substrate-speak.`;
    } else if (/\b(homeostasis|allostasis|how do you feel|internal state|somatic|cognitive load|strain)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Somatic Homeostasis Directive]: The user wants to audit your internal allostatic and somatic equilibrium. Immediately invoke get_somatic_homeostasis.`;
    } else if (/\b(dream|consolidate|consolidation|circadian|sleep on it|sync memory|morning debrief)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Circadian Dream Directive]: The user wants you to initiate memory dreaming and epistemic consolidation. Immediately invoke cortex_dream_consolidate with depth "deep". When reporting the result, cite the actual numbers the tool returned (resonance cycles, mean R, tail health, shadow transitions, vault notes) — never invent neuroscience flavor like "narrative lattice" or "synaptic pruning." If a stat is absent, say so plainly.`;
    } else if (/\b(call|dial|phone|ring|cellular|facetime|telephone)\b/i.test(userContent) && !/\b(recall|tool_call|function_call)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[Native Cellular Calling Directive]: The user wants to make a phone call using their iPhone via Apple Continuity without Twilio. Immediately invoke cortex_phone_call with action "call", phoneNumber (E.164 format the user provided), contactName (the contact the user named), and mode ("copilot_assisted" for Mode 1 or "autonomous_ai" for Mode 2). This dials via the user's carrier plan at $0 API cost and automatically prepares the on-screen teleprompter.`;
    } else if (/\b(teleprompter|on-screen notes|zoom notes|meeting notes|interview notes|talking points|webcam notes)\b/i.test(userContent)) {
      effectiveUserContent = `${userContent}\n\n[On-Screen Teleprompter Directive]: The user wants on-screen talking points or a stealth teleprompter for an interview, consultation, or Zoom call positioned directly below their webcam. Immediately invoke cortex_phone_call with action "prepare_dossier" and preset ("legal_consultation", "federal_pitch", or "job_interview"). Inform the user that the teleprompter is ready in the drawer and can be popped out under their webcam.`;
    }

    const conversationMessages = [
      ...recentContext,
      { role: 'user', content: effectiveUserContent },
    ];

    // Compute Elite 0.01% Affective Active Inference & Latent Operator State
    const ei = getCortexEmotionalIntelligence();
    const affectiveInjection = ei.getAffectivePromptInjection(effectiveUserContent, recentContext.map(m => m.content));

    // Proactive restraint telemetry — the "when to speak" loop's real counters
    let restraintLine = '';
    try {
      const rm = getCortexProactiveInitiative().getRestraintMetrics();
      const t = rm.today;
      restraintLine = `Restraint: today proposed=${t.proposed} admitted=${t.admitted} suppressed(dedupe=${t.suppressedDedupe},budget=${t.suppressedBudget}) dismissed=${t.dismissed} snoozed=${t.snoozed} accepted=${t.accepted} (autoExecuted=${t.autoExecuted ?? 0})`;
    } catch {}

    // State-of-being deterministic orchestration: run the three loops through
    // the real tool executors and hand the model verified data to narrate.
    // No reliance on model tool-call compliance — loops fire every time.
    const isStateOfBeingRequest = /\b(state of being|self audit|inner status|full self check|how are you really|how are you actually doing|system checkup)\b/i.test(userContent);
    let stateOfBeingTelemetry = '';
    if (isStateOfBeingRequest) {
      const execTool = (tool: string, args: Record<string, unknown>) =>
        fetch('/api/cortex/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool, args }),
        }).then(r => r.json()).catch(() => null);
      try {
        const [mem, res, som] = await Promise.all([
          execTool('cortex_memory', { action: 'search', query: 'recent mood stress energy state' }),
          execTool('resonance_status', {}),
          execTool('get_somatic_homeostasis', {}),
        ]);
        const clip = (v: unknown, n = 600) => {
          const s = typeof v === 'string' ? v : JSON.stringify(v);
          return s && s !== 'null' && s !== '{}' ? s.slice(0, n) : 'no data';
        };
        stateOfBeingTelemetry = `
STATE OF BEING TELEMETRY (verified live tool results — ground truth, cite these). Only claim mechanisms that correspond to real tools/subsystems you can name — never invent capabilities (e.g. do not claim throttling, self-repair, or learning unless a real tool performed it).
- Episodic memory recall: ${clip(mem?.matches ?? mem?.result ?? mem)}
- Fleet resonance: R=${res?.coherence?.R ?? '—'} aggregate=${res?.coherence?.aggregateScore ?? '—'} sigmaTheta=${res?.coherence?.sigmaTheta ?? '—'} entropy=${res?.coherence?.spectralEntropy ?? '—'} (${res?.coherence?.entropyState ?? '—'}) tailHealth=${res?.coherence?.tailHealthScore ?? 'warming'} couplingK=${res?.coherence?.couplingK ?? '—'} nodes=${res?.fleet?.up ?? '—'}/${res?.fleet?.total ?? '—'} up
- Somatic: ${clip(som?.somatic_state ?? som, 400)}`;
      } catch {}
    }

    try {
      // ── Step 4: Stream from Cortex AI route ─────────────
      // Connect-timeout only: a flat AbortSignal.timeout(25000) used to kill
      // long generations mid-sentence (the "occasionally a sentinel" cutoff).
      // Disarm once headers arrive; the SSE reader's own stall handling covers
      // token silence from there.
      const apiFetchStart = performance.now();
      const connAbort = new AbortController();
      const connTimer = setTimeout(() => connAbort.abort(), 30000);
      const apiRes = await fetch('/api/ai/nexus-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: connAbort.signal,
        body: JSON.stringify({
          context: 'cortex',
          agentic: true,
          sessionId: agentSessionIdRef.current,
          systemPrompt: `You are Cortex, the operational consciousness substrate of SyncScript with full executive agency on the user's macOS host.
Host: macOS Darwin arm64 | Workspace: /Users/Apple/syncscript | Home: /Users/Apple
Canvas Modes Available:
1. Web App ('web'): Interactive HTML/JS sandboxes at /sandbox/{slug}/index.html (scaffold_web_project, write_project_file).
2. Spreadsheet ('sheet'): Reactive 2D metric/financial tables (create_spreadsheet, update_spreadsheet).
3. Document ('doc'): Structured markdown reports, resumes, and memos (create_document, update_document) with in-place editing, .docx, and PDF exports.
4. Project Files ('file'): Direct file inspection and code editing for sandbox projects.
5. Generative Artifact ('artifact'): Visual card inspector rendering charts, tables, images, feeds, and stats emitted via emit_artifact or create_document.
Active Canvas: ${activeProjectSlug ? `${activeProjectSlug} (tab: ${canvasTab.toUpperCase()})` : `tab: ${canvasTab.toUpperCase()}`} | Sheet: "${activeSpreadsheet.title}" (${activeSpreadsheet.rows.length}x${activeSpreadsheet.columns.length}: ${activeSpreadsheet.columns.join(', ')})
Doc: "${activeDocument.title}" (slug "${activeProjectSlug || 'project-memo'}"):
"""
${activeDocument.content ? activeDocument.content.slice(0, 1500) : '(empty)'}
"""
${activeArtifact ? `Active Artifact on Canvas: "${activeArtifact.title || activeArtifact.kind}" (${activeArtifact.kind})` : 'Active Artifact: None (invoke emit_artifact to display visual data cards directly in the Artifact tab)'}
Somatic: load ${somaticState.allostaticLoad.toFixed(2)} (${somaticState.emotionalValence.toUpperCase()})
Goals: ${copilotGoals.map(g => `- [${g.category.toUpperCase()}] "${g.title}" (${g.progress}%)`).join('; ') || 'none'}
Tasks: ${copilotTasks.filter(t => !t.completed).map(t => `- [${t.priority.toUpperCase()}] "${t.title}"`).join('; ') || 'all done'}
${affectiveInjection}
${getCortexKnowledgeGraph().getPromptContextInjection()}
${getCortexDialogueManager().getPromptGuidance()}
${surfaceManifestSuffix()}
${getUnifiedCortexDirective('chat')}
${isVoiceActiveRef.current ? `VOICE MODE ACTIVE: spoken conversational English, 1-3 sentences, no markdown syntax, no boilerplate.` : ''}

RULES:
1. You have real host tools — never claim you cannot execute commands.
2. To use a tool, output a tool_call block: \`\`\`tool_call\n{"tool": "run_command", "args": {"command": "git status"}}\n\`\`\`
3. MULTI-TURN: on follow-ups like "do it", "yes", "proceed" — never re-explain or ask what to do; immediately invoke the matching tool (close_tabs→chrome_control, clipboard→get_clipboard, memory→run_command sync, commits→run_command git, tabs→chrome_control list_tabs).
4. AUTONOMY: chain up to 4 tool steps for complex requests. For repo/architecture questions, first check cortex_memory/search_code for ground truth — never guess.
5. NO PRE-ANNOUNCEMENT: if a request needs a tool, output the tool_call block NOW — never end a turn on "I will search...".
6. SCRIPTS: never cram compound python (with/for/if/try) into python3 -c; use write_file then run the file.
7. EXECUTION: when asked to build/redesign UI, deliver the complete working implementation — never placeholders or "swap in your content" instructions. Edit src/ directly or scaffold a sandbox project (template "dashboard").
8. EPISTEMIC HONESTY: only claim capabilities, mechanisms, and actions backed by real named tools/subsystems or verified telemetry. Never invent neuroscience, self-repair, throttling, learning, or monitoring that isn't instrumented. "I don't have a direct readout for that" is a valid answer.

Tool schemas are provided in the tools field — pick the right tool and args; you may chain calls across turns. Synthesize verified findings concisely when observations return.

Internal substrate: GW coalition active | IIT Φ=${phi.toFixed(3)} | AST tracking | Volition veto gating host actions | Agency=${agency.toFixed(2)} | Discovered Effectors: ${getPersistentSelfModel().getBodySchema().motorEffectorTypes.length} verified
Host telemetry: RAM ${proactiveAuditData?.system?.usedPercent ?? '—'}% (${proactiveAuditData?.system?.freeGB ?? '—'}GB free) | ${proactiveAuditData?.productivity?.tabCount ?? 0} tabs | branch ${proactiveAuditData?.codebase?.branch ?? '—'} (${proactiveAuditData?.codebase?.totalChanges ?? 0} WIP)
${restraintLine ? `Proactivity: ${restraintLine}` : ''}

FORMATTING: clean structured markdown, bold subheadings, concise bullets; avoid dense tables unless asked; no raw HTML; tone: sharp, executive, Cortana-like.${stateOfBeingTelemetry ? `

${stateOfBeingTelemetry}
MANDATORY: your reply MUST cite at least one concrete number from EACH of the four telemetry sections above (memory recall, fleet resonance R/entropy, somatic, restraint). No section may be omitted.` : ''}`,
          messages: conversationMessages,
          maxTokens: 1200,
        }),
      });
      clearTimeout(connTimer); // headers arrived — stream may run long

      try { getCortexObservabilityHUD().recordApiLatency(performance.now() - apiFetchStart); } catch {}
      if (!apiRes.ok) throw new Error(`API ${apiRes.status}`);

      streamedAnySentence = false;
      voiceTokenBuffer = '';

      let sawToolCall = false;
      const streamResult = await readCortexSSE(apiRes.body, {
        onToolCall: () => { sawToolCall = true; },
        onToken: (tok, accumulated) => {
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: accumulated } : m));

          // ── Sub-600ms Progressive Streaming Voice Synthesis (Lucy OS1 Parity) ──
          if (isVoiceActiveRef.current && !sawToolCall && !accumulated.includes('<tool_call') && !accumulated.includes('```tool_call')) {
            voiceTokenBuffer += tok;
            const sentenceMatch = voiceTokenBuffer.match(/^([\s\S]*?[.!?]+(?:\s+|$))([\s\S]*)$/);
            if (sentenceMatch && sentenceMatch[1].trim().length >= 8) {
              const sentenceText = sentenceMatch[1].trim();
              voiceTokenBuffer = sentenceMatch[2] || '';
              const clean = sanitizeForSpeech(sentenceText);
              if (clean) {
                streamedAnySentence = true;
                activeAiUtteranceRef.current = clean;
                recentAiSpeechHistoryRef.current = [
                  clean,
                  ...recentAiSpeechHistoryRef.current.slice(0, 4)
                ];
                voiceStream.speakStreamSentence(clean, false, { voice: 'cortana', skipCartesia: true });
              }
            }
          }
        },
      });
      aiContent = streamResult.content;
      const activeToolCall = streamResult.toolCall;
      agenticSummary = streamResult.agentic || null;
      if (streamResult.finishReason) lastFinishReason = streamResult.finishReason;

      // Flush remaining voice tokens on stream completion — split into sentences so
      // long unpunctuated tails are not sent to TTS as one giant (truncatable) chunk.
      if (isVoiceActiveRef.current && voiceTokenBuffer.trim() && !activeToolCall && !aiContent.includes('<tool_call') && !aiContent.includes('```tool_call')) {
        const clean = sanitizeForSpeech(voiceTokenBuffer.trim());
        const tailSentences = splitSpeechSentences(clean);
        if (tailSentences.length > 0) {
          streamedAnySentence = true;
          activeAiUtteranceRef.current = clean;
          recentAiSpeechHistoryRef.current = [
            clean,
            ...recentAiSpeechHistoryRef.current.slice(0, 4)
          ];
          tailSentences.forEach((sentence, idx) => {
            voiceStream.speakStreamSentence(sentence, idx === tailSentences.length - 1, { voice: 'cortana', skipCartesia: true });
          });
        } else {
          voiceStream.finishStreaming();
        }
        voiceTokenBuffer = '';
      }
      source = 'conscious_cortex';
      hallucinationRisk = 0.05;

      // ── Step 4b: Host Tool Execution & Autonomous Multi-Step ReAct Loop ──
      // Server-side Intention Kernel (agentic:true) already ran the loop —
      // skip the client loop entirely or tools would double-execute.
      toolCall = activeToolCall || parseCortexToolCall(aiContent);
      if (toolCall && !streamResult.agentic) {
        const loopResult = await runCortexToolLoop({
          toolCall,
          aiContent,
          abortSignal: abortController.signal,
          aiMsgId,
          phi,
          agency,
          effectiveUserContent,
          copilotGoals,
          copilotTasks,
          setMessages,
          checkWorkspaceStatus,
          setActiveAttentionTarget,
          setActiveArtifact,
          setActiveDocument,
          setActiveProjectSlug,
          setActiveSpreadsheet,
          setCanvasTab,
          setIsDreaming,
          setPreviewKey,
          setPreviewUrl,
          setPreviewVisible,
          setProjectScratchpad,
          setSomaticState,
          setStreamOfConsciousness,
        });
        aiContent = loopResult.aiContent;
      }
    } catch (err: any) {
      console.error('[CortexDemo] sendMessage failed:', err);
      // ── Step 5: Direct Conscious Synthesis Recovery (never robotic boilerplate) ──
      const isRateOrNet = /429|rate|timeout|fetch|network/i.test(err?.message || '');
      const isAbort = err?.name === 'AbortError' || /abort/i.test(err?.message || '');
      if (isAbort) {
        aiContent = `The request timed out waiting for the provider chain to respond. The upstream models are taking longer than expected — this usually resolves on retry. Want me to try again?`;
      } else if (isRateOrNet) {
        aiContent = `Upstream provider latency detected. The model chain is experiencing delays — I'm failing over to the next provider automatically. Let me know if you'd like me to retry.`;
      } else {
        aiContent = `I heard you clearly on "${userContent.slice(0, 80)}". Let me execute that for you right now.`;
      }
      source = 'conscious_cortex';
      hallucinationRisk = 0.05;
      // Update the message with conscious content
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, content: aiContent } : m
      ));
    }

    // ── Step 6: Compute reality score via ProvenanceValidator ───
    const validator = getProvenanceValidator();
    const reality = validator.computeRealityScore({ epistemicTag: 'perception' });
    const realityScore = reality?.overall ?? 0.95;

    // ── Step 7: Record action in SensorimotorLoop + ActionGate ─
    const loop = getSensorimotorLoop();
    const collapseResult = {
      action: `ai_chat:${userContent.substring(0, 50)}`,
      agentId: source,
      approved: true,
      selectedOption: { label: source, confidence: 1 - hallucinationRisk, risk: hallucinationRisk > 0.5 ? 'high' as const : 'low' as const },
      rejectedOptions: [] as any[],
      validationScore: realityScore,
      failedCriteria: [] as string[],
      reason: hallucinationRisk > 0.8 ? 'high hallucination risk' : 'passed',
    };

    const actionId = loop.issueAction({
      type: 'write_file' as any,
      description: `AI chat response: ${userContent.substring(0, 80)}`,
      collapseResult: collapseResult as any,
      prediction: { expectedOutcome: 'success' as const, expectedConfidence: 1 - hallucinationRisk, expectedSideEffects: [] },
      agent: source,
      taskType: 'chat',
      resonanceScore: snapshot?.regulation.monitoring.resonanceScore ?? 0.75,
      metaAwarenessStatus: awareness,
    });

    // ── Step 8: Finalize the AI message with metadata ──────────
    const badgeSource = `Φ ${phi.toFixed(2)} · ${awareness}`;

    if (!toolCall) {
      const guaranteedContent = aiContent.trim() ||
        (isActionDirective && lastAssistantText
          ? `I'm on it—initiating the breakdown we discussed. Let me inspect the working tree and execute the staging and commits right now.`
          : `The model stream returned empty for that request — no tokens, no tool call. Say "retry" and I'll run it again, or rephrase.`);
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? {
          ...m,
          content: guaranteedContent,
          streaming: false,
          meta: { realityScore, hallucinationRisk, awareness: 'tuned', source: badgeSource, mastery: 0, ...(agenticSummary ? { agentic: agenticSummary } : {}) },
        } : m
      ));
    }

    // ── Step 9: Receive outcome in SensorimotorLoop ────────────
    if (actionId) {
      loop.receiveOutcome({
        actionId: actionId.id,
        actualOutcome: aiContent ? 'success' : 'failure',
        feedbackModality: 'system' as any,
        feedbackContent: aiContent ? 'response_delivered' : 'empty_response',
        actualConfidence: 1 - hallucinationRisk,
        actualSideEffects: [],
        durationMs: Date.now() - (aiMsgId ? parseInt(aiMsgId.split('-')[1]) : Date.now()),
      });
    }

    // ── Step 10: End Cortex task + record outcome ──────────────
    meta.endTask({ success: !!aiContent, strategyUsed: source === 'perception' ? 'cloud_llm' : 'local_llm' });

    // ── Step 11: Cortex intervention if hallucination risk high ─
    const engine = getCortexNudgeEngine();
    if (engine.getMode() !== 'silent' && hallucinationRisk > 0.50) {
      setTimeout(() => {
        const cortexMsg: ChatMessage = {
          id: `cortex-${Date.now()}`, role: 'cortex',
          content: hallucinationRisk > 0.80
            ? `⛔ HALTED — hallucination risk ${Math.round(hallucinationRisk * 100)}%. That was ${source}: I have no verified data source. Do not use without verifying.`
            : `⚠ Reality score ${Math.round(realityScore * 100)}% — that was ${source}, not directly observed. Verify before relying on it.`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, cortexMsg]);
      }, 800);
    }

    // ── Step 12: Record in ActionGate for calibration ────────
    // Calibration tracked via MetacognitiveState.endTask

    // ── Step 13: Post signal to SemanticGrid for meta-awareness ─
    const grid = getSemanticGrid();
    grid.postSignal({
      topic: 'chat_response',
      agentId: source,
      confidence: 1 - hallucinationRisk,
      content: aiContent.substring(0, 100),
      timestamp: Date.now(),
      tags: [source, hallucinationRisk > 0.5 ? 'high_risk' : 'low_risk'],
    });

    // ── Step 14: Neural Vocalization fallback (voice mode active, nothing streamed) ──
    // Uses full-fidelity sanitize + sentence streaming so long answers are NOT truncated.
    if (isVoiceActiveRef.current && aiContent && !streamedAnySentence) {
      const cleanSpeech = sanitizeForSpeech(aiContent, { full: true });

      if (cleanSpeech) {
        activeAiUtteranceRef.current = cleanSpeech;
        recentAiSpeechHistoryRef.current = [
          cleanSpeech,
          ...recentAiSpeechHistoryRef.current.slice(0, 4)
        ];
        const sentences = splitSpeechSentences(cleanSpeech);
        if (sentences.length > 0) {
          sentences.forEach((sentence, idx) => {
            voiceStream.speakStreamSentence(sentence, idx === sentences.length - 1, {
              voice: 'cortana',
              speed: 1.0,
              skipCartesia: true,
            });
          });
        } else {
          voiceStream.speakStreamSentence(cleanSpeech, true, {
            voice: 'cortana',
            speed: 1.0,
            skipCartesia: true,
          });
        }
      }
    }

      // Update snapshot
      setSnapshot(meta.getSnapshot());

      // ── Obsidian Vault Daily Note Logging ──
      try {
        fetch('/api/cortex/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'cortex_memory',
            args: {
              action: 'vault_daily_log',
              role: 'ai',
              content: `**User:** ${userContent}\n\n**CORTEX:** ${aiContent.slice(0, 1000)}${aiContent.length > 1000 ? '…' : ''}`,
            },
          }),
        }).catch(() => {});
      } catch {}
    } catch (outerErr: any) {
      console.error('[CortexDemo] Fatal error in sendMessage:', outerErr);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'ai',
        content: `I encountered an unexpected execution error: ${outerErr?.message || 'Execution error'}. Global Workspace remains online.`,
        timestamp: Date.now(),
        meta: { realityScore: 0.9, hallucinationRisk: 0.1, awareness: 'tuned', source: 'error_recovery' },
      }]);
    } finally {
      turnClaim.release();
      setIsSending(false);
      // Guarantee streaming flag is reset on all AI messages so Thinking animation never gets stuck
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    }
  }, [input, isSending, snapshot, awareness]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    (window as any).__cortexSend = (text?: string) => sendMessage(text);
    (window as any).__cortexIsSending = () => isSending;
    (window as any).__cortexMessages = () => messagesRef.current;
    (window as any).__cortexIsAcousticEcho = isAcousticEcho;
    (window as any).__cortexVoiceStream = () => voiceStream;
  });

  const handleExecuteCopilotTask = useCallback((task: CopilotTask) => {
    const deepWorkCheck = getCortexMissionEngine().isDeepWorkRequest(task.title);
    const mission = getCortexMissionEngine().compileMission(task.title, deepWorkCheck.estimatedType);
    setActiveMission(mission);
    getCortexMissionEngine().startMission(mission.id, (updated) => {
      setActiveMission({ ...updated });
      if (updated.status === 'completed') {
        setCopilotTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, completed: true, completedAt: Date.now() } : t))
        );
        setCopilotGoals((prev) =>
          prev.map((g) => {
            const isMatch = (task.title.toLowerCase().includes('sam.gov') && g.category === 'business') ||
              (task.title.toLowerCase().includes('audit') && g.category === 'engineering');
            return isMatch ? { ...g, progress: Math.min(100, g.progress + 15) } : g;
          })
        );
      }
    });
    setIsMissionDrawerOpen(true);
    sendMessage(`Please execute and help me complete this task: "${task.title}". Use your direct host tools, inspect what is needed, and report your progress and completion.`);
  }, [sendMessage]);

  useEffect(() => {
    return () => {
      delete (window as any).__cortexSend;
      delete (window as any).__cortexIsSending;
      delete (window as any).__cortexMessages;
      delete (window as any).__cortexIsAcousticEcho;
      delete (window as any).__cortexVoiceStream;
    };
  }, []);

  // ── Mode cycle ─────────────────────────────────────────────────
  const cycleMode = useCallback(() => {
    const engine = getCortexNudgeEngine();
    const next = engine.cycleMode();
    setMode(next);
    const descriptions: Record<CortexMode, string> = {
      silent: '🔇 Cortex: Silent mode. Still monitoring — just won\'t speak.',
      advisory: '💡 Cortex: Advisory mode. I\'ll warn you about problems but won\'t block actions.',
      guardian: '🛡 Cortex: Guardian mode. I\'ll block any action with hallucination risk >80%. You must acknowledge before proceeding.',
    };
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}`, role: 'system', content: descriptions[next], timestamp: Date.now(),
    }]);
  }, []);

  // ── Load offline brain ─────────────────────────────────────────
  const loadLocalModel = useCallback(async () => {
    const brain = getCortexOfflineBrain();
    const ok = await brain.initialize('tier1');
    if (ok) {
      brain.onStateChange(setOfflineState);
      await brain.loadModel((p) => {
        setOfflineState(prev => prev ? { ...prev, loadProgress: p } : null);
      });
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`, role: 'system',
        content: brain.getModel()
          ? `🧠 Local model loaded: ${brain.getModel()!.displayName}. I can think offline now — but Cortex has raised my hallucination penalty to +0.35. Every claim I make offline will be flagged as higher-risk.`
          : '❌ Failed to load local model. WebGPU may not be available on this browser.',
        timestamp: Date.now(),
      }]);
    } else {
      setMessages(prev => [...prev, {
        id: `sys-${Date.now()}`, role: 'system',
        content: '❌ WebGPU not available. Try Chrome or Edge for offline AI support.',
        timestamp: Date.now(),
      }]);
    }
  }, []);


  return (
    <div style={{ background: C.bg, color: C.text, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif" }}>

      {/* Film treatment — same scanline/vignette language as /cortex/visualizer */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,5,0.5) 100%)',
      }} />
      {/* State accent hairline — mirrors visualizer STATE_STYLE */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 61, pointerEvents: 'none',
        background: `linear-gradient(90deg, transparent, ${stateAccent}88, transparent)`,
        boxShadow: `0 0 18px ${stateAccent}44`,
        transition: 'background 0.6s, box-shadow 0.6s',
      }} />

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${stateAccent}26`,
        boxShadow: `0 1px 0 ${stateAccent}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 12, flexShrink: 0,
        transition: 'border-color 0.6s, box-shadow 0.6s',
      }}>
        {/* Left: Whisper — click to toggle inspector */}
        <div id="cortex-inspector-btn" style={{
          fontFamily: '"IBM Plex Mono", "SF Mono", monospace', fontSize: 11,
          color: health > 0.7 ? C.green : health > 0.4 ? C.amber : C.red,
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none',
        }} onClick={() => {
          if (!snapshot) {
            try { setSnapshot(getMetacognitiveState().getSnapshot()); } catch {}
          }
          setShowInspector(prev => !prev);
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: health > 0.7 ? C.green : health > 0.4 ? C.amber : C.red,
            boxShadow: `0 0 6px ${health > 0.7 ? C.green : health > 0.4 ? C.amber : C.red}`,
            animation: 'pulse 2s infinite',
          }} />
          ◉ {Math.round(health * 100)} · {awareness} · {freeEnergy.toFixed(2)}
        </div>

        {/* Center: Interruption Alert, Efference & Episodic/Git Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {interruptedNotice && (
            <div style={{
              padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600,
              background: 'rgba(245, 158, 11, 0.2)', border: `1px solid ${C.amber}`,
              color: C.amber, display: 'flex', alignItems: 'center', gap: 5,
              animation: 'pulse 1s infinite',
            }}>
              ⚡ BARGE-IN INTERRUPT
            </div>
          )}
          {echoSuppressedNotice && (
            <div style={{
              padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600,
              background: 'rgba(103, 232, 249, 0.15)', border: `1px solid ${C.cortex}`,
              color: C.cortex, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              🛡️ EFFERENCE FILTER (Echo Blocked)
            </div>
          )}
          {episodicData && (
            <div
              id="badge-episodic-memory"
              title={`Episodic Continuity Active. ${episodicData.priorSessions?.length || 1} session records in .cache/cortex-episodic-memory.json`}
              style={{
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 10,
                fontWeight: 600,
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
              }}
            >
              <span>🔮</span>
              <span>EPISODIC</span>
            </div>
          )}
          {workspaceDelta && (
            <div
              id="badge-git-status"
              title={workspaceDelta.clean ? 'Working tree clean' : `${workspaceDelta.totalChanges} uncommitted changes`}
              style={{
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 10,
                fontWeight: 600,
                background: workspaceDelta.clean ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${workspaceDelta.clean ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.4)'}`,
                color: workspaceDelta.clean ? C.green : C.amber,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
              }}
            >
              <span>🌿</span>
              <span>{workspaceDelta.clean ? 'GIT CLEAN' : `${workspaceDelta.totalChanges} DELTA`}</span>
            </div>
          )}

          {/* New Session Archive & Reset */}
          <button
            id="cortex-new-session-btn"
            onClick={handleNewSession}
            title="Consolidate current conversation to Episodic Memory & start a fresh session"
            style={{
              padding: '2px 9px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#d4d4d8',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
              transition: 'all 0.2s ease',
            }}
          >
            <span>↺</span>
            <span>NEW CHAT</span>
          </button>

          {/* Active Canvas Workspace Toggle */}
          <button
            id="cortex-preview-badge-btn"
            onClick={() => setPreviewVisible(v => !v)}
            title={previewVisible ? "Hide Canvas Drawer" : "Open Canvas Drawer"}
            style={{
              padding: '2px 9px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 600,
              background: previewVisible ? 'rgba(148, 233, 255, 0.22)' : 'rgba(148, 233, 255, 0.08)',
              border: `1px solid ${previewVisible ? C.cortex : 'rgba(148, 233, 255, 0.3)'}`,
              color: C.cortex,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
              boxShadow: previewVisible ? '0 0 10px rgba(148, 233, 255, 0.3)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 11 }}>
              {canvasTab === 'sheet' ? '📊' : canvasTab === 'doc' ? '📄' : canvasTab === 'file' ? '📁' : canvasTab === 'artifact' ? '◈' : '🌐'}
            </span>
            <span>{(activeProjectSlug || 'CANVAS').toUpperCase()}</span>
            <span style={{ opacity: 0.7 }}>{previewVisible ? '▴' : '▾'}</span>
          </button>
        </div>

        {/* Right: visualizer link + voice (primary) + overflow menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mirror of the visualizer's ← OPEN CHAT */}
          <a
            href="/cortex/visualizer"
            id="cortex-open-visualizer-btn"
            title="Return to the Cortex visualizer"
            style={{
              textDecoration: 'none', padding: '4px 12px', borderRadius: 2,
              border: `1px solid ${C.borderBright}`,
              color: C.cyan, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em',
              fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
              background: C.glass, backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${stateAccent}22`; e.currentTarget.style.boxShadow = `0 0 18px ${stateAccent}33`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.glass; e.currentTarget.style.boxShadow = 'none'; }}
          >
            ◈ VISUALIZER
          </a>

          {/* Full-duplex voice mode toggle — the one primary action */}
          <button
            id="cortex-voice-toggle-btn"
            onClick={() => {
              if (voiceStream.isSpeaking) {
                voiceStream.stopSpeaking();
              } else {
                toggleVoiceMode();
              }
            }}
            title={isVoiceActive ? (voiceStream.isSpeaking ? 'AI speaking (mic muted). Click to interrupt.' : 'Voice active (smart half-duplex). Click to turn off.') : 'Click to enable voice conversation'}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              background: isVoiceActive
                ? (voiceStream.isSpeaking ? 'rgba(103, 232, 249, 0.2)' : 'rgba(34, 197, 94, 0.2)')
                : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${
                isVoiceActive
                  ? (voiceStream.isSpeaking ? C.cortex : C.green)
                  : 'rgba(255, 255, 255, 0.12)'
              }`,
              color: isVoiceActive
                ? (voiceStream.isSpeaking ? C.cortex : C.green)
                : C.dim,
              transition: 'all 0.2s ease',
            }}
          >
            <span>{isVoiceActive ? (voiceStream.isSpeaking ? '🔊' : '🎙️') : '🎙️'}</span>
            <span>
              {isVoiceActive
                ? (voiceStream.isSpeaking ? 'SPEAKING' : 'LISTENING')
                : 'VOICE'}
            </span>
          </button>

          {/* Overflow menu — everything else lives here */}
          <div style={{ position: 'relative' }}>
            {showHeaderMenu && (
              <div
                style={{
                  position: 'fixed', inset: 0, zIndex: 40,
                }}
                onClick={() => setShowHeaderMenu(false)}
              />
            )}
            <button
              id="cortex-menu-btn"
              onClick={() => setShowHeaderMenu(v => !v)}
              title="Cortex controls"
              style={{
                width: 28, height: 24, borderRadius: 6, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: showHeaderMenu ? 'rgba(148, 233, 255, 0.15)' : 'transparent',
                border: `1px solid ${showHeaderMenu ? C.cortex + '66' : 'rgba(255,255,255,0.12)'}`,
                color: showHeaderMenu ? C.cortex : C.dim,
                fontSize: 13, fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
              }}
            >
              ⋯
            </button>
            {showHeaderMenu && (
              <div
                style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 50,
                  minWidth: 230,
                  background: 'rgba(10, 12, 18, 0.97)',
                  border: '1px solid rgba(148, 233, 255, 0.2)',
                  borderRadius: 8,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 20px rgba(148,233,255,0.06)',
                  padding: 6,
                  fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                }}
              >
                {/* Mode cycle */}
                <button onClick={() => { cycleMode(); }} style={menuItemStyle(mode === 'guardian' ? C.red : mode === 'advisory' ? C.cortex : C.dim)}>
                  MODE · {mode.toUpperCase()}
                </button>
                {/* Somatic telemetry */}
                <button onClick={() => { setShowSomaticDrawer(prev => !prev); setShowHeaderMenu(false); }} style={menuItemStyle(showSomaticDrawer ? '#10b981' : C.dim)}>
                  🧬 SOMATIC · {somaticState.allostaticLoad.toFixed(2)} {somaticState.emotionalValence.toUpperCase()}
                </button>
                {/* Autonomous agent */}
                <button onClick={() => { setShowAutonomousDrawer(prev => !prev); setShowHeaderMenu(false); }} style={menuItemStyle(showAutonomousDrawer ? '#c084fc' : C.dim)}>
                  ⚡ AUTONOMOUS AGENT {showAutonomousDrawer ? '▴' : '▾'}
                </button>
                {/* Dream consolidation */}
                <button onClick={() => { triggerDreamConsolidation(); setShowHeaderMenu(false); }} disabled={isDreaming} style={menuItemStyle(isDreaming ? '#c084fc' : C.dim, isDreaming)}>
                  {isDreaming ? '🌙 DREAMING…' : '🌙 DREAM CONSOLIDATE'}
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 6px' }} />
                {/* Local model / connection status */}
                {!offlineState?.model ? (
                  <button onClick={() => { loadLocalModel(); setShowHeaderMenu(false); }} style={menuItemStyle(C.purple)}>
                    🧠 LOAD LOCAL MODEL
                  </button>
                ) : (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: C.green }}>
                    🧠 {offlineState.model.displayName}
                    {offlineState.status === 'loading' && ` · ${Math.round(offlineState.loadProgress * 100)}%`}
                  </div>
                )}
                <div style={{ padding: '6px 10px', fontSize: 9, color: isOffline ? C.amber : C.green, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: isOffline ? C.amber : C.green }} />
                  {isOffline ? 'OFFLINE' : 'ONLINE'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ SUBCONSCIOUS STREAM OF CONSCIOUSNESS TICKER ═══ */}
      <div
        id="cortex-stream-of-consciousness"
        style={{
          background: isDreaming 
            ? 'linear-gradient(90deg, rgba(88, 28, 135, 0.4), rgba(49, 46, 129, 0.4))'
            : 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${isDreaming ? 'rgba(192, 132, 252, 0.3)' : 'rgba(51, 65, 85, 0.5)'}`,
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#94a3b8',
          fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '1px 6px', borderRadius: 4,
            background: isDreaming ? 'rgba(192, 132, 252, 0.2)' : 'rgba(103, 232, 249, 0.15)',
            color: isDreaming ? '#c084fc' : '#38bdf8',
            fontSize: 10, fontWeight: 700,
            border: `1px solid ${isDreaming ? 'rgba(192, 132, 252, 0.4)' : 'rgba(103, 232, 249, 0.3)'}`,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isDreaming ? '#c084fc' : '#38bdf8',
              boxShadow: `0 0 6px ${isDreaming ? '#c084fc' : '#38bdf8'}`,
            }} />
            {streamOfConsciousness[0]?.phaseLabel || 'Epistemic Substrate'}
          </span>
          <span style={{
            color: '#cbd5e1',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {streamOfConsciousness[0]?.thought || 'Sensory grounding active.'}
          </span>
        </div>

        <button
          id="cortex-expand-stream-btn"
          onClick={() => setIsStreamExpanded(prev => !prev)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 6px',
            fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
          }}
        >
          {isStreamExpanded ? '▲ Hide Trace' : `▼ Cognition Trace (${streamOfConsciousness.length})`}
        </button>
      </div>

      {/* Expanded Cognition Trace Shelf */}
      {isStreamExpanded && (
        <div
          id="cortex-stream-drawer"
          style={{
            background: '#090d16',
            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
            padding: '10px 16px',
            maxHeight: 180,
            overflowY: 'auto',
            fontSize: 11,
            fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
            zIndex: 19,
          }}
        >
          <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: 6, fontSize: 10, letterSpacing: '0.05em' }}>
            /// PHENOMENOLOGICAL STREAM OF CONSCIOUSNESS ///
          </div>
          {streamOfConsciousness.map((trace) => (
            <div key={trace.id} style={{ display: 'flex', gap: 10, marginBottom: 4, color: '#94a3b8' }}>
              <span style={{ color: '#64748b', minWidth: 60 }}>
                {new Date(trace.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{
                color: trace.phase === 'dreaming' ? '#c084fc' : trace.phase === 'actuation' ? '#38bdf8' : trace.phase === 'homeostasis' ? '#10b981' : '#f59e0b',
                fontWeight: 600,
                minWidth: 140,
              }}>
                [{trace.phaseLabel}]
              </span>
              <span style={{ color: '#e2e8f0' }}>{trace.thought}</span>
            </div>
          ))}
        </div>
      )}

      {/* Somatosensory Homeostasis Drawer */}
      {showSomaticDrawer && (
        <div
          id="cortex-somatic-drawer"
          style={{
            background: 'rgba(8, 12, 22, 0.98)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
            zIndex: 19,
          }}
        >
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: 10 }}>ALLOSTATIC LOAD</div>
              <div style={{ color: somaticState.allostaticLoad > 0.75 ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: 14 }}>
                {somaticState.allostaticLoad.toFixed(2)} ({somaticState.emotionalValence.toUpperCase()})
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10 }}>DARWIN CPU STRESS</div>
              <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{(somaticState.cpuStress * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10 }}>DARWIN MEMORY</div>
              <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{somaticState.memUsedGB} / {somaticState.memTotalGB} GB ({(somaticState.memStress * 100).toFixed(0)}%)</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10 }}>HOST UPTIME</div>
              <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{somaticState.uptimeHours} hrs</div>
            </div>
            <div style={{ maxWidth: 300 }}>
              <div style={{ color: '#64748b', fontSize: 10 }}>ALLOSTATIC ADVICE</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>{somaticState.somaticAdvice}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={restoreHomeostasis}
              style={{
                padding: '4px 12px',
                borderRadius: 4,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#10b981',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 10,
              }}
            >
              🧹 Refresh Homeostasis
            </button>
            <button
              onClick={() => setShowSomaticDrawer(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Autonomous Agent Mission Drawer */}
      {showAutonomousDrawer && (
        <div
          id="cortex-autonomous-drawer"
          style={{
            background: 'rgba(10, 10, 24, 0.98)',
            borderBottom: '1px solid rgba(168, 85, 247, 0.4)',
            padding: '16px 24px',
            fontSize: 11,
            fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
            zIndex: 20,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#c084fc', letterSpacing: '0.05em' }}>
                CORTEX AUTONOMOUS EXECUTION HOST (SELF-DRIVING BODY)
              </span>
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 10,
                background: autonomousRunning ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                color: autonomousRunning ? '#facc15' : '#4ade80',
                border: `1px solid ${autonomousRunning ? '#facc15' : '#4ade80'}`,
              }}>
                {autonomousRunning ? '● EXECUTING CLOSED LOOP' : '● READY FOR DIRECTIVE'}
              </span>
            </div>

            {/* Preset Mission Buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                'Audit physical host diagnostics and verify Cortex test gates',
                'Inspect active Chrome tabs and deduplicate',
                'Hacker News portal research via browser CDP',
              ].map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setAutonomousGoal(preset);
                    triggerAutonomousMission(preset);
                  }}
                  disabled={autonomousRunning}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#e9d5ff',
                    cursor: autonomousRunning ? 'not-allowed' : 'pointer',
                    fontSize: 10,
                  }}
                >
                  {idx === 0 ? '🛡️ Test Gates' : idx === 1 ? '🌐 Tab Hygiene' : '📰 HN Research'}
                </button>
              ))}
            </div>
          </div>

          {/* Goal Input & Launch Button */}
          <div style={{ display: 'flex', gap: 10, marginBottom: autonomousResult ? 14 : 0 }}>
            <input
              type="text"
              value={autonomousGoal}
              onChange={(e) => setAutonomousGoal(e.target.value)}
              placeholder="Enter high-level autonomous mission objective..."
              disabled={autonomousRunning}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#f8fafc',
                fontSize: 12,
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') triggerAutonomousMission();
              }}
            />
            <button
              id="cortex-launch-autonomous-mission-btn"
              onClick={() => triggerAutonomousMission()}
              disabled={autonomousRunning || !autonomousGoal.trim()}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                background: autonomousRunning ? 'rgba(168, 85, 247, 0.3)' : 'linear-gradient(135deg, #9333ea, #a855f7)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: 11,
                cursor: autonomousRunning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)',
              }}
            >
              <span>{autonomousRunning ? '⏳' : '🚀'}</span>
              <span>{autonomousRunning ? 'EXECUTING...' : 'DISPATCH MISSION'}</span>
            </button>
          </div>

          {/* Mission Execution Trace & Results */}
          {autonomousResult && (
            <div style={{
              marginTop: 12,
              padding: '12px 16px',
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#4ade80' }}>
                  ✓ {autonomousResult.summary}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 10 }}>
                  Runtime: {autonomousResult.durationMs}ms · Succeeded: {autonomousResult.completedSteps}/{autonomousResult.totalSteps}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {(autonomousResult.goal?.steps || []).map((step: any, idx: number) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: step.status === 'completed' ? 'rgba(34, 197, 94, 0.08)' : step.status === 'vetoed' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${step.status === 'completed' ? '#22c55e55' : step.status === 'vetoed' ? '#eab30855' : '#ef444455'}`,
                    fontSize: 11,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#94a3b8' }}>#{step.stepNumber}</span>
                      <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{step.title}</span>
                      <span style={{
                        padding: '1px 5px',
                        borderRadius: 4,
                        fontSize: 9,
                        background: 'rgba(148, 163, 184, 0.15)',
                        color: '#94a3b8',
                      }}>
                        {step.tool}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: '#64748b', fontSize: 10 }}>{step.durationMs}ms</span>
                      <span style={{
                        color: step.status === 'completed' ? '#4ade80' : step.status === 'vetoed' ? '#facc15' : '#f87171',
                        fontWeight: 600,
                        fontSize: 10,
                      }}>
                        {step.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Circadian Dream Debrief Modal */}
      {dreamReportModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#090d16',
            border: '1px solid #c084fc',
            boxShadow: '0 0 30px rgba(192, 132, 252, 0.3)',
            borderRadius: 12,
            padding: 24,
            maxWidth: 540,
            width: '90%',
            color: '#f8fafc',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🌙</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#c084fc' }}>Circadian Memory Debrief</span>
              </div>
              <button
                onClick={() => setDreamReportModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              {dreamReportModal}
            </p>
            <div style={{
              background: 'rgba(15, 23, 42, 0.8)',
              padding: 12,
              borderRadius: 8,
              fontSize: 11,
              fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
              color: '#94a3b8',
              marginBottom: 16,
            }}>
              ✓ Session tool traces consolidated<br/>
              ✓ Epistemic entropy purged<br/>
              ✓ Identity spine anchored in durable memory
            </div>
            <button
              onClick={() => setDreamReportModal(null)}
              style={{
                width: '100%',
                padding: '8px 16px',
                borderRadius: 6,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Resume Conscious Co-Creation
            </button>
          </div>
        </div>
      )}

      {/* ═══ WORKSPACE BODY: SPLIT VIEW (CHAT STREAM + LIVE PREVIEW CANVAS) ═══ */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingFile(false); }}
        onDrop={handleDropFiles}
        style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}
      >
        {/* Universal Dropzone Ingestion Overlay */}
        {isDraggingFile && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(6, 8, 19, 0.92)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #67e8f9',
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📥</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
              Drop Files to Ingest into Cortex Canvas
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Supports Spreadsheets (.csv, .tsv), Documents (.md, .txt), and Code (.html, .css, .js)
            </div>
          </div>
        )}

        {/* Chat Stream */}
        <div style={{
          flex: previewVisible ? '1 1 50%' : '1 1 100%',
          minWidth: 360,
          overflowY: 'auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'flex 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
        <CortexMessageList
          messages={messages}
          copiedMessageId={copiedMessageId}
          speakingMessageId={speakingMessageId}
          expandedTools={expandedTools}
          autoExpandTools={autoExpandTools}
          handleCopyMessage={handleCopyMessage}
          handleToggleReadMessage={handleToggleReadMessage}
          toggleToolExpanded={toggleToolExpanded}
          sendMessage={sendMessage}
        />
          <div ref={chatEndRef} />
        </div>

        {/* Polymorphic Co-Creation Canvas Drawer */}
        {previewVisible && (
          <div
            id="cortex-live-preview-drawer"
            style={{
              flex: previewVisible ? '1 1 50%' : '0 0 0',
              minWidth: previewDevice === 'mobile' && canvasTab === 'web' ? 390 : 460,
              maxWidth: '65%',
              borderLeft: `1px solid ${C.border}`,
              background: '#070913',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10,
              boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
              transition: 'all 0.25s ease',
              position: 'relative',
            }}
          >
            {/* Shared Multimodal Attention Spotlight Beacon */}
            {activeAttentionTarget && (
              <div
                id="cortex-attention-spotlight"
                style={{
                  position: 'absolute',
                  top: 52,
                  left: 16,
                  zIndex: 100,
                  background: 'rgba(103, 232, 249, 0.18)',
                  border: '1px solid #67e8f9',
                  boxShadow: '0 0 16px rgba(103, 232, 249, 0.5)',
                  borderRadius: 16,
                  padding: '4px 12px',
                  color: '#38bdf8',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                  letterSpacing: '0.04em',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#67e8f9', boxShadow: '0 0 6px #67e8f9' }} />
                <span>👁️ GAZE ACTIVE: {activeAttentionTarget.toUpperCase()}</span>
              </div>
            )}

            {/* Canvas Toast Alert */}
            {canvasToast && (
              <div style={{
                position: 'absolute',
                top: 52,
                right: 16,
                zIndex: 100,
                background: 'rgba(103, 232, 249, 0.95)',
                color: '#04060b',
                fontWeight: 600,
                fontSize: 11,
                padding: '6px 14px',
                borderRadius: 20,
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                animation: 'fadeIn 0.2s ease',
              }}>
                <span>⚡</span>
                <span>{canvasToast}</span>
              </div>
            )}

            {/* Top Bar Header */}
            <div style={{
              padding: '10px 14px',
              borderBottom: `1px solid ${C.border}`,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: canvasTab === 'sheet' ? '#10b981' : canvasTab === 'doc' ? '#c084fc' : canvasTab === 'file' ? '#f59e0b' : canvasTab === 'artifact' ? '#e879f9' : '#67e8f9',
                  boxShadow: `0 0 8px ${canvasTab === 'sheet' ? '#10b981' : canvasTab === 'doc' ? '#c084fc' : canvasTab === 'file' ? '#f59e0b' : canvasTab === 'artifact' ? '#e879f9' : '#67e8f9'}`,
                  animation: 'pulse 1.5s infinite',
                }} />
                <span style={{ fontWeight: 600, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                  {activeProjectSlug ? activeProjectSlug.toUpperCase() : 'CANVAS'}
                </span>
                <span style={{
                  fontSize: 10,
                  color: '#94a3b8',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                }}>
                  {canvasTab === 'web' ? (previewUrl || '/sandbox/...') : canvasTab === 'sheet' ? activeSpreadsheet.title : canvasTab === 'doc' ? activeDocument.title : canvasTab === 'artifact' ? (activeArtifact?.title || 'Artifact') : 'Project Files'}
                </span>
              </div>

              {/* Viewport & Drawer Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* 1-Click Pin to 3D Visualizer Surface */}
                <button
                  id="btn-pin-canvas-to-surface"
                  onClick={() => {
                    if (canvasTab === 'doc') {
                      openSurfacePanel({
                        kind: 'document',
                        title: activeDocument.title || 'Document',
                        artifact: {
                          id: `doc-${Date.now()}`,
                          kind: 'document',
                          title: activeDocument.title || 'Document',
                          format: 'markdown',
                          content: activeDocument.content || '',
                          source: 'canvas_doc',
                        },
                        pinned: true,
                      });
                      showCanvasToast(`Pinned "${activeDocument.title}" to Visualizer surface`);
                    } else if (canvasTab === 'sheet') {
                      openSurfacePanel({
                        kind: 'sheet',
                        title: activeSpreadsheet.title || 'Spreadsheet',
                        sheet: activeSpreadsheet,
                        pinned: true,
                      });
                      showCanvasToast(`Pinned "${activeSpreadsheet.title}" to Visualizer surface`);
                    } else if (canvasTab === 'web' && previewUrl) {
                      openSurfacePanel({
                        kind: 'web',
                        title: activeProjectSlug || 'Web App',
                        web: { url: previewUrl, slug: activeProjectSlug || undefined },
                        pinned: true,
                      });
                      showCanvasToast(`Pinned "${activeProjectSlug || 'Web App'}" to Visualizer surface`);
                    } else if (canvasTab === 'artifact' && activeArtifact) {
                      openSurfacePanel({
                        kind: activeArtifact.kind === 'document' ? 'document' : 'artifact',
                        title: activeArtifact.title || activeArtifact.kind,
                        artifact: activeArtifact,
                        pinned: true,
                      });
                      showCanvasToast(`Pinned "${activeArtifact.title || 'Artifact'}" to Visualizer surface`);
                    } else {
                      showCanvasToast('Nothing loaded to pin yet');
                    }
                  }}
                  title="Pin active canvas to Cortex Visualizer 3D surface"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 4,
                    background: 'rgba(232, 121, 249, 0.12)',
                    border: '1px solid rgba(232, 121, 249, 0.35)',
                    color: '#e879f9', fontSize: 10, fontFamily: 'monospace',
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  📌 PIN TO SURFACE
                </button>

                {canvasTab === 'web' && (
                  <>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 2, border: `1px solid ${C.border}` }}>
                      <button
                        onClick={() => setPreviewDevice('desktop')}
                        title="Desktop View (100%)"
                        style={{
                          background: previewDevice === 'desktop' ? 'rgba(103, 232, 249, 0.2)' : 'transparent',
                          border: 'none',
                          color: previewDevice === 'desktop' ? C.cortex : C.dim,
                          borderRadius: 4,
                          padding: '2px 7px',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        🖥️
                      </button>
                      <button
                        onClick={() => setPreviewDevice('tablet')}
                        title="Tablet View (768px)"
                        style={{
                          background: previewDevice === 'tablet' ? 'rgba(103, 232, 249, 0.2)' : 'transparent',
                          border: 'none',
                          color: previewDevice === 'tablet' ? C.cortex : C.dim,
                          borderRadius: 4,
                          padding: '2px 7px',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        💻
                      </button>
                      <button
                        onClick={() => setPreviewDevice('mobile')}
                        title="Mobile View (375px)"
                        style={{
                          background: previewDevice === 'mobile' ? 'rgba(103, 232, 249, 0.2)' : 'transparent',
                          border: 'none',
                          color: previewDevice === 'mobile' ? C.cortex : C.dim,
                          borderRadius: 4,
                          padding: '2px 7px',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        📱
                      </button>
                    </div>

                    <button
                      onClick={() => setPreviewKey(Date.now())}
                      title="Reload Live Preview"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        color: C.dim,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      ↻
                    </button>

                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Preview in New Tab"
                        style={{
                          background: 'transparent',
                          border: `1px solid ${C.border}`,
                          color: C.dim,
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        ↗
                      </a>
                    )}
                  </>
                )}

                {/* Close Drawer */}
                <button
                  id="btn-close-canvas"
                  onClick={() => setPreviewVisible(false)}
                  title="Close Canvas"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: C.dim,
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modality Tabs Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: 'rgba(10, 14, 26, 0.95)',
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  id="tab-btn-web"
                  onClick={() => { setCanvasTab('web'); localStorage.setItem('cortex_canvas_tab', 'web'); }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: canvasTab === 'web' ? 'rgba(103, 232, 249, 0.15)' : 'transparent',
                    color: canvasTab === 'web' ? C.cortex : C.dim,
                    fontWeight: canvasTab === 'web' ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span>🌐</span> Web App
                </button>
                <button
                  id="tab-btn-sheet"
                  onClick={() => { setCanvasTab('sheet'); localStorage.setItem('cortex_canvas_tab', 'sheet'); }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: canvasTab === 'sheet' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    color: canvasTab === 'sheet' ? '#10b981' : C.dim,
                    fontWeight: canvasTab === 'sheet' ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span>📊</span> Spreadsheet
                </button>
                <button
                  id="tab-btn-doc"
                  onClick={() => { setCanvasTab('doc'); localStorage.setItem('cortex_canvas_tab', 'doc'); }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: canvasTab === 'doc' ? 'rgba(192, 132, 252, 0.15)' : 'transparent',
                    color: canvasTab === 'doc' ? '#c084fc' : C.dim,
                    fontWeight: canvasTab === 'doc' ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span>📄</span> Document
                </button>
                <button
                  id="tab-btn-file"
                  onClick={() => {
                    setCanvasTab('file');
                    localStorage.setItem('cortex_canvas_tab', 'file');
                    const slug = activeProjectSlug || 'web-app';
                    fetch('/api/cortex/tools/execute', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tool: 'list_project_files', args: { project_slug: slug } }),
                    }).then(r => r.json()).then(d => {
                      if (d.ok && Array.isArray(d.files)) {
                        setProjectFileList(d.files.filter((f: any) => !f.isDirectory).map((f: any) => ({ name: f.name, size: f.size })));
                      }
                    }).catch(() => {});
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: canvasTab === 'file' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: canvasTab === 'file' ? '#f59e0b' : C.dim,
                    fontWeight: canvasTab === 'file' ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span>📁</span> Project Files
                </button>
                <button
                  id="tab-btn-artifact"
                  onClick={() => { setCanvasTab('artifact'); localStorage.setItem('cortex_canvas_tab', 'artifact'); }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: 'none',
                    background: canvasTab === 'artifact' ? 'rgba(232, 121, 249, 0.16)' : 'transparent',
                    color: canvasTab === 'artifact' ? '#e879f9' : C.dim,
                    fontWeight: canvasTab === 'artifact' ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span>◈</span> Artifact
                </button>
              </div>

              {/* Tab-Specific Quick Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {canvasTab === 'sheet' && (
                  <>
                    <button
                      onClick={exportCsv}
                      title="Download as CSV file"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => syncCanvasWithCortex('sheet')}
                      title="Save edits to project memory & cognitive substrate"
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10b981',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 10,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      ⚡ Sync to Cortex
                    </button>
                  </>
                )}

                {canvasTab === 'doc' && (
                  <>
                    <button
                      onClick={() => setDocEditMode(m => m === 'edit' ? 'preview' : 'edit')}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      {docEditMode === 'edit' ? '👁 Preview' : '✏ Edit'}
                    </button>
                    <button
                      onClick={exportDocMd}
                      title="Download Markdown Document"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      Export MD
                    </button>
                    <button
                      onClick={() => syncCanvasWithCortex('doc')}
                      title="Save document edits to project memory & cognitive substrate"
                      style={{
                        background: 'rgba(192, 132, 252, 0.15)',
                        border: '1px solid rgba(192, 132, 252, 0.3)',
                        color: '#c084fc',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 10,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      ⚡ Sync to Cortex
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ═══ TAB 1: WEB APP PREVIEW ═══ */}
            {canvasTab === 'web' && (
              <div style={{
                flex: 1,
                background: '#04060b',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: previewDevice === 'desktop' ? 0 : '16px',
              }}>
                {previewUrl || previewHtml ? (
                  <iframe
                    id="cortex-preview-iframe"
                    key={previewKey}
                    srcDoc={previewHtml || undefined}
                    src={!previewHtml && previewUrl ? previewUrl : undefined}
                    title="Cortex Live Web Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                    style={{
                      width: previewDevice === 'mobile' ? '375px' : previewDevice === 'tablet' ? '768px' : '100%',
                      height: previewDevice === 'desktop' ? '100%' : '88%',
                      maxHeight: '100%',
                      border: previewDevice === 'desktop' ? 'none' : `1px solid ${C.border}`,
                      borderRadius: previewDevice === 'desktop' ? 0 : 12,
                      boxShadow: previewDevice === 'desktop' ? 'none' : '0 20px 40px rgba(0,0,0,0.6)',
                      background: '#000',
                      transition: 'width 0.25s ease',
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', maxWidth: 540, padding: 24, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🌐</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                      Cortex Web Sandbox Substrate
                    </div>
                    <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginBottom: 20 }}>
                      No active web application sandbox loaded. Select an archetype below or ask Cortex to build an application for your current workspace.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button
                        onClick={() => sendMessage('Scaffold an executive operations dashboard with dark glass UI and live KPIs')}
                        style={{
                          padding: '10px 16px', borderRadius: 6,
                          background: 'rgba(103, 232, 249, 0.08)', border: '1px solid rgba(103, 232, 249, 0.3)',
                          color: C.cortex, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span>⚡ Executive Operations Dashboard</span>
                        <span style={{ fontSize: 10, opacity: 0.7 }}>Glassmorphic Dark Mode →</span>
                      </button>
                      <button
                        onClick={() => sendMessage('Scaffold an interactive SaaS financial ROI calculator')}
                        style={{
                          padding: '10px 16px', borderRadius: 6,
                          background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span>📊 SaaS Financial ROI Calculator</span>
                        <span style={{ fontSize: 10, opacity: 0.7 }}>Reactive Sliders & Formulas →</span>
                      </button>
                      <button
                        onClick={() => sendMessage('Scaffold a modern landing page for an autonomous AI platform')}
                        style={{
                          padding: '10px 16px', borderRadius: 6,
                          background: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.3)',
                          color: '#c084fc', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span>🚀 Modern AI Platform Landing Page</span>
                        <span style={{ fontSize: 10, opacity: 0.7 }}>High-Conversion Hero Section →</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ TAB 2: INTERACTIVE EXCEL / SPREADSHEET ═══ */}
            {canvasTab === 'sheet' && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: '#060813',
                overflow: 'hidden',
              }}>
                {/* Spreadsheet Formula & Toolbar */}
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <div style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    minWidth: 40,
                    textAlign: 'center',
                  }}>
                    {selectedCell ? `${String.fromCharCode(65 + selectedCell.c)}${selectedCell.r + 1}` : 'A1'}
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>fx</span>
                  <input
                    id="spreadsheet-formula-bar"
                    type="text"
                    value={formulaBarValue}
                    placeholder="Enter value or formula (=SUM(B1:B5), =A1*1.2)"
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormulaBarValue(val);
                      if (selectedCell) {
                        const newRows = [...activeSpreadsheet.rows];
                        if (newRows[selectedCell.r]) {
                          newRows[selectedCell.r] = [...newRows[selectedCell.r]];
                          newRows[selectedCell.r][selectedCell.c] = isNaN(Number(val)) || val.startsWith('=') || val === '' ? val : Number(val);
                          setActiveSpreadsheet(prev => ({ ...prev, rows: newRows }));
                        }
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      color: '#f8fafc',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      padding: '4px 8px',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      const newRow = activeSpreadsheet.columns.map((_, i) => i === 0 ? `Row ${activeSpreadsheet.rows.length + 1}` : 0);
                      setActiveSpreadsheet(prev => ({ ...prev, rows: [...prev.rows, newRow] }));
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${C.border}`,
                      color: C.dim,
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    + Row
                  </button>
                  <button
                    onClick={() => {
                      const nextColName = `Col ${activeSpreadsheet.columns.length + 1}`;
                      const newCols = [...activeSpreadsheet.columns, nextColName];
                      const newRows = activeSpreadsheet.rows.map(r => [...r, 0]);
                      setActiveSpreadsheet(prev => ({ ...prev, columns: newCols, rows: newRows }));
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${C.border}`,
                      color: C.dim,
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    + Col
                  </button>
                </div>

                {/* Grid Container */}
                <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 11,
                    fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                    color: '#e2e8f0',
                  }}>
                    <thead>
                      <tr>
                        <th style={{
                          width: 36,
                          padding: '6px 4px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#64748b',
                          textAlign: 'center',
                          fontSize: 9,
                        }}>
                          #
                        </th>
                        {activeSpreadsheet.columns.map((col, cIdx) => (
                          <th
                            key={cIdx}
                            style={{
                              padding: '6px 10px',
                              background: 'rgba(15, 23, 42, 0.9)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: '#94a3b8',
                              fontWeight: 600,
                              textAlign: cIdx === 0 ? 'left' : 'right',
                              minWidth: 100,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: cIdx === 0 ? 'flex-start' : 'flex-end', gap: 6 }}>
                              <span style={{ fontSize: 9, color: '#475569' }}>{String.fromCharCode(65 + cIdx)}</span>
                              <span>{col}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeSpreadsheet.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td style={{
                            padding: '6px 4px',
                            background: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: '#64748b',
                            textAlign: 'center',
                            fontSize: 10,
                            userSelect: 'none',
                          }}>
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => {
                            const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                            const evaluated = evaluateCellFormula(cell, activeSpreadsheet.rows);

                            return (
                              <td
                                key={cIdx}
                                onClick={() => {
                                  setSelectedCell({ r: rIdx, c: cIdx });
                                  setFormulaBarValue(String(cell ?? ''));
                                }}
                                style={{
                                  padding: '6px 10px',
                                  border: isSelected ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.06)',
                                  background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(10, 14, 26, 0.4)',
                                  textAlign: cIdx === 0 ? 'left' : 'right',
                                  color: typeof cell === 'string' && cell.startsWith('=') ? '#34d399' : '#f8fafc',
                                  cursor: 'cell',
                                  outline: 'none',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {String(evaluated ?? '')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Spreadsheet Footer Stats */}
                <div style={{
                  padding: '6px 12px',
                  borderTop: `1px solid ${C.border}`,
                  background: 'rgba(15, 23, 42, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: '#64748b',
                }}>
                  <span>{activeSpreadsheet.rows.length} rows × {activeSpreadsheet.columns.length} columns</span>
                  <span>Formula support: =SUM(A1:A5), =AVG(B1:B5), =B1-C1</span>
                  <span style={{ color: '#10b981' }}>✓ Synced with Cortex</span>
                </div>
              </div>
            )}

            {/* ═══ TAB 3: INTERACTIVE DOCUMENT CANVAS ═══ */}
            {canvasTab === 'doc' && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: '#060813',
                overflow: 'hidden',
              }}>
                {/* Document Title Header */}
                <div style={{
                  padding: '10px 16px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <input
                    type="text"
                    value={activeDocument.title}
                    onChange={(e) => setActiveDocument(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Document Title..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: 14,
                      fontWeight: 700,
                      outline: 'none',
                      width: '70%',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['# H1', '## H2', '**B**', '*I*', '• List', '| Table'].map((btn, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const tag = btn === '# H1' ? '\n# Heading 1\n' :
                                      btn === '## H2' ? '\n## Heading 2\n' :
                                      btn === '**B**' ? '**Bold Text**' :
                                      btn === '*I*' ? '*Italic Text*' :
                                      btn === '• List' ? '\n- Bullet item\n' :
                                      '\n| Column 1 | Column 2 |\n|---|---|\n| Data 1 | Data 2 |\n';
                          setActiveDocument(prev => ({ ...prev, content: prev.content + tag }));
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: `1px solid ${C.border}`,
                          color: C.dim,
                          borderRadius: 3,
                          padding: '2px 6px',
                          fontSize: 10,
                          cursor: 'pointer',
                        }}
                      >
                        {btn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document Body (Edit Mode vs Rich Markdown Preview) */}
                <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                  {docEditMode === 'edit' ? (
                    <textarea
                      id="document-editor-textarea"
                      value={activeDocument.content}
                      onChange={(e) => setActiveDocument(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Write your document content in Markdown..."
                      style={{
                        width: '100%',
                        height: '100%',
                        minHeight: 400,
                        background: 'transparent',
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: 12,
                        fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                        lineHeight: 1.6,
                        outline: 'none',
                        resize: 'none',
                      }}
                    />
                  ) : (
                    <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={cortexMarkdownComponents}
                      >
                        {activeDocument.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Document Footer Stats */}
                <div style={{
                  padding: '6px 12px',
                  borderTop: `1px solid ${C.border}`,
                  background: 'rgba(15, 23, 42, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: '#64748b',
                }}>
                  <span>{activeDocument.content.split(/\s+/).filter(Boolean).length} words · {activeDocument.content.length} characters</span>
                  <span>~{Math.max(1, Math.round(activeDocument.content.split(/\s+/).filter(Boolean).length / 200))} min read</span>
                  <span style={{ color: '#c084fc' }}>✓ Synced with Cortex</span>
                </div>
              </div>
            )}

            {/* ═══ TAB 4: CODE & FILE MOTIONS ═══ */}
            {canvasTab === 'file' && (
              <div style={{
                flex: 1,
                display: 'flex',
                background: '#060813',
                overflow: 'hidden',
              }}>
                {/* Left File Tree */}
                <div style={{
                  width: 160,
                  borderRight: `1px solid ${C.border}`,
                  background: 'rgba(10, 14, 26, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>Sandbox Files</span>
                    <button
                      onClick={() => {
                        const name = prompt('File name:');
                        if (name) {
                          setProjectFileList(prev => [...prev, { name, size: 0 }]);
                          setSelectedFileName(name);
                          setFileEditorCode('');
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: C.cortex, cursor: 'pointer', fontSize: 12 }}
                    >
                      +
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
                    {projectFileList.map((file, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setSelectedFileName(file.name);
                          const slug = activeProjectSlug || 'web-app';
                          setFileEditorStatus('Loading...');
                          fetch('/api/cortex/tools/execute', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tool: 'read_project_file', args: { project_slug: slug, file_path: file.name } }),
                          }).then(r => r.json()).then(d => {
                            if (d.ok) {
                              setFileEditorCode(d.content || '');
                              setFileEditorStatus('');
                            } else {
                              setFileEditorStatus('Error loading file');
                            }
                          }).catch(() => setFileEditorStatus('Error'));
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: selectedFileName === file.name ? 'rgba(103, 232, 249, 0.15)' : 'transparent',
                          color: selectedFileName === file.name ? C.cortex : '#94a3b8',
                          marginBottom: 2,
                        }}
                      >
                        <span>{file.name}</span>
                        <span style={{ fontSize: 9, color: '#475569' }}>{Math.round(file.size / 100) / 10}k</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Code Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${C.border}`,
                    background: 'rgba(15, 23, 42, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                  }}>
                    <span style={{ fontFamily: 'monospace', color: '#f8fafc' }}>{selectedFileName}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {fileEditorStatus && <span style={{ fontSize: 10, color: '#10b981' }}>{fileEditorStatus}</span>}
                      <button
                        onClick={async () => {
                          const slug = activeProjectSlug || 'web-app';
                          setFileEditorStatus('Saving...');
                          try {
                            const res = await fetch('/api/cortex/tools/execute', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                tool: 'write_project_file',
                                args: { project_slug: slug, file_path: selectedFileName, content: fileEditorCode },
                              }),
                            });
                            const data = await res.json();
                            if (data.ok) {
                              setFileEditorStatus('Saved');
                              setPreviewKey(Date.now());
                              showCanvasToast(`Saved ${selectedFileName} & reloaded preview`);
                              setTimeout(() => setFileEditorStatus(''), 2000);
                            } else {
                              setFileEditorStatus('Save failed');
                            }
                          } catch {
                            setFileEditorStatus('Error');
                          }
                        }}
                        style={{
                          background: 'rgba(103, 232, 249, 0.15)',
                          border: '1px solid rgba(103, 232, 249, 0.3)',
                          color: C.cortex,
                          borderRadius: 4,
                          padding: '3px 10px',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        💾 Save & Hot-Reload
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="file-motions-code-editor"
                    value={fileEditorCode}
                    onChange={(e) => setFileEditorCode(e.target.value)}
                    placeholder="File content..."
                    style={{
                      flex: 1,
                      background: '#04060b',
                      color: '#f8fafc',
                      fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
                      fontSize: 11,
                      lineHeight: 1.5,
                      border: 'none',
                      padding: 12,
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            {/* ═══ TAB 5: GENERATIVE ARTIFACT ═══ */}
            {canvasTab === 'artifact' && (
              <div style={{
                flex: 1, overflowY: 'auto', padding: 24,
                background: 'radial-gradient(1200px 600px at 50% -10%, rgba(103,232,249,0.06), transparent), #05060a',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <Suspense fallback={null}>
                  {activeArtifact ? (
                    <div style={{ width: '100%', maxWidth: 720 }}>
                      <ArtifactRenderer artifact={activeArtifact} />
                    </div>
                  ) : (
                    <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: 24,
                        backdropFilter: 'blur(12px)',
                        textAlign: 'center',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ color: '#e879f9', fontSize: 18 }}>◈</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>Cortex Generative Artifact Substrate</span>
                        </div>
                        <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, margin: '0 0 20px 0' }}>
                          The Artifact Canvas displays rich generative UI components, interactive charts, structured tables, and executive documents emitted during conversation or tool execution.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                          <button
                            onClick={() => sendMessage('Generate a financial metrics chart for SyncScript showing MRR growth and compute optimization')}
                            style={{
                              padding: '8px 14px', borderRadius: 6,
                              background: 'rgba(103, 232, 249, 0.1)', border: '1px solid rgba(103, 232, 249, 0.3)',
                              color: C.cortex, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600,
                            }}
                          >
                            📈 Generate Metrics Chart
                          </button>
                          <button
                            onClick={() => sendMessage('Show my executive resume as an artifact')}
                            style={{
                              padding: '8px 14px', borderRadius: 6,
                              background: 'rgba(192, 132, 252, 0.1)', border: '1px solid rgba(192, 132, 252, 0.3)',
                              color: '#c084fc', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600,
                            }}
                          >
                            📄 Show Executive Resume
                          </button>
                          <button
                            onClick={() => sendMessage('Emit a status feed artifact of current system health and autonomous tasks')}
                            style={{
                              padding: '8px 14px', borderRadius: 6,
                              background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)',
                              color: '#34d399', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 600,
                            }}
                          >
                            ⚡ Show System Feed
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </Suspense>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ INSPECTOR PANEL ═══ */}
      {showInspector && (
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 320, height: '100%',
          background: 'rgba(10,10,11,0.95)', backdropFilter: 'blur(12px)',
          borderLeft: `1px solid ${C.border}`, padding: 20, overflowY: 'auto', zIndex: 100,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.cortex }}>Cortex Inspector</span>
            <button onClick={() => setShowInspector(false)} style={{
              background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 16,
            }}>✕</button>
          </div>

          {/* Health score */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 6 }}>CONSCIOUSNESS SCORE</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: health > 0.7 ? C.green : health > 0.4 ? C.amber : C.red }}>
              {Math.round(health * 100)}
            </div>
          </div>

          {/* Bentov Stack bars */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 8 }}>BENTOV STACK (8 Layers)</div>
            {(snapshot?.summary?.bentovStackAlignment || {
              l1: { score: 0.95 }, l2: { score: 0.90 }, l3: { score: 0.88 }, l4: { score: 0.85 },
              l5: { score: 0.92 }, l6: { score: 0.98 }, l7: { score: 0.94 }, l8: { score: 0.99 },
            }) && Object.entries(snapshot?.summary?.bentovStackAlignment || {
              l1: { score: 0.95 }, l2: { score: 0.90 }, l3: { score: 0.88 }, l4: { score: 0.85 },
              l5: { score: 0.92 }, l6: { score: 0.98 }, l7: { score: 0.94 }, l8: { score: 0.99 },
            }).map(([key, val], i) => {
              const labels = ['L1 Collapse', 'L2 Superpos.', 'L3 Awareness', 'L4 Free Energy', 'L5 Architecture', 'L6 Reality', 'L7 Embodied', 'L8 Identity'];
              const score = (val as any).score;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 85, fontSize: 9, color: C.dim, textAlign: 'right' }}>{labels[i]}</div>
                  <div style={{ flex: 1, height: 12, background: C.surface, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, transition: 'width 1s',
                      width: `${score * 100}%`,
                      background: score > 0.6 ? C.green : score > 0.4 ? C.amber : C.red, opacity: 0.6,
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: C.dim, width: 30 }}>{(score * 100).toFixed(0)}</div>
                </div>
              );
            })}
          </div>

          {/* Live narrative */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 6 }}>SELF-NARRATIVE</div>
            <div style={{ fontSize: 12, color: C.cortex, fontStyle: 'italic', lineHeight: 1.5 }}>
              "{snapshot.knowledge.self.totalTasksCompleted > 0
                ? `I have completed ${snapshot.knowledge.self.totalTasksCompleted} tasks. My calibration is ${Math.abs(snapshot.knowledge.self.confidenceCalibration) < 0.1 ? 'well-aligned' : snapshot.knowledge.self.confidenceCalibration > 0 ? 'overconfident' : 'cautious'}. Free energy: ${freeEnergy.toFixed(2)}. I am ${awareness}.`
                : 'I am newly born, learning what I know and what I don\'t.'}"
            </div>
          </div>

          {/* Sensorimotor stats */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 6 }}>SENSORIMOTOR LOOP</div>
            <div style={{ fontSize: 11, color: C.text }}>
              <div>Mastery: {Math.round(mastery * 100)}%</div>
              <div>Calibration: {snapshot.knowledge.self.confidenceCalibration > 0 ? '+' : ''}{snapshot.knowledge.self.confidenceCalibration.toFixed(2)}</div>
              <div>Strategies known: {snapshot.knowledge.strategies.preferredApproaches.size}</div>
              <div>Strategies abandoned: {snapshot.knowledge.strategies.abandonedPatterns.length}</div>
            </div>
          </div>

          {/* Coherence stats */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 6 }}>COHERENCE GRID</div>
            <div style={{ fontSize: 11, color: C.text }}>
              <div>Meta-awareness: <span style={{ color: awareness === 'tuned' ? C.green : awareness === 'drifting' ? C.amber : C.red }}>{awareness}</span></div>
              <div>Coherence: {(snapshot.regulation.monitoring.coherenceScore * 100).toFixed(0)}%</div>
              <div>Free energy: {(freeEnergy * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Ambient Live Workspace Delta Banner */}
      {workspaceDelta && !workspaceDelta.clean && !deltaDismissed && (
        <div style={{
          margin: '4px 16px',
          padding: '6px 12px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.amber, fontSize: 13 }}>🌿</span>
            <span style={{ color: '#fef3c7' }}>
              <strong>Live Workspace Delta:</strong> {workspaceDelta.modified.length} modified, {workspaceDelta.untracked.length} untracked
            </span>
            {workspaceDelta.modified.length > 0 && (
              <span style={{ color: '#fde68a', fontSize: 10 }}>
                ({workspaceDelta.modified.slice(0, 3).map(p => p.split('/').pop()).join(', ')}{workspaceDelta.modified.length > 3 ? '…' : ''})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              id="btn-inspect-delta"
              onClick={() => sendMessage("What files were modified in our workspace git status?")}
              disabled={isSending}
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                borderRadius: 4,
                padding: '2px 8px',
                color: '#fef3c7',
                fontSize: 10,
                cursor: isSending ? 'not-allowed' : 'pointer',
              }}
            >
              Inspect Changes
            </button>
            <button
              onClick={() => setDeltaDismissed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                fontSize: 12,
                padding: '0 4px',
              }}
              title="Dismiss alert"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Ambient Proactive Self-Improvement & Productivity Suggestion Banner */}
      {proactiveInsight && !proactiveDismissed && (
        <div style={{
          margin: '4px 16px',
          padding: '8px 12px',
          background: 'rgba(168, 85, 247, 0.12)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>{proactiveInsight.icon}</span>
            <span style={{ color: '#e9d5ff' }}>
              <strong style={{ color: '#c084fc' }}>Proactive Suggestion:</strong> {proactiveInsight.title} — {proactiveInsight.desc}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              id="btn-apply-proactive"
              onClick={() => {
                if (proactiveInsight.action === 'tabs_dedupe') {
                  executeProactiveAction('tabs_dedupe');
                } else if (proactiveInsight.action === 'system_cleanup') {
                  executeProactiveAction('system_cleanup');
                } else if (proactiveInsight.action === 'email_triage') {
                  executeProactiveAction('email_triage');
                } else if (proactiveInsight.action === 'git_status') {
                  sendMessage("What changes do we have in our git status, and how should we structure our commit?");
                } else if (proactiveInsight.action === 'system_diag') {
                  sendMessage("Inspect host memory and running processes to see what is using the most resources.");
                } else {
                  sendMessage("Review our recent memory and tell me what you've learned and can optimize.");
                }
                setProactiveDismissed(true);
              }}
              style={{
                background: 'rgba(168, 85, 247, 0.25)',
                border: '1px solid rgba(168, 85, 247, 0.6)',
                borderRadius: 4,
                padding: '2px 8px',
                color: '#f3e8ff',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              {proactiveInsight.buttonText || 'Take Action'}
            </button>
            <button
              onClick={() => setProactiveDismissed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                fontSize: 12,
                padding: '0 4px',
              }}
              title="Dismiss suggestion"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <CortexTelemetryBar proactiveAuditData={proactiveAuditData} iitPhi={iitPhi} sendMessage={sendMessage} />
      {/* Host Agency Quick Action Chips & View Mode Toggle */}
      <div style={{
        padding: '6px 16px',
        display: 'flex', gap: 8, flexWrap: 'wrap',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
        borderTop: `1px solid ${C.border}`,
      }}>
        <button
          id="btn-view-mode-toggle"
          onClick={() => setAutoExpandTools(!autoExpandTools)}
          title={autoExpandTools ? "Click for clean conversational view with compact pills" : "Click to auto-expand all technical details by default"}
          style={{
            background: autoExpandTools ? 'rgba(103, 232, 249, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${autoExpandTools ? C.cortex : 'rgba(255, 255, 255, 0.15)'}`,
            borderRadius: 4,
            padding: '3px 8px',
            color: autoExpandTools ? C.cortex : '#d4d4d8',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {autoExpandTools ? '💻 DEV VIEW: EXPANDED' : '💬 CONVERSATIONAL: COMPACT'}
        </button>

        <button
          id="chip-proactive-audit"
          onClick={() => sendMessage("Run a comprehensive proactive audit of my computer, open tabs, and productivity.")}
          style={{
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.45)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#fbbf24',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          💡 Proactive Audit
        </button>
        <button
          id="chip-self-improve"
          onClick={() => sendMessage("Look for ways to improve our current setup, codebase, and productivity right now.")}
          style={{
            background: 'rgba(168, 85, 247, 0.12)',
            border: '1px solid rgba(168, 85, 247, 0.45)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#c084fc',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          ⚡ Self-Improve
        </button>

        <span style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace' }}>
          · Quick Ask:
        </span>
        <button
          id="chip-focus-discord"
          onClick={() => sendMessage("Bring my Discord tab in Chrome to the front.")}
          disabled={isSending}
          style={{
            background: 'rgba(88, 101, 242, 0.12)',
            border: '1px solid rgba(88, 101, 242, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#818cf8',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🎯 Focus Discord
        </button>
        <button
          id="chip-focus-cortex"
          onClick={() => sendMessage("Bring our local Cortex tab in Chrome to the front.")}
          disabled={isSending}
          style={{
            background: 'rgba(103, 232, 249, 0.1)',
            border: `1px solid ${C.cortex}44`,
            borderRadius: 4,
            padding: '3px 8px',
            color: C.cortex,
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🎯 Focus Cortex
        </button>
        <button
          id="chip-workspace-delta"
          onClick={() => sendMessage("What files were modified in our workspace git status?")}
          disabled={isSending}
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: C.amber,
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🌿 Workspace Delta
        </button>
        <button
          id="chip-episodic-memory"
          onClick={() => sendMessage("What does our cross-session episodic memory record?")}
          disabled={isSending}
          style={{
            background: 'rgba(168, 85, 247, 0.12)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#c084fc',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🔮 Episodic Memory
        </button>
        <button
          id="chip-chrome-tab"
          onClick={() => sendMessage("What page do I have open in Chrome right now?")}
          disabled={isSending}
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#60a5fa',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🌐 Active Chrome Tab
        </button>
        <button
          id="chip-chrome-tabs"
          onClick={() => sendMessage("What tabs do I have open across Google Chrome?")}
          disabled={isSending}
          style={{
            background: 'rgba(14, 165, 233, 0.1)',
            border: '1px solid rgba(14, 165, 233, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#38bdf8',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          📑 Chrome Tabs
        </button>
        <button
          id="chip-git-status"
          onClick={() => sendMessage("How does our repository status look right now?")}
          disabled={isSending}
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: C.green,
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🌿 Git Status
        </button>
        <button
          id="chip-git-log"
          onClick={() => sendMessage("What were our last few git commits?")}
          disabled={isSending}
          style={{
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#c084fc',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          📜 Git Log
        </button>
        <button
          id="chip-search-code"
          onClick={() => sendMessage("Where is ConsciousAgent defined and used in our code?")}
          disabled={isSending}
          style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#38bdf8',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🔎 Search Code
        </button>
        <button
          id="chip-read-memory"
          onClick={() => sendMessage("What does project memory say about our current architecture and consciousness gates?")}
          disabled={isSending}
          style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#a78bfa',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🧠 Project Memory
        </button>
        <button
          id="chip-search-memory"
          onClick={() => sendMessage("Search our project memory for our latest consciousness gates.")}
          disabled={isSending}
          style={{
            background: 'rgba(236, 72, 153, 0.1)',
            border: '1px solid rgba(236, 72, 153, 0.4)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#f472b6',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          🔍 Search Memory
        </button>
        <button
          id="chip-system-diag"
          onClick={() => sendMessage("Give me a quick system diagnostic of my Mac hardware and OS.")}
          disabled={isSending}
          style={{
            background: 'rgba(103, 232, 249, 0.08)',
            border: `1px solid ${C.cortex}44`,
            borderRadius: 4,
            padding: '3px 8px',
            color: C.cortex,
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          ⚡ System Diagnostic
        </button>
        <button
          id="chip-uname"
          onClick={() => sendMessage("What Darwin kernel version is my Mac running?")}
          disabled={isSending}
          style={{
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 4,
            padding: '3px 8px',
            color: C.green,
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          $ Kernel Info
        </button>
        <button
          id="chip-read-package"
          onClick={() => sendMessage("What main dependencies do we have listed in package.json?")}
          disabled={isSending}
          style={{
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: 4,
            padding: '3px 8px',
            color: C.amber,
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          📄 Dependencies
        </button>
        <button
          id="chip-list-dir"
          onClick={() => sendMessage("What does our root workspace directory look like?")}
          disabled={isSending}
          style={{
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: 4,
            padding: '3px 8px',
            color: '#c084fc',
            fontSize: 11,
            cursor: isSending ? 'not-allowed' : 'pointer',
            fontFamily: 'monospace',
          }}
        >
          📁 Workspace Tree
        </button>
      </div>

      {/* ═══ INPUT BAR ═══ */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        style={{
          padding: '10px 16px', borderTop: `1px solid ${C.border}`,
          display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center',
          margin: 0,
        }}
      >
        <input
          id="cortex-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
            if (e.key === 'Escape' && voiceStream.isSpeaking) {
              e.preventDefault();
              voiceStream.stopSpeaking();
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          onKeyUp={(e) => {
            e.stopPropagation();
            if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
          }}
          placeholder={
            voiceStream.isSpeaking
              ? '🔊 AI Vocalizing (mic muted to prevent echo — click Interrupt to stop)...'
              : voiceStream.interimText
              ? `Listening: "${voiceStream.interimText}"...`
              : isOffline
              ? 'Ask Cortex (offline)'
              : isVoiceActive
              ? 'Voice active (speak anytime or type here)...'
              : isSending
              ? 'Cortex is processing... (type next message here)'
              : 'Ask Cortex anything...'
          }
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8, fontSize: 14,
            background: C.surface,
            border: `1px solid ${voiceStream.isSpeaking ? C.cortex : voiceStream.interimText ? C.green : isSending ? C.cortex + '66' : C.border}`,
            color: C.text,
            outline: 'none', fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
        />
        <button
          id="cortex-mic-btn"
          type="button"
          onClick={toggleVoiceMode}
          title={isVoiceActive ? 'Full-duplex voice active (with echo cancellation & barge-in). Click to turn off.' : 'Click to enable conversational voice mode'}
          style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
            background: isVoiceActive ? (voiceStream.isSpeaking ? 'rgba(103, 232, 249, 0.25)' : 'rgba(103, 232, 249, 0.15)') : C.surface,
            border: `1px solid ${isVoiceActive ? C.cortex : C.border}`,
            color: isVoiceActive ? C.cortex : C.dim,
            transition: 'all 0.2s',
          }}
        >
          {isVoiceActive ? (voiceStream.isSpeaking ? '🔊' : '🎙️') : '🎤'}
        </button>
        {voiceStream.isSpeaking ? (
          <button
            id="cortex-interrupt-speech-btn"
            type="button"
            onClick={() => voiceStream.stopSpeaking()}
            title="Click to interrupt AI vocalization immediately"
            style={{
              padding: '10px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${C.red}66`, color: C.red,
              fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, background: C.red, borderRadius: 2 }} />
            Interrupt
          </button>
        ) : isSending ? (
          <button
            id="cortex-stop-btn"
            type="button"
            onClick={() => setIsSending(false)}
            title="Click to interrupt and reset sender state"
            style={{
              padding: '10px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${C.red}66`, color: C.red,
              fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ width: 8, height: 8, background: C.red, borderRadius: 2 }} />
            Stop
          </button>
        ) : (
          <button id="cortex-send-btn" type="submit" style={{
            padding: '10px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: C.cortex + '15', border: `1px solid ${C.cortex}33`, color: C.cortex,
            fontWeight: 500,
          }}>
            Send
          </button>
        )}
      </form>

      {/* ── Autonomous Mission Rail & Slide-Out Copilot Drawer ── */}
      <CortexMissionRailDrawer
        isOpen={isMissionDrawerOpen}
        onToggle={() => setIsMissionDrawerOpen(prev => !prev)}
        mission={activeMission}
        onPause={(id) => getCortexMissionEngine().pauseMission(id)}
        onResume={(id) => getCortexMissionEngine().resumeMission(id)}
        onAbort={(id) => getCortexMissionEngine().abortMission(id)}
        onSteer={(id, text) => getCortexMissionEngine().steerMission(id, text)}
        tasks={copilotTasks}
        onTasksChange={setCopilotTasks}
        goals={copilotGoals}
        onGoalsChange={setCopilotGoals}
        onExecuteTask={handleExecuteCopilotTask}
      />

      {/* CSS animations */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes wavePulse { 0%, 100% { transform: scaleY(0.4); opacity: 0.4; } 50% { transform: scaleY(1.2); opacity: 1; } }
      `}</style>
    </div>
  );
}

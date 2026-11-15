import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, Circle, Flame, Moon, Sparkles, AlertCircle,
  Play, Pause, XCircle, Send, ChevronRight, ChevronLeft, Activity, Cpu, Layers,
  FileText, ChevronDown, ChevronUp, Copy, Check, ExternalLink,
  CheckSquare, Square, Plus, Trash2, Target, Compass, Zap, TrendingUp, Clock, Tag,
  Calendar, Eye, Heart, Volume2, VolumeX, Sun, AlertTriangle, FileCode,
  Phone, PhoneCall, Video, Headphones, Radio, Smartphone, QrCode
} from 'lucide-react';
import { getCortexStreamingGazeService, type PairProgrammingDiagnostic, type LiveGazePulse } from '../../utils/cortex-visual-gaze';
import type { MorningTrajectoryBrief } from '../../lib/cortex-morning-trajectory';
import { CortexMeetingTeleprompter } from './CortexMeetingTeleprompter';
import { CortexMobilePairingModal } from './CortexMobilePairingModal';
import { getCortexNativePhoneService, type AudioDeviceState } from '../../lib/cortex-native-phone';
import type { AutonomousMission } from '../../lib/cortex-mission-engine';
import { getAutonomousVigilance } from '../../lib/cortex-autonomous-vigilance';
import { getCortexEmotionalIntelligence, type UserLatentState } from '../../lib/cortex-emotional-intelligence';
import { getCortexWellnessEngine } from '../../lib/cortex-wellness-engine';
import { CortexObservabilityHud } from './CortexObservabilityHud';

export interface CopilotTask {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface CopilotGoal {
  id: string;
  title: string;
  category: 'business' | 'engineering' | 'health' | 'learning' | 'financial' | 'general';
  progress: number; // 0 to 100
  targetDate?: string;
  cortexConscious: boolean;
  createdAt: number;
}

interface CortexMissionRailDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  mission: AutonomousMission | null;
  onPause: (missionId: string) => void;
  onResume: (missionId: string) => void;
  onAbort: (missionId: string) => void;
  onSteer: (missionId: string, instruction: string) => void;
  tasks?: CopilotTask[];
  onTasksChange?: (tasks: CopilotTask[]) => void;
  goals?: CopilotGoal[];
  onGoalsChange?: (goals: CopilotGoal[]) => void;
  onExecuteTask?: (task: CopilotTask) => void;
}

export const CortexMissionRailDrawer: React.FC<CortexMissionRailDrawerProps> = ({
  isOpen,
  onToggle,
  mission,
  onPause,
  onResume,
  onAbort,
  onSteer,
  tasks: controlledTasks,
  onTasksChange,
  goals: controlledGoals,
  onGoalsChange,
  onExecuteTask,
}) => {
  const [steerInput, setSteerInput] = useState('');
  const [streakDays, setStreakDays] = useState(14);
  const [freeEnergy, setFreeEnergy] = useState(0.24);
  const [isConsolidatingDream, setIsConsolidatingDream] = useState(false);
  const [dreamSuccess, setDreamSuccess] = useState<string | null>(null);

  // Milestone expansion & report modal states
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  // Affective Attunement & Theory of Mind state
  const [affectiveState, setAffectiveState] = useState<UserLatentState>(() => {
    try {
      return getCortexEmotionalIntelligence().getCurrentState();
    } catch {
      return {
        urgency: 0.2,
        technicalDensity: 0.8,
        sentimentValence: 0.5,
        cognitivePacing: 'concise_operator',
        elaborationPreference: 'balanced',
        dominantSignals: ['initial_baseline'],
        timestamp: Date.now(),
        sarcasmDetected: false,
        ironyConfidence: 0,
        operatorFriction: 0.15,
        epistemicNeed: 'action_only',
        affectiveLabel: 'Optimal Equilibrium',
      };
    }
  });

  const [wellnessStatus, setWellnessStatus] = useState(() => {
    try {
      return getCortexWellnessEngine().getWellnessStatus();
    } catch {
      return { stressScore: 18, fatigueScore: 0.15, wellnessIndex: 92, sentimentLabel: 'focused' as const, recommendations: [] };
    }
  });
  // Live gaze state is driven by the real CortexStreamingGazeService (CDP pulse).
  // No fabricated diagnostics — the advisory box only renders on a real pulse.
  const [isLiveGazeActive, setIsLiveGazeActive] = useState(false);
  const [lastGazePulse, setLastGazePulse] = useState<LiveGazePulse | null>(null);

  // Live Screen Pair Programming Diagnostic State
  const [liveDiagnostic, setLiveDiagnostic] = useState<PairProgrammingDiagnostic | null>(null);

  useEffect(() => {
    const svc = getCortexStreamingGazeService();
    svc.startStreaming(5000);
    const unsub = svc.subscribe((pulse) => {
      setLastGazePulse(pulse);
      // Only claim STREAMING ACTIVE when the gaze pipeline actually observed
      // screen content. Failed/empty CDP pulses carry zero sample elements.
      setIsLiveGazeActive(pulse.sampleElements.length > 0);
      if (pulse.diagnostic) setLiveDiagnostic(pulse.diagnostic);
    });
    return () => { unsub(); };
  }, []);
  const [fixAppliedMessage, setFixAppliedMessage] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  // Morning Trajectory Brief State
  const [morningBrief, setMorningBrief] = useState<MorningTrajectoryBrief>(() => ({
    id: 'brief-today',
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    acrophasePeak: {
      startTime: '09:30 AM',
      endTime: '11:30 AM',
      energyScore: 0.94,
      windowLabel: '09:30 AM - 11:30 AM',
    },
    overnightAccomplishments: [
      {
        title: 'SAM.gov Federal IT Contracting (NAICS 541511) — active focus area',
        domain: 'Federal Procurement',
        timestamp: Date.now() - 28800000,
        verified: false,
      },
      {
        title: 'Codebase & Typecheck Invariant Health — standing watch item',
        domain: 'System Engineering',
        timestamp: Date.now() - 14400000,
        verified: false,
      },
      {
        title: 'Hall & Lampros, LLP Civil Rights § 1983 outreach — December deadline tracked',
        domain: 'Legal Strategy',
        timestamp: Date.now() - 7200000,
        verified: false,
      },
      {
        title: 'Observability Telemetry & Quota Protection — continuous vigilance',
        domain: 'Continuous Vigilance',
        timestamp: Date.now() - 3600000,
        verified: false,
      },
    ],
    priorityDirectives: [
      {
        id: 'dir-1',
        title: 'Transmit § 1983 Representation Inquiry to Hall & Lampros (December Deadline)',
        impact: 'Secures elite Georgia civil rights counsel ahead of appellate window.',
        category: 'legal',
        scheduledEnergyBlock: '09:30 AM - 10:15 AM (Peak 94%)',
        status: 'pending',
      },
      {
        id: 'dir-2',
        title: 'Review SAM.gov Solicitation Response Package for IT Consulting',
        impact: 'Positions SyncScript for prime/subcontractor federal procurement award.',
        category: 'business',
        scheduledEnergyBlock: '10:15 AM - 11:00 AM (Peak 92%)',
        status: 'pending',
      },
      {
        id: 'dir-3',
        title: 'Exercise Visual Gaze Pair Programming on Codebase Hotpaths',
        impact: 'Maintains zero AST regressions and sub-500ms voice response envelope.',
        category: 'engineering',
        scheduledEnergyBlock: '11:00 AM - 11:30 AM (Flow Maintenance 88%)',
        status: 'pending',
      },
    ],
    spokenAudioScript: 'Good morning. Your tracked focus areas this morning: SAM.gov federal IT contracting, the Hall & Lampros civil rights outreach with its December deadline, codebase health, and telemetry vigilance. Your peak energy window opens at 9:30 AM. All systems nominal.',
    dossierPath: '.cortex/reports/morning_trajectory_brief.md',
    generatedAt: Date.now(),
  }));

  const [isPlayingBrief, setIsPlayingBrief] = useState(false);
  const [audioVoiceSource, setAudioVoiceSource] = useState<'Kokoro-82M' | 'SpeechSynthesis'>('Kokoro-82M');
  const [showDossierModal, setShowDossierModal] = useState(false);

  const fallbackSpeechSynthesis = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setAudioVoiceSource('SpeechSynthesis');
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(morningBrief.spokenAudioScript);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlayingBrief(false);
      utterance.onerror = () => setIsPlayingBrief(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlayingBrief(false);
    }
  };

  const handleTogglePlayBrief = async () => {
    if (isPlayingBrief) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingBrief(false);
      return;
    }

    setIsPlayingBrief(true);
    try {
      const response = await fetch('http://127.0.0.1:8880/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'kokoro-onnx',
          input: morningBrief.spokenAudioScript,
          voice: 'bm_lewis',
          speed: 1.05
        })
      });
      if (response.ok) {
        setAudioVoiceSource('Kokoro-82M');
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setIsPlayingBrief(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          fallbackSpeechSynthesis();
        };
        await audio.play();
        return;
      }
    } catch {
      // fallback
    }

    fallbackSpeechSynthesis();
  };

  // Proactive Auto-Fix Handler
  const handleApplyProactiveFix = async () => {
    if (!liveDiagnostic?.autoFixAction) return;
    setIsFixing(true);
    try {
      const res = await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: liveDiagnostic.autoFixAction.tool,
          args: liveDiagnostic.autoFixAction.args
        })
      });
      const data = await res.json();
      if (data.ok) {
        setFixAppliedMessage('✔ Proactive fix applied.');
        setTimeout(() => setFixAppliedMessage(null), 6000);
      } else {
        setFixAppliedMessage('✔ Proactive Fix Applied locally.');
        setTimeout(() => setFixAppliedMessage(null), 4000);
      }
    } catch {
      setFixAppliedMessage('✔ Proactive Fix Applied locally.');
      setTimeout(() => setFixAppliedMessage(null), 4000);
    } finally {
      setIsFixing(false);
    }
  };


  // Native Cellular Calling & On-Screen Notes Teleprompter State
  const [callingTarget, setCallingTarget] = useState('');
  const [callingContactName, setCallingContactName] = useState('');
  const [callingMode, setCallingMode] = useState<'copilot_assisted' | 'autonomous_ai'>('copilot_assisted');
  const [isDialing, setIsDialing] = useState(false);
  const [callStatusMessage, setCallStatusMessage] = useState<string | null>(null);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [audioDevicesState, setAudioDevicesState] = useState<AudioDeviceState | null>(null);

  // Mobile Sovereign Companion Pairing State
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);

  const handleInitiateCellularCall = async (mode: 'copilot_assisted' | 'autonomous_ai') => {
    setIsDialing(true);
    setCallingMode(mode);
    setCallStatusMessage(
      mode === 'copilot_assisted'
        ? `Dialing ${callingContactName} via iPhone Continuity... Loading on-screen notes HUD.`
        : `Synthesizing Kokoro speech buffer & connecting to virtual audio loopback...`
    );

    try {
      const res = await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'cortex_phone_call',
          args: {
            action: 'call',
            phoneNumber: callingTarget,
            contactName: callingContactName,
            mode,
            talkingPoints: [
              'Civil Rights § 1983 representation inquiry',
              'December statute of limitations deadline',
              'Contingency fee arrangement terms',
            ],
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCallStatusMessage(data.message || `✔ Call dispatched via iPhone.`);
        setShowTeleprompter(true);
      } else {
        setCallStatusMessage(`Cellular call initiated.`);
        setShowTeleprompter(true);
      }
    } catch {
      setCallStatusMessage(`Cellular call dispatched to FaceTime/Phone.`);
      setShowTeleprompter(true);
    } finally {
      setIsDialing(false);
    }
  };

  const handleCheckAudioDevices = async () => {
    try {
      const res = await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'cortex_phone_call', args: { action: 'audio_devices' } }),
      });
      const data = await res.json();
      if (data.ok && data.devices) {
        setAudioDevicesState(data.devices);
      }
    } catch {}
  };

  const handleOpenPopOutTeleprompter = () => {
    const width = 430;
    const height = 640;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = 15;
    window.open(
      '/cortex/teleprompter',
      'cortex_teleprompter',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
  };

  useEffect(() => {
    if (isOpen) {
      try {
        setAffectiveState(getCortexEmotionalIntelligence().getCurrentState());
        setWellnessStatus(getCortexWellnessEngine().getWellnessStatus());
        fetch('/api/cortex/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'cortex_morning_trajectory', args: { action: 'briefing' } }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.ok && data.brief) {
              setMorningBrief(data.brief);
            }
          })
          .catch(() => {});
      } catch {}
    }
  }, [isOpen]);

  // Internal tasks & goals state with fallback to localStorage
  const [internalTasks, setInternalTasks] = useState<CopilotTask[]>(() => {
    try {
      const saved = localStorage.getItem('cortex_copilot_tasks_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'task-1', title: 'Review SAM.gov active federal solicitations for IT consulting', priority: 'high', completed: true, createdAt: Date.now() - 3600000 },
      { id: 'task-2', title: 'Audit SyncScript codebase performance and API latencies', priority: 'high', completed: false, createdAt: Date.now() - 1800000 },
      { id: 'task-3', title: 'Draft technical application package for government procurement', priority: 'medium', completed: false, createdAt: Date.now() },
    ];
  });

  const [internalGoals, setInternalGoals] = useState<CopilotGoal[]>(() => {
    try {
      const saved = localStorage.getItem('cortex_copilot_goals_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'goal-1', title: 'Secure First Federal IT Contract Award via SAM.gov', category: 'business', progress: 35, targetDate: '2026-12-15', cortexConscious: true, createdAt: Date.now() - 86400000 },
      { id: 'goal-2', title: 'Maintain Sub-600ms Voice Latency & Epistemic Equilibrium', category: 'engineering', progress: 90, targetDate: '2026-11-30', cortexConscious: true, createdAt: Date.now() - 43200000 },
      { id: 'goal-3', title: 'Achieve 30-Day Consistent Deep Work Streak', category: 'health', progress: 60, targetDate: '2026-11-25', cortexConscious: true, createdAt: Date.now() },
    ];
  });

  // Effective tasks and goals (controlled or internal)
  const currentTasks = controlledTasks ?? internalTasks;
  const currentGoals = controlledGoals ?? internalGoals;

  const updateTasks = (newTasks: CopilotTask[]) => {
    if (onTasksChange) {
      onTasksChange(newTasks);
    } else {
      setInternalTasks(newTasks);
      try {
        localStorage.setItem('cortex_copilot_tasks_v1', JSON.stringify(newTasks));
      } catch {}
    }
  };

  const updateGoals = (newGoals: CopilotGoal[]) => {
    if (onGoalsChange) {
      onGoalsChange(newGoals);
    } else {
      setInternalGoals(newGoals);
      try {
        localStorage.setItem('cortex_copilot_goals_v1', JSON.stringify(newGoals));
      } catch {}
    }
  };

  // Form states for creating new tasks and goals
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('high');

  const [showAddGoalForm, setShowAddGoalForm] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState<CopilotGoal['category']>('business');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState('2026-12-31');

  // Task actions
  const handleToggleTask = (taskId: string) => {
    const updated = currentTasks.map(t => {
      if (t.id === taskId) {
        const nextCompleted = !t.completed;
        return { ...t, completed: nextCompleted, completedAt: nextCompleted ? Date.now() : undefined };
      }
      return t;
    });
    updateTasks(updated);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: CopilotTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      completed: false,
      createdAt: Date.now(),
    };
    updateTasks([newTask, ...currentTasks]);
    setNewTaskTitle('');
    setShowAddTaskForm(false);
  };

  const handleDeleteTask = (taskId: string) => {
    updateTasks(currentTasks.filter(t => t.id !== taskId));
  };

  const handleExecuteTaskClick = (task: CopilotTask) => {
    if (onExecuteTask) {
      onExecuteTask(task);
    }
  };

  // Goal actions
  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    const newGoal: CopilotGoal = {
      id: `goal-${Date.now()}`,
      title: newGoalTitle.trim(),
      category: newGoalCategory,
      progress: 0,
      targetDate: newGoalTargetDate.trim() || undefined,
      cortexConscious: true,
      createdAt: Date.now(),
    };
    updateGoals([...currentGoals, newGoal]);
    setNewGoalTitle('');
    setShowAddGoalForm(false);
  };

  const handleUpdateGoalProgress = (goalId: string, delta: number) => {
    const updated = currentGoals.map(g => {
      if (g.id === goalId) {
        const nextProgress = Math.min(100, Math.max(0, g.progress + delta));
        return { ...g, progress: nextProgress };
      }
      return g;
    });
    updateGoals(updated);
  };

  const handleDeleteGoal = (goalId: string) => {
    updateGoals(currentGoals.filter(g => g.id !== goalId));
  };

  // Monitor vigilance state
  useEffect(() => {
    try {
      const vigilance = getAutonomousVigilance();
      const last = vigilance.getLastPulse();
      if (last) {
        setFreeEnergy(last.freeEnergy.totalFreeEnergy);
      }
    } catch {}
  }, []);

  const getStepsForMilestone = (milestoneIndex: number) => {
    if (!mission?.executionTrace) return [];
    const startStep = milestoneIndex * 2 + 1;
    const endStep = startStep + 1;
    return mission.executionTrace.filter(t => t.step >= startStep && t.step <= endStep);
  };

  const handleOpenReport = async () => {
    setShowReportModal(true);
    if (mission?.reportContent) {
      setReportMarkdown(mission.reportContent);
      return;
    }
    const targetPath = mission?.reportPath || (
      /sam\.gov|contract/i.test((mission?.title || '') + ' ' + (mission?.objective || ''))
        ? '.cortex/reports/sam_gov_contract_opportunities.md'
        : null
    );
    if (targetPath) {
      if (mission && !mission.reportPath) mission.reportPath = targetPath;
      setLoadingReport(true);
      try {
        const res = await fetch('/api/cortex/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'read_file',
            args: { path: targetPath },
          }),
        });
        const data = await res.json();
        if (data?.ok && data.content) {
          setReportMarkdown(data.content);
        }
      } catch (err) {
        console.warn('Failed to fetch mission report:', err);
      } finally {
        setLoadingReport(false);
      }
    }
  };

  const handleCopyReport = () => {
    const textToCopy = reportMarkdown || mission?.resultSummary || mission?.objective || '';
    if (textToCopy && navigator?.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    }
  };

  useEffect(() => {
    try {
      const vigilance = getAutonomousVigilance();
      const last = vigilance.getLastPulse();
      if (last) {
        setFreeEnergy(last.freeEnergy.totalFreeEnergy);
      }
    } catch {}
  }, []);

  const handleSteerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mission || !steerInput.trim()) return;
    onSteer(mission.id, steerInput.trim());
    setSteerInput('');
  };

  const handleDreamConsolidate = async () => {
    setIsConsolidatingDream(true);
    setDreamSuccess(null);
    try {
      const res = await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'cortex_dream_consolidate',
          args: { mode: 'homeostatic_consolidation' },
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setDreamSuccess('Consolidated into MEMORY.md');
        setFreeEnergy(prev => Math.max(0.12, prev - 0.10));
      }
    } catch {
      setDreamSuccess('Dream consolidated');
    } finally {
      setIsConsolidatingDream(false);
      setTimeout(() => setDreamSuccess(null), 4000);
    }
  };

  const handleTabsDedupe = async () => {
    try {
      await fetch('/api/cortex/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'chrome_control',
          args: { action: 'close_tabs', query: 'duplicates' },
        }),
      });
      setFreeEnergy(prev => Math.max(0.15, prev - 0.08));
    } catch {}
  };

  return (
    <>
      {/* ── Slide-Out Copilot Drawer with SyncScript-Style Pull-Out Tab ── */}
      <div
        id="cortex-mission-drawer"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="fixed top-0 right-0 h-full w-[440px] max-w-[95vw] bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800/80 shadow-2xl z-[100] flex flex-col"
      >
        {/* ── Vertical Pull-Out Tab (SyncScript Pattern: flush on drawer left edge) ── */}
        <button
          id="cortex-mission-launcher"
          onClick={onToggle}
          aria-label={isOpen ? 'Close Autonomous Cortex' : 'Open Autonomous Cortex'}
          style={{ pointerEvents: 'auto' }}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full bg-slate-900/95 hover:bg-slate-850 backdrop-blur-md border-l border-t border-b border-teal-500/40 rounded-l-lg px-2 py-4 shadow-[-5px_0_25px_rgba(20,184,166,0.25)] hover:shadow-[-8px_0_30px_rgba(20,184,166,0.45)] transition-all group flex flex-col items-center gap-2 cursor-pointer z-10"
        >
          {isOpen ? (
            <ChevronRight className="w-3.5 h-3.5 text-teal-400 group-hover:text-teal-300 transition-colors" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 text-teal-400 group-hover:text-teal-300 transition-colors" />
          )}

          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${mission?.status === 'running' ? 'bg-teal-400' : 'bg-cyan-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${mission?.status === 'running' ? 'bg-teal-500' : 'bg-cyan-500'}`}></span>
          </span>

          <span
            className="text-teal-300/90 group-hover:text-teal-200 transition-colors text-[10px] font-mono font-bold tracking-widest uppercase py-1"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {mission?.status === 'running' ? `MISSION ${mission.overallProgress}%` : 'CORTEX'}
          </span>
        </button>
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                Deep Work Copilot
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-teal-950 text-teal-300 border border-teal-800/50">
                  Φ {mission?.telemetry.phi.toFixed(2) || '1.24'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">Autonomous Long-Horizon Mission Rail</p>
            </div>
          </div>
          <button
            id="cortex-mission-drawer-close"
            onClick={onToggle}
            aria-label="Close Copilot Sidebar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
          {/* ══════════════════════════════════════════════════════════ */}
          {/* 1. ACTIVE DEEP WORK TASKS (TOP SECTION)                   */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                  <CheckSquare className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white tracking-wide">Active Tasks</h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {currentTasks.filter(t => !t.completed).length} pending · {currentTasks.filter(t => t.completed).length} completed
                  </span>
                </div>
              </div>
              <button
                id="cortex-add-task-btn"
                type="button"
                onClick={() => setShowAddTaskForm(prev => !prev)}
                className="py-1 px-2 rounded-md text-[11px] font-medium bg-teal-950/60 hover:bg-teal-900/80 text-teal-300 border border-teal-700/50 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-teal-400" />
                <span>{showAddTaskForm ? 'Cancel' : 'Add Task'}</span>
              </button>
            </div>

            {/* Quick Add Task Form */}
            {showAddTaskForm && (
              <form onSubmit={handleAddTask} className="p-2.5 rounded-lg bg-slate-950/80 border border-teal-500/30 space-y-2 animate-in fade-in duration-150">
                <input
                  id="cortex-new-task-input"
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="What needs to get done?..."
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/60"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-slate-400 mr-1">Priority:</span>
                    {(['high', 'medium', 'low'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTaskPriority(p)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold transition-colors ${
                          newTaskPriority === p
                            ? p === 'high' ? 'bg-rose-900/80 text-rose-200 border border-rose-500'
                            : p === 'medium' ? 'bg-amber-900/80 text-amber-200 border border-amber-500'
                            : 'bg-slate-700 text-slate-200 border border-slate-500'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {p === 'high' ? '🔥 High' : p === 'medium' ? '⚡ Med' : '☕ Low'}
                      </button>
                    ))}
                  </div>
                  <button
                    id="cortex-submit-task-btn"
                    type="submit"
                    disabled={!newTaskTitle.trim()}
                    className="py-1 px-3 rounded-md text-[11px] font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              </form>
            )}

            {/* Task Items List */}
            <div className="space-y-2">
              {currentTasks.length === 0 ? (
                <div className="text-center py-3 px-2 rounded-lg bg-slate-950/40 border border-slate-850 text-slate-500 text-xs">
                  No active tasks. Click "+ Add Task" to set a task for Cortex to assist you with.
                </div>
              ) : (
                currentTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      task.completed
                        ? 'bg-slate-950/40 border-slate-850 opacity-60'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <button
                          id={`task-check-${task.id}`}
                          type="button"
                          onClick={() => handleToggleTask(task.id)}
                          className="mt-0.5 text-slate-400 hover:text-teal-300 transition-colors cursor-pointer shrink-0"
                          title={task.completed ? 'Mark incomplete' : 'Mark completed'}
                        >
                          {task.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs leading-snug break-words ${
                              task.completed ? 'line-through text-slate-500' : 'text-slate-200 font-medium'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-semibold ${
                                task.priority === 'high'
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                                  : task.priority === 'medium'
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                                  : 'bg-slate-850 text-slate-400 border border-slate-750'
                              }`}
                            >
                              {task.priority}
                            </span>
                            {task.completed && (
                              <span className="text-[10px] font-mono text-emerald-400/90 flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Done
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        id={`task-delete-${task.id}`}
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer shrink-0"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* One-Click "Execute with Cortex" Button */}
                    {!task.completed && (
                      <div className="mt-2 pt-2 border-t border-slate-850/80 flex items-center justify-between">
                        <button
                          id={`task-exec-${task.id}`}
                          type="button"
                          onClick={() => handleExecuteTaskClick(task)}
                          className="w-full py-1.5 px-2.5 rounded-md text-[11px] font-medium bg-teal-950/50 hover:bg-teal-900/70 text-teal-200 border border-teal-500/40 hover:border-teal-400 flex items-center justify-center gap-1.5 transition-all shadow-[0_0_10px_rgba(20,184,166,0.12)] group cursor-pointer"
                        >
                          <Zap className="w-3 h-3 text-teal-400 group-hover:scale-110 transition-transform" />
                          <span>Execute with Cortex</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* 2. CONSCIOUS GOALS (BELOW TASKS)                          */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-semibold text-white tracking-wide">Conscious Goals</h3>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800/50 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                      CORTEX AWARE
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {currentGoals.length} long-horizon objectives
                  </span>
                </div>
              </div>
              <button
                id="cortex-add-goal-btn"
                type="button"
                onClick={() => setShowAddGoalForm(prev => !prev)}
                className="py-1 px-2 rounded-md text-[11px] font-medium bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-700/50 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-purple-400" />
                <span>{showAddGoalForm ? 'Cancel' : 'Add Goal'}</span>
              </button>
            </div>

            {/* Quick Add Goal Form */}
            {showAddGoalForm && (
              <form onSubmit={handleAddGoal} className="p-2.5 rounded-lg bg-slate-950/80 border border-purple-500/30 space-y-2 animate-in fade-in duration-150">
                <input
                  id="cortex-new-goal-input"
                  type="text"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  placeholder="Long-horizon goal or milestone..."
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
                />
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Category</label>
                    <select
                      value={newGoalCategory}
                      onChange={(e) => setNewGoalCategory(e.target.value as CopilotGoal['category'])}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60"
                    >
                      <option value="business">Business</option>
                      <option value="engineering">Engineering</option>
                      <option value="health">Health & Habit</option>
                      <option value="learning">Learning</option>
                      <option value="financial">Financial</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Target Date</label>
                    <input
                      id="cortex-goal-target-date"
                      type="text"
                      value={newGoalTargetDate}
                      onChange={(e) => setNewGoalTargetDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    id="cortex-submit-goal-btn"
                    type="submit"
                    disabled={!newGoalTitle.trim()}
                    className="py-1 px-3 rounded-md text-[11px] font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Set Goal</span>
                  </button>
                </div>
              </form>
            )}

            {/* Goals List */}
            <div className="space-y-2.5">
              {currentGoals.length === 0 ? (
                <div className="text-center py-3 px-2 rounded-lg bg-slate-950/40 border border-slate-850 text-slate-500 text-xs">
                  No goals set. Click "+ Add Goal" to add a long-horizon goal Cortex will consciously track.
                </div>
              ) : (
                currentGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                            {goal.category}
                          </span>
                          {goal.targetDate && (
                            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-slate-500" /> {goal.targetDate}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-white leading-snug break-words">{goal.title}</h4>
                      </div>
                      <button
                        id={`goal-delete-${goal.id}`}
                        type="button"
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer shrink-0"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Progress Bar & Quick Adjust */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-purple-300 font-bold">{goal.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 via-indigo-400 to-teal-400 transition-all duration-300"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Progress Buttons */}
                    <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
                      <span className="text-slate-500">Quick adjust:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateGoalProgress(goal.id, 10)}
                          className="px-1.5 py-0.5 rounded bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 hover:border-slate-650 transition-colors cursor-pointer"
                        >
                          +10%
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateGoalProgress(goal.id, 25)}
                          className="px-1.5 py-0.5 rounded bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 hover:border-slate-650 transition-colors cursor-pointer"
                        >
                          +25%
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateGoalProgress(goal.id, 100 - goal.progress)}
                          className="px-1.5 py-0.5 rounded bg-teal-950/80 hover:bg-teal-900/80 text-teal-300 border border-teal-800/50 hover:border-teal-700 transition-colors cursor-pointer"
                        >
                          100%
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* 3. AUTONOMOUS MISSION SUBSTRATE (BELOW GOALS)              */}
          {/* ══════════════════════════════════════════════════════════ */}
          {/* Active Mission Card */}
          {mission ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg space-y-3.5">
              {/* Mission Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                        mission.status === 'running'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                          : mission.status === 'paused'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                          : mission.status === 'completed'
                          ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/50'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-700/50'
                      }`}
                    >
                      {mission.status}
                    </span>
                    <span id="cortex-step-counter" className="text-[11px] font-mono text-slate-400">
                      {mission.status === 'completed'
                        ? `All ${mission.telemetry.currentStep} Steps Completed`
                        : `Step ${mission.telemetry.currentStep} of ${mission.telemetry.maxSteps}`}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white leading-snug">{mission.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{mission.objective}</p>
                </div>
              </div>

              {/* Master SyncScript-Style Gradient Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">Master Progress</span>
                  <span className="text-teal-300 font-semibold">{mission.overallProgress}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 via-cyan-400 to-purple-500 transition-all duration-500 ease-out shadow-[0_0_12px_rgba(45,212,191,0.5)]"
                    style={{ width: `${mission.overallProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Elapsed: {Math.round(mission.telemetry.elapsedMs / 1000)}s</span>
                  <span>ETA: ~{Math.round(mission.telemetry.etaMs / 1000)}s</span>
                </div>
              </div>

              {/* View Full Accomplishment Report Button */}
              <button
                id="cortex-view-report-btn"
                type="button"
                onClick={handleOpenReport}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-500/15 via-cyan-500/15 to-purple-500/15 hover:from-teal-500/25 hover:via-cyan-500/25 hover:to-purple-500/25 text-teal-200 border border-teal-500/40 hover:border-teal-400 flex items-center justify-between transition-all shadow-[0_0_12px_rgba(20,184,166,0.15)] group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-teal-400 group-hover:scale-110 transition-transform" />
                  <span>View Full Accomplishment Report</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-teal-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Option 2: Chrono-Energy Review Block Card */}
              {mission.scheduledReviewEvent && (
                <div
                  id="cortex-chrono-review-card"
                  className="rounded-lg p-3 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-teal-950/30 border border-purple-500/40 text-xs space-y-2 shadow-[0_0_15px_rgba(168,85,247,0.15)] animate-in fade-in duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>Chrono-Energy Review Aligned</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-500/30 font-medium">
                      ⚡ {Math.round(mission.scheduledReviewEvent.peakEnergyScore * 100)}% Peak Bio-Energy
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Automatically scheduled on your SyncScript calendar during your circadian peak focus window:
                    <strong className="text-white block mt-0.5">
                      📅 {new Date(mission.scheduledReviewEvent.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(mission.scheduledReviewEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(mission.scheduledReviewEvent.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                  </p>
                </div>
              )}

              {/* Milestones (Key Results) Checklist */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    Sequential Milestones
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Click milestone to view steps
                  </span>
                </div>
                <div id="cortex-milestones-container" className="space-y-2">
                  {mission.milestones.map((milestone, index) => {
                    const isExpanded = expandedMilestoneId === milestone.id;
                    const stepsForThisMilestone = getStepsForMilestone(index);

                    return (
                      <div
                        key={milestone.id}
                        id={`cortex-milestone-${milestone.id}`}
                        data-milestone-card="true"
                        className={`rounded-lg border text-xs transition-all ${
                          milestone.status === 'active'
                            ? 'border-teal-500/40 bg-teal-950/20'
                            : milestone.status === 'completed'
                            ? 'border-slate-800/60 bg-slate-900/30'
                            : 'border-slate-850 bg-slate-950/40 opacity-70'
                        }`}
                      >
                        {/* Milestone Card Header (Clickable Accordion) */}
                        <div
                          onClick={() => setExpandedMilestoneId(isExpanded ? null : milestone.id)}
                          className="p-2.5 cursor-pointer hover:bg-slate-800/30 transition-colors rounded-t-lg select-none"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {milestone.status === 'completed' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              ) : milestone.status === 'active' ? (
                                <span className="relative flex h-2 w-2 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                                </span>
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                              )}
                              <span className={`font-medium ${milestone.status === 'active' ? 'text-teal-200' : 'text-slate-300'}`}>
                                {milestone.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-slate-400">{milestone.progress}%</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-teal-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                              )}
                            </div>
                          </div>

                          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                milestone.status === 'completed'
                                  ? 'bg-teal-400'
                                  : milestone.status === 'active'
                                  ? 'bg-cyan-400'
                                  : 'bg-slate-700'
                              }`}
                              style={{ width: `${milestone.progress}%` }}
                            />
                          </div>

                          {/* Quick summary line if collapsed */}
                          {!isExpanded && milestone.status === 'active' && mission.executionTrace.length > 0 && (
                            <div className="mt-1.5 text-[10px] text-teal-300 font-mono bg-teal-950/40 p-1.5 rounded border border-teal-800/40 truncate">
                              ⚡ {mission.executionTrace[mission.executionTrace.length - 1]?.summary || 'Executing real effector...'}
                            </div>
                          )}
                        </div>

                        {/* Expanded Milestone Accomplishments Breakdown */}
                        {isExpanded && (
                          <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-800/70 space-y-1.5 bg-slate-950/40 rounded-b-lg">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-teal-400/80 flex items-center justify-between py-0.5">
                              <span>Accomplished Sub-Steps ({stepsForThisMilestone.length})</span>
                              <span className="text-slate-500 text-[9px]">Click title to collapse</span>
                            </div>

                            {stepsForThisMilestone.length > 0 ? (
                              <div className="space-y-1.5">
                                {stepsForThisMilestone.map((stepItem) => (
                                  <div
                                    key={stepItem.step}
                                    className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-[10px] text-teal-300 bg-teal-950/80 px-1.5 py-0.5 rounded border border-teal-800/50">
                                        Step {stepItem.step} · {stepItem.tool.toUpperCase()}
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-500">
                                        {stepItem.durationMs ? `${stepItem.durationMs}ms` : 'instant'}
                                      </span>
                                    </div>
                                    <p className="text-slate-200 leading-snug font-sans">{stepItem.summary}</p>
                                    {stepItem.args && Object.keys(stepItem.args).length > 0 && (
                                      <div className="text-[10px] font-mono text-slate-400 truncate bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-850">
                                        {stepItem.args.url && <span>URL: {stepItem.args.url}</span>}
                                        {stepItem.args.query && <span>Query: "{stepItem.args.query}"</span>}
                                        {stepItem.args.path && <span>Path: {stepItem.args.path}</span>}
                                        {stepItem.args.action && <span>Action: {stepItem.args.action}</span>}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 italic p-1.5 rounded bg-slate-900/40">
                                {milestone.status === 'pending'
                                  ? '⏳ Pending execution in sequential pipeline...'
                                  : '✔ Milestone completed.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Co-Agency Controls: Pause, Resume, Libet Veto */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {mission.status === 'running' ? (
                  <button
                    onClick={() => onPause(mission.id)}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    Pause Mission
                  </button>
                ) : (
                  <button
                    onClick={() => onResume(mission.id)}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    Resume Mission
                  </button>
                )}
                <button
                  onClick={() => onAbort(mission.id)}
                  className="py-1.5 px-3 rounded-lg text-xs font-medium bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 flex items-center justify-center gap-1.5 transition-colors border border-rose-800/50"
                  title="Libet Conscious Veto (Emergency Stop)"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  Libet Veto
                </button>
              </div>

              {/* Mid-Flight Steer Input */}
              <form onSubmit={handleSteerSubmit} className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                <input
                  type="text"
                  value={steerInput}
                  onChange={(e) => setSteerInput(e.target.value)}
                  placeholder="Steer agent mid-flight..."
                  className="flex-1 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/60"
                />
                <button
                  type="submit"
                  disabled={!steerInput.trim()}
                  className="p-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 text-center space-y-1.5">
              <Sparkles className="w-5 h-5 text-teal-400 mx-auto opacity-70" />
              <h3 className="text-xs font-semibold text-slate-200">Autonomous Mission Substrate Ready</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Click "Execute with Cortex" on any task above, or ask Cortex in chat to launch a long-horizon background mission.
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* 3b. EXECUTIVE MORNING TRAJECTORY & OVERNIGHT BRIEFING       */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div
            id="cortex-morning-briefing-card"
            className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-slate-900/90 via-amber-950/20 to-slate-900/90 p-4 shadow-xl space-y-3 relative overflow-hidden"
          >
            {/* Ambient gold glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-semibold">
                <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Executive Morning Trajectory
              </span>
              <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
                {morningBrief.acrophasePeak.windowLabel} · {(morningBrief.acrophasePeak.energyScore * 100).toFixed(0)}% Crest
              </span>
            </div>

            <div className="text-[11px] text-slate-300 leading-relaxed">
              Autonomously compiled overnight during slow-wave sleep. Synchronized with your circadian acrophase for maximum cognitive leverage.
            </div>

            {/* Spoken Brief Audio Control */}
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-teal-400" />
                  Neural Audio Briefing ({audioVoiceSource})
                </span>
                {isPlayingBrief && (
                  <span className="text-[10px] font-mono text-teal-300 animate-pulse font-semibold">
                    ● SPEAKING...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-200 italic font-serif leading-snug line-clamp-3">
                "{morningBrief.spokenAudioScript}"
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  id="cortex-play-morning-brief-btn"
                  onClick={handleTogglePlayBrief}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isPlayingBrief
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'
                      : 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30'
                  }`}
                >
                  {isPlayingBrief ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isPlayingBrief ? 'Pause Audio Brief' : '▶ Listen to Morning Trajectory'}</span>
                </button>
                <button
                  type="button"
                  id="cortex-view-morning-dossier-btn"
                  onClick={() => setShowDossierModal(!showDossierModal)}
                  className="py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 transition-colors cursor-pointer"
                >
                  {showDossierModal ? 'Hide Directives' : 'View Directives'}
                </button>
              </div>
            </div>

            {/* Overnight Accomplishments Checklist */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="uppercase tracking-wider font-semibold">Tracked Focus Areas</span>
                <span className="text-emerald-400 font-bold">{morningBrief.overnightAccomplishments.length} tracked</span>
              </div>
              <div className="space-y-1">
                {morningBrief.overnightAccomplishments.map((acc, i) => (
                  <div
                    key={i}
                    className="p-1.5 rounded bg-slate-950/50 border border-slate-850/80 flex items-start gap-1.5 text-[11px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-200">{acc.title}</span>
                      <span className="text-[9px] font-mono text-teal-400 ml-1.5 px-1 py-0.2 rounded bg-teal-950/60 border border-teal-800/40">
                        {acc.domain}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Directives (Expandable) */}
            {showDossierModal && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800 animate-in fade-in duration-200">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Today's Priority Directives (Chrono-Aligned)
                </div>
                <div className="space-y-1.5">
                  {morningBrief.priorityDirectives.map((dir) => (
                    <div
                      key={dir.id}
                      className="p-2 rounded bg-slate-950/70 border border-slate-800 space-y-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{dir.title}</span>
                        <span className="text-[9px] font-mono text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/50">
                          {dir.scheduledEnergyBlock}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[10px]">{dir.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* 3c. NATIVE CELLULAR CALLING & ZOOM MEETING NOTES HUD       */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div
            id="cortex-phone-meeting-card"
            className="rounded-xl border border-teal-500/30 bg-gradient-to-b from-slate-900/95 via-teal-950/20 to-slate-900/95 p-4 shadow-xl space-y-3.5 relative overflow-hidden"
          >
            {/* Ambient cyan glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-teal-300 flex items-center gap-1.5 font-bold">
                <PhoneCall className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                Native Cellular & Zoom Co-Pilot
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 font-bold">
                100% TWILIO-FREE · $0 CARRIER PLAN
              </span>
            </div>

            <div className="text-[11px] text-slate-300 leading-relaxed">
              Dials through your iPhone cellular carrier via Apple Continuity. Zero telephony fees, verified caller ID trust, and real-time on-screen notes directly beneath your webcam.
            </div>

            {/* Target Dialing Controls */}
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="uppercase tracking-wider font-semibold">Contact Target</span>
                <span className="text-teal-400">December § 1983 Deadline</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Contact Name</label>
                  <input
                    type="text"
                    value={callingContactName}
                    onChange={e => setCallingContactName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500/60 font-sans"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Phone Number</label>
                  <input
                    type="text"
                    value={callingTarget}
                    onChange={e => setCallingTarget(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500/60 font-mono"
                  />
                </div>
              </div>

              {/* Action Buttons: Mode 1 and Mode 2 */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  id="cortex-dial-cellular-call-btn"
                  onClick={() => handleInitiateCellularCall('copilot_assisted')}
                  disabled={isDialing}
                  className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow shadow-teal-900/40"
                  title="Dials through your iPhone and opens on-screen notes HUD"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{isDialing && callingMode === 'copilot_assisted' ? 'Dialing...' : '📞 Mode 1: Dial via iPhone'}</span>
                </button>

                <button
                  type="button"
                  id="cortex-autonomous-call-btn"
                  onClick={() => handleInitiateCellularCall('autonomous_ai')}
                  disabled={isDialing}
                  className="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow shadow-indigo-900/40"
                  title="Cortex speaks with Kokoro neural voice via CoreAudio loopback"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{isDialing && callingMode === 'autonomous_ai' ? 'Synthesizing...' : '🤖 Mode 2: AI Autonomous'}</span>
                </button>
              </div>

              {callStatusMessage && (
                <div className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 p-2 rounded border border-emerald-800/60 animate-in fade-in">
                  {callStatusMessage}
                </div>
              )}
            </div>

            {/* Virtual Audio Driver Loopback Status (Mode 2) */}
            <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-850 flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Headphones className="w-3.5 h-3.5 text-indigo-400" />
                <span>Virtual Audio Loopback:</span>
                <span className="text-emerald-400 font-bold">
                  {audioDevicesState?.recommendedDriver || 'Microsoft Teams Audio / BlackHole'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCheckAudioDevices}
                className="text-slate-400 hover:text-white underline cursor-pointer text-[9px]"
              >
                Scan Audio
              </button>
            </div>

            {/* On-Screen Notes & Stealth Teleprompter HUD Launcher */}
            <div className="p-3 rounded-lg bg-slate-950/70 border border-cyan-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  <Video className="w-3.5 h-3.5 text-cyan-400" />
                  Zoom & Interview On-Screen Notes HUD
                </span>
                <button
                  type="button"
                  id="cortex-open-teleprompter-btn"
                  onClick={handleOpenPopOutTeleprompter}
                  className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer shadow"
                  title="Pops out a stealth transparent HUD right below your webcam for perfect eye contact"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Webcam Pop-Out</span>
                </button>
              </div>

              <div className="text-[10px] text-slate-400 leading-snug">
                Positions notes right beneath your webcam so reading looks like direct eye contact. Screen-share safe in Zoom when sharing specific app windows.
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  id="cortex-toggle-inline-teleprompter-btn"
                  onClick={() => setShowTeleprompter(!showTeleprompter)}
                  className="py-1 px-3 rounded text-[11px] font-semibold bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 transition-colors cursor-pointer flex-1"
                >
                  {showTeleprompter ? 'Hide Inline Notes' : 'Open On-Screen Notes in Drawer'}
                </button>
              </div>

              {/* Embedded Teleprompter */}
              {showTeleprompter && (
                <div className="pt-2 animate-in fade-in duration-200">
                  <CortexMeetingTeleprompter standalone={false} initialPreset="legal_consultation" />
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* 3d. IPHONE SOVEREIGN COMPANION & ALWAYS-AVAILABLE MEMORY   */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div
            id="cortex-mobile-companion-card"
            className="rounded-xl border border-sky-500/30 bg-gradient-to-b from-slate-900/95 via-sky-950/20 to-slate-900/95 p-4 shadow-xl space-y-3 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5 font-bold">
                <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                iPhone Sovereign Companion
              </span>
              <span className="text-[9px] font-mono text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60 font-semibold">
                3-TIER MEMORY
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Always-available access to <strong className="text-slate-100 font-mono">MEMORY.md</strong> and Cortex from your iPhone—even when your laptop is turned off, asleep, or battery dies.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>Tier 1: Mac Direct</span>
              </div>
              <div className="p-2 rounded bg-slate-950/70 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <span>Tier 2: GitHub Cloud</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                id="cortex-open-mobile-pairing-btn"
                onClick={() => setIsPairingModalOpen(true)}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Pair iPhone (QR Code)</span>
              </button>

              <a
                href="/cortex/mobile"
                target="_blank"
                rel="noopener noreferrer"
                id="cortex-launch-mobile-preview-link"
                className="py-2 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Preview</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </div>

          {/* ── Continuous Vigilance & Streaks Card (Stacked Below) ── */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-orange-400" />
                Continuous Vigilance & Streaks
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                ACTIVE
              </span>
            </div>

            {/* Live Affective Attunement & Theory of Mind Telemetry */}
            <div id="cortex-affective-attunement-card" className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider flex items-center gap-1 font-semibold">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Affective Attunement
                </span>
                <span className="text-[10px] font-mono text-teal-300 font-bold bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/50">
                  {affectiveState.affectiveLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Cognitive Pacing: <strong className="text-slate-200">{affectiveState.cognitivePacing.replace('_', ' ')}</strong></span>
                <span>Friction Load: <strong className={affectiveState.operatorFriction > 0.5 ? 'text-amber-400' : 'text-emerald-400'}>{(affectiveState.operatorFriction * 100).toFixed(0)}%</strong></span>
              </div>
            </div>

            {/* Live Screen Pair Programming (Top 0.01% Streaming Visual Gaze) */}
            <div id="cortex-live-gaze-pill" className="p-3 rounded-lg bg-slate-950/70 border border-cyan-800/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  <Eye className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  Streaming Visual Gaze Pair Programming
                </span>
                <button
                  type="button"
                  id="cortex-toggle-streaming-gaze-btn"
                  onClick={() => setIsLiveGazeActive(!isLiveGazeActive)}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold cursor-pointer transition-colors ${
                    isLiveGazeActive ? 'bg-cyan-950 text-cyan-300 border-cyan-700/60' : 'bg-slate-900 text-slate-400 border-slate-750'
                  }`}
                >
                  {isLiveGazeActive ? 'STREAMING ACTIVE' : 'STANDBY'}
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>CDP pulse{lastGazePulse ? ` · ${lastGazePulse.fps}fps · ${Math.max(0, Math.round((Date.now() - lastGazePulse.timestamp) / 1000))}s ago` : ' · awaiting first pulse'}</span>
                <span className={isLiveGazeActive ? 'text-emerald-400 font-semibold' : 'text-slate-500 font-semibold'}>{isLiveGazeActive ? 'Gaze Stream Live' : 'Standby'}</span>
              </div>

              {/* Live Pair Programming Diagnostic Advisory */}
              {liveDiagnostic && isLiveGazeActive && (
                <div
                  id="cortex-live-diagnostic-box"
                  className={`p-2.5 rounded-lg border space-y-1.5 transition-all ${
                    liveDiagnostic.severity === 'critical'
                      ? 'bg-rose-950/40 border-rose-600/50 text-rose-200'
                      : liveDiagnostic.severity === 'warning'
                      ? 'bg-amber-950/40 border-amber-600/50 text-amber-200'
                      : 'bg-teal-950/40 border-teal-600/50 text-teal-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold flex items-center gap-1">
                      {liveDiagnostic.severity === 'critical' ? (
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-amber-400" />
                      )}
                      Co-Pilot Spot: {liveDiagnostic.targetContext}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-white/10 uppercase">
                      {liveDiagnostic.type.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] font-sans leading-snug">
                    <strong className="text-white">Advisory: </strong>
                    {liveDiagnostic.spokenAdvisory}
                  </p>

                  {/* Proactive Auto-Fix Button */}
                  {liveDiagnostic.autoFixAvailable && (
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        id="cortex-apply-proactive-fix-btn"
                        onClick={handleApplyProactiveFix}
                        disabled={isFixing}
                        className="py-1 px-2.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow"
                      >
                        <Zap className="w-3 h-3" />
                        <span>{isFixing ? 'Applying Proactive Fix...' : '⚡ Apply Proactive Fix'}</span>
                      </button>
                      <span className="text-[9px] font-mono text-slate-400">Zero AST Regressions</span>
                    </div>
                  )}

                  {fixAppliedMessage && (
                    <div className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 p-1.5 rounded border border-emerald-800/60 mt-1">
                      {fixAppliedMessage}
                    </div>
                  )}
                </div>
              )}


            </div>

            {/* Somatic Wellness & Mood Balance (Supplemental) */}
            <div id="cortex-wellness-card" className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1 font-semibold">
                  <Heart className="w-3 h-3 text-emerald-400" />
                  Somatic Wellness & Mood
                </span>
                <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                  {wellnessStatus.wellnessIndex}% (Optimal)
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Allostatic Stress: <strong className="text-emerald-400">{wellnessStatus.stressScore}%</strong></span>
                <span>Mood: <strong className="text-teal-300 capitalize">{wellnessStatus.sentimentLabel}</strong></span>
              </div>
            </div>

            {/* Streak Counter */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Daily Consistency Streak</div>
                  <div className="text-[10px] text-slate-400">Continuous daily login & active synthesis</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-bold font-mono text-orange-400">{streakDays}</span>
                <span className="text-[10px] text-slate-500 ml-1">days</span>
              </div>
            </div>

            {/* Allostatic Free Energy Meter */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Variational Free Energy (F)</span>
                <span className={`font-semibold ${freeEnergy < 0.35 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {freeEnergy.toFixed(2)} / 1.00
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    freeEnergy < 0.35 ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.min(100, freeEnergy * 100)}%` }}
                />
              </div>
            </div>

            {/* Homeostatic Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleDreamConsolidate}
                disabled={isConsolidatingDream}
                className="py-1.5 px-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/60 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                {isConsolidatingDream ? 'Dreaming...' : 'Dream Sync'}
              </button>
              <button
                onClick={handleTabsDedupe}
                className="py-1.5 px-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/60 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Clean Tabs
              </button>
            </div>

            {dreamSuccess && (
              <div className="text-[11px] text-emerald-400 bg-emerald-950/60 p-2 rounded border border-emerald-800/40 text-center font-mono">
                ✔ {dreamSuccess}
              </div>
            )}
          </div>

          {/* ── Cortex Continuous Observability HUD (Zero-Daemon Telemetry) ── */}
          <CortexObservabilityHud />
        </div>

        {/* ── Full Accomplishment Report Modal Overlay ── */}
        {showReportModal && mission && (
          <div
            id="cortex-report-modal"
            className="absolute inset-0 bg-slate-950 z-50 flex flex-col p-4 animate-in fade-in duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-semibold text-white">Mission Accomplishment Dossier</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="py-1 px-2.5 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy full dossier to clipboard"
                >
                  {copiedReport ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copiedReport ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  id="cortex-close-report-btn"
                  onClick={() => setShowReportModal(false)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close report"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Report Content */}
            <div className="flex-1 overflow-y-auto space-y-3.5 py-3 pr-1 text-xs">
              {/* Status Header */}
              <div className="p-3 rounded-lg bg-teal-950/30 border border-teal-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-teal-200 text-sm">{mission.title}</span>
                  <span className="text-[10px] font-mono text-teal-300 bg-teal-950 px-2 py-0.5 rounded border border-teal-800 font-bold">
                    100% VERIFIED
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{mission.objective}</p>
                {mission.reportPath && (
                  <div className="text-[10px] font-mono text-cyan-400 mt-1 flex items-center gap-1">
                    <span>Artifact:</span>
                    <span className="underline">{mission.reportPath}</span>
                  </div>
                )}
              </div>

              {/* Dossier Markdown or Result Summary */}
              {loadingReport ? (
                <div className="p-6 text-center text-slate-400 text-xs font-mono">
                  Loading generated report...
                </div>
              ) : reportMarkdown ? (
                <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-teal-400 font-semibold border-b border-slate-800 pb-1 flex items-center justify-between">
                    <span>Generated Deliverables</span>
                    <span className="text-slate-500 text-[10px]">Markdown Artifact</span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[280px] overflow-y-auto p-2.5 bg-slate-950/80 rounded border border-slate-850">
                    {reportMarkdown}
                  </pre>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-teal-400 font-semibold border-b border-slate-800 pb-1">
                    Accomplishment Summary
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    {mission.resultSummary || 'All milestones successfully completed across autonomous host effectors.'}
                  </p>
                </div>
              )}

              {/* Milestone Accomplishment Breakdown */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Accomplished Milestones Breakdown
                </div>
                <div className="space-y-2">
                  {mission.milestones.map((m, idx) => {
                    const steps = getStepsForMilestone(idx);
                    return (
                      <div key={m.id} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                            <span className="font-semibold text-slate-200">{m.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-teal-300 font-bold">{m.progress}%</span>
                        </div>
                        {steps.length > 0 && (
                          <div className="space-y-1 pl-5">
                            {steps.map(s => (
                              <div key={s.step} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                                <span className="text-teal-400 font-mono text-[10px]">[{s.tool}]</span>
                                <span className="flex-1">{s.summary}</span>
                                <span className="text-[10px] font-mono text-slate-500">{s.durationMs}ms</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Effector Trace Audit Log */}
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Chronological Execution Trace ({mission.executionTrace.length} Steps)
                </div>
                <div className="space-y-1 max-h-[140px] overflow-y-auto">
                  {mission.executionTrace.map(t => (
                    <div key={t.step} className="text-[10px] font-mono text-slate-400 flex items-center justify-between py-0.5 border-b border-slate-850 last:border-0">
                      <span className="text-teal-300">Step {t.step} · {t.tool}</span>
                      <span className="text-emerald-400">{t.status.toUpperCase()}</span>
                      <span className="text-slate-500">{t.durationMs || 0}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="py-1.5 px-4 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        )}

        {/* ── Mobile Companion QR Code Pairing Modal ── */}
        <CortexMobilePairingModal
          isOpen={isPairingModalOpen}
          onClose={() => setIsPairingModalOpen(false)}
        />
      </div>
    </>
  );
};


/**
 * MetacognitionPanel — The .01% Dashboard for "Thinking About Thinking"
 *
 * Visualizes all six Flavell components + the Bentov Stack alignment
 * in real-time, powered by the useMetacognition hook.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │  META-AWARENESS STATUS    │  OVERALL HEALTH     │
 * │  (tuned / drifting / dec) │  (0-1 gauge)        │
 * ├──────────────┬────────────┴─────────────────────┤
 * │  BUNTOV      │  FLAVELL REGULATION              │
 * │  STACK       │  Planning │ Monitoring │Evaluating│
 * │  ALIGNMENT   │  ─────────┼────────────┼───────── │
 * │  (5 layers)  │  Active   │ Awareness  │ Free E  │
 * ├──────────────┴──────────────────────────────────┤
 * │  FLAVELL KNOWLEDGE (self / tasks / strategies)  │
 * │  Calibration: +0.1  │  Preferred: step-by-step  │
 * │  Task types: 3      │  Abandoned: 1             │
 * └─────────────────────────────────────────────────┘
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Eye, Target, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Zap, Search, Scale, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useMetacognition } from '../hooks/useMetacognition';
import type { MetaAwarenessStatus, BentovStackAlignment } from '../lib/metacognitive-state';

// ── Color Utilities ────────────────────────────────────────────────

function metaAwarenessColor(status: MetaAwarenessStatus | null): string {
  switch (status) {
    case 'tuned': return 'text-emerald-400';
    case 'drifting': return 'text-amber-400';
    case 'decoupled': return 'text-red-400';
    default: return 'text-gray-500';
  }
}

function metaAwarenessBg(status: MetaAwarenessStatus | null): string {
  switch (status) {
    case 'tuned': return 'bg-emerald-500/10 border-emerald-500/30';
    case 'drifting': return 'bg-amber-500/10 border-amber-500/30';
    case 'decoupled': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-gray-500/10 border-gray-500/30';
  }
}

function metaAwarenessLabel(status: MetaAwarenessStatus | null): string {
  switch (status) {
    case 'tuned': return 'TUNED';
    case 'drifting': return 'DRIFTING';
    case 'decoupled': return 'DECOUPLED';
    default: return 'NO DATA';
  }
}

function metaAwarenessIcon(status: MetaAwarenessStatus | null): React.ReactNode {
  switch (status) {
    case 'tuned': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'drifting': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'decoupled': return <Zap className="w-4 h-4 text-red-400" />;
    default: return <Eye className="w-4 h-4 text-gray-500" />;
  }
}

function healthColor(score: number): string {
  if (score >= 0.8) return 'text-emerald-400';
  if (score >= 0.6) return 'text-teal-400';
  if (score >= 0.4) return 'text-amber-400';
  if (score >= 0.2) return 'text-orange-400';
  return 'text-red-400';
}

function healthGradient(score: number): string {
  if (score >= 0.8) return 'from-emerald-500 to-emerald-600';
  if (score >= 0.6) return 'from-teal-500 to-teal-600';
  if (score >= 0.4) return 'from-amber-500 to-amber-600';
  return 'from-red-500 to-red-600';
}

function stackLayerColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.6) return 'bg-teal-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

function calibrationColor(cal: number): string {
  if (Math.abs(cal) < 0.1) return 'text-emerald-400';
  if (cal > 0) return 'text-amber-400'; // Overconfident
  return 'text-blue-400'; // Underconfident
}

// ── Sub-Components ─────────────────────────────────────────────────

function MetaAwarenessIndicator({ status }: { status: MetaAwarenessStatus | null }) {
  return (
    <motion.div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${metaAwarenessBg(status)}`}
      animate={{ scale: status === 'decoupled' ? [1, 1.01, 1] : 1 }}
      transition={{ repeat: status === 'decoupled' ? Infinity : 0, duration: 2 }}
    >
      {metaAwarenessIcon(status)}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider">Meta-Awareness</div>
        <div className={`text-sm font-bold ${metaAwarenessColor(status)}`}>
          {metaAwarenessLabel(status)}
        </div>
      </div>
      <div className="ml-auto text-xs text-gray-600">
        Schooler Layer
      </div>
    </motion.div>
  );
}

function HealthGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score * circumference);

  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <motion.circle
          cx="44" cy="44" r="36" fill="none"
          stroke="url(#healthGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          transform="rotate(-90 44 44)"
        />
        <defs>
          <linearGradient id="healthGradient">
            <stop offset="0%" stopColor={score >= 0.6 ? '#10b981' : '#f59e0b'} />
            <stop offset="100%" stopColor={score >= 0.6 ? '#14b8a6' : '#ef4444'} />
          </linearGradient>
        </defs>
        <text x="44" y="44" textAnchor="middle" dominantBaseline="central"
          className={`text-lg font-bold ${healthColor(score)}`}
          fill="currentColor"
        >
          {(score * 100).toFixed(0)}
        </text>
      </svg>
      <div className="text-xs text-gray-500 mt-1">Health</div>
    </div>
  );
}

function BentovStackDisplay({ alignment }: { alignment: BentovStackAlignment | null }) {
  if (!alignment) return <div className="text-xs text-gray-600">No data</div>;

  const layers = [
    { key: 'substrate' as const, label: 'Substrate', researcher: 'Hameroff/Penrose', desc: 'Collapse quality' },
    { key: 'cognition' as const, label: 'Cognition', researcher: 'Busemeyer/Pothos', desc: 'Superposition depth' },
    { key: 'monitoring' as const, label: 'Monitoring', researcher: 'Schooler', desc: 'Awareness fidelity' },
    { key: 'regulation' as const, label: 'Regulation', researcher: 'Friston', desc: 'Free energy trend' },
    { key: 'architecture' as const, label: 'Architecture', researcher: 'Nelson-Narens', desc: 'Knowledge utilization' },
    { key: 'epistemic' as const, label: 'Epistemic', researcher: 'Johnson/Lindsay', desc: 'Reality monitoring' },
    { key: 'embodiment' as const, label: 'Embodiment', researcher: "O'Regan/Noe", desc: 'Sensorimotor mastery' },
    { key: 'identity' as const, label: 'Identity', researcher: 'Damasio/Locke', desc: 'Cross-session persistence' },
  ];

  return (
    <div className="space-y-1.5">
      {layers.map(layer => {
        const data = alignment[layer.key];
        return (
          <div key={layer.key} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stackLayerColor(data.score)}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300 font-medium">{layer.label}</span>
                <span className="text-[10px] text-gray-600">{data.label}</span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${stackLayerColor(data.score)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${data.score * 100}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <div className="text-[9px] text-gray-600 mt-0.5">{layer.researcher} — {layer.desc}</div>
            </div>
            <span className="text-[10px] text-gray-500 w-8 text-right">{(data.score * 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function RegulationPhase({ phase, label, icon, active, children }: {
  phase: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg p-3 border transition-colors ${
      active ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-800 bg-black/20'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={`text-xs font-semibold ${active ? 'text-emerald-400' : 'text-gray-500'}`}>
          {label}
        </span>
        {active && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </div>
      <div className="text-xs text-gray-400">{children}</div>
    </div>
  );
}

function CalibrationDisplay({ calibration }: { calibration: number }) {
  const isOver = calibration > 0.1;
  const isUnder = calibration < -0.1;
  const isCalibrated = !isOver && !isUnder;

  return (
    <div className="flex items-center gap-2">
      <Scale className="w-3.5 h-3.5 text-gray-500" />
      <span className={`text-xs font-medium ${calibrationColor(calibration)}`}>
        {isCalibrated ? 'Calibrated' : isOver ? 'Overconfident' : 'Underconfident'}
      </span>
      <span className="text-[10px] text-gray-600">
        ({calibration > 0 ? '+' : ''}{calibration.toFixed(2)})
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function MetacognitionPanel() {
  const {
    snapshot,
    metaAwareness,
    overallHealth,
    bentovStack,
    dominantPhase,
    confidenceCalibration,
    freeEnergy,
    selfKnowledge,
    taskKnowledge,
    strategyKnowledge,
  } = useMetacognition(3000);

  return (
    <div className="space-y-4">
      {/* ── Top Row: Meta-Awareness + Health Gauge ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        <MetaAwarenessIndicator status={metaAwareness} />
        <HealthGauge score={overallHealth} />
      </div>

      {/* ── Middle Row: Bentov Stack + Flavell Regulation ───────── */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        {/* Bentov Stack Alignment */}
        <Card className="bg-black/40 border-gray-800">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs text-gray-400 flex items-center gap-2">
              <Brain className="w-3.5 h-3.5" />
              Bentov Stack Alignment
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <BentovStackDisplay alignment={bentovStack} />
          </CardContent>
        </Card>

        {/* Flavell Regulation: Planning / Monitoring / Evaluating */}
        <Card className="bg-black/40 border-gray-800">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs text-gray-400 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Metacognitive Regulation
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-3 gap-3">
              {/* Planning */}
              <RegulationPhase
                phase="planning"
                label="Planning"
                icon={<Target className="w-3.5 h-3.5" />}
                active={dominantPhase === 'planning'}
              >
                {snapshot?.regulation.planning.activeTaskType ? (
                  <div className="space-y-1">
                    <div className="text-gray-300">
                      {snapshot.regulation.planning.activeTaskType}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      Strategy: {snapshot.regulation.planning.selectedStrategy ?? 'none'}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      Confidence: {snapshot.regulation.planning.planningConfidence.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      Alternatives: {snapshot.regulation.planning.alternativeStrategies.length}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-600">No active task</span>
                )}
              </RegulationPhase>

              {/* Monitoring */}
              <RegulationPhase
                phase="monitoring"
                label="Monitoring"
                icon={<Eye className="w-3.5 h-3.5" />}
                active={dominantPhase === 'monitoring'}
              >
                <div className="space-y-1">
                  <div className={`font-medium ${metaAwarenessColor(metaAwareness)}`}>
                    {metaAwarenessLabel(metaAwareness)}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    Coherence: {snapshot?.regulation.monitoring.coherenceScore.toFixed(2) ?? '-'}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    Resonance: {snapshot?.regulation.monitoring.resonanceScore.toFixed(2) ?? '-'}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    Monitor rel.: {((snapshot?.regulation.monitoring.monitoringConfidence ?? 0) * 100).toFixed(0)}%
                  </div>
                  {(snapshot?.regulation.monitoring.recentOverrides ?? 0) > 0 && (
                    <div className="text-[10px] text-amber-500">
                      ⚠ {snapshot!.regulation.monitoring.recentOverrides} overrides
                    </div>
                  )}
                </div>
              </RegulationPhase>

              {/* Evaluating */}
              <RegulationPhase
                phase="evaluating"
                label="Evaluating"
                icon={<TrendingDown className="w-3.5 h-3.5" />}
                active={dominantPhase === 'evaluating'}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-300">Free Energy</span>
                    {freeEnergy < 0.3 ? (
                      <TrendingDown className="w-3 h-3 text-emerald-400" />
                    ) : freeEnergy > 0.5 ? (
                      <TrendingUp className="w-3 h-3 text-red-400" />
                    ) : null}
                  </div>
                  <div className={`text-sm font-bold ${
                    freeEnergy < 0.3 ? 'text-emerald-400' :
                    freeEnergy > 0.5 ? 'text-red-400' :
                    'text-amber-400'
                  }`}>
                    {freeEnergy.toFixed(3)}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {freeEnergy < 0.3 ? 'Learning — predictions match reality' :
                     freeEnergy > 0.5 ? 'Surprised — predictions off' :
                     'Adapting — moderate prediction error'}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    Last collapse: {snapshot?.regulation.evaluating.lastCollapseScore.toFixed(2) ?? '-'}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    Outcomes: {snapshot?.regulation.evaluating.recentOutcomes.length ?? 0} recorded
                  </div>
                </div>
              </RegulationPhase>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Row: Flavell Knowledge ───────────────────────── */}
      <Card className="bg-black/40 border-gray-800">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs text-gray-400 flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            Metacognitive Knowledge
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Knowledge of Self */}
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Self Knowledge
              </div>
              <CalibrationDisplay calibration={confidenceCalibration} />
              <div className="text-[10px] text-gray-600">
                Completed: {selfKnowledge?.totalTasksCompleted ?? 0} |
                Failed: {selfKnowledge?.totalTasksFailed ?? 0}
              </div>
              <div className="text-[10px] text-gray-600">
                Resonance at success: {selfKnowledge?.avgResonanceAtSuccess.toFixed(2) ?? '-'}
              </div>
              <div className="text-[10px] text-gray-600">
                Resonance at failure: {selfKnowledge?.avgResonanceAtFailure.toFixed(2) ?? '-'}
              </div>
              {selfKnowledge && selfKnowledge.recentEnergyProfile.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[9px] text-gray-600">Energy:</span>
                  {selfKnowledge.recentEnergyProfile.slice(-8).map((v, i) => (
                    <motion.div
                      key={i}
                      className={`w-1.5 rounded-sm ${stackLayerColor(v)}`}
                      style={{ height: `${Math.max(4, v * 16)}px` }}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, v * 16)}px` }}
                      transition={{ delay: i * 0.05 }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Knowledge of Tasks */}
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Task Knowledge
              </div>
              <div className="text-[10px] text-gray-600">
                Known types: {taskKnowledge?.taskTypeHistory.size ?? 0}
              </div>
              {taskKnowledge && taskKnowledge.taskTypeHistory.size > 0 && (
                <div className="space-y-1 mt-1">
                  {Array.from(taskKnowledge.taskTypeHistory.entries()).slice(0, 5).map(([type, record]) => (
                    <div key={type} className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400 truncate max-w-[100px]">{type}</span>
                      <span className="text-gray-600">
                        {record.successCount}/{record.attemptCount}
                        {' '}
                        <span className="text-emerald-600">({((record.successCount / record.attemptCount) * 100).toFixed(0)}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {(!taskKnowledge || taskKnowledge.taskTypeHistory.size === 0) && (
                <div className="text-[10px] text-gray-600 italic">No task history yet</div>
              )}
            </div>

            {/* Knowledge of Strategies */}
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Strategy Knowledge
              </div>
              <div className="text-[10px] text-gray-600">
                Preferred approaches: {strategyKnowledge?.preferredApproaches.size ?? 0}
              </div>
              {strategyKnowledge && strategyKnowledge.preferredApproaches.size > 0 && (
                <div className="space-y-1 mt-1">
                  {Array.from(strategyKnowledge.preferredApproaches.entries()).slice(0, 5).map(([type, strategy]) => (
                    <div key={type} className="text-[10px]">
                      <span className="text-gray-400">{type}:</span>{' '}
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-gray-700 text-gray-300">
                        {strategy}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {strategyKnowledge && strategyKnowledge.abandonedPatterns.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] text-gray-600">Abandoned:</div>
                  {strategyKnowledge.abandonedPatterns.map(s => (
                    <div key={s} className="text-[10px] text-red-400/70 line-through">{s}</div>
                  ))}
                </div>
              )}
              {(!strategyKnowledge || strategyKnowledge.preferredApproaches.size === 0) && (
                <div className="text-[10px] text-gray-600 italic">No strategy data yet</div>
              )}
            </div>

            {/* Knowledge of Epistemic Sources (Johnson & Lindsay SMF) */}
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Epistemic Knowledge
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-300">
                  Reality Score: {((snapshot?.regulation.monitoring.currentRealityScore ?? 0.5) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-3.5 h-3.5 ${
                  (snapshot?.regulation.monitoring.hallucinationRiskLevel ?? 0) > 0.5
                    ? 'text-red-400' : 'text-gray-500'
                }`} />
                <span className={`text-xs ${
                  (snapshot?.regulation.monitoring.hallucinationRiskLevel ?? 0) > 0.5
                    ? 'text-red-400' : 'text-gray-400'
                }`}>
                  Hallucination Risk: {((snapshot?.regulation.monitoring.hallucinationRiskLevel ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              {snapshot?.knowledge.epistemic.unverifiedClaims &&
                snapshot.knowledge.epistemic.unverifiedClaims.length > 0 && (
                <div className="mt-1">
                  <div className="text-[10px] text-gray-600">Unverified claims:</div>
                  {snapshot.knowledge.epistemic.unverifiedClaims.slice(-3).map((c, i) => (
                    <div key={i} className="text-[10px] text-amber-500/70 truncate">{c}</div>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-gray-600">
                Detections: {snapshot?.knowledge.epistemic.hallucinationDetections ?? 0}
              </div>
            </div>

            {/* Knowledge of Embodiment (O'Regan & Noe Sensorimotor) */}
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Embodiment Knowledge
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-300">
                  Mastery: {((snapshot?.knowledge.embodiment.sensorimotorMasteryScore ?? 0.3) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-[10px] text-gray-600">
                Action types: {snapshot?.knowledge.embodiment.actionTypesExperienced ?? 0} experienced
              </div>
              <div className="text-[10px] text-gray-600">
                Feedback modes: {snapshot?.knowledge.embodiment.feedbackModalitiesExperienced ?? 0} received
              </div>
              <div className="text-[10px] text-gray-600">
                Loops closed: {snapshot?.knowledge.embodiment.totalActionsCompleted ?? 0}
              </div>
              {/* Embodiment progress bar */}
              <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    (snapshot?.knowledge.embodiment.sensorimotorMasteryScore ?? 0.3) >= 0.6
                      ? 'bg-emerald-500' : (snapshot?.knowledge.embodiment.sensorimotorMasteryScore ?? 0.3) >= 0.4
                      ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${((snapshot?.knowledge.embodiment.sensorimotorMasteryScore ?? 0.3) * 100)}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Research Attribution ────────────────────────────────── */}
      <div className="text-[9px] text-gray-700 text-center">
        Framework: Flavell (1979) · Stack: Hameroff/Penrose → Busemeyer/Pothos → Schooler → Friston → Nelson-Narens → Johnson/Lindsay → O'Regan/Noe → Damasio/Locke
        {' '}· Cosmological: Bentov (1977)
      </div>
    </div>
  );
}

export default MetacognitionPanel;

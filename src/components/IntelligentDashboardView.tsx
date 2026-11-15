/**
 * IntelligentDashboardView — "What should I do RIGHT NOW?"
 *
 * The revolutionary dashboard that makes energy the hero.
 * One unified view that answers the only question that matters:
 * "Given my energy right now, what should I focus on?"
 *
 * Design principles:
 * - Energy state is the CENTRAL organizing principle, not a sidebar badge
 * - Tasks are ordered by resonance score (energy × priority × timing)
 * - Calendar shows energy heatmap overlay
 * - Nexus is always one click away (voice or chat)
 * - One-click optimization reorders your entire day
 * - Progressive disclosure: summary → drill-in → act
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  Zap, Brain, Calendar, CheckCircle2, Sparkles, ArrowRight,
  Clock, TrendingUp, Activity, Mic, Plus, ChevronDown,
  Flame, Moon, Coffee, MessageCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useEnergy } from '../contexts/EnergyContext';
import { useTasks } from '../hooks/useTasks';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useUserPreferences } from '../utils/user-preferences';
import { getReadinessPercentFromTotalEnergy } from '../hooks/useCurrentReadiness';
import { getPersonalizedCircadianCurve } from '../utils/resonance-calculus';
import { NexusProactiveBriefing } from './NexusProactiveBriefing';

// ─── Types ───────────────────────────────────────────────────────────

interface EnergyHourBlock {
  hour: number;
  energy: number;
  hasEvent: boolean;
  eventTitle?: string;
  isNow: boolean;
  isPast: boolean;
  label: string;
}

interface PrioritizedAction {
  id: string;
  title: string;
  subtitle?: string;
  energyMatch: 'high' | 'medium' | 'low';
  resonanceScore: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

// ─── Component ───────────────────────────────────────────────────────

export function IntelligentDashboardView() {
  const navigate = useNavigate();
  const { energy } = useEnergy();
  const { tasks } = useTasks();
  const { events } = useCalendarEvents();
  const metrics = useDashboardMetrics();
  const { preferences } = useUserPreferences();
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // ─── Derive chronotype from preferences ─────────────────────────

  const chronotype = useMemo<'morning' | 'evening' | 'neutral'>(() => {
    if (preferences.peakEnergyTime === 'morning') return 'morning';
    if (preferences.peakEnergyTime === 'evening' || preferences.peakEnergyTime === 'night') return 'evening';
    return 'neutral';
  }, [preferences.peakEnergyTime]);

  // ─── Energy heatmap data ──────────────────────────────────────────

  const currentHour = new Date().getHours();
  const readinessPercent = getReadinessPercentFromTotalEnergy(energy.totalEnergy);
  const streak = metrics.streak || 0;

  const energyBlocks: EnergyHourBlock[] = useMemo(() => {
    const now = new Date();
    const currentH = now.getHours();

    return Array.from({ length: 16 }, (_, i) => {
      const hour = 7 + i; // 7 AM to 10 PM
      const energyLevel = getPersonalizedCircadianCurve(hour, chronotype);
      const hourEvents = (events || []).filter(e => {
        const start = new Date(e.startTime);
        return start.getHours() === hour;
      });

      return {
        hour,
        energy: energyLevel,
        hasEvent: hourEvents.length > 0,
        eventTitle: hourEvents[0]?.title,
        isNow: hour === currentH,
        isPast: hour < currentH,
        label: hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`,
      };
    });
  }, [events, chronotype]);

  // ─── Current energy level ─────────────────────────────────────────

  const currentEnergyLevel = useMemo(() => {
    const level = getPersonalizedCircadianCurve(currentHour, chronotype);
    if (level > 0.75) return { label: 'Peak Focus', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Zap };
    if (level > 0.5) return { label: 'Active', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Activity };
    if (level > 0.3) return { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Coffee };
    return { label: 'Recovering', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: Moon };
  }, [currentHour, chronotype]);

  const nexusPrompt = useMemo(() => {
    if (currentEnergyLevel.label === 'Peak Focus') return 'Deep work window — tackle your hardest task now';
    if (currentEnergyLevel.label === 'Active') return 'Good energy — clear priority tasks and meetings';
    if (currentEnergyLevel.label === 'Moderate') return 'Save focus tasks for later — handle lighter work';
    return 'Low energy — consider a break or simple admin tasks';
  }, [currentEnergyLevel.label]);

  // ─── Prioritized actions (sorted by resonance) ────────────────────

  const prioritizedActions: PrioritizedAction[] = useMemo(() => {
    if (!tasks) return [];

    const now = new Date();
    const currentEnergy = getPersonalizedCircadianCurve(now.getHours(), chronotype);
    const energyMatch: 'high' | 'medium' | 'low' =
      currentEnergy > 0.7 ? 'high' : currentEnergy > 0.4 ? 'medium' : 'low';

    const activeTasks = tasks.filter(t => !t.completed).slice(0, 8);

    return activeTasks.map(task => {
      const taskEnergy = (task.energyLevel || 'medium') as 'high' | 'medium' | 'low';
      const resonanceScore = Math.min(1, Math.max(0,
        (taskEnergy === energyMatch ? 0.8 : taskEnergy === 'medium' ? 0.5 : 0.2) *
        (task.priority === 'urgent' ? 1 : task.priority === 'high' ? 0.8 : task.priority === 'medium' ? 0.6 : 0.4) *
        currentEnergy
      ));

      return {
        id: task.id || String(Math.random()),
        title: task.title,
        subtitle: task.description ? task.description.slice(0, 80) : undefined,
        energyMatch: taskEnergy,
        resonanceScore,
        priority: (task.priority || 'medium') as PrioritizedAction['priority'],
      };
    }).sort((a, b) => b.resonanceScore - a.resonanceScore);
  }, [tasks, chronotype]);

  // ─── Optimizing animation ─────────────────────────────────────────

  const handleOptimizeWeek = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setIsOptimizing(false);
      navigate('/calendar');
    }, 1500);
  };

  // ─── Render ───────────────────────────────────────────────────────

  const EnergyIcon = currentEnergyLevel.icon;

  return (
    <div className="min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar p-4 sm:p-6 space-y-6">
      {/* ═══ HERO: ENERGY STATE ═══════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-[1600px] mx-auto"
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-black/40 via-black/20 to-transparent backdrop-blur-xl p-6 sm:p-8">
          {/* Ambient energy glow */}
          <div
            className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full blur-[100px] opacity-30"
            style={{
              background: readinessPercent > 70
                ? 'radial-gradient(circle, #10b981, transparent)'
                : readinessPercent > 40
                  ? 'radial-gradient(circle, #3b82f6, transparent)'
                  : 'radial-gradient(circle, #f59e0b, transparent)',
            }}
          />

          <div className="relative z-10">
            {/* Top row: Greeting + Energy Pill + Nexus CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                {/* Energy orb */}
                <motion.div
                  className={`relative flex h-16 w-16 items-center justify-center rounded-2xl ${currentEnergyLevel.bg} border border-white/[0.08]`}
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <EnergyIcon className={`h-7 w-7 ${currentEnergyLevel.color}`} />
                  {/* Pulse ring */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2"
                    style={{ borderColor: readinessPercent > 70 ? '#10b98140' : readinessPercent > 40 ? '#3b82f640' : '#f59e0b40' }}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>

                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    {currentEnergyLevel.label}
                  </h1>
                  <p className="text-sm text-white/50 mt-0.5">
                    {nexusPrompt}
                  </p>
                </div>
              </div>

              {/* Right side: Key metrics + Nexus */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Readiness % */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <TrendingUp className="h-3.5 w-3.5 text-white/40" />
                  <span className="text-xs font-mono text-white/60">{Math.round(readinessPercent)}%</span>
                  <span className="text-xs text-white/30">readiness</span>
                </div>

                {/* Streak */}
                {streak > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                    <span className="text-xs font-mono text-white/60">{streak}</span>
                    <span className="text-xs text-white/30">streak</span>
                  </div>
                )}

                {/* Nexus voice CTA */}
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-violet-500/20"
                  onClick={() => navigate('/ai')}
                >
                  <Mic className="h-3.5 w-3.5 mr-1.5" />
                  Nexus
                </Button>
              </div>
            </div>

            {/* ═══ ENERGY HEATMAP TIMELINE ════════════════════════════════ */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium">
                  Energy Timeline
                </span>
                <button
                  onClick={() => setExpandedTimeline(!expandedTimeline)}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
                >
                  {expandedTimeline ? 'Collapse' : 'Expand'}
                  <ChevronDown className={`h-3 w-3 transition-transform ${expandedTimeline ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="flex gap-[2px] h-8 items-end">
                {energyBlocks.map((block) => {
                  const height = Math.max(8, block.energy * 100);
                  const opacity = block.isPast ? 0.35 : 1;
                  const color = block.energy > 0.7
                    ? 'bg-emerald-400' : block.energy > 0.5
                    ? 'bg-blue-400' : block.energy > 0.3
                    ? 'bg-amber-400' : 'bg-rose-400';

                  return (
                    <motion.div
                      key={block.hour}
                      className="relative flex-1 group cursor-pointer"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.3, delay: block.hour * 0.02 }}
                      style={{ transformOrigin: 'bottom', opacity }}
                    >
                      <div
                        className={`rounded-sm ${color} ${block.isNow ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-transparent' : ''} transition-all hover:brightness-125`}
                        style={{ height: `${height}%`, minHeight: 4 }}
                      />

                      {/* Now indicator */}
                      {block.isNow && (
                        <motion.div
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}

                      {/* Event indicator dots */}
                      {block.hasEvent && (
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
                          <div className="w-1 h-1 rounded-full bg-cyan-400" />
                        </div>
                      )}

                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-white/10 rounded text-[10px] text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        {block.label} · {Math.round(block.energy * 100)}%
                        {block.eventTitle && ` · ${block.eventTitle}`}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Timeline labels */}
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-white/20 font-mono">7a</span>
                <span className="text-[9px] text-white/20 font-mono">12p</span>
                <span className="text-[9px] text-white/20 font-mono">5p</span>
                <span className="text-[9px] text-white/20 font-mono">10p</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ NEXUS PROACTIVE BRIEFING ════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="max-w-[1600px] mx-auto"
      >
        <NexusProactiveBriefing />
      </motion.section>

      {/* ═══ PRIORITIZED ACTIONS: "What should I do now?" ═══════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="max-w-[1600px] mx-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white/40 tracking-wide uppercase">
            Optimized for you right now
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/30 hover:text-white/60 text-xs"
            onClick={handleOptimizeWeek}
            disabled={isOptimizing}
          >
            <Sparkles className={`h-3 w-3 mr-1.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            {isOptimizing ? 'Optimizing...' : 'Optimize week'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {prioritizedActions.slice(0, 6).map((action, i) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              onClick={() => navigate('/tasks')}
              className="group relative text-left rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] p-4 transition-all hover:border-white/[0.12]"
            >
              {/* Resonance score bar */}
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${action.resonanceScore * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                />
              </div>

              <div className="flex items-start gap-3">
                {/* Energy match badge */}
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                  action.energyMatch === 'high' ? 'bg-emerald-500/10 text-emerald-400' :
                  action.energyMatch === 'medium' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>
                  {action.energyMatch === 'high' ? '⚡' : action.energyMatch === 'medium' ? '→' : '◐'}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">
                    {action.title}
                  </div>
                  {action.subtitle && (
                    <div className="text-xs text-white/30 mt-0.5 truncate">
                      {action.subtitle}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 h-4 border-0 ${
                        action.priority === 'urgent' ? 'bg-rose-500/15 text-rose-400' :
                        action.priority === 'high' ? 'bg-orange-500/15 text-orange-400' :
                        action.priority === 'medium' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-slate-500/15 text-slate-400'
                      }`}
                    >
                      {action.priority}
                    </Badge>
                    <span className="text-[9px] text-white/20 font-mono">
                      {Math.round(action.resonanceScore * 100)}% resonance
                    </span>
                  </div>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-white/0 group-hover:text-white/40 transition-colors shrink-0 mt-1" />
              </div>
            </motion.button>
          ))}

          {/* Add task card */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            onClick={() => navigate('/tasks')}
            className="group rounded-xl border border-dashed border-white/[0.08] hover:border-white/[0.15] bg-transparent hover:bg-white/[0.02] p-4 transition-all flex items-center justify-center gap-2 text-white/20 hover:text-white/40"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs font-medium">Add task</span>
          </motion.button>
        </div>
      </motion.section>

      {/* ═══ QUICK ACCESS ROW ══════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="max-w-[1600px] mx-auto"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAccessCard
            icon={Calendar}
            label="Calendar"
            value={`${(events || []).length} events`}
            onClick={() => navigate('/calendar')}
            accent="cyan"
          />
          <QuickAccessCard
            icon={CheckCircle2}
            label="Tasks"
            value={`${(tasks || []).filter(t => !t.completed).length} active`}
            onClick={() => navigate('/tasks')}
            accent="violet"
          />
          <QuickAccessCard
            icon={Activity}
            label="Resonance"
            value={`${Math.round(readinessPercent)}% aligned`}
            onClick={() => navigate('/resonance-engine')}
            accent="emerald"
          />
          <QuickAccessCard
            icon={MessageCircle}
            label="Nexus AI"
            value="Ask anything"
            onClick={() => navigate('/ai')}
            accent="indigo"
          />
        </div>
      </motion.section>
    </div>
  );
}

// ─── QuickAccessCard Sub-component ───────────────────────────────────

function QuickAccessCard({
  icon: Icon,
  label,
  value,
  onClick,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onClick: () => void;
  accent: 'cyan' | 'violet' | 'emerald' | 'indigo' | 'amber' | 'rose';
}) {
  const accentColors: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
  };

  const hoverColors: Record<string, string> = {
    cyan: 'hover:border-cyan-500/30',
    violet: 'hover:border-violet-500/30',
    emerald: 'hover:border-emerald-500/30',
    indigo: 'hover:border-indigo-500/30',
    amber: 'hover:border-amber-500/30',
    rose: 'hover:border-rose-500/30',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-xl border border-white/[0.06] ${hoverColors[accent]} bg-white/[0.02] hover:bg-white/[0.04] p-3 transition-all text-left`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accentColors[accent]} transition-colors`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-white/70 group-hover:text-white/90 transition-colors">{label}</div>
        <div className="text-[10px] text-white/30 font-mono mt-0.5">{value}</div>
      </div>
    </motion.button>
  );
}

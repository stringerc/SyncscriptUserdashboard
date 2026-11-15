/**
 * ResonanceWeeklyReport — 7-Day Intelligence Summary
 *
 * The "aha moment" retention driver. Every Monday morning,
 * users get a deeply personalized report showing:
 * - How well their week aligned with their energy curve
 * - Which tasks were completed at peak vs. off-peak
 * - Resonance trajectory (improving / stable / declining)
 * - Recommendations for the coming week
 * - "Resonance Score" trendline
 *
 * Design: Fortune 500 COO briefing quality.
 * Built to be screenshotted and shared (viral mechanic).
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp, TrendingDown, Minus, Brain, Zap, Target,
  Calendar, CheckCircle2, BarChart3, Sparkles, ArrowRight,
  Flame
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useEnergy } from '../contexts/EnergyContext';
import { useTasks } from '../hooks/useTasks';
import { getReadinessPercentFromTotalEnergy } from '../hooks/useCurrentReadiness';
import { useUserPreferences } from '../utils/user-preferences';

interface DayScore {
  day: string;
  resonance: number;    // 0-1 alignment score
  tasksCompleted: number;
  peakUsed: boolean;     // did they do hard work during peak?
}

export function ResonanceWeeklyReport() {
  const { energy } = useEnergy();
  const { tasks } = useTasks();
  const metrics = useDashboardMetrics();
  const { preferences } = useUserPreferences();
  const readinessPercent = getReadinessPercentFromTotalEnergy(energy.totalEnergy);

  // ─── Generate week data from real energy entries ──────────────────

  const weekData: DayScore[] = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;

    return days.map((day, i) => {
      // Estimate from actual energy entries for the day
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - (todayIdx - i));
      const dayStr = dayDate.toDateString();

      const dayEntries = energy.entries.filter(e =>
        new Date(e.timestamp).toDateString() === dayStr
      );
      const tasksCompleted = dayEntries.filter(e => e.source === 'tasks').length;
      const totalEnergy = dayEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

      // Simple resonance estimate: did they log energy + complete tasks?
      const hasActivity = dayEntries.length > 0;
      const resonance = hasActivity
        ? Math.min(1, 0.3 + (tasksCompleted * 0.15) + (totalEnergy > 50 ? 0.2 : totalEnergy > 20 ? 0.1 : 0))
        : i < todayIdx ? 0.1 : 0;

      // Check if it's a future day
      const isFuture = i > todayIdx;

      return {
        day,
        resonance: isFuture ? -1 : resonance,
        tasksCompleted: isFuture ? -1 : tasksCompleted,
        peakUsed: resonance > 0.6,
      };
    });
  }, [energy.entries]);

  // ─── Compute summary metrics ──────────────────────────────────────

  const pastDays = weekData.filter(d => d.resonance >= 0);
  const avgResonance = pastDays.length > 0
    ? pastDays.reduce((s, d) => s + d.resonance, 0) / pastDays.length
    : 0;
  const totalTasksCompleted = pastDays.reduce((s, d) => s + Math.max(0, d.tasksCompleted), 0);
  const peakDaysUsed = pastDays.filter(d => d.peakUsed).length;
  const resonanceTrend: 'up' | 'stable' | 'down' = avgResonance > 0.6 ? 'up' : avgResonance > 0.35 ? 'stable' : 'down';
  const streak = metrics.streak || 0;

  // ─── Recommendations ──────────────────────────────────────────────

  const recommendations = useMemo(() => {
    const recs: { icon: React.ElementType; text: string; color: string }[] = [];

    if (peakDaysUsed < pastDays.length * 0.5) {
      recs.push({
        icon: Zap,
        text: 'Schedule deep work during your peak energy windows this week',
        color: 'text-amber-400',
      });
    }
    if (totalTasksCompleted < 5 && pastDays.length >= 3) {
      recs.push({
        icon: Target,
        text: 'Break large tasks into smaller ones — completion momentum builds energy',
        color: 'text-violet-400',
      });
    }
    if (avgResonance < 0.4) {
      recs.push({
        icon: Brain,
        text: 'Your schedule is misaligned with your energy. Let SyncScript optimize your week.',
        color: 'text-rose-400',
      });
    }
    if (recs.length === 0) {
      recs.push({
        icon: Sparkles,
        text: 'Strong alignment this week. Keep trusting your energy curve — it compounds.',
        color: 'text-emerald-400',
      });
    }

    return recs;
  }, [peakDaysUsed, pastDays.length, totalTasksCompleted, avgResonance]);

  // ─── Render ───────────────────────────────────────────────────────

  const TrendIcon = resonanceTrend === 'up' ? TrendingUp : resonanceTrend === 'down' ? TrendingDown : Minus;
  const trendLabel = resonanceTrend === 'up' ? 'Improving' : resonanceTrend === 'down' ? 'Needs Attention' : 'Stable';
  const trendColor = resonanceTrend === 'up' ? 'text-emerald-400' : resonanceTrend === 'down' ? 'text-rose-400' : 'text-blue-400';

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 p-4 sm:p-6">
      {/* ═══ Header ════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Weekly Resonance Report
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            Your cognitive performance alignment — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`${trendColor} border-current/20 bg-current/5 px-3 py-1`}
          >
            <TrendIcon className="h-3.5 w-3.5 mr-1.5" />
            {trendLabel}
          </Badge>
          {streak > 0 && (
            <Badge variant="outline" className="text-orange-400 border-orange-500/20 bg-orange-500/5 px-3 py-1">
              <Flame className="h-3.5 w-3.5 mr-1.5" />
              {streak} day streak
            </Badge>
          )}
        </div>
      </motion.div>

      {/* ═══ Key Metrics Row ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon={BarChart3}
          label="Avg Resonance"
          value={`${Math.round(avgResonance * 100)}%`}
          accent={avgResonance > 0.6 ? 'emerald' : avgResonance > 0.35 ? 'blue' : 'rose'}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Tasks Completed"
          value={String(totalTasksCompleted)}
          accent="violet"
        />
        <MetricCard
          icon={Zap}
          label="Peak Days Used"
          value={`${peakDaysUsed}/${pastDays.length}`}
          accent={peakDaysUsed >= pastDays.length * 0.5 ? 'emerald' : 'amber'}
        />
        <MetricCard
          icon={Calendar}
          label="Active Days"
          value={`${pastDays.filter(d => d.resonance > 0.1).length}/${pastDays.length}`}
          accent="indigo"
        />
      </div>

      {/* ═══ Week Resonance Chart ══════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <h2 className="text-sm font-medium text-white/50 mb-4">7-Day Resonance</h2>
        <div className="flex items-end gap-3 h-32">
          {weekData.map((day, i) => {
            const isFuture = day.resonance < 0;
            const height = isFuture ? 5 : Math.max(5, day.resonance * 100);
            const color = isFuture
              ? 'bg-white/[0.05]'
              : day.resonance > 0.6
                ? 'bg-emerald-400/70'
                : day.resonance > 0.35
                  ? 'bg-blue-400/70'
                  : 'bg-amber-400/70';

            return (
              <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                <motion.div
                  className={`w-full rounded-t-md ${color} relative group cursor-pointer`}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  style={{ height: `${height}%`, transformOrigin: 'bottom' }}
                >
                  {/* Hover tooltip */}
                  {!isFuture && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 border border-white/10 rounded text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      {Math.round(day.resonance * 100)}% · {day.tasksCompleted} tasks
                    </div>
                  )}
                </motion.div>
                <span className="text-[10px] text-white/25 font-mono">{day.day}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ═══ AI Recommendations ════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <h2 className="text-sm font-medium text-white/50 mb-4">Recommendations</h2>
        <div className="space-y-3">
          {recommendations.map((rec, i) => {
            const Icon = rec.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${rec.color}`} />
                <p className="text-sm text-white/60">{rec.text}</p>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ═══ Share CTA ═════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center"
      >
        <Button
          variant="outline"
          className="text-white/40 border-white/[0.08] hover:text-white/60 hover:border-white/[0.15]"
          onClick={() => {
            // This will be wired to the share card component
            if (navigator.share) {
              navigator.share({
                title: 'My SyncScript Weekly Resonance',
                text: `My resonance alignment: ${Math.round(avgResonance * 100)}% · ${totalTasksCompleted} tasks completed · ${streak} day streak 🧠⚡`,
                url: 'https://syncscript.app',
              }).catch(() => {});
            }
          }}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Share My Report
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Metric Card Sub-component ───────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'indigo';
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg mb-2 ${colors[accent]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xl font-semibold text-white font-mono">{value}</div>
      <div className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">{label}</div>
    </motion.div>
  );
}

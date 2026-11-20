/**
 * NexusProactiveBriefing — AI-Generated Daily Intelligence
 *
 * The component that makes Nexus feel ALIVE.
 * Every time the user opens the dashboard, Nexus has already
 * prepared a briefing based on their energy, schedule, and tasks.
 *
 * This is what separates SyncScript from every "chat with AI" product:
 * Nexus doesn't wait for you to ask — it tells you what you need to know.
 *
 * Design:
 * - Glassmorphism card with gradient border
 * - One-sentence summary (the "headline")
 * - 3 actionable insights (drill-in to act)
 * - Voice playback button (Nexus reads it to you)
 * - "Ask Nexus" follow-up input
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useBriefingSpeech } from '../hooks/useBriefingSpeech';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain, Mic, Volume2, ArrowRight, Sparkles, Zap,
  Calendar, CheckCircle2, Clock, MessageSquare
} from 'lucide-react';
import { Button } from './ui/button';
import { useEnergy } from '../contexts/EnergyContext';
import { useTasks } from '../hooks/useTasks';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useUserPreferences } from '../utils/user-preferences';
import { getReadinessPercentFromTotalEnergy } from '../hooks/useCurrentReadiness';
import { getPersonalizedCircadianCurve } from '../utils/resonance-calculus';

interface BriefingInsight {
  icon: React.ElementType;
  headline: string;
  detail: string;
  action: string;
  actionPath: string;
  urgency: 'high' | 'medium' | 'low';
}

export function NexusProactiveBriefing() {
  const navigate = useNavigate();
  const { energy } = useEnergy();
  const { tasks } = useTasks();
  const { events } = useCalendarEvents();
  const metrics = useDashboardMetrics();
  const { preferences } = useUserPreferences();
  const [isExpanded, setIsExpanded] = useState(false);

  const chronotype = useMemo<'morning' | 'evening' | 'neutral'>(() => {
    if (preferences.peakEnergyTime === 'morning') return 'morning';
    if (preferences.peakEnergyTime === 'evening' || preferences.peakEnergyTime === 'night') return 'evening';
    return 'neutral';
  }, [preferences.peakEnergyTime]);

  const currentHour = new Date().getHours();
  const energyNow = getPersonalizedCircadianCurve(currentHour, chronotype);
  const readiness = getReadinessPercentFromTotalEnergy(energy.totalEnergy);
  const activeTasks = (tasks || []).filter(t => !t.completed);
  const urgentTasks = activeTasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const todayEvents = (events || []).filter(e => {
    const start = new Date(e.startTime);
    const now = new Date();
    return start.toDateString() === now.toDateString();
  });

  // ─── Generate briefing insights ───────────────────────────────────

  const insights: BriefingInsight[] = useMemo(() => {
    const result: BriefingInsight[] = [];

    // Insight 1: Energy window
    if (energyNow > 0.7) {
      result.push({
        icon: Zap,
        headline: 'Peak focus window active',
        detail: `Your energy is at ${Math.round(energyNow * 100)}% right now. This is your best cognitive window today.`,
        action: 'Focus on deep work',
        actionPath: '/tasks',
        urgency: 'high',
      });
    } else if (energyNow > 0.4) {
      result.push({
        icon: Clock,
        headline: 'Active energy period',
        detail: `${Math.round(energyNow * 100)}% energy — good for meetings and structured tasks.`,
        action: 'View prioritized tasks',
        actionPath: '/tasks',
        urgency: 'medium',
      });
    } else {
      result.push({
        icon: Clock,
        headline: 'Energy is recovering',
        detail: `At ${Math.round(energyNow * 100)}%, save deep work for later. Consider lighter tasks or a break.`,
        action: 'See what can wait',
        actionPath: '/tasks',
        urgency: 'medium',
      });
    }

    // Insight 2: Urgent tasks
    if (urgentTasks.length > 0) {
      result.push({
        icon: CheckCircle2,
        headline: `${urgentTasks.length} high-priority task${urgentTasks.length > 1 ? 's' : ''} pending`,
        detail: urgentTasks[0]?.title
          ? `"${urgentTasks[0].title}" is ${urgentTasks[0].priority === 'urgent' ? 'urgent' : 'high priority'}.`
          : 'These need attention today.',
        action: 'Tackle now',
        actionPath: '/tasks',
        urgency: 'high',
      });
    }

    // Insight 3: Calendar awareness
    if (todayEvents.length > 0) {
      const nextEvent = todayEvents.find(e => new Date(e.startTime) > new Date());
      if (nextEvent) {
        const minutesUntil = Math.round((new Date(nextEvent.startTime).getTime() - Date.now()) / 60000);
        result.push({
          icon: Calendar,
          headline: minutesUntil < 30 ? 'Meeting in moments' : `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m until next meeting`,
          detail: `"${nextEvent.title}" at ${new Date(nextEvent.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
          action: 'View calendar',
          actionPath: '/calendar',
          urgency: minutesUntil < 30 ? 'high' : 'low',
        });
      }
    } else {
      result.push({
        icon: Calendar,
        headline: 'No meetings today',
        detail: 'Your calendar is clear — great opportunity for focused deep work blocks.',
        action: 'Block focus time',
        actionPath: '/calendar',
        urgency: 'low',
      });
    }

    return result.slice(0, 3);
  }, [energyNow, urgentTasks, todayEvents]);

  // ─── Headline sentence ─────────────────────────────────────────────

  const headline = useMemo(() => {
    const name = ''; // Could pull from user context
    const energyPct = Math.round(energyNow * 100);
    const taskCount = activeTasks.length;

    if (energyNow > 0.7 && urgentTasks.length > 0) {
      return `Peak energy (${energyPct}%) with ${urgentTasks.length} priority task${urgentTasks.length > 1 ? 's' : ''} — tackle the hardest one now.`;
    }
    if (energyNow > 0.7) {
      return `Peak focus window — ${energyPct}% energy. This is your shot at deep work.`;
    }
    if (urgentTasks.length > 0 && todayEvents.length > 2) {
      return `Busy day ahead: ${urgentTasks.length} priorities + ${todayEvents.length} meetings. Let Nexus optimize your sequence.`;
    }
    if (taskCount === 0) {
      return 'Clear deck — no active tasks. Consider planning your week or setting new goals.';
    }
    return `${energyPct}% energy, ${taskCount} tasks, ${todayEvents.length} meetings today. Nexus has your sequencing ready.`;
  }, [energyNow, urgentTasks.length, activeTasks.length, todayEvents.length]);

  // ─── TTS playback ──────────────────────────────────────────────────

  const briefText = `${headline} ${insights.map(i => i.headline).join('. ')}`;
  const { speaking: isSpeaking, toggle: handleSpeak } = useBriefingSpeech(briefText, { pitch: 0.95 });

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-indigo-500/[0.04] backdrop-blur-sm overflow-hidden"
    >
      {/* Gradient accent bar */}
      <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-transparent" />

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
              <Brain className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Nexus Briefing
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/30 hover:text-white/60"
              onClick={handleSpeak}
            >
              <Volume2 className={`h-3 w-3 ${isSpeaking ? 'text-violet-400' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/30 hover:text-white/60"
              onClick={() => navigate('/ai')}
            >
              <Mic className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Headline */}
        <p className="text-sm text-white/80 font-medium leading-relaxed mb-3">
          {headline}
        </p>

        {/* Insights */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 mb-3">
                {insights.map((insight, i) => {
                  const Icon = insight.icon;
                  return (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(insight.actionPath)}
                      className="w-full flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] transition-all text-left group"
                    >
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                        insight.urgency === 'high' ? 'text-rose-400' :
                        insight.urgency === 'medium' ? 'text-amber-400' :
                        'text-white/30'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white/70 group-hover:text-white/90 transition-colors">
                          {insight.headline}
                        </div>
                        <div className="text-[11px] text-white/30 mt-0.5">
                          {insight.detail}
                        </div>
                      </div>
                      <ArrowRight className="h-3 w-3 text-white/0 group-hover:text-white/30 transition-colors shrink-0 mt-0.5" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-violet-400/60 hover:text-violet-400 transition-colors"
          >
            {isExpanded ? 'Collapse' : `${insights.length} insights ▸`}
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] text-white/20 hover:text-white/50"
            onClick={() => navigate('/ai')}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Ask Nexus
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

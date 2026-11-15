/**
 * ResonanceShareCard — Viral Week-In-Resonance Shareable
 *
 * The growth engine. Users share their resonance alignment
 * score on social media, driving organic signups.
 *
 * Design:
 * - Compact card (1200x630 for OG image, 400x500 for in-app display)
 * - Beautiful gradient background
 * - Key resonance metrics visualized
 * - SyncScript branding subtle but present
 * - "Get your score at syncscript.app" CTA
 */

import { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Zap, Flame, Target, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useEnergy } from '../contexts/EnergyContext';
import { useTasks } from '../hooks/useTasks';
import { getReadinessPercentFromTotalEnergy } from '../hooks/useCurrentReadiness';

export function ResonanceShareCard() {
  const { energy } = useEnergy();
  const { tasks } = useTasks();
  const metrics = useDashboardMetrics();
  const readiness = getReadinessPercentFromTotalEnergy(energy.totalEnergy);
  const streak = metrics.streak || 0;
  const completedToday = tasks?.filter(t => t.completed).length || 0;
  const cardRef = useRef<HTMLDivElement>(null);

  const resonanceGrade = useMemo(() => {
    if (readiness > 85) return { grade: 'S', color: 'from-emerald-400 to-cyan-400', label: 'Legendary' };
    if (readiness > 70) return { grade: 'A', color: 'from-blue-400 to-violet-400', label: 'Excellent' };
    if (readiness > 55) return { grade: 'B', color: 'from-amber-400 to-orange-400', label: 'Good' };
    if (readiness > 40) return { grade: 'C', color: 'from-rose-400 to-pink-400', label: 'Developing' };
    return { grade: 'D', color: 'from-slate-400 to-slate-500', label: 'Emerging' };
  }, [readiness]);

  const handleShare = async () => {
    const text = `My Resonance Score: ${Math.round(readiness)}% (Grade ${resonanceGrade.grade}) 🔥\n${streak} day streak · ${completedToday} tasks completed today\n\nGet yours at syncscript.app`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My SyncScript Resonance Score',
          text,
          url: 'https://syncscript.app',
        });
      } catch { /* user cancelled */ }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="space-y-4">
      {/* The Share Card */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] mx-auto"
        style={{ maxWidth: 400 }}
      >
        {/* Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${resonanceGrade.color} opacity-15`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="relative z-10 p-6 pb-8">
          {/* Top label */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-white/40" />
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium">
                Resonance Score
              </span>
            </div>
            <span className="text-[9px] text-white/20 font-mono">syncscript.app</span>
          </div>

          {/* Big grade + score */}
          <div className="text-center mb-6">
            <motion.div
              className={`inline-flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${resonanceGrade.color} shadow-lg`}
              style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <span className="text-5xl font-bold text-white drop-shadow-lg">
                {resonanceGrade.grade}
              </span>
            </motion.div>
            <div className="mt-3">
              <div className="text-3xl font-bold text-white font-mono">
                {Math.round(readiness)}%
              </div>
              <div className="text-xs text-white/40 mt-0.5">
                {resonanceGrade.label} Alignment
              </div>
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center">
              <Flame className="h-4 w-4 text-orange-400 mx-auto mb-1" />
              <div className="text-sm font-semibold text-white font-mono">{streak}</div>
              <div className="text-[9px] text-white/25 uppercase tracking-wider">Streak</div>
            </div>
            <div className="text-center">
              <Zap className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-sm font-semibold text-white font-mono">{completedToday}</div>
              <div className="text-[9px] text-white/25 uppercase tracking-wider">Done Today</div>
            </div>
            <div className="text-center">
              <Target className="h-4 w-4 text-violet-400 mx-auto mb-1" />
              <div className="text-sm font-semibold text-white font-mono">{tasks?.filter(t => !t.completed).length || 0}</div>
              <div className="text-[9px] text-white/25 uppercase tracking-wider">Active</div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-[11px] text-white/30">
              Know your cognitive rhythm → syncscript.app
            </p>
          </div>
        </div>
      </motion.div>

      {/* Share button */}
      <div className="flex justify-center">
        <Button
          onClick={handleShare}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-violet-500/20"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Share My Score
        </Button>
      </div>
    </div>
  );
}

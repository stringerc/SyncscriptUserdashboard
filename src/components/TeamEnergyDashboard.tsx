/**
 * TeamEnergyDashboard — Collective Resonance View
 *
 * Shows the energy alignment of an entire team.
 * Enables "resonance-aware collaboration": schedule meetings
 * when the team's collective energy is highest.
 *
 * This is the Enterprise wedge — teams can see when the
 * WHOLE team is in sync vs. fragmented.
 *
 * Design:
 * - Team energy heatmap (each member's curve overlaid)
 * - Collective peak window indicator
 * - "Best meeting times" recommendation
 * - Individual member energy cards
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Users, Zap, Clock, Calendar, TrendingUp,
  Brain, ArrowRight, AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

// ─── Mock team data (real integration would pull from team context) ──

interface TeamMemberEnergy {
  name: string;
  chronotype: 'morning' | 'evening' | 'neutral';
  currentEnergy: number; // 0-1
  avatar: string; // initials
  status: 'peak' | 'active' | 'moderate' | 'low';
}

const TEAM_MEMBERS: TeamMemberEnergy[] = [
  { name: 'You', chronotype: 'neutral', currentEnergy: 0.82, avatar: 'CS', status: 'peak' },
  { name: 'Sarah Kim', chronotype: 'morning', currentEnergy: 0.45, avatar: 'SK', status: 'moderate' },
  { name: 'Alex Rivera', chronotype: 'neutral', currentEnergy: 0.71, avatar: 'AR', status: 'active' },
  { name: 'Jordan Lee', chronotype: 'evening', currentEnergy: 0.28, avatar: 'JL', status: 'low' },
  { name: 'Morgan Chen', chronotype: 'morning', currentEnergy: 0.62, avatar: 'MC', status: 'active' },
];

export function TeamEnergyDashboard() {
  const currentHour = new Date().getHours();

  // ─── Compute collective peak ──────────────────────────────────────

  const collectivePeak = useMemo(() => {
    // Find hours where majority of team is above 0.5 energy
    const peakHours: number[] = [];
    for (let h = 7; h <= 21; h++) {
      let aboveThreshold = 0;
      TEAM_MEMBERS.forEach(m => {
        // Approximate: morning types peak 7-10, evening 16-20, neutral 9-14
        let energy = 0.5;
        if (m.chronotype === 'morning') {
          energy = (h >= 7 && h <= 10) ? 0.9 : (h >= 11 && h <= 14) ? 0.6 : 0.3;
        } else if (m.chronotype === 'evening') {
          energy = (h >= 16 && h <= 20) ? 0.9 : (h >= 11 && h <= 15) ? 0.6 : 0.3;
        } else {
          energy = (h >= 9 && h <= 14) ? 0.85 : (h >= 15 && h <= 17) ? 0.5 : 0.3;
        }
        if (energy > 0.5) aboveThreshold++;
      });
      if (aboveThreshold >= Math.ceil(TEAM_MEMBERS.length * 0.6)) {
        peakHours.push(h);
      }
    }
    return peakHours;
  }, []);

  const bestMeetingWindows = useMemo(() => {
    if (collectivePeak.length === 0) return [];
    // Group consecutive hours into windows
    const windows: { start: number; end: number }[] = [];
    let windowStart = collectivePeak[0];
    let windowEnd = collectivePeak[0];

    for (let i = 1; i < collectivePeak.length; i++) {
      if (collectivePeak[i] === windowEnd + 1) {
        windowEnd = collectivePeak[i];
      } else {
        windows.push({ start: windowStart, end: windowEnd });
        windowStart = collectivePeak[i];
        windowEnd = collectivePeak[i];
      }
    }
    windows.push({ start: windowStart, end: windowEnd });
    return windows;
  }, [collectivePeak]);

  const teamAvgEnergy = TEAM_MEMBERS.reduce((s, m) => s + m.currentEnergy, 0) / TEAM_MEMBERS.length;
  const peakMembers = TEAM_MEMBERS.filter(m => m.status === 'peak' || m.status === 'active').length;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Team Energy
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            Collective resonance alignment for smart collaboration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/20 bg-emerald-500/5 px-3 py-1">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            {peakMembers}/{TEAM_MEMBERS.length} in sync
          </Badge>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <Zap className="h-5 w-5 text-emerald-400 mb-2" />
          <div className="text-xl font-semibold text-white font-mono">
            {Math.round(teamAvgEnergy * 100)}%
          </div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Team Avg Energy</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <Users className="h-5 w-5 text-violet-400 mb-2" />
          <div className="text-xl font-semibold text-white font-mono">
            {peakMembers}
          </div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Members Active</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <Calendar className="h-5 w-5 text-blue-400 mb-2" />
          <div className="text-xl font-semibold text-white font-mono">
            {bestMeetingWindows.length}
          </div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Peak Windows</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <TrendingUp className="h-5 w-5 text-amber-400 mb-2" />
          <div className="text-xl font-semibold text-white font-mono">
            {bestMeetingWindows[0] ? `${formatHour(bestMeetingWindows[0].start)}` : 'N/A'}
          </div>
          <div className="text-[10px] text-white/30 uppercase tracking-wider">Best Meeting Time</div>
        </div>
      </div>

      {/* Team members */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium text-white/50 mb-4">Member Energy Levels</h2>
        <div className="space-y-3">
          {TEAM_MEMBERS.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
            >
              {/* Avatar */}
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                member.status === 'peak' ? 'bg-emerald-500/20 text-emerald-400' :
                member.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                member.status === 'moderate' ? 'bg-amber-500/20 text-amber-400' :
                'bg-rose-500/10 text-rose-400'
              }`}>
                {member.avatar}
              </div>

              {/* Name + chronotype */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/80 font-medium">{member.name}</div>
                <div className="text-[10px] text-white/30 capitalize">{member.chronotype} type</div>
              </div>

              {/* Energy bar */}
              <div className="w-24 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    member.currentEnergy > 0.7 ? 'bg-emerald-400' :
                    member.currentEnergy > 0.5 ? 'bg-blue-400' :
                    member.currentEnergy > 0.3 ? 'bg-amber-400' :
                    'bg-rose-400'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${member.currentEnergy * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                />
              </div>

              {/* Status label */}
              <span className={`text-[10px] font-medium uppercase tracking-wider w-16 text-right ${
                member.status === 'peak' ? 'text-emerald-400' :
                member.status === 'active' ? 'text-blue-400' :
                member.status === 'moderate' ? 'text-amber-400' :
                'text-rose-400/60'
              }`}>
                {member.status === 'peak' ? 'Peak' :
                 member.status === 'active' ? 'Active' :
                 member.status === 'moderate' ? 'Moderate' : 'Low'}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Best meeting windows */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium text-white/50 mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-400" />
          Recommended Meeting Windows
        </h2>
        {bestMeetingWindows.length > 0 ? (
          <div className="space-y-2">
            {bestMeetingWindows.map((window, i) => {
              const duration = window.end - window.start + 1;
              const isNow = currentHour >= window.start && currentHour <= window.end;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    isNow
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-white/[0.04] bg-white/[0.02]'
                  }`}
                >
                  <Clock className={`h-4 w-4 ${isNow ? 'text-emerald-400' : 'text-white/30'}`} />
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${isNow ? 'text-emerald-300' : 'text-white/70'}`}>
                      {formatHour(window.start)} — {formatHour(window.end + 1)}
                    </span>
                    <span className="text-xs text-white/30 ml-2">
                      ({duration}hr window)
                    </span>
                  </div>
                  {isNow && (
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/20 text-[9px]">
                      Now
                    </Badge>
                  )}
                  {i === 0 && !isNow && (
                    <Badge variant="outline" className="text-violet-400 border-violet-500/20 text-[9px]">
                      Optimal
                    </Badge>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/10 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-amber-200/60">No overlapping peak windows today — consider async collaboration.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

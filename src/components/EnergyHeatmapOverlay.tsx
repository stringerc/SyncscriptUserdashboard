/**
 * EnergyHeatmapOverlay — Calendar energy visualization
 *
 * Renders a color-coded energy heatmap that overlays on the calendar,
 * showing which time blocks align with high/medium/low energy periods.
 *
 * This is the SIGNATURE visual element of SyncScript — the one feature
 * that makes our calendar instantly recognizable vs. every other calendar app
 * that treats 9 AM the same as 2 PM.
 *
 * Design:
 * - Color gradient: emerald (high) → blue (medium) → amber (moderate) → rose (low)
 * - Semi-transparent so calendar events show through
 * - Tooltip on hover showing energy % and recommendation
 * - "Now" indicator line
 * - Integration with getPersonalizedCircadianCurve
 */

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { getPersonalizedCircadianCurve } from '../utils/resonance-calculus';
import { useUserPreferences } from '../utils/user-preferences';

interface EnergyHeatmapOverlayProps {
  /** Start hour (default 7 = 7 AM) */
  startHour?: number;
  /** End hour (default 22 = 10 PM) */
  endHour?: number;
  /** Height in px per hour row (default 60) */
  hourHeight?: number;
  /** Whether to show hour labels on the left */
  showLabels?: boolean;
  /** Whether to show the "now" indicator */
  showNowLine?: boolean;
}

export function EnergyHeatmapOverlay({
  startHour = 7,
  endHour = 22,
  hourHeight = 60,
  showLabels = true,
  showNowLine = true,
}: EnergyHeatmapOverlayProps) {
  const { preferences } = useUserPreferences();

  const chronotype = useMemo<'morning' | 'evening' | 'neutral'>(() => {
    if (preferences.peakEnergyTime === 'morning') return 'morning';
    if (preferences.peakEnergyTime === 'evening' || preferences.peakEnergyTime === 'night') return 'evening';
    return 'neutral';
  }, [preferences.peakEnergyTime]);

  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const energyMap = useMemo(() => {
    return hours.map(hour => ({
      hour,
      energy: getPersonalizedCircadianCurve(hour, chronotype),
    }));
  }, [hours, chronotype]);

  // Color from energy level
  const getColor = (energy: number) => {
    if (energy > 0.75) return 'rgba(16, 185, 129, 0.08)';   // emerald-500 at 8%
    if (energy > 0.55) return 'rgba(59, 130, 246, 0.06)';   // blue-500 at 6%
    if (energy > 0.35) return 'rgba(245, 158, 11, 0.06)';   // amber-500 at 6%
    return 'rgba(244, 63, 94, 0.05)';                        // rose-500 at 5%
  };

  const getLabel = (energy: number): string => {
    if (energy > 0.75) return 'Peak — best for deep work';
    if (energy > 0.55) return 'Active — good for meetings & tasks';
    if (energy > 0.35) return 'Moderate — save for lighter work';
    return 'Low — consider breaks, admin, or rest';
  };

  const getGradient = (energy: number): string => {
    if (energy > 0.75) return 'from-emerald-500/10 to-emerald-500/5';
    if (energy > 0.55) return 'from-blue-500/10 to-blue-500/5';
    if (energy > 0.35) return 'from-amber-500/10 to-amber-500/5';
    return 'from-rose-500/8 to-rose-500/4';
  };

  const nowOffset = showNowLine && currentHour >= startHour && currentHour < endHour
    ? (currentHour - startHour) * hourHeight + (currentMinute / 60) * hourHeight
    : null;

  return (
    <div className="relative" style={{ height: hours.length * hourHeight }}>
      {energyMap.map(({ hour, energy }, i) => {
        const isNow = hour === currentHour;
        const isPast = hour < currentHour;

        return (
          <motion.div
            key={hour}
            className="absolute left-0 right-0 group"
            style={{
              top: i * hourHeight,
              height: hourHeight,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isPast ? 0.4 : 1 }}
            transition={{ duration: 0.3, delay: i * 0.02 }}
          >
            {/* Energy color fill */}
            <div
              className={`absolute inset-0 bg-gradient-to-r ${getGradient(energy)} ${isNow ? 'border-l-2 border-l-white/30' : 'border-l border-l-white/[0.04]'}`}
            />

            {/* Hour label */}
            {showLabels && (
              <div className="absolute left-2 top-0.5 text-[9px] font-mono text-white/20">
                {formatHour(hour)}
              </div>
            )}

            {/* Energy indicator dot on left edge */}
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r ${
                energy > 0.75 ? 'bg-emerald-400' :
                energy > 0.55 ? 'bg-blue-400' :
                energy > 0.35 ? 'bg-amber-400' :
                'bg-rose-400'
              } ${isNow ? 'opacity-100' : 'opacity-40'}`}
            />

            {/* Hover tooltip */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-40">
              <div className="px-2 py-1 bg-black/90 border border-white/10 rounded-md text-[10px] text-white/80 whitespace-nowrap">
                <span className="font-medium">{formatHour(hour)}</span>
                {' · '}
                <span className={`${
                  energy > 0.75 ? 'text-emerald-400' :
                  energy > 0.55 ? 'text-blue-400' :
                  energy > 0.35 ? 'text-amber-400' :
                  'text-rose-400'
                }`}>
                  {Math.round(energy * 100)}%
                </span>
                {' · '}
                <span className="text-white/50">{getLabel(energy)}</span>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Now indicator line */}
      {nowOffset !== null && (
        <motion.div
          className="absolute left-0 right-0 h-[2px] bg-white/60 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ top: nowOffset }}
        >
          {/* Now dot */}
          <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-white shadow-lg shadow-white/30" />
          <span className="absolute left-3 -top-[10px] text-[9px] font-mono text-white/60 bg-black/60 px-1 rounded">
            now
          </span>
        </motion.div>
      )}
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

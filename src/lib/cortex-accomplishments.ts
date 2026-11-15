/**
 * Cortex Accomplishment Ledger & Circadian Trajectory Engine
 * 
 * Tracks real-time operational check-offs during the day (e.g. email inbox purge,
 * web app scaffolding, test suite verifications, tab reclamation) and synthesizes
 * the Morning Trajectory Brief connecting yesterday's wins to today's high-leverage focus.
 */

export type AccomplishmentCategory = 'productivity' | 'engineering' | 'system' | 'strategy';

export interface AccomplishmentItem {
  id: string;
  timestamp: number;
  title: string;
  impact: string;
  category: AccomplishmentCategory;
  source: 'automated_tool' | 'user_directive' | 'dream_consolidation';
  verified: boolean;
}

export interface DailyAccomplishmentRecord {
  date: string; // YYYY-MM-DD
  items: AccomplishmentItem[];
  velocityScore: number;
  momentumSummary: string;
  trajectoryFocus: string;
}

export interface EnergyTimeBlock {
  time: string;
  label: string;
  energyBand: 'peak' | 'moderate' | 'recovery';
  recommendedActivity: string;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns yesterday's date formatted as YYYY-MM-DD in local time
 */
export function getYesterdayDateString(d: Date = new Date()): string {
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  return getTodayDateString(prev);
}

/**
 * Factory for creating verified accomplishment records
 */
export function createAccomplishmentItem(input: {
  title: string;
  impact?: string;
  category?: AccomplishmentCategory;
  source?: AccomplishmentItem['source'];
  verified?: boolean;
}): AccomplishmentItem {
  return {
    id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    title: input.title.trim(),
    impact: (input.impact || 'Completed host operation successfully.').trim(),
    category: input.category || 'productivity',
    source: input.source || 'automated_tool',
    verified: input.verified !== false,
  };
}

/**
 * Default circadian energy schedule for SyncScript high-leverage alignment
 */
export const DEFAULT_ENERGY_SCHEDULE: EnergyTimeBlock[] = [
  {
    time: '09:00 - 11:30',
    label: 'Peak Focus Band',
    energyBand: 'peak',
    recommendedActivity: 'Deep Architecture & Critical Engineering Sprint',
  },
  {
    time: '13:00 - 14:00',
    label: 'Post-Prandial Dip',
    energyBand: 'recovery',
    recommendedActivity: 'Low-Friction Inbox & Receipt Archiving Triage',
  },
  {
    time: '15:00 - 16:30',
    label: 'Second Energy Peak',
    energyBand: 'moderate',
    recommendedActivity: 'Roadmap Planning, Canvas Scaffolding & Strategic Review',
  },
];

/**
 * Synthesizes the full Morning Trajectory Brief text
 */
export function formatMorningTrajectoryBrief(params: {
  yesterdayDate: string;
  yesterdayItems: AccomplishmentItem[];
  todayDate: string;
  todayItems?: AccomplishmentItem[];
  velocitySummary?: string;
  trajectoryFocus?: string;
  energySchedule?: EnergyTimeBlock[];
}): string {
  const dateFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const items = params.yesterdayItems || [];
  const accomplishedList = items.length > 0
    ? items.map(it => `• ✔ **${it.title}**${it.impact ? ` — _${it.impact}_` : ''}`).join('\n')
    : '• ✔ Maintained steady epistemic focus & verified host operational baseline.';

  const velocityText = params.velocitySummary
    || (items.length >= 3
      ? `High velocity detected (${items.length} critical operations completed yesterday). All technical and cognitive overhead from prior backlogs has been neutralized.`
      : 'Operational momentum is positive. Friction points have been cleared to make room for deep execution.');

  const trajectoryText = params.trajectoryFocus
    || 'Consolidate today’s primary engineering vectors, execute Phase 2 inbox optimization during low-energy windows, and maintain uninterrupted peak deep work.';

  const schedule = params.energySchedule || DEFAULT_ENERGY_SCHEDULE;
  const scheduleList = schedule
    .map(b => `• **${b.time}** (${b.label}): ${b.recommendedActivity}`)
    .join('\n');

  return `🌅 **CORTEX MORNING BRIEF — ${dateFormatted}**

🏆 **What We Accomplished Yesterday:**
${accomplishedList}

📈 **Cumulative Velocity & Trajectory:**
${velocityText}
${trajectoryText}

⚡ **Today's Energy-Aligned Blueprint:**
${scheduleList}

_Ready when you are. Reply "flight check" or ask me anything to coordinate today's mission._`;
}

/**
 * Formats accomplishments into a clean markdown snippet for MEMORY.md updates
 */
export function formatAccomplishmentsForMemoryMd(dateStr: string, items: AccomplishmentItem[]): string {
  if (!items || items.length === 0) return '';
  const lines = items.map(it => `  - [x] ${it.title} (${it.category}): ${it.impact}`);
  return `### Operational Accomplishments (${dateStr}):\n${lines.join('\n')}\n`;
}


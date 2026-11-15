/**
 * EnergySchedulingGuidePage — SEO + Content Engine
 *
 * The top-of-funnel content page that ranks for
 * "energy aware scheduling" / "best time to do deep work"
 * / "circadian rhythm productivity" queries.
 *
 * This is pure content marketing that drives organic traffic
 * and positions SyncScript as the THOUGHT LEADER in
 * energy-aware productivity.
 */

import { motion } from 'motion/react';
import {
  Zap, Brain, Clock, Sun, Moon, Coffee,
  Calendar, TrendingUp, ArrowRight, CheckCircle2,
  Flame
} from 'lucide-react';
import { Button } from './ui/button';

const SECTIONS = [
  {
    title: 'Why Your Calendar Is Lying to You',
    content: `Every calendar app treats 9 AM and 2 PM as identical time slots. But cognitive science proves they're not. Your circadian rhythm — the 24-hour internal clock governed by the suprachiasmatic nucleus — creates 40-60% variation in cognitive capacity throughout the day. The Two-Process Model (Borbély, 1982) shows that performance follows a sinusoidal curve, not a flat line. If you're scheduling your hardest work at 2 PM because your calendar shows an "open slot," you're operating at 30-40% of your potential.`,
  },
  {
    title: 'The Science of Peak Performance Windows',
    content: `Research from Kleitman's Basic Rest-Activity Cycle (BRAC) reveals that humans operate in 90-minute ultradian rhythms. Within each cycle, there's a peak performance window of 30-60 minutes, followed by a trough requiring recovery. Stack this with the circadian rhythm, and you get predictable "golden hours" — windows where both your ultradian AND circadian systems align for maximum cognitive throughput. For most people, this occurs between 9-11 AM. But evening chronotypes ("night owls") peak 4-9 PM. Generic scheduling ignores this entirely.`,
  },
  {
    title: 'What Is Energy-Aware Scheduling?',
    content: `Energy-aware scheduling is the practice of matching task difficulty to your cognitive capacity at each hour. High-energy windows get deep work (strategy, writing, complex problem-solving). Medium windows get structured collaboration (meetings, code reviews, design sessions). Low windows get admin tasks (email, scheduling, filing). This isn't time management — it's capacity management. The difference? Time management assumes all hours are equal. Capacity management knows they're not.`,
  },
  {
    title: 'How SyncScript Models Your Energy Curve',
    content: `SyncScript uses a personalized Cosinor model — the gold standard in circadian research — adjusted for your chronotype (morning, evening, or neutral). The Resonance Calculus computes a real-time coherence score between your task's energy requirement and your current capacity. The result: a resonance score (0-100%) that tells you not just WHAT to do, but WHEN you'll do it best. This score drives intelligent task reordering, calendar optimization, and proactive Nexus AI briefings.`,
  },
  {
    title: 'The Business Case: Hard Numbers',
    content: `A knowledge worker earning $75/hr loses approximately $4,500/month to: context switching (~23 min recovery per switch, Mark et al. 2008), misaligned scheduling (deep work displaced by meetings, ~2 hrs/day), and tool fragmentation (re-entering context across 5+ apps, ~45 min/day). Energy-aware scheduling recovers an estimated 5-7 productive hours per week. At $75/hr, that's $1,500-$2,100/month in recovered cognitive output. SyncScript Professional costs $49/month. The ROI is 30-42x.`,
  },
];

const FAQ_ITEMS = [
  {
    q: 'How is this different from time blocking?',
    a: 'Time blocking assigns tasks to time slots based on availability. Energy-aware scheduling assigns tasks based on your cognitive capacity at that time. You might have an "open" slot at 2 PM, but if your energy is at 35%, that slot should get admin work — not your hardest strategic problem.',
  },
  {
    q: 'Does this work for night owls?',
    a: "Yes. SyncScript detects your chronotype during onboarding and adjusts the circadian curve accordingly. Evening types see their peak windows shift to 4-9 PM, and task reordering reflects this. We don't force everyone into a 9-5 box.",
  },
  {
    q: 'What data does SyncScript use for my energy curve?',
    a: 'We use three signals: (1) your self-reported chronotype during onboarding, (2) your task completion patterns over time, and (3) your energy logging entries. The more you use SyncScript, the more personalized the curve becomes. We never use invasive biometric data.',
  },
  {
    q: 'Is the resonance score scientifically validated?',
    a: 'The Resonance Calculus is based on peer-reviewed circadian research (Borbély 1982, Refinetti 2006, Folkard & Monk 1985) and the Cosinor model used in sleep science. The coherence scoring maps task characteristics to known performance curves. The paper "Resonance Homeostasis" (Stringer, 2026) formalizes the mathematical framework. Our wellness claims are bounded — this is heuristic scheduling, not medical advice.',
  },
];

export function EnergySchedulingGuidePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-black via-slate-950 to-violet-950/20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 sm:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <span className="text-sm font-medium text-violet-400/80 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">
              Research Guide
            </span>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 leading-tight">
            The Complete Guide to
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Energy-Aware Scheduling
            </span>
          </h1>
          <p className="text-lg text-white/40 max-w-xl mx-auto">
            Why your hardest tasks belong in your peak cognitive windows — and how to find them.
          </p>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {SECTIONS.map((section, i) => (
          <motion.section
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-violet-500/10 text-violet-400 text-xs font-bold shrink-0">
                {i + 1}
              </div>
              {section.title}
            </h2>
            <p className="text-white/50 leading-relaxed text-[15px]">
              {section.content}
            </p>
          </motion.section>
        ))}

        {/* FAQ */}
        <section className="border-t border-white/[0.06] pt-12">
          <h2 className="text-xl font-semibold text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i}>
                <h3 className="text-sm font-medium text-white/70 mb-1.5">{item.q}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/[0.06] pt-12 text-center">
          <p className="text-white/40 mb-4">Stop fighting your biology. Start scheduling with it.</p>
          <Button
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-violet-500/20"
            onClick={() => window.location.href = '/'}
          >
            Try SyncScript Free
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </section>
      </article>
    </div>
  );
}

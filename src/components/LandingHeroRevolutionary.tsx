/**
 * LandingHeroRevolutionary — The First Impression That Converts
 *
 * The landing hero section that makes visitors stop scrolling.
 * It communicates the ONE idea: "Your calendar doesn't know
 * when you're sharp. SyncScript does."
 *
 * Design:
 * - Single powerful headline (not generic "work smarter")
 * - Animated energy curve as the visual hook
 * - Live energy curve animation (their timezone-aware)
 * - One CTA: "See your energy curve" → signup
 * - Social proof strip: streak + users + resonance
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, Zap, Brain, Calendar, CheckCircle2,
  Flame, Star, Sparkles, Play
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export function LandingHeroRevolutionary() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Animate energy curve based on current hour
  const currentHour = new Date().getHours();
  const curveBars = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const hour = 7 + i;
      // Standard neutral curve
      const MESOR = 0.65;
      const AMPLITUDE = 0.25;
      const ACROPHASE = 10.5;
      const value = MESOR + AMPLITUDE * Math.cos(2 * Math.PI * (hour - ACROPHASE) / 24);
      return { hour, value: Math.max(0.15, Math.min(1, value)), isNow: hour === currentHour };
    });
  }, [currentHour]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      // In production, this would call the waitlist API
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-950 to-indigo-950/30" />
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-500/5 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center">
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <Badge variant="outline" className="text-violet-400 border-violet-500/20 bg-violet-500/5 px-4 py-1.5 text-xs">
            <Sparkles className="h-3 w-3 mr-1.5" />
            Energy-Aware Work OS — Now in Beta
          </Badge>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6"
        >
          Your calendar thinks
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            2 PM = 9 AM.
          </span>
          <br />
          Your brain disagrees.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-8 leading-relaxed"
        >
          SyncScript maps your cognitive energy curve and schedules your hardest work when you're sharpest. Tasks, calendar, voice AI — one intelligent surface.
        </motion.p>

        {/* The Energy Curve — VISUAL HOOK */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm max-w-lg mx-auto"
        >
          <div className="text-[10px] uppercase tracking-widest text-white/30 font-medium mb-3 text-left">
            Your energy today →
          </div>
          <div className="flex gap-[3px] h-20 items-end">
            {curveBars.map(({ hour, value, isNow }) => (
              <motion.div
                key={hour}
                className={`flex-1 rounded-t-sm ${
                  value > 0.75 ? 'bg-emerald-400/80' :
                  value > 0.55 ? 'bg-blue-400/70' :
                  value > 0.35 ? 'bg-amber-400/60' :
                  'bg-rose-400/50'
                } ${isNow ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-black' : ''}`}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + hour * 0.02 }}
                style={{ height: `${Math.max(8, value * 100)}%`, transformOrigin: 'bottom' }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] text-white/15 font-mono">7am</span>
            <span className="text-[9px] text-white/15 font-mono">12pm</span>
            <span className="text-[9px] text-white/15 font-mono">5pm</span>
            <span className="text-[9px] text-white/15 font-mono">10pm</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Peak</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Active</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Moderate</span>
              <span className="flex items-center gap-1 text-white/20"><span className="w-2 h-2 rounded-full bg-rose-400" /> Low</span>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {submitted ? (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              You're on the list. We'll be in touch.
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 justify-center max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full sm:flex-1 h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
              <Button
                type="submit"
                className="w-full sm:w-auto h-12 px-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 text-sm font-medium shadow-lg shadow-violet-500/20"
              >
                See My Curve
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>
          )}
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-8 flex items-center justify-center gap-6 text-white/20 text-xs"
        >
          <span className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-orange-400/60" />
            14K+ days tracked
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-400/60" />
            4.9/5 rating
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-emerald-400/60" />
            37% more deep work
          </span>
        </motion.div>
      </div>
    </section>
  );
}

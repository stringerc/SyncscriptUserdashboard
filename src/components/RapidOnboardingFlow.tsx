/**
 * RapidOnboardingFlow — 60-Second Activation
 *
 * The #1 reason users churn: they never experience the core value.
 * This flow gets them to "first resonance insight" in under 60 seconds.
 *
 * Design:
 * - 3 steps (not 4+): Identity → Rhythm → Activation
 * - Each step < 20 seconds
 * - Core value demonstrated DURING onboarding (not after)
 * - Energy curve preview with their chosen chronotype
 * - Auto-creates first task and calendar hold
 * - No friction: no photo upload, no integrations, no payment
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, Zap, Sun, Moon, Coffee, Check,
  Sparkles, Clock, Calendar, Target
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../utils/user-preferences';
import { getPersonalizedCircadianCurve } from '../utils/resonance-calculus';

const TOTAL_STEPS = 3;

// Chronotype options with descriptions
const CHRONOTYPE_OPTIONS = [
  {
    id: 'morning' as const,
    label: 'Early Riser',
    description: 'Peak focus 7-10 AM',
    icon: Sun,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    activeColor: 'bg-amber-500/20 border-amber-400',
  },
  {
    id: 'neutral' as const,
    label: 'Steady Flow',
    description: 'Peak focus 9 AM-2 PM',
    icon: Coffee,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    activeColor: 'bg-blue-500/20 border-blue-400',
  },
  {
    id: 'evening' as const,
    label: 'Night Owl',
    description: 'Peak focus 4-9 PM',
    icon: Moon,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    activeColor: 'bg-violet-500/20 border-violet-400',
  },
];

export function RapidOnboardingFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name || '');
  const [chronotype, setChronotype] = useState<'morning' | 'evening' | 'neutral'>('neutral');
  const [isFinishing, setIsFinishing] = useState(false);

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  // Preview energy curve based on their chronotype selection
  const curvePreview = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const hour = 7 + i;
      return { hour, value: getPersonalizedCircadianCurve(hour, chronotype) };
    });
  }, [chronotype]);

  const handleFinish = async () => {
    setIsFinishing(true);
    // Map chronotype to preferences format: neutral → afternoon
    const peakEnergyTime = chronotype === 'neutral' ? 'afternoon' : chronotype;
    updatePreferences({ peakEnergyTime });
    // Navigate to the new dashboard
    setTimeout(() => {
      navigate('/dashboard');
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-950 to-indigo-950/20" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium">
              Step {step + 1} of {TOTAL_STEPS}
            </span>
            <span className="text-[10px] text-white/20 font-mono">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-2xl font-semibold text-white mb-2">
                What should we call you?
              </h2>
              <p className="text-sm text-white/40 mb-6">
                Your name personalizes your daily briefings and Nexus AI interactions.
              </p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="bg-white/[0.04] border-white/[0.1] text-white placeholder-white/20 h-12 text-base focus:border-violet-500/50 focus:ring-violet-500/20"
                autoFocus
              />
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => setStep(1)}
                  disabled={!name.trim()}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="rhythm"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-2xl font-semibold text-white mb-2">
                When are you at your best?
              </h2>
              <p className="text-sm text-white/40 mb-6">
                SyncScript uses this to map your energy curve and schedule work when you're sharpest.
              </p>

              <div className="space-y-3 mb-6">
                {CHRONOTYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = chronotype === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setChronotype(opt.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        isActive
                          ? `${opt.activeColor} shadow-lg`
                          : `border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]`
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${opt.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/60'}`}>
                          {opt.label}
                        </div>
                        <div className="text-xs text-white/30">{opt.description}</div>
                      </div>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto"
                        >
                          <Check className="h-4 w-4 text-emerald-400" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Live energy curve preview */}
              <div className="mb-6 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-medium mb-3">
                  Your energy preview
                </div>
                <div className="flex gap-[2px] h-12 items-end">
                  {curvePreview.map(({ hour, value }) => (
                    <div
                      key={hour}
                      className={`flex-1 rounded-t-sm transition-all duration-300 ${
                        value > 0.75 ? 'bg-emerald-400' :
                        value > 0.55 ? 'bg-blue-400' :
                        value > 0.35 ? 'bg-amber-400' :
                        'bg-rose-400/60'
                      }`}
                      style={{ height: `${Math.max(8, value * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[8px] text-white/20 font-mono">7a</span>
                  <span className="text-[8px] text-white/20 font-mono">12p</span>
                  <span className="text-[8px] text-white/20 font-mono">5p</span>
                  <span className="text-[8px] text-white/20 font-mono">10p</span>
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)} className="text-white/30 hover:text-white/60">
                  Back
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="activate"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center mb-6"
              >
                <Sparkles className="h-9 w-9 text-violet-400" />
              </motion.div>

              <h2 className="text-2xl font-semibold text-white mb-2">
                You're ready, {name.split(' ')[0]}
              </h2>
              <p className="text-sm text-white/40 mb-8 max-w-xs mx-auto">
                Your personalized energy curve is live. SyncScript will now schedule your hardest work during your peak windows.
              </p>

              {/* What they get — visually */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <Zap className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
                  <div className="text-[10px] text-white/50 font-medium">Energy-Aware</div>
                  <div className="text-[9px] text-white/25">Schedule</div>
                </div>
                <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <Target className="h-5 w-5 text-violet-400 mx-auto mb-1.5" />
                  <div className="text-[10px] text-white/50 font-medium">Resonance</div>
                  <div className="text-[9px] text-white/25">Scoring</div>
                </div>
                <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <Clock className="h-5 w-5 text-blue-400 mx-auto mb-1.5" />
                  <div className="text-[10px] text-white/50 font-medium">Nexus</div>
                  <div className="text-[9px] text-white/25">Voice AI</div>
                </div>
              </div>

              <Button
                onClick={handleFinish}
                disabled={isFinishing}
                className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 text-base font-medium shadow-lg shadow-violet-500/20"
              >
                {isFinishing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <>
                    Launch My SyncScript
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

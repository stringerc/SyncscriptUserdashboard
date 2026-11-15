/**
 * Cortex On-Screen Meeting Notes & Stealth Teleprompter HUD
 *
 * Designed for Zoom, Google Meet, phone interviews, and legal consultations:
 * 1. Under-Webcam Alignment: Locks eye contact directly with the camera lens.
 * 2. Screen-Share Safe: Floating pop-out window excluded from single-app Zoom screen shares.
 * 3. Acoustic Question Assistant: Real-time speech listener that detects questions and highlights answers.
 * 4. Pacing & Timing Gauge: Keeps speaking tempo steady under pressure.
 * 5. Presets for Legal (§ 1983 Hall & Lampros), Federal Contracting (SAM.gov), & Technical Interviews.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Video, Eye, Mic, MicOff, CheckSquare, Square, Clock,
  ExternalLink, Sparkles, AlertCircle, ChevronDown, ChevronUp,
  Volume2, Shield, Sliders, Play, Pause, RotateCcw, Copy, Check
} from 'lucide-react';
import { getCortexNativePhoneService, type MeetingDossier } from '../../lib/cortex-native-phone';

interface CortexMeetingTeleprompterProps {
  standalone?: boolean;
  onClose?: () => void;
  initialPreset?: MeetingDossier['preset'];
}

export const CortexMeetingTeleprompter: React.FC<CortexMeetingTeleprompterProps> = ({
  standalone = false,
  onClose,
  initialPreset = 'legal_consultation',
}) => {
  const [preset, setPreset] = useState<MeetingDossier['preset']>(initialPreset);
  const [dossier, setDossier] = useState<MeetingDossier>(() => {
    return getCortexNativePhoneService().prepareMeetingDossier(initialPreset);
  });

  const [opacity, setOpacity] = useState(standalone ? 92 : 100);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [matchedPointId, setMatchedPointId] = useState<string | null>(null);

  // Timer states
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Custom notes input
  const [newNoteInput, setNewNoteInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);

  // Update dossier when preset changes
  useEffect(() => {
    const updated = getCortexNativePhoneService().prepareMeetingDossier(preset);
    setDossier(updated);
  }, [preset]);

  // Timer management
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Acoustic Question Assistant (Web Speech API)
  useEffect(() => {
    if (!isListening) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            analyzeUtteranceForMatches(trans);
          } else {
            interim += trans;
          }
        }
        setLiveTranscript(interim);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();

      return () => {
        try { recognition.stop(); } catch {}
      };
    } catch {}
  }, [isListening]);

  // Analyze speech tokens to auto-highlight matching talking points
  const analyzeUtteranceForMatches = (text: string) => {
    const lower = text.toLowerCase();
    if (/deadline|statute|limitation|december|when.*file/i.test(lower)) {
      setMatchedPointId('tp-1');
      setTimeout(() => setMatchedPointId(null), 8000);
    } else if (/claim|civil rights|1983|constitutional|rights/i.test(lower)) {
      setMatchedPointId('tp-2');
      setTimeout(() => setMatchedPointId(null), 8000);
    } else if (/evidence|record|documents|pleading/i.test(lower)) {
      setMatchedPointId('tp-3');
      setTimeout(() => setMatchedPointId(null), 8000);
    } else if (/fee|cost|contingency|retainer|terms/i.test(lower)) {
      setMatchedPointId('tp-4');
      setTimeout(() => setMatchedPointId(null), 8000);
    } else if (/naics|code|programming|systems design/i.test(lower)) {
      setMatchedPointId('tp-p1');
      setTimeout(() => setMatchedPointId(null), 8000);
    }
  };

  const handleToggleCheck = (id: string) => {
    setDossier(prev => ({
      ...prev,
      talkingPoints: prev.talkingPoints.map(tp => tp.id === id ? { ...tp, checked: !tp.checked } : tp),
    }));
  };

  const handleAddCustomNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return;
    const newPoint = {
      id: `tp-c-${Date.now()}`,
      label: 'Added Point',
      detail: newNoteInput.trim(),
      checked: false,
    };
    setDossier(prev => ({
      ...prev,
      talkingPoints: [...prev.talkingPoints, newPoint],
    }));
    setNewNoteInput('');
  };

  const handlePopOut = () => {
    const width = 430;
    const height = 640;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = 15; // Placed right below the top-center webcam!
    window.open(
      '/cortex/teleprompter',
      'cortex_teleprompter',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
  };

  const handleCopyPoints = () => {
    const text = dossier.talkingPoints.map(tp => `• ${tp.label}: ${tp.detail}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="cortex-meeting-teleprompter"
      style={{
        backgroundColor: standalone ? `rgba(2, 6, 23, ${opacity / 100})` : undefined,
      }}
      className={`rounded-2xl border border-teal-500/30 text-slate-100 flex flex-col shadow-2xl relative overflow-hidden backdrop-blur-xl transition-all ${
        standalone ? 'min-h-screen p-4 font-sans' : 'p-3.5 bg-slate-950/80'
      }`}
    >
      {/* ── Top Webcam Eye-Contact Lock Indicator ── */}
      <div className="flex flex-col items-center justify-center pb-2.5 border-b border-slate-800/80 space-y-1">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-700/60 shadow-lg shadow-teal-950/40">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <span className="text-[10px] font-mono text-teal-300 font-bold uppercase tracking-wider flex items-center gap-1">
            <Eye className="w-3 h-3 text-teal-400" />
            Under-Webcam Eye Contact Lock
          </span>
        </div>
        <div className="text-[10px] text-slate-400 text-center font-mono">
          Position this HUD directly below your camera. Reading looks like direct eye contact.
        </div>
      </div>

      {/* ── Preset Profile Tabs & Pop-Out Controls ── */}
      <div className="py-2.5 flex items-center justify-between gap-1.5 flex-wrap border-b border-slate-800/60">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPreset('legal_consultation')}
            className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold transition-all cursor-pointer ${
              preset === 'legal_consultation'
                ? 'bg-amber-950 text-amber-300 border border-amber-700/60 shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            ⚖️ Legal (§ 1983)
          </button>
          <button
            type="button"
            onClick={() => setPreset('federal_pitch')}
            className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold transition-all cursor-pointer ${
              preset === 'federal_pitch'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            💼 Federal Pitch
          </button>
          <button
            type="button"
            onClick={() => setPreset('job_interview')}
            className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold transition-all cursor-pointer ${
              preset === 'job_interview'
                ? 'bg-purple-950 text-purple-300 border border-purple-700/60 shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            🎓 Interview
          </button>
          <button
            type="button"
            onClick={() => setPreset('custom')}
            className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold transition-all cursor-pointer ${
              preset === 'custom'
                ? 'bg-teal-950 text-teal-300 border border-teal-700/60 shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            ✍️ Scratch
          </button>
        </div>

        {!standalone && (
          <button
            type="button"
            id="cortex-teleprompter-popout-btn"
            onClick={handlePopOut}
            className="px-2 py-1 rounded-md bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer shadow"
            title="Pop out into floating window directly below webcam"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Pop-Out HUD</span>
          </button>
        )}
      </div>

      {/* ── Meeting Context Header & Pacing Bar ── */}
      <div className="py-2.5 space-y-1.5 border-b border-slate-800/60">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white leading-tight">{dossier.title}</span>
          <span className="text-[10px] font-mono text-teal-300 bg-teal-950 px-2 py-0.5 rounded border border-teal-800/60">
            {dossier.idealPacingWpm} WPM Pacing
          </span>
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          <strong>Entity:</strong> {dossier.targetEntity}
        </div>

        {/* Live Call Timer & Acoustic Assistant Toolbar */}
        <div className="flex items-center justify-between pt-1 gap-2">
          {/* Timer */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-800 text-[10px] font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-white font-bold">{formatTimer(timerSeconds)}</span>
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="text-slate-400 hover:text-teal-300 cursor-pointer p-0.5"
            >
              {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => { setTimerSeconds(0); setIsTimerRunning(false); }}
              className="text-slate-400 hover:text-rose-300 cursor-pointer p-0.5"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Real-time Acoustic Question Assistant Toggle */}
          <button
            type="button"
            id="cortex-teleprompter-listen-toggle"
            onClick={() => setIsListening(!isListening)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
              isListening
                ? 'bg-emerald-950 text-emerald-300 border-emerald-600 animate-pulse'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Listens to interviewer/caller audio and auto-highlights corresponding notes"
          >
            {isListening ? <Mic className="w-3 h-3 text-emerald-400" /> : <MicOff className="w-3 h-3 text-slate-400" />}
            <span>{isListening ? 'AI Listener Active' : 'Listen for Questions'}</span>
          </button>

          {/* Standalone Opacity Controller */}
          {standalone && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Sliders className="w-3 h-3" />
              <input
                type="range"
                min="40"
                max="100"
                value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                className="w-14 h-1 accent-teal-400 cursor-pointer"
                title="Adjust glassmorphism opacity"
              />
            </div>
          )}
        </div>

        {/* Live speech match notice */}
        {isListening && liveTranscript && (
          <div className="text-[10px] font-mono text-teal-300 bg-teal-950/60 p-1 rounded border border-teal-800/40 truncate">
            Hearing: "{liveTranscript}"
          </div>
        )}
      </div>

      {/* ── Scrollable Talking Points (The Core Teleprompter Feed) ── */}
      <div className="flex-1 overflow-y-auto py-2.5 space-y-2 pr-1 max-h-[380px]">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
          <span className="font-semibold">Key Talking Points (Check as Covered)</span>
          <button
            type="button"
            onClick={handleCopyPoints}
            className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
          >
            {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="space-y-1.5">
          {dossier.talkingPoints.map(tp => {
            const isMatched = matchedPointId === tp.id;
            return (
              <div
                key={tp.id}
                onClick={() => handleToggleCheck(tp.id)}
                className={`p-2 rounded-lg border transition-all cursor-pointer flex items-start gap-2 ${
                  isMatched
                    ? 'bg-emerald-950/80 border-emerald-500 shadow-lg shadow-emerald-950/50 scale-[1.01]'
                    : tp.checked
                    ? 'bg-slate-950/40 border-slate-850 opacity-60'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="pt-0.5 text-slate-400 hover:text-teal-400">
                  {tp.checked ? (
                    <CheckSquare className="w-3.5 h-3.5 text-teal-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[11px] font-semibold leading-snug ${tp.checked ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                      {tp.label}
                    </span>
                    {tp.criticalDeadline && (
                      <span className="text-[9px] font-mono text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800/60 font-bold shrink-0 animate-pulse">
                        ⚠ {tp.criticalDeadline}
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] font-sans leading-relaxed mt-0.5 ${tp.checked ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                    {tp.detail}
                  </p>
                  {isMatched && (
                    <div className="text-[9px] font-mono text-emerald-400 font-bold mt-1 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                      Relevant talking point identified by acoustic listener
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Suggested Questions Section */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <button
            type="button"
            onClick={() => setShowQuestions(!showQuestions)}
            className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold hover:text-slate-200 cursor-pointer"
          >
            <span>Questions To Ask Other Party ({dossier.suggestedQuestions.length})</span>
            {showQuestions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showQuestions && (
            <div className="space-y-1">
              {dossier.suggestedQuestions.map((q, idx) => (
                <div key={idx} className="p-1.5 rounded bg-slate-950/60 border border-slate-850 text-[10px] text-slate-300 flex items-start gap-1.5">
                  <span className="font-mono text-teal-400">{idx + 1}.</span>
                  <span className="flex-1">{q}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Custom Quick Note Input ── */}
      <form onSubmit={handleAddCustomNote} className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
        <input
          type="text"
          value={newNoteInput}
          onChange={e => setNewNoteInput(e.target.value)}
          placeholder="Add quick scratch note or question..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/60 font-sans"
        />
        <button
          type="submit"
          disabled={!newNoteInput.trim()}
          className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-[10px] font-mono font-bold transition-colors cursor-pointer"
        >
          Add
        </button>
      </form>

      {/* ── Privacy & Screen-Share Safeguard Banner ── */}
      <div className="mt-2 p-1.5 rounded bg-slate-900/60 border border-slate-850 flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
        <Shield className="w-3 h-3 text-teal-400 shrink-0" />
        <span><strong>Zoom Screen-Share Protection:</strong> In Zoom, share a specific app window (e.g. Chrome/Slides), not Entire Desktop. This floating HUD stays 100% private.</span>
      </div>
    </div>
  );
};
export default CortexMeetingTeleprompter;


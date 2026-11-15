import React from 'react';
import { Shield, Eye, ShieldAlert, ShieldCheck, Zap, Activity, EyeOff, LayoutTemplate, MessageSquare, Search, MousePointerClick, Cpu, ArrowRight } from 'lucide-react';
import { FloatingOrbs } from '../FloatingOrbs';


export function CortexShieldLandingPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-300 font-sans selection:bg-cyan-500/30 selection:text-cyan-100 overflow-x-hidden">
      {/* ── Background Glows ── */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] bg-teal-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* ── 3D Particles & Background Glows ── */}
      <FloatingOrbs />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full mix-blend-screen" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
      <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] bg-teal-900/10 blur-[120px] rounded-full mix-blend-screen" />
      
      {/* ── HERO SECTION ── */}
      <section className="relative pt-[33vh] pb-24 md:pb-32 px-6 max-w-6xl mx-auto flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-12">
            <Shield className="w-4 h-4" />
            <span>Introducing CortexShield for Chrome</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight mb-10 max-w-4xl">
            Take Back Control From <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-teal-400">
              AI on the Web
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mb-16 leading-relaxed">
            Detect, flag, and block AI-powered elements on any webpage. 
            Like uBlock Origin, but for AI.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <a 
              href="https://github.com/stringerc/cortex-shield" 
              target="_blank" 
              rel="noreferrer"
              className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl transition-all duration-200 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <ShieldCheck className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Add to Chrome — It's Free</span>
            </a>
            <a 
              href="#modes"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-white font-medium rounded-xl transition-colors duration-200"
            >
              See How It Works
            </a>
          </div>
        </section>

        {/* ── THE THREAT LANDSCAPE ── */}
        <section className="py-24 px-6 border-t border-slate-800/50 bg-slate-900/20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">AI Is Everywhere. We Stop It.</h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                AI chat widgets track you. AI search overlays replace real results. AI popups nag you. 
                CortexShield detects all of it — and lets you choose what to block.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: MessageSquare, title: "Chat Widgets", desc: "Intercom, Drift, Crisp, ChatGPT embeds, Zendesk AI, and automated bots." },
                { icon: Search, title: "Search AI", desc: "Google AI Overviews, Bing Copilot, DuckDuckGo AI, and Perplexity overlays." },
                { icon: LayoutTemplate, title: "Content AI", desc: "Grammarly overlays, Notion AI, WordPress AI, and Google 'Help me write'." },
                { icon: Activity, title: "Social AI", desc: "X/Twitter Grok, Meta AI, LinkedIn AI suggestions, and Reddit AI summaries." },
                { icon: Eye, title: "AI Popups", desc: "'Try AI!' banners, AI upgrade prompts, and intrusive 'Powered by AI' badges." },
                { icon: EyeOff, title: "AI Trackers", desc: "AI-powered session recorders and behavioral analytics like Clarity and Hotjar." },
              ].map((item, i) => (
                <div key={i} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors group">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <item.icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── THREE MODES ── */}
        <section id="modes" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Three Modes of Protection</h2>
              <p className="text-lg text-slate-400 max-w-2xl">
                Configure CortexShield per-site or globally. You remain in complete control.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Ghost Mode */}
              <div className="relative p-8 rounded-3xl bg-gradient-to-b from-slate-800/40 to-slate-900/40 border border-slate-700/50 overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Eye className="w-32 h-32 text-slate-400" />
                </div>
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-700/50 text-slate-300 mb-6 border border-slate-600/50">
                    <Eye className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Ghost Mode</h3>
                  <p className="text-slate-400 mb-6">
                    Detects AI silently. Logs statistics but never changes the page. Perfect for seeing what's watching you without breaking sites.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-500" /> Silent detection</li>
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-500" /> Statistical logging</li>
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-500" /> Zero page modification</li>
                  </ul>
                </div>
              </div>

              {/* Sentry Mode */}
              <div className="relative p-8 rounded-3xl bg-gradient-to-b from-yellow-900/20 to-slate-900/40 border border-yellow-700/30 overflow-hidden group shadow-[0_0_40px_-15px_rgba(234,179,8,0.1)]">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldAlert className="w-32 h-32 text-yellow-500" />
                </div>
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-500/20 text-yellow-400 mb-6 border border-yellow-500/30">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Sentry Mode</h3>
                  <p className="text-slate-400 mb-6">
                    Detects and visually flags AI elements with stark yellow warning borders. You see exactly what is AI-powered before you interact.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-yellow-500/70" /> Visual highlighting</li>
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-yellow-500/70" /> Element flagging</li>
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-yellow-500/70" /> <i>Default Mode</i></li>
                  </ul>
                </div>
              </div>

              {/* Guardian Mode */}
              <div className="relative p-8 rounded-3xl bg-gradient-to-b from-cyan-900/20 to-slate-900/40 border border-cyan-700/50 overflow-hidden group shadow-[0_0_40px_-15px_rgba(6,182,212,0.15)]">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldCheck className="w-32 h-32 text-cyan-400" />
                </div>
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 mb-6 border border-cyan-500/30">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Guardian Mode</h3>
                  <p className="text-slate-400 mb-6">
                    Auto-blocks AI elements entirely. Replaces them with clean "blocked" placeholders. One click to reveal, right-click to allow always.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-cyan-500" /> Active blocking</li>
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-cyan-500" /> DOM removal</li>
                    <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-cyan-500" /> Click-to-reveal</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TECHNICAL ENGINE ── */}
        <section className="py-24 px-6 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Powered by a 5-Vector Engine</h2>
              <p className="text-lg text-slate-400 mb-8">
                Unlike simple ad blockers that rely solely on CSS selectors, CortexShield uses five simultaneous detection methods to catch AI that attempts to evade traditional filters.
              </p>
              
              <div className="space-y-6">
                {[
                  { title: "Static Rules", desc: "130+ known AI widget CSS selectors updated continuously." },
                  { title: "Network Blocking", desc: "Intercepts AI domains at the network level." },
                  { title: "DOM Analysis", desc: "Catches AI injected after page load via MutationObserver." },
                  { title: "Runtime Hooks", desc: "Monitors window.ai, WebSockets, and SSE streams." },
                  { title: "Behavioral Patterns", desc: "Detects LLM token streaming and mutation bursts." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                      <Zap className="w-3 h-3 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">{item.title}</h4>
                      <p className="text-slate-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex-1 w-full relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-blue-500/10 blur-3xl -z-10" />
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl font-mono text-xs sm:text-sm text-cyan-300/80 overflow-hidden">
                <div className="flex gap-2 mb-4 border-b border-slate-800 pb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed">
{`[CortexEngine] Initiating scan sequence...
[CortexEngine] MutationObserver attached to ShadowRoot.
[NetworkHook] Intercepting SSE stream from wss://chat.ai...
[PatternMatch] Token streaming detected: 14ms intervals.
[Vector 4] window.ai injection attempt blocked.
[Action] Element <div id="ai-assistant-widget"> flagged.
[GuardianMode] DOM node removed. Shield active.`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRIVACY PROMISE ── */}
        <section className="py-32 px-6 bg-slate-900/50 border-t border-slate-800/50 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <Shield className="w-16 h-16 text-white mx-auto mb-8 opacity-80" />
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Zero Data Collection. Period.</h2>
            <p className="text-xl text-slate-400 mb-12 leading-relaxed">
              CortexShield collects absolutely nothing. All detection runs entirely locally in your browser. 
              Settings stay in <code className="text-cyan-400 bg-cyan-900/20 px-2 py-1 rounded">chrome.storage</code> on your device. 
              No telemetry. No analytics. No tracking. No phoning home.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
              <span className="px-4 py-2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">No Google Analytics</span>
              <span className="px-4 py-2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">No Crash Reporting</span>
              <span className="px-4 py-2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">100% Open Source</span>
              <span className="px-4 py-2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">~150KB Installed</span>
            </div>
          </div>
        </section>
        
        {/* ── CTA FOOTER ── */}
        <section className="py-24 px-6 text-center border-t border-slate-800">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready for a quieter web?</h2>
          <a 
            href="https://github.com/stringerc/cortex-shield" 
            target="_blank" 
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-slate-200 text-slate-900 font-bold rounded-xl transition-colors duration-200"
          >
            Get CortexShield <ArrowRight className="w-5 h-5" />
          </a>
        </section>
    </div>
  );
}

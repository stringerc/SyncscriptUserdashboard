import { motion } from 'motion/react';
import { ArrowRight, Brain, Zap, Target, Calendar, TrendingUp, Sparkles, CheckCircle2, Mic, Activity, BarChart3, Clock, Play, Users, Workflow, Bot, LineChart, Gauge } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#141619] text-white overflow-x-hidden">
      {/* Epic animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#1e2128]/95 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-[1800px] mx-auto px-8 h-16 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-900/50">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">SyncScript</span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-8"
          >
            <a href="#features" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Features</a>
            <a href="#live-demo" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Live Demo</a>
            <Link 
              to="/dashboard" 
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 transition-all font-semibold text-sm shadow-lg shadow-teal-900/30 hover:scale-105"
            >
              Launch App →
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* EPIC Hero Section with Live Chart */}
      <section className="relative pt-20 pb-32 px-8">
        <div className="max-w-[1800px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Compelling Copy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-teal-900/30 to-blue-900/30 border border-teal-700/30"
              >
                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></div>
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-semibold text-teal-300">AI-Powered Productivity OS</span>
              </motion.div>
              
              <div className="space-y-6">
                <h1 className="text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight">
                  Stop
                  <br />
                  <span className="text-gray-500">Managing</span>
                  <br />
                  <span className="bg-gradient-to-r from-teal-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Start Winning
                  </span>
                </h1>
                
                <p className="text-2xl text-gray-300 leading-relaxed max-w-xl font-light">
                  AI predicts your energy peaks, prioritizes ruthlessly, and 
                  guides you to <span className="text-teal-400 font-semibold">2.5 extra hours</span> every day.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/dashboard"
                  className="group inline-flex items-center justify-center gap-3 px-10 py-5 rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 transition-all font-bold text-lg shadow-2xl shadow-teal-900/50 hover:shadow-teal-900/70 hover:scale-[1.02]"
                >
                  Try Free for 14 Days
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </Link>
                <button className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-xl bg-[#2a2d35] hover:bg-[#32353d] border border-gray-700 transition-all font-bold text-lg">
                  <Play className="w-5 h-5" />
                  Watch Demo
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4">
                {['No credit card', '14-day trial', 'Cancel anytime', '10k+ users'].map((text) => (
                  <div key={text} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: LIVE ANIMATED DASHBOARD PREVIEW */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative"
            >
              {/* Main Dashboard Container */}
              <div className="relative rounded-3xl bg-[#1e2128] border border-gray-800 shadow-2xl overflow-hidden">
                {/* Animated glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-blue-500/10 animate-pulse"></div>
                
                <div className="relative p-8 space-y-6">
                  {/* Top: AI Insight Card */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 }}
                    className="bg-gradient-to-br from-teal-900/40 to-blue-900/40 border border-teal-700/30 rounded-2xl p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                        <Brain className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-3 bg-teal-400/60 rounded-full w-32 animate-pulse"></div>
                          <div className="h-2 bg-gray-600 rounded-full w-16"></div>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full w-full"></div>
                        <div className="h-2 bg-gray-700 rounded-full w-3/4"></div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Live Energy Chart */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 }}
                    className="bg-[#1a1c20] border border-gray-800 rounded-2xl p-6"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-purple-400" />
                        <span className="text-sm font-semibold text-gray-300">Energy Levels</span>
                      </div>
                      <span className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">78%</span>
                    </div>
                    
                    {/* LIVE ANIMATED CHART */}
                    <div className="h-32 flex items-end gap-2">
                      {[65, 72, 68, 78, 85, 82, 88, 75, 70, 65, 58, 52].map((height, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: 1.2 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                          className="flex-1 rounded-t-lg bg-gradient-to-t from-teal-500 via-blue-500 to-purple-500 opacity-80 relative group cursor-pointer"
                        >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1e2128] border border-gray-700 rounded px-2 py-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {height}%
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-3 text-xs text-gray-500">
                      <span>6AM</span>
                      <span>12PM</span>
                      <span>6PM</span>
                    </div>
                  </motion.div>

                  {/* Task Cards Grid */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.4 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="bg-[#2a2d35] border border-gray-700 rounded-xl p-4 space-y-3 hover:bg-[#32353d] transition-colors cursor-pointer group">
                      <div className="flex items-center justify-between">
                        <Target className="w-5 h-5 text-teal-400" />
                        <span className="text-xs text-gray-500">High Priority</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 bg-gray-700 rounded w-full"></div>
                        <div className="h-2 bg-gray-700 rounded w-2/3"></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-1.5 bg-teal-500 rounded-full flex-1"></div>
                        <div className="h-1.5 bg-gray-700 rounded-full flex-1"></div>
                      </div>
                    </div>

                    <div className="bg-[#2a2d35] border border-gray-700 rounded-xl p-4 space-y-3 hover:bg-[#32353d] transition-colors cursor-pointer group">
                      <div className="flex items-center justify-between">
                        <Clock className="w-5 h-5 text-blue-400" />
                        <span className="text-xs text-gray-500">Due Today</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 bg-gray-700 rounded w-full"></div>
                        <div className="h-2 bg-gray-700 rounded w-3/4"></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="h-1.5 bg-blue-500 rounded-full flex-[2]"></div>
                        <div className="h-1.5 bg-gray-700 rounded-full flex-1"></div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Performance Rings */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.6 }}
                    className="flex items-center justify-between bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-700/20 rounded-2xl p-6"
                  >
                    {['Work', 'Focus', 'Energy'].map((label, i) => (
                      <div key={label} className="flex flex-col items-center gap-3">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 transform -rotate-90">
                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-gray-700" />
                            <motion.circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="none"
                              className={i === 0 ? "text-teal-500" : i === 1 ? "text-blue-500" : "text-purple-500"}
                              strokeDasharray={`${2 * Math.PI * 28}`}
                              initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                              animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - (0.6 + i * 0.1)) }}
                              transition={{ delay: 1.8 + i * 0.1, duration: 1, ease: "easeOut" }}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                            {Math.round((0.6 + i * 0.1) * 100)}%
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">{label}</span>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </div>

              {/* Floating Success Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 2, duration: 0.5 }}
                className="absolute -bottom-6 -left-6 bg-gradient-to-br from-green-600 to-teal-600 rounded-2xl p-5 shadow-2xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white">+47%</div>
                    <div className="text-sm text-white/90 font-medium">Productivity</div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Active Users Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 2.2, duration: 0.5 }}
                className="absolute -top-6 -right-6 bg-[#1e2128] border border-gray-700 rounded-2xl p-4 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`w-10 h-10 rounded-full border-2 border-[#1e2128] bg-gradient-to-br ${
                        i === 1 ? 'from-teal-500 to-blue-500' : i === 2 ? 'from-blue-500 to-purple-500' : 'from-purple-500 to-pink-500'
                      } flex items-center justify-center text-white text-sm font-bold`}>
                        {i === 3 ? '10k+' : ''}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-white">Active Now</div>
                    <div className="text-xs text-gray-400">Join 10k+ users</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* LIVE STATS - Real-time feel */}
      <section className="py-20 px-8 border-y border-gray-800/50 bg-gradient-to-r from-[#1a1c20]/30 via-transparent to-[#1a1c20]/30">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '10,000+', label: 'Active Users', icon: Users, color: 'teal' },
              { value: '+47%', label: 'Productivity', icon: TrendingUp, color: 'blue' },
              { value: '2.5hrs', label: 'Saved Daily', icon: Clock, color: 'purple' },
              { value: '4.9★', label: 'User Rating', icon: Sparkles, color: 'yellow' }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-[#1e2128] border border-gray-800 rounded-2xl p-8 text-center card-hover group"
              >
                <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 group-hover:scale-110 transition-transform">
                  <stat.icon className={`w-8 h-8 text-${stat.color}-400`} />
                </div>
                <div className="text-4xl font-black bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-400 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES - Interactive */}
      <section id="features" className="py-32 px-8">
        <div className="max-w-[1600px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-6xl font-black mb-6">
              Your New
              <span className="bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"> Superpower</span>
            </h2>
            <p className="text-2xl text-gray-400 max-w-3xl mx-auto">
              Every feature engineered to give you an unfair advantage
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: "AI Task Prioritization", description: "ML algorithms analyze your deadlines, dependencies, and patterns to suggest optimal task order every morning.", gradient: "from-teal-600 to-blue-600" },
              { icon: Activity, title: "Energy Tracking", description: "Monitor productivity patterns and schedule demanding work during your peak performance hours automatically.", gradient: "from-blue-600 to-purple-600" },
              { icon: Target, title: "Laser Focus Mode", description: "Enter flow state faster with intelligent task breakdown, distraction blocking, and real-time progress tracking.", gradient: "from-purple-600 to-pink-600" },
              { icon: Mic, title: "Voice-to-Task", description: "Create tasks, set reminders, and manage your entire schedule hands-free with advanced voice recognition.", gradient: "from-teal-600 to-green-600" },
              { icon: BarChart3, title: "Performance Analytics", description: "Detailed insights into productivity trends, completion rates, and personalized recommendations for improvement.", gradient: "from-orange-600 to-red-600" },
              { icon: Workflow, title: "Smart Automation", description: "Automate repetitive workflows, sync across tools, and let AI handle the boring stuff while you focus on impact.", gradient: "from-blue-600 to-teal-600" }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group relative bg-[#1e2128] border border-gray-800 rounded-3xl p-8 card-hover overflow-hidden"
              >
                {/* Hover gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                
                <div className="relative">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} mb-6 shadow-xl group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-teal-400 transition-colors">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MASSIVE CTA */}
      <section className="py-32 px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-teal-600 via-blue-600 to-purple-600 p-20 text-center shadow-2xl"
          >
            {/* Animated grid */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>
            
            <div className="relative">
              <h2 className="text-6xl lg:text-7xl font-black mb-8 text-white">
                Ready to Win Back
                <br />
                Your Time?
              </h2>
              <p className="text-2xl mb-12 text-white/95 max-w-3xl mx-auto font-medium">
                Join 10,000+ professionals who've stopped managing and started winning
              </p>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-4 px-12 py-6 rounded-2xl bg-white text-gray-900 hover:bg-gray-100 transition-all font-black text-2xl shadow-2xl hover:scale-105"
              >
                Start Free Trial
                <ArrowRight className="w-8 h-8" />
              </Link>
              <p className="mt-8 text-white/90 text-lg">✓ No credit card  ✓ 14-day trial  ✓ Cancel anytime</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-[#1a1c20]/50 py-20 px-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">SyncScript</span>
              </div>
              <p className="text-gray-400 mb-8 max-w-md text-lg">
                The AI-powered productivity platform helping teams achieve more with less stress.
              </p>
              <div className="flex gap-4">
                {['Twitter', 'LinkedIn', 'GitHub'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="w-12 h-12 rounded-xl bg-[#2a2d35] hover:bg-[#32353d] border border-gray-700 flex items-center justify-center transition-all hover:scale-110"
                  >
                    <span className="text-xs font-bold text-gray-400">{social[0]}</span>
                  </a>
                ))}
              </div>
            </div>
            
            {['Product', 'Company'].map((section) => (
              <div key={section}>
                <h4 className="font-bold mb-6 text-lg">{section}</h4>
                <ul className="space-y-4 text-gray-400">
                  {['Features', 'Pricing', 'Roadmap', 'Changelog'].map((link) => (
                    <li key={link}>
                      <a href="#" className="hover:text-white transition-colors text-base">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-gray-400">
              © 2025 SyncScript. All rights reserved.
            </div>
            <div className="flex gap-8 text-gray-400">
              {['Privacy', 'Terms', 'Security'].map((link) => (
                <a key={link} href="#" className="hover:text-white transition-colors">{link}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

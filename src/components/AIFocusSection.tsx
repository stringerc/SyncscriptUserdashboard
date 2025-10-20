import { HelpCircle, Mic, MoreHorizontal } from 'lucide-react';
import { AnimatedAvatar } from './AnimatedAvatar';

export function AIFocusSection() {
  return (
    <div className="h-full flex flex-col pb-4">
      <h2 className="text-white mb-4">AI & FOCUS</h2>

      <div className="flex flex-col gap-4 flex-1">
        {/* What Should I Be Doing Card */}
        <div className="bg-gradient-to-br from-teal-900/40 to-blue-900/40 rounded-2xl p-6 border border-teal-800/30 flex-[1.4] flex flex-col justify-between card-hover shadow-lg shadow-teal-900/20">
        <div className="flex items-start justify-between mb-6">
          <h3 className="text-white text-4xl">What Should I Be Doing Right Now?</h3>
          <HelpCircle className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="mb-6">
          <p className="text-gray-300 text-xl mb-1">
            Prioritize <span className="text-teal-400">"Q4 Bllocation (Financial Agent) Agent)"</span>
          </p>
        </div>

        <div className="flex items-center gap-3 bg-black/20 rounded-lg p-4 mb-4 hover:bg-black/30 transition-all cursor-pointer border border-transparent hover:border-teal-500/30">
          <AnimatedAvatar
            src="https://images.unsplash.com/photo-1656313826909-1f89d1702a81?w=100&h=100&fit=crop"
            fallback="AI"
            progress={65}
            animationType="pulse"
            className="w-20 h-20"
            size={80}
          />
          <div className="flex-1">
            <p className="text-white">"Q4 Budget Allocation</p>
            <p className="text-gray-400 text-sm">before your 1M 1 team sync for maximum cashback.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-black/20 rounded-lg p-4 hover:bg-black/30 transition-all cursor-pointer border border-transparent hover:border-teal-500/30">
          <AnimatedAvatar
            src="https://images.unsplash.com/photo-1549614614-dfc31601c389?w=100&h=100&fit=crop"
            fallback="AI"
            progress={45}
            animationType="heartbeat"
            className="w-20 h-20"
            size={80}
          />
          <div className="flex-1">
            <p className="text-white">Review Project Proposal</p>
            <p className="text-gray-400 text-sm">Due in 2 hours - High priority from stakeholder meeting.</p>
          </div>
        </div>
      </div>

      {/* Energy Adaptive Agent */}
      <div className="bg-[#1e2128] rounded-2xl p-6 border border-gray-800 flex-1 flex flex-col card-hover shadow-lg">
        <h3 className="text-white mb-6 text-center">Energy Adaptive Agent</h3>
        
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="#2a2d35"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="#10b981"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 70 * 0.85} ${2 * Math.PI * 70}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-4xl">85%</span>
            </div>
          </div>
        </div>

        <p className="text-gray-400 text-center text-sm mb-4">4 hrs left. Optimize Optimize load?</p>

        <button className="w-full bg-[#2a2d35] hover:bg-[#32353d] text-gray-300 rounded-lg py-3 flex items-center justify-center gap-2 transition-all button-ripple hover:shadow-lg hover:scale-105">
          <Mic className="w-4 h-4" />
          Voice-to-Task
        </button>
      </div>

        {/* Weather & Route Intelligence */}
        <div className="bg-[#1e2128] rounded-2xl p-6 border border-gray-800 flex-[0.7] flex flex-col card-hover shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-white text-2xl">Weather & Route Intelligence</h3>
            <MoreHorizontal className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="flex items-center gap-3 mb-3 hover:bg-black/20 rounded-lg p-2 -m-2 transition-all cursor-pointer">
            <AnimatedAvatar
              src="https://images.unsplash.com/photo-1758599543154-76ec1c4257df?w=100&h=100&fit=crop"
              fallback="W"
              progress={75}
              animationType="shake"
              className="w-20 h-20"
              size={80}
            />
            <div className="flex-1">
              <p className="text-white">Heavy rain 5 PM. Reassamblable</p>
              <p className="text-gray-400 text-sm">Outdoor Run or pack gear</p>
            </div>
          </div>

          <div className="flex items-center gap-3 hover:bg-black/20 rounded-lg p-2 -m-2 transition-all cursor-pointer">
            <AnimatedAvatar
              src="https://images.unsplash.com/photo-1581065178047-8ee15951ede6?w=100&h=100&fit=crop"
              fallback="W"
              progress={55}
              animationType="spin"
              className="w-20 h-20"
              size={80}
            />
            <div className="flex-1">
              <p className="text-white">Traffic delay on Route 101</p>
              <p className="text-gray-400 text-sm">Leave 15 min early for evening appointment</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

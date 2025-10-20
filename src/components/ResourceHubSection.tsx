import { MoreHorizontal, Plus, Check, X } from 'lucide-react';
import { AnimatedAvatar } from './AnimatedAvatar';
import { Progress } from './ui/progress';

export function ResourceHubSection() {
  return (
    <div className="h-full flex flex-col pb-4">
      <h2 className="text-white mb-4">RESOURCE HUB</h2>

      <div className="flex flex-col gap-4 flex-1">
        {/* Financial Health Snapshot */}
        <div className="bg-[#1e2128] rounded-2xl p-4 border border-gray-800 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-white mb-1">Financial Health Snapshot</h3>
            <p className="text-gray-400 text-sm">Rechoopan for</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-end justify-between mb-2">
            <span className="text-gray-400 text-sm">Weekly Spend vs Budget</span>
            <span className="text-white">75%</span>
          </div>
          <p className="text-gray-500 text-xs mb-2">$167 <span className="text-teal-400">OVERTRENDING</span></p>
          <Progress value={75} className="h-2 bg-gray-700" indicatorClassName="bg-orange-500" />
          <div className="flex items-center justify-between mt-1">
            <span className="text-gray-500 text-xs">Campus 1 nom" , Mo"</span>
            <span className="text-gray-500 text-xs">$1,lease</span>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex items-end justify-between mb-2">
              <span className="text-gray-400 text-sm">Monthly Savings Goal</span>
              <span className="text-white">60%</span>
            </div>
            <p className="text-gray-500 text-xs mb-2">$600 / $1,000 <span className="text-green-400">ON TRACK</span></p>
            <Progress value={60} className="h-2 bg-gray-700" indicatorClassName="bg-orange-500" />
          </div>
        </div>
      </div>

      {/* Gamification Streaks */}
      <div className="bg-[#1e2128] rounded-2xl p-4 border border-gray-800 flex-[0.6] flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-white">Gamification Streaks</h3>
          <MoreHorizontal className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-white text-sm">7-Day Streak</p>
                <p className="text-gray-400 text-xs">Keep it going!</p>
              </div>
            </div>
            <span className="text-orange-400">7</span>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-white text-sm">Weekly Tasks</p>
                <p className="text-gray-400 text-xs">18/25 completed</p>
              </div>
            </div>
            <span className="text-blue-400">72%</span>
          </div>
          
          <div className="flex gap-2">
            <button className="flex-1 bg-[#2a2d35] hover:bg-[#32353d] text-gray-300 rounded-lg py-2 px-3 text-sm">
              View Stats
            </button>
            <button className="flex-1 bg-[#2a2d35] hover:bg-[#32353d] text-gray-300 rounded-lg py-2 px-3 text-sm">
              Leaderboard
            </button>
          </div>
        </div>
      </div>

      {/* Notification In-Box */}
      <div className="bg-[#1e2128] rounded-2xl p-4 border border-gray-800 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-white">Notification In-Box</h3>
          <span className="text-gray-400 text-sm">4 new</span>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="space-y-2 overflow-y-auto hide-scrollbar">
            <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
              <div className="text-xl">📧</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">Team Update Required</p>
                <p className="text-gray-400 text-xs">2 pending approvals</p>
              </div>
              <button className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 shrink-0">
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
              <MoreHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
            </div>

            <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
              <div className="text-xl">⚠️</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">Budget Alert</p>
                <p className="text-gray-400 text-xs">75% of weekly spend</p>
              </div>
              <button className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 shrink-0">
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
              <MoreHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
            </div>

            <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
              <AnimatedAvatar
                src="https://images.unsplash.com/photo-1656313826909-1f89d1702a81?w=100&h=100&fit=crop"
                fallback="S"
                progress={50}
                animationType="wiggle"
                className="w-7 h-7 shrink-0"
                size={28}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">Sarah mentioned you</p>
                <p className="text-gray-400 text-xs">In Q4 Planning Doc</p>
              </div>
              <button className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 shrink-0">
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
              <MoreHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
            </div>

            <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
              <div className="text-xl">🎯</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">Goal Progress</p>
                <p className="text-gray-400 text-xs">Weekly target: 80%</p>
              </div>
              <button className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 shrink-0">
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
              <MoreHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
            </div>
          </div>
        </div>
      </div>

        {/* Achievement Progress Rail */}
        <div className="bg-[#1e2128] rounded-2xl p-4 border border-gray-800 flex-1 flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-white">Achievement Progress Rail</h3>
            <span className="text-gray-400 text-sm">5 Active</span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="space-y-2 overflow-y-auto">
              <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">Early Bird</p>
                  <p className="text-gray-400 text-xs">5/7 Days This Week</p>
                </div>
                <span className="text-green-400 text-sm shrink-0">71%</span>
              </div>

              <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
                <Check className="w-4 h-4 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">Focus Master</p>
                  <p className="text-gray-400 text-xs">8/10 Sessions</p>
                </div>
                <span className="text-orange-400 text-sm shrink-0">80%</span>
              </div>

              <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
                <X className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">Task Streak</p>
                  <p className="text-gray-400 text-xs">18/25 Tasks Completed</p>
                </div>
                <span className="text-blue-400 text-sm shrink-0">72%</span>
              </div>

              <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
                <div className="text-lg shrink-0">🏆</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">Budget Master</p>
                  <p className="text-gray-400 text-xs">Under budget 3 weeks</p>
                </div>
                <span className="text-yellow-400 text-sm shrink-0">3/4</span>
              </div>

              <div className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5">
                <div className="text-lg shrink-0">⚡</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">Energy Champion</p>
                  <p className="text-gray-400 text-xs">High energy 4 days</p>
                </div>
                <span className="text-purple-400 text-sm shrink-0">4/5</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

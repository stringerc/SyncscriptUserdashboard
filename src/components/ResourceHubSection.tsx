import { MoreHorizontal, Plus, Check, X } from 'lucide-react';
import { AnimatedAvatar } from './AnimatedAvatar';
import { Progress } from './ui/progress';
import { navigationLinks, navigate } from '../utils/navigation';

export function ResourceHubSection() {
  return (
    <div className="h-full flex flex-col pb-4">
      <h2 className="text-white mb-4">RESOURCE HUB</h2>

      <div className="flex flex-col gap-4 flex-1">
        {/* Financial Health Snapshot */}
        <div 
          className="bg-[#1e2128] rounded-2xl p-4 border border-gray-800 flex-1 flex flex-col card-hover shadow-lg hover:border-gray-700 transition-all cursor-pointer"
          onClick={() => navigate(navigationLinks.resources.financialHealth)}
          data-nav="financial-health"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-white mb-1">Financial Health Snapshot</h3>
              <p className="text-gray-400">Real-time overview</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-end justify-between mb-2">
              <span className="text-gray-400">Weekly Spend vs Budget</span>
              <span className="text-white">75%</span>
            </div>
            <p className="text-gray-500 mb-2">$750 / $1,000 <span className="text-orange-400">OVERTRENDING</span></p>
            <Progress value={75} className="h-2 bg-gray-700" indicatorClassName="bg-orange-500" />
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-500">Currently $167 over</span>
              <span className="text-gray-500">$1,000 limit</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <div className="flex items-end justify-between mb-2">
                <span className="text-gray-400">Monthly Savings Goal</span>
                <span className="text-white">60%</span>
              </div>
              <p className="text-gray-500 mb-2">$600 / $1,000 <span className="text-green-400">ON TRACK</span></p>
              <Progress value={60} className="h-2 bg-gray-700" indicatorClassName="bg-green-500" />
            </div>
          </div>
        </div>

        {/* Gamification Streaks */}
        <div className="bg-[#1e2128] rounded-2xl p-4 border border-gray-800 flex-[0.6] flex flex-col card-hover shadow-lg hover:border-gray-700 transition-all">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-white">Gamification Streaks</h3>
            <MoreHorizontal className="w-5 h-5 text-gray-400 hover:text-white transition-colors cursor-pointer" />
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-3 p-2 rounded-lg hover:bg-[#2a2d35] transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span>🔥</span>
                <div>
                  <p className="text-white">7-Day Streak</p>
                  <p className="text-gray-400">Keep it going!</p>
                </div>
              </div>
              <span className="text-orange-400">7</span>
            </div>
            
            <div className="flex items-center justify-between mb-4 p-2 rounded-lg hover:bg-[#2a2d35] transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <span>⭐</span>
                <div>
                  <p className="text-white">Weekly Tasks</p>
                  <p className="text-gray-400">18/25 completed</p>
                </div>
              </div>
              <span className="text-blue-400">72%</span>
            </div>
            
            <div className="flex gap-2">
              <button 
                className="flex-1 bg-[#2a2d35] hover:bg-[#32353d] text-gray-300 rounded-lg py-2 px-3 transition-all hover:scale-105 active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(navigationLinks.resources.viewStats);
                }}
                data-nav="view-stats"
              >
                View Stats
              </button>
              <button 
                className="flex-1 bg-[#2a2d35] hover:bg-[#32353d] text-gray-300 rounded-lg py-2 px-3 transition-all hover:scale-105 active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(navigationLinks.resources.leaderboard);
                }}
                data-nav="leaderboard"
              >
                Leaderboard
              </button>
            </div>
          </div>
        </div>

        {/* Notification In-Box */}
        <div className="bg-[#1e2128] rounded-2xl p-4 border border-gray-800 flex-1 flex flex-col card-hover shadow-lg hover:border-gray-700 transition-all">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-white">Notification In-Box</h3>
            <span className="text-gray-400">4 new</span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="space-y-2 overflow-y-auto hide-scrollbar">
              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer group"
                onClick={() => navigate(navigationLinks.resources.notification('team-update'))}
                data-nav="notification-team-update"
              >
                <div>📧</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white">Team Update Required</p>
                  <p className="text-gray-400">2 pending approvals</p>
                </div>
                <button className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 shrink-0 transition-colors">
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
                <MoreHorizontal className="w-4 h-4 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer group"
                onClick={() => navigate(navigationLinks.resources.notification('budget-alert'))}
                data-nav="notification-budget-alert"
              >
                <div>⚠️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white">Budget Alert</p>
                  <p className="text-gray-400">75% of weekly spend</p>
                </div>
                <button className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 shrink-0 transition-colors">
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
                <MoreHorizontal className="w-4 h-4 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer group"
                onClick={() => navigate(navigationLinks.resources.notification('mention'))}
                data-nav="notification-mention"
              >
                <AnimatedAvatar
                  src="https://images.unsplash.com/photo-1656313826909-1f89d1702a81?w=100&h=100&fit=crop"
                  fallback="S"
                  progress={50}
                  animationType="wiggle"
                  className="w-7 h-7 shrink-0"
                  size={28}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white">Sarah mentioned you</p>
                  <p className="text-gray-400">In Q4 Planning Doc</p>
                </div>
                <button className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 shrink-0 transition-colors">
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
                <MoreHorizontal className="w-4 h-4 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer group"
                onClick={() => navigate(navigationLinks.resources.notification('goal-progress'))}
                data-nav="notification-goal"
              >
                <div>🎯</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white">Goal Progress</p>
                  <p className="text-gray-400">Weekly target: 80%</p>
                </div>
                <button className="w-7 h-7 bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-600 shrink-0 transition-colors">
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
                <MoreHorizontal className="w-4 h-4 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>

        {/* Achievement Progress Rail */}
        <div className="bg-[#1e2128] rounded-2xl p-4 border border-gray-800 flex-1 flex flex-col card-hover shadow-lg hover:border-gray-700 transition-all">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-white">Achievement Progress Rail</h3>
            <span className="text-gray-400">5 Active</span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="space-y-2 overflow-y-auto hide-scrollbar">
              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer"
                onClick={() => navigate(navigationLinks.resources.achievement('early-bird'))}
                data-nav="achievement-early-bird"
              >
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white">Early Bird</p>
                  <p className="text-gray-400">5/7 Days This Week</p>
                </div>
                <span className="text-green-400 shrink-0">71%</span>
              </div>

              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer"
                onClick={() => navigate(navigationLinks.resources.achievement('focus-master'))}
                data-nav="achievement-focus"
              >
                <Check className="w-4 h-4 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white">Focus Master</p>
                  <p className="text-gray-400">8/10 Sessions</p>
                </div>
                <span className="text-orange-400 shrink-0">80%</span>
              </div>

              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer"
                onClick={() => navigate(navigationLinks.resources.achievement('task-streak'))}
                data-nav="achievement-task"
              >
                <X className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white">Task Streak</p>
                  <p className="text-gray-400">18/25 Tasks Completed</p>
                </div>
                <span className="text-blue-400 shrink-0">72%</span>
              </div>

              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer"
                onClick={() => navigate(navigationLinks.resources.achievement('budget-master'))}
                data-nav="achievement-budget"
              >
                <div className="shrink-0">🏆</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white">Budget Master</p>
                  <p className="text-gray-400">Under budget 3 weeks</p>
                </div>
                <span className="text-yellow-400 shrink-0">3/4</span>
              </div>

              <div 
                className="flex items-center gap-2 bg-[#2a2d35] rounded-lg p-2.5 hover:bg-[#32353d] transition-all cursor-pointer"
                onClick={() => navigate(navigationLinks.resources.achievement('energy-champion'))}
                data-nav="achievement-energy"
              >
                <div className="shrink-0">⚡</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white">Energy Champion</p>
                  <p className="text-gray-400">High energy 4 days</p>
                </div>
                <span className="text-purple-400 shrink-0">4/5</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
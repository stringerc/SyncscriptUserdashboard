import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { AnimatedAvatar } from './AnimatedAvatar';
import { Badge } from './ui/badge';

export function TodaySection() {
  const tasks = [
    { id: 1, title: 'Time', subtitle: 'Ask Togglise llm"', time: '7&10', avatar: 'https://images.unsplash.com/photo-1758518727984-17b37f2f0562?w=100&h=100&fit=crop' },
    { id: 2, title: 'Themess law', subtitle: 'Ask Togglises llme!', time: '7&10', badge: 'Party Sumcrn!' },
    { id: 3, title: 'Money Smth by', subtitle: 'Ask Togglises ller morp"', time: '7&10' },
    { id: 4, title: 'Personal', subtitle: 'Elm Togglises Enjer"', time: '7&10' },
    { id: 5, title: 'Themess/stas', subtitle: 'Adn Toggliser lope!', time: '7&10' },
    { id: 6, title: 'Thererastm', subtitle: 'Adn Togglises Enjer"', time: '7&10' },
  ];

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const startDay = 6; // Sunday
  const emptyDays = Array.from({ length: startDay }, (_, i) => i);

  return (
    <div className="h-full flex flex-col pb-4">
      <h2 className="text-white mb-4">TODAY'S ORCHRETATION</h2>

      <div className="flex flex-col gap-4 flex-1">
        {/* My Day */}
        <div className="bg-[#1e2128] rounded-2xl p-6 border border-gray-800 flex-1 flex flex-col card-hover shadow-lg">
        <p className="text-gray-400 mb-4">My Day: Tuesday, Nov 28, 2023</p>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white">Prioritzed Tasks</h3>
          <span className="text-gray-400 text-sm">Hometon fog</span>
        </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 bg-[#2a2d35] rounded-lg p-3 hover:bg-[#32353d] transition-all cursor-pointer border border-transparent hover:border-gray-600">
                {task.avatar ? (
                  <AnimatedAvatar
                    src={task.avatar}
                    fallback="T"
                    progress={35}
                    animationType="bounce"
                    className="w-8 h-8"
                    size={32}
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{task.title}</p>
                  <p className="text-gray-400 text-xs truncate">{task.subtitle}</p>
                </div>
                {task.badge && (
                  <Badge className="bg-teal-500 hover:bg-teal-500 text-white text-xs">
                    {task.badge}
                  </Badge>
                )}
                <span className="text-gray-400 text-sm">{task.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Conflict Alert Card */}
        <div className="bg-gradient-to-br from-orange-900/40 to-red-900/40 border-2 border-orange-500 rounded-2xl p-6 flex-[0.5] card-hover shadow-lg shadow-orange-900/30 animated-gradient">
        <h4 className="text-white mb-1">Financial Conflict Alert</h4>
        <p className="text-orange-300 mb-2">Dinner exceods budget by $45</p>
        <p className="text-gray-400 text-sm mb-3">[Suggest Alternatives]</p>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-300 text-sm">Daily Challenge</p>
            <p className="text-gray-400 text-xs">W Hyperfixation plumt.Max?</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white">🎯 Points: +500</span>
          </div>
        </div>
      </div>

        {/* My Calendar */}
        <div className="bg-[#1e2128] rounded-2xl p-6 border border-gray-800 flex-1 flex flex-col card-hover shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white">My Calendar</h3>
          <MoreHorizontal className="w-5 h-5 text-gray-400" />
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="text-center text-gray-500 text-xs py-0.5">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map((i) => (
            <div key={`empty-${i}`} className="aspect-square"></div>
          ))}
          {daysInMonth.map((day) => (
            <div
              key={day}
              className={`aspect-square flex items-center justify-center text-xs rounded-lg cursor-pointer ${
                day === 28
                  ? 'bg-blue-500 text-white'
                  : day < 28
                  ? 'text-gray-500 hover:bg-gray-800'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

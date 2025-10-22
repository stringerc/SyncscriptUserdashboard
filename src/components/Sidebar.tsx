import { useState } from 'react';
import { LayoutDashboard, Target, Calendar, Bot, Zap, Users, TrendingUp, Gamepad2, Link2, Building2, FileText, Menu, Settings } from 'lucide-react';
import logoImage from 'figma:asset/914d5787f554946c037cbfbb2cf65fcc0de06278.png';
import { navigationLinks, navigate } from '../utils/navigation';

export function Sidebar() {
  const [activeItem, setActiveItem] = useState('Dashboard');

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'Dashboard', path: navigationLinks.sidebar.dashboard },
    { icon: Target, label: 'Tasks', id: 'Tasks', path: navigationLinks.sidebar.tasks },
    { icon: Calendar, label: 'Calendar', id: 'Calendar', path: navigationLinks.sidebar.calendar },
    { icon: Bot, label: 'AI', id: 'AI', path: navigationLinks.sidebar.ai },
    { icon: Zap, label: 'Energy', id: 'Energy', path: navigationLinks.sidebar.energy },
    { icon: Users, label: 'Team', id: 'Team', path: navigationLinks.sidebar.team },
    { icon: TrendingUp, label: 'Analytics', id: 'Analytics', path: navigationLinks.sidebar.analytics },
    { icon: Gamepad2, label: 'Gaming', id: 'Gaming', path: navigationLinks.sidebar.gaming },
    { icon: Link2, label: 'Integrations', id: 'Integrations', path: navigationLinks.sidebar.integrations },
    { icon: Building2, label: 'Enterprise', id: 'Enterprise', path: navigationLinks.sidebar.enterprise },
    { icon: FileText, label: 'Scripts &\nTemplates', id: 'Scripts', multiline: true, path: navigationLinks.sidebar.scripts },
    { icon: Menu, label: 'All Features\nMenu', id: 'AllFeatures', multiline: true, path: navigationLinks.sidebar.allFeatures },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    setActiveItem(item.id);
    navigate(item.path);
  };

  return (
    <div className="w-[140px] bg-[#1e2128] border-r border-gray-800 flex flex-col items-center py-6 space-y-8 backdrop-blur-sm">
      {/* Logo */}
      <div 
        className="mb-6 transition-transform hover:scale-110 cursor-pointer"
        onClick={() => navigate(navigationLinks.sidebar.dashboard)}
        data-nav="logo"
      >
        <img src={logoImage} alt="SyncScript Logo" className="w-16 h-16 object-contain" />
      </div>

      {/* Navigation Items */}
      <nav className="flex flex-col items-center space-y-6 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <div 
              key={item.id}
              onClick={() => handleNavClick(item)}
              data-nav={`sidebar-${item.id.toLowerCase()}`}
              className={`flex flex-col items-center gap-1 cursor-pointer group transition-all ${
                isActive ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                isActive 
                  ? 'bg-teal-600 shadow-lg shadow-teal-600/50 scale-110' 
                  : 'bg-gray-700/50 group-hover:bg-gray-600 group-hover:scale-110'
              }`}>
                <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
              </div>
              <span className={`text-center leading-tight transition-colors ${
                item.multiline ? 'text-xs' : 'text-xs'
              }`} style={{ whiteSpace: 'pre-line' }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div 
        onClick={() => {
          setActiveItem('Settings');
          navigate(navigationLinks.sidebar.settings);
        }}
        data-nav="sidebar-settings"
        className={`flex flex-col items-center gap-1 cursor-pointer group transition-all ${
          activeItem === 'Settings' ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
          activeItem === 'Settings'
            ? 'bg-teal-600 shadow-lg shadow-teal-600/50 scale-110'
            : 'bg-gray-700/50 group-hover:bg-gray-600 group-hover:scale-110'
        }`}>
          <Settings className="w-4 h-4 transition-transform group-hover:scale-110" />
        </div>
        <span className="transition-colors">Settings</span>
      </div>
    </div>
  );
}
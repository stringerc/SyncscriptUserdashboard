import { useState } from 'react';
import { Search, Lock, MessageSquare, Bell, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { AnimatedAvatar } from './AnimatedAvatar';
import syncScriptLogo from 'figma:asset/32f9c29c68f7ed10b9efd8ff6ac4135b7a2a4290.png';
import { navigationLinks, navigate } from '../utils/navigation';

interface DashboardHeaderProps {
  isAIInsightsOpen: boolean;
  onToggleAIInsights: () => void;
}

export function DashboardHeader({ isAIInsightsOpen, onToggleAIInsights }: DashboardHeaderProps) {
  const [isLowEnergyMode, setIsLowEnergyMode] = useState(true);
  
  return (
    <header className="h-16 bg-[#1e2128] border-b border-gray-800 flex items-center px-6 gap-6 relative z-10 backdrop-blur-sm">
      {/* Logo */}
      <div 
        className="flex items-center gap-3 transition-transform hover:scale-105 cursor-pointer"
        onClick={() => navigate(navigationLinks.sidebar.dashboard)}
        data-nav="header-logo"
      >
        <img src={syncScriptLogo} alt="SyncScript" className="h-8 object-contain" />
      </div>

      {/* Left Spacer */}
      <div className="flex-1"></div>

      {/* Search Bar - Centered */}
      <div className="relative w-full max-w-2xl group">
        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 transition-colors group-focus-within:text-teal-500" />
        <input
          type="text"
          placeholder="Universal Search & Command"
          className="w-full bg-[#2a2d35] border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all"
          onFocus={() => navigate(navigationLinks.header.search)}
          data-nav="search-input"
        />
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 transition-colors group-focus-within:text-teal-500" />
      </div>

      {/* Right Spacer with Conversation Extraction */}
      <div className="flex-1 flex items-center gap-4 pl-6">
        <div 
          className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer transition-colors group"
          onClick={() => navigate(navigationLinks.header.conversationExtraction)}
          data-nav="conversation-extraction"
        >
          <MessageSquare className="w-5 h-5 text-teal-500 group-hover:scale-110 transition-transform" />
          <span>Conversation Extraction</span>
        </div>
      </div>

      {/* Right Side Icons */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div 
          className="relative cursor-pointer group"
          onClick={() => navigate(navigationLinks.header.notifications)}
          data-nav="notifications"
        >
          <Bell className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full pulse-glow"></span>
        </div>

        {/* AI Insights Toggle */}
        <button 
          onClick={onToggleAIInsights}
          className="p-2 hover:bg-gray-700 rounded-lg transition-all button-ripple group"
          aria-label="Toggle AI Insights"
          data-nav="ai-insights-toggle"
        >
          {isAIInsightsOpen ? (
            <PanelRightClose className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
          ) : (
            <PanelRightOpen className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
          )}
        </button>

        {/* Low Energy Mode Indicator */}
        <div className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isLowEnergyMode 
              ? 'border-red-500 pulse-glow-red' 
              : 'border-gray-600'
          }`}>
            <div className={`w-2 h-2 rounded-full transition-colors ${
              isLowEnergyMode ? 'bg-red-500' : 'bg-gray-600'
            }`}></div>
          </div>
          <span>Low Energy Mode</span>
        </div>

        {/* Low Energy Mode Toggle */}
        <div 
          onClick={() => setIsLowEnergyMode(!isLowEnergyMode)}
          className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-all ${
            isLowEnergyMode 
              ? 'bg-red-600 hover:bg-red-500' 
              : 'bg-green-600 hover:bg-green-500'
          }`}
          data-nav="energy-mode-toggle"
        >
          <div 
            className={`w-4 h-4 bg-white rounded-full transition-all ${
              isLowEnergyMode ? 'ml-auto' : 'ml-0'
            }`}
          ></div>
        </div>

        {/* User Avatar */}
        <div 
          onClick={() => navigate(navigationLinks.header.profile)}
          data-nav="user-profile"
        >
          <AnimatedAvatar
            src="https://images.unsplash.com/photo-1758639842445-b58f639119d2?w=100&h=100&fit=crop"
            fallback="U"
            progress={85}
            animationType="glow"
            className="w-9 h-9 cursor-pointer hover:scale-110 transition-transform"
            size={36}
          />
        </div>
      </div>
    </header>
  );
}
import { useState } from 'react';
import { Search, Lock, MessageSquare, Bell, Moon, Sun, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { AnimatedAvatar } from './AnimatedAvatar';
import syncScriptLogo from '../assets/syncscript-main-logo.png';

interface DashboardHeaderProps {
  isAIInsightsOpen: boolean;
  onToggleAIInsights: () => void;
}

export function DashboardHeader({ isAIInsightsOpen, onToggleAIInsights }: DashboardHeaderProps) {
  const [isLowEnergyMode, setIsLowEnergyMode] = useState(true); // true = on/right = red, false = off/left = green
  return (
    <header className="h-16 bg-[#1e2128] border-b border-gray-800 flex items-center px-6 gap-6 relative z-10 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 transition-transform hover:scale-105">
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
          className="w-full bg-[#2a2d35] border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all"
        />
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 transition-colors group-focus-within:text-teal-500" />
      </div>

      {/* Right Spacer with Conversation Extraction */}
      <div className="flex-1 flex items-center gap-4 pl-6">
        <div className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer">
          <MessageSquare className="w-5 h-5 text-teal-500" />
          <span className="text-sm">Conversation Extraction</span>
        </div>
      </div>

      {/* Right Side Icons */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full pulse-glow"></span>
        </div>
        <button 
          onClick={onToggleAIInsights}
          className="p-2 hover:bg-gray-700 rounded-lg transition-all button-ripple"
          aria-label="Toggle AI Insights"
        >
          {isAIInsightsOpen ? (
            <PanelRightClose className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
          ) : (
            <PanelRightOpen className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
          )}
        </button>
        <div className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isLowEnergyMode 
              ? 'border-red-500 pulse-glow-red' 
              : 'border-gray-600'
          }`}>
            <div className={`w-2 h-2 rounded-full transition-colors ${
              isLowEnergyMode ? 'bg-red-500' : 'bg-gray-600'
            }`}></div>
          </div>
          <span className="text-sm">Low Energy Mode</span>
        </div>
        <div 
          onClick={() => setIsLowEnergyMode(!isLowEnergyMode)}
          className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-all ${
            isLowEnergyMode 
              ? 'bg-red-600 hover:bg-red-500' 
              : 'bg-green-600 hover:bg-green-500'
          }`}
        >
          <div 
            className={`w-4 h-4 bg-white rounded-full transition-all ${
              isLowEnergyMode ? 'ml-auto' : 'ml-0'
            }`}
          ></div>
        </div>
        <AnimatedAvatar
          src="https://images.unsplash.com/photo-1758639842445-b58f639119d2?w=100&h=100&fit=crop"
          fallback="U"
          progress={85}
          animationType="glow"
          className="w-9 h-9"
          size={36}
        />
      </div>
    </header>
  );
}

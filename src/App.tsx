import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { DashboardHeader } from "./components/DashboardHeader";
import { AIFocusSection } from "./components/AIFocusSection";
import { TodaySection } from "./components/TodaySection";
import { ResourceHubSection } from "./components/ResourceHubSection";
import { AIInsightsSection } from "./components/AIInsightsSection";

export default function App() {
  const [isAIInsightsOpen, setIsAIInsightsOpen] = useState(true);

  return (
    <div className="flex h-screen bg-[#141619] overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <DashboardHeader
          isAIInsightsOpen={isAIInsightsOpen}
          onToggleAIInsights={() =>
            setIsAIInsightsOpen(!isAIInsightsOpen)
          }
        />

        {/* Dashboard Content */}
        <main
          className={`flex-1 overflow-hidden p-6 transition-all duration-300 ${
            isAIInsightsOpen ? "mr-80" : "mr-0"
          }`}
        >
          <div className="flex gap-6 max-w-[1600px] mx-auto h-full">
            {/* Left Column - AI & FOCUS */}
            <div className="flex-1 h-full overflow-y-auto hide-scrollbar">
              <AIFocusSection />
            </div>

            {/* Middle Column - TODAY'S ORCHESTRATION */}
            <div className="flex-1 h-full overflow-y-auto hide-scrollbar">
              <TodaySection />
            </div>

            {/* Right Column - RESOURCE HUB */}
            <div className="flex-1 h-full overflow-y-auto hide-scrollbar">
              <ResourceHubSection />
            </div>
          </div>
        </main>

        {/* AI Insights Sidebar */}
        <div
          className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-80 bg-[#1a1c20] border-l border-gray-800 transition-transform duration-300 transform ${
            isAIInsightsOpen
              ? "translate-x-0"
              : "translate-x-full"
          } overflow-hidden shadow-2xl`}
        >
          <AIInsightsSection isOpen={isAIInsightsOpen} />
        </div>
      </div>
    </div>
  );
}
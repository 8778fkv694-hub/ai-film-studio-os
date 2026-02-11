"use client";

import { LayoutDashboard, FolderOpen, FileText, MapPin, Users, Clapperboard, Volume2, Wrench } from 'lucide-react';

export type TabId = 'dashboard' | 'project' | 'script' | 'scenes' | 'assets' | 'shots' | 'preview' | 'tools';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'dashboard', label: '概览', icon: <LayoutDashboard size={18} /> },
  { id: 'project', label: '项目管理', icon: <FolderOpen size={18} /> },
  { id: 'script', label: '剧本工作台', icon: <FileText size={18} /> },
  { id: 'scenes', label: '场景管理', icon: <MapPin size={18} /> },
  { id: 'assets', label: '角色道具', icon: <Users size={18} /> },
  { id: 'shots', label: '分镜编辑', icon: <Clapperboard size={18} /> },
  { id: 'preview', label: 'TTS 预演', icon: <Volume2 size={18} /> },
  { id: 'tools', label: '自动化', icon: <Wrench size={18} /> },
];

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="bg-slate-950 border-b border-slate-800 px-6">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-blue-400 border-blue-400 bg-slate-900/50'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

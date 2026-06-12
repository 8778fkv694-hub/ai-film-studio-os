"use client";

import { Film, RefreshCw, CheckCircle, Sun, Moon } from 'lucide-react';
import ProjectSelector from './ProjectSelector';

interface ToolbarProps {
  projectName: string;
  activeProjectId: string | null;
  onReload: () => void;
  onRunChecks: () => void;
  onProjectChange: (projectId: string) => void;
  onCreateNewProject: () => void;
  onManageProjects: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function Toolbar({ 
  projectName, 
  activeProjectId, 
  onReload, 
  onRunChecks, 
  onProjectChange, 
  onCreateNewProject,
  onManageProjects,
  theme,
  onToggleTheme
}: ToolbarProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-3 py-3 sm:px-6 sticky top-0 z-50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Film className="text-blue-400 flex-shrink-0" size={24} />
          <span className="whitespace-nowrap text-base font-bold text-slate-100 sm:text-xl">
            AI 影视工作室
          </span>
        </div>
        <div className="hidden h-6 w-px bg-slate-700 sm:block"></div>
        <ProjectSelector
          activeProjectId={activeProjectId}
          onProjectChange={onProjectChange}
          onCreateNew={onCreateNewProject}
          onManage={onManageProjects}
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        <button
          onClick={onRunChecks}
          aria-label="运行检查"
          className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 sm:px-4"
        >
          <CheckCircle size={16} />
          <span className="hidden sm:inline">运行检查</span>
        </button>

        <button
          onClick={onReload}
          aria-label="刷新"
          className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white transition hover:bg-slate-600 sm:px-4"
        >
          <RefreshCw size={16} />
          <span className="hidden sm:inline">刷新</span>
        </button>

        <button
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? "切换到白天模式" : "切换到暗黑模式"}
          className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white transition hover:bg-slate-600 sm:px-4"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span className="hidden sm:inline">
            {theme === 'dark' ? '白天模式' : '暗黑模式'}
          </span>
        </button>
      </div>
      </div>
    </header>
  );
}


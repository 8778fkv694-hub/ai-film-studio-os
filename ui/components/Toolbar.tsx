"use client";

import { useState } from 'react';
import { Film, Save, RefreshCw, CheckCircle, Settings, Play } from 'lucide-react';

interface ToolbarProps {
  projectName: string;
  onSave: () => void;
  onReload: () => void;
  onRunChecks: () => void;
}

export default function Toolbar({ projectName, onSave, onReload, onRunChecks }: ToolbarProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave();
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Logo & Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Film className="text-blue-400" size={28} />
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            AI 影视工作室
          </span>
        </div>
        <div className="h-6 w-px bg-slate-700"></div>
        <span className="text-slate-400 text-sm font-mono">{projectName}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunChecks}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition text-sm font-medium"
        >
          <CheckCircle size={16} />
          运行检查
        </button>

        <button
          onClick={onReload}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm"
        >
          <RefreshCw size={16} />
          刷新
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition text-sm disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? '保存中...' : '保存'}
        </button>

        <div className="h-6 w-px bg-slate-700 mx-2"></div>

        <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}

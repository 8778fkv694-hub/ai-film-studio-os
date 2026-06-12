"use client";

import { Loader2, Sparkles, Volume2, CheckCircle, X } from 'lucide-react';
import type { Shot } from './shot-types';

interface ShotSyncPanelProps {
  shot: Shot;
  isSyncOpen: boolean;
  syncingPromptShot: string | null;
  generatingSingle: string | null;
  acceptingTakeShot: string | null;
  onSyncPrompts: (shotId: string) => void | Promise<void>;
  onGenerateTTS: (shotId: string) => void | Promise<void>;
  onAcceptCurrentTakePrompt: (shot: Shot) => void | Promise<void>;
  onClose: () => void;
}

export default function ShotSyncPanel({
  shot,
  isSyncOpen,
  syncingPromptShot,
  generatingSingle,
  acceptingTakeShot,
  onSyncPrompts,
  onGenerateTTS,
  onAcceptCurrentTakePrompt,
  onClose,
}: ShotSyncPanelProps) {
  if (!isSyncOpen || !shot._sync_state || shot._sync_state.status === 'ok') return null;

  return (
    <div className="w-full rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between my-2 text-left">
      <div className="min-w-0">
        <div className="font-semibold text-amber-200">{shot._sync_state.label}</div>
        <div className="mt-0.5 text-amber-100/80 truncate">
          {shot._sync_state.reasons.join('；')}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {shot._sync_state.actions.includes('sync_prompts') && (
          <button
            onClick={() => onSyncPrompts(shot.shot_id)}
            disabled={syncingPromptShot === shot.shot_id}
            className="flex items-center gap-1 rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {syncingPromptShot === shot.shot_id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            同步 Prompt
          </button>
        )}
        {shot._sync_state.actions.includes('generate_tts') && (
          <button
            onClick={() => onGenerateTTS(shot.shot_id)}
            disabled={generatingSingle === shot.shot_id}
            className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {generatingSingle === shot.shot_id ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
            生成配音
          </button>
        )}
        {shot._sync_state.actions.includes('accept_take_prompt_hash') && shot._sync_state.video_prompt_state === 'ok' && (
          <button
            onClick={() => onAcceptCurrentTakePrompt(shot)}
            disabled={acceptingTakeShot === shot.shot_id}
            title="视频不重做，只把当前视频 Take 标记为匹配当前 Prompt"
            className="flex items-center gap-1 rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {acceptingTakeShot === shot.shot_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            接受当前视频
          </button>
        )}
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
        >
          <X size={12} />
          关闭
        </button>
      </div>
    </div>
  );
}

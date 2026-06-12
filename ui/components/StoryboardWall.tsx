"use client";

import { Film, Image as ImageIcon } from 'lucide-react';
import type { Shot, LintIssue } from './shot-types';

interface StoryboardWallProps {
  shots: Shot[];
  lintByShot: Record<string, LintIssue[]>;
  onOpenImage: (shot: Shot) => void;
  onOpenPrompt: (shot: Shot) => void;
}

// 故事板墙：全片关键帧按时间线铺开，用于一眼发现跨镜头风格漂移
export default function StoryboardWall({ shots, lintByShot, onOpenImage, onOpenPrompt }: StoryboardWallProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {shots.map((shot) => {
        const issues = lintByShot[shot.shot_id];
        const hasError = issues?.some(i => i.level === 'ERROR');
        const hasWarn = issues?.some(i => i.level === 'WARN');
        return (
          <div
            key={shot.shot_id}
            onClick={() => {
              if (shot._selected_keyframe) {
                onOpenImage(shot);
              } else {
                onOpenPrompt(shot);
              }
            }}
            className="group cursor-pointer rounded-lg overflow-hidden border border-slate-800 hover:border-blue-500/60 bg-slate-950 transition"
            title={shot.voiceover?.text || shot.dialogue?.text || shot.action?.beats?.join('，') || shot.shot_id}
          >
            <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
              {shot._selected_keyframe ? (
                <img
                  src={shot._selected_keyframe}
                  alt={shot.shot_id}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-700 p-2 text-center">
                  <ImageIcon size={20} />
                  <span className="text-[10px] leading-tight">待生成（点击看 Prompt）</span>
                </div>
              )}
              {shot._video_url && (
                <span className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[9px] text-emerald-300 font-medium flex items-center gap-0.5">
                  <Film size={9} /> 视频
                </span>
              )}
              {(hasError || hasWarn) && (
                <span className={`absolute top-1 left-1 w-2 h-2 rounded-full ${hasError ? 'bg-red-500' : 'bg-amber-400'}`} />
              )}
            </div>
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono">
              <span className="text-blue-300 font-bold">{shot.shot_id}</span>
              <span className="text-slate-500">{shot.duration_s}s</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

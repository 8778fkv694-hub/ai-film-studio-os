"use client";

import { useRef } from 'react';
import { Film, Play, X } from 'lucide-react';
import type { Shot } from './shot-types';

interface TakeCompareModalProps {
  shot: Shot;
  takes: any[];
  onClose: () => void;
  onSetActive: (takeId: string) => Promise<void> | void;
}

// Take A/B 并排对比：双视频同步播放，直接选优设为活动版本
export default function TakeCompareModal({ shot, takes, onClose, onSetActive }: TakeCompareModalProps) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const playBoth = (play: boolean) => {
    for (const video of videoRefs.current) {
      if (!video) continue;
      if (play) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Film size={16} className="text-purple-400" />
            版本对比（{shot.shot_id}）
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => playBoth(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition"
            >
              <Play size={13} />
              同时从头播放
            </button>
            <button
              onClick={() => playBoth(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              暂停
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          {takes.map((take: any, i: number) => {
            const isActive = shot._active_take?.take_id === take.take_id;
            return (
              <div key={take.take_id} className="space-y-3">
                <div className="rounded-lg overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                  {take.video_path ? (
                    <video
                      ref={el => { videoRefs.current[i] = el; }}
                      src={`/api/assets/reference/${take.video_path}`}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : take.keyframe_path ? (
                    <img
                      src={`/api/assets/reference/${take.keyframe_path}`}
                      alt={take.take_id}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-slate-600 text-xs">无可预览素材</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-400 space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-200">
                        版本{(take.take_id.match(/\d+/)?.[0] || '').replace(/^0+/, '') || ''}
                      </span>
                      {isActive && (
                        <span className="text-[9px] bg-blue-500 text-white px-1 rounded uppercase font-bold">Active</span>
                      )}
                      {take.review?.rating > 0 && (
                        <span className="text-amber-400">{'★'.repeat(take.review.rating)}</span>
                      )}
                    </div>
                    <div className="truncate">{new Date(take.timestamp).toLocaleString()}{take.review?.notes ? ` · ${take.review.notes}` : ''}</div>
                  </div>
                  <button
                    onClick={() => onSetActive(take.take_id)}
                    disabled={isActive}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {isActive ? '当前活动' : '选它（设为活动）'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

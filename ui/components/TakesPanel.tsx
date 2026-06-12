"use client";

import { Image as ImageIcon } from 'lucide-react';
import type { Shot } from './shot-types';

interface TakesPanelProps {
  shot: Shot;
  isExpanded: boolean;
  compareSel: { shotId: string; takeIds: string[] };
  onToggleCompareTake: (shot: Shot, takeId: string) => void;
  onUpdateReview: (shotId: string, takeId: string, rating: number | null, notes: string) => void | Promise<void>;
  onTakeAction: (shotId: string, takeId: string, action: string) => void | Promise<void>;
  onDeleteTake: (shotId: string, takeId: string) => void | Promise<void>;
}

export default function TakesPanel({
  shot,
  isExpanded,
  compareSel,
  onToggleCompareTake,
  onUpdateReview,
  onTakeAction,
  onDeleteTake,
}: TakesPanelProps) {
  if (!isExpanded) return null;

  return (
    <div className="w-full p-4 bg-slate-900/50 rounded-lg border border-slate-800 space-y-4 my-2 text-left">
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        🎬 版本历史与审片 ({shot.shot_id})
      </h4>
      
      {(!shot._takes || shot._takes.length === 0) ? (
        <div className="text-xs text-slate-500 py-2">
          暂无 Take 记录。请在上方“上传视频”或通过工具脚本录入新 Take。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {shot._takes.map((take: any) => {
            const isActive = shot._active_take?.take_id === take.take_id;
            const isApproved = take.review?.approved;
            const isRejected = take.status === 'rejected';
            
            return (
              <div 
                key={take.take_id} 
                className={`p-3 rounded-lg border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition ${
                  isActive 
                    ? 'bg-blue-950/20 border-blue-500/55 shadow-md shadow-blue-500/5' 
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Metadata */}
                <div className="flex gap-3 items-start">
                  <div className="w-24 h-16 bg-slate-900 border border-slate-800 rounded relative overflow-hidden flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={20} className="text-slate-600 absolute" />
                    {take.keyframe_path && (
                      <img 
                        src={`/api/assets/reference/${take.keyframe_path}`} 
                        alt={take.take_id} 
                        className="w-full h-full object-cover absolute inset-0 z-10"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    {isActive && (
                      <span className="absolute bottom-1 right-1 text-[8px] bg-blue-500 text-white px-1 rounded uppercase font-bold z-20">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-200">
                        版本{(take.take_id.match(/\d+/)?.[0] || '').replace(/^0+/, '') || ''}
                      </span>
                      <span className={`text-[10px] px-1 rounded uppercase font-medium ${
                        isApproved 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : isRejected 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {take.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 space-y-0.5">
                      <div>时间: {new Date(take.timestamp).toLocaleString()}</div>
                      <div>平台: {take.platform || 'manual'} | 来源: {take.source || 'manual'}</div>
                      {take.prompt_hash && <div>Prompt Hash: <span className="font-mono">{take.prompt_hash}</span></div>}
                    </div>
                  </div>
                </div>
                
                {/* Review notes and rating */}
                <div className="flex-1 w-full md:w-auto max-w-md space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">评分:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => onUpdateReview(shot.shot_id, take.take_id, star, take.review?.notes)}
                          className={`text-sm transition hover:scale-110 ${
                            star <= (take.review?.rating || 0) ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="备注说明 (如: 画面崩坏/运镜极佳)..."
                      defaultValue={take.review?.notes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (take.review?.notes || '')) {
                          onUpdateReview(shot.shot_id, take.take_id, take.review?.rating, e.target.value);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 w-full md:w-auto justify-end">
                  {(shot._takes?.length || 0) >= 2 && (
                    <button
                      onClick={() => onToggleCompareTake(shot, take.take_id)}
                      title="选中两个版本后并排对比"
                      className={`px-2.5 py-1 rounded text-xs font-medium transition border ${
                        compareSel.shotId === shot.shot_id && compareSel.takeIds.includes(take.take_id)
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-transparent'
                      }`}
                    >
                      {compareSel.shotId === shot.shot_id && compareSel.takeIds.includes(take.take_id) ? '已选 · 再选一个' : '对比'}
                    </button>
                  )}
                  {take.video_path && (
                    <button
                      onClick={() => window.open(`/api/assets/reference/${take.video_path}`)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                    >
                      播放
                    </button>
                  )}
                  <button
                    onClick={() => onTakeAction(shot.shot_id, take.take_id, 'set_active')}
                    disabled={isActive}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      isActive
                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {isActive ? '当前活动' : '设为活动'}
                  </button>
                  <button
                    onClick={() => onTakeAction(shot.shot_id, take.take_id, 'approve')}
                    disabled={isApproved}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      isApproved
                        ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onTakeAction(shot.shot_id, take.take_id, 'reject')}
                    disabled={isRejected}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      isRejected
                        ? 'bg-red-600/10 text-red-400 border border-red-500/20 cursor-default'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => onDeleteTake(shot.shot_id, take.take_id)}
                    title="删除该视频版本（含文件）"
                    className="px-2.5 py-1 rounded text-xs font-medium bg-red-600/15 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import React from 'react';
import { 
  Volume2, Play, AlertCircle, Loader2, Image as ImageIcon, 
  Upload, Sparkles, Download, ArrowUp, ArrowDown, Trash2 
} from 'lucide-react';
import type { Shot } from './shot-types';
import TakesPanel from './TakesPanel';
import ShotSyncPanel from './ShotSyncPanel';
import ShotLintPanel from './ShotLintPanel';

interface ShotCardListProps {
  shots: Shot[];
  selectedShotIds: string[];
  toggleSelectShot: (id: string) => void;
  
  // Ordering
  orderingShot: string | null;
  updateShotOrder: (id: string, action: 'move_up' | 'move_down' | 'delete') => void;
  
  // Duration Edit
  editingDuration: string | null;
  durationDraft: string;
  setDurationDraft: (val: string) => void;
  beginEditDuration: (shot: Shot) => void;
  cancelEditDuration: () => void;
  commitEditDuration: (shot: Shot) => void;
  
  // VO Edit
  editingVO: string | null;
  voDraft: string;
  setVoDraft: (val: string) => void;
  beginEditVO: (shot: Shot) => void;
  cancelEditVO: () => void;
  commitEditVO: (shot: Shot) => void;
  savingVO: boolean;
  
  // Keyboard Navigation / Focus
  focusedIndex: number;
  setFocusedIndex: (idx: number) => void;
  
  // Drag & Drop / Paste
  dragOverShot: string | null;
  handlePaste: (e: React.ClipboardEvent, shotId: string) => void;
  handleDragOver: (e: React.DragEvent, shotId: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, shotId: string) => void;
  
  // Modals & Panels Active State
  activeSyncShotId: string | null;
  setActiveSyncShotId: (id: string | null) => void;
  syncingPromptShot: string | null;
  acceptingTakeShot: string | null;
  expandedShots: Record<string, boolean>;
  toggleExpandShot: (shotId: string) => void;
  
  // Uploads & Generation
  uploadingKeyframe: string | null;
  uploadKeyframe: (shotId: string, file: File | null) => void;
  uploadingVideo: string | null;
  uploadVideo: (shotId: string, file: File | null) => void;
  generatingSingle: string | null;
  generateSingleTTS: (shotId: string) => void;
  exportingShot: string | null;
  exportShotHandoff: (shotId: string) => void;
  
  // Modals handlers
  setActiveImageShot: (shot: Shot | null) => void;
  setActiveImagePromptShot: (shot: Shot | null) => void;
  setActivePromptShot: (shot: Shot | null) => void;
  
  // Lint & Takes Panels Props
  lintData: any;
  expandedLints: Record<string, boolean>;
  setExpandedLints: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  compareSel: { shotId: string; takeIds: string[] };
  handleToggleCompareTake: (shot: Shot, takeId: string) => void;
  handleUpdateReview: (shotId: string, takeId: string, rating?: number, notes?: string) => void;
  handleTakeAction: (shotId: string, takeId: string, action: string) => Promise<void>;
  deleteTake: (shotId: string, takeId: string) => Promise<void>;
  syncShotPrompts: (shotId: string) => void;
  acceptCurrentTakePrompt: (shot: Shot) => void;
}

export default function ShotCardList({
  shots,
  selectedShotIds,
  toggleSelectShot,
  orderingShot,
  updateShotOrder,
  editingDuration,
  durationDraft,
  setDurationDraft,
  beginEditDuration,
  cancelEditDuration,
  commitEditDuration,
  editingVO,
  voDraft,
  setVoDraft,
  beginEditVO,
  cancelEditVO,
  commitEditVO,
  savingVO,
  focusedIndex,
  setFocusedIndex,
  dragOverShot,
  handlePaste,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  activeSyncShotId,
  setActiveSyncShotId,
  syncingPromptShot,
  acceptingTakeShot,
  expandedShots,
  toggleExpandShot,
  uploadingKeyframe,
  uploadKeyframe,
  uploadingVideo,
  uploadVideo,
  generatingSingle,
  generateSingleTTS,
  exportingShot,
  exportShotHandoff,
  setActiveImageShot,
  setActiveImagePromptShot,
  setActivePromptShot,
  lintData,
  expandedLints,
  setExpandedLints,
  compareSel,
  handleToggleCompareTake,
  handleUpdateReview,
  handleTakeAction,
  deleteTake,
  syncShotPrompts,
  acceptCurrentTakePrompt,
}: ShotCardListProps) {
  return (
    <div className="space-y-4">
      {shots.map((shot, index) => {
        const isSelected = selectedShotIds.includes(shot.shot_id);
        const isEditingVO = editingVO === shot.shot_id;
        const isEditingDuration = editingDuration === shot.shot_id;
        const isFocused = focusedIndex === index;
        const isDraggedOver = dragOverShot === shot.shot_id;
        
        return (
          <div
            key={shot.shot_id}
            id={`shot-card-${shot.shot_id}`}
            tabIndex={0}
            onFocus={() => setFocusedIndex(index)}
            onPaste={(e) => handlePaste(e, shot.shot_id)}
            onDragOver={(e) => handleDragOver(e, shot.shot_id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, shot.shot_id)}
            className={`flex flex-col p-4 bg-slate-950 rounded-xl border transition text-left focus:outline-none ${
              isDraggedOver
                ? 'border-dashed border-purple-500 bg-purple-950/10 shadow-lg scale-[1.01]'
                : isSelected 
                ? 'border-blue-500 bg-blue-950/10 shadow-md shadow-blue-500/5' 
                : isFocused
                ? 'border-blue-500/55 bg-slate-900/50 ring-1 ring-blue-500/30'
                : 'border-slate-800 hover:border-slate-700 hover:bg-slate-950/80 shadow-sm'
            }`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              
              {/* Left Column: Metadata & Selection (span 2) */}
              <div className="lg:col-span-2 flex flex-row lg:flex-col items-center lg:items-start justify-between lg:justify-start gap-3 border-b lg:border-b-0 border-slate-800 pb-3 lg:pb-0 h-full">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectShot(shot.shot_id)}
                    className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-base text-blue-300 select-none">{shot.shot_id}</span>
                  {(() => {
                    const issues = lintData?.byShot[shot.shot_id] || [];
                    const errors = issues.filter((i: any) => i.level === 'ERROR').length;
                    const warns = issues.filter((i: any) => i.level === 'WARN').length;
                    if (errors === 0 && warns === 0) return null;
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedLints(prev => ({
                            ...prev,
                            [shot.shot_id]: !prev[shot.shot_id]
                          }));
                        }}
                        className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold ${
                          errors > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                        title={issues.map((i: any) => `[${i.level}] ${i.msg}`).join('\n')}
                      >
                        <AlertCircle size={10} />
                        {errors > 0 ? `${errors}E` : ''}
                        {warns > 0 ? `${warns}W` : ''}
                      </button>
                    );
                  })()}
                </div>
                
                <div className="flex items-center gap-1.5 lg:mt-2">
                  <button
                    onClick={() => updateShotOrder(shot.shot_id, 'move_up')}
                    disabled={index === 0 || orderingShot === shot.shot_id}
                    title="上移"
                    className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => updateShotOrder(shot.shot_id, 'move_down')}
                    disabled={index === shots.length - 1 || orderingShot === shot.shot_id}
                    title="下移"
                    className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                
                <div className="lg:mt-3">
                  {isEditingDuration ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        type="text"
                        value={durationDraft}
                        onChange={e => setDurationDraft(e.target.value)}
                        onBlur={() => commitEditDuration(shot)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEditDuration(shot);
                          else if (e.key === 'Escape') cancelEditDuration();
                        }}
                        className="w-16 bg-slate-900 border border-blue-500 rounded px-1.5 py-0.5 text-center text-xs font-semibold text-slate-100 focus:outline-none"
                      />
                      <span className="text-slate-500 text-xs font-mono">s</span>
                    </div>
                  ) : (
                    <div 
                      onClick={() => beginEditDuration(shot)}
                      className="group cursor-pointer bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-600 px-2.5 py-1 rounded-md text-slate-300 font-mono text-xs flex items-center gap-1.5 transition"
                      title="点击编辑分镜时长"
                    >
                      <span>时长: <strong className="text-slate-100">{shot.duration_s}s</strong></span>
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400 font-sans transition">修改</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Middle Column: Expanded Content & Subtitles Editing (span 6) */}
              <div className="lg:col-span-6 space-y-2">
                {isEditingVO ? (
                  <div className="space-y-3 bg-slate-900/40 p-3 rounded-lg border border-blue-500/30">
                    <textarea
                      autoFocus
                      value={voDraft}
                      onChange={e => setVoDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditVO(shot); }
                        else if (e.key === 'Escape') { e.preventDefault(); cancelEditVO(); }
                      }}
                      rows={3}
                      placeholder="输入讲解（旁白）文字 · Shift+Enter换行 · 回车保存"
                      className="w-full resize-y bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500/80 transition"
                    />
                    
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/50 pt-2">
                      {(() => {
                        const draftChars = voDraft.replace(/\s/g, '').length;
                        const baseChars = (shot.voiceover?.text || '').replace(/\s/g, '').length;
                        const target = shot.duration_s || 0;
                        const calibrated = shot._has_audio && baseChars > 0 && target > 0;
                        const rate = calibrated ? baseChars / target : 4.5;
                        const est = draftChars / rate;
                        
                        if (!calibrated) {
                          return (
                            <span
                              title="该镜尚未生成配音，无法精确估时长。请先点右侧「生成」建立时长基准（之后估算才准）。"
                              className="text-[10px] px-2 py-0.5 rounded border bg-slate-800/50 text-slate-400 border-slate-700/80"
                            >
                              未校准（估 ≈{est.toFixed(1)}s）
                            </span>
                          );
                        }
                        
                        const ratio = est / target;
                        const tone = ratio <= 1.0 ? 'emerald' : ratio <= 1.1 ? 'amber' : 'red';
                        const label = ratio <= 1.0 ? '塞得下' : ratio <= 1.1 ? '略超·可放慢' : '超太多·需缩短';
                        const cls: Record<string, string> = {
                            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                            red: 'bg-red-500/10 text-red-400 border-red-500/20',
                        };
                        return (
                          <span
                            title={`已生成配音 ${target}s（${baseChars}字 ≈ ${rate.toFixed(1)}字/秒）。草稿 ${draftChars}字 ≈ ${est.toFixed(1)}s`}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${cls[tone]}`}
                          >
                            ≈{est.toFixed(1)}s / {target}s · {label}
                          </span>
                        );
                      })()}
                      
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEditVO}
                          className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded transition"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => commitEditVO(shot)}
                          disabled={savingVO}
                          className="text-[11px] px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition disabled:opacity-50"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => beginEditVO(shot)}
                    className="group cursor-pointer hover:bg-slate-900/60 p-3 rounded-lg border border-dashed border-slate-800 hover:border-slate-700 text-left min-h-[64px] transition"
                    title="点击修改讲解/台词"
                  >
                    {shot.voiceover?.text || shot.dialogue?.text ? (
                      <div className="space-y-1.5">
                        {shot.voiceover?.text && (
                          <div className="text-xs text-slate-300 leading-relaxed">
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded mr-1.5 select-none font-medium">讲解</span>
                            {shot.voiceover.text}
                          </div>
                        )}
                        {shot.dialogue?.text && (
                          <div className="text-xs text-slate-400 leading-relaxed font-sans">
                            <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1 py-0.5 rounded mr-1.5 select-none font-medium">{shot.dialogue.speaker || '角色'}</span>
                            "{shot.dialogue.text}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600 italic text-xs flex items-center justify-center h-10">无旁白与对白台词（点击添加）</span>
                    )}
                    <div className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 mt-2 text-right transition">点击编辑文本</div>
                  </div>
                )}
              </div>
              
              {/* Right Column: Creative Buttons & Asset details (span 4) */}
              <div className="lg:col-span-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3 bg-slate-900/30 p-2 rounded-lg border border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <div className="relative w-16 h-10 rounded bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0 group/thumb">
                      <ImageIcon size={16} className="text-slate-700 absolute" />
                      {shot._selected_keyframe && (
                        <img
                          src={`/api/assets/reference/${shot._selected_keyframe}`}
                          alt="keyframe"
                          className="w-full h-full object-cover cursor-pointer absolute inset-0 z-10"
                          onClick={() => setActiveImageShot(shot)}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      {shot._selected_keyframe && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition cursor-pointer z-20" onClick={() => setActiveImageShot(shot)}>
                          <Play size={10} className="text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="text-[10px] text-slate-400">
                      <div>画面: <span className="font-mono text-slate-200">{shot._keyframes?.length || 0} 张</span></div>
                      {shot._sync_state && (
                        <div
                          onClick={() => setActiveSyncShotId(activeSyncShotId === shot.shot_id ? null : shot.shot_id)}
                          className={`cursor-pointer font-semibold underline ${
                            shot._sync_state.status === 'ok' ? 'text-emerald-500' :
                            shot._sync_state.status === 'warning' ? 'text-amber-500' : 'text-red-500'
                          }`}
                          title={shot._sync_state.reasons.join('\n')}
                        >
                          {shot._sync_state.label}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <label className="cursor-pointer px-2 py-1 bg-slate-800 hover:bg-slate-700 hover:text-slate-100 text-slate-400 rounded text-[10px] transition font-medium flex items-center gap-1">
                      {uploadingKeyframe === shot.shot_id ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                      上传图
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingKeyframe === shot.shot_id}
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            uploadKeyframe(shot.shot_id, e.target.files[0]);
                          }
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    
                    <label className="cursor-pointer px-2 py-1 bg-slate-800 hover:bg-slate-700 hover:text-slate-100 text-slate-400 rounded text-[10px] transition font-medium flex items-center gap-1">
                      {uploadingVideo === shot.shot_id ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                      {shot._video_url ? '视频已传 ✓' : '上传视频'}
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                        className="hidden"
                        disabled={uploadingVideo === shot.shot_id}
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            uploadVideo(shot.shot_id, e.target.files[0]);
                          }
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => toggleExpandShot(shot.shot_id)}
                    className={`px-2 py-1 rounded text-[10px] font-medium border transition ${
                      expandedShots[shot.shot_id]
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    版本 ({shot._takes?.length || 0})
                  </button>
                  
                  <button
                    onClick={() => generateSingleTTS(shot.shot_id)}
                    disabled={generatingSingle === shot.shot_id}
                    className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 disabled:opacity-50 rounded text-[10px] font-medium flex items-center gap-1 transition"
                  >
                    {generatingSingle === shot.shot_id ? <Loader2 size={10} className="animate-spin" /> : <Volume2 size={10} />}
                    生成配音
                  </button>
                  
                  <button
                    onClick={() => setActiveImagePromptShot(shot)}
                    className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 rounded text-[10px] font-medium flex items-center gap-1 transition"
                  >
                    <Sparkles size={10} />
                    生成照片
                  </button>
                  
                  <button
                    onClick={() => setActivePromptShot(shot)}
                    className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 rounded text-[10px] font-medium flex items-center gap-1 transition"
                  >
                    <Sparkles size={10} />
                    提示词
                  </button>
                  
                  <button
                    onClick={() => exportShotHandoff(shot.shot_id)}
                    disabled={exportingShot === shot.shot_id}
                    className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 disabled:opacity-50 rounded text-[10px] font-medium flex items-center gap-1 transition"
                  >
                    {exportingShot === shot.shot_id ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                    交接包
                  </button>
                  
                  <button
                    onClick={() => updateShotOrder(shot.shot_id, 'delete')}
                    disabled={orderingShot === shot.shot_id}
                    className="ml-auto p-1.5 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                    title="删除镜头"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              
            </div>
            
            <TakesPanel
              shot={shot}
              isExpanded={!!expandedShots[shot.shot_id]}
              compareSel={compareSel}
              onToggleCompareTake={handleToggleCompareTake}
              onUpdateReview={(shotId, takeId, rating, notes) => handleUpdateReview(shotId, takeId, rating ?? undefined, notes ?? undefined)}
              onTakeAction={handleTakeAction}
              onDeleteTake={deleteTake}
            />
            
            <ShotSyncPanel
              shot={shot}
              isSyncOpen={activeSyncShotId === shot.shot_id}
              syncingPromptShot={syncingPromptShot}
              generatingSingle={generatingSingle}
              acceptingTakeShot={acceptingTakeShot}
              onSyncPrompts={syncShotPrompts}
              onGenerateTTS={generateSingleTTS}
              onAcceptCurrentTakePrompt={acceptCurrentTakePrompt}
              onClose={() => setActiveSyncShotId(null)}
            />

            <ShotLintPanel
              shot={shot}
              isLintOpen={!!expandedLints[shot.shot_id]}
              lintIssues={lintData?.byShot[shot.shot_id] || []}
            />
          </div>
        );
      })}
    </div>
  );
}

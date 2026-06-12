"use client";

import React, { Fragment } from 'react';
import { 
  Volume2, AlertCircle, Loader2, Image as ImageIcon, 
  Upload, Sparkles, Download, ArrowUp, ArrowDown, Trash2 
} from 'lucide-react';
import type { Shot } from './shot-types';
import TakesPanel from './TakesPanel';
import ShotSyncPanel from './ShotSyncPanel';
import ShotLintPanel from './ShotLintPanel';

interface ShotTableListProps {
  shots: Shot[];
  selectedShotIds: string[];
  toggleSelectShot: (id: string) => void;
  isAllSelected: boolean;
  toggleSelectAll: () => void;
  
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

export default function ShotTableList({
  shots,
  selectedShotIds,
  toggleSelectShot,
  isAllSelected,
  toggleSelectAll,
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
}: ShotTableListProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] text-slate-400 font-medium select-none">
            <th className="p-3 w-10 text-center">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
              />
            </th>
            <th className="p-3 w-16">分镜ID</th>
            <th className="p-3 w-20">排序</th>
            <th className="p-3 w-24">时长</th>
            <th className="p-3">旁白台词 / 讲解词</th>
            <th className="p-3 w-32">画面资产</th>
            <th className="p-3 w-32">视频状态</th>
            <th className="p-3 w-40 text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-xs">
          {shots.map((shot, index) => {
            const isSelected = selectedShotIds.includes(shot.shot_id);
            const isEditingVO = editingVO === shot.shot_id;
            const isEditingDuration = editingDuration === shot.shot_id;
            
            return (
              <Fragment key={shot.shot_id}>
                <tr 
                  className={`hover:bg-slate-900/30 transition ${
                    isSelected ? 'bg-blue-950/10' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectShot(shot.shot_id)}
                      className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </td>
                  
                  {/* Shot ID */}
                  <td className="p-3 font-mono font-bold text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span>{shot.shot_id}</span>
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
                            className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold ${
                              errors > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                            title={issues.map((i: any) => `[${i.level}] ${i.msg}`).join('\n')}
                          >
                            <AlertCircle size={9} />
                            {errors > 0 ? `${errors}E` : ''}
                            {warns > 0 ? `${warns}W` : ''}
                          </button>
                        );
                      })()}
                    </div>
                  </td>
                  
                  {/* Order buttons */}
                  <td className="p-3">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => updateShotOrder(shot.shot_id, 'move_up')}
                        disabled={index === 0 || orderingShot === shot.shot_id}
                        className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => updateShotOrder(shot.shot_id, 'move_down')}
                        disabled={index === shots.length - 1 || orderingShot === shot.shot_id}
                        className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </td>
                  
                  {/* Duration Edit Inline */}
                  <td className="p-3">
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
                          className="w-12 bg-slate-900 border border-blue-500 rounded px-1.5 py-0.5 text-center text-xs text-slate-100 focus:outline-none"
                        />
                        <span className="text-slate-500 text-[10px]">s</span>
                      </div>
                    ) : (
                      <span
                        onClick={() => beginEditDuration(shot)}
                        className="cursor-pointer hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-800 text-slate-300 font-mono inline-block min-w-[40px] text-center transition"
                        title="点击修改时长"
                      >
                        {shot.duration_s}s
                      </span>
                    )}
                  </td>
                  
                  {/* Voiceover / Dialogue Text */}
                  <td className="p-3 max-w-md">
                    {isEditingVO ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <textarea
                          autoFocus
                          value={voDraft}
                          onChange={e => setVoDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditVO(shot); }
                            else if (e.key === 'Escape') { e.preventDefault(); cancelEditVO(); }
                          }}
                          onBlur={() => commitEditVO(shot)}
                          rows={1}
                          placeholder="输入讲解文字，回车保存"
                          className="flex-1 bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => beginEditVO(shot)}
                        className="cursor-pointer hover:bg-slate-900 p-1.5 rounded truncate max-w-lg text-slate-300 text-left transition"
                        title="点击修改文本"
                      >
                        {shot.voiceover?.text || shot.dialogue?.text ? (
                          <span>
                            {shot.voiceover?.text ? `[讲解] ${shot.voiceover.text}` : ''}
                            {shot.voiceover?.text && shot.dialogue?.text ? ' | ' : ''}
                            {shot.dialogue?.text ? `[${shot.dialogue.speaker}] "${shot.dialogue.text}"` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">[双击/点击添加旁白与对白台词]</span>
                        )}
                      </div>
                    )}
                  </td>
                  
                  {/* Image assets */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="relative w-8 h-6 bg-slate-950 border border-slate-800 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                        <ImageIcon size={12} className="text-slate-700 absolute" />
                        {shot._selected_keyframe && (
                          <img
                            src={`/api/assets/reference/${shot._selected_keyframe}`}
                            alt="thumb"
                            className="w-full h-full object-cover cursor-pointer absolute inset-0 z-10"
                            onClick={() => setActiveImageShot(shot)}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {shot._keyframes?.length || 0}P
                        </span>
                        <label className="cursor-pointer text-[9px] text-blue-400 hover:underline">
                          {uploadingKeyframe === shot.shot_id ? '中...' : '上传'}
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
                      </div>
                    </div>
                  </td>
                  
                  {/* Video takes and status */}
                  <td className="p-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        {shot._sync_state && (
                          <span 
                            onClick={() => setActiveSyncShotId(activeSyncShotId === shot.shot_id ? null : shot.shot_id)}
                            className={`cursor-pointer text-[9px] px-1 py-0.5 rounded font-medium border underline ${
                              shot._sync_state.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              shot._sync_state.status === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                            title={shot._sync_state.reasons.join('\n')}
                          >
                            {shot._sync_state.label}
                          </span>
                        )}
                        {shot._active_take && (
                          <span className="text-[9px] bg-slate-800 text-slate-300 px-1 py-0.5 rounded font-mono">
                            V{(shot._active_take.take_id.match(/\d+/)?.[0] || '').replace(/^0+/, '') || '1'}
                          </span>
                        )}
                      </div>
                      <label className="cursor-pointer text-[9px] text-blue-400 hover:underline">
                        {uploadingVideo === shot.shot_id ? '中...' : shot._video_url ? '重新上传' : '上传视频'}
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
                  </td>
                  
                  {/* Actions */}
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleExpandShot(shot.shot_id)}
                        className={`px-2 py-0.5 rounded text-[10px] border transition ${
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
                        className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded hover:border-slate-700 transition"
                        title="生成配音"
                      >
                        {generatingSingle === shot.shot_id ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                      </button>
                      
                      <button
                        onClick={() => setActiveImagePromptShot(shot)}
                        className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded hover:border-slate-700 transition"
                        title="生成照片"
                      >
                        <Sparkles size={12} />
                      </button>
                      
                      <button
                        onClick={() => setActivePromptShot(shot)}
                        className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded hover:border-slate-700 transition"
                        title="编辑提示词"
                      >
                        <Sparkles size={12} />
                      </button>
                      
                      <button
                        onClick={() => exportShotHandoff(shot.shot_id)}
                        className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded hover:border-slate-700 transition"
                        title="导出交接包"
                      >
                        <Download size={12} />
                      </button>
                      
                      <button
                        onClick={() => updateShotOrder(shot.shot_id, 'delete')}
                        className="p-1 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                        title="删除镜头"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
                
                {/* Takes Sub-panel row for Table View */}
                {expandedShots[shot.shot_id] && (
                  <tr className="bg-slate-900/20" key={`takes-${shot.shot_id}`}>
                    <td colSpan={8} className="p-3">
                      <TakesPanel
                        shot={shot}
                        isExpanded={true}
                        compareSel={compareSel}
                        onToggleCompareTake={handleToggleCompareTake}
                        onUpdateReview={(shotId, takeId, rating, notes) => handleUpdateReview(shotId, takeId, rating ?? undefined, notes ?? undefined)}
                        onTakeAction={handleTakeAction}
                        onDeleteTake={deleteTake}
                      />
                    </td>
                  </tr>
                )}
                
                {/* Sync Sub-panel row for Table View */}
                {activeSyncShotId === shot.shot_id && shot._sync_state && shot._sync_state.status !== 'ok' && (
                  <tr className="bg-amber-950/10" key={`sync-${shot.shot_id}`}>
                    <td colSpan={8} className="p-3">
                      <ShotSyncPanel
                        shot={shot}
                        isSyncOpen={true}
                        syncingPromptShot={syncingPromptShot}
                        generatingSingle={generatingSingle}
                        acceptingTakeShot={acceptingTakeShot}
                        onSyncPrompts={syncShotPrompts}
                        onGenerateTTS={generateSingleTTS}
                        onAcceptCurrentTakePrompt={acceptCurrentTakePrompt}
                        onClose={() => setActiveSyncShotId(null)}
                      />
                    </td>
                  </tr>
                )}

                {/* Lint Sub-panel row for Table View */}
                {expandedLints[shot.shot_id] && lintData?.byShot[shot.shot_id] && lintData.byShot[shot.shot_id].length > 0 && (
                  <tr className="bg-slate-900/40" key={`lint-${shot.shot_id}`}>
                    <td colSpan={8} className="p-3">
                      <ShotLintPanel
                        shot={shot}
                        isLintOpen={true}
                        lintIssues={lintData.byShot[shot.shot_id]}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, Fragment } from 'react';
import { Volume2, Play, RefreshCw, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, Upload, Copy, Sparkles, X, Download, Film, ArrowUp, ArrowDown, Trash2, Grid, List } from 'lucide-react';
import Player, { SubtitleStyle } from '../Player';

interface Shot {
  shot_id: string;
  duration_s: number;
  action?: { beats?: string[] };
  dialogue?: { text: string; speaker: string };
  voiceover?: { text: string; speaker?: string };
  scene_ref?: string;
  prompt?: { positive?: string; negative?: string };
  _keyframes?: string[];
  _selected_keyframe?: string | null;
  _video_url?: string | null;
  _video_prompt?: {
    prompt: string;
    prompt_shot_only?: string;
    negative: string;
    motion: string;
    condition_images?: string[];
  } | null;
  _takes?: any[];
  _active_take?: any | null;
  _filename?: string;
  _has_audio?: boolean;
  _sync_state?: {
    status: 'ok' | 'warning' | 'error';
    label: string;
    reasons: string[];
    actions: string[];
    video_prompt_state?: 'missing' | 'stale' | 'ok';
    image_prompt_state?: 'missing' | 'stale' | 'ok';
    take_prompt_state?: 'none' | 'unknown' | 'ok' | 'stale';
    audio_state?: 'none' | 'missing' | 'ok';
    current_prompt_hash?: string | null;
  };
  layout?: {
    fitMode: 'contain' | 'cover' | 'fill';
    scale: number;
    stretchX: number;
    stretchY: number;
  };
}

export default function PreviewTab() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);
  const [uploadingKeyframe, setUploadingKeyframe] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const [exportingShot, setExportingShot] = useState<string | null>(null);
  const [orderingShot, setOrderingShot] = useState<string | null>(null);
  const [activeSyncShotId, setActiveSyncShotId] = useState<string | null>(null);
  const [syncingPromptShot, setSyncingPromptShot] = useState<string | null>(null);
  const [acceptingTakeShot, setAcceptingTakeShot] = useState<string | null>(null);
  const [exportingVideo, setExportingVideo] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportWithSubtitles, setExportWithSubtitles] = useState(true);
  const [exportPreset, setExportPreset] = useState<string>('default_1080p');
  const [exportAudioSource, setExportAudioSource] = useState<'tts' | 'video'>('tts');
  const [editingVO, setEditingVO] = useState<string | null>(null); // 正在行内编辑讲解的分镜 id
  const [voDraft, setVoDraft] = useState('');
  const [savingVO, setSavingVO] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontSize: 20,
    fontFamily: '"Microsoft YaHei", sans-serif',
    textColor: '#ffffff',
    bgOpacity: 70,
    strokeWidth: 3,
  });
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [activePromptShot, setActivePromptShot] = useState<Shot | null>(null);
  const [activeImagePromptShot, setActiveImagePromptShot] = useState<Shot | null>(null);
  const [activeImageShot, setActiveImageShot] = useState<Shot | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [expandedShots, setExpandedShots] = useState<Record<string, boolean>>({});
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [showSystemPrompt, setShowSystemPrompt] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [editingDuration, setEditingDuration] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState('');
  const [savingDuration, setSavingDuration] = useState(false);
  const [previewVideoMode, setPreviewVideoMode] = useState<'local' | 'full'>('local');
  const layoutSaveTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    loadShots();
    loadProjectPrompt();
  }, []);

  const loadProjectPrompt = async () => {
    try {
      const res = await fetch('/api/project');
      if (res.ok) {
        const data = await res.json();
        if (data.project_system_prompt) {
          setSystemPrompt(data.project_system_prompt);
        }
      }
    } catch (e) {
      console.error('Failed to load project system prompt:', e);
    }
  };

  const loadShots = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shots');
      if (res.ok) {
        setShots(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isAllSelected = shots.length > 0 && selectedShotIds.length === shots.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedShotIds([]);
    } else {
      setSelectedShotIds(shots.map(s => s.shot_id));
    }
  };
  const toggleSelectShot = (shotId: string) => {
    setSelectedShotIds(prev =>
      prev.includes(shotId) ? prev.filter(id => id !== shotId) : [...prev, shotId]
    );
  };

  const toggleExpandShot = (shotId: string) => {
    setExpandedShots(prev => ({
      ...prev,
      [shotId]: !prev[shotId]
    }));
  };

  const updateShotOrder = async (shotId: string, action: 'move_up' | 'move_down' | 'delete') => {
    if (action === 'delete' && !window.confirm(`删除分镜 ${shotId}？对应画面、视频版本、配音和提示词文件也会一并删除。`)) return;
    setOrderingShot(shotId);
    setResult(null);
    try {
      const res = await fetch('/api/shots/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot_id: shotId, action })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const renamed = data.renamed && Object.keys(data.renamed).length
          ? `；重排编号 ${Object.entries(data.renamed).map(([a, b]) => `${a}→${b}`).join('、')}`
          : '';
        const promptNote = data.prompt_rebuild?.success === false ? '；提示词重编译失败，请稍后手动重编译' : '；提示词已重编译';
        setResult({ success: data.prompt_rebuild?.success !== false, message: `时间线已更新${renamed}${promptNote}` });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '更新时间线失败' });
      }
    } catch {
      setResult({ success: false, message: '更新时间线失败' });
    } finally {
      setOrderingShot(null);
    }
  };

  const handleTakeAction = async (shotId: string, takeId: string, action: string) => {
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shotId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: takeId, action })
      });
      if (res.ok) {
        setResult({ success: true, message: `操作成功：${action}` });
        await loadShots(); // Reload shots list
      } else {
        const data = await res.json();
        setResult({ success: false, message: data.error || '操作失败' });
      }
    } catch {
      setResult({ success: false, message: '操作发生异常错误' });
    }
  };

  const deleteTake = async (shotId: string, takeId: string) => {
    if (!window.confirm(`删除该视频版本（${takeId}）？此操作不可撤销。若删除的是当前版本，会自动切换到最新的剩余版本。`)) return;
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shotId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: takeId, action: 'delete' })
      });
      if (res.ok) {
        setResult({ success: true, message: `已删除视频版本 ${takeId}` });
        await loadShots();
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || '删除视频版本失败' });
      }
    } catch {
      setResult({ success: false, message: '删除视频版本失败' });
    }
  };

  const handleUpdateReview = async (shotId: string, takeId: string, rating?: number, notes?: string) => {
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shotId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          take_id: takeId, 
          action: 'update_review',
          rating,
          notes 
        })
      });
      if (res.ok) {
        await loadShots(); // Reload shots list silently
      } else {
        const data = await res.json();
        setResult({ success: false, message: data.error || '保存评审失败' });
      }
    } catch {
      setResult({ success: false, message: '保存评审失败' });
    }
  };

  const syncShotPrompts = async (shotId: string) => {
    setSyncingPromptShot(shotId);
    setResult(null);
    try {
      const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/prompts`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setResult({ success: true, message: `${shotId} Prompt 已同步` });
        await loadProjectPrompt();
        await loadShots();
      } else {
        const detail = data.video_prompts?.stderr || data.image_prompts?.stderr || data.error;
        setResult({ success: false, message: detail || `${shotId} Prompt 同步失败` });
      }
    } catch {
      setResult({ success: false, message: `${shotId} Prompt 同步失败` });
    } finally {
      setSyncingPromptShot(null);
    }
  };

  const acceptCurrentTakePrompt = async (shot: Shot) => {
    if (!shot._active_take?.take_id) return;
    setAcceptingTakeShot(shot.shot_id);
    setResult(null);
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shot.shot_id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: shot._active_take.take_id, action: 'refresh_prompt_hash' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ success: true, message: `${shot.shot_id} 已接受当前视频为新版基准` });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '更新视频基准失败' });
      }
    } catch {
      setResult({ success: false, message: '更新视频基准失败' });
    } finally {
      setAcceptingTakeShot(null);
    }
  };

  const generateTTS = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/tts/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `成功生成 ${data.count} 个音频文件` });
        await loadShots(); // 刷新镜头数据（含更新后的时长）
      } else {
        setResult({ success: false, message: data.error || '生成失败' });
      }
    } catch (e) {
      setResult({ success: false, message: '生成失败' });
    } finally {
      setGenerating(false);
    }
  };

  const generateSingleTTS = async (shotId: string) => {
    setGeneratingSingle(shotId);
    setResult(null);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot_id: shotId })
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `${shotId} 音频已生成` });
        await loadShots(); // 刷新镜头数据
      } else {
        setResult({ success: false, message: data.error || '生成失败' });
      }
    } catch (e) {
      setResult({ success: false, message: '生成失败' });
    } finally {
      setGeneratingSingle(null);
    }
  };

  const uploadKeyframe = async (shotId: string, file: File | null) => {
    if (!file) return;
    setUploadingKeyframe(shotId);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/assets/keyframes/${encodeURIComponent(shotId)}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `${shotId} 关键帧已上传` });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '上传失败' });
      }
    } catch {
      setResult({ success: false, message: '上传失败' });
    } finally {
      setUploadingKeyframe(null);
    }
  };

  const deleteKeyframe = async (shotId: string, kfUrl: string) => {
    const name = kfUrl.split('/').pop() || '';
    if (!name) return;
    if (!confirm(`确定删除 ${shotId} 的关键帧「${decodeURIComponent(name)}」？此操作不可撤销。`)) return;
    setResult(null);
    try {
      const res = await fetch(`/api/assets/keyframes/${encodeURIComponent(shotId)}/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ success: true, message: `${shotId} 关键帧已删除` });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '删除失败' });
      }
    } catch {
      setResult({ success: false, message: '删除失败' });
    }
  };

  // ===== 讲解（旁白）行内编辑 =====
  const beginEditVO = (shot: Shot) => {
    setEditingVO(shot.shot_id);
    setVoDraft(shot.voiceover?.text || '');
  };
  const cancelEditVO = () => {
    setEditingVO(null);
    setVoDraft('');
  };
  const commitEditVO = async (shot: Shot) => {
    if (savingVO) return;
    const text = voDraft.trim();
    const current = shot.voiceover?.text || '';
    if (text === current || (!text && !shot.voiceover)) { cancelEditVO(); return; }
    setSavingVO(true);
    try {
      const updated: any = { ...shot, voiceover: { ...(shot.voiceover || { speaker: '讲解' }), text } };
      const res = await fetch('/api/shots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setEditingVO(null);
        setVoDraft('');
        setResult({ success: true, message: `${shot.shot_id} 讲解已更新（重新生成配音后即同步语音）` });
        await loadShots();
      } else {
        const d = await res.json().catch(() => ({}));
        setResult({ success: false, message: d.error || '保存失败' });
      }
    } catch {
      setResult({ success: false, message: '保存失败' });
    } finally {
      setSavingVO(false);
    }
  };

  // ===== 时长行内编辑 =====
  const beginEditDuration = (shot: Shot) => {
    setEditingDuration(shot.shot_id);
    setDurationDraft(shot.duration_s.toString());
  };
  const cancelEditDuration = () => {
    setEditingDuration(null);
    setDurationDraft('');
  };
  const commitEditDuration = async (shot: Shot) => {
    if (savingDuration) return;
    const val = parseFloat(durationDraft);
    if (isNaN(val) || val <= 0) {
      setResult({ success: false, message: '请输入有效的时长值（大于 0 的数字）' });
      cancelEditDuration();
      return;
    }
    if (val === shot.duration_s) {
      cancelEditDuration();
      return;
    }
    setSavingDuration(true);
    try {
      const updated: any = { ...shot, duration_s: val };
      const res = await fetch('/api/shots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setEditingDuration(null);
        setDurationDraft('');
        setResult({ success: true, message: `${shot.shot_id} 时长已更新为 ${val}s` });
        await loadShots();
      } else {
        const d = await res.json().catch(() => ({}));
        setResult({ success: false, message: d.error || '保存时长失败' });
      }
    } catch {
      setResult({ success: false, message: '保存时长失败' });
    } finally {
      setSavingDuration(false);
    }
  };

  // ===== 批量操作处理器 =====
  const bulkSyncPrompts = async () => {
    if (selectedShotIds.length === 0) return;
    setResult(null);
    let successCount = 0;
    let failCount = 0;
    for (const shotId of selectedShotIds) {
      try {
        const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/prompts`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    setResult({
      success: failCount === 0,
      message: `批量同步 Prompt 完成：成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : '')
    });
    await loadProjectPrompt();
    await loadShots();
    setSelectedShotIds([]);
  };

  const bulkGenerateTTS = async () => {
    if (selectedShotIds.length === 0) return;
    setResult(null);
    let successCount = 0;
    let failCount = 0;
    for (const shotId of selectedShotIds) {
      try {
        const res = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shot_id: shotId })
        });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    setResult({
      success: failCount === 0,
      message: `批量生成配音完成：成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : '')
    });
    await loadShots();
    setSelectedShotIds([]);
  };

  const bulkExportHandoff = async () => {
    if (selectedShotIds.length === 0) return;
    setResult(null);
    let successCount = 0;
    let failCount = 0;
    for (const shotId of selectedShotIds) {
      try {
        const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/export`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `handoff_${shotId}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          successCount++;
          await new Promise(r => setTimeout(r, 300));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    setResult({
      success: failCount === 0,
      message: `批量导出交接包完成：成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : '')
    });
    setSelectedShotIds([]);
  };

  const bulkDeleteShots = async () => {
    if (selectedShotIds.length === 0) return;
    if (!window.confirm(`确认批量删除选中的 ${selectedShotIds.length} 个分镜？对应画面、视频版本、配音和提示词文件也会一并删除。`)) return;
    
    setResult(null);
    const sortedIds = [...selectedShotIds].sort((a, b) => {
      const indexA = shots.findIndex(s => s.shot_id === a);
      const indexB = shots.findIndex(s => s.shot_id === b);
      return indexB - indexA;
    });

    let successCount = 0;
    let failCount = 0;
    for (const shotId of sortedIds) {
      try {
        const res = await fetch('/api/shots/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shot_id: shotId, action: 'delete' })
        });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    
    setResult({
      success: failCount === 0,
      message: `批量删除分镜完成：成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : '')
    });
    await loadShots();
    setSelectedShotIds([]);
  };

  const renderTakesPanel = (shot: Shot) => {
    if (!expandedShots[shot.shot_id]) return null;
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
                      ? 'bg-blue-950/20 border-blue-500/50 shadow-md shadow-blue-500/5' 
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
                            onClick={() => handleUpdateReview(shot.shot_id, take.take_id, star, take.review?.notes)}
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
                            handleUpdateReview(shot.shot_id, take.take_id, take.review?.rating, e.target.value);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    {take.video_path && (
                      <button
                        onClick={() => window.open(`/api/assets/reference/${take.video_path}`)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                      >
                        播放
                      </button>
                    )}
                    <button
                      onClick={() => handleTakeAction(shot.shot_id, take.take_id, 'set_active')}
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
                      onClick={() => handleTakeAction(shot.shot_id, take.take_id, 'approve')}
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
                      onClick={() => handleTakeAction(shot.shot_id, take.take_id, 'reject')}
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
                      onClick={() => deleteTake(shot.shot_id, take.take_id)}
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
  };

  const renderSyncPanel = (shot: Shot) => {
    if (activeSyncShotId !== shot.shot_id || !shot._sync_state || shot._sync_state.status === 'ok') return null;
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
              onClick={() => syncShotPrompts(shot.shot_id)}
              disabled={syncingPromptShot === shot.shot_id}
              className="flex items-center gap-1 rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {syncingPromptShot === shot.shot_id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              同步 Prompt
            </button>
          )}
          {shot._sync_state.actions.includes('generate_tts') && (
            <button
              onClick={() => generateSingleTTS(shot.shot_id)}
              disabled={generatingSingle === shot.shot_id}
              className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {generatingSingle === shot.shot_id ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
              生成配音
            </button>
          )}
          {shot._sync_state.actions.includes('accept_take_prompt_hash') && shot._sync_state.video_prompt_state === 'ok' && (
            <button
              onClick={() => acceptCurrentTakePrompt(shot)}
              disabled={acceptingTakeShot === shot.shot_id}
              title="视频不重做，只把当前视频 Take 标记为匹配当前 Prompt"
              className="flex items-center gap-1 rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-50"
            >
              {acceptingTakeShot === shot.shot_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              接受当前视频
            </button>
          )}
          <button
            onClick={() => setActiveSyncShotId(null)}
            className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            <X size={12} />
            关闭
          </button>
        </div>
      </div>
    );
  };

  const renderCardView = () => {
    return (
      <div className="space-y-4">
        {shots.map((shot, index) => {
          const isSelected = selectedShotIds.includes(shot.shot_id);
          const isEditingVO = editingVO === shot.shot_id;
          const isEditingDuration = editingDuration === shot.shot_id;
          
          return (
            <div
              key={shot.shot_id}
              className={`flex flex-col p-4 bg-slate-950 rounded-xl border transition text-left ${
                isSelected 
                  ? 'border-blue-500/50 bg-blue-950/5 shadow-md shadow-blue-500/5' 
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
                
                {/* Right Column: Assets, Versions & Creative Buttons (span 4) */}
                <div className="lg:col-span-4 flex flex-col gap-2.5">
                  {/* Upper row: Thumbnail and upload status */}
                  <div className="flex items-center justify-between gap-3 bg-slate-900/30 p-2 rounded-lg border border-slate-800/50">
                    {/* Image Thumbnail */}
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
                    
                    {/* Sync details or upload actions */}
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
                  
                  {/* Action buttons list */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Versions Pill */}
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
                    
                    {/* Single TTS */}
                    <button
                      onClick={() => generateSingleTTS(shot.shot_id)}
                      disabled={generatingSingle === shot.shot_id}
                      className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 disabled:opacity-50 rounded text-[10px] font-medium flex items-center gap-1 transition"
                    >
                      {generatingSingle === shot.shot_id ? <Loader2 size={10} className="animate-spin" /> : <Volume2 size={10} />}
                      生成配音
                    </button>
                    
                    {/* Image Generator */}
                    <button
                      onClick={() => setActiveImagePromptShot(shot)}
                      className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 rounded text-[10px] font-medium flex items-center gap-1 transition"
                    >
                      <Sparkles size={10} />
                      生成照片
                    </button>
                    
                    {/* Prompt */}
                    <button
                      onClick={() => setActivePromptShot(shot)}
                      className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 rounded text-[10px] font-medium flex items-center gap-1 transition"
                    >
                      <Sparkles size={10} />
                      提示词
                    </button>
                    
                    {/* Handoff export */}
                    <button
                      onClick={() => exportShotHandoff(shot.shot_id)}
                      disabled={exportingShot === shot.shot_id}
                      className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 disabled:opacity-50 rounded text-[10px] font-medium flex items-center gap-1 transition"
                    >
                      {exportingShot === shot.shot_id ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                      交接包
                    </button>
                    
                    {/* Delete */}
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
              
              {/* Render Takes panel if expanded */}
              {renderTakesPanel(shot)}
              
              {/* Render Sync panel if active */}
              {renderSyncPanel(shot)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTableView = () => {
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
                      {shot.shot_id}
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
                        {renderTakesPanel(shot)}
                      </td>
                    </tr>
                  )}
                  
                  {/* Sync Sub-panel row for Table View */}
                  {activeSyncShotId === shot.shot_id && shot._sync_state && shot._sync_state.status !== 'ok' && (
                    <tr className="bg-amber-950/10" key={`sync-${shot.shot_id}`}>
                      <td colSpan={8} className="p-3">
                        {renderSyncPanel(shot)}
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
  };

  const renderBulkActionsBar = () => {
    if (selectedShotIds.length === 0) return null;
    return (
      <div className="sticky bottom-4 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border border-blue-500/30 rounded-xl p-4 shadow-xl shadow-blue-500/5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-5 h-5 bg-blue-600 rounded-full text-[10px] font-bold text-white font-mono">
            {selectedShotIds.length}
          </span>
          <span className="text-sm font-medium text-slate-200">已选中分镜</span>
          <button
            onClick={() => setSelectedShotIds([])}
            className="text-xs text-slate-400 hover:text-slate-200 hover:underline"
          >
            取消选择
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={bulkSyncPrompts}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Sparkles size={13} />
            批量同步 Prompt
          </button>
          
          <button
            onClick={bulkGenerateTTS}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Volume2 size={13} />
            批量生成配音
          </button>
          
          <button
            onClick={bulkExportHandoff}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download size={13} />
            批量导出交接包
          </button>
          
          <button
            onClick={bulkDeleteShots}
            className="px-3 py-1.5 bg-red-950/45 border border-red-500/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Trash2 size={13} />
            批量删除
          </button>
        </div>
      </div>
    );
  };

  const uploadVideo = async (shotId: string, file: File | null) => {
    if (!file) return;
    setUploadingVideo(shotId);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shot_id', shotId);
      const res = await fetch('/api/assets/video/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: `${shotId} 视频已成功上传${data.ffmpegSuccess ? '，并成功自动提取最后一帧作为垫图。' : '，但提取尾帧失败（已降级）。'}`
        });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '上传视频失败' });
      }
    } catch {
      setResult({ success: false, message: '上传视频失败' });
    } finally {
      setUploadingVideo(null);
    }
  };

  const handleShotLayoutChange = (shotId: string, layout: any) => {
    const currentShot = shots.find(s => s.shot_id === shotId);
    if (!currentShot) return;

    const updatedShot = {
      ...currentShot,
      layout: layout || undefined
    };

    // 1. Update state immediately so player renders correctly without waiting for save
    setShots(prevShots => prevShots.map(s => {
      if (s.shot_id === shotId) {
        return updatedShot;
      }
      return s;
    }));

    // 2. Debounce persisting the updated JSON to disk
    if (layoutSaveTimeoutRef.current[shotId]) {
      clearTimeout(layoutSaveTimeoutRef.current[shotId]);
    }

    layoutSaveTimeoutRef.current[shotId] = setTimeout(async () => {
      try {
        const res = await fetch('/api/shots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedShot)
        });
        if (!res.ok) {
          console.error('Failed to persist layout adjustment for', shotId);
        }
      } catch (e) {
        console.error('Error persisting layout adjustment:', e);
      }
      delete layoutSaveTimeoutRef.current[shotId];
    }, 500); // 500ms debounce
  };

  const exportCSV = () => {
    const csvCell = (value: any) => {
      const s = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };

    const headers = ['shot_id', 'duration_s', 'dialogue', 'voiceover', 'video_prompt', 'negative_prompt', 'camera_motion', 'reference_images', 'conditioning_keyframes', 'keyframe_dir'];
    const rows = [headers.join(',')];

    for (const shot of shots) {
      const pkg = shot._video_prompt;
      rows.push([
        shot.shot_id,
        shot.duration_s,
        shot.dialogue?.text || '',
        shot.voiceover?.text || '',
        pkg?.prompt || '',
        pkg?.negative || '',
        pkg?.motion || '',
        pkg?.condition_images || [],
        shot._keyframes || [],
        `assets/renders/${shot.shot_id}/keyframes`
      ].map(csvCell).join(','));
    }

    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `storyboard-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    const md = [
      '# Video Prompt Storyboard',
      '',
      '每个镜头的视频生成提示词。复制 "Prompt" 和 "Negative" 到视频生成工具，可用 conditioning keyframes 做 img2vid。',
      '',
      `共 ${shots.length} 个镜头。`,
      ''
    ];

    for (const shot of shots) {
      const pkg = shot._video_prompt;
      md.push(
        `## ${shot.shot_id} (${shot.duration_s}s)`,
        '',
        `Camera: ${pkg?.motion || 'N/A'}`,
        '',
        shot.dialogue?.text
          ? `Dialogue: **${shot.dialogue.speaker}**: ${shot.dialogue.text}`
          : '',
        shot.voiceover?.text
          ? `Voiceover: ${shot.voiceover.text}`
          : '',
        '',
        '### Prompt',
        '',
        '```text',
        pkg?.prompt || '',
        '```',
        '',
        '### Negative',
        '',
        '```text',
        pkg?.negative || '',
        '```',
        '',
        pkg?.condition_images?.length
          ? `Conditioning images/keyframes available: ${pkg.condition_images.length} image(s)`
          : `Keyframe dir: \`assets/renders/${shot.shot_id}/keyframes\` (empty)`,
        '',
        '---',
        ''
      );
    }

    const blob = new Blob([md.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `storyboard-${new Date().toISOString().slice(0, 10)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportVideo = async (withSubtitles: boolean) => {
    setShowExportDialog(false);
    setExportingVideo(true);
    setResult(null);
    try {
      const res = await fetch('/api/export/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: exportPreset,
          audioSource: exportAudioSource,
          subtitles: withSubtitles,
          subFontSize: subtitleStyle.fontSize,
          subFontFamily: subtitleStyle.fontFamily,
          subColor: subtitleStyle.textColor,
          subBgOpacity: subtitleStyle.bgOpacity / 100,
          subStrokeWidth: subtitleStyle.strokeWidth
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `film_${new Date().toISOString().slice(0, 10)}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setResult({ success: true, message: '视频导出成功' });
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || '导出失败' });
      }
    } catch {
      setResult({ success: false, message: '导出视频失败' });
    } finally {
      setExportingVideo(false);
    }
  };

  const exportShotHandoff = async (shotId: string) => {
    setExportingShot(shotId);
    try {
      const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `handoff_${shotId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || '导出交接包失败' });
      }
    } catch {
      setResult({ success: false, message: '导出交接包失败' });
    } finally {
      setExportingShot(null);
    }
  };

  const syncChipClass = (shot: Shot) => {
    const sync = shot._sync_state;
    if (!sync) return '';
    if (sync.video_prompt_state === 'missing' || sync.image_prompt_state === 'missing') {
      return 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20';
    }
    if (sync.take_prompt_state === 'stale') {
      return 'bg-orange-500/10 text-orange-300 border-orange-500/30 hover:bg-orange-500/20';
    }
    return 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20';
  };

  const shotsWithDialogue = shots.filter(s => s.dialogue);
  const shotsWithVoiceover = shots.filter(s => s.voiceover);
  const shotsWithKeyframes = shots.filter(s => (s._keyframes?.length || 0) > 0);
  const totalDuration = shots.reduce((acc, s) => acc + s.duration_s, 0);

  if (loading) return <div className="p-8 text-slate-400">加载中...</div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-start gap-3 w-full">
        <button
          onClick={loadShots}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white border border-transparent rounded-lg transition text-sm"
        >
          <RefreshCw size={16} />
          刷新
        </button>
        <button
          onClick={exportCSV}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-300 border border-blue-500/20 hover:bg-blue-600/30 rounded-lg transition text-sm"
        >
          <Download size={16} />
          导出 CSV 故事板
        </button>
        <button
          onClick={exportMarkdown}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-300 border border-purple-500/20 hover:bg-purple-600/30 rounded-lg transition text-sm"
        >
          <Download size={16} />
          导出 Markdown 故事板
        </button>
        {systemPrompt && (
          <button
            onClick={() => setShowSystemPrompt(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-600/30 rounded-lg transition text-sm"
          >
            <Sparkles size={16} />
            全局系统提示词
          </button>
        )}
        <button
          onClick={generateTTS}
          disabled={generating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white border border-transparent rounded-lg transition text-sm disabled:opacity-50"
        >
          <Volume2 size={16} />
          {generating ? '生成中...' : '生成全部 TTS'}
        </button>
        <button
          onClick={() => setShowExportDialog(true)}
          disabled={exportingVideo}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white border border-transparent rounded-lg transition text-sm disabled:opacity-50"
        >
          <Film size={16} />
          {exportingVideo ? '合成中...' : '导出 MP4'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-blue-400">{shots.length}</div>
          <div className="text-sm text-slate-400">总镜头数</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-yellow-400">{shotsWithDialogue.length}</div>
          <div className="text-sm text-slate-400">有对白镜头</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-emerald-400">{shotsWithVoiceover.length}</div>
          <div className="text-sm text-slate-400">有讲解镜头</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-purple-400">
            {shotsWithKeyframes.length}
          </div>
          <div className="text-sm text-slate-400">已回填画面</div>
        </div>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          result.success
            ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800'
            : 'bg-red-900/30 text-red-300 border border-red-800'
        }`}>
          {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {result.message}
        </div>
      )}

      {/* Player */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
          <Play size={18} className="text-blue-400" />
          配音漫画播放器
        </h3>
        <Player shots={shots} subtitleStyle={subtitleStyle} onSubtitleStyleChange={setSubtitleStyle} onShotLayoutChange={handleShotLayoutChange} onCaptured={loadShots} />
      </div>

      {/* Shot List with Switchable Views */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-200">镜头列表</h3>
            <span className="text-xs bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">
              {shots.length} 个镜头
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Multi-select indicator & Select All button for Card View */}
            {viewMode === 'card' && (
              <button
                onClick={toggleSelectAll}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition"
              >
                {isAllSelected ? '取消全选' : '全选'}
              </button>
            )}

            {/* View switcher */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              <button
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  viewMode === 'card'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="卡片看板视图"
              >
                <Grid size={13} />
                卡片
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="表格对齐视图"
              >
                <List size={13} />
                列表
              </button>
            </div>
          </div>
        </div>

        {/* View rendering */}
        {viewMode === 'card' ? renderCardView() : renderTableView()}
      </div>

      {/* Floating Bulk Actions Bar */}
      {renderBulkActionsBar()}

      {/* Help */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
        <strong className="text-slate-300">提示：</strong>
        音频文件保存在 <code className="text-blue-300">assets/audio/</code>，关键帧保存在{' '}
        <code className="text-blue-300">assets/renders/&lt;shot_id&gt;/keyframes/</code>。
        播放器会优先显示每个镜头的第一张关键帧。
      </div>

      {/* Image Preview Modal */}
      {activeImageShot && activeImageShot._keyframes && activeImageShot._keyframes.length > 0 && (
        <ImagePreviewModal
          shot={activeImageShot}
          onClose={() => setActiveImageShot(null)}
          onDelete={async (kfUrl) => {
            await deleteKeyframe(activeImageShot.shot_id, kfUrl);
            setActiveImageShot(null);
          }}
        />
      )}

      {/* Image Prompt Modal for photo generation */}
      {activeImagePromptShot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="text-purple-400" size={20} />
                {activeImagePromptShot.shot_id} 分镜头照片参考提示词
              </h3>
              <button
                onClick={() => {
                  setActiveImagePromptShot(null);
                  setIsCopied(false);
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              {/* Shot Info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>时长: <span className="text-slate-200">{activeImagePromptShot.duration_s}s</span></div>
                <div>场景: <span className="text-slate-200">{activeImagePromptShot.scene_ref || '—'}</span></div>
                {activeImagePromptShot.action?.beats && (
                  <div className="col-span-2">动作: <span className="text-slate-200">{activeImagePromptShot.action.beats.join('，')}</span></div>
                )}
                {activeImagePromptShot.voiceover?.text && (
                  <div className="col-span-2">旁白: <span className="text-emerald-300">"{activeImagePromptShot.voiceover.text}"</span></div>
                )}
              </div>

              {activeImagePromptShot.prompt?.positive ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-2">
                    <div>画幅: <span className="text-slate-200">16:9</span></div>
                    <div>画质: <span className="text-slate-200">8K, photorealistic, highly detailed</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">正向提示词</span>
                      <button
                        onClick={() => {
                          const full = `16:9, ${activeImagePromptShot.prompt!.positive}, photorealistic, highly detailed, 8K`;
                          navigator.clipboard.writeText(full);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <Copy size={12} />
                        {isCopied ? '已复制' : '复制（含质量词）'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-emerald-300 font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {activeImagePromptShot.prompt.positive}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">负向提示词</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeImagePromptShot.prompt!.negative!);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <Copy size={12} />
                        {isCopied ? '已复制' : '复制'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-red-300 font-mono text-xs whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                      {activeImagePromptShot.prompt.negative || 'blurry, low quality, distorted, text artifacts, watermark, logo'}
                    </pre>
                  </div>

                  <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg text-xs text-blue-300">
                    画幅 16:9，推荐分辨率 1920x1080。复制上方提示词到 Stable Diffusion / Midjourney / DALL·E 生成关键帧，生成后通过「上传画面」回填。
                  </div>
                </>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <div className="text-yellow-500 text-4xl">⚠️</div>
                  <h4 className="text-slate-200 font-semibold">暂无参考提示词</h4>
                  <p className="text-slate-400 max-w-sm mx-auto text-xs leading-relaxed">
                    本镜头未包含图像生成提示词。请先运行<strong>「剧本拆分」</strong>由 AI 自动生成，或手动在分镜编辑中填写 prompt 字段。
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setActiveImagePromptShot(null);
                  setIsCopied(false);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                关闭
              </button>
              {activeImagePromptShot.prompt?.positive && (
                <button
                  onClick={() => {
                    const fullText = `正向提示词:\n${activeImagePromptShot.prompt!.positive}\n\n负向提示词:\n${activeImagePromptShot.prompt!.negative || '无'}`;
                    navigator.clipboard.writeText(fullText);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
                >
                  <Copy size={16} />
                  {isCopied ? '已复制！' : '一键复制全部'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prompt Preview Modal (Video) */}
      {activePromptShot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="text-purple-400" size={20} />
                {activePromptShot.shot_id} 视频生成提示词预览
              </h3>
              <button
                onClick={() => {
                  setActivePromptShot(null);
                  setIsCopied(false);
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              {activePromptShot._video_prompt ? (
                <>
                  {/* Prompt Text */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-slate-400 font-medium">正向提示词 (Positive Prompt)</span>
                      <div className="flex items-center gap-3">
                        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                          <button
                            onClick={() => setPreviewVideoMode('local')}
                            className={`px-2 py-1 rounded transition-all ${previewVideoMode === 'local' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                          >
                            仅分镜提示词
                          </button>
                          <button
                            onClick={() => setPreviewVideoMode('full')}
                            className={`px-2 py-1 rounded transition-all ${previewVideoMode === 'full' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                          >
                            完整提示词
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            const val = previewVideoMode === 'local'
                              ? (activePromptShot._video_prompt!.prompt_shot_only || activePromptShot._video_prompt!.prompt)
                              : activePromptShot._video_prompt!.prompt;
                            navigator.clipboard.writeText(val);
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          {isCopied ? '已复制！' : '复制正向'}
                        </button>
                      </div>
                    </div>
                    <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-emerald-300 font-mono text-xs whitespace-pre-wrap select-all max-h-48 overflow-y-auto leading-relaxed">
                      {previewVideoMode === 'local'
                        ? (activePromptShot._video_prompt.prompt_shot_only || activePromptShot._video_prompt.prompt)
                        : activePromptShot._video_prompt.prompt}
                    </pre>
                  </div>

                  {/* Negative Prompt Text */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">负向提示词 (Negative Prompt)</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activePromptShot._video_prompt!.negative);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        {isCopied ? '已复制！' : '复制负向'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-red-300 font-mono text-xs whitespace-pre-wrap select-all max-h-36 overflow-y-auto leading-relaxed">
                      {activePromptShot._video_prompt.negative}
                    </pre>
                  </div>

                  {/* Camera Motion */}
                  {activePromptShot._video_prompt.motion && (
                    <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-slate-800 text-xs">
                      <div className="col-span-1 text-slate-500">相机运动 (Camera Motion)</div>
                      <div className="col-span-2 text-slate-300 font-mono">{activePromptShot._video_prompt.motion}</div>
                    </div>
                  )}

                  {/* Conditioning Images */}
                  {activePromptShot._video_prompt.condition_images && activePromptShot._video_prompt.condition_images.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-slate-400 font-medium">条件参考图 (Conditioning Images)</span>
                      <div className="text-xs text-slate-500 mb-1">
                        外部工具生成时可上传这些参考图进行垫图（首尾帧插值或身份保持）
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 bg-slate-950 border border-slate-800 rounded-xl">
                        {activePromptShot._video_prompt.condition_images.map((img: string, idx: number) => (
                          <div key={idx} className="truncate text-slate-400 font-mono text-xs p-1 hover:text-white flex items-center justify-between gap-2">
                            <span className="truncate">• {img.split('/').pop()}</span>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(img);
                                  const blob = await response.blob();
                                  const blobUrl = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = blobUrl;
                                  a.download = img.split('/').pop() || 'keyframe.png';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(blobUrl);
                                } catch (err) {
                                  console.error('Download failed:', err);
                                }
                              }}
                              className="text-blue-400 hover:text-blue-300 text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 flex-shrink-0"
                            >
                              下载
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <div className="text-yellow-500 text-4xl">⚠️</div>
                  <h4 className="text-slate-200 font-semibold">提示词未编译</h4>
                  <p className="text-slate-400 max-w-sm mx-auto text-xs leading-relaxed">
                    本镜头的 final.json 提示词文件不存在。请前往<strong>“自动化工具”</strong>页签运行<strong>“视频提示词”</strong>编译工具后再试。
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setActivePromptShot(null);
                  setIsCopied(false);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                关闭
              </button>
              {activePromptShot._video_prompt && (
                <button
                  onClick={() => {
                    const promptVal = previewVideoMode === 'local'
                      ? (activePromptShot._video_prompt!.prompt_shot_only || activePromptShot._video_prompt!.prompt)
                      : activePromptShot._video_prompt!.prompt;
                    const fullText = `Prompt:\n${promptVal}\n\nNegative:\n${activePromptShot._video_prompt!.negative}`;
                    navigator.clipboard.writeText(fullText);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
                >
                  <Copy size={16} />
                  {isCopied ? '已复制！' : '一键复制提示词'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 导出确认对话框 */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Film className="text-red-400" size={20} />
                导出 MP4 视频
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">
                将 {shots.length} 个分镜合成为一个 MP4 视频文件。
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">导出分辨率预设</label>
                <select
                  value={exportPreset}
                  onChange={e => setExportPreset(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition font-medium"
                >
                  <option value="default_1080p">宽屏 1080p (1920x1080, 16:9)</option>
                  <option value="vertical_1080x1920">竖屏 1080x1920 (1080x1920, 9:16)</option>
                  <option value="square_1080">方屏 1080p (1080x1080, 1:1)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  声音来源
                  <span className="ml-2 font-normal text-slate-500">当前：{exportAudioSource === 'tts' ? 'TTS 配音（默认）' : '画面自带声音'}</span>
                </label>
                <div className="inline-flex rounded-lg border border-slate-800 overflow-hidden text-sm w-full">
                  <button
                    type="button"
                    onClick={() => setExportAudioSource('tts')}
                    className={`flex-1 px-3 py-2 transition ${exportAudioSource === 'tts' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}
                  >
                    TTS 配音 · 默认
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportAudioSource('video')}
                    className={`flex-1 px-3 py-2 transition border-l border-slate-800 ${exportAudioSource === 'video' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}
                  >
                    画面自带声音
                  </button>
                </div>
                <div className="text-xs text-slate-500 mt-1.5">
                  {exportAudioSource === 'tts'
                    ? '✓ 全程使用 TTS 配音，视频片段静音只作画面（视频自带声音不会被导出）。'
                    : '视频片段使用其自带声音；无音轨的片段回退到 TTS 配音。'}
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition">
                <input
                  type="checkbox"
                  checked={exportWithSubtitles}
                  onChange={e => setExportWithSubtitles(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm text-slate-200 font-medium">烧录字幕</div>
                  <div className="text-xs text-slate-500">将旁白/对白文字烧录到视频底部，类似电影字幕</div>
                </div>
              </label>
              {exportWithSubtitles && (
                <div className="text-xs text-slate-500 bg-slate-800/30 rounded-lg p-3 space-y-1">
                  <div className="text-slate-400">当前字幕样式：<span className="text-slate-300">白字黑描边</span></div>
                  <div className="text-slate-300">字号: <span className="text-white">{subtitleStyle.fontSize}px</span> · 字体: <span className="text-white">{subtitleStyle.fontFamily.split(',')[0].replace(/"/g, '')}</span></div>
                  <div className="text-slate-300">颜色: <span className="inline-block w-3 h-3 rounded-full align-middle border border-slate-500" style={{backgroundColor: subtitleStyle.textColor}}></span> · 描边: <span className="text-white">{subtitleStyle.strokeWidth}px</span></div>
                  <div className="bg-black rounded-lg p-2 mt-1 text-center" style={{
                    fontSize: `${Math.min(subtitleStyle.fontSize, 14)}px`,
                    fontFamily: subtitleStyle.fontFamily,
                    color: subtitleStyle.textColor,
                    textShadow: subtitleStyle.strokeWidth > 0
                      ? `${subtitleStyle.strokeWidth}px ${subtitleStyle.strokeWidth}px 0 #000, -${subtitleStyle.strokeWidth}px -${subtitleStyle.strokeWidth}px 0 #000, ${subtitleStyle.strokeWidth}px -${subtitleStyle.strokeWidth}px 0 #000, -${subtitleStyle.strokeWidth}px ${subtitleStyle.strokeWidth}px 0 #000, 0 ${subtitleStyle.strokeWidth}px 0 #000, 0 -${subtitleStyle.strokeWidth}px 0 #000, ${subtitleStyle.strokeWidth}px 0 0 #000, -${subtitleStyle.strokeWidth}px 0 0 #000`
                      : 'none',
                    fontWeight: 600,
                  }}>
                    {(shots.map(s => s.voiceover?.text || s.dialogue?.text).find(Boolean) || '字幕预览示例').split(/(?<=[。，,.;；!！?？])/)[0]}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition"
              >
                取消
              </button>
              <button
                onClick={() => exportVideo(exportWithSubtitles)}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
              >
                <Film size={16} />
                开始导出
              </button>
            </div>
          </div>
        </div>
      )}

      {showSystemPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="text-indigo-400" size={20} />
                项目全局系统提示词 (Project System Prompt)
              </h3>
              <button
                onClick={() => {
                  setShowSystemPrompt(false);
                  setIsCopied(false);
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-sm">
              <p className="text-slate-400 text-xs leading-relaxed bg-indigo-950/20 border border-indigo-900/30 p-3 rounded-lg">
                💡 <strong>使用说明</strong>：复制下方全局系统提示词，粘贴到 ChatGPT / Gemini 会话的第一轮输入中。建立会话上下文之后，你再生成每一个镜头时，只需输入分镜提示词（可选择剥离全局的独立版本），即可大幅降低画面和连续性漂移，保持全局角色与场景一致！
              </p>
              <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-slate-300 font-mono text-xs whitespace-pre-wrap select-all max-h-[45vh] overflow-y-auto leading-relaxed">
                {systemPrompt}
              </pre>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSystemPrompt(false);
                  setIsCopied(false);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(systemPrompt);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
              >
                <Copy size={16} />
                {isCopied ? '已复制！' : '一键复制系统提示词'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ImagePreviewModalProps {
  shot: Shot;
  onClose: () => void;
  onDelete?: (kfUrl: string) => void | Promise<void>;
}

function ImagePreviewModal({ shot, onClose, onDelete }: ImagePreviewModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [copyStatus, setCopyStatus] = useState('复制图片');
  const images = shot._keyframes || [];
  const activeImg = images[currentIdx];

  const handleDownload = async () => {
    if (!activeImg) return;
    try {
      const response = await fetch(activeImg);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeImg.split('/').pop() || `${shot.shot_id}_keyframe.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyImage = async () => {
    if (!activeImg) return;
    setCopyStatus('读取中...');
    try {
      const response = await fetch(activeImg);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopyStatus('已复制！');
      setTimeout(() => setCopyStatus('复制图片'), 2000);
    } catch (err) {
      console.error('Clipboard copy failed: ', err);
      try {
        const fullUrl = window.location.origin + activeImg;
        await navigator.clipboard.writeText(fullUrl);
        setCopyStatus('已复制链接');
        setTimeout(() => setCopyStatus('复制图片'), 2000);
      } catch {
        setCopyStatus('复制失败');
        setTimeout(() => setCopyStatus('复制图片'), 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <ImageIcon className="text-blue-400" size={20} />
            {shot.shot_id} 分镜画面预览 ({currentIdx + 1}/{images.length})
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-950 p-6 flex flex-col items-center justify-center min-h-[300px] overflow-hidden relative">
          {activeImg ? (
            <img
              src={activeImg}
              alt={`${shot.shot_id} keyframe`}
              className="max-h-[50vh] object-contain rounded-lg shadow-lg border border-slate-800"
            />
          ) : (
            <div className="text-slate-500 text-sm">图片不存在</div>
          )}

          {/* Navigation Dots / Thumbnail */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto max-w-full p-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-12 h-12 rounded border-2 transition overflow-hidden flex-shrink-0 ${
                    idx === currentIdx ? 'border-blue-500' : 'border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <span className="text-xs text-slate-500 font-mono truncate max-w-[250px]">
            {activeImg ? activeImg.split('/').pop() : ''}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
            >
              关闭
            </button>
            {onDelete && activeImg && (
              <button
                onClick={() => onDelete(activeImg)}
                className="px-4 py-2 bg-red-600/20 text-red-300 border border-red-500/20 hover:bg-red-600/30 rounded-lg text-sm transition"
              >
                删除此图
              </button>
            )}
            <button
              onClick={handleCopyImage}
              className="px-4 py-2 bg-blue-600/20 text-blue-300 border border-blue-500/20 hover:bg-blue-600/30 rounded-lg text-sm transition"
            >
              {copyStatus}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              下载图片
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

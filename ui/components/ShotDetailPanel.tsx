"use client";

import { useState, useEffect, useRef } from 'react';
import {
  Clapperboard, Clock, MessageSquare, Camera, Sparkles,
  CheckCircle, AlertCircle, Loader2, Copy, Upload, Trash2,
  Star, FileText, Link, Film, Play, Move
} from 'lucide-react';
import BlockingEditor from './BlockingEditor';

export interface Shot {
  shot_id: string;
  duration_s: number;
  scene_ref: string;
  cam_setup_ref?: string;
  characters: { ref: string }[];
  props: { ref: string; state: string }[];
  action: { beats: string[] };
  dialogue?: { speaker: string; text: string; voice_id: string };
  voiceover?: { speaker?: string; text: string };
  budget: { tier: string; max_regen: number };
  prompt: { positive: string; negative: string };
  blocking?: any;
  context_refs?: string[];
  _keyframes?: string[];
  _video_url?: string | null;
  _filename?: string;
}

interface ShotDetailPanelProps {
  initialShot: Shot;
  isDraft: boolean;
  onSave: (s: Shot) => Promise<void>;
  onPromote?: (s: Shot) => Promise<void>;
  onReload: () => void;
}

export default function ShotDetailPanel({
  initialShot,
  isDraft,
  onSave,
  onPromote,
  onReload
}: ShotDetailPanelProps) {
  const [shot, setShot] = useState<Shot>(initialShot);
  const [activeTab, setActiveTab] = useState<'edit' | 'blocking' | 'assets' | 'prompts' | 'takes'>('edit');
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  
  // Local operation states
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingKeyframe, setUploadingKeyframe] = useState(false);
  
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);
  const [isCopied, setIsCopied] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [videoPromptMode, setVideoPromptMode] = useState<'local' | 'full'>('local');
  const [imagePromptMode, setImagePromptMode] = useState<'local' | 'full'>('local');

  useEffect(() => {
    setShot(initialShot);
    fetchShotDetails(initialShot.shot_id);

    if (typeof window !== 'undefined') {
      const subtab = localStorage.getItem('redirect_to_subtab');
      if (subtab === 'blocking') {
        setActiveTab('blocking');
        localStorage.removeItem('redirect_to_subtab');
      }
    }
  }, [initialShot]);

  const fetchShotDetails = async (shotId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
        if (data.shot) {
          setShot({
            ...initialShot,
            ...data.shot
          });
        }
      }
    } catch (e) {
      console.error('Error fetching shot details:', e);
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type: 'success' | 'error', message: string, details?: string) => {
    setStatus({ type, message, details });
    setTimeout(() => setStatus(null), 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(shot);
      showStatus('success', '镜头配置已保存');
      await fetchShotDetails(shot.shot_id);
    } catch (err: any) {
      showStatus('error', err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`/api/shots/${encodeURIComponent(shot.shot_id)}/validate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showStatus('success', '结构校验与业务 Lint 检查通过！');
      } else {
        const lintErrors = data.lint?.stdout || data.lint?.stderr || '校验失败';
        showStatus('error', '校验未通过', lintErrors);
      }
    } catch {
      showStatus('error', '网络异常，校验失败');
    } finally {
      setValidating(false);
    }
  };

  const handleCompilePrompts = async () => {
    setCompiling(true);
    try {
      const res = await fetch(`/api/shots/${encodeURIComponent(shot.shot_id)}/prompts`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showStatus('success', '提示词编译成功！');
        await fetchShotDetails(shot.shot_id);
        onReload();
      } else {
        showStatus('error', '编译提示词失败');
      }
    } catch {
      showStatus('error', '网络异常，编译失败');
    } finally {
      setCompiling(false);
    }
  };

  const handleSaveAndCompilePrompts = async () => {
    setSaving(true);
    try {
      await onSave(shot);
    } catch (err: any) {
      showStatus('error', err.message || '保存失败');
      setSaving(false);
      return;
    }
    setSaving(false);
    await handleCompilePrompts();
  };

  const handleUploadKeyframe = async (file: File | null) => {
    if (!file) return;
    setUploadingKeyframe(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/assets/keyframes/${encodeURIComponent(shot.shot_id)}/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        showStatus('success', '关键帧图片上传成功！');
        await fetchShotDetails(shot.shot_id);
        onReload();
      } else {
        const data = await res.json();
        showStatus('error', data.error || '上传图片失败');
      }
    } catch {
      showStatus('error', '上传图片出错');
    } finally {
      setUploadingKeyframe(false);
    }
  };

  const handleDeleteKeyframe = async (kfUrl: string) => {
    const name = kfUrl.split('/').pop() || '';
    if (!name) return;
    if (!confirm(`确定删除关键帧「${decodeURIComponent(name)}」？此操作不可撤销。`)) return;
    try {
      const res = await fetch(`/api/assets/keyframes/${encodeURIComponent(shot.shot_id)}/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showStatus('success', '关键帧已删除');
        await fetchShotDetails(shot.shot_id);
        onReload();
      } else {
        const data = await res.json().catch(() => ({}));
        showStatus('error', data.error || '删除关键帧失败');
      }
    } catch {
      showStatus('error', '删除关键帧出错');
    }
  };

  const handleUploadVideo = async (file: File | null) => {
    if (!file) return;
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shot_id', shot.shot_id);
      const res = await fetch('/api/assets/video/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showStatus('success', `视频 Take 上传成功${data.ffmpegSuccess ? '，并成功提取尾帧关键帧！' : '，提取尾帧失败（已降级）'}`);
        await fetchShotDetails(shot.shot_id);
        onReload();
      } else {
        showStatus('error', data.error || '上传视频失败');
      }
    } catch {
      showStatus('error', '上传视频出错');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleTakeAction = async (takeId: string, action: string) => {
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shot.shot_id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: takeId, action })
      });
      if (res.ok) {
        showStatus('success', `Take 状态已更新: ${action}`);
        await fetchShotDetails(shot.shot_id);
        onReload();
      } else {
        const data = await res.json();
        showStatus('error', data.error || '更新失败');
      }
    } catch {
      showStatus('error', '网络异常');
    }
  };

  const handleUpdateTakeReview = async (takeId: string, rating?: number, notes?: string) => {
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shot.shot_id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: takeId, action: 'update_review', rating, notes })
      });
      if (res.ok) {
        await fetchShotDetails(shot.shot_id);
      }
    } catch (e) {
      console.error('Error updating review:', e);
    }
  };

  const handleOptimizePrompt = async () => {
    setOptimizing(true);
    try {
      const res = await fetch('/api/ai/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: shot.prompt?.positive || '',
          negative_prompt: shot.prompt?.negative || ''
        })
      });
      const data = await res.json();
      if (res.ok && data.result) {
        let content = data.result.trim();
        if (content.startsWith('```')) {
          content = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        }
        try {
          const parsed = JSON.parse(content);
          setShot(prev => ({
            ...prev,
            prompt: {
              positive: parsed.positive_prompt || prev.prompt?.positive || '',
              negative: parsed.negative_prompt || prev.prompt?.negative || ''
            }
          }));
        } catch {
          setShot(prev => ({
            ...prev,
            prompt: {
              ...prev.prompt,
              positive: content
            }
          }));
        }
        showStatus('success', 'AI 优化提示词成功！');
      } else {
        showStatus('error', `优化失败: ${data.error || '未知错误'}`);
      }
    } catch {
      showStatus('error', '网络错误，优化失败');
    } finally {
      setOptimizing(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(type);
    setTimeout(() => setIsCopied(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Panel Header */}
      <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clapperboard className="text-blue-400" size={24} />
          <div>
            <h2 className="text-lg font-bold font-mono text-slate-100 flex items-center gap-2">
              {shot.shot_id}
              {isDraft && <span className="bg-amber-500/10 text-amber-400 text-xs px-2 py-0.5 rounded border border-amber-500/20">DRAFT</span>}
            </h2>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Clock size={12} /> {shot.duration_s} 秒 · 场景: {shot.scene_ref || '未指定'}
            </p>
          </div>
        </div>

        {/* Local operation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-semibold transition"
          >
            {validating ? <Loader2 size={12} className="animate-spin" /> : null}
            安检 Lint
          </button>
          <button
            onClick={handleCompilePrompts}
            disabled={compiling}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/20 disabled:opacity-50 rounded-lg text-xs font-semibold transition"
          >
            {compiling ? <Loader2 size={12} className="animate-spin" /> : null}
            编译 Prompt
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/20 disabled:opacity-50 rounded-lg text-xs font-semibold transition">
            {uploadingKeyframe ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            上传画面
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              disabled={uploadingKeyframe}
              onChange={(e) => handleUploadKeyframe(e.target.files?.[0] || null)}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition">
            {uploadingVideo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            上传 Video
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              disabled={uploadingVideo}
              onChange={(e) => handleUploadVideo(e.target.files?.[0] || null)}
            />
          </label>
          {isDraft && onPromote && (
            <button
              onClick={() => onPromote(shot)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition"
            >
              移至正式
            </button>
          )}
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-800 bg-slate-950 px-4">
        {[
          { id: 'edit', label: '分镜编辑', icon: FileText },
          { id: 'blocking', label: '空间调度', icon: Move },
          { id: 'assets', label: '资源与引用', icon: Link },
          { id: 'prompts', label: '编译提示词', icon: Sparkles },
          { id: 'takes', label: '版本审片', icon: Film }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition ${
                activeTab === t.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {t.label}
              {t.id === 'takes' && detailData?.history?.takes?.length > 0 && (
                <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                  {detailData.history.takes.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Status alert message */}
        {status && (
          <div className={`p-4 rounded-xl border flex flex-col gap-1.5 transition-all ${
            status.type === 'success'
              ? 'bg-emerald-950/20 text-emerald-300 border-emerald-800/40'
              : 'bg-red-950/20 text-red-300 border-red-800/40'
          }`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {status.message}
            </div>
            {status.details && (
              <pre className="text-xs bg-slate-950/50 p-2.5 rounded font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-slate-400 mt-1 leading-relaxed border border-slate-900">
                {status.details}
              </pre>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> 加载详情中...
          </div>
        ) : (
          <>
            {/* TAB 1: Specs Editor */}
            {activeTab === 'edit' && (
              <div className="space-y-6">
                {/* 1. Basic specifications */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/40 p-5 rounded-xl border border-slate-850">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">镜头 ID</label>
                    <input
                      type="text"
                      value={shot.shot_id}
                      onChange={(e) => setShot({ ...shot, shot_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">时长 (秒)</label>
                    <input
                      type="number"
                      value={shot.duration_s}
                      onChange={(e) => setShot({ ...shot, duration_s: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">场景引用</label>
                    <input
                      type="text"
                      value={shot.scene_ref}
                      onChange={(e) => setShot({ ...shot, scene_ref: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm font-mono focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">运镜机位 (Cam Setup)</label>
                    <input
                      type="text"
                      value={shot.cam_setup_ref || ''}
                      onChange={(e) => setShot({ ...shot, cam_setup_ref: e.target.value })}
                      placeholder="e.g. comic_panel_02"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm font-mono focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">渲染等级 (Budget Tier)</label>
                    <select
                      value={shot.budget?.tier || 'cheap'}
                      onChange={(e) => setShot({ ...shot, budget: { ...shot.budget, tier: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="cheap">cheap (低成本快速预览)</option>
                      <option value="final">final (高质量成片渲染)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">最大重试次数 (Retry Limit)</label>
                    <input
                      type="number"
                      value={shot.budget?.max_regen || 1}
                      onChange={(e) => setShot({ ...shot, budget: { ...shot.budget, max_regen: Number(e.target.value) } })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* 2. Action beats */}
                <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-850 space-y-3">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Camera size={16} className="text-emerald-400" />
                    动作列表 (Action Beats)
                  </h3>
                  <textarea
                    placeholder="每行一个动作描述节点..."
                    value={shot.action?.beats?.join('\n') || ''}
                    onChange={(e) => setShot({
                      ...shot,
                      action: { beats: e.target.value.split('\n').filter(b => b.trim()) }
                    })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 h-28 text-sm focus:outline-none focus:border-blue-500 transition leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-500">按回车分行。编译提示词时，多行动作将被作为关键时间节点输入大模型。</p>
                </div>

                {/* 3. Dialogue & Voiceover */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Dialogue */}
                  <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-850 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-200 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <MessageSquare size={16} className="text-yellow-400" />
                          台词对白 (Dialogue)
                        </span>
                        {shot.dialogue && (
                          <button 
                            onClick={() => {
                              const newShot = { ...shot };
                              delete newShot.dialogue;
                              setShot(newShot);
                            }}
                            className="text-xs text-red-400 hover:text-red-300 font-medium"
                          >
                            移除对白
                          </button>
                        )}
                      </h3>
                      {shot.dialogue ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">说话角色</label>
                              <input
                                type="text"
                                value={shot.dialogue.speaker}
                                onChange={(e) => setShot({
                                  ...shot,
                                  dialogue: { ...shot.dialogue!, speaker: e.target.value }
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">TTS 语音 ID</label>
                              <input
                                type="text"
                                value={shot.dialogue.voice_id}
                                onChange={(e) => setShot({
                                  ...shot,
                                  dialogue: { ...shot.dialogue!, voice_id: e.target.value }
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">台词正文</label>
                            <textarea
                              value={shot.dialogue.text}
                              onChange={(e) => setShot({
                                ...shot,
                                dialogue: { ...shot.dialogue!, text: e.target.value }
                              })}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs h-20 focus:outline-none focus:border-blue-500 leading-relaxed"
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShot({
                            ...shot,
                            dialogue: { speaker: '旁白', text: '在此处输入台词...', voice_id: 'zh-CN-XiaoxiaoNeural' }
                          })}
                          className="w-full py-4 border border-dashed border-slate-800 hover:border-slate-700 rounded-lg text-slate-400 hover:text-slate-300 text-xs font-medium transition"
                        >
                          + 添加台词对白
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Voiceover */}
                  <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-850 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-200 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <MessageSquare size={16} className="text-emerald-400" />
                          画面讲解 (Voiceover)
                        </span>
                        {shot.voiceover && (
                          <button 
                            onClick={() => {
                              const newShot = { ...shot };
                              delete newShot.voiceover;
                              setShot(newShot);
                            }}
                            className="text-xs text-red-400 hover:text-red-300 font-medium"
                          >
                            移除讲解
                          </button>
                        )}
                      </h3>
                      {shot.voiceover ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">配音角色 (可选)</label>
                            <input
                              type="text"
                              value={shot.voiceover.speaker || ''}
                              onChange={(e) => setShot({
                                ...shot,
                                voiceover: { ...shot.voiceover!, speaker: e.target.value }
                              })}
                              placeholder="默认: 旁白"
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">讲解内容</label>
                            <textarea
                              value={shot.voiceover.text}
                              onChange={(e) => setShot({
                                ...shot,
                                voiceover: { ...shot.voiceover!, text: e.target.value }
                              })}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs h-24 focus:outline-none focus:border-blue-500 leading-relaxed"
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShot({
                            ...shot,
                            voiceover: { speaker: 'Narrator', text: '在此输入旁白讲解词...' }
                          })}
                          className="w-full py-4 border border-dashed border-slate-800 hover:border-slate-700 rounded-lg text-slate-400 hover:text-slate-300 text-xs font-medium transition"
                        >
                          + 添加讲解旁白
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit bar */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    保存修改
                  </button>
                </div>
              </div>
            )}

            {/* TAB: Spatial blocking */}
            {activeTab === 'blocking' && (
              <div className="space-y-4">
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-850 text-xs text-slate-400">
                  俯视摆位 → 自动生成空间从句 + 灰模脚手架首帧，并支持越轴 / 跳切 / 瞬移校验。俯视图仅供你和 Lint，喂给视频 AI 的是灰模图与文字。
                </div>
                <BlockingEditor
                  shotId={shot.shot_id}
                  characters={shot.characters || []}
                  props={shot.props || []}
                  value={shot.blocking}
                  onChange={(blocking) => setShot({ ...shot, blocking })}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    保存调度
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Assets & References */}
            {activeTab === 'assets' && (
              <div className="space-y-6">
                {/* References editor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/40 p-5 rounded-xl border border-slate-850">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      👤 角色资源引用 (Characters)
                    </h3>
                    <textarea
                      placeholder="每行一个角色配置路径，如：characters/visitor.json..."
                      value={shot.characters?.map(c => c.ref).join('\n') || ''}
                      onChange={(e) => setShot({
                        ...shot,
                        characters: e.target.value.split('\n').filter(r => r.trim()).map(r => ({ ref: r }))
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 h-28 font-mono text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      📦 道具资源引用 (Props)
                    </h3>
                    <textarea
                      placeholder="每行一个道具及状态 (格式: 路径,状态)，如：props/warning_signage.json,visible..."
                      value={shot.props?.map(p => `${p.ref}${p.state ? `,${p.state}` : ''}`).join('\n') || ''}
                      onChange={(e) => {
                        const parsed = e.target.value.split('\n').filter(r => r.trim()).map(line => {
                          const parts = line.split(',');
                          return { ref: parts[0], state: parts[1] || '' };
                        });
                        setShot({ ...shot, props: parsed });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 h-28 font-mono text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-3 col-span-1 md:col-span-2 border-t border-slate-850 pt-4">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      🔗 上下游分镜参考图 (Context References)
                    </h3>
                    <textarea
                      placeholder="每行一个前序分镜截图相对路径，如：assets/renders/S001/keyframes/frame_last.jpg..."
                      value={shot.context_refs?.join('\n') || ''}
                      onChange={(e) => setShot({
                        ...shot,
                        context_refs: e.target.value.split('\n').filter(r => r.trim())
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 h-24 font-mono text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Keyframes list */}
                <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-850 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200">
                    🖼️ 已上传的分镜关键帧 (Uploaded Keyframes)
                  </h3>
                  {(!shot._keyframes || shot._keyframes.length === 0) ? (
                    <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-800 rounded-lg">
                      暂无关键帧图片。请点击右上角「上传画面」或在此处上传。
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {shot._keyframes.map((kf, i) => (
                        <div key={i} className="group relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                          <img
                            src={kf}
                            alt={`frame_${i}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-1 left-1 text-[9px] bg-black/60 text-slate-200 px-1 rounded uppercase font-mono">
                            {kf.split('/').pop()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteKeyframe(kf)}
                            title="删除此关键帧"
                            className="absolute top-1 right-1 p-1 rounded bg-black/60 text-slate-200 opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    保存修改
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Prompt packages */}
            {activeTab === 'prompts' && (
              <div className="space-y-6">
                {/* AI prompt optimizer */}
                <div className="p-4 bg-purple-950/20 border border-purple-900/40 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-purple-300">使用本地 AI 自动扩充与润色提示词</h4>
                    <p className="text-xs text-slate-400 mt-1">根据分镜运镜、动作描述以及对白情绪，智能生成适合 Midjourney / SD 画面细节的提示词。</p>
                  </div>
                  <button
                    onClick={handleOptimizePrompt}
                    disabled={optimizing}
                    className="flex items-center gap-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition font-medium flex-shrink-0"
                  >
                    {optimizing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        AI 优化中...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        AI 润色
                      </>
                    )}
                  </button>
                </div>

                {/* Edit positives and negatives */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">分镜正向提示词 (Positive Override)</label>
                    <textarea
                      value={shot.prompt?.positive || ''}
                      onChange={(e) => setShot({
                        ...shot,
                        prompt: { ...shot.prompt, positive: e.target.value }
                      })}
                      placeholder="选填。可在此对该分镜的主题画面细节做具体描述限制，提示词编译器会将其与全局场景/角色配置结合..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 h-28 text-xs focus:outline-none focus:border-blue-500 transition leading-relaxed font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">分镜负向提示词 (Negative Override)</label>
                    <textarea
                      value={shot.prompt?.negative || ''}
                      onChange={(e) => setShot({
                        ...shot,
                        prompt: { ...shot.prompt, negative: e.target.value }
                      })}
                      placeholder="选填。在此输入该分镜要排除的词汇..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 h-28 text-xs focus:outline-none focus:border-blue-500 transition leading-relaxed font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end border-b border-slate-800 pb-4">
                  <button
                    onClick={handleSaveAndCompilePrompts}
                    disabled={saving || compiling}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
                  >
                    {saving || compiling ? <Loader2 size={16} className="animate-spin" /> : null}
                    保存并同步 Prompt
                  </button>
                </div>

                {/* Compiled Prompts Results */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                    ⚙️ 编译提示词产物包 (Compiled Prompt Output)
                  </h3>
                  
                  {!detailData?.video_prompt ? (
                    <div className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-lg">
                      暂无编译产物。请点击右上角「编译 Prompt」生成。
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Prompt Quality Evaluation */}
                      {detailData?.quality && (
                        <div className={`p-4 rounded-xl border space-y-2 ${
                          detailData.quality.status === 'good'
                            ? 'bg-emerald-950/20 text-emerald-300 border-emerald-800/30'
                            : detailData.quality.status === 'fair'
                            ? 'bg-amber-950/20 text-amber-300 border-amber-800/30'
                            : 'bg-red-950/20 text-red-350 border-red-800/30'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              🎯 提示词编译质量评分 (Quality Score)
                            </span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                              detailData.quality.status === 'good'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : detailData.quality.status === 'fair'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {detailData.quality.score} / 100 ({detailData.quality.status.toUpperCase()})
                            </span>
                          </div>
                          {detailData.quality.issues && detailData.quality.issues.length > 0 ? (
                            <ul className="text-xs space-y-1.5 text-slate-400 pl-1 list-none">
                              {detailData.quality.issues.map((iss: any, idx: number) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="flex-shrink-0 mt-0.5">{iss.severity === 'error' ? '❌' : '⚠️'}</span>
                                  <span>{iss.message}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-emerald-400/80 pl-1">✓ 该分镜提示词编译质量符合标准，没有发现潜在问题。</p>
                          )}
                        </div>
                      )}

                      {/* Project System Prompt */}
                      {detailData?.project_system_prompt && (
                        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-300">📌 项目全局系统提示词 (Project System Prompt)</span>
                              <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium">在会话中只需输入一次</span>
                            </div>
                            <button
                              onClick={() => handleCopy(detailData.project_system_prompt, 'sys')}
                              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
                            >
                              <Copy size={12} />
                              {isCopied === 'sys' ? '已复制！' : '复制系统提示词'}
                            </button>
                          </div>
                          <pre className="bg-slate-950 p-3 border border-slate-900 rounded text-slate-400 font-mono text-xs whitespace-pre-wrap select-all leading-relaxed max-h-36 overflow-y-auto">
                            {detailData.project_system_prompt}
                          </pre>
                        </div>
                      )}

                      {/* Video Prompt */}
                      <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <span className="text-xs font-bold text-slate-300">🎥 视频生成提示词 (Video Prompt)</span>
                          <div className="flex items-center gap-3">
                            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                              <button
                                onClick={() => setVideoPromptMode('local')}
                                className={`px-2 py-1 rounded transition-all ${videoPromptMode === 'local' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                              >
                                仅分镜提示词
                              </button>
                              <button
                                onClick={() => setVideoPromptMode('full')}
                                className={`px-2 py-1 rounded transition-all ${videoPromptMode === 'full' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                              >
                                完整提示词
                              </button>
                            </div>
                            <button
                              onClick={() => handleCopy(
                                videoPromptMode === 'local' 
                                  ? (detailData.video_prompt.prompt_shot_only || detailData.video_prompt.prompt)
                                  : detailData.video_prompt.prompt, 
                                'vid'
                              )}
                              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
                            >
                              <Copy size={12} />
                              {isCopied === 'vid' ? '已复制！' : '复制当前提示词'}
                            </button>
                          </div>
                        </div>
                        <pre className="bg-slate-950 p-3 border border-slate-900 rounded text-emerald-400 font-mono text-xs whitespace-pre-wrap select-all leading-relaxed max-h-40 overflow-y-auto">
                          {videoPromptMode === 'local' 
                            ? (detailData.video_prompt.prompt_shot_only || detailData.video_prompt.prompt)
                            : detailData.video_prompt.prompt}
                        </pre>
                      </div>

                      {/* Image Prompt */}
                      {detailData?.image_prompt && (
                        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <span className="text-xs font-bold text-slate-300">🖼️ 关键帧正向提示词 (Image Prompt)</span>
                            <div className="flex items-center gap-3">
                              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                                <button
                                  onClick={() => setImagePromptMode('local')}
                                  className={`px-2 py-1 rounded transition-all ${imagePromptMode === 'local' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                  仅分镜提示词
                                </button>
                                <button
                                  onClick={() => setImagePromptMode('full')}
                                  className={`px-2 py-1 rounded transition-all ${imagePromptMode === 'full' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                  完整提示词
                                </button>
                              </div>
                              <button
                                onClick={() => handleCopy(
                                  imagePromptMode === 'local'
                                    ? (detailData.image_prompt.image_prompt_shot || detailData.image_prompt.image_prompt_final)
                                    : detailData.image_prompt.image_prompt_final,
                                  'img'
                                )}
                                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
                              >
                                <Copy size={12} />
                                {isCopied === 'img' ? '已复制！' : '复制当前提示词'}
                              </button>
                            </div>
                          </div>
                          <pre className="bg-slate-950 p-3 border border-slate-900 rounded text-purple-400 font-mono text-xs whitespace-pre-wrap select-all leading-relaxed max-h-40 overflow-y-auto">
                            {imagePromptMode === 'local'
                              ? (detailData.image_prompt.image_prompt_shot || detailData.image_prompt.image_prompt_final)
                              : detailData.image_prompt.image_prompt_final}
                          </pre>
                        </div>
                      )}

                      {/* Negative Prompt */}
                      <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-300">🚫 通用反向词 (Negative Prompt)</span>
                          <button
                            onClick={() => handleCopy(detailData.video_prompt.negative, 'neg')}
                            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
                          >
                            <Copy size={12} />
                            {isCopied === 'neg' ? '已复制！' : '复制'}
                          </button>
                        </div>
                        <pre className="bg-slate-950 p-3 border border-slate-900 rounded text-red-400/80 font-mono text-xs whitespace-pre-wrap select-all leading-relaxed max-h-24 overflow-y-auto">
                          {detailData.video_prompt.negative}
                        </pre>
                      </div>

                      {/* Prompts compiler metadata */}
                      <div className="text-[10px] text-slate-500 flex justify-between px-1">
                        <div>编译器版本: {detailData.video_prompt.meta?.compiler_version || 'N/A'}</div>
                        <div>编译时间: {detailData.video_prompt.meta?.compiled_at ? new Date(detailData.video_prompt.meta.compiled_at).toLocaleString() : 'N/A'}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: Takes Management */}
            {activeTab === 'takes' && (
              <div className="space-y-6">
                {/* Active take preview */}
                <div className="bg-slate-950/45 p-5 rounded-xl border border-slate-850 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Film size={16} className="text-blue-400" />
                    当前活动版画面 (Active Take Preview)
                  </h3>
                  
                  {shot._video_url ? (
                    <div className="max-w-xl mx-auto border border-slate-850 rounded-xl overflow-hidden shadow-2xl bg-slate-950 aspect-video flex items-center justify-center">
                      <video 
                        src={shot._video_url} 
                        controls 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="py-12 border border-dashed border-slate-850 rounded-xl flex flex-col items-center justify-center gap-3">
                      <Film size={36} className="text-slate-700" />
                      <div className="text-xs text-slate-500">当前没有有效的活动视频 Take。请在右上角上传视频。</div>
                    </div>
                  )}
                </div>

                {/* Takes versions list */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-200">
                    版本历史 ({detailData?.history?.takes?.length || 0})
                  </h3>

                  {(!detailData?.history?.takes || detailData.history.takes.length === 0) ? (
                    <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-lg bg-slate-950/20">
                      无 Take 记录。请在右上角上传视频以产生新 Take。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detailData.history.takes.map((take: any) => {
                        const isActive = detailData.history.active_take_id === take.take_id;
                        const isApproved = take.review?.approved;
                        const isRejected = take.status === 'rejected';

                        return (
                          <div 
                            key={take.take_id}
                            className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition ${
                              isActive 
                                ? 'bg-blue-950/20 border-blue-500/50 shadow-md shadow-blue-500/5' 
                                : 'bg-slate-950/40 border-slate-850 hover:border-slate-800'
                            }`}
                          >
                            <div className="flex gap-4 items-start">
                              <div className="w-28 h-16 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden relative flex-shrink-0 flex items-center justify-center">
                                {take.keyframe_path ? (
                                  <img 
                                    src={`/api/assets/reference/${take.keyframe_path}`} 
                                    alt={take.take_id} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Camera size={20} className="text-slate-700" />
                                )}
                                {isActive && (
                                  <span className="absolute bottom-1 right-1 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-slate-200">版本{(take.take_id.match(/\d+/)?.[0] || '').replace(/^0+/, '') || ''}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${
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
                                </div>
                              </div>
                            </div>

                            <div className="flex-1 w-full md:w-auto max-w-sm space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400">评分:</span>
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      onClick={() => handleUpdateTakeReview(take.take_id, star, take.review?.notes)}
                                      className={`text-sm transition hover:scale-110 ${
                                        star <= (take.review?.rating || 0) ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'
                                      }`}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <input
                                type="text"
                                placeholder="添加审片备注..."
                                defaultValue={take.review?.notes || ''}
                                onBlur={(e) => {
                                  if (e.target.value !== (take.review?.notes || '')) {
                                    handleUpdateTakeReview(take.take_id, take.review?.rating, e.target.value);
                                  }
                                }}
                                className="w-full bg-slate-900 border border-slate-850 rounded px-2.5 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition font-medium"
                              />
                            </div>

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
                                onClick={() => handleTakeAction(take.take_id, 'set_active')}
                                disabled={isActive}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                                  isActive
                                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 cursor-default'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                              >
                                {isActive ? '当前活动' : '设为活动'}
                              </button>
                              <button
                                onClick={() => handleTakeAction(take.take_id, 'approve')}
                                disabled={isApproved}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                                  isApproved
                                    ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                }`}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleTakeAction(take.take_id, 'reject')}
                                disabled={isRejected}
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                                  isRejected
                                    ? 'bg-red-600/10 text-red-400 border border-red-500/20 cursor-default'
                                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                                }`}
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

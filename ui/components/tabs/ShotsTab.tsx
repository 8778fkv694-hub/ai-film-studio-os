"use client";

import { useState, useEffect } from 'react';
import { Clapperboard, Plus, Clock, MessageSquare, Camera, Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Shot {
  shot_id: string;
  duration_s: number;
  scene_ref: string;
  cam_setup_ref?: string;
  characters: { ref: string }[];
  props: { ref: string; state: string }[];
  action: { beats: string[] };
  dialogue?: { speaker: string; text: string; voice_id: string };
  budget: { tier: string; max_regen: number };
  prompt: { positive: string; negative: string };
  _filename?: string;
}

export default function ShotsTab() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [draftShots, setDraftShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [viewMode, setViewMode] = useState<'final' | 'draft'>('final');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadShots();
  }, []);

  const loadShots = async () => {
    setLoading(true);
    try {
      const [shotsRes, draftsRes] = await Promise.all([
        fetch('/api/shots'),
        fetch('/api/shots/draft')
      ]);
      if (shotsRes.ok) {
        const data = await shotsRes.json();
        setShots(data);
        if (data.length > 0 && !selectedShot) setSelectedShot(data[0]);
      }
      if (draftsRes.ok) {
        setDraftShots(await draftsRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const saveShot = async (shot: Shot) => {
    try {
      const endpoint = viewMode === 'draft' ? '/api/shots/draft' : '/api/shots';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shot)
      });
      if (res.ok) {
        showStatus('success', '镜头已保存');
        loadShots();
      } else {
        showStatus('error', '保存失败');
      }
    } catch (e) {
      showStatus('error', '保存失败');
    }
  };

  const promoteToFinal = async (shot: Shot) => {
    try {
      const res = await fetch('/api/shots/draft/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shot)
      });
      if (res.ok) {
        showStatus('success', '已移至正式镜头');
        await loadShots();
        setViewMode('final');
      } else {
        showStatus('error', '移动失败');
      }
    } catch (e) {
      showStatus('error', '移动失败');
    }
  };

  const createNewShot = () => {
    const newId = viewMode === 'final'
      ? `S${String(shots.length + 1).padStart(3, '0')}`
      : `D${String(draftShots.length + 1).padStart(3, '0')}`;
    const newShot: Shot = {
      shot_id: newId,
      duration_s: 3,
      scene_ref: '',
      characters: [],
      props: [],
      action: { beats: ['新动作描述'] },
      budget: { tier: 'cheap', max_regen: 1 },
      prompt: { positive: '', negative: '' }
    };
    setSelectedShot(newShot);
  };

  const currentList = viewMode === 'final' ? shots : draftShots;
  const totalDuration = currentList.reduce((acc, s) => acc + s.duration_s, 0);

  if (loading) return <div className="p-8 text-slate-400">加载镜头中...</div>;

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Sidebar - Shot List */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Header with Stats */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Clapperboard size={18} className="text-blue-400" />
              时间线
            </h3>
            <div className="text-xs text-slate-500">
              {currentList.length} 镜头 · {totalDuration}s
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-lg">
            <button
              onClick={() => {
                setViewMode('final');
                setSelectedShot(shots[0] || null);
              }}
              className={`flex-1 py-1.5 text-xs rounded transition ${
                viewMode === 'final'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              正式 ({shots.length})
            </button>
            <button
              onClick={() => {
                setViewMode('draft');
                setSelectedShot(draftShots[0] || null);
              }}
              className={`flex-1 py-1.5 text-xs rounded transition ${
                viewMode === 'draft'
                  ? 'bg-yellow-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              草稿 ({draftShots.length})
            </button>
          </div>
        </div>

        {/* Shot List */}
        <div className="flex-1 overflow-y-auto p-2">
          {currentList.map((shot, idx) => (
            <button
              key={shot.shot_id}
              onClick={() => setSelectedShot(shot)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                selectedShot?.shot_id === shot.shot_id
                  ? 'bg-blue-600/20 border border-blue-500/50'
                  : 'hover:bg-slate-800 border border-transparent'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-mono font-bold text-blue-300">{shot.shot_id}</span>
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                  {shot.duration_s}s
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                {shot.action?.beats?.[0] || '无描述'}
              </div>
              {shot.dialogue && (
                <div className="text-xs text-yellow-400/70 mt-1 flex items-center gap-1">
                  <MessageSquare size={10} />
                  {shot.dialogue.speaker}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-slate-800">
          <button
            onClick={createNewShot}
            className="w-full flex items-center justify-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition"
          >
            <Plus size={16} />
            新建镜头
          </button>
        </div>
      </div>

      {/* Main Content - Shot Editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Status Message */}
        {status && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            status.type === 'success'
              ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800'
              : 'bg-red-900/30 text-red-300 border border-red-800'
          }`}>
            {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {status.message}
          </div>
        )}
        {selectedShot ? (
          <ShotEditor
            shot={selectedShot}
            onChange={setSelectedShot}
            isDraft={viewMode === 'draft'}
            onSave={saveShot}
            onPromote={promoteToFinal}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            选择一个镜头进行编辑
          </div>
        )}
      </div>
    </div>
  );
}

function ShotEditor({
  shot,
  onChange,
  isDraft,
  onSave,
  onPromote
}: {
  shot: Shot;
  onChange: (s: Shot) => void;
  isDraft: boolean;
  onSave: (s: Shot) => void;
  onPromote: (s: Shot) => void;
}) {
  const [optimizing, setOptimizing] = useState(false);
  const [optStatus, setOptStatus] = useState('');

  const handleOptimizePrompt = async () => {
    setOptimizing(true);
    setOptStatus('');
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
          onChange({
            ...shot,
            prompt: {
              positive: parsed.positive_prompt || shot.prompt?.positive || '',
              negative: parsed.negative_prompt || shot.prompt?.negative || ''
            }
          });
        } catch {
          onChange({
            ...shot,
            prompt: {
              ...shot.prompt,
              positive: content
            }
          });
        }
        setOptStatus('优化成功！');
      } else {
        setOptStatus(`优化失败: ${data.error || '未知错误'}`);
      }
    } catch {
      setOptStatus('网络错误，优化失败');
    } finally {
      setOptimizing(false);
      setTimeout(() => setOptStatus(''), 3000);
    }
  };
  const addBeat = () => {
    const newBeats = [...(shot.action?.beats || []), '新动作描述'];
    onChange({ ...shot, action: { ...shot.action, beats: newBeats } });
  };

  const removeBeat = (idx: number) => {
    const newBeats = shot.action.beats.filter((_, i) => i !== idx);
    onChange({ ...shot, action: { ...shot.action, beats: newBeats } });
  };

  const addDialogue = () => {
    onChange({
      ...shot,
      dialogue: { speaker: '', text: '', voice_id: 'zh-CN-XiaoxiaoNeural' }
    });
  };

  const removeDialogue = () => {
    const newShot = { ...shot };
    delete newShot.dialogue;
    onChange(newShot);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <Clapperboard size={24} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-mono text-slate-200">{shot.shot_id}</h2>
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Clock size={14} />
              {shot.duration_s} 秒
              {isDraft && (
                <span className="bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded text-xs">
                  草稿
                </span>
              )}
            </p>
          </div>
        </div>
        {isDraft && (
          <button
            onClick={() => onPromote(shot)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition text-sm"
          >
            移至正式
          </button>
        )}
      </div>

      {/* Basic Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">基本信息</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">镜头 ID</label>
            <input
              type="text"
              value={shot.shot_id}
              onChange={(e) => onChange({ ...shot, shot_id: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">时长 (秒)</label>
            <input
              type="number"
              value={shot.duration_s}
              onChange={(e) => onChange({ ...shot, duration_s: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">场景引用</label>
            <input
              type="text"
              value={shot.scene_ref}
              onChange={(e) => onChange({ ...shot, scene_ref: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Action Beats */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
          <Camera size={18} className="text-emerald-400" />
          动作描述 (Action Beats)
        </h3>
        <div className="space-y-2">
          {shot.action?.beats?.map((beat, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-slate-500 font-mono text-sm w-6">{idx + 1}.</span>
              <input
                type="text"
                value={beat}
                onChange={(e) => {
                  const newBeats = [...shot.action.beats];
                  newBeats[idx] = e.target.value;
                  onChange({ ...shot, action: { ...shot.action, beats: newBeats } });
                }}
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
              />
              <button
                onClick={() => removeBeat(idx)}
                className="text-red-400 hover:text-red-300 text-sm px-2"
              >
                删除
              </button>
            </div>
          ))}
          <button
            onClick={addBeat}
            className="text-sm text-blue-400 hover:text-blue-300 mt-2"
          >
            + 添加动作
          </button>
        </div>
      </div>

      {/* Dialogue */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
          <MessageSquare size={18} className="text-yellow-400" />
          对白 (Dialogue)
        </h3>
        {shot.dialogue ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">说话人</label>
                <input
                  type="text"
                  value={shot.dialogue.speaker}
                  onChange={(e) => onChange({
                    ...shot,
                    dialogue: { ...shot.dialogue!, speaker: e.target.value }
                  })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">语音 ID</label>
                <input
                  type="text"
                  value={shot.dialogue.voice_id}
                  onChange={(e) => onChange({
                    ...shot,
                    dialogue: { ...shot.dialogue!, voice_id: e.target.value }
                  })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">台词内容</label>
              <textarea
                value={shot.dialogue.text}
                onChange={(e) => onChange({
                  ...shot,
                  dialogue: { ...shot.dialogue!, text: e.target.value }
                })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white h-24"
              />
            </div>
            <button
              onClick={removeDialogue}
              className="text-sm text-red-400 hover:text-red-300"
            >
              删除对白
            </button>
          </div>
        ) : (
          <button
            onClick={addDialogue}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + 添加对白
          </button>
        )}
      </div>

      {/* Prompt */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            提示词 (Prompt)
          </h3>
          <div className="flex items-center gap-2">
            {optStatus && (
              <span className={`text-xs ${optStatus.includes('失败') ? 'text-red-400' : 'text-emerald-400'}`}>
                {optStatus}
              </span>
            )}
            <button
              onClick={handleOptimizePrompt}
              disabled={optimizing}
              className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition flex items-center gap-1 font-medium"
            >
              {optimizing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  正在 AI 优化...
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  ✨ AI 优化提示词
                </>
              )}
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">正向提示词</label>
            <textarea
              value={shot.prompt?.positive || ''}
              onChange={(e) => onChange({
                ...shot,
                prompt: { ...shot.prompt, positive: e.target.value }
              })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-emerald-300 h-20 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">负向提示词</label>
            <textarea
              value={shot.prompt?.negative || ''}
              onChange={(e) => onChange({
                ...shot,
                prompt: { ...shot.prompt, negative: e.target.value }
              })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-red-300 h-20 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">预算设置</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">质量等级</label>
            <select
              value={shot.budget?.tier || 'cheap'}
              onChange={(e) => onChange({
                ...shot,
                budget: { ...shot.budget, tier: e.target.value }
              })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            >
              <option value="cheap">cheap (低成本预览)</option>
              <option value="final">final (高质量渲染)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">最大重试次数</label>
            <input
              type="number"
              value={shot.budget?.max_regen || 1}
              onChange={(e) => onChange({
                ...shot,
                budget: { ...shot.budget, max_regen: Number(e.target.value) }
              })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => onSave(shot)}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
      >
        保存镜头
      </button>
    </div>
  );
}

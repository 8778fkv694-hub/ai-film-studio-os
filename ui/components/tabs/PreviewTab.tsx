"use client";

import { useState, useEffect } from 'react';
import { Volume2, Play, RefreshCw, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, Upload } from 'lucide-react';
import Player from '../Player';

interface Shot {
  shot_id: string;
  duration_s: number;
  action?: { beats?: string[] };
  dialogue?: { text: string; speaker: string };
  voiceover?: { text: string; speaker?: string };
  scene_ref?: string;
  _keyframes?: string[];
  _selected_keyframe?: string | null;
}

export default function PreviewTab() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);
  const [uploadingKeyframe, setUploadingKeyframe] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadShots();
  }, []);

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

  const generateTTS = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/tts/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `成功生成 ${data.count} 个音频文件` });
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

  const shotsWithDialogue = shots.filter(s => s.dialogue);
  const shotsWithVoiceover = shots.filter(s => s.voiceover);
  const shotsWithKeyframes = shots.filter(s => (s._keyframes?.length || 0) > 0);
  const totalDuration = shots.reduce((acc, s) => acc + s.duration_s, 0);

  if (loading) return <div className="p-8 text-slate-400">加载中...</div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="text-emerald-400" />
            配音分镜漫画
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            读取回填关键帧，配合对白音频预览静态图片漫画
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={loadShots}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm"
          >
            <RefreshCw size={16} />
            刷新
          </button>
          <button
            onClick={generateTTS}
            disabled={generating || shotsWithDialogue.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition text-sm disabled:opacity-50"
          >
            <Volume2 size={16} />
            {generating ? '生成中...' : '生成全部 TTS'}
          </button>
        </div>
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
        <Player shots={shots} />
      </div>

      {/* Shot List with TTS Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">镜头列表</h3>
        <div className="space-y-2">
          {shots.map((shot) => (
            <div
              key={shot.shot_id}
              className="flex flex-wrap items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800"
            >
              <span className="font-mono font-bold text-blue-300 w-16">{shot.shot_id}</span>
              <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                {shot.duration_s}s
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                (shot._keyframes?.length || 0) > 0
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'bg-slate-800 text-slate-500'
              }`}>
                {(shot._keyframes?.length || 0) > 0 ? `${shot._keyframes?.length} 张图` : '无图'}
              </span>
              <label className="flex cursor-pointer items-center gap-1 rounded bg-blue-600/20 px-3 py-1 text-xs text-blue-300 transition hover:bg-blue-600/30">
                {uploadingKeyframe === shot.shot_id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                上传画面
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={uploadingKeyframe === shot.shot_id}
                  onChange={(e) => {
                    uploadKeyframe(shot.shot_id, e.target.files?.[0] || null);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              {shot.dialogue ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                    {shot.voiceover?.text ? `讲解：${shot.voiceover.text} / ` : ''}
                    台词："{shot.dialogue.text}"
                  </span>
                  <button
                    onClick={() => generateSingleTTS(shot.shot_id)}
                    disabled={generatingSingle === shot.shot_id}
                    className="text-xs px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 transition disabled:opacity-50 flex items-center gap-1"
                  >
                    {generatingSingle === shot.shot_id ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        生成中
                      </>
                    ) : (
                      '生成'
                    )}
                  </button>
                </>
              ) : (
                <span className="text-slate-500 text-sm italic">无对白</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Help */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
        <strong className="text-slate-300">提示：</strong>
        音频文件保存在 <code className="text-blue-300">assets/audio/</code>，关键帧保存在{' '}
        <code className="text-blue-300">assets/renders/&lt;shot_id&gt;/keyframes/</code>。
        播放器会优先显示每个镜头的第一张关键帧。
      </div>
    </div>
  );
}

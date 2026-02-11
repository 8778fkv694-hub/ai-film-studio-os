"use client";

import { useState, useEffect } from 'react';
import { Volume2, Play, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Player from '../Player';

interface Shot {
  shot_id: string;
  duration_s: number;
  action?: { beats?: string[] };
  dialogue?: { text: string; speaker: string };
  scene_ref?: string;
}

export default function PreviewTab() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);
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

  const shotsWithDialogue = shots.filter(s => s.dialogue);
  const totalDuration = shots.reduce((acc, s) => acc + s.duration_s, 0);

  if (loading) return <div className="p-8 text-slate-400">加载中...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Volume2 className="text-emerald-400" />
            TTS 预演
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            生成对白音频，在播放器中预览动态分镜
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadShots}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm"
          >
            <RefreshCw size={16} />
            刷新
          </button>
          <button
            onClick={generateTTS}
            disabled={generating || shotsWithDialogue.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition text-sm disabled:opacity-50"
          >
            <Volume2 size={16} />
            {generating ? '生成中...' : '生成全部 TTS'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-blue-400">{shots.length}</div>
          <div className="text-sm text-slate-400">总镜头数</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-yellow-400">{shotsWithDialogue.length}</div>
          <div className="text-sm text-slate-400">有对白镜头</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-emerald-400">{totalDuration}s</div>
          <div className="text-sm text-slate-400">总时长</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-purple-400">
            {Math.floor(totalDuration / 60)}:{String(totalDuration % 60).padStart(2, '0')}
          </div>
          <div className="text-sm text-slate-400">分:秒</div>
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
          动态分镜播放器
        </h3>
        <Player shots={shots} />
      </div>

      {/* Shot List with TTS Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">对白列表</h3>
        <div className="space-y-2">
          {shots.map((shot) => (
            <div
              key={shot.shot_id}
              className="flex items-center gap-4 p-3 bg-slate-950 rounded-lg border border-slate-800"
            >
              <span className="font-mono font-bold text-blue-300 w-16">{shot.shot_id}</span>
              <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                {shot.duration_s}s
              </span>
              {shot.dialogue ? (
                <>
                  <span className="text-yellow-400 text-sm w-24">{shot.dialogue.speaker}</span>
                  <span className="text-slate-300 text-sm flex-1 truncate">
                    "{shot.dialogue.text}"
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
        TTS 使用 Edge TTS 引擎，支持多种语音。音频文件保存在 <code className="text-blue-300">assets/audio/</code> 目录。
        点击播放器的播放键即可预览带配音的动态分镜。
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { Volume2, Play, RefreshCw, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, Upload, Copy, Sparkles, X, Download, Film } from 'lucide-react';
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
    negative: string;
    motion: string;
    condition_images?: string[];
  } | null;
  _takes?: any[];
  _active_take?: any | null;
}

export default function PreviewTab() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);
  const [uploadingKeyframe, setUploadingKeyframe] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const [exportingShot, setExportingShot] = useState<string | null>(null);
  const [exportingVideo, setExportingVideo] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportWithSubtitles, setExportWithSubtitles] = useState(true);
  const [exportPreset, setExportPreset] = useState<string>('default_1080p');
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

  const toggleExpandShot = (shotId: string) => {
    setExpandedShots(prev => ({
      ...prev,
      [shotId]: !prev[shotId]
    }));
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

  const exportShotZip = async (shotId: string) => {
    setExportingShot(shotId);
    try {
      const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shot_${shotId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || '导出分镜 ZIP 失败' });
      }
    } catch {
      setResult({ success: false, message: '导出分镜 ZIP 失败' });
    } finally {
      setExportingShot(null);
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
          <button
            onClick={generateTTS}
            disabled={generating || shotsWithDialogue.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition text-sm disabled:opacity-50"
          >
            <Volume2 size={16} />
            {generating ? '生成中...' : '生成全部 TTS'}
          </button>
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={exportingVideo}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition text-sm disabled:opacity-50"
          >
            <Film size={16} />
            {exportingVideo ? '合成中...' : '导出 MP4'}
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
        <Player shots={shots} subtitleStyle={subtitleStyle} onSubtitleStyleChange={setSubtitleStyle} />
      </div>

      {/* Shot List with TTS Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">镜头列表</h3>
        <div className="space-y-2">
          {shots.map((shot) => (
            <div
              key={shot.shot_id}
              className="flex flex-col p-3 bg-slate-950 rounded-lg border border-slate-800 gap-3"
            >
              <div className="flex flex-wrap items-center gap-3 w-full">
                <span className="font-mono font-bold text-blue-300 w-16">{shot.shot_id}</span>
                <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                  {shot.duration_s}s
                </span>
                <button
                  onClick={() => {
                    if (shot._keyframes && shot._keyframes.length > 0) {
                      setActiveImageShot(shot);
                    }
                  }}
                  disabled={!shot._keyframes || shot._keyframes.length === 0}
                  className={`text-xs px-2 py-1 rounded transition text-left ${
                    (shot._keyframes?.length || 0) > 0
                      ? 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {(shot._keyframes?.length || 0) > 0 ? `${shot._keyframes?.length} 张图 👁️` : '无图'}
                </button>
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
                <button
                  onClick={() => setActiveImagePromptShot(shot)}
                  className="flex cursor-pointer items-center gap-1 rounded bg-purple-600/20 px-3 py-1 text-xs text-purple-300 transition hover:bg-purple-600/30"
                >
                  <Sparkles size={12} />
                  生成照片
                </button>
                <label className={`flex cursor-pointer items-center gap-1 rounded px-3 py-1 text-xs transition ${
                  shot._video_url 
                    ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30' 
                    : 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/30'
                }`}>
                  {uploadingVideo === shot.shot_id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  {shot._video_url ? '视频已上传 ✓' : '上传视频'}
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                    className="hidden"
                    disabled={uploadingVideo === shot.shot_id}
                    onChange={(e) => {
                      uploadVideo(shot.shot_id, e.target.files?.[0] || null);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                
                {/* Takes Manage Button */}
                <button
                  onClick={() => toggleExpandShot(shot.shot_id)}
                  className={`text-xs px-3 py-1 rounded transition flex items-center gap-1 font-medium ${
                    expandedShots[shot.shot_id]
                      ? 'bg-slate-700 text-slate-200'
                      : 'bg-blue-600/10 text-blue-300 border border-blue-500/20 hover:bg-blue-600/20'
                  }`}
                >
                  Takes ({shot._takes?.length || 0})
                </button>
                {shot._active_take && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                    shot._active_take.status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : shot._active_take.status === 'rejected'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {shot._active_take.take_id} ({shot._active_take.status})
                  </span>
                )}

                {shot.dialogue ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                      {shot.voiceover?.text ? `讲解：${shot.voiceover.text} / ` : ''}
                      台词："{shot.dialogue.text}"
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActivePromptShot(shot)}
                        className="text-xs px-3 py-1 bg-purple-600/20 text-purple-300 rounded hover:bg-purple-600/30 transition flex items-center gap-1"
                      >
                        <Sparkles size={12} />
                        提示词
                      </button>
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
                      <button
                        onClick={() => exportShotZip(shot.shot_id)}
                        disabled={exportingShot === shot.shot_id}
                        className="text-xs px-3 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/20 hover:bg-blue-600/30 rounded transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {exportingShot === shot.shot_id ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            导出中
                          </>
                        ) : (
                          <>
                            <Download size={12} />
                            导出 ZIP
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-500 italic">无对白</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActivePromptShot(shot)}
                        className="text-xs px-3 py-1 bg-purple-600/20 text-purple-300 rounded hover:bg-purple-600/30 transition flex items-center gap-1"
                      >
                        <Sparkles size={12} />
                        提示词
                      </button>
                      <button
                        onClick={() => exportShotZip(shot.shot_id)}
                        disabled={exportingShot === shot.shot_id}
                        className="text-xs px-3 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/20 hover:bg-blue-600/30 rounded transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {exportingShot === shot.shot_id ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            导出中
                          </>
                        ) : (
                          <>
                            <Download size={12} />
                            导出 ZIP
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              {/* Takes Expand Sub-Panel */}
              {expandedShots[shot.shot_id] && (
                <div className="w-full p-4 bg-slate-900/50 rounded-lg border border-slate-800/80 space-y-4">
                  <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    🎬 Takes 历史版本与审片管理 ({shot.shot_id})
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
                                : 'bg-slate-950/40 border-slate-850 hover:border-slate-800'
                            }`}
                          >
                            {/* Metadata */}
                            <div className="flex gap-3 items-start">
                              <div className="w-24 h-16 bg-slate-900 border border-slate-800 rounded relative overflow-hidden flex items-center justify-center flex-shrink-0">
                                {take.keyframe_path ? (
                                  <img 
                                    src={`/api/assets/reference/${take.keyframe_path}`} 
                                    alt={take.take_id} 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon size={20} className="text-slate-600" />
                                )}
                                {isActive && (
                                  <span className="absolute bottom-1 right-1 text-[8px] bg-blue-500 text-white px-1 rounded uppercase font-bold">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-slate-200">
                                    {take.take_id}
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
                                  className="w-full bg-slate-900 border border-slate-805 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
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

      {/* Image Preview Modal */}
      {activeImageShot && activeImageShot._keyframes && activeImageShot._keyframes.length > 0 && (
        <ImagePreviewModal
          shot={activeImageShot}
          onClose={() => setActiveImageShot(null)}
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
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">正向提示词 (Positive Prompt)</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activePromptShot._video_prompt!.prompt);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        {isCopied ? '已复制！' : '复制正向'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-emerald-300 font-mono text-xs whitespace-pre-wrap select-all max-h-48 overflow-y-auto leading-relaxed">
                      {activePromptShot._video_prompt.prompt}
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
                    const fullText = `Prompt:\n${activePromptShot._video_prompt!.prompt}\n\nNegative:\n${activePromptShot._video_prompt!.negative}`;
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
                    欢迎参观滤芯洁净车间
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
    </div>
  );
}

interface ImagePreviewModalProps {
  shot: Shot;
  onClose: () => void;
}

function ImagePreviewModal({ shot, onClose }: ImagePreviewModalProps) {
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

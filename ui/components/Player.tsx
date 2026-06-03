"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Settings, X, Sliders, RotateCcw, Camera, Scissors } from 'lucide-react';

interface Shot {
  shot_id: string;
  duration_s: number;
  action?: { beats?: string[] };
  dialogue?: { text: string; speaker: string };
  voiceover?: { text: string; speaker?: string };
  scene_ref?: string;
  _keyframes?: string[];
  _selected_keyframe?: string | null;
  _video_url?: string | null;
  layout?: {
    fitMode: 'contain' | 'cover' | 'fill';
    scale: number;
    stretchX: number;
    stretchY: number;
  };
}

export interface SubtitleStyle {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  bgOpacity: number;
  strokeWidth: number;
}

export const FONT_FAMILIES = [
  { value: 'sans-serif', label: '默认' },
  { value: 'serif', label: '宋体' },
  { value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
  { value: '"PingFang SC", sans-serif', label: '苹方' },
  { value: '"Noto Sans SC", sans-serif', label: '思源黑体' },
  { value: 'monospace', label: '等宽' },
];

interface PlayerProps {
  shots: Shot[];
  subtitleStyle: SubtitleStyle;
  onSubtitleStyleChange: (style: SubtitleStyle) => void;
  onShotLayoutChange?: (shotId: string, layout: {
    fitMode: 'contain' | 'cover' | 'fill';
    scale: number;
    stretchX: number;
    stretchY: number;
  } | null) => void;
  onCaptured?: () => void; // 截取分镜画面后通知外层刷新
}

export default function Player({ shots, subtitleStyle, onSubtitleStyleChange, onShotLayoutChange, onCaptured }: PlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentLine, setCurrentLine] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [videoHasError, setVideoHasError] = useState(false);
  const [audioSource, setAudioSource] = useState<'tts' | 'video'>('tts');
  const [videoDuration, setVideoDuration] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0); // 视频精确时长（秒，含小数），供进度条用
  const [currentTime, setCurrentTime] = useState(0);     // 视频当前播放时间
  const [audioVersion, setAudioVersion] = useState(0);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);
  // AI 润色后的台词本地覆盖（字幕即时反映，无需整页刷新）
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRequestedRef = useRef(false);
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentShot = shots[currentIndex];
  const currentImage = currentShot?._selected_keyframe || currentShot?._keyframes?.[0] || null;
  const currentVideo = currentShot?._video_url || null;
  const hasVideo = !!currentVideo;
  // 声音来源：默认 TTS 配音（画面静音只当画面用），可切到画面自带声音
  const useVideoSound = audioSource === 'video' && hasVideo;

  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [shotLayouts, setShotLayouts] = useState<Record<string, {
    fitMode: 'contain' | 'cover' | 'fill';
    scale: number;
    stretchX: number;
    stretchY: number;
  }>>({});

  // Sync shotLayouts when shots prop changes (persistent layout load)
  useEffect(() => {
    const initialLayouts: Record<string, {
      fitMode: 'contain' | 'cover' | 'fill';
      scale: number;
      stretchX: number;
      stretchY: number;
    }> = {};

    shots.forEach(shot => {
      if (shot.layout) {
        initialLayouts[shot.shot_id] = {
          fitMode: shot.layout.fitMode || 'contain',
          scale: typeof shot.layout.scale === 'number' ? shot.layout.scale : 1.0,
          stretchX: typeof shot.layout.stretchX === 'number' ? shot.layout.stretchX : 1.0,
          stretchY: typeof shot.layout.stretchY === 'number' ? shot.layout.stretchY : 1.0,
        };
      }
    });
    setShotLayouts(initialLayouts);
  }, [shots]);

  const currentLayout = shotLayouts[currentShot?.shot_id || ''] || {
    fitMode: 'contain',
    scale: 1.0,
    stretchX: 1.0,
    stretchY: 1.0
  };

  const updateCurrentLayout = (updates: Partial<typeof currentLayout>) => {
    if (!currentShot?.shot_id) return;
    const newLayout = {
      ...currentLayout,
      ...updates
    };
    setShotLayouts(prev => ({
      ...prev,
      [currentShot.shot_id]: newLayout
    }));
    if (onShotLayoutChange) {
      onShotLayoutChange(currentShot.shot_id, newLayout);
    }
  };

  const resetCurrentLayout = () => {
    if (!currentShot?.shot_id) return;
    setShotLayouts(prev => {
      const copy = { ...prev };
      delete copy[currentShot.shot_id];
      return copy;
    });
    if (onShotLayoutChange) {
      onShotLayoutChange(currentShot.shot_id, null);
    }
  };


  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const handleNext = useCallback(() => {
    if (advanceRequestedRef.current) return;
    advanceRequestedRef.current = true;
    clearSafetyTimer();
    if (currentIndex < shots.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentIndex, shots.length, clearSafetyTimer]);

  const handlePrev = useCallback(() => {
    advanceRequestedRef.current = false;
    clearSafetyTimer();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, clearSafetyTimer]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // 将长文本按标点拆成单行
  const splitLines = (text: string): string[] => {
    return text.split(/(?<=[。，,.;；!！?？])/).map(s => s.trim()).filter(Boolean);
  };

  // 字幕逐行播放
  useEffect(() => {
    if (subtitleTimerRef.current) {
      clearTimeout(subtitleTimerRef.current);
      subtitleTimerRef.current = null;
    }

    const text = textOverrides[currentShot?.shot_id || '']
      || currentShot?.voiceover?.text || currentShot?.dialogue?.text || '';
    if (!text || !isPlaying) {
      setCurrentLine('');
      return;
    }

    const lines = splitLines(text);
    let lineIndex = 0;
    const totalLines = lines.length;
    const lineDuration = (currentShot.duration_s * 1000) / totalLines;

    const showNextLine = () => {
      if (lineIndex < totalLines && isPlaying) {
        setCurrentLine(lines[lineIndex]);
        lineIndex++;
        subtitleTimerRef.current = setTimeout(showNextLine, lineDuration);
      }
    };

    showNextLine();

    return () => {
      if (subtitleTimerRef.current) {
        clearTimeout(subtitleTimerRef.current);
      }
    };
  }, [currentIndex, currentShot, isPlaying, textOverrides]);

  // Switch shot / source change: load audio + video, sync playback
  useEffect(() => {
    setVideoHasError(false);
    advanceRequestedRef.current = false;
    clearSafetyTimer();
    setAudioDuration(0);
    setVideoDuration(0);
    setMediaDuration(0);
    setCurrentTime(0);

    const audio = audioRef.current;
    const video = videoRef.current;

    if (audio) {
      audio.pause();
      // audioVersion 用于配音重新生成后强制刷新
      audio.src = `/api/assets/audio/${currentShot.shot_id}.mp3?v=${audioVersion}`;
      audio.currentTime = 0;
      audio.load();
    }

    if (video) {
      video.pause();
      // TTS 模式下画面静音，只作为画面；画面声音模式下出声
      video.muted = !useVideoSound;
      if (currentShot._video_url) {
        video.src = currentShot._video_url;
        video.currentTime = 0;
        video.load();
      } else {
        video.src = '';
      }
    }

    if (isPlaying) {
      const fallbackTimer = () => {
        safetyTimerRef.current = setTimeout(() => {
          handleNext();
        }, Math.max(1, currentShot.duration_s) * 1000);
      };
      // 画面：有视频就播放（TTS 模式下已静音）
      if (hasVideo && video) {
        video.play().catch(() => { if (!useVideoSound) fallbackTimer(); });
      }
      // 声音：TTS 模式（或无视频）播配音；画面声音模式停掉配音
      if (!useVideoSound && audio) {
        audio.play().catch(() => { if (!hasVideo) fallbackTimer(); });
      } else if (audio) {
        audio.pause();
      }
      if (!hasVideo && !audio) fallbackTimer();
    }
  }, [currentIndex, isPlaying, currentShot, audioVersion, useVideoSound, hasVideo, handleNext, clearSafetyTimer]);

  // Playback ended → advance
  const handlePlaybackEnded = useCallback(() => {
    clearSafetyTimer();
    handleNext();
  }, [clearSafetyTimer, handleNext]);

  // Audio (TTS) metadata loaded — 配音始终量时长（即使有视频）
  const handleAudioMetadata = useCallback(() => {
    if (!audioRef.current) return;
    const dur = Number.isFinite(audioRef.current.duration)
      ? Math.ceil(audioRef.current.duration)
      : 0;
    setAudioDuration(dur);

    // 仅当配音是主轨（TTS 模式）时由它驱动推进
    if (isPlaying && !useVideoSound) {
      clearSafetyTimer();
      const safetySeconds = (dur || currentShot.duration_s) + 3;
      safetyTimerRef.current = setTimeout(() => {
        handleNext();
      }, safetySeconds * 1000);
    }
  }, [currentShot, isPlaying, useVideoSound, handleNext, clearSafetyTimer]);

  // Video metadata loaded
  const handleVideoMetadata = useCallback(() => {
    if (!videoRef.current) return;
    const exact = Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : 0;
    const dur = Math.ceil(exact);
    setVideoDuration(dur);
    setMediaDuration(exact);

    // 仅当画面声音是主轨时由视频驱动推进
    if (isPlaying && useVideoSound) {
      clearSafetyTimer();
      const safetySeconds = dur + 3;
      safetyTimerRef.current = setTimeout(() => {
        handleNext();
      }, safetySeconds * 1000);
    }
  }, [isPlaying, useVideoSound, handleNext, clearSafetyTimer]);

  // 主轨结束才推进，避免画面/配音任一先结束导致截断
  const handleAudioEnded = useCallback(() => {
    if (!useVideoSound) handlePlaybackEnded();
  }, [useVideoSound, handlePlaybackEnded]);

  const handleVideoEnded = useCallback(() => {
    if (useVideoSound) handlePlaybackEnded();
  }, [useVideoSound, handlePlaybackEnded]);

  // 智能默认（视频短/配音长）：TTS 模式下，仅当“需要放慢幅度 ≤ 10%”时轻微放慢视频铺满；
  // 超过 10% 则保持 1x —— 视频放完末帧定格、配音继续讲完（保旁白，绝不剪音频）。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (audioSource === 'tts' && hasVideo && audioDuration > 0 && videoDuration > 0 && videoDuration < audioDuration) {
      const stretch = audioDuration / videoDuration; // >1 = 需要放慢
      video.playbackRate = stretch <= 1.10 ? (videoDuration / audioDuration) : 1;
    } else {
      video.playbackRate = 1;
    }
  }, [audioDuration, videoDuration, audioSource, hasVideo, currentIndex]);

  // 进度条拖动：定位视频到指定时间
  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const t = Math.max(0, Math.min(time, mediaDuration || video.duration || 0));
    video.currentTime = t;
    setCurrentTime(t);
  }, [mediaDuration]);

  const fmtTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s - Math.floor(s)) * 1000);
    return `${m}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  // 截取分镜画面：抓当前显示帧，文件名带秒+毫秒
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);
  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !currentShot) return;
    if (!video.videoWidth) { setCaptureMsg('视频未就绪'); setTimeout(() => setCaptureMsg(null), 2000); return; }
    const t = video.currentTime || 0;
    const sec = Math.floor(t);
    const ms = Math.round((t - sec) * 1000);
    const fname = `frame_${sec}s${String(ms).padStart(3, '0')}ms.jpg`;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setCaptureMsg('截图失败'); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.95));
      if (!blob) { setCaptureMsg('截图失败'); return; }
      const fd = new FormData();
      fd.append('file', new File([blob], fname, { type: 'image/jpeg' }));
      fd.append('filename', fname);
      const res = await fetch(`/api/assets/keyframes/${encodeURIComponent(currentShot.shot_id)}/upload`, { method: 'POST', body: fd });
      if (res.ok) {
        setCaptureMsg(`已截取 ${sec}秒${ms}毫秒 → ${fname}`);
        onCaptured?.();
      } else {
        const d = await res.json().catch(() => ({}));
        setCaptureMsg(d.error || '保存失败');
      }
    } catch {
      setCaptureMsg('截图失败');
    }
    setTimeout(() => setCaptureMsg(null), 3000);
  }, [currentShot, onCaptured]);

  // 从当前进度位置，按 timeline 插入新的分镜头（当前帧作新镜首帧）
  const handleSaveAsNewShot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !currentShot) return;
    if (!video.videoWidth) { setCaptureMsg('视频未就绪'); setTimeout(() => setCaptureMsg(null), 2000); return; }
    const t = video.currentTime || 0;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setCaptureMsg('截图失败'); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.95));
      const fd = new FormData();
      if (blob) fd.append('file', new File([blob], 'frame_00.jpg', { type: 'image/jpeg' }));
      fd.append('from_shot_id', currentShot.shot_id);
      fd.append('time', String(t));
      fd.append('media_duration', String(mediaDuration || video.duration || 0));
      const res = await fetch('/api/shots/split', { method: 'POST', body: fd });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        const newId = d.new_shot_id || '新分镜';
        const sourceId = d.source_shot_id || currentShot.shot_id;
        const promptNote = d.prompt_rebuild?.success === false ? '，提示词重编译失败' : '，提示词已重编译';
        setCaptureMsg(`已插入 ${newId}（${sourceId} 第 ${fmtTime(t)}${promptNote}）`);
        onCaptured?.();
      } else {
        const d = await res.json().catch(() => ({}));
        setCaptureMsg(d.error || '新建分镜失败');
      }
    } catch {
      setCaptureMsg('新建分镜失败');
    }
    setTimeout(() => setCaptureMsg(null), 3500);
  }, [currentShot, mediaDuration, onCaptured]);

  // AI 匹配画面时长，重新生成配音
  const handleRegenTts = useCallback(async () => {
    if (!currentShot || !videoDuration) return;
    setRegenLoading(true);
    setRegenMsg(null);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot_id: currentShot.shot_id, target_duration: videoDuration })
      });
      if (res.ok) {
        setAudioDuration(0);
        setAudioVersion(v => v + 1); // 触发音频重新加载
        setRegenMsg('已按画面时长重新生成配音');
      } else {
        const d = await res.json().catch(() => ({}));
        setRegenMsg(d.error || '重新生成失败');
      }
    } catch {
      setRegenMsg('重新生成失败');
    } finally {
      setRegenLoading(false);
    }
  }, [currentShot, videoDuration]);

  // 档3 · AI 润色台词（更柔和；有视频不匹配时按画面时长控制字数），随后重生成配音
  const handleOptimizeVoiceover = useCallback(async () => {
    if (!currentShot) return;
    const fitDuration = audioSource === 'tts' && videoDuration > 0 ? videoDuration : undefined;
    setRegenLoading(true);
    setRegenMsg(null);
    try {
      const res = await fetch('/api/ai/optimize-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot_id: currentShot.shot_id, target_duration: fitDuration })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.text) {
        setTextOverrides(prev => ({ ...prev, [currentShot.shot_id]: d.text }));
        // 台词已改，按画面时长重新生成配音
        await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shot_id: currentShot.shot_id, target_duration: fitDuration })
        });
        setAudioDuration(0);
        setAudioVersion(v => v + 1);
        setRegenMsg('已润色台词并重配配音');
      } else {
        setRegenMsg(d.error || '台词润色失败');
      }
    } catch {
      setRegenMsg('台词润色失败');
    } finally {
      setRegenLoading(false);
    }
  }, [currentShot, audioSource, videoDuration]);

  const hasVoiceover = !!(currentShot?.voiceover?.text || currentShot?.dialogue?.text);

  // Video playback error fallback
  const handleVideoError = useCallback(() => {
    setVideoHasError(true);
    clearSafetyTimer();
    if (isPlaying) {
      safetyTimerRef.current = setTimeout(() => {
        handleNext();
      }, Math.max(1, currentShot.duration_s) * 1000);
    }
  }, [clearSafetyTimer, currentShot, isPlaying, handleNext]);

  // Audio playback error fallback
  const handleAudioError = useCallback(() => {
    setAudioDuration(0);
    // If there is no video, we must set a safety timer to advance the shot
    if (isPlaying && !currentShot._video_url) {
      clearSafetyTimer();
      safetyTimerRef.current = setTimeout(() => {
        handleNext();
      }, Math.max(1, currentShot.duration_s) * 1000);
    }
  }, [clearSafetyTimer, currentShot, isPlaying, handleNext]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, handlePrev, handleNext]);

  if (!currentShot) return <div className="text-slate-500">暂无镜头数据。</div>;

  const effectiveDuration = (useVideoSound ? videoDuration : audioDuration) || currentShot.duration_s;
  // TTS 模式 + 有视频时，比较配音与画面时长
  const canCompare = hasVideo && audioSource === 'tts' && audioDuration > 0 && videoDuration > 0;
  const rawFit = canCompare ? videoDuration / audioDuration : 1; // 视频需要的速度倍率
  // 档2：±10% 以内 → 视频微调静默吸收
  const absorbed = canCompare && Math.abs(videoDuration - audioDuration) >= 1 && rawFit >= 0.9 && rawFit <= 1.1;
  const fitRate = Math.min(1.1, Math.max(0.9, rawFit));
  // 差太多（超出 ±10%）→ 提示按画面时长重配 TTS（含闭环 + 可改台词）
  const durMismatch = canCompare && (rawFit < 0.9 || rawFit > 1.1);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-800 bg-black shadow-2xl">
      <div className="relative w-full aspect-video bg-black">
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {currentVideo && !videoHasError ? (
            <video
              key={currentShot.shot_id}
              ref={videoRef}
              src={currentVideo}
              poster={currentImage || undefined}
              preload="auto"
              onLoadedMetadata={handleVideoMetadata}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
              onError={handleVideoError}
              onEnded={handleVideoEnded}
              className="max-h-full max-w-full w-auto h-auto"
              style={{
                objectFit: currentLayout.fitMode,
                transform: `scale(${currentLayout.scale}) scaleX(${currentLayout.stretchX}) scaleY(${currentLayout.stretchY})`,
                transition: 'transform 0.1s ease-out'
              }}
              playsInline
            />
          ) : currentImage ? (
            <img
              src={currentImage}
              alt={`${currentShot.shot_id} keyframe`}
              className="max-h-full max-w-full w-auto h-auto"
              style={{
                objectFit: currentLayout.fitMode,
                transform: `scale(${currentLayout.scale}) scaleX(${currentLayout.stretchX}) scaleY(${currentLayout.stretchY})`,
                transition: 'transform 0.1s ease-out'
              }}
            />
          ) : (
            <div className="text-center p-8">
              <div className="mx-auto mb-4 h-16 w-16 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center text-slate-400">
                {currentShot.shot_id}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{currentShot.shot_id}</h2>
              <p className="text-slate-400 font-mono text-sm mb-4">
                {currentShot.scene_ref?.replace('scenes/', '').replace('.json', '')}
              </p>
              <div className="max-w-2xl rounded bg-slate-800/50 p-3 text-sm italic text-blue-200 sm:p-4 sm:text-lg">
                "{currentShot.action?.beats?.[0] || '等待回填关键帧'}"
              </div>
            </div>
          )}
        </div>

        {/* Floating Layout Adjust Control */}
        <div className="absolute top-3 right-3 z-30">
          <button
            onClick={() => setShowAdjustPanel(!showAdjustPanel)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold backdrop-blur-sm shadow-lg transition ${
              showAdjustPanel
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="画面拉伸与微调"
          >
            <Sliders size={14} />
            <span>画面微调</span>
          </button>

          {showAdjustPanel && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 border border-slate-700 rounded-xl p-4 shadow-2xl backdrop-blur-sm text-slate-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">分镜 {currentShot?.shot_id} 画面微调</span>
                <button
                  onClick={() => setShowAdjustPanel(false)}
                  className="text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Fit Mode selection */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">填充模式</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['contain', 'cover', 'fill'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => updateCurrentLayout({ fitMode: mode })}
                        className={`text-[10px] py-1 rounded transition border ${
                          currentLayout.fitMode === mode
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-450 hover:text-slate-200'
                        }`}
                      >
                        {mode === 'contain' ? '适应' : mode === 'cover' ? '裁剪' : '拉伸'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zoom Scale slider */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>等比缩放</span>
                    <span>{Math.round(currentLayout.scale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={currentLayout.scale}
                    onChange={e => updateCurrentLayout({ scale: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Stretch X Slider */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>水平伸缩</span>
                    <span>{Math.round(currentLayout.stretchX * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={currentLayout.stretchX}
                    onChange={e => updateCurrentLayout({ stretchX: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Stretch Y Slider */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>垂直伸缩</span>
                    <span>{Math.round(currentLayout.stretchY * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={currentLayout.stretchY}
                    onChange={e => updateCurrentLayout({ stretchY: Number(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Reset button */}
                <button
                  onClick={resetCurrentLayout}
                  className="w-full py-1.5 mt-1 bg-slate-850 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-semibold text-slate-300 hover:text-white transition flex items-center justify-center gap-1"
                >
                  <RotateCcw size={10} />
                  重置当前分镜画面
                </button>
              </div>
            </div>
          )}
        </div>



        {/* 统一底部字幕（电影风格：白字黑描边） */}
        {currentLine && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4" style={{ zIndex: 10 }}>
            <span
              style={{
                fontSize: `${subtitleStyle.fontSize}px`,
                fontFamily: subtitleStyle.fontFamily,
                color: subtitleStyle.textColor,
                WebkitTextStroke: subtitleStyle.strokeWidth > 0 ? `${subtitleStyle.strokeWidth * 2}px #000` : 'none',
                paintOrder: 'stroke fill',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                padding: '4px 0',
                maxWidth: '90%',
                textAlign: 'center',
                fontWeight: 600,
                lineHeight: 1.5,
                letterSpacing: '0.05em',
              }}
            >
              {currentLine}
            </span>
          </div>
        )}

        <audio
          ref={audioRef}
          onLoadedMetadata={handleAudioMetadata}
          onError={handleAudioError}
          onEnded={handleAudioEnded}
        />
      </div>

      {/* 视频进度条：可拖动定位，便于截取任意时间点的分镜画面 */}
      {hasVideo && mediaDuration > 0 && (
        <div className="flex items-center gap-3 border-t border-slate-800 bg-slate-950 px-3 pt-3 sm:px-4">
          <span className="text-[11px] font-mono text-slate-400 tabular-nums whitespace-nowrap">{fmtTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={mediaDuration}
            step={0.01}
            value={Math.min(currentTime, mediaDuration)}
            onChange={e => handleSeek(Number(e.target.value))}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            title="拖动定位视频，到目标时间点后可点「截取此帧」"
          />
          <span className="text-[11px] font-mono text-slate-500 tabular-nums whitespace-nowrap">{fmtTime(mediaDuration)}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-950 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-4">
          <button onClick={handlePrev} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
            <SkipBack size={24} />
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-full transition shadow-lg hover:shadow-blue-500/20"
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </button>

          <button onClick={handleNext} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
            <SkipForward size={24} />
          </button>

          {hasVideo && (
            <button
              onClick={handleCapture}
              title="截取当前帧为分镜画面（文件名带秒+毫秒）"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-blue-600/15 text-blue-300 border border-blue-500/30 hover:bg-blue-600/25 transition"
            >
              <Camera size={16} />
              截取此帧
            </button>
          )}
          {hasVideo && (
            <button
              onClick={handleSaveAsNewShot}
              title={`从当前位置插入新分镜（按 timeline 重排 A/B/C 编号，取自 ${currentShot.shot_id}）`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-purple-600/15 text-purple-300 border border-purple-500/30 hover:bg-purple-600/25 transition"
            >
              <Scissors size={16} />
              存为新分镜
            </button>
          )}
          {captureMsg && (
            <span className="text-[11px] text-emerald-300 font-mono whitespace-nowrap">{captureMsg}</span>
          )}

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-full transition ${showSettings ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
              title="字幕设置"
            >
              <Settings size={20} />
            </button>

            {showSettings && (
              <div className="absolute bottom-full left-0 mb-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-200">字幕样式</h4>
                  <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white">
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">字号 ({subtitleStyle.fontSize}px)</label>
                    <input type="range" min="14" max="40" value={subtitleStyle.fontSize}
                      onChange={e => onSubtitleStyleChange({...subtitleStyle, fontSize: Number(e.target.value)})}
                      className="w-full" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">字体</label>
                    <select value={subtitleStyle.fontFamily}
                      onChange={e => onSubtitleStyleChange({...subtitleStyle, fontFamily: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200">
                      {FONT_FAMILIES.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">颜色</label>
                    <div className="flex gap-2">
                      {['#ffffff', '#ffff00', '#00ff00', '#ff8800', '#88ccff'].map(c => (
                        <button key={c} onClick={() => onSubtitleStyleChange({...subtitleStyle, textColor: c})}
                          className="w-6 h-6 rounded-full border-2 transition"
                          style={{ backgroundColor: c, borderColor: subtitleStyle.textColor === c ? '#fff' : 'transparent' }} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">描边 ({subtitleStyle.strokeWidth}px)</label>
                    <input type="range" min="0" max="6" value={subtitleStyle.strokeWidth}
                      onChange={e => onSubtitleStyleChange({...subtitleStyle, strokeWidth: Number(e.target.value)})}
                      className="w-full" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">背景 ({subtitleStyle.bgOpacity}%)</label>
                    <input type="range" min="0" max="90" value={subtitleStyle.bgOpacity}
                      onChange={e => onSubtitleStyleChange({...subtitleStyle, bgOpacity: Number(e.target.value)})}
                      className="w-full" />
                  </div>

                  {/* 效果预览 */}
                  <div className="bg-black rounded-lg p-3 mt-2">
                    <div className="text-[10px] text-slate-500 mb-1">预览</div>
                    <div className="text-center" style={{
                      fontSize: `${Math.min(subtitleStyle.fontSize, 20)}px`,
                      fontFamily: subtitleStyle.fontFamily,
                      color: subtitleStyle.textColor,
                      WebkitTextStroke: subtitleStyle.strokeWidth > 0 ? `${subtitleStyle.strokeWidth * 2}px #000` : 'none',
                      paintOrder: 'stroke fill',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      fontWeight: 600,
                      lineHeight: 1.5,
                    }}>
                      {(shots.map(s => s.voiceover?.text || s.dialogue?.text).find(Boolean) || '字幕预览示例').split(/(?<=[。，,.;；!！?？])/)[0]}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
          {/* 声音来源切换：默认 TTS 配音，可切画面声音 */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 whitespace-nowrap">声音来源</span>
            <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden text-xs">
              <button
                onClick={() => setAudioSource('tts')}
                className={`px-2.5 py-1 transition ${audioSource === 'tts' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="使用 TTS 配音（画面静音，仅作画面）"
              >
                TTS 配音
              </button>
              <button
                onClick={() => hasVideo && setAudioSource('video')}
                disabled={!hasVideo}
                className={`px-2.5 py-1 transition ${audioSource === 'video' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                title={hasVideo ? '使用画面自带声音' : '当前镜头无上传视频'}
              >
                画面声音
              </button>
            </div>
          </div>

          {/* AI 润色台词：更柔和自然；有视频且时长不匹配时，按画面时长控制字数后重配配音 */}
          {hasVoiceover && (
            <button
              onClick={handleOptimizeVoiceover}
              disabled={regenLoading}
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50 text-xs whitespace-nowrap transition"
              title={durMismatch ? '按画面时长把台词改短/改长并更柔和，再重配配音' : '把台词改得更自然、柔和'}
            >
              {regenLoading ? '处理中…' : (durMismatch ? 'AI 润色台词配时长' : 'AI 润色台词')}
            </button>
          )}

          {/* 档2：差一两秒，视频速度已静默吸收 */}
          {absorbed && (
            <span className="text-[11px] text-slate-500 whitespace-nowrap">
              画面 {fitRate.toFixed(2)}x 贴合配音
            </span>
          )}

          {/* 档3：差太多 → AI 匹配时长重生成（闭环，必要时改台词） */}
          {durMismatch && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-amber-400 whitespace-nowrap">
                配音 {audioDuration}s / 画面 {videoDuration}s
              </span>
              <button
                onClick={handleRegenTts}
                disabled={regenLoading}
                className="px-2.5 py-1 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-50 text-xs whitespace-nowrap transition"
                title="按画面时长用 AI 调整语速重新生成配音"
              >
                {regenLoading ? '生成中…' : 'AI 匹配时长重生成'}
              </button>
            </div>
          )}
          {regenMsg && !durMismatch && (
            <span className="text-[11px] text-emerald-400 whitespace-nowrap">{regenMsg}</span>
          )}

          <div className="text-slate-500 font-mono text-sm whitespace-nowrap">
            镜头 {currentIndex + 1} / {shots.length} · {effectiveDuration}秒
          </div>
        </div>
      </div>
    </div>
  );
};

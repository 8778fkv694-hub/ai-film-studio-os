"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Settings, X } from 'lucide-react';

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
}

export default function Player({ shots, subtitleStyle, onSubtitleStyleChange }: PlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentLine, setCurrentLine] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRequestedRef = useRef(false);
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentShot = shots[currentIndex];
  const currentImage = currentShot?._selected_keyframe || currentShot?._keyframes?.[0] || null;
  const currentVideo = currentShot?._video_url || null;


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

    const text = currentShot?.voiceover?.text || currentShot?.dialogue?.text || '';
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
  }, [currentIndex, currentShot, isPlaying]);

  // Switch shot: load audio or video
  useEffect(() => {
    advanceRequestedRef.current = false;
    clearSafetyTimer();
    setAudioDuration(0);

    const audio = audioRef.current;
    const video = videoRef.current;

    if (audio) {
      audio.pause();
      audio.src = `/api/assets/audio/${currentShot.shot_id}.mp3`;
      audio.currentTime = 0;
      audio.load();
    }

    if (video) {
      video.pause();
      if (currentShot._video_url) {
        video.src = currentShot._video_url;
        video.currentTime = 0;
        video.load();
      } else {
        video.src = '';
      }
    }

    if (isPlaying) {
      if (currentShot._video_url && video) {
        video.play().catch(() => {
          safetyTimerRef.current = setTimeout(() => {
            handleNext();
          }, Math.max(1, currentShot.duration_s) * 1000);
        });
      } else if (audio) {
        audio.play().catch(() => {
          safetyTimerRef.current = setTimeout(() => {
            handleNext();
          }, Math.max(1, currentShot.duration_s) * 1000);
        });
      } else {
        safetyTimerRef.current = setTimeout(() => {
          handleNext();
        }, Math.max(1, currentShot.duration_s) * 1000);
      }
    }
  }, [currentIndex, isPlaying, currentShot, handleNext, clearSafetyTimer]);

  // Playback ended → advance
  const handlePlaybackEnded = useCallback(() => {
    clearSafetyTimer();
    handleNext();
  }, [clearSafetyTimer, handleNext]);

  // Audio metadata loaded
  const handleAudioMetadata = useCallback(() => {
    if (!audioRef.current || currentShot._video_url) return;
    const dur = Number.isFinite(audioRef.current.duration)
      ? Math.ceil(audioRef.current.duration)
      : 0;
    setAudioDuration(dur);

    const safetySeconds = currentShot.duration_s + 3;
    if (isPlaying && safetySeconds > 0) {
      safetyTimerRef.current = setTimeout(() => {
        handleNext();
      }, safetySeconds * 1000);
    }
  }, [currentShot, isPlaying, handleNext]);

  // Video metadata loaded
  const handleVideoMetadata = useCallback(() => {
    if (!videoRef.current) return;
    const dur = Number.isFinite(videoRef.current.duration)
      ? Math.ceil(videoRef.current.duration)
      : 0;
    setAudioDuration(dur);

    const safetySeconds = dur + 3;
    if (isPlaying && safetySeconds > 0) {
      safetyTimerRef.current = setTimeout(() => {
        handleNext();
      }, safetySeconds * 1000);
    }
  }, [isPlaying, handleNext]);

  // Playback error fallback
  const handlePlaybackError = useCallback(() => {
    clearSafetyTimer();
    setAudioDuration(0);
    if (isPlaying) {
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

  const effectiveDuration = audioDuration || currentShot.duration_s;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-800 bg-black shadow-2xl">
      <div className="relative aspect-video w-full flex items-center justify-center bg-slate-950">
        {currentVideo ? (
          <video
            ref={videoRef}
            src={currentVideo}
            onLoadedMetadata={handleVideoMetadata}
            onError={handlePlaybackError}
            onEnded={handlePlaybackEnded}
            className="absolute inset-0 h-full w-full object-contain bg-black"
            playsInline
          />
        ) : currentImage ? (
          <img
            src={currentImage}
            alt={`${currentShot.shot_id} keyframe`}
            className="absolute inset-0 h-full w-full object-contain bg-black"
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

        {/* 统一底部字幕（电影风格：白字黑描边） */}
        {currentLine && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4" style={{ zIndex: 10 }}>
            <span
              style={{
                fontSize: `${subtitleStyle.fontSize}px`,
                fontFamily: subtitleStyle.fontFamily,
                color: subtitleStyle.textColor,
                textShadow: subtitleStyle.strokeWidth > 0
                  ? `${subtitleStyle.strokeWidth}px ${subtitleStyle.strokeWidth}px 0 #000, -${subtitleStyle.strokeWidth}px -${subtitleStyle.strokeWidth}px 0 #000, ${subtitleStyle.strokeWidth}px -${subtitleStyle.strokeWidth}px 0 #000, -${subtitleStyle.strokeWidth}px ${subtitleStyle.strokeWidth}px 0 #000, 0 ${subtitleStyle.strokeWidth}px 0 #000, 0 -${subtitleStyle.strokeWidth}px 0 #000, ${subtitleStyle.strokeWidth}px 0 0 #000, -${subtitleStyle.strokeWidth}px 0 0 #000`
                  : 'none',
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
          onError={handlePlaybackError}
          onEnded={handlePlaybackEnded}
        />
      </div>

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
                      textShadow: subtitleStyle.strokeWidth > 0
                        ? `${subtitleStyle.strokeWidth}px ${subtitleStyle.strokeWidth}px 0 #000, -${subtitleStyle.strokeWidth}px -${subtitleStyle.strokeWidth}px 0 #000, ${subtitleStyle.strokeWidth}px -${subtitleStyle.strokeWidth}px 0 #000, -${subtitleStyle.strokeWidth}px ${subtitleStyle.strokeWidth}px 0 #000, 0 ${subtitleStyle.strokeWidth}px 0 #000, 0 -${subtitleStyle.strokeWidth}px 0 #000, ${subtitleStyle.strokeWidth}px 0 0 #000, -${subtitleStyle.strokeWidth}px 0 0 #000`
                        : 'none',
                      fontWeight: 600,
                      lineHeight: 1.5,
                    }}>
                      欢迎参观滤芯洁净车间
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-slate-500 font-mono text-sm">
          镜头 {currentIndex + 1} / {shots.length} · {effectiveDuration}秒
        </div>
      </div>
    </div>
  );
};

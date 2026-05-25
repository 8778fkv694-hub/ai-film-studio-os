"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

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

interface PlayerProps {
  shots: Shot[];
}

export default function Player({ shots }: PlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRequestedRef = useRef(false);

  const currentShot = shots[currentIndex];
  const currentImage = currentShot?._selected_keyframe || currentShot?._keyframes?.[0] || null;

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

  // Switch shot: load audio
  useEffect(() => {
    advanceRequestedRef.current = false;
    clearSafetyTimer();
    setAudioDuration(0);

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.src = `/api/assets/audio/${currentShot.shot_id}.mp3`;
    audio.currentTime = 0;
    audio.load();

    if (isPlaying) {
      audio.play().catch(() => {
        // Audio failed — fall back to timer-based advance
        safetyTimerRef.current = setTimeout(() => {
          handleNext();
        }, Math.max(1, currentShot.duration_s) * 1000);
      });
    }
  }, [currentIndex, isPlaying, currentShot, handleNext, clearSafetyTimer]);

  // Audio ended → advance (primary advance mechanism)
  const handleAudioEnded = useCallback(() => {
    clearSafetyTimer();
    handleNext();
  }, [clearSafetyTimer, handleNext]);

  // Audio metadata loaded
  const handleAudioMetadata = useCallback(() => {
    if (!audioRef.current) return;
    const dur = Number.isFinite(audioRef.current.duration)
      ? Math.ceil(audioRef.current.duration)
      : 0;
    setAudioDuration(dur);

    // Safety fallback: max timer = shot.duration_s + 3 seconds
    const safetySeconds = currentShot.duration_s + 3;
    if (isPlaying && safetySeconds > 0) {
      safetyTimerRef.current = setTimeout(() => {
        handleNext();
      }, safetySeconds * 1000);
    }
  }, [currentShot, isPlaying, handleNext]);

  // Audio error — fall back to timer
  const handleAudioError = useCallback(() => {
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
      <div className="relative w-full aspect-video bg-slate-900 flex items-center justify-center">

        {currentImage ? (
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

        {currentShot.voiceover?.text && (
          <div className="absolute left-3 right-3 top-3 sm:left-6 sm:right-auto sm:top-6 sm:max-w-xl">
            <div className="rounded bg-slate-950/80 px-3 py-2 text-left text-xs leading-5 text-slate-100 shadow-lg sm:text-sm">
              {currentShot.voiceover.text}
            </div>
          </div>
        )}

        {currentShot.dialogue && (
          <div className="absolute bottom-4 left-0 right-0 px-3 text-center sm:bottom-12 sm:px-8">
            <span className="inline-block rounded bg-black/80 px-3 py-2 text-sm font-semibold text-yellow-300 shadow-lg sm:px-4 sm:text-xl">
              {currentShot.dialogue.text}
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
        </div>

        <div className="text-slate-500 font-mono text-sm">
          镜头 {currentIndex + 1} / {shots.length} · {effectiveDuration}秒
        </div>
      </div>
    </div>
  );
};

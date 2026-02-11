"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface Shot {
  shot_id: string;
  duration_s: number;
  action?: { beats?: string[] };
  dialogue?: { text: string; speaker: string };
  scene_ref?: string;
  characters?: { ref: string }[];
  props?: { ref: string; state?: string }[];
  cam_setup_ref?: string;
  _source?: string;
}

interface PlayerProps {
  shots: Shot[];
}

// Color palette for visual variety per shot (cycles through)
const SCENE_PALETTES = [
  { bg: 'from-slate-900 via-indigo-950 to-slate-900', accent: 'text-indigo-300', bar: 'bg-indigo-500' },
  { bg: 'from-slate-900 via-amber-950 to-slate-900', accent: 'text-amber-300', bar: 'bg-amber-500' },
  { bg: 'from-slate-900 via-emerald-950 to-slate-900', accent: 'text-emerald-300', bar: 'bg-emerald-500' },
  { bg: 'from-slate-900 via-rose-950 to-slate-900', accent: 'text-rose-300', bar: 'bg-rose-500' },
  { bg: 'from-slate-900 via-cyan-950 to-slate-900', accent: 'text-cyan-300', bar: 'bg-cyan-500' },
  { bg: 'from-slate-900 via-purple-950 to-slate-900', accent: 'text-purple-300', bar: 'bg-purple-500' },
];

export default function Player({ shots }: PlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const beatTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentShot = shots[currentIndex];
  const palette = SCENE_PALETTES[currentIndex % SCENE_PALETTES.length];

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < shots.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentIndex, shots.length]);

  // Drive playback: audio + progress bar + auto-advance + beat animation
  useEffect(() => {
    if (!currentShot) return;

    setProgress(0);
    setBeatIndex(0);

    if (audioRef.current) {
      audioRef.current.src = `/api/assets/audio/${currentShot.shot_id}.mp3`;
      audioRef.current.muted = muted;
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }

    if (isPlaying) {
      clearAllTimers();

      // Progress bar animation (update every 50ms)
      const durationMs = currentShot.duration_s * 1000;
      const startTime = Date.now();
      progressRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setProgress(Math.min(elapsed / durationMs, 1));
      }, 50);

      // Auto-advance
      timerRef.current = setTimeout(() => {
        handleNext();
      }, durationMs);

      // Animate through beats sequentially
      const beats = currentShot.action?.beats || [];
      if (beats.length > 1) {
        const beatInterval = durationMs / beats.length;
        let i = 1;
        const scheduleBeat = () => {
          beatTimerRef.current = setTimeout(() => {
            setBeatIndex(i);
            i++;
            if (i < beats.length) scheduleBeat();
          }, beatInterval);
        };
        scheduleBeat();
      }
    }

    return clearAllTimers;
  }, [currentIndex, isPlaying, currentShot, clearAllTimers, handleNext, muted]);

  // Sync mute state
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Jump to specific shot via thumbnail strip
  const jumpTo = (idx: number) => {
    setCurrentIndex(idx);
    if (!isPlaying) setProgress(0);
  };

  if (!currentShot) return <div className="text-slate-500">No shots loaded.</div>;

  const beats = currentShot.action?.beats || [];
  const sceneName = currentShot.scene_ref?.replace('scenes/', '').replace('.json', '').replace(/_/g, ' ') || 'Unknown Scene';
  const charNames = (currentShot.characters || []).map(c => c.ref.replace('characters/', '').replace('.json', ''));
  const propNames = (currentShot.props || []).map(p => `${p.ref.replace('props/', '').replace('.json', '')}${p.state ? ` (${p.state})` : ''}`);

  return (
    <div className="w-full bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Viewport (16:9) */}
      <div className={`relative w-full aspect-video bg-gradient-to-br ${palette.bg} flex flex-col items-center justify-center overflow-hidden`}>

        {/* Shot ID badge (top-left) */}
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <span className="bg-black/60 backdrop-blur px-3 py-1 rounded-full text-white font-mono text-sm font-bold">
            {currentShot.shot_id}
          </span>
          {currentShot._source === 'shots_draft' && (
            <span className="bg-yellow-600/80 backdrop-blur px-2 py-0.5 rounded-full text-xs text-white font-semibold">DRAFT</span>
          )}
        </div>

        {/* Duration badge (top-right) */}
        <div className="absolute top-4 right-4 z-10">
          <span className="bg-black/60 backdrop-blur px-3 py-1 rounded-full text-slate-300 font-mono text-sm">
            {currentShot.duration_s}s
          </span>
        </div>

        {/* Main storyboard content */}
        <div className="flex flex-col items-center justify-center text-center px-8 max-w-3xl z-10">
          {/* Scene name */}
          <div className={`text-xs uppercase tracking-widest mb-3 ${palette.accent} opacity-70`}>
            {sceneName}
            {currentShot.cam_setup_ref && <span className="ml-2 opacity-50">/ {currentShot.cam_setup_ref}</span>}
          </div>

          {/* Action beat (animated - cycles through beats during playback) */}
          <div className="relative min-h-[4rem] flex items-center justify-center">
            <p className="text-xl md:text-2xl text-white font-light leading-relaxed transition-all duration-500">
              {beats[beatIndex] || beats[0] || 'No action description'}
            </p>
          </div>

          {/* Beat dots indicator */}
          {beats.length > 1 && (
            <div className="flex gap-1.5 mt-4">
              {beats.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === beatIndex ? `${palette.bar} scale-125` : 'bg-white/20'}`}
                />
              ))}
            </div>
          )}

          {/* Characters & Props strip */}
          {(charNames.length > 0 || propNames.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-5 justify-center">
              {charNames.map(name => (
                <span key={name} className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {name}
                </span>
              ))}
              {propNames.map(name => (
                <span key={name} className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Subtitle / Dialogue overlay */}
        {currentShot.dialogue && (
          <div className="absolute bottom-6 left-0 right-0 text-center px-8 z-10">
            <div className="inline-block bg-black/80 backdrop-blur-sm rounded-lg px-6 py-3 max-w-2xl shadow-2xl">
              <span className="text-yellow-400/80 text-xs font-semibold uppercase tracking-wide block mb-1">
                {currentShot.dialogue.speaker}
              </span>
              <span className="text-white text-lg md:text-xl font-medium italic">
                &ldquo;{currentShot.dialogue.text}&rdquo;
              </span>
            </div>
          </div>
        )}

        {/* Vignette overlay for cinematic feel */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)'
        }} />

        <audio ref={audioRef} />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-900 relative">
        <div
          className={`h-full ${palette.bar} transition-all duration-100 ease-linear`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="bg-slate-950 px-4 py-3 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handlePrev} disabled={currentIndex === 0} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white disabled:opacity-30 transition">
              <SkipBack size={20} />
            </button>

            <button
              onClick={togglePlay}
              className="w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-full transition shadow-lg hover:shadow-blue-500/20"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>

            <button onClick={handleNext} disabled={currentIndex === shots.length - 1} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white disabled:opacity-30 transition">
              <SkipForward size={20} />
            </button>

            <button onClick={() => setMuted(!muted)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition ml-1">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          <div className="text-slate-500 font-mono text-sm">
            {currentIndex + 1} / {shots.length}
          </div>
        </div>

        {/* Thumbnail strip */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {shots.map((shot, idx) => (
            <button
              key={shot.shot_id}
              onClick={() => jumpTo(idx)}
              className={`shrink-0 px-3 py-1.5 rounded text-xs font-mono transition-all ${
                idx === currentIndex
                  ? 'bg-blue-600 text-white shadow-md'
                  : idx < currentIndex
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  : 'bg-slate-900 text-slate-500 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {shot.shot_id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

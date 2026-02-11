"use client";

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface Shot {
  shot_id: string;
  duration_s: number;
  action?: { beats?: string[] };
  dialogue?: { text: string; speaker: string };
  scene_ref?: string;
}

interface PlayerProps {
  shots: Shot[];
}

export default function Player({ shots }: PlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentShot = shots[currentIndex];

  // Reset when shot changes
  useEffect(() => {
    if (!currentShot) return;

    // Play audio if available
    if (audioRef.current) {
      audioRef.current.src = `/api/assets/audio/${currentShot.shot_id}.mp3`;
      if (isPlaying) {
        audioRef.current.play().catch(() => {}); // ignore errors if file missing
      }
    }

    // Auto-advance timer
    if (isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleNext();
      }, currentShot.duration_s * 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, isPlaying]);

  const handleNext = () => {
    if (currentIndex < shots.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false); // End of timeline
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  if (!currentShot) return <div className="text-slate-500">暂无镜头数据。</div>;

  return (
    <div className="w-full bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Viewport (16:9 Aspect Ratio) */}
      <div className="relative w-full aspect-video bg-slate-900 flex items-center justify-center">

        {/* Placeholder / Image */}
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🎬</div>
          <h2 className="text-2xl font-bold text-white mb-2">{currentShot.shot_id}</h2>
          <p className="text-slate-400 font-mono text-sm mb-4">
            {currentShot.scene_ref?.replace('scenes/', '').replace('.json', '')}
          </p>
          <div className="bg-slate-800/50 p-4 rounded text-lg text-blue-200 italic max-w-2xl">
            "{currentShot.action?.beats?.[0] || '...'}"
          </div>
        </div>

        {/* Subtitle Overlay */}
        {currentShot.dialogue && (
          <div className="absolute bottom-12 left-0 right-0 text-center px-8">
            <span className="inline-block bg-black/80 text-yellow-300 px-4 py-2 rounded text-xl font-semibold shadow-lg">
              {currentShot.dialogue.speaker}: {currentShot.dialogue.text}
            </span>
          </div>
        )}

        {/* Audio Element (Hidden) */}
        <audio ref={audioRef} onEnded={() => { /* allow timer to handle advance for pacing */ }} />
      </div>

      {/* Controls */}
      <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between">
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
          镜头 {currentIndex + 1} / {shots.length} · {currentShot.duration_s}秒
        </div>
      </div>
    </div>
  );
}

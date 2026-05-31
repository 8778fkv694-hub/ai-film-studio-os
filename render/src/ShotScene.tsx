import React from 'react';
import { Img, Audio, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import type { ShotData } from './data';

interface ShotSceneProps {
  shot: ShotData;
  keyframePath: string | null;
  audioPath: string | null;
}

const STYLE: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#0a0a0a',
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    position: 'absolute',
    inset: 0
  },
  narration: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    maxWidth: '70%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    padding: '12px 18px',
    fontSize: 20,
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
    color: '#e2e8f0',
    lineHeight: 1.6,
    zIndex: 10
  },
  subtitle: {
    position: 'absolute',
    bottom: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 6,
    padding: '10px 24px',
    fontSize: 28,
    fontWeight: 700,
    fontFamily: '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
    color: '#fde047',
    textAlign: 'center',
    maxWidth: '85%',
    zIndex: 10,
    whiteSpace: 'nowrap'
  },
  shotId: {
    position: 'absolute',
    bottom: 16,
    right: 20,
    fontSize: 14,
    fontFamily: 'monospace',
    color: 'rgba(148, 163, 184, 0.6)',
    zIndex: 10
  },
  placeholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontSize: 18,
    fontFamily: 'sans-serif'
  }
};

const FADE_DURATION = 12;

export const ShotScene: React.FC<ShotSceneProps> = ({ shot, keyframePath, audioPath }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const layout = shot.layout as {
    fitMode?: 'contain' | 'cover' | 'fill';
    scale?: number;
    stretchX?: number;
    stretchY?: number;
  } | undefined;

  const durationSeconds = shot.duration_s;
  const fadeFrames = Math.min(FADE_DURATION, fps * durationSeconds);
  const opacity = Math.min(1, frame / fadeFrames);

  const imageStyle: React.CSSProperties = {
    ...STYLE.image,
    objectFit: layout?.fitMode || 'contain',
    transform: `scale(${layout?.scale ?? 1.0}) scaleX(${layout?.stretchX ?? 1.0}) scaleY(${layout?.stretchY ?? 1.0})`,
  };

  return (
    <div style={STYLE.container}>
      {keyframePath ? (
        <Img src={staticFile(keyframePath)} style={imageStyle} />
      ) : (
        <div style={STYLE.placeholder}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{shot.shot_id}</div>
          <div>等待回填关键帧</div>
          <div style={{ fontSize: 14, marginTop: 8, color: '#64748b' }}>
            assets/renders/{shot.shot_id}/keyframes/
          </div>
        </div>
      )}

      {audioPath && <Audio src={staticFile(audioPath)} />}

      {shot.voiceover?.text && (
        <div style={{ ...STYLE.narration, opacity }}>
          {shot.voiceover.text}
        </div>
      )}

      {shot.dialogue?.text && (
        <div style={{ ...STYLE.subtitle, opacity }}>
          {shot.dialogue.speaker && (
            <span style={{ color: '#94a3b8', fontSize: 18, marginRight: 8 }}>
              {shot.dialogue.speaker}:
            </span>
          )}
          {shot.dialogue.text}
        </div>
      )}

      <div style={STYLE.shotId}>{shot.shot_id} · {durationSeconds}s</div>
    </div>
  );
};

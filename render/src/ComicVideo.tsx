import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Composition,
  Sequence,
  useVideoConfig,
  useCurrentFrame
} from 'remotion';
import { ShotScene } from './ShotScene';
import { useShots } from './data';

const FPS = 24;
const WIDTH = 1920;
const HEIGHT = 1080;
const CROSSFADE_FRAMES = 12;

const AllScenesContent: React.FC = () => {
  const shots = useShots();
  const frame = useCurrentFrame();

  if (shots.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#475569', fontSize: 24, fontFamily: 'sans-serif' }}>
          未找到镜头数据。请先运行 prepare-data.ts 生成数据。
        </div>
      </AbsoluteFill>
    );
  }

  let elapsedFrames = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {shots.map((scene, index) => {
        const shotFrames = Math.max(1, Math.round(scene.shot.duration_s * FPS));
        const startFrame = elapsedFrames;
        elapsedFrames += shotFrames - CROSSFADE_FRAMES;

        return (
          <Sequence
            key={scene.shot.shot_id}
            from={startFrame}
            durationInFrames={shotFrames}
          >
            <div style={{ position: 'absolute', inset: 0 }}>
              <ShotScene
                shot={scene.shot}
                keyframePath={scene.keyframe}
                audioPath={scene.audio}
              />

              {index < shots.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#0a0a0a',
                    opacity: Math.min(1, Math.max(0,
                      (frame - (startFrame + shotFrames - CROSSFADE_FRAMES)) / CROSSFADE_FRAMES
                    ))
                  }}
                />
              )}
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const ComicVideo: React.FC = () => {
  const shots = useShots();

  const totalSeconds = shots.reduce((sum, s) => sum + s.shot.duration_s, 0);
  const totalFrames = Math.max(1, Math.round(totalSeconds * FPS));

  return (
    <Composition
      id="ComicVideo"
      component={AllScenesContent}
      durationInFrames={totalFrames}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};

export const RemotionRoot: React.FC = () => {
  return <ComicVideo />;
};

export default ComicVideo;

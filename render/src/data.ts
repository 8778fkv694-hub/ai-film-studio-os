import { useMemo } from 'react';
import { manifest, type DataManifest } from './manifest';

export type { ShotData, ShotSceneInput } from './manifest';
export type { DataManifest };

export function useShots() {
  return useMemo(() => manifest.shots, []);
}

export function useProjectName() {
  return useMemo(() => manifest.projectName, []);
}

export function getTotalDuration() {
  return manifest.totalDuration;
}

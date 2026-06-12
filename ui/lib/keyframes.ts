import fs from 'fs';
import path from 'path';
import { KEYFRAME_EXTS as SHARED_KEYFRAME_EXTS, isSafeId } from '@shared/conventions.js';

export const KEYFRAME_EXTS = new Set(SHARED_KEYFRAME_EXTS);

export type KeyframeSaveMode = 'append' | 'replace';

interface SaveKeyframeOptions {
  assetsDir: string;
  shotId: string;
  buffer: Buffer;
  originalName: string;
  mode?: KeyframeSaveMode;
}

function listKeyframeFiles(keyframeDir: string) {
  if (!fs.existsSync(keyframeDir)) return [];
  return fs.readdirSync(keyframeDir)
    .filter(name => KEYFRAME_EXTS.has(path.extname(name).toLowerCase()))
    .sort();
}

function slotFromFilename(filename: string | undefined) {
  const match = filename?.match(/^frame_(\d+)/);
  return match ? match[1] : null;
}

function nextFrameSlot(existing: string[]) {
  let max = 0;
  for (const file of existing) {
    const slot = slotFromFilename(file);
    if (slot) max = Math.max(max, Number(slot));
  }
  return String(max + 1 || existing.length + 1).padStart(2, '0');
}

export function safeShotId(shotId: string) {
  return isSafeId(shotId);
}

export function saveKeyframeBuffer(options: SaveKeyframeOptions) {
  if (!safeShotId(options.shotId)) {
    throw new Error('无效镜头 ID');
  }

  const ext = path.extname(options.originalName).toLowerCase() || '.png';
  if (!KEYFRAME_EXTS.has(ext)) {
    throw new Error('仅支持 jpg、jpeg、png、webp');
  }

  const keyframeDir = path.join(options.assetsDir, 'renders', options.shotId, 'keyframes');
  fs.mkdirSync(keyframeDir, { recursive: true });

  const existing = listKeyframeFiles(keyframeDir);
  const mode = options.mode || 'append';
  const slot = mode === 'replace'
    ? (slotFromFilename(existing[0]) || '01')
    : nextFrameSlot(existing);
  const filename = `frame_${slot}${ext}`;

  if (mode === 'replace') {
    for (const file of existing) {
      if (slotFromFilename(file) === slot) {
        fs.unlinkSync(path.join(keyframeDir, file));
      }
    }
  }

  const filePath = path.join(keyframeDir, filename);
  fs.writeFileSync(filePath, options.buffer);

  return {
    filename,
    filePath,
    relativePath: `assets/renders/${options.shotId}/keyframes/${filename}`,
    url: `/api/assets/keyframes/${encodeURIComponent(options.shotId)}/${encodeURIComponent(filename)}`
  };
}

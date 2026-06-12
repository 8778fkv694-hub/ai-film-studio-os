import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getCurrentProjectPath, getResourcePath } from '@/lib/projects';
import { KEYFRAME_EXTS, saveKeyframeBuffer } from '@/lib/keyframes';
import { VIDEO_EXTS as SHARED_VIDEO_EXTS } from '@shared/conventions.js';

const execFileAsync = promisify(execFile);

const VIDEO_EXTS = new Set(SHARED_VIDEO_EXTS);

interface InboxEntry {
  filename: string;
  kind: 'image' | 'video' | 'unsupported';
  shotId: string | null;
}

function listShotIds(projectPath: string): string[] {
  const shotsDir = path.join(projectPath, 'shots');
  if (!fs.existsSync(shotsDir)) return [];
  return fs.readdirSync(shotsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''));
}

// 文件名 -> 镜头 ID：取能作为文件名前缀的最长镜头 ID（区分 S002 / S002A），
// 前缀之后必须是分隔符或扩展名，例如 S001_frame_01.png、S002A-v2.jpg、S003.mp4
function matchShotId(filename: string, shotIds: string[]): string | null {
  const base = path.basename(filename, path.extname(filename)).toUpperCase();
  let best: string | null = null;
  for (const id of shotIds) {
    const upper = id.toUpperCase();
    if (base === upper || (base.startsWith(upper) && /^[_\-. ]/.test(base.slice(upper.length)))) {
      if (!best || id.length > best.length) best = id;
    }
  }
  return best;
}

function scanInbox(projectPath: string): { inboxDir: string; entries: InboxEntry[] } {
  const inboxDir = path.join(projectPath, 'inbox');
  fs.mkdirSync(inboxDir, { recursive: true });
  const shotIds = listShotIds(projectPath);
  const entries: InboxEntry[] = fs.readdirSync(inboxDir)
    .filter(f => !f.startsWith('.') && fs.statSync(path.join(inboxDir, f)).isFile())
    .map(filename => {
      const ext = path.extname(filename).toLowerCase();
      const kind = KEYFRAME_EXTS.has(ext) ? 'image' : VIDEO_EXTS.has(ext) ? 'video' : 'unsupported';
      return {
        filename,
        kind,
        shotId: kind === 'unsupported' ? null : matchShotId(filename, shotIds)
      } as InboxEntry;
    });
  return { inboxDir, entries };
}

// GET：预览收件箱内容与匹配结果（不导入）
export async function GET() {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return NextResponse.json({ error: '未找到活动项目' }, { status: 404 });
  }
  const { entries } = scanInbox(projectPath);
  return NextResponse.json({ inbox: 'inbox/', entries });
}

// POST：把收件箱里能匹配到镜头的文件导入（图片 -> 关键帧，视频 -> take），
// 成功导入的文件移动到 inbox/imported/ 留底
export async function POST() {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return NextResponse.json({ error: '未找到活动项目' }, { status: 404 });
  }
  const { inboxDir, entries } = scanInbox(projectPath);
  const importedDir = path.join(inboxDir, 'imported');

  const imported: { filename: string; shotId: string; kind: string }[] = [];
  const skipped: { filename: string; reason: string }[] = [];

  for (const entry of entries) {
    const filePath = path.join(inboxDir, entry.filename);
    if (entry.kind === 'unsupported') {
      skipped.push({ filename: entry.filename, reason: '不支持的文件类型' });
      continue;
    }
    if (!entry.shotId) {
      skipped.push({ filename: entry.filename, reason: '文件名未匹配到镜头 ID（应以镜头号开头，如 S001_xxx.png）' });
      continue;
    }
    try {
      if (entry.kind === 'image') {
        saveKeyframeBuffer({
          assetsDir: getResourcePath('assets'),
          shotId: entry.shotId,
          buffer: fs.readFileSync(filePath),
          originalName: entry.filename,
          mode: 'append'
        });
      } else {
        const repoRoot = path.resolve(process.cwd(), '..');
        const toolPath = path.join(repoRoot, 'tools/scripts', 'import-take.js');
        await execFileAsync('node', [
          toolPath, entry.shotId, filePath,
          '--platform', 'inbox',
          '--project-dir', projectPath
        ], { cwd: repoRoot, timeout: 120000 });
      }
      fs.mkdirSync(importedDir, { recursive: true });
      let destName = entry.filename;
      if (fs.existsSync(path.join(importedDir, destName))) {
        const ext = path.extname(destName);
        destName = `${path.basename(destName, ext)}-${Date.now()}${ext}`;
      }
      fs.renameSync(filePath, path.join(importedDir, destName));
      imported.push({ filename: entry.filename, shotId: entry.shotId, kind: entry.kind });
    } catch (e: any) {
      skipped.push({ filename: entry.filename, reason: e?.message || '导入失败' });
    }
  }

  return NextResponse.json({ success: true, imported, skipped });
}

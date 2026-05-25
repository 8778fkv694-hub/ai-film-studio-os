import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getResourcePath } from '@/lib/projects';

const KEYFRAME_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

function listKeyframes(shotId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(shotId)) return [];

  const keyframeDir = path.join(getResourcePath('assets'), 'renders', shotId, 'keyframes');
  if (!fs.existsSync(keyframeDir)) return [];

  return fs.readdirSync(keyframeDir)
    .filter(file => KEYFRAME_EXTS.has(path.extname(file).toLowerCase()))
    .sort()
    .map(file => `/api/assets/keyframes/${encodeURIComponent(shotId)}/${encodeURIComponent(file)}`);
}

function findUploadedVideo(shotId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(shotId)) return null;
  const videoDir = path.join(getResourcePath('assets'), 'renders', shotId, 'video');
  if (!fs.existsSync(videoDir)) return null;

  const files = fs.readdirSync(videoDir);
  const videoFile = files.find(file => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.mp4' || ext === '.mov' || ext === '.webm' || ext === '.avi';
  });

  return videoFile ? `/api/assets/video/${encodeURIComponent(shotId)}/${encodeURIComponent(videoFile)}` : null;
}

export async function GET() {
  try {
    const shotsDir = getResourcePath('shots');
    if (!fs.existsSync(shotsDir)) {
      return NextResponse.json([]);
    }
    const promptsDir = getResourcePath('prompts');
    const files = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json'));
    const shots = files.map(f => {
      const content = fs.readFileSync(path.join(shotsDir, f), 'utf-8');
      const shot = JSON.parse(content);
      const keyframes = listKeyframes(shot.shot_id);
      
      // Load history and takes
      let takes: any[] = [];
      let activeTake: any = null;
      let videoUrl = findUploadedVideo(shot.shot_id); // legacy fallback

      const historyPath = path.join(getResourcePath('assets'), 'renders', shot.shot_id, 'history.json');
      if (fs.existsSync(historyPath)) {
        try {
          const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
          takes = history.takes || [];
          if (history.active_take_id) {
            activeTake = takes.find((t: any) => t.take_id === history.active_take_id) || null;
            if (activeTake && activeTake.video_path) {
              videoUrl = `/api/assets/reference/${activeTake.video_path}`;
            }
          }
        } catch {
          // ignore
        }
      }

      // Load final compiled prompt if it exists
      let videoPrompt = null;
      const promptPath = path.join(promptsDir, `${shot.shot_id}.final.json`);
      if (fs.existsSync(promptPath)) {
        try {
          videoPrompt = JSON.parse(fs.readFileSync(promptPath, 'utf-8'));
        } catch {
          // ignore
        }
      }

      return {
        ...shot,
        _filename: f,
        _keyframes: keyframes,
        _selected_keyframe: keyframes[0] || null,
        _video_url: videoUrl,
        _video_prompt: videoPrompt,
        _takes: takes,
        _active_take: activeTake
      };
    });

    // Sort by shot_id
    shots.sort((a, b) => a.shot_id.localeCompare(b.shot_id));
    return NextResponse.json(shots);
  } catch (e) {
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const shot = await request.json();
    if (!shot.shot_id || !/^[A-Za-z0-9_-]+$/.test(shot.shot_id)) {
      return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
    }
    const filename = path.basename(shot._filename || `${shot.shot_id}.json`);
    delete shot._filename;
    fs.writeFileSync(
      path.join(getResourcePath('shots'), filename),
      JSON.stringify(shot, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SHOTS_DIR = path.resolve(process.cwd(), '../shots');
const KEYFRAME_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

function listKeyframes(shotId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(shotId)) return [];

  const keyframeDir = path.resolve(process.cwd(), '../assets/renders', shotId, 'keyframes');
  if (!fs.existsSync(keyframeDir)) return [];

  return fs.readdirSync(keyframeDir)
    .filter(file => KEYFRAME_EXTS.has(path.extname(file).toLowerCase()))
    .sort()
    .map(file => `/api/assets/keyframes/${encodeURIComponent(shotId)}/${encodeURIComponent(file)}`);
}

export async function GET() {
  try {
    if (!fs.existsSync(SHOTS_DIR)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(SHOTS_DIR).filter(f => f.endsWith('.json'));
    const shots = files.map(f => {
      const content = fs.readFileSync(path.join(SHOTS_DIR, f), 'utf-8');
      const shot = JSON.parse(content);
      const keyframes = listKeyframes(shot.shot_id);
      return {
        ...shot,
        _filename: f,
        _keyframes: keyframes,
        _selected_keyframe: keyframes[0] || null
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
    const filename = shot._filename || `${shot.shot_id}.json`;
    delete shot._filename;
    fs.writeFileSync(
      path.join(SHOTS_DIR, filename),
      JSON.stringify(shot, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

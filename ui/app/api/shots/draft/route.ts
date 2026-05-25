import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getResourcePath } from '@/lib/projects';

export async function GET() {
  try {
    const draftsDir = getResourcePath('shots_draft');
    if (!fs.existsSync(draftsDir)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(draftsDir).filter(f => f.endsWith('.json'));
    const shots = files.map(f => {
      const content = fs.readFileSync(path.join(draftsDir, f), 'utf-8');
      return { ...JSON.parse(content), _filename: f };
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
    const draftsDir = getResourcePath('shots_draft');
    if (!fs.existsSync(draftsDir)) {
      fs.mkdirSync(draftsDir, { recursive: true });
    }
    const shot = await request.json();
    if (!shot.shot_id || !/^[A-Za-z0-9_-]+$/.test(shot.shot_id)) {
      return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
    }
    const filename = path.basename(shot._filename || `${shot.shot_id}.json`);
    delete shot._filename;
    fs.writeFileSync(
      path.join(draftsDir, filename),
      JSON.stringify(shot, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

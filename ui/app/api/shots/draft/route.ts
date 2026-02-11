import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DRAFTS_DIR = path.resolve(process.cwd(), '../shots_draft');

export async function GET() {
  try {
    if (!fs.existsSync(DRAFTS_DIR)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.json'));
    const shots = files.map(f => {
      const content = fs.readFileSync(path.join(DRAFTS_DIR, f), 'utf-8');
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
    if (!fs.existsSync(DRAFTS_DIR)) {
      fs.mkdirSync(DRAFTS_DIR, { recursive: true });
    }
    const shot = await request.json();
    const filename = shot._filename || `${shot.shot_id}.json`;
    delete shot._filename;
    fs.writeFileSync(
      path.join(DRAFTS_DIR, filename),
      JSON.stringify(shot, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

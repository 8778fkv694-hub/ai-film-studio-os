import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SCENES_DIR = path.resolve(process.cwd(), '../scenes');

export async function GET() {
  try {
    if (!fs.existsSync(SCENES_DIR)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(SCENES_DIR).filter(f => f.endsWith('.json'));
    const scenes = files.map(f => {
      const content = fs.readFileSync(path.join(SCENES_DIR, f), 'utf-8');
      return { ...JSON.parse(content), _filename: f };
    });
    return NextResponse.json(scenes);
  } catch (e) {
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const scene = await request.json();
    const filename = scene._filename || `${scene.id}.json`;
    delete scene._filename;
    fs.writeFileSync(
      path.join(SCENES_DIR, filename),
      JSON.stringify(scene, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

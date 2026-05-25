import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getResourcePath } from '@/lib/projects';

export async function GET() {
  try {
    const scenesDir = getResourcePath('scenes');
    if (!fs.existsSync(scenesDir)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(scenesDir).filter(f => f.endsWith('.json'));
    const scenes = files.map(f => {
      const content = fs.readFileSync(path.join(scenesDir, f), 'utf-8');
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
    if (!scene.id || !/^[A-Za-z0-9_-]+$/.test(scene.id)) {
      return NextResponse.json({ error: '无效场景 ID' }, { status: 400 });
    }
    const filename = path.basename(scene._filename || `${scene.id}.json`);
    delete scene._filename;
    fs.writeFileSync(
      path.join(getResourcePath('scenes'), filename),
      JSON.stringify(scene, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

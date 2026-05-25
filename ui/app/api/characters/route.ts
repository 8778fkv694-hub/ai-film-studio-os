import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getResourcePath } from '@/lib/projects';

export async function GET() {
  try {
    const charsDir = getResourcePath('characters');
    if (!fs.existsSync(charsDir)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(charsDir).filter(f => f.endsWith('.json'));
    const characters = files.map(f => {
      const content = fs.readFileSync(path.join(charsDir, f), 'utf-8');
      return { ...JSON.parse(content), _filename: f };
    });
    return NextResponse.json(characters);
  } catch (e) {
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const character = await request.json();
    if (!character.id || !/^[A-Za-z0-9_-]+$/.test(character.id)) {
      return NextResponse.json({ error: '无效角色 ID' }, { status: 400 });
    }
    const filename = path.basename(character._filename || `${character.id}.json`);
    delete character._filename;
    fs.writeFileSync(
      path.join(getResourcePath('characters'), filename),
      JSON.stringify(character, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

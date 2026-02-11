import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CHARS_DIR = path.resolve(process.cwd(), '../characters');

export async function GET() {
  try {
    if (!fs.existsSync(CHARS_DIR)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(CHARS_DIR).filter(f => f.endsWith('.json'));
    const characters = files.map(f => {
      const content = fs.readFileSync(path.join(CHARS_DIR, f), 'utf-8');
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
    const filename = character._filename || `${character.id}.json`;
    delete character._filename;
    fs.writeFileSync(
      path.join(CHARS_DIR, filename),
      JSON.stringify(character, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

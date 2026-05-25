import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getScriptPath } from '@/lib/projects';

export async function GET() {
  try {
    const scriptPath = getScriptPath();
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ content: '' });
    }
    const content = fs.readFileSync(scriptPath, 'utf-8');
    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    const scriptPath = getScriptPath();
    const dir = path.dirname(scriptPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(scriptPath, content, 'utf-8');
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

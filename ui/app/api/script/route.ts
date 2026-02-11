import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SCRIPT_PATH = path.resolve(process.cwd(), '../docs/script.txt');

export async function GET() {
  try {
    if (!fs.existsSync(SCRIPT_PATH)) {
      return NextResponse.json({ content: '' });
    }
    const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { content } = await request.json();
    const dir = path.dirname(SCRIPT_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCRIPT_PATH, content, 'utf-8');
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

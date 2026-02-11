import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROPS_DIR = path.resolve(process.cwd(), '../props');

export async function GET() {
  try {
    if (!fs.existsSync(PROPS_DIR)) {
      return NextResponse.json([]);
    }
    const files = fs.readdirSync(PROPS_DIR).filter(f => f.endsWith('.json'));
    const props = files.map(f => {
      const content = fs.readFileSync(path.join(PROPS_DIR, f), 'utf-8');
      return { ...JSON.parse(content), _filename: f };
    });
    return NextResponse.json(props);
  } catch (e) {
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const prop = await request.json();
    const filename = prop._filename || `${prop.id}.json`;
    delete prop._filename;
    fs.writeFileSync(
      path.join(PROPS_DIR, filename),
      JSON.stringify(prop, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

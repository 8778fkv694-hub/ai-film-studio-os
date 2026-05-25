import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shotId = searchParams.get('shot_id');

    if (!shotId || !/^[A-Za-z0-9_-]+$/.test(shotId)) {
      return NextResponse.json({ error: '无效或缺少 shot_id' }, { status: 400 });
    }

    const historyFile = path.join(getResourcePath('assets'), 'renders', shotId, 'history.json');
    if (!fs.existsSync(historyFile)) {
      return NextResponse.json({
        shot_id: shotId,
        active_take_id: null,
        takes: []
      });
    }

    const content = fs.readFileSync(historyFile, 'utf-8');
    const history = JSON.parse(content);
    return NextResponse.json(history);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '获取 Takes 失败' }, { status: 500 });
  }
}

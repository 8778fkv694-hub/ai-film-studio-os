import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

function currentPromptHash(shotId: string): string {
  const promptPath = path.join(getResourcePath('prompts'), `${shotId}.final.json`);
  if (!fs.existsSync(promptPath)) return '';
  return crypto
    .createHash('md5')
    .update(fs.readFileSync(promptPath, 'utf-8'))
    .digest('hex')
    .substring(0, 8);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shot: string }> }
) {
  try {
    const { shot: shotId } = await params;
    const body = await request.json();
    const { take_id: takeId, action, rating, tags, notes } = body;

    if (!shotId || !/^[A-Za-z0-9_-]+$/.test(shotId)) {
      return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
    }

    if (!takeId) {
      return NextResponse.json({ error: '缺少 take_id' }, { status: 400 });
    }

    const historyFile = path.join(getResourcePath('assets'), 'renders', shotId, 'history.json');
    if (!fs.existsSync(historyFile)) {
      return NextResponse.json({ error: '未找到该镜头的渲染历史记录' }, { status: 404 });
    }

    const history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    const take = history.takes.find((t: any) => t.take_id === takeId);
    if (!take) {
      return NextResponse.json({ error: `未找到 Take: ${takeId}` }, { status: 404 });
    }

    if (action === 'set_active') {
      history.active_take_id = takeId;
      
      // Copy keyframe to global keyframes directory for player compatibility
      const takeDir = path.join(getResourcePath('assets'), 'renders', shotId, 'takes', takeId);
      const takeKeyframe = path.join(takeDir, 'keyframe.jpg');
      if (fs.existsSync(takeKeyframe)) {
        const globalKeyframesDir = path.join(getResourcePath('assets'), 'renders', shotId, 'keyframes');
        fs.mkdirSync(globalKeyframesDir, { recursive: true });
        fs.copyFileSync(takeKeyframe, path.join(globalKeyframesDir, 'frame_last.jpg'));
      }
      console.log(`[Takes API] Shot ${shotId} active take switched to ${takeId}`);

    } else if (action === 'approve') {
      take.review = take.review || {};
      take.review.approved = true;
      take.status = 'approved';
      console.log(`[Takes API] Shot ${shotId} ${takeId} approved`);

    } else if (action === 'reject') {
      take.review = take.review || {};
      take.review.approved = false;
      take.status = 'rejected';
      // If we reject the active take, reset active_take_id or keep it?
      // Usually keep it but let user decide. We will keep it.
      console.log(`[Takes API] Shot ${shotId} ${takeId} rejected`);

    } else if (action === 'update_review') {
      take.review = take.review || {};
      if (rating !== undefined) take.review.rating = rating;
      if (tags !== undefined) take.review.tags = tags;
      if (notes !== undefined) take.review.notes = notes;
      console.log(`[Takes API] Shot ${shotId} ${takeId} review updated`);
    } else if (action === 'refresh_prompt_hash') {
      const hash = currentPromptHash(shotId);
      if (!hash) {
        return NextResponse.json({ error: '当前镜头缺少 final.json，请先同步 Prompt' }, { status: 400 });
      }
      take.prompt_hash = hash;
      take.prompt_hash_accepted_at = new Date().toISOString();
      take.prompt_hash_note = 'accepted_current_take_as_matching_current_prompt';
      console.log(`[Takes API] Shot ${shotId} ${takeId} prompt hash refreshed to ${hash}`);
    } else {
      return NextResponse.json({ error: `未知 action: ${action}` }, { status: 400 });
    }

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    return NextResponse.json({ success: true, history });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 500 });
  }
}

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath, getCurrentProjectPath } from '@/lib/projects';
import { writeJsonAtomic } from '@/lib/fs-atomic';
import { syncActiveTakeKeyframes, currentPromptHash } from '@shared/conventions.js';

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

    const projectPath = getCurrentProjectPath();
    if (!projectPath) {
      return NextResponse.json({ error: '没有活动项目' }, { status: 400 });
    }

    const historyFile = path.join(projectPath, 'assets', 'renders', shotId, 'history.json');
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
      // 回退到该版本：把它的首帧/末帧刷进全局 keyframes，使预览 poster 与所选视频一致
      syncActiveTakeKeyframes(projectPath, shotId, takeId);
      console.log(`[Takes API] Shot ${shotId} active take switched to ${takeId}`);

    } else if (action === 'delete') {
      // 删除该视频版本（take）及其文件
      history.takes = (history.takes || []).filter((t: any) => t.take_id !== takeId);
      const takeDir = path.join(projectPath, 'assets', 'renders', shotId, 'takes', takeId);
      try { fs.rmSync(takeDir, { recursive: true, force: true }); } catch {}

      // 若删的是当前活动版本，自动切到最新剩余版本；都删完则清空并移除派生关键帧
      if (history.active_take_id === takeId) {
        const takeNum = (t: any) => { const m = String(t.take_id).match(/take_(\d+)/); return m ? parseInt(m[1], 10) : 0; };
        const next = [...history.takes].sort((a, b) => takeNum(b) - takeNum(a))[0] || null;
        history.active_take_id = next ? next.take_id : null;
        const globalKeyframesDir = path.join(projectPath, 'assets', 'renders', shotId, 'keyframes');
        if (next) {
          syncActiveTakeKeyframes(projectPath, shotId, next.take_id);
        } else {
          for (const fn of ['frame_00.jpg', 'frame_last.jpg']) {
            try { fs.rmSync(path.join(globalKeyframesDir, fn), { force: true }); } catch {}
          }
        }
      }
      console.log(`[Takes API] Shot ${shotId} take ${takeId} deleted`);

    } else if (action === 'approve') {
      take.review = take.review || {};
      take.review.approved = true;
      take.status = 'approved';
      console.log(`[Takes API] Shot ${shotId} ${takeId} approved`);

    } else if (action === 'reject') {
      take.review = take.review || {};
      take.review.approved = false;
      take.status = 'rejected';
      console.log(`[Takes API] Shot ${shotId} ${takeId} rejected`);

    } else if (action === 'update_review') {
      take.review = take.review || {};
      if (rating !== undefined) take.review.rating = rating;
      if (tags !== undefined) take.review.tags = tags;
      if (notes !== undefined) take.review.notes = notes;
      console.log(`[Takes API] Shot ${shotId} ${takeId} review updated`);
    } else if (action === 'refresh_prompt_hash') {
      const hash = currentPromptHash(projectPath, shotId);
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

    writeJsonAtomic(historyFile, history);
    return NextResponse.json({ success: true, history });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '操作失败' }, { status: 500 });
  }
}

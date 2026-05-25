import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shot: string }> }
) {
  try {
    const { shot: shotId } = await params;

    if (!shotId || !/^[A-Za-z0-9_-]+$/.test(shotId)) {
      return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
    }

    // 1. Load Shot JSON
    const shotPath = path.join(getResourcePath('shots'), `${shotId}.json`);
    if (!fs.existsSync(shotPath)) {
      return NextResponse.json({ error: `未找到镜头: ${shotId}` }, { status: 404 });
    }
    const shot = JSON.parse(fs.readFileSync(shotPath, 'utf-8'));

    // 2. Load compiled video prompt
    let videoPrompt = null;
    const videoPromptPath = path.join(getResourcePath('prompts'), `${shotId}.final.json`);
    if (fs.existsSync(videoPromptPath)) {
      try {
        videoPrompt = JSON.parse(fs.readFileSync(videoPromptPath, 'utf-8'));
      } catch {}
    }

    // 3. Load compiled image prompt
    let imagePrompt = null;
    const imagePromptPath = path.join(getResourcePath('prompts/image'), `${shotId}.image.json`);
    if (fs.existsSync(imagePromptPath)) {
      try {
        imagePrompt = JSON.parse(fs.readFileSync(imagePromptPath, 'utf-8'));
      } catch {}
    }

    // 4. Load history
    let history = null;
    const historyFile = path.join(getResourcePath('assets'), 'renders', shotId, 'history.json');
    if (fs.existsSync(historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      } catch {}
    }

    return NextResponse.json({
      shot,
      video_prompt: videoPrompt,
      image_prompt: imagePrompt,
      history
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '获取分镜详情失败' }, { status: 500 });
  }
}

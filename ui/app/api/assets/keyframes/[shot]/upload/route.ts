import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';
import { KEYFRAME_EXTS, safeShotId, saveKeyframeBuffer } from '@/lib/keyframes';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shot: string }> }
) {
  const { shot } = await params;
  if (!safeShotId(shot)) {
    return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '未找到上传图片' }, { status: 400 });
  }

  const originalName = file.name || 'keyframe.jpg';
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  if (!KEYFRAME_EXTS.has(ext)) {
    return NextResponse.json({ error: '仅支持 jpg、jpeg、png、webp' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mode = formData.get('mode') === 'replace' ? 'replace' : 'append';
  const saved = saveKeyframeBuffer({
    assetsDir: getResourcePath('assets'),
    shotId: shot,
    buffer: bytes,
    originalName,
    mode
  });

  return NextResponse.json({
    success: true,
    path: saved.relativePath,
    url: saved.url,
    mode
  });
}

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

function safeShotId(shot: string) {
  return /^[A-Za-z0-9_-]+$/.test(shot);
}

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
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: '仅支持 jpg、png、webp' }, { status: 400 });
  }

  const keyframeDir = path.join(getResourcePath('assets'), 'renders', shot, 'keyframes');
  fs.mkdirSync(keyframeDir, { recursive: true });

  const existing = fs.readdirSync(keyframeDir).filter(name => ALLOWED_EXTS.has(path.extname(name).toLowerCase()));
  const index = String(existing.length + 1).padStart(2, '0');
  const filename = `frame_${index}${ext}`;
  const filePath = path.join(keyframeDir, filename);

  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, bytes);

  return NextResponse.json({
    success: true,
    path: `assets/renders/${shot}/keyframes/${filename}`,
    url: `/api/assets/keyframes/${encodeURIComponent(shot)}/${encodeURIComponent(filename)}`
  });
}

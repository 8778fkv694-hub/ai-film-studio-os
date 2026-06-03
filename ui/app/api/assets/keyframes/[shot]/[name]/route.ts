import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shot: string; name: string }> }
) {
  const { shot, name } = await params;

  if (!/^[A-Za-z0-9_-]+$/.test(shot) || !name || name.includes('..')) {
    return new NextResponse('Invalid keyframe path', { status: 400 });
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new NextResponse('Unsupported image type', { status: 400 });
  }

  const keyframeDir = path.join(getResourcePath('assets'), 'renders', shot, 'keyframes');
  const filePath = path.resolve(keyframeDir, name);

  if (!filePath.startsWith(keyframeDir) || !fs.existsSync(filePath)) {
    return new NextResponse('Keyframe not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'no-store'
    }
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ shot: string; name: string }> }
) {
  const { shot, name } = await params;

  if (!/^[A-Za-z0-9_-]+$/.test(shot) || !name || name.includes('..')) {
    return NextResponse.json({ error: '无效的关键帧路径' }, { status: 400 });
  }

  const ext = path.extname(name).toLowerCase();
  if (!CONTENT_TYPES[ext]) {
    return NextResponse.json({ error: '不支持的图片类型' }, { status: 400 });
  }

  const keyframeDir = path.join(getResourcePath('assets'), 'renders', shot, 'keyframes');
  const filePath = path.resolve(keyframeDir, name);

  if (!filePath.startsWith(keyframeDir)) {
    return NextResponse.json({ error: '非法路径' }, { status: 400 });
  }
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '关键帧不存在' }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
  } catch {
    return NextResponse.json({ error: '删除关键帧失败' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
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

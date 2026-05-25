import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo'
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shot: string; name: string }> }
) {
  const { shot, name } = await params;

  if (!/^[A-Za-z0-9_-]+$/.test(shot) || !name || name.includes('..')) {
    return new NextResponse('Invalid video path', { status: 400 });
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new NextResponse('Unsupported video type', { status: 400 });
  }

  const videoDir = path.join(getResourcePath('assets'), 'renders', shot, 'video');
  const filePath = path.resolve(videoDir, name);

  if (!filePath.startsWith(videoDir) || !fs.existsSync(filePath)) {
    return new NextResponse('Video file not found', { status: 404 });
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

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo'
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse('Invalid asset path', { status: 400 });
  }

  // Strip leading 'assets' segment if present
  let cleanSegments = [...pathSegments];
  if (cleanSegments[0] === 'assets') {
    cleanSegments.shift();
  }

  if (cleanSegments.length < 2) {
    return new NextResponse('Invalid asset path', { status: 400 });
  }

  // Prevent path traversal
  const relativePath = cleanSegments.join('/');
  if (relativePath.includes('..')) {
    return new NextResponse('Invalid asset path', { status: 400 });
  }

  // We only allow serving from 'characters', 'props', 'scenes', 'renders'
  const allowedRoots = new Set(['characters', 'props', 'scenes', 'renders']);
  if (!allowedRoots.has(cleanSegments[0])) {
    return new NextResponse('Access denied', { status: 403 });
  }

  const ext = path.extname(relativePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new NextResponse('Unsupported asset type', { status: 400 });
  }

  const assetsDir = getResourcePath('assets');
  const filePath = path.resolve(assetsDir, relativePath);

  if (!filePath.startsWith(assetsDir) || !fs.existsSync(filePath)) {
    return new NextResponse('Asset not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

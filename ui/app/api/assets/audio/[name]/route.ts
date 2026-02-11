import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  // Security: Prevent traversal
  if (!name || name.includes('..') || !name.endsWith('.mp3')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  // Path to root/assets/audio
  const filePath = path.resolve(process.cwd(), '../assets/audio', name);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Audio not found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': fileBuffer.length.toString(),
    },
  });
}

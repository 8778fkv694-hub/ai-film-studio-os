import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const PROJECT_PATH = path.resolve(process.cwd(), '../project.json');

export async function GET() {
  if (!fs.existsSync(PROJECT_PATH)) {
    return new NextResponse('Project file not found', { status: 404 });
  }
  const data = fs.readFileSync(PROJECT_PATH, 'utf-8');
  return NextResponse.json(JSON.parse(data));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Basic validation could go here
    fs.writeFileSync(PROJECT_PATH, JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (e) {
    return new NextResponse('Failed to save project', { status: 500 });
  }
}

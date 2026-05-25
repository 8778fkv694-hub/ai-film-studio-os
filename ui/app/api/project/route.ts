import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getCurrentProjectPath } from '@/lib/projects';

export async function GET() {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return new NextResponse('No active project found', { status: 404 });
  }
  
  const projectJsonPath = path.join(projectPath, 'project.json');
  if (!fs.existsSync(projectJsonPath)) {
    return new NextResponse('Project file not found', { status: 404 });
  }
  
  const data = fs.readFileSync(projectJsonPath, 'utf-8');
  return NextResponse.json(JSON.parse(data));
}

export async function POST(request: Request) {
  try {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) {
      return new NextResponse('No active project found', { status: 404 });
    }
    
    const body = await request.json();
    const projectJsonPath = path.join(projectPath, 'project.json');
    
    // Basic validation could go here
    fs.writeFileSync(projectJsonPath, JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (e) {
    return new NextResponse('Failed to save project', { status: 500 });
  }
}

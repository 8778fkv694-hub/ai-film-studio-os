import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const PROJECTS_FILE = path.resolve(process.cwd(), '../projects.json');

interface ProjectsData {
  projects: any[];
  activeProjectId: string | null;
}

// 切换活动项目
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return new NextResponse('Project ID is required', { status: 400 });
    }
    if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
      return new NextResponse('Invalid project ID', { status: 400 });
    }

    // 读取项目列表
    if (!fs.existsSync(PROJECTS_FILE)) {
      return new NextResponse('Projects file not found', { status: 404 });
    }

    const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
    const projectsData: ProjectsData = JSON.parse(data);

    // 检查项目是否存在
    if (!projectsData.projects.some(p => p.id === projectId)) {
      return new NextResponse('Project not found', { status: 404 });
    }

    // 更新活动项目
    projectsData.activeProjectId = projectId;
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projectsData, null, 2));

    return NextResponse.json({ 
      success: true, 
      activeProjectId: projectId 
    });
  } catch (e) {
    console.error('Error activating project:', e);
    return new NextResponse('Failed to activate project', { status: 500 });
  }
}

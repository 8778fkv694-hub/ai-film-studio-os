import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { writeJsonAtomic } from '@/lib/fs-atomic';

const PROJECTS_DIR = path.resolve(process.cwd(), '../projects');
const PROJECTS_FILE = path.resolve(process.cwd(), '../projects.json');

interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectsData {
  projects: ProjectInfo[];
  activeProjectId: string | null;
}

// 获取项目列表
export async function GET() {
  try {
    // 确保项目目录存在
    if (!fs.existsSync(PROJECTS_DIR)) {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }

    // 读取项目列表文件
    let projectsData: ProjectsData = { projects: [], activeProjectId: null };
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
      projectsData = JSON.parse(data);
    }

    // 扫描项目目录，获取每个项目的详细信息
    const projectsWithDetails: ProjectInfo[] = [];
    
    for (const projectInfo of projectsData.projects) {
      const projectDir = path.join(PROJECTS_DIR, projectInfo.id);
      const projectJsonPath = path.join(projectDir, 'project.json');
      
      if (fs.existsSync(projectJsonPath)) {
        try {
          const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
          projectsWithDetails.push({
            id: projectInfo.id,
            name: projectData.name || projectInfo.name,
            description: projectData.description || projectInfo.description,
            createdAt: projectInfo.createdAt,
            updatedAt: projectInfo.updatedAt
          });
        } catch (e) {
          // 如果读取失败，使用基本信息
          projectsWithDetails.push(projectInfo);
        }
      } else {
        // 项目目录不存在或没有project.json，跳过
        continue;
      }
    }

    // 更新项目列表（移除无效项目）
    if (projectsWithDetails.length !== projectsData.projects.length) {
      projectsData.projects = projectsWithDetails;
      writeJsonAtomic(PROJECTS_FILE, projectsData);
    }

    return NextResponse.json({
      projects: projectsWithDetails,
      activeProjectId: projectsData.activeProjectId
    });
  } catch (e) {
    console.error('Error reading projects:', e);
    return new NextResponse('Failed to read projects', { status: 500 });
  }
}

// 创建新项目
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description } = body;

    // 验证必填字段
    if (!id || !name) {
      return new NextResponse('Project ID and name are required', { status: 400 });
    }

    // 验证ID格式（只允许字母、数字、下划线、连字符）
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return new NextResponse('Project ID can only contain letters, numbers, underscores, and hyphens', { status: 400 });
    }

    // 确保项目目录存在
    if (!fs.existsSync(PROJECTS_DIR)) {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }

    // 读取现有项目列表
    let projectsData: ProjectsData = { projects: [], activeProjectId: null };
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
      projectsData = JSON.parse(data);
    }

    // 检查项目ID是否已存在
    if (projectsData.projects.some(p => p.id === id)) {
      return new NextResponse('Project ID already exists', { status: 409 });
    }

    // 创建项目目录
    const projectDir = path.join(PROJECTS_DIR, id);
    if (fs.existsSync(projectDir)) {
      return new NextResponse('Project directory already exists', { status: 409 });
    }

    fs.mkdirSync(projectDir, { recursive: true });

    // 创建项目子目录
    const subDirs = ['docs', 'shots', 'shots_draft', 'scenes', 'characters', 'props', 'assets/audio', 'prompts', 'renders', 'reports'];
    subDirs.forEach(dir => {
      fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
    });

    // 创建项目配置文件
    const projectConfig = {
      id: id,
      name: name,
      description: description || '',
      default_style_ref: 'styles/cinematic_v1.json',
      defaults: {
        language: 'zh',
        fps: 24
      },
      inventory: {
        scenes: [],
        characters: [],
        props: []
      },
      timeline: []
    };

    fs.writeFileSync(
      path.join(projectDir, 'project.json'),
      JSON.stringify(projectConfig, null, 2)
    );

    // 更新项目列表
    const now = new Date().toISOString();
    const newProjectInfo: ProjectInfo = {
      id: id,
      name: name,
      description: description || '',
      createdAt: now,
      updatedAt: now
    };

    projectsData.projects.push(newProjectInfo);
    
    // 如果是第一个项目，设为活动项目
    if (projectsData.projects.length === 1) {
      projectsData.activeProjectId = id;
    }

    writeJsonAtomic(PROJECTS_FILE, projectsData);

    return NextResponse.json({ 
      success: true, 
      project: newProjectInfo 
    });
  } catch (e) {
    console.error('Error creating project:', e);
    return new NextResponse('Failed to create project', { status: 500 });
  }
}
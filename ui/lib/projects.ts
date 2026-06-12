import fs from 'fs';
import path from 'path';
import { writeJsonAtomic } from './fs-atomic';

const PROJECTS_DIR = path.resolve(process.cwd(), '../projects');
const PROJECTS_FILE = path.resolve(process.cwd(), '../projects.json');

export interface ProjectsData {
  projects: ProjectInfo[];
  activeProjectId: string | null;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// 获取项目列表数据
export function getProjectsData(): ProjectsData {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return { projects: [], activeProjectId: null };
  }
  const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
  return JSON.parse(data);
}

// 保存项目列表数据
export function saveProjectsData(data: ProjectsData): void {
  writeJsonAtomic(PROJECTS_FILE, data);
}

// 获取活动项目ID
export function getActiveProjectId(): string | null {
  const data = getProjectsData();
  return data.activeProjectId;
}

// 获取活动项目路径
export function getActiveProjectPath(): string | null {
  const activeProjectId = getActiveProjectId();
  if (!activeProjectId) {
    return null;
  }
  return path.join(PROJECTS_DIR, activeProjectId);
}

// 获取指定项目的路径
export function getProjectPath(projectId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
    throw new Error('Invalid project ID');
  }
  return path.join(PROJECTS_DIR, projectId);
}

// 检查项目是否存在
export function projectExists(projectId: string): boolean {
  const projectDir = getProjectPath(projectId);
  return fs.existsSync(projectDir) && fs.existsSync(path.join(projectDir, 'project.json'));
}

// 获取项目配置
export function getProjectConfig(projectId: string): any | null {
  const projectDir = getProjectPath(projectId);
  const configPath = path.join(projectDir, 'project.json');
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

// 保存项目配置
export function saveProjectConfig(projectId: string, config: any): void {
  const projectDir = getProjectPath(projectId);
  const configPath = path.join(projectDir, 'project.json');

  writeJsonAtomic(configPath, config);
}

// 获取项目资源路径
export function getProjectResourcePath(projectId: string, resourceType: string): string {
  const projectDir = getProjectPath(projectId);
  return path.join(projectDir, resourceType);
}

// 兼容旧版本：获取当前项目路径（如果只有一个项目或设置了活动项目）
export function getCurrentProjectPath(): string | null {
  const activeProjectId = getActiveProjectId();
  if (activeProjectId) {
    return getProjectPath(activeProjectId);
  }
  
  // 如果没有活动项目，但有项目列表，使用第一个
  const projectsData = getProjectsData();
  if (projectsData.projects.length > 0) {
    return getProjectPath(projectsData.projects[0].id);
  }
  
  return null;
}

// 必须有活动项目；根目录单项目兼容模式已移除，解析不到就明确报错而不是静默读写错误位置
function requireProjectPath(): string {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    throw new Error('没有活动项目：请先在项目管理中创建或激活一个项目');
  }
  return projectPath;
}

// 统一资源路径：始终位于活动项目目录内
export function getResourcePath(resourceType: string): string {
  const dir = path.join(requireProjectPath(), resourceType);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// 获取脚本文件路径
export function getScriptPath(): string {
  return path.join(requireProjectPath(), 'docs/script.txt');
}

// 获取项目 project.json 路径
export function getProjectJsonPath(): string {
  return path.join(requireProjectPath(), 'project.json');
}

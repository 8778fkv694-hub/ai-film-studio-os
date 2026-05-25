import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// 项目根目录（tools/scripts/shared/ 的上三级）
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function resolveProjectDir(projectId) {
  if (!projectId || !/^[A-Za-z0-9_-]+$/.test(projectId)) return null;
  const projectDir = path.join(ROOT, 'projects', projectId);
  return fs.existsSync(path.join(projectDir, 'project.json')) ? projectDir : null;
}

function resolveActiveProjectDir() {
  const projectsData = readJsonIfExists(path.join(ROOT, 'projects.json'));
  const activeDir = resolveProjectDir(projectsData?.activeProjectId);
  if (activeDir) return activeDir;

  for (const project of projectsData?.projects || []) {
    const projectDir = resolveProjectDir(project.id);
    if (projectDir) return projectDir;
  }

  return fs.existsSync(path.join(ROOT, 'project.json')) ? ROOT : ROOT;
}

// 解析 --project-dir 参数，返回实际工作目录
function parseArgs() {
  const args = process.argv.slice(2);
  let projectDir = null;
  let projectId = null;
  const remainingArgs = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-dir' && i + 1 < args.length) {
      projectDir = args[i + 1];
      i++;
    } else if (args[i] === '--project-id' && i + 1 < args.length) {
      projectId = args[i + 1];
      i++;
    } else {
      remainingArgs.push(args[i]);
    }
  }

  const resolvedProjectDir = projectDir
    ? path.resolve(process.cwd(), projectDir)
    : (resolveProjectDir(projectId) || resolveActiveProjectDir());

  return {
    workDir: resolvedProjectDir,
    projectRoot: ROOT,
    projectId,
    remainingArgs
  };
}

export { parseArgs, ROOT, resolveActiveProjectDir, resolveProjectDir };

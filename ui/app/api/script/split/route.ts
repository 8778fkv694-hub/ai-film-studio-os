import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getCurrentProjectPath, getScriptPath } from '@/lib/projects';

const execAsync = promisify(exec);

export async function POST() {
  try {
    const projectPath = getCurrentProjectPath();
    const projectRoot = path.resolve(process.cwd(), '..');
    const scriptPath = getScriptPath();
    const toolPath = path.join(projectRoot, 'tools/scripts/script-split.js');

    // 如果有多项目，传递项目目录给脚本
    const projectDirArg = projectPath ? ` --project-dir "${projectPath}"` : '';

    const { stdout, stderr } = await execAsync(`node "${toolPath}" "${scriptPath}"${projectDirArg}`, {
      cwd: projectRoot
    });

    // Count generated files
    const match = stdout.match(/(\d+)/);
    const count = match ? parseInt(match[1]) : 0;

    return NextResponse.json({
      success: true,
      count,
      output: stdout
    });
  } catch (e: any) {
    return NextResponse.json({
      error: e.message || '拆分失败',
      output: e.stderr || ''
    }, { status: 500 });
  }
}

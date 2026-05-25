import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getCurrentProjectPath, getScriptPath } from '@/lib/projects';

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    const projectPath = getCurrentProjectPath();
    const projectRoot = path.resolve(process.cwd(), '..');
    const scriptPath = getScriptPath();
    const toolPath = path.join(projectRoot, 'tools/scripts/script-split.js');

    const args = [toolPath, scriptPath];
    if (projectPath) args.push('--project-dir', projectPath);

    const { stdout, stderr } = await execFileAsync('node', args, {
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

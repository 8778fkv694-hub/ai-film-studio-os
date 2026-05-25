import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getCurrentProjectPath } from '@/lib/projects';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const projectPath = getCurrentProjectPath();
    const toolPath = path.join(projectRoot, 'tools/scripts/gen-tts.js');
    const projectDirArg = projectPath ? ` --project-dir "${projectPath}"` : '';

    // Check if single shot_id is provided
    let shotId: string | null = null;
    try {
      const body = await request.json();
      shotId = body.shot_id || null;
    } catch {
      // No body or invalid JSON, generate all
    }

    const args = shotId ? `--shot ${shotId}` : '';
    const { stdout, stderr } = await execAsync(`node "${toolPath}" ${args}${projectDirArg}`, {
      cwd: projectRoot
    });

    // Count generated files
    const match = stdout.match(/Generated (\d+)/i) || stdout.match(/(\d+)/);
    const count = match ? parseInt(match[1]) : (shotId ? 1 : 0);

    return NextResponse.json({
      success: true,
      count,
      output: stdout
    });
  } catch (e: any) {
    return NextResponse.json({
      error: e.message || '生成失败',
      output: e.stderr || ''
    }, { status: 500 });
  }
}

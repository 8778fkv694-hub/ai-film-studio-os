import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getCurrentProjectPath } from '@/lib/projects';

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const projectPath = getCurrentProjectPath();
    const toolPath = path.join(projectRoot, 'tools/scripts/gen-tts.js');

    // Check if single shot_id is provided
    let shotId: string | null = null;
    try {
      const body = await request.json();
      shotId = body.shot_id || null;
      if (shotId && !/^[A-Za-z0-9_-]+$/.test(shotId)) {
        return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
      }
    } catch {
      // No body or invalid JSON, generate all
    }

    const args = [toolPath, '--force'];
    if (shotId) args.push('--shot', shotId);
    if (projectPath) args.push('--project-dir', projectPath);
    const { stdout, stderr } = await execFileAsync('node', args, {
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

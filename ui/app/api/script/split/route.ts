import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const scriptPath = path.join(projectRoot, 'docs/script.txt');
    const toolPath = path.join(projectRoot, 'tools/scripts/script-split.js');

    const { stdout, stderr } = await execAsync(`node "${toolPath}" "${scriptPath}"`, {
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

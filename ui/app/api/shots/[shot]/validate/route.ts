import { execFile } from 'child_process';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';
import path from 'path';

function runScript(scriptName: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const rootDir = path.resolve(process.cwd(), '..');
  const scriptPath = path.join(rootDir, 'tools/scripts', scriptName);
  
  return new Promise((resolve) => {
    execFile('node', [scriptPath, ...args], { cwd: rootDir }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout,
        stderr
      });
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shot: string }> }
) {
  try {
    const { shot: shotId } = await params;
    const projectDir = path.resolve(getResourcePath('shots'), '..');

    const args = ['--project-dir', projectDir];

    // Run validate and lint
    const validateRes = await runScript('validate.js', args);
    const lintRes = await runScript('lint.js', args);

    const success = validateRes.code === 0 && lintRes.code === 0;

    return NextResponse.json({
      success,
      validate: {
        code: validateRes.code,
        stdout: validateRes.stdout,
        stderr: validateRes.stderr
      },
      lint: {
        code: lintRes.code,
        stdout: lintRes.stdout,
        stderr: lintRes.stderr
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '运行校验失败' }, { status: 500 });
  }
}

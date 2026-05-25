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

    // Run build-image-prompts (builds all, very fast)
    const imageRes = await runScript('build-image-prompts.js', ['--project-dir', projectDir]);
    
    // Run build-prompts (supports --shot for this specific shot)
    const videoRes = await runScript('build-prompts.js', ['--shot', shotId, '--project-dir', projectDir]);

    // Run prompt quality scoring
    const scoreRes = await runScript('score-prompts.js', ['--project-dir', projectDir]);

    const success = imageRes.code === 0 && videoRes.code === 0 && scoreRes.code === 0;

    return NextResponse.json({
      success,
      image_prompts: {
        code: imageRes.code,
        stdout: imageRes.stdout,
        stderr: imageRes.stderr
      },
      video_prompts: {
        code: videoRes.code,
        stdout: videoRes.stdout,
        stderr: videoRes.stderr
      },
      score_prompts: {
        code: scoreRes.code,
        stdout: scoreRes.stdout,
        stderr: scoreRes.stderr
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '运行编译提示词失败' }, { status: 500 });
  }
}

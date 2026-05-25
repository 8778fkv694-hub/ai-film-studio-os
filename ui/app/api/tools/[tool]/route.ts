import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getCurrentProjectPath } from '@/lib/projects';

const execFileAsync = promisify(execFile);

const TOOL_MAP: Record<string, string> = {
  'validate': 'validate.js',
  'lint': 'lint.js',
  'build-prompts': 'build-prompts.js',
  'build-image-prompts': 'build-image-prompts.js',
  'gen-tts': 'gen-tts.js',
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tool: string }> }
) {
  const { tool } = await params;
  const scriptName = TOOL_MAP[tool];

  if (!scriptName) {
    return NextResponse.json({ error: '未知工具' }, { status: 404 });
  }

  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const projectPath = getCurrentProjectPath();
    const toolPath = path.join(projectRoot, 'tools/scripts', scriptName);

    const args = [toolPath];
    if (projectPath) args.push('--project-dir', projectPath);

    const { stdout, stderr } = await execFileAsync('node', args, {
      cwd: projectRoot,
      timeout: 60000
    });

    // Parse errors from output
    const errors: string[] = [];
    const lines = stdout.split('\n');
    for (const line of lines) {
      const lower = line.toLowerCase();
      // Detect real errors but ignore "0 errors", "0 error(s)", "no error" summary stats
      const hasRealError = (lower.includes('error') && 
                            !lower.includes('0 error') && 
                            !lower.includes('no error')) ||
                           lower.includes('[error]') ||
                           lower.includes('exception') ||
                           line.includes('❌') ||
                           line.includes('✗');
      if (hasRealError) {
        errors.push(line.trim());
      }
    }

    const success = errors.length === 0;

    return NextResponse.json({
      success,
      output: stdout,
      errors: errors.length > 0 ? errors : undefined,
      stderr: stderr || undefined
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message || '执行失败',
      output: e.stdout || '',
      errors: [e.stderr || e.message]
    }, { status: 500 });
  }
}

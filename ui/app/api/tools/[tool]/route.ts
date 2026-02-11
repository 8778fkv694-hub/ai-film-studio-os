import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

const TOOL_MAP: Record<string, string> = {
  'validate': 'validate.js',
  'lint': 'lint.js',
  'build-prompts': 'build-prompts.js',
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
    const toolPath = path.join(projectRoot, 'tools/scripts', scriptName);

    const { stdout, stderr } = await execAsync(`node "${toolPath}"`, {
      cwd: projectRoot,
      timeout: 60000
    });

    // Parse errors from output
    const errors: string[] = [];
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('error') || line.includes('❌') || line.includes('✗')) {
        errors.push(line.trim());
      }
    }

    const success = !stderr && errors.length === 0;

    return NextResponse.json({
      success,
      output: stdout,
      errors: errors.length > 0 ? errors : undefined
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

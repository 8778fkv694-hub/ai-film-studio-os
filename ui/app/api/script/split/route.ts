import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { getCurrentProjectPath, getScriptPath } from '@/lib/projects';

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    const projectPath = getCurrentProjectPath();
    const projectRoot = path.resolve(process.cwd(), '..');
    const scriptPath = getScriptPath();

    // 前端带来的编辑器内容先落盘：拆分的就是用户当前看到的剧本，
    // 避免“AI 生成/导入但未点保存 → docs/script.txt 不存在 → Input file not found”。
    let content: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.content === 'string') content = body.content;
    } catch {
      // 无 body（旧调用）：回退到使用磁盘上已保存的剧本
    }
    if (typeof content === 'string') {
      if (!content.trim()) {
        return NextResponse.json({ error: '剧本内容为空，请先填写剧本再拆分。' }, { status: 400 });
      }
      fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
      fs.writeFileSync(scriptPath, content, 'utf-8');
    }

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: '剧本尚未保存，请先在编辑器中填写并保存剧本再拆分。' }, { status: 400 });
    }

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

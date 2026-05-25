import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getCurrentProjectPath } from '@/lib/projects';

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    const projectPath = getCurrentProjectPath();
    const projectRoot = path.resolve(process.cwd(), '..');
    const toolPath = path.join(projectRoot, 'tools/scripts/compose-video.js');
    const args = [toolPath];
    if (projectPath) args.push('--project-dir', projectPath);

    // 读取可选的字幕与预设参数
    try {
      const body = await request.json();
      if (body.preset) {
        args.push('--preset', String(body.preset));
      }
      if (body.subtitles) {
        const family = String(body.subFontFamily || 'Microsoft YaHei').replace(/"/g, '').replace(/'/g, '').split(',')[0].trim();
        const hexMap: Record<string, string> = { '#ffffff': 'white', '#ffff00': 'yellow', '#00ff00': 'green', '#ff8800': 'orange', '#88ccff': 'blue' };
        const color = hexMap[body.subColor] || 'white';
        const strokeWidth = body.subStrokeWidth ?? 3;
        args.push(
          '--subtitles',
          '--sub-font-size', String((body.subFontSize || 20) * 2.5),
          '--sub-font-family', family,
          '--sub-color', color,
          '--sub-bg', String(body.subBgOpacity ?? 0.7),
          '--sub-stroke', String(strokeWidth)
        );
      }
    } catch {
      // 无 body 或格式错误，跳过
    }

    const { stdout, stderr } = await execFileAsync('node', args, { cwd: projectRoot, timeout: 600000 });

    // 解析输出中的 JSON 结果（最后一行）
    const lines = stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    let result;
    try {
      result = JSON.parse(lastLine);
    } catch {
      return NextResponse.json({ error: '合成失败，无法解析输出', output: stdout }, { status: 500 });
    }

    if (!result.success || !result.path) {
      return NextResponse.json({ error: '合成失败', output: stdout }, { status: 500 });
    }

    // 读取视频文件并返回
    const videoBuffer = fs.readFileSync(result.path);
    const filename = path.basename(result.path);

    // 删除临时导出文件
    try { fs.unlinkSync(result.path); } catch {}

    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      error: e.message || '合成失败',
      output: e.stderr || e.stdout || ''
    }, { status: 500 });
  }
}

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { getCurrentProjectPath } from '@/lib/projects';

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '未找到上传的 ZIP 文件' }, { status: 400 });
    }

    const projectRoot = path.resolve(process.cwd(), '..');
    const workDir = getCurrentProjectPath() || projectRoot;
    const localDir = path.join(projectRoot, '.local');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const zipPath = path.join(localDir, 'project_import.zip');
    
    // Save file buffer to local
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(zipPath, bytes);

    // Call native unzip to extract and overwrite existing files
    await execFileAsync('unzip', ['-o', zipPath], { cwd: workDir });

    // Clean up import zip
    fs.unlinkSync(zipPath);

    return NextResponse.json({ success: true, message: '项目导入成功，相关文件已重载' });
  } catch (e: any) {
    return NextResponse.json({ error: `导入失败: ${e.message}` }, { status: 500 });
  }
}

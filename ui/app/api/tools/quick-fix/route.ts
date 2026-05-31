import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentProjectPath } from '@/lib/projects';

export async function POST(request: Request) {
  try {
    const { fixPath, fixType } = await request.json();
    const projectPath = getCurrentProjectPath();
    if (!projectPath) {
      return NextResponse.json({ error: '没有活动项目' }, { status: 404 });
    }

    if (!fixPath || typeof fixPath !== 'string') {
      return NextResponse.json({ error: '无效的修复路径' }, { status: 400 });
    }

    // Security check: must not escape project directory
    const targetPath = path.resolve(projectPath, fixPath);
    const relative = path.relative(projectPath, targetPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return NextResponse.json({ error: '非法路径，越界访问限制' }, { status: 403 });
    }

    // If file already exists, return ok
    if (fs.existsSync(targetPath)) {
      return NextResponse.json({ success: true, message: '文件已存在' });
    }

    // Ensure target folder exists
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    // Generate skeleton file content based on type
    let content = {};
    const baseName = path.basename(fixPath, '.json');

    if (fixType === 'scene') {
      content = {
        scene_id: baseName,
        name: `自动创建的场景 ${baseName}`,
        description: `这是由一键修复自动生成的场景模板。`
      };
    } else if (fixType === 'character') {
      content = {
        character_id: baseName,
        name: `新角色 ${baseName}`,
        avatar: ""
      };
    } else if (fixType === 'prop') {
      content = {
        prop_id: baseName,
        name: `道具 ${baseName}`
      };
    } else if (fixType === 'state') {
      content = {
        shot_id: baseName,
        schema: "continuity_out",
        audio_prompt: "",
        visual_prompt: "",
        narration_done: false,
        visual_done: false
      };
    } else {
      content = {
        todo: `待补充: ${baseName}`
      };
    }

    fs.writeFileSync(targetPath, JSON.stringify(content, null, 2), 'utf-8');
    return NextResponse.json({ success: true, message: `成功创建模板文件: ${fixPath}` });
  } catch (e: any) {
    return NextResponse.json({ error: `修复失败: ${e.message}` }, { status: 500 });
  }
}

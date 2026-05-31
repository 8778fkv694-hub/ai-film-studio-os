import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type') as string; // 'characters' or 'props'
    const id = formData.get('id') as string;

    if (!file || !(file instanceof File) || !type || !id) {
      return NextResponse.json({ error: '缺少必要参数 (file, type, id)' }, { status: 400 });
    }

    if (type !== 'characters' && type !== 'props') {
      return NextResponse.json({ error: '无效的资产类型' }, { status: 400 });
    }

    // Safety checks for traversal
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: '无效的 ID' }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: '仅支持 jpg、jpeg、png、webp 格式' }, { status: 400 });
    }

    // Create target dir
    const targetDir = path.join(getResourcePath('assets'), type, id);
    fs.mkdirSync(targetDir, { recursive: true });

    // Clean name to prevent traversal
    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = path.join(targetDir, safeName);

    // Save image bytes
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, bytes);

    const relativePath = `assets/${type}/${id}/${safeName}`;

    // Update corresponding JSON configuration file
    const jsonDir = getResourcePath(type);
    const jsonPath = path.join(jsonDir, `${id}.json`);

    if (fs.existsSync(jsonPath)) {
      try {
        const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        if (!jsonContent.references) {
          jsonContent.references = {};
        }
        if (!Array.isArray(jsonContent.references.images)) {
          jsonContent.references.images = [];
        }
        if (!jsonContent.references.images.includes(relativePath)) {
          jsonContent.references.images.push(relativePath);
        }
        fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf-8');
      } catch (err: any) {
        console.error('Error updating JSON database:', err);
      }
    }

    return NextResponse.json({
      success: true,
      path: relativePath,
      url: `/api/assets/reference/${relativePath}`
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '上传参考图失败' }, { status: 500 });
  }
}

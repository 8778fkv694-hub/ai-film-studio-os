import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

export async function POST(request: Request) {
  try {
    const { type, id, path: imagePath } = await request.json();

    if (!type || !id || !imagePath) {
      return NextResponse.json({ error: '缺少必要参数 (type, id, path)' }, { status: 400 });
    }

    if (type !== 'characters' && type !== 'props') {
      return NextResponse.json({ error: '无效的资产类型' }, { status: 400 });
    }

    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: '无效的 ID' }, { status: 400 });
    }

    // Update corresponding JSON database file
    const jsonPath = path.join(getResourcePath(type), `${id}.json`);
    if (fs.existsSync(jsonPath)) {
      try {
        const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        if (jsonContent.references && Array.isArray(jsonContent.references.images)) {
          jsonContent.references.images = jsonContent.references.images.filter(
            (img: string) => img !== imagePath
          );
          fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf-8');
        }
      } catch (err: any) {
        console.error('Error updating JSON database:', err);
      }
    }

    // Clean traversal path to delete physical file safely
    const cleanPath = imagePath.replace(/^assets\//, '');
    if (!cleanPath.includes('..')) {
      const physicalPath = path.join(getResourcePath('assets'), cleanPath);
      if (fs.existsSync(physicalPath)) {
        try {
          fs.unlinkSync(physicalPath);
        } catch (err) {
          console.error('Failed to delete physical asset file:', err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '删除参考图失败' }, { status: 500 });
  }
}

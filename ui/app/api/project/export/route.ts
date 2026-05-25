import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { getCurrentProjectPath } from '@/lib/projects';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const workDir = getCurrentProjectPath() || projectRoot;
    const localDir = path.join(projectRoot, '.local');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const zipPath = path.join(localDir, 'project_export.zip');
    
    // Remove existing zip if any
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // Identify files and folders that actually exist to zip
    const itemsToZip = [
      'project.json',
      'shots',
      'shots_draft',
      'scenes',
      'characters',
      'props',
      'styles',
      'assets',
      'docs',
      'prompt_templates',
      'prompt_experience',
      'tools',
      'prompts',
      'renders',
      'render/output'
    ].filter(item => fs.existsSync(path.join(workDir, item)));

    if (itemsToZip.length === 0) {
      return new NextResponse('No project files found to export', { status: 400 });
    }

    await execFileAsync('zip', ['-r', zipPath, ...itemsToZip, '-x', '**/node_modules/*', '-x', '**/.git/*'], { cwd: workDir });

    if (!fs.existsSync(zipPath)) {
      return new NextResponse('ZIP generation failed', { status: 500 });
    }

    const fileBuffer = fs.readFileSync(zipPath);

    // Clean up zip after reading to conserve disk space
    fs.unlinkSync(zipPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=project_export.zip',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-store'
      }
    });
  } catch (e: any) {
    return new NextResponse(`Export failed: ${e.message}`, { status: 500 });
  }
}

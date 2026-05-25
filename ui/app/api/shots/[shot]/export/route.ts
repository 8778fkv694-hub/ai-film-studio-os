import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { getCurrentProjectPath, getResourcePath } from '@/lib/projects';

const execAsync = promisify(exec);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shot: string }> }
) {
  const { shot } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(shot)) {
    return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
  }

  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const workDir = getCurrentProjectPath() || projectRoot;
    const localDir = path.join(projectRoot, '.local');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const tempExportDir = path.join(localDir, `shot_export_${shot}`);
    if (fs.existsSync(tempExportDir)) {
      fs.rmSync(tempExportDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempExportDir, { recursive: true });

    // 1. Copy prompts
    const promptsDir = getResourcePath('prompts');
    const promptJson = path.join(promptsDir, `${shot}.prompt.json`);
    const finalJson = path.join(promptsDir, `${shot}.final.json`);
    if (fs.existsSync(promptJson)) {
      fs.copyFileSync(promptJson, path.join(tempExportDir, `${shot}.prompt.json`));
    }
    if (fs.existsSync(finalJson)) {
      fs.copyFileSync(finalJson, path.join(tempExportDir, `${shot}.final.json`));
    }

    // 2. Copy audio
    const audioFile = path.join(workDir, 'assets/audio', `${shot}.mp3`);
    if (fs.existsSync(audioFile)) {
      fs.copyFileSync(audioFile, path.join(tempExportDir, `${shot}.mp3`));
    }

    // 3. Copy keyframes
    const keyframesSourceDir = path.join(workDir, 'assets/renders', shot, 'keyframes');
    if (fs.existsSync(keyframesSourceDir)) {
      const keyframesDestDir = path.join(tempExportDir, 'keyframes');
      fs.mkdirSync(keyframesDestDir, { recursive: true });
      const files = fs.readdirSync(keyframesSourceDir);
      for (const f of files) {
        fs.copyFileSync(path.join(keyframesSourceDir, f), path.join(keyframesDestDir, f));
      }
    }

    // 4. Copy videos
    const videoSourceDir = path.join(workDir, 'assets/renders', shot, 'video');
    if (fs.existsSync(videoSourceDir)) {
      const videoDestDir = path.join(tempExportDir, 'video');
      fs.mkdirSync(videoDestDir, { recursive: true });
      const files = fs.readdirSync(videoSourceDir);
      for (const f of files) {
        fs.copyFileSync(path.join(videoSourceDir, f), path.join(videoDestDir, f));
      }
    }

    const zipPath = path.join(localDir, `shot_${shot}.zip`);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // Command to zip the temp folder contents
    const cmd = `zip -r "${zipPath}" .`;
    await execAsync(cmd, { cwd: tempExportDir });

    if (!fs.existsSync(zipPath)) {
      return new NextResponse('ZIP generation failed', { status: 500 });
    }

    const fileBuffer = fs.readFileSync(zipPath);

    // Clean up
    fs.unlinkSync(zipPath);
    fs.rmSync(tempExportDir, { recursive: true, force: true });

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename=shot_${shot}.zip`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-store'
      }
    });
  } catch (e: any) {
    return new NextResponse(`Export failed: ${e.message}`, { status: 500 });
  }
}

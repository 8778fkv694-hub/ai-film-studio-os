import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';

const ALLOWED_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi']);

// Helper to execute ffmpeg commands asynchronously
function runFFmpeg(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout);
      }
    });
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const shotId = formData.get('shot_id') as string;

    if (!file || !(file instanceof File) || !shotId) {
      return NextResponse.json({ error: '缺少必要参数 (file, shot_id)' }, { status: 400 });
    }

    if (!/^[A-Za-z0-9_-]+$/.test(shotId)) {
      return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: '仅支持 mp4、mov、webm、avi 格式的视频' }, { status: 400 });
    }

    // Target Directories
    const renderDir = path.join(getResourcePath('assets'), 'renders', shotId);
    const videoDir = path.join(renderDir, 'video');
    const keyframeDir = path.join(renderDir, 'keyframes');

    fs.mkdirSync(videoDir, { recursive: true });
    fs.mkdirSync(keyframeDir, { recursive: true });

    // Save Video File
    const videoPath = path.join(videoDir, `video_raw${ext}`);
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(videoPath, bytes);

    const relativeVideoPath = `assets/renders/${shotId}/video/video_raw${ext}`;
    const videoUrl = `/api/assets/video/${encodeURIComponent(shotId)}/video_raw${ext}`;

    // Extract last frame using ffmpeg
    // -sseof -1 offsets to 1 second before end, -update 1 overwrites to output single image
    const framePath = path.join(keyframeDir, 'frame_last.jpg');
    const ffmpegCmd = `ffmpeg -y -sseof -1 -i "${videoPath}" -update 1 -q:v 1 "${framePath}"`;

    let ffmpegSuccess = false;
    let ffmpegError = '';

    try {
      await runFFmpeg(ffmpegCmd);
      ffmpegSuccess = true;
    } catch (err: any) {
      console.warn('FFmpeg execution failed, extraction skipped:', err);
      ffmpegError = String(err);
      
      // Attempt fallback if frame_last.jpg doesn't exist
      // Write placeholder or warn UI to prompt manual upload
    }

    return NextResponse.json({
      success: true,
      videoPath: relativeVideoPath,
      videoUrl,
      extractedFrame: ffmpegSuccess ? `assets/renders/${shotId}/keyframes/frame_last.jpg` : null,
      ffmpegSuccess,
      ffmpegError
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '上传视频失败' }, { status: 500 });
  }
}

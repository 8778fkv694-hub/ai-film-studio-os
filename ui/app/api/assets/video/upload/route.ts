import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';
import { writeJsonAtomic } from '@/lib/fs-atomic';

const ALLOWED_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi']);

// Helper to execute ffmpeg commands asynchronously
function runFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, (error, stdout, stderr) => {
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

    // 1. Calculate prompt hash
    const promptPath = path.join(getResourcePath('prompts'), `${shotId}.final.json`);
    let promptHash = '';
    if (fs.existsSync(promptPath)) {
      try {
        const promptContent = fs.readFileSync(promptPath, 'utf-8');
        promptHash = crypto.createHash('md5').update(promptContent).digest('hex').substring(0, 8);
      } catch (err) {
        console.warn('Failed to calculate prompt hash:', err);
      }
    }

    // 2. Load or initialize history.json
    const historyFile = path.join(getResourcePath('assets'), 'renders', shotId, 'history.json');
    let history: any = { shot_id: shotId, active_take_id: null, takes: [] };
    if (fs.existsSync(historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      } catch (err) {
        console.warn('Failed to parse history.json:', err);
      }
    }

    // 3. Generate next take ID
    let maxNum = 0;
    for (const t of history.takes || []) {
      const match = t.take_id.match(/take_(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const takeId = `take_${String(maxNum + 1).padStart(3, '0')}`;

    // Target Directories
    const takeDir = path.join(getResourcePath('assets'), 'renders', shotId, 'takes', takeId);
    fs.mkdirSync(takeDir, { recursive: true });

    // Save Video File
    const videoPath = path.join(takeDir, `video${ext}`);
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(videoPath, bytes);

    const relativeVideoPath = `assets/renders/${shotId}/takes/${takeId}/video${ext}`;
    const videoUrl = `/api/assets/reference/renders/${encodeURIComponent(shotId)}/takes/${encodeURIComponent(takeId)}/video${ext}`;

    // 截取首帧与末帧作为分镜画面（首帧用于预览 poster，与视频开头一致，避免闪图）
    const firstFramePath = path.join(takeDir, 'keyframe_first.jpg');
    const framePath = path.join(takeDir, 'keyframe.jpg'); // 末帧

    let ffmpegSuccess = false;
    let ffmpegError = '';

    try {
      // 首帧
      await runFFmpeg(['-y', '-i', videoPath, '-frames:v', '1', '-q:v', '1', firstFramePath]);
      // 末帧
      await runFFmpeg(['-y', '-sseof', '-1', '-i', videoPath, '-update', '1', '-q:v', '1', framePath]);
      ffmpegSuccess = true;
    } catch (err: any) {
      console.warn('FFmpeg execution failed, extraction skipped:', err);
      ffmpegError = String(err);
    }

    // Load shot duration
    let durationS = 4;
    const shotPath = path.join(getResourcePath('shots'), `${shotId}.json`);
    if (fs.existsSync(shotPath)) {
      try {
        durationS = JSON.parse(fs.readFileSync(shotPath, 'utf-8')).duration_s || 4;
      } catch {}
    }

    // 4. Record Take
    const newTake = {
      take_id: takeId,
      timestamp: new Date().toISOString(),
      status: 'imported',
      prompt_hash: promptHash,
      video_path: relativeVideoPath,
      keyframe_path: ffmpegSuccess ? `assets/renders/${shotId}/takes/${takeId}/keyframe_first.jpg` : '',
      keyframe_last_path: ffmpegSuccess ? `assets/renders/${shotId}/takes/${takeId}/keyframe.jpg` : '',
      duration_s: durationS,
      source: 'manual_external',
      platform: 'manual',
      review: {
        rating: null,
        tags: [],
        notes: '',
        approved: false
      }
    };

    history.takes = history.takes || [];
    history.takes.push(newTake);

    // 新上传的视频自动成为当前活动版本（覆盖上一个），与图片一致；
    // 如需回退到旧版本，可在版本面板里对旧 take “设为活动”。
    history.active_take_id = takeId;

    // 把首帧/末帧刷进全局 keyframes，供播放器与列表显示。
    // 命名让首帧排在最前（frame_00），使预览 currentImage = 当前视频首帧、poster 与视频一致、不再闪。
    if (ffmpegSuccess) {
      const globalKeyframesDir = path.join(getResourcePath('assets'), 'renders', shotId, 'keyframes');
      fs.mkdirSync(globalKeyframesDir, { recursive: true });
      fs.copyFileSync(firstFramePath, path.join(globalKeyframesDir, 'frame_00.jpg'));
      fs.copyFileSync(framePath, path.join(globalKeyframesDir, 'frame_last.jpg'));
    }

    // Save History
    writeJsonAtomic(historyFile, history);

    return NextResponse.json({
      success: true,
      take_id: takeId,
      videoPath: relativeVideoPath,
      videoUrl,
      extractedFrame: ffmpegSuccess ? `assets/renders/${shotId}/takes/${takeId}/keyframe.jpg` : null,
      ffmpegSuccess,
      ffmpegError,
      history
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '上传视频失败' }, { status: 500 });
  }
}

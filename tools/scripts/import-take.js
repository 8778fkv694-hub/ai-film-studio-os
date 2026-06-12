import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from './shared/dirs.js';
import { md5Short as md5, VIDEO_EXTS, currentPromptHash, syncActiveTakeKeyframes } from './shared/conventions.js';

const { workDir, remainingArgs } = parseArgs();

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

async function main() {
  const shotId = remainingArgs[0];
  const videoFilePath = remainingArgs[1] ? path.resolve(process.cwd(), remainingArgs[1]) : null;

  if (!shotId || !videoFilePath) {
    console.error('Usage: node tools/scripts/import-take.js <shot_id> <video_file_path> [--platform <name>] [--notes <text>] [--project-dir <dir>|--project-id <id>]');
    process.exit(1);
  }

  // Parse custom parameters
  const platformIndex = remainingArgs.indexOf('--platform');
  const platform = (platformIndex !== -1 && platformIndex + 1 < remainingArgs.length) 
    ? remainingArgs[platformIndex + 1] 
    : 'manual';

  const notesIndex = remainingArgs.indexOf('--notes');
  const notes = (notesIndex !== -1 && notesIndex + 1 < remainingArgs.length) 
    ? remainingArgs[notesIndex + 1] 
    : '';

  if (!/^[A-Za-z0-9_-]+$/.test(shotId)) {
    console.error(`❌ Invalid shot_id: ${shotId}`);
    process.exit(1);
  }

  // 1. Verify shot file
  const shotFile = path.join(workDir, 'shots', `${shotId}.json`);
  if (!fs.existsSync(shotFile)) {
    console.error(`❌ Shot file not found: ${shotFile}`);
    process.exit(1);
  }

  // 2. Verify video file
  if (!fs.existsSync(videoFilePath)) {
    console.error(`❌ Input video file not found: ${videoFilePath}`);
    process.exit(1);
  }
  const ext = path.extname(videoFilePath).toLowerCase();
  const allowedExts = new Set(VIDEO_EXTS);
  if (!allowedExts.has(ext)) {
    console.error(`❌ Unsupported video extension "${ext}". Expected: .mp4, .mov, .webm, .avi`);
    process.exit(1);
  }

  // 3. Load or initialize history
  const historyFile = path.join(workDir, `assets/renders/${shotId}/history.json`);
  let history = readJson(historyFile);
  if (!history) {
    history = { shot_id: shotId, active_take_id: null, takes: [] };
  }

  // 4. Generate next take ID
  let maxNum = 0;
  for (const t of history.takes || []) {
    const match = t.take_id.match(/take_(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const takeId = `take_${String(maxNum + 1).padStart(3, '0')}`;
  const takeDir = path.join(workDir, `assets/renders/${shotId}/takes/${takeId}`);
  ensureDir(takeDir);

  // 5. Copy video file
  const destVideoPath = path.join(takeDir, `video${ext}`);
  fs.copyFileSync(videoFilePath, destVideoPath);
  console.log(`🎬 Copied video to ${destVideoPath}`);

  // 6. Extract keyframe using ffmpeg
  const destKeyframePath = path.join(takeDir, 'keyframe.jpg');
  let ffmpegSuccess = false;
  try {
    console.log('[FFmpeg] Extracting last frame as keyframe...');
    execFileSync('ffmpeg', ['-y', '-sseof', '-1', '-i', destVideoPath, '-update', '1', '-q:v', '1', destKeyframePath], { stdio: 'ignore' });
    ffmpegSuccess = true;
    console.log(`🖼️  Extracted keyframe to ${destKeyframePath}`);
  } catch (err) {
    console.warn('⚠️  Warning: FFmpeg failed to extract last frame. You might want to upload keyframe manually.');
  }

  // 7. Calculate prompt hash
  const promptHash = currentPromptHash(workDir, shotId);
  if (!promptHash) {
    console.warn(`⚠️  Warning: prompts/${shotId}.final.json not found or empty. prompt_hash will be empty.`);
  }

  // 7.1 Probe actual video duration using ffprobe/ffmpeg
  let videoDuration = null;
  try {
    const ffprobeOut = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      destVideoPath
    ], { encoding: 'utf8' }).trim();
    const parsedDuration = parseFloat(ffprobeOut);
    if (!isNaN(parsedDuration) && parsedDuration > 0) {
      videoDuration = Math.round(parsedDuration * 10) / 10;
      console.log(`🎬 Probed video duration: ${videoDuration}s`);
    }
  } catch (err) {
    try {
      execFileSync('ffmpeg', ['-i', destVideoPath], { stdio: 'pipe', encoding: 'utf8' });
    } catch (ffmpegErr) {
      const stderr = ffmpegErr.stderr || '';
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const s = parseFloat(match[3]);
        const parsedDuration = h * 3600 + m * 60 + s;
        videoDuration = Math.round(parsedDuration * 10) / 10;
        console.log(`🎬 Probed video duration (via ffmpeg): ${videoDuration}s`);
      }
    }
  }

  const defaultDuration = readJson(path.join(workDir, `prompts/${shotId}.prompt.json`))?.params?.duration_s || 4;
  const finalDuration = videoDuration !== null ? videoDuration : defaultDuration;

  // 8. Add take record
  const relativeVideoPath = `assets/renders/${shotId}/takes/${takeId}/video${ext}`;
  const relativeKeyframePath = ffmpegSuccess 
    ? `assets/renders/${shotId}/takes/${takeId}/keyframe.jpg` 
    : '';

  const newTake = {
    take_id: takeId,
    timestamp: new Date().toISOString(),
    status: 'imported',
    prompt_hash: promptHash,
    video_path: relativeVideoPath,
    keyframe_path: relativeKeyframePath,
    duration_s: finalDuration,
    source: 'manual_external',
    platform: platform,
    review: {
      rating: null,
      tags: [],
      notes: notes,
      approved: false
    }
  };

  history.takes.push(newTake);

  // 9. Set as active if none exists
  if (!history.active_take_id) {
    history.active_take_id = takeId;
    console.log(`⭐️ Set ${takeId} as active take.`);
    syncActiveTakeKeyframes(workDir, shotId, takeId);
  }

  // 10. Save history
  ensureDir(path.dirname(historyFile));
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

  console.log(`✅ Successfully imported ${takeId} for ${shotId}!`);
}

main().catch(err => {
  console.error('❌ Error importing take:', err.message);
  process.exit(1);
});

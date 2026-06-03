import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from './shared/dirs.js';

const execFileAsync = promisify(execFile);
const { workDir, projectRoot, remainingArgs } = parseArgs();

if (!workDir || !fs.existsSync(workDir)) {
  console.error(`❌ Project working directory not found: ${workDir}`);
  process.exit(1);
}

// Find Ffmpeg
async function findFfmpeg() {
  for (const p of ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg', '/opt/miniconda3/bin/ffmpeg']) {
    try { await execFileAsync(p, ['-version']); return p; } catch {}
  }
  return null;
}

let ffprobeBin = null;
async function findFfprobe() {
  for (const p of ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', 'ffprobe', '/opt/miniconda3/bin/ffprobe']) {
    try { await execFileAsync(p, ['-version']); return p; } catch {}
  }
  return null;
}

// 读取媒体时长（秒）
async function getDurationSec(file) {
  if (!ffprobeBin) return null;
  try {
    const { stdout } = await execFileAsync(ffprobeBin, [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file
    ]);
    const d = parseFloat(stdout.trim());
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch { return null; }
}

// 检测视频文件是否含音轨
async function hasAudioStream(file) {
  if (!ffprobeBin) return false;
  try {
    const { stdout } = await execFileAsync(ffprobeBin, [
      '-v', 'error', '-select_streams', 'a',
      '-show_entries', 'stream=index', '-of', 'csv=p=0', file
    ]);
    return stdout.trim().length > 0;
  } catch { return false; }
}

// Find support for drawtext filter
async function findDrawtextFfmpeg() {
  for (const p of ['/opt/miniconda3/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', 'ffmpeg']) {
    try {
      const { stdout } = await execFileAsync(p, ['-filters']);
      if (stdout.includes('drawtext')) return p;
    } catch {}
  }
  return null;
}

// Parse remaining arguments
let preset = 'default_1080p';
let audioSource = 'tts'; // tts(默认) | video
let includeSubtitles = false;
let subFontSize = 20;
let subFontFamily = 'Microsoft YaHei';
let subColor = 'white';
let subBgOpacity = 0.7;
let subStrokeWidth = 3;

for (let i = 0; i < remainingArgs.length; i++) {
  if (remainingArgs[i] === '--preset' && i + 1 < remainingArgs.length) preset = remainingArgs[i + 1];
  if (remainingArgs[i] === '--audio-source' && i + 1 < remainingArgs.length) audioSource = remainingArgs[i + 1] === 'video' ? 'video' : 'tts';
  if (remainingArgs[i] === '--subtitles') includeSubtitles = true;
  if (remainingArgs[i] === '--sub-font-size' && i + 1 < remainingArgs.length) subFontSize = parseInt(remainingArgs[i + 1]);
  if (remainingArgs[i] === '--sub-font-family' && i + 1 < remainingArgs.length) subFontFamily = remainingArgs[i + 1].replace(/"/g, '').replace(/'/g, '').split(',')[0].trim();
  if (remainingArgs[i] === '--sub-color' && i + 1 < remainingArgs.length) subColor = remainingArgs[i + 1];
  if (remainingArgs[i] === '--sub-bg' && i + 1 < remainingArgs.length) subBgOpacity = parseFloat(remainingArgs[i + 1]);
  if (remainingArgs[i] === '--sub-stroke' && i + 1 < remainingArgs.length) subStrokeWidth = parseInt(remainingArgs[i + 1]);
}

// Resolve preset resolution
const presetsFile = path.join(workDir, 'settings', 'export-presets.json');
let presetsData = {
  "default_1080p": { "width": 1920, "height": 1080, "fps": 24 },
  "vertical_1080x1920": { "width": 1080, "height": 1920, "fps": 24 },
  "square_1080": { "width": 1080, "height": 1080, "fps": 24 }
};

if (fs.existsSync(presetsFile)) {
  try {
    const customPresets = JSON.parse(fs.readFileSync(presetsFile, 'utf-8'));
    presetsData = { ...presetsData, ...customPresets };
  } catch {}
} else {
  const settingsDir = path.dirname(presetsFile);
  if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(presetsFile, JSON.stringify(presetsData, null, 2), 'utf-8');
}

const activePreset = presetsData[preset] || presetsData['default_1080p'];
const width = activePreset.width || 1920;
const height = activePreset.height || 1080;
const fps = activePreset.fps || 24;

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// Create blank audio segment if missing
async function createSilence(ffmpeg, durationS, outputPath) {
  await execFileAsync(ffmpeg, [
    '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-t', String(durationS), '-c:a', 'aac', '-b:a', '64k', outputPath
  ]);
}

// Compose single shot segment
async function composeShot(ffmpeg, shot, shotIndex, tmpDir, width, height) {
  const shotId = shot.shot_id;
  const durationS = shot.duration_s || 5;
  const outputFile = path.join(tmpDir, `segment_${String(shotIndex).padStart(3, '0')}.mp4`);

  let imageFile = null;
  let videoFile = null;

  // Try to load active take from history
  const historyFile = path.join(workDir, 'assets/renders', shotId, 'history.json');
  let activeTake = null;
  if (fs.existsSync(historyFile)) {
    try {
      const history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      const activeId = history.active_take_id;
      if (activeId) {
        activeTake = (history.takes || []).find(t => t.take_id === activeId);
      }
    } catch {}
  }

  if (activeTake) {
    if (activeTake.video_path) {
      const absoluteVideoPath = path.join(workDir, activeTake.video_path);
      if (fs.existsSync(absoluteVideoPath) && fs.statSync(absoluteVideoPath).size > 0) videoFile = absoluteVideoPath;
    }
    if (activeTake.keyframe_path) {
      const absoluteKeyframePath = path.join(workDir, activeTake.keyframe_path);
      if (fs.existsSync(absoluteKeyframePath) && fs.statSync(absoluteKeyframePath).size > 0) imageFile = absoluteKeyframePath;
    }
  }

  // Fallback to legacy paths
  if (!videoFile) {
    const videoDir = path.join(workDir, 'assets/renders', shotId, 'video');
    if (fs.existsSync(videoDir)) {
      const videos = fs.readdirSync(videoDir).filter(f => /\.(mp4|mov|webm|avi)$/i.test(f));
      if (videos.length > 0) {
        const fullPath = path.join(videoDir, videos[0]);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) videoFile = fullPath;
      }
    }
  }
  if (!imageFile) {
    const keyframeDir = path.join(workDir, 'assets/renders', shotId, 'keyframes');
    if (fs.existsSync(keyframeDir)) {
      const imgs = fs.readdirSync(keyframeDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
      if (imgs.length > 0) {
        const fullPath = path.join(keyframeDir, imgs[0]);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) imageFile = fullPath;
      }
    }
  }

  let audioFile = path.join(workDir, 'assets/audio', `${shotId}.mp3`);
  if (!fs.existsSync(audioFile)) audioFile = null;

  console.log(`[Compose] ${shotId}: image=${!!imageFile} video=${!!videoFile} audio=${!!audioFile} duration=${durationS}s`);

  // Build aspect-ratio correct scale and pad filters
  const vfScale = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;

  // 统一编码参数：所有片段必须完全一致，concat -c copy 才不会在片段边界（尤其图片段）卡住。
  // 固定帧率 + 固定时基 + 统一音频采样率/声道。
  const VOPTS = ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(fps), '-video_track_timescale', '90000'];
  const AOPTS = ['-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2'];

  // 确保始终有一条音轨（无配音则补等长静音），让每段都同时具备 v+a 轨
  let audioInput = audioFile;
  if (!audioInput) {
    audioInput = path.join(tmpDir, `silence_${shotId}.m4a`);
    await createSilence(ffmpeg, durationS, audioInput);
  }

  if (videoFile) {
    // 声音来源：默认 TTS（视频只当画面，必须显式 -map 选 TTS 音轨，否则 ffmpeg 默认会选用视频自带声音）。
    // audioSource==='video' 且视频确实带音轨时，才使用画面自带声音。
    let useOwnAudio = false;
    if (audioSource === 'video' && ffprobeBin) {
      useOwnAudio = await hasAudioStream(videoFile);
    }
    if (useOwnAudio) {
      // 用视频自带声音（音画同源，按视频自身长度）
      await execFileAsync(ffmpeg, ['-y', '-i', videoFile, '-t', String(durationS), '-vf', vfScale, ...VOPTS, ...AOPTS, '-map', '0:v:0', '-map', '0:a:0', '-shortest', outputFile]);
    } else {
      // 用 TTS 配音：目标时长 = durationS（≈配音长度）。视频比配音短时按“10% 规则”补足，且绝不截断旁白（不加 -shortest）。
      const videoDur = await getDurationSec(videoFile);
      let videoVf = vfScale;
      if (videoDur && videoDur > 0.1 && durationS - videoDur > 0.2) {
        const stretch = durationS / videoDur;           // >1 表示需要放慢/补足
        if (stretch <= 1.10) {
          // 差距在 10% 以内：轻微放慢视频铺满（PTS 拉伸）
          videoVf = `setpts=${stretch.toFixed(4)}*PTS,${vfScale}`;
          console.log(`[Compose]   ${shotId}: 视频${videoDur.toFixed(1)}s < 目标${durationS}s，放慢×${stretch.toFixed(3)}填满`);
        } else {
          // 差距超 10%：末帧定格补足，保旁白完整
          const pad = (durationS - videoDur).toFixed(3);
          videoVf = `${vfScale},tpad=stop_mode=clone:stop_duration=${pad}`;
          console.log(`[Compose]   ${shotId}: 视频${videoDur.toFixed(1)}s < 目标${durationS}s，末帧定格补 ${pad}s（保旁白）`);
        }
      }
      await execFileAsync(ffmpeg, ['-y', '-i', videoFile, '-i', audioInput, '-t', String(durationS), '-vf', videoVf, ...VOPTS, ...AOPTS, '-map', '0:v:0', '-map', '1:a:0', outputFile]);
    }
  } else if (imageFile) {
    // 图片段：用 -t 铺满整段时长（不加 -shortest，避免配音比时长短时图片被提前截断）
    await execFileAsync(ffmpeg, ['-y', '-loop', '1', '-i', imageFile, '-i', audioInput, '-t', String(durationS), '-vf', vfScale, ...VOPTS, ...AOPTS, '-map', '0:v:0', '-map', '1:a:0', outputFile]);
  } else {
    // 纯黑底：同样用 -t 铺满
    await execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:d=${durationS}`, '-i', audioInput, '-t', String(durationS), '-vf', vfScale, ...VOPTS, ...AOPTS, '-map', '0:v:0', '-map', '1:a:0', outputFile]);
  }

  return outputFile;
}

function findSystemFont(family) {
  const dirs = ['/System/Library/Fonts', '/Library/Fonts', path.join(process.env.HOME || '', 'Library/Fonts'), '/usr/share/fonts'];
  const map = {
    'Microsoft YaHei': ['Microsoft YaHei', 'msyh'],
    'sans-serif': ['Arial', 'Helvetica'],
    'serif': ['Times New Roman', 'Georgia'],
    'monospace': ['Courier New', 'Menlo'],
    'PingFang SC': ['PingFang SC', 'PingFang'],
    'Noto Sans SC': ['Noto Sans SC', 'NotoSansSC'],
  };
  const candidates = map[family] || [family];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const f of fs.readdirSync(dir)) {
        for (const c of candidates) {
          if (f.toLowerCase().includes(c.toLowerCase()) && /\.(ttf|ttc|otf)$/i.test(f)) return path.join(dir, f);
        }
      }
    } catch {}
  }
  return null;
}

async function concatSegments(ffmpeg, segmentFiles, outputPath) {
  const listFile = outputPath + '.list.txt';
  fs.writeFileSync(listFile, segmentFiles.map(f => `file '${f}'`).join('\n'), 'utf-8');
  // 视频直拷（各段编码参数已统一，无需重编码）；音频重编码以消除拼接边界的 Non-monotonic DTS（图片/视频混排时尤其明显）。
  await execFileAsync(ffmpeg, [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
    '-movflags', '+faststart',
    outputPath
  ]);
  fs.rmSync(listFile, { force: true });
}

async function main() {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) { console.error('[Compose] ffmpeg 未安装'); process.exit(1); }
  ffprobeBin = await findFfprobe();
  console.log(`[Compose] 声音来源: ${audioSource === 'video' ? '画面自带声音' : 'TTS 配音'}`);

  const projectPath = path.join(workDir, 'project.json');
  if (!fs.existsSync(projectPath)) { console.error('[Compose] project.json 不存在'); process.exit(1); }

  const project = readJson(projectPath);
  const timeline = project?.timeline || [];
  if (!timeline.length) { console.error('[Compose] timeline 为空'); process.exit(1); }

  // Load shots sequentially from timeline
  const shots = timeline.map(item => {
    const shotPath = path.join(workDir, item.shot_file);
    const shot = readJson(shotPath);
    if (shot) shot.shot_id = item.shot_id;
    return shot;
  }).filter(Boolean);

  console.log(`[Compose] 合成 ${shots.length} 个镜头 (尺寸: ${width}x${height}, 帧率: ${fps}, 预设: ${preset}, ffmpeg: ${ffmpeg})...`);

  const tmpDir = path.join(workDir, '.local', 'compose-tmp');
  ensureDir(tmpDir);
  fs.readdirSync(tmpDir).forEach(f => fs.rmSync(path.join(tmpDir, f), { recursive: true, force: true }));

  const segmentFiles = [];
  for (let i = 0; i < shots.length; i++) {
    segmentFiles.push(await composeShot(ffmpeg, shots[i], i, tmpDir, width, height));
  }

  const exportDir = path.join(workDir, 'exports');
  ensureDir(exportDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(exportDir, `composed_${ts}.mp4`);

  await concatSegments(ffmpeg, segmentFiles, outputPath);

  // Subtitle burn-in via drawtext filter
  if (includeSubtitles) {
    console.log('[Compose] 生成字幕并烧录...');
    const drawFfmpeg = await findDrawtextFfmpeg();
    if (!drawFfmpeg) {
      console.warn('[Compose] 未找到支持 drawtext 的 ffmpeg，跳过字幕烧录');
    } else {
      let fontFile = findSystemFont(subFontFamily) || findSystemFont('PingFang SC');
      if (!fontFile) {
        const stHeiti = '/System/Library/Fonts/STHeiti Medium.ttc';
        fontFile = fs.existsSync(stHeiti) ? stHeiti : '/System/Library/Fonts/Helvetica.ttc';
      }
      const fontArg = `:fontfile='${fontFile}'`;
      
      const drawtexts = [];
      let startTime = 0;
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const text = shot.voiceover?.text || shot.dialogue?.text || '';
        const duration = shot.duration_s || 5;
        if (!text) { startTime += duration; continue; }

        const lines = text.split(/(?<=[。，,.;；!！?？])/).map(s => s.trim()).filter(Boolean);
        const lineTime = duration / lines.length;

        for (let j = 0; j < lines.length; j++) {
          const ts = startTime + j * lineTime;
          const te = startTime + (j + 1) * lineTime;
          const escaped = lines[j].replace(/'/g, "'\\\\\\''");
          // Calculate font size relative to height for consistent sizing across presets
          const finalFontSize = Math.round((height / 1080) * subFontSize);
          const finalStrokeWidth = Math.round((height / 1080) * subStrokeWidth);
          const yPosition = height - 80;
          const boxArg = subBgOpacity > 0 ? `:box=1:boxcolor=black@${subBgOpacity}:boxborderw=4` : `:box=0`;

          drawtexts.push(
            `drawtext=text='${escaped}'${fontArg}:fontsize=${finalFontSize}` +
            `:fontcolor=${subColor}${boxArg}` +
            `:bordercolor=black:borderw=${finalStrokeWidth}` +
            `:x=(w-text_w)/2:y=${yPosition}:enable='between(t,${ts.toFixed(1)},${te.toFixed(1)})'`
          );
        }
        startTime += duration;
      }

      if (drawtexts.length > 0) {
        const vf = drawtexts.join(',');
        const subbedPath = outputPath.replace('.mp4', '_subbed.mp4');
        
        try {
          await execFileAsync(drawFfmpeg, [
            '-y', '-i', outputPath,
            '-vf', vf,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-c:a', 'copy', subbedPath
          ]);
          fs.rmSync(outputPath, { force: true });
          fs.renameSync(subbedPath, outputPath);
          console.log(`[Compose] 字幕已烧录 (${drawtexts.length} 行, ffmpeg: ${drawFfmpeg})`);
        } catch (err) {
          console.warn('[Compose] 字幕烧录失败:', err.message);
        }
      }
    }
  }

  segmentFiles.forEach(f => { try { fs.rmSync(f, { force: true }); } catch {} });

  const stat = fs.statSync(outputPath);
  const mb = (stat.size / 1048576).toFixed(1);
  console.log(`[Compose] 完成: ${outputPath} (${mb} MB)`);
  console.log(JSON.stringify({ success: true, path: outputPath, size: stat.size, sizeMB: mb }));
}

main().catch(e => { console.error('[Compose] Error:', e.message); process.exit(2); });
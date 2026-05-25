import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from './shared/dirs.js';

const execFileAsync = promisify(execFile);
const { workDir, projectRoot, remainingArgs } = parseArgs();

// 查找可用的 ffmpeg（优先 homebrew 版本用于编码，conda 版本作为备选）
async function findFfmpeg() {
  for (const p of ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg', '/opt/miniconda3/bin/ffmpeg']) {
    try { await execFileAsync(p, ['-version']); return p; } catch {}
  }
  return null;
}

// 查找有 drawtext 滤镜的 ffmpeg（用于字幕烧录）
async function findDrawtextFfmpeg() {
  for (const p of ['/opt/miniconda3/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', 'ffmpeg']) {
    try {
      const { stdout } = await execFileAsync(p, ['-filters']);
      if (stdout.includes('drawtext')) return p;
    } catch {}
  }
  return null;
}

async function findFfprobe() {
  for (const p of ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', 'ffprobe']) {
    try { await execFileAsync(p, ['-version']); return p; } catch {}
  }
  return null;
}

// 解析字幕参数
function parseSubtitleArgs(args) {
  let includeSubtitles = false;
  let subFontSize = 20;
  let subFontFamily = 'Microsoft YaHei';
  let subColor = 'white';
  let subBgOpacity = 0.7;
  let subStrokeWidth = 3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--subtitles') includeSubtitles = true;
    if (args[i] === '--sub-font-size' && i + 1 < args.length) subFontSize = parseInt(args[i + 1]);
    if (args[i] === '--sub-font-family' && i + 1 < args.length) subFontFamily = args[i + 1].replace(/"/g, '').replace(/'/g, '').split(',')[0].trim();
    if (args[i] === '--sub-color' && i + 1 < args.length) subColor = args[i + 1];
    if (args[i] === '--sub-bg' && i + 1 < args.length) subBgOpacity = parseFloat(args[i + 1]);
    if (args[i] === '--sub-stroke' && i + 1 < args.length) subStrokeWidth = parseInt(args[i + 1]);
  }

  const colorMap = { white: '&H00FFFFFF', yellow: '&H0000FFFF', green: '&H0000FF00', orange: '&H000088FF', blue: '&H00FFFFCC' };
  return {
    includeSubtitles, subFontSize, subFontFamily, subStrokeWidth,
    subColorHex: colorMap[subColor] || '&H00FFFFFF',
    subBgHex: subBgOpacity > 0 ? `&H${Math.round(subBgOpacity * 255).toString(16).padStart(2, '0').toUpperCase()}000000` : '&H00000000',
  };
}

const subOpts = parseSubtitleArgs(remainingArgs);

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function getAudioDuration(mp3Path) {
  const probe = await findFfprobe();
  if (!probe) return 0;
  try {
    const { stdout } = await execFileAsync(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', mp3Path]);
    const d = parseFloat(JSON.parse(stdout).format?.duration || '0');
    return isNaN(d) ? 0 : d;
  } catch { return 0; }
}

// 创建静音音频
async function createSilence(ffmpeg, durationS, outputPath) {
  await execFileAsync(ffmpeg, [
    '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-t', String(durationS), '-c:a', 'aac', '-b:a', '64k', outputPath
  ]);
}

async function composeShot(ffmpeg, shot, shotIndex, tmpDir, fps) {
  const shotId = shot.shot_id;
  const durationS = shot.duration_s || 5;
  const outputFile = path.join(tmpDir, `segment_${String(shotIndex).padStart(3, '0')}.mp4`);

  let imageFile = null;
  const keyframeDir = path.join(workDir, 'assets/renders', shotId, 'keyframes');
  if (fs.existsSync(keyframeDir)) {
    const imgs = fs.readdirSync(keyframeDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
    if (imgs.length > 0) imageFile = path.join(keyframeDir, imgs[0]);
  }

  let videoFile = null;
  const videoDir = path.join(workDir, 'assets/renders', shotId, 'video');
  if (fs.existsSync(videoDir)) {
    const videos = fs.readdirSync(videoDir).filter(f => /\.(mp4|mov|webm|avi)$/i.test(f));
    if (videos.length > 0) videoFile = path.join(videoDir, videos[0]);
  }

  let audioFile = path.join(workDir, 'assets/audio', `${shotId}.mp3`);
  if (!fs.existsSync(audioFile)) audioFile = null;

  console.log(`[Compose] ${shotId}: image=${!!imageFile} video=${!!videoFile} audio=${!!audioFile} duration=${durationS}s`);

  if (videoFile) {
    if (audioFile) {
      await execFileAsync(ffmpeg, ['-y', '-i', videoFile, '-i', audioFile, '-t', String(durationS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-shortest', outputFile]);
    } else {
      const sp = path.join(tmpDir, `silence_${shotId}.m4a`);
      await createSilence(ffmpeg, durationS, sp);
      await execFileAsync(ffmpeg, ['-y', '-i', videoFile, '-i', sp, '-t', String(durationS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-shortest', outputFile]);
    }
  } else if (imageFile) {
    if (audioFile) {
      await execFileAsync(ffmpeg, ['-y', '-loop', '1', '-i', imageFile, '-i', audioFile, '-t', String(durationS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2', '-c:a', 'aac', '-b:a', '128k', '-shortest', outputFile]);
    } else {
      const sp = path.join(tmpDir, `silence_${shotId}.m4a`);
      await createSilence(ffmpeg, durationS, sp);
      await execFileAsync(ffmpeg, ['-y', '-loop', '1', '-i', imageFile, '-i', sp, '-t', String(durationS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2', '-c:a', 'aac', '-b:a', '128k', '-shortest', outputFile]);
    }
  } else {
    if (audioFile) {
      await execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:d=' + durationS, '-i', audioFile, '-t', String(durationS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-shortest', outputFile]);
    } else {
      await execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:d=' + durationS, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(durationS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '64k', '-shortest', outputFile]);
    }
  }

  return outputFile;
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function generateSRT(shots, outputPath) {
  let srt = '';
  let startTime = 0;

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const text = shot.voiceover?.text || shot.dialogue?.text || '';
    if (!text) { startTime += shot.duration_s || 5; continue; }

    const duration = shot.duration_s || 5;
    const endTime = startTime + duration;
    const lines = text.split(/(?<=[。，,.;；!！?？])/).map(s => s.trim()).filter(Boolean);
    const lineTime = duration / lines.length;

    for (let j = 0; j < lines.length; j++) {
      const ls = startTime + j * lineTime;
      const le = startTime + (j + 1) * lineTime;
      srt += `${i * 100 + j + 1}\n${formatTime(ls)} --> ${formatTime(le)}\n${lines[j]}\n\n`;
    }
    startTime = endTime;
  }

  fs.writeFileSync(outputPath, srt, 'utf-8');
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
  await execFileAsync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputPath]);
  fs.rmSync(listFile, { force: true });
}

async function main() {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) { console.error('[Compose] ffmpeg 未安装'); process.exit(1); }

  const shotsDir = path.join(workDir, 'shots');
  if (!fs.existsSync(shotsDir)) { console.error('[Compose] shots/ 目录不存在'); process.exit(1); }

  const shotFiles = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json')).sort();
  if (!shotFiles.length) { console.error('[Compose] 没有分镜文件'); process.exit(1); }

  const shots = shotFiles.map(f => readJson(path.join(shotsDir, f))).filter(Boolean);
  console.log(`[Compose] 合成 ${shots.length} 个镜头 (ffmpeg: ${ffmpeg})...`);

  const tmpDir = path.join(workDir, '.local', 'compose-tmp');
  ensureDir(tmpDir);
  fs.readdirSync(tmpDir).forEach(f => fs.rmSync(path.join(tmpDir, f), { recursive: true, force: true }));

  const segmentFiles = [];
  for (let i = 0; i < shots.length; i++) {
    segmentFiles.push(await composeShot(ffmpeg, shots[i], i, tmpDir, 24));
  }

  const exportDir = path.join(workDir, 'exports');
  ensureDir(exportDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(exportDir, `composed_${ts}.mp4`);

  await concatSegments(ffmpeg, segmentFiles, outputPath);

  // 烧录字幕（使用 drawtext 滤镜）
  if (subOpts.includeSubtitles) {
    console.log('[Compose] 生成字幕并烧录...');
    const drawFfmpeg = await findDrawtextFfmpeg();
    if (!drawFfmpeg) {
      console.warn('[Compose] 未找到支持 drawtext 的 ffmpeg，跳过字幕烧录');
    } else {
      // 查找中文字体
      let fontFile = findSystemFont(subOpts.subFontFamily) || findSystemFont('PingFang SC');
      if (!fontFile) {
        const stHeiti = '/System/Library/Fonts/STHeiti Medium.ttc';
        fontFile = fs.existsSync(stHeiti) ? stHeiti : '/System/Library/Fonts/Helvetica.ttc';
      }
      const fontArg = `:fontfile='${fontFile}'`;
      
      // 构建 drawtext 滤镜链
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
          // 转义单引号：将 ' 替换为 '\'' 
          const escaped = lines[j].replace(/'/g, "'\\\\\\''");
          drawtexts.push(
            `drawtext=text='${escaped}'${fontArg}:fontsize=${subOpts.subFontSize}` +
            `:fontcolor=white:box=0` +
            `:bordercolor=black:borderw=${subOpts.subStrokeWidth}` +
            `:x=(w-text_w)/2:y=h-th-60:enable='between(t,${ts.toFixed(1)},${te.toFixed(1)})'`
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
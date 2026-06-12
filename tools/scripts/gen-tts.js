import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { parseArgs } from './shared/dirs.js';
import { speechHash } from './shared/conventions.js';
import { promisify } from 'node:util';
import { EdgeTTS } from 'node-edge-tts';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[TTS] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[TTS] Uncaught Exception:', err);
});

const { workDir, projectRoot, remainingArgs } = parseArgs();
const execFileAsync = promisify(execFile);

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function speechSegmentsForShot(shot) {
  const segments = [];
  if (shot.voiceover?.text) {
    segments.push({
      role: 'voiceover',
      text: shot.voiceover.text,
      voice: shot.voiceover.voice_id || 'zh-CN-XiaoxiaoNeural',
      rate: '-4%'
    });
  }
  if (shot.dialogue?.text) {
    segments.push({
      role: 'dialogue',
      text: shot.dialogue.text,
      voice: shot.dialogue.voice_id || 'zh-CN-YunxiNeural',
      rate: '+0%'
    });
  }
  return segments;
}

function safeSpeechText(text) {
  return String(text || '').replace(/["\n]/g, '').trim();
}

function audioMetaPath(outFile) {
  return `${outFile}.meta.json`;
}

// 语音内容指纹来自 shared/conventions.js 的 speechHash（与 UI 同源）
function writeAudioMeta(outFile, shot) {
  try {
    fs.writeFileSync(audioMetaPath(outFile), JSON.stringify({
      text_hash: speechHash(shot),
      generatedAt: new Date().toISOString()
    }, null, 2));
  } catch (e) {
    console.warn(`[TTS] Failed to write audio meta for ${path.basename(outFile)}:`, e?.message || e);
  }
}

async function getAudioDuration(mp3Path) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      mp3Path
    ]);
    const info = JSON.parse(stdout);
    const duration = parseFloat(info.format?.duration || '0');
    return isNaN(duration) ? null : Math.ceil(duration + 0.5); // 向上取整，预留余量
  } catch {
    return null;
  }
}

// 精确时长（秒，不取整），用于闭环匹配迭代
async function getAudioDurationPrecise(mp3Path) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', mp3Path
    ]);
    const d = parseFloat(JSON.parse(stdout).format?.duration || '0');
    return isNaN(d) || d <= 0 ? null : d;
  } catch {
    return null;
  }
}

async function updateShotDuration(shotId, newDuration) {
  const shotFile = path.join(workDir, 'shots', `${shotId}.json`);
  const shot = readJson(shotFile);
  if (!shot) return;
  
  const oldDuration = shot.duration_s;
  shot.duration_s = newDuration;
  fs.writeFileSync(shotFile, JSON.stringify(shot, null, 2));
  
  // 同步更新 project.json timeline
  const projectFile = path.join(workDir, 'project.json');
  const project = readJson(projectFile);
  if (project?.timeline) {
    let updated = false;
    for (const entry of project.timeline) {
      if (entry.shot_id === shotId) {
        entry.duration_s = newDuration;
        updated = true;
      }
    }
    if (updated) {
      fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
    }
  }
  
  console.log(`[TTS]   ${shotId} duration updated: ${oldDuration}s → ${newDuration}s (基于实际音频长度)`);
}

async function concatMp3(segmentFiles, outFile, shot_id = 'unknown') {
  if (segmentFiles.length === 1) {
    fs.copyFileSync(segmentFiles[0], outFile);
    return;
  }

  // Check if ffmpeg exists
  let hasFfmpeg = true;
  try {
    await execFileAsync('ffmpeg', ['-version']);
  } catch (err) {
    hasFfmpeg = false;
  }

  if (!hasFfmpeg) {
    console.warn(`[WARN] ffmpeg is not installed on this system. Cannot concatenate multiple voiceover/dialogue tracks for shot ${shot_id}. Falling back to copying the first segment.`);
    fs.copyFileSync(segmentFiles[0], outFile);
    return;
  }

  const listFile = `${outFile}.concat.txt`;
  const lines = segmentFiles
    .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listFile, lines, 'utf-8');

  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      outFile
    ]);
  } catch (err) {
    console.error(`[ERROR] ffmpeg concatenation failed:`, err);
    console.log(`[TTS] Gracefully falling back to copying first segment for shot ${shot_id}.`);
    fs.copyFileSync(segmentFiles[0], outFile);
  } finally {
    fs.rmSync(listFile, { force: true });
  }
}

// 把分段自带的 rate（如 -4%）与额外的语速偏移（用于匹配时长）相加，并夹到合理区间
function combineRate(baseRate, extraPct) {
  const base = parseInt(String(baseRate || '0').replace('%', ''), 10) || 0;
  let total = base + (extraPct || 0);
  total = Math.max(-45, Math.min(90, Math.round(total)));
  return `${total >= 0 ? '+' : ''}${total}%`;
}

// 合成一个镜头的全部语音分段并拼接到 outFile；extraRatePct 为额外语速偏移
async function renderSegments(tts, segments, shot_id, tmpDir, outFile, extraRatePct = 0) {
  const segmentFiles = [];
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const safeText = safeSpeechText(segment.text);
    if (!safeText) continue;
    const segmentFile = path.join(tmpDir, `${shot_id}_${String(i + 1).padStart(2, '0')}_${segment.role}.mp3`);
    const rate = combineRate(segment.rate, extraRatePct);
    console.log(`[TTS]   ${segment.role}: "${safeText}" (${segment.voice}, rate ${rate})`);

    let success = false;
    let attempts = 3;
    while (attempts > 0 && !success) {
      try {
        await tts.ttsPromise(safeText, segmentFile, {
          voice: segment.voice,
          rate,
          pitch: 0,
          volume: 0
        });
        success = true;
      } catch (err) {
        attempts--;
        console.warn(`[TTS]   Attempt failed for ${shot_id} (${segment.role}), ${attempts} attempts remaining. Error:`, err);
        if (attempts > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw err;
        }
      }
    }
    segmentFiles.push(segmentFile);
  }

  if (segmentFiles.length === 0) return false;
  await concatMp3(segmentFiles, outFile, shot_id);
  return true;
}

async function main() {
  const tts = new EdgeTTS();
  const force = process.argv.includes('--force');
  const shotArgIndex = process.argv.indexOf('--shot');
  const onlyShotId = shotArgIndex >= 0 ? process.argv[shotArgIndex + 1] : null;
  const targetArgIndex = process.argv.indexOf('--target-duration');
  const targetDuration = targetArgIndex >= 0 ? parseFloat(process.argv[targetArgIndex + 1]) : null;
  const hasTarget = targetDuration && Number.isFinite(targetDuration) && targetDuration > 0;
  const shotsDir = path.join(workDir, 'shots');
  const audioDir = path.join(workDir, 'assets/audio');
  const tmpDir = path.join(workDir, '.local/tts-segments');
  
  if (!fs.existsSync(shotsDir)) return;
  ensureDir(audioDir);
  ensureDir(tmpDir);

  const files = fs.readdirSync(shotsDir)
    .filter(f => f.endsWith('.json'))
    .filter(f => !onlyShotId || f === `${onlyShotId}.json`);
  console.log(`[TTS] Scanning ${files.length} shots for dialogue...`);
  let generated = 0;

  for (const f of files) {
    const shot = readJson(path.join(shotsDir, f));
    const segments = shot ? speechSegmentsForShot(shot) : [];
    if (shot && segments.length > 0) {
      const { shot_id } = shot;
      const outFile = path.join(audioDir, `${shot_id}.mp3`);

      // Skip if exists and looks non-empty (cheap caching)；
      // 但若 meta 记录的台词指纹与当前不一致，说明台词改过，自动重新生成
      if (!force && fs.existsSync(outFile) && fs.statSync(outFile).size > 1024) {
        const meta = readJson(audioMetaPath(outFile));
        const currentHash = speechHash(shot);
        if (meta?.text_hash && meta.text_hash !== currentHash) {
          console.log(`[TTS] ${shot_id} 台词已修改（${meta.text_hash} → ${currentHash}），重新生成`);
        } else {
          if (!meta) writeAudioMeta(outFile, shot); // 旧音频补登记指纹
          console.log(`[TTS] Skipping ${shot_id} (already exists)`);
          // 即使跳过生成，也根据已有音频更新时长
          const actualDuration = await getAudioDuration(outFile);
          if (actualDuration && actualDuration > 0) {
            await updateShotDuration(shot_id, actualDuration);
          }
          continue;
        }
      }

      console.log(`[TTS] Generating audio for ${shot_id}: ${segments.length} segment(s)...`);

      try {
        // 第一遍：自然语速合成
        const ok = await renderSegments(tts, segments, shot_id, tmpDir, outFile, 0);
        if (!ok) continue;

        if (hasTarget) {
          // 闭环匹配画面时长：实测 → 修正语速 → 重合成，最多 3 次，保留最接近的一版
          const TOL = 0.35;          // 容差（秒）
          const RATE_MIN = -45, RATE_MAX = 90; // 语速舒适/可用区间
          const bestFile = `${outFile}.best.mp3`;
          let extraPct = 0;
          let best = { dur: await getAudioDurationPrecise(outFile), rate: 0 };
          fs.copyFileSync(outFile, bestFile);

          for (let attempt = 1; attempt <= 3; attempt++) {
            const cur = await getAudioDurationPrecise(outFile);
            if (!cur) break;
            if (Math.abs(cur - targetDuration) <= TOL) break;
            // 由当前语速与实测时长反推自然时长，再算命中目标所需语速
            const naturalEst = cur * (1 + extraPct / 100);
            let newPct = Math.round(100 * (naturalEst / targetDuration - 1));
            newPct = Math.max(RATE_MIN, Math.min(RATE_MAX, newPct));
            if (newPct === extraPct) break; // 语速已触顶，再调也无效 → 该改台词（档3）
            extraPct = newPct;
            console.log(`[TTS]   第${attempt}次匹配：实测 ${cur.toFixed(2)}s → 目标 ${targetDuration}s，语速 ${extraPct >= 0 ? '+' : ''}${extraPct}%`);
            await renderSegments(tts, segments, shot_id, tmpDir, outFile, extraPct);
            const dur = await getAudioDurationPrecise(outFile);
            if (dur && (!best.dur || Math.abs(dur - targetDuration) < Math.abs(best.dur - targetDuration))) {
              best = { dur, rate: extraPct };
              fs.copyFileSync(outFile, bestFile);
            }
          }
          fs.copyFileSync(bestFile, outFile);
          fs.rmSync(bestFile, { force: true });
          const gap = best.dur ? (best.dur - targetDuration) : 0;
          console.log(`[TTS] -> Saved ${shot_id}.mp3 (目标 ${targetDuration}s，实得 ${best.dur ? best.dur.toFixed(2) : '?'}s，语速 ${best.rate >= 0 ? '+' : ''}${best.rate}%，余差 ${gap.toFixed(2)}s → 余下由视频微调吸收)`);
          writeAudioMeta(outFile, shot);
          generated += 1;
          // 配音对齐到画面：分镜时长以目标（画面）为准
          await updateShotDuration(shot_id, Math.round(targetDuration));
        } else {
          console.log(`[TTS] -> Saved to assets/audio/${shot_id}.mp3`);
          writeAudioMeta(outFile, shot);
          generated += 1;
          // 根据实际音频时长自动调整分镜 duration_s
          const actualDuration = await getAudioDuration(outFile);
          if (actualDuration && actualDuration > 0) {
            await updateShotDuration(shot_id, actualDuration);
          }
        }
      } catch (e) {
        console.error(`[TTS] Failed to generate ${shot_id}:`, e);
      }
    }
  }

  console.log(`[TTS] Generated ${generated} file(s).`);
}

main();

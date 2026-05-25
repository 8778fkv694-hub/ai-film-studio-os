import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { parseArgs } from './shared/dirs.js';
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

async function main() {
  const tts = new EdgeTTS();
  const force = process.argv.includes('--force');
  const shotArgIndex = process.argv.indexOf('--shot');
  const onlyShotId = shotArgIndex >= 0 ? process.argv[shotArgIndex + 1] : null;
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

      // Skip if exists and looks non-empty (cheap caching)
      if (!force && fs.existsSync(outFile) && fs.statSync(outFile).size > 1024) {
        console.log(`[TTS] Skipping ${shot_id} (already exists)`);
        // 即使跳过生成，也根据已有音频更新时长
        const actualDuration = await getAudioDuration(outFile);
        if (actualDuration && actualDuration > 0) {
          await updateShotDuration(shot_id, actualDuration);
        }
        continue;
      }

      console.log(`[TTS] Generating audio for ${shot_id}: ${segments.length} segment(s)...`);
      
      try {
        const segmentFiles = [];
        for (let i = 0; i < segments.length; i += 1) {
          const segment = segments[i];
          const safeText = safeSpeechText(segment.text);
          if (!safeText) continue;
          const segmentFile = path.join(tmpDir, `${shot_id}_${String(i + 1).padStart(2, '0')}_${segment.role}.mp3`);
          console.log(`[TTS]   ${segment.role}: "${safeText}" (${segment.voice})`);
          
          let success = false;
          let attempts = 3;
          while (attempts > 0 && !success) {
            try {
              await tts.ttsPromise(safeText, segmentFile, {
                voice: segment.voice,
                rate: segment.rate,
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

        if (segmentFiles.length === 0) continue;
        await concatMp3(segmentFiles, outFile, shot_id);
        console.log(`[TTS] -> Saved to assets/audio/${shot_id}.mp3`);
        generated += 1;

        // 根据实际音频时长自动调整分镜 duration_s
        const actualDuration = await getAudioDuration(outFile);
        if (actualDuration && actualDuration > 0) {
          await updateShotDuration(shot_id, actualDuration);
        }
      } catch (e) {
        console.error(`[TTS] Failed to generate ${shot_id}:`, e);
      }
    }
  }

  console.log(`[TTS] Generated ${generated} file(s).`);
}

main();

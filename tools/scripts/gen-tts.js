import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { EdgeTTS } from 'node-edge-tts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
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
      rate: -4
    });
  }
  if (shot.dialogue?.text) {
    segments.push({
      role: 'dialogue',
      text: shot.dialogue.text,
      voice: shot.dialogue.voice_id || 'zh-CN-YunxiNeural',
      rate: 0
    });
  }
  return segments;
}

function safeSpeechText(text) {
  return String(text || '').replace(/["\n]/g, '').trim();
}

async function concatMp3(segmentFiles, outFile) {
  if (segmentFiles.length === 1) {
    fs.copyFileSync(segmentFiles[0], outFile);
    return;
  }

  const listFile = `${outFile}.concat.txt`;
  const lines = segmentFiles
    .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listFile, lines, 'utf-8');

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

  fs.rmSync(listFile, { force: true });
}

async function main() {
  const tts = new EdgeTTS();
  const force = process.argv.includes('--force');
  const shotArgIndex = process.argv.indexOf('--shot');
  const onlyShotId = shotArgIndex >= 0 ? process.argv[shotArgIndex + 1] : null;
  const shotsDir = path.join(ROOT, 'shots');
  const audioDir = path.join(ROOT, 'assets/audio');
  const tmpDir = path.join(ROOT, '.local/tts-segments');
  
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
          await tts.ttsPromise(safeText, segmentFile, {
            voice: segment.voice,
            rate: segment.rate,
            pitch: 0,
            volume: 0
          });
          segmentFiles.push(segmentFile);
        }

        if (segmentFiles.length === 0) continue;
        await concatMp3(segmentFiles, outFile);
        console.log(`[TTS] -> Saved to assets/audio/${shot_id}.mp3`);
        generated += 1;
      } catch (e) {
        console.error(`[TTS] Failed to generate ${shot_id}:`, e);
      }
    }
  }

  console.log(`[TTS] Generated ${generated} file(s).`);
}

main();

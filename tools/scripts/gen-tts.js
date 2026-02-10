import fs from 'node:fs';
import path from 'node:path';
import { EdgeTTS } from 'node-edge-tts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const tts = new EdgeTTS();
  const shotsDir = path.join(ROOT, 'shots');
  const audioDir = path.join(ROOT, 'assets/audio');
  
  if (!fs.existsSync(shotsDir)) return;
  ensureDir(audioDir);

  const files = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json'));
  console.log(`[TTS] Scanning ${files.length} shots for dialogue...`);

  for (const f of files) {
    const shot = readJson(path.join(shotsDir, f));
    if (shot && shot.dialogue && shot.dialogue.text) {
      const { shot_id, dialogue } = shot;
      const voice = dialogue.voice_id || 'en-US-ChristopherNeural';
      const safeText = dialogue.text.replace(/["\n]/g, '');
      const outFile = path.join(audioDir, `${shot_id}.mp3`);

      // Skip if exists (cheap caching)
      if (fs.existsSync(outFile)) {
        console.log(`[TTS] Skipping ${shot_id} (already exists)`);
        continue;
      }

      console.log(`[TTS] Generating audio for ${shot_id}: "${safeText}" (${voice})...`);
      
      try {
        await tts.ttsPromise(safeText, outFile, {
            voice,
            rate: 0, // default speed
            pitch: 0,
            volume: 0
        });
        console.log(`[TTS] -> Saved to assets/audio/${shot_id}.mp3`);
      } catch (e) {
        console.error(`[TTS] Failed to generate ${shot_id}:`, e);
      }
    }
  }
}

main();

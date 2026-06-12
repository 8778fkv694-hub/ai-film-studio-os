import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';
import { md5Short as md5, currentPromptHash } from './shared/conventions.js';

const { workDir, remainingArgs } = parseArgs();

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  const shotId = remainingArgs[0]; // e.g. S001
  if (!shotId) {
    console.error("Usage: node tools/scripts/manage-renders.js <shot_id> [--project-dir <dir>|--project-id <id>]");
    process.exit(1);
  }

  const promptFile = path.join(workDir, `prompts/${shotId}.final.json`);
  const historyFile = path.join(workDir, `assets/renders/${shotId}/history.json`);
  
  if (!fs.existsSync(promptFile)) {
    console.error(`Prompt file not found: ${promptFile}. Run build-prompts.js first.`);
    process.exit(1);
  }

  // 1. Load History
  let history = readJson(historyFile);
  if (!history) {
    history = { shot_id: shotId, active_take_id: null, takes: [] };
  }

  // 2. Prepare Take ID
  // Find max take number to prevent collisions if any takes were deleted
  let maxNum = 0;
  for (const t of history.takes || []) {
    const match = t.take_id.match(/take_(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const takeId = `take_${String(maxNum + 1).padStart(3, '0')}`;
  // 3. Record a pending manual take slot. Actual videos/images are imported with import-take.js or the UI uploader.
  const promptHash = currentPromptHash(workDir, shotId);

  const newTake = {
    take_id: takeId,
    timestamp: new Date().toISOString(),
    status: 'pending',
    prompt_hash: promptHash,
    model: 'manual_external',
    seed: null,
    cost_estimate: 0,
    video_path: '',
    keyframe_path: '',
    duration_s: readJson(path.join(workDir, `prompts/${shotId}.prompt.json`))?.params?.duration_s || 4,
    source: 'manual_external',
    platform: 'manual',
    review: {
      rating: null,
      tags: [],
      notes: '',
      approved: false
    }
  };

  history.takes.push(newTake);

  if (!history.active_take_id) {
    history.active_take_id = takeId;
  }

  // 4. Save History
  ensureDir(path.dirname(historyFile));
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  console.log(`[Render] Pending manual take ${takeId} recorded in history. (Hash: ${promptHash})`);
  console.log(`[Render] Import the finished file with: node tools/scripts/import-take.js ${shotId} <video_file>`);
}

main();

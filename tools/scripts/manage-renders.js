import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from './shared/dirs.js';

const { workDir, remainingArgs } = parseArgs();

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// Mock Render Function
async function mockRender(shotId, takeId) {
  console.log(`[Render] Simulating render for ${shotId} (${takeId})...`);
  await new Promise(r => setTimeout(r, 500)); // Simulate delay
  
  const relativeVideoPath = `assets/renders/${shotId}/takes/${takeId}/video.mp4`;
  const relativeKeyframePath = `assets/renders/${shotId}/takes/${takeId}/keyframe.jpg`;

  return {
    status: 'success',
    video_path: relativeVideoPath,
    keyframe_path: relativeKeyframePath,
    cost: 0.05,
    model: "seedance-2.0-turbo",
    seed: Math.floor(Math.random() * 1000000)
  };
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
  const takeDir = path.join(workDir, `assets/renders/${shotId}/takes/${takeId}`);
  ensureDir(takeDir);

  // 3. Render (Mock)
  const result = await mockRender(shotId, takeId);

  // 4. Create Mock Files on disk so the UI/Remotion can see them
  fs.writeFileSync(path.join(takeDir, 'video.mp4'), Buffer.alloc(0)); // empty file
  fs.writeFileSync(path.join(takeDir, 'keyframe.jpg'), Buffer.alloc(0)); // empty file

  // 5. Record Take
  const promptContent = fs.readFileSync(promptFile, 'utf-8');
  const promptHash = md5(promptContent);

  const newTake = {
    take_id: takeId,
    timestamp: new Date().toISOString(),
    status: result.status,
    prompt_hash: promptHash,
    model: result.model,
    seed: result.seed,
    cost_estimate: result.cost,
    video_path: result.video_path,
    keyframe_path: result.keyframe_path,
    duration_s: readJson(path.join(workDir, `prompts/${shotId}.prompt.json`))?.params?.duration_s || 4,
    source: 'automated_mock',
    platform: 'mock_renderer',
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
    
    // Copy keyframe to global keyframes directory for player compatibility
    const globalKeyframesDir = path.join(workDir, `assets/renders/${shotId}/keyframes`);
    ensureDir(globalKeyframesDir);
    fs.writeFileSync(path.join(globalKeyframesDir, 'frame_last.jpg'), Buffer.alloc(0));
  }

  // 6. Save History
  ensureDir(path.dirname(historyFile));
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  console.log(`[Render] Take ${takeId} recorded in history. (Hash: ${promptHash})`);
}

main();

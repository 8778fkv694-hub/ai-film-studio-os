import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

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

// Mock Render Function (Replace with actual API call)
async function mockRender(shotId, promptPath) {
  console.log(`[Render] Simulating render for ${shotId}...`);
  await new Promise(r => setTimeout(r, 500)); // Simulate delay
  return {
    status: 'success',
    file_path: `renders/${shotId}/takes/${shotId}_take_${Date.now()}.mp4`,
    cost: 0.05,
    model: "seedance-2.0-turbo",
    seed: Math.floor(Math.random() * 1000000)
  };
}

async function main() {
  const shotId = process.argv[2]; // e.g. S001
  if (!shotId) {
    console.error("Usage: node tools/scripts/manage-renders.js <shot_id>");
    process.exit(1);
  }

  const promptFile = path.join(ROOT, `prompts/${shotId}.final.json`);
  const historyFile = path.join(ROOT, `renders/${shotId}/history.json`);
  const renderDir = path.join(ROOT, `renders/${shotId}/takes`);

  if (!fs.existsSync(promptFile)) {
    console.error(`Prompt file not found: ${promptFile}. Run build-prompts.js first.`);
    process.exit(1);
  }

  ensureDir(renderDir);

  // 1. Load History
  let history = readJson(historyFile);
  if (!history) {
    history = { shot_id: shotId, best_take: null, takes: [] };
  }

  // 2. Prepare Take
  const promptContent = fs.readFileSync(promptFile, 'utf-8');
  const promptHash = md5(promptContent);
  const takeId = `${shotId}_take_${history.takes.length + 1}`;

  // 3. Render (Mock)
  const result = await mockRender(shotId, promptFile);

  // 4. Record Take
  const newTake = {
    take_id: takeId,
    timestamp: new Date().toISOString(),
    status: result.status,
    prompt_hash: promptHash,
    model: result.model,
    seed: result.seed,
    cost_estimate: result.cost,
    file_path: result.file_path,
    duration_s: readJson(path.join(ROOT, `prompts/${shotId}.prompt.json`))?.params?.duration_s || 4
  };

  history.takes.push(newTake);

  // 5. Save History
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  console.log(`[Render] Take ${takeId} recorded in history. (Hash: ${promptHash})`);
}

main();

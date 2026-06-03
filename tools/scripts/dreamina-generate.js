import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { parseArgs } from './shared/dirs.js';

const { workDir, projectRoot } = parseArgs();

// Find dreamina CLI binary
const dreaminaPath = path.join(process.env.HOME || '', '.local/bin/dreamina');

function readJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// Helper to spawn a process and stream stdout/stderr, resolving with full stdout
function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`[DreaminaGen] Running: ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const s = data.toString();
      stdout += s;
      process.stdout.write(s);
    });

    proc.stderr.on('data', (data) => {
      const s = data.toString();
      stderr += s;
      process.stderr.write(s);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Process exited with code ${code}. Stderr: ${stderr}`));
      }
    });
  });
}

async function main() {
  if (!fs.existsSync(dreaminaPath)) {
    console.error(`❌ Dreamina CLI binary not found at ${dreaminaPath}. Please install it first.`);
    process.exit(1);
  }

  // Parse shot parameter
  const shotArgIndex = process.argv.indexOf('--shot');
  const onlyShotId = shotArgIndex >= 0 ? process.argv[shotArgIndex + 1] : null;
  if (!onlyShotId) {
    console.error('Usage: node tools/scripts/dreamina-generate.js --shot <shot_id> [--model <model_version>] [--project-dir <dir>]');
    process.exit(1);
  }

  const shotId = `S${String(onlyShotId).replace(/^S/i, '').padStart(3, '0')}`;
  
  // 1. Locate spec file
  const specPath = path.join(workDir, 'prompts', `${shotId}.prompt.json`);
  if (!fs.existsSync(specPath)) {
    console.error(`❌ Prompt specification not found for ${shotId}. Run 'npm run check' first.`);
    process.exit(1);
  }

  const spec = readJson(specPath);
  if (!spec) {
    console.error(`❌ Failed to read prompt spec for ${shotId}`);
    process.exit(1);
  }

  // 2. Resolve parameters
  const prompt = spec.video_prompt || '';
  const negativePrompt = spec.negative_prompt || '';
  
  // Clamp duration to [4, 15] range supported by multimodal2video
  const rawDuration = spec.duration_s || 5;
  const duration = Math.min(15, Math.max(4, Math.round(rawDuration)));

  const modelArgIndex = process.argv.indexOf('--model');
  const model = modelArgIndex >= 0 ? process.argv[modelArgIndex + 1] : 'seedance2.0fast';

  console.log(`🎬 [DreaminaGen] Preparing video generation for ${shotId}:`);
  console.log(`   - Model: ${model}`);
  console.log(`   - Duration: ${duration}s (original: ${rawDuration}s)`);
  console.log(`   - Prompt: ${prompt.slice(0, 80)}...`);

  // 3. Collect reference images from exports package
  const refsDir = path.join(workDir, `exports/seedance_packages/${shotId}/references`);
  const imageArgs = [];
  if (fs.existsSync(refsDir)) {
    const files = fs.readdirSync(refsDir)
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort(); // Context tails are sorted to the front due to name prefix '00_'
    
    for (const f of files) {
      const fullPath = path.join(refsDir, f);
      imageArgs.push('--image', fullPath);
    }
  }

  if (imageArgs.length > 0) {
    console.log(`🖼️  [DreaminaGen] Found ${imageArgs.length / 2} reference image(s) to pass to CLI.`);
  } else {
    console.warn(`⚠️  [DreaminaGen] No packaged reference images found under ${refsDir}. Generating without image conditions.`);
  }

  // 4. Locate dialogue audio
  const audioPath = path.join(workDir, `assets/audio/${shotId}.mp3`);
  const audioArgs = [];
  if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 1024) {
    // Dreamina CLI audio must be between 2 and 15 seconds
    audioArgs.push('--audio', audioPath);
    console.log(`🔊 [DreaminaGen] Found speech audio: ${audioPath}`);
  }

  // 5. Submit multimodal generation task
  const submitArgs = [
    'multimodal2video',
    '--prompt', prompt,
    '--duration', String(duration),
    '--ratio', '16:9',
    '--model_version', model,
    '--poll', '0', // Submit asynchronously, we'll poll ourselves for precise download control
    ...imageArgs,
    ...audioArgs
  ];

  let submitStdout;
  try {
    submitStdout = await runProcess(dreaminaPath, submitArgs);
  } catch (err) {
    console.error(`❌ [DreaminaGen] Submission failed:`, err.message);
    process.exit(1);
  }

  // 6. Parse submit_id and initial status
  let submitId = '';
  let genStatus = '';
  
  // Try parsing as JSON first
  try {
    const json = JSON.parse(submitStdout);
    submitId = json.submit_id || '';
    genStatus = json.gen_status || '';
  } catch {
    // Fallback to regex matching
    const submitIdMatch = submitStdout.match(/submit_id[:=]\s*([a-zA-Z0-9-]+)/i);
    const genStatusMatch = submitStdout.match(/gen_status[:=]\s*([a-zA-Z0-9_]+)/i);
    if (submitIdMatch) submitId = submitIdMatch[1];
    if (genStatusMatch) genStatus = genStatusMatch[1];
  }

  if (!submitId) {
    console.error(`❌ [DreaminaGen] Failed to retrieve submit_id from CLI output. Stderr check required.`);
    process.exit(1);
  }

  console.log(`🚀 [DreaminaGen] Submitted successfully! submit_id: ${submitId}, status: ${genStatus}`);

  // 7. Polling loop
  const tmpDownloadDir = path.join(workDir, '.local/dreamina-tmp');
  ensureDir(tmpDownloadDir);
  
  // Clear any existing mp4 files in tmp download dir
  fs.readdirSync(tmpDownloadDir)
    .filter(f => f.endsWith('.mp4'))
    .forEach(f => fs.rmSync(path.join(tmpDownloadDir, f), { force: true }));

  console.log(`⏳ [DreaminaGen] Polling task status (timeout 180s)...`);
  const maxAttempts = 36; // 36 * 5s = 180s
  let attempt = 0;
  let success = false;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`[DreaminaGen] Poll attempt ${attempt}/${maxAttempts}...`);
    
    let queryStdout;
    try {
      queryStdout = await runProcess(dreaminaPath, [
        'query_result',
        '--submit_id', submitId,
        '--download_dir', tmpDownloadDir
      ]);
    } catch (err) {
      console.warn(`[DreaminaGen] Query failed, will retry:`, err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    let status = '';
    let failReason = '';
    try {
      const json = JSON.parse(queryStdout);
      status = json.gen_status || '';
      failReason = json.fail_reason || '';
    } catch {
      const statusMatch = queryStdout.match(/gen_status[:=]\s*([a-zA-Z0-9_]+)/i);
      if (statusMatch) status = statusMatch[1];
      const failMatch = queryStdout.match(/fail_reason[:=]\s*([^\n]+)/i);
      if (failMatch) failReason = failMatch[1];
    }

    if (status === 'success') {
      console.log(`✅ [DreaminaGen] Generation succeeded!`);
      success = true;
      break;
    } else if (status === 'fail') {
      console.error(`❌ [DreaminaGen] Generation failed on cloud. Reason: ${failReason}`);
      process.exit(1);
    } else {
      console.log(`[DreaminaGen] Current status: ${status || 'querying'}. Waiting 5s...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (!success) {
    console.error(`❌ [DreaminaGen] Timeout waiting for video generation completion.`);
    process.exit(1);
  }

  // 8. Find downloaded mp4 file
  const downloadedFiles = fs.readdirSync(tmpDownloadDir).filter(f => f.endsWith('.mp4'));
  if (downloadedFiles.length === 0) {
    console.error(`❌ [DreaminaGen] Succeeded on cloud but downloaded video file not found in ${tmpDownloadDir}.`);
    process.exit(1);
  }

  const downloadedVideoPath = path.join(tmpDownloadDir, downloadedFiles[0]);
  console.log(`📂 [DreaminaGen] Downloaded video file: ${downloadedVideoPath}`);

  // 9. Execute import-take.js to copy, extract keyframe, and register
  console.log(`🎬 [DreaminaGen] Executing import-take.js for shot ${shotId}...`);
  try {
    const importArgs = [
      'tools/scripts/import-take.js',
      shotId,
      downloadedVideoPath,
      '--platform', `DreaminaCLI-${model}`,
      '--notes', `Automated Dreamina generation (submit_id: ${submitId})`,
      '--project-dir', workDir
    ];
    execSync(`node ${importArgs.join(' ')}`, { stdio: 'inherit' });
    console.log(`🎉 [DreaminaGen] Done! Video imported successfully for ${shotId}.`);
  } catch (err) {
    console.error(`❌ [DreaminaGen] Failed to automatically import video:`, err.message);
    process.exit(1);
  } finally {
    // Clean up temporary download file
    try {
      fs.rmSync(downloadedVideoPath, { force: true });
    } catch {}
  }
}

main().catch(err => {
  console.error(`❌ [DreaminaGen] Fatal error:`, err.message);
  process.exit(2);
});

#!/usr/bin/env node

/**
 * AI Film Studio OS — Headless CLI
 *
 * Usage:
 *   node studio.js <command> [options]
 *
 * Commands:
 *   status                  Project overview + pipeline health
 *   list     [-a|--all]     List all shots (default: finalized only, -a: include drafts)
 *   show     <id>           Show full shot details
 *   edit     <id> <field> <value>   Edit a shot field
 *   promote  <id>           Move draft → finalized (shots_draft/ → shots/)
 *   split    [file]         Parse screenplay → draft shots
 *   validate                Schema validation
 *   lint                    Logic lint (forbidden words, continuity, budget)
 *   build                   Compile prompts from specs
 *   tts      [-a|--all]     Generate TTS audio (-a: include drafts)
 *   render   [id|--all]     Render shot(s) (mock)
 *   fixup                   Process open fixup tickets
 *   pipeline [-a|--all]     Run full pipeline: validate → lint → build → tts → render
 *   play     [-a|--all]     Terminal animatic player (slideshow + timing)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, fork } from 'node:child_process';
import readline from 'node:readline';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const SCRIPTS = path.join(ROOT, 'tools/scripts');

// ─── Helpers ────────────────────────────────────────────────────────────────

function readJson(rel) {
  const p = path.join(ROOT, rel);
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function writeJson(rel, obj) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function listDir(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter(f => f.endsWith('.json')).sort();
}

function loadShot(id) {
  let shot = readJson(`shots/${id}.json`);
  if (shot) return { ...shot, _source: 'shots' };
  shot = readJson(`shots_draft/${id}.json`);
  if (shot) return { ...shot, _source: 'shots_draft' };
  return null;
}

function allShotIds(includeDrafts = false) {
  const ids = [];
  for (const f of listDir('shots')) ids.push(f.replace('.json', ''));
  if (includeDrafts) {
    for (const f of listDir('shots_draft')) {
      const id = f.replace('.json', '');
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids.sort();
}

function runScript(script, args = []) {
  const cmd = `node ${path.join(SCRIPTS, script)} ${args.join(' ')}`;
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function dim(s) { return `\x1b[2m${s}\x1b[0m`; }
function bold(s) { return `\x1b[1m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function red(s) { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function cyan(s) { return `\x1b[36m${s}\x1b[0m`; }
function magenta(s) { return `\x1b[35m${s}\x1b[0m`; }
function blue(s) { return `\x1b[34m${s}\x1b[0m`; }

function hr() { console.log(dim('─'.repeat(60))); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Commands ───────────────────────────────────────────────────────────────

function cmdStatus() {
  const project = readJson('project.json');
  const finalizedShots = listDir('shots');
  const draftShots = listDir('shots_draft');
  const scenes = listDir('scenes');
  const chars = listDir('characters');
  const propFiles = listDir('props');
  const states = listDir('states');
  const fixups = listDir('fixups');
  const promptFiles = listDir('prompts').filter(f => f.endsWith('.final.json'));
  const lintReport = readJson('reports/lint.report.json');

  // Count renders
  let totalTakes = 0;
  const rendersDir = path.join(ROOT, 'renders');
  if (fs.existsSync(rendersDir)) {
    for (const d of fs.readdirSync(rendersDir)) {
      const h = readJson(`renders/${d}/history.json`);
      if (h?.takes) totalTakes += h.takes.length;
    }
  }

  // Audio count
  const audioDir = path.join(ROOT, 'assets/audio');
  const audioFiles = fs.existsSync(audioDir)
    ? fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3')).length : 0;

  console.log();
  console.log(bold(cyan('  AI Film Studio OS — Project Status')));
  hr();

  if (project) {
    console.log(`  ${bold('Project')}: ${project.name} ${dim(`(${project.id})`)}`);
    console.log(`  ${dim(project.description || '')}`);
  } else {
    console.log(yellow('  No project.json found'));
  }
  console.log();

  console.log(bold('  Assets'));
  console.log(`    Scenes      ${cyan(String(scenes.length).padStart(3))}   ${dim(scenes.map(f => f.replace('.json', '')).join(', '))}`);
  console.log(`    Characters  ${cyan(String(chars.length).padStart(3))}   ${dim(chars.map(f => f.replace('.json', '')).join(', '))}`);
  console.log(`    Props       ${cyan(String(propFiles.length).padStart(3))}   ${dim(propFiles.map(f => f.replace('.json', '')).join(', '))}`);
  console.log(`    States      ${cyan(String(states.length).padStart(3))}`);
  console.log();

  console.log(bold('  Shots'));
  console.log(`    Finalized   ${green(String(finalizedShots.length).padStart(3))}   ${dim(finalizedShots.map(f => f.replace('.json', '')).join(', '))}`);
  console.log(`    Drafts      ${yellow(String(draftShots.length).padStart(3))}   ${dim(draftShots.map(f => f.replace('.json', '')).join(', '))}`);
  console.log();

  console.log(bold('  Pipeline'));
  console.log(`    Prompts     ${promptFiles.length > 0 ? green(String(promptFiles.length).padStart(3)) : dim('  0')}   ${dim('compiled .final.json files')}`);
  console.log(`    TTS Audio   ${audioFiles > 0 ? green(String(audioFiles).padStart(3)) : dim('  0')}   ${dim('.mp3 files')}`);
  console.log(`    Renders     ${totalTakes > 0 ? green(String(totalTakes).padStart(3)) : dim('  0')}   ${dim('total takes')}`);
  console.log(`    Fixups      ${cyan(String(fixups.length).padStart(3))}`);
  console.log();

  console.log(bold('  Quality Gate'));
  if (lintReport) {
    const errors = (lintReport.issues || []).filter(i => i.level === 'ERROR').length;
    const warns = (lintReport.issues || []).filter(i => i.level === 'WARN').length;
    if (errors > 0) {
      console.log(`    Lint        ${red(`${errors} ERROR${errors > 1 ? 'S' : ''}`)}  ${warns > 0 ? yellow(`${warns} WARN`) : ''}`);
    } else if (warns > 0) {
      console.log(`    Lint        ${yellow(`${warns} WARN${warns > 1 ? 'S' : ''}`)}  ${dim('no errors')}`);
    } else {
      console.log(`    Lint        ${green('OK')}   ${dim(`last: ${lintReport.generatedAt?.slice(0, 10) || '?'}`)}`);
    }
  } else {
    console.log(`    Lint        ${dim('not run yet')}`);
  }

  // Total duration
  let totalDuration = 0;
  for (const id of allShotIds(true)) {
    const s = loadShot(id);
    if (s) totalDuration += s.duration_s || 0;
  }
  console.log();
  console.log(`  ${dim('Total duration:')} ${bold(totalDuration + 's')} ${dim(`(${(totalDuration / 60).toFixed(1)} min)`)}`);
  console.log();
}

function cmdList(includeAll) {
  const ids = allShotIds(includeAll);

  if (ids.length === 0) {
    console.log(yellow('  No shots found.'));
    return;
  }

  console.log();
  console.log(bold(`  ${'ID'.padEnd(8)} ${'Dur'.padEnd(5)} ${'Tier'.padEnd(10)} ${'Status'.padEnd(12)} ${'Scene'.padEnd(25)} Dialogue`));
  hr();

  for (const id of ids) {
    const shot = loadShot(id);
    if (!shot) continue;
    const isDraft = shot._source === 'shots_draft';
    const scene = (shot.scene_ref || '').replace('scenes/', '').replace('.json', '');
    const dialogue = shot.dialogue ? `"${shot.dialogue.text?.slice(0, 30)}${shot.dialogue.text?.length > 30 ? '...' : ''}"` : dim('—');
    const status = isDraft ? yellow('draft') : green('final');

    console.log(`  ${cyan(id.padEnd(8))} ${String(shot.duration_s || 0).padEnd(5)} ${(shot.budget?.tier || 'standard').padEnd(10)} ${status.padEnd(21)} ${scene.padEnd(25)} ${dialogue}`);
  }
  console.log();
}

function cmdShow(id) {
  const shot = loadShot(id);
  if (!shot) {
    console.log(red(`  Shot ${id} not found.`));
    process.exit(1);
  }

  const isDraft = shot._source === 'shots_draft';

  console.log();
  console.log(bold(cyan(`  Shot: ${id}`)) + (isDraft ? yellow(' [DRAFT]') : green(' [FINALIZED]')));
  hr();

  // Basic info
  console.log(`  ${dim('Duration:')}    ${shot.duration_s}s`);
  console.log(`  ${dim('Scene:')}       ${shot.scene_ref || 'N/A'}`);
  console.log(`  ${dim('Camera:')}      ${shot.cam_setup_ref || 'N/A'}`);
  console.log(`  ${dim('Budget:')}      ${shot.budget?.tier || 'standard'} (max_regen: ${shot.budget?.max_regen ?? 'N/A'})`);

  // Characters
  if (shot.characters?.length > 0) {
    console.log(`  ${dim('Characters:')}  ${shot.characters.map(c => c.ref.replace('characters/', '').replace('.json', '')).join(', ')}`);
  }

  // Props
  if (shot.props?.length > 0) {
    console.log(`  ${dim('Props:')}       ${shot.props.map(p => `${p.ref.replace('props/', '').replace('.json', '')}${p.state ? ` (${p.state})` : ''}`).join(', ')}`);
  }
  console.log();

  // Action beats
  if (shot.action?.beats?.length > 0) {
    console.log(bold('  Action Beats'));
    shot.action.beats.forEach((b, i) => {
      console.log(`    ${dim(`${i + 1}.`)} ${b}`);
    });
    console.log();
  }

  // Dialogue
  if (shot.dialogue) {
    console.log(bold('  Dialogue'));
    console.log(`    ${yellow(shot.dialogue.speaker)}: ${cyan(`"${shot.dialogue.text}"`)}`);
    if (shot.dialogue.voice_id) console.log(`    ${dim(`voice: ${shot.dialogue.voice_id}`)}`);
    console.log();
  }

  // Prompt
  if (shot.prompt) {
    console.log(bold('  Prompt'));
    console.log(`    ${green('+')} ${shot.prompt.positive || 'N/A'}`);
    console.log(`    ${red('−')} ${shot.prompt.negative || 'N/A'}`);
    console.log();
  }

  // Continuity
  if (shot.continuity) {
    console.log(bold('  Continuity'));
    console.log(`    ${dim('state_in:')} ${shot.continuity.state_in_ref || 'none'}`);
    if (shot.continuity.state_changes) {
      console.log(`    ${dim('changes:')}`);
      const changes = shot.continuity.state_changes;
      if (changes.characters) {
        for (const [k, v] of Object.entries(changes.characters)) {
          console.log(`      char ${cyan(k)}: ${JSON.stringify(v)}`);
        }
      }
      if (changes.props) {
        for (const [k, v] of Object.entries(changes.props)) {
          console.log(`      prop ${magenta(k)}: ${JSON.stringify(v)}`);
        }
      }
      if (changes.scene) {
        console.log(`      scene: ${JSON.stringify(changes.scene)}`);
      }
    }
    console.log();
  }

  // Compiled prompt (if exists)
  const finalPrompt = readJson(`prompts/${id}.final.json`);
  if (finalPrompt) {
    console.log(bold('  Compiled Prompt'));
    console.log(`    ${green('+')} ${finalPrompt.positive_text}`);
    console.log(`    ${red('−')} ${finalPrompt.negative_text}`);
    console.log(`    ${dim(`refs: ${finalPrompt.ref_images?.length || 0} images`)}`);
    if (finalPrompt.meta?.validation?.status === 'WARN') {
      console.log(`    ${yellow(`missing: ${finalPrompt.meta.validation.missing_assets?.length || 0} assets`)}`);
    }
    console.log(`    ${dim(`compiler: v${finalPrompt.meta?.compiler_version || '?'}  git: ${finalPrompt.meta?.git_commit || '?'}`)}`);
    console.log();
  }

  // Render history
  const history = readJson(`renders/${id}/history.json`);
  if (history?.takes?.length > 0) {
    console.log(bold(`  Render History (${history.takes.length} takes)`));
    if (history.best_take) console.log(`    ${dim('best:')} ${green(history.best_take)}`);
    for (const take of history.takes) {
      const star = history.best_take === take.take_id ? green('*') : ' ';
      const reviewStr = take.review
        ? ` ${'★'.repeat(take.review.rating || 0)}${'☆'.repeat(5 - (take.review.rating || 0))} ${(take.review.tags || []).join(', ')}`
        : '';
      console.log(`    ${star} ${take.take_id.padEnd(15)} ${(take.status || '').padEnd(8)} model=${take.model || '?'} seed=${take.seed ?? '?'} hash=${take.prompt_hash || '?'} $${take.cost_estimate?.toFixed(2) ?? '?'}${reviewStr}`);
    }
    console.log();
  }

  // Fixups
  const fixupDir = path.join(ROOT, 'fixups');
  if (fs.existsSync(fixupDir)) {
    const fixups = listDir('fixups')
      .map(f => readJson(`fixups/${f}`))
      .filter(f => f && f.target_shot_id === id);

    if (fixups.length > 0) {
      console.log(bold(`  Fixups (${fixups.length})`));
      for (const f of fixups) {
        const statusColor = f.status === 'completed' ? green : f.status === 'open' ? yellow : red;
        console.log(`    ${f.fixup_id.padEnd(18)} ${magenta(f.type.padEnd(12))} ${statusColor(f.status.padEnd(10))} ${f.instruction}`);
      }
      console.log();
    }
  }
}

function cmdEdit(id, field, value) {
  const shot = loadShot(id);
  if (!shot) {
    console.log(red(`  Shot ${id} not found.`));
    process.exit(1);
  }

  const source = shot._source;
  delete shot._source;
  delete shot._file;

  // Parse dotted field paths: "dialogue.text", "action.beats.0", "duration_s"
  const parts = field.split('.');
  let obj = shot;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = isNaN(parts[i]) ? parts[i] : Number(parts[i]);
    if (obj[key] === undefined || obj[key] === null) obj[key] = {};
    obj = obj[key];
  }

  const lastKey = isNaN(parts[parts.length - 1]) ? parts[parts.length - 1] : Number(parts[parts.length - 1]);
  const oldValue = obj[lastKey];

  // Smart type coercion
  let parsed = value;
  if (value === 'true') parsed = true;
  else if (value === 'false') parsed = false;
  else if (value === 'null') parsed = null;
  else if (!isNaN(value) && value !== '') parsed = Number(value);

  obj[lastKey] = parsed;

  writeJson(`${source}/${id}.json`, shot);

  console.log();
  console.log(`  ${green('Updated')} ${cyan(id)} ${dim(`(${source})`)}`);
  console.log(`    ${field}: ${dim(JSON.stringify(oldValue))} → ${bold(JSON.stringify(parsed))}`);
  console.log();
}

function cmdPromote(id) {
  const draftPath = path.join(ROOT, 'shots_draft', `${id}.json`);
  const finalPath = path.join(ROOT, 'shots', `${id}.json`);

  if (!fs.existsSync(draftPath)) {
    if (fs.existsSync(finalPath)) {
      console.log(dim(`  ${id} is already finalized.`));
    } else {
      console.log(red(`  Shot ${id} not found in shots_draft/.`));
    }
    process.exit(1);
  }

  if (fs.existsSync(finalPath)) {
    console.log(yellow(`  Warning: ${id} already exists in shots/. Overwriting.`));
  }

  const shot = readJson(`shots_draft/${id}.json`);
  // Clean up draft metadata
  delete shot._draft_meta;
  delete shot._source;
  delete shot._file;

  writeJson(`shots/${id}.json`, shot);
  fs.unlinkSync(draftPath);

  console.log(green(`  Promoted ${id}: shots_draft/ → shots/`));
}

async function cmdPlay(includeAll) {
  const ids = allShotIds(includeAll);
  const shots = ids.map(id => loadShot(id)).filter(Boolean);

  if (shots.length === 0) {
    console.log(yellow('  No shots to play.'));
    return;
  }

  // Calculate total duration
  const totalDuration = shots.reduce((sum, s) => sum + (s.duration_s || 4), 0);

  console.log();
  console.log(bold(cyan('  ╔════════════════════════════════════════════════╗')));
  console.log(bold(cyan('  ║        AI Film Studio — Animatic Player       ║')));
  console.log(bold(cyan('  ╚════════════════════════════════════════════════╝')));
  console.log(dim(`  ${shots.length} shots • ${totalDuration}s total • Press Ctrl+C to stop`));
  console.log();

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const isDraft = shot._source === 'shots_draft';
    const scene = (shot.scene_ref || '').replace('scenes/', '').replace('.json', '').replace(/_/g, ' ');
    const beats = shot.action?.beats || [];

    // Header
    console.log(dim('  ═'.repeat(30)));
    console.log();
    console.log(`  ${bold(`[${i + 1}/${shots.length}]`)}  ${bold(cyan(shot.shot_id))}${isDraft ? yellow(' DRAFT') : ''}  ${dim(`${shot.duration_s}s`)}`);
    console.log(`  ${dim('scene:')} ${scene}`);
    if (shot.cam_setup_ref) console.log(`  ${dim('cam:')}   ${shot.cam_setup_ref}`);

    // Characters & Props
    const chars = (shot.characters || []).map(c => c.ref.replace('characters/', '').replace('.json', ''));
    const propsList = (shot.props || []).map(p => p.ref.replace('props/', '').replace('.json', ''));
    if (chars.length > 0) console.log(`  ${dim('chars:')} ${blue(chars.join(', '))}`);
    if (propsList.length > 0) console.log(`  ${dim('props:')} ${magenta(propsList.join(', '))}`);
    console.log();

    // Animate beats with timing
    if (beats.length > 0) {
      const beatInterval = (shot.duration_s * 1000) / beats.length;
      for (let b = 0; b < beats.length; b++) {
        console.log(`  ${dim(`${b + 1}.`)} ${beats[b]}`);
        if (b < beats.length - 1 || shot.dialogue) {
          await sleep(beatInterval);
        }
      }
    }

    // Dialogue
    if (shot.dialogue) {
      console.log();
      console.log(`  ${yellow(shot.dialogue.speaker)}: ${cyan(`"${shot.dialogue.text}"`)}`);
    }

    // Wait remaining duration
    if (beats.length === 0) {
      await sleep(shot.duration_s * 1000);
    } else if (!shot.dialogue) {
      // Last beat timing
      const beatInterval = (shot.duration_s * 1000) / beats.length;
      await sleep(beatInterval);
    } else {
      await sleep(1500); // Extra pause for dialogue
    }

    console.log();
  }

  console.log(dim('  ═'.repeat(30)));
  console.log();
  console.log(green('  ▶ Playback complete.'));
  console.log();
}

function cmdPipeline(includeAll) {
  console.log();
  console.log(bold(cyan('  AI Film Studio — Full Pipeline')));
  hr();

  // Step 1: Validate
  console.log(bold('\n  [1/5] Schema Validation'));
  const validateOk = runScript('validate.js');
  if (!validateOk) {
    console.log(red('\n  Pipeline aborted: validation failed.'));
    process.exit(2);
  }

  // Step 2: Lint
  console.log(bold('\n  [2/5] Logic Lint'));
  const lintOk = runScript('lint.js');
  if (!lintOk) {
    console.log(red('\n  Pipeline aborted: lint errors found.'));
    process.exit(2);
  }

  // Step 3: Build Prompts
  console.log(bold('\n  [3/5] Compile Prompts'));
  const buildOk = runScript('build-prompts.js');
  if (!buildOk) {
    console.log(red('\n  Pipeline aborted: prompt compilation failed.'));
    process.exit(2);
  }

  // Step 4: TTS
  console.log(bold('\n  [4/5] TTS Audio Generation'));
  const ttsOk = runScript('gen-tts.js');
  if (!ttsOk) {
    console.log(yellow('\n  TTS generation had issues (non-blocking, continuing).'));
  }

  // Step 5: Render all finalized shots
  console.log(bold('\n  [5/5] Render'));
  const shotIds = allShotIds(false); // Only finalized
  for (const id of shotIds) {
    // Only render if prompt exists
    if (fs.existsSync(path.join(ROOT, `prompts/${id}.final.json`))) {
      runScript('manage-renders.js', [id]);
    }
  }

  console.log();
  hr();
  console.log(green('  Pipeline complete!'));
  console.log();
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const hasFlag = (flag) => args.includes(flag);

switch (command) {
  case 'status':
  case 'st':
    cmdStatus();
    break;

  case 'list':
  case 'ls':
    cmdList(hasFlag('-a') || hasFlag('--all'));
    break;

  case 'show':
    if (!args[1]) { console.log(red('Usage: studio show <shot_id>')); process.exit(1); }
    cmdShow(args[1]);
    break;

  case 'edit':
    if (!args[1] || !args[2] || args[3] === undefined) {
      console.log(red('Usage: studio edit <shot_id> <field> <value>'));
      console.log(dim('  Examples:'));
      console.log(dim('    studio edit S001 duration_s 8'));
      console.log(dim('    studio edit S001 dialogue.text "Hello world"'));
      console.log(dim('    studio edit S001 action.beats.0 "New first beat"'));
      console.log(dim('    studio edit S001 budget.tier standard'));
      process.exit(1);
    }
    cmdEdit(args[1], args[2], args.slice(3).join(' '));
    break;

  case 'promote':
    if (!args[1]) { console.log(red('Usage: studio promote <shot_id>')); process.exit(1); }
    cmdPromote(args[1]);
    break;

  case 'split':
    runScript('script-split.js', args.slice(1));
    break;

  case 'validate':
  case 'val':
    runScript('validate.js');
    break;

  case 'lint':
    runScript('lint.js');
    break;

  case 'build':
    runScript('build-prompts.js');
    break;

  case 'tts':
    runScript('gen-tts.js');
    break;

  case 'render':
    if (args[1] === '--all') {
      for (const id of allShotIds(false)) {
        if (fs.existsSync(path.join(ROOT, `prompts/${id}.final.json`))) {
          runScript('manage-renders.js', [id]);
        }
      }
    } else if (args[1]) {
      runScript('manage-renders.js', [args[1]]);
    } else {
      console.log(red('Usage: studio render <shot_id> | studio render --all'));
      process.exit(1);
    }
    break;

  case 'fixup':
    runScript('process-fixups.js');
    break;

  case 'pipeline':
  case 'pipe':
    cmdPipeline(hasFlag('-a') || hasFlag('--all'));
    break;

  case 'play':
    cmdPlay(hasFlag('-a') || hasFlag('--all'));
    break;

  default:
    console.log();
    console.log(bold(cyan('  AI Film Studio OS — Headless CLI')));
    console.log();
    console.log(bold('  Project'));
    console.log(`    ${cyan('status')}                       Project overview, asset counts, pipeline health`);
    console.log(`    ${cyan('list')}   ${dim('[-a|--all]')}           List shots (add -a to include drafts)`);
    console.log(`    ${cyan('show')}   ${dim('<id>')}                 Show full shot details`);
    console.log();
    console.log(bold('  Editing'));
    console.log(`    ${cyan('edit')}   ${dim('<id> <field> <val>')}   Edit a shot field (dot notation: dialogue.text)`);
    console.log(`    ${cyan('promote')} ${dim('<id>')}                Move draft → finalized`);
    console.log(`    ${cyan('split')}  ${dim('[file]')}               Parse screenplay → draft shots`);
    console.log();
    console.log(bold('  Pipeline'));
    console.log(`    ${cyan('validate')}                     Schema validation`);
    console.log(`    ${cyan('lint')}                         Logic lint (forbidden words, continuity, budget)`);
    console.log(`    ${cyan('build')}                        Compile specs → prompts`);
    console.log(`    ${cyan('tts')}                          Generate TTS audio`);
    console.log(`    ${cyan('render')}  ${dim('<id|--all>')}          Render shot(s)`);
    console.log(`    ${cyan('fixup')}                        Process fixup tickets`);
    console.log(`    ${cyan('pipeline')}                     Run full pipeline: validate → lint → build → tts → render`);
    console.log();
    console.log(bold('  Playback'));
    console.log(`    ${cyan('play')}   ${dim('[-a|--all]')}           Terminal animatic player (timed slideshow)`);
    console.log();
    console.log(dim('  Aliases: status=st, list=ls, validate=val, pipeline=pipe'));
    console.log();
    break;
}

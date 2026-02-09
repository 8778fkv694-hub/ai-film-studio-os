import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function listJson(dir) {
  const abs = path.join(ROOT, dir);
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => ({ file: `${dir}/${f}`, abs: path.join(abs, f), obj: readJson(path.join(abs, f)) }));
}

const shots = listJson('shots');
const scenes = new Map(listJson('scenes').map(x => [x.file.replace('scenes/', ''), x.obj]));
const projectPath = path.join(ROOT, 'project.json');
const project = fs.existsSync(projectPath) ? readJson(projectPath) : null;

const issues = [];
function err(msg, where) { issues.push({ level: 'ERROR', where, msg }); }
function warn(msg, where) { issues.push({ level: 'WARN', where, msg }); }

// Project timeline lint (if project.json exists)
if (project) {
  const shotFiles = new Set(shots.map(s => `shots/${path.basename(s.abs)}`));
  const seenIds = new Set();
  for (const item of (project.timeline || [])) {
    if (seenIds.has(item.shot_id)) warn(`duplicate shot_id in timeline: ${item.shot_id}`, 'project.json');
    seenIds.add(item.shot_id);
    if (!item.shot_file || !shotFiles.has(item.shot_file)) {
      err(`timeline shot_file not found in shots/: ${item.shot_file}`, 'project.json');
    }
  }
}

for (const s of shots) {
  const shot = s.obj;
  const scenePath = shot.scene_ref;
  if (scenePath && scenePath.startsWith('scenes/')) {
    const key = scenePath.replace('scenes/', '');
    const scene = scenes.get(key);
    if (!scene) {
      err(`scene_ref not found: ${scenePath}`, s.file);
      continue;
    }
    // quick lint: forbidden keywords inside prompt.positive
    const pos = shot?.prompt?.positive || '';
    for (const f of (scene.forbidden || [])) {
      if (pos.toLowerCase().includes(String(f).toLowerCase())) {
        warn(`prompt contains scene.forbidden keyword: ${f}`, s.file);
      }
    }
    // cam_setup_ref exists?
    if (shot.cam_setup_ref && scene.cam_setups && !scene.cam_setups[shot.cam_setup_ref]) {
      err(`cam_setup_ref not in scene.cam_setups: ${shot.cam_setup_ref}`, s.file);
    }
  }

  // duration sanity
  if (shot.duration_s > 12 && (shot?.budget?.tier || 'cheap') === 'cheap') {
    warn('cheap pass duration_s > 12s (consider splitting)', s.file);
  }

  // continuity fields sanity
  const continuity = shot?.continuity;
  if (continuity) {
    if (continuity.handoff_to_next && !Array.isArray(continuity.handoff_to_next)) {
      err('continuity.handoff_to_next must be array', s.file);
    }
    // Check state_in_ref existence
    if (continuity.state_in_ref) {
      const statePath = path.join(ROOT, continuity.state_in_ref);
      if (!fs.existsSync(statePath)) {
        err(`state_in_ref file not found: ${continuity.state_in_ref}`, s.file);
      }
    }
  }

  // --- STRONG LINT RULES ---

  const scene = scenes.get(shot.scene_ref.replace('scenes/', ''));
  if (scene) {
    // Rule 1: Anchor Consistency (Warning for now)
    // Check if shot prompt includes scene anchors (implied via build-prompts, but good to check explicit overrides if any)
    // Here we check if the SCENE has anchors, but the SHOT logic might override/ignore them? 
    // Actually build-prompts.js forces them in. 
    // Let's check if the shot explicitly defined 'references' that might conflict or be empty?
    // For now, let's check Forbidden words in the *Shot Spec* fields (positive/negative) if they exist raw.
    
    if (scene.forbidden && Array.isArray(scene.forbidden)) {
      const textsToCheck = [
        shot.prompt?.positive,
        shot.prompt?.negative,
        shot.action?.beats?.join(' ')
      ].filter(Boolean).join(' ').toLowerCase();

      for (const badWord of scene.forbidden) {
        if (textsToCheck.includes(badWord.toLowerCase())) {
          err(`Forbidden word detected: "${badWord}" (banned by scene ${shot.scene_ref})`, s.file);
        }
      }
    }
  } else {
     // Scene ref not found handled by schema validation usually, but good to check logic
     err(`Referenced scene not found in scenes/: ${shot.scene_ref}`, s.file);
  }

  // Rule 2: Budget/Tier Sanity
  if (shot.budget?.tier === 'cheap') {
     // Example constraint: cheap shots shouldn't have > 2 characters to save complexity/tokens? 
     // Or just check max_regen
     if (shot.budget.max_regen > 1) {
       warn(`Cheap tier shot has max_regen > 1 (${shot.budget.max_regen}). Consider lowering for draft.`, s.file);
     }
     if (shot.characters && shot.characters.length > 2) {
       warn(`Cheap tier shot has ${shot.characters.length} characters. Complex scenes might fail in cheap mode.`, s.file);
     }
  }
}

// output report
const report = { generatedAt: new Date().toISOString(), issueCount: issues.length, issues };
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'lint.report.json'), JSON.stringify(report, null, 2));

const errors = issues.filter(x => x.level === 'ERROR');
for (const i of issues) {
  const line = `${i.level}: ${i.where} :: ${i.msg}`;
  console.log(line);
}

if (errors.length) {
  console.error(`lint: failed (${errors.length} errors)`);
  process.exit(2);
} else {
  console.log('lint: ok');
  process.exit(0);
}

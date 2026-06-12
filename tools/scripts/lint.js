import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from './shared/dirs.js';
import { compileBlocking, sideOfLine, angleAtPivot, dist } from './shared/blocking.js';

const { workDir, projectRoot, remainingArgs } = parseArgs();

let maxWarns = Infinity;
let maxInfos = Infinity;

for (let i = 0; i < remainingArgs.length; i++) {
  const arg = remainingArgs[i];
  if (arg === '--max-warns' && i + 1 < remainingArgs.length) {
    maxWarns = parseInt(remainingArgs[i + 1], 10);
    i++;
  } else if (arg === '--max-infos' && i + 1 < remainingArgs.length) {
    maxInfos = parseInt(remainingArgs[i + 1], 10);
    i++;
  }
}

if (process.env.AFSOS_LINT_MAX_WARNS !== undefined) {
  maxWarns = parseInt(process.env.AFSOS_LINT_MAX_WARNS, 10);
}
if (process.env.AFSOS_LINT_MAX_INFOS !== undefined) {
  maxInfos = parseInt(process.env.AFSOS_LINT_MAX_INFOS, 10);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function listJson(dir) {
  const abs = path.join(workDir, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => ({ file: `${dir}/${f}`, abs: path.join(abs, f), obj: readJson(path.join(abs, f)) }));
}

const shots = listJson('shots');
const parentShotIds = new Set(shots.map(s => s.obj.parent_shot_id).filter(Boolean));
const scenes = new Map(listJson('scenes').map(x => [x.file.replace('scenes/', ''), x.obj]));
const characters = new Map(listJson('characters').map(x => [x.file, x.obj]));
const props = new Map(listJson('props').map(x => [x.file, x.obj]));
const projectPath = path.join(workDir, 'project.json');
const project = fs.existsSync(projectPath) ? readJson(projectPath) : null;
const timelineShotIds = new Set((project?.timeline || []).map(item => item.shot_id).filter(Boolean));

const issues = [];
function err(msg, where) { issues.push({ level: 'ERROR', where, msg }); }
function warn(msg, where) { issues.push({ level: 'WARN', where, msg }); }
function info(msg, where) { issues.push({ level: 'INFO', where, msg }); }

function fileExistsWithImageExtFallback(relPath) {
  const exactPath = path.join(workDir, relPath);
  if (fs.existsSync(exactPath)) return true;

  const ext = path.extname(relPath);
  if (!ext) return false;

  const dir = path.join(workDir, path.dirname(relPath));
  const base = path.basename(relPath, ext);
  if (!fs.existsSync(dir)) return false;

  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  if (!imageExts.has(ext.toLowerCase())) return false;

  return fs.readdirSync(dir).some(file => (
    path.basename(file, path.extname(file)) === base &&
    imageExts.has(path.extname(file).toLowerCase())
  ));
}

function isPendingTimelineContextRef(relPath) {
  const ref = String(relPath).trim();
  // 裸镜头号：指向时间线内某镜（通常是前一镜）做连续性衔接，关键帧尚未生成——属正常待生成状态，非错误
  if (timelineShotIds.has(ref)) return true;
  // 路径形式 assets/renders/<id>/keyframes/...：同样当 <id> 在时间线内时视为待生成
  const match = ref.match(/^assets\/renders\/([A-Za-z0-9_-]+)\/keyframes\//);
  return Boolean(match && timelineShotIds.has(match[1]));
}

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

  for (const item of shot.characters || []) {
    const ref = item.ref || '';
    if (!ref) {
      err('character ref missing', s.file);
    } else if (String(ref).startsWith('TODO:')) {
      warn(`character ref is placeholder: ${ref}`, s.file);
    } else if (!characters.has(ref) && !fs.existsSync(path.join(workDir, ref))) {
      err(`character ref not found: ${ref}`, s.file);
    }
  }

  for (const item of shot.props || []) {
    const ref = item.ref || '';
    if (!ref) {
      err('prop ref missing', s.file);
    } else if (String(ref).startsWith('TODO:')) {
      warn(`prop ref is placeholder: ${ref}`, s.file);
    } else if (!props.has(ref) && !fs.existsSync(path.join(workDir, ref))) {
      err(`prop ref not found: ${ref}`, s.file);
    }
  }

  for (const ref of shot.context_refs || []) {
    if (typeof ref !== 'string' || !ref.trim()) continue;
    if (!fileExistsWithImageExtFallback(ref)) {
      if (isPendingTimelineContextRef(ref)) {
        info(`context_ref pending generated keyframe: ${ref}`, s.file);
      } else {
        warn(`context_ref not found: ${ref}`, s.file);
      }
    }
  }

  // --- BLOCKING (spatial) per-shot checks ---
  if (shot.blocking && Array.isArray(shot.blocking.entities)) {
    const entities = shot.blocking.entities;
    const refSet = new Set(entities.map(e => e.ref));
    // Rule: gaze_target must be 'camera' or resolve to another entity in this shot
    for (const e of entities) {
      if (!e.gaze_target || e.gaze_target === 'camera') continue;
      if (!refSet.has(e.gaze_target)) {
        warn(`blocking gaze_target not found among shot entities: "${e.gaze_target}" (on ${e.ref})`, s.file);
      }
    }
    // Rule: if a camera is defined, at least one entity should fall inside the frustum
    const cam = shot.blocking.camera;
    if (cam && typeof cam.x === 'number' && typeof cam.y === 'number' && entities.length) {
      const r = compileBlocking(shot.blocking, {});
      if (r.visibleEntities.length === 0) {
        warn('blocking: all entities fall outside the camera frustum (widen lens or move camera)', s.file);
      }
    }
  }

  // duration and budget sanity
  if ((shot?.budget?.tier || 'cheap') === 'cheap') {
    if (shot.duration_s > 12 && !parentShotIds.has(shot.shot_id)) {
      warn('cheap pass duration_s > 12s (consider splitting)', s.file);
    }
    if (shot?.budget?.max_regen > 1) {
      warn(`cheap budget tier should not have max_regen > 1 (found ${shot.budget.max_regen})`, s.file);
    }
    if ((shot.characters || []).length > 3) {
      warn(`cheap budget tier should avoid too many characters (found ${(shot.characters || []).length}, max recommended is 3)`, s.file);
    }
    const expensiveCamTerms = ['crane', 'drone', 'helicopter', 'underwater', 'bullet time', 'bullet-time', 'aerial', '3d tracking'];
    const camSetup = String(shot.cam_setup_ref || '').toLowerCase();
    const promptPos = String(shot.prompt?.positive || '').toLowerCase();
    const hasExpensiveCam = expensiveCamTerms.some(term => camSetup.includes(term) || promptPos.includes(term));
    if (hasExpensiveCam) {
      warn(`cheap budget tier should avoid expensive camera setups/movements (ref: "${shot.cam_setup_ref}")`, s.file);
    }
  }

  // continuity fields sanity
  const continuity = shot?.continuity;
  if (continuity) {
    if (continuity.handoff_to_next && !Array.isArray(continuity.handoff_to_next)) {
      err('continuity.handoff_to_next must be array', s.file);
    }
    // Check state_in_ref existence
    if (continuity.state_in_ref) {
      const statePath = path.join(workDir, continuity.state_in_ref);
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
     const isTodo = String(shot.scene_ref || '').startsWith('TODO:');
     if (isTodo) {
       warn(`Scene ref is placeholder: ${shot.scene_ref}. Create scenes/ or edit shot to fix.`, s.file);
     } else {
       err(`Referenced scene not found in scenes/: ${shot.scene_ref}`, s.file);
     }
   }

  // Rule 3: Anchor Consistency (Project-wide)
  // Check if multiple shots refer to the same scene but use different effective anchors?
  // Actually, anchors are defined in the SCENE spec, and built into the prompt by build-prompts.js.
  // So unless the SHOT overrides references, they should be consistent by definition.
  // BUT, if the shot explicitly DEFINES 'references' (overriding scene), we must warn.
  if (shot.references && shot.references.images && shot.references.images.length > 0) {
     // This means the shot is trying to add/override references manually.
     // We should check if it *includes* the scene anchors.
      if (scene && scene.anchors && scene.anchors.length > 0) {
       const sceneAnchorPaths = scene.anchors.map(a => a.img);
       const shotRefPaths = shot.references.images;
       
       const missingAnchors = sceneAnchorPaths.filter(a => !shotRefPaths.includes(a));
       if (missingAnchors.length > 0) {
         warn(`Shot defines custom references but misses scene anchors: ${missingAnchors.join(', ')}. Scene consistency at risk.`, s.file);
       }
     }
  }
}

// --- BLOCKING (spatial) cross-shot continuity checks ---
{
  // Order shots by timeline when available, else by filename.
  const byFile = new Map(shots.map(s => [`shots/${path.basename(s.abs)}`, s]));
  let ordered;
  if (project?.timeline?.length) {
    ordered = project.timeline.map(t => byFile.get(t.shot_file)).filter(Boolean);
  } else {
    ordered = shots;
  }

  const camPos = b => (b?.camera && typeof b.camera.x === 'number' && typeof b.camera.y === 'number')
    ? { x: b.camera.x, y: b.camera.y } : null;
  const entMap = b => new Map((b?.entities || [])
    .filter(e => typeof e.x === 'number' && typeof e.y === 'number')
    .map(e => [e.ref, { x: e.x, y: e.y }]));
  const resolveAxisEndpoint = (token, b) => {
    const t = String(token).trim().toLowerCase();
    for (const e of b?.entities || []) {
      const ref = String(e.ref).toLowerCase();
      if (ref.includes(t) || ref.replace(/^(prop|fixture):/, '').includes(t)) {
        return { x: e.x, y: e.y };
      }
    }
    return null;
  };

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1].obj, cur = ordered[i].obj;
    const bp = prev.blocking, bc = cur.blocking;
    if (!bp || !bc) continue;
    const camP = camPos(bp), camC = camPos(bc);
    const where = ordered[i].file;

    // Rule: 180-degree axis crossing (shared axis_lock)
    if (camP && camC && bp.axis_lock && bp.axis_lock === bc.axis_lock) {
      const toks = String(bp.axis_lock).split(/[-|/]/).map(t => t.trim()).filter(Boolean);
      if (toks.length === 2) {
        const a1 = resolveAxisEndpoint(toks[0], bp), a2 = resolveAxisEndpoint(toks[1], bp);
        const c1 = resolveAxisEndpoint(toks[0], bc), c2 = resolveAxisEndpoint(toks[1], bc);
        if (a1 && a2 && c1 && c2) {
          const sPrev = sideOfLine(camP, a1, a2);
          const sCur = sideOfLine(camC, c1, c2);
          if (sPrev !== 0 && sCur !== 0 && sPrev !== sCur) {
            warn(`crosses 180° action axis (${bp.axis_lock}) vs ${ordered[i - 1].file}; screen left/right will flip`, where);
          }
        }
      }
    }

    // Rule: 30-degree rule (same scene, shared subject, near-identical angle)
    if (camP && camC && prev.scene_ref === cur.scene_ref) {
      const mp = entMap(bp), mc = entMap(bc);
      const shared = [...mp.keys()].find(k => mc.has(k));
      const sizeSame = String(bp.camera.shot_size || '') === String(bc.camera.shot_size || '');
      if (shared && sizeSame) {
        const ang = angleAtPivot(mp.get(shared), camP, camC);
        if (ang < 30) {
          warn(`<30° camera move on same subject vs ${ordered[i - 1].file} (${ang.toFixed(0)}°), same shot size — risks a jump cut`, where);
        }
      }
    }

    // Rule: teleport (shared entity jumps far with no motion bridging it)
    {
      const mp = entMap(bp), mc = entMap(bc);
      const motionWho = new Set((bc.motion || []).map(m => m.who));
      for (const [ref, pPrev] of mp) {
        const pCur = mc.get(ref);
        if (!pCur) continue;
        if (dist(pPrev, pCur) > 40 && !motionWho.has(ref)) {
          warn(`entity "${ref}" jumps far from ${ordered[i - 1].file} with no motion bridging it (possible teleport)`, where);
        }
      }
    }
  }
}

// Run build-state-chain.js to update the continuity check report
try {
  execFileSync('node', [path.join(projectRoot, 'tools/scripts/build-state-chain.js'), '--project-dir', workDir], { stdio: 'ignore' });
  const stateReportPath = path.join(workDir, 'reports', 'state-chain.report.json');
  if (fs.existsSync(stateReportPath)) {
    const stateReport = JSON.parse(fs.readFileSync(stateReportPath, 'utf-8'));
    for (const iss of (stateReport.issues || [])) {
      issues.push({
        level: iss.level,
        where: `states/continuity (${iss.shot_id})`,
        msg: `${iss.code}: ${iss.message}`
      });
    }
  }
} catch (e) {
  console.warn('⚠️  Could not run build-state-chain.js:', e.message);
}

// output report
const report = { generatedAt: new Date().toISOString(), issueCount: issues.length, issues };
fs.mkdirSync(path.join(workDir, 'reports'), { recursive: true });
fs.writeFileSync(path.join(workDir, 'reports', 'lint.report.json'), JSON.stringify(report, null, 2));

const errors = issues.filter(x => x.level === 'ERROR');
const warnings = issues.filter(x => x.level === 'WARN');
const infos = issues.filter(x => x.level === 'INFO');

for (const i of issues) {
  const line = `${i.level}: ${i.where} :: ${i.msg}`;
  console.log(line);
}

let failed = false;
let failMsg = '';

if (errors.length > 0) {
  failed = true;
  failMsg = `failed (${errors.length} errors)`;
} else if (warnings.length > maxWarns) {
  failed = true;
  failMsg = `failed (warnings count ${warnings.length} > threshold ${maxWarns})`;
} else if (infos.length > maxInfos) {
  failed = true;
  failMsg = `failed (infos count ${infos.length} > threshold ${maxInfos})`;
}

if (failed) {
  console.error(`lint: ${failMsg}`);
  process.exit(2);
} else {
  console.log('lint: ok');
  process.exit(0);
}

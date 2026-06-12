import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { loadTemplate, renderTemplate, loadRules, applyRules, joinSentences, joinList, clean } from './shared/template-engine.js';
import { parseArgs } from './shared/dirs.js';
import { compileBlocking } from './shared/blocking.js';

const { workDir, projectRoot, remainingArgs } = parseArgs();
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

// Optional global spatial-mode override: --spatial lock|guide|off (overrides per-shot blocking.mode)
const spatialIdx = remainingArgs.indexOf('--spatial');
const SPATIAL_OVERRIDE = spatialIdx >= 0 ? remainingArgs[spatialIdx + 1] : null;

function readJson(rel) {
  const projectPath = path.join(workDir, rel);
  if (fs.existsSync(projectPath)) {
    try { return JSON.parse(fs.readFileSync(projectPath, 'utf-8')); } catch { return null; }
  }
  const globalPath = path.join(projectRoot, rel);
  try {
    return JSON.parse(fs.readFileSync(globalPath, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureDir(rel) {
  fs.mkdirSync(path.join(workDir, rel), { recursive: true });
}

function splitPromptItems(items) {
  return (items || [])
    .flatMap(item => String(item || '').split(/[;,]/))
    .map(clean)
    .filter(Boolean);
}

function normalizeNegativeItem(item) {
  return clean(item).replace(/^no\s+/i, '');
}

function formatStateNotes(stateChanges) {
  if (!stateChanges) return '';

  const notes = [];

  for (const [id, state] of Object.entries(stateChanges.characters || {})) {
    const details = Object.entries(state || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (details) notes.push(`${id} (${details})`);
  }

  for (const [id, state] of Object.entries(stateChanges.props || {})) {
    const details = Object.entries(state || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (details) notes.push(`${id} (${details})`);
  }

  const sceneNotes = Object.entries(stateChanges.scene || {})
    .filter(([key]) => key !== 'lighting')
    .map(([key, value]) => `${key}: ${value}`);
  notes.push(...sceneNotes);

  return notes.length ? `continuity locks: ${notes.join('; ')}` : '';
}

function csvCell(value) {
  const s = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: workDir, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function listExistingKeyframes(shotId) {
  const dir = path.join(workDir, 'assets/renders', shotId, 'keyframes');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(file => IMAGE_EXTS.has(path.extname(file).toLowerCase()))
    .sort()
    .map(file => `assets/renders/${shotId}/keyframes/${file}`);
}

function resolveImageRef(ref) {
  const exactPath = path.join(workDir, ref);
  if (fs.existsSync(exactPath)) return ref;

  const ext = path.extname(ref);
  if (!ext) return null;

  const base = ref.slice(0, -ext.length);
  for (const candidateExt of IMAGE_EXTS) {
    const candidate = `${base}${candidateExt}`;
    if (fs.existsSync(path.join(workDir, candidate))) return candidate;
  }

  return null;
}

function collectReferences(scene, characters, props) {
  const refs = [];

  for (const anchor of scene.anchors || []) {
    refs.push({
      kind: 'scene_anchor',
      id: anchor.id,
      path: anchor.img,
      note: anchor.note || '',
      use_for: anchor.use_for || [],
      exists: fs.existsSync(path.join(workDir, anchor.img))
    });
  }

  for (const character of characters) {
    for (const img of character.references?.images || []) {
      refs.push({
        kind: 'character_reference',
        id: character.id,
        path: img,
        note: character.name || character.id,
        use_for: ['identity', 'wardrobe'],
        exists: fs.existsSync(path.join(workDir, img))
      });
    }
  }

  for (const prop of props) {
    for (const img of prop.references?.images || []) {
      refs.push({
        kind: 'prop_reference',
        id: prop.id,
        path: img,
        note: prop.name || prop.id,
        use_for: ['prop lock'],
        exists: fs.existsSync(path.join(workDir, img))
      });
    }
  }

  return refs;
}

function characterLock(character) {
  const mustKeep = character.must_keep || {};
  return [
    `character lock: ${character.name || character.id} (${character.id})`,
    mustKeep.hair ? `hair: ${mustKeep.hair}` : '',
    mustKeep.outfit ? `outfit: ${mustKeep.outfit}` : '',
    mustKeep.accessories?.length ? `accessories: ${mustKeep.accessories.join(' + ')}` : ''
  ].filter(Boolean).join(', ');
}

function propLock(prop, shotProp) {
  return [
    `prop lock: ${prop.name || prop.id} (${prop.id})`,
    shotProp?.state ? `state: ${shotProp.state}` : '',
    prop.must_keep ? 'must remain visually consistent' : ''
  ].filter(Boolean).join(', ');
}

/**
 * Resolve full parent context for split shots.
 * Prefers inline parent_context, falls back to reading shots_archived.
 */
function resolveParentContext(shot) {
  if (!shot.parent_shot_id) return null;
  // Prefer inline parent_context stored during split
  if (shot.parent_context) return shot.parent_context;
  // Fallback: read from shots_archived
  const archived = readJson(`shots_archived/${shot.parent_shot_id}.json`);
  if (!archived) return null;
  return {
    voiceover_full: archived.voiceover?.text || null,
    dialogue_full: archived.dialogue?.text || null,
    action_beats_full: archived.action?.beats || []
  };
}

/**
 * Build a ref -> display-label resolver for blocking entities/gaze targets.
 * Handles character/prop ref paths, "prop:<id>" forms, and scene fixtures.
 */
function makeLabelFor(shot, scene) {
  const map = new Map();

  for (const item of shot.characters || []) {
    if (!item.ref) continue;
    const obj = readJson(item.ref);
    const label = obj?.name || obj?.id;
    if (label) map.set(item.ref, label);
  }

  for (const item of shot.props || []) {
    if (!item.ref) continue;
    const obj = readJson(item.ref);
    const label = obj?.name || obj?.id;
    if (!label) continue;
    map.set(item.ref, label);
    const idMatch = item.ref.match(/([^/]+)\.json$/);
    if (idMatch) map.set(`prop:${idMatch[1]}`, label);
  }

  for (const f of scene?.floorplan?.fixtures || []) {
    map.set(`fixture:${f.id}`, f.label || f.id);
  }

  return ref => map.get(ref)
    || String(ref || '').replace(/^(prop|fixture):/, '').replace(/\.json$/, '').split('/').pop();
}

function compileImagePrompt(shotFile, gitHash) {
  const shot = readJson(`shots/${shotFile}`);
  const scene = readJson(shot.scene_ref);
  const style = shot.style_ref ? readJson(shot.style_ref) : (scene.style_ref ? readJson(scene.style_ref) : null);
  const characters = (shot.characters || []).map(item => readJson(item.ref)).filter(Boolean);
  const props = (shot.props || []).map(item => readJson(item.ref)).filter(Boolean);
  const references = collectReferences(scene, characters, props);
  const missingAssets = references.filter(ref => !ref.exists).map(ref => ref.path);
  const existingKeyframes = listExistingKeyframes(shot.shot_id);

  // Shot-to-shot visual continuity (StoryGen approach)
  const contextRefs = (shot.context_refs || [])
    .filter(ref => typeof ref === 'string' && ref.trim());
  const resolvedContextRefs = contextRefs
    .map(ref => ({ declared: ref, resolved: resolveImageRef(ref) }));
  const availableContextRefs = resolvedContextRefs
    .filter(ref => ref.resolved)
    .map(ref => ref.resolved);
  const missingContextRefs = contextRefs
    .filter(ref => !resolveImageRef(ref));

  const contextContinuity = availableContextRefs.length > 0
    ? `Shot-to-shot continuity: maintain exact character identity, scene layout, lighting and prop positions from previous shot. Visual style must match preceding frame.`
    : '';

  const master = [
    'photorealistic cinematic storyboard keyframe',
    'aspect ratio 16:9, horizontal composition',
    'single static frame for a voiced comic animatic',
    '8K resolution, highly detailed, sharp focus',
    'professional industrial photography lighting',
    style?.name ? `visual style: ${style.name}` : '',
    style?.mood_keywords?.length ? `mood: ${style.mood_keywords.join(', ')}` : '',
    style?.palette?.length ? `color palette: ${style.palette.join(', ')}` : '',
    'stable character identity across all shots',
    'consistent environment layout and prop continuity',
    'clean frame, no captions, no watermark, no user interface, no text overlay',
    'natural camera angle, avoid extreme distortion'
  ];

  const scenePrompt = [
    `scene: ${scene.name || scene.id}`,
    scene.must_keep?.set_elements?.length ? `must keep set elements: ${scene.must_keep.set_elements.join(', ')}` : '',
    scene.must_keep?.lighting ? `lighting: ${scene.must_keep.lighting}` : '',
    scene.anchors?.length ? `match scene anchors: ${scene.anchors.map(a => `${a.id} ${a.note || ''}`.trim()).join('; ')}` : ''
  ];

  const characterPrompt = characters.map(characterLock);
  const propPrompt = props.map((prop, index) => {
    const shotProp = shot.props?.find(p => p.ref && p.ref.endsWith(`/${prop.id}.json`)) || shot.props?.[index];
    return propLock(prop, shotProp);
  });
  const continuityNotes = formatStateNotes(shot.continuity?.state_changes);

  // Resolve parent context for split shots
  const parentCtx = resolveParentContext(shot);
  const isSplitShot = !!parentCtx;

  // Spatial blocking -> spatial/camera clauses + visibility (optional, backward compatible)
  const blockingResult = shot.blocking
    ? compileBlocking(shot.blocking, {
        labelFor: makeLabelFor(shot, scene),
        fixtures: shot.blocking.floorplan_ref ? (scene.floorplan?.fixtures || []) : [],
        mode: SPATIAL_OVERRIDE
      })
    : null;
  // mode-shaped injection (lock=hard / guide=soft / off=nothing)
  const imagePromptSpace = blockingResult?.inject.space || '';
  const imagePromptCamera = blockingResult?.inject.camera || '';

  const shotPrompt = [
    `shot ${shot.shot_id}`,
    shot.cam_setup_ref ? `camera intent: ${shot.cam_setup_ref}` : '',
    // Full parent action beats (for split shots where local beats may be empty)
    isSplitShot && parentCtx.action_beats_full?.length
      ? `full action sequence: ${parentCtx.action_beats_full.join('; ')}` : '',
    // Local segment action beats
    shot.action?.beats?.length ? `action beats: ${shot.action.beats.join('; ')}` : '',
    // Full parent voiceover context + segment-specific narration
    isSplitShot && parentCtx.voiceover_full
      ? `scene narration (full context, segment ${shot.segment_index}/${shot.segment_count}): ${shot.voiceover?.speaker || 'Narrator'} explains "${parentCtx.voiceover_full}"` : '',
    shot.voiceover?.text
      ? (isSplitShot
        ? `this segment narration: "${shot.voiceover.text}"`
        : `narration intent: ${shot.voiceover.speaker || 'Narrator'} explains "${shot.voiceover.text}"`) : '',
    // Full parent dialogue context + segment-specific dialogue
    isSplitShot && parentCtx.dialogue_full
      ? `scene dialogue (full context): "${parentCtx.dialogue_full}"` : '',
    shot.dialogue?.text
      ? (isSplitShot
        ? `this segment dialogue: ${shot.dialogue.speaker || 'speaker'} says "${shot.dialogue.text}"`
        : `dialogue mood: ${shot.dialogue.speaker || 'speaker'} says "${shot.dialogue.text}"`) : '',
    continuityNotes,
    contextContinuity,
    shot.prompt?.positive ? `shot positive notes: ${shot.prompt.positive}` : ''
  ];

  const negative = [
    ...(style?.forbidden || []),
    ...(scene.forbidden || []),
    ...splitPromptItems([shot.prompt?.negative]),
    'face drift',
    'outfit change',
    'prop drift',
    'wrong set layout',
    'extra fingers',
    'text artifacts',
    'subtitles burned into image',
    'logo',
    'watermark'
  ];

  const imagePromptMaster = joinSentences(master);
  const imagePromptScene = joinSentences(scenePrompt);
  const imagePromptCharacters = joinSentences(characterPrompt);
  const imagePromptProps = joinSentences(propPrompt);
  const imagePromptShot = joinSentences(shotPrompt);
  const negativePrompt = joinList([
    ...new Set(negative.map(normalizeNegativeItem).filter(Boolean))
  ]);

  const imagePromptFinal = joinSentences([
    imagePromptMaster,
    imagePromptScene,
    imagePromptCharacters,
    imagePromptProps,
    imagePromptShot,
    imagePromptSpace,
    imagePromptCamera
  ]);

  return {
    shot_id: shot.shot_id,
    task_type: 'keyframe_image',
    language: 'en',
    system_prompt_ref: 'exports/project-system-prompt.txt',
    workflow: {
      tool_instructions: "IMPORTANT: Before generating, load the project system prompt from 'system_prompt_ref' as context. Then use this shot's prompt for generation."
    },
    image_prompt_master: imagePromptMaster,
    image_prompt_scene: imagePromptScene,
    image_prompt_characters: imagePromptCharacters,
    image_prompt_props: imagePromptProps,
    image_prompt_shot: imagePromptShot,
    image_prompt_space: imagePromptSpace,
    image_prompt_camera: imagePromptCamera,
    image_prompt_final: imagePromptFinal,
    negative_prompt: negativePrompt,
    visible_entities: blockingResult?.visibleEntities || [],
    blocking_mode: blockingResult?.mode || null,
    blocking_warnings: blockingResult?.warnings || [],
    continuity_notes: continuityNotes,
    reference_images: references,
    context_refs: {
      declared: contextRefs,
      available: availableContextRefs,
      missing: missingContextRefs
    },
    duration_s: shot.duration_s,
    voiceover: shot.voiceover || null,
    dialogue: shot.dialogue || null,
    parent_context: parentCtx || null,
    camera_intent: shot.cam_setup_ref || null,
    continuity: {
      state_in_ref: shot.continuity?.state_in_ref || null,
      state_changes: shot.continuity?.state_changes || null,
      must_match_prev: shot.continuity?.must_match_prev || [],
      handoff_to_next: shot.continuity?.handoff_to_next || []
    },
    manual_workflow: {
      external_generation: 'paste image_prompt_final and negative_prompt into any web image/video tool; upload reference_images when supported',
      keyframe_dir: `assets/renders/${shot.shot_id}/keyframes`,
      expected_files: ['frame_01.jpg', 'frame_02.jpg', 'frame_03.jpg'],
      existing_keyframes: existingKeyframes,
      context_keyframes: availableContextRefs,
      context_hint: availableContextRefs.length > 0
        ? 'Use context_keyframes as visual reference to maintain shot-to-shot continuity with previous shot.'
        : null
    },
    validation: {
      missing_assets: missingAssets,
      missing_context_refs: missingContextRefs,
      status: missingAssets.length || missingContextRefs.length ? 'WARN' : 'OK'
    },
    meta: {
      compiler_version: 'image-prompts-1.0.0',
      git_commit: gitHash,
      compiled_at: new Date().toISOString(),
      compiled_from: {
        shot: `shots/${shotFile}`,
        scene: shot.scene_ref,
        style: style ? (shot.style_ref || scene.style_ref) : null,
        characters: (shot.characters || []).map(c => c.ref),
        props: (shot.props || []).map(p => p.ref)
      }
    }
  };
}

function writeStoryboardExports(packages) {
  ensureDir('exports');

  const csvRows = [
    ['shot_id', 'duration_s', 'dialogue', 'image_prompt_final', 'negative_prompt', 'reference_images', 'keyframe_dir']
      .map(csvCell).join(',')
  ];

  const md = [
    '# Storyboard Image Prompt Pack',
    '',
    'Use these packages with web image/video tools, then save chosen keyframes back into the listed keyframe directories.',
    ''
  ];

  for (const pkg of packages) {
    const refPaths = pkg.reference_images.map(ref => ref.path);
    csvRows.push([
      pkg.shot_id,
      pkg.duration_s,
      pkg.dialogue?.text || '',
      pkg.image_prompt_final,
      pkg.negative_prompt,
      refPaths,
      pkg.manual_workflow.keyframe_dir
    ].map(csvCell).join(','));

    md.push(
      `## ${pkg.shot_id}`,
      '',
      `Duration: ${pkg.duration_s}s`,
      '',
      pkg.dialogue?.text ? `Dialogue: ${pkg.dialogue.speaker}: ${pkg.dialogue.text}` : 'Dialogue: none',
      '',
      'Prompt:',
      '',
      '```text',
      pkg.image_prompt_final,
      '```',
      '',
      'Negative:',
      '',
      '```text',
      pkg.negative_prompt,
      '```',
      '',
      `Keyframe dir: \`${pkg.manual_workflow.keyframe_dir}\``,
      ''
    );
  }

  fs.writeFileSync(path.join(workDir, 'exports/storyboard.csv'), csvRows.join('\n'));
  fs.writeFileSync(path.join(workDir, 'exports/storyboard.md'), md.join('\n'));
}

function main() {
  ensureDir('prompts/image');
  const shotsDir = path.join(workDir, 'shots');
  const shotFiles = fs.readdirSync(shotsDir).filter(file => file.endsWith('.json')).sort();
  const gitHash = getGitHash();
  const packages = [];
  let missingCount = 0;

  console.log(`[ImagePrompts] Compiling ${shotFiles.length} image prompt packages (Commit: ${gitHash})...`);

  // Clean up orphaned image prompt files in prompts/image
  const promptsImgDir = path.join(workDir, 'prompts/image');
  if (fs.existsSync(promptsImgDir)) {
    const activeShotIds = new Set(shotFiles.map(f => f.replace('.json', '')));
    const files = fs.readdirSync(promptsImgDir);
    for (const file of files) {
      if (file.endsWith('.image.json')) {
        const shotId = file.replace('.image.json', '');
        if (!activeShotIds.has(shotId)) {
          fs.unlinkSync(path.join(promptsImgDir, file));
          console.log(`[ImagePrompts] Cleaned up orphaned prompt: prompts/image/${file}`);
        }
      }
    }
  }

  for (const shotFile of shotFiles) {
    const pkg = compileImagePrompt(shotFile, gitHash);
    fs.writeFileSync(
      path.join(workDir, 'prompts/image', `${pkg.shot_id}.image.json`),
      JSON.stringify(pkg, null, 2)
    );

    if (pkg.validation.missing_assets.length) {
      missingCount += pkg.validation.missing_assets.length;
      console.log(`[WARN] ${pkg.shot_id} missing ${pkg.validation.missing_assets.length} reference assets.`);
    }

    packages.push(pkg);
    console.log(`[ImagePrompts] ${pkg.shot_id} -> prompts/image/${pkg.shot_id}.image.json`);
  }

  writeStoryboardExports(packages);
  console.log(`[ImagePrompts] Wrote exports/storyboard.csv and exports/storyboard.md.`);
  console.log(`[ImagePrompts] Completed (${packages.length} shots, ${missingCount} missing reference assets).`);
}

main();

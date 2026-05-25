import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);

const CAMERA_MOTION = {
  'comic_panel_01': 'static wide establishing shot, slow dolly in from medium to close-up',
  'comic_panel_02': 'medium shot, subtle hand-held camera feel, focus on subject action',
  'comic_panel_03': 'tight close-up, shallow depth of field, subtle breathing camera drift',
  'comic_panel_04': 'detail insert shot, smooth focus pull, macro lens feel, very slight movement',
  'comic_panel_05': 'over-the-shoulder shot, slow rack focus between subjects',
  'comic_panel_06': 'low angle shot, slight upward tilt, dramatic perspective',
  'comic_panel_07': 'high angle shot, downward perspective, surveillance or top-down feel',
  'comic_panel_08': 'extreme close-up, ultra shallow depth of field, slow micro-movement'
};

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8'));
  } catch {
    return null;
  }
}

function ensureDir(rel) {
  fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
}

function clean(value) {
  return String(value || '').trim();
}

function joinList(items) {
  return (items || []).map(clean).filter(Boolean).join(', ');
}

function joinSentences(items) {
  return (items || [])
    .flat()
    .map(clean)
    .filter(Boolean)
    .map(s => s.endsWith('.') ? s : `${s}.`)
    .join(' ');
}

function splitPromptItems(items) {
  return (items || [])
    .flatMap(item => String(item || '').split(/[;,]/))
    .map(clean)
    .filter(Boolean);
}

function normalizeNegative(item) {
  return clean(item).replace(/^no\s+/i, '');
}

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function cameraMotion(camSetupRef) {
  return CAMERA_MOTION[camSetupRef] || (camSetupRef ? `camera intent: ${camSetupRef}` : 'static shot, minimal camera movement');
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

function characterVisual(character) {
  const mk = character.must_keep || {};
  const parts = [];
  if (mk.hair) parts.push(mk.hair);
  if (mk.outfit) parts.push(mk.outfit);
  if (mk.accessories?.length) parts.push(mk.accessories.join(' + '));
  return parts.length ? `(${character.id}): ${parts.join(', ')}` : `(${character.id})`;
}

function propVisual(prop, shotProp) {
  const parts = [];
  if (shotProp?.state) parts.push(`state: ${shotProp.state}`);
  if (prop.must_keep) parts.push('visually consistent');
  return parts.length
    ? `(${prop.id}): ${parts.join(', ')}`
    : `(${prop.id})`;
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
      exists: fs.existsSync(path.join(ROOT, anchor.img))
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
        exists: fs.existsSync(path.join(ROOT, img))
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
        exists: fs.existsSync(path.join(ROOT, img))
      });
    }
  }
  return refs;
}

function listExistingKeyframes(shotId) {
  const dir = path.join(ROOT, 'assets/renders', shotId, 'keyframes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => IMAGE_EXTS.has(path.extname(file).toLowerCase()))
    .sort()
    .map(file => `assets/renders/${shotId}/keyframes/${file}`);
}

function csvCell(value) {
  const s = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function compileVideoPrompt(shotFile, gitHash, projectDefaults) {
  const shot = readJson(`shots/${shotFile}`);
  if (!shot) {
    return { shot_id: shotFile.replace('.json', ''), error: 'shot file not found' };
  }

  const scene = readJson(shot.scene_ref);
  if (!scene) {
    return { shot_id: shot.shot_id, error: `scene not found: ${shot.scene_ref}` };
  }

  const resolveStyle = () => {
    if (shot.style_ref) return readJson(shot.style_ref);
    if (scene.style_ref) return readJson(scene.style_ref);
    if (projectDefaults?.style) return readJson(projectDefaults.style);
    return null;
  };
  const style = resolveStyle();
  const characters = (shot.characters || []).map(c => readJson(c.ref)).filter(Boolean);
  const props = (shot.props || []).map(p => readJson(p.ref)).filter(Boolean);
  const references = collectReferences(scene, characters, props);
  const missingAssets = references.filter(ref => !ref.exists).map(ref => ref.path);
  const existingKeyframes = listExistingKeyframes(shot.shot_id);

  // --- Build video prompt sections ---

  const styleLine = [
    style?.name ? `style: ${style.name}` : '',
    style?.mood_keywords?.length ? `mood: ${style.mood_keywords.join(', ')}` : '',
    style?.palette?.length ? `color palette: ${style.palette.join(', ')}` : ''
  ].filter(Boolean);

  const sceneLine = [
    `scene: ${scene.name || scene.id}`,
    scene.must_keep?.set_elements?.length
      ? scene.must_keep.set_elements.join(', ')
      : '',
    scene.must_keep?.lighting ? `lighting: ${scene.must_keep.lighting}` : ''
  ].filter(Boolean);

  const characterLines = characters.map(ch => `character ${characterVisual(ch)}`);
  const propLines = props.map((p, i) => `prop ${propVisual(p, shot.props?.[i])}`);

  const motion = cameraMotion(shot.cam_setup_ref);

  const actionText = shot.action?.beats?.length
    ? shot.action.beats.join(', ')
    : '';

  const dialogueText = shot.dialogue?.text
    ? `${shot.dialogue.speaker || 'Character'} says: "${shot.dialogue.text}"`
    : '';

  const voiceoverText = shot.voiceover?.text
    ? `Narration: "${shot.voiceover.text}"`
    : '';

  const continuityNotes = formatStateNotes(shot.continuity?.state_changes);

  const shotOverridePositive = shot.prompt?.positive || '';

  // ---- NATURAL LANGUAGE VIDEO PROMPT (paragraph) ----
  const videoPromptSentences = [
    styleLine.length > 0 ? styleLine.join(', ') : '',
    sceneLine.length > 0 ? sceneLine.join('. ') : '',
    characterLines.length > 0 ? characterLines.join('. ') : '',
    propLines.length > 0 ? propLines.join('. ') : '',
    actionText,
    voiceoverText,
    dialogueText,
    `Camera motion: ${motion}`,
    continuityNotes,
    shotOverridePositive,
    'Stable visual consistency across entire clip. No character drift, no prop mutation, no scene layout shift.'
  ].filter(Boolean);

  const videoPrompt = joinSentences(videoPromptSentences);

  // ---- KEYWORD-STYLE PROMPT (for tools preferring comma-joined format) ----
  const keywordItems = [
    ...(style?.mood_keywords || []),
    ...(scene.must_keep?.set_elements || []),
    scene.must_keep?.lighting ? scene.must_keep.lighting : '',
    ...characters.flatMap(ch => {
      const mk = ch.must_keep || {};
      return [
        ch.id,
        mk.hair,
        mk.outfit,
        ...(mk.accessories || [])
      ];
    }),
    ...props.map(p => p.id),
    actionText.split(/[,;]/).map(clean).filter(Boolean),
    dialogueText,
    motion,
    ...splitPromptItems([shotOverridePositive])
  ];

  const videoPromptKeywords = joinList(
    [...new Set(keywordItems.map(clean).filter(Boolean).filter(s => s.length < 80))]
  );

  // ---- NEGATIVE PROMPT ----
  const negative = [
    ...(style?.forbidden || []),
    ...(scene.forbidden || []),
    ...splitPromptItems([shot.prompt?.negative]),
    'face morphing',
    'character drift',
    'outfit change',
    'prop mutation',
    'scene layout shift',
    'extra fingers',
    'distorted limbs',
    'text artifacts',
    'burnt-in subtitles',
    'logo',
    'watermark',
    'motion blur excessive',
    'flickering',
    'framing jump cut'
  ];

  const negativePrompt = joinList([
    ...new Set(negative.map(normalizeNegative).filter(Boolean))
  ]);

  // ---- CONSTRAINT COLLECTION ----
  const constraints = {
    must_keep: [
      ...(scene.must_keep?.set_elements || []).map(x => `scene:${x}`),
      ...characters.map(c => `character:${c.id}`),
      ...props.filter(p => p.must_keep).map(p => `prop:${p.id}`)
    ],
    forbidden: scene.forbidden || []
  };

  // ---- REFERENCE IMAGE PATHS (flat, for video tool upload) ----
  const refImagePaths = references.map(r => r.path);

  // ---- STRUCTURED SHOT CONTEXT ----
  const structuredContext = {
    scene_name: scene.name || scene.id,
    scene_elements: scene.must_keep?.set_elements || [],
    scene_lighting: scene.must_keep?.lighting || '',
    style_name: style?.name || null,
    style_mood: style?.mood_keywords || [],
    style_palette: style?.palette || [],
    characters: characters.map(ch => ({
      id: ch.id,
      name: ch.name || ch.id,
      hair: ch.must_keep?.hair || '',
      outfit: ch.must_keep?.outfit || '',
      accessories: ch.must_keep?.accessories || []
    })),
    props: props.map((p, i) => ({
      id: p.id,
      name: p.name || p.id,
      state: shot.props?.[i]?.state || null
    })),
    action_beats: shot.action?.beats || [],
    dialogue: shot.dialogue || null,
    voiceover: shot.voiceover || null
  };

  const promptSpec = {
    shot_id: shot.shot_id,
    duration_s: shot.duration_s,
    language: projectDefaults?.language || 'zh',
    task_type: 'video_generation',

    video_prompt: videoPrompt,
    video_prompt_keywords: videoPromptKeywords,
    video_prompt_short: videoPrompt.length > 500 ? videoPrompt.slice(0, 497) + '...' : videoPrompt,
    negative_prompt: negativePrompt,

    camera_intent: shot.cam_setup_ref || null,
    camera_motion: motion,

    continuity_notes: continuityNotes || null,
    continuity_locks: formatStateNotes(shot.continuity?.state_changes) || null,

    structured_context: structuredContext,

    reference_images: references,
    conditioning_keyframes: existingKeyframes,

    constraints,
    ref_image_paths: refImagePaths,

    params: {
      duration_s: shot.duration_s,
      tier: shot.budget?.tier || 'cheap',
      max_regen: shot.budget?.max_regen || 1
    },

    workflow: {
      prompt_ready: true,
      has_keyframes: existingKeyframes.length > 0,
      keyframe_dir: `assets/renders/${shot.shot_id}/keyframes`,
      expected_keyframes: ['frame_01.jpg', 'frame_02.jpg', 'frame_03.jpg'],
      tool_instructions: existingKeyframes.length > 0
        ? `Use video prompt + conditioning keyframes for img2vid generation. Copy 'video_prompt' into your video tool, attach 'conditioning_keyframes' as start/end frame conditioning.`
        : `No keyframes found yet. Generate keyframe images first using build-image-prompts, save them to ${shot.shot_id}/keyframes, then re-run this compiler for img2vid conditioning. Text-to-video is still possible with just 'video_prompt'.`
    },

    validation: {
      missing_assets: missingAssets,
      status: missingAssets.length ? 'WARN' : 'OK'
    },

    meta: {
      compiler_version: 'video-prompts-2.0.0',
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

  // ---- FLATTENED READY-TO-USE FORMAT ----
  const finalPrompt = {
    shot_id: shot.shot_id,
    duration_s: shot.duration_s,
    prompt: videoPrompt,
    negative: negativePrompt,
    motion: motion,
    condition_images: [
      ...existingKeyframes,
      ...refImagePaths
    ],
    tool_hint: 'Copy "prompt" and "negative" into video generation tool. Upload "condition_images" for img2vid start/end frame conditioning if supported. Duration is a guideline.',
    meta: promptSpec.meta
  };

  return { promptSpec, finalPrompt, missingAssets };
}

function sortByTimeline(shotFiles, timeline) {
  if (!timeline || timeline.length === 0) return shotFiles.sort();

  const order = new Map(timeline.map((entry, i) => [entry.shot_id, i]));
  return [...shotFiles].sort((a, b) => {
    const idA = a.replace('.json', '');
    const idB = b.replace('.json', '');
    const idxA = order.has(idA) ? order.get(idA) : 9999;
    const idxB = order.has(idB) ? order.get(idB) : 9999;
    if (idxA !== idxB) return idxA - idxB;
    return idA.localeCompare(idB);
  });
}

function writeStoryboardExports(packages, suffix) {
  ensureDir('exports');

  const filenameBase = suffix ? `exports/video-storyboard-${suffix}` : 'exports/video-storyboard';

  // CSV
  const csvRows = [
    ['shot_id', 'duration_s', 'dialogue', 'voiceover', 'video_prompt', 'negative_prompt', 'camera_motion', 'reference_images', 'conditioning_keyframes', 'keyframe_dir']
      .map(csvCell).join(',')
  ];

  for (const pkg of packages) {
    csvRows.push([
      pkg.shot_id,
      pkg.duration_s,
      pkg.structured_context?.dialogue?.text || '',
      pkg.structured_context?.voiceover?.text || '',
      pkg.video_prompt || '',
      pkg.negative_prompt || '',
      pkg.camera_motion || '',
      pkg.ref_image_paths || [],
      pkg.conditioning_keyframes || [],
      pkg.workflow?.keyframe_dir || ''
    ].map(csvCell).join(','));
  }

  // Markdown
  const md = [
    '# Video Prompt Storyboard',
    '',
    '每个镜头的视频生成提示词。复制 "Prompt" 和 "Negative" 到视频生成工具，可用 conditioning keyframes 做 img2vid。',
    '',
    `共 ${packages.length} 个镜头。`,
    ''
  ];

  for (const pkg of packages) {
    md.push(
      `## ${pkg.shot_id} (${pkg.duration_s}s)`,
      '',
      `Camera: ${pkg.camera_motion || 'N/A'}`,
      '',
      pkg.structured_context?.dialogue?.text
        ? `Dialogue: **${pkg.structured_context.dialogue.speaker}**: ${pkg.structured_context.dialogue.text}`
        : '',
      pkg.structured_context?.voiceover?.text
        ? `Voiceover: ${pkg.structured_context.voiceover.text}`
        : '',
      '',
      '### Prompt',
      '',
      '```text',
      pkg.video_prompt || '',
      '```',
      '',
      '### Negative',
      '',
      '```text',
      pkg.negative_prompt || '',
      '```',
      '',
      pkg.conditioning_keyframes?.length
        ? `Keyframes available: ${pkg.conditioning_keyframes.length} image(s)`
        : `Keyframe dir: \`${pkg.workflow?.keyframe_dir}\` (empty)`,
      '',
      '---',
      ''
    );
  }

  fs.writeFileSync(path.join(ROOT, `${filenameBase}.csv`), csvRows.join('\n'));
  fs.writeFileSync(path.join(ROOT, `${filenameBase}.md`), md.join('\n'));
}

function main() {
  ensureDir('prompts');
  ensureDir('exports');

  const project = readJson('project.json');
  const projectDefaults = {
    language: project?.defaults?.language || 'zh',
    style: project?.default_style_ref || null
  };

  const timeline = project?.timeline || [];
  const gitHash = getGitHash();

  const onlyShotId = process.argv.includes('--shot')
    ? process.argv[process.argv.indexOf('--shot') + 1]
    : null;

  let shotFiles;
  if (onlyShotId) {
    const fileName = `S${String(onlyShotId).padStart(3, '0')}.json`;
    if (fs.existsSync(path.join(ROOT, 'shots', fileName))) {
      shotFiles = [fileName];
    } else if (fs.existsSync(path.join(ROOT, 'shots', `${onlyShotId}.json`))) {
      shotFiles = [`${onlyShotId}.json`];
    } else {
      console.error(`[VideoPrompts] Shot not found: ${onlyShotId}`);
      process.exit(1);
    }
  } else {
    shotFiles = fs.readdirSync(path.join(ROOT, 'shots'))
      .filter(f => f.endsWith('.json'));
  }

  if (timeline.length > 0) {
    shotFiles = sortByTimeline(shotFiles, timeline);
  } else {
    shotFiles.sort();
  }

  console.log(`[VideoPrompts] Compiling ${shotFiles.length} shot(s) into video prompts (Commit: ${gitHash})...`);

  const packages = [];
  let totalMissing = 0;
  let errors = 0;

  const exportSuffix = onlyShotId ? `shot-${onlyShotId}` : '';

  for (const f of shotFiles) {
    const { promptSpec, finalPrompt, missingAssets } = compileVideoPrompt(f, gitHash, projectDefaults);

    if (promptSpec.error) {
      console.error(`[ERROR] ${promptSpec.shot_id}: ${promptSpec.error}`);
      errors++;
      continue;
    }

    fs.writeFileSync(
      path.join(ROOT, 'prompts', `${promptSpec.shot_id}.prompt.json`),
      JSON.stringify(promptSpec, null, 2)
    );
    fs.writeFileSync(
      path.join(ROOT, 'prompts', `${promptSpec.shot_id}.final.json`),
      JSON.stringify(finalPrompt, null, 2)
    );

    if (missingAssets.length > 0) {
      console.warn(`[WARN] ${promptSpec.shot_id} missing ${missingAssets.length} reference assets:`);
      missingAssets.slice(0, 3).forEach(m => console.warn(`  - ${m}`));
      if (missingAssets.length > 3) console.warn(`  ... and ${missingAssets.length - 3} more`);
      totalMissing += missingAssets.length;
    }

    packages.push(promptSpec);
    const kfInfo = promptSpec.conditioning_keyframes?.length
      ? ` +${promptSpec.conditioning_keyframes.length} keyframes`
      : ' (no keyframes)';
    console.log(`[VideoPrompts] ${promptSpec.shot_id} -> prompts/${promptSpec.shot_id}.{prompt,final}.json${kfInfo}`);
  }

  writeStoryboardExports(packages, exportSuffix);
  console.log(`[VideoPrompts] Wrote exports/${exportSuffix ? `video-storyboard-${exportSuffix}` : 'video-storyboard'}.{csv,md}`);

  if (errors > 0) {
    console.error(`[VideoPrompts] ${errors} shot(s) failed to compile.`);
  }
  if (totalMissing > 0) {
    console.warn(`[VideoPrompts] ${totalMissing} missing reference asset(s). Run validate.js for details.`);
  }

  console.log(`[VideoPrompts] Completed: ${packages.length} shot(s) compiled, ${errors} error(s), ${totalMissing} missing asset(s).`);
}

main();

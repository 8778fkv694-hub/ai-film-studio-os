import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir, projectRoot, projectId } = parseArgs();

// Helper for color logging
function logInfo(str) { console.log(`\x1b[36m[ProjectContext] ${str}\x1b[0m`); }
function logSuccess(str) { console.log(`\x1b[32m[ProjectContext] ${str}\x1b[0m`); }
function logWarn(str) { console.warn(`\x1b[33m[ProjectContext] [WARN] ${str}\x1b[0m`); }
function logError(str) { console.error(`\x1b[31m[ProjectContext] [ERROR] ${str}\x1b[0m`); }

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

function main() {
  logInfo(`Starting project system prompt generation...`);
  logInfo(`Target Project Directory: ${workDir}`);

  const projectData = readJson('project.json');
  if (!projectData) {
    logError(`project.json not found in project dir: ${workDir}`);
    process.exit(1);
  }

  const projName = projectData.name || projectId || path.basename(workDir);
  const projDesc = projectData.description || 'No description provided.';
  const defaultStyleRef = projectData.default_style_ref;
  const defaultStyle = defaultStyleRef ? readJson(defaultStyleRef) : null;

  // Load Inventory Scenes, Characters, Props
  const scenes = (projectData.inventory?.scenes || []).map(ref => readJson(ref)).filter(Boolean);
  const characters = (projectData.inventory?.characters || []).map(ref => readJson(ref)).filter(Boolean);
  const props = (projectData.inventory?.props || []).map(ref => readJson(ref)).filter(Boolean);
  const timeline = projectData.timeline || [];

  // Deduplicate and resolve unique parent shots
  const uniqueParents = [];
  const parentIds = new Set();

  for (const item of timeline) {
    const shotFile = item.shot_file;
    let shotData = null;
    try {
      const raw = fs.readFileSync(path.join(workDir, shotFile), 'utf-8');
      shotData = JSON.parse(raw);
    } catch (e) {
      continue;
    }

    const parentId = shotData.parent_shot_id || shotData.shot_id;
    if (!parentIds.has(parentId)) {
      parentIds.add(parentId);

      let parentShotData = null;
      if (shotData.parent_shot_id) {
        const archivedPath = path.join(workDir, 'shots_archived', `${parentId}.json`);
        if (fs.existsSync(archivedPath)) {
          try {
            parentShotData = JSON.parse(fs.readFileSync(archivedPath, 'utf-8'));
          } catch (e) {}
        }
      }

      if (!parentShotData) {
        parentShotData = shotData;
      }
      uniqueParents.push(parentShotData);
    }
  }

  // Find mapping of scene paths to scene names
  const sceneNameMap = {};
  for (const scene of scenes) {
    sceneNameMap[scene.id] = scene.name;
    // Also map potential references
    sceneNameMap[`scenes/scene_${scene.id}.json`] = scene.name;
    sceneNameMap[`scenes/${scene.id}.json`] = scene.name;
  }
  
  function getSceneName(sceneRef) {
    if (!sceneRef) return 'Unknown Scene';
    const base = path.basename(sceneRef, '.json');
    if (sceneNameMap[base]) return sceneNameMap[base];
    const key = base.replace(/^scene_/, '');
    if (sceneNameMap[key]) return sceneNameMap[key];
    return sceneNameMap[sceneRef] || base;
  }

  // Re-map scene names for unique parents
  const fullScript = [];
  for (const p of uniqueParents) {
    const sName = getSceneName(p.scene_ref);
    let voText = p.voiceover?.text || '';
    let dialText = p.dialogue?.text || '';
    let beats = p.action?.beats || [];
    fullScript.push({
      shot_id: p.shot_id,
      scene_name: sName,
      voiceover: voText ? { speaker: p.voiceover.speaker || 'Narrator', text: voText } : null,
      dialogue: dialText ? { speaker: p.dialogue.speaker || 'Character', text: dialText } : null,
      action_beats: beats
    });
  }

  // --- MD Format Generation ---
  const mdLines = [];
  mdLines.push(`# 项目系统提示词 — ${projName}`);
  mdLines.push('');
  mdLines.push('## 项目身份');
  mdLines.push(`你正在为一部视频生成分镜关键帧图片和视频提示词。`);
  mdLines.push(`- **项目名称**: ${projName}`);
  mdLines.push(`- **项目 ID**: ${projectData.id || projectId || path.basename(workDir)}`);
  mdLines.push(`- **项目描述**: ${projDesc}`);
  mdLines.push('');

  if (defaultStyle) {
    mdLines.push('## 视觉风格指南');
    mdLines.push(`- **风格名称**: ${defaultStyle.name || defaultStyle.id || '未命名风格'}`);
    if (defaultStyle.mood_keywords?.length) {
      mdLines.push(`- **情绪/基调**: ${defaultStyle.mood_keywords.join(', ')}`);
    }
    if (defaultStyle.palette?.length) {
      mdLines.push(`- **颜色调色板**: ${defaultStyle.palette.join(', ')}`);
    }
    if (defaultStyle.forbidden?.length) {
      mdLines.push(`- **禁止元素**: ${defaultStyle.forbidden.join(', ')}`);
    }
    mdLines.push('');
  }

  if (characters.length > 0) {
    mdLines.push('## 角色设定');
    for (const char of characters) {
      mdLines.push(`### 角色 ID: ${char.id} (${char.name || '未命名'})`);
      if (char.must_keep?.hair) mdLines.push(`- **发型**: ${char.must_keep.hair}`);
      if (char.must_keep?.outfit) mdLines.push(`- **服装**: ${char.must_keep.outfit}`);
      if (char.must_keep?.accessories?.length) {
        mdLines.push(`- **配饰**: ${char.must_keep.accessories.join(', ')}`);
      }
      mdLines.push(`- **视觉一致性要求**: 所有镜头中必须保持上述外观一致，不能有面部漂移或服装突变。`);
      mdLines.push('');
    }
  }

  if (scenes.length > 0) {
    mdLines.push('## 场景设定');
    for (const sc of scenes) {
      mdLines.push(`### 场景 ID: ${sc.id} (${sc.name || '未命名'})`);
      if (sc.must_keep?.set_elements?.length) {
        mdLines.push(`- **必须包含元素**: ${sc.must_keep.set_elements.join(', ')}`);
      }
      if (sc.must_keep?.lighting) {
        mdLines.push(`- **灯光设定**: ${sc.must_keep.lighting}`);
      }
      if (sc.forbidden?.length) {
        mdLines.push(`- **禁用元素**: ${sc.forbidden.join(', ')}`);
      }
      mdLines.push('');
    }
  }

  if (props.length > 0) {
    mdLines.push('## 道具清单');
    for (const pr of props) {
      mdLines.push(`- **道具 ID: ${pr.id}** (${pr.name || '未命名'}): ${pr.must_keep ? '必须在各个镜头中保持视觉一致' : '无需特殊一致性锁定'}`);
    }
    mdLines.push('');
  }

  mdLines.push('## 完整剧本（按时间线顺序，包含完整无截断字幕与上下文）');
  for (const s of fullScript) {
    mdLines.push(`### ${s.shot_id} — 场景: ${s.scene_name}`);
    if (s.voiceover) {
      mdLines.push(`- **旁白**: 「${s.voiceover.speaker}：${s.voiceover.text}」`);
    }
    if (s.dialogue) {
      mdLines.push(`- **对白**: 「${s.dialogue.speaker}：${s.dialogue.text}」`);
    }
    if (s.action_beats?.length) {
      mdLines.push(`- **动作描述**: ${s.action_beats.join('; ')}`);
    }
    mdLines.push('');
  }

  mdLines.push('## 分镜总览');
  mdLines.push(`共包含 ${timeline.length} 个子分镜。`);
  for (const item of timeline) {
    let shotData = null;
    try {
      shotData = JSON.parse(fs.readFileSync(path.join(workDir, item.shot_file), 'utf-8'));
    } catch(e) {}
    
    const scName = shotData ? getSceneName(shotData.scene_ref) : '未知场景';
    const voPart = shotData?.voiceover?.text ? `旁白: "${shotData.voiceover.text}"` : '';
    const diagPart = shotData?.dialogue?.text ? `对白: "${shotData.dialogue.text}"` : '';
    const textPart = [voPart, diagPart].filter(Boolean).join(' | ');
    mdLines.push(`- **${item.shot_id}**: 场景: ${scName}, 时长: ${item.duration_s}秒 ${textPart ? `(${textPart})` : ''}`);
  }

  const mdContent = mdLines.join('\n');

  // --- TXT Format Generation (Pure Instructions text) ---
  const txtLines = [];
  txtLines.push(`================================================================================`);
  txtLines.push(`PROJECT SYSTEM PROMPT - ${projName.toUpperCase()}`);
  txtLines.push(`================================================================================`);
  txtLines.push(`You are a multimodal AI assisting in generating consistent storyboard keyframes and video prompts.`);
  txtLines.push(`To ensure strict visual consistency and narrative continuity, you must ground all generations in this global project context.`);
  txtLines.push(``);
  txtLines.push(`[PROJECT METADATA]`);
  txtLines.push(`Project Name: ${projName}`);
  txtLines.push(`Description: ${projDesc}`);
  txtLines.push(``);

  if (defaultStyle) {
    txtLines.push(`[VISUAL STYLE GUIDE]`);
    txtLines.push(`Style: ${defaultStyle.name}`);
    if (defaultStyle.mood_keywords?.length) txtLines.push(`Mood: ${defaultStyle.mood_keywords.join(', ')}`);
    if (defaultStyle.palette?.length) txtLines.push(`Color Palette: ${defaultStyle.palette.join(', ')}`);
    if (defaultStyle.forbidden?.length) txtLines.push(`Forbidden Elements: ${defaultStyle.forbidden.join(', ')}`);
    txtLines.push(``);
  }

  if (characters.length > 0) {
    txtLines.push(`[CHARACTER DESCRIPTIONS & CONTINUITY LOCKS]`);
    for (const char of characters) {
      txtLines.push(`- Character "${char.id}" (${char.name}):`);
      if (char.must_keep?.hair) txtLines.push(`  * Hair: ${char.must_keep.hair}`);
      if (char.must_keep?.outfit) txtLines.push(`  * Outfit: ${char.must_keep.outfit}`);
      if (char.must_keep?.accessories?.length) txtLines.push(`  * Accessories: ${char.must_keep.accessories.join(', ')}`);
      txtLines.push(`  * Consistency: Maintain exact face and clothing details across all shots without variation.`);
    }
    txtLines.push(``);
  }

  if (scenes.length > 0) {
    txtLines.push(`[SCENE SETTINGS]`);
    for (const sc of scenes) {
      txtLines.push(`- Scene "${sc.id}" (${sc.name}):`);
      if (sc.must_keep?.set_elements?.length) txtLines.push(`  * Key Set Elements: ${sc.must_keep.set_elements.join(', ')}`);
      if (sc.must_keep?.lighting) txtLines.push(`  * Lighting: ${sc.must_keep.lighting}`);
      if (sc.forbidden?.length) txtLines.push(`  * Excluded Elements: ${sc.forbidden.join(', ')}`);
    }
    txtLines.push(``);
  }

  if (props.length > 0) {
    txtLines.push(`[PROP LOCKS]`);
    for (const pr of props) {
      txtLines.push(`- Prop "${pr.id}" (${pr.name}): ${pr.must_keep ? 'Lock visual consistency' : 'No lock'}`);
    }
    txtLines.push(``);
  }

  txtLines.push(`[FULL SEQUENTIAL SCRIPT / NARRATION CONTEXT]`);
  txtLines.push(`Use this complete timeline of parent shots to understand the flow and solve truncated subtitles or partial context:`);
  for (const s of fullScript) {
    txtLines.push(`---`);
    txtLines.push(`Shot: ${s.shot_id} (${s.scene_name})`);
    if (s.voiceover) txtLines.push(`Narration: [${s.voiceover.speaker}] "${s.voiceover.text}"`);
    if (s.dialogue) txtLines.push(`Dialogue: [${s.dialogue.speaker}] "${s.dialogue.text}"`);
    if (s.action_beats?.length) txtLines.push(`Action Beats: ${s.action_beats.join('; ')}`);
  }
  txtLines.push(`================================================================================`);

  const txtContent = txtLines.join('\n');

  // --- Compact TXT Format Generation ---
  const compactLines = [];
  compactLines.push(`PROJECT: ${projName}`);
  compactLines.push(`STYLE: ${defaultStyle?.name || 'Cinematic Realism v1'} (mood: ${defaultStyle?.mood_keywords?.join(', ')}, palette: ${defaultStyle?.palette?.join(', ')})`);
  
  if (characters.length > 0) {
    compactLines.push(`CHARACTERS:`);
    for (const char of characters) {
      const parts = [];
      if (char.must_keep?.hair) parts.push(`hair: ${char.must_keep.hair}`);
      if (char.must_keep?.outfit) parts.push(`outfit: ${char.must_keep.outfit}`);
      if (char.must_keep?.accessories?.length) parts.push(`acc: ${char.must_keep.accessories.join('+')}`);
      compactLines.push(`- ${char.id} (${char.name}): ${parts.join(', ')} (lock appearance)`);
    }
  }

  if (scenes.length > 0) {
    compactLines.push(`SCENES:`);
    for (const sc of scenes) {
      const parts = [];
      if (sc.must_keep?.set_elements?.length) parts.push(`elements: ${sc.must_keep.set_elements.join(', ')}`);
      if (sc.must_keep?.lighting) parts.push(`lighting: ${sc.must_keep.lighting}`);
      compactLines.push(`- ${sc.id} (${sc.name}): ${parts.join(', ')}`);
    }
  }

  compactLines.push(`FULL SCRIPT SEQUENCE:`);
  for (const s of fullScript) {
    const textPart = s.voiceover ? `Narration: "${s.voiceover.text}"` : (s.dialogue ? `Dialogue: "${s.dialogue.text}"` : '');
    const beatsPart = s.action_beats?.length ? `Action: ${s.action_beats.join(';')}` : '';
    compactLines.push(`- ${s.shot_id} (${s.scene_name}): ${textPart} ${beatsPart ? `| ${beatsPart}` : ''}`);
  }

  const compactContent = compactLines.join('\n');

  // --- JSON Format Generation ---
  const jsonContent = JSON.stringify({
    project: {
      id: projectData.id || projectId || path.basename(workDir),
      name: projName,
      description: projDesc
    },
    style: defaultStyle,
    characters,
    scenes,
    props,
    script: fullScript,
    timeline: timeline.map(item => {
      let shotData = null;
      try {
        shotData = JSON.parse(fs.readFileSync(path.join(workDir, item.shot_file), 'utf-8'));
      } catch(e) {}
      return {
        shot_id: item.shot_id,
        duration_s: item.duration_s,
        scene_name: shotData ? getSceneName(shotData.scene_ref) : '未知场景',
        voiceover: shotData?.voiceover || null,
        dialogue: shotData?.dialogue || null
      };
    })
  }, null, 2);

  // Write outputs
  ensureDir('exports');
  
  const mdPath = path.join(workDir, 'exports/project-system-prompt.md');
  const txtPath = path.join(workDir, 'exports/project-system-prompt.txt');
  const compactPath = path.join(workDir, 'exports/project-system-prompt-compact.txt');
  const jsonPath = path.join(workDir, 'exports/project-system-prompt.json');

  fs.writeFileSync(mdPath, mdContent, 'utf-8');
  fs.writeFileSync(txtPath, txtContent, 'utf-8');
  fs.writeFileSync(compactPath, compactContent, 'utf-8');
  fs.writeFileSync(jsonPath, jsonContent, 'utf-8');

  logSuccess(`Wrote project system prompt exports:`);
  console.log(`  - MD:      exports/project-system-prompt.md`);
  console.log(`  - TXT:     exports/project-system-prompt.txt`);
  console.log(`  - Compact: exports/project-system-prompt-compact.txt`);
  console.log(`  - JSON:    exports/project-system-prompt.json`);
  logSuccess(`Completed successfully.`);
}

main();

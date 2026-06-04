import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir: DEFAULT_WORK_DIR, projectRoot: ROOT, remainingArgs } = parseArgs();

// 工作目录：默认活动项目，可通过 --project-dir / --project-id 覆盖
let WORK_DIR = DEFAULT_WORK_DIR;

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(WORK_DIR, rel), 'utf-8'));
  } catch (e) {
    return {};
  }
}

function ensureDir(rel) {
  fs.mkdirSync(path.join(WORK_DIR, rel), { recursive: true });
}

// 1. Load Asset Inventory to resolve references automatically
// These will be set in main() based on BASE_DIR
let characters = [];
let props = [];
let scenes = [];

function loadInventory(type) {
  const dir = path.join(WORK_DIR, type);
  return fs.existsSync(dir)
    ? fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ file: `${type}/${f}`, ...readJson(path.join(dir, f)) }))
    : [];
}

// 把一个引用（可能是 file 路径 / id / 文件名 / 裸名）解析为库存里的规范 file；解析不到返回 null。
function resolveInventoryFile(ref, inventory) {
  if (!ref || typeof ref !== 'string') return null;
  const r = ref.trim();
  if (!r) return null;
  let hit = inventory.find(x => x.file === r);            // 精确 file
  if (hit) return hit.file;
  hit = inventory.find(x => x.id === r);                  // 按 id
  if (hit) return hit.file;
  const base = r.replace(/^.*\//, '').replace(/\.json$/i, ''); // 裸名/文件名
  hit = inventory.find(x => x.id === base || x.file.endsWith(`/${base}.json`) || x.file === `${base}.json`);
  return hit ? hit.file : null;
}

// 白名单校验：AI/正则产出的 characters/props/scene_ref 必须落在库存内，非法的丢弃/回退默认，杜绝幻觉引用。
function sanitizeShotRefs(shot, defaultSceneRef) {
  shot.characters = Array.isArray(shot.characters)
    ? shot.characters.map(c => {
        const file = resolveInventoryFile(c && c.ref, characters);
        return file ? { ...c, ref: file } : null;
      }).filter(Boolean)
    : [];
  shot.props = Array.isArray(shot.props)
    ? shot.props.map(p => {
        const file = resolveInventoryFile(p && p.ref, props);
        return file ? { ...p, ref: file } : null;
      }).filter(Boolean)
    : [];
  const sceneFile = resolveInventoryFile(shot.scene_ref, scenes);
  shot.scene_ref = sceneFile || resolveInventoryFile(defaultSceneRef, scenes) || defaultSceneRef;
  return shot;
}

// 创意档位 → 采样温度（与 ui/lib/ai-settings.ts 保持一致）
function splitTemperature(settings) {
  switch (String(settings?.creativitySplit)) {
    case 'creative': return 0.8;
    case 'balanced': return 0.45;
    case 'precise':
    default: return 0.2;
  }
}

// 2. AI Chunked Script Splitter via DeepSeek
async function parseChunkWithAI(chunkText, settings, currentSceneRef) {
  const baseUrl = String(settings.apiBaseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = String(settings.textModel || 'deepseek-chat');

  // 喂入规范属性做锚定：角色长相/服装、场景光线/必留元素/禁止项、道具规范
  const charInv = characters.map(c => ({
    ref: c.file, id: c.id, name: c.name,
    identity: c.must_keep?.identity || '',
    hair: c.must_keep?.hair || '',
    outfit: c.must_keep?.outfit || ''
  }));
  const propInv = props.map(p => ({
    ref: p.file, id: p.id, name: p.name,
    must_keep: typeof p.must_keep === 'string' ? p.must_keep : (p.must_keep || '')
  }));
  const sceneInv = scenes.map(s => ({
    ref: s.file, id: s.id, name: s.name,
    lighting: s.must_keep?.lighting || '',
    set_elements: s.must_keep?.set_elements || [],
    forbidden: s.forbidden || []
  }));

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: `You are an expert film director and screenplay analyzer.
Analyze the provided screenplay text chunk and break it down into sequential storyboard shots.
Comply strictly with the shot schema and output a valid JSON array of shot objects.

=== ASSET INVENTORY (the ONLY allowed references) ===
Characters: ${JSON.stringify(charInv)}
Props: ${JSON.stringify(propInv)}
Scenes: ${JSON.stringify(sceneInv)}
Default scene_ref: "${currentSceneRef}"

=== HARD CONSTRAINTS (anti-hallucination) ===
1. For characters[].ref, props[].ref and scene_ref you MUST copy a "ref" value verbatim from the inventory above. NEVER invent a file path or id that is not listed.
2. If no inventory character/prop matches what the text mentions, use an empty array [] — do NOT fabricate one.
3. If no scene matches, use the Default scene_ref verbatim.
4. Do NOT invent characters, props, locations, wardrobe, lighting, weather, time of day, or any story facts that are not present in the screenplay text or the inventory.
5. Ground the image prompt in the inventory: describe each referenced character using its identity/hair/outfit, and the scene using its lighting/set_elements, and AVOID anything in the scene's forbidden list. Do not contradict these canonical attributes.
6. If a detail is unknown, omit it rather than guessing.

For each shot, output an object with exactly these fields:
- shot_id: e.g., "S001", "S002", etc.
- duration_s: duration in seconds (usually 3 to 12).
- scene_ref: a scene "ref" from inventory (verbatim) or the Default scene_ref.
- cam_setup_ref: "comic_panel_01" (wide establishing), "comic_panel_02" (medium), "comic_panel_03" (close-up), or "comic_panel_08" (extreme closeup).
- characters: array of { ref } using ONLY refs from the Characters inventory.
- props: array of { ref, state } using ONLY refs from the Props inventory.
- action: { beats: string[] } list of action descriptions grounded in the text.
- dialogue: { speaker, text, voice_id } or null if no dialogue.
- voiceover: { speaker, text, voice_id } or null if no voiceover.
- budget: { tier: 'cheap', max_regen: 1 }
- prompt: { positive, negative } — KEYFRAME IMAGE prompt, production-ready:
  positive format: "[16:9] [shot type], [subject/action with referenced characters' outfit + props + scene set_elements], [scene lighting], [camera angle], [photorealistic, highly detailed, 8K], [style/atmosphere]". Use the canonical outfit/lighting from inventory; do not invent new wardrobe or lighting.
  negative format: comma-separated things to AVOID, including the scene's forbidden items. Always include: blurry, low quality, distorted faces, wrong proportions, text artifacts, watermark, logo, extra limbs.
- context_refs: array (will be overwritten by the pipeline; you may output []).

Return ONLY the raw JSON array. Do not wrap in markdown code blocks or quotes. Do not include extra text.`
        },
        {
          role: 'user',
          content: chunkText
        }
      ],
      temperature: splitTemperature(settings)
    })
  });

  if (!response.ok) {
    throw new Error(`API returned status ${response.status}: ${await response.text()}`);
  }

  const resJson = await response.json();
  let content = resJson?.choices?.[0]?.message?.content?.trim() || '';
  
  if (content.startsWith('```')) {
    content = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  }

  return JSON.parse(content);
}

async function parseScriptWithAI(scriptText, settings) {
  const defaultScene = scenes.length > 0 ? scenes[0].file : 'TODO: match scene manually';
  let currentSceneRef = defaultScene;

  // Split by empty lines to find individual shot blocks
  const blocks = scriptText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  
  console.log(`[ScriptSplit] [AI] Split script into ${blocks.length} blocks. Processing in chunks of 5...`);
  
  const allShots = [];
  const chunkSize = 5;
  
  for (let i = 0; i < blocks.length; i += chunkSize) {
    const chunkBlocks = blocks.slice(i, i + chunkSize);
    const chunkText = chunkBlocks.join('\n\n');
    console.log(`[ScriptSplit] [AI] Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(blocks.length / chunkSize)} (${chunkBlocks.length} blocks)...`);
    
    const chunkShots = await parseChunkWithAI(chunkText, settings, currentSceneRef);
    
    // Re-index shot IDs and continuity structures to be sequential based on overall count
    for (let j = 0; j < chunkShots.length; j++) {
      const shotIndex = allShots.length + j + 1;
      chunkShots[j].shot_id = `S${String(shotIndex).padStart(3, '0')}`;
      
      // Update context_refs
      if (shotIndex > 1) {
        const prevId = `S${String(shotIndex - 1).padStart(3, '0')}`;
        chunkShots[j].context_refs = [`assets/renders/${prevId}/keyframes/frame_01.jpg`];
      } else {
        chunkShots[j].context_refs = [];
      }
      
      // Update continuity fields
      if (chunkShots[j].continuity) {
        const prevId = `S${String(shotIndex - 1).padStart(3, '0')}`;
        chunkShots[j].continuity.state_in_ref = shotIndex > 1 ? `states/${prevId}_OUT.json` : 'states/S000_INIT.json';
        chunkShots[j].continuity.handoff_to_next = [`S${String(shotIndex).padStart(3, '0')} finished`];
      }
    }
    
    allShots.push(...chunkShots);
    
    // Update currentSceneRef based on the last shot's scene
    if (chunkShots.length > 0) {
      currentSceneRef = chunkShots[chunkShots.length - 1].scene_ref;
    }
  }
  
  return allShots;
}

// 3. Fallback Regex Heuristic Script Splitter
class ScriptExtractor {
  parse(scriptText) {
    const defaultScene = scenes.length > 0 ? scenes[0].file : 'TODO: match scene manually';
    let currentSceneRef = defaultScene;

    const shots = [];
    const lines = scriptText.split('\n').map(l => l.trim());
    
    let currentBlock = [];

    // Helper to process a collected shot block
    const processBlock = (blockLines) => {
      if (blockLines.length === 0) return null;
      
      const firstLine = blockLines[0];
      const customMatch = firstLine.match(/^(S\d+)\s*｜\s*(旁白：|台词：)?(.*)$/);
      if (!customMatch) {
        const sceneHeaderMatch = firstLine.match(/^(场景：|INT\.|EXT\.)\s*(.*)$/i);
        if (sceneHeaderMatch) {
          const sceneName = sceneHeaderMatch[2];
          const foundScene = scenes.find(s => 
            s.name.toLowerCase().includes(sceneName.toLowerCase()) || 
            sceneName.toLowerCase().includes(s.name.toLowerCase())
          );
          if (foundScene) {
            currentSceneRef = foundScene.file;
          }
        }
        return null;
      }

      const shotId = customMatch[1];
      let firstLineText = customMatch[3];
      let voiceoverText = '';
      let dialogueText = '';
      const actionBeats = [];

      const firstLineLabel = customMatch[2] || '';
      if (firstLineLabel.includes('旁白')) {
        voiceoverText = firstLineText;
      } else if (firstLineLabel.includes('台词')) {
        dialogueText = firstLineText;
      } else {
        actionBeats.push(firstLineText);
      }

      for (let i = 1; i < blockLines.length; i++) {
        const line = blockLines[i];
        if (line.startsWith('旁白：')) {
          voiceoverText = line.substring(3).trim();
        } else if (line.startsWith('台词：')) {
          dialogueText = line.substring(3).trim();
        } else {
          actionBeats.push(line);
        }
      }

      if (actionBeats.length === 0) {
        if (voiceoverText) actionBeats.push(voiceoverText);
        else if (dialogueText) actionBeats.push(dialogueText);
      }

      const fullText = [voiceoverText, dialogueText, ...actionBeats].join(' ');

      // 通用匹配：仅当库存里某角色/道具的名字出现在文本中才引用，不再写死 demo 的 charA_v1/mug_red_v1
      const charRefs = characters
        .filter(c => c.name && fullText.includes(c.name))
        .map(c => ({ ref: c.file }));
      const propRefs = props
        .filter(p => p.name && fullText.includes(p.name))
        .map(p => ({ ref: p.file, state: 'present' }));
      const primarySpeaker = charRefs.length
        ? (characters.find(c => c.file === charRefs[0].ref)?.name || '角色')
        : '角色';

      let camSetupRef = 'comic_panel_02';
      if (fullText.includes('午夜') || fullText.includes('雨') || fullText.includes('城市') || fullText.includes('公寓') || fullText.includes('走廊')) {
        camSetupRef = 'comic_panel_01';
      } else if (fullText.includes('红杯') || fullText.includes('杯子') || fullText.includes('照片') || fullText.includes('钥匙') || fullText.includes('屏幕')) {
        camSetupRef = 'comic_panel_03';
      } else if (fullText.includes('电视') || fullText.includes('猫眼') || fullText.includes('指甲')) {
        camSetupRef = 'comic_panel_08';
      }

      const warnings = [];
      if (fullText.includes('阳光') || fullText.includes('白天') || fullText.includes('日')) {
        const sceneObj = scenes.find(s => s.file === currentSceneRef);
        if (sceneObj && sceneObj.name.toLowerCase().includes('night')) {
          warnings.push(`Lighting conflict: Shot mentions daylight, but scene is Night (${sceneObj.name})`);
        }
      }

      const calculatedDuration = dialogueText 
        ? Math.max(3, Math.ceil(dialogueText.length / 3)) 
        : (voiceoverText ? Math.max(4, Math.ceil(voiceoverText.length / 4)) : 4);

      const contextRefs = [];
      const currentIdNum = parseInt(shotId.replace(/\D/g, ''));
      if (currentIdNum > 1) {
        const prevId = `S${String(currentIdNum - 1).padStart(3, '0')}`;
        contextRefs.push(`assets/renders/${prevId}/keyframes/frame_01.jpg`);
      }

      return {
        shot_id: shotId,
        duration_s: calculatedDuration,
        scene_ref: currentSceneRef,
        cam_setup_ref: camSetupRef,
        characters: charRefs,
        props: propRefs,
        action: { beats: actionBeats },
        dialogue: dialogueText ? {
          speaker: primarySpeaker,
          text: dialogueText,
          voice_id: 'zh-CN-YunxiNeural'
        } : null,
        voiceover: voiceoverText ? {
          speaker: '旁白',
          text: voiceoverText,
          voice_id: 'zh-CN-XiaoxiaoNeural'
        } : null,
        continuity: {
          state_in_ref: currentIdNum > 1 ? `states/S${String(currentIdNum - 1).padStart(3, '0')}_OUT.json` : 'states/S000_INIT.json',
          state_changes: {},   // 不再凭空捏造位置/姿态/光线，待真实连续性流程或人工填充
          handoff_to_next: [`S${String(currentIdNum).padStart(3, '0')} finished`]
        },
        context_refs: contextRefs,
        budget: { tier: 'cheap', max_regen: 1 },
        prompt: {
          positive: `${camSetupRef === 'comic_panel_01' ? 'establishing shot' : camSetupRef === 'comic_panel_03' ? 'close-up shot' : 'medium shot'}, photographic cinematic style, ${actionBeats.join(', ')}`,
          negative: 'watermark, text, bad anatomy, deformed face, drawing, 3d render'
        },
        _draft_meta: {
          original_text: fullText,
          warnings
        }
      };
    };

    for (const line of lines) {
      const isNewShot = /^S\d+\s*｜/.test(line);
      const isSceneHeader = /^(场景：|INT\.|EXT\.)/i.test(line);

      if ((isNewShot || isSceneHeader) && currentBlock.length > 0) {
        const shotObj = processBlock(currentBlock);
        if (shotObj) shots.push(shotObj);
        currentBlock = [];
      }
      
      if (line) {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      const shotObj = processBlock(currentBlock);
      if (shotObj) shots.push(shotObj);
    }

    return shots;
  }
}

async function main() {
  // 解析命令行参数：node script-split.js <script-path> [--project-dir <dir>]
  const args = remainingArgs;
  let inputFile = 'docs/script.txt';

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) {
      inputFile = args[i];
    }
  }
  
  // 加载项目库存（角色、道具、场景）
  characters = loadInventory('characters');
  props = loadInventory('props');
  scenes = loadInventory('scenes');
  
  // 支持绝对路径和相对路径
  const inputPath = path.isAbsolute(inputFile) ? inputFile : path.join(WORK_DIR, inputFile);
  if (!fs.existsSync(inputPath)) {
    console.error(`[ScriptSplit] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`[ScriptSplit] Reading script from ${inputPath}...`);
  const text = fs.readFileSync(inputPath, 'utf-8');

  // Load Settings to check AI availability
  const settingsPath = path.join(ROOT, '.local/ai-settings.json');
  const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) : null;

  let drafts = [];
  if (settings && settings.aiEnabled && settings.apiKey) {
    try {
      drafts = await parseScriptWithAI(text, settings);
      console.log(`[ScriptSplit] [AI] Successfully processed ${drafts.length} shots using DeepSeek.`);
    } catch (e) {
      console.warn(`[ScriptSplit] [AI] Failed: ${e.message}. Falling back to Regex parser.`);
      const extractor = new ScriptExtractor();
      drafts = extractor.parse(text);
    }
  } else {
    console.log(`[ScriptSplit] [Regex] Using regex parsing (AI is disabled or unconfigured).`);
    const extractor = new ScriptExtractor();
    drafts = extractor.parse(text);
  }

  ensureDir('shots_draft');
  ensureDir('states');
  ensureDir('reports');
  const report = {
    generatedAt: new Date().toISOString(),
    source: inputFile,
    shotCount: drafts.length,
    conflicts: []
  };

  const defaultSceneRef = scenes.length ? scenes[0].file : 'TODO: match scene manually';
  const idOf = (ref) => String(ref || '').replace(/^.*\//, '').replace(/\.json$/i, '');

  drafts.forEach(draft => {
    // Basic formatting safety
    draft.budget = draft.budget || { tier: 'cheap', max_regen: 1 };
    draft.prompt = draft.prompt || { positive: '', negative: '' };

    // 白名单校验：丢弃幻觉的角色/道具引用，scene_ref 回退到合法值
    sanitizeShotRefs(draft, defaultSceneRef);

    if (draft._draft_meta?.warnings?.length > 0) {
      report.conflicts.push({ shot: draft.shot_id, warnings: draft._draft_meta.warnings });
    }

    fs.writeFileSync(
      path.join(WORK_DIR, `shots_draft/${draft.shot_id}.json`),
      JSON.stringify(draft, null, 2)
    );

    // 输出状态文件：由本镜实际引用的角色/道具派生，不再写死 demo 的 charA_v1/夜雨/午夜等
    const stateChars = {};
    for (const c of draft.characters || []) {
      const id = idOf(c.ref);
      if (id) stateChars[id] = {};
    }
    const stateProps = {};
    for (const p of draft.props || []) {
      const id = idOf(p.ref);
      if (id) stateProps[id] = p.state ? { state: p.state } : {};
    }
    const stateOut = {
      shot_id: draft.shot_id,
      characters: stateChars,
      props: stateProps,
      scene: {}
    };

    fs.writeFileSync(
      path.join(WORK_DIR, `states/${draft.shot_id}_OUT.json`),
      JSON.stringify(stateOut, null, 2)
    );
  });

  fs.writeFileSync(path.join(WORK_DIR, 'reports/script.parse.json'), JSON.stringify(report, null, 2));
  console.log(`[ScriptSplit] Completed draft generation: ${drafts.length} shot(s) saved.`);
}

main().catch(e => {
  console.error('[ScriptSplit] Critical error:', e);
  process.exit(1);
});

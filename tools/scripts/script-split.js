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

// 2. AI Chunked Script Splitter via DeepSeek
async function parseChunkWithAI(chunkText, settings, currentSceneRef) {
  const baseUrl = String(settings.apiBaseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = String(settings.textModel || 'deepseek-chat');

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

Characters Inventory: ${JSON.stringify(characters.map(c => ({ id: c.id, name: c.name, file: c.file })))}
Props Inventory: ${JSON.stringify(props.map(p => ({ id: p.id, name: p.name, file: p.file })))}
Scenes Inventory: ${JSON.stringify(scenes.map(s => ({ id: s.id, name: s.name, file: s.file })))}

Default scene_ref: "${currentSceneRef}"

For each shot, output an object with exactly these fields:
- shot_id: e.g., "S001", "S002", etc.
- duration_s: duration in seconds (usually 3 to 12).
- scene_ref: path to scene from the scenes inventory. Match semantically or fallback to default scene_ref!
- cam_setup_ref: e.g. "comic_panel_01" (wide establishing), "comic_panel_02" (medium), "comic_panel_03" (close-up), "comic_panel_08" (extreme closeup).
- characters: array of { ref: string } matching character paths. Match names (e.g. "林澈" -> "characters/charA_v1.json") semantically!
- props: array of { ref: string, state: string } matching prop paths and their states (e.g. "mug_red_v1.json" for "红杯" or "杯子").
- action: { beats: string[] } list of action descriptions.
- dialogue: { speaker: string, text: string, voice_id: string } or null if no dialogue.
- voiceover: { speaker: string, text: string, voice_id: string } or null if no voiceover.
- budget: { tier: 'cheap', max_regen: 1 }
- prompt: { positive: string, negative: string } 
  IMPORTANT - This is a KEYFRAME IMAGE generation prompt. Must be detailed and production-ready:
  positive string format: "[aspect ratio] [shot type], [subject/action description with characters+props+scene elements], [lighting], [camera angle/framing], [quality keywords], [style/atmosphere]"
  Example positive: "16:9 cinematic wide shot, clean room interior with running machinery and yellow warning lines, two workers in white clean suits walking along designated path, bright industrial overhead lighting, eye-level angle, photorealistic, highly detailed, 8K, industrial documentary style"
  negative string format: Comma-separated list of things to AVOID in the generated image.
  Example negative: "blurry, low quality, distorted faces, wrong proportions, text artifacts, watermark, logo, extra limbs, missing safety equipment, dark lighting, cluttered background"
  Always include aspect ratio (16:9), quality keywords (photorealistic, highly detailed, 8K), and style reference.
- context_refs: array of strings. For shot N (N > 1), put "assets/renders/S(N-1)/keyframes/frame_01.jpg" for shot-to-shot continuity.

Return ONLY the raw JSON array. Do not wrap in markdown code blocks or quotes. Do not include extra text.`
        },
        {
          role: 'user',
          content: chunkText
        }
      ],
      temperature: 0.2
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

      const charRefs = [];
      if (fullText.includes('林澈') || fullText.includes('林') || fullText.toLowerCase().includes('protagonist')) {
        const char = characters.find(c => c.id === 'charA_v1');
        if (char) charRefs.push({ ref: char.file });
      }

      const propRefs = [];
      if (fullText.includes('红杯') || fullText.includes('杯') || fullText.toLowerCase().includes('mug')) {
        const prop = props.find(p => p.id === 'mug_red_v1');
        if (prop) {
          propRefs.push({
            ref: prop.file,
            state: fullText.includes('碎') ? 'broken' : 'story_clue'
          });
        }
      }

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
          speaker: '林澈',
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
          state_changes: {
            characters: charRefs.length ? {
              [characters.find(c => c.id === 'charA_v1')?.id || 'charA_v1']: {
                location: fullText.includes('地下室') ? 'basement' : (fullText.includes('走廊') ? 'hallway' : 'kitchen'),
                pose: dialogueText ? 'talking' : 'exploring'
              }
            } : {},
            props: propRefs.length ? {
              [props.find(p => p.id === 'mug_red_v1')?.id || 'mug_red_v1']: {
                state: fullText.includes('碎') ? 'broken' : 'story_clue'
              }
            } : {},
            scene: {
              lighting: fullText.includes('亮') ? 'warm lamp' : 'blue shadow'
            }
          },
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

  drafts.forEach(draft => {
    // Basic formatting safety
    draft.budget = draft.budget || { tier: 'cheap', max_regen: 1 };
    draft.prompt = draft.prompt || { positive: '', negative: '' };
    
    if (draft._draft_meta?.warnings?.length > 0) {
      report.conflicts.push({ shot: draft.shot_id, warnings: draft._draft_meta.warnings });
    }
    
    fs.writeFileSync(
      path.join(WORK_DIR, `shots_draft/${draft.shot_id}.json`),
      JSON.stringify(draft, null, 2)
    );
    
    // Write output state file states/SXXX_OUT.json
    const stateOut = {
      shot_id: draft.shot_id,
      characters: draft.characters?.length ? {
        'charA_v1': {
          location: draft.dialogue?.text ? 'apartment' : 'unknown',
          pose: draft.dialogue?.text ? 'speaking' : 'silent',
          outfit: 'white hoodie, dark pants'
        }
      } : {},
      props: draft.props?.length ? {
        'mug_red_v1': {
          location: 'near Lin Che',
          state: draft.props[0]?.state || 'warm'
        }
      } : {},
      scene: {
        lighting: 'night rain',
        weather: 'rain',
        time: 'midnight'
      }
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

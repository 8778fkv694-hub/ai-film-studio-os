import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir } = parseArgs();

if (!workDir || !fs.existsSync(workDir)) {
  console.error(`❌ Project working directory not found: ${workDir}`);
  process.exit(1);
}

// Check if --apply is passed
const args = process.argv.slice(2);
const isApply = args.includes('--apply');

console.log(`🔍 AI Film Studio OS - 连续性状态审计`);
console.log(`📂 工作项目目录: ${workDir}`);
console.log(`模式: ${isApply ? '应用并重写状态文件 (--apply)' : '只读审计模式'}\n`);

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

const projectPath = path.join(workDir, 'project.json');
if (!fs.existsSync(projectPath)) {
  console.error(`❌ project.json not found in ${workDir}`);
  process.exit(1);
}

const project = readJson(projectPath);
const timeline = project?.timeline || [];

if (timeline.length === 0) {
  console.log(`⚠️  项目 timeline 为空。`);
  process.exit(0);
}

const issues = [];
let currentState = {
  characters: {},
  props: {},
  scene: {
    lighting: '',
    weather: '',
    time: ''
  }
};

// Pre-load characters, props, scenes maps to retrieve IDs/Names
function loadInventory(type) {
  const dir = path.join(workDir, type);
  if (!fs.existsSync(dir)) return new Map();
  const list = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const obj = readJson(path.join(dir, f));
      if (!obj) return null;
      return [f.replace('.json', ''), obj];
    })
    .filter(Boolean);
  return new Map(list);
}

const charInventory = loadInventory('characters');
const propInventory = loadInventory('props');
const sceneInventory = loadInventory('scenes');

for (const item of timeline) {
  const shotId = item.shot_id;
  const shotFile = item.shot_file;
  const shotPath = path.join(workDir, shotFile);

  if (!fs.existsSync(shotPath)) {
    issues.push({
      shot_id: shotId,
      level: 'ERROR',
      code: 'MISSING_SHOT_FILE',
      message: `分镜文件不存在: ${shotFile}`
    });
    continue;
  }

  const shot = readJson(shotPath);
  if (!shot) {
    issues.push({
      shot_id: shotId,
      level: 'ERROR',
      code: 'INVALID_JSON',
      message: `无法解析分镜 JSON: ${shotFile}`
    });
    continue;
  }

  // 1. Establish state baseline
  let baselineState = JSON.parse(JSON.stringify(currentState));
  if (shot.continuity?.state_in_ref) {
    const customBaseline = readJson(path.join(workDir, shot.continuity.state_in_ref));
    if (customBaseline) {
      baselineState = customBaseline;
    } else {
      issues.push({
        shot_id: shotId,
        level: 'ERROR',
        code: 'MISSING_STATE_IN',
        message: `无法读取指定的 state_in_ref: ${shot.continuity.state_in_ref}`
      });
    }
  }

  // 2. Determine expected scene state for current shot
  const expectedState = JSON.parse(JSON.stringify(baselineState));

  // Auto-fill scene info from scene file
  if (shot.scene_ref) {
    const sceneKey = shot.scene_ref.replace('scenes/', '').replace('.json', '');
    const sceneObj = sceneInventory.get(sceneKey);
    if (sceneObj) {
      expectedState.scene.lighting = sceneObj.must_keep?.lighting || expectedState.scene.lighting || 'standard';
      expectedState.scene.weather = sceneObj.must_keep?.weather || expectedState.scene.weather || 'clear';
      expectedState.scene.time = sceneObj.must_keep?.time || expectedState.scene.time || 'day';
    }
  }

  // Auto-fill characters currently in shot
  const activeCharIds = new Set();
  for (const cRef of shot.characters || []) {
    const cKey = cRef.ref.replace('characters/', '').replace('.json', '');
    activeCharIds.add(cKey);
    const charObj = charInventory.get(cKey);
    const hair = charObj?.must_keep?.hair || '';
    const outfit = charObj?.must_keep?.outfit || '';

    // If character not present in expected state, add them
    if (!expectedState.characters[cKey]) {
      expectedState.characters[cKey] = {
        location: 'in_scene',
        pose: 'present',
        hair,
        outfit
      };
    } else {
      // Update location/pose to active
      expectedState.characters[cKey].location = 'in_scene';
      expectedState.characters[cKey].pose = 'present';
    }
  }

  // Mark other characters as out-of-scene (continuity check)
  for (const cKey in expectedState.characters) {
    if (!activeCharIds.has(cKey)) {
      expectedState.characters[cKey].location = 'out_of_scene';
      expectedState.characters[cKey].pose = 'absent';
    }
  }

  // Auto-fill props currently in shot
  const activePropIds = new Set();
  for (const pRef of shot.props || []) {
    const pKey = pRef.ref.replace('props/', '').replace('.json', '');
    activePropIds.add(pKey);
    expectedState.props[pKey] = {
      location: 'in_scene',
      state: pRef.state || 'displayed'
    };
  }

  // Mark other props as out-of-scene
  for (const pKey in expectedState.props) {
    if (!activePropIds.has(pKey)) {
      expectedState.props[pKey].location = 'out_of_scene';
      expectedState.props[pKey].state = 'absent';
    }
  }

  // Apply explicit manual state_changes if specified
  if (shot.continuity?.state_changes) {
    const sc = shot.continuity.state_changes;
    if (sc.characters) {
      for (const [k, v] of Object.entries(sc.characters)) {
        if (v === null) delete expectedState.characters[k];
        else expectedState.characters[k] = { ...expectedState.characters[k], ...v };
      }
    }
    if (sc.props) {
      for (const [k, v] of Object.entries(sc.props)) {
        if (v === null) delete expectedState.props[k];
        else expectedState.props[k] = { ...expectedState.props[k], ...v };
      }
    }
    if (sc.scene) {
      expectedState.scene = { ...expectedState.scene, ...sc.scene };
    }
  }

  expectedState.shot_id = shotId;

  // 3. Compare with physical state file or write it
  const actualStatePath = path.join(workDir, 'states', `${shotId}_OUT.json`);

  if (isApply) {
    // Generate/write expected output state
    const statesDir = path.join(workDir, 'states');
    if (!fs.existsSync(statesDir)) {
      fs.mkdirSync(statesDir, { recursive: true });
    }
    fs.writeFileSync(actualStatePath, JSON.stringify(expectedState, null, 2), 'utf-8');
    console.log(`💾 已写入状态文件: states/${shotId}_OUT.json`);
  } else {
    // Compare actual vs expected
    if (!fs.existsSync(actualStatePath)) {
      issues.push({
        shot_id: shotId,
        level: 'WARN',
        code: 'MISSING_STATE_OUT',
        message: `缺失输出状态文件: states/${shotId}_OUT.json`
      });
    } else {
      const actualState = readJson(actualStatePath);
      if (!actualState) {
        issues.push({
          shot_id: shotId,
          level: 'ERROR',
          code: 'INVALID_STATE_JSON',
          message: `无法解析状态 JSON: states/${shotId}_OUT.json`
        });
      } else {
        // Compare scene lighting
        if (actualState.scene?.lighting !== expectedState.scene.lighting) {
          issues.push({
            shot_id: shotId,
            level: 'WARN',
            code: 'LIGHTING_MISMATCH',
            message: `场景布光连续性不一致！预期: "${expectedState.scene.lighting}", 实际: "${actualState.scene?.lighting || 'none'}"`
          });
        }

        // Compare characters
        for (const charKey of Object.keys(expectedState.characters)) {
          const expChar = expectedState.characters[charKey];
          const actChar = actualState.characters?.[charKey];

          if (!actChar) {
            if (expChar.location === 'in_scene') {
              issues.push({
                shot_id: shotId,
                level: 'WARN',
                code: 'CHARACTER_MISSING_IN_STATE',
                message: `状态中缺少预期出场角色: "${charKey}"`
              });
            }
          } else {
            if (expChar.location === 'in_scene' && actChar.location === 'out_of_scene') {
              issues.push({
                shot_id: shotId,
                level: 'WARN',
                code: 'CHARACTER_LOCATION_MISMATCH',
                message: `角色 "${charKey}" 位置不一致！预期出镜，状态里却标记为出场。`
              });
            }
            if (expChar.outfit && actChar.outfit && expChar.outfit !== actChar.outfit) {
              issues.push({
                shot_id: shotId,
                level: 'WARN',
                code: 'CHARACTER_OUTFIT_MISMATCH',
                message: `角色 "${charKey}" 服装一致性改变！预期: "${expChar.outfit}", 实际: "${actChar.outfit}"`
              });
            }
          }
        }

        // Check for unexpected extra characters
        for (const charKey of Object.keys(actualState.characters || {})) {
          if (!expectedState.characters[charKey] && actualState.characters[charKey].location === 'in_scene') {
            issues.push({
              shot_id: shotId,
              level: 'WARN',
              code: 'UNEXPECTED_CHARACTER_IN_STATE',
              message: `状态中包含未在该分镜声明的角色: "${charKey}"`
            });
          }
        }

        // Compare props
        for (const propKey of Object.keys(expectedState.props)) {
          const expProp = expectedState.props[propKey];
          const actProp = actualState.props?.[propKey];

          if (!actProp) {
            if (expProp.location === 'in_scene') {
              issues.push({
                shot_id: shotId,
                level: 'WARN',
                code: 'PROP_MISSING_IN_STATE',
                message: `状态中缺少预期出场道具: "${propKey}"`
              });
            }
          } else {
            if (expProp.location === 'in_scene' && actProp.location === 'out_of_scene') {
              issues.push({
                shot_id: shotId,
                level: 'WARN',
                code: 'PROP_LOCATION_MISMATCH',
                message: `道具 "${propKey}" 位置不一致！预期出场，实际为出场。`
              });
            }
          }
        }
      }
    }
  }

  // Update current tracking state to the expected one for the next shot
  currentState = expectedState;
}

const reportsDir = path.join(workDir, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const reportPath = path.join(reportsDir, 'state-chain.report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  issues
}, null, 2), 'utf-8');

console.log(`\n🎉 连续性状态审计完成！`);
if (issues.length > 0) {
  console.warn(`⚠️  发现 ${issues.length} 处连续性问题/警告:`);
  issues.forEach(iss => {
    const icon = iss.level === 'ERROR' ? '❌' : '⚠️';
    console.warn(`   - [${iss.shot_id}] [${iss.code}] ${iss.message}`);
  });
} else {
  console.log(`✅ 完美！角色、道具、布光场景状态链条完全契合。`);
}
console.log(`📊 报告已写入: reports/state-chain.report.json`);

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir } = parseArgs();

if (!workDir || !fs.existsSync(workDir)) {
  console.error(`❌ Project working directory not found: ${workDir}`);
  process.exit(1);
}

console.log(`🔍 AI Film Studio OS - Prompt 质量评估`);
console.log(`📂 工作项目目录: ${workDir}\n`);

const promptsDir = path.join(workDir, 'prompts');
if (!fs.existsSync(promptsDir)) {
  console.error(`❌ Prompts directory not found: ${promptsDir}`);
  process.exit(1);
}

const promptFiles = fs.readdirSync(promptsDir)
  .filter(f => f.endsWith('.prompt.json'))
  .sort();

if (promptFiles.length === 0) {
  console.log(`⚠️  没有找到编译完成的 prompt.json 文件。`);
  process.exit(0);
}

const reports = [];

for (const file of promptFiles) {
  const filePath = path.join(promptsDir, file);
  try {
    const promptContent = fs.readFileSync(filePath, 'utf-8');
    const promptObj = JSON.parse(promptContent);
    const shotId = promptObj.shot_id || file.replace('.prompt.json', '');

    const pPrompt = promptObj.video_prompt || '';
    const nPrompt = promptObj.negative_prompt || '';
    const camMotion = promptObj.camera_motion || '';

    const issues = [];
    let score = 100;

    // Rule 1: Subject presence (characters)
    const characters = promptObj.structured_context?.characters || [];
    for (const char of characters) {
      const name = char.name?.toLowerCase();
      const id = char.id?.toLowerCase();
      if (name && !pPrompt.toLowerCase().includes(name) && id && !pPrompt.toLowerCase().includes(id)) {
        issues.push({
          severity: 'error',
          code: 'MISSING_CHARACTER',
          message: `提示词中缺少角色元素: "${char.name}" (${char.id})`
        });
        score -= 15;
      }
    }

    // Rule 2: Props presence
    const props = promptObj.structured_context?.props || [];
    for (const prop of props) {
      const name = prop.name?.toLowerCase();
      const id = prop.id?.toLowerCase();
      if (name && !pPrompt.toLowerCase().includes(name) && id && !pPrompt.toLowerCase().includes(id)) {
        issues.push({
          severity: 'warn',
          code: 'MISSING_PROP',
          message: `提示词中缺少道具元素: "${prop.name}" (${prop.id})`
        });
        score -= 10;
      }
    }

    // Rule 3: Scene presence
    const sceneName = promptObj.structured_context?.scene_name;
    if (sceneName && !pPrompt.toLowerCase().includes(sceneName.toLowerCase())) {
      issues.push({
        severity: 'error',
        code: 'MISSING_SCENE',
        message: `提示词中缺少场景描述: "${sceneName}"`
      });
      score -= 15;
    }

    // Rule 4: Action presence
    const actionBeats = promptObj.structured_context?.action_beats || [];
    let beatsFound = 0;
    for (const beat of actionBeats) {
      if (pPrompt.toLowerCase().includes(beat.toLowerCase())) {
        beatsFound++;
      }
    }
    if (actionBeats.length > 0 && beatsFound === 0) {
      issues.push({
        severity: 'error',
        code: 'MISSING_ACTION_BEATS',
        message: `提示词中未包含镜头的任何动作节拍 (action beats)。`
      });
      score -= 15;
    }

    // Rule 5: Camera motion presence
    const cameraMotionTerms = ['pan', 'zoom', 'tilt', 'tracking', 'dolly', 'camera', 'shot', 'angle', 'view', 'focus', 'slow motion', 'cinematic', 'movement', 'move'];
    const hasCameraMotion = cameraMotionTerms.some(term => pPrompt.toLowerCase().includes(term) || camMotion.toLowerCase().includes(term));
    if (!hasCameraMotion) {
      issues.push({
        severity: 'warn',
        code: 'MISSING_CAMERA_MOTION',
        message: `提示词中缺少镜头运动/构图描述。`
      });
      score -= 10;
    }

    // Rule 6: Prompt length
    const wordCount = pPrompt.split(/\s+/).filter(Boolean).length;
    if (wordCount > 120 || pPrompt.length > 1000) {
      issues.push({
        severity: 'warn',
        code: 'PROMPT_TOO_LONG',
        message: `提示词过长 (${wordCount} 单词, ${pPrompt.length} 字符)。可能会被生成引擎截断。`
      });
      score -= 10;
    } else if (wordCount < 10 || pPrompt.length < 50) {
      issues.push({
        severity: 'warn',
        code: 'PROMPT_TOO_SHORT',
        message: `提示词过短 (${wordCount} 单词, ${pPrompt.length} 字符)。细节描述可能不足。`
      });
      score -= 15;
    }

    // Rule 7: Negative prompt is empty
    if (!nPrompt || nPrompt.trim() === '' || nPrompt.toLowerCase() === 'todo') {
      issues.push({
        severity: 'warn',
        code: 'EMPTY_NEGATIVE_PROMPT',
        message: `负面提示词为空或为占位符。`
      });
      score -= 10;
    }

    // Rule 8: Semantic conflicts
    const conflicts = [
      { words: ['day', 'night'], message: '提示词中包含时间冲突词: "day" 与 "night"' },
      { words: ['indoor', 'outdoor'], message: '提示词中包含空间冲突词: "indoor" 与 "outdoor"' },
      { words: ['interior', 'exterior'], message: '提示词中包含空间冲突词: "interior" 与 "exterior"' },
      { words: ['dark', 'bright'], message: '提示词中包含光影冲突词: "dark" 与 "bright"' },
      { words: ['static', 'moving'], message: '提示词中包含运动冲突词: "static" 与 "moving"' }
    ];

    for (const conf of conflicts) {
      if (conf.words.every(w => pPrompt.toLowerCase().includes(w))) {
        issues.push({
          severity: 'error',
          code: 'SEMANTIC_CONFLICT',
          message: conf.message
        });
        score -= 20;
      }
    }

    score = Math.max(0, score);
    const status = score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor';

    // Update meta.quality inside individual prompt file
    if (!promptObj.meta) promptObj.meta = {};
    promptObj.meta.quality = { score, status, issues };
    fs.writeFileSync(filePath, JSON.stringify(promptObj, null, 2), 'utf-8');

    reports.push({
      shot_id: shotId,
      file,
      score,
      status,
      issues
    });

    console.log(`🎬 [${shotId}] 评分: ${score} (${status.toUpperCase()})`);
    issues.forEach(iss => {
      const icon = iss.severity === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon} [${iss.code}] ${iss.message}`);
    });
    if (issues.length === 0) {
      console.log(`   ✅ 提示词编译质量良好`);
    }
    console.log('');

  } catch (e) {
    console.error(`Error scoring file ${file}:`, e);
  }
}

const reportsDir = path.join(workDir, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}
const reportPath = path.join(reportsDir, 'prompt-score.report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  prompts: reports
}, null, 2), 'utf-8');

console.log(`📊 质量评估报告已保存到: reports/prompt-score.report.json`);

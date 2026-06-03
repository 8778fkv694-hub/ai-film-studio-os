import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir, projectRoot } = parseArgs();

function readJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFileIfExists(src, dest) {
  if (fs.existsSync(src)) {
    try {
      fs.copyFileSync(src, dest);
      return true;
    } catch (err) {
      console.warn(`[SeedancePack] Failed to copy ${src} to ${dest}:`, err.message);
    }
  }
  return false;
}

function findAndCopyRef(refPath, destAbs) {
  let srcAbs = path.join(workDir, refPath);
  if (fs.existsSync(srcAbs)) {
    return copyFileIfExists(srcAbs, destAbs);
  }
  srcAbs = path.join(projectRoot, refPath);
  if (fs.existsSync(srcAbs)) {
    return copyFileIfExists(srcAbs, destAbs);
  }
  return false;
}

function main() {
  const promptsDir = path.join(workDir, 'prompts');
  if (!fs.existsSync(promptsDir)) {
    console.error(`❌ Prompts directory not found: ${promptsDir}. Please run 'npm run check' first.`);
    process.exit(1);
  }

  // Support targeting a single shot via --shot parameter
  const onlyShotId = process.argv.includes('--shot')
    ? process.argv[process.argv.indexOf('--shot') + 1]
    : null;

  let promptFiles;
  if (onlyShotId) {
    const shotName = `S${String(onlyShotId).padStart(3, '0')}`;
    const pFile = path.join(promptsDir, `${shotName}.prompt.json`);
    const pFileAlt = path.join(promptsDir, `${onlyShotId}.prompt.json`);
    if (fs.existsSync(pFile)) {
      promptFiles = [`${shotName}.prompt.json`];
    } else if (fs.existsSync(pFileAlt)) {
      promptFiles = [`${onlyShotId}.prompt.json`];
    } else {
      console.error(`❌ Prompt file for shot ${onlyShotId} not found.`);
      process.exit(1);
    }
  } else {
    promptFiles = fs.readdirSync(promptsDir).filter(f => f.endsWith('.prompt.json'));
  }

  if (promptFiles.length === 0) {
    console.warn(`⚠️ No prompt specifications found in ${promptsDir}`);
    return;
  }

  console.log(`[SeedancePack] Compiling Seedance 2.0 task packages for ${promptFiles.length} shot(s)...`);

  const packagesBaseDir = path.join(workDir, 'exports/seedance_packages');
  ensureDir(packagesBaseDir);

  for (const f of promptFiles) {
    const specPath = path.join(promptsDir, f);
    const spec = readJson(specPath);
    if (!spec || !spec.shot_id) {
      console.warn(`[SeedancePack] Skipping invalid spec: ${f}`);
      continue;
    }

    const shotId = spec.shot_id;
    const packDir = path.join(packagesBaseDir, shotId);
    const refsDir = path.join(packDir, 'references');
    ensureDir(packDir);
    ensureDir(refsDir);

    // 1. Write text files
    fs.writeFileSync(path.join(packDir, 'prompt.txt'), spec.video_prompt || '', 'utf-8');
    fs.writeFileSync(path.join(packDir, 'negative_prompt.txt'), spec.negative_prompt || '', 'utf-8');

    let dialogueText = '';
    if (spec.structured_context?.voiceover) {
      dialogueText += `Voiceover (${spec.structured_context.voiceover.speaker || 'Narrator'}): ${spec.structured_context.voiceover.text}\n`;
    }
    if (spec.structured_context?.dialogue) {
      dialogueText += `Dialogue (${spec.structured_context.dialogue.speaker || 'Character'}): ${spec.structured_context.dialogue.text}\n`;
    }
    fs.writeFileSync(path.join(packDir, 'dialogue.txt'), dialogueText.trim(), 'utf-8');

    // 2. Copy reference images
    const copiedRefs = [];

    // Predecessor/Context Keyframes
    const contextList = spec.context_refs?.available || [];
    contextList.forEach((refPath, idx) => {
      const ext = path.extname(refPath) || '.jpg';
      const destName = `00_context_prev_tail_${idx + 1}${ext}`;
      const destAbs = path.join(refsDir, destName);
      if (findAndCopyRef(refPath, destAbs)) {
        copiedRefs.push({ type: 'Context Frame', name: destName, note: 'Previous shot tail keyframe for visual continuity' });
      }
    });

    // Current Shot Keyframes (Conditioning Keyframes)
    const keyframesList = spec.conditioning_keyframes || [];
    keyframesList.forEach((refPath, idx) => {
      const ext = path.extname(refPath) || '.png';
      const destName = `00_conditioning_keyframe_${idx + 1}${ext}`;
      const destAbs = path.join(refsDir, destName);
      if (findAndCopyRef(refPath, destAbs)) {
        copiedRefs.push({ type: 'Conditioning Keyframe', name: destName, note: 'Current shot keyframe for generation reference' });
      }
    });

    // Scene/Character/Prop reference assets
    const refList = spec.reference_images || [];
    refList.forEach(ref => {
      if (!ref.path) return;
      const ext = path.extname(ref.path) || '.png';
      const destName = `${ref.kind}_${ref.id}${ext}`;
      const destAbs = path.join(refsDir, destName);
      if (findAndCopyRef(ref.path, destAbs)) {
        copiedRefs.push({ type: ref.kind.replace('_', ' '), name: destName, note: ref.note || '' });
      }
    });

    // 3. Write README.md mapping guide
    const readmeContent = [
      `# Seedance 2.0 任务包 - ${shotId}`,
      '',
      '本任务包专为字节跳动 **Seedance 2.0** 视频大模型设计，已自动打包所需的正反提示词、对白配音文本及所有连续性图像参考资产。',
      '',
      '## 📋 镜头基本信息 (Shot Info)',
      `- **镜头 ID**: \`${shotId}\``,
      `- **建议时长**: ${spec.duration_s || 4} 秒`,
      `- **机位意图**: ${spec.camera_motion || spec.camera_intent || '默认'}`,
      spec.continuity_locks ? `- **连续性锁定**: ${spec.continuity_locks}` : '',
      '',
      '## 📝 提示词指令 (Prompts)',
      '',
      '### 正向提示词 (Positive Prompt):',
      '```text',
      spec.video_prompt || '',
      '```',
      '',
      '### 反向提示词 (Negative Prompt):',
      '```text',
      spec.negative_prompt || '',
      '```',
      '',
      '## 🔊 口型同步与配音 (Dialogue & Voiceover)',
      dialogueText.trim() ? [
        '请在 Seedance 语音输入/配音（Audio/Lip-sync Script）文本框中贴入以下文本，并选择合适的音色：',
        '```text',
        dialogueText.trim(),
        '```'
      ].join('\n') : '*本镜头无配音/旁白*',
      '',
      '## 🖼️ 图像资产上传指引 (Image Reference Mapping)',
      '请根据下表，将 `references/` 目录下的图片手动上传到 Seedance 网页端的对应栏位中：',
      '',
      '| 文件名 | 类型 (Slot) | 作用/说明 (Use For) |',
      '| :--- | :--- | :--- |',
      ...copiedRefs.map(r => `| \`references/${r.name}\` | **${r.type}** | ${r.note} |`),
      '',
      '---',
      '*由 AI Film Studio OS - Seedance 任务编译器自动生成。*'
    ].join('\n');

    fs.writeFileSync(path.join(packDir, 'README.md'), readmeContent, 'utf-8');
    console.log(`[SeedancePack] Compiled package for ${shotId} -> exports/seedance_packages/${shotId}`);
  }

  console.log(`[SeedancePack] Compilation finished. Total packages generated in exports/seedance_packages/`);
}

main();

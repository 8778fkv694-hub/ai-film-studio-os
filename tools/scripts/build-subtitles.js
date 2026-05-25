import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir } = parseArgs();

if (!workDir || !fs.existsSync(workDir)) {
  console.error(`❌ Project working directory not found: ${workDir}`);
  process.exit(1);
}

console.log(`🔍 AI Film Studio OS - 字幕生成`);
console.log(`📂 工作项目目录: ${workDir}\n`);

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
  console.log(`⚠️  项目 timeline 为空，无法生成字幕。`);
  process.exit(0);
}

function formatTime(seconds, isVtt = false) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const msDelim = isVtt ? '.' : ',';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${msDelim}${String(ms).padStart(3, '0')}`;
}

let srtContent = '';
let vttContent = 'WEBVTT\n\n';
const jsonSubtitles = [];

let subtitleIndex = 1;
let startTime = 0;

for (const item of timeline) {
  const shotId = item.shot_id;
  const shotFile = item.shot_file;
  const shotPath = path.join(workDir, shotFile);

  if (!fs.existsSync(shotPath)) continue;

  const shot = readJson(shotPath);
  if (!shot) continue;

  const duration = shot.duration_s || 5;
  const text = shot.voiceover?.text || shot.dialogue?.text || '';

  if (!text.trim()) {
    startTime += duration;
    continue;
  }

  // Split by punctuation to split long sentences across subtitle blocks
  const sentences = text.split(/(?<=[。，,.;；!！?？])/).map(s => s.trim()).filter(Boolean);
  const sentenceDuration = duration / sentences.length;

  for (let i = 0; i < sentences.length; i++) {
    const sStart = startTime + i * sentenceDuration;
    const sEnd = startTime + (i + 1) * sentenceDuration;
    const sentenceText = sentences[i];

    // SRT format
    srtContent += `${subtitleIndex}\n${formatTime(sStart)} --> ${formatTime(sEnd)}\n${sentenceText}\n\n`;

    // VTT format
    vttContent += `${formatTime(sStart, true)} --> ${formatTime(sEnd, true)}\n${sentenceText}\n\n`;

    // JSON format
    jsonSubtitles.push({
      index: subtitleIndex,
      shot_id: shotId,
      start_time: sStart,
      end_time: sEnd,
      text: sentenceText
    });

    subtitleIndex++;
  }

  startTime += duration;
}

const exportsDir = path.join(workDir, 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

fs.writeFileSync(path.join(exportsDir, 'subtitles.srt'), srtContent, 'utf-8');
fs.writeFileSync(path.join(exportsDir, 'subtitles.vtt'), vttContent, 'utf-8');
fs.writeFileSync(path.join(exportsDir, 'subtitles.json'), JSON.stringify(jsonSubtitles, null, 2), 'utf-8');

console.log(`🎉 字幕文件编译完成！`);
console.log(`   - SRT: exports/subtitles.srt (${jsonSubtitles.length} 行)`);
console.log(`   - VTT: exports/subtitles.vtt`);
console.log(`   - JSON: exports/subtitles.json`);

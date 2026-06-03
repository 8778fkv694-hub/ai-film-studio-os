import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { writeJsonAtomic } from './fs-atomic';

export const SHOT_ID_RE = /^[A-Za-z0-9_-]+$/;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function readJson(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeJson(filePath: string, value: any): void {
  // 原子写：避免 order/split 多文件变更或并发请求写坏 project.json / 镜头 JSON
  writeJsonAtomic(filePath, value);
}

export function parseShotSequenceId(shotId: string): { base: string; suffix: string } {
  const match = shotId.match(/^([A-Za-z]*\d+)([A-Z]*)$/);
  if (!match) return { base: shotId, suffix: '' };
  return { base: match[1], suffix: match[2] || '' };
}

export function suffixFromIndex(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

export function bestKeyframeRef(projectPath: string, shotId: string, prefer: 'first' | 'last' = 'last'): string | null {
  const dir = path.join(projectPath, 'assets', 'renders', shotId, 'keyframes');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(file => IMAGE_EXTS.has(path.extname(file).toLowerCase()))
    .sort();
  if (files.length === 0) return null;

  const candidates = prefer === 'first'
    ? ['frame_00.jpg', 'frame_00.png', 'frame_01.jpg', 'frame_01.png']
    : ['frame_last.jpg', 'frame_last.png', 'keyframe.jpg', 'frame_00.jpg', 'frame_00.png'];
  const picked = candidates.find(file => files.includes(file)) || (prefer === 'first' ? files[0] : files[files.length - 1]);
  return `assets/renders/${shotId}/keyframes/${picked}`;
}

export function replaceShotIdsInString(input: string, idMap: Map<string, string>): string {
  let out = input;
  for (const [oldId, newId] of Array.from(idMap.entries())) {
    if (oldId === newId) continue;
    out = out
      .replaceAll(`assets/renders/${oldId}/`, `assets/renders/${newId}/`)
      .replaceAll(`/renders/${oldId}/`, `/renders/${newId}/`)
      .replaceAll(`states/${oldId}_OUT.json`, `states/${newId}_OUT.json`)
      .replaceAll(`${oldId}.prompt.json`, `${newId}.prompt.json`)
      .replaceAll(`${oldId}.final.json`, `${newId}.final.json`)
      .replaceAll(`${oldId}.image.json`, `${newId}.image.json`);
    if (out === oldId) out = newId;
  }
  return out;
}

export function replaceShotIdsDeep(value: any, idMap: Map<string, string>): any {
  if (typeof value === 'string') return replaceShotIdsInString(value, idMap);
  if (Array.isArray(value)) return value.map(item => replaceShotIdsDeep(item, idMap));
  if (value && typeof value === 'object') {
    const next: any = {};
    for (const [key, val] of Object.entries(value)) {
      next[key] = replaceShotIdsDeep(val, idMap);
    }
    return next;
  }
  return value;
}

function resourcePairs(projectPath: string, shotId: string): Array<{ src: string; destFor: (newId: string) => string }> {
  return [
    { src: path.join(projectPath, 'shots', `${shotId}.json`), destFor: newId => path.join(projectPath, 'shots', `${newId}.json`) },
    { src: path.join(projectPath, 'assets', 'renders', shotId), destFor: newId => path.join(projectPath, 'assets', 'renders', newId) },
    { src: path.join(projectPath, 'assets', 'audio', `${shotId}.mp3`), destFor: newId => path.join(projectPath, 'assets', 'audio', `${newId}.mp3`) },
    { src: path.join(projectPath, 'assets', 'audio', `${shotId}.wav`), destFor: newId => path.join(projectPath, 'assets', 'audio', `${newId}.wav`) },
    { src: path.join(projectPath, 'assets', 'audio', `${shotId}.m4a`), destFor: newId => path.join(projectPath, 'assets', 'audio', `${newId}.m4a`) },
    { src: path.join(projectPath, 'prompts', `${shotId}.prompt.json`), destFor: newId => path.join(projectPath, 'prompts', `${newId}.prompt.json`) },
    { src: path.join(projectPath, 'prompts', `${shotId}.final.json`), destFor: newId => path.join(projectPath, 'prompts', `${newId}.final.json`) },
    { src: path.join(projectPath, 'prompts', 'image', `${shotId}.image.json`), destFor: newId => path.join(projectPath, 'prompts', 'image', `${newId}.image.json`) },
    { src: path.join(projectPath, 'states', `${shotId}_OUT.json`), destFor: newId => path.join(projectPath, 'states', `${newId}_OUT.json`) },
  ];
}

export function renameShotResources(projectPath: string, idMap: Map<string, string>): void {
  const moves: Array<{ src: string; temp: string; dest: string }> = [];
  const plannedSources = new Set<string>();
  const plannedDests = new Set<string>();
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  for (const [oldId, newId] of Array.from(idMap.entries())) {
    if (oldId === newId) continue;
    for (const pair of resourcePairs(projectPath, oldId)) {
      if (!fs.existsSync(pair.src)) continue;
      plannedSources.add(pair.src);
      const temp = `${pair.src}.renaming-${stamp}`;
      const dest = pair.destFor(newId);
      if (plannedDests.has(dest)) {
        throw new Error(`重命名目标重复，无法安全处理: ${dest}`);
      }
      plannedDests.add(dest);
      moves.push({ src: pair.src, temp, dest });
    }
  }

  for (const move of moves) {
    if (fs.existsSync(move.dest) && !plannedSources.has(move.dest)) {
      throw new Error(`目标资源已存在，无法安全重命名: ${move.dest}`);
    }
  }

  const completed: Array<{ src: string; dest: string }> = [];
  try {
    for (const move of moves) {
      fs.renameSync(move.src, move.temp);
    }

    for (const move of moves) {
      fs.mkdirSync(path.dirname(move.dest), { recursive: true });
      fs.renameSync(move.temp, move.dest);
      completed.push({ src: move.src, dest: move.dest });
    }
  } catch (err) {
    for (const move of completed.reverse()) {
      try {
        if (fs.existsSync(move.dest) && !fs.existsSync(move.src)) {
          fs.renameSync(move.dest, move.src);
        }
      } catch {}
    }
    for (const move of moves) {
      try {
        if (fs.existsSync(move.temp) && !fs.existsSync(move.src)) {
          fs.renameSync(move.temp, move.src);
        }
      } catch {}
    }
    throw err;
  }
}

export function removeShotResources(projectPath: string, shotId: string): void {
  const paths = [
    path.join(projectPath, 'shots', `${shotId}.json`),
    path.join(projectPath, 'assets', 'renders', shotId),
    path.join(projectPath, 'assets', 'audio', `${shotId}.mp3`),
    path.join(projectPath, 'assets', 'audio', `${shotId}.wav`),
    path.join(projectPath, 'assets', 'audio', `${shotId}.m4a`),
    path.join(projectPath, 'prompts', `${shotId}.prompt.json`),
    path.join(projectPath, 'prompts', `${shotId}.final.json`),
    path.join(projectPath, 'prompts', 'image', `${shotId}.image.json`),
    path.join(projectPath, 'states', `${shotId}_OUT.json`),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }
}

export function updateRenamedJsonContent(projectPath: string, idMap: Map<string, string>): void {
  const files: string[] = [];
  const addJsonFiles = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) addJsonFiles(full);
      else if (file.endsWith('.json')) files.push(full);
    }
  };
  addJsonFiles(path.join(projectPath, 'shots'));
  addJsonFiles(path.join(projectPath, 'assets', 'renders'));
  addJsonFiles(path.join(projectPath, 'prompts'));
  addJsonFiles(path.join(projectPath, 'states'));

  for (const file of files) {
    const data = readJson(file);
    if (!data) continue;
    writeJson(file, replaceShotIdsDeep(data, idMap));
  }
}

export function relinkContextRefs(projectPath: string, timeline: any[], shotIds: Set<string>): void {
  for (const shotId of Array.from(shotIds)) {
    const idx = timeline.findIndex(item => item.shot_id === shotId);
    const shotPath = path.join(projectPath, 'shots', `${shotId}.json`);
    const shot = readJson(shotPath);
    if (!shot) continue;
    if (idx <= 0) {
      shot.context_refs = [];
    } else {
      const prevId = timeline[idx - 1]?.shot_id;
      const ref = prevId ? bestKeyframeRef(projectPath, prevId, 'last') : null;
      shot.context_refs = ref ? [ref] : [];
    }
    writeJson(shotPath, shot);
  }
}

/**
 * 事务包裹 order/split 这类多文件结构变更（重命名磁盘资源 + 深改 JSON + 删除）。
 * order/split 会跨 shots/prompts/states/renders 改动，且 renameShotResources 自身的
 * 回滚无法覆盖“重命名成功之后、写 project.json 失败”这类半完成状态。
 *
 * 策略：操作前按受影响的 base 组快照——整份 shots/prompts/states + project.json（都很小），
 * 以及这些 base 下的 assets/renders/<id> 与 assets/audio/<id>.*（仅相关镜头的媒体）。
 * fn 抛错则把这些范围整体还原（删除当前的旧/新 id 产物，再从快照拷回），可同时撤销
 * 重命名、深改与删除；成功则删除快照。派生且非致命的 rebuildPromptPackages 应放在事务外。
 */
export async function withShotTransaction<T>(
  projectPath: string,
  affectedBases: Set<string>,
  fn: () => Promise<T> | T
): Promise<T> {
  const baseOf = (id: string) => parseShotSequenceId(id).base;
  const inScope = (id: string) => affectedBases.has(baseOf(id));
  const textDirs = ['shots', 'prompts', 'states'];
  const rendersDir = path.join(projectPath, 'assets', 'renders');
  const audioDir = path.join(projectPath, 'assets', 'audio');
  const projJson = path.join(projectPath, 'project.json');

  const backupDir = path.join(projectPath, '.local', `tx-${crypto.randomUUID()}`);
  const backupRenders = path.join(backupDir, 'assets', 'renders');
  const backupAudio = path.join(backupDir, 'assets', 'audio');
  fs.mkdirSync(backupDir, { recursive: true });

  // 快照：小文本树整份 + project.json
  for (const d of textDirs) {
    const src = path.join(projectPath, d);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(backupDir, d), { recursive: true });
  }
  if (fs.existsSync(projJson)) fs.copyFileSync(projJson, path.join(backupDir, 'project.json'));

  // 快照：受影响 base 组的媒体（renders 目录 + audio 文件）
  if (fs.existsSync(rendersDir)) {
    for (const id of fs.readdirSync(rendersDir)) {
      if (!inScope(id)) continue;
      fs.mkdirSync(backupRenders, { recursive: true });
      fs.cpSync(path.join(rendersDir, id), path.join(backupRenders, id), { recursive: true });
    }
  }
  if (fs.existsSync(audioDir)) {
    for (const f of fs.readdirSync(audioDir)) {
      if (!inScope(f.replace(/\.[^.]+$/, ''))) continue;
      fs.mkdirSync(backupAudio, { recursive: true });
      fs.copyFileSync(path.join(audioDir, f), path.join(backupAudio, f));
    }
  }

  try {
    const result = await fn();
    fs.rmSync(backupDir, { recursive: true, force: true });
    return result;
  } catch (err) {
    try {
      // 还原文本树：清空后拷回快照（撤销重命名/新建/深改/删除）
      for (const d of textDirs) {
        const cur = path.join(projectPath, d);
        fs.rmSync(cur, { recursive: true, force: true });
        const bak = path.join(backupDir, d);
        if (fs.existsSync(bak)) fs.cpSync(bak, cur, { recursive: true });
      }
      const bakProj = path.join(backupDir, 'project.json');
      if (fs.existsSync(bakProj)) fs.copyFileSync(bakProj, projJson);

      // 还原媒体：先删掉范围内所有（含重命名后的新 id）产物，再拷回快照里的原件
      if (fs.existsSync(rendersDir)) {
        for (const id of fs.readdirSync(rendersDir)) {
          if (inScope(id)) fs.rmSync(path.join(rendersDir, id), { recursive: true, force: true });
        }
      }
      if (fs.existsSync(backupRenders)) {
        for (const id of fs.readdirSync(backupRenders)) {
          fs.cpSync(path.join(backupRenders, id), path.join(rendersDir, id), { recursive: true });
        }
      }
      if (fs.existsSync(audioDir)) {
        for (const f of fs.readdirSync(audioDir)) {
          if (inScope(f.replace(/\.[^.]+$/, ''))) fs.rmSync(path.join(audioDir, f), { force: true });
        }
      }
      if (fs.existsSync(backupAudio)) {
        fs.mkdirSync(audioDir, { recursive: true });
        for (const f of fs.readdirSync(backupAudio)) {
          fs.copyFileSync(path.join(backupAudio, f), path.join(audioDir, f));
        }
      }
    } finally {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
    throw err;
  }
}

export async function rebuildPromptPackages(projectPath: string): Promise<Array<{ script: string; code: number; stdout: string; stderr: string }>> {
  const rootDir = path.resolve(process.cwd(), '..');
  const scripts = ['build-project-context.js', 'build-image-prompts.js', 'build-prompts.js'];
  const results = [];

  for (const script of scripts) {
    const scriptPath = path.join(rootDir, 'tools', 'scripts', script);
    const result = await new Promise<{ script: string; code: number; stdout: string; stderr: string }>((resolve) => {
      execFile('node', [scriptPath, '--project-dir', projectPath], { cwd: rootDir, timeout: 120000 }, (error, stdout, stderr) => {
        resolve({
          script,
          code: error ? (typeof (error as any).code === 'number' ? (error as any).code : 1) : 0,
          stdout,
          stderr
        });
      });
    });
    results.push(result);
  }

  return results;
}

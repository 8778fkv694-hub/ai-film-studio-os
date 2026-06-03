import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getCurrentProjectPath } from '@/lib/projects';
import {
  SHOT_ID_RE,
  parseShotSequenceId,
  readJson,
  rebuildPromptPackages,
  relinkContextRefs,
  renameShotResources,
  replaceShotIdsDeep,
  suffixFromIndex,
  updateRenamedJsonContent,
  writeJson
} from '@/lib/shot-sequence';

function splitTextAtRatio(text: string | undefined, ratio: number): [string, string] {
  const value = String(text || '').trim();
  if (!value) return ['', ''];

  const clauses: string[] = [];
  const parts = value.split(/([。，；！？\.,;!\?])/).filter(Boolean);
  for (const part of parts) {
    if (/^[。，；！？\.,;!\?]$/.test(part) && clauses.length > 0) {
      clauses[clauses.length - 1] += part;
    } else {
      clauses.push(part);
    }
  }

  if (clauses.length <= 1) {
    const cut = Math.max(1, Math.min(value.length - 1, Math.round(value.length * ratio)));
    return [value.slice(0, cut).trim(), value.slice(cut).trim()];
  }

  const total = clauses.reduce((sum, item) => sum + item.length, 0);
  const target = total * ratio;
  let acc = 0;
  let cutIndex = 1;
  for (let i = 0; i < clauses.length; i++) {
    acc += clauses[i].length;
    if (acc >= target) {
      cutIndex = Math.max(1, Math.min(i + 1, clauses.length - 1));
      break;
    }
  }

  return [clauses.slice(0, cutIndex).join('').trim(), clauses.slice(cutIndex).join('').trim()];
}

function splitArrayAtRatio(items: any[] | undefined, ratio: number): [any[], any[]] {
  const arr = Array.isArray(items) ? items : [];
  if (arr.length <= 1) return [arr, []];
  const cut = Math.max(1, Math.min(arr.length - 1, Math.round(arr.length * ratio)));
  return [arr.slice(0, cut), arr.slice(cut)];
}

function clonePublicShot(shot: any): any {
  const next: any = {};
  for (const [key, value] of Object.entries(shot)) {
    if (key.startsWith('_')) continue;
    next[key] = value;
  }
  return JSON.parse(JSON.stringify(next));
}

function buildSplitPair(src: any, fromShotId: string, time: number, mediaDuration: number | null): { before: any; after: any; ratio: number } {
  const originalDuration = Number(src.duration_s) > 0 ? Number(src.duration_s) : 5;
  const ratioSource = mediaDuration && mediaDuration > 0 ? time / mediaDuration : time / originalDuration;
  const ratio = Math.max(0.05, Math.min(0.95, Number.isFinite(ratioSource) ? ratioSource : 0.5));
  const beforeDuration = Math.max(1, Math.round(originalDuration * ratio * 10) / 10);
  const afterDuration = Math.max(1, Math.round((originalDuration - beforeDuration) * 10) / 10);

  const before = clonePublicShot(src);
  const after = clonePublicShot(src);
  before.duration_s = beforeDuration;
  after.duration_s = afterDuration;

  const [beforeBeats, afterBeats] = splitArrayAtRatio(src.action?.beats, ratio);
  before.action = { ...(before.action || {}), beats: beforeBeats };
  after.action = { ...(after.action || {}), beats: afterBeats };

  if (src.voiceover?.text) {
    const [a, b] = splitTextAtRatio(src.voiceover.text, ratio);
    before.voiceover = { ...src.voiceover, text: a };
    after.voiceover = { ...src.voiceover, text: b };
  }
  if (src.dialogue?.text) {
    const [a, b] = splitTextAtRatio(src.dialogue.text, ratio);
    before.dialogue = { ...src.dialogue, text: a };
    after.dialogue = { ...src.dialogue, text: b };
  }
  if (src.prompt?.positive) {
    const [a, b] = splitTextAtRatio(src.prompt.positive, ratio);
    before.prompt = { ...(before.prompt || {}), positive: a || src.prompt.positive, negative: src.prompt.negative || '' };
    after.prompt = { ...(after.prompt || {}), positive: b || src.prompt.positive, negative: src.prompt.negative || '' };
  }

  const parentContext = {
    voiceover_full: src.voiceover?.text || null,
    dialogue_full: src.dialogue?.text || null,
    action_beats_full: Array.isArray(src.action?.beats) ? src.action.beats : []
  };

  before.parent_context = parentContext;
  after.parent_context = parentContext;
  before.split_reason = `manual split from ${fromShotId} at ${time.toFixed(3)}s`;
  after.split_reason = `manual split from ${fromShotId} at ${time.toFixed(3)}s`;
  before._split_from = { shot_id: fromShotId, time, media_duration: mediaDuration };
  after._split_from = { shot_id: fromShotId, time, media_duration: mediaDuration };

  return { before, after, ratio };
}

export async function POST(request: Request) {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return NextResponse.json({ error: 'No active project found' }, { status: 404 });
  }

  const createdFiles: string[] = [];
  try {
    const formData = await request.formData();
    const fromShotId = String(formData.get('from_shot_id') || '');
    const time = Number(formData.get('time') || 0);
    const mediaDurationRaw = Number(formData.get('media_duration') || 0);
    const mediaDuration = Number.isFinite(mediaDurationRaw) && mediaDurationRaw > 0 ? mediaDurationRaw : null;
    const file = formData.get('file');

    if (!SHOT_ID_RE.test(fromShotId) || !Number.isFinite(time) || time < 0) {
      return NextResponse.json({ error: '无效拆分参数' }, { status: 400 });
    }

    const shotsDir = path.join(projectPath, 'shots');
    const fromPath = path.join(shotsDir, `${fromShotId}.json`);
    const projectJsonPath = path.join(projectPath, 'project.json');
    const project = readJson(projectJsonPath);
    const src = readJson(fromPath);
    if (!project || !Array.isArray(project.timeline)) {
      return NextResponse.json({ error: 'project.json timeline 无效' }, { status: 500 });
    }
    if (!src) {
      return NextResponse.json({ error: `源镜头不存在: ${fromShotId}` }, { status: 404 });
    }

    const sourceIndex = project.timeline.findIndex((item: any) => item.shot_id === fromShotId);
    if (sourceIndex < 0) {
      return NextResponse.json({ error: `源镜头不在 timeline 中: ${fromShotId}` }, { status: 404 });
    }

    const { base } = parseShotSequenceId(fromShotId);
    const { before, after, ratio } = buildSplitPair(src, fromShotId, time, mediaDuration);
    const placeholderId = `__NEW_SPLIT_${Date.now()}__`;
    const nextTimeline = project.timeline.map((item: any) => ({ ...item }));
    const sourceEntry = nextTimeline[sourceIndex];
    nextTimeline.splice(sourceIndex + 1, 0, {
      shot_id: placeholderId,
      shot_file: '',
      tier: sourceEntry.tier || before.budget?.tier || 'standard',
      duration_s: after.duration_s
    });

    const groupEntries = nextTimeline
      .map((item: any, index: number) => ({ item, index }))
      .filter(({ item }: any) => item.shot_id === placeholderId || parseShotSequenceId(item.shot_id).base === base);

    const finalIdByTimelineIndex = new Map<number, string>();
    groupEntries.forEach(({ index }: any, order: number) => {
      finalIdByTimelineIndex.set(index, `${base}${suffixFromIndex(order)}`);
    });

    const idMap = new Map<string, string>();
    for (const { item, index } of groupEntries as any[]) {
      if (item.shot_id !== placeholderId) {
        const finalId = finalIdByTimelineIndex.get(index)!;
        if (item.shot_id !== finalId) idMap.set(item.shot_id, finalId);
      }
    }

    renameShotResources(projectPath, idMap);
    updateRenamedJsonContent(projectPath, idMap);

    const actualSourceId = idMap.get(fromShotId) || fromShotId;
    const newShotId = finalIdByTimelineIndex.get(sourceIndex + 1)!;
    const affectedIds = new Set<string>();

    for (const { item, index } of groupEntries as any[]) {
      const finalId = finalIdByTimelineIndex.get(index)!;
      item.shot_id = finalId;
      item.shot_file = `shots/${finalId}.json`;
      affectedIds.add(finalId);
    }

    const groupCount = groupEntries.length;
    for (const { item, index } of groupEntries as any[]) {
      const shotId = item.shot_id;
      const shotPath = path.join(shotsDir, `${shotId}.json`);
      let shot = readJson(shotPath) || {};
      if (shotId === actualSourceId) shot = before;
      if (shotId === newShotId) shot = after;
      shot = replaceShotIdsDeep(shot, idMap);
      shot.shot_id = shotId;
      shot.parent_shot_id = base;
      shot.segment_index = (groupEntries as any[]).findIndex(entry => entry.item.shot_id === shotId) + 1;
      shot.segment_count = groupCount;
      item.duration_s = shot.duration_s || item.duration_s || 5;
      writeJson(shotPath, shot);
    }

    const nextAfterGroup = nextTimeline[groupEntries[groupEntries.length - 1].index + 1]?.shot_id;
    if (nextAfterGroup) affectedIds.add(nextAfterGroup);

    project.timeline = nextTimeline;
    writeJson(projectJsonPath, project);

    if (file instanceof File) {
      const kfDir = path.join(projectPath, 'assets', 'renders', newShotId, 'keyframes');
      fs.mkdirSync(kfDir, { recursive: true });
      const framePath = path.join(kfDir, 'frame_00.jpg');
      const bytes = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(framePath, bytes);
      createdFiles.push(framePath);
    }

    relinkContextRefs(projectPath, project.timeline, affectedIds);
    const promptResults = await rebuildPromptPackages(projectPath);
    const promptFailed = promptResults.find(result => result.code !== 0);

    return NextResponse.json({
      success: true,
      new_shot_id: newShotId,
      source_shot_id: actualSourceId,
      renamed: Object.fromEntries(idMap.entries()),
      ratio,
      prompt_rebuild: {
        success: !promptFailed,
        results: promptResults.map(result => ({
          script: result.script,
          code: result.code,
          stderr: result.stderr.slice(0, 1200)
        }))
      }
    });
  } catch (e: any) {
    for (const file of createdFiles) {
      try { if (fs.existsSync(file)) fs.rmSync(file, { force: true }); } catch {}
    }
    return NextResponse.json({ error: e.message || '拆分镜头失败' }, { status: 500 });
  }
}


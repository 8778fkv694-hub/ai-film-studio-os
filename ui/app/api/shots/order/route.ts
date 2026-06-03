import path from 'path';
import { NextResponse } from 'next/server';
import { getCurrentProjectPath } from '@/lib/projects';
import {
  SHOT_ID_RE,
  parseShotSequenceId,
  readJson,
  rebuildPromptPackages,
  relinkContextRefs,
  removeShotResources,
  renameShotResources,
  replaceShotIdsDeep,
  suffixFromIndex,
  updateRenamedJsonContent,
  writeJson
} from '@/lib/shot-sequence';

function affectedWindow(timeline: any[], index: number): Set<string> {
  const ids = new Set<string>();
  for (const i of [index - 1, index, index + 1]) {
    const id = timeline[i]?.shot_id;
    if (id) ids.add(id);
  }
  return ids;
}

function renumberGroup(projectPath: string, project: any, base: string): { renamed: Record<string, string>; affected: Set<string> } {
  const group = project.timeline
    .map((item: any, index: number) => ({ item, index }))
    .filter(({ item }: any) => parseShotSequenceId(item.shot_id).base === base);

  const affected = new Set<string>();
  const idMap = new Map<string, string>();
  if (group.length > 0) {
    group.forEach(({ item }: any, order: number) => {
      const nextId = `${base}${suffixFromIndex(order)}`;
      affected.add(nextId);
      if (item.shot_id !== nextId) idMap.set(item.shot_id, nextId);
      item.shot_id = nextId;
      item.shot_file = `shots/${nextId}.json`;
    });
  }

  renameShotResources(projectPath, idMap);
  updateRenamedJsonContent(projectPath, idMap);

  const groupCount = group.length;
  for (const { item } of group as any[]) {
    const shotPath = path.join(projectPath, 'shots', `${item.shot_id}.json`);
    const shot = replaceShotIdsDeep(readJson(shotPath) || {}, idMap);
    shot.shot_id = item.shot_id;
    shot.parent_shot_id = base;
    shot.segment_index = group.findIndex((entry: any) => entry.item.shot_id === item.shot_id) + 1;
    shot.segment_count = groupCount;
    item.duration_s = shot.duration_s || item.duration_s || 5;
    writeJson(shotPath, shot);
  }

  return { renamed: Object.fromEntries(idMap.entries()), affected };
}

export async function POST(request: Request) {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) {
    return NextResponse.json({ error: 'No active project found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const action = String(body.action || '');
    const shotId = String(body.shot_id || '');
    if (!SHOT_ID_RE.test(shotId)) {
      return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
    }

    const projectJsonPath = path.join(projectPath, 'project.json');
    const project = readJson(projectJsonPath);
    if (!project || !Array.isArray(project.timeline)) {
      return NextResponse.json({ error: 'project.json timeline 无效' }, { status: 500 });
    }

    const idx = project.timeline.findIndex((item: any) => item.shot_id === shotId);
    if (idx < 0) {
      return NextResponse.json({ error: `镜头不在 timeline 中: ${shotId}` }, { status: 404 });
    }

    let renamed: Record<string, string> = {};
    let affected = affectedWindow(project.timeline, idx);

    if (action === 'move_up' || action === 'move_down') {
      const target = action === 'move_up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= project.timeline.length) {
        return NextResponse.json({ error: '已经到边界，不能继续移动' }, { status: 400 });
      }
      const currentBase = parseShotSequenceId(project.timeline[idx].shot_id).base;
      const targetBase = parseShotSequenceId(project.timeline[target].shot_id).base;
      const tmp = project.timeline[idx];
      project.timeline[idx] = project.timeline[target];
      project.timeline[target] = tmp;
      affected = new Set([
        ...Array.from(affectedWindow(project.timeline, idx)),
        ...Array.from(affectedWindow(project.timeline, target))
      ]);
      if (currentBase === targetBase) {
        const result = renumberGroup(projectPath, project, currentBase);
        renamed = result.renamed;
        affected = new Set([...Array.from(affected), ...Array.from(result.affected)]);
      }
    } else if (action === 'delete') {
      const deletedBase = parseShotSequenceId(shotId).base;
      project.timeline.splice(idx, 1);
      removeShotResources(projectPath, shotId);
      const result = renumberGroup(projectPath, project, deletedBase);
      renamed = result.renamed;
      affected = new Set([
        ...Array.from(result.affected),
        ...Array.from(affectedWindow(project.timeline, Math.max(0, idx - 1)))
      ]);
    } else {
      return NextResponse.json({ error: '未知排序操作' }, { status: 400 });
    }

    writeJson(projectJsonPath, project);
    relinkContextRefs(projectPath, project.timeline, affected);
    const promptResults = await rebuildPromptPackages(projectPath);
    const promptFailed = promptResults.find(result => result.code !== 0);

    return NextResponse.json({
      success: true,
      action,
      shot_id: shotId,
      renamed,
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
    return NextResponse.json({ error: e.message || '更新时间线失败' }, { status: 500 });
  }
}

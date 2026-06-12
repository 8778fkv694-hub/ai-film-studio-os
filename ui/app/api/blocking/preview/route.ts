import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath, getCurrentProjectPath } from '@/lib/projects';
// Reuse the SAME geometry engine the compilers use (single source of truth).
import {
  compileBlocking,
  renderBlueprintSVG,
  renderGrayboxSVG
} from '../../../../../tools/scripts/shared/blocking.js';

function readJsonSafe(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

/** Resolve a resource ref (e.g. "characters/x.json") within project or repo root. */
function resolveRef(ref: string): any {
  const projectPath = getCurrentProjectPath();
  const repoRoot = path.resolve(process.cwd(), '..');
  for (const base of [projectPath, repoRoot].filter(Boolean) as string[]) {
    const full = path.join(base, ref);
    if (fs.existsSync(full)) return readJsonSafe(full);
  }
  return null;
}

function makeLabelFor(shot: any, scene: any) {
  const map = new Map<string, string>();
  for (const item of shot?.characters || []) {
    if (!item.ref) continue;
    const obj = resolveRef(item.ref);
    if (obj?.name || obj?.id) map.set(item.ref, obj.name || obj.id);
  }
  for (const item of shot?.props || []) {
    if (!item.ref) continue;
    const obj = resolveRef(item.ref);
    const label = obj?.name || obj?.id;
    if (!label) continue;
    map.set(item.ref, label);
    const m = String(item.ref).match(/([^/]+)\.json$/);
    if (m) map.set(`prop:${m[1]}`, label);
  }
  for (const f of scene?.floorplan?.fixtures || []) map.set(`fixture:${f.id}`, f.label || f.id);
  return (ref: string): string => map.get(ref)
    || String(ref || '').replace(/^(prop|fixture):/, '').replace(/\.json$/, '').split('/').pop()
    || ref;
}

export async function POST(request: Request) {
  try {
    const { shotId, blocking } = await request.json();
    if (!blocking || typeof blocking !== 'object') {
      return NextResponse.json({ error: 'missing blocking' }, { status: 400 });
    }

    // Load shot + scene for label resolution (best-effort).
    let shot: any = null;
    if (shotId && /^[A-Za-z0-9_-]+$/.test(shotId)) {
      shot = readJsonSafe(path.join(getResourcePath('shots'), `${shotId}.json`))
        || readJsonSafe(path.join(getResourcePath('shots_draft'), `${shotId}.json`));
    }
    const scene = shot?.scene_ref ? resolveRef(shot.scene_ref) : null;
    const labelFor = makeLabelFor(shot || {}, scene);
    const fixtures = blocking.floorplan_ref ? (scene?.floorplan?.fixtures || []) : [];

    const result = compileBlocking(blocking, { labelFor, fixtures });
    const blueprintSvg = renderBlueprintSVG(blocking, { labelFor, fixtures });
    const grayboxSvg = renderGrayboxSVG(blocking, { labelFor, fixtures });

    return NextResponse.json({
      mode: result.mode,
      injected: result.inject,
      spaceClause: result.spaceClause,
      cameraClause: result.cameraClause,
      motionClause: result.motionClause,
      visibleEntities: result.visibleEntities,
      offscreenLabels: result.offscreenLabels,
      warnings: result.warnings,
      blueprintSvg,
      grayboxSvg
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'preview failed' }, { status: 500 });
  }
}

/**
 * build-blocking-diagrams.js
 *
 * For every shot that declares `blocking`, render a top-down staging diagram
 * (Overhead Blueprint) to assets/renders/<shot_id>/blocking.svg.
 *
 * This SVG is for the human and for review — it is NEVER fed to the AI.
 * Backward compatible: shots without `blocking` are skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';
import { renderBlueprintSVG, renderGrayboxSVG } from './shared/blocking.js';

const { workDir, projectRoot } = parseArgs();

function readJson(rel) {
  for (const base of [workDir, projectRoot]) {
    const p = path.join(base, rel);
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
    }
  }
  return null;
}

function makeLabelFor(shot, scene) {
  const map = new Map();
  for (const item of shot.characters || []) {
    if (!item.ref) continue;
    const obj = readJson(item.ref);
    if (obj?.name || obj?.id) map.set(item.ref, obj.name || obj.id);
  }
  for (const item of shot.props || []) {
    if (!item.ref) continue;
    const obj = readJson(item.ref);
    const label = obj?.name || obj?.id;
    if (!label) continue;
    map.set(item.ref, label);
    const m = item.ref.match(/([^/]+)\.json$/);
    if (m) map.set(`prop:${m[1]}`, label);
  }
  for (const f of scene?.floorplan?.fixtures || []) map.set(`fixture:${f.id}`, f.label || f.id);
  return ref => map.get(ref)
    || String(ref || '').replace(/^(prop|fixture):/, '').replace(/\.json$/, '').split('/').pop();
}

function main() {
  const shotsDir = path.join(workDir, 'shots');
  if (!fs.existsSync(shotsDir)) {
    console.error(`❌ shots/ not found in ${workDir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json')).sort();
  let written = 0, skipped = 0;

  for (const file of files) {
    const shot = readJson(`shots/${file}`);
    if (!shot?.blocking) { skipped++; continue; }
    const scene = shot.scene_ref ? readJson(shot.scene_ref) : null;
    const labelFor = makeLabelFor(shot, scene);
    const fixtures = shot.blocking.floorplan_ref ? (scene?.floorplan?.fixtures || []) : [];
    const blueprint = renderBlueprintSVG(shot.blocking, {
      labelFor, fixtures, title: `${shot.shot_id} — top-down blocking`
    });
    const graybox = renderGrayboxSVG(shot.blocking, {
      labelFor, fixtures, title: `${shot.shot_id} — camera-view gray-box (scaffold)`
    });
    const outDir = path.join(workDir, 'assets/renders', shot.shot_id);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'blocking.svg'), blueprint);
    fs.writeFileSync(path.join(outDir, 'blocking_grayframe.svg'), graybox);
    console.log(`[Blocking] ${shot.shot_id} -> blocking.svg + blocking_grayframe.svg`);
    written++;
  }

  console.log(`[Blocking] Done. ${written} diagram(s) written, ${skipped} shot(s) without blocking skipped.`);
}

main();

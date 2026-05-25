import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

function readJson(rel) {
  const p = path.join(ROOT, rel);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function ensureDir(rel) {
  fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
}

function joinLines(arr) {
  return (arr || []).map(s => String(s).trim()).filter(Boolean).join(', ');
}

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

function compileShotPrompt(shotFile, gitHash) {
  const shot = readJson(`shots/${shotFile}`);
  const scene = readJson(shot.scene_ref);
  const style = shot.style_ref ? readJson(shot.style_ref) : (scene.style_ref ? readJson(scene.style_ref) : null);

  const characters = (shot.characters || []).map(c => readJson(c.ref));
  const props = (shot.props || []).map(p => readJson(p.ref));

  const positive = [];
  const negative = [];

  if (style?.mood_keywords) positive.push(...style.mood_keywords);
  if (scene?.must_keep?.lighting) positive.push(`lighting: ${scene.must_keep.lighting}`);
  positive.push('match scene anchor layout');

  for (const ch of characters) {
    positive.push(`stable identity: ${ch.id}`);
    if (ch?.must_keep?.outfit) positive.push(`outfit fixed: ${ch.must_keep.outfit}`);
    if (Array.isArray(ch?.must_keep?.accessories) && ch.must_keep.accessories.length) {
      positive.push(`accessories fixed: ${ch.must_keep.accessories.join(' + ')}`);
    }
    negative.push('no face drift');
    negative.push('no outfit change');
  }

  for (const pr of props) {
    if (pr.must_keep) positive.push(`prop must_keep: ${pr.id}`);
  }

  negative.push('no extra fingers');
  negative.push('no text artifacts');

  // references collection
  const refImages = [];
  for (const a of (scene.anchors || [])) refImages.push(a.img);
  for (const ch of characters) for (const img of (ch.references?.images || [])) refImages.push(img);
  for (const pr of props) for (const img of (pr.references?.images || [])) refImages.push(img);

  // RESOURCE PRE-CHECK
  const missingAssets = [];
  for (const imgPath of refImages) {
    const absPath = path.join(ROOT, imgPath);
    if (!fs.existsSync(absPath)) {
      missingAssets.push(imgPath);
    }
  }

  const promptSpec = {
    shot_id: shot.shot_id,
    language: 'en',
    positive,
    negative,
    constraints: {
      must_keep: [
        ...(scene.must_keep?.set_elements || []).map(x => `scene:${x}`),
        ...characters.map(c => `character:${c.id}`),
        ...props.filter(p => p.must_keep).map(p => `prop:${p.id}`)
      ],
      forbidden: scene.forbidden || []
    },
    references: { images: refImages, video: [], audio: [] },
    params: {
      duration_s: shot.duration_s,
      quality_tier: shot?.budget?.tier || 'cheap'
    },
    meta: {
      compiler_version: '1.1.0',
      git_commit: gitHash,
      compiled_at: new Date().toISOString(),
      validation: {
        missing_assets: missingAssets,
        status: missingAssets.length > 0 ? 'WARN' : 'OK'
      },
      compiled_from: {
        shot: `shots/${shotFile}`,
        scene: shot.scene_ref,
        style: style ? (shot.style_ref || scene.style_ref) : null,
        characters: (shot.characters || []).map(c => c.ref),
        props: (shot.props || []).map(p => p.ref)
      }
    }
  };

  const finalPrompt = {
    shot_id: shot.shot_id,
    positive_text: joinLines(promptSpec.positive),
    negative_text: joinLines(promptSpec.negative),
    ref_images: refImages,
    meta: promptSpec.meta
  };

  return { promptSpec, finalPrompt, missingAssets };
}

function main() {
  ensureDir('prompts');
  const shotFiles = fs.readdirSync(path.join(ROOT, 'shots')).filter(f => f.endsWith('.json')).sort();
  const out = [];
  const gitHash = getGitHash();
  let totalMissing = 0;

  console.log(`[Build] Starting prompt compilation (Commit: ${gitHash})...`);

  for (const f of shotFiles) {
    const { promptSpec, finalPrompt, missingAssets } = compileShotPrompt(f, gitHash);
    
    // Write output
    fs.writeFileSync(path.join(ROOT, 'prompts', `${promptSpec.shot_id}.prompt.json`), JSON.stringify(promptSpec, null, 2));
    fs.writeFileSync(path.join(ROOT, 'prompts', `${promptSpec.shot_id}.final.json`), JSON.stringify(finalPrompt, null, 2));
    
    // Log status
    if (missingAssets.length > 0) {
      console.warn(`[WARN] Shot ${promptSpec.shot_id} missing ${missingAssets.length} assets:`);
      missingAssets.forEach(m => console.warn(`  - ${m}`));
      totalMissing += missingAssets.length;
    }
    
    out.push(promptSpec.shot_id);
  }

  console.log(`[Build] Completed (${out.length} shots).`);
  if (totalMissing > 0) {
    console.warn(`[WARN] Total missing assets: ${totalMissing}. Fix paths or create placeholder files before rendering.`);
  } else {
    console.log('[Build] All assets verified OK.');
  }
}

main();

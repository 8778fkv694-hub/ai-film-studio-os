import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COMFYUI_DIR = path.join(ROOT, 'comfyui');

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8')); } catch { return null; }
}

function readPrompt(shotId) {
  const p = path.join(ROOT, 'prompts', `${shotId}.prompt.json`);
  return fs.existsSync(p) ? readJson(`prompts/${shotId}.prompt.json`) : null;
}

function findKeyframe(shotId) {
  const dir = path.join(ROOT, 'assets/renders', shotId, 'keyframes');
  if (!fs.existsSync(dir)) return null;
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
    const f = path.join(dir, `frame_01${ext}`);
    if (fs.existsSync(f)) return path.resolve(f);
  }
  return null;
}

function findContextRefs(shot) {
  return (shot.context_refs || [])
    .filter(ref => fs.existsSync(path.join(ROOT, ref)))
    .map(ref => path.resolve(path.join(ROOT, ref)));
}

function collectRefImages(scene, characters, props) {
  const images = [];
  for (const a of (scene?.anchors || [])) {
    const p = path.resolve(path.join(ROOT, a.img));
    if (fs.existsSync(p)) images.push({ label: `scene_${a.id}`, path: p });
  }
  for (const ch of characters) {
    for (const img of (ch.references?.images || [])) {
      const p = path.resolve(path.join(ROOT, img));
      if (fs.existsSync(p)) images.push({ label: `char_${ch.id}`, path: p });
    }
  }
  for (const pr of props) {
    for (const img of (pr.references?.images || [])) {
      const p = path.resolve(path.join(ROOT, img));
      if (fs.existsSync(p)) images.push({ label: `prop_${pr.id}`, path: p });
    }
  }
  return images;
}

function buildWorkflow(shot, promptData) {
  const scene = readJson(shot.scene_ref);
  const characters = (shot.characters || []).map(c => readJson(c.ref)).filter(Boolean);
  const props = (shot.props || []).map(p => readJson(p.ref)).filter(Boolean);

  const keyframe = findKeyframe(shot.shot_id);
  const contextRefs = findContextRefs(shot);
  const refImages = collectRefImages(scene, characters, props);

  const positive = promptData?.video_prompt || '';
  const negative = promptData?.negative_prompt || '';

  const nodes = [];
  const links = [];
  let nextId = 1;
  let nextLink = 1;

  function node(type, pos, widgets = [], inputs = [], flags = {}) {
    const id = nextId++;
    nodes.push({
      id, type,
      pos: { 0: pos[0], 1: pos[1] },
      size: { 0: 315, 1: type === 'LoadImage' ? 314 : type.endsWith('Encode') ? 400 : 200 },
      flags,
      order: id - 1,
      mode: 0,
      inputs: inputs.map(inp => ({ name: inp.name, type: inp.type, link: inp.link || null })),
      outputs: (() => {
        switch (type) {
          case 'CheckpointLoaderSimple': return [
            { name: 'MODEL', type: 'MODEL', links: null, slot_index: 0 },
            { name: 'CLIP', type: 'CLIP', links: null, slot_index: 1 },
            { name: 'VAE', type: 'VAE', links: null, slot_index: 2 }
          ];
          case 'CLIPTextEncode': return [
            { name: 'CONDITIONING', type: 'CONDITIONING', links: null, slot_index: 0 }
          ];
          case 'LoadImage': return [
            { name: 'IMAGE', type: 'IMAGE', links: null, slot_index: 0 },
            { name: 'MASK', type: 'MASK', links: null, slot_index: 1 }
          ];
          case 'KSampler': return [
            { name: 'LATENT', type: 'LATENT', links: null, slot_index: 0 }
          ];
          case 'VAEDecode': return [
            { name: 'IMAGE', type: 'IMAGE', links: null, slot_index: 0 }
          ];
          case 'EmptyLatentImage': return [
            { name: 'LATENT', type: 'LATENT', links: null, slot_index: 0 }
          ];
          case 'SaveImage': return [];
          default: return [];
        }
      })(),
      properties: { 'Node name for S&R': type },
      widgets_values: widgets
    });
    return id;
  }

  function link(fromNode, fromSlot, toNode, toSlot, type) {
    const linkId = nextLink++;
    links.push([linkId, fromNode, fromSlot, toNode, toSlot, type]);
  }

  // Checkpoint loader
  const ckptId = node('CheckpointLoaderSimple', [50, 50], ['sd_xl_base_1.0.safetensors']);

  // CLIP Text Encode
  const posEncodeId = node('CLIPTextEncode', [50, 200], [positive], [
    { name: 'clip', type: 'CLIP', link: null }
  ]);
  const negEncodeId = node('CLIPTextEncode', [50, 400], [negative], [
    { name: 'clip', type: 'CLIP', link: null }
  ]);
  link(ckptId, 1, posEncodeId, 0, 'CLIP');
  link(ckptId, 1, negEncodeId, 0, 'CLIP');

  // Load reference images
  const allImages = [
    ...(keyframe ? [{ label: `keyframe_${shot.shot_id}`, path: keyframe }] : []),
    ...contextRefs.map((p, i) => ({ label: `context_${i}`, path: p })),
    ...refImages
  ];

  let yPos = 50;
  const imageNodeIds = [];
  for (const img of allImages) {
    const imgId = node('LoadImage', [500, yPos], [img.path, 'image']);
    imageNodeIds.push(imgId);
    yPos += 350;
  }

  // Empty latent
  const latentId = node('EmptyLatentImage', [50, 600], [1920, 1080, 1]);

  // KSampler
  const samplerId = node('KSampler', [900, 300], [
    156680208700286, 'randomize', 20, 7.5, 'euler', 'normal', 1
  ], [
    { name: 'model', type: 'MODEL', link: null },
    { name: 'positive', type: 'CONDITIONING', link: null },
    { name: 'negative', type: 'CONDITIONING', link: null },
    { name: 'latent_image', type: 'LATENT', link: null }
  ]);
  link(ckptId, 0, samplerId, 0, 'MODEL');
  link(posEncodeId, 0, samplerId, 1, 'CONDITIONING');
  link(negEncodeId, 0, samplerId, 2, 'CONDITIONING');
  link(latentId, 0, samplerId, 3, 'LATENT');

  // VAEDecode
  const vaeId = node('VAEDecode', [1250, 300], [], [
    { name: 'samples', type: 'LATENT', link: null },
    { name: 'vae', type: 'VAE', link: null }
  ]);
  link(samplerId, 0, vaeId, 0, 'LATENT');
  link(ckptId, 2, vaeId, 1, 'VAE');

  // SaveImage
  const saveId = node('SaveImage', [1600, 300], [`${shot.shot_id}_`], [
    { name: 'images', type: 'IMAGE', link: null }
  ]);
  link(vaeId, 0, saveId, 0, 'IMAGE');

  // Groups
  const groups = [
    { title: `Shot ${shot.shot_id} — Prompt`, bounding: [45, 45, 310, 600], color: '#3b82f6' },
    { title: `Reference Images (${allImages.length})`, bounding: [495, 45, 330, allImages.length * 350], color: '#a855f7' },
    { title: 'Generation Pipeline', bounding: [895, 245, 740, 250], color: '#22c55e' }
  ];

  return {
    last_node_id: nextId - 1,
    last_link_id: nextLink - 1,
    nodes,
    links,
    groups: groups.map((g, i) => ({
      title: g.title,
      bounding: g.bounding,
      color: g.color,
      font_size: 14,
      flags: {}
    })),
    config: {},
    extra: {
      ds: { scale: 0.6, offset: [200, 100] },
      workflow_description: `ComfyUI workflow for shot ${shot.shot_id}
Generated by ai-film-studio-os / build-comfyui.js

Setup:
1. Load this JSON in ComfyUI
2. Select your SDXL checkpoint in CheckpointLoaderSimple
3. Connect reference images to ControlNet/IPAdapter if needed
4. Adjust KSampler settings as needed
5. Queue Prompt

This is a basic txt2img workflow. For video, add AnimateDiff nodes after the KSampler.`
    },
    version: 0.4
  };
}

function main() {
  const project = readJson('project.json');
  if (!project) { console.error('project.json not found'); process.exit(1); }

  ensureDir('comfyui');

  const timeline = project.timeline || [];
  console.log(`[ComfyUI] Generating workflows for ${timeline.length} shots...`);

  for (const entry of timeline) {
    const shot = readJson(`shots/${entry.shot_id}.json`);
    if (!shot) { console.warn(`  ${entry.shot_id}: shot not found`); continue; }

    const promptData = readPrompt(shot.shot_id);
    const workflow = buildWorkflow(shot, promptData);

    const outPath = path.join(COMFYUI_DIR, `${shot.shot_id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(workflow, null, 2));

    const imgCount = workflow.nodes.filter(n => n.type === 'LoadImage').length;
    console.log(`  ${shot.shot_id} ✓ ${imgCount} reference images, ${workflow.nodes.length} nodes`);
  }

  console.log(`[ComfyUI] Wrote ${timeline.length} workflows to comfyui/`);
}

function ensureDir(rel) {
  fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
}

main();

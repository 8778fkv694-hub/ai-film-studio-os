import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir, projectRoot } = parseArgs();

if (!workDir || !fs.existsSync(workDir)) {
  console.error(`❌ Project working directory not found: ${workDir}`);
  process.exit(1);
}

console.log(`🔍 AI Film Studio OS - 资产库与引用审计`);
console.log(`📂 工作项目目录: ${workDir}\n`);

// Helper to check file existence locally (in project) or globally (for style refs, templates, etc.)
function checkFileExists(relPath) {
  if (fs.existsSync(path.join(workDir, relPath))) return true;
  if (fs.existsSync(path.join(projectRoot, relPath))) return true;

  const ext = path.extname(relPath);
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  if (ext && imageExts.has(ext.toLowerCase())) {
    for (const root of [workDir, projectRoot]) {
      const dir = path.join(root, path.dirname(relPath));
      const base = path.basename(relPath, ext);
      if (!fs.existsSync(dir)) continue;
      if (fs.readdirSync(dir).some(file => (
        path.basename(file, path.extname(file)) === base &&
        imageExts.has(path.extname(file).toLowerCase())
      ))) {
        return true;
      }
    }
  }

  return false;
}

// Helper to scan a directory recursively and return relative paths from workDir
function scanDirRecursive(baseDir, relativeDir = '') {
  const absDir = path.join(baseDir, relativeDir);
  if (!fs.existsSync(absDir)) return [];
  
  let results = [];
  try {
    const files = fs.readdirSync(absDir);
    for (const file of files) {
      const relPath = relativeDir ? `${relativeDir}/${file}` : file;
      const absPath = path.join(absDir, file);
      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        results.push(...scanDirRecursive(baseDir, relPath));
      } else {
        results.push(relPath);
      }
    }
  } catch (e) {
    console.error(`Error scanning directory ${absDir}:`, e);
  }
  return results;
}

// 1. Scan Reference Images in assets/reference/
const referenceImages = scanDirRecursive(workDir, 'assets/reference')
  .filter(f => /\.(jpg|jpeg|png|webp|svg|gif|mp4|webm|mov)$/i.test(f));

console.log(`📸 Found ${referenceImages.length} reference asset(s) in assets/reference/`);

// 2. Load characters, props, scenes definitions
function loadInventory(type) {
  const dir = path.join(workDir, type);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const relPath = `${type}/${f}`;
      const absPath = path.join(dir, f);
      try {
        const obj = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
        return { file: relPath, abs: absPath, obj };
      } catch (e) {
        console.error(`Error reading ${relPath}:`, e);
        return null;
      }
    })
    .filter(Boolean);
}

const charactersList = loadInventory('characters');
const propsList = loadInventory('props');
const scenesList = loadInventory('scenes');

console.log(`👤 Loaded ${charactersList.length} character(s)`);
console.log(`📦 Loaded ${propsList.length} prop(s)`);
console.log(`🎬 Loaded ${scenesList.length} scene(s)`);

const missingRefs = [];
const pendingRefs = [];
function addMissing(filePath, refBy, type) {
  missingRefs.push({ path: filePath, ref_by: refBy, type });
}
function addPending(filePath, refBy, type) {
  pendingRefs.push({ path: filePath, ref_by: refBy, type });
}

// 3. Audit Asset definitions
for (const char of charactersList) {
  const imgRefs = char.obj.references?.images || [];
  for (const img of imgRefs) {
    if (!checkFileExists(img)) {
      addMissing(img, char.file, 'character_reference');
    }
  }
}

for (const prop of propsList) {
  const imgRefs = prop.obj.references?.images || [];
  for (const img of imgRefs) {
    if (!checkFileExists(img)) {
      addMissing(img, prop.file, 'prop_reference');
    }
  }
}

for (const sc of scenesList) {
  if (sc.obj.style_ref && !checkFileExists(sc.obj.style_ref)) {
    addMissing(sc.obj.style_ref, sc.file, 'style');
  }
  const anchors = sc.obj.anchors || [];
  for (const anchor of anchors) {
    if (anchor.img && !checkFileExists(anchor.img)) {
      addMissing(anchor.img, sc.file, 'scene_anchor');
    }
  }
}

// 4. Audit active shots on timeline
const projectPath = path.join(workDir, 'project.json');
let timelineShots = [];
if (fs.existsSync(projectPath)) {
  try {
    const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
    timelineShots = project.timeline || [];
  } catch (e) {
    console.error('Error loading project.json:', e);
  }
}

const timelineShotIds = new Set(timelineShots.map(item => item.shot_id).filter(Boolean));
function isPendingTimelineContextRef(relPath) {
  const match = String(relPath).match(/^assets\/renders\/([A-Za-z0-9_-]+)\/keyframes\//);
  return Boolean(match && timelineShotIds.has(match[1]));
}

console.log(`🎞️  Auditing active timeline: ${timelineShots.length} shot(s)...`);

for (const item of timelineShots) {
  const shotFile = item.shot_file;
  const shotPath = path.join(workDir, shotFile);
  if (!fs.existsSync(shotPath)) {
    addMissing(shotFile, 'project.json', 'shot_file');
    continue;
  }
  
  try {
    const shot = JSON.parse(fs.readFileSync(shotPath, 'utf-8'));
    
    // Check scene_ref
    if (shot.scene_ref) {
      if (!checkFileExists(shot.scene_ref)) {
        addMissing(shot.scene_ref, shotFile, 'scene');
      }
    } else {
      addMissing('scene_ref missing in shot', shotFile, 'metadata');
    }
    
    // Check characters
    for (const charRef of shot.characters || []) {
      if (charRef.ref && !checkFileExists(charRef.ref)) {
        addMissing(charRef.ref, shotFile, 'character');
      }
    }
    
    // Check props
    for (const propRef of shot.props || []) {
      if (propRef.ref && !checkFileExists(propRef.ref)) {
        addMissing(propRef.ref, shotFile, 'prop');
      }
    }
    
    // Check context_refs
    for (const ref of shot.context_refs || []) {
      if (ref && typeof ref === 'string' && ref.trim() && !checkFileExists(ref)) {
        if (isPendingTimelineContextRef(ref)) {
          addPending(ref, shotFile, 'context_ref');
        } else {
          addMissing(ref, shotFile, 'context_ref');
        }
      }
    }
    
    // Check style_ref (if present)
    if (shot.style_ref && !checkFileExists(shot.style_ref)) {
      addMissing(shot.style_ref, shotFile, 'style');
    }
    
  } catch (e) {
    console.error(`Error auditing shot ${shotFile}:`, e);
  }
}

// 5. Output Report Index JSON
const report = {
  generated_at: new Date().toISOString(),
  characters: charactersList.map(c => ({
    file: c.file,
    id: c.obj.id,
    name: c.obj.name,
    references: c.obj.references?.images || [],
    must_keep: c.obj.must_keep || {}
  })),
  props: propsList.map(p => ({
    file: p.file,
    id: p.obj.id,
    name: p.obj.name,
    references: p.obj.references?.images || [],
    must_keep: p.obj.must_keep || {}
  })),
  scenes: scenesList.map(s => ({
    file: s.file,
    id: s.obj.id,
    name: s.obj.name,
    style_ref: s.obj.style_ref || '',
    anchors: s.obj.anchors || [],
    must_keep: s.obj.must_keep || {}
  })),
  reference_images: referenceImages,
  missing_refs: missingRefs,
  pending_refs: pendingRefs
};

const reportsDir = path.join(workDir, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const reportPath = path.join(reportsDir, 'asset-index.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

console.log(`\n🎉 Auditing complete!`);
if (missingRefs.length > 0) {
  console.warn(`⚠️  Found ${missingRefs.length} missing reference(s):`);
  missingRefs.forEach(m => {
    console.warn(`   - [${m.type.toUpperCase()}] ${m.path} (referenced by ${m.ref_by})`);
  });
} else {
  console.log(`✅ All references are intact and healthy!`);
}
if (pendingRefs.length > 0) {
  console.log(`⏳ Found ${pendingRefs.length} pending generated context reference(s). These are expected until previous shots are rendered:`);
  pendingRefs.forEach(m => {
    console.log(`   - [${m.type.toUpperCase()}] ${m.path} (referenced by ${m.ref_by})`);
  });
}
console.log(`📊 Asset index written to: reports/asset-index.json`);

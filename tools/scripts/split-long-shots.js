import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './shared/dirs.js';

const { workDir, projectRoot, remainingArgs } = parseArgs();

// Parse custom arguments
let maxDuration = 12;
let dryRun = true;
let apply = false;

for (let i = 0; i < remainingArgs.length; i++) {
  const arg = remainingArgs[i];
  if (arg === '--max-duration' && i + 1 < remainingArgs.length) {
    maxDuration = parseFloat(remainingArgs[i + 1]);
    i++;
  } else if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg === '--apply') {
    apply = true;
    dryRun = false;
  }
}

if (!workDir || !fs.existsSync(workDir)) {
  console.error(`❌ Project working directory not found: ${workDir}`);
  process.exit(1);
}

const projectPath = path.join(workDir, 'project.json');
if (!fs.existsSync(projectPath)) {
  console.error(`❌ project.json not found in ${workDir}`);
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
const timeline = project.timeline || [];

console.log(`🎬 AI Film Studio OS - 长镜头自动拆分`);
console.log(`📂 工作项目目录: ${workDir}`);
console.log(`⏱️  最大允许时长: ${maxDuration}秒`);
console.log(`Mode: ${apply ? '应用更改 (Apply)' : '预演 (Dry Run)'}\n`);

// Helper to split text by typical punctuation
function splitText(text, numSegments) {
  if (!text) return Array(numSegments).fill('');
  const clauses = text.split(/([。，；！？\.,;!\?])/).filter(Boolean);
  const parts = [];
  for (let i = 0; i < clauses.length; i++) {
    const c = clauses[i];
    if (/[。，；！？\.,;!\?]/.test(c)) {
      if (parts.length > 0) {
        parts[parts.length - 1] += c;
      } else {
        parts.push(c);
      }
    } else {
      parts.push(c);
    }
  }
  
  if (parts.length === 0) {
    return Array(numSegments).fill('');
  }

  const buckets = Array.from({ length: numSegments }, () => []);
  const B = parts.length;
  for (let i = 0; i < B; i++) {
    const bucketIndex = Math.min(Math.floor(i * numSegments / B), numSegments - 1);
    buckets[bucketIndex].push(parts[i]);
  }
  return buckets.map(b => b.join('').trim());
}

// Load all existing shots in directory (needed for potential context_refs updating)
function listJson(dir) {
  const abs = path.join(workDir, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(abs, f);
      return {
        file: `${dir}/${f}`,
        abs: filePath,
        obj: JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      };
    });
}

const shots = listJson('shots');

const suffixes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const splitPlans = [];
const newTimeline = [];
let hasChanges = false;

for (const timelineItem of timeline) {
  const shotId = timelineItem.shot_id;
  const shotFile = timelineItem.shot_file;
  
  // Find shot JSON
  const shotInfo = shots.find(s => s.obj.shot_id === shotId);
  if (!shotInfo) {
    // If not found in loaded list, keep on timeline as is
    newTimeline.push(timelineItem);
    continue;
  }
  
  const shot = shotInfo.obj;
  const duration = shot.duration_s || timelineItem.duration_s || 0;
  
  if (duration > maxDuration) {
    hasChanges = true;
    const S = Math.ceil(duration / maxDuration);
    if (S > 26) {
      console.error(`❌ Shot ${shotId} duration ${duration}s is too long and requires more than 26 segments!`);
      process.exit(1);
    }
    
    // Calculate durations
    const segmentDurations = [];
    const firstDur = Math.round((duration / S) * 10) / 10;
    let remainingDur = duration;
    for (let j = 0; j < S - 1; j++) {
      segmentDurations.push(firstDur);
      remainingDur = Math.round((remainingDur - firstDur) * 10) / 10;
    }
    segmentDurations.push(remainingDur);
    
    // Distribute beats
    const parentBeats = shot.action?.beats || [];
    const B = parentBeats.length;
    
    // Distribute voiceover text
    const voTexts = shot.voiceover?.text ? splitText(shot.voiceover.text, S) : Array(S).fill('');
    // Distribute dialogue text
    const dlgTexts = shot.dialogue?.text ? splitText(shot.dialogue.text, S) : Array(S).fill('');
    
    const segments = [];
    
    for (let j = 0; j < S; j++) {
      const childId = `${shotId}${suffixes[j]}`;
      const childBeats = parentBeats.slice(Math.floor(j * B / S), Math.floor((j + 1) * B / S));
      
      const childShot = {
        shot_id: childId,
        duration_s: segmentDurations[j],
        scene_ref: shot.scene_ref,
        parent_shot_id: shotId,
        segment_index: j + 1,
        segment_count: S,
        split_reason: `duration_s (${duration}s) > max_duration (${maxDuration}s)`
      };
      
      if (shot.cam_setup_ref) childShot.cam_setup_ref = shot.cam_setup_ref;
      if (shot.style_ref) childShot.style_ref = shot.style_ref;
      if (shot.characters) childShot.characters = shot.characters;
      if (shot.props) childShot.props = shot.props;
      if (shot.budget) childShot.budget = shot.budget;
      
      // Action beats
      childShot.action = { beats: childBeats };
      
      // Dialogue
      if (shot.dialogue && dlgTexts[j]) {
        childShot.dialogue = {
          speaker: shot.dialogue.speaker,
          text: dlgTexts[j],
          voice_id: shot.dialogue.voice_id
        };
      }
      
      // Voiceover
      if (shot.voiceover && voTexts[j]) {
        childShot.voiceover = {
          speaker: shot.voiceover.speaker,
          text: voTexts[j],
          voice_id: shot.voiceover.voice_id
        };
      }
      
      // Prompt negative override
      if (shot.prompt) {
        childShot.prompt = {
          positive: shot.prompt.positive || '',
          negative: shot.prompt.negative || ''
        };
      }
      
      // context_refs chaining
      if (j === 0) {
        if (shot.context_refs) {
          childShot.context_refs = shot.context_refs;
        }
      } else {
        childShot.context_refs = [`assets/renders/${shotId}${suffixes[j - 1]}/keyframes/frame_last.jpg`];
      }
      
      // continuity chaining
      if (shot.continuity) {
        const childContinuity = {};
        if (j === 0) {
          if (shot.continuity.state_in_ref) {
            childContinuity.state_in_ref = shot.continuity.state_in_ref;
          }
          if (shot.continuity.must_match_prev) {
            childContinuity.must_match_prev = shot.continuity.must_match_prev;
          }
        } else {
          childContinuity.state_in_ref = `states/${shotId}${suffixes[j - 1]}_OUT.json`;
        }
        
        if (j === S - 1) {
          if (shot.continuity.state_changes) {
            childContinuity.state_changes = shot.continuity.state_changes;
          }
          if (shot.continuity.handoff_to_next) {
            childContinuity.handoff_to_next = shot.continuity.handoff_to_next;
          }
        }
        childShot.continuity = childContinuity;
      }
      
      segments.push(childShot);
    }
    
    splitPlans.push({
      parent_id: shotId,
      parent_file: shotInfo.file,
      parent_abs: shotInfo.abs,
      duration,
      segments
    });
    
    // Add segments to the new timeline
    for (const seg of segments) {
      newTimeline.push({
        shot_id: seg.shot_id,
        shot_file: `shots/${seg.shot_id}.json`,
        tier: seg.budget?.tier || timelineItem.tier || 'cheap',
        duration_s: seg.duration_s
      });
    }
  } else {
    // Keep as is
    newTimeline.push(timelineItem);
  }
}

if (!hasChanges) {
  console.log(`✨ 没有需要拆分的镜头 (所有镜头时长均在 ${maxDuration}秒 以内)。`);
  process.exit(0);
}

// Log plans
console.log(`📋 计划拆分以下 ${splitPlans.length} 个镜头:`);
for (const plan of splitPlans) {
  console.log(`  - 镜头 ${plan.parent_id} (${plan.duration}秒) -> 拆分为 ${plan.segments.length} 个子分镜:`);
  for (const seg of plan.segments) {
    console.log(`    * ${seg.shot_id} (${seg.duration_s}秒)`);
    if (seg.action.beats.length > 0) {
      console.log(`      Beats: ${JSON.stringify(seg.action.beats)}`);
    }
    if (seg.voiceover) {
      console.log(`      VO: "${seg.voiceover.text}"`);
    }
    if (seg.dialogue) {
      console.log(`      Dlg: "${seg.dialogue.text}"`);
    }
    if (seg.continuity) {
      console.log(`      Continuity: ${JSON.stringify(seg.continuity)}`);
    }
  }
  console.log('');
}

if (dryRun) {
  console.log(`⚠️  这只是一个预演 (Dry Run)。要实际应用更改，请运行:`);
  console.log(`   node tools/scripts/split-long-shots.js --apply --max-duration ${maxDuration}`);
  process.exit(0);
}

// Apply changes
console.log(`🚀 开始执行拆分写入...`);

// 1. Create archived directory if it doesn't exist
const archiveDir = path.join(workDir, 'shots_archived');
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

const reportsDir = path.join(workDir, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const reportItems = [];
const archivedShotIds = new Set();

// Helper to migrate or create a state file with updated shot_id
function migrateOrCreateStateFile(srcPath, destPath, targetShotId) {
  let stateObj = {
    shot_id: targetShotId,
    characters: {},
    props: {},
    scene: {}
  };
  if (srcPath && fs.existsSync(srcPath)) {
    try {
      stateObj = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
      stateObj.shot_id = targetShotId;
    } catch (e) {
      console.warn(`⚠️ Failed to parse source state file ${srcPath}, creating a default one.`);
    }
  }
  const statesDir = path.dirname(destPath);
  if (!fs.existsSync(statesDir)) {
    fs.mkdirSync(statesDir, { recursive: true });
  }
  fs.writeFileSync(destPath, JSON.stringify(stateObj, null, 2), 'utf-8');
}

for (const plan of splitPlans) {
  const parentId = plan.parent_id;
  const parentAbs = plan.parent_abs;
  
  // Archive parent JSON
  const archivePath = path.join(archiveDir, `${parentId}.json`);
  fs.renameSync(parentAbs, archivePath);
  archivedShotIds.add(parentId);
  console.log(`📦 Archived: shots/${parentId}.json -> shots_archived/${parentId}.json`);

  // Clean up old prompt files of the parent shot immediately
  const parentPromptPath = path.join(workDir, 'prompts', `${parentId}.prompt.json`);
  const parentFinalPath = path.join(workDir, 'prompts', `${parentId}.final.json`);
  const parentImagePath = path.join(workDir, 'prompts/image', `${parentId}.image.json`);

  if (fs.existsSync(parentPromptPath)) {
    fs.unlinkSync(parentPromptPath);
    console.log(`   🧹 Cleaned up: prompts/${parentId}.prompt.json`);
  }
  if (fs.existsSync(parentFinalPath)) {
    fs.unlinkSync(parentFinalPath);
    console.log(`   🧹 Cleaned up: prompts/${parentId}.final.json`);
  }
  if (fs.existsSync(parentImagePath)) {
    fs.unlinkSync(parentImagePath);
    console.log(`   🧹 Cleaned up: prompts/image/${parentId}.image.json`);
  }
  
  // Write child JSONs
  for (const seg of plan.segments) {
    const childPath = path.join(workDir, 'shots', `${seg.shot_id}.json`);
    fs.writeFileSync(childPath, JSON.stringify(seg, null, 2), 'utf-8');
    console.log(`✍️  Created: shots/${seg.shot_id}.json`);
  }
  
  // Process state files if parent had continuity
  const parentShot = shots.find(s => s.obj.shot_id === parentId)?.obj;
  if (parentShot && parentShot.continuity) {
    const S = plan.segments.length;
    // Migrate parent OUT file to last child OUT file
    const parentOutPath = path.join(workDir, `states/${parentId}_OUT.json`);
    const lastChildId = `${parentId}${suffixes[S - 1]}`;
    const lastOutPath = path.join(workDir, `states/${lastChildId}_OUT.json`);
    migrateOrCreateStateFile(parentOutPath, lastOutPath, lastChildId);
    console.log(`   📄 Migrated/created OUT state for ${lastChildId}`);
    
    // Migrate intermediate state files
    let currentInRef = parentShot.continuity.state_in_ref;
    for (let j = 0; j < S - 1; j++) {
      const childId = `${parentId}${suffixes[j]}`;
      const childOutPath = path.join(workDir, `states/${childId}_OUT.json`);
      const srcPath = currentInRef ? path.join(workDir, currentInRef) : null;
      migrateOrCreateStateFile(srcPath, childOutPath, childId);
      console.log(`   📄 Migrated/created IN state for ${childId}`);
      currentInRef = `states/${childId}_OUT.json`;
    }
  }
  
  reportItems.push({
    parent_id: parentId,
    duration: plan.duration,
    segments: plan.segments.map(s => ({
      shot_id: s.shot_id,
      duration_s: s.duration_s
    }))
  });
}

// 2. Write project.json back with updated timeline
project.timeline = newTimeline;
fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');
console.log(`📝 Updated project.json timeline.`);

// 2.5 Scan all active shots to update their context_refs pointing to old parent shots
const activeShotsDir = path.join(workDir, 'shots');
if (fs.existsSync(activeShotsDir)) {
  const activeShotFiles = fs.readdirSync(activeShotsDir).filter(f => f.endsWith('.json'));
  for (const activeFile of activeShotFiles) {
    const activeFilePath = path.join(activeShotsDir, activeFile);
    try {
      const activeShot = JSON.parse(fs.readFileSync(activeFilePath, 'utf-8'));
      if (activeShot.context_refs && Array.isArray(activeShot.context_refs)) {
        let modified = false;
        activeShot.context_refs = activeShot.context_refs.map(ref => {
          for (const plan of splitPlans) {
            const parentId = plan.parent_id;
            const parentRenderStr = `assets/renders/${parentId}/`;
            if (ref.includes(parentRenderStr)) {
              const S = plan.segments.length;
              const lastChildId = `${parentId}${suffixes[S - 1]}`;
              const lastChildRenderStr = `assets/renders/${lastChildId}/`;
              modified = true;
              return ref.replace(parentRenderStr, lastChildRenderStr);
            }
          }
          return ref;
        });

        if (modified) {
          fs.writeFileSync(activeFilePath, JSON.stringify(activeShot, null, 2), 'utf-8');
          console.log(`   🔗 Updated context_refs in shots/${activeFile} to point to new split child assets.`);
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to update context_refs in shots/${activeFile}:`, e.message);
    }
  }
}

// 3. Write split report
const report = {
  project_id: project.id,
  timestamp: new Date().toISOString(),
  max_duration: maxDuration,
  splits: reportItems
};
const reportPath = path.join(reportsDir, 'split-long-shots.report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`📊 Generated report: reports/split-long-shots.report.json`);

console.log(`\n🎉 长镜头拆分执行完毕！`);

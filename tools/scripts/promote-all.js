import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

function promoteAll() {
  const draftsDir = path.join(ROOT, 'shots_draft');
  const shotsDir = path.join(ROOT, 'shots');
  const projectPath = path.join(ROOT, 'project.json');

  if (!fs.existsSync(draftsDir)) {
    console.error('shots_draft/ does not exist!');
    return;
  }
  if (!fs.existsSync(shotsDir)) {
    fs.mkdirSync(shotsDir, { recursive: true });
  }

  const draftFiles = fs.readdirSync(draftsDir).filter(f => f.endsWith('.json'));
  console.log(`Promoting ${draftFiles.length} drafts to shots...`);

  // Read project.json
  const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
  project.timeline = []; // Reset timeline to contain all promoted files

  draftFiles.forEach(file => {
    const src = path.join(draftsDir, file);
    const dest = path.join(shotsDir, file);
    
    // Copy file
    fs.copyFileSync(src, dest);
    
    const shot = JSON.parse(fs.readFileSync(dest, 'utf-8'));
    project.timeline.push({
      shot_id: shot.shot_id,
      shot_file: `shots/${file}`,
      tier: shot.budget?.tier || 'cheap'
    });
  });

  // Sort timeline
  project.timeline.sort((a, b) => {
    const numA = parseInt(a.shot_id.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.shot_id.replace(/\D/g, '')) || 0;
    if (numA !== numB) return numA - numB;
    return a.shot_id.localeCompare(b.shot_id);
  });

  // Save project.json
  fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');
  console.log(`Successfully promoted all ${draftFiles.length} shots and updated project.json timeline.`);
}

promoteAll();

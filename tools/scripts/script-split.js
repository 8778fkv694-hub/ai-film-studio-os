import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../');

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf-8'));
  } catch (e) {
    return {};
  }
}

function ensureDir(rel) {
  fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
}

// 1. Load Asset Specs (to match names in script)
const characters = fs.readdirSync(path.join(ROOT, 'characters'))
  .filter(f => f.endsWith('.json'))
  .map(f => ({ file: `characters/${f}`, ...readJson(`characters/${f}`) }));

const props = fs.readdirSync(path.join(ROOT, 'props'))
  .filter(f => f.endsWith('.json'))
  .map(f => ({ file: `props/${f}`, ...readJson(`props/${f}`) }));

const scenes = fs.readdirSync(path.join(ROOT, 'scenes'))
  .filter(f => f.endsWith('.json'))
  .map(f => ({ file: `scenes/${f}`, ...readJson(`scenes/${f}`) }));

// 2. The "Extractor" (Currently Regex Heuristics -> To be replaced by LLM)
class ScriptExtractor {
  parse(scriptText) {
    // Naive split by Scene Headings (INT./EXT.)
    const chunks = scriptText.split(/(?=\n(?:INT\.|EXT\.)\s)/g).map(s => s.trim()).filter(Boolean);
    
    const shots = [];
    let shotCounter = 1;

    chunks.forEach(chunk => {
      const lines = chunk.split('\n');
      const header = lines[0]; // e.g. "INT. KITCHEN - NIGHT"
      const body = lines.slice(1).join('\n');

      // Guess Scene Ref
      const sceneMatch = scenes.find(s => header.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])); // loose match
      const sceneRef = sceneMatch ? sceneMatch.file : "TODO: match scene manually";

      // Split body into "beats" (paragraphs) to make shots
      const beats = body.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

      beats.forEach(beat => {
        // Detect Characters
        const charRefs = characters
          .filter(c => beat.includes(c.name) || beat.includes(c.name.toUpperCase()))
          .map(c => ({ ref: c.file }));

        // Detect Props
        const propRefs = props
          .filter(p => beat.toLowerCase().includes(p.name.toLowerCase()))
          .map(p => ({ ref: p.file, state: "TODO: infer state" }));

        // Conflict Detection (Simple)
        const warnings = [];
        if (header.includes("NIGHT") && beat.toLowerCase().includes("sunlight")) {
          warnings.push("Lighting Conflict: Scene is NIGHT but action mentions sunlight");
        }

        shots.push({
          id: `S${String(shotCounter++).padStart(3, '0')}`,
          header,
          text: beat,
          sceneRef,
          charRefs,
          propRefs,
          warnings
        });
      });
    });

    return shots;
  }
}

// 3. Main Logic
function main() {
  const inputFile = process.argv[2] || 'docs/script.txt';
  if (!fs.existsSync(path.join(ROOT, inputFile))) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const text = fs.readFileSync(path.join(ROOT, inputFile), 'utf-8');
  const extractor = new ScriptExtractor();
  const drafts = extractor.parse(text);

  // Output Drafts
  ensureDir('shots_draft');
  const report = {
    generatedAt: new Date().toISOString(),
    source: inputFile,
    shotCount: drafts.length,
    conflicts: []
  };

  drafts.forEach(draft => {
    // Map to Shot Schema
    const shotJson = {
      shot_id: draft.id,
      duration_s: 4, // default
      scene_ref: draft.sceneRef,
      cam_setup_ref: "TODO",
      characters: draft.charRefs,
      props: draft.propRefs,
      action: {
        beats: [draft.text]
      },
      continuity: {
        must_match_prev: [],
        handoff_to_next: []
      },
      budget: { tier: "cheap", max_regen: 1 },
      prompt: {
        positive: `${draft.header}, ${draft.text}`,
        negative: "default negative"
      },
      _draft_meta: {
        original_text: draft.text,
        warnings: draft.warnings
      }
    };

    if (draft.warnings.length > 0) {
      report.conflicts.push({ shot: draft.id, warnings: draft.warnings });
    }

    fs.writeFileSync(path.join(ROOT, `shots_draft/${draft.id}.json`), JSON.stringify(shotJson, null, 2));
  });

  // Write Report
  fs.writeFileSync(path.join(ROOT, 'reports/script.parse.json'), JSON.stringify(report, null, 2));

  console.log(`[ScriptSplit] Processed ${drafts.length} draft shots into 'shots_draft/'.`);
  if (report.conflicts.length > 0) {
    console.warn(`[WARN] Detected ${report.conflicts.length} potential conflicts. Check reports/script.parse.json.`);
  }
}

main();

// Natural language script splitter (skeleton)
// Input: a plain text script file
// Output: reports/script.parse.json (+ optional draft shots)
//
// NOTE: This is a placeholder to formalize the workflow.
// You can later plug in an LLM call (or local parser) to do extraction.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../');

function usage() {
  console.log('Usage: node tools/scripts/script-split.js <script.txt>');
  process.exit(1);
}

const input = process.argv[2];
if (!input) usage();

const text = fs.readFileSync(path.resolve(input), 'utf-8');
const rawParas = text
  .split(/\n\s*\n/g)
  .map(s => s.trim())
  .filter(Boolean);

// naive split: each paragraph is a segment
const segments = rawParas.map((p, i) => ({
  seg_id: `P${String(i + 1).padStart(3, '0')}`,
  text: p,
  extracted: {
    // to be filled by a smarter extractor
    scene_hint: null,
    characters_hint: [],
    props_hint: [],
    beats: []
  }
}));

const report = {
  generatedAt: new Date().toISOString(),
  input,
  segmentCount: segments.length,
  segments,
  notes: [
    'This is a naive splitter. Next step: replace extracted.* with an LLM-based extractor.',
    'Planned output: shot drafts with references to scenes/characters/props specs.'
  ]
};

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'script.parse.json'), JSON.stringify(report, null, 2));

console.log(`script-split: ok (${segments.length} segments) -> reports/script.parse.json`);

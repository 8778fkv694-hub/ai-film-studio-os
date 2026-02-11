import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const ROOT = path.resolve(process.cwd(), '..');

export async function GET() {
  const result: any[] = [];

  for (const dir of ['shots', 'shots_draft']) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(fullDir, f), 'utf-8'));
        if (!result.find(s => s.shot_id === content.shot_id)) {
          content._source = dir;
          content._file = f;
          result.push(content);
        }
      } catch { /* skip invalid */ }
    }
  }

  result.sort((a, b) => a.shot_id.localeCompare(b.shot_id));
  return NextResponse.json(result);
}

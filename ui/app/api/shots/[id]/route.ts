import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const ROOT = path.resolve(process.cwd(), '..');

function readJsonSafe(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  if (!id || id.includes('..') || id.includes('/')) {
    return NextResponse.json({ error: 'Invalid shot id' }, { status: 400 });
  }

  const shot = readJsonSafe(path.join(ROOT, 'shots', `${id}.json`));
  if (!shot) {
    return NextResponse.json({ error: 'Shot not found' }, { status: 404 });
  }

  const prompt = readJsonSafe(path.join(ROOT, 'prompts', `${id}.prompt.json`));
  const finalPrompt = readJsonSafe(path.join(ROOT, 'prompts', `${id}.final.json`));
  const renderHistory = readJsonSafe(path.join(ROOT, 'renders', id, 'history.json'));

  // Load scene info
  let scene = null;
  if (shot.scene_ref) {
    scene = readJsonSafe(path.join(ROOT, shot.scene_ref));
  }

  // Load character info
  const characters = (shot.characters || []).map((c: any) => ({
    ...c,
    data: readJsonSafe(path.join(ROOT, c.ref)),
  }));

  // Load prop info
  const props = (shot.props || []).map((p: any) => ({
    ...p,
    data: readJsonSafe(path.join(ROOT, p.ref)),
  }));

  // Load fixups for this shot
  const fixups: any[] = [];
  const fixupsDir = path.join(ROOT, 'fixups');
  if (fs.existsSync(fixupsDir)) {
    const fixupFiles = fs.readdirSync(fixupsDir).filter(f => f.endsWith('.json'));
    for (const f of fixupFiles) {
      const fixup = readJsonSafe(path.join(fixupsDir, f));
      if (fixup && fixup.target_shot_id === id) {
        fixups.push(fixup);
      }
    }
  }

  // Load state
  let stateIn = null;
  if (shot.continuity?.state_in_ref) {
    stateIn = readJsonSafe(path.join(ROOT, shot.continuity.state_in_ref));
  }

  return NextResponse.json({
    shot,
    prompt,
    finalPrompt,
    renderHistory,
    scene,
    characters,
    props,
    fixups,
    stateIn,
  });
}

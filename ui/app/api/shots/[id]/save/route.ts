import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const ROOT = path.resolve(process.cwd(), '..');

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  if (!id || id.includes('..') || id.includes('/')) {
    return NextResponse.json({ error: 'Invalid shot id' }, { status: 400 });
  }

  const body = await request.json();
  const { shot, promote } = body;

  if (!shot || !shot.shot_id || shot.shot_id !== id) {
    return NextResponse.json({ error: 'Invalid shot data' }, { status: 400 });
  }

  // Remove internal fields before saving
  const toSave = { ...shot };
  delete toSave._source;
  delete toSave._file;

  // Determine save location
  const shotsPath = path.join(ROOT, 'shots', `${id}.json`);
  const draftPath = path.join(ROOT, 'shots_draft', `${id}.json`);

  // If promoting from draft to finalized
  if (promote && fs.existsSync(draftPath)) {
    fs.writeFileSync(shotsPath, JSON.stringify(toSave, null, 2));
    fs.unlinkSync(draftPath);
    return NextResponse.json({ ok: true, saved_to: 'shots', promoted: true });
  }

  // Save to whichever directory the shot currently lives in
  if (fs.existsSync(shotsPath)) {
    fs.writeFileSync(shotsPath, JSON.stringify(toSave, null, 2));
    return NextResponse.json({ ok: true, saved_to: 'shots' });
  }

  if (fs.existsSync(draftPath)) {
    fs.writeFileSync(draftPath, JSON.stringify(toSave, null, 2));
    return NextResponse.json({ ok: true, saved_to: 'shots_draft' });
  }

  // New shot - save to drafts
  fs.mkdirSync(path.join(ROOT, 'shots_draft'), { recursive: true });
  fs.writeFileSync(draftPath, JSON.stringify(toSave, null, 2));
  return NextResponse.json({ ok: true, saved_to: 'shots_draft', created: true });
}

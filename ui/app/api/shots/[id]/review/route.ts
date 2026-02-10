import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const ROOT = path.resolve(process.cwd(), '..');

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  if (!id || id.includes('..') || id.includes('/')) {
    return NextResponse.json({ error: 'Invalid shot id' }, { status: 400 });
  }

  const historyPath = path.join(ROOT, 'renders', id, 'history.json');
  if (!fs.existsSync(historyPath)) {
    return NextResponse.json({ error: 'Render history not found' }, { status: 404 });
  }

  const body = await request.json();
  const { take_id, rating, tags, notes } = body;

  if (!take_id) {
    return NextResponse.json({ error: 'take_id is required' }, { status: 400 });
  }

  const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
  const take = history.takes?.find((t: any) => t.take_id === take_id);

  if (!take) {
    return NextResponse.json({ error: 'Take not found' }, { status: 404 });
  }

  take.review = {
    rating: rating ?? take.review?.rating,
    tags: tags ?? take.review?.tags ?? [],
    notes: notes ?? take.review?.notes ?? '',
  };

  // If rating is 5, auto-mark as best_take
  if (rating === 5) {
    history.best_take = take_id;
  }

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

  return NextResponse.json({ ok: true, history });
}

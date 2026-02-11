import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DRAFTS_DIR = path.resolve(process.cwd(), '../shots_draft');
const SHOTS_DIR = path.resolve(process.cwd(), '../shots');

export async function POST(request: Request) {
  try {
    const shot = await request.json();
    const draftFilename = shot._filename || `${shot.shot_id}.json`;
    delete shot._filename;

    // Ensure shots directory exists
    if (!fs.existsSync(SHOTS_DIR)) {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
    }

    // Write to final shots directory
    const finalFilename = `${shot.shot_id}.json`;
    fs.writeFileSync(
      path.join(SHOTS_DIR, finalFilename),
      JSON.stringify(shot, null, 2),
      'utf-8'
    );

    // Remove from drafts directory
    const draftPath = path.join(DRAFTS_DIR, draftFilename);
    if (fs.existsSync(draftPath)) {
      fs.unlinkSync(draftPath);
    }

    return NextResponse.json({ success: true, message: '已移至正式镜头' });
  } catch (e) {
    return NextResponse.json({ error: '移动失败' }, { status: 500 });
  }
}

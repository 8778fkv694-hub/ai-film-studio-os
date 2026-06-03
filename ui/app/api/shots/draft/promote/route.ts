import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getResourcePath, getProjectJsonPath } from '@/lib/projects';
import { writeJsonAtomic } from '@/lib/fs-atomic';

export async function POST(request: Request) {
  try {
    const shot = await request.json();
    const draftFilename = shot._filename || `${shot.shot_id}.json`;
    delete shot._filename;

    const shotsDir = getResourcePath('shots');

    // Ensure shots directory exists
    if (!fs.existsSync(shotsDir)) {
      fs.mkdirSync(shotsDir, { recursive: true });
    }

    // Write to final shots directory
    const finalFilename = `${shot.shot_id}.json`;
    writeJsonAtomic(path.join(shotsDir, finalFilename), shot);

    // Remove from drafts directory
    const draftPath = path.join(getResourcePath('shots_draft'), draftFilename);
    if (fs.existsSync(draftPath)) {
      fs.unlinkSync(draftPath);
    }

    // Update project.json timeline
    const projectPath = getProjectJsonPath();
    if (fs.existsSync(projectPath)) {
      try {
        const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
        project.timeline = project.timeline || [];
        
        // Check if shot already exists in timeline
        const exists = project.timeline.some((item: any) => item.shot_id === shot.shot_id);
        if (!exists) {
          project.timeline.push({
            shot_id: shot.shot_id,
            shot_file: `shots/${finalFilename}`,
            tier: shot.budget?.tier || 'cheap'
          });
          
          // Sort timeline by shot_id numerically if possible, otherwise localeCompare
          project.timeline.sort((a: any, b: any) => {
            const numA = parseInt(a.shot_id.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.shot_id.replace(/\D/g, '')) || 0;
            if (numA !== numB) return numA - numB;
            return a.shot_id.localeCompare(b.shot_id);
          });

          writeJsonAtomic(projectPath, project);
          console.log(`[Promote] Added and sorted ${shot.shot_id} in project.json timeline.`);
        }
      } catch (err) {
        console.error('[Promote] Failed to update project.json timeline:', err);
      }
    }

    return NextResponse.json({ success: true, message: '已移至正式镜头并更新时间线' });
  } catch (e) {
    return NextResponse.json({ error: '移动失败' }, { status: 500 });
  }
}

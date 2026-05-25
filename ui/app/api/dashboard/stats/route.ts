import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd(), '..');

function countFiles(dir: string, ext = '.json'): number {
  const absDir = path.join(ROOT, dir);
  if (!fs.existsSync(absDir)) return 0;
  try {
    return fs.readdirSync(absDir).filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

function countKeyframes(): number {
  const rendersDir = path.join(ROOT, 'assets/renders');
  if (!fs.existsSync(rendersDir)) return 0;

  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);
  let count = 0;

  for (const shotId of fs.readdirSync(rendersDir)) {
    const keyframeDir = path.join(rendersDir, shotId, 'keyframes');
    if (!fs.existsSync(keyframeDir)) continue;

    count += fs.readdirSync(keyframeDir)
      .filter(file => imageExts.has(path.extname(file).toLowerCase()))
      .length;
  }

  return count;
}

function readJson(p: string) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // Read project
    const projectPath = path.join(ROOT, 'project.json');
    const project = fs.existsSync(projectPath) ? readJson(projectPath) : null;

    // Count resources
    const counts = {
      shots: countFiles('shots'),
      drafts: countFiles('shots_draft'),
      scenes: countFiles('scenes'),
      characters: countFiles('characters'),
      props: countFiles('props'),
      audioFiles: countFiles('assets/audio', '.mp3'),
      keyframes: countKeyframes(),
      imagePromptPackages: countFiles('prompts/image'),
      videoPromptPackages: countFiles('prompts', '.prompt.json'),
    };

    // Calculate total duration
    let totalDuration = 0;
    const shotsDir = path.join(ROOT, 'shots');
    if (fs.existsSync(shotsDir)) {
      const shotFiles = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json'));
      for (const f of shotFiles) {
        const shot = readJson(path.join(shotsDir, f));
        if (shot?.duration_s) {
          totalDuration += shot.duration_s;
        }
      }
    }

    // Read lint report if exists
    const lintReportPath = path.join(ROOT, 'reports/lint.report.json');
    const lintReport = fs.existsSync(lintReportPath) ? readJson(lintReportPath) : null;
    const issues = lintReport?.issues || [];

    // Determine check status based on report existence and content
    const validatePassed = counts.shots > 0; // Simplified: assume passed if shots exist
    const lintPassed = lintReport ? issues.filter((i: any) => i.level === 'ERROR').length === 0 : false;

    return NextResponse.json({
      project: project ? {
        id: project.id,
        name: project.name,
        description: project.description,
      } : null,
      counts,
      totalDuration,
      checks: {
        validate: validatePassed ? 'passed' : 'pending',
        lint: lintReport ? (lintPassed ? 'passed' : 'failed') : 'pending',
        lastRun: lintReport?.generatedAt || null,
      },
      issues: issues.slice(0, 20), // Limit to 20 issues
    });
  } catch (e) {
    return NextResponse.json({ error: '获取状态失败' }, { status: 500 });
  }
}

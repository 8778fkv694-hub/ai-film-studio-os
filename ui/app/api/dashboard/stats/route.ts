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

function runValidate(): { passed: boolean; errors: string[] } {
  const errors: string[] = [];
  const shotsDir = path.join(ROOT, 'shots');
  if (!fs.existsSync(shotsDir)) {
    errors.push('shots/ 目录不存在');
    return { passed: false, errors };
  }

  const shotFiles = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json'));
  if (shotFiles.length === 0) {
    errors.push('没有找到分镜文件');
    return { passed: false, errors };
  }

  const shotIds = new Set<string>();

  for (const f of shotFiles) {
    const shotPath = path.join(shotsDir, f);
    const shot = readJson(shotPath);
    if (!shot) {
      errors.push(`${f}: 文件格式错误`);
      continue;
    }

    if (!shot.shot_id) {
      errors.push(`${f}: 缺少 shot_id`);
      continue;
    }

    if (shotIds.has(shot.shot_id)) {
      errors.push(`${shot.shot_id}: shot_id 重复`);
    }
    shotIds.add(shot.shot_id);

    if (!shot.scene_ref) {
      errors.push(`${shot.shot_id}: 缺少 scene_ref`);
    } else if (!fs.existsSync(path.join(ROOT, shot.scene_ref))) {
      errors.push(`${shot.shot_id}: scene_ref 文件不存在 (${shot.scene_ref})`);
    }

    for (const ch of shot.characters || []) {
      if (!ch.ref) {
        errors.push(`${shot.shot_id}: 角色引用缺少 ref`);
      } else if (!fs.existsSync(path.join(ROOT, ch.ref))) {
        errors.push(`${shot.shot_id}: 角色文件不存在 (${ch.ref})`);
      }
    }

    for (const pr of shot.props || []) {
      if (!pr.ref) {
        errors.push(`${shot.shot_id}: 道具引用缺少 ref`);
      } else if (!fs.existsSync(path.join(ROOT, pr.ref))) {
        errors.push(`${shot.shot_id}: 道具文件不存在 (${pr.ref})`);
      }
    }

    if (shot.continuity?.state_in_ref && !fs.existsSync(path.join(ROOT, shot.continuity.state_in_ref))) {
      errors.push(`${shot.shot_id}: state_in_ref 文件不存在 (${shot.continuity.state_in_ref})`);
    }
  }

  return { passed: errors.length === 0, errors };
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

    // Real inline validation
    const { passed: validatePassed, errors: validateErrors } = runValidate();

    // Read lint report if exists
    const lintReportPath = path.join(ROOT, 'reports/lint.report.json');
    const lintReport = fs.existsSync(lintReportPath) ? readJson(lintReportPath) : null;
    const lintIssues = lintReport?.issues || [];
    const lintPassed = lintReport ? lintIssues.filter((i: any) => i.level === 'ERROR').length === 0 : false;

    // Merge validate errors into issues
    const allIssues = [
      ...lintIssues.map((i: any) => ({ level: i.level, where: i.where, msg: i.msg })),
      ...validateErrors.map(e => ({ level: 'ERROR', where: 'validate', msg: e }))
    ];

    return NextResponse.json({
      project: project ? {
        id: project.id,
        name: project.name,
        description: project.description,
      } : null,
      counts,
      totalDuration,
      checks: {
        validate: validatePassed ? 'passed' : 'failed',
        lint: lintReport ? (lintPassed ? 'passed' : 'failed') : 'pending',
        lastRun: lintReport?.generatedAt || null,
      },
      issues: allIssues.slice(0, 20),
    });
  } catch (e) {
    return NextResponse.json({ error: '获取状态失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentProjectPath } from '@/lib/projects';

function countFiles(projectPath: string, dir: string, ext = '.json'): number {
  const absDir = path.join(projectPath, dir);
  if (!fs.existsSync(absDir)) return 0;
  try {
    return fs.readdirSync(absDir).filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

function countKeyframes(projectPath: string): number {
  const rendersDir = path.join(projectPath, 'assets/renders');
  if (!fs.existsSync(rendersDir)) return 0;

  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
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

function runValidate(projectPath: string): { passed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const shotsDir = path.join(projectPath, 'shots');
  if (!fs.existsSync(shotsDir)) {
    errors.push('shots/ 目录不存在');
    return { passed: false, errors, warnings };
  }

  const shotFiles = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json'));
  if (shotFiles.length === 0) {
    errors.push('没有找到分镜文件');
    return { passed: false, errors, warnings };
  }

  const isTodo = (val: string) => String(val || '').startsWith('TODO:');
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
    } else if (isTodo(shot.scene_ref)) {
      warnings.push(`${shot.shot_id}: scene_ref 为占位符，请创建场景后更新`);
    } else if (!fs.existsSync(path.join(projectPath, shot.scene_ref))) {
      errors.push(`${shot.shot_id}: scene_ref 文件不存在 (${shot.scene_ref})`);
    }

    for (const ch of shot.characters || []) {
      if (!ch.ref) {
        errors.push(`${shot.shot_id}: 角色引用缺少 ref`);
      } else if (isTodo(ch.ref)) {
        warnings.push(`${shot.shot_id}: 角色引用为占位符，请创建角色或移除`);
      } else if (!fs.existsSync(path.join(projectPath, ch.ref))) {
        errors.push(`${shot.shot_id}: 角色文件不存在 (${ch.ref})`);
      }
    }

    for (const pr of shot.props || []) {
      if (!pr.ref) {
        errors.push(`${shot.shot_id}: 道具引用缺少 ref`);
      } else if (isTodo(pr.ref)) {
        warnings.push(`${shot.shot_id}: 道具引用为占位符，请创建道具或移除`);
      } else if (!fs.existsSync(path.join(projectPath, pr.ref))) {
        errors.push(`${shot.shot_id}: 道具文件不存在 (${pr.ref})`);
      }
    }

    if (shot.continuity?.state_in_ref && !fs.existsSync(path.join(projectPath, shot.continuity.state_in_ref))) {
      errors.push(`${shot.shot_id}: state_in_ref 文件不存在 (${shot.continuity.state_in_ref})`);
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

export async function GET() {
  try {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) {
      return NextResponse.json({ error: '没有活动项目' }, { status: 404 });
    }

    // Read project
    const projectJsonPath = path.join(projectPath, 'project.json');
    const project = fs.existsSync(projectJsonPath) ? readJson(projectJsonPath) : null;

    // Count resources
    const counts = {
      shots: countFiles(projectPath, 'shots'),
      drafts: countFiles(projectPath, 'shots_draft'),
      scenes: countFiles(projectPath, 'scenes'),
      characters: countFiles(projectPath, 'characters'),
      props: countFiles(projectPath, 'props'),
      audioFiles: countFiles(projectPath, 'assets/audio', '.mp3'),
      keyframes: countKeyframes(projectPath),
      imagePromptPackages: countFiles(projectPath, 'prompts/image'),
      videoPromptPackages: countFiles(projectPath, 'prompts', '.prompt.json'),
    };

    // Calculate total duration
    let totalDuration = 0;
    const shotsDir = path.join(projectPath, 'shots');
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
    const { passed: validatePassed, errors: validateErrors, warnings: validateWarnings } = runValidate(projectPath);

    // Read lint report if exists
    const lintReportPath = path.join(projectPath, 'reports/lint.report.json');
    const lintReport = fs.existsSync(lintReportPath) ? readJson(lintReportPath) : null;
    const lintIssues = lintReport?.issues || [];
    const lintPassed = lintReport ? lintIssues.filter((i: any) => i.level === 'ERROR').length === 0 : false;

    // Merge validate errors/warnings into issues
    const parseFixable = (msg: string) => {
      const m = msg.match(/文件不存在 \(([^)]+)\)/);
      if (m) {
        const filePath = m[1];
        let type = 'unknown';
        if (filePath.startsWith('scenes/')) type = 'scene';
        else if (filePath.startsWith('characters/')) type = 'character';
        else if (filePath.startsWith('props/')) type = 'prop';
        else if (filePath.startsWith('states/')) type = 'state';
        return { fixPath: filePath, fixType: type };
      }
      return null;
    };

    const allIssues = [
      ...lintIssues.map((i: any) => {
        const fixInfo = parseFixable(i.msg);
        return { level: i.level, where: i.where, msg: i.msg, ...fixInfo };
      }),
      ...(validateErrors || []).map(e => {
        const fixInfo = parseFixable(e);
        return { level: 'ERROR', where: 'validate', msg: e, ...fixInfo };
      }),
      ...(validateWarnings || []).map(w => {
        const fixInfo = parseFixable(w);
        return { level: 'WARN', where: 'validate', msg: w, ...fixInfo };
      })
    ].filter((issue: any) => issue.level === 'ERROR' || issue.level === 'WARN');

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

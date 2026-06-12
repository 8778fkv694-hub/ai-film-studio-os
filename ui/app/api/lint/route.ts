import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { getCurrentProjectPath } from '@/lib/projects';

const execFileAsync = promisify(execFile);

interface LintIssue {
  level: 'ERROR' | 'WARN' | 'INFO';
  where: string;
  msg: string;
}

interface LintReport {
  generatedAt: string;
  issueCount: number;
  issues: LintIssue[];
}

// 从 issue 的 where 字段里提取镜头 ID，例如：
//   "shots/S002A.json"            -> S002A
//   "states/continuity (S001)"    -> S001
//   "prompts/S003.final.json"     -> S003
function extractShotId(issue: LintIssue): string | null {
  const fileMatch = issue.where.match(/(?:shots|prompts|states)\/([A-Za-z0-9_-]+?)(?:_OUT|_IN)?(?:\.final|\.prompt|\.image)?\.json/);
  if (fileMatch) return fileMatch[1];
  const parenMatch = issue.where.match(/\(([A-Za-z0-9_-]+)\)/);
  if (parenMatch) return parenMatch[1];
  return null;
}

function groupReport(report: LintReport) {
  const byShot: Record<string, LintIssue[]> = {};
  const global: LintIssue[] = [];
  for (const issue of report.issues) {
    const shotId = extractShotId(issue);
    if (shotId) {
      (byShot[shotId] ||= []).push(issue);
    } else {
      global.push(issue);
    }
  }
  const counts = { error: 0, warn: 0, info: 0 };
  for (const issue of report.issues) {
    if (issue.level === 'ERROR') counts.error++;
    else if (issue.level === 'WARN') counts.warn++;
    else counts.info++;
  }
  return { generatedAt: report.generatedAt, counts, byShot, global };
}

function readReport(): LintReport | null {
  const projectPath = getCurrentProjectPath();
  if (!projectPath) return null;
  const reportPath = path.join(projectPath, 'reports', 'lint.report.json');
  if (!fs.existsSync(reportPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  } catch {
    return null;
  }
}

// GET：读取已有报告（不重跑 lint）
export async function GET() {
  const report = readReport();
  if (!report) {
    return NextResponse.json({ available: false });
  }
  return NextResponse.json({ available: true, ...groupReport(report) });
}

// POST：先跑 lint.js 再返回分组结果
export async function POST() {
  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const projectPath = getCurrentProjectPath();
    const toolPath = path.join(projectRoot, 'tools/scripts', 'lint.js');
    const args = [toolPath];
    if (projectPath) args.push('--project-dir', projectPath);
    // lint.js 在有 ERROR 时以非零退出码结束，但报告文件已写出，所以忽略退出码
    await execFileAsync('node', args, { cwd: projectRoot, timeout: 60000 }).catch(() => {});
  } catch {
    // 忽略执行异常，尽量返回已有报告
  }
  const report = readReport();
  if (!report) {
    return NextResponse.json({ available: false, error: 'lint 执行后未找到报告文件' }, { status: 500 });
  }
  return NextResponse.json({ available: true, ...groupReport(report) });
}

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getCurrentProjectPath } from '@/lib/projects';
import { execFile } from 'child_process';

function runScript(scriptName: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const rootDir = path.resolve(process.cwd(), '..');
  const scriptPath = path.join(rootDir, 'tools/scripts', scriptName);
  
  return new Promise((resolve) => {
    execFile('node', [scriptPath, ...args], { cwd: rootDir }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout,
        stderr
      });
    });
  });
}

export async function GET() {
  try {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) {
      return NextResponse.json({ error: '没有活动项目' }, { status: 400 });
    }

    const reportFile = path.join(projectPath, 'reports', 'asset-index.json');
    if (!fs.existsSync(reportFile)) {
      const res = await runScript('build-asset-index.js', ['--project-dir', projectPath]);
      if (res.code !== 0) {
        return NextResponse.json({ error: '生成资产索引失败', details: res.stderr || res.stdout }, { status: 500 });
      }
    }

    if (!fs.existsSync(reportFile)) {
      return NextResponse.json({ error: '资产索引文件未找到' }, { status: 404 });
    }

    const content = fs.readFileSync(reportFile, 'utf-8');
    const index = JSON.parse(content);
    return NextResponse.json(index);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '获取资产库失败' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) {
      return NextResponse.json({ error: '没有活动项目' }, { status: 400 });
    }

    const res = await runScript('build-asset-index.js', ['--project-dir', projectPath]);
    if (res.code !== 0) {
      return NextResponse.json({ error: '生成资产索引失败', details: res.stderr || res.stdout }, { status: 500 });
    }

    const reportFile = path.join(projectPath, 'reports', 'asset-index.json');
    if (!fs.existsSync(reportFile)) {
      return NextResponse.json({ error: '资产索引文件未找到' }, { status: 404 });
    }

    const content = fs.readFileSync(reportFile, 'utf-8');
    const index = JSON.parse(content);
    return NextResponse.json({ success: true, ...index });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '更新资产库失败' }, { status: 500 });
  }
}

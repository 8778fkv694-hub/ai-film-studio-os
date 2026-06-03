import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { getActiveProjectId, getCurrentProjectPath, getProjectsData, getResourcePath } from '@/lib/projects';

const execFileAsync = promisify(execFile);

function readJsonIfExists(filePath: string): any | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function copyDirRecursive(sourceDir: string, destDir: string): void {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

function listRelativeFiles(rootDir: string, baseDir = rootDir): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRelativeFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  return files.sort();
}

function buildReadme(params: {
  shot: string;
  projectName?: string;
  shotData: any | null;
  historyData: any | null;
  files: Record<string, string[]>;
  warnings: string[];
}): string {
  const activeTakeId = params.historyData?.active_take_id || '';
  const activeTakeLabel = activeTakeId || '无';
  const activeTake = (params.historyData?.takes || []).find((t: any) => t.take_id === activeTakeId);
  const editingHint = activeTakeId
    ? `优先使用 takes/${activeTakeId}/video.*、音频文件和 keyframes/。`
    : '未发现当前 Take；可先用 keyframes/、音频文件和提示词判断这一镜状态。';
  const voiceoverText = params.shotData?.voiceover?.text || params.shotData?.dialogue || '';
  const lines = [
    `# ${params.shot} 视频交接包`,
    '',
    `项目: ${params.projectName || '当前项目'}`,
    `镜头: ${params.shot}`,
    `时长: ${params.shotData?.duration_s ?? activeTake?.duration_s ?? '未知'}s`,
    `当前 Take: ${activeTakeLabel}`,
    '',
    '## 打开顺序',
    '',
    '1. 先看 handoff_manifest.json，确认这一镜当前有哪些素材。',
    `2. 剪映手动剪辑：${editingHint}`,
    `3. 下游 AI 接手：优先读取 ${params.shot}.final.json；需要原始镜头信息时读取 shot.json。`,
    '',
    '## 已包含',
    '',
    `- 原提示词: ${params.files.prompts.length ? params.files.prompts.join(', ') : '无'}`,
    `- 音频: ${params.files.audio.length ? params.files.audio.join(', ') : '无'}`,
    `- 关键帧: ${params.files.keyframes.length} 个`,
    `- Take 视频与版本素材: ${params.files.takes.length} 个文件`,
    `- 兼容旧 video/ 目录: ${params.files.video.length} 个文件`,
    '',
    '## 旁白',
    '',
    voiceoverText || '无',
  ];

  if (params.warnings.length) {
    lines.push('', '## 注意', '', ...params.warnings.map((w) => `- ${w}`));
  }

  return `${lines.join('\n')}\n`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shot: string }> }
) {
  const { shot } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(shot)) {
    return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
  }

  try {
    const projectRoot = path.resolve(process.cwd(), '..');
    const workDir = getCurrentProjectPath() || projectRoot;
    const localDir = path.join(projectRoot, '.local');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const tempExportDir = path.join(localDir, `shot_handoff_${shot}`);
    if (fs.existsSync(tempExportDir)) {
      fs.rmSync(tempExportDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempExportDir, { recursive: true });

    const activeProjectId = getActiveProjectId();
    const projectsData = getProjectsData();
    const projectInfo = activeProjectId
      ? projectsData.projects.find((p) => p.id === activeProjectId)
      : null;

    const shotJson = path.join(workDir, 'shots', `${shot}.json`);
    const shotData = readJsonIfExists(shotJson);
    if (fs.existsSync(shotJson)) {
      fs.copyFileSync(shotJson, path.join(tempExportDir, 'shot.json'));
    }

    // 1. Copy prompts
    const promptsDir = getResourcePath('prompts');
    const promptJson = path.join(promptsDir, `${shot}.prompt.json`);
    const finalJson = path.join(promptsDir, `${shot}.final.json`);
    if (fs.existsSync(promptJson)) {
      fs.copyFileSync(promptJson, path.join(tempExportDir, `${shot}.prompt.json`));
    }
    if (fs.existsSync(finalJson)) {
      fs.copyFileSync(finalJson, path.join(tempExportDir, `${shot}.final.json`));
    }

    // 2. Copy audio
    const audioFile = path.join(workDir, 'assets/audio', `${shot}.mp3`);
    if (fs.existsSync(audioFile)) {
      fs.copyFileSync(audioFile, path.join(tempExportDir, `${shot}.mp3`));
    }

    // 3. Copy keyframes
    const keyframesSourceDir = path.join(workDir, 'assets/renders', shot, 'keyframes');
    if (fs.existsSync(keyframesSourceDir)) {
      copyDirRecursive(keyframesSourceDir, path.join(tempExportDir, 'keyframes'));
    }

    // 4. Copy videos
    const videoSourceDir = path.join(workDir, 'assets/renders', shot, 'video');
    if (fs.existsSync(videoSourceDir)) {
      copyDirRecursive(videoSourceDir, path.join(tempExportDir, 'video'));
    }

    // 5. Copy current take history and uploaded/generated take videos.
    const renderShotDir = path.join(workDir, 'assets/renders', shot);
    const historyPath = path.join(renderShotDir, 'history.json');
    const historyData = readJsonIfExists(historyPath);
    if (fs.existsSync(historyPath)) {
      fs.copyFileSync(historyPath, path.join(tempExportDir, 'history.json'));
    }
    const takesSourceDir = path.join(renderShotDir, 'takes');
    if (fs.existsSync(takesSourceDir)) {
      copyDirRecursive(takesSourceDir, path.join(tempExportDir, 'takes'));
    }

    const files = {
      prompts: [`${shot}.prompt.json`, `${shot}.final.json`].filter((f) => fs.existsSync(path.join(tempExportDir, f))),
      audio: [`${shot}.mp3`].filter((f) => fs.existsSync(path.join(tempExportDir, f))),
      keyframes: listRelativeFiles(path.join(tempExportDir, 'keyframes')).map((f) => `keyframes/${f}`),
      video: listRelativeFiles(path.join(tempExportDir, 'video')).map((f) => `video/${f}`),
      takes: listRelativeFiles(path.join(tempExportDir, 'takes')).map((f) => `takes/${f}`),
      metadata: ['shot.json', 'history.json', 'handoff_manifest.json', 'README.md'],
    };
    const warnings = [
      !files.takes.length && !files.video.length ? '未找到视频文件，交接包只包含提示词/音频/关键帧等当前可用素材。' : '',
      !files.audio.length ? '未找到该镜头音频文件。' : '',
      !files.keyframes.length ? '未找到该镜头关键帧。' : '',
    ].filter(Boolean);
    const activeTake = (historyData?.takes || []).find((t: any) => t.take_id === historyData?.active_take_id) || null;
    const manifest = {
      type: 'ai-film-studio-shot-video-handoff',
      version: 1,
      generated_at: new Date().toISOString(),
      project: {
        id: activeProjectId,
        name: projectInfo?.name || path.basename(workDir),
      },
      shot_id: shot,
      duration_s: shotData?.duration_s ?? activeTake?.duration_s ?? null,
      voiceover: {
        speaker: shotData?.voiceover?.speaker || null,
        text: shotData?.voiceover?.text || shotData?.dialogue || '',
        voice_id: shotData?.voiceover?.voice_id || null,
        audio_file: files.audio[0] || null,
      },
      active_take: activeTake,
      take_count: historyData?.takes?.length || 0,
      files,
      warnings,
      source_shot: shotData,
    };
    fs.writeFileSync(path.join(tempExportDir, 'handoff_manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(
      path.join(tempExportDir, 'README.md'),
      buildReadme({ shot, projectName: projectInfo?.name, shotData, historyData, files, warnings }),
      'utf-8'
    );

    const zipPath = path.join(localDir, `handoff_${shot}.zip`);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    await execFileAsync('zip', ['-r', zipPath, '.'], { cwd: tempExportDir });

    if (!fs.existsSync(zipPath)) {
      return new NextResponse('ZIP generation failed', { status: 500 });
    }

    const fileBuffer = fs.readFileSync(zipPath);

    // Clean up
    fs.unlinkSync(zipPath);
    fs.rmSync(tempExportDir, { recursive: true, force: true });

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename=handoff_${shot}.zip`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-store'
      }
    });
  } catch (e: any) {
    return new NextResponse(`Export failed: ${e.message}`, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getResourcePath, getCurrentProjectPath } from '@/lib/projects';
import { isSafeId, KEYFRAME_EXTS, VIDEO_EXTS, md5Short, speechHash } from '@shared/conventions.js';

const STALE_TOLERANCE_MS = 1000;

function listKeyframes(shotId: string) {
  if (!isSafeId(shotId)) return [];

  const keyframeDir = path.join(getResourcePath('assets'), 'renders', shotId, 'keyframes');
  if (!fs.existsSync(keyframeDir)) return [];

  return fs.readdirSync(keyframeDir)
    .filter(file => KEYFRAME_EXTS.includes(path.extname(file).toLowerCase()))
    .sort()
    .map(file => `/api/assets/keyframes/${encodeURIComponent(shotId)}/${encodeURIComponent(file)}`);
}

function findUploadedVideo(shotId: string) {
  if (!isSafeId(shotId)) return null;
  const videoDir = path.join(getResourcePath('assets'), 'renders', shotId, 'video');
  if (!fs.existsSync(videoDir)) return null;

  const files = fs.readdirSync(videoDir);
  const videoFile = files.find(file => VIDEO_EXTS.includes(path.extname(file).toLowerCase()));

  if (!videoFile) return null;
  const fullPath = path.join(videoDir, videoFile);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
    return `/api/assets/video/${encodeURIComponent(shotId)}/${encodeURIComponent(videoFile)}`;
  }
  return null;
}

function readJsonFile(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function fileMtime(filePath: string): number {
  try {
    return fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
  } catch {
    return 0;
  }
}

function maxDirMtime(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let max = fileMtime(dirPath);
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    max = Math.max(max, entry.isDirectory() ? maxDirMtime(fullPath) : fileMtime(fullPath));
  }
  return max;
}

function resolveResourcePath(projectPath: string | null, projectRoot: string, relPath?: string | null): string | null {
  if (!projectPath || !relPath || typeof relPath !== 'string') return null;
  if (path.isAbsolute(relPath)) return relPath;
  const projectFile = path.join(projectPath, relPath);
  if (fs.existsSync(projectFile)) return projectFile;
  return path.join(projectRoot, relPath);
}

function collectSourceMtime(projectPath: string | null, projectRoot: string, shotPath: string, shot: any): number {
  if (!projectPath) return fileMtime(shotPath);

  const sourcePaths = new Set<string>([
    shotPath,
    path.join(projectPath, 'project.json')
  ]);

  const addJsonRef = (relPath?: string | null) => {
    const resolved = resolveResourcePath(projectPath, projectRoot, relPath);
    if (!resolved) return null;
    sourcePaths.add(resolved);
    return readJsonFile(resolved);
  };

  const scene = addJsonRef(shot.scene_ref);
  addJsonRef(shot.style_ref || scene?.style_ref);

  for (const item of shot.characters || []) addJsonRef(item?.ref);
  for (const item of shot.props || []) addJsonRef(item?.ref);

  return Math.max(...Array.from(sourcePaths).map(fileMtime));
}

function promptState(promptPath: string, sourceMtime: number) {
  const exists = fs.existsSync(promptPath);
  const mtime = fileMtime(promptPath);
  if (!exists) return { state: 'missing', mtime };
  if (sourceMtime > mtime + STALE_TOLERANCE_MS) return { state: 'stale', mtime };
  return { state: 'ok', mtime };
}

function buildSyncState(args: {
  shot: any;
  shotPath: string;
  projectPath: string | null;
  projectRoot: string;
  promptsDir: string;
  activeTake: any | null;
  hasAudio: boolean;
}) {
  const { shot, shotPath, projectPath, projectRoot, promptsDir, activeTake, hasAudio } = args;
  const baseSourceMtime = collectSourceMtime(projectPath, projectRoot, shotPath, shot);
  const keyframesMtime = projectPath
    ? maxDirMtime(path.join(projectPath, 'assets/renders', shot.shot_id, 'keyframes'))
    : 0;
  const promptSourceMtime = Math.max(baseSourceMtime, keyframesMtime);

  const videoPromptPath = path.join(promptsDir, `${shot.shot_id}.final.json`);
  const imagePromptPath = path.join(promptsDir, 'image', `${shot.shot_id}.image.json`);
  const videoPrompt = promptState(videoPromptPath, promptSourceMtime);
  const imagePrompt = promptState(imagePromptPath, promptSourceMtime);

  const reasons: string[] = [];
  const actions: string[] = [];

  if (videoPrompt.state === 'missing') reasons.push('视频 Prompt 未编译');
  if (videoPrompt.state === 'stale') reasons.push('视频 Prompt 已落后于镜头/素材修改');
  if (imagePrompt.state === 'missing') reasons.push('图片 Prompt 未编译');
  if (imagePrompt.state === 'stale') reasons.push('图片 Prompt 已落后于镜头/素材修改');
  if (videoPrompt.state !== 'ok' || imagePrompt.state !== 'ok') actions.push('sync_prompts');

  let currentPromptHash = '';
  if (fs.existsSync(videoPromptPath)) {
    try {
      currentPromptHash = md5Short(fs.readFileSync(videoPromptPath, 'utf-8'));
    } catch {}
  }

  let takePromptState: 'none' | 'unknown' | 'ok' | 'stale' = activeTake ? 'unknown' : 'none';
  if (activeTake && currentPromptHash && activeTake.prompt_hash) {
    takePromptState = activeTake.prompt_hash === currentPromptHash ? 'ok' : 'stale';
    if (takePromptState === 'stale') {
      reasons.push('当前视频 Take 基于旧 Prompt');
      actions.push('accept_take_prompt_hash');
    }
  } else if (activeTake && !activeTake.prompt_hash) {
    reasons.push('当前视频 Take 缺少 Prompt 版本标记');
    actions.push('accept_take_prompt_hash');
  }

  const hasVoiceText = Boolean(shot.voiceover?.text || shot.dialogue?.text);
  let audioState: 'none' | 'missing' | 'ok' | 'stale' = 'none';
  if (hasVoiceText) {
    audioState = hasAudio ? 'ok' : 'missing';
    if (audioState === 'missing') {
      reasons.push('有台词/旁白但尚未生成音频');
      actions.push('generate_tts');
    } else if (projectPath) {
      // 比对生成时记录的台词指纹，台词改了但音频没重生成 → 配音过期
      const metaPath = path.join(projectPath, 'assets/audio', `${shot.shot_id}.mp3.meta.json`);
      try {
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          if (meta?.text_hash && meta.text_hash !== speechHash(shot)) {
            audioState = 'stale';
            reasons.push('台词/旁白已修改，配音已过期');
            actions.push('generate_tts');
          }
        }
      } catch {}
    }
  }

  const status = reasons.length ? 'warning' : 'ok';
  const label = videoPrompt.state !== 'ok' || imagePrompt.state !== 'ok'
    ? '待同步'
    : takePromptState === 'stale'
    ? '旧视频'
    : audioState === 'missing'
    ? '待配音'
    : audioState === 'stale'
    ? '配音过期'
    : '已同步';

  return {
    status,
    label,
    reasons,
    actions: Array.from(new Set(actions)),
    video_prompt_state: videoPrompt.state,
    image_prompt_state: imagePrompt.state,
    take_prompt_state: takePromptState,
    audio_state: audioState,
    current_prompt_hash: currentPromptHash || null,
    source_mtime: promptSourceMtime,
    video_prompt_mtime: videoPrompt.mtime,
    image_prompt_mtime: imagePrompt.mtime
  };
}

export async function GET() {
  try {
    const shotsDir = getResourcePath('shots');
    if (!fs.existsSync(shotsDir)) {
      return NextResponse.json([]);
    }
    const promptsDir = getResourcePath('prompts');
    const projectPath = getCurrentProjectPath();
    const projectRoot = path.resolve(process.cwd(), '..');
    const project = projectPath ? (() => {
      try {
        return JSON.parse(fs.readFileSync(path.join(projectPath, 'project.json'), 'utf-8'));
      } catch {
        return null;
      }
    })() : null;
    const timelineOrder = new Map<string, number>(
      (project?.timeline || []).map((item: any, index: number) => [item.shot_id, index])
    );
    const files = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json'));
    const shots = files.map(f => {
      const shotPath = path.join(shotsDir, f);
      const content = fs.readFileSync(shotPath, 'utf-8');
      const shot = JSON.parse(content);
      const keyframes = listKeyframes(shot.shot_id);
      
      // Load history and takes
      let takes: any[] = [];
      let activeTake: any = null;
      let videoUrl = findUploadedVideo(shot.shot_id); // legacy fallback

      const historyPath = path.join(getResourcePath('assets'), 'renders', shot.shot_id, 'history.json');
      if (fs.existsSync(historyPath)) {
        try {
          const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
          takes = history.takes || [];
          if (history.active_take_id) {
            activeTake = takes.find((t: any) => t.take_id === history.active_take_id) || null;
            if (activeTake && activeTake.video_path) {
              const fullVideoPath = projectPath ? path.join(projectPath, activeTake.video_path) : '';
              if (fullVideoPath && fs.existsSync(fullVideoPath) && fs.statSync(fullVideoPath).size > 0) {
                videoUrl = `/api/assets/reference/${activeTake.video_path}`;
              } else {
                videoUrl = null;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Load final compiled prompt if it exists
      let videoPrompt = null;
      const promptPath = path.join(promptsDir, `${shot.shot_id}.final.json`);
      if (fs.existsSync(promptPath)) {
        try {
          videoPrompt = JSON.parse(fs.readFileSync(promptPath, 'utf-8'));
        } catch {
          // ignore
        }
      }

      // 是否已生成配音（用于行内编辑时的时长基准判定）
      let hasAudio = false;
      try {
        const audioPath = path.join(getResourcePath('assets'), 'audio', `${shot.shot_id}.mp3`);
        hasAudio = fs.existsSync(audioPath) && fs.statSync(audioPath).size > 1024;
      } catch {}

      return {
        ...shot,
        _filename: f,
        _keyframes: keyframes,
        _selected_keyframe: keyframes[0] || null,
        _video_url: videoUrl,
        _video_prompt: videoPrompt,
        _takes: takes,
        _active_take: activeTake,
        _has_audio: hasAudio,
        _sync_state: buildSyncState({
          shot,
          shotPath,
          projectPath,
          projectRoot,
          promptsDir,
          activeTake,
          hasAudio
        })
      };
    });

    // Sort by timeline first; fall back to shot_id for orphan files.
    shots.sort((a, b) => {
      const ai = timelineOrder.has(a.shot_id) ? timelineOrder.get(a.shot_id)! : Number.MAX_SAFE_INTEGER;
      const bi = timelineOrder.has(b.shot_id) ? timelineOrder.get(b.shot_id)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.shot_id.localeCompare(b.shot_id);
    });
    return NextResponse.json(shots);
  } catch (e) {
    return NextResponse.json({ error: '读取失败' }, { status: 500 });
  }
}

const SHOT_WHITELIST_FIELDS = [
  'shot_id',
  'duration_s',
  'style_ref',
  'scene_ref',
  'cam_setup_ref',
  'characters',
  'props',
  'action',
  'dialogue',
  'voiceover',
  'continuity',
  'budget',
  'context_refs',
  'prompt',
  'blocking',
  'parent_shot_id',
  'parent_context',
  'segment_index',
  'segment_count',
  'split_reason'
];

export async function POST(request: Request) {
  try {
    const shot = await request.json();
    if (!shot.shot_id || !/^[A-Za-z0-9_-]+$/.test(shot.shot_id)) {
      return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
    }
    const filename = path.basename(shot._filename || `${shot.shot_id}.json`);

    // Extract only whitelisted fields to prevent polluting the file with UI layout/computed fields
    const cleanShot: any = {};
    for (const key of SHOT_WHITELIST_FIELDS) {
      if (shot[key] !== undefined) {
        cleanShot[key] = shot[key];
      }
    }

    fs.writeFileSync(
      path.join(getResourcePath('shots'), filename),
      JSON.stringify(cleanShot, null, 2),
      'utf-8'
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

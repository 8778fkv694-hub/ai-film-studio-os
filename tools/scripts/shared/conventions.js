// 全仓库共享的「约定」单一事实源：ID 规则、文件扩展名、内容指纹。
// tools/scripts/* 与 ui/app/api/*（经同目录的 conventions.d.ts 提供类型）都从这里取，
// 禁止在各处复制这些规则 —— 一个规则只在一处定义。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// 镜头 / 项目等资源 ID 的合法字符
export const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;

export function isSafeId(id) {
  return typeof id === 'string' && SAFE_ID_RE.test(id);
}

// 关键帧（图片）与视频允许的扩展名（含点，小写）
export const KEYFRAME_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
export const VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.avi'];

// 短指纹：用于 prompt_hash / 台词指纹等「变了即过期」的比对
export function md5Short(input) {
  return crypto.createHash('md5').update(input).digest('hex').substring(0, 8);
}

// 默认 TTS 音色（与 gen-tts.js 的合成参数对应）
export const DEFAULT_VOICEOVER_VOICE = 'zh-CN-XiaoxiaoNeural';
export const DEFAULT_DIALOGUE_VOICE = 'zh-CN-YunxiNeural';

// 语音内容指纹：台词文本或音色变了即视为配音过期
export function speechHash(shot) {
  const segments = [];
  if (shot?.voiceover?.text) {
    segments.push(`voiceover:${shot.voiceover.voice_id || DEFAULT_VOICEOVER_VOICE}:${shot.voiceover.text}`);
  }
  if (shot?.dialogue?.text) {
    segments.push(`dialogue:${shot.dialogue.voice_id || DEFAULT_DIALOGUE_VOICE}:${shot.dialogue.text}`);
  }
  return md5Short(segments.join('|'));
}

// 把指定 take 的首帧/末帧刷进全局 keyframes（frame_00 作 poster、frame_last 备用），
// 使预览画面与当前活动视频一致。
export function syncActiveTakeKeyframes(projectPath, shotId, takeId) {
  const takeDir = path.join(projectPath, 'assets', 'renders', shotId, 'takes', takeId);
  const first = path.join(takeDir, 'keyframe_first.jpg');
  const last = path.join(takeDir, 'keyframe.jpg');
  const globalKeyframesDir = path.join(projectPath, 'assets', 'renders', shotId, 'keyframes');
  try {
    fs.mkdirSync(globalKeyframesDir, { recursive: true });
    if (fs.existsSync(first)) {
      fs.copyFileSync(first, path.join(globalKeyframesDir, 'frame_00.jpg'));
    }
    if (fs.existsSync(last)) {
      fs.copyFileSync(last, path.join(globalKeyframesDir, 'frame_last.jpg'));
    }
  } catch (err) {
    console.warn(`[syncActiveTakeKeyframes] failed:`, err);
  }
}

// 获取当前镜头的 prompt hash
export function currentPromptHash(projectPath, shotId) {
  const promptPath = path.join(projectPath, 'prompts', `${shotId}.final.json`);
  if (!fs.existsSync(promptPath)) return '';
  try {
    const content = fs.readFileSync(promptPath, 'utf-8');
    return md5Short(content);
  } catch {
    return '';
  }
}

// 镜头数据在前端的共享类型（/api/shots 的返回结构）
export interface Shot {
  shot_id: string;
  duration_s: number;
  action?: { beats?: string[] };
  dialogue?: { text: string; speaker: string };
  voiceover?: { text: string; speaker?: string };
  scene_ref?: string;
  prompt?: { positive?: string; negative?: string };
  _keyframes?: string[];
  _selected_keyframe?: string | null;
  _video_url?: string | null;
  _video_prompt?: {
    prompt: string;
    prompt_shot_only?: string;
    negative: string;
    motion: string;
    condition_images?: string[];
  } | null;
  _takes?: any[];
  _active_take?: any | null;
  _filename?: string;
  _has_audio?: boolean;
  _sync_state?: {
    status: 'ok' | 'warning' | 'error';
    label: string;
    reasons: string[];
    actions: string[];
    video_prompt_state?: 'missing' | 'stale' | 'ok';
    image_prompt_state?: 'missing' | 'stale' | 'ok';
    take_prompt_state?: 'none' | 'unknown' | 'ok' | 'stale';
    audio_state?: 'none' | 'missing' | 'ok' | 'stale';
    current_prompt_hash?: string | null;
  };
  layout?: {
    fitMode: 'contain' | 'cover' | 'fill';
    scale: number;
    stretchX: number;
    stretchY: number;
  };
  blocking?: any;
}

// /api/lint 返回的单条检查结果
export interface LintIssue {
  level: 'ERROR' | 'WARN' | 'INFO';
  where: string;
  msg: string;
}

export interface ShotData {
  shot_id: string;
  duration_s: number;
  characters?: Array<{ ref: string; [key: string]: unknown }>;
  props?: Array<{ ref: string; state?: string; [key: string]: unknown }>;
  cam_setup_ref?: string;
  action?: { beats?: string[] };
  dialogue?: { speaker: string; text: string; voice_id?: string } | null;
  voiceover?: { speaker?: string; text: string; voice_id?: string } | null;
  scene_ref?: string;
  context_refs?: string[];
  [key: string]: unknown;
}

export interface ShotSceneInput {
  shot: ShotData;
  keyframe: string | null;
  audio: string | null;
}

export interface ProjectData {
  name: string;
  timeline: string[];
}

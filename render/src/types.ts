export interface ShotData {
  shot_id: string;
  duration_s: number;
  cam_setup_ref?: string;
  action?: { beats?: string[] };
  dialogue?: { speaker: string; text: string; voice_id?: string };
  voiceover?: { speaker?: string; text: string; voice_id?: string };
  scene_ref?: string;
}

export interface ShotSceneInput {
  shot: ShotData;
  keyframePath: string | null;
  audioPath: string | null;
}

export interface ProjectData {
  name: string;
  timeline: string[];
}

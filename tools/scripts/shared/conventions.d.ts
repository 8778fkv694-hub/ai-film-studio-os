// conventions.js 的类型声明，供 ui/（TypeScript）直接 import 同一份实现
export declare const SAFE_ID_RE: RegExp;
export declare function isSafeId(id: unknown): boolean;
export declare const KEYFRAME_EXTS: string[];
export declare const VIDEO_EXTS: string[];
export declare function md5Short(input: string): string;
export declare const DEFAULT_VOICEOVER_VOICE: string;
export declare const DEFAULT_DIALOGUE_VOICE: string;
export declare function speechHash(shot: {
  voiceover?: { text?: string; voice_id?: string } | null;
  dialogue?: { text?: string; voice_id?: string } | null;
} | null | undefined): string;
export declare function syncActiveTakeKeyframes(projectPath: string, shotId: string, takeId: string): void;
export declare function currentPromptHash(projectPath: string, shotId: string): string;


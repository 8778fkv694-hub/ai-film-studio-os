import fs from 'fs';
import path from 'path';
import { writeJsonAtomic } from './fs-atomic';

export interface AiSettings {
  aiEnabled: boolean;
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  textModel: string;
  multimodalEnabled: boolean;
  visionModel: string;
  promptOptimization: boolean;
  // 按任务分档的「创意 vs 精准」：precise(低温少发挥) | balanced | creative(高温更丰富)
  creativitySplit: string;      // 剧本拆分分镜
  creativityImage: string;      // 画面/提示词优化
  creativityVoiceover: string;  // 台词润色
  imageWorkflow: string;
  imageModel: string;
  notes: string;
  comfyEnabled: boolean;
  comfyBaseUrl: string;
  comfyCheckpoint: string;
  comfySampler: string;
  comfyScheduler: string;
  comfySteps: number;
  comfyCfg: number;
  comfyWidth: number;
  comfyHeight: number;
  comfyTimeoutSec: number;
}

export const SETTINGS_PATH = path.resolve(process.cwd(), '../.local/ai-settings.json');

export const DEFAULT_AI_SETTINGS: AiSettings = {
  aiEnabled: false,
  provider: 'deepseek',
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  textModel: 'deepseek-chat',
  multimodalEnabled: false,
  visionModel: '',
  promptOptimization: true,
  // 默认贴近原有写死温度：拆分/画面偏精准、台词偏自然
  creativitySplit: 'precise',
  creativityImage: 'precise',
  creativityVoiceover: 'creative',
  imageWorkflow: 'upload_first',
  imageModel: '',
  notes: '',
  comfyEnabled: false,
  comfyBaseUrl: 'http://127.0.0.1:8188',
  comfyCheckpoint: '',
  comfySampler: 'euler',
  comfyScheduler: 'normal',
  comfySteps: 28,
  comfyCfg: 7,
  comfyWidth: 1280,
  comfyHeight: 720,
  comfyTimeoutSec: 300
};

// 创意档位 → 采样温度。精准=低温少发挥(抗幻觉)，创意=高温画面更丰富。
export const CREATIVITY_LEVELS = ['precise', 'balanced', 'creative'] as const;
export type CreativityLevel = typeof CREATIVITY_LEVELS[number];

export function creativityTemperature(level: unknown): number {
  switch (String(level)) {
    case 'creative': return 0.8;
    case 'balanced': return 0.45;
    case 'precise':
    default: return 0.2;
  }
}

function levelSetting(value: unknown, fallback: string): string {
  const v = String(value || '').trim();
  return (CREATIVITY_LEVELS as readonly string[]).includes(v) ? v : fallback;
}

function ensureSettingsDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function normalizeBaseUrl(value: unknown, fallback: string) {
  const raw = String(value || fallback).trim();
  return raw.replace(/\/+$/, '');
}

function stringSetting(value: unknown, fallback: string) {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function intSetting(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function numberSetting(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function readAiSettings(): AiSettings {
  if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULT_AI_SETTINGS };

  try {
    return {
      ...DEFAULT_AI_SETTINGS,
      ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function publicAiSettings(settings: AiSettings) {
  const apiKey = settings.apiKey || '';
  return {
    ...settings,
    apiKey: '',
    apiKeySet: apiKey.length > 0,
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : ''
  };
}

export function sanitizeAiSettings(body: any, current: AiSettings): AiSettings {
  const next: AiSettings = {
    ...current,
    aiEnabled: Boolean(body.aiEnabled),
    provider: stringSetting(body.provider, current.provider),
    apiBaseUrl: normalizeBaseUrl(body.apiBaseUrl, current.apiBaseUrl),
    textModel: stringSetting(body.textModel, current.textModel),
    multimodalEnabled: Boolean(body.multimodalEnabled),
    visionModel: stringSetting(body.visionModel, current.visionModel),
    promptOptimization: Boolean(body.promptOptimization),
    creativitySplit: levelSetting(body.creativitySplit, current.creativitySplit),
    creativityImage: levelSetting(body.creativityImage, current.creativityImage),
    creativityVoiceover: levelSetting(body.creativityVoiceover, current.creativityVoiceover),
    imageWorkflow: stringSetting(body.imageWorkflow, current.imageWorkflow),
    imageModel: stringSetting(body.imageModel, ''),
    notes: stringSetting(body.notes, ''),
    comfyEnabled: Boolean(body.comfyEnabled),
    comfyBaseUrl: normalizeBaseUrl(body.comfyBaseUrl, current.comfyBaseUrl),
    comfyCheckpoint: stringSetting(body.comfyCheckpoint, '').trim(),
    comfySampler: stringSetting(body.comfySampler, current.comfySampler).trim() || DEFAULT_AI_SETTINGS.comfySampler,
    comfyScheduler: stringSetting(body.comfyScheduler, current.comfyScheduler).trim() || DEFAULT_AI_SETTINGS.comfyScheduler,
    comfySteps: intSetting(body.comfySteps, current.comfySteps, 1, 150),
    comfyCfg: numberSetting(body.comfyCfg, current.comfyCfg, 0, 30),
    comfyWidth: intSetting(body.comfyWidth, current.comfyWidth, 64, 4096),
    comfyHeight: intSetting(body.comfyHeight, current.comfyHeight, 64, 4096),
    comfyTimeoutSec: intSetting(body.comfyTimeoutSec, current.comfyTimeoutSec, 30, 1800)
  };

  if (body.clearApiKey) {
    next.apiKey = '';
  } else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
    next.apiKey = body.apiKey.trim();
  }

  return next;
}

export function saveAiSettings(settings: AiSettings) {
  ensureSettingsDir();
  writeJsonAtomic(SETTINGS_PATH, settings);
}

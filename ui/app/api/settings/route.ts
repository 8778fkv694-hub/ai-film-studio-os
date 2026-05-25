import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const SETTINGS_PATH = path.resolve(process.cwd(), '../.local/ai-settings.json');

const DEFAULT_SETTINGS = {
  aiEnabled: false,
  provider: 'deepseek',
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  textModel: 'deepseek-chat',
  multimodalEnabled: false,
  visionModel: '',
  promptOptimization: true,
  imageWorkflow: 'upload_first',
  imageModel: '',
  notes: ''
};

function ensureDir() {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

function readSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULT_SETTINGS };

  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function publicSettings(settings: typeof DEFAULT_SETTINGS) {
  const apiKey = settings.apiKey || '';
  return {
    ...settings,
    apiKey: '',
    apiKeySet: apiKey.length > 0,
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : ''
  };
}

export async function GET() {
  return NextResponse.json(publicSettings(readSettings()));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = readSettings();

    const next = {
      ...current,
      aiEnabled: Boolean(body.aiEnabled),
      provider: String(body.provider || current.provider),
      apiBaseUrl: String(body.apiBaseUrl || current.apiBaseUrl).replace(/\/+$/, ''),
      textModel: String(body.textModel || current.textModel),
      multimodalEnabled: Boolean(body.multimodalEnabled),
      visionModel: String(body.visionModel || current.visionModel),
      promptOptimization: Boolean(body.promptOptimization),
      imageWorkflow: String(body.imageWorkflow || current.imageWorkflow),
      imageModel: String(body.imageModel || ''),
      notes: String(body.notes || '')
    };

    if (body.clearApiKey) {
      next.apiKey = '';
    } else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      next.apiKey = body.apiKey.trim();
    }

    ensureDir();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
    return NextResponse.json({ success: true, settings: publicSettings(next) });
  } catch {
    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}

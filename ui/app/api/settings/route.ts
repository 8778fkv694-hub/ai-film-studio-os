import { NextResponse } from 'next/server';
import {
  publicAiSettings,
  readAiSettings,
  sanitizeAiSettings,
  saveAiSettings
} from '@/lib/ai-settings';

export async function GET() {
  return NextResponse.json(publicAiSettings(readAiSettings()));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const next = sanitizeAiSettings(body, readAiSettings());
    saveAiSettings(next);
    return NextResponse.json({ success: true, settings: publicAiSettings(next) });
  } catch {
    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}

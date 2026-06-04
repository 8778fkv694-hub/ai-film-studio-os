import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { creativityTemperature } from '@/lib/ai-settings';

const SETTINGS_PATH = path.resolve(process.cwd(), '../.local/ai-settings.json');

function readSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const settings = readSettings();

  if (!settings?.aiEnabled || !settings?.apiKey) {
    return NextResponse.json(
      { error: 'AI 未启用或 API Key 未配置。当前推荐先使用网页工具和手动上传。' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const prompt = String(body.prompt || '').trim();
    const negativePrompt = String(body.negative_prompt || body.negativePrompt || '').trim();

    if (!prompt) {
      return NextResponse.json({ error: '缺少 prompt' }, { status: 400 });
    }

    const baseUrl = String(settings.apiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = String(settings.textModel || 'gpt-4o-mini');

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: creativityTemperature(settings.creativityImage),
        messages: [
          {
            role: 'system',
            content: [
              'You are a film storyboard prompt engineer.',
              'Rewrite prompts for static keyframe generation used in a voiced comic animatic.',
              'Preserve character identity, scene continuity, wardrobe, props, lighting, and camera intent EXACTLY as given.',
              'Hard constraints: do NOT invent characters, props, locations, wardrobe, or story facts that are not present in the input; do NOT change who/what/where; only rephrase and enrich visual/photographic wording.',
              'If a detail is unknown, omit it rather than guessing.',
              'Return compact JSON with positive_prompt, negative_prompt, continuity_notes, and checklist.'
            ].join(' ')
          },
          {
            role: 'user',
            content: JSON.stringify({
              positive_prompt: prompt,
              negative_prompt: negativePrompt
            })
          }
        ]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'AI 优化失败' },
        { status: res.status }
      );
    }

    return NextResponse.json({
      model,
      result: data?.choices?.[0]?.message?.content || ''
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'AI 优化失败' }, { status: 500 });
  }
}

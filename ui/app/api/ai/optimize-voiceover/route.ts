import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getResourcePath } from '@/lib/projects';
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

// 中文常态语速约 4.2 字/秒，用于把目标时长换算成大致字数
const CHARS_PER_SEC = 4.2;

export async function POST(request: Request) {
  const settings = readSettings();
  if (!settings?.aiEnabled || !settings?.apiKey) {
    return NextResponse.json(
      { error: 'AI 未启用或 API Key 未配置。请在「设置」里开启后再用台词润色。' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const shotId = String(body.shot_id || '').trim();
    if (!/^[A-Za-z0-9_-]+$/.test(shotId)) {
      return NextResponse.json({ error: '无效镜头 ID' }, { status: 400 });
    }
    const targetDuration = Number(body.target_duration);
    const hasTarget = Number.isFinite(targetDuration) && targetDuration > 0;

    const shotPath = path.join(getResourcePath('shots'), `${shotId}.json`);
    if (!fs.existsSync(shotPath)) {
      return NextResponse.json({ error: '镜头不存在' }, { status: 404 });
    }
    const shot = JSON.parse(fs.readFileSync(shotPath, 'utf-8'));
    const original = String(shot?.voiceover?.text || '').trim();
    if (!original) {
      return NextResponse.json({ error: '该镜头没有配音台词' }, { status: 400 });
    }

    const targetChars = hasTarget ? Math.round(targetDuration * CHARS_PER_SEC) : null;
    const lengthRule = targetChars
      ? `把台词控制在大约 ${targetChars} 个汉字（${Math.max(targetChars - 4, 4)}–${targetChars + 4} 字），以贴合 ${Math.round(targetDuration)} 秒画面。`
      : '保持简洁，不要明显加长。';

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
        temperature: creativityTemperature(settings.creativityVoiceover),
        messages: [
          {
            role: 'system',
            content: [
              '你是中文影片旁白润色师。把给定旁白改写得更自然、口语化、温暖、有人情味，避免生硬、说明书腔和机械感。',
              '保留原句的核心意思与信息点，不要新增事实。',
              lengthRule,
              '只返回改写后的台词纯文本，不要引号、不要解释、不要多行。'
            ].join(' ')
          },
          { role: 'user', content: original }
        ]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message || 'AI 调用失败' }, { status: 502 });
    }

    let text = String(data?.choices?.[0]?.message?.content || '').trim();
    text = text.replace(/^["「『]+|["」』]+$/g, '').replace(/\n+/g, '').trim();
    if (!text) {
      return NextResponse.json({ error: 'AI 未返回有效台词' }, { status: 502 });
    }

    // 写回镜头文件
    shot.voiceover.text = text;
    fs.writeFileSync(shotPath, JSON.stringify(shot, null, 2) + '\n', 'utf-8');

    return NextResponse.json({ success: true, text, original });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '台词润色失败' }, { status: 500 });
  }
}

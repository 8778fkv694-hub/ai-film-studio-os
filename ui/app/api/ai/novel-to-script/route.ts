import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

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
      { error: 'AI 未启用或 API Key 未配置。请先在系统设置中启用 AI。' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const novelText = String(body.novel || '').trim();
    const mode = String(body.mode || 'fiction').trim();

    if (!novelText) {
      return NextResponse.json({ error: '缺少小说文本内容' }, { status: 400 });
    }

    const baseUrl = String(settings.apiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = String(settings.textModel || 'gpt-4o-mini');

    let promptDetail = '';
    if (mode === 'explainer') {
      promptDetail = `你是一位专业的科普解说与科学原理演示片导演。请将用户输入的说明文本/原理小说/技术文档转化为标准的分镜头剧本格式。
格式规范如下：
1. 每一镜使用 "SXXX｜旁白：" 开头，其中 XXX 是三位数字序号（如 S001、S002 等），后接该镜头的【画面演示内容描述 + 专业科普解说词】（请注意：解说词应该用通俗生动的语言解释技术/科学原理，画面描述应具有高度可视化，比如展示剖面图、3D组装、流向图等）。
2. 如果镜头中需要虚拟讲解员、演示人出镜说话，在旁白下一行写 "台词：" 后接其说话内容（如果不需要出镜说话，则不要写台词行，只保留旁白）。
3. 语言使用中文，保持专业、严谨且通俗易懂的解说基调。`;
    } else if (mode === 'documentary') {
      promptDetail = `你是一位专业的自然地理/动物世界纪录片导演。请将用户输入的自然故事/动物世界散文/地理纪录文本转化为标准的分镜头剧本格式。
格式规范如下：
1. 每一镜使用 "SXXX｜旁白：" 开头，其中 XXX 是三位数字序号（如 S001、S002 等），后接该镜头的【写实环境/动物动作画面描述 + 磁性纪录片解说旁白】（解说旁白要深沉、大气、富有人文或科学关怀，画面描述需体现出写实照片级质感和壮丽的镜头感）。
2. 通常不需要角色对白。如果有出镜采访或出镜人物说话，可在下一行写 "台词：" 后接说话内容。
3. 语言使用中文，保持纪录片深邃、诗意、客观且大气的解说基调。`;
    } else {
      promptDetail = `你是一位电影/电视剧影视编剧。请将用户输入的原始小说文本转化为标准的分镜头剧本格式。
格式规范如下：
1. 每一镜使用 "SXXX｜旁白：" 开头，其中 XXX 是三位数字序号（如 S001、S002 等），后接该镜头的【画面动作描述 + 旁白】以交代场景、氛围和角色动作。
2. 旁白紧接着如果有角色说话，下一行写 "台词：" 后接其说话内容（不要写角色名字在台词两个字前面，说话习惯可以直接在旁白中指明）。
3. 语言使用中文，保持原著小说剧情、悬疑和故事张力。`;
    }

    const systemPrompt = `${promptDetail}

统一格式要求：
- 每一镜以 "SXXX｜旁白：" 开始。
- 如果有角色说话，紧随其后下一行写 "台词："。
- 镜头与镜头之间用空行隔开。
- 请直接输出转化后的剧本，不要包含任何 markdown 标记、\`\`\` 代码块、自我解释或额外问候语。直接从 S001 开始输出。`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: novelText
          }
        ]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'AI 转化失败' },
        { status: res.status }
      );
    }

    return NextResponse.json({
      model,
      script: data?.choices?.[0]?.message?.content || ''
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'AI 转化失败' }, { status: 500 });
  }
}

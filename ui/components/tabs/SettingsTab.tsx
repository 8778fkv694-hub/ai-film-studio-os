"use client";

import { useEffect, useState } from 'react';
import { CheckCircle, Eye, EyeOff, KeyRound, Save, Settings, Wand2 } from 'lucide-react';

interface AiSettings {
  aiEnabled: boolean;
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  apiKeySet?: boolean;
  apiKeyPreview?: string;
  textModel: string;
  multimodalEnabled: boolean;
  visionModel: string;
  promptOptimization: boolean;
  creativitySplit: string;
  creativityImage: string;
  creativityVoiceover: string;
  imageWorkflow: string;
  imageModel: string;
  notes: string;
}

const PROVIDER_PRESETS: Record<string, Partial<AiSettings>> = {
  deepseek: {
    provider: 'deepseek',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    textModel: 'deepseek-chat',
    multimodalEnabled: false,
    visionModel: ''
  },
  openai: {
    provider: 'openai',
    apiBaseUrl: 'https://api.openai.com/v1',
    textModel: 'gpt-4o-mini',
    multimodalEnabled: true,
    visionModel: 'gpt-4o'
  },
  compatible: {
    provider: 'compatible',
    apiBaseUrl: '',
    textModel: '',
    multimodalEnabled: false,
    visionModel: ''
  }
};

const EMPTY_SETTINGS: AiSettings = {
  aiEnabled: false,
  provider: 'deepseek',
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  textModel: 'deepseek-chat',
  multimodalEnabled: false,
  visionModel: '',
  promptOptimization: true,
  creativitySplit: 'precise',
  creativityImage: 'precise',
  creativityVoiceover: 'creative',
  imageWorkflow: 'upload_first',
  imageModel: '',
  notes: ''
};

export default function SettingsTab() {
  const [settings, setSettings] = useState<AiSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [clearApiKey, setClearApiKey] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        setSettings({ ...EMPTY_SETTINGS, ...(await res.json()), apiKey: '' });
      }
    } catch {
      setStatus({ type: 'error', message: '读取设置失败' });
    } finally {
      setLoading(false);
    }
  };

  const update = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const applyProvider = (provider: string) => {
    setSettings(prev => ({
      ...prev,
      ...PROVIDER_PRESETS[provider],
      provider
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, clearApiKey })
      });
      const data = await res.json();
      if (res.ok) {
        setSettings({ ...EMPTY_SETTINGS, ...data.settings, apiKey: '' });
        setClearApiKey(false);
        setStatus({ type: 'success', message: '系统设置已保存' });
      } else {
        setStatus({ type: 'error', message: data.error || '保存失败' });
      }
    } catch {
      setStatus({ type: 'error', message: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">加载设置中...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <Settings className="text-blue-400" />
          系统设置
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          配置在线大模型 API，用于提示词优化、镜头连贯性检查和后续可选的图片生成。
        </p>
      </div>

      {status && (
        <div className={`rounded-lg border p-4 text-sm ${
          status.type === 'success'
            ? 'border-emerald-800 bg-emerald-900/30 text-emerald-300'
            : 'border-red-800 bg-red-900/30 text-red-300'
        }`}>
          {status.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-300">
            <CheckCircle size={18} />
            推荐默认方式
          </div>
          <p className="text-sm leading-6 text-slate-300">
            先用本项目生成专业提示词，再去 ChatGPT 网页或其他网页工具生成图片，最后上传关键帧。
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-blue-300">
            <Wand2 size={18} />
            在线 API 增强
          </div>
          <p className="text-sm leading-6 text-slate-400">
            配置 DeepSeek / OpenAI-compatible API 后，可用于自动优化提示词和检查连续性。
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-yellow-300">
            <KeyRound size={18} />
            密钥存储
          </div>
          <p className="text-sm leading-6 text-slate-400">
            API Key 只保存在 <code className="text-blue-300">.local/ai-settings.json</code>，已加入 gitignore。
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">在线大模型</h3>
            <p className="text-sm text-slate-500">未启用时，项目仍可完整走手动上传和网页工具流程。</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.aiEnabled}
              onChange={e => update('aiEnabled', e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            启用在线 API
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-slate-400">服务商</span>
            <select
              value={settings.provider}
              onChange={e => applyProvider(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="compatible">OpenAI-compatible / 其他</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-400">Base URL</span>
            <input
              value={settings.apiBaseUrl}
              onChange={e => update('apiBaseUrl', e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-400">API Key</span>
            <div className="flex gap-2">
              <input
                value={settings.apiKey}
                onChange={e => update('apiKey', e.target.value)}
                type={showKey ? 'text' : 'password'}
                placeholder={settings.apiKeySet ? `已保存：${settings.apiKeyPreview}` : 'sk-...'}
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 text-slate-300 hover:bg-slate-700"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">留空不会覆盖旧 Key。</p>
              {settings.apiKeySet && (
                <label className="flex items-center gap-2 text-xs text-red-300">
                  <input
                    type="checkbox"
                    checked={clearApiKey}
                    onChange={e => setClearApiKey(e.target.checked)}
                    className="h-3 w-3 accent-red-500"
                  />
                  保存时清除 Key
                </label>
              )}
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-400">文本模型</span>
            <input
              value={settings.textModel}
              onChange={e => update('textModel', e.target.value)}
              placeholder="deepseek-chat"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-400">图片工作流</span>
            <select
              value={settings.imageWorkflow}
              onChange={e => update('imageWorkflow', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            >
              <option value="upload_first">上传图片优先</option>
              <option value="api_optional">API 生成可选</option>
              <option value="api_first">API 生成优先</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-400">图片模型（可选）</span>
            <input
              value={settings.imageModel}
              onChange={e => update('imageModel', e.target.value)}
              placeholder="仅当服务商支持图片生成时填写"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.promptOptimization}
              onChange={e => update('promptOptimization', e.target.checked)}
              className="h-4 w-4 accent-blue-500"
            />
            使用在线模型优化提示词
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.multimodalEnabled}
              onChange={e => update('multimodalEnabled', e.target.checked)}
              className="h-4 w-4 accent-blue-500"
            />
            当前 API 支持多模态/看图
          </label>
        </div>

        {/* 创意 / 精准：按任务分档，统一控制各 LLM 调用的发挥程度 */}
        <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
          <div className="mb-1 text-sm font-medium text-slate-200">创意 / 精准（按任务）</div>
          <p className="mb-3 text-xs text-slate-500">
            精准=低温、少发挥、抗幻觉漂移；平衡=适中；创意=高温、画面更丰富但更易偏离设定。
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {([
              { key: 'creativitySplit', label: '剧本拆分分镜', hint: '建议精准，保证引用准确' },
              { key: 'creativityImage', label: '画面 / 提示词优化', hint: '建议精准~平衡' },
              { key: 'creativityVoiceover', label: '台词润色', hint: '建议创意，语言更自然' },
            ] as const).map(item => (
              <label key={item.key} className="block space-y-1">
                <span className="text-sm text-slate-300">{item.label}</span>
                <select
                  value={settings[item.key] || 'precise'}
                  onChange={e => update(item.key, e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                >
                  <option value="precise">精准（低温·抗漂移）</option>
                  <option value="balanced">平衡</option>
                  <option value="creative">创意（高温·更丰富）</option>
                </select>
                <span className="block text-[11px] text-slate-500">{item.hint}</span>
              </label>
            ))}
          </div>
        </div>

        {settings.multimodalEnabled && (
          <label className="mt-4 block space-y-2">
            <span className="text-sm text-slate-400">多模态模型</span>
            <input
              value={settings.visionModel}
              onChange={e => update('visionModel', e.target.value)}
              placeholder="例如 gpt-4o；DeepSeek 文本模型可留空"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            />
          </label>
        )}

        <label className="mt-4 block space-y-2">
          <span className="text-sm text-slate-400">备注</span>
          <textarea
            value={settings.notes}
            onChange={e => update('notes', e.target.value)}
            rows={3}
            placeholder="例如：平时用 DeepSeek 优化文本提示词，图片仍走 ChatGPT 网页生成后上传。"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
          />
        </label>

        <div className="mt-6 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}

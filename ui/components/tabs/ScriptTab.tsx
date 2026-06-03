"use client";

import { useState, useEffect } from 'react';
import { FileText, Scissors, Upload, Download, AlertCircle, CheckCircle, Sparkles, Loader2 } from 'lucide-react';

export default function ScriptTab() {
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<'fiction' | 'explainer' | 'documentary'>('fiction');
  const [novel, setNovel] = useState('');
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadScript();
  }, []);

  const loadScript = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/script');
      if (res.ok) {
        const data = await res.json();
        setScript(data.content || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveScript = async () => {
    try {
      await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: script })
      });
      setResult({ success: true, message: '剧本已保存' });
    } catch (e) {
      setResult({ success: false, message: '保存失败' });
    }
    setTimeout(() => setResult(null), 3000);
  };

  const splitScript = async () => {
    if (!script.trim()) {
      setResult({ success: false, message: '剧本内容为空，请先填写或转换剧本再拆分。' });
      setTimeout(() => setResult(null), 3000);
      return;
    }
    setSplitting(true);
    setResult(null);
    try {
      // 带上当前编辑器内容，后端先落盘再拆分（无需先手动点保存）
      const res = await fetch('/api/script/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: script })
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `成功拆分为 ${data.count} 个镜头草稿` });
      } else {
        setResult({ success: false, message: data.error || '拆分失败' });
      }
    } catch (e) {
      setResult({ success: false, message: '拆分失败' });
    } finally {
      setSplitting(false);
    }
  };

  const handleNovelToScript = async () => {
    if (!novel.trim()) return;
    setConverting(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/novel-to-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novel, mode })
      });
      const data = await res.json();
      if (res.ok) {
        setScript(data.script || '');
        setResult({ success: true, message: 'AI 剧本转换完成！已自动载入到第二步编辑器中。' });
        setActiveStep(2); // Auto switch to step 2
      } else {
        setResult({ success: false, message: data.error || 'AI 转化失败' });
      }
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'AI 转化失败' });
    } finally {
      setConverting(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setScript(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleNovelFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setNovel(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 text-slate-400">加载剧本中...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-blue-400" />
            剧本工作台
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            第一步将小说转换为标准分镜剧本，第二步编辑并拆分为项目镜头草稿
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeStep === 1 ? (
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition cursor-pointer text-sm font-medium">
              <Upload size={16} />
              导入小说 .txt
              <input type="file" accept=".txt" onChange={handleNovelFileImport} className="hidden" />
            </label>
          ) : (
            <>
              <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition cursor-pointer text-sm font-medium">
                <Upload size={16} />
                导入剧本 .txt
                <input type="file" accept=".txt" onChange={handleFileImport} className="hidden" />
              </label>

              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm font-medium"
              >
                <Download size={16} />
                导出剧本
              </button>
            </>
          )}
        </div>
      </div>

      {/* Steps Navigation */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveStep(1)}
          className={`flex-1 pb-3 text-sm font-bold border-b-2 transition ${
            activeStep === 1
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          第一步：导入小说转剧本
        </button>
        <button
          onClick={() => setActiveStep(2)}
          className={`flex-1 pb-3 text-sm font-bold border-b-2 transition ${
            activeStep === 2
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          第二步：剧本编辑与分镜化
        </button>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          result.success
            ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800'
            : 'bg-red-900/30 text-red-300 border border-red-800'
        }`}>
          {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {result.message}
        </div>
      )}

      {/* Step 1 Content */}
      {activeStep === 1 && (
        <div className="space-y-6">
          {/* Mode Selector */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-200">选择短片模式 (Video Mode)</label>
              <p className="text-xs text-slate-400">选择您要制作的视频类型，AI 会自适应调整改写剧本的解说语气与画面节奏</p>
            </div>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-full sm:w-64 transition cursor-pointer"
            >
              <option value="fiction">🎬 剧情故事 / 悬疑短片</option>
              <option value="explainer">⚙️ 科普动画 / 原理展示</option>
              <option value="documentary">🌿 纪录片 / 自然地理</option>
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
              <span className="text-sm text-slate-300 font-medium font-mono">原始小说文本输入</span>
              <span className="text-xs text-slate-500 font-mono">{novel.length} 字符</span>
            </div>
            <textarea
              value={novel}
              onChange={(e) => setNovel(e.target.value)}
              placeholder="在此粘贴您的整段小说内容（无需任何剧本格式，AI 会自动识别并生成符合分镜的旁白和角色对白）..."
              className="w-full h-96 bg-transparent p-4 text-slate-200 text-sm resize-none outline-none leading-relaxed"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleNovelToScript}
              disabled={converting || !novel.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {converting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  AI 正在梳理转化中...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  一键转化为影视剧本
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
            <strong className="text-slate-300 font-medium">说明：</strong>
            系统将调用您的 DeepSeek AI 引擎解析小说逻辑，抽离出带 <code className="text-blue-300">SXXX｜旁白：</code> 与 <code className="text-blue-300">台词：</code> 标记的标准化脚本。
          </div>
        </div>
      )}

      {/* Step 2 Content */}
      {activeStep === 2 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
              <span className="text-sm text-slate-300 font-medium font-mono">docs/script.txt</span>
              <span className="text-xs text-slate-500 font-mono">{script.length} 字符</span>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="在此粘贴或编写标准剧本...

示例格式：
---
S001｜旁白：午夜的雨把旧公寓包成一只黑盒。林澈回家时，厨房灯自己亮着。
台词：我出门前，明明关了灯。

S002｜旁白：桌上有一只红杯，杯沿还冒着热气。那不是他的杯子。
台词：谁来过我家？
"
              className="w-full h-96 bg-transparent p-4 text-slate-200 font-mono text-sm resize-none outline-none leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={saveScript}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
            >
              保存剧本
            </button>

            <button
              onClick={splitScript}
              disabled={splitting || !script.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Scissors size={18} />
              {splitting ? '拆分中...' : '自动拆分为分镜'}
            </button>
          </div>

          {/* Help */}
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
            <strong className="text-slate-300 font-medium">提示：</strong>
            自动拆分会识别场景、角色、对白，生成草稿到 <code className="text-blue-300">shots_draft/</code> 目录。
            请人工确认后移动到 <code className="text-blue-300">shots/</code> 目录正式生效。
          </div>
        </div>
      )}
    </div>
  );
}

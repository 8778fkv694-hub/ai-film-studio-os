"use client";

import { useState, useEffect } from 'react';
import { FileText, Scissors, Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';

export default function ScriptTab() {
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(true);
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
    setSplitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/script/split', { method: 'POST' });
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

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setScript(event.target?.result as string || '');
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
            编辑剧本文本，使用自动拆分功能生成分镜草稿
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition cursor-pointer text-sm">
            <Upload size={16} />
            导入 .txt
            <input type="file" accept=".txt" onChange={handleFileImport} className="hidden" />
          </label>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm"
          >
            <Download size={16} />
            导出
          </button>
        </div>
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

      {/* Editor */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
          <span className="text-sm text-slate-400">docs/script.txt</span>
          <span className="text-xs text-slate-500">{script.length} 字符</span>
        </div>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="在此粘贴或编写剧本...

示例格式：
---
场景：厨房 - 夜间
角色：小明
---
小明坐在桌前，手里握着一个红色杯子。
小明：(自言自语) 今晚太安静了...
"
          className="w-full h-96 bg-transparent p-4 text-slate-200 font-mono text-sm resize-none outline-none"
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
        <strong className="text-slate-300">提示：</strong>
        自动拆分会识别场景、角色、对白，生成草稿到 <code className="text-blue-300">shots_draft/</code> 目录。
        请人工确认后移动到 <code className="text-blue-300">shots/</code> 目录正式生效。
      </div>
    </div>
  );
}

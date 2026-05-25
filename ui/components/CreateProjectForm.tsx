"use client";

import { useState } from 'react';
import { ArrowLeft, FolderPlus, CheckCircle, AlertTriangle } from 'lucide-react';

interface CreateProjectFormProps {
  onBack: () => void;
  onProjectCreated: (projectId: string) => void;
}

export default function CreateProjectForm({ onBack, onProjectCreated }: CreateProjectFormProps) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: ''
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 验证表单
    if (!formData.id.trim()) {
      setError('项目ID不能为空');
      return;
    }
    if (!formData.name.trim()) {
      setError('项目名称不能为空');
      return;
    }

    // 验证ID格式
    if (!/^[a-zA-Z0-9_-]+$/.test(formData.id)) {
      setError('项目ID只能包含字母、数字、下划线和连字符');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const data = await res.json();
        onProjectCreated(data.project.id);
      } else {
        const data = await res.text();
        setError(data || '创建失败');
      }
    } catch (e) {
      setError('网络错误');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
          <FolderPlus className="text-emerald-400" />
          新建项目
        </h2>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/30 text-red-300 border border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              项目ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="my_project"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              只能包含字母、数字、下划线和连字符，创建后不可修改
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              项目名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="我的新项目"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              项目描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="描述一下这个项目..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none h-24"
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">项目将自动创建以下目录结构</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> docs/ - 剧本文档
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> shots/ - 正式镜头
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> shots_draft/ - 草稿镜头
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> scenes/ - 场景定义
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> characters/ - 角色定义
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> props/ - 道具定义
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> assets/audio/ - 音频文件
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> prompts/ - 提示词
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> renders/ - 渲染结果
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">📁</span> reports/ - 检查报告
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <FolderPlus size={18} />
                创建项目
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
"use client";

import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Trash2, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';

interface ProjectInfo {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface DeleteTarget {
  id: string;
  name: string;
}

interface ProjectListProps {
  onProjectSelect: (projectId: string) => void;
  onProjectCreate: () => void;
  onProjectDeleted?: () => void;
  activeProjectId: string | null;
}

export default function ProjectList({ onProjectSelect, onProjectCreate, onProjectDeleted, activeProjectId }: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      } else {
        setError('加载项目列表失败');
      }
    } catch (e) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || confirmText !== deleteTarget.name) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/projects/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: deleteTarget.id })
      });
      if (res.ok) {
        setDeleteTarget(null);
        setConfirmText('');
        loadProjects();
        if (onProjectDeleted) onProjectDeleted();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (e) {
      alert('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/30 text-red-300 border border-red-800 rounded-lg p-4 flex items-center gap-2">
          <AlertTriangle size={20} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
          <FolderOpen className="text-blue-400" />
          项目列表
        </h2>
        <button
          onClick={onProjectCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
        >
          <Plus size={18} />
          新建项目
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">暂无项目</h3>
          <p className="text-slate-500 mb-4">点击上方按钮创建您的第一个项目</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`bg-slate-900 border rounded-xl p-4 transition-all cursor-pointer hover:border-blue-500/50 ${
                activeProjectId === project.id
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-slate-800'
              }`}
              onClick={() => onProjectSelect(project.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activeProjectId === project.id
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    <FolderOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">{project.name}</h3>
                    <p className="text-sm text-slate-500">{project.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeProjectId === project.id && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded">
                      <CheckCircle size={14} />
                      当前项目
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: project.id, name: project.name });
                      setConfirmText('');
                    }}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition"
                    title="删除项目"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {project.description && (
                <p className="mt-2 text-sm text-slate-400">{project.description}</p>
              )}
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  创建于 {new Date(project.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  更新于 {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle size={20} />
                删除项目
              </h3>
              <button
                onClick={() => { setDeleteTarget(null); setConfirmText(''); }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300">
                即将删除项目 <span className="font-bold text-white">「{deleteTarget.name}」</span>，包含所有镜头、场景、音频等资源，此操作不可撤销。
              </p>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  请输入项目名称 <span className="font-mono text-slate-200">{deleteTarget.name}</span> 以确认：
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={deleteTarget.name}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:border-red-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setConfirmText(''); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={confirmText !== deleteTarget.name || deleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Trash2 size={16} />
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
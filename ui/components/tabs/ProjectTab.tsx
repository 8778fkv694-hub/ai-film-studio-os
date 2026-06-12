"use client";

import { useState, useEffect } from 'react';
import {
  FolderOpen, Download, Upload, Save, RefreshCw, Trash2,
  CheckCircle, Clock, AlertTriangle, BarChart3, Settings,
  FileJson, FolderArchive, History
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  default_style_ref?: string;
  defaults?: {
    language?: string;
    fps?: number;
  };
  inventory?: {
    scenes: string[];
    characters: string[];
    props: string[];
  };
  timeline?: { shot_id: string; shot_file: string }[];
}

interface ProjectStats {
  shots: number;
  drafts: number;
  scenes: number;
  characters: number;
  props: number;
  audioFiles: number;
  totalDuration: number;
}

interface TaskItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  type: 'shot' | 'scene' | 'character' | 'tts' | 'check';
  description?: string;
}

export default function ProjectTab() {
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'progress' | 'export'>('info');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectRes, statsRes] = await Promise.all([
        fetch('/api/project'),
        fetch('/api/dashboard/stats')
      ]);

      if (projectRes.ok) {
        setProject(await projectRes.json());
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.counts);
        // 生成任务列表
        generateTasks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateTasks = (data: any) => {
    const tasks: TaskItem[] = [];

    // 检查各项完成状态
    if (data.counts.shots === 0 && data.counts.drafts > 0) {
      tasks.push({
        id: 'review-drafts',
        title: '审核分镜草稿',
        status: 'pending',
        type: 'shot',
        description: `${data.counts.drafts} 个草稿待审核并移至正式目录`
      });
    }

    if (data.counts.scenes === 0) {
      tasks.push({
        id: 'create-scenes',
        title: '创建场景',
        status: 'pending',
        type: 'scene',
        description: '至少需要一个场景定义'
      });
    }

    if (data.counts.characters === 0) {
      tasks.push({
        id: 'create-characters',
        title: '创建角色',
        status: 'pending',
        type: 'character',
        description: '定义角色外貌和服装'
      });
    }

    if (data.checks?.validate !== 'passed') {
      tasks.push({
        id: 'run-validate',
        title: '运行结构校验',
        status: 'pending',
        type: 'check',
        description: '确保所有 JSON 格式正确'
      });
    }

    if (data.checks?.lint !== 'passed') {
      tasks.push({
        id: 'run-lint',
        title: '运行逻辑检查',
        status: data.checks?.lint === 'failed' ? 'in_progress' : 'pending',
        type: 'check',
        description: '检查引用完整性和禁忌词'
      });
    }

    if (data.counts.shots > 0 && data.counts.audioFiles < data.counts.shots) {
      tasks.push({
        id: 'generate-tts',
        title: '生成 TTS 语音',
        status: 'pending',
        type: 'tts',
        description: `${data.counts.audioFiles}/${data.counts.shots} 已生成`
      });
    }

    // 已完成的任务
    if (data.counts.shots > 0) {
      tasks.push({
        id: 'shots-ready',
        title: '正式镜头就绪',
        status: 'completed',
        type: 'shot',
        description: `${data.counts.shots} 个镜头`
      });
    }

    if (data.checks?.validate === 'passed') {
      tasks.push({
        id: 'validate-passed',
        title: '结构校验通过',
        status: 'completed',
        type: 'check'
      });
    }

    setTasks(tasks);
  };

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
      if (res.ok) {
        setStatus({ type: 'success', message: '项目已保存' });
      } else {
        setStatus({ type: 'error', message: '保存失败' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: '保存失败' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/project/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project?.id || 'project'}_export.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus({ type: 'success', message: '导出成功' });
      } else {
        // 降级为 JSON 导出
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `${project?.id || 'project'}.json`;
        a.click();
        setStatus({ type: 'success', message: '已导出 project.json' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: '导出失败' });
    }
    setTimeout(() => setStatus(null), 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          setProject(json);
          setStatus({ type: 'success', message: '已导入，请保存生效' });
        } catch (e) {
          setStatus({ type: 'error', message: '无效的 JSON 文件' });
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.zip')) {
      setStatus({ type: 'success', message: '正在上传并导入项目 ZIP...' });
      const formData = new FormData();
      formData.append('file', file);
      fetch('/api/project/import', {
        method: 'POST',
        body: formData
      })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus({ type: 'success', message: 'ZIP 项目导入成功！' });
          loadData();
        } else {
          setStatus({ type: 'error', message: data.error || 'ZIP 导入失败' });
        }
      })
      .catch(() => {
        setStatus({ type: 'error', message: 'ZIP 导入请求失败' });
      });
    }
    setTimeout(() => setStatus(null), 3000);
  };

  if (loading) return <div className="p-8 text-slate-400">加载中...</div>;

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Sidebar */}
      <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <FolderOpen size={18} className="text-blue-400" />
            项目管理
          </h3>
        </div>

        <div className="flex-1 p-2">
          {([
            { id: 'info' as const, label: '项目信息', icon: <Settings size={18} /> },
            { id: 'progress' as const, label: '进度看板', icon: <BarChart3 size={18} /> },
            { id: 'export' as const, label: '导入导出', icon: <FolderArchive size={18} /> },
          ]).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-2 p-3 rounded-lg mb-1 text-sm transition ${
                activeSection === item.id
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Status Message */}
        {status && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            status.type === 'success'
              ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800'
              : 'bg-red-900/30 text-red-300 border border-red-800'
          }`}>
            {status.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            {status.message}
          </div>
        )}

        {/* Project Info Section */}
        {activeSection === 'info' && project && (
          <div className="space-y-6 max-w-3xl">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
                <FileJson className="text-blue-400" />
                项目信息
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={loadData}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                >
                  <RefreshCw size={16} />
                  刷新
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">项目 ID</label>
                  <input
                    type="text"
                    value={project.id || ''}
                    onChange={(e) => setProject({ ...project, id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">项目名称</label>
                  <input
                    type="text"
                    value={project.name || ''}
                    onChange={(e) => setProject({ ...project, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">项目描述</label>
                <textarea
                  value={project.description || ''}
                  onChange={(e) => setProject({ ...project, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white h-24"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">默认语言</label>
                  <select
                    value={project.defaults?.language || 'zh'}
                    onChange={(e) => setProject({
                      ...project,
                      defaults: { ...project.defaults, language: e.target.value }
                    })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">帧率 (FPS)</label>
                  <input
                    type="number"
                    value={project.defaults?.fps || 24}
                    onChange={(e) => setProject({
                      ...project,
                      defaults: { ...project.defaults, fps: parseInt(e.target.value) }
                    })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Resource Summary */}
            {stats && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">资源统计</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: '正式镜头', value: stats.shots, color: 'blue' },
                    { label: '草稿镜头', value: stats.drafts, color: 'yellow' },
                    { label: '场景', value: stats.scenes, color: 'green' },
                    { label: '角色', value: stats.characters, color: 'purple' },
                    { label: '道具', value: stats.props, color: 'cyan' },
                    { label: '音频文件', value: stats.audioFiles, color: 'emerald' },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                      <div className={`text-2xl font-bold text-${item.color}-400`}>{item.value}</div>
                      <div className="text-xs text-slate-500">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Section */}
        {activeSection === 'progress' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
              <BarChart3 className="text-emerald-400" />
              进度看板
            </h2>

            {/* Progress Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400">整体进度</span>
                <span className="text-2xl font-bold text-emerald-400">{progressPercent}%</span>
              </div>
              <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {completedTasks} / {tasks.length} 项任务已完成
              </div>
            </div>

            {/* Task List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">任务清单</h3>
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">
                    暂无任务，项目已完成所有配置
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border ${
                        task.status === 'completed'
                          ? 'bg-emerald-900/10 border-emerald-800/50'
                          : task.status === 'in_progress'
                          ? 'bg-yellow-900/10 border-yellow-800/50'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        task.status === 'completed'
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : task.status === 'in_progress'
                          ? 'bg-yellow-600/20 text-yellow-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {task.status === 'completed' ? (
                          <CheckCircle size={18} />
                        ) : task.status === 'in_progress' ? (
                          <Clock size={18} />
                        ) : (
                          <Clock size={18} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium ${
                          task.status === 'completed' ? 'text-emerald-300' : 'text-slate-200'
                        }`}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-sm text-slate-500">{task.description}</div>
                        )}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        task.status === 'completed'
                          ? 'bg-emerald-900/30 text-emerald-400'
                          : task.status === 'in_progress'
                          ? 'bg-yellow-900/30 text-yellow-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {task.status === 'completed' ? '已完成' : task.status === 'in_progress' ? '进行中' : '待处理'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Export Section */}
        {activeSection === 'export' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
              <FolderArchive className="text-purple-400" />
              导入导出
            </h2>

            <div className="grid grid-cols-2 gap-6">
              {/* Export */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Download size={24} className="text-blue-400" />
                  <h3 className="text-lg font-semibold text-slate-200">导出项目</h3>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  导出当前项目配置，可用于备份或分享给其他人。
                </p>
                <div className="space-y-2">
                  <button
                    onClick={handleExport}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                  >
                    <Download size={18} />
                    导出 project.json
                  </button>
                  <button
                    onClick={handleExport}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                  >
                    <FolderArchive size={18} />
                    导出完整项目 (ZIP)
                  </button>
                </div>
              </div>

              {/* Import */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Upload size={24} className="text-emerald-400" />
                  <h3 className="text-lg font-semibold text-slate-200">导入项目</h3>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  从 JSON 或 ZIP 文件导入项目配置。
                </p>
                <div className="space-y-2">
                  <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition cursor-pointer">
                    <Upload size={18} />
                    导入 project.json
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                  <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition cursor-pointer">
                    <FolderArchive size={18} />
                    导入完整项目 (ZIP)
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* History (placeholder) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <History size={24} className="text-yellow-400" />
                <h3 className="text-lg font-semibold text-slate-200">操作历史</h3>
              </div>
              <div className="text-sm text-slate-500 text-center py-8">
                暂无操作历史记录
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

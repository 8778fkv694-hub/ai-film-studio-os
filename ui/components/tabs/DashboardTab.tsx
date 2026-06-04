"use client";

import { useState, useEffect } from 'react';
import {
  LayoutDashboard, CheckCircle, AlertTriangle, XCircle,
  FileText, MapPin, Users, Clapperboard, Volume2,
  ArrowRight, Play, RefreshCw, Sparkles, Image as ImageIcon, Hammer
} from 'lucide-react';

interface ProjectStats {
  project: {
    id: string;
    name: string;
    description: string;
  } | null;
  counts: {
    shots: number;
    drafts: number;
    scenes: number;
    characters: number;
    props: number;
    audioFiles: number;
    keyframes: number;
    imagePromptPackages: number;
    videoPromptPackages: number;
  };
  checks: {
    validate: 'pending' | 'running' | 'passed' | 'failed';
    lint: 'pending' | 'running' | 'passed' | 'failed';
    lastRun: string | null;
  };
  issues: {
    level: string;
    where: string;
    msg: string;
  }[];
  totalDuration: number;
}

interface DashboardTabProps {
  onNavigate: (tab: string) => void;
}

export default function DashboardTab({ onNavigate }: DashboardTabProps) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningChecks, setRunningChecks] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fixingPath, setFixingPath] = useState<string | null>(null);
  const [ignoredKeys, setIgnoredKeys] = useState<string[]>([]);

  useEffect(() => {
    loadStats();
    const saved = localStorage.getItem('afsos_ignored_issues');
    if (saved) {
      try {
        setIgnoredKeys(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleIgnoreIssue = (e: React.MouseEvent, issue: any) => {
    e.stopPropagation();
    const issueKey = `${issue.where}:${issue.msg}`;
    const newKeys = [...ignoredKeys, issueKey];
    setIgnoredKeys(newKeys);
    localStorage.setItem('afsos_ignored_issues', JSON.stringify(newKeys));
  };

  const handleResetIgnored = () => {
    setIgnoredKeys([]);
    localStorage.removeItem('afsos_ignored_issues');
  };

  // 一键忽略当前所有可见问题
  const handleIgnoreAll = (visible: any[]) => {
    const merged = Array.from(new Set([
      ...ignoredKeys,
      ...visible.map((issue: any) => `${issue.where}:${issue.msg}`)
    ]));
    setIgnoredKeys(merged);
    localStorage.setItem('afsos_ignored_issues', JSON.stringify(merged));
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runChecks = async () => {
    setRunningChecks(true);
    try {
      // Run validate
      setStats(prev => prev ? { ...prev, checks: { ...prev.checks, validate: 'running' } } : prev);
      const vRes = await fetch('/api/tools/validate', { method: 'POST' });
      await vRes.json();

      // Run lint
      setStats(prev => prev ? { ...prev, checks: { ...prev.checks, lint: 'running' } } : prev);
      const lRes = await fetch('/api/tools/lint', { method: 'POST' });
      await lRes.json();

      // Update stats
      await loadStats();
    } catch (e) {
      console.error(e);
    } finally {
      setRunningChecks(false);
    }
  };

  const handleQuickFix = async (e: React.MouseEvent, fixPath: string, fixType: string) => {
    e.stopPropagation();
    setFixingPath(fixPath);
    try {
      const res = await fetch('/api/tools/quick-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixPath, fixType })
      });
      if (res.ok) {
        await loadStats();
      } else {
        const err = await res.json();
        alert(err.error || '修复失败');
      }
    } catch (err: any) {
      console.error(err);
      alert('修复出错: ' + err.message);
    } finally {
      setFixingPath(null);
    }
  };

  const handleIssueClick = (issue: any) => {
    const msg = issue.msg || '';
    const where = issue.where || '';

    if (where === 'validate') {
      if (msg.includes('scene_ref') || msg.includes('scenes/')) {
        onNavigate('scenes');
      } else if (msg.includes('角色') || msg.includes('characters/')) {
        onNavigate('assets');
      } else if (msg.includes('道具') || msg.includes('props/')) {
        onNavigate('assets');
      } else if (msg.includes('shots/') || msg.includes('镜头')) {
        onNavigate('shots');
      } else {
        onNavigate('shots');
      }
    } else if (where.endsWith('.json')) {
      onNavigate('shots');
    } else {
      onNavigate('tools');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-red-400">加载失败</div>
    );
  }

  const { project, counts, checks, issues } = stats;
  const visibleIssues = issues.filter((issue: any) => !ignoredKeys.includes(`${issue.where}:${issue.msg}`));
  const hasProject = !!project;
  const totalShots = counts.shots + counts.drafts;

  // 计算完成度
  const completionItems = [
    { done: hasProject, label: '项目配置' },
    { done: counts.scenes > 0, label: '场景定义' },
    { done: counts.characters > 0, label: '角色定义' },
    { done: counts.shots > 0, label: '正式镜头' },
    { done: checks.validate === 'passed', label: '结构校验' },
    { done: checks.lint === 'passed', label: '逻辑检查' },
  ];
  const completionPercent = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-200">
            <LayoutDashboard className="text-blue-400" />
            项目概览
          </h2>
          {project ? (
            <p className="text-slate-400 mt-1">
              {project.name} <span className="text-slate-500">({project.id})</span>
            </p>
          ) : (
            <p className="text-yellow-400 mt-1">未找到 project.json</p>
          )}
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm"
        >
          <RefreshCw size={16} />
          刷新
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Validate Status */}
        <StatusCard
          title="结构校验"
          status={checks.validate}
          icon={<CheckCircle size={24} />}
        />
        {/* Lint Status */}
        <StatusCard
          title="逻辑检查"
          status={checks.lint}
          icon={<AlertTriangle size={24} />}
        />
        {/* Completion */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">完成度</span>
            <Sparkles size={20} className="text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-purple-400">{completionPercent}%</div>
          <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
        {/* Duration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">总时长</span>
            <Play size={20} className="text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">
            {Math.floor(stats.totalDuration / 60)}:{String(stats.totalDuration % 60).padStart(2, '0')}
          </div>
          <div className="text-xs text-slate-500 mt-1">{stats.totalDuration} 秒</div>
        </div>
      </div>

      {/* Run Checks Button */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={runChecks}
          disabled={runningChecks}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-medium disabled:opacity-50"
        >
          {runningChecks ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              检查中...
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              运行全部检查
            </>
          )}
        </button>
        <button
          onClick={() => onNavigate('tools')}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
        >
          查看详细工具
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-red-300 flex items-center gap-2">
              <XCircle size={20} />
              待处理问题 ({visibleIssues.length} / {issues.length})
            </h3>
            <div className="flex items-center gap-2">
              {visibleIssues.length > 0 && (
                <button
                  onClick={() => handleIgnoreAll(visibleIssues)}
                  className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                >
                  🔕 一键忽略全部 ({visibleIssues.length})
                </button>
              )}
              {ignoredKeys.length > 0 && (
                <button
                  onClick={handleResetIgnored}
                  className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                >
                  🔄 恢复已忽略 ({ignoredKeys.length})
                </button>
              )}
            </div>
          </div>
          {visibleIssues.length === 0 ? (
            <div className="text-slate-400 text-sm py-2">所有问题已忽略或已解决。</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(isExpanded ? visibleIssues : visibleIssues.slice(0, 5)).map((issue: any, idx) => {
                const displayWhere = issue.where === 'validate' ? '结构校验' : issue.where;
                return (
                  <div
                    key={idx}
                    onClick={() => handleIssueClick(issue)}
                    className="flex items-center justify-between gap-4 text-sm p-1.5 rounded hover:bg-red-900/40 cursor-pointer transition"
                  >
                    <div className="flex items-start gap-2 flex-1">
                      <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 mt-0.5 ${
                        issue.level === 'ERROR' ? 'bg-red-800 text-red-200' : 'bg-yellow-800 text-yellow-200'
                      }`}>
                        {issue.level === 'ERROR' ? '错误' : '警告'}
                      </span>
                      <span className="text-slate-400 flex-shrink-0">{displayWhere}:</span>
                      <span className="text-slate-300 break-all">{issue.msg}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {issue.fixPath && (
                        <button
                          disabled={fixingPath === issue.fixPath}
                          onClick={(e) => handleQuickFix(e, issue.fixPath, issue.fixType)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                        >
                          {fixingPath === issue.fixPath ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            '🔧 一键修复'
                          )}
                        </button>
                      )}
                      <button
                        onClick={(e) => handleIgnoreIssue(e, issue)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                        title="忽略此问题"
                      >
                        🔕 忽略
                      </button>
                    </div>
                  </div>
                );
              })}
              {visibleIssues.length > 5 && (
                <div className="pt-2 flex justify-start">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs font-medium text-red-400 hover:text-red-300 hover:underline"
                  >
                    {isExpanded ? '收起全部 ▴' : `展开全部 (还有 ${visibleIssues.length - 5} 个问题) ▾`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resource Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <ResourceCard
          icon={<Clapperboard size={24} />}
          label="正式镜头"
          count={counts.shots}
          color="blue"
          onClick={() => onNavigate('shots')}
        />
        <ResourceCard
          icon={<FileText size={24} />}
          label="草稿镜头"
          count={counts.drafts}
          color="yellow"
          onClick={() => onNavigate('shots')}
        />
        <ResourceCard
          icon={<MapPin size={24} />}
          label="场景"
          count={counts.scenes}
          color="green"
          onClick={() => onNavigate('scenes')}
        />
        <ResourceCard
          icon={<Users size={24} />}
          label="角色"
          count={counts.characters}
          color="purple"
          onClick={() => onNavigate('assets')}
        />
        <ResourceCard
          icon={<Hammer size={24} />}
          label="视频提示词"
          count={counts.videoPromptPackages}
          color="purple"
          onClick={() => onNavigate('tools')}
        />
        <ResourceCard
          icon={<Volume2 size={24} />}
          label="音频"
          count={counts.audioFiles}
          color="emerald"
          onClick={() => onNavigate('preview')}
        />
        <ResourceCard
          icon={<ImageIcon size={24} />}
          label="关键帧"
          count={counts.keyframes}
          color="blue"
          onClick={() => onNavigate('preview')}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">快速操作</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            title="导入剧本"
            description="从文本文件导入剧本"
            onClick={() => onNavigate('script')}
          />
          <QuickAction
            title="编译视频提示词"
            description="生成每个镜头的视频生成 Prompt"
            onClick={() => onNavigate('tools')}
          />
          <QuickAction
            title="生成 TTS"
            description="为所有对白生成语音"
            onClick={() => onNavigate('preview')}
          />
          <QuickAction
            title="配音分镜漫画"
            description="播放图片和对白"
            onClick={() => onNavigate('preview')}
          />
        </div>
      </div>

      {/* Workflow Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">推荐工作流程</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { step: 1, label: '剧本拆分', done: counts.drafts > 0 || counts.shots > 0 },
            { step: 2, label: '完善分镜', done: counts.shots > 0 },
            { step: 3, label: '运行检查', done: checks.validate === 'passed' && checks.lint === 'passed' },
            { step: 4, label: '视频提示词', done: counts.videoPromptPackages > 0 },
            { step: 5, label: '回填关键帧', done: counts.keyframes > 0 },
            { step: 6, label: '配音预演', done: counts.audioFiles > 0 },
          ].map((item) => (
            <div key={item.step} className="flex items-center justify-center">
              <div className={`flex flex-col items-center ${item.done ? 'text-emerald-400' : 'text-slate-500'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 ${
                  item.done ? 'border-emerald-400 bg-emerald-400/20' : 'border-slate-600 bg-slate-800'
                }`}>
                  {item.done ? '✓' : item.step}
                </div>
                <span className="text-xs mt-2">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, status, icon }: { title: string; status: string; icon: React.ReactNode }) {
  const config = {
    pending: { color: 'slate', text: '待检查', bg: 'bg-slate-800' },
    running: { color: 'blue', text: '检查中...', bg: 'bg-blue-900/30' },
    passed: { color: 'emerald', text: '通过', bg: 'bg-emerald-900/30' },
    failed: { color: 'red', text: '失败', bg: 'bg-red-900/30' },
  }[status] || { color: 'slate', text: '未知', bg: 'bg-slate-800' };

  return (
    <div className={`${config.bg} border border-slate-800 rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{title}</span>
        <div className={`text-${config.color}-400`}>{icon}</div>
      </div>
      <div className={`text-xl font-bold text-${config.color}-400`}>{config.text}</div>
    </div>
  );
}

function ResourceCard({
  icon, label, count, color, onClick
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition text-left"
    >
      <div className={`text-${color}-400 mb-2`}>{icon}</div>
      <div className="text-2xl font-bold text-slate-200">{count}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </button>
  );
}

function QuickAction({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition text-left"
    >
      <div className="font-medium text-slate-200">{title}</div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </button>
  );
}

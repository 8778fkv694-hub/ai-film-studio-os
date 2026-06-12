"use client";

import type { Shot, LintIssue } from './shot-types';

interface ShotLintPanelProps {
  shot: Shot;
  isLintOpen: boolean;
  lintIssues: LintIssue[];
}

export default function ShotLintPanel({
  shot,
  isLintOpen,
  lintIssues,
}: ShotLintPanelProps) {
  if (!isLintOpen || !lintIssues || lintIssues.length === 0) return null;

  return (
    <div className="w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs my-2 text-left space-y-1">
      <div className="font-semibold text-slate-300 mb-1">Lint 检查结果（{shot.shot_id}）</div>
      {lintIssues.map((issue, i) => (
        <div key={i} className="flex items-start gap-2 font-mono">
          <span className={`shrink-0 font-bold ${
            issue.level === 'ERROR' ? 'text-red-400' : issue.level === 'WARN' ? 'text-amber-400' : 'text-slate-500'
          }`}>{issue.level}</span>
          <span className="text-slate-300 break-all">{issue.msg}</span>
        </div>
      ))}
    </div>
  );
}

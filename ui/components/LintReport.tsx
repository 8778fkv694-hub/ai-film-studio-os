"use client";

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface LintIssue {
  severity: string;
  rule: string;
  shot_id?: string;
  message: string;
  file?: string;
}

interface LintReportData {
  exists: boolean;
  status?: string;
  issues?: LintIssue[];
  summary?: string;
  checked_at?: string;
}

const SEVERITY_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  ERROR: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-900/50' },
  WARN: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-900/50' },
  INFO: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-900/50' },
};

export default function LintReport() {
  const [report, setReport] = useState<LintReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/lint-report');
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-slate-500 text-sm">
        Loading lint report...
      </div>
    );
  }

  if (!report || !report.exists) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <AlertTriangle size={16} />
            No lint report found. Run <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">node tools/scripts/lint.js</code> to generate.
          </div>
          <button onClick={fetchReport} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    );
  }

  const issues = report.issues || [];
  const errorCount = issues.filter(i => i.severity === 'ERROR').length;
  const warnCount = issues.filter(i => i.severity === 'WARN').length;
  const infoCount = issues.filter(i => i.severity === 'INFO').length;

  const overallStatus = errorCount > 0 ? 'ERROR' : warnCount > 0 ? 'WARN' : 'OK';
  const statusConfig = overallStatus === 'OK'
    ? { color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-900/50' }
    : overallStatus === 'ERROR'
    ? { color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-900/50' }
    : { color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-900/50' };

  return (
    <div className={`${statusConfig.bg} border ${statusConfig.border} rounded-lg overflow-hidden`}>
      {/* Header (always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition"
      >
        <div className="flex items-center gap-3">
          {overallStatus === 'OK' ? (
            <CheckCircle size={20} className="text-emerald-400" />
          ) : overallStatus === 'ERROR' ? (
            <XCircle size={20} className="text-red-400" />
          ) : (
            <AlertTriangle size={20} className="text-yellow-400" />
          )}
          <span className={`font-semibold ${statusConfig.color}`}>
            Lint: {overallStatus === 'OK' ? 'All Clear' : `${issues.length} issue${issues.length !== 1 ? 's' : ''}`}
          </span>
          <div className="flex gap-2 text-xs">
            {errorCount > 0 && <span className="px-2 py-0.5 rounded bg-red-900/40 text-red-300">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>}
            {warnCount > 0 && <span className="px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-300">{warnCount} warn{warnCount !== 1 ? 's' : ''}</span>}
            {infoCount > 0 && <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300">{infoCount} info</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetchReport(); }}
            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition"
          >
            <RefreshCw size={14} />
          </button>
          <span className="text-slate-500 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Issue List (expandable) */}
      {expanded && issues.length > 0 && (
        <div className="border-t border-slate-800 divide-y divide-slate-800/50">
          {issues.map((issue, i) => {
            const cfg = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.INFO;
            const Icon = cfg.icon;
            return (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <Icon size={16} className={`${cfg.color} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold uppercase ${cfg.color}`}>{issue.severity}</span>
                    <span className="text-xs font-mono text-slate-500">{issue.rule}</span>
                    {issue.shot_id && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono border border-slate-700">
                        {issue.shot_id}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 mt-0.5">{issue.message}</p>
                  {issue.file && <p className="text-xs text-slate-500 mt-0.5 font-mono">{issue.file}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

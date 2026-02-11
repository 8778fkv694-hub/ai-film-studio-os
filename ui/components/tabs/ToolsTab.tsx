"use client";

import { useState } from 'react';
import { Wrench, CheckCircle, AlertTriangle, FileCheck, Hammer, Play, Terminal, X } from 'lucide-react';

interface ToolResult {
  success: boolean;
  output: string;
  errors?: string[];
}

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  command: string;
}

const tools: Tool[] = [
  {
    id: 'validate',
    name: '结构校验',
    description: '检查所有 JSON 文件是否符合 Schema 规范',
    icon: <FileCheck size={24} />,
    color: 'blue',
    command: 'validate'
  },
  {
    id: 'lint',
    name: '逻辑检查',
    description: '检查连续性、禁忌词、资源缺失、预算越界',
    icon: <AlertTriangle size={24} />,
    color: 'yellow',
    command: 'lint'
  },
  {
    id: 'build-prompts',
    name: '编译提示词',
    description: '将 Specs 编译成模型可读的 Final Prompts',
    icon: <Hammer size={24} />,
    color: 'purple',
    command: 'build-prompts'
  },
  {
    id: 'gen-tts',
    name: '生成 TTS',
    description: '根据对白生成语音文件 (Edge TTS)',
    icon: <Play size={24} />,
    color: 'emerald',
    command: 'gen-tts'
  }
];

export default function ToolsTab() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ToolResult>>({});
  const [showConsole, setShowConsole] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const runTool = async (tool: Tool) => {
    setRunning(tool.id);
    setShowConsole(true);
    setConsoleOutput(prev => [...prev, `> 正在运行: ${tool.name} (${tool.command})...`]);

    try {
      const res = await fetch(`/api/tools/${tool.command}`, { method: 'POST' });
      const data = await res.json();

      const result: ToolResult = {
        success: res.ok && !data.errors?.length,
        output: data.output || (res.ok ? '完成' : '失败'),
        errors: data.errors
      };

      setResults(prev => ({ ...prev, [tool.id]: result }));
      setConsoleOutput(prev => [
        ...prev,
        result.success ? `✓ ${tool.name}: 通过` : `✗ ${tool.name}: 失败`,
        ...(data.output ? [data.output] : []),
        ...(data.errors || []).map((e: string) => `  错误: ${e}`)
      ]);
    } catch (e) {
      setResults(prev => ({
        ...prev,
        [tool.id]: { success: false, output: '执行出错' }
      }));
      setConsoleOutput(prev => [...prev, `✗ ${tool.name}: 执行出错`]);
    } finally {
      setRunning(null);
    }
  };

  const runAllChecks = async () => {
    for (const tool of tools.slice(0, 2)) { // validate and lint
      await runTool(tool);
    }
  };

  const getColorClasses = (color: string) => ({
    blue: 'bg-blue-600/20 text-blue-400 border-blue-500/50 hover:bg-blue-600/30',
    yellow: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-600/30',
    purple: 'bg-purple-600/20 text-purple-400 border-purple-500/50 hover:bg-purple-600/30',
    emerald: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-600/30',
  }[color] || 'bg-slate-600/20 text-slate-400');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="text-purple-400" />
            自动化工具
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            运行校验、检查和编译工具，确保项目质量
          </p>
        </div>

        <button
          onClick={runAllChecks}
          disabled={running !== null}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition text-sm disabled:opacity-50"
        >
          <CheckCircle size={16} />
          运行全部检查
        </button>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-2 gap-4">
        {tools.map((tool) => {
          const result = results[tool.id];
          const isRunning = running === tool.id;

          return (
            <div
              key={tool.id}
              className={`bg-slate-900 border rounded-xl p-6 transition ${
                result
                  ? result.success
                    ? 'border-emerald-500/50'
                    : 'border-red-500/50'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${getColorClasses(tool.color)}`}>
                  {tool.icon}
                </div>
                {result && (
                  <div className={`flex items-center gap-1 text-sm ${
                    result.success ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {result.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {result.success ? '通过' : '失败'}
                  </div>
                )}
              </div>

              <h3 className="text-lg font-semibold text-slate-200 mb-1">{tool.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{tool.description}</p>

              {result?.errors && result.errors.length > 0 && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-300">
                  {result.errors.slice(0, 3).map((err, idx) => (
                    <div key={idx} className="truncate">• {err}</div>
                  ))}
                  {result.errors.length > 3 && (
                    <div className="text-red-400 mt-1">还有 {result.errors.length - 3} 个错误...</div>
                  )}
                </div>
              )}

              <button
                onClick={() => runTool(tool)}
                disabled={isRunning}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition text-sm disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    运行中...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    运行
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Console Output */}
      {showConsole && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Terminal size={16} />
              控制台输出
            </div>
            <button
              onClick={() => setShowConsole(false)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-4 font-mono text-sm max-h-64 overflow-y-auto">
            {consoleOutput.map((line, idx) => (
              <div
                key={idx}
                className={`${
                  line.startsWith('✓') ? 'text-emerald-400' :
                  line.startsWith('✗') ? 'text-red-400' :
                  line.startsWith('>') ? 'text-blue-400' :
                  line.startsWith('  错误') ? 'text-red-300' :
                  'text-slate-400'
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">推荐工作流程</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div className="text-2xl mb-2">1</div>
            <div className="text-sm text-slate-300">结构校验</div>
            <div className="text-xs text-slate-500 mt-1">validate.js</div>
          </div>
          <div className="text-slate-600">→</div>
          <div className="flex-1 text-center p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div className="text-2xl mb-2">2</div>
            <div className="text-sm text-slate-300">逻辑检查</div>
            <div className="text-xs text-slate-500 mt-1">lint.js</div>
          </div>
          <div className="text-slate-600">→</div>
          <div className="flex-1 text-center p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div className="text-2xl mb-2">3</div>
            <div className="text-sm text-slate-300">编译提示词</div>
            <div className="text-xs text-slate-500 mt-1">build-prompts.js</div>
          </div>
          <div className="text-slate-600">→</div>
          <div className="flex-1 text-center p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div className="text-2xl mb-2">4</div>
            <div className="text-sm text-slate-300">生成渲染</div>
            <div className="text-xs text-slate-500 mt-1">manage-renders.js</div>
          </div>
        </div>
      </div>

      {/* Help */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
        <strong className="text-slate-300">重要提示：</strong>
        必须看到 <span className="text-emerald-400">结构校验: 通过</span> 和{' '}
        <span className="text-emerald-400">逻辑检查: 通过</span> 才能继续后续步骤！
        这能帮你省下巨额的废片学费。
      </div>
    </div>
  );
}

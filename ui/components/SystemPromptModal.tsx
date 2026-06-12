"use client";

import { useState } from 'react';
import { Sparkles, X, Copy } from 'lucide-react';

interface SystemPromptModalProps {
  isOpen: boolean;
  systemPrompt: string;
  onClose: () => void;
}

export default function SystemPromptModal({
  isOpen,
  systemPrompt,
  onClose,
}: SystemPromptModalProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="text-indigo-400" size={20} />
            项目全局系统提示词 (Project System Prompt)
          </h3>
          <button
            onClick={() => {
              onClose();
              setIsCopied(false);
            }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-left">
          <p className="text-slate-400 text-xs leading-relaxed bg-indigo-950/20 border border-indigo-900/30 p-3 rounded-lg">
            💡 <strong>使用说明</strong>：复制下方全局系统提示词，粘贴到 ChatGPT / Gemini 会话的第一轮输入中。建立会话上下文之后，你再生成每一个镜头时，只需输入分镜提示词（可选择剥离全局的独立版本），即可大幅降低画面和连续性漂移，保持全局角色与场景一致！
          </p>
          <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-slate-300 font-mono text-xs whitespace-pre-wrap select-all max-h-[45vh] overflow-y-auto leading-relaxed">
            {systemPrompt}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={() => {
              onClose();
              setIsCopied(false);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
          >
            关闭
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(systemPrompt);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 2000);
            }}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
          >
            <Copy size={16} />
            {isCopied ? '已复制！' : '一键复制系统提示词'}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from 'react';
import { Sparkles, X, Copy } from 'lucide-react';
import type { Shot } from './shot-types';

interface ImagePromptModalProps {
  shot: Shot | null;
  onClose: () => void;
}

export default function ImagePromptModal({ shot, onClose }: ImagePromptModalProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (!shot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="text-purple-400" size={20} />
            {shot.shot_id} 分镜头照片参考提示词
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

        <div className="p-6 overflow-y-auto space-y-5 text-sm text-left">
          {/* Shot Info */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>时长: <span className="text-slate-200">{shot.duration_s}s</span></div>
            <div>场景: <span className="text-slate-200">{shot.scene_ref || '—'}</span></div>
            {shot.action?.beats && (
              <div className="col-span-2">动作: <span className="text-slate-200">{shot.action.beats.join('，')}</span></div>
            )}
            {shot.voiceover?.text && (
              <div className="col-span-2">旁白: <span className="text-emerald-300">"{shot.voiceover.text}"</span></div>
            )}
          </div>

          {shot.prompt?.positive ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-2">
                <div>画幅: <span className="text-slate-200">16:9</span></div>
                <div>画质: <span className="text-slate-200">8K, photorealistic, highly detailed</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">正向提示词</span>
                  <button
                    onClick={() => {
                      const full = `16:9, ${shot.prompt!.positive}, photorealistic, highly detailed, 8K`;
                      navigator.clipboard.writeText(full);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Copy size={12} />
                    {isCopied ? '已复制' : '复制（含质量词）'}
                  </button>
                </div>
                <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-emerald-300 font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                  {shot.prompt.positive}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">负向提示词</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shot.prompt!.negative!);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Copy size={12} />
                    {isCopied ? '已复制' : '复制'}
                  </button>
                </div>
                <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-red-300 font-mono text-xs whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                  {shot.prompt.negative || 'blurry, low quality, distorted, text artifacts, watermark, logo'}
                </pre>
              </div>

              <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg text-xs text-blue-300">
                画幅 16:9，推荐分辨率 1920x1080。复制上方提示词到 Stable Diffusion / Midjourney / DALL·E 生成关键帧，生成后通过「上传画面」回填。
              </div>
            </>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="text-yellow-500 text-4xl">⚠️</div>
              <h4 className="text-slate-200 font-semibold">暂无参考提示词</h4>
              <p className="text-slate-400 max-w-sm mx-auto text-xs leading-relaxed">
                本镜头未包含图像生成提示词。请先运行<strong>「剧本拆分」</strong>由 AI 自动生成，或手动在分镜编辑中填写 prompt 字段。
              </p>
            </div>
          )}
        </div>

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
          {shot.prompt?.positive && (
            <button
              onClick={() => {
                const fullText = `正向提示词:\n${shot.prompt!.positive}\n\n负向提示词:\n${shot.prompt!.negative || '无'}`;
                navigator.clipboard.writeText(fullText);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
              }}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
            >
              <Copy size={16} />
              {isCopied ? '已复制！' : '一键复制全部'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

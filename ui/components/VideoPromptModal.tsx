"use client";

import { useState } from 'react';
import { Sparkles, X, Copy } from 'lucide-react';
import type { Shot } from './shot-types';

interface VideoPromptModalProps {
  shot: Shot | null;
  onClose: () => void;
}

export default function VideoPromptModal({ shot, onClose }: VideoPromptModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [previewVideoMode, setPreviewVideoMode] = useState<'local' | 'full'>('local');

  if (!shot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="text-purple-400" size={20} />
            {shot.shot_id} 视频生成提示词预览
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
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-left font-sans">
          {shot._video_prompt ? (
            <>
              {/* Prompt Text */}
              <div className="space-y-2">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="text-slate-400 font-medium">正向提示词 (Positive Prompt)</span>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                      <button
                        onClick={() => setPreviewVideoMode('local')}
                        className={`px-2 py-1 rounded transition-all ${previewVideoMode === 'local' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        仅分镜提示词
                      </button>
                      <button
                        onClick={() => setPreviewVideoMode('full')}
                        className={`px-2 py-1 rounded transition-all ${previewVideoMode === 'full' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        完整提示词
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const val = previewVideoMode === 'local'
                          ? (shot._video_prompt!.prompt_shot_only || shot._video_prompt!.prompt)
                          : shot._video_prompt!.prompt;
                        navigator.clipboard.writeText(val);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      {isCopied ? '已复制！' : '复制正向'}
                    </button>
                  </div>
                </div>
                <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-emerald-300 font-mono text-xs whitespace-pre-wrap select-all max-h-48 overflow-y-auto leading-relaxed">
                  {previewVideoMode === 'local'
                    ? (shot._video_prompt.prompt_shot_only || shot._video_prompt.prompt)
                    : shot._video_prompt.prompt}
                </pre>
              </div>

              {/* Negative Prompt Text */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">负向提示词 (Negative Prompt)</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shot._video_prompt!.negative);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    {isCopied ? '已复制！' : '复制负向'}
                  </button>
                </div>
                <pre className="bg-slate-950 p-4 border border-slate-800 rounded-xl text-red-300 font-mono text-xs whitespace-pre-wrap select-all max-h-36 overflow-y-auto leading-relaxed">
                  {shot._video_prompt.negative}
                </pre>
              </div>

              {/* Camera Motion */}
              {shot._video_prompt.motion && (
                <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-slate-800 text-xs">
                  <div className="col-span-1 text-slate-500">相机运动 (Camera Motion)</div>
                  <div className="col-span-2 text-slate-300 font-mono">{shot._video_prompt.motion}</div>
                </div>
              )}

              {/* Conditioning Images */}
              {shot._video_prompt.condition_images && shot._video_prompt.condition_images.length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-400 font-medium">条件参考图 (Conditioning Images)</span>
                  <div className="text-xs text-slate-500 mb-1">
                    外部工具生成时可上传这些参考图进行垫图（首尾帧插值或身份保持）
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 bg-slate-950 border border-slate-800 rounded-xl">
                    {shot._video_prompt.condition_images.map((img: string, idx: number) => (
                      <div key={idx} className="truncate text-slate-400 font-mono text-xs p-1 hover:text-white flex items-center justify-between gap-2">
                        <span className="truncate">• {img.split('/').pop()}</span>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(img);
                              const blob = await response.blob();
                              const blobUrl = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = img.split('/').pop() || 'keyframe.png';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(blobUrl);
                            } catch (err) {
                              console.error('Download failed:', err);
                            }
                          }}
                          className="text-blue-400 hover:text-blue-300 text-[10px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 flex-shrink-0"
                        >
                          下载
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="text-yellow-500 text-4xl">⚠️</div>
              <h4 className="text-slate-200 font-semibold">提示词未编译</h4>
              <p className="text-slate-400 max-w-sm mx-auto text-xs leading-relaxed">
                本镜头的 final.json 提示词 file 不存在。请前往<strong>“自动化工具”</strong>页签运行<strong>“视频提示词”</strong>编译工具后再试。
              </p>
            </div>
          )}
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
          {shot._video_prompt && (
            <button
              onClick={() => {
                const promptVal = previewVideoMode === 'local'
                  ? (shot._video_prompt!.prompt_shot_only || shot._video_prompt!.prompt)
                  : shot._video_prompt!.prompt;
                const fullText = `Prompt:\n${promptVal}\n\nNegative:\n${shot._video_prompt!.negative}`;
                navigator.clipboard.writeText(fullText);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
              }}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
            >
              <Copy size={16} />
              {isCopied ? '已复制！' : '一键复制提示词'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

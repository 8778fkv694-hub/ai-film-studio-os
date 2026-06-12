"use client";

import { useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import type { Shot } from './shot-types';

interface ImagePreviewModalProps {
  shot: Shot;
  onClose: () => void;
  onDelete?: (kfUrl: string) => void | Promise<void>;
}

export default function ImagePreviewModal({ shot, onClose, onDelete }: ImagePreviewModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [copyStatus, setCopyStatus] = useState('复制图片');
  const images = shot._keyframes || [];
  const activeImg = images[currentIdx];

  const handleDownload = async () => {
    if (!activeImg) return;
    try {
      const response = await fetch(activeImg);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeImg.split('/').pop() || `${shot.shot_id}_keyframe.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyImage = async () => {
    if (!activeImg) return;
    setCopyStatus('读取中...');
    try {
      const response = await fetch(activeImg);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopyStatus('已复制！');
      setTimeout(() => setCopyStatus('复制图片'), 2000);
    } catch (err) {
      console.error('Clipboard copy failed: ', err);
      try {
        const fullUrl = window.location.origin + activeImg;
        await navigator.clipboard.writeText(fullUrl);
        setCopyStatus('已复制链接');
        setTimeout(() => setCopyStatus('复制图片'), 2000);
      } catch {
        setCopyStatus('复制失败');
        setTimeout(() => setCopyStatus('复制图片'), 2000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <ImageIcon className="text-blue-400" size={20} />
            {shot.shot_id} 分镜画面预览 ({currentIdx + 1}/{images.length})
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-950 p-6 flex flex-col items-center justify-center min-h-[300px] overflow-hidden relative">
          {activeImg ? (
            <img
              src={activeImg}
              alt={`${shot.shot_id} keyframe`}
              className="max-h-[50vh] object-contain rounded-lg shadow-lg border border-slate-800"
            />
          ) : (
            <div className="text-slate-500 text-sm">图片不存在</div>
          )}

          {/* Navigation Dots / Thumbnail */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto max-w-full p-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-12 h-12 rounded border-2 transition overflow-hidden flex-shrink-0 ${
                    idx === currentIdx ? 'border-blue-500' : 'border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <span className="text-xs text-slate-500 font-mono truncate max-w-[250px]">
            {activeImg ? activeImg.split('/').pop() : ''}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
            >
              关闭
            </button>
            {onDelete && activeImg && (
              <button
                onClick={() => onDelete(activeImg)}
                className="px-4 py-2 bg-red-600/20 text-red-300 border border-red-500/20 hover:bg-red-600/30 rounded-lg text-sm transition"
              >
                删除此图
              </button>
            )}
            <button
              onClick={handleCopyImage}
              className="px-4 py-2 bg-blue-600/20 text-blue-300 border border-blue-500/20 hover:bg-blue-600/30 rounded-lg text-sm transition"
            >
              {copyStatus}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              下载图片
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

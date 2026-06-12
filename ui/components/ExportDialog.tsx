"use client";

import { Film } from 'lucide-react';
import type { Shot } from './shot-types';
import type { SubtitleStyle } from './Player';

interface ExportDialogProps {
  isOpen: boolean;
  shots: Shot[];
  exportPreset: string;
  setExportPreset: (val: string) => void;
  exportAudioSource: 'tts' | 'video';
  setExportAudioSource: (val: 'tts' | 'video') => void;
  exportWithSubtitles: boolean;
  setExportWithSubtitles: (val: boolean) => void;
  subtitleStyle: SubtitleStyle;
  onClose: () => void;
  onExport: (withSubtitles: boolean) => void;
}

export default function ExportDialog({
  isOpen,
  shots,
  exportPreset,
  setExportPreset,
  exportAudioSource,
  setExportAudioSource,
  exportWithSubtitles,
  setExportWithSubtitles,
  subtitleStyle,
  onClose,
  onExport,
}: ExportDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Film className="text-red-400" size={20} />
            导出 MP4 视频
          </h3>
        </div>
        <div className="p-6 space-y-4 text-left">
          <p className="text-sm text-slate-400">
            将 {shots.length} 个分镜合成为一个 MP4 视频 file。
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">导出分辨率预设</label>
            <select
              value={exportPreset}
              onChange={e => setExportPreset(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition font-medium"
            >
              <option value="default_1080p">宽屏 1080p (1920x1080, 16:9)</option>
              <option value="vertical_1080x1920">竖屏 1080x1920 (1080x1920, 9:16)</option>
              <option value="square_1080">方屏 1080p (1080x1080, 1:1)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              声音来源
              <span className="ml-2 font-normal text-slate-500 font-sans">当前：{exportAudioSource === 'tts' ? 'TTS 配音（默认）' : '画面自带声音'}</span>
            </label>
            <div className="inline-flex rounded-lg border border-slate-800 overflow-hidden text-sm w-full">
              <button
                type="button"
                onClick={() => setExportAudioSource('tts')}
                className={`flex-1 px-3 py-2 transition ${exportAudioSource === 'tts' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}
              >
                TTS 配音 · 默认
              </button>
              <button
                type="button"
                onClick={() => setExportAudioSource('video')}
                className={`flex-1 px-3 py-2 transition border-l border-slate-800 ${exportAudioSource === 'video' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'}`}
              >
                画面自带声音
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              {exportAudioSource === 'tts'
                ? '✓ 全程使用 TTS 配音，视频片段静音只作画面（视频自带声音不会被导出）。'
                : '视频片段使用其自带声音；无音轨的片段回退到 TTS 配音。'}
            </div>
          </div>
          <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition">
            <input
              type="checkbox"
              checked={exportWithSubtitles}
              onChange={e => setExportWithSubtitles(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm text-slate-200 font-medium">烧录字幕</div>
              <div className="text-xs text-slate-500">将旁白/对白文字烧录到视频底部，类似电影字幕</div>
            </div>
          </label>
          {exportWithSubtitles && (
            <div className="text-xs text-slate-500 bg-slate-800/30 rounded-lg p-3 space-y-1">
              <div className="text-slate-400">当前字幕样式：<span className="text-slate-300">白字黑描边</span></div>
              <div className="text-slate-300 font-sans">字号: <span className="text-white">{subtitleStyle.fontSize}px</span> · 字体: <span className="text-white">{subtitleStyle.fontFamily.split(',')[0].replace(/"/g, '')}</span></div>
              <div className="text-slate-300 font-sans">颜色: <span className="inline-block w-3 h-3 rounded-full align-middle border border-slate-500" style={{backgroundColor: subtitleStyle.textColor}}></span> · 描边: <span className="text-white">{subtitleStyle.strokeWidth}px</span></div>
              <div className="bg-black rounded-lg p-2 mt-1 text-center" style={{
                fontSize: `${Math.min(subtitleStyle.fontSize, 14)}px`,
                fontFamily: subtitleStyle.fontFamily,
                color: subtitleStyle.textColor,
                textShadow: subtitleStyle.strokeWidth > 0
                  ? `${subtitleStyle.strokeWidth}px ${subtitleStyle.strokeWidth}px 0 #000, -${subtitleStyle.strokeWidth}px -${subtitleStyle.strokeWidth}px 0 #000, ${subtitleStyle.strokeWidth}px -${subtitleStyle.strokeWidth}px 0 #000, -${subtitleStyle.strokeWidth}px ${subtitleStyle.strokeWidth}px 0 #000, 0 ${subtitleStyle.strokeWidth}px 0 #000, 0 -${subtitleStyle.strokeWidth}px 0 #000, ${subtitleStyle.strokeWidth}px 0 0 #000, -${subtitleStyle.strokeWidth}px 0 0 #000`
                  : 'none',
                fontWeight: 600,
              }}>
                {(shots.map(s => s.voiceover?.text || s.dialogue?.text).find(Boolean) || '字幕预览示例').split(/(?<=[。，,.;；!！?？])/)[0]}
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition"
          >
            取消
          </button>
          <button
            onClick={() => onExport(exportWithSubtitles)}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
          >
            <Film size={16} />
            开始导出
          </button>
        </div>
      </div>
    </div>
  );
}

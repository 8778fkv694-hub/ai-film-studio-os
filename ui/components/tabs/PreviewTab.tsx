"use client";

import { useState, useEffect, useRef, Fragment } from 'react';
import { Volume2, Play, RefreshCw, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, Upload, Copy, Sparkles, X, Download, Film, ArrowUp, ArrowDown, Trash2, Grid, List, Inbox } from 'lucide-react';
import Player, { SubtitleStyle } from '../Player';
import ImagePreviewModal from '../ImagePreviewModal';
import TakeCompareModal from '../TakeCompareModal';
import StoryboardWall from '../StoryboardWall';
import TakesPanel from '../TakesPanel';
import ShotSyncPanel from '../ShotSyncPanel';
import ShotLintPanel from '../ShotLintPanel';
import ExportDialog from '../ExportDialog';
import SystemPromptModal from '../SystemPromptModal';
import ImagePromptModal from '../ImagePromptModal';
import VideoPromptModal from '../VideoPromptModal';
import ShotCardList from '../ShotCardList';
import ShotTableList from '../ShotTableList';

import type { Shot, LintIssue } from '../shot-types';

interface PreviewTabProps {
  onNavigate?: (tab: any) => void;
}

export default function PreviewTab({ onNavigate }: PreviewTabProps = {}) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);
  const [uploadingKeyframe, setUploadingKeyframe] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const [exportingShot, setExportingShot] = useState<string | null>(null);
  const [orderingShot, setOrderingShot] = useState<string | null>(null);
  const [activeSyncShotId, setActiveSyncShotId] = useState<string | null>(null);
  const [syncingPromptShot, setSyncingPromptShot] = useState<string | null>(null);
  const [acceptingTakeShot, setAcceptingTakeShot] = useState<string | null>(null);
  const [exportingVideo, setExportingVideo] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportWithSubtitles, setExportWithSubtitles] = useState(true);
  const [exportPreset, setExportPreset] = useState<string>('default_1080p');
  const [exportAudioSource, setExportAudioSource] = useState<'tts' | 'video'>('tts');
  const [editingVO, setEditingVO] = useState<string | null>(null); // 正在行内编辑讲解的分镜 id
  const [voDraft, setVoDraft] = useState('');
  const [savingVO, setSavingVO] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontSize: 20,
    fontFamily: '"Microsoft YaHei", sans-serif',
    textColor: '#ffffff',
    bgOpacity: 70,
    strokeWidth: 3,
  });
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [activePromptShot, setActivePromptShot] = useState<Shot | null>(null);
  const [activeImagePromptShot, setActiveImagePromptShot] = useState<Shot | null>(null);
  const [activeImageShot, setActiveImageShot] = useState<Shot | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [expandedShots, setExpandedShots] = useState<Record<string, boolean>>({});
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [showSystemPrompt, setShowSystemPrompt] = useState<boolean>(false);

  // New state variables for refactored tabs
  const [viewMode, setViewMode] = useState<'card' | 'table' | 'board'>('card');
  const [compareSel, setCompareSel] = useState<{ shotId: string; takeIds: string[] }>({ shotId: '', takeIds: [] });
  const [compareModal, setCompareModal] = useState<{ shot: Shot; takes: any[] } | null>(null);
  const [lintData, setLintData] = useState<{ counts: { error: number; warn: number; info: number }; byShot: Record<string, LintIssue[]>; global: LintIssue[] } | null>(null);
  const [expandedLints, setExpandedLints] = useState<Record<string, boolean>>({});
  const [runningLint, setRunningLint] = useState(false);
  const [runningInbox, setRunningInbox] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [dragOverShot, setDragOverShot] = useState<string | null>(null);

  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [editingDuration, setEditingDuration] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState('');
  const [savingDuration, setSavingDuration] = useState(false);
  const layoutSaveTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Lint Report loading
  const loadLintReport = async (runPost: boolean = false) => {
    if (runPost) setRunningLint(true);
    try {
      const res = await fetch('/api/lint', { method: runPost ? 'POST' : 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          setLintData({
            counts: data.counts,
            byShot: data.byShot,
            global: data.global
          });
        }
      }
    } catch (e) {
      console.error('Failed to load lint report:', e);
    } finally {
      if (runPost) setRunningLint(false);
    }
  };

  // Inbox import trigger
  const triggerInboxFill = async () => {
    setRunningInbox(true);
    setResult(null);
    try {
      const res = await fetch('/api/assets/inbox', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const impCount = data.imported?.length || 0;
        const skipCount = data.skipped?.length || 0;
        if (impCount > 0) {
          setResult({
            success: true,
            message: `收件箱处理完成：成功导入 ${impCount} 个文件，跳过 ${skipCount} 个。`
          });
          await loadShots();
          await loadLintReport(true);
        } else {
          setResult({
            success: true,
            message: `没有可导入的文件（跳过 ${skipCount} 个）。请把文件放到项目 inbox/ 目录中。`
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setResult({ success: false, message: err.error || '处理收件箱失败' });
      }
    } catch (e) {
      setResult({ success: false, message: '处理收件箱失败' });
    } finally {
      setRunningInbox(false);
    }
  };

  // Toggle compare selection
  const handleToggleCompareTake = (shot: Shot, takeId: string) => {
    setCompareSel(prev => {
      if (prev.shotId !== shot.shot_id) {
        return { shotId: shot.shot_id, takeIds: [takeId] };
      }
      if (prev.takeIds.includes(takeId)) {
        return { ...prev, takeIds: prev.takeIds.filter(id => id !== takeId) };
      }
      const newTakeIds = [...prev.takeIds, takeId];
      if (newTakeIds.length === 2) {
        const selectedTakes = shot._takes?.filter((t: any) => newTakeIds.includes(t.take_id)) || [];
        setCompareModal({ shot, takes: selectedTakes });
        return { shotId: '', takeIds: [] };
      }
      return { ...prev, takeIds: newTakeIds };
    });
  };

  // Copy next pending shot prompt and focus
  const copyNextPending = () => {
    const nextPending = shots.find(s => !s._keyframes || s._keyframes.length === 0);
    if (nextPending) {
      const positivePrompt = nextPending.prompt?.positive || '';
      if (positivePrompt) {
        navigator.clipboard.writeText(positivePrompt);
        setResult({
          success: true,
          message: `已自动定位并复制 ${nextPending.shot_id} 的提示词到剪贴板！`
        });
      } else {
        setResult({
          success: true,
          message: `已自动定位到 ${nextPending.shot_id}，但该镜头无提示词。`
        });
      }
      const el = document.getElementById(`shot-card-${nextPending.shot_id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const idx = shots.findIndex(s => s.shot_id === nextPending.shot_id);
      if (idx !== -1) setFocusedIndex(idx);
    } else {
      setResult({
        success: true,
        message: '所有分镜均已包含画面资产！'
      });
    }
  };

  // Drag and drop / Paste handlers
  const handleDragOver = (e: React.DragEvent, shotId: string) => {
    e.preventDefault();
    setDragOverShot(shotId);
  };

  const handleDragLeave = () => {
    setDragOverShot(null);
  };

  const handleDrop = async (e: React.DragEvent, shotId: string) => {
    e.preventDefault();
    setDragOverShot(null);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      if (isImg) {
        await uploadKeyframe(shotId, file);
      } else if (isVid) {
        await uploadVideo(shotId, file);
      } else {
        setResult({ success: false, message: '只支持拖拽上传图片或视频文件' });
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent, shotId: string) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const isImg = file.type.startsWith('image/');
          const isVid = file.type.startsWith('video/');
          if (isImg) {
            await uploadKeyframe(shotId, file);
          } else if (isVid) {
            await uploadVideo(shotId, file);
          } else {
            setResult({ success: false, message: '粘贴只支持图片或视频文件' });
          }
          break;
        }
      }
    }
  };

  useEffect(() => {
    loadShots();
    loadProjectPrompt();
    loadLintReport();
  }, []);

  // Keyboard navigation listener
  const focusedShot = focusedIndex >= 0 && focusedIndex < shots.length ? shots[focusedIndex] : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      
      if (key === 'j') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev < shots.length - 1 ? prev + 1 : prev;
          if (next >= 0 && shots[next]) {
            const el = document.getElementById(`shot-card-${shots[next].shot_id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          return next;
        });
      } else if (key === 'k') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev > 0 ? prev - 1 : 0;
          if (next >= 0 && shots[next]) {
            const el = document.getElementById(`shot-card-${shots[next].shot_id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          return next;
        });
      }

      if (!focusedShot) return;

      const activeTake = focusedShot._active_take;

      if (key === 'a') {
        if (activeTake) {
          e.preventDefault();
          handleTakeAction(focusedShot.shot_id, activeTake.take_id, 'approve');
        }
      } else if (key === 'r') {
        if (activeTake) {
          e.preventDefault();
          handleTakeAction(focusedShot.shot_id, activeTake.take_id, 'reject');
        }
      } else if (key >= '1' && key <= '5') {
        if (activeTake) {
          e.preventDefault();
          const rating = parseInt(key, 10);
          handleUpdateReview(focusedShot.shot_id, activeTake.take_id, rating, activeTake.review?.notes || '');
        }
      } else if (key === 'e') {
        e.preventDefault();
        toggleExpandShot(focusedShot.shot_id);
      } else if (key === 's') {
        e.preventDefault();
        setActiveSyncShotId(prev => prev === focusedShot.shot_id ? null : focusedShot.shot_id);
      } else if (key === 'l') {
        e.preventDefault();
        setExpandedLints(prev => ({
          ...prev,
          [focusedShot.shot_id]: !prev[focusedShot.shot_id]
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shots, focusedIndex, focusedShot]);

  const loadProjectPrompt = async () => {
    try {
      const res = await fetch('/api/project');
      if (res.ok) {
        const data = await res.json();
        if (data.project_system_prompt) {
          setSystemPrompt(data.project_system_prompt);
        }
      }
    } catch (e) {
      console.error('Failed to load project system prompt:', e);
    }
  };

  const loadShots = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shots');
      if (res.ok) {
        setShots(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isAllSelected = shots.length > 0 && selectedShotIds.length === shots.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedShotIds([]);
    } else {
      setSelectedShotIds(shots.map(s => s.shot_id));
    }
  };
  const toggleSelectShot = (shotId: string) => {
    setSelectedShotIds(prev =>
      prev.includes(shotId) ? prev.filter(id => id !== shotId) : [...prev, shotId]
    );
  };

  const toggleExpandShot = (shotId: string) => {
    setExpandedShots(prev => ({
      ...prev,
      [shotId]: !prev[shotId]
    }));
  };

  const updateShotOrder = async (shotId: string, action: 'move_up' | 'move_down' | 'delete') => {
    if (action === 'delete' && !window.confirm(`删除分镜 ${shotId}？对应画面、视频版本、配音和提示词文件也会一并删除。`)) return;
    setOrderingShot(shotId);
    setResult(null);
    try {
      const res = await fetch('/api/shots/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot_id: shotId, action })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const renamed = data.renamed && Object.keys(data.renamed).length
          ? `；重排编号 ${Object.entries(data.renamed).map(([a, b]) => `${a}→${b}`).join('、')}`
          : '';
        const promptNote = data.prompt_rebuild?.success === false ? '；提示词重编译失败，请稍后手动重编译' : '；提示词已重编译';
        setResult({ success: data.prompt_rebuild?.success !== false, message: `时间线已更新${renamed}${promptNote}` });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '更新时间线失败' });
      }
    } catch {
      setResult({ success: false, message: '更新时间线失败' });
    } finally {
      setOrderingShot(null);
    }
  };

  const handleTakeAction = async (shotId: string, takeId: string, action: string) => {
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shotId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: takeId, action })
      });
      if (res.ok) {
        setResult({ success: true, message: `操作成功：${action}` });
        await loadShots(); // Reload shots list
      } else {
        const data = await res.json();
        setResult({ success: false, message: data.error || '操作失败' });
      }
    } catch {
      setResult({ success: false, message: '操作发生异常错误' });
    }
  };

  const deleteTake = async (shotId: string, takeId: string) => {
    if (!window.confirm(`删除该视频版本（${takeId}）？此操作不可撤销。若删除的是当前版本，会自动切换到最新的剩余版本。`)) return;
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shotId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: takeId, action: 'delete' })
      });
      if (res.ok) {
        setResult({ success: true, message: `已删除视频版本 ${takeId}` });
        await loadShots();
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || '删除视频版本失败' });
      }
    } catch {
      setResult({ success: false, message: '删除视频版本失败' });
    }
  };

  const handleUpdateReview = async (shotId: string, takeId: string, rating?: number, notes?: string) => {
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shotId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          take_id: takeId, 
          action: 'update_review',
          rating,
          notes 
        })
      });
      if (res.ok) {
        await loadShots(); // Reload shots list silently
      } else {
        const data = await res.json();
        setResult({ success: false, message: data.error || '保存评审失败' });
      }
    } catch {
      setResult({ success: false, message: '保存评审失败' });
    }
  };

  const syncShotPrompts = async (shotId: string) => {
    setSyncingPromptShot(shotId);
    setResult(null);
    try {
      const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/prompts`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setResult({ success: true, message: `${shotId} Prompt 已同步` });
        await loadProjectPrompt();
        await loadShots();
      } else {
        const detail = data.video_prompts?.stderr || data.image_prompts?.stderr || data.error;
        setResult({ success: false, message: detail || `${shotId} Prompt 同步失败` });
      }
    } catch {
      setResult({ success: false, message: `${shotId} Prompt 同步失败` });
    } finally {
      setSyncingPromptShot(null);
    }
  };

  const acceptCurrentTakePrompt = async (shot: Shot) => {
    if (!shot._active_take?.take_id) return;
    setAcceptingTakeShot(shot.shot_id);
    setResult(null);
    try {
      const res = await fetch(`/api/takes/${encodeURIComponent(shot.shot_id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take_id: shot._active_take.take_id, action: 'refresh_prompt_hash' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ success: true, message: `${shot.shot_id} 已接受当前视频为新版基准` });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '更新视频基准失败' });
      }
    } catch {
      setResult({ success: false, message: '更新视频基准失败' });
    } finally {
      setAcceptingTakeShot(null);
    }
  };

  const generateTTS = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/tts/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `成功生成 ${data.count} 个音频文件` });
        await loadShots(); // 刷新镜头数据（含更新后的时长）
      } else {
        setResult({ success: false, message: data.error || '生成失败' });
      }
    } catch (e) {
      setResult({ success: false, message: '生成失败' });
    } finally {
      setGenerating(false);
    }
  };

  const generateSingleTTS = async (shotId: string) => {
    setGeneratingSingle(shotId);
    setResult(null);
    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot_id: shotId })
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `${shotId} 音频已生成` });
        await loadShots(); // 刷新镜头数据
      } else {
        setResult({ success: false, message: data.error || '生成失败' });
      }
    } catch (e) {
      setResult({ success: false, message: '生成失败' });
    } finally {
      setGeneratingSingle(null);
    }
  };

  const uploadKeyframe = async (shotId: string, file: File | null) => {
    if (!file) return;
    setUploadingKeyframe(shotId);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/assets/keyframes/${encodeURIComponent(shotId)}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `${shotId} 关键帧已上传` });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '上传失败' });
      }
    } catch {
      setResult({ success: false, message: '上传失败' });
    } finally {
      setUploadingKeyframe(null);
    }
  };

  const deleteKeyframe = async (shotId: string, kfUrl: string) => {
    const name = kfUrl.split('/').pop() || '';
    if (!name) return;
    if (!confirm(`确定删除 ${shotId} 的关键帧「${decodeURIComponent(name)}」？此操作不可撤销。`)) return;
    setResult(null);
    try {
      const res = await fetch(`/api/assets/keyframes/${encodeURIComponent(shotId)}/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ success: true, message: `${shotId} 关键帧已删除` });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '删除失败' });
      }
    } catch {
      setResult({ success: false, message: '删除失败' });
    }
  };

  // ===== 讲解（旁白）行内编辑 =====
  const beginEditVO = (shot: Shot) => {
    setEditingVO(shot.shot_id);
    setVoDraft(shot.voiceover?.text || '');
  };
  const cancelEditVO = () => {
    setEditingVO(null);
    setVoDraft('');
  };
  const commitEditVO = async (shot: Shot) => {
    if (savingVO) return;
    const text = voDraft.trim();
    const current = shot.voiceover?.text || '';
    if (text === current || (!text && !shot.voiceover)) { cancelEditVO(); return; }
    setSavingVO(true);
    try {
      const updated: any = { ...shot, voiceover: { ...(shot.voiceover || { speaker: '讲解' }), text } };
      const res = await fetch('/api/shots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setEditingVO(null);
        setVoDraft('');
        setResult({ success: true, message: `${shot.shot_id} 讲解已更新（重新生成配音后即同步语音）` });
        await loadShots();
      } else {
        const d = await res.json().catch(() => ({}));
        setResult({ success: false, message: d.error || '保存失败' });
      }
    } catch {
      setResult({ success: false, message: '保存失败' });
    } finally {
      setSavingVO(false);
    }
  };

  // ===== 时长行内编辑 =====
  const beginEditDuration = (shot: Shot) => {
    setEditingDuration(shot.shot_id);
    setDurationDraft(shot.duration_s.toString());
  };
  const cancelEditDuration = () => {
    setEditingDuration(null);
    setDurationDraft('');
  };
  const commitEditDuration = async (shot: Shot) => {
    if (savingDuration) return;
    const val = parseFloat(durationDraft);
    if (isNaN(val) || val <= 0) {
      setResult({ success: false, message: '请输入有效的时长值（大于 0 的数字）' });
      cancelEditDuration();
      return;
    }
    if (val === shot.duration_s) {
      cancelEditDuration();
      return;
    }
    setSavingDuration(true);
    try {
      const updated: any = { ...shot, duration_s: val };
      const res = await fetch('/api/shots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setEditingDuration(null);
        setDurationDraft('');
        setResult({ success: true, message: `${shot.shot_id} 时长已更新为 ${val}s` });
        await loadShots();
      } else {
        const d = await res.json().catch(() => ({}));
        setResult({ success: false, message: d.error || '保存时长失败' });
      }
    } catch {
      setResult({ success: false, message: '保存时长失败' });
    } finally {
      setSavingDuration(false);
    }
  };

  // ===== 批量操作处理器 =====
  const bulkSyncPrompts = async () => {
    if (selectedShotIds.length === 0) return;
    setResult(null);
    let successCount = 0;
    let failCount = 0;
    for (const shotId of selectedShotIds) {
      try {
        const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/prompts`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    setResult({
      success: failCount === 0,
      message: `批量同步 Prompt 完成：成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : '')
    });
    await loadProjectPrompt();
    await loadShots();
    setSelectedShotIds([]);
  };

  const bulkGenerateTTS = async () => {
    if (selectedShotIds.length === 0) return;
    setResult(null);
    let successCount = 0;
    let failCount = 0;
    for (const shotId of selectedShotIds) {
      try {
        const res = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shot_id: shotId })
        });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    setResult({
      success: failCount === 0,
      message: `批量生成配音完成：成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : '')
    });
    await loadShots();
    setSelectedShotIds([]);
  };

  const bulkExportHandoff = async () => {
    if (selectedShotIds.length === 0) return;
    setResult(null);
    let successCount = 0;
    let failCount = 0;
    for (const shotId of selectedShotIds) {
      try {
        const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/export`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `handoff_${shotId}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          successCount++;
          await new Promise(r => setTimeout(r, 300));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    setResult({
      success: failCount === 0,
      message: `批量导出交接包完成：成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : '')
    });
    setSelectedShotIds([]);
  };

  const bulkDeleteShots = async () => {
    if (selectedShotIds.length === 0) return;
    if (!window.confirm(`确认批量删除选中的 ${selectedShotIds.length} 个分镜？对应画面、视频版本、配音和提示词文件也会一并删除。`)) return;
    
    setResult(null);
    const sortedIds = [...selectedShotIds].sort((a, b) => {
      const indexA = shots.findIndex(s => s.shot_id === a);
      const indexB = shots.findIndex(s => s.shot_id === b);
      return indexB - indexA;
    });

    let successCount = 0;
    let failCount = 0;
    for (const shotId of sortedIds) {
      try {
        const res = await fetch('/api/shots/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shot_id: shotId, action: 'delete' })
        });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    
    setResult({
      success: failCount === 0,
      message: `批量删除分镜完成：成功 ${successCount} 个` + (failCount > 0 ? `，失败 ${failCount} 个` : '')
    });
    await loadShots();
    setSelectedShotIds([]);
  };


    const renderCardView = () => {
    return (
      <ShotCardList
        shots={shots}
        selectedShotIds={selectedShotIds}
        toggleSelectShot={toggleSelectShot}
        orderingShot={orderingShot}
        updateShotOrder={updateShotOrder}
        editingDuration={editingDuration}
        durationDraft={durationDraft}
        setDurationDraft={setDurationDraft}
        beginEditDuration={beginEditDuration}
        cancelEditDuration={cancelEditDuration}
        commitEditDuration={commitEditDuration}
        editingVO={editingVO}
        voDraft={voDraft}
        setVoDraft={setVoDraft}
        beginEditVO={beginEditVO}
        cancelEditVO={cancelEditVO}
        commitEditVO={commitEditVO}
        savingVO={savingVO}
        focusedIndex={focusedIndex}
        setFocusedIndex={setFocusedIndex}
        dragOverShot={dragOverShot}
        handlePaste={handlePaste}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        activeSyncShotId={activeSyncShotId}
        setActiveSyncShotId={setActiveSyncShotId}
        syncingPromptShot={syncingPromptShot}
        acceptingTakeShot={acceptingTakeShot}
        expandedShots={expandedShots}
        toggleExpandShot={toggleExpandShot}
        uploadingKeyframe={uploadingKeyframe}
        uploadKeyframe={uploadKeyframe}
        uploadingVideo={uploadingVideo}
        uploadVideo={uploadVideo}
        generatingSingle={generatingSingle}
        generateSingleTTS={generateSingleTTS}
        exportingShot={exportingShot}
        exportShotHandoff={exportShotHandoff}
        setActiveImageShot={setActiveImageShot}
        setActiveImagePromptShot={setActiveImagePromptShot}
        setActivePromptShot={setActivePromptShot}
        lintData={lintData}
        expandedLints={expandedLints}
        setExpandedLints={setExpandedLints}
        compareSel={compareSel}
        handleToggleCompareTake={handleToggleCompareTake}
        handleUpdateReview={handleUpdateReview}
        handleTakeAction={handleTakeAction}
        deleteTake={deleteTake}
        syncShotPrompts={syncShotPrompts}
        acceptCurrentTakePrompt={acceptCurrentTakePrompt}
      />
    );
  };

    const renderTableView = () => {
    return (
      <ShotTableList
        shots={shots}
        selectedShotIds={selectedShotIds}
        toggleSelectShot={toggleSelectShot}
        isAllSelected={isAllSelected}
        toggleSelectAll={toggleSelectAll}
        orderingShot={orderingShot}
        updateShotOrder={updateShotOrder}
        editingDuration={editingDuration}
        durationDraft={durationDraft}
        setDurationDraft={setDurationDraft}
        beginEditDuration={beginEditDuration}
        cancelEditDuration={cancelEditDuration}
        commitEditDuration={commitEditDuration}
        editingVO={editingVO}
        voDraft={voDraft}
        setVoDraft={setVoDraft}
        beginEditVO={beginEditVO}
        cancelEditVO={cancelEditVO}
        commitEditVO={commitEditVO}
        activeSyncShotId={activeSyncShotId}
        setActiveSyncShotId={setActiveSyncShotId}
        syncingPromptShot={syncingPromptShot}
        acceptingTakeShot={acceptingTakeShot}
        expandedShots={expandedShots}
        toggleExpandShot={toggleExpandShot}
        uploadingKeyframe={uploadingKeyframe}
        uploadKeyframe={uploadKeyframe}
        uploadingVideo={uploadingVideo}
        uploadVideo={uploadVideo}
        generatingSingle={generatingSingle}
        generateSingleTTS={generateSingleTTS}
        exportingShot={exportingShot}
        exportShotHandoff={exportShotHandoff}
        setActiveImageShot={setActiveImageShot}
        setActiveImagePromptShot={setActiveImagePromptShot}
        setActivePromptShot={setActivePromptShot}
        lintData={lintData}
        expandedLints={expandedLints}
        setExpandedLints={setExpandedLints}
        compareSel={compareSel}
        handleToggleCompareTake={handleToggleCompareTake}
        handleUpdateReview={handleUpdateReview}
        handleTakeAction={handleTakeAction}
        deleteTake={deleteTake}
        syncShotPrompts={syncShotPrompts}
        acceptCurrentTakePrompt={acceptCurrentTakePrompt}
      />
    );
  };

  const renderBulkActionsBar = () => {
    if (selectedShotIds.length === 0) return null;
    return (
      <div className="sticky bottom-4 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border border-blue-500/30 rounded-xl p-4 shadow-xl shadow-blue-500/5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-5 h-5 bg-blue-600 rounded-full text-[10px] font-bold text-white font-mono">
            {selectedShotIds.length}
          </span>
          <span className="text-sm font-medium text-slate-200">已选中分镜</span>
          <button
            onClick={() => setSelectedShotIds([])}
            className="text-xs text-slate-400 hover:text-slate-200 hover:underline"
          >
            取消选择
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={bulkSyncPrompts}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Sparkles size={13} />
            批量同步 Prompt
          </button>
          
          <button
            onClick={bulkGenerateTTS}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Volume2 size={13} />
            批量生成配音
          </button>
          
          <button
            onClick={bulkExportHandoff}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download size={13} />
            批量导出交接包
          </button>
          
          <button
            onClick={bulkDeleteShots}
            className="px-3 py-1.5 bg-red-950/45 border border-red-500/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Trash2 size={13} />
            批量删除
          </button>
        </div>
      </div>
    );
  };

  const uploadVideo = async (shotId: string, file: File | null) => {
    if (!file) return;
    setUploadingVideo(shotId);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('shot_id', shotId);
      const res = await fetch('/api/assets/video/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: `${shotId} 视频已成功上传${data.ffmpegSuccess ? '，并成功自动提取最后一帧作为垫图。' : '，但提取尾帧失败（已降级）。'}`
        });
        await loadShots();
      } else {
        setResult({ success: false, message: data.error || '上传视频失败' });
      }
    } catch {
      setResult({ success: false, message: '上传视频失败' });
    } finally {
      setUploadingVideo(null);
    }
  };

  const handleShotLayoutChange = (shotId: string, layout: any) => {
    const currentShot = shots.find(s => s.shot_id === shotId);
    if (!currentShot) return;

    const updatedShot = {
      ...currentShot,
      layout: layout || undefined
    };

    // 1. Update state immediately so player renders correctly without waiting for save
    setShots(prevShots => prevShots.map(s => {
      if (s.shot_id === shotId) {
        return updatedShot;
      }
      return s;
    }));

    // 2. Debounce persisting the updated JSON to disk
    if (layoutSaveTimeoutRef.current[shotId]) {
      clearTimeout(layoutSaveTimeoutRef.current[shotId]);
    }

    layoutSaveTimeoutRef.current[shotId] = setTimeout(async () => {
      try {
        const res = await fetch('/api/shots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedShot)
        });
        if (!res.ok) {
          console.error('Failed to persist layout adjustment for', shotId);
        }
      } catch (e) {
        console.error('Error persisting layout adjustment:', e);
      }
      delete layoutSaveTimeoutRef.current[shotId];
    }, 500); // 500ms debounce
  };

  const exportCSV = () => {
    const csvCell = (value: any) => {
      const s = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };

    const headers = ['shot_id', 'duration_s', 'dialogue', 'voiceover', 'video_prompt', 'negative_prompt', 'camera_motion', 'reference_images', 'conditioning_keyframes', 'keyframe_dir'];
    const rows = [headers.join(',')];

    for (const shot of shots) {
      const pkg = shot._video_prompt;
      rows.push([
        shot.shot_id,
        shot.duration_s,
        shot.dialogue?.text || '',
        shot.voiceover?.text || '',
        pkg?.prompt || '',
        pkg?.negative || '',
        pkg?.motion || '',
        pkg?.condition_images || [],
        shot._keyframes || [],
        `assets/renders/${shot.shot_id}/keyframes`
      ].map(csvCell).join(','));
    }

    const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `storyboard-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    const md = [
      '# Video Prompt Storyboard',
      '',
      '每个镜头的视频生成提示词。复制 "Prompt" 和 "Negative" 到视频生成工具，可用 conditioning keyframes 做 img2vid。',
      '',
      `共 ${shots.length} 个镜头。`,
      ''
    ];

    for (const shot of shots) {
      const pkg = shot._video_prompt;
      md.push(
        `## ${shot.shot_id} (${shot.duration_s}s)`,
        '',
        `Camera: ${pkg?.motion || 'N/A'}`,
        '',
        shot.dialogue?.text
          ? `Dialogue: **${shot.dialogue.speaker}**: ${shot.dialogue.text}`
          : '',
        shot.voiceover?.text
          ? `Voiceover: ${shot.voiceover.text}`
          : '',
        '',
        '### Prompt',
        '',
        '```text',
        pkg?.prompt || '',
        '```',
        '',
        '### Negative',
        '',
        '```text',
        pkg?.negative || '',
        '```',
        '',
        pkg?.condition_images?.length
          ? `Conditioning images/keyframes available: ${pkg.condition_images.length} image(s)`
          : `Keyframe dir: \`assets/renders/${shot.shot_id}/keyframes\` (empty)`,
        '',
        '---',
        ''
      );
    }

    const blob = new Blob([md.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `storyboard-${new Date().toISOString().slice(0, 10)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportVideo = async (withSubtitles: boolean) => {
    setShowExportDialog(false);
    setExportingVideo(true);
    setResult(null);
    try {
      const res = await fetch('/api/export/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: exportPreset,
          audioSource: exportAudioSource,
          subtitles: withSubtitles,
          subFontSize: subtitleStyle.fontSize,
          subFontFamily: subtitleStyle.fontFamily,
          subColor: subtitleStyle.textColor,
          subBgOpacity: subtitleStyle.bgOpacity / 100,
          subStrokeWidth: subtitleStyle.strokeWidth
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `film_${new Date().toISOString().slice(0, 10)}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setResult({ success: true, message: '视频导出成功' });
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || '导出失败' });
      }
    } catch {
      setResult({ success: false, message: '导出视频失败' });
    } finally {
      setExportingVideo(false);
    }
  };

  const exportShotHandoff = async (shotId: string) => {
    setExportingShot(shotId);
    try {
      const res = await fetch(`/api/shots/${encodeURIComponent(shotId)}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `handoff_${shotId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || '导出交接包失败' });
      }
    } catch {
      setResult({ success: false, message: '导出交接包失败' });
    } finally {
      setExportingShot(null);
    }
  };

  const syncChipClass = (shot: Shot) => {
    const sync = shot._sync_state;
    if (!sync) return '';
    if (sync.video_prompt_state === 'missing' || sync.image_prompt_state === 'missing') {
      return 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20';
    }
    if (sync.take_prompt_state === 'stale') {
      return 'bg-orange-500/10 text-orange-300 border-orange-500/30 hover:bg-orange-500/20';
    }
    return 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20';
  };

  const shotsWithDialogue = shots.filter(s => s.dialogue);
  const shotsWithVoiceover = shots.filter(s => s.voiceover);
  const shotsWithKeyframes = shots.filter(s => (s._keyframes?.length || 0) > 0);
  const totalDuration = shots.reduce((acc, s) => acc + s.duration_s, 0);

  if (loading) return <div className="p-8 text-slate-400">加载中...</div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-start gap-3 w-full">
        <button
          onClick={loadShots}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white border border-transparent rounded-lg transition text-sm"
        >
          <RefreshCw size={16} />
          刷新
        </button>
        <button
          onClick={exportCSV}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-300 border border-blue-500/20 hover:bg-blue-600/30 rounded-lg transition text-sm"
        >
          <Download size={16} />
          导出 CSV 故事板
        </button>
        <button
          onClick={exportMarkdown}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-300 border border-purple-500/20 hover:bg-purple-600/30 rounded-lg transition text-sm"
        >
          <Download size={16} />
          导出 Markdown 故事板
        </button>
        {systemPrompt && (
          <button
            onClick={() => setShowSystemPrompt(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-600/30 rounded-lg transition text-sm"
          >
            <Sparkles size={16} />
            全局系统提示词
          </button>
        )}
        <button
          onClick={generateTTS}
          disabled={generating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white border border-transparent rounded-lg transition text-sm disabled:opacity-50"
        >
          <Volume2 size={16} />
          {generating ? '生成中...' : '生成全部 TTS'}
        </button>
        <button
          onClick={() => setShowExportDialog(true)}
          disabled={exportingVideo}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white border border-transparent rounded-lg transition text-sm disabled:opacity-50"
        >
          <Film size={16} />
          {exportingVideo ? '合成中...' : '导出 MP4'}
        </button>
        <button
          onClick={triggerInboxFill}
          disabled={runningInbox}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition text-sm disabled:opacity-50"
          title="自动扫描并导入项目 inbox/ 目录下的图片和视频到分镜"
        >
          {runningInbox ? <Loader2 size={16} className="animate-spin" /> : <Inbox size={16} />}
          收件箱导入
        </button>
        <button
          onClick={copyNextPending}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20 rounded-lg transition text-sm"
          title="定位下一个未画的分镜，复制其提示词并滚动到该卡片"
        >
          <Copy size={16} />
          复制下个待画
        </button>
        <button
          onClick={() => loadLintReport(true)}
          disabled={runningLint}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600/20 text-amber-300 border border-amber-500/20 hover:bg-amber-600/30 rounded-lg transition text-sm disabled:opacity-50"
          title="重跑 Lint 检查以发现画面漂移/时长不一致等问题"
        >
          {runningLint ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}
          Lint 检查
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-blue-400">{shots.length}</div>
          <div className="text-sm text-slate-400">总镜头数</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-yellow-400">{shotsWithDialogue.length}</div>
          <div className="text-sm text-slate-400">有对白镜头</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-emerald-400">{shotsWithVoiceover.length}</div>
          <div className="text-sm text-slate-400">有讲解镜头</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-purple-400">
            {shotsWithKeyframes.length}
          </div>
          <div className="text-sm text-slate-400">已回填画面</div>
        </div>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          result.success
            ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800'
            : 'bg-red-900/30 text-red-300 border border-red-800'
        }`}>
          {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {result.message}
        </div>
      )}

      {/* Player */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
          <Play size={18} className="text-blue-400" />
          配音漫画播放器
        </h3>
        <Player shots={shots} subtitleStyle={subtitleStyle} onSubtitleStyleChange={setSubtitleStyle} onShotLayoutChange={handleShotLayoutChange} onCaptured={loadShots} />
      </div>

      {/* Shot List with Switchable Views */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-200">镜头列表</h3>
            <span className="text-xs bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">
              {shots.length} 个镜头
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Multi-select indicator & Select All button for Card View */}
            {viewMode === 'card' && (
              <button
                onClick={toggleSelectAll}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition"
              >
                {isAllSelected ? '取消全选' : '全选'}
              </button>
            )}

            {/* View switcher */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              <button
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  viewMode === 'card'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="卡片看板视图"
              >
                <Grid size={13} />
                卡片
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="表格对齐视图"
              >
                <List size={13} />
                列表
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  viewMode === 'board'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="故事板墙视图"
              >
                <ImageIcon size={13} />
                故事板
              </button>
            </div>
          </div>
        </div>

        {/* View rendering */}
        {viewMode === 'card' ? (
          renderCardView()
        ) : viewMode === 'table' ? (
          renderTableView()
        ) : (
          <StoryboardWall
            shots={shots}
            lintByShot={lintData?.byShot || {}}
            onOpenImage={(shot) => setActiveImageShot(shot)}
            onOpenPrompt={(shot) => setActiveImagePromptShot(shot)}
          />
        )}
      </div>

      {/* Floating Bulk Actions Bar */}
      {renderBulkActionsBar()}

      {/* Help */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
        <strong className="text-slate-300">提示：</strong>
        音频文件保存在 <code className="text-blue-300">assets/audio/</code>，关键帧保存在{' '}
        <code className="text-blue-300">assets/renders/&lt;shot_id&gt;/keyframes/</code>。
        播放器会优先显示每个镜头的第一张关键帧。
      </div>

      {/* Image Preview Modal */}
      {activeImageShot && activeImageShot._keyframes && activeImageShot._keyframes.length > 0 && (
        <ImagePreviewModal
          shot={activeImageShot}
          onClose={() => setActiveImageShot(null)}
          onDelete={async (kfUrl) => {
            await deleteKeyframe(activeImageShot.shot_id, kfUrl);
            setActiveImageShot(null);
          }}
        />
      )}

      {/* Take Compare Modal */}
      {compareModal && (
        <TakeCompareModal
          shot={compareModal.shot}
          takes={compareModal.takes}
          onClose={() => setCompareModal(null)}
          onSetActive={async (takeId) => {
            await handleTakeAction(compareModal.shot.shot_id, takeId, 'set_active');
            setCompareModal(null);
          }}
        />
      )}

      {/* Image Prompt Modal for photo generation */}
      <ImagePromptModal
        shot={activeImagePromptShot}
        onClose={() => setActiveImagePromptShot(null)}
      />

      {/* Prompt Preview Modal (Video) */}
      <VideoPromptModal
        shot={activePromptShot}
        onClose={() => setActivePromptShot(null)}
      />

      {/* 导出确认对话框 */}
      <ExportDialog
        isOpen={showExportDialog}
        shots={shots}
        exportPreset={exportPreset}
        setExportPreset={setExportPreset}
        exportAudioSource={exportAudioSource}
        setExportAudioSource={setExportAudioSource}
        exportWithSubtitles={exportWithSubtitles}
        setExportWithSubtitles={setExportWithSubtitles}
        subtitleStyle={subtitleStyle}
        onClose={() => setShowExportDialog(false)}
        onExport={(withSub) => {
          exportVideo(withSub);
          setShowExportDialog(false);
        }}
      />

      {/* 项目全局系统提示词 */}
      <SystemPromptModal
        isOpen={showSystemPrompt}
        systemPrompt={systemPrompt}
        onClose={() => setShowSystemPrompt(false)}
      />
    </div>
  );
}


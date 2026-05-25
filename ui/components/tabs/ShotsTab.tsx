"use client";

import { useState, useEffect } from 'react';
import { Clapperboard, Plus, Clock, MessageSquare, Camera, Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import ShotDetailPanel, { Shot } from '../ShotDetailPanel';

export default function ShotsTab() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [draftShots, setDraftShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [viewMode, setViewMode] = useState<'final' | 'draft'>('final');

  useEffect(() => {
    loadShots();
  }, []);

  const loadShots = async () => {
    setLoading(true);
    try {
      const [shotsRes, draftsRes] = await Promise.all([
        fetch('/api/shots'),
        fetch('/api/shots/draft')
      ]);
      if (shotsRes.ok) {
        const data = await shotsRes.json();
        setShots(data);
        if (data.length > 0 && !selectedShot) setSelectedShot(data[0]);
      }
      if (draftsRes.ok) {
        setDraftShots(await draftsRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReload = async () => {
    try {
      const [shotsRes, draftsRes] = await Promise.all([
        fetch('/api/shots'),
        fetch('/api/shots/draft')
      ]);
      let updatedShots: Shot[] = [];
      let updatedDrafts: Shot[] = [];
      if (shotsRes.ok) {
        updatedShots = await shotsRes.json();
        setShots(updatedShots);
      }
      if (draftsRes.ok) {
        updatedDrafts = await draftsRes.json();
        setDraftShots(updatedDrafts);
      }
      
      if (selectedShot) {
        const currentList = viewMode === 'final' ? updatedShots : updatedDrafts;
        const found = currentList.find(s => s.shot_id === selectedShot.shot_id);
        if (found) {
          setSelectedShot(found);
        }
      }
    } catch (e) {
      console.error('Error reloading shots:', e);
    }
  };

  const saveShot = async (shot: Shot) => {
    const endpoint = viewMode === 'draft' ? '/api/shots/draft' : '/api/shots';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shot)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || '保存失败');
    }
    await handleReload();
  };

  const promoteToFinal = async (shot: Shot) => {
    const res = await fetch('/api/shots/draft/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shot)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || '移动失败');
    }
    setViewMode('final');
    
    const [shotsRes, draftsRes] = await Promise.all([
      fetch('/api/shots'),
      fetch('/api/shots/draft')
    ]);
    let updatedShots: Shot[] = [];
    let updatedDrafts: Shot[] = [];
    if (shotsRes.ok) {
      updatedShots = await shotsRes.json();
      setShots(updatedShots);
    }
    if (draftsRes.ok) {
      updatedDrafts = await draftsRes.json();
      setDraftShots(updatedDrafts);
    }
    const found = updatedShots.find(s => s.shot_id === shot.shot_id);
    if (found) {
      setSelectedShot(found);
    } else if (updatedShots.length > 0) {
      setSelectedShot(updatedShots[0]);
    }
  };

  const createNewShot = () => {
    const newId = viewMode === 'final'
      ? `S${String(shots.length + 1).padStart(3, '0')}`
      : `D${String(draftShots.length + 1).padStart(3, '0')}`;
    const newShot: Shot = {
      shot_id: newId,
      duration_s: 3,
      scene_ref: '',
      characters: [],
      props: [],
      action: { beats: ['新动作描述'] },
      budget: { tier: 'cheap', max_regen: 1 },
      prompt: { positive: '', negative: '' }
    };
    setSelectedShot(newShot);
  };

  const currentList = viewMode === 'final' ? shots : draftShots;
  const totalDuration = currentList.reduce((acc, s) => acc + s.duration_s, 0);

  if (loading) return <div className="p-8 text-slate-400">加载镜头中...</div>;

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Sidebar - Shot List */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Header with Stats */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Clapperboard size={18} className="text-blue-400" />
              时间线
            </h3>
            <div className="text-xs text-slate-500">
              {currentList.length} 镜头 · {totalDuration}s
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-lg">
            <button
              onClick={() => {
                setViewMode('final');
                setSelectedShot(shots[0] || null);
              }}
              className={`flex-1 py-1.5 text-xs rounded transition ${
                viewMode === 'final'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              正式 ({shots.length})
            </button>
            <button
              onClick={() => {
                setViewMode('draft');
                setSelectedShot(draftShots[0] || null);
              }}
              className={`flex-1 py-1.5 text-xs rounded transition ${
                viewMode === 'draft'
                  ? 'bg-yellow-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              草稿 ({draftShots.length})
            </button>
          </div>
        </div>

        {/* Shot List */}
        <div className="flex-1 overflow-y-auto p-2">
          {currentList.map((shot, idx) => (
            <button
              key={shot.shot_id}
              onClick={() => setSelectedShot(shot)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                selectedShot?.shot_id === shot.shot_id
                  ? 'bg-blue-600/20 border border-blue-500/50'
                  : 'hover:bg-slate-800 border border-transparent'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-mono font-bold text-blue-300">{shot.shot_id}</span>
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                  {shot.duration_s}s
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                {shot.action?.beats?.[0] || '无描述'}
              </div>
              {shot.dialogue && (
                <div className="text-xs text-yellow-400/70 mt-1 flex items-center gap-1">
                  <MessageSquare size={10} />
                  {shot.dialogue.speaker}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-slate-800">
          <button
            onClick={createNewShot}
            className="w-full flex items-center justify-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition"
          >
            <Plus size={16} />
            新建镜头
          </button>
        </div>
      </div>

      {/* Main Content - Shot Detail Panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedShot ? (
          <ShotDetailPanel
            initialShot={selectedShot}
            isDraft={viewMode === 'draft'}
            onSave={saveShot}
            onPromote={promoteToFinal}
            onReload={handleReload}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            选择一个镜头进行编辑
          </div>
        )}
      </div>
    </div>
  );
}



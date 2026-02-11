"use client";

import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ArrowUpCircle, X, Pencil } from 'lucide-react';

interface Shot {
  shot_id: string;
  duration_s: number;
  scene_ref?: string;
  cam_setup_ref?: string;
  action?: { beats?: string[] };
  dialogue?: { text: string; speaker: string; voice_id?: string };
  budget?: { tier?: string; max_regen?: number };
  prompt?: { positive?: string; negative?: string };
  _source?: string;
  _file?: string;
  [key: string]: any;
}

interface ShotEditorProps {
  shotId: string;
  initialShot: Shot;
  onSaved?: () => void;
}

export default function ShotEditor({ shotId, initialShot, onSaved }: ShotEditorProps) {
  const [shot, setShot] = useState<Shot>(initialShot);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Reset if initialShot changes
  useEffect(() => {
    setShot(initialShot);
  }, [initialShot]);

  const updateField = (path: string, value: any) => {
    setShot(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async (promote = false) => {
    setSaving(true);
    setStatus('');
    try {
      const res = await fetch(`/api/shots/${shotId}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot, promote }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(promote ? 'Promoted to finalized!' : 'Saved!');
        if (data.promoted) {
          setShot(prev => ({ ...prev, _source: 'shots' }));
        }
        onSaved?.();
      } else {
        const err = await res.json();
        setStatus(`Error: ${err.error}`);
      }
    } catch {
      setStatus('Network error');
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  // Beat management
  const addBeat = () => {
    const beats = [...(shot.action?.beats || []), ''];
    updateField('action.beats', beats);
  };

  const removeBeat = (idx: number) => {
    const beats = (shot.action?.beats || []).filter((_: string, i: number) => i !== idx);
    updateField('action.beats', beats);
  };

  const updateBeat = (idx: number, value: string) => {
    const beats = [...(shot.action?.beats || [])];
    beats[idx] = value;
    updateField('action.beats', beats);
  };

  const isDraft = shot._source === 'shots_draft';

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-sm"
      >
        <Pencil size={14} />
        Edit Shot
      </button>
    );
  }

  return (
    <div className="bg-slate-950 border border-blue-900/50 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
          <Pencil size={14} />
          Edit {shotId}
          {isDraft && <span className="text-xs text-yellow-400 ml-1">(draft)</span>}
        </h3>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Basic Fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Duration (s)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={shot.duration_s}
              onChange={(e) => updateField('duration_s', Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Scene Ref</label>
            <input
              type="text"
              value={shot.scene_ref || ''}
              onChange={(e) => updateField('scene_ref', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Camera Setup</label>
            <input
              type="text"
              value={shot.cam_setup_ref || ''}
              onChange={(e) => updateField('cam_setup_ref', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Budget Tier</label>
            <select
              value={shot.budget?.tier || 'standard'}
              onChange={(e) => updateField('budget.tier', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="cheap">cheap</option>
              <option value="standard">standard</option>
              <option value="final">final</option>
            </select>
          </div>
        </div>

        {/* Action Beats */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-500">Action Beats</label>
            <button onClick={addBeat} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition">
              <Plus size={12} /> Add Beat
            </button>
          </div>
          <div className="space-y-2">
            {(shot.action?.beats || []).map((beat: string, i: number) => (
              <div key={i} className="flex gap-2">
                <span className="text-xs text-slate-600 pt-2 w-5 text-right shrink-0">{i + 1}</span>
                <input
                  type="text"
                  value={beat}
                  onChange={(e) => updateBeat(i, e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Describe what happens..."
                />
                <button
                  onClick={() => removeBeat(i)}
                  className="p-1.5 hover:bg-red-900/30 rounded text-slate-600 hover:text-red-400 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Dialogue */}
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Dialogue</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                value={shot.dialogue?.speaker || ''}
                onChange={(e) => updateField('dialogue.speaker', e.target.value)}
                placeholder="Speaker ID"
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                value={shot.dialogue?.text || ''}
                onChange={(e) => updateField('dialogue.text', e.target.value)}
                placeholder="Dialogue line..."
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-2">
            <input
              type="text"
              value={shot.dialogue?.voice_id || ''}
              onChange={(e) => updateField('dialogue.voice_id', e.target.value)}
              placeholder="Voice ID (e.g. en-US-GuyNeural)"
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Prompt</label>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-emerald-500">Positive</span>
              <textarea
                value={shot.prompt?.positive || ''}
                onChange={(e) => updateField('prompt.positive', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500 h-16 resize-none mt-1"
                placeholder="Positive prompt keywords..."
              />
            </div>
            <div>
              <span className="text-xs text-red-500">Negative</span>
              <textarea
                value={shot.prompt?.negative || ''}
                onChange={(e) => updateField('prompt.negative', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500 h-16 resize-none mt-1"
                placeholder="Negative prompt keywords..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm rounded transition"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>

          {isDraft && (
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-sm rounded transition"
            >
              <ArrowUpCircle size={14} />
              Promote to Finalized
            </button>
          )}

          {status && (
            <span className={`text-sm ${status.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

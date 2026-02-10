"use client";

import { useState } from 'react';
import { Star, Tag, Send } from 'lucide-react';

interface Take {
  take_id: string;
  status: string;
  review?: {
    rating?: number;
    tags?: string[];
    notes?: string;
  };
}

interface ReviewPanelProps {
  shotId: string;
  takes: Take[];
}

const PRESET_TAGS = [
  'approved',
  'bad_hands',
  'bad_face',
  'lighting_mismatch',
  'outfit_drift',
  'prop_missing',
  'composition_off',
  'motion_artifact',
  'needs_fixup',
];

export default function ReviewPanel({ shotId, takes }: ReviewPanelProps) {
  const [selectedTake, setSelectedTake] = useState(takes[0]?.take_id || '');
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!selectedTake) return;
    setSubmitting(true);
    setStatus('');

    try {
      const res = await fetch(`/api/shots/${shotId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          take_id: selectedTake,
          rating: rating || undefined,
          tags: selectedTags,
          notes: notes || undefined,
        }),
      });

      if (res.ok) {
        setStatus('Review saved!');
        setTimeout(() => setStatus(''), 3000);
      } else {
        const err = await res.json();
        setStatus(`Error: ${err.error}`);
      }
    } catch {
      setStatus('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-blue-900/50 rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
        <Tag size={14} />
        Add Review
      </h3>

      {/* Take Selector */}
      <div className="mb-3">
        <label className="text-xs text-slate-500 mb-1 block">Select Take</label>
        <select
          value={selectedTake}
          onChange={(e) => setSelectedTake(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
        >
          {takes.map(t => (
            <option key={t.take_id} value={t.take_id}>{t.take_id} ({t.status})</option>
          ))}
        </select>
      </div>

      {/* Star Rating */}
      <div className="mb-3">
        <label className="text-xs text-slate-500 mb-1 block">Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star === rating ? 0 : star)}
              className={`text-xl transition ${star <= rating ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}
            >
              <Star size={20} fill={star <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-xs text-slate-500 ml-2 self-center">{rating}/5</span>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="mb-3">
        <label className="text-xs text-slate-500 mb-1 block">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagToggle(tag)}
              className={`text-xs px-2 py-1 rounded border transition ${
                selectedTags.includes(tag)
                  ? tag === 'approved'
                    ? 'bg-emerald-900/50 text-emerald-300 border-emerald-600'
                    : 'bg-blue-900/50 text-blue-300 border-blue-600'
                  : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-slate-500'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-3">
        <label className="text-xs text-slate-500 mb-1 block">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional review notes..."
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500 h-16 resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedTake}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded transition"
        >
          <Send size={14} />
          {submitting ? 'Saving...' : 'Submit Review'}
        </button>
        {status && (
          <span className={`text-sm ${status.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}

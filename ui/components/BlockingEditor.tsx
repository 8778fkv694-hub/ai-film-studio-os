'use client';

import { useRef, useState, useEffect } from 'react';
import { Loader2, RefreshCw, Plus, Trash2 } from 'lucide-react';
// Reuse the engine's real FOV math so the canvas cone matches the actual lens.
import { cameraHFov } from '../../tools/scripts/shared/blocking.js';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const HEIGHTS = ['', 'low', 'eye_level', 'high', 'overhead'];
const SHOT_SIZES = ['', 'wide', 'medium', 'close', 'ecu'];
const DOFS = ['', 'shallow', 'normal', 'deep'];
const PALETTE = ['#2563eb', '#16a34a', '#db2777', '#ca8a04', '#0891b2', '#9333ea'];
const MODES: { key: 'lock' | 'guide' | 'off'; label: string; hint: string }[] = [
  { key: 'lock', label: '锁定', hint: '强制 AI 严格按此布局 + 灰模首帧' },
  { key: 'guide', label: '建议', hint: '作为建议，AI 可为更好构图调整（默认）' },
  { key: 'off', label: '自由', hint: '不注入空间约束，AI 自由补全' }
];

export interface BlockingEntity {
  ref: string; x: number; y: number;
  facing?: string; gaze_target?: string; layer?: string;
}
export interface BlockingCamera {
  x: number; y: number; facing?: string;
  lens?: string; height?: string; shot_size?: string; tilt?: number; dof?: string;
}
export interface BlockingData {
  grid?: string;
  mode?: 'lock' | 'guide' | 'off';
  camera?: BlockingCamera;
  entities?: BlockingEntity[];
  motion?: any[];
  axis_lock?: string;
  floorplan_ref?: string;
}

interface Props {
  shotId: string;
  characters: { ref: string }[];
  props: { ref: string; state?: string }[];
  value?: BlockingData;
  onChange: (b: BlockingData) => void;
}

const shortLabel = (ref: string) =>
  String(ref || '').replace(/^(prop|fixture):/, '').replace(/\.json$/, '').split('/').pop() || ref;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export default function BlockingEditor({ shotId, characters, props, value, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ kind: 'entity' | 'camera'; idx: number } | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const b: BlockingData = value || {};
  const entities = b.entities || [];
  const camera = b.camera;

  const update = (patch: Partial<BlockingData>) => onChange({ ...b, ...patch });
  const updateEntity = (i: number, patch: Partial<BlockingEntity>) =>
    update({ entities: entities.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const updateCamera = (patch: Partial<BlockingCamera>) =>
    update({ camera: { x: 50, y: 90, facing: 'N', ...camera, ...patch } });

  const seedFromRefs = () => {
    const refs = [
      ...characters.map(c => c.ref),
      ...props.map(p => p.ref)
    ].filter(Boolean);
    const seeded: BlockingEntity[] = refs.map((ref, i) => ({
      ref,
      x: 30 + (i * 18) % 50,
      y: 45 + (i % 2) * 12,
      facing: 'S'
    }));
    update({
      entities: seeded,
      camera: camera || { x: 50, y: 92, facing: 'N', lens: '35mm', height: 'eye_level', shot_size: 'medium' }
    });
  };

  const addEntity = () =>
    update({ entities: [...entities, { ref: '', x: 50, y: 50, facing: 'S' }] });
  const removeEntity = (i: number) =>
    update({ entities: entities.filter((_, idx) => idx !== i) });

  const toPlane = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: clamp(((clientX - r.left) / r.width) * 100), y: clamp(((clientY - r.top) / r.height) * 100) };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toPlane(e.clientX, e.clientY);
    if (drag.kind === 'camera') updateCamera({ x: p.x, y: p.y });
    else updateEntity(drag.idx, { x: p.x, y: p.y });
  };

  const refreshPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/blocking/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotId, blocking: b })
      });
      setPreview(await res.json());
    } catch {
      setPreview({ error: '预览失败' });
    } finally {
      setLoading(false);
    }
  };

  const gazeOptions = (selfRef: string) =>
    ['', 'camera', ...entities.map(e => e.ref).filter(r => r && r !== selfRef)];

  // facing -> degrees for arrow drawing (0=N clockwise)
  const facingDeg = (f?: string) => {
    if (!f) return null;
    const i = COMPASS.indexOf(f);
    return i >= 0 ? i * 45 : (Number(f) || 0);
  };

  // Auto-refresh preview (debounced) whenever the blocking changes — no manual click needed.
  const blockingKey = JSON.stringify(b);
  useEffect(() => {
    if (!entities.length) return;
    const t = setTimeout(() => { refreshPreview(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockingKey]);

  if (!entities.length && !camera) {
    return (
      <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl space-y-3">
        <p className="text-sm text-slate-400">本镜尚无空间调度数据。</p>
        <button
          onClick={seedFromRefs}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold"
        >
          从角色/道具初始化调度
        </button>
        <p className="text-[11px] text-slate-500">将根据本镜的角色与道具自动摆放，再拖拽调整。</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
      {/* LEFT: top-down draggable canvas */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-200">🗺️ 俯视调度（拖拽摆位）</h3>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 select-none">
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            className="w-full aspect-square touch-none max-w-[560px] mx-auto"
            onPointerMove={onPointerMove}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
          >
            <rect x="0" y="0" width="100" height="100" fill="#0b1220" />
            {[20, 40, 60, 80].map(g => (
              <g key={g}>
                <line x1={g} y1="0" x2={g} y2="100" stroke="#1e293b" strokeWidth="0.4" />
                <line x1="0" y1={g} x2="100" y2={g} stroke="#1e293b" strokeWidth="0.4" />
              </g>
            ))}
            <text x="50" y="5" fill="#475569" fontSize="3.4" textAnchor="middle">back (far)</text>
            <text x="50" y="98" fill="#475569" fontSize="3.4" textAnchor="middle">front (near) · camera side</text>

            {/* camera FOV cone */}
            {camera && facingDeg(camera.facing) !== null && (() => {
              const th = (facingDeg(camera.facing)! * Math.PI) / 180;
              const half = (cameraHFov(camera) * Math.PI) / 360; // real half-FOV from lens/shot_size
              const L = 80;
              const r1 = { x: camera.x + Math.sin(th - half) * L, y: camera.y - Math.cos(th - half) * L };
              const r2 = { x: camera.x + Math.sin(th + half) * L, y: camera.y - Math.cos(th + half) * L };
              return (
                <polygon
                  points={`${camera.x},${camera.y} ${r1.x},${r1.y} ${r2.x},${r2.y}`}
                  fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeWidth="0.3" strokeDasharray="1.5 1"
                />
              );
            })()}

            {/* entities */}
            {entities.map((e, i) => {
              const c = PALETTE[i % PALETTE.length];
              const deg = facingDeg(e.facing);
              return (
                <g key={i}>
                  {deg !== null && (
                    <line
                      x1={e.x} y1={e.y}
                      x2={e.x + Math.sin((deg * Math.PI) / 180) * 6}
                      y2={e.y - Math.cos((deg * Math.PI) / 180) * 6}
                      stroke={c} strokeWidth="1"
                    />
                  )}
                  <circle
                    cx={e.x} cy={e.y} r="2.6" fill={c} stroke="#e2e8f0" strokeWidth="0.4"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(ev) => { setDrag({ kind: 'entity', idx: i }); try { (ev.target as Element).setPointerCapture?.(ev.pointerId); } catch {} }}
                  />
                  <text x={e.x} y={e.y + 5.5} fill="#cbd5e1" fontSize="3" textAnchor="middle">{shortLabel(e.ref)}</text>
                </g>
              );
            })}

            {/* camera marker */}
            {camera && (
              <g>
                <circle
                  cx={camera.x} cy={camera.y} r="3" fill="#b45309" stroke="#fcd34d" strokeWidth="0.5"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(ev) => { setDrag({ kind: 'camera', idx: -1 }); try { (ev.target as Element).setPointerCapture?.(ev.pointerId); } catch {} }}
                />
                <text x={camera.x} y={camera.y - 4} fill="#fbbf24" fontSize="3" textAnchor="middle">CAM</text>
              </g>
            )}
          </svg>
        </div>
        <button
          onClick={refreshPreview}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-sm font-semibold"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          刷新预览（空间从句 + 灰模图）
        </button>

        {preview && !preview.error && (
          <div className="space-y-2 text-xs">
            {preview.spaceClause && <p className="text-slate-300"><span className="text-slate-500">空间：</span>{preview.spaceClause}</p>}
            {preview.cameraClause && <p className="text-slate-300"><span className="text-slate-500">相机：</span>{preview.cameraClause}</p>}
            {preview.motionClause && <p className="text-slate-300"><span className="text-slate-500">运动：</span>{preview.motionClause}</p>}
            {preview.mode === 'off' ? (
              <p className="text-emerald-400 border border-emerald-900/50 bg-emerald-950/20 rounded px-2 py-1">自由模式：不向 AI 注入任何空间约束，由 AI 自由补全（上方为你的布局参考，仅供你看）。</p>
            ) : preview.injected?.space && (
              <p className="text-sky-300 border border-sky-900/50 bg-sky-950/20 rounded px-2 py-1">
                <span className="text-slate-500">实际注入 AI（{preview.mode === 'lock' ? '锁定' : '建议'}）：</span>{preview.injected.space}
              </p>
            )}
            {Array.isArray(preview.warnings) && preview.warnings.length > 0 && (
              <p className="text-amber-400">⚠ {preview.warnings.join('；')}</p>
            )}
            {preview.grayboxSvg && (
              <div>
                <p className="text-slate-500 mb-1">灰模脚手架首帧（给视频AI看）：</p>
                <img
                  alt="graybox"
                  className="w-full rounded-lg border border-slate-800"
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(preview.grayboxSvg)}`}
                />
              </div>
            )}
          </div>
        )}
        {preview?.error && <p className="text-xs text-red-400">{preview.error}</p>}
      </div>

      {/* RIGHT: numeric / select controls */}
      <div className="space-y-4">
        {/* Spatial freedom mode */}
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
          <h3 className="text-sm font-bold text-slate-200">🎚️ 空间自由度（注入 AI 的方式）</h3>
          <div className="flex gap-1.5">
            {MODES.map(m => {
              const active = (b.mode || 'guide') === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => update({ mode: m.key })}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold transition ${active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">{MODES.find(m => m.key === (b.mode || 'guide'))?.hint}</p>
        </div>

        {/* Camera */}
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
          <h3 className="text-sm font-bold text-amber-300">🎥 摄影机</h3>
          {!camera ? (
            <button onClick={() => updateCamera({})} className="text-xs px-3 py-1.5 bg-amber-700/60 hover:bg-amber-600 text-white rounded">
              添加摄影机
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="space-y-0.5"><span className="text-slate-500">朝向</span>
                <select value={camera.facing || 'N'} onChange={e => updateCamera({ facing: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200">
                  {COMPASS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="space-y-0.5"><span className="text-slate-500">焦段(lens)</span>
                <input value={camera.lens || ''} placeholder="35mm" onChange={e => updateCamera({ lens: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200" />
              </label>
              <label className="space-y-0.5"><span className="text-slate-500">机位高度</span>
                <select value={camera.height || ''} onChange={e => updateCamera({ height: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200">
                  {HEIGHTS.map(h => <option key={h} value={h}>{h || '—'}</option>)}
                </select>
              </label>
              <label className="space-y-0.5"><span className="text-slate-500">景别</span>
                <select value={camera.shot_size || ''} onChange={e => updateCamera({ shot_size: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200">
                  {SHOT_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                </select>
              </label>
              <label className="space-y-0.5"><span className="text-slate-500">俯仰(tilt°)</span>
                <input type="number" value={camera.tilt ?? ''} onChange={e => updateCamera({ tilt: e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200" />
              </label>
              <label className="space-y-0.5"><span className="text-slate-500">景深(dof)</span>
                <select value={camera.dof || ''} onChange={e => updateCamera({ dof: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200">
                  {DOFS.map(d => <option key={d} value={d}>{d || '—'}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Entities */}
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">🎭 实体（角色 / 道具）</h3>
            <button onClick={addEntity} className="text-xs flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"><Plus size={12} />添加</button>
          </div>
          {entities.length === 0 && (
            <button onClick={seedFromRefs} className="text-xs px-3 py-1.5 bg-blue-700/60 hover:bg-blue-600 text-white rounded">从角色/道具初始化</button>
          )}
          {entities.map((e, i) => (
            <div key={i} className="border border-slate-850 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                <input
                  value={e.ref} placeholder="characters/x.json 或 prop:id"
                  onChange={ev => updateEntity(i, { ref: ev.target.value })}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                />
                <button onClick={() => removeEntity(i)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={13} /></button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="space-y-0.5"><span className="text-slate-500">朝向</span>
                  <select value={e.facing || 'S'} onChange={ev => updateEntity(i, { facing: ev.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200">
                    {COMPASS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="space-y-0.5 col-span-2"><span className="text-slate-500">看向(gaze)</span>
                  <select value={e.gaze_target || ''} onChange={ev => updateEntity(i, { gaze_target: ev.target.value || undefined })} className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200">
                    {gazeOptions(e.ref).map(g => <option key={g} value={g}>{g === '' ? '—' : g === 'camera' ? '镜头' : shortLabel(g)}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-[10px] text-slate-600">x:{e.x} y:{e.y}（拖拽左侧圆点调整）</p>
            </div>
          ))}
        </div>

        {/* axis lock */}
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-1.5">
          <h3 className="text-sm font-bold text-slate-200">🧭 轴线（180° 校验）</h3>
          <input
            value={b.axis_lock || ''} placeholder="如 inspector-station（两个实体token，用-分隔）"
            onChange={e => update({ axis_lock: e.target.value || undefined })}
            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
          />
          <p className="text-[10px] text-slate-600">填了之后，相邻镜越过此轴线时 Lint 会警告屏幕左右翻转。</p>
        </div>
      </div>
    </div>
  );
}

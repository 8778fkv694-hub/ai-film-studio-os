/**
 * blocking.js — Spatial staging geometry engine.
 *
 * Pure, dependency-free. Turns a shot's top-down `blocking` data into:
 *   - a natural-language spatial clause (who stands where, facing what, fore/back)
 *   - a camera/lens clause (focal length, height, tilt, roll, depth of field)
 *   - a motion clause (video stage)
 *   - visibility info (which entities fall inside the camera frustum)
 *
 * Coordinate system: a 0-100 normalized TOP-DOWN plane.
 *   x: 0 = left (west), 100 = right (east)
 *   y: 0 = far/back (north), 100 = near/front (south)
 * Facing/compass angles: 0 = North (toward -y / up the plan), clockwise.
 *   forward(theta) = (sin theta, -cos theta)   // N=(0,-1) E=(1,0) S=(0,1) W=(-1,0)
 *   screen-right(theta) = (cos theta, sin theta)
 *
 * NOTE: the AI is not a real lens — projection here is intentionally coarse
 * (left/center/right, foreground/midground/background). Do not chase pixel
 * precision; the strong constraint is the keyframe, this only guides wording.
 */

const COMPASS = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
};

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }

/** Resolve a compass string or numeric facing to degrees (0=N, clockwise). null if absent. */
function facingToDeg(facing) {
  if (facing === undefined || facing === null || facing === '') return null;
  if (typeof facing === 'number') return ((facing % 360) + 360) % 360;
  const key = String(facing).trim().toUpperCase();
  if (key in COMPASS) return COMPASS[key];
  const n = Number(key);
  return Number.isFinite(n) ? ((n % 360) + 360) % 360 : null;
}

/** Parse "35mm" / "35" / "35 mm" -> 35 (Number) or null. */
function parseFocal(lens) {
  if (lens === undefined || lens === null) return null;
  const m = String(lens).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** Horizontal field of view (degrees) from focal length on a full-frame (36mm) sensor. */
function hFovFromFocal(focal) {
  return toDeg(2 * Math.atan(36 / (2 * focal)));
}

/** Fallback FOV from shot_size when no lens given. */
function fovFromShotSize(shotSize) {
  const s = String(shotSize || '').toLowerCase();
  if (/wide|establish|long|ws|els/.test(s)) return 65;
  if (/close|cu|ecu|detail/.test(s)) return 28;
  return 45; // medium / default
}

function cameraHFov(camera) {
  const focal = parseFocal(camera.lens);
  if (focal) return hFovFromFocal(focal);
  return fovFromShotSize(camera.shot_size);
}

/**
 * Project a single entity into camera space.
 * Returns { depth, lateral, angleH, screenX, onscreen, ratio } or null if no camera facing.
 */
function projectEntity(entity, camera, hFov) {
  const camDeg = facingToDeg(camera.facing);
  if (camDeg === null) return null;
  const theta = toRad(camDeg);
  const fwd = { x: Math.sin(theta), y: -Math.cos(theta) };
  const right = { x: Math.cos(theta), y: Math.sin(theta) };

  const dx = entity.x - camera.x;
  const dy = entity.y - camera.y;
  const depth = dx * fwd.x + dy * fwd.y;     // + = in front of camera
  const lateral = dx * right.x + dy * right.y; // + = screen right

  if (depth <= 0.0001) {
    return { depth, lateral, angleH: 180, screenX: null, onscreen: false, ratio: Infinity };
  }
  const angleH = toDeg(Math.atan2(lateral, depth));
  const ratio = angleH / (hFov / 2);
  const onscreen = Math.abs(ratio) <= 1;
  const screenX = onscreen ? 50 + ratio * 50 : null;
  return { depth, lateral, angleH, screenX, onscreen, ratio };
}

function horizBucket(screenX) {
  if (screenX === null) return null;
  if (screenX < 33) return 'left';
  if (screenX > 67) return 'right';
  return 'center';
}

/** Assign foreground/midground/background by depth rank among the visible set. */
function depthBuckets(visible) {
  const sorted = [...visible].sort((a, b) => a.proj.depth - b.proj.depth);
  const n = sorted.length;
  sorted.forEach((v, i) => {
    if (v.entity.layer) { v.depthBucket = v.entity.layer; return; }
    if (n === 1) { v.depthBucket = 'midground'; return; }
    const frac = i / (n - 1);
    v.depthBucket = frac < 0.34 ? 'foreground' : frac > 0.66 ? 'background' : 'midground';
  });
}

/** How an entity is oriented relative to the camera. */
function facingRelToCamera(entity, camera, proj) {
  const eDeg = facingToDeg(entity.facing);
  if (eDeg === null) return null;
  const phi = toRad(eDeg);
  const fwd = { x: Math.sin(phi), y: -Math.cos(phi) };
  const toCamX = camera.x - entity.x;
  const toCamY = camera.y - entity.y;
  const len = Math.hypot(toCamX, toCamY) || 1;
  const d = (fwd.x * toCamX + fwd.y * toCamY) / len;
  if (d > 0.5) return 'facing the camera';
  if (d < -0.5) return 'back to the camera';
  // in profile — which screen side are they facing?
  return proj && proj.lateral >= 0
    ? 'in profile facing screen-left'
    : 'in profile facing screen-right';
}

/** Camera height -> phrase. */
function heightPhrase(height) {
  switch (String(height || '').toLowerCase()) {
    case 'low': return 'low camera height';
    case 'high': return 'high camera height';
    case 'overhead': return 'overhead top-down view';
    case 'eye_level': return 'eye-level camera';
    default: return '';
  }
}

function lensPhrase(camera) {
  const out = [];
  const focal = parseFocal(camera.lens);
  if (focal) {
    if (focal < 28) out.push(`wide-angle ${focal}mm lens, expansive spatial perspective`);
    else if (focal <= 50) out.push(`${focal}mm lens, natural spatial perspective`);
    else if (focal <= 85) out.push(`${focal}mm lens, mild perspective compression`);
    else out.push(`${focal}mm telephoto lens, compressed flattened depth, subject isolation`);
  }
  const h = heightPhrase(camera.height);
  if (h) out.push(h);
  if (typeof camera.tilt === 'number' && camera.tilt !== 0) {
    out.push(camera.tilt > 0 ? 'low-angle shot looking up' : 'high-angle shot looking down');
  }
  if (typeof camera.roll === 'number' && camera.roll !== 0) {
    out.push(`dutch angle (${camera.roll}deg roll)`);
  }
  const dof = String(camera.dof || '').toLowerCase();
  if (dof === 'shallow') out.push('shallow depth of field, blurred background');
  else if (dof === 'deep') out.push('deep focus, everything sharp');
  return out.join(', ');
}

/** Default human label for an entity ref when no labelFor is provided. */
function defaultLabel(ref) {
  if (!ref) return 'subject';
  let s = String(ref);
  s = s.replace(/^(prop|fixture):/, '');
  s = s.replace(/\.json$/, '');
  s = s.split('/').pop();
  return s;
}

/**
 * Compile a shot's blocking into clauses + visibility.
 *
 * @param {object} blocking - shot.blocking
 * @param {object} [opts]
 * @param {(ref:string)=>string} [opts.labelFor] - resolve an entity ref to a display label
 * @param {Array}  [opts.fixtures] - scene floorplan fixtures [{id,x,y,label,facing}]
 * @returns {{
 *   ok: boolean,
 *   spaceClause: string,
 *   cameraClause: string,
 *   motionClause: string,
 *   visibleEntities: Array,
 *   offscreenLabels: string[],
 *   warnings: string[]
 * }}
 */
export const BLOCKING_MODES = ['lock', 'guide', 'off'];

/** Resolve the enforcement mode (opts.mode overrides blocking.mode; default 'guide'). */
function resolveMode(blocking, opts) {
  const m = opts.mode || blocking?.mode || 'guide';
  return BLOCKING_MODES.includes(m) ? m : 'guide';
}

/**
 * Shape the raw clauses into what actually gets injected into a prompt, per mode.
 *   lock  -> hard constraint wording
 *   guide -> soft suggestion wording
 *   off   -> nothing (AI composes freely)
 */
function shapeForMode(mode, { space, camera, motion }) {
  if (mode === 'off') return { space: '', camera: '', motion: '', scaffold: false };
  const lead = mode === 'lock'
    ? 'Spatial layout (follow exactly)'
    : 'Suggested spatial layout (adjust freely for the best composition)';
  return {
    space: space ? `${lead}: ${space.replace(/^Spatial layout:?\s*/i, '')}` : '',
    camera: camera ? `camera: ${camera}` : '',
    motion: motion || '',
    scaffold: mode !== 'off'
  };
}

export function compileBlocking(blocking, opts = {}) {
  const warnings = [];
  const labelFor = opts.labelFor || defaultLabel;
  const mode = resolveMode(blocking, opts);
  const empty = {
    ok: false, mode, spaceClause: '', cameraClause: '', motionClause: '',
    inject: { space: '', camera: '', motion: '', scaffold: false },
    visibleEntities: [], offscreenLabels: [], warnings
  };
  if (!blocking || typeof blocking !== 'object') return empty;

  const camera = blocking.camera || {};
  const cameraClause = lensPhrase(camera);

  // Merge declared entities with scene fixtures (fixtures get a synthetic ref/label).
  const rawEntities = [
    ...(blocking.entities || []),
    ...((opts.fixtures || []).map(f => ({
      ref: `fixture:${f.id}`, x: f.x, y: f.y, facing: f.facing, _label: f.label || f.id
    })))
  ].filter(e => typeof e.x === 'number' && typeof e.y === 'number');

  const hasCameraPos = typeof camera.x === 'number' && typeof camera.y === 'number'
    && facingToDeg(camera.facing) !== null;

  // --- No usable camera: fall back to world-relative description ---
  if (!hasCameraPos) {
    if (rawEntities.length) {
      warnings.push('blocking.camera missing position/facing; using world-relative layout (no screen left/right)');
    }
    const parts = rawEntities.map(e => {
      const label = e._label || labelFor(e.ref);
      const h = e.x < 33 ? 'left' : e.x > 67 ? 'right' : 'center';
      const d = e.y < 33 ? 'back' : e.y > 67 ? 'front' : 'middle';
      return `${label} at ${d}-${h} of the set`;
    });
    const spaceClause = parts.length ? `Spatial layout: ${parts.join('; ')}` : '';
    const motionClause = toMotionClause(blocking, labelFor);
    return {
      ok: parts.length > 0,
      mode,
      spaceClause,
      cameraClause,
      motionClause,
      inject: shapeForMode(mode, { space: spaceClause, camera: cameraClause, motion: motionClause }),
      visibleEntities: [],
      offscreenLabels: [],
      warnings
    };
  }

  // --- Full projection ---
  const hFov = cameraHFov(camera);
  const projected = rawEntities.map(e => ({
    entity: e,
    label: e._label || labelFor(e.ref),
    proj: projectEntity(e, camera, hFov)
  })).filter(p => p.proj);

  const visible = projected.filter(p => p.proj.onscreen);
  const offscreen = projected.filter(p => !p.proj.onscreen);
  depthBuckets(visible);

  // nearest first reads most naturally
  const ordered = [...visible].sort((a, b) => a.proj.depth - b.proj.depth);

  const parts = ordered.map(v => {
    const hb = horizBucket(v.proj.screenX);
    const place = `${v.depthBucket}${hb ? '-' + hb : ''}`;
    const facing = facingRelToCamera(v.entity, camera, v.proj);
    let gaze = '';
    if (v.entity.gaze_target) {
      const g = v.entity.gaze_target === 'camera' ? 'the camera' : labelFor(v.entity.gaze_target);
      gaze = `, looking at ${g}`;
    }
    return `${v.label} in the ${place}${facing ? ', ' + facing : ''}${gaze}`;
  });

  const offscreenLabels = offscreen.map(v => v.label);
  const spaceParts = [];
  if (parts.length) spaceParts.push(`Spatial layout: ${parts.join('; ')}`);
  if (offscreenLabels.length) spaceParts.push(`Out of frame: ${offscreenLabels.join(', ')}`);

  const spaceClause = spaceParts.join('. ');
  const motionClause = toMotionClause(blocking, labelFor);
  return {
    ok: parts.length > 0,
    mode,
    spaceClause,
    cameraClause,
    motionClause,
    inject: shapeForMode(mode, { space: spaceClause, camera: cameraClause, motion: motionClause }),
    visibleEntities: ordered.map(v => ({
      ref: v.entity.ref,
      label: v.label,
      screen_x: v.proj.screenX !== null ? Math.round(v.proj.screenX) : null,
      depth: v.depthBucket,
      facing: facingRelToCamera(v.entity, camera, v.proj)
    })),
    offscreenLabels,
    warnings
  };
}

/** Turn motion[] commands into a sentence (video stage; harmless for image). */
export function toMotionClause(blocking, labelFor = defaultLabel) {
  const steps = (blocking && blocking.motion) || [];
  if (!steps.length) return '';
  const phrases = steps.map(s => {
    const who = s.who === 'camera' ? 'camera' : labelFor(s.who);
    const tgt = s.target ? (s.target === 'camera' ? 'the camera' : labelFor(s.target)) : '';
    switch (s.verb) {
      case 'walk_to': return `${who} walks across the space`;
      case 'turn_to': return `${who} turns to ${tgt || 'face a new direction'}`;
      case 'track': return `camera tracks ${tgt || who}`;
      case 'push_in': return 'camera pushes in';
      case 'pull_out': return 'camera pulls out';
      case 'pan_to': return `camera pans to ${tgt || 'a new subject'}`;
      case 'hold': return 'camera holds static';
      default: return '';
    }
  }).filter(Boolean);
  return phrases.length ? `Motion: ${phrases.join('; ')}` : '';
}

// ----------------------------------------------------------------------------
// Geometry helpers for cross-shot continuity lint (180deg / 30deg / teleport)
// ----------------------------------------------------------------------------

/** Sign of which side of line a->b the point p lies on (+1 / 0 / -1). */
export function sideOfLine(p, a, b) {
  return Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
}

/** Angle (degrees) subtended at `pivot` between points p1 and p2. */
export function angleAtPivot(pivot, p1, p2) {
  const v1 = { x: p1.x - pivot.x, y: p1.y - pivot.y };
  const v2 = { x: p2.x - pivot.x, y: p2.y - pivot.y };
  const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
  if (!m1 || !m2) return 0;
  const c = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (m1 * m2)));
  return toDeg(Math.acos(c));
}

export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export { facingToDeg, cameraHFov };

// ----------------------------------------------------------------------------
// Top-down blueprint SVG (for humans / review — NEVER fed to the AI)
// ----------------------------------------------------------------------------

const PALETTE = ['#2563eb', '#16a34a', '#db2777', '#ca8a04', '#0891b2', '#9333ea'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render a top-down blocking diagram as an SVG string.
 * World 0-100 plane -> SVG canvas. y=0 (far/back) at top.
 */
export function renderBlueprintSVG(blocking, opts = {}) {
  const labelFor = opts.labelFor || defaultLabel;
  const title = opts.title || '';
  const S = 460, PAD = 40, W = S - PAD * 2;
  const px = x => PAD + (x / 100) * W;
  const py = y => PAD + (y / 100) * W;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S + 24}" viewBox="0 0 ${S} ${S + 24}" font-family="sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${S}" height="${S + 24}" fill="#f8fafc"/>`);
  // grid
  for (let i = 0; i <= 5; i++) {
    const g = PAD + (i / 5) * W;
    parts.push(`<line x1="${g}" y1="${PAD}" x2="${g}" y2="${PAD + W}" stroke="#e2e8f0" stroke-width="1"/>`);
    parts.push(`<line x1="${PAD}" y1="${g}" x2="${PAD + W}" y2="${g}" stroke="#e2e8f0" stroke-width="1"/>`);
  }
  parts.push(`<rect x="${PAD}" y="${PAD}" width="${W}" height="${W}" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`);
  // edge labels
  parts.push(`<text x="${PAD + W / 2}" y="${PAD - 14}" font-size="11" fill="#64748b" text-anchor="middle">back (far) ↑</text>`);
  parts.push(`<text x="${PAD + W / 2}" y="${PAD + W + 22}" font-size="11" fill="#64748b" text-anchor="middle">front (near) ↓ — camera side</text>`);
  parts.push(`<text x="${PAD - 12}" y="${PAD + W / 2}" font-size="11" fill="#64748b" text-anchor="middle" transform="rotate(-90 ${PAD - 12} ${PAD + W / 2})">left ← → right</text>`);

  // fixtures (gray squares)
  for (const f of opts.fixtures || []) {
    if (typeof f.x !== 'number') continue;
    parts.push(`<rect x="${px(f.x) - 6}" y="${py(f.y) - 6}" width="12" height="12" fill="#cbd5e1" stroke="#64748b"/>`);
    parts.push(`<text x="${px(f.x)}" y="${py(f.y) - 10}" font-size="10" fill="#475569" text-anchor="middle">${esc(f.label || f.id)}</text>`);
  }

  // entities (colored dots + facing arrow + label)
  (blocking.entities || []).forEach((e, i) => {
    if (typeof e.x !== 'number') return;
    const c = PALETTE[i % PALETTE.length];
    const cx = px(e.x), cy = py(e.y);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="8" fill="${c}" fill-opacity="0.85" stroke="#1e293b"/>`);
    const deg = facingToDeg(e.facing);
    if (deg !== null) {
      const th = toRad(deg);
      const ax = cx + Math.sin(th) * 22, ay = cy - Math.cos(th) * 22;
      parts.push(`<line x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}" stroke="${c}" stroke-width="2.5"/>`);
      parts.push(`<circle cx="${ax}" cy="${ay}" r="3" fill="${c}"/>`);
    }
    parts.push(`<text x="${cx}" y="${cy + 22}" font-size="11" fill="#0f172a" text-anchor="middle">${esc(labelFor(e.ref))}</text>`);
  });

  // camera (triangle + FOV cone)
  const cam = blocking.camera || {};
  if (typeof cam.x === 'number' && typeof cam.y === 'number' && facingToDeg(cam.facing) !== null) {
    const cx = px(cam.x), cy = py(cam.y);
    const deg = facingToDeg(cam.facing), th = toRad(deg);
    const half = toRad(cameraHFov(cam) / 2);
    const L = W * 0.9;
    const r1 = { x: cx + Math.sin(th - half) * L, y: cy - Math.cos(th - half) * L };
    const r2 = { x: cx + Math.sin(th + half) * L, y: cy - Math.cos(th + half) * L };
    parts.push(`<polygon points="${cx},${cy} ${r1.x},${r1.y} ${r2.x},${r2.y}" fill="#f59e0b" fill-opacity="0.12" stroke="#f59e0b" stroke-dasharray="4 3"/>`);
    parts.push(`<polygon points="${cx},${cy - 9} ${cx - 7},${cy + 6} ${cx + 7},${cy + 6}" fill="#b45309" stroke="#78350f" transform="rotate(${deg} ${cx} ${cy})"/>`);
    parts.push(`<text x="${cx}" y="${cy + 20}" font-size="10" fill="#92400e" text-anchor="middle">CAM ${esc(cam.lens || cam.shot_size || '')}</text>`);
  }

  if (title) parts.push(`<text x="${S / 2}" y="${S + 18}" font-size="12" fill="#0f172a" text-anchor="middle" font-weight="bold">${esc(title)}</text>`);
  parts.push('</svg>');
  return parts.join('\n');
}

// ----------------------------------------------------------------------------
// Camera-view gray-box SVG (a 16:9 composition mockup FOR the video AI:
// scaffold first frame / layout guide — this is in camera space, unlike the
// top-down blueprint, so a generative tool can actually use it).
// ----------------------------------------------------------------------------

/**
 * Render a 16:9 camera-view gray-box of the blocking.
 * Visible entities are placed by screen_x and sized/stacked by depth.
 */
export function renderGrayboxSVG(blocking, opts = {}) {
  const labelFor = opts.labelFor || defaultLabel;
  const title = opts.title || '';
  const compiled = compileBlocking(blocking, { labelFor, fixtures: opts.fixtures || [] });

  const W = 480, H = 270, TH = title ? 22 : 0;
  const sizeByDepth = { foreground: 0.62, midground: 0.42, background: 0.27 };
  const baselineByDepth = { foreground: 0.96, midground: 0.84, background: 0.72 };

  const p = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + TH}" viewBox="0 0 ${W} ${H + TH}" font-family="sans-serif">`);
  p.push(`<rect x="0" y="0" width="${W}" height="${H + TH}" fill="#0f172a"/>`);
  p.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#1e293b"/>`);
  // rule-of-thirds
  for (let i = 1; i < 3; i++) {
    p.push(`<line x1="${(W / 3) * i}" y1="0" x2="${(W / 3) * i}" y2="${H}" stroke="#334155" stroke-width="1"/>`);
    p.push(`<line x1="0" y1="${(H / 3) * i}" x2="${W}" y2="${(H / 3) * i}" stroke="#334155" stroke-width="1"/>`);
  }

  // background first, foreground last (painter's order)
  const order = { background: 0, midground: 1, foreground: 2 };
  const ents = [...compiled.visibleEntities].sort(
    (a, b) => (order[a.depth] ?? 1) - (order[b.depth] ?? 1)
  );
  ents.forEach((e, i) => {
    const c = PALETTE[i % PALETTE.length];
    const sx = (e.screen_x ?? 50) / 100 * W;
    const frac = sizeByDepth[e.depth] ?? 0.42;
    const bh = H * frac, bw = bh * 0.42;
    const baseY = H * (baselineByDepth[e.depth] ?? 0.84);
    const topY = baseY - bh;
    // body silhouette
    p.push(`<rect x="${(sx - bw / 2).toFixed(1)}" y="${topY.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bw / 3).toFixed(1)}" fill="${c}" fill-opacity="0.55" stroke="${c}" stroke-width="2"/>`);
    // head
    p.push(`<circle cx="${sx.toFixed(1)}" cy="${(topY + bw * 0.35).toFixed(1)}" r="${(bw * 0.32).toFixed(1)}" fill="${c}" fill-opacity="0.8" stroke="${c}"/>`);
    p.push(`<text x="${sx.toFixed(1)}" y="${(baseY + 11).toFixed(1)}" font-size="10" fill="#e2e8f0" text-anchor="middle">${esc(e.label)}</text>`);
    const f = e.facing ? e.facing.replace('the camera', 'cam') : '';
    if (f) p.push(`<text x="${sx.toFixed(1)}" y="${(topY - 4).toFixed(1)}" font-size="8" fill="#94a3b8" text-anchor="middle">${esc(f)}</text>`);
  });

  if (!ents.length) {
    p.push(`<text x="${W / 2}" y="${H / 2}" font-size="12" fill="#64748b" text-anchor="middle">no entities in frame</text>`);
  }
  if (compiled.cameraClause) {
    p.push(`<text x="6" y="${H - 6}" font-size="8" fill="#475569">${esc(compiled.cameraClause)}</text>`);
  }
  // watermark so nobody mistakes a scaffold for a finished frame
  p.push(`<text x="${W - 6}" y="14" font-size="9" fill="#475569" text-anchor="end">GRAY-BOX SCAFFOLD</text>`);
  if (title) p.push(`<text x="${W / 2}" y="${H + 16}" font-size="12" fill="#e2e8f0" text-anchor="middle" font-weight="bold">${esc(title)}</text>`);
  p.push('</svg>');
  return p.join('\n');
}

// Exposed for testing / reuse.
export const _internals = {
  facingToDeg, parseFocal, hFovFromFocal, cameraHFov, projectEntity,
  horizBucket, facingRelToCamera, lensPhrase
};

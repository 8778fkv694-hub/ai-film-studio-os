import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import ReviewPanel from '@/components/ReviewPanel';
import ShotEditor from '@/components/ShotEditor';

const ROOT = path.resolve(process.cwd(), '..');

function readJsonSafe(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

function getShotData(id: string) {
  // Check finalized first, then drafts
  let shot = readJsonSafe(path.join(ROOT, 'shots', `${id}.json`));
  let source = 'shots';
  if (!shot) {
    shot = readJsonSafe(path.join(ROOT, 'shots_draft', `${id}.json`));
    source = 'shots_draft';
  }
  if (!shot) return null;
  shot._source = source;

  const finalPrompt = readJsonSafe(path.join(ROOT, 'prompts', `${id}.final.json`));
  const renderHistory = readJsonSafe(path.join(ROOT, 'renders', id, 'history.json'));

  let scene = null;
  if (shot.scene_ref) {
    scene = readJsonSafe(path.join(ROOT, shot.scene_ref));
  }

  const characters = (shot.characters || []).map((c: any) => ({
    ...c,
    data: readJsonSafe(path.join(ROOT, c.ref)),
  }));

  const props = (shot.props || []).map((p: any) => ({
    ...p,
    data: readJsonSafe(path.join(ROOT, p.ref)),
  }));

  const fixups: any[] = [];
  const fixupsDir = path.join(ROOT, 'fixups');
  if (fs.existsSync(fixupsDir)) {
    const fixupFiles = fs.readdirSync(fixupsDir).filter(f => f.endsWith('.json'));
    for (const f of fixupFiles) {
      const fixup = readJsonSafe(path.join(fixupsDir, f));
      if (fixup && fixup.target_shot_id === id) {
        fixups.push(fixup);
      }
    }
  }

  let stateIn = null;
  if (shot.continuity?.state_in_ref) {
    stateIn = readJsonSafe(path.join(ROOT, shot.continuity.state_in_ref));
  }

  return { shot, finalPrompt, renderHistory, scene, characters, props, fixups, stateIn };
}

function getAllShotIds(): string[] {
  const ids: string[] = [];
  for (const dir of ['shots', 'shots_draft']) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;
    fs.readdirSync(fullDir)
      .filter(f => f.endsWith('.json'))
      .forEach(f => {
        const id = f.replace('.json', '');
        if (!ids.includes(id)) ids.push(id);
      });
  }
  return ids.sort();
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  failed: 'bg-red-900/50 text-red-300 border-red-700',
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  rendering: 'bg-blue-900/50 text-blue-300 border-blue-700',
};

const FIXUP_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  open: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  processing: 'bg-blue-900/50 text-blue-300 border-blue-700',
  rejected: 'bg-red-900/50 text-red-300 border-red-700',
};

export default function ShotDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const data = getShotData(id);
  const allIds = getAllShotIds();
  const currentIdx = allIds.indexOf(id);
  const prevId = currentIdx > 0 ? allIds[currentIdx - 1] : null;
  const nextId = currentIdx < allIds.length - 1 ? allIds[currentIdx + 1] : null;

  if (!data) {
    return (
      <main className="p-8 max-w-7xl mx-auto">
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">&larr; Back to Dashboard</Link>
        <div className="mt-8 text-center text-slate-400 text-lg">
          Shot <span className="font-mono text-white">{id}</span> not found.
        </div>
      </main>
    );
  }

  const { shot, finalPrompt, renderHistory, scene, characters, props, fixups, stateIn } = data;

  return (
    <main className="p-8 max-w-7xl mx-auto">
      {/* Breadcrumb + Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">&larr; Back to Dashboard</Link>
        <div className="flex gap-2">
          {prevId && (
            <Link href={`/shots/${prevId}`} className="px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded transition text-slate-300">
              &larr; {prevId}
            </Link>
          )}
          {nextId && (
            <Link href={`/shots/${nextId}`} className="px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700 rounded transition text-slate-300">
              {nextId} &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Header */}
      <header className="mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-4xl font-bold font-mono text-blue-300">{shot.shot_id}</h1>
          <span className="text-sm px-3 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {shot.duration_s}s
          </span>
          <span className="text-sm px-3 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {shot.budget?.tier || 'standard'}
          </span>
          {shot._source === 'shots_draft' && (
            <span className="text-sm px-3 py-1 rounded bg-yellow-900/50 text-yellow-300 border border-yellow-700">
              DRAFT
            </span>
          )}
        </div>
        <p className="text-slate-400">
          {scene ? `${scene.name} (${scene.id})` : shot.scene_ref || 'No scene'}
          {shot.cam_setup_ref && <span className="ml-3 text-slate-500">cam: {shot.cam_setup_ref}</span>}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Shot Spec */}
        <div className="lg:col-span-2 space-y-6">

          {/* Shot Editor */}
          <section>
            <ShotEditor shotId={id} initialShot={shot} />
          </section>

          {/* Action Beats */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-lg font-semibold mb-3 text-slate-200">Action Beats</h2>
            <ol className="list-decimal list-inside space-y-2 text-slate-300">
              {(shot.action?.beats || []).map((beat: string, i: number) => (
                <li key={i} className="pl-2">{beat}</li>
              ))}
            </ol>
          </section>

          {/* Dialogue */}
          {shot.dialogue && (
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <h2 className="text-lg font-semibold mb-3 text-slate-200">Dialogue</h2>
              <div className="bg-slate-950 rounded p-4 border border-slate-800">
                <span className="text-yellow-400 font-semibold">{shot.dialogue.speaker}</span>
                <span className="text-slate-500 mx-2">:</span>
                <span className="text-blue-200 italic">"{shot.dialogue.text}"</span>
                {shot.dialogue.voice_id && (
                  <span className="ml-3 text-xs text-slate-500">voice: {shot.dialogue.voice_id}</span>
                )}
              </div>
            </section>
          )}

          {/* Prompt */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-lg font-semibold mb-3 text-slate-200">Prompt</h2>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wide">Positive</span>
                <p className="mt-1 text-sm text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 font-mono leading-relaxed">
                  {finalPrompt?.positive_text || shot.prompt?.positive || 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-xs text-red-400 font-semibold uppercase tracking-wide">Negative</span>
                <p className="mt-1 text-sm text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 font-mono leading-relaxed">
                  {finalPrompt?.negative_text || shot.prompt?.negative || 'N/A'}
                </p>
              </div>
              {finalPrompt?.ref_images && finalPrompt.ref_images.length > 0 && (
                <div>
                  <span className="text-xs text-blue-400 font-semibold uppercase tracking-wide">
                    Reference Images ({finalPrompt.ref_images.length})
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {finalPrompt.ref_images.map((img: string, i: number) => {
                      const isMissing = finalPrompt.meta?.validation?.missing_assets?.includes(img);
                      return (
                        <span key={i} className={`text-xs px-2 py-1 rounded font-mono ${isMissing ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                          {img.split('/').pop()}
                          {isMissing && ' (missing)'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {finalPrompt?.meta && (
                <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800 text-xs text-slate-500">
                  <span>compiler: v{finalPrompt.meta.compiler_version}</span>
                  <span>git: {finalPrompt.meta.git_commit}</span>
                  <span>compiled: {new Date(finalPrompt.meta.compiled_at).toLocaleString()}</span>
                  {finalPrompt.meta.validation?.status && (
                    <span className={finalPrompt.meta.validation.status === 'WARN' ? 'text-yellow-500' : 'text-emerald-500'}>
                      validation: {finalPrompt.meta.validation.status}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Continuity / State */}
          {shot.continuity && (
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <h2 className="text-lg font-semibold mb-3 text-slate-200">Continuity</h2>
              <div className="space-y-3">
                <div className="text-sm text-slate-400">
                  State input: <span className="font-mono text-slate-300">{shot.continuity.state_in_ref || 'none'}</span>
                </div>
                {shot.continuity.state_changes && (
                  <div>
                    <span className="text-xs text-purple-400 font-semibold uppercase tracking-wide">State Changes</span>
                    <pre className="mt-1 text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto">
                      {JSON.stringify(shot.continuity.state_changes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Render History */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-lg font-semibold mb-3 text-slate-200">
              Render History
              {renderHistory?.takes && <span className="text-sm text-slate-500 ml-2">({renderHistory.takes.length} takes)</span>}
            </h2>
            {!renderHistory || !renderHistory.takes || renderHistory.takes.length === 0 ? (
              <p className="text-slate-500 text-sm">No renders yet.</p>
            ) : (
              <div className="space-y-3">
                {renderHistory.best_take && (
                  <div className="text-sm text-emerald-400 mb-2">
                    Best take: <span className="font-mono">{renderHistory.best_take}</span>
                  </div>
                )}
                {renderHistory.takes.map((take: any) => (
                  <div key={take.take_id} className={`bg-slate-950 rounded-lg border p-4 ${renderHistory.best_take === take.take_id ? 'border-emerald-600' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm text-white">{take.take_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[take.status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {take.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-400">
                      <div>model: <span className="text-slate-300">{take.model || 'N/A'}</span></div>
                      <div>seed: <span className="text-slate-300">{take.seed ?? 'N/A'}</span></div>
                      <div>cost: <span className="text-slate-300">${take.cost_estimate?.toFixed(2) ?? 'N/A'}</span></div>
                      <div>hash: <span className="text-slate-300 font-mono">{take.prompt_hash}</span></div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(take.timestamp).toLocaleString()}
                    </div>

                    {/* Review display */}
                    {take.review && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <div className="flex items-center gap-3 text-xs">
                          {take.review.rating && (
                            <span className="text-yellow-400">
                              {'★'.repeat(take.review.rating)}{'☆'.repeat(5 - take.review.rating)}
                            </span>
                          )}
                          {take.review.tags?.map((tag: string) => (
                            <span key={tag} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                        {take.review.notes && (
                          <p className="text-xs text-slate-400 mt-1">{take.review.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Interactive Review Panel */}
                <ReviewPanel shotId={id} takes={renderHistory.takes} />
              </div>
            )}
          </section>

          {/* Fixups */}
          {fixups.length > 0 && (
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <h2 className="text-lg font-semibold mb-3 text-slate-200">
                Fixup Tickets ({fixups.length})
              </h2>
              <div className="space-y-3">
                {fixups.map((fixup: any) => (
                  <div key={fixup.fixup_id} className="bg-slate-950 rounded-lg border border-slate-800 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm text-white">{fixup.fixup_id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700">
                          {fixup.type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${FIXUP_STATUS_COLORS[fixup.status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                          {fixup.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300">{fixup.instruction}</p>
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span>take: {fixup.target_take_id}</span>
                      {fixup.params?.denoise_strength != null && <span>denoise: {fixup.params.denoise_strength}</span>}
                      {fixup.result_ref && <span>result: {fixup.result_ref}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-6">

          {/* Characters */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-lg font-semibold mb-3 text-slate-200">Characters</h2>
            {characters.length === 0 ? (
              <p className="text-slate-500 text-sm">No characters</p>
            ) : (
              <div className="space-y-3">
                {characters.map((c: any) => (
                  <div key={c.ref} className="bg-slate-950 rounded p-3 border border-slate-800">
                    <div className="font-mono text-sm text-blue-300 mb-1">{c.data?.id || c.ref}</div>
                    {c.data?.name && <div className="text-sm text-slate-300">{c.data.name}</div>}
                    {c.data?.must_keep?.outfit && (
                      <div className="text-xs text-slate-500 mt-1">outfit: {c.data.must_keep.outfit.join(', ')}</div>
                    )}
                    {c.data?.must_keep?.accessories && (
                      <div className="text-xs text-slate-500">accessories: {c.data.must_keep.accessories.join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Props */}
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-lg font-semibold mb-3 text-slate-200">Props</h2>
            {props.length === 0 ? (
              <p className="text-slate-500 text-sm">No props</p>
            ) : (
              <div className="space-y-3">
                {props.map((p: any) => (
                  <div key={p.ref} className="bg-slate-950 rounded p-3 border border-slate-800">
                    <div className="font-mono text-sm text-emerald-300 mb-1">{p.data?.id || p.ref}</div>
                    {p.data?.name && <div className="text-sm text-slate-300">{p.data.name}</div>}
                    <div className="text-xs text-slate-500 mt-1">state: {p.state || 'N/A'}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Scene Info */}
          {scene && (
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <h2 className="text-lg font-semibold mb-3 text-slate-200">Scene</h2>
              <div className="space-y-2">
                <div className="font-mono text-sm text-purple-300">{scene.id}</div>
                <div className="text-sm text-slate-300">{scene.name}</div>
                {scene.anchors && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Anchors</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {scene.anchors.map((a: any) => (
                        <span key={a.id} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700" title={a.note}>
                          {a.id}: {a.note}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {scene.must_keep && (
                  <div className="mt-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">Must Keep</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {scene.must_keep.set_elements?.map((e: string) => (
                        <span key={e} className="text-xs px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-300 border border-emerald-800">{e}</span>
                      ))}
                    </div>
                    {scene.must_keep.lighting && (
                      <div className="text-xs text-slate-400 mt-1">lighting: {scene.must_keep.lighting}</div>
                    )}
                  </div>
                )}
                {scene.forbidden && scene.forbidden.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-red-400 uppercase tracking-wide">Forbidden</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {scene.forbidden.map((f: string) => (
                        <span key={f} className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-800">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Budget */}
          {shot.budget && (
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <h2 className="text-lg font-semibold mb-3 text-slate-200">Budget</h2>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tier</span>
                  <span className={`font-mono ${shot.budget.tier === 'cheap' ? 'text-yellow-400' : shot.budget.tier === 'final' ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {shot.budget.tier}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Regen</span>
                  <span className="text-slate-300">{shot.budget.max_regen ?? 'N/A'}</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

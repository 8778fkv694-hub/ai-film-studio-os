import fs from 'fs';
import path from 'path';
import Link from 'next/link';

import Player from '@/components/Player';

// Mock function to read shots (Server Component logic)
function getShots() {
  const shotsDir = path.resolve(process.cwd(), '../shots');
  if (!fs.existsSync(shotsDir)) return [];
  const files = fs.readdirSync(shotsDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const content = fs.readFileSync(path.join(shotsDir, f), 'utf-8');
    return JSON.parse(content);
  });
}

function getProject() {
  const p = path.resolve(process.cwd(), '../project.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export default function Home() {
  const project = getProject();
  const shots = getShots();

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <header className="mb-12 border-b border-slate-800 pb-6">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          AI Film Studio OS
        </h1>
        <p className="mt-2 text-slate-400">
          {project ? `${project.name} (${project.id})` : 'No project.json found'}
        </p>
      </header>

      {/* Main Player Area */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
          Animatic Preview (TTS + Slides)
        </h2>
        <Player shots={shots} />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
          Timeline ({shots.length} Shots)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shots.map((shot: any) => (
            <div key={shot.shot_id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-600 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-xl font-bold text-blue-300">{shot.shot_id}</span>
                <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {shot.duration_s}s
                </span>
              </div>
              
              <div className="text-sm text-slate-400 mb-4 line-clamp-3 h-16">
                {shot.action?.beats?.[0] || "No action description"}
              </div>

              <div className="flex gap-2 mt-4 text-xs font-mono text-slate-500">
                <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {shot.scene_ref?.replace('scenes/', '').replace('.json', '')}
                </span>
                <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {shot.budget?.tier || 'standard'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="p-4 bg-yellow-900/20 border border-yellow-900/50 rounded text-yellow-200 text-sm">
          ⚠️ This is a static dashboard preview. Run <code>npm run dev</code> locally to interact.
        </div>
      </section>
    </main>
  );
}

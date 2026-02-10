import fs from 'fs';
import path from 'path';
import Link from 'next/link';

import Player from '@/components/Player';
import ProjectManager from '@/components/ProjectManager';
import LintReport from '@/components/LintReport';

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

      <section className="mb-12">
        <ProjectManager />
      </section>

      {/* Lint Report */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <span className="w-2 h-8 bg-red-500 rounded-full"></span>
          Quality Gate (Lint Report)
        </h2>
        <LintReport />
      </section>

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
            <Link
              key={shot.shot_id}
              href={`/shots/${shot.shot_id}`}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-blue-600 hover:bg-slate-900/80 transition-all group block"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-xl font-bold text-blue-300 group-hover:text-blue-200 transition-colors">{shot.shot_id}</span>
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

              <div className="mt-3 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                View Details &rarr;
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

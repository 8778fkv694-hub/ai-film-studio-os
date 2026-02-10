"use client";

import { useState, useEffect } from 'react';
import { Save, Download, Upload, RefreshCw } from 'lucide-react';

export default function ProjectManager() {
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchProject();
  }, []);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/project');
      if (res.ok) {
        setProject(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setStatus('Saving...');
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
      if (res.ok) setStatus('Saved!');
      else setStatus('Error saving');
    } catch (e) {
      setStatus('Error saving');
    }
    setTimeout(() => setStatus(''), 2000);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `project_${project.id || 'export'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setProject(json);
        setStatus('Loaded (Unsaved)');
      } catch (e) {
        setStatus('Invalid JSON');
      }
    };
    reader.readAsText(file);
  };

  if (loading) return <div className="p-4 text-slate-400">Loading project...</div>;
  if (!project) return <div className="p-4 text-red-400">Failed to load project.json</div>;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-2xl">📦</span> Project Management
        </h2>
        <div className="text-sm font-mono text-emerald-400">{status}</div>
      </div>

      <div className="space-y-6">
        {/* Meta Editor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Project ID</label>
            <input 
              type="text" 
              value={project.id || ''}
              onChange={e => setProject({...project, id: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Project Name</label>
            <input 
              type="text" 
              value={project.name || ''}
              onChange={e => setProject({...project, name: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <textarea 
              value={project.description || ''}
              onChange={e => setProject({...project, description: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none h-20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-800">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition"
          >
            <Save size={18} /> Sync / Overwrite
          </button>

          <button 
            onClick={fetchProject}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
          >
            <RefreshCw size={18} /> Reload Disk
          </button>

          <div className="w-px h-10 bg-slate-800 mx-2"></div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition"
          >
            <Download size={18} /> Export JSON
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded transition cursor-pointer">
            <Upload size={18} /> Import JSON
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
}

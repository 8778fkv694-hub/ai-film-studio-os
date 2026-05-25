"use client";

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, FolderOpen, Check, Plus, Settings } from 'lucide-react';

interface ProjectInfo {
  id: string;
  name: string;
  description: string;
}

interface ProjectSelectorProps {
  activeProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  onCreateNew: () => void;
  onManage: () => void;
}

export default function ProjectSelector({ activeProjectId, onProjectChange, onCreateNew, onManage }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setLoading(false);
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
      >
        <FolderOpen size={16} className="text-blue-400" />
        <span className="text-sm text-slate-200">
          {loading ? '加载中...' : activeProject?.name || '选择项目'}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <div className="text-xs text-slate-500 px-2 py-1">项目列表</div>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                暂无项目
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    onProjectChange(project.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 transition ${
                    activeProjectId === project.id ? 'bg-blue-900/20' : ''
                  }`}
                >
                  <FolderOpen size={16} className={activeProjectId === project.id ? 'text-blue-400' : 'text-slate-500'} />
                  <div className="flex-1 text-left">
                    <div className="text-sm text-slate-200">{project.name}</div>
                    <div className="text-xs text-slate-500">{project.id}</div>
                  </div>
                  {activeProjectId === project.id && (
                    <Check size={16} className="text-blue-400" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="p-2 border-t border-slate-800 flex flex-col gap-1">
            <button
              onClick={() => {
                onCreateNew();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-slate-800 rounded transition"
            >
              <Plus size={16} />
              新建项目
            </button>
            <button
              onClick={() => {
                onManage();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded transition"
            >
              <Settings size={16} />
              管理项目
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
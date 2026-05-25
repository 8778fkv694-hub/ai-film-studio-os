"use client";

import { useState, useEffect } from 'react';
import Toolbar from '@/components/Toolbar';
import TabNav, { TabId } from '@/components/TabNav';
import DashboardTab from '@/components/tabs/DashboardTab';
import ProjectTab from '@/components/tabs/ProjectTab';
import ScriptTab from '@/components/tabs/ScriptTab';
import ScenesTab from '@/components/tabs/ScenesTab';
import AssetsTab from '@/components/tabs/AssetsTab';
import ShotsTab from '@/components/tabs/ShotsTab';
import PreviewTab from '@/components/tabs/PreviewTab';
import ToolsTab from '@/components/tabs/ToolsTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import ProjectList from '@/components/ProjectList';
import CreateProjectForm from '@/components/CreateProjectForm';

interface Project {
  id: string;
  name: string;
  description: string;
}

type ProjectView = 'main' | 'list' | 'create';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [project, setProject] = useState<Project | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectView, setProjectView] = useState<ProjectView>('main');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadActiveProject();
  }, []);

  const loadActiveProject = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        if (data.activeProjectId) {
          setActiveProjectId(data.activeProjectId);
          fetchProject();
        } else if (data.projects.length > 0) {
          // 如果没有活动项目但有项目列表，激活第一个
          await activateProject(data.projects[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProject = async () => {
    try {
      const res = await fetch('/api/project');
      if (res.ok) {
        setProject(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activateProject = async (projectId: string) => {
    try {
      const res = await fetch('/api/projects/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });

      if (res.ok) {
        setActiveProjectId(projectId);
        setProjectView('main');
        fetchProject();
        setRefreshKey(prev => prev + 1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleRunChecks = async () => {
    setActiveTab('tools');
  };

  const handleProjectChange = (projectId: string) => {
    activateProject(projectId);
  };

  const handleCreateNewProject = () => {
    setProjectView('create');
  };

  const handleManageProjects = () => {
    setProjectView('list');
  };

  const handleProjectCreated = (projectId: string) => {
    activateProject(projectId);
  };

  const handleDataRefresh = () => {
    setRefreshKey(prev => prev + 1);
    fetchProject();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab key={refreshKey} onNavigate={(tab) => setActiveTab(tab as TabId)} />;
      case 'project':
        return <ProjectTab key={refreshKey} />;
      case 'script':
        return <ScriptTab />;
      case 'scenes':
        return <ScenesTab />;
      case 'assets':
        return <AssetsTab />;
      case 'shots':
        return <ShotsTab key={refreshKey} />;
      case 'preview':
        return <PreviewTab key={refreshKey} />;
      case 'tools':
        return <ToolsTab onDataRefresh={handleDataRefresh} />;
      case 'settings':
        return <SettingsTab />;
      default:
        return null;
    }
  };

  // 如果没有活动项目或用户选择查看项目列表
  if (projectView === 'list' || (!activeProjectId && projectView === 'main')) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
          <h1 className="text-xl font-bold text-slate-100">AI 影视工作室</h1>
        </header>
        <main className="flex-1">
          <ProjectList
            onProjectSelect={activateProject}
            onProjectCreate={() => setProjectView('create')}
            onProjectDeleted={() => {
              setActiveProjectId(null);
              setProject(null);
              loadActiveProject();
            }}
            activeProjectId={activeProjectId}
          />
        </main>
      </div>
    );
  }

  // 新建项目表单
  if (projectView === 'create') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
          <h1 className="text-xl font-bold text-slate-100">AI 影视工作室</h1>
        </header>
        <main className="flex-1">
          <CreateProjectForm
            onBack={() => setProjectView('list')}
            onProjectCreated={handleProjectCreated}
          />
        </main>
      </div>
    );
  }

  // 主界面
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Toolbar
        projectName={project?.name || '加载中...'}
        activeProjectId={activeProjectId}
        onReload={handleReload}
        onRunChecks={handleRunChecks}
        onProjectChange={handleProjectChange}
        onCreateNewProject={handleCreateNewProject}
        onManageProjects={handleManageProjects}
      />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-x-hidden">
        {renderTabContent()}
      </main>
    </div>
  );
}

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

interface Project {
  id: string;
  name: string;
  description: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProject();
  }, []);

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

  const handleSave = async () => {
    // Global save action - can be customized
    console.log('Global save triggered');
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleRunChecks = async () => {
    // Switch to tools tab and trigger checks
    setActiveTab('tools');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab onNavigate={(tab) => setActiveTab(tab as TabId)} />;
      case 'project':
        return <ProjectTab />;
      case 'script':
        return <ScriptTab />;
      case 'scenes':
        return <ScenesTab />;
      case 'assets':
        return <AssetsTab />;
      case 'shots':
        return <ShotsTab />;
      case 'preview':
        return <PreviewTab />;
      case 'tools':
        return <ToolsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Toolbar
        projectName={project?.name || '加载中...'}
        onSave={handleSave}
        onReload={handleReload}
        onRunChecks={handleRunChecks}
      />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-hidden">
        {renderTabContent()}
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Image, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface Anchor {
  id: string;
  img: string;
  note: string;
  use_for: string[];
}

interface Scene {
  id: string;
  name: string;
  style_ref: string;
  anchors: Anchor[];
  must_keep: {
    set_elements: string[];
    lighting: string;
  };
  forbidden: string[];
  _filename?: string;
}

export default function ScenesTab() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadScenes();
  }, []);

  const loadScenes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scenes');
      if (res.ok) {
        const data = await res.json();
        setScenes(data);
        if (data.length > 0 && !selectedScene) setSelectedScene(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const saveScene = async (scene: Scene) => {
    try {
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scene)
      });
      if (res.ok) {
        showStatus('success', '场景已保存');
        loadScenes();
      } else {
        showStatus('error', '保存失败');
      }
    } catch (e) {
      showStatus('error', '保存失败');
    }
  };

  const createNewScene = () => {
    const newId = `scene_${String(scenes.length + 1).padStart(2, '0')}`;
    const newScene: Scene = {
      id: newId,
      name: '新场景',
      style_ref: 'styles/default.json',
      anchors: [],
      must_keep: {
        set_elements: [],
        lighting: ''
      },
      forbidden: []
    };
    setSelectedScene(newScene);
  };

  const addAnchor = () => {
    if (!selectedScene) return;
    const newAnchor: Anchor = {
      id: `anchor_${selectedScene.anchors.length + 1}`,
      img: '',
      note: '新锚点描述',
      use_for: ['background']
    };
    setSelectedScene({
      ...selectedScene,
      anchors: [...selectedScene.anchors, newAnchor]
    });
  };

  const removeAnchor = (idx: number) => {
    if (!selectedScene) return;
    setSelectedScene({
      ...selectedScene,
      anchors: selectedScene.anchors.filter((_, i) => i !== idx)
    });
  };

  const addSetElement = () => {
    if (!selectedScene) return;
    const element = prompt('输入场景元素名称:');
    if (element) {
      setSelectedScene({
        ...selectedScene,
        must_keep: {
          ...selectedScene.must_keep,
          set_elements: [...selectedScene.must_keep.set_elements, element]
        }
      });
    }
  };

  const removeSetElement = (idx: number) => {
    if (!selectedScene) return;
    setSelectedScene({
      ...selectedScene,
      must_keep: {
        ...selectedScene.must_keep,
        set_elements: selectedScene.must_keep.set_elements.filter((_, i) => i !== idx)
      }
    });
  };

  const addForbidden = () => {
    if (!selectedScene) return;
    const item = prompt('输入禁止元素:');
    if (item) {
      setSelectedScene({
        ...selectedScene,
        forbidden: [...selectedScene.forbidden, item]
      });
    }
  };

  const removeForbidden = (idx: number) => {
    if (!selectedScene) return;
    setSelectedScene({
      ...selectedScene,
      forbidden: selectedScene.forbidden.filter((_, i) => i !== idx)
    });
  };

  if (loading) return <div className="p-8 text-slate-400">加载场景中...</div>;

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Sidebar - Scene List */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <MapPin size={18} className="text-blue-400" />
            场景列表
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              onClick={() => setSelectedScene(scene)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                selectedScene?.id === scene.id
                  ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="font-medium text-sm">{scene.name}</div>
              <div className="text-xs text-slate-500 mt-1">{scene.id}</div>
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-slate-800">
          <button
            onClick={createNewScene}
            className="w-full flex items-center justify-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition"
          >
            <Plus size={16} />
            新建场景
          </button>
        </div>
      </div>

      {/* Main Content - Scene Editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Status Message */}
        {status && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            status.type === 'success'
              ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800'
              : 'bg-red-900/30 text-red-300 border border-red-800'
          }`}>
            {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {status.message}
          </div>
        )}

        {selectedScene ? (
          <div className="space-y-6 max-w-4xl">
            {/* Basic Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-200">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">场景 ID</label>
                  <input
                    type="text"
                    value={selectedScene.id}
                    onChange={(e) => setSelectedScene({ ...selectedScene, id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">场景名称</label>
                  <input
                    type="text"
                    value={selectedScene.name}
                    onChange={(e) => setSelectedScene({ ...selectedScene, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-slate-400 mb-1">风格引用</label>
                  <input
                    type="text"
                    value={selectedScene.style_ref}
                    onChange={(e) => setSelectedScene({ ...selectedScene, style_ref: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Anchors */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
                <Image size={18} className="text-emerald-400" />
                参考锚点 (Anchors)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {selectedScene.anchors.map((anchor, idx) => (
                  <div key={anchor.id} className="bg-slate-950 border border-slate-700 rounded-lg p-3 relative">
                    <button
                      onClick={() => removeAnchor(idx)}
                      className="absolute top-2 right-2 text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="aspect-video bg-slate-800 rounded mb-2 flex items-center justify-center text-slate-600">
                      <Image size={32} />
                    </div>
                    <input
                      type="text"
                      value={anchor.id}
                      onChange={(e) => {
                        const newAnchors = [...selectedScene.anchors];
                        newAnchors[idx] = { ...anchor, id: e.target.value };
                        setSelectedScene({ ...selectedScene, anchors: newAnchors });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-blue-300 text-sm font-mono mb-1"
                    />
                    <input
                      type="text"
                      value={anchor.note}
                      onChange={(e) => {
                        const newAnchors = [...selectedScene.anchors];
                        newAnchors[idx] = { ...anchor, note: e.target.value };
                        setSelectedScene({ ...selectedScene, anchors: newAnchors });
                      }}
                      placeholder="描述..."
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-400 text-xs"
                    />
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {anchor.use_for.map((use) => (
                        <span key={use} className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                          {use}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={addAnchor}
                  className="aspect-video bg-slate-950 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 hover:border-slate-500 transition"
                >
                  <Plus size={24} />
                  <span className="text-sm mt-1">添加锚点</span>
                </button>
              </div>
            </div>

            {/* Must Keep */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-200">必须保持 (Must Keep)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">场景元素</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedScene.must_keep.set_elements.map((el, idx) => (
                      <span
                        key={idx}
                        className="bg-emerald-900/30 text-emerald-300 px-3 py-1 rounded-full text-sm border border-emerald-800 flex items-center gap-1"
                      >
                        {el}
                        <button
                          onClick={() => removeSetElement(idx)}
                          className="hover:text-emerald-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={addSetElement}
                      className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-sm hover:bg-slate-700 transition"
                    >
                      + 添加
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">灯光设定</label>
                  <input
                    type="text"
                    value={selectedScene.must_keep.lighting}
                    onChange={(e) => setSelectedScene({
                      ...selectedScene,
                      must_keep: { ...selectedScene.must_keep, lighting: e.target.value }
                    })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Forbidden */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-400" />
                禁止元素 (Forbidden)
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedScene.forbidden.map((item, idx) => (
                  <span key={idx} className="bg-red-900/30 text-red-300 px-3 py-1 rounded-full text-sm border border-red-800 flex items-center gap-1">
                    {item}
                    <button
                      onClick={() => removeForbidden(idx)}
                      className="hover:text-red-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
                <button
                  onClick={addForbidden}
                  className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-sm hover:bg-slate-700 transition"
                >
                  + 添加
                </button>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={() => saveScene(selectedScene)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
            >
              保存场景
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            选择一个场景进行编辑
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import { 
  Plus, User, Box, Trash2, CheckCircle, AlertCircle, 
  Upload, Loader2, RefreshCw, AlertTriangle, Image as ImageIcon, Sliders, Layout
} from 'lucide-react';

interface Character {
  id: string;
  name: string;
  must_keep?: {
    hair?: string;
    outfit?: string;
    accessories?: string[];
  };
  references?: {
    images?: string[];
  };
  _filename?: string;
}

interface Prop {
  id: string;
  name: string;
  must_keep?: boolean;
  references?: {
    images?: string[];
  };
  _filename?: string;
}

interface Scene {
  file: string;
  id: string;
  name: string;
  style_ref: string;
  anchors: { id: string; img: string; note?: string; use_for?: string[] }[];
  must_keep?: {
    set_elements?: string[];
    lighting?: string;
  };
}

interface MissingRef {
  path: string;
  ref_by: string;
  type: string;
}

type TabType = 'characters' | 'props' | 'scenes' | 'gallery' | 'missing';

export default function AssetsTab() {
  const [activeTab, setActiveTab] = useState<TabType>('characters');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [missingRefs, setMissingRefs] = useState<MissingRef[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);

  useEffect(() => {
    loadLibraryData();
  }, []);

  const loadLibraryData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const endpoint = isRefresh ? '/api/assets/library' : '/api/assets/library';
      const method = isRefresh ? 'POST' : 'GET';
      const res = await fetch(endpoint, { method });
      
      if (res.ok) {
        const data = await res.json();
        setCharacters(data.characters || []);
        setProps(data.props || []);
        setScenes(data.scenes || []);
        setGalleryImages(data.reference_images || []);
        setMissingRefs(data.missing_refs || []);
        
        // Auto select first item if not set
        if (!selectedItem) {
          if (activeTab === 'characters' && data.characters?.length > 0) {
            setSelectedItem(data.characters[0]);
          } else if (activeTab === 'props' && data.props?.length > 0) {
            setSelectedItem(data.props[0]);
          } else if (activeTab === 'scenes' && data.scenes?.length > 0) {
            setSelectedItem(data.scenes[0]);
          }
        } else {
          // Update selected item from new data
          const id = selectedItem.id;
          if (activeTab === 'characters') {
            const found = data.characters.find((c: any) => c.id === id);
            if (found) setSelectedItem(found);
          } else if (activeTab === 'props') {
            const found = data.props.find((p: any) => p.id === id);
            if (found) setSelectedItem(found);
          } else if (activeTab === 'scenes') {
            const found = data.scenes.find((s: any) => s.id === id);
            if (found) setSelectedItem(found);
          }
        }
        
        if (isRefresh) {
          showStatus('success', '资产库审核刷新成功！');
        }
      } else {
        showStatus('error', '加载资产库失败');
      }
    } catch (e) {
      console.error(e);
      showStatus('error', '加载资产库网络异常');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleRefreshAudit = () => {
    loadLibraryData(true);
  };

  const saveCharacter = async (character: Character) => {
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(character)
      });
      if (res.ok) {
        showStatus('success', '角色保存成功');
        await loadLibraryData(true);
      } else {
        showStatus('error', '保存失败');
      }
    } catch (e) {
      showStatus('error', '保存失败');
    }
  };

  const saveProp = async (prop: Prop) => {
    try {
      const res = await fetch('/api/props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prop)
      });
      if (res.ok) {
        showStatus('success', '道具保存成功');
        await loadLibraryData(true);
      } else {
        showStatus('error', '保存失败');
      }
    } catch (e) {
      showStatus('error', '保存失败');
    }
  };

  const handleUploadReference = async (id: string, file: File | null) => {
    if (!file) return;
    setUploadingRef(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', activeTab);
      formData.append('id', id);

      const res = await fetch('/api/assets/reference/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showStatus('success', '参考图已上传');
        await loadLibraryData(true);
      } else {
        showStatus('error', data.error || '上传失败');
      }
    } catch {
      showStatus('error', '上传参考图时发生网络错误');
    } finally {
      setUploadingRef(false);
    }
  };

  const handleDeleteReference = async (id: string, imgPath: string) => {
    if (!confirm('确认删除此参考图？')) return;
    try {
      const res = await fetch('/api/assets/reference/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab, id, path: imgPath })
      });
      if (res.ok) {
        showStatus('success', '参考图已删除');
        await loadLibraryData(true);
      } else {
        showStatus('error', '删除失败');
      }
    } catch {
      showStatus('error', '删除参考图时发生网络错误');
    }
  };

  const createNewAsset = () => {
    if (activeTab === 'characters') {
      const newId = `char_${String(characters.length + 1).padStart(2, '0')}`;
      const newCharacter: Character = {
        id: newId,
        name: '新角色',
        must_keep: {
          hair: '',
          outfit: '',
          accessories: []
        },
        references: { images: [] }
      };
      setSelectedItem(newCharacter);
    } else {
      const newId = `prop_${String(props.length + 1).padStart(2, '0')}`;
      const newProp: Prop = {
        id: newId,
        name: '新道具',
        must_keep: false,
        references: { images: [] }
      };
      setSelectedItem(newProp);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'characters') {
      setSelectedItem(characters[0] || null);
    } else if (tab === 'props') {
      setSelectedItem(props[0] || null);
    } else if (tab === 'scenes') {
      setSelectedItem(scenes[0] || null);
    } else {
      setSelectedItem(null);
    }
  };

  if (loading) return <div className="p-8 text-slate-400">加载资产库中...</div>;

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-950">
      {/* Sidebar navigation and list */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Categories Tab Selector */}
        <div className="p-3 border-b border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-200 text-xs tracking-wider uppercase">资产库类别</h3>
            <button
              onClick={handleRefreshAudit}
              disabled={refreshing}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 hover:text-slate-200 rounded-lg transition"
              title="重新审核资产引用"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-400' : ''} />
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-lg">
            {[
              { id: 'characters', icon: User, label: '人' },
              { id: 'props', icon: Box, label: '物' },
              { id: 'scenes', icon: Layout, label: '景' },
              { id: 'gallery', icon: ImageIcon, label: '图' },
              { id: 'missing', icon: AlertTriangle, label: '断' }
            ].map(t => {
              const Icon = t.icon;
              const isMissing = t.id === 'missing';
              const hasMissing = missingRefs.length > 0;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTabChange(t.id as TabType)}
                  className={`relative py-2 flex flex-col items-center justify-center rounded transition ${
                    activeTab === t.id
                      ? isMissing && hasMissing
                        ? 'bg-red-600 text-white font-bold'
                        : 'bg-blue-600 text-white font-bold'
                      : isMissing && hasMissing
                      ? 'text-red-400 hover:bg-slate-900/60 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                  title={isMissing ? `缺失引用审计 (${missingRefs.length})` : t.label}
                >
                  <Icon size={16} />
                  <span className="text-[10px] mt-0.5">{t.label}</span>
                  {isMissing && hasMissing && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full font-bold animate-pulse">
                      {missingRefs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* List of items depending on tab */}
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === 'characters' && characters.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                selectedItem?.id === item.id
                  ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="font-semibold text-sm">{item.name}</div>
              <div className="text-xs text-slate-500 mt-1 font-mono">{item.id}</div>
            </button>
          ))}

          {activeTab === 'props' && props.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                selectedItem?.id === item.id
                  ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="font-semibold text-sm">{item.name}</div>
              <div className="text-xs text-slate-500 mt-1 font-mono">{item.id}</div>
            </button>
          ))}

          {activeTab === 'scenes' && scenes.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                selectedItem?.id === item.id
                  ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="font-semibold text-sm">{item.name}</div>
              <div className="text-xs text-slate-500 mt-1 font-mono">{item.id}</div>
            </button>
          ))}

          {activeTab === 'gallery' && (
            <div className="p-3 text-xs text-slate-400 text-center leading-relaxed">
              📷 共有 {galleryImages.length} 个媒体资产存放在 <code>assets/reference/</code> 下。右侧可查看网格缩略图。
            </div>
          )}

          {activeTab === 'missing' && (
            <div className="p-3 text-xs text-center leading-relaxed">
              {missingRefs.length > 0 ? (
                <span className="text-red-400 font-medium">⚠️  检测到 {missingRefs.length} 处分镜或资产声明包含缺失引用的路径。右侧可查看详细审计。</span>
              ) : (
                <span className="text-emerald-400 font-medium">✅ 所有分镜及资产文件完整无断链！</span>
              )}
            </div>
          )}
        </div>

        {/* Bottom add button (only for characters/props) */}
        {(activeTab === 'characters' || activeTab === 'props') && (
          <div className="p-2 border-t border-slate-800">
            <button
              onClick={createNewAsset}
              className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition font-semibold"
            >
              <Plus size={16} />
              新建{activeTab === 'characters' ? '角色' : '道具'}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20">
        {/* Status Toast Alert */}
        {status && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 border transition ${
            status.type === 'success'
              ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40'
              : 'bg-red-950/30 text-red-300 border-red-800/40'
          }`}>
            {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-medium">{status.message}</span>
          </div>
        )}

        {/* Selected Item Editor depending on Tab */}
        {activeTab === 'characters' && selectedItem && (
          <CharacterEditor
            character={selectedItem}
            onChange={setSelectedItem}
            onSave={saveCharacter}
            onUploadRef={(file) => handleUploadReference(selectedItem.id, file)}
            onDeleteRef={(path) => handleDeleteReference(selectedItem.id, path)}
            uploadingRef={uploadingRef}
          />
        )}

        {activeTab === 'props' && selectedItem && (
          <PropEditor
            prop={selectedItem}
            onChange={setSelectedItem}
            onSave={saveProp}
            onUploadRef={(file) => handleUploadReference(selectedItem.id, file)}
            onDeleteRef={(path) => handleDeleteReference(selectedItem.id, path)}
            uploadingRef={uploadingRef}
          />
        )}

        {activeTab === 'scenes' && selectedItem && (
          <SceneViewer scene={selectedItem} />
        )}

        {activeTab === 'gallery' && (
          <ReferenceGallery images={galleryImages} />
        )}

        {activeTab === 'missing' && (
          <MissingReferencesAudit reports={missingRefs} onRefresh={handleRefreshAudit} refreshing={refreshing} />
        )}

        {!selectedItem && (activeTab === 'characters' || activeTab === 'props' || activeTab === 'scenes') && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            选择左侧资产列表进行预览或编辑
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function CharacterEditor({
  character,
  onChange,
  onSave,
  onUploadRef,
  onDeleteRef,
  uploadingRef
}: {
  character: Character;
  onChange: (c: Character) => void;
  onSave: (c: Character) => void;
  onUploadRef: (file: File | null) => void;
  onDeleteRef: (path: string) => void;
  uploadingRef: boolean;
}) {
  const mustKeep = character.must_keep || {};
  const accessories = Array.isArray(mustKeep.accessories) ? mustKeep.accessories : [];
  const refImages = character.references?.images || [];

  const addAccessory = () => {
    const item = prompt('输入配饰描述:');
    if (item) {
      onChange({
        ...character,
        must_keep: {
          ...mustKeep,
          accessories: [...accessories, item]
        }
      });
    }
  };

  const removeAccessory = (idx: number) => {
    onChange({
      ...character,
      must_keep: {
        ...mustKeep,
        accessories: accessories.filter((_, i) => i !== idx)
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 bg-blue-600/10 border border-blue-500/20 rounded-full flex items-center justify-center">
          <User size={28} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">{character.name}</h2>
          <p className="text-slate-400 text-xs font-mono mt-0.5">{character.id}</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">角色 ID</label>
            <input
              type="text"
              value={character.id}
              onChange={(e) => onChange({ ...character, id: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">角色名称</label>
            <input
              type="text"
              value={character.name}
              onChange={(e) => onChange({ ...character, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Must Keep */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">画面一致性描述 (Must Keep)</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">发型 (Hair)</label>
            <input
              type="text"
              value={mustKeep.hair || ''}
              onChange={(e) => onChange({
                ...character,
                must_keep: { ...mustKeep, hair: e.target.value }
              })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">服装 (Outfit)</label>
            <input
              type="text"
              value={mustKeep.outfit || ''}
              onChange={(e) => onChange({
                ...character,
                must_keep: { ...mustKeep, outfit: e.target.value }
              })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">固定配饰 (Accessories)</label>
            <div className="flex flex-wrap gap-2">
              {accessories.map((item, idx) => (
                <span
                  key={idx}
                  className="bg-slate-950 text-slate-300 px-3 py-1 rounded-full text-xs border border-slate-800 flex items-center gap-1.5 font-medium"
                >
                  {item}
                  <button
                    onClick={() => removeAccessory(idx)}
                    className="text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
              <button
                onClick={addAccessory}
                className="bg-blue-600/10 border border-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs hover:bg-blue-600/20 transition font-medium"
              >
                + 添加配饰
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* References */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-200">参考图库</h3>
          <label className="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition">
            {uploadingRef ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            上传参考图
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingRef}
              onChange={(e) => {
                onUploadRef(e.target.files?.[0] || null);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        
        {refImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {refImages.map((img, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden flex flex-col group relative border border-slate-900">
                <div className="aspect-video bg-slate-900 flex items-center justify-center relative p-2">
                  <img
                    src={`/api/assets/reference/${img}`}
                    alt="Character Reference"
                    className="max-w-full max-h-full object-cover rounded"
                  />
                  <button
                    onClick={() => onDeleteRef(img)}
                    className="absolute top-2 right-2 p-1.5 bg-red-950/80 hover:bg-red-800/90 text-red-300 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="p-2 bg-slate-900/30 border-t border-slate-850 flex justify-between items-center">
                  <p className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]" title={img}>
                    {img.split('/').pop()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-xs text-center py-8 border border-dashed border-slate-800 rounded-xl">
            暂无关联参考图。请点击上方按钮上传新图片。
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => onSave(character)}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition"
        >
          保存修改
        </button>
      </div>
    </div>
  );
}

function PropEditor({
  prop,
  onChange,
  onSave,
  onUploadRef,
  onDeleteRef,
  uploadingRef
}: {
  prop: Prop;
  onChange: (p: Prop) => void;
  onSave: (p: Prop) => void;
  onUploadRef: (file: File | null) => void;
  onDeleteRef: (path: string) => void;
  uploadingRef: boolean;
}) {
  const refImages = prop.references?.images || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 bg-emerald-600/10 border border-emerald-500/20 rounded-lg flex items-center justify-center">
          <Box size={28} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">{prop.name}</h2>
          <p className="text-slate-400 text-xs font-mono mt-0.5">{prop.id}</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">道具 ID</label>
            <input
              type="text"
              value={prop.id}
              onChange={(e) => onChange({ ...prop, id: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">道具名称</label>
            <input
              type="text"
              value={prop.name}
              onChange={(e) => onChange({ ...prop, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 text-sm focus:outline-none"
            />
          </div>
          <div className="col-span-2 pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-350 cursor-pointer">
              <input
                type="checkbox"
                checked={prop.must_keep === true}
                onChange={(e) => onChange({ ...prop, must_keep: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-0"
              />
              生成关键帧时必须进行视觉关联与保持 (Must Keep)
            </label>
          </div>
        </div>
      </div>

      {/* References */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-200">参考图库</h3>
          <label className="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition">
            {uploadingRef ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            上传参考图
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingRef}
              onChange={(e) => {
                onUploadRef(e.target.files?.[0] || null);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        {refImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {refImages.map((img, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden flex flex-col group relative border border-slate-900">
                <div className="aspect-video bg-slate-900 flex items-center justify-center relative p-2">
                  <img
                    src={`/api/assets/reference/${img}`}
                    alt="Prop Reference"
                    className="max-w-full max-h-full object-cover rounded"
                  />
                  <button
                    onClick={() => onDeleteRef(img)}
                    className="absolute top-2 right-2 p-1.5 bg-red-950/80 hover:bg-red-800/90 text-red-300 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="p-2 bg-slate-900/30 border-t border-slate-850">
                  <p className="text-[10px] font-mono text-slate-500 truncate" title={img}>
                    {img.split('/').pop()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-xs text-center py-8 border border-dashed border-slate-800 rounded-xl">
            暂无关联参考图。请点击上方按钮上传新图片。
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => onSave(prop)}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition"
        >
          保存修改
        </button>
      </div>
    </div>
  );
}

function SceneViewer({ scene }: { scene: Scene }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 bg-purple-600/10 border border-purple-500/20 rounded-lg flex items-center justify-center">
          <Layout size={28} className="text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">{scene.name}</h2>
          <p className="text-slate-400 text-xs font-mono mt-0.5">{scene.file}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic specifications */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">配置规格</h3>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">场景 ID</span>
              <span className="text-sm font-mono text-slate-250 font-bold">{scene.id}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">风格配置文件引用</span>
              <span className="text-sm font-mono text-blue-400">{scene.style_ref || '使用项目全局风格'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">默认布光方案</span>
              <span className="text-sm text-slate-250">{scene.must_keep?.lighting || '未指定'}</span>
            </div>
          </div>
        </div>

        {/* Elements list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">环境保留要素 (Set Elements)</h3>
          <div className="flex flex-wrap gap-1.5">
            {scene.must_keep?.set_elements?.map((el, i) => (
              <span key={i} className="bg-slate-950 border border-slate-850 px-2.5 py-1 rounded text-xs text-slate-300 font-medium">
                {el}
              </span>
            )) || <span className="text-xs text-slate-500">无指定场景要素</span>}
          </div>
        </div>
      </div>

      {/* Anchors Gallery */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">场景锚点锚定图 (Scene Anchors)</h3>
        {scene.anchors?.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {scene.anchors.map((ac, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden flex flex-col border border-slate-900">
                <div className="aspect-video bg-slate-900 flex items-center justify-center relative p-2">
                  <img
                    src={`/api/assets/reference/${ac.img}`}
                    alt={ac.id}
                    className="max-w-full max-h-full object-cover rounded"
                  />
                </div>
                <div className="p-3 bg-slate-900/30 border-t border-slate-850 space-y-1">
                  <div className="font-mono font-bold text-[11px] text-slate-300">{ac.id}</div>
                  <p className="text-[10px] text-slate-500 leading-normal">{ac.note || '场景透视/布局参考锚定'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-xs text-center py-8 border border-dashed border-slate-800 rounded-xl">
            该场景尚无定义锚定图 (Anchors)。
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceGallery({ images }: { images: string[] }) {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-200">参考媒体资产库 (Reference Gallery)</h2>
          <p className="text-xs text-slate-500 mt-1">存放于活动项目 <code>assets/reference/</code> 目录下的所有静态素材和视频文件。</p>
        </div>
        <div className="text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
          共 {images.length} 个文件
        </div>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {images.map((img, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col group hover:border-slate-700 transition">
              <div className="aspect-square bg-slate-950 flex items-center justify-center relative p-2 overflow-hidden">
                <img
                  src={`/api/assets/reference/${img}`}
                  alt="Gallery Item"
                  className="max-w-full max-h-full object-contain rounded transition group-hover:scale-105"
                />
              </div>
              <div className="p-3 bg-slate-900/50 border-t border-slate-850">
                <p className="text-xs text-slate-300 truncate font-semibold" title={img.split('/').pop()}>
                  {img.split('/').pop()}
                </p>
                <p className="text-[10px] font-mono text-slate-550 mt-1 truncate" title={img}>
                  {img}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
          <ImageIcon size={48} className="text-slate-800" />
          <div className="text-slate-500 text-sm">资产目录下没有媒体文件。你可以前往角色或道具编辑卡上传首张参考图。</div>
        </div>
      )}
    </div>
  );
}

function MissingReferencesAudit({ 
  reports, 
  onRefresh, 
  refreshing 
}: { 
  reports: MissingRef[]; 
  onRefresh: () => void; 
  refreshing: boolean; 
}) {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-200">项目断链审计报告 (References Integrity)</h2>
          <p className="text-xs text-slate-500 mt-1">扫描 timeline 所有分镜及库存规格声明，检测是否存在已引用但物理上缺失的文件（断链）。</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
        >
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          立即重新扫描
        </button>
      </div>

      {reports.length > 0 ? (
        <div className="space-y-4">
          <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-red-400 mt-0.5 flex-shrink-0" size={18} />
            <div>
              <h4 className="text-sm font-bold text-red-300">发现 {reports.length} 个缺失引用警告</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                这些缺失的文件可能是由于还未开始进行对应镜头的渲染（如 context_ref 引用了前序子镜头的尾帧，但该镜头尚未出片），或者由于配置文件中手动输入了错误的路径。这可能会影响本地提示词编译或者全量 Remotion 视频合成。
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                    <th className="p-3 font-semibold">缺失文件路径</th>
                    <th className="p-3 font-semibold">引用源位置 (Referenced By)</th>
                    <th className="p-3 font-semibold">引用类型 (Type)</th>
                    <th className="p-3 font-semibold">修复建议</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {reports.map((item, i) => {
                    const isContextRef = item.type === 'context_ref';
                    return (
                      <tr key={i} className="hover:bg-slate-900/30">
                        <td className="p-3 text-red-400 font-mono font-medium truncate max-w-[280px]" title={item.path}>
                          {item.path}
                        </td>
                        <td className="p-3 text-slate-300 font-mono">
                          {item.ref_by}
                        </td>
                        <td className="p-3">
                          <span className="bg-slate-950 px-2 py-0.5 rounded text-[10px] font-mono text-slate-450 uppercase border border-slate-850">
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 leading-normal">
                          {isContextRef ? (
                            <span>前序分镜渲染后，将其尾帧文件放置在 <code>{item.path}</code> 位置。</span>
                          ) : (
                            <span>修改 <code>{item.ref_by}</code> 或者在相应位置创建该资产文件。</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 border border-dashed border-emerald-800/40 bg-emerald-950/5 rounded-2xl flex flex-col items-center justify-center gap-3">
          <CheckCircle size={48} className="text-emerald-500" />
          <div className="text-emerald-300 text-sm font-bold">完美！没有发现任何断链引用。</div>
          <div className="text-slate-500 text-xs">所有分镜、参考图、连续性状态指向的文件都 100% 存在且可追踪。</div>
        </div>
      )}
    </div>
  );
}

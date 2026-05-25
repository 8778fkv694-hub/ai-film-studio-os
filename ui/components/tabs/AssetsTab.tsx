"use client";

import { useState, useEffect } from 'react';
import { Plus, User, Box, Trash2, CheckCircle, AlertCircle, Upload, Loader2 } from 'lucide-react';

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

type AssetType = 'characters' | 'props';

export default function AssetsTab() {
  const [activeType, setActiveType] = useState<AssetType>('characters');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Character | Prop | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const [charsRes, propsRes] = await Promise.all([
        fetch('/api/characters'),
        fetch('/api/props')
      ]);
      if (charsRes.ok) {
        const data = await charsRes.json();
        setCharacters(data);
        if (data.length > 0 && !selectedItem) setSelectedItem(data[0]);
      }
      if (propsRes.ok) {
        setProps(await propsRes.json());
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

  const saveCharacter = async (character: Character) => {
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(character)
      });
      if (res.ok) {
        showStatus('success', '角色已保存');
        loadAssets();
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
        showStatus('success', '道具已保存');
        loadAssets();
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
      formData.append('type', activeType);
      formData.append('id', id);

      const res = await fetch('/api/assets/reference/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showStatus('success', '参考图已上传');
        if (selectedItem) {
          const currentRefs = selectedItem.references?.images || [];
          const updatedItem = {
            ...selectedItem,
            references: {
              ...selectedItem.references,
              images: [...currentRefs, data.path]
            }
          };
          setSelectedItem(updatedItem);
          if (activeType === 'characters') {
            setCharacters(characters.map(c => c.id === id ? (updatedItem as Character) : c));
          } else {
            setProps(props.map(p => p.id === id ? (updatedItem as Prop) : p));
          }
        }
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
        body: JSON.stringify({ type: activeType, id, path: imgPath })
      });
      if (res.ok) {
        showStatus('success', '参考图已删除');
        if (selectedItem) {
          const currentRefs = selectedItem.references?.images || [];
          const updatedItem = {
            ...selectedItem,
            references: {
              ...selectedItem.references,
              images: currentRefs.filter(img => img !== imgPath)
            }
          };
          setSelectedItem(updatedItem);
          if (activeType === 'characters') {
            setCharacters(characters.map(c => c.id === id ? (updatedItem as Character) : c));
          } else {
            setProps(props.map(p => p.id === id ? (updatedItem as Prop) : p));
          }
        }
      } else {
        showStatus('error', '删除失败');
      }
    } catch {
      showStatus('error', '删除参考图时发生网络错误');
    }
  };

  const createNewAsset = () => {
    if (activeType === 'characters') {
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

  const currentList = activeType === 'characters' ? characters : props;

  if (loading) return <div className="p-8 text-slate-400">加载资产中...</div>;

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Type Switcher */}
        <div className="p-2 border-b border-slate-800 flex gap-1">
          <button
            onClick={() => {
              setActiveType('characters');
              setSelectedItem(characters[0] || null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition ${
              activeType === 'characters'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <User size={16} />
            角色
          </button>
          <button
            onClick={() => {
              setActiveType('props');
              setSelectedItem(props[0] || null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition ${
              activeType === 'props'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Box size={16} />
            道具
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {currentList.map((item: any) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={`w-full text-left p-3 rounded-lg mb-1 transition ${
                selectedItem?.id === item.id
                  ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-xs text-slate-500 mt-1">{item.id}</div>
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-slate-800">
          <button
            onClick={createNewAsset}
            className="w-full flex items-center justify-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition"
          >
            <Plus size={16} />
            新建{activeType === 'characters' ? '角色' : '道具'}
          </button>
        </div>
      </div>

      {/* Main Content */}
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

        {selectedItem && activeType === 'characters' && (
          <CharacterEditor
            character={selectedItem as Character}
            onChange={setSelectedItem}
            onSave={saveCharacter}
            onUploadRef={(file) => handleUploadReference(selectedItem.id, file)}
            onDeleteRef={(path) => handleDeleteReference(selectedItem.id, path)}
            uploadingRef={uploadingRef}
          />
        )}
        {selectedItem && activeType === 'props' && (
          <PropEditor
            prop={selectedItem as Prop}
            onChange={setSelectedItem}
            onSave={saveProp}
            onUploadRef={(file) => handleUploadReference(selectedItem.id, file)}
            onDeleteRef={(path) => handleDeleteReference(selectedItem.id, path)}
            uploadingRef={uploadingRef}
          />
        )}
        {!selectedItem && (
          <div className="flex items-center justify-center h-full text-slate-500">
            选择一个{activeType === 'characters' ? '角色' : '道具'}进行编辑
          </div>
        )}
      </div>
    </div>
  );
}

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
    const item = prompt('输入配饰名称:');
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
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
          <User size={32} className="text-slate-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-200">{character.name}</h2>
          <p className="text-slate-400 text-sm">{character.id}</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">角色 ID</label>
            <input
              type="text"
              value={character.id}
              onChange={(e) => onChange({ ...character, id: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">角色名称</label>
            <input
              type="text"
              value={character.name}
              onChange={(e) => onChange({ ...character, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>

      {/* Must Keep */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">必须保持 (Must Keep)</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">发型</label>
            <input
              type="text"
              value={mustKeep.hair || ''}
              onChange={(e) => onChange({
                ...character,
                must_keep: { ...mustKeep, hair: e.target.value }
              })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">服装</label>
            <input
              type="text"
              value={mustKeep.outfit || ''}
              onChange={(e) => onChange({
                ...character,
                must_keep: { ...mustKeep, outfit: e.target.value }
              })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">配饰</label>
            <div className="flex flex-wrap gap-2">
              {accessories.map((item, idx) => (
                <span
                  key={idx}
                  className="bg-yellow-900/30 text-yellow-300 px-3 py-1 rounded-full text-sm border border-yellow-800 flex items-center gap-1"
                >
                  {item}
                  <button
                    onClick={() => removeAccessory(idx)}
                    className="hover:text-yellow-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
              <button
                onClick={addAccessory}
                className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-sm hover:bg-slate-700 transition"
              >
                + 添加
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* References */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-200">参考图</h3>
          <label className="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-600/30">
            {uploadingRef ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Upload size={13} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {refImages.map((img, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col group relative">
                <div className="aspect-square bg-slate-900 flex items-center justify-center relative p-3">
                  <img
                    src={`/api/assets/reference/${img}`}
                    alt="Character Reference"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                  <button
                    onClick={() => onDeleteRef(img)}
                    className="absolute top-2 right-2 p-1.5 bg-red-950/80 hover:bg-red-800/90 text-red-300 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg"
                    title="删除图片"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="p-3 border-t border-slate-800/60 bg-slate-900/30">
                  <p className="text-[11px] font-mono text-slate-500 truncate" title={img}>
                    {img.split('/').pop()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-800 rounded-xl">
            暂无参考图，请点击上方按钮进行上传
          </div>
        )}
      </div>

      <button
        onClick={() => onSave(character)}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
      >
        保存角色
      </button>
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
        <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center">
          <Box size={32} className="text-slate-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-200">{prop.name}</h2>
          <p className="text-slate-400 text-sm">{prop.id}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">道具 ID</label>
            <input
              type="text"
              value={prop.id}
              onChange={(e) => onChange({ ...prop, id: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">道具名称</label>
            <input
              type="text"
              value={prop.name}
              onChange={(e) => onChange({ ...prop, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={prop.must_keep === true}
                onChange={(e) => onChange({ ...prop, must_keep: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700"
              />
              必须保持 (Must Keep)
            </label>
          </div>
        </div>
      </div>

      {/* References */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-200">参考图</h3>
          <label className="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-600/30">
            {uploadingRef ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Upload size={13} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {refImages.map((img, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col group relative">
                <div className="aspect-square bg-slate-900 flex items-center justify-center relative p-3">
                  <img
                    src={`/api/assets/reference/${img}`}
                    alt="Prop Reference"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                  <button
                    onClick={() => onDeleteRef(img)}
                    className="absolute top-2 right-2 p-1.5 bg-red-950/80 hover:bg-red-800/90 text-red-300 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-lg"
                    title="删除图片"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="p-3 border-t border-slate-800/60 bg-slate-900/30">
                  <p className="text-[11px] font-mono text-slate-500 truncate" title={img}>
                    {img.split('/').pop()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-sm text-center py-6 border border-dashed border-slate-800 rounded-xl">
            暂无参考图，请点击上方按钮进行上传
          </div>
        )}
      </div>

      <button
        onClick={() => onSave(prop)}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition font-medium"
      >
        保存道具
      </button>
    </div>
  );
}

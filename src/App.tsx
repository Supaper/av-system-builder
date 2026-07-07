import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  useReactFlow,
  ReactFlowProvider,
  MiniMap,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Minus, Maximize, Download, Upload, FileText, LayoutTemplate, Settings, Video, Mic, Cpu, Network, Monitor, Users, Radio, MoreHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FolderOpen, Save, Trash2, Grid, Map, Lock, Unlock, Undo2, Redo2, ClipboardList, Share2, Cloud, CloudOff, Search, X, Sun, Moon, Factory, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

import { useStore, getDefaultEquipmentImage, CATEGORY_LABELS } from './store';
import { getLayoutedElements } from './utils/layout';
import { processEdgesWithOffsets } from './utils/edgeProcessing';
import type { EquipmentCategory, Equipment } from './store';
import { EquipmentNode } from './EquipmentNode';
import { AddEquipmentModal } from './AddEquipmentModal';
import { AddLineTypeModal } from './AddLineTypeModal';
import { EditLineTypeModal } from './EditLineTypeModal';
import { EditNodeModal } from './EditNodeModal';
import { EditEquipmentModal } from './EditEquipmentModal';
import { CustomSmoothstepEdge } from './CustomSmoothstepEdge';
import { BulkImportModal } from './BulkImportModal';
import { AnnotationNode } from './AnnotationNode';
import { ShapeNode } from './ShapeNode';
import { EditAnnotationModal } from './EditAnnotationModal';
import { EditEdgeModal } from './EditEdgeModal';
import { BomBulkModal } from './BomBulkModal';
import { BomEdgeModal } from './BomEdgeModal';
import { BomReportModal } from './BomReportModal';
import { LoadPresetModal } from './LoadPresetModal';
import { ShareModal } from './ShareModal';
import { loadSharedDiagram } from './cloud';
import { startLibrarySync, type SyncStatus } from './librarySync';
import { isFirebaseConfigured } from './firebaseConfig';
import type { DiagramPreset } from './store';
import './App.css';

const nodeTypes = {
  equipment: EquipmentNode,
  annotation: AnnotationNode,
  shape: ShapeNode,
};

const edgeTypes = {
  customSmoothstep: CustomSmoothstepEdge,
};


function FlowBuilder() {
  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect, setNodes, setEdges,
    equipmentDB, importEquipmentDB, bulkImportEquipment, lineTypes,
    presets, savePreset, loadPreset, addPresetToCanvas, deletePreset, importPresets, importDiagramState,
    history, undo, redo, saveToHistory,
  } = useStore();

  const [hiddenLineTypeIds, setHiddenLineTypeIds] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [equipmentSearch, setEquipmentSearch] = useState('');

  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('av-builder-theme') as 'dark' | 'light') || 'dark'
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('av-builder-theme', theme);
  }, [theme]);

  const [groupMode, setGroupMode] = useState<'category' | 'manufacturer'>(() =>
    (localStorage.getItem('av-builder-group-mode') as 'category' | 'manufacturer') || 'category'
  );
  useEffect(() => {
    localStorage.setItem('av-builder-group-mode', groupMode);
  }, [groupMode]);

  const filteredEquipmentDB = useMemo(() => {
    const q = equipmentSearch.trim().toLowerCase();
    if (!q) return equipmentDB;
    return equipmentDB.filter(eq =>
      eq.name.toLowerCase().includes(q) || eq.model.toLowerCase().includes(q)
    );
  }, [equipmentDB, equipmentSearch]);

  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  const processedEdges = useMemo(
    () => processEdgesWithOffsets(edges, nodes),
    [edges, nodes]
  );

  const visibleEdges = useMemo(() => {
    return processedEdges.filter(edge => {
      const strokeColor = edge.style?.stroke;
      let lineTypeId = (edge as any).data?.lineTypeId;
      if (!lineTypeId && strokeColor) {
        const matched = lineTypes.find(lt => lt.color.toLowerCase() === strokeColor.toLowerCase());
        if (matched) {
          lineTypeId = matched.id;
        }
      }
      if (!lineTypeId) return true;
      return !hiddenLineTypeIds.includes(lineTypeId);
    });
  }, [processedEdges, hiddenLineTypeIds, lineTypes]);

  const [isBomMode, setIsBomMode] = useState(false);
  const [isBomBulkModalOpen, setIsBomBulkModalOpen] = useState(false);
  const [isBomReportModalOpen, setIsBomReportModalOpen] = useState(false);
  const [editingBomEdge, setEditingBomEdge] = useState<string | null>(null);

  // BOM 모드일 때 각 엣지 data에 isBomMode 플래그 주입
  const finalEdges = useMemo(() => {
    if (!isBomMode) return visibleEdges;
    return visibleEdges.map(edge => ({
      ...edge,
      data: { ...(edge.data as any), isBomMode: true },
    }));
  }, [visibleEdges, isBomMode]);

  const processedNodes = useMemo(() => {
    const isFilterActive = hiddenLineTypeIds.length > 0;
    return nodes.map(node => {
      if (node.type && node.type !== 'equipment') {
        return node;
      }
      const isConnected = visibleEdges.some(e => e.source === node.id || e.target === node.id);
      return {
        ...node,
        data: {
          ...node.data,
          dimmed: isFilterActive && !isConnected
        }
      };
    });
  }, [nodes, visibleEdges, hiddenLineTypeIds]);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      const isUndo = mod && !e.shiftKey && e.key.toLowerCase() === 'z';
      const isRedo = mod && (e.shiftKey ? e.key.toLowerCase() === 'z' : e.key.toLowerCase() === 'y');

      if (isUndo) { undo(); e.preventDefault(); return; }
      if (isRedo) { redo(); e.preventDefault(); return; }

      const isCopy = mod && e.key.toLowerCase() === 'c';
      const isPaste = mod && e.key.toLowerCase() === 'v';

      if (isCopy) {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const edgesToCopy = edges.filter(
          edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
        );

        setClipboard({
          nodes: selectedNodes,
          edges: edgesToCopy,
        });
        e.preventDefault();
      }

      if (isPaste && clipboard) {
        saveToHistory();
        const idMap: Record<string, string> = {};
        const timestamp = Date.now();

        const clonedNodes = clipboard.nodes.map((node, idx) => {
          const newId = `node_${timestamp}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
          idMap[node.id] = newId;

          return {
            ...node,
            id: newId,
            selected: true,
            position: {
              x: node.position.x + 40,
              y: node.position.y + 40,
            },
          };
        });

        const clonedEdges = clipboard.edges.map((edge, idx) => {
          const newSource = idMap[edge.source];
          const newTarget = idMap[edge.target];
          return {
            ...edge,
            id: `e-cloned-${timestamp}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            source: newSource,
            target: newTarget,
            selected: true,
          };
        });

        // Deselect previous selection
        const resetNodes = nodes.map(n => ({ ...n, selected: false }));
        const resetEdges = edges.map(e => ({ ...e, selected: false }));

        setNodes([...resetNodes, ...clonedNodes]);
        setEdges([...resetEdges, ...clonedEdges]);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, edges, clipboard, setNodes, setEdges, undo, redo]);
  
  const [isEqModalOpen, setIsEqModalOpen] = useState(false);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<{id: string, data: Equipment} | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<{id: string, type: 'annotation' | 'shape', data: any} | null>(null);
  const [editingEdge, setEditingEdge] = useState<{id: string, label: string} | null>(null);
  const [loadingPreset, setLoadingPreset] = useState<DiagramPreset | null>(null);
  const [editingLineType, setEditingLineType] = useState<any>(null);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLoadState, setShareLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isFirebaseConfigured ? 'connecting' : 'off');

  // 새로만들기 상태
  const [newDiagramStep, setNewDiagramStep] = useState<'idle' | 'confirm' | 'naming'>('idle');
  const [newSaveName, setNewSaveName] = useState('');

  const handleNewDiagram = () => {
    if (nodes.length === 0 && edges.length === 0) {
      setNodes([]); setEdges([]);
      return;
    }
    setNewDiagramStep('confirm');
  };
  const confirmNewSave = () => {
    if (!newSaveName.trim()) return;
    savePreset(newSaveName.trim());
    setNodes([]); setEdges([]);
    setNewDiagramStep('idle'); setNewSaveName('');
  };
  const confirmNewDiscard = () => {
    setNodes([]); setEdges([]);
    setNewDiagramStep('idle'); setNewSaveName('');
  };
  
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [isDiagramLocked, setIsDiagramLocked] = useState(false);
  
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(CATEGORY_LABELS).map(k => [k, true]))
  );
  const [openSubGroups, setOpenSubGroups] = useState<Record<string, boolean>>({});

  const [presetName, setPresetName] = useState('');
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // On mount: check if this tab was opened with a pending preset via new-tab load,
  // or with a cloud share link (?share=<id>).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const shareId = params.get('share');
    if (shareId) {
      setShareLoadState('loading');
      loadSharedDiagram(shareId)
        .then(diagram => {
          if (diagram) {
            importDiagramState(diagram);
            setShareLoadState('idle');
          } else {
            setShareLoadState('error');
          }
        })
        .catch(() => setShareLoadState('error'))
        .finally(() => {
          window.history.replaceState({}, '', window.location.pathname);
        });
      return;
    }

    const token = params.get('preset');
    if (token) {
      try {
        const raw = localStorage.getItem(`av-pending-preset-${token}`);
        if (raw) {
          const preset = JSON.parse(raw);
          localStorage.removeItem(`av-pending-preset-${token}`);
          importDiagramState(preset);
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch (_) {}
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 팀 공용 라이브러리(장비 DB·라인 타입·프리셋) 실시간 동기화 시작
  useEffect(() => {
    void startLibrarySync(setSyncStatus);
  }, []);

  const handleOpenPresetInNewTab = (preset: DiagramPreset) => {
    const token = Date.now().toString(36);
    localStorage.setItem(`av-pending-preset-${token}`, JSON.stringify(preset));
    window.open(`${window.location.origin}${window.location.pathname}?preset=${token}`);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setIsAddMenuOpen(false);
        setIsImportMenuOpen(false);
        setIsExportMenuOpen(false);
        setIsPresetMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [setIsPresetMenuOpen]);

  const handleExportPresets = () => {
    try {
      const dataStr = JSON.stringify(presets, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `av_builder_presets_${Date.now()}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (e) {
      alert('Failed to export presets.');
    }
  };

  const onDragStart = (event: React.DragEvent, equipmentId: string) => {
    event.dataTransfer.setData('application/reactflow', equipmentId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const equipmentId = event.dataTransfer.getData('application/reactflow');
      if (!equipmentId) return;

      const equipment = equipmentDB.find(eq => eq.id === equipmentId);
      if (!equipment) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type: 'equipment',
        position,
        data: { ...equipment },
      };

      saveToHistory();
      setNodes([...nodes, newNode]);
    },
    [screenToFlowPosition, equipmentDB, nodes, setNodes, saveToHistory],
  );

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'annotation' || node.type === 'shape') {
      setEditingAnnotation({ id: node.id, type: node.type as any, data: node.data });
    } else {
      setEditingNode({ id: node.id, data: node.data as unknown as Equipment });
    }
  }, []);

  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (isBomMode) {
      setEditingBomEdge(edge.id);
    } else {
      const currentLabel = (edge.data as any)?.label ?? '';
      setEditingEdge({ id: edge.id, label: currentLabel });
    }
  }, [isBomMode]);

  // 카테고리 정의는 store.ts의 CATEGORY_LABELS가 단일 소스 — 여기서는 아이콘만 매핑.
  // Record<EquipmentCategory, ...> 타입이라 카테고리를 추가하면 컴파일 에러로 누락이 잡힌다.
  const categoryIcons: Record<EquipmentCategory, LucideIcon> = {
    video: Video,
    display: Monitor,
    conferencing: Users,
    audio: Mic,
    control: Cpu,
    network: Network,
    broadcast: Radio,
    etc: MoreHorizontal,
  };

  const categories = (Object.entries(CATEGORY_LABELS) as [EquipmentCategory, string][])
    .map(([key, label]) => ({ key, label, icon: categoryIcons[key] }));

  // 사이드바 대분류 섹션 — 카테고리 모드는 고정 8종, 제조사 모드는 데이터에서 동적 생성
  const librarySections: { key: string; label: string; icon: LucideIcon; items: Equipment[] }[] =
    groupMode === 'category'
      ? categories.map(cat => ({
          key: cat.key,
          label: cat.label,
          icon: cat.icon,
          items: filteredEquipmentDB.filter(eq => eq.category === cat.key),
        }))
      : (() => {
          // 주의: Map은 lucide-react 아이콘 import에 가려져 있어 Record 사용
          const byMfr: Record<string, Equipment[]> = {};
          filteredEquipmentDB.forEach(eq => {
            const mfr = (eq.manufacturer || '').trim() || '미지정';
            (byMfr[mfr] ??= []).push(eq);
          });
          return Object.entries(byMfr)
            .sort((a, b) => {
              if (a[0] === '미지정') return 1;
              if (b[0] === '미지정') return -1;
              return a[0].localeCompare(b[0], 'ko');
            })
            .map(([mfr, items]) => ({ key: `mfr::${mfr}`, label: mfr, icon: Factory, items }));
        })();

  const handleExportDB = () => {
    const data = JSON.stringify(equipmentDB, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'equipment-db.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          importEquipmentDB(json);
        }
      } catch (err) {
        alert("Failed to parse JSON DB");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportDiagram = () => {
    const diagramState = {
      version: '1.1',
      nodes,
      edges,
      lineTypes,
      equipmentDB
    };
    const data = JSON.stringify(diagramState, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `av-diagram-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDiagram = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && (json.nodes || json.edges)) {
          importDiagramState(json);
          alert("Diagram state loaded successfully!");
        } else {
          alert("Invalid diagram state file structure.");
        }
      } catch (err) {
        alert("Failed to parse Diagram state JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPDF = async () => {
    const element = document.querySelector('.react-flow') as HTMLElement;
    if (!element) return;
    
    // Fit view before capturing
    fitView();
    
    // Add exporting class to hide UI overlays
    element.classList.add('exporting');
    
    // wait a tiny bit for render and class application
    setTimeout(async () => {
      try {
        const dataUrl = await toPng(element, {
          backgroundColor: theme === 'light' ? '#f1f5f9' : '#0f172a',
          filter: () => {
            // Alternatively, use HTML filter to exclude controls, but CSS class is easier
            return true;
          }
        });
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [element.offsetWidth, element.offsetHeight]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, element.offsetWidth, element.offsetHeight);
        pdf.save('av-diagram.pdf');
      } catch (error) {
        console.error('Error generating PDF', error);
      } finally {
        element.classList.remove('exporting');
      }
    }, 150);
  };

  const handleAutoLayout = useCallback(() => {
    saveToHistory();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);

    window.requestAnimationFrame(() => {
      fitView();
    });
  }, [nodes, edges, setNodes, setEdges, fitView, saveToHistory]);

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const isValidConnection = useCallback((connection: any) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    
    // Check if duplicate connection already exists (including in reverse direction)
    const isDuplicate = edges.some(edge => 
      (edge.source === source && edge.target === target && edge.sourceHandle === sourceHandle && edge.targetHandle === targetHandle) ||
      (edge.source === target && edge.target === source && edge.sourceHandle === targetHandle && edge.targetHandle === sourceHandle)
    );
    if (isDuplicate) return false;
    
    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);
    if (!sourceNode || !targetNode) return false;
    
    const getCleanPortId = (handleId: string | null) => {
      if (!handleId) return '';
      if (handleId.startsWith('source_') || handleId.startsWith('target_')) {
        return handleId.substring(7); // Remove source_ or target_ prefix
      }
      return handleId;
    };
    
    const handleAPortId = getCleanPortId(sourceHandle);
    const handleBPortId = getCleanPortId(targetHandle);
    
    const eqA = sourceNode.data as unknown as Equipment;
    const portA = 
      eqA.outputs.find(p => p.id === handleAPortId) || 
      eqA.inputs.find(p => p.id === handleAPortId) ||
      (eqA.bidirectional && eqA.bidirectional.find(p => p.id === handleAPortId));
      
    const eqB = targetNode.data as unknown as Equipment;
    const portB = 
      eqB.outputs.find(p => p.id === handleBPortId) || 
      eqB.inputs.find(p => p.id === handleBPortId) ||
      (eqB.bidirectional && eqB.bidirectional.find(p => p.id === handleBPortId));
      
    if (!portA || !portB) return false;
    
    return portA.type === portB.type;
  }, [nodes, edges]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        {/* Title */}
        <div className="header-title">
          <Settings size={14} color="var(--accent-color)" />
          <span>AV System Builder</span>
          <span className="version-tag">v1.18</span>
          <button
            className="glass-button icon-btn"
            onClick={handleNewDiagram}
            title="새 구성도 만들기"
            style={{ marginLeft: 4, fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={11} /> New
          </button>
          {(() => {
            const map: Record<SyncStatus, { color: string; label: string; icon: LucideIcon }> = {
              off:        { color: '#64748b', label: '로컬 전용',   icon: CloudOff },
              connecting: { color: '#f59e0b', label: '동기화 중…',  icon: Cloud },
              synced:     { color: '#22c55e', label: '클라우드 동기화', icon: Cloud },
              error:      { color: '#ef4444', label: '동기화 오류',  icon: CloudOff },
            };
            const s = map[syncStatus];
            const Icon = s.icon;
            return (
              <span
                title={
                  syncStatus === 'off'
                    ? 'Firebase 미설정 — 이 기기에만 저장됩니다'
                    : syncStatus === 'synced'
                    ? '장비 DB·라인 타입·프리셋이 팀 공용으로 실시간 동기화됩니다'
                    : s.label
                }
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6,
                  fontSize: 10, fontWeight: 600, color: s.color,
                  padding: '2px 7px', borderRadius: 10,
                  background: `${s.color}1a`, border: `1px solid ${s.color}44`,
                  userSelect: 'none',
                }}
              >
                <Icon size={11} className={syncStatus === 'connecting' ? 'spin' : undefined} />
                {s.label}
              </span>
            );
          })()}
        </div>

        {/* Center Toolbar */}
        <div className="header-center">
          {/* Line Filter Chips */}
          {lineTypes.map(type => {
            const isVisible = !hiddenLineTypeIds.includes(type.id);
            return (
              <button
                key={type.id}
                onClick={() => setHiddenLineTypeIds(prev =>
                  isVisible ? [...prev, type.id] : prev.filter(id => id !== type.id)
                )}
                onDoubleClick={() => setEditingLineType(type)}
                className="glass-button filter-chip"
                style={{
                  background: isVisible ? `${type.color}22` : 'transparent',
                  borderColor: isVisible ? `${type.color}66` : 'var(--panel-border)',
                  color: isVisible ? 'var(--text-primary)' : 'var(--text-secondary)',
                  opacity: isVisible ? 1 : 0.55,
                  userSelect: 'none',
                }}
                title="Click to toggle · Double-click to edit"
              >
                <span className="chip-dot" style={{ background: isVisible ? type.color : 'var(--text-secondary)' }} />
                {type.name}
              </button>
            );
          })}

          <div className="control-divider" />

          {/* Auto Layout */}
          <button className="glass-button" onClick={handleAutoLayout}>
            <LayoutTemplate size={13} /> Auto Layout
          </button>

          <div className="control-divider" />

          {/* Zoom controls */}
          <button type="button" className="glass-button icon-btn" onClick={() => zoomIn()} title="Zoom In">
            <Plus size={13} />
          </button>
          <button type="button" className="glass-button icon-btn" onClick={() => zoomOut()} title="Zoom Out">
            <Minus size={13} />
          </button>
          <button type="button" className="glass-button icon-btn" onClick={() => fitView({ duration: 400 })} title="Fit View">
            <Maximize size={13} />
          </button>

          <div className="control-divider" />

          {/* Grid & MiniMap */}
          <button
            type="button"
            className={`glass-button icon-btn${snapToGrid ? ' primary' : ''}`}
            onClick={() => setSnapToGrid(!snapToGrid)}
            title="Snap to Grid"
          >
            <Grid size={13} />
          </button>
          <button
            type="button"
            className={`glass-button icon-btn${showMiniMap ? ' primary' : ''}`}
            onClick={() => setShowMiniMap(!showMiniMap)}
            title="Toggle MiniMap"
          >
            <Map size={13} />
          </button>

          <div className="control-divider" />

          {/* Lock */}
          <button
            type="button"
            className={`glass-button icon-btn${isDiagramLocked ? ' primary' : ''}`}
            onClick={() => setIsDiagramLocked(!isDiagramLocked)}
            title={isDiagramLocked ? 'Unlock Canvas' : 'Lock Canvas'}
            style={isDiagramLocked ? { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.15)' } : undefined}
          >
            {isDiagramLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>

          <div className="control-divider" />

          {/* Undo / Redo */}
          <button
            type="button"
            className="glass-button icon-btn"
            onClick={undo}
            disabled={history.past.length === 0}
            title="Undo (Ctrl+Z)"
            style={{ opacity: history.past.length === 0 ? 0.3 : 1 }}
          >
            <Undo2 size={13} />
          </button>
          <button
            type="button"
            className="glass-button icon-btn"
            onClick={redo}
            disabled={history.future.length === 0}
            title="Redo (Ctrl+Y)"
            style={{ opacity: history.future.length === 0 ? 0.3 : 1 }}
          >
            <Redo2 size={13} />
          </button>

        </div>

        {/* Right Actions */}
        <div className="header-actions">
          {/* Theme Toggle */}
          <button
            className="glass-button icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {/* Preset Manager Dropdown */}
          <div className="dropdown-container">
            <button className="glass-button" onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}>
              <LayoutTemplate size={13} /> Presets ({presets.length})
            </button>
            {isPresetMenuOpen && (
              <div className="glass-panel" style={{
                position: 'absolute',
                top: '40px',
                right: 0,
                width: '300px',
                padding: '16px',
                borderRadius: '8px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                border: '1px solid var(--panel-border)'
              }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', borderBottom: '1px solid var(--panel-border)', paddingBottom: '6px', margin: 0 }}>
                  Manage Presets
                </h4>
                
                {/* Save Current */}
                <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Save current configuration:</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      className="glass-input"
                      placeholder="Preset name..."
                      style={{ flex: 1 }}
                      value={presetName}
                      onChange={e => setPresetName(e.target.value)}
                    />
                    <button
                      className="glass-button primary"
                      onClick={() => { if (!presetName.trim()) return; savePreset(presetName.trim()); setPresetName(''); }}
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Preset List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Saved presets:</span>
                  {presets.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>No presets yet.</span>
                  ) : (
                    presets.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 8px', background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', gap: '6px'
                      }}>
                        <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>
                          {p.name}
                        </span>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            className="glass-button icon-btn"
                            style={{ color: '#60a5fa', border: 'none', background: 'transparent' }}
                            title="불러오기 옵션"
                            onClick={() => { setLoadingPreset(p); setIsPresetMenuOpen(false); }}
                          >
                            <FolderOpen size={12} />
                          </button>
                          <button className="glass-button icon-btn" style={{ color: '#10b981', border: 'none', background: 'transparent' }} title="Overwrite"
                            onClick={() => { if (confirm(`Overwrite "${p.name}"?`)) savePreset(p.name, p.id); }}>
                            <Save size={12} />
                          </button>
                          <button className="glass-button icon-btn" style={{ color: '#ef4444', border: 'none', background: 'transparent' }} title="Delete"
                            onClick={() => { if (confirm(`Delete "${p.name}"?`)) deletePreset(p.id); }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Import / Export Presets File */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--panel-border)', paddingTop: '10px' }}>
                  <button className="glass-button" style={{ flex: 1, justifyContent: 'center' }} onClick={handleExportPresets}>
                    <Download size={12} /> Export File
                  </button>
                  <button className="glass-button" style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          try {
                            const imported = JSON.parse(evt.target?.result as string);
                            if (Array.isArray(imported)) {
                              const isValid = imported.every(p => 
                                p && typeof p === 'object' && p.id && p.name && Array.isArray(p.nodes) && Array.isArray(p.edges)
                              );
                              if (isValid) {
                                importPresets(imported);
                                alert(`Successfully imported ${imported.length} presets!`);
                              } else {
                                alert('Invalid presets file format.');
                              }
                            } else {
                              alert('Invalid file format: Presets must be a JSON array.');
                            }
                          } catch (err) {
                            alert('Failed to parse JSON file.');
                          }
                        };
                        reader.readAsText(file);
                      };
                      input.click();
                    }}
                  >
                    <Upload size={13} /> Import File
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="control-divider" style={{ height: 18 }} />

          {/* Add Dropdown */}
          <div className="dropdown-container">
            <button className="glass-button primary" onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}>
              <Plus size={13} /> Add <ChevronDown size={11} />
            </button>
            {isAddMenuOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => { setIsEqModalOpen(true); setIsAddMenuOpen(false); }}>
                  <Plus size={14} /> Add Equipment
                </button>
                <button className="dropdown-item" onClick={() => { setIsLineModalOpen(true); setIsAddMenuOpen(false); }}>
                  <Plus size={14} /> Add Line Type
                </button>
                <button className="dropdown-item" onClick={() => {
                  const newNode: Node = {
                    id: `annotation_${Date.now()}`,
                    type: 'annotation',
                    position: { x: 100, y: 100 },
                    data: {
                      label: 'New note (Double-click to edit)',
                      fontSize: 14,
                      fontColor: '#ffffff',
                      bgColor: '#1e293b',
                      bgOpacity: 0.8,
                      borderColor: '#38bdf8',
                      borderStyle: 'dashed',
                      borderRadius: 8,
                      textAlign: 'center',
                    },
                    style: { width: 200, height: 60 }
                  };
                  setNodes([...nodes, newNode]);
                  setIsAddMenuOpen(false);
                }}>
                  <Plus size={14} /> Add Text Annotation
                </button>
                <button className="dropdown-item" onClick={() => {
                  const newNode: Node = {
                    id: `shape_${Date.now()}`,
                    type: 'shape',
                    position: { x: 100, y: 100 },
                    data: {
                      shapeType: 'rectangle',
                      label: 'ZONE BOX',
                      fontSize: 14,
                      fontColor: '#94a3b8',
                      bgColor: '#1e293b',
                      bgOpacity: 0.25,
                      borderColor: '#475569',
                      borderStyle: 'solid',
                      borderWidth: 2,
                    },
                    style: { width: 350, height: 250 }
                  };
                  setNodes([...nodes, newNode]);
                  setIsAddMenuOpen(false);
                }}>
                  <Plus size={14} /> Add Shape / Zone
                </button>
                <div style={{ height: 1, background: 'var(--panel-border)', margin: '4px 0' }} />
                <button className="dropdown-item" onClick={() => { setIsBulkImportModalOpen(true); setIsAddMenuOpen(false); }}>
                  <Upload size={14} /> Bulk Import (Excel/CSV)
                </button>
              </div>
            )}
          </div>

          {/* Import Dropdown */}
          <div className="dropdown-container">
            <button className="glass-button" onClick={() => setIsImportMenuOpen(!isImportMenuOpen)}>
              <Upload size={13} /> Import <ChevronDown size={11} />
            </button>
            {isImportMenuOpen && (
              <div className="dropdown-menu">
                <label className="dropdown-item" style={{ cursor: 'pointer' }}>
                  <Upload size={14} /> Import Diagram
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { handleImportDiagram(e); setIsImportMenuOpen(false); }} />
                </label>
                <label className="dropdown-item" style={{ cursor: 'pointer' }}>
                  <Upload size={14} /> Import Equipment DB
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { handleImportDB(e); setIsImportMenuOpen(false); }} />
                </label>
                <button className="dropdown-item" onClick={() => {
                  setIsImportMenuOpen(false);
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      try {
                        const imported = JSON.parse(evt.target?.result as string);
                        if (Array.isArray(imported)) {
                          const isValid = imported.every(p => 
                            p && typeof p === 'object' && p.id && p.name && Array.isArray(p.nodes) && Array.isArray(p.edges)
                          );
                          if (isValid) {
                            importPresets(imported);
                            alert(`Successfully imported ${imported.length} presets!`);
                          } else {
                            alert('Invalid presets file format.');
                          }
                        } else {
                          alert('Invalid file format: Presets must be a JSON array.');
                        }
                      } catch (err) {
                        alert('Failed to parse JSON file.');
                      }
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}>
                  <Upload size={14} /> Import Presets File
                </button>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="dropdown-container">
            <button className="glass-button" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}>
              <Download size={13} /> Export <ChevronDown size={11} />
            </button>
            {isExportMenuOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => { handleExportDiagram(); setIsExportMenuOpen(false); }}>
                  <Download size={14} /> Export Diagram
                </button>
                <button className="dropdown-item" onClick={() => { handleExportDB(); setIsExportMenuOpen(false); }}>
                  <Download size={14} /> Export Equipment DB
                </button>
                <button className="dropdown-item" onClick={() => { handleExportPresets(); setIsExportMenuOpen(false); }}>
                  <Download size={14} /> Export Presets File
                </button>
                <div style={{ height: 1, background: 'var(--panel-border)', margin: '4px 0' }} />
                <button className="dropdown-item" onClick={() => { handleExportPDF(); setIsExportMenuOpen(false); }}>
                  <FileText size={14} /> Export PDF
                </button>
              </div>
            )}
          </div>

          {/* Share (Cloud) */}
          <div className="control-divider" style={{ height: 18 }} />
          <button
            type="button"
            className="glass-button"
            onClick={() => setIsShareModalOpen(true)}
            title="클라우드 공유 링크 생성"
          >
            <Share2 size={13} /> Share
          </button>

          {/* BOM Section — always rightmost so BOM toggle never shifts when sub-buttons appear */}
          <div className="control-divider" style={{ height: 18 }} />
          {isBomMode && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                type="button"
                className="glass-button"
                onClick={() => setIsBomBulkModalOpen(true)}
                title="전체 케이블 일괄 입력"
                style={{ fontSize: 12 }}
              >
                <ClipboardList size={13} /> 일괄 입력
              </button>
              <button
                type="button"
                className="glass-button"
                onClick={() => setIsBomReportModalOpen(true)}
                title="케이블 명세서 보기"
                style={{ fontSize: 12, borderColor: '#34d399', color: '#34d399', background: 'rgba(52,211,153,0.12)' }}
              >
                <FileText size={13} /> BOM 보기
              </button>
              <div className="control-divider" style={{ height: 18 }} />
            </div>
          )}
          <button
            type="button"
            className={`glass-button${isBomMode ? ' primary' : ''}`}
            onClick={() => setIsBomMode(prev => !prev)}
            title="BOM 케이블 명세 모드"
            style={isBomMode ? { borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245,158,11,0.15)' } : undefined}
          >
            <FileText size={13} /> BOM
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* Sidebar */}
        <aside className={`sidebar glass-panel${isSidebarCollapsed ? ' collapsed' : ''}`}>
          <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 500, margin: 0 }}>Equipment Library</h3>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="glass-button"
              style={{ padding: '4px', border: 'none', background: 'transparent' }}
              title="Collapse Library"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
          <div style={{ position: 'relative', padding: '0 12px 8px' }}>
            <Search size={13} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="glass-input"
              placeholder="장비 검색 (이름·모델)"
              value={equipmentSearch}
              onChange={(e) => setEquipmentSearch(e.target.value)}
              style={{ width: '100%', fontSize: 12, padding: '6px 26px' }}
            />
            {equipmentSearch && (
              <button
                type="button"
                onClick={() => setEquipmentSearch('')}
                title="검색어 지우기"
                style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          {/* 그룹핑 모드 토글 — 카테고리 / 제조사 */}
          <div style={{ display: 'flex', gap: 4, padding: '0 12px 10px' }}>
            <button
              type="button"
              className={`glass-button${groupMode === 'category' ? ' primary' : ''}`}
              style={{ flex: 1, fontSize: 11 }}
              onClick={() => setGroupMode('category')}
            >
              <LayoutGrid size={12} /> 카테고리
            </button>
            <button
              type="button"
              className={`glass-button${groupMode === 'manufacturer' ? ' primary' : ''}`}
              style={{ flex: 1, fontSize: 11 }}
              onClick={() => setGroupMode('manufacturer')}
            >
              <Factory size={12} /> 제조사
            </button>
          </div>
          <div className="sidebar-content">
            {librarySections.map((section) => {
              const isSearching = equipmentSearch.trim().length > 0;
              const items = section.items;
              if (isSearching && items.length === 0) return null;
              // 카테고리 모드는 기본 펼침(초기 state 시드), 제조사 모드는 섹션이 많아 기본 접힘
              const isOpen = isSearching ? true : (openCategories[section.key] ?? false);

              // name(제품명) 기준 소그룹 — 항목 수와 무관하게 항상 접이식으로 표시
              const groups: { name: string; items: Equipment[] }[] = [];
              items.forEach(eq => {
                const g = groups.find(g => g.name === eq.name);
                if (g) g.items.push(eq);
                else groups.push({ name: eq.name, items: [eq] });
              });

              const renderEquipmentItem = (eq: Equipment) => {
                const displayImg = eq.imageUrl || getDefaultEquipmentImage(eq.name, eq.category);
                const FallbackIcon = categoryIcons[eq.category] || MoreHorizontal;
                return (
                  <div
                    key={eq.id}
                    className="equipment-item"
                    draggable
                    onDragStart={(e) => onDragStart(e, eq.id)}
                    onDoubleClick={() => setEditingEquipment(eq)}
                    title="더블클릭하여 장비 정보 편집"
                  >
                    <div className={`equipment-icon ${eq.category}`} style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: displayImg ? 0 : undefined }}>
                      {displayImg ? (
                        <img src={displayImg} alt={eq.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <FallbackIcon size={16} />
                      )}
                    </div>
                    <div className="equipment-info">
                      <div className="equipment-name">{eq.model}</div>
                      <div className="equipment-model">{eq.name}{eq.manufacturer ? ` · ${eq.manufacturer}` : ''}</div>
                    </div>
                  </div>
                );
              };

              return (
              <div key={section.key} className="equipment-category">
                <div
                  className="category-title"
                  style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => toggleCategory(section.key)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <section.icon size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {section.label} {groupMode === 'manufacturer' && `(${items.length})`}
                    </span>
                  </span>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                {isOpen && groups.map(group => {
                  const subKey = `${section.key}::${group.name}`;
                  const isSubOpen = isSearching ? true : (openSubGroups[subKey] ?? false);
                  return (
                    <div key={subKey}>
                      <div
                        className="equipment-subgroup-title"
                        onClick={() => setOpenSubGroups(prev => ({ ...prev, [subKey]: !isSubOpen }))}
                      >
                        <span>{group.name} ({group.items.length})</span>
                        {isSubOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </div>
                      {isSubOpen && (
                        <div className="equipment-subgroup-items">
                          {group.items.map(eq => renderEquipmentItem(eq))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        </aside>

        {/* Canvas */}
        <main className={`canvas-area ${isDiagramLocked ? 'diagram-locked' : ''}`} ref={reactFlowWrapper} style={{ position: 'relative' }}>
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="glass-button"
              style={{
                position: 'absolute', left: '16px', top: '16px', zIndex: 10,
                padding: '6px 10px', borderRadius: '8px',
                display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
              title="Open Equipment Library"
            >
              <ChevronRight size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Library</span>
            </button>
          )}
          <ReactFlow
            nodes={processedNodes}
            edges={finalEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onDrop={onDrop}
            onDragOver={onDragOver}
            isValidConnection={isValidConnection}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{ type: 'customSmoothstep' }}
            snapToGrid={snapToGrid}
            snapGrid={[15, 15]}
            nodesDraggable={!isDiagramLocked}
          >
            <Background color={theme === 'light' ? 'rgba(15, 23, 42, 0.18)' : 'rgba(255, 255, 255, 0.1)'} gap={16} />

            {/* Standalone Floating MiniMap (Conditional) - Nested inside ReactFlow to use context */}
            {showMiniMap && (
              <div 
                className="glass-panel react-flow__panel" 
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  zIndex: 10,
                  padding: '6px',
                  borderRadius: '12px',
                  boxSizing: 'border-box',
                  border: '1px solid var(--panel-border)',
                  backgroundColor: theme === 'light' ? 'rgba(241, 245, 249, 0.7)' : 'rgba(15, 23, 42, 0.6)',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                  margin: 0,
                  pointerEvents: 'all'
                }}
              >
                <MiniMap 
                  style={{ 
                    width: 200,
                    height: 130,
                    borderRadius: '8px',
                    margin: 0,
                    backgroundColor: 'transparent',
                    border: 'none'
                  }}
                  nodeColor={(node) => {
                    if (node.type === 'shape') return '#10b981';
                    if (node.type === 'annotation') return '#38bdf8';
                    return '#6366f1';
                  }}
                  maskColor={theme === 'light' ? 'rgba(148, 163, 184, 0.35)' : 'rgba(0, 0, 0, 0.4)'}
                  zoomable
                  pannable
                />
              </div>
            )}
          </ReactFlow>
        </main>
      </div>

      {isEqModalOpen && <AddEquipmentModal onClose={() => setIsEqModalOpen(false)} />}
      {isLineModalOpen && <AddLineTypeModal onClose={() => setIsLineModalOpen(false)} />}
      {isBulkImportModalOpen && (
        <BulkImportModal 
          isOpen={isBulkImportModalOpen} 
          onClose={() => setIsBulkImportModalOpen(false)} 
          onImport={(imported, mergeMode) => bulkImportEquipment(imported as any, mergeMode)}
        />
      )}
      {editingLineType && (
        <EditLineTypeModal 
          lineType={editingLineType} 
          onClose={() => setEditingLineType(null)} 
        />
      )}
      {editingNode && (
        <EditNodeModal
          nodeId={editingNode.id}
          initialData={editingNode.data}
          onClose={() => setEditingNode(null)}
        />
      )}
      {editingEquipment && (
        <EditEquipmentModal
          equipment={editingEquipment}
          onClose={() => setEditingEquipment(null)}
        />
      )}
      {editingAnnotation && (
        <EditAnnotationModal
          nodeId={editingAnnotation.id}
          nodeType={editingAnnotation.type}
          initialData={editingAnnotation.data}
          onClose={() => setEditingAnnotation(null)}
        />
      )}
      {editingEdge && (
        <EditEdgeModal
          edgeId={editingEdge.id}
          initialLabel={editingEdge.label}
          onClose={() => setEditingEdge(null)}
        />
      )}
      {loadingPreset && (
        <LoadPresetModal
          preset={loadingPreset}
          onReplace={() => loadPreset(loadingPreset.id)}
          onAddToCanvas={() => addPresetToCanvas(loadingPreset.id)}
          onNewTab={() => handleOpenPresetInNewTab(loadingPreset)}
          onClose={() => setLoadingPreset(null)}
        />
      )}
      {isBomBulkModalOpen && (
        <BomBulkModal onClose={() => setIsBomBulkModalOpen(false)} />
      )}
      {editingBomEdge && (
        <BomEdgeModal edgeId={editingBomEdge} onClose={() => setEditingBomEdge(null)} />
      )}
      {isBomReportModalOpen && (
        <BomReportModal onClose={() => setIsBomReportModalOpen(false)} />
      )}
      {isShareModalOpen && (
        <ShareModal
          getDiagram={() => ({ nodes, edges })}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}

      {/* 공유 링크로 진입 시 로딩/오류 오버레이 */}
      {shareLoadState !== 'idle' && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, background: 'rgba(0,0,0,0.6)' }}>
          <div className="glass-panel" style={{ padding: '20px 26px', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 360, textAlign: 'center' }}>
            {shareLoadState === 'loading' ? (
              <>
                <Share2 size={22} className="spin" color="var(--accent-color)" />
                <span style={{ fontSize: 13 }}>공유된 구성도를 불러오는 중...</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>공유 구성도를 찾을 수 없습니다.</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  링크가 잘못되었거나 삭제되었을 수 있습니다.
                </span>
                <button className="glass-button" style={{ fontSize: 12 }} onClick={() => setShareLoadState('idle')}>닫기</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 새로만들기 확인 모달 */}
      {newDiagramStep !== 'idle' && (
        <div
          style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setNewDiagramStep('idle')}
        >
          <div
            className="glass-panel"
            style={{ width: 380, padding: '22px 24px', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}
          >
            {newDiagramStep === 'confirm' ? (
              <>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>새 구성도 만들기</h3>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    현재 구성도를 저장하지 않으면 작업 내용이 사라집니다.
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    className="glass-button primary"
                    onClick={() => setNewDiagramStep('naming')}
                    style={{ justifyContent: 'center' }}
                  >
                    저장 후 새로만들기
                  </button>
                  <button
                    className="glass-button"
                    onClick={confirmNewDiscard}
                    style={{ justifyContent: 'center', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                  >
                    저장 안함 (삭제)
                  </button>
                  <button
                    className="glass-button"
                    onClick={() => setNewDiagramStep('idle')}
                    style={{ justifyContent: 'center' }}
                  >
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>프리셋 이름 입력</h3>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    현재 구성도를 프리셋으로 저장합니다.
                  </p>
                </div>
                <input
                  className="glass-input"
                  placeholder="구성도 이름..."
                  value={newSaveName}
                  onChange={e => setNewSaveName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') confirmNewSave(); if (e.key === 'Escape') setNewDiagramStep('idle'); }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="glass-button" onClick={() => setNewDiagramStep('confirm')}>뒤로</button>
                  <button
                    className="glass-button primary"
                    onClick={confirmNewSave}
                    disabled={!newSaveName.trim()}
                    style={{ opacity: newSaveName.trim() ? 1 : 0.4 }}
                  >
                    저장 후 새로만들기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowBuilder />
    </ReactFlowProvider>
  );
}

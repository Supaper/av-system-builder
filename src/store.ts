import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';

type DiagramSnapshot = { nodes: Node[]; edges: Edge[] };
const MAX_HISTORY = 50;

// Drag tracking — module-level to avoid extra Zustand re-renders
let _isDragging = false;
let _preDragSnapshot: DiagramSnapshot | null = null;
import {
  svgPtzCam, svgVideoSwitcher, svgUsbCapture, svgDsp, svgMic, svgSpeaker,
  svgAmp, svgController, svgSwitch, svgDisplay, svgProjector, svgScreen,
  svgVideoMatrix, svgTransmitter, svgDesktopPC, svgLaptopPC, svgDistributor,
} from './svgAssets';

export type EquipmentCategory =
  | 'video' | 'display' | 'conferencing' | 'audio'
  | 'control' | 'network' | 'broadcast' | 'etc';
/**
 * 포트 타입 = 라인 타입(LineType) id. 포트-포트 연결 유효성 판정과 엣지 색상이
 * 이 값으로 결정된다. 라인 타입은 사용자가 추가/삭제할 수 있는 동적 목록이므로
 * 리터럴 유니온이 아니라 string이다. UI의 포트 타입 선택지는 하드코딩하지 말고
 * 반드시 useStore().lineTypes에서 렌더링할 것.
 */
export type PortType = string;

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  video: 'Video',
  display: 'Display',
  conferencing: 'Conferencing',
  audio: 'Audio',
  control: 'Control',
  network: 'Network',
  broadcast: 'Broadcast',
  etc: 'Etc',
};

/** 카테고리별 기본 PortType (신규 장비 생성 시 초기 포트 타입 추정용) */
export const getDefaultPortTypeForCategory = (category: EquipmentCategory): PortType => {
  switch (category) {
    case 'video':
    case 'display':
    case 'conferencing':
    case 'broadcast':
      return 'video';
    case 'audio':
      return 'audio';
    case 'control':
      return 'control';
    case 'network':
    case 'etc':
    default:
      return 'network';
  }
};

export const defaultCategoryImages: Record<EquipmentCategory, string> = {
  video: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none"><rect width="100%" height="100%" rx="4" fill="%231e293b"/><rect x="15" y="10" width="70" height="36" rx="2" fill="%230f172a" stroke="%23334155" stroke-width="1.5"/><rect x="40" y="46" width="20" height="6" fill="%23475569"/><rect x="30" y="52" width="40" height="2" fill="%2364748b"/><path d="M 25,28 L 75,28" stroke="%23ef4444" stroke-width="1" stroke-dasharray="2,4" opacity="0.5"/><polygon points="45,22 60,28 45,34" fill="%23ef4444" opacity="0.8"/></svg>',
  display: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none"><rect width="100%" height="100%" rx="4" fill="%231e293b"/><rect x="20" y="10" width="60" height="34" rx="2" fill="%230f172a" stroke="%233b82f6" stroke-width="1.5"/><rect x="42" y="44" width="16" height="5" fill="%23475569"/><rect x="34" y="49" width="32" height="2" fill="%2364748b"/></svg>',
  conferencing: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none"><rect width="100%" height="100%" rx="4" fill="%231e293b"/><circle cx="38" cy="30" r="14" fill="%230f172a" stroke="%2306b6d4" stroke-width="1.5"/><circle cx="38" cy="30" r="5" fill="%2306b6d4"/><path d="M 62,22 L 78,16 L 78,44 L 62,38 Z" fill="%2306b6d4" opacity="0.7"/></svg>',
  audio: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none"><rect width="100%" height="100%" rx="4" fill="%231e293b"/><line x1="15" y1="30" x2="15" y2="30" stroke="%2310b981" stroke-width="3" stroke-linecap="round"/><line x1="25" y1="20" x2="25" y2="40" stroke="%2310b981" stroke-width="3" stroke-linecap="round"/><line x1="35" y1="12" x2="35" y2="48" stroke="%2310b981" stroke-width="3" stroke-linecap="round"/><line x1="45" y1="25" x2="45" y2="35" stroke="%2310b981" stroke-width="3" stroke-linecap="round"/><line x1="55" y1="5" x2="55" y2="55" stroke="%2310b981" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="18" x2="65" y2="42" stroke="%2310b981" stroke-width="3" stroke-linecap="round"/><line x1="75" y1="28" x2="75" y2="32" stroke="%2310b981" stroke-width="3" stroke-linecap="round"/><line x1="85" y1="15" x2="85" y2="45" stroke="%2310b981" stroke-width="3" stroke-linecap="round"/></svg>',
  control: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none"><rect width="100%" height="100%" rx="4" fill="%231e293b"/><rect x="35" y="15" width="30" height="30" rx="4" fill="%230f172a" stroke="%23f59e0b" stroke-width="1.5"/><line x1="25" y1="22" x2="35" y2="22" stroke="%23475569" stroke-width="2"/><line x1="25" y1="30" x2="35" y2="30" stroke="%23475569" stroke-width="2"/><line x1="25" y1="38" x2="35" y2="38" stroke="%23475569" stroke-width="2"/><line x1="65" y1="22" x2="75" y2="22" stroke="%23475569" stroke-width="2"/><line x1="65" y1="30" x2="75" y2="30" stroke="%23475569" stroke-width="2"/><line x1="65" y1="38" x2="75" y2="38" stroke="%23475569" stroke-width="2"/><line x1="42" y1="5" x2="42" y2="15" stroke="%23475569" stroke-width="2"/><line x1="50" y1="5" x2="50" y2="15" stroke="%23475569" stroke-width="2"/><line x1="58" y1="5" x2="58" y2="15" stroke="%23475569" stroke-width="2"/><line x1="42" y1="45" x2="42" y2="55" stroke="%23475569" stroke-width="2"/><line x1="50" y1="45" x2="50" y2="55" stroke="%23475569" stroke-width="2"/><line x1="58" y1="45" x2="58" y2="55" stroke="%23475569" stroke-width="2"/><circle cx="50" cy="30" r="6" fill="%23f59e0b" opacity="0.3"/><circle cx="50" cy="30" r="2" fill="%23f59e0b"/></svg>',
  network: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none"><rect width="100%" height="100%" rx="4" fill="%231e293b"/><circle cx="50" cy="15" r="5" fill="%238b5cf6"/><circle cx="25" cy="42" r="5" fill="%238b5cf6"/><circle cx="75" cy="42" r="5" fill="%238b5cf6"/><line x1="50" y1="15" x2="25" y2="42" stroke="%238b5cf6" stroke-width="1.5"/><line x1="50" y1="15" x2="75" y2="42" stroke="%238b5cf6" stroke-width="1.5"/><line x1="25" y1="42" x2="75" y2="42" stroke="%238b5cf6" stroke-width="1.5" stroke-dasharray="2,2"/><circle cx="50" cy="30" r="2.5" fill="%23fff" opacity="0.7"/></svg>',
  broadcast: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none"><rect width="100%" height="100%" rx="4" fill="%231e293b"/><circle cx="50" cy="42" r="4" fill="%23ec4899"/><path d="M 50,42 L 50,20" stroke="%23ec4899" stroke-width="2"/><path d="M 35,30 A 20,20 0 0 1 65,30" stroke="%23ec4899" stroke-width="1.5" fill="none" opacity="0.6"/><path d="M 25,20 A 35,35 0 0 1 75,20" stroke="%23ec4899" stroke-width="1.5" fill="none" opacity="0.35"/></svg>',
  etc: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="none"><rect width="100%" height="100%" rx="4" fill="%231e293b"/><rect x="30" y="18" width="40" height="26" rx="3" fill="%230f172a" stroke="%2364748b" stroke-width="1.5"/><circle cx="50" cy="31" r="5" fill="%2364748b"/></svg>',
};

export interface Port {
  id: string;
  label: string;
  type: PortType;
  direction: 'in' | 'out' | 'both';
}

export interface Equipment extends Record<string, unknown> {
  id: string;
  category: EquipmentCategory;
  name: string;
  model: string;
  manufacturer?: string;
  description?: string;
  /** 모듈형 프레임 제품군 태그 (예: "XDM 시리즈"). EquipmentOption.compatibleSeries와 매칭됨 */
  series?: string;
  inputs: Port[];
  outputs: Port[];
  bidirectional: Port[];
  imageUrl?: string;
  isReused?: boolean;
}

export interface LineType {
  id: string;
  name: string;
  color: string;
}

/** 장비에 장착 가능한 옵션 카드/액세서리. 여러 상위 장비(모델 또는 시리즈)에 동시 호환 가능 */
export interface EquipmentOption extends Record<string, unknown> {
  id: string;
  name: string;
  model?: string;
  manufacturer?: string;
  description?: string;
  /** 특정 모델명 지정 (접두 일치로 판정, 예: ["BLU-101"]) */
  compatibleModels?: string[];
  /** 제품군 단위 지정 (Equipment.series와 정확히 일치, 예: ["XDM 시리즈"]) */
  compatibleSeries?: string[];
  addPorts: {
    inputs: Port[];
    outputs: Port[];
    bidirectional: Port[];
  };
}

/** BOM 기성케이블 선택용 카탈로그 항목. 장비 DB(캔버스 노드)와는 분리된 컬렉션 */
export interface CableCatalogItem extends Record<string, unknown> {
  id: string;
  name: string;
  model: string;
  manufacturer?: string;
  lineTypeId?: string;
  description?: string;
}

/** 특정 장비에 적용 가능한 옵션 목록 조회 (모델 접두 일치 또는 시리즈 일치) */
export const getAvailableOptionsForEquipment = (
  equipment: Pick<Equipment, 'model' | 'series'>,
  optionsCatalog: EquipmentOption[]
): EquipmentOption[] => {
  return optionsCatalog.filter((opt) => {
    const modelMatch = opt.compatibleModels?.some((m) => equipment.model.startsWith(m));
    const seriesMatch = !!equipment.series && !!opt.compatibleSeries?.includes(equipment.series);
    return modelMatch || seriesMatch;
  });
};

export interface DiagramPreset {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
}

const generatePorts = (count: number, prefix: string, type: PortType, direction: 'in' | 'out' | 'both'): Port[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${direction}-${prefix.toLowerCase()}-${i + 1}`,
    label: `${prefix} ${i + 1}`,
    type,
    direction
  }));
};


export const getDefaultEquipmentImage = (name: string, category: EquipmentCategory): string => {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('laptop') || lowerName.includes('notebook') || lowerName.includes('macbook') || lowerName.includes('노트북') || lowerName.includes('랩탑') || lowerName.includes('맥북')) {
    return svgLaptopPC;
  }
  if (lowerName.includes('desktop') || lowerName.includes('pc') || lowerName.includes('computer') || lowerName.includes('workstation') || lowerName.includes('데스크탑') || lowerName.includes('컴퓨터') || lowerName.includes('본체')) {
    return svgDesktopPC;
  }
  if (lowerName.includes('transmitter') || lowerName.includes('receiver') || lowerName.includes('tx') || lowerName.includes('rx') || lowerName.includes('extender') || lowerName.includes('balun') || lowerName.includes('전송기') || lowerName.includes('수신기') || lowerName.includes('송신기') || lowerName.includes('송수신기') || lowerName.includes('익스텐더') || lowerName.includes('발룬') || lowerName.includes('kvm 연장기') || lowerName.includes('ct-104')) {
    return svgTransmitter;
  }
  if (lowerName.includes('distributor') || lowerName.includes('splitter') || lowerName.includes('분배기') || lowerName.includes('스플리터') || lowerName.includes('분배')) {
    return svgDistributor;
  }

  if (category === 'video') {
    if (lowerName.includes('display') || lowerName.includes('monitor') || lowerName.includes('tv') || lowerName.includes('디스플레이') || lowerName.includes('모니터') || lowerName.includes('비디오월') || lowerName.includes('video wall') || lowerName.includes('wall')) {
      return svgDisplay;
    }
    if (lowerName.includes('projector') || lowerName.includes('beam') || lowerName.includes('프로젝터') || lowerName.includes('빔')) {
      return svgProjector;
    }
    if (lowerName.includes('screen') || lowerName.includes('스크린')) {
      return svgScreen;
    }
    if (lowerName.includes('cam') || lowerName.includes('camera') || lowerName.includes('카메라')) {
      return svgPtzCam;
    }
    if (lowerName.includes('matrix') || lowerName.includes('processor') || lowerName.includes('매트릭스') || lowerName.includes('프로세서')) {
      return svgVideoMatrix;
    }
    if (lowerName.includes('switcher') || lowerName.includes('switch') || lowerName.includes('스위처') || lowerName.includes('스위치')) {
      return svgVideoSwitcher;
    }
    if (lowerName.includes('capture') || lowerName.includes('usb') || lowerName.includes('캡처') || lowerName.includes('캡쳐')) {
      return svgUsbCapture;
    }
    return defaultCategoryImages.video;
  }
  
  if (category === 'audio') {
    if (lowerName.includes('mic') || lowerName.includes('microphone') || lowerName.includes('마이크')) {
      return svgMic;
    }
    if (lowerName.includes('speaker') || lowerName.includes('spk') || lowerName.includes('스피커')) {
      return svgSpeaker;
    }
    if (lowerName.includes('amp') || lowerName.includes('amplifier') || lowerName.includes('앰프')) {
      return svgAmp;
    }
    if (lowerName.includes('dsp') || lowerName.includes('processor') || lowerName.includes('mixer') || lowerName.includes('믹서') || lowerName.includes('프로세서')) {
      return svgDsp;
    }
    return defaultCategoryImages.audio;
  }
  
  if (category === 'control') {
    if (lowerName.includes('dsp') || lowerName.includes('processor') || lowerName.includes('프로세서')) {
      return svgDsp;
    }
    if (lowerName.includes('controller') || lowerName.includes('컨트롤러')) {
      return svgController;
    }
    return svgController;
  }
  
  if (category === 'network') {
    if (lowerName.includes('switch') || lowerName.includes('hub') || lowerName.includes('router') || lowerName.includes('스위치') || lowerName.includes('허브') || lowerName.includes('공유기')) {
      return svgSwitch;
    }
    return svgSwitch;
  }
  
  return defaultCategoryImages[category] || defaultCategoryImages.video;
};

export const calculateNodeHeight = (eq: {
  inputs: any[];
  outputs: any[];
  bidirectional?: any[];
  name: string;
  category: any;
  imageUrl?: string;
}): number => {
  const hasImage = !!(eq.imageUrl || getDefaultEquipmentImage(eq.name, eq.category));
  const I = eq.inputs?.length || 0;
  const O = eq.outputs?.length || 0;
  const B = eq.bidirectional?.length || 0;
  const maxIO = Math.max(I, O);
  
  let portsHeight = 0;
  if (maxIO > 0 && B > 0) {
    portsHeight = (maxIO * 28 - 4) + 8 + 13 + (B * 28 - 4);
  } else if (maxIO > 0) {
    portsHeight = maxIO * 28 - 4;
  } else if (B > 0) {
    portsHeight = B * 28 - 4 + 13;
  }
  
  const totalHeight = 24 + 45 + (hasImage ? 68 : 0) + portsHeight + 12;
  return Math.max(100, totalHeight);
};

export const getPortYOffset = (
  eq: {
    inputs: any[];
    outputs: any[];
    bidirectional?: any[];
    name: string;
    category: any;
    imageUrl?: string;
  },
  handleId: string | null | undefined
): number => {
  if (!handleId) return 0;
  
  const hasImage = !!(eq.imageUrl || getDefaultEquipmentImage(eq.name, eq.category));
  const imageOffset = hasImage ? 68 : 0;
  const headerHeight = 45;
  const paddingTop = 12;
  const baseOffset = paddingTop + headerHeight + imageOffset;
  const maxIO = Math.max(eq.inputs?.length || 0, eq.outputs?.length || 0);
  
  const inIndex = eq.inputs ? eq.inputs.findIndex((p: any) => p.id === handleId) : -1;
  if (inIndex !== -1) {
    return baseOffset + inIndex * 28 + 12;
  }
  
  const outIndex = eq.outputs ? eq.outputs.findIndex((p: any) => p.id === handleId) : -1;
  if (outIndex !== -1) {
    return baseOffset + outIndex * 28 + 12;
  }
  
  const bidiIndex = eq.bidirectional ? eq.bidirectional.findIndex((p: any) => p.id === handleId || `source_${p.id}` === handleId || `target_${p.id}` === handleId) : -1;
  if (bidiIndex !== -1) {
    let offsetBeforeBidi = 0;
    if (maxIO > 0) {
      offsetBeforeBidi = (maxIO * 28 - 4) + 8 + 13;
    } else {
      offsetBeforeBidi = 13;
    }
    return baseOffset + offsetBeforeBidi + bidiIndex * 28 + 12;
  }
  
  return 0;
};

const initialEquipmentDB: Equipment[] = [
  // Video
  { id: 'v1', category: 'video', name: 'PTZ CAM', model: 'TR315 / POE+ 19W', inputs: [], outputs: generatePorts(3, 'SDI', 'video', 'out'), bidirectional: generatePorts(1, 'LAN', 'network', 'both'), imageUrl: svgPtzCam },
  { id: 'v2', category: 'video', name: '비디오 스위처', model: 'VS5', inputs: generatePorts(4, 'SDI In', 'video', 'in'), outputs: generatePorts(2, 'HDMI Out', 'video', 'out'), bidirectional: generatePorts(1, 'LAN', 'network', 'both'), imageUrl: svgVideoSwitcher },
  { id: 'v3', category: 'video', name: 'USB캡처', model: 'UVC-01', inputs: generatePorts(1, 'HDMI In', 'video', 'in'), outputs: generatePorts(1, 'USB Out', 'network', 'out'), bidirectional: [], imageUrl: svgUsbCapture },
  { id: 'v4', category: 'video', name: '비디오 매트릭스', model: 'VDM-16X', inputs: generatePorts(10, 'HDMI In', 'video', 'in'), outputs: generatePorts(10, 'HDMI Out', 'video', 'out'), bidirectional: [], imageUrl: svgVideoMatrix },
  { id: 'v5', category: 'video', name: '2분배기', model: '2-Way Splitter', inputs: generatePorts(1, 'In', 'video', 'in'), outputs: generatePorts(2, 'Out', 'video', 'out'), bidirectional: [], imageUrl: svgDistributor },
  { id: 'v6', category: 'video', name: '4분배기', model: '4-Way Splitter', inputs: generatePorts(1, 'In', 'video', 'in'), outputs: generatePorts(4, 'Out', 'video', 'out'), bidirectional: [], imageUrl: svgDistributor },
  { id: 'v7', category: 'video', name: '비디오월 (가로)', model: 'LH55VHCRBGBXKR 2×4', inputs: generatePorts(8, 'In', 'video', 'in'), outputs: [], bidirectional: [], imageUrl: svgDisplay },
  { id: 'v8', category: 'video', name: '비디오월 (세로)', model: 'LH55VMTEBGBXKR 1×3', inputs: generatePorts(3, 'In', 'video', 'in'), outputs: [], bidirectional: [], imageUrl: svgDisplay },
  { id: 'v9', category: 'video', name: '모니터', model: '24인치 모니터', inputs: generatePorts(2, 'HDMI In', 'video', 'in'), outputs: [], bidirectional: [], imageUrl: svgDisplay },
  // Audio
  { id: 'a1', category: 'audio', name: 'DSP', model: 'BLU-50v2', inputs: generatePorts(4, 'In', 'audio', 'in'), outputs: generatePorts(2, 'Out', 'audio', 'out'), bidirectional: generatePorts(1, 'LAN', 'network', 'both'), imageUrl: svgDsp },
  { id: 'a2', category: 'audio', name: 'DSP', model: 'BLU-101', inputs: generatePorts(8, 'In', 'audio', 'in'), outputs: generatePorts(4, 'Out', 'audio', 'out'), bidirectional: generatePorts(1, 'LAN', 'network', 'both'), imageUrl: svgDsp },
  { id: 'a3', category: 'audio', name: 'Delegate System', model: 'TELEVIC D-Cerno', inputs: [], outputs: generatePorts(1, 'Audio Out', 'audio', 'out'), bidirectional: generatePorts(1, 'LAN', 'network', 'both'), imageUrl: svgMic },
  { id: 'a4', category: 'audio', name: 'CEILING SPEAKER', model: 'Ceiling Speaker', inputs: generatePorts(1, 'In', 'audio', 'in'), outputs: [], bidirectional: [], imageUrl: svgSpeaker },
  { id: 'a5', category: 'audio', name: 'AMP', model: 'Power Amplifier', inputs: generatePorts(1, 'In', 'audio', 'in'), outputs: generatePorts(1, 'Out', 'audio', 'out'), bidirectional: [], imageUrl: svgAmp },
  { id: 'a6', category: 'audio', name: '무선마이크', model: '2CH Wireless MIC', inputs: [], outputs: generatePorts(1, 'Audio Out', 'audio', 'out'), bidirectional: [], imageUrl: svgMic },
  { id: 'a7', category: 'audio', name: '구즈넥 마이크', model: 'MX418DC', inputs: [], outputs: generatePorts(1, 'Audio Out', 'audio', 'out'), bidirectional: [], imageUrl: svgMic },
  // Control
  { id: 'c1', category: 'control', name: '통합제어 컨트롤러', model: 'NX-1200', inputs: [], outputs: [], bidirectional: generatePorts(2, 'LAN', 'network', 'both'), imageUrl: svgController },
  { id: 'c2', category: 'control', name: 'Logic Controller', model: 'MPCMPC', inputs: [], outputs: [], bidirectional: generatePorts(2, 'LAN', 'network', 'both'), imageUrl: svgController },
  { id: 'c3', category: 'control', name: 'KVM Switch', model: 'CS1798 (8포트 HDMI)', inputs: generatePorts(8, 'HDMI In', 'video', 'in'), outputs: generatePorts(1, 'HDMI Out', 'video', 'out'), bidirectional: generatePorts(1, 'USB', 'network', 'both'), imageUrl: svgController },
  { id: 'c4', category: 'control', name: 'KVM 연장기 TX', model: 'CE824', inputs: generatePorts(1, 'HDMI In', 'video', 'in'), outputs: generatePorts(1, 'LAN Out', 'network', 'out'), bidirectional: generatePorts(1, 'USB', 'network', 'both'), imageUrl: svgTransmitter },
  { id: 'c5', category: 'control', name: 'KVM 연장기 RX', model: 'CE824', inputs: generatePorts(1, 'LAN In', 'network', 'in'), outputs: generatePorts(1, 'HDMI Out', 'video', 'out'), bidirectional: generatePorts(1, 'USB', 'network', 'both'), imageUrl: svgTransmitter },
  { id: 'c6', category: 'control', name: 'CT-104-U TX', model: 'HDBaseT TX', inputs: generatePorts(2, 'HDMI In', 'video', 'in'), outputs: generatePorts(2, 'LAN Out', 'network', 'out'), bidirectional: [], imageUrl: svgTransmitter },
  { id: 'c7', category: 'control', name: 'CT-104-U RX', model: 'HDBaseT RX', inputs: generatePorts(2, 'LAN In', 'network', 'in'), outputs: generatePorts(2, 'HDMI Out', 'video', 'out'), bidirectional: [], imageUrl: svgTransmitter },
  { id: 'c8', category: 'control', name: 'PC', model: 'Desktop PC', inputs: generatePorts(1, 'USB In', 'network', 'in'), outputs: generatePorts(2, 'HDMI Out', 'video', 'out'), bidirectional: [], imageUrl: svgDesktopPC },
  // Network
  { id: 'n1', category: 'network', name: 'POE 허브', model: 'GSM4230P', inputs: [], outputs: [], bidirectional: generatePorts(8, 'LAN', 'network', 'both'), imageUrl: svgSwitch },
  { id: 'n2', category: 'network', name: 'Switching Hub', model: 'GS728TPP (24포트)', inputs: [], outputs: [], bidirectional: generatePorts(8, 'LAN', 'network', 'both'), imageUrl: svgSwitch },
];

const initialLineTypes: LineType[] = [
  { id: 'sdi', name: 'SDI', color: '#374151' },        // dark gray/black — SDI 케이블
  { id: 'video', name: 'HDMI', color: '#ef4444' },     // red — HDMI
  { id: 'network', name: 'LAN', color: '#22c55e' },    // green — LAN/Network
  { id: 'audio', name: 'A.AUDIO', color: '#a855f7' },  // purple — Analog Audio
  { id: 'usb', name: 'USB', color: '#3b82f6' },        // blue — USB
  { id: 'control', name: 'Control', color: '#f59e0b' }, // amber — RS-232/Control
];

const loadPresetsFromStorage = (): DiagramPreset[] => {
  try {
    const saved = localStorage.getItem('av-builder-presets');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Failed to load presets', e);
    return [];
  }
};

const savePresetsToStorage = (presets: DiagramPreset[]) => {
  try {
    localStorage.setItem('av-builder-presets', JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets', e);
  }
};

interface AppState {
  equipmentDB: Equipment[];
  addEquipment: (eq: Omit<Equipment, 'id'>) => void;
  updateEquipment: (id: string, eq: Omit<Equipment, 'id'>) => void;
  removeEquipment: (id: string) => void;
  importEquipmentDB: (db: Equipment[]) => void;
  bulkImportEquipment: (items: Omit<Equipment, 'id'>[], mergeMode: 'append' | 'overwrite') => void;

  equipmentOptions: EquipmentOption[];
  addEquipmentOption: (opt: Omit<EquipmentOption, 'id'>) => void;
  updateEquipmentOption: (id: string, opt: Omit<EquipmentOption, 'id'>) => void;
  removeEquipmentOption: (id: string) => void;

  cableCatalog: CableCatalogItem[];
  addCableCatalogItem: (item: Omit<CableCatalogItem, 'id'>) => void;
  updateCableCatalogItem: (id: string, item: Omit<CableCatalogItem, 'id'>) => void;
  removeCableCatalogItem: (id: string) => void;

  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (id: string, data: Equipment) => void;

  history: { past: DiagramSnapshot[]; future: DiagramSnapshot[] };
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;

  lineTypes: LineType[];
  addLineType: (lineType: Omit<LineType, 'id'>) => void;
  updateLineType: (id: string, lineType: Omit<LineType, 'id'>) => void;
  removeLineType: (id: string) => void;
  selectedLineTypeId: string;
  setSelectedLineTypeId: (id: string) => void;

  presets: DiagramPreset[];
  savePreset: (name: string, id?: string) => void;
  loadPreset: (id: string) => void;
  addPresetToCanvas: (id: string) => void;
  deletePreset: (id: string) => void;
  importPresets: (presets: DiagramPreset[]) => void;
  importDiagramState: (state: { nodes?: Node[]; edges?: Edge[] }) => void;
}

export const useStore = create<AppState>((set, get) => {
  let initialNodes: Node[] = [];
  let initialEdges: Edge[] = [];
  let initialEqDBSaved: Equipment[] = initialEquipmentDB;

  try {
    const n = localStorage.getItem('av-builder-active-nodes');
    const e = localStorage.getItem('av-builder-active-edges');
    const d = localStorage.getItem('av-builder-active-eqdb');
    if (n) initialNodes = JSON.parse(n);
    if (e) initialEdges = JSON.parse(e);
    if (d) initialEqDBSaved = JSON.parse(d);
  } catch (err) {
    console.error('Failed to load initial storage state', err);
  }

  return {
    equipmentDB: initialEqDBSaved,
    addEquipment: (eq) => set((state) => ({
      equipmentDB: [...state.equipmentDB, { ...eq, id: `eq-${Date.now()}` } as Equipment]
    })),
    updateEquipment: (id, eq) => set((state) => ({
      equipmentDB: state.equipmentDB.map(e => e.id === id ? { ...eq, id } as Equipment : e)
    })),
    removeEquipment: (id) => set((state) => ({
      equipmentDB: state.equipmentDB.filter(e => e.id !== id)
    })),
    importEquipmentDB: (db) => set({ equipmentDB: db }),
    bulkImportEquipment: (items, mergeMode) => set((state) => {
      const newItems = items.map((item, idx) => ({
        ...item,
        id: `eq-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`
      } as Equipment));

      const updated = mergeMode === 'overwrite'
        ? newItems
        : [...state.equipmentDB, ...newItems];

      return { equipmentDB: updated };
    }),

    equipmentOptions: [],
    addEquipmentOption: (opt) => set((state) => ({
      equipmentOptions: [...state.equipmentOptions, { ...opt, id: `eqopt-${Date.now()}` } as EquipmentOption]
    })),
    updateEquipmentOption: (id, opt) => set((state) => ({
      equipmentOptions: state.equipmentOptions.map(o => o.id === id ? { ...o, ...opt } : o)
    })),
    removeEquipmentOption: (id) => set((state) => ({
      equipmentOptions: state.equipmentOptions.filter(o => o.id !== id)
    })),

    cableCatalog: [],
    addCableCatalogItem: (item) => set((state) => ({
      cableCatalog: [...state.cableCatalog, { ...item, id: `cable-${Date.now()}` } as CableCatalogItem]
    })),
    updateCableCatalogItem: (id, item) => set((state) => ({
      cableCatalog: state.cableCatalog.map(c => c.id === id ? { ...c, ...item } : c)
    })),
    removeCableCatalogItem: (id) => set((state) => ({
      cableCatalog: state.cableCatalog.filter(c => c.id !== id)
    })),

    nodes: initialNodes,
    edges: initialEdges,

    history: { past: [], future: [] },

    saveToHistory: () => {
      const { nodes, edges, history } = get();
      set({
        history: {
          past: [...history.past, { nodes, edges }].slice(-MAX_HISTORY),
          future: [],
        },
      });
    },

    undo: () => {
      const { history, nodes, edges } = get();
      if (history.past.length === 0) return;
      const snapshot = history.past[history.past.length - 1];
      set({
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        history: {
          past: history.past.slice(0, -1),
          future: [{ nodes, edges }, ...history.future].slice(0, MAX_HISTORY),
        },
      });
    },

    redo: () => {
      const { history, nodes, edges } = get();
      if (history.future.length === 0) return;
      const snapshot = history.future[0];
      set({
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        history: {
          past: [...history.past, { nodes, edges }].slice(-MAX_HISTORY),
          future: history.future.slice(1),
        },
      });
    },

  onNodesChange: (changes: NodeChange[]) => {
    const hasRemoves = changes.some(c => c.type === 'remove');
    if (hasRemoves) {
      get().saveToHistory();
    }

    const isDragMove = changes.some(c => c.type === 'position' && (c as any).dragging === true);
    const isDragEnd = changes.some(c => c.type === 'position' && (c as any).dragging === false);

    if (isDragMove && !_isDragging) {
      _isDragging = true;
      _preDragSnapshot = { nodes: get().nodes, edges: get().edges };
    }

    if (isDragEnd && _isDragging && _preDragSnapshot) {
      const snap = _preDragSnapshot;
      _isDragging = false;
      _preDragSnapshot = null;
      const { history } = get();
      set({
        history: {
          past: [...history.past, snap].slice(-MAX_HISTORY),
          future: [],
        },
      });
    }

    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    const hasRemoves = changes.some(c => c.type === 'remove');
    if (hasRemoves) {
      get().saveToHistory();
    }
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    get().saveToHistory();
    const { nodes, edges, lineTypes, selectedLineTypeId } = get();
    
    // Prevent duplicate connections (including reverse direction)
    const isDuplicate = edges.some(edge => 
      (edge.source === connection.source && edge.target === connection.target && edge.sourceHandle === connection.sourceHandle && edge.targetHandle === connection.targetHandle) ||
      (edge.source === connection.target && edge.target === connection.source && edge.sourceHandle === connection.targetHandle && edge.targetHandle === connection.sourceHandle)
    );
    if (isDuplicate) return;
    
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    let portType: string = selectedLineTypeId;
    
    if (sourceNode && targetNode) {
      const getCleanPortId = (handleId: string | null) => {
        if (!handleId) return '';
        if (handleId.startsWith('source_') || handleId.startsWith('target_')) {
          return handleId.substring(7);
        }
        return handleId;
      };
      
      const handleAPortId = getCleanPortId(connection.sourceHandle);
      const handleBPortId = getCleanPortId(connection.targetHandle);
      
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
        
      if (portA && portB && portA.type === portB.type) {
        portType = portA.type;
      } else if (portA) {
        portType = portA.type;
      } else if (portB) {
        portType = portB.type;
      }
    }
    
    const selectedLine = lineTypes.find(lt => lt.id === portType) || lineTypes.find(lt => lt.id === selectedLineTypeId);
    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      type: 'smoothstep',
      animated: false,
      style: { stroke: selectedLine?.color || '#fff', strokeWidth: 2 },
      data: { lineTypeId: portType || selectedLineTypeId }
    };
    
    set({
      edges: addEdge(newEdge, get().edges),
    });
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateNodeData: (id, data) => {
    get().saveToHistory();
    set((state) => ({
      nodes: state.nodes.map(node => {
        if (node.id === id) {
          const nextDraggable = data.locked !== undefined ? !data.locked : node.draggable;
          return {
            ...node,
            draggable: nextDraggable,
            data: { ...node.data, ...data }
          };
        }
        return node;
      })
    }));
  },
  
  lineTypes: initialLineTypes,
  addLineType: (lineType) => set((state) => ({
    lineTypes: [...state.lineTypes, { ...lineType, id: `lt-${Date.now()}` }]
  })),
  updateLineType: (id, lineType) => set((state) => ({
    lineTypes: state.lineTypes.map(lt => lt.id === id ? { ...lt, ...lineType } : lt)
  })),
  removeLineType: (id) => set((state) => ({
    lineTypes: state.lineTypes.filter(lt => lt.id !== id),
    selectedLineTypeId: state.selectedLineTypeId === id 
      ? state.lineTypes.find(lt => lt.id !== id)?.id || '' 
      : state.selectedLineTypeId
  })),
  selectedLineTypeId: 'video',
  setSelectedLineTypeId: (id) => set({ selectedLineTypeId: id }),

  presets: loadPresetsFromStorage(),
  savePreset: (name: string, id?: string) => {
    const { nodes, edges, presets } = get();
    let updated: DiagramPreset[];
    if (id) {
      updated = presets.map(p => p.id === id ? {
        ...p,
        name,
        nodes,
        edges,
        updatedAt: new Date().toISOString(),
      } : p);
    } else {
      const newPreset: DiagramPreset = {
        id: `preset-${Date.now()}`,
        name,
        nodes,
        edges,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updated = [...presets, newPreset];
    }
    set({ presets: updated });
    savePresetsToStorage(updated);
  },
  importPresets: (importedPresets: DiagramPreset[]) => {
    const { presets } = get();
    const updated = [...presets];
    importedPresets.forEach(imported => {
      const existingIdx = updated.findIndex(p => p.id === imported.id || p.name === imported.name);
      if (existingIdx > -1) {
        updated[existingIdx] = {
          ...imported,
          createdAt: imported.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        updated.push({
          ...imported,
          createdAt: imported.createdAt || new Date().toISOString(),
          updatedAt: imported.updatedAt || new Date().toISOString()
        });
      }
    });
    set({ presets: updated });
    savePresetsToStorage(updated);
  },
  loadPreset: (id: string) => {
    get().saveToHistory();
    const preset = get().presets.find(p => p.id === id);
    if (preset) {
      // 장비 DB·라인 타입은 팀 공용(실시간 동기화) 자산이라 프리셋을 불러와도 건드리지 않는다.
      set({
        nodes: preset.nodes,
        edges: preset.edges.map(e => ({ ...e, animated: false })),
      });
    }
  },

  addPresetToCanvas: (id: string) => {
    get().saveToHistory();
    const preset = get().presets.find(p => p.id === id);
    if (!preset) return;

    const { nodes: currentNodes, edges: currentEdges } = get();

    // Find rightmost X to place preset to the right
    const maxX = currentNodes.length > 0
      ? Math.max(...currentNodes.map(n => (n.position?.x ?? 0) + 260))
      : 0;
    const offsetX = maxX + 80;

    const timestamp = Date.now();
    const idMap: Record<string, string> = {};

    const newNodes = preset.nodes.map((n, idx) => {
      const newId = `preset_${timestamp}_${idx}`;
      idMap[n.id] = newId;
      return {
        ...n,
        id: newId,
        selected: false,
        position: { x: (n.position?.x ?? 0) + offsetX, y: n.position?.y ?? 0 },
      };
    });

    const newEdges = preset.edges.map((e, idx) => ({
      ...e,
      id: `pe_${timestamp}_${idx}`,
      source: idMap[e.source] ?? e.source,
      target: idMap[e.target] ?? e.target,
      animated: false,
    }));

    set({
      nodes: [...currentNodes, ...newNodes],
      edges: [...currentEdges, ...newEdges],
    });
  },
  deletePreset: (id: string) => {
    const updated = get().presets.filter(p => p.id !== id);
    set({ presets: updated });
    savePresetsToStorage(updated);
  },
  importDiagramState: (state) => {
    get().saveToHistory();
    // 장비 DB·라인 타입은 팀 공용(실시간 동기화) 자산이므로 통째로 덮어쓰지 않는다.
    // 노드는 배치 시점의 장비 정보를 그대로 품고 있으므로(App.tsx onDrop), 그중
    // 로컬 카탈로그에 없는 장비만 사이드바에 보충한다 — 공유 이후 카탈로그에서
    // 지워진 장비라도 diagram 자체는 항상 정상 렌더링된다.
    const currentDB = get().equipmentDB;
    const dbIds = new Set(currentDB.map(e => e.id));
    const seenIds = new Set<string>();
    const recoveredEquipment = (state.nodes || [])
      .filter(n => n.type === 'equipment')
      .map(n => n.data as unknown as Equipment)
      .filter(eq => {
        if (!eq?.id || dbIds.has(eq.id) || seenIds.has(eq.id)) return false;
        seenIds.add(eq.id);
        return true;
      });

    set({
      nodes: state.nodes || [],
      edges: (state.edges || []).map(e => ({ ...e, animated: false })),
      equipmentDB: [...currentDB, ...recoveredEquipment],
    });
  },
};
});

if (typeof window !== 'undefined') {
  useStore.subscribe((state) => {
    try {
      localStorage.setItem('av-builder-active-nodes', JSON.stringify(state.nodes));
      localStorage.setItem('av-builder-active-edges', JSON.stringify(state.edges));
      localStorage.setItem('av-builder-active-eqdb', JSON.stringify(state.equipmentDB));
    } catch (e) {
      console.error('Failed to persist active state', e);
    }
  });
}


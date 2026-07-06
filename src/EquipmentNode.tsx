import React from 'react';
import { Handle, Position, useStore as useRFStore } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Video, Mic, Cpu, Network, Monitor, Users, Radio, MoreHorizontal } from 'lucide-react';
import { useStore, getDefaultEquipmentImage, calculateNodeHeight } from './store';
import type { Equipment, EquipmentCategory } from './store';

type EquipmentNodeData = Equipment & { dimmed?: boolean };
export type EquipmentNodeType = Node<EquipmentNodeData, 'equipment'>;

const categoryColors: Record<EquipmentCategory, string> = {
  video: 'var(--node-video)',
  display: 'var(--node-display)',
  conferencing: 'var(--node-conferencing)',
  audio: 'var(--node-audio)',
  control: 'var(--node-control)',
  network: 'var(--node-network)',
  broadcast: 'var(--node-broadcast)',
  etc: 'var(--node-etc)',
};

// 라인 타입이 삭제됐거나 아직 동기화 전일 때를 위한 예비 색상 (기본 6종)
const fallbackPortColors: Record<string, string> = {
  sdi: '#374151',
  video: '#ef4444',
  audio: '#a855f7',
  network: '#22c55e',
  usb: '#3b82f6',
  control: '#f59e0b',
};

const iconMap: Record<string, React.ReactElement> = {
  video: <Video size={14} />,
  display: <Monitor size={14} />,
  conferencing: <Users size={14} />,
  audio: <Mic size={14} />,
  control: <Cpu size={14} />,
  network: <Network size={14} />,
  broadcast: <Radio size={14} />,
  etc: <MoreHorizontal size={14} />,
};

export function EquipmentNode({ data }: NodeProps<EquipmentNodeType>) {
  const isDimmed = data.dimmed ?? false;
  const isReused = data.isReused;

  // React Flow viewport zoom — used for inverse-scaling the LOD overlay text
  const zoom = useRFStore(state => state.transform[2]);

  // 포트 색상은 라인 타입(케이블 타입) 색상과 항상 일치해야 한다 — 동적 조회
  const lineTypes = useStore(state => state.lineTypes);
  const portColor = (type: string) =>
    lineTypes.find(lt => lt.id === type)?.color || fallbackPortColors[type] || '#fff';

  const bgColor = categoryColors[data.category] || '#666';
  const displayImageUrl = data.imageUrl || getDefaultEquipmentImage(data.name, data.category);
  const calculatedMinHeight = calculateNodeHeight(data);

  // LOD overlay appears when zoomed out
  const showOverlay = zoom < 0.55;
  const isCompact   = zoom < 0.3;

  // Target ~10px on screen → font-size in flow coords = 10 / zoom, capped to fit within node
  const overlayNameSize  = showOverlay ? Math.min(28, Math.max(13, Math.round(10 / zoom))) : 13;
  const overlayModelSize = showOverlay ? Math.min(18, Math.max(10, Math.round( 7 / zoom))) : 10;

  // ── Port renderers (unchanged — always full detail) ────────────────────────
  const inputHandles = data.inputs.map((port) => {
    const c = portColor(port.type);
    return (
      <div key={port.id} style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
        <Handle type="target" position={Position.Left} id={port.id}
          style={{ background: c, width: 8, height: 8, left: -16, border: '1.5px solid var(--handle-border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{port.label}</span>
        </div>
      </div>
    );
  });

  const outputHandles = data.outputs.map((port) => {
    const c = portColor(port.type);
    return (
      <div key={port.id} style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{port.label}</span>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
        </div>
        <Handle type="source" position={Position.Right} id={port.id}
          style={{ background: c, width: 8, height: 8, right: -16, border: '1.5px solid var(--handle-border)' }} />
      </div>
    );
  });

  const bidiHandles = (data.bidirectional || []).map((port) => {
    const c = portColor(port.type);
    return (
      <div key={port.id} style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <Handle type="target" position={Position.Left} id={`target_${port.id}`}
          style={{ background: c, width: 8, height: 8, left: -16, border: '1.5px solid var(--handle-border)' }} />
        <span style={{
          fontSize: 10, color: 'var(--text-primary)', background: 'rgba(255,255,255,0.04)',
          padding: '2px 8px', borderRadius: 4, border: `1px solid ${c}44`,
          display: 'flex', alignItems: 'center', gap: 4, width: '80%', justifyContent: 'center',
        }}>
          <span style={{ color: c }}>↔</span> {port.label}
        </span>
        <Handle type="source" position={Position.Right} id={`source_${port.id}`}
          style={{ background: c, width: 8, height: 8, right: -16, border: '1.5px solid var(--handle-border)' }} />
      </div>
    );
  });

  return (
    <div
      className="glass-panel"
      style={{
        position: 'relative',
        padding: 12,
        borderRadius: 8,
        minWidth: 200,
        minHeight: calculatedMinHeight,
        borderLeft: `4px solid ${bgColor}`,
        display: 'flex',
        flexDirection: 'column',
        opacity: isDimmed ? 0 : 1,
        visibility: isDimmed ? 'hidden' : 'visible',
        pointerEvents: isDimmed ? 'none' : 'all',
        filter: isDimmed ? 'grayscale(0.6)' : 'none',
        transition: 'opacity 0.2s ease, visibility 0.2s ease, filter 0.2s ease',
      }}
    >
      {/* ── LOD Overlay ─────────────────────────────────────────────────────────
          position: absolute + overflow: visible → text scales inversely with
          zoom and can extend beyond node bounds (pointer-events: none ensures
          interaction still passes through to the node and handles).
          The handles are at left/right: -16px (outside this overlay's inset:0
          bounds), so they remain fully clickable.
      ─────────────────────────────────────────────────────────────────────── */}
      {showOverlay && !isDimmed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 7,
            background: 'var(--lod-overlay-bg)',
            zIndex: 2,
            pointerEvents: 'none',
            overflow: 'hidden',          // text stays inside node
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '8px 12px',
            gap: 4,
          }}
        >
          {/* Equipment name — wraps within node, inverse-scaled for readability */}
          <div style={{
            fontSize: overlayNameSize,
            fontWeight: 800,
            color: 'var(--lod-overlay-text)',
            lineHeight: 1.25,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}>
            {data.name}
          </div>

          {/* Model — only at medium LOD, hidden when compact */}
          {!isCompact && (
            <div style={{
              fontSize: overlayModelSize,
              color: 'var(--lod-overlay-text-dim)',
              lineHeight: 1.2,
              wordBreak: 'break-word',
            }}>
              {data.model}
            </div>
          )}
        </div>
      )}

      {/* ── Full detail content (always in DOM so handles stay positioned) ──── */}
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--panel-border)',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 4, background: bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
        }}>
          {iconMap[data.category]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {data.name}
            {isReused && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                background: 'rgba(234,179,8,0.2)', color: '#eab308', border: '1px solid rgba(234,179,8,0.5)',
                flexShrink: 0,
              }}>
                재활용
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{data.model}</div>
        </div>
      </div>

      {/* Product Image */}
      {displayImageUrl && (
        <div style={{
          width: '100%', height: 60, borderRadius: 4, overflow: 'hidden',
          marginBottom: 8, border: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        }}>
          <img src={displayImageUrl} alt={data.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}

      {/* Ports Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {(data.inputs.length > 0 || data.outputs.length > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              {inputHandles}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, alignItems: 'flex-end' }}>
              {outputHandles}
            </div>
          </div>
        )}
        {(data.bidirectional || []).length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            borderTop: (data.inputs.length > 0 || data.outputs.length > 0) ? '1px dashed var(--panel-border)' : 'none',
            paddingTop: (data.inputs.length > 0 || data.outputs.length > 0) ? 8 : 0,
          }}>
            {bidiHandles}
          </div>
        )}
      </div>
    </div>
  );
}

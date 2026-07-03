import { useState } from 'react';
import { useStore } from './store';
import type { BomRowData } from './BomBulkModal';

function getDefaultCableType(lineTypeId: string): 'manufactured' | 'ready-made' {
  if (lineTypeId === 'video' || lineTypeId === 'usb') return 'ready-made';
  return 'manufactured';
}

interface RowState {
  cableType: 'manufactured' | 'ready-made';
  productName: string;
  length: string;
  quantity: string;
}

interface Props {
  edgeId: string;
  onClose: () => void;
}

export function BomEdgeModal({ edgeId, onClose }: Props) {
  const { edges, nodes, lineTypes, cableCatalog, setEdges } = useStore();

  const edge = edges.find(e => e.id === edgeId);
  if (!edge) return null;

  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  const srcData = sourceNode?.data as any;
  const tgtData = targetNode?.data as any;

  const lineTypeId = (edge.data as any)?.lineTypeId || 'sdi';
  const lineType = lineTypes.find(lt => lt.id === lineTypeId);
  const existingBomRows: BomRowData[] = (edge.data as any)?.bomRows || [];

  const [rows, setRows] = useState<RowState[]>(() => {
    const base = existingBomRows.length > 0 ? existingBomRows : [undefined];
    return base.map(ex => ({
      cableType: ex?.cableType ?? getDefaultCableType(lineTypeId),
      productName: ex?.productName ?? '',
      length: ex?.length?.toString() ?? '',
      quantity: ex?.quantity?.toString() ?? '1',
    }));
  });

  const update = (idx: number, field: keyof RowState, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleSave = () => {
    const bomRows: BomRowData[] = rows.map(r => ({
      cableType: r.cableType,
      productName: r.productName,
      length: r.cableType === 'manufactured' && r.length ? parseFloat(r.length) : undefined,
      quantity: r.cableType === 'ready-made' && r.quantity ? parseInt(r.quantity) : undefined,
    }));
    setEdges(edges.map(e => e.id === edgeId ? { ...e, data: { ...(e.data as any), bomRows } } : e));
    onClose();
  };

  const rowLabel = (i: number) => {
    if (rows.length <= 1) return null;
    return `#${i + 1}`;
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel modal-panel"
        style={{ width: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--panel-border)', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700 }}>케이블 정보 편집</h3>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
            {srcData?.name} → {tgtData?.name}
            {lineType && (
              <span style={{ marginLeft: 8, color: lineType.color, fontWeight: 700 }}>
                {lineType.name}
              </span>
            )}
            </p>
        </div>

        {/* 행 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              {rowLabel(i) && (
                <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {rowLabel(i)}
                </span>
              )}
              {row.cableType === 'ready-made' && (() => {
                const catalogMatches = cableCatalog.filter(c => !c.lineTypeId || c.lineTypeId === lineTypeId);
                if (catalogMatches.length === 0) return null;
                return (
                  <select
                    value=""
                    onChange={e => { if (e.target.value) update(i, 'productName', e.target.value); }}
                    style={{ fontSize: 11, padding: '4px 6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--panel-border)', borderRadius: 4, color: 'var(--text-secondary)' }}
                  >
                    <option value="">카탈로그에서 선택...</option>
                    {catalogMatches.map(c => {
                      const label = `${c.manufacturer ? c.manufacturer + ' ' : ''}${c.name} ${c.model}`.trim();
                      return <option key={c.id} value={label}>{label}</option>;
                    })}
                  </select>
                );
              })()}
              <input
                className="glass-input"
                style={{ fontSize: 12 }}
                placeholder="제품명 (예: CANARE L-5CFB, MONSTER HDMI 2m)"
                value={row.productName}
                onChange={e => update(i, 'productName', e.target.value)}
                autoFocus={i === 0}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                  <button
                    className={`glass-button${row.cableType === 'manufactured' ? ' primary' : ''}`}
                    style={{ flex: 1, fontSize: 11 }}
                    onClick={() => update(i, 'cableType', 'manufactured')}
                  >제작 케이블</button>
                  <button
                    className={`glass-button${row.cableType === 'ready-made' ? ' primary' : ''}`}
                    style={{ flex: 1, fontSize: 11 }}
                    onClick={() => update(i, 'cableType', 'ready-made')}
                  >기성 케이블</button>
                </div>
                {row.cableType === 'manufactured' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      className="glass-input"
                      type="number" min="0" step="0.5" placeholder="0"
                      value={row.length}
                      onChange={e => update(i, 'length', e.target.value)}
                      style={{ width: 68, textAlign: 'right', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>m</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      className="glass-input"
                      type="number" min="1" step="1" placeholder="1"
                      value={row.quantity}
                      onChange={e => update(i, 'quantity', e.target.value)}
                      style={{ width: 68, textAlign: 'right', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>개</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--panel-border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="glass-button" onClick={onClose}>취소</button>
          <button className="glass-button primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}

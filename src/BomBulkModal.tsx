import { useState } from 'react';
import { X, Plus, Minus, Save } from 'lucide-react';
import { useStore } from './store';

export interface BomRowData {
  cableType: 'manufactured' | 'ready-made';
  productName: string;
  lineTypeId?: string;
  length?: number;
  quantity?: number;
}

interface BomRow {
  key: string;
  edgeId: string;
  sourceLabel: string;
  targetLabel: string;
  lineTypeId: string;
  cableType: 'manufactured' | 'ready-made';
  productName: string;
  length: string;
  quantity: string;
}

function parseQuantity(qty?: string): number {
  if (!qty) return 1;
  const match = qty.match(/\d+/);
  return match ? Math.max(1, parseInt(match[0])) : 1;
}

function getDefaultCableType(lineTypeId: string): 'manufactured' | 'ready-made' {
  if (lineTypeId === 'video' || lineTypeId === 'usb') return 'ready-made';
  return 'manufactured';
}

interface Props {
  onClose: () => void;
}

export function BomBulkModal({ onClose }: Props) {
  const { nodes, edges, lineTypes, setEdges } = useStore();

  const [rows, setRows] = useState<BomRow[]>(() => {
    const result: BomRow[] = [];

    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;
      if (sourceNode.type !== 'equipment' || targetNode.type !== 'equipment') return;

      const srcData = sourceNode.data as any;
      const tgtData = targetNode.data as any;
      const sourceQty = parseQuantity(srcData.quantity);
      const targetQty = parseQuantity(tgtData.quantity);
      const expandQty = sourceQty > 1 ? sourceQty : targetQty;
      const isSourceExpanded = sourceQty > 1;

      // 엣지의 실제 lineTypeId: style.stroke 색상으로 역추산도 시도
      const edgeData = edge.data as any;
      let lineTypeId = edgeData?.lineTypeId || '';
      if (!lineTypeId && edge.style?.stroke) {
        const matched = lineTypes.find(lt =>
          lt.color.toLowerCase() === (edge.style!.stroke as string).toLowerCase()
        );
        if (matched) lineTypeId = matched.id;
      }
      if (!lineTypeId) lineTypeId = lineTypes[0]?.id || 'sdi';

      const existingBomRows: BomRowData[] = edgeData?.bomRows || [];

      for (let i = 0; i < expandQty; i++) {
        const existing = existingBomRows[i];
        const rowLineTypeId = existing?.lineTypeId || lineTypeId;
        let sourceLabel = srcData.name;
        let targetLabel = tgtData.name;
        if (expandQty > 1) {
          if (isSourceExpanded) sourceLabel = `${srcData.name} #${i + 1}`;
          else targetLabel = `${tgtData.name} #${i + 1}`;
        }

        result.push({
          key: `${edge.id}::${i}`,
          edgeId: edge.id,
          sourceLabel,
          targetLabel,
          lineTypeId: rowLineTypeId,
          cableType: existing?.cableType ?? getDefaultCableType(rowLineTypeId),
          productName: existing?.productName ?? '',
          length: existing?.length?.toString() ?? '',
          quantity: existing?.quantity?.toString() ?? '1',
        });
      }
    });

    return result;
  });

  const updateRow = (
    key: string,
    field: keyof Pick<BomRow, 'cableType' | 'productName' | 'length' | 'quantity' | 'lineTypeId'>,
    value: string
  ) => {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      const updated = { ...r, [field]: value };
      // lineTypeId 변경 시 cableType 기본값도 자동 전환
      if (field === 'lineTypeId') {
        updated.cableType = getDefaultCableType(value);
      }
      return updated;
    }));
  };

  const addRowAfter = (key: string) => {
    const idx = rows.findIndex(r => r.key === key);
    if (idx === -1) return;
    const ref = rows[idx];
    const sameEdgeCount = rows.filter(r => r.edgeId === ref.edgeId).length;
    const newKey = `${ref.edgeId}::extra-${Date.now()}`;
    const newRow: BomRow = {
      ...ref,
      key: newKey,
      sourceLabel: ref.sourceLabel.replace(/ #\d+$/, '') + ` #${sameEdgeCount + 1}`,
      productName: ref.productName,
      length: '',
      quantity: '1',
    };
    const next = [...rows];
    next.splice(idx + 1, 0, newRow);
    setRows(next);
  };

  const removeRow = (key: string) => {
    const edgeId = rows.find(r => r.key === key)?.edgeId;
    if (rows.filter(r => r.edgeId === edgeId).length <= 1) return;
    setRows(prev => prev.filter(r => r.key !== key));
  };

  const handleSave = () => {
    const byEdge: Record<string, BomRow[]> = {};
    rows.forEach(r => {
      if (!byEdge[r.edgeId]) byEdge[r.edgeId] = [];
      byEdge[r.edgeId].push(r);
    });

    const updatedEdges = edges.map(edge => {
      const edgeRows = byEdge[edge.id];
      if (!edgeRows) return edge;
      const bomRows: BomRowData[] = edgeRows.map(r => ({
        cableType: r.cableType,
        productName: r.productName,
        lineTypeId: r.lineTypeId,
        length: r.cableType === 'manufactured' && r.length ? parseFloat(r.length) : undefined,
        quantity: r.cableType === 'ready-made' && r.quantity ? parseInt(r.quantity) : undefined,
      }));

      // lineTypeId가 변경됐으면 엣지 스타일도 업데이트
      const firstRow = edgeRows[0];
      const newLineType = lineTypes.find(lt => lt.id === firstRow.lineTypeId);
      const updatedStyle = newLineType
        ? { ...edge.style, stroke: newLineType.color }
        : edge.style;

      return {
        ...edge,
        style: updatedStyle,
        data: { ...(edge.data as any), bomRows, lineTypeId: firstRow.lineTypeId },
      };
    });

    setEdges(updatedEdges);
    onClose();
  };

  const filledCount = rows.filter(r => r.productName.trim()).length;

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{ width: 'min(96vw, 860px)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', borderRadius: 14, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>케이블 명세 일괄 입력</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
              총 {rows.length}개 · {filledCount}개 입력됨
              {rows.length - filledCount > 0 && (
                <span style={{ color: '#f59e0b', marginLeft: 6 }}>⚠ {rows.length - filledCount}개 미입력</span>
              )}
            </p>
          </div>
          <button className="glass-button icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {/* 테이블 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)', fontSize: 13 }}>
              연결된 장비가 없습니다. 구성도를 먼저 작성해 주세요.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'rgba(10,16,32,0.97)', zIndex: 1 }}>
                <tr>
                  <th style={thStyle}>연결 (From → To)</th>
                  <th style={{ ...thStyle, width: 120 }}>케이블 종류</th>
                  <th style={thStyle}>제품명</th>
                  <th style={{ ...thStyle, width: 100 }}>구분</th>
                  <th style={{ ...thStyle, width: 90 }}>길이/수량</th>
                  <th style={{ ...thStyle, width: 48, textAlign: 'center' }}>+/-</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isGroupStart = idx === 0 || rows[idx - 1].edgeId !== row.edgeId;
                  const edgeRowCount = rows.filter(r => r.edgeId === row.edgeId).length;
                  const lineType = lineTypes.find(lt => lt.id === row.lineTypeId);
                  const lineColor = lineType?.color || '#94a3b8';

                  return (
                    <tr
                      key={row.key}
                      style={{
                        background: isGroupStart ? 'rgba(255,255,255,0.025)' : 'transparent',
                        borderTop: isGroupStart ? '1px solid rgba(255,255,255,0.07)' : 'none',
                      }}
                    >
                      {/* 연결 */}
                      <td style={tdStyle}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.sourceLabel}</span>
                        <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>→</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{row.targetLabel}</span>
                      </td>
                      {/* 케이블 종류 드롭다운 */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: lineColor, flexShrink: 0 }} />
                          <select
                            value={row.lineTypeId}
                            onChange={e => updateRow(row.key, 'lineTypeId', e.target.value)}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: `1px solid ${lineColor}55`,
                              borderRadius: 4,
                              color: lineColor,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '3px 4px',
                              cursor: 'pointer',
                              outline: 'none',
                              width: '100%',
                            }}
                          >
                            {lineTypes.map(lt => (
                              <option key={lt.id} value={lt.id} style={{ background: '#0f172a', color: lt.color }}>
                                {lt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      {/* 제품명 */}
                      <td style={tdStyle}>
                        <input
                          className="glass-input"
                          style={{ width: '100%', fontSize: 11, padding: '4px 7px' }}
                          placeholder="예: CANARE L-5CFB, MONSTER HDMI 2m"
                          value={row.productName}
                          onChange={e => updateRow(row.key, 'productName', e.target.value)}
                        />
                      </td>
                      {/* 구분 */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button
                            className={`glass-button${row.cableType === 'manufactured' ? ' primary' : ''}`}
                            style={{ flex: 1, fontSize: 10, padding: '3px 3px' }}
                            onClick={() => updateRow(row.key, 'cableType', 'manufactured')}
                          >제작</button>
                          <button
                            className={`glass-button${row.cableType === 'ready-made' ? ' primary' : ''}`}
                            style={{ flex: 1, fontSize: 10, padding: '3px 3px' }}
                            onClick={() => updateRow(row.key, 'cableType', 'ready-made')}
                          >기성</button>
                        </div>
                      </td>
                      {/* 길이/수량 */}
                      <td style={tdStyle}>
                        {row.cableType === 'manufactured' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <input
                              className="glass-input"
                              style={{ width: 52, fontSize: 11, padding: '4px 5px', textAlign: 'right' }}
                              type="number" min="0" step="0.5" placeholder="0"
                              value={row.length}
                              onChange={e => updateRow(row.key, 'length', e.target.value)}
                            />
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>m</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <input
                              className="glass-input"
                              style={{ width: 52, fontSize: 11, padding: '4px 5px', textAlign: 'right' }}
                              type="number" min="1" step="1" placeholder="1"
                              value={row.quantity}
                              onChange={e => updateRow(row.key, 'quantity', e.target.value)}
                            />
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>개</span>
                          </div>
                        )}
                      </td>
                      {/* 행 조작 */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <button
                            className="glass-button icon-btn"
                            style={{ padding: '3px', color: '#10b981' }}
                            title="행 추가"
                            onClick={() => addRowAfter(row.key)}
                          ><Plus size={11} /></button>
                          <button
                            className="glass-button icon-btn"
                            style={{ padding: '3px', color: '#ef4444', opacity: edgeRowCount <= 1 ? 0.3 : 1 }}
                            disabled={edgeRowCount <= 1}
                            title="행 삭제"
                            onClick={() => removeRow(row.key)}
                          ><Minus size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 */}
        <div style={{ padding: '11px 18px', borderTop: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button className="glass-button" onClick={onClose}>취소</button>
          <button className="glass-button primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={13} /> 전체 저장
          </button>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--panel-border)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px',
  verticalAlign: 'middle',
};

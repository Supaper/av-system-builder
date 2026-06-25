import { useMemo } from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';
import { useStore } from './store';
import type { BomRowData } from './BomBulkModal';

interface Props {
  onClose: () => void;
}

export function BomReportModal({ onClose }: Props) {
  const { edges, nodes } = useStore();

  const { manufactured, readyMade, unlabeledCount, totalCables } = useMemo(() => {
    const mfMap: Record<string, number> = {};
    const rmMap: Record<string, number> = {};
    let unlabeled = 0;
    let total = 0;

    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;
      if (sourceNode.type !== 'equipment' || targetNode.type !== 'equipment') return;

      const bomRows: BomRowData[] = (edge.data as any)?.bomRows || [];

      if (bomRows.length === 0) {
        unlabeled++;
        total++;
        return;
      }

      bomRows.forEach(row => {
        total++;
        if (!row.productName?.trim()) {
          unlabeled++;
          return;
        }
        const name = row.productName.trim();
        if (row.cableType === 'manufactured') {
          mfMap[name] = (mfMap[name] ?? 0) + (row.length ?? 0);
        } else {
          rmMap[name] = (rmMap[name] ?? 0) + (row.quantity ?? 1);
        }
      });
    });

    return {
      manufactured: Object.entries(mfMap).sort((a, b) => b[1] - a[1]),
      readyMade: Object.entries(rmMap).sort((a, b) => b[1] - a[1]),
      unlabeledCount: unlabeled,
      totalCables: total,
    };
  }, [edges, nodes]);

  const handleExportCSV = () => {
    const lines: string[] = ['구분,제품명,수량/길이,단위'];
    readyMade.forEach(([name, qty]) => lines.push(`기성,${name},${qty},개`));
    manufactured.forEach(([name, len]) => lines.push(`제작,${name},${len},m`));

    const csv = '﻿' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BOM_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = readyMade.length > 0 || manufactured.length > 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{ width: 580, maxHeight: '82vh', display: 'flex', flexDirection: 'column', borderRadius: 14, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>케이블 명세서 (BOM)</h2>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
              총 {totalCables}개 케이블
              {unlabeledCount > 0 && (
                <span style={{ color: '#f59e0b', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <AlertTriangle size={11} /> 미입력 {unlabeledCount}개
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasData && (
              <button className="glass-button" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={13} /> CSV
              </button>
            )}
            <button className="glass-button icon-btn" onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        {/* 내용 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {!hasData && unlabeledCount === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
              집계할 케이블 정보가 없습니다.
            </div>
          )}

          {/* 기성 케이블 */}
          {readyMade.length > 0 && (
            <section>
              <h3 style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
                기성 케이블 — 제품별 수량
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>제품명</th>
                    <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>수량</th>
                  </tr>
                </thead>
                <tbody>
                  {readyMade.map(([name, qty]) => (
                    <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={tdStyle}>{name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#60a5fa' }}>
                        {qty} 개
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 제작 케이블 */}
          {manufactured.length > 0 && (
            <section>
              <h3 style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                제작 케이블 — 제품별 총 길이
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>제품명</th>
                    <th style={{ ...thStyle, width: 100, textAlign: 'right' }}>총 길이</th>
                  </tr>
                </thead>
                <tbody>
                  {manufactured.map(([name, len]) => (
                    <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={tdStyle}>{name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                        {Number.isInteger(len) ? len : len.toFixed(1)} m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* 미입력 경고 */}
          {unlabeledCount > 0 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#f59e0b',
            }}>
              <AlertTriangle size={14} />
              케이블 정보가 입력되지 않은 연결선 {unlabeledCount}개 — BOM 모드에서 일괄 입력 또는 더블클릭으로 편집하세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--panel-border)',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  verticalAlign: 'middle',
};

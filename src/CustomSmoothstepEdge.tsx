import { BaseEdge, EdgeLabelRenderer, useStore as useRFStore } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { useMemo } from 'react';
import type { BomRowData } from './BomBulkModal';
import { getEdgePoints, buildOrthogonalPath, computeJumps, getEdgeEndpointsFromLookup } from './utils/edgeGeometry';
import type { XY } from './utils/edgeGeometry';

function buildBomLabel(bomRows: BomRowData[]): string {
  const filled = bomRows.filter(r => r.productName?.trim());
  if (filled.length === 0) return '⚠ 미입력';

  const names = [...new Set(filled.map(r => r.productName.trim()))];
  const nameDisplay = names.length === 1 ? names[0] : `${names.length}종`;

  const hasManufactured = filled.some(r => r.cableType === 'manufactured');
  const hasReadyMade = filled.some(r => r.cableType === 'ready-made');

  if (hasManufactured && !hasReadyMade) {
    const total = filled.reduce((s, r) => s + (r.length ?? 0), 0);
    const totalStr = Number.isInteger(total) ? `${total}m` : `${total.toFixed(1)}m`;
    return `${nameDisplay}  ${totalStr}`;
  }
  if (hasReadyMade && !hasManufactured) {
    const total = filled.reduce((s, r) => s + (r.quantity ?? 1), 0);
    return `${nameDisplay}  ×${total}`;
  }
  return nameDisplay;
}

export function CustomSmoothstepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData = data as { splitOffset?: number; label?: string; isBomMode?: boolean; bomRows?: BomRowData[] } | undefined;
  const splitOffset = edgeData?.splitOffset ?? 0;
  const label = edgeData?.label ?? '';
  const isBomMode = edgeData?.isBomMode ?? false;
  const bomRows: BomRowData[] = edgeData?.bomRows ?? [];
  const isHorizontal = sourcePosition === 'left' || sourcePosition === 'right';

  const bomLabel = isBomMode ? buildBomLabel(bomRows) : '';
  const bomLabelMissing = isBomMode && bomLabel === '⚠ 미입력';

  // 다른 엣지들의 지오메트리 (교차 점프 계산용) — 렌더 시점의 RF 스토어에서
  // 직접 읽어 이 엣지가 props로 받은 좌표와 같은 프레임을 보장한다.
  const otherEdges = useRFStore(s => s.edges);
  const nodeLookup = useRFStore(s => s.nodeLookup);

  // 경로 지점 계산은 edgeGeometry로 일원화 (교차 계산과 동일 지오메트리)
  const points = getEdgePoints({ sourceX, sourceY, targetX, targetY, isHorizontal, splitOffset });

  const jumps: XY[] = useMemo(() => {
    const others: XY[][] = [];
    for (const e of otherEdges) {
      if (e.id === id || e.hidden) continue;
      const g = getEdgeEndpointsFromLookup(e, nodeLookup as Map<string, unknown>);
      if (!g) continue;
      others.push(getEdgePoints({ ...g, splitOffset: (e.data as any)?.splitOffset ?? 0 }));
    }
    return computeJumps(points, others);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherEdges, nodeLookup, id, sourceX, sourceY, targetX, targetY, splitOffset]);

  const path = buildOrthogonalPath(points, jumps);

  // Midpoint for label placement (approximate center of the routing path)
  const labelX = isHorizontal
    ? (sourceX + targetX) / 2 + splitOffset * 0.5
    : (sourceX + targetX) / 2;
  const labelY = isHorizontal
    ? (sourceY + targetY) / 2
    : (sourceY + targetY) / 2 + splitOffset * 0.5;

  const edgeColor = (style?.stroke as string) || '#94a3b8';

  return (
    <>
      <BaseEdge id={id} path={path} style={isBomMode ? { ...style, opacity: bomLabelMissing ? 0.4 : 1 } : style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        {/* 일반 레이블 (BOM 모드 OFF 시) */}
        {!isBomMode && label && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'rgba(10, 16, 32, 0.92)',
              padding: '2px 7px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              color: edgeColor,
              border: `1px solid ${edgeColor}55`,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              letterSpacing: '0.03em',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        )}
        {/* BOM 레이블 (BOM 모드 ON 시) */}
        {isBomMode && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: bomLabelMissing ? 'rgba(245,158,11,0.12)' : 'rgba(10, 16, 32, 0.92)',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              color: bomLabelMissing ? '#f59e0b' : edgeColor,
              border: `1px solid ${bomLabelMissing ? '#f59e0b55' : edgeColor + '55'}`,
              pointerEvents: 'none',
              whiteSpace: 'pre',
              letterSpacing: '0.03em',
              lineHeight: 1.5,
              textAlign: 'center',
            }}
            className="nodrag nopan"
          >
            {bomLabel}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

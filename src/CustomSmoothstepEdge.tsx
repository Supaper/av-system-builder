import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { BomRowData } from './BomBulkModal';
import { getEdgePoints, buildOrthogonalPath } from './utils/edgeGeometry';
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
  const edgeData = data as { splitOffset?: number; label?: string; isBomMode?: boolean; bomRows?: BomRowData[]; jumps?: XY[] } | undefined;
  const splitOffset = edgeData?.splitOffset ?? 0;
  const label = edgeData?.label ?? '';
  const isBomMode = edgeData?.isBomMode ?? false;
  const bomRows: BomRowData[] = edgeData?.bomRows ?? [];
  const jumps: XY[] = edgeData?.jumps ?? [];
  const isHorizontal = sourcePosition === 'left' || sourcePosition === 'right';

  const bomLabel = isBomMode ? buildBomLabel(bomRows) : '';
  const bomLabelMissing = isBomMode && bomLabel === '⚠ 미입력';

  // 경로 지점 계산은 edgeGeometry로 일원화 — 교차 점프(hop) 계산과 반드시
  // 같은 지오메트리를 봐야 하기 때문 (edgeProcessing.attachEdgeJumps 참고)
  const points = getEdgePoints({ sourceX, sourceY, targetX, targetY, isHorizontal, splitOffset });
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

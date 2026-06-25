import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { BomRowData } from './BomBulkModal';

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

  let path = '';

  if (isHorizontal) {
    const isBackEdge = targetX < sourceX - 20;

    if (isBackEdge) {
      // Back-edge (target is LEFT of source): route below both endpoints as a U-shape
      // so it doesn't cross forward edges in the diagram.
      const exitH = 50;
      const R = 10;
      const loopY = Math.max(sourceY, targetY) + 90 + Math.abs(splitOffset);
      const exitX = sourceX + exitH;
      const entryX = targetX - exitH;

      const dyTop1 = loopY - sourceY;   // height from source to loop bottom (source side)
      const dyTop2 = loopY - targetY;   // height from loop bottom to target (target side)
      const dxMid = exitX - entryX;     // width of the horizontal bottom segment

      if (dyTop1 < R * 2 || dyTop2 < R * 2 || dxMid < R * 2) {
        path = `M ${sourceX} ${sourceY} H ${exitX} V ${loopY} H ${entryX} V ${targetY} H ${targetX}`;
      } else {
        path =
          `M ${sourceX} ${sourceY} ` +
          `H ${exitX - R} ` +
          `Q ${exitX} ${sourceY} ${exitX} ${sourceY + R} ` +
          `V ${loopY - R} ` +
          `Q ${exitX} ${loopY} ${exitX - R} ${loopY} ` +
          `H ${entryX + R} ` +
          `Q ${entryX} ${loopY} ${entryX} ${loopY - R} ` +
          `V ${targetY + R} ` +
          `Q ${entryX} ${targetY} ${entryX + R} ${targetY} ` +
          `H ${targetX}`;
      }
    } else {
    const midpointX = (sourceX + targetX) / 2;
    const splitX = midpointX + splitOffset;
    const dx = splitX > sourceX ? 1 : -1;
    const dy = targetY > sourceY ? 1 : -1;
    const R = Math.min(10, Math.abs(splitX - sourceX) / 2, Math.abs(targetX - splitX) / 2, Math.abs(targetY - sourceY) / 2);

    if (R <= 0) {
      path = `M ${sourceX} ${sourceY} H ${splitX} V ${targetY} H ${targetX}`;
    } else {
      path =
        `M ${sourceX} ${sourceY} ` +
        `H ${splitX - R * dx} ` +
        `Q ${splitX} ${sourceY} ${splitX} ${sourceY + R * dy} ` +
        `V ${targetY - R * dy} ` +
        `Q ${splitX} ${targetY} ${splitX + R * dx} ${targetY} ` +
        `H ${targetX}`;
    }
    }
  } else {
    const midpointY = (sourceY + targetY) / 2;
    const splitY = midpointY + splitOffset;
    const dx = targetX > sourceX ? 1 : -1;
    const dy = splitY > sourceY ? 1 : -1;
    const R = Math.min(10, Math.abs(splitY - sourceY) / 2, Math.abs(targetY - splitY) / 2, Math.abs(targetX - sourceX) / 2);

    if (R <= 0) {
      path = `M ${sourceX} ${sourceY} V ${splitY} H ${targetX} V ${targetY}`;
    } else {
      path =
        `M ${sourceX} ${sourceY} ` +
        `V ${splitY - R * dy} ` +
        `Q ${sourceX} ${splitY} ${sourceX + R * dx} ${splitY} ` +
        `H ${targetX - R * dx} ` +
        `Q ${targetX} ${splitY} ${targetX} ${splitY + R * dy} ` +
        `V ${targetY}`;
    }
  }

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

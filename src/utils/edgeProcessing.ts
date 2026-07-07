import type { Node, Edge } from '@xyflow/react';
import { calculateNodeHeight, getPortYOffset } from '../store';
import { getEdgePoints, computeJumps } from './edgeGeometry';
import type { XY } from './edgeGeometry';

interface EdgeEndpoints {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isHorizontal: boolean;
  baseX: number;
  baseY: number;
}

function getEdgeEndpoints(edge: Edge, nodeMap: Record<string, Node>): EdgeEndpoints | null {
  const sourceNode = nodeMap[edge.source];
  const targetNode = nodeMap[edge.target];
  if (!sourceNode || !targetNode) return null;

  const isHorizontal = (targetNode as any).targetPosition !== 'top';

  if (isHorizontal) {
    // React Flow가 측정한 실제 노드 폭 사용 (핸들은 노드 우측 경계에 위치)
    const srcWidth = (sourceNode as any).measured?.width ?? (sourceNode as any).width ?? 200;
    const sourceX = sourceNode.position.x + srcWidth;
    const targetX = targetNode.position.x;
    const sourceY = sourceNode.position.y + getPortYOffset(sourceNode.data as any, edge.sourceHandle);
    const targetY = targetNode.position.y + getPortYOffset(targetNode.data as any, edge.targetHandle);
    return { sourceX, sourceY, targetX, targetY, isHorizontal, baseX: (sourceX + targetX) / 2, baseY: (sourceY + targetY) / 2 };
  } else {
    const srcH = calculateNodeHeight(sourceNode.data as any);
    const sourceX = sourceNode.position.x + 100;
    const sourceY = sourceNode.position.y + srcH;
    const targetX = targetNode.position.x + 100;
    const targetY = targetNode.position.y;
    return { sourceX, sourceY, targetX, targetY, isHorizontal, baseX: (sourceX + targetX) / 2, baseY: (sourceY + targetY) / 2 };
  }
}

function edgesConflict(infoI: EdgeEndpoints, infoJ: EdgeEndpoints): boolean {
  if (infoI.isHorizontal !== infoJ.isHorizontal) return false;

  if (infoI.isHorizontal) {
    if (Math.abs(infoI.baseX - infoJ.baseX) >= 80) return false;
    const minYI = Math.min(infoI.sourceY, infoI.targetY);
    const maxYI = Math.max(infoI.sourceY, infoI.targetY);
    const minYJ = Math.min(infoJ.sourceY, infoJ.targetY);
    const maxYJ = Math.max(infoJ.sourceY, infoJ.targetY);
    return Math.max(minYI, minYJ) <= Math.min(maxYI, maxYJ) + 12;
  } else {
    if (Math.abs(infoI.baseY - infoJ.baseY) >= 80) return false;
    const minXI = Math.min(infoI.sourceX, infoI.targetX);
    const maxXI = Math.max(infoI.sourceX, infoI.targetX);
    const minXJ = Math.min(infoJ.sourceX, infoJ.targetX);
    const maxXJ = Math.max(infoJ.sourceX, infoJ.targetX);
    return Math.max(minXI, minXJ) <= Math.min(maxXI, maxXJ) + 12;
  }
}

const SPACING = 20;

/**
 * Assigns splitOffset values to edges so that parallel edges don't overlap
 * and, where possible, don't cross each other.
 *
 * Algorithm:
 *  Stage 1 — Fan-in groups (multiple sources → same target):
 *    Sort by sourceY ascending → assign offsets in that order.
 *    When source-Y order matches target-port-Y order (the common case),
 *    this guarantees crossing-free H-V-H routing.
 *
 *  Stage 2 — Fan-out groups (same source → multiple targets):
 *    Sort by targetY ascending → assign offsets in that order.
 *    Only applies to edges not already handled by Stage 1.
 *
 *  Stage 3 — Generic overlapping edges (neither same source nor target):
 *    Detect overlapping paths via conflict graph, group into components,
 *    sort each component by midY (or midX), assign centered offsets.
 */
export function processEdgesWithOffsets(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeMap: Record<string, Node> = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  const infoMap = new Map<string, EdgeEndpoints | null>();
  edges.forEach(e => infoMap.set(e.id, getEdgeEndpoints(e, nodeMap)));

  const hasSpan = (info: EdgeEndpoints) =>
    info.isHorizontal
      ? Math.abs(info.sourceY - info.targetY) > 5
      : Math.abs(info.sourceX - info.targetX) > 5;

  const edgeOffsets: Record<string, number> = {};
  const handled = new Set<string>();

  // ── Stage 0: Same-pair edges (same source AND target node) ────────────────
  // When multiple edges connect the exact same source→target pair (e.g. SDI +
  // Control both going from NodeA to NodeB), the offsets must be assigned
  // direction-aware so the H-V-H routes don't create unnecessary crossings.
  //
  // For DOWN (avgDy ≥ 0): sort sourceY DESCENDING so the top-source edge gets
  // the largest (most positive) offset — its splitX is further right, keeping
  // its return-horizontal clear of the lower edge's vertical segment.
  // For UP (avgDy < 0): sort sourceY ASCENDING (top source → smallest offset).
  const byPair = new Map<string, Edge[]>();
  edges.forEach(e => {
    const key = `${e.source}::${e.target}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(e);
  });
  byPair.forEach(group => {
    const active = group.filter(e => {
      const info = infoMap.get(e.id);
      return info && hasSpan(info);
    });
    if (active.length < 2) return;

    const avgDy =
      active.reduce((sum, e) => {
        const info = infoMap.get(e.id)!;
        return sum + (info.targetY - info.sourceY);
      }, 0) / active.length;

    // DOWN: reverse sort → top source gets positive offset (largest splitX)
    // UP:   normal sort  → top source gets negative offset (smallest splitX)
    if (avgDy >= 0) {
      active.sort((a, b) => infoMap.get(b.id)!.sourceY - infoMap.get(a.id)!.sourceY);
    } else {
      active.sort((a, b) => infoMap.get(a.id)!.sourceY - infoMap.get(b.id)!.sourceY);
    }
    const n = active.length;
    active.forEach((e, i) => {
      edgeOffsets[e.id] = (i - (n - 1) / 2) * SPACING;
      handled.add(e.id);
    });
  });

  // ── Stage 1: Fan-in (multiple sources → same target node) ─────────────────
  // Correct crossing-free order: sort by sourceY.
  // Top source → smallest offset (leftmost split X) → arrives at top port.
  // This matches the natural visual order and prevents crossings when the
  // sourceY ranking equals the targetPortY ranking (the typical case).
  const byTarget = new Map<string, Edge[]>();
  edges.forEach(e => {
    if (!byTarget.has(e.target)) byTarget.set(e.target, []);
    byTarget.get(e.target)!.push(e);
  });
  byTarget.forEach(group => {
    const active = group.filter(e => {
      const info = infoMap.get(e.id);
      return info && hasSpan(info) && !handled.has(e.id);
    });
    if (active.length < 2) return;

    active.sort((a, b) => infoMap.get(a.id)!.sourceY - infoMap.get(b.id)!.sourceY);
    const n = active.length;
    active.forEach((e, i) => {
      edgeOffsets[e.id] = (i - (n - 1) / 2) * SPACING;
      handled.add(e.id);
    });
  });

  // ── Stage 2: Fan-out (same source node → multiple targets) ────────────────
  // Sort by targetY; only process edges not yet assigned in Stage 1.
  const bySource = new Map<string, Edge[]>();
  edges.forEach(e => {
    if (!bySource.has(e.source)) bySource.set(e.source, []);
    bySource.get(e.source)!.push(e);
  });
  bySource.forEach(group => {
    const active = group.filter(e => {
      const info = infoMap.get(e.id);
      return info && hasSpan(info) && !handled.has(e.id) && edgeOffsets[e.id] === undefined;
    });
    if (active.length < 2) return;

    active.sort((a, b) => infoMap.get(a.id)!.targetY - infoMap.get(b.id)!.targetY);
    const n = active.length;
    active.forEach((e, i) => {
      edgeOffsets[e.id] = (i - (n - 1) / 2) * SPACING;
    });
  });

  // ── Stage 3: Generic overlapping edges ────────────────────────────────────
  // Build a conflict graph of edges sharing neither source nor target but whose
  // routing corridors overlap. Sort each component by midY/midX so that
  // offset order matches spatial order (same crossing-avoidance principle).
  const remaining = edges.filter(e => {
    const info = infoMap.get(e.id);
    return info && hasSpan(info) && edgeOffsets[e.id] === undefined;
  });

  if (remaining.length >= 2) {
    const n = remaining.length;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (edgesConflict(infoMap.get(remaining[i].id)!, infoMap.get(remaining[j].id)!)) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    const visited = new Set<number>();
    const components: number[][] = [];
    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;
      const comp: number[] = [];
      const queue = [i];
      visited.add(i);
      while (queue.length > 0) {
        const u = queue.shift()!;
        comp.push(u);
        adj[u].forEach(v => {
          if (!visited.has(v)) { visited.add(v); queue.push(v); }
        });
      }
      components.push(comp);
    }

    components.forEach(comp => {
      if (comp.length < 2) return;
      const isH = infoMap.get(remaining[comp[0]].id)!.isHorizontal;
      comp.sort((a, b) => {
        const ia = infoMap.get(remaining[a].id)!;
        const ib = infoMap.get(remaining[b].id)!;
        return isH ? ia.baseY - ib.baseY : ia.baseX - ib.baseX;
      });
      const total = comp.length;
      comp.forEach((u, idx) => {
        edgeOffsets[remaining[u].id] = (idx - (total - 1) / 2) * SPACING;
      });
    });
  }

  return edges.map(edge => ({
    ...edge,
    type: 'customSmoothstep',
    data: {
      ...((edge as any).data || {}),
      splitOffset: edgeOffsets[edge.id] ?? 0,
    },
  }));
}

/**
 * React Flow 내부 실측값(internals.handleBounds)으로 엣지 양끝 좌표를 구한다.
 * getPortYOffset 기반 근사치는 헤더 실제 높이와 어긋날 수 있어(텍스트 줄바꿈 등)
 * 점프처럼 픽셀 정밀도가 필요한 계산에는 반드시 이 실측 좌표를 쓴다 —
 * CustomSmoothstepEdge가 렌더링에 받는 좌표와 동일한 소스다.
 */
function getEdgeEndpointsFromInternals(
  edge: Edge,
  getInternalNode: (id: string) => any
): { sourceX: number; sourceY: number; targetX: number; targetY: number; isHorizontal: boolean } | null {
  const sn = getInternalNode(edge.source);
  const tn = getInternalNode(edge.target);
  if (!sn?.internals?.handleBounds || !tn?.internals?.handleBounds) return null;

  const sBounds = sn.internals.handleBounds.source || [];
  const tBounds = tn.internals.handleBounds.target || [];
  const sb = (edge.sourceHandle ? sBounds.find((h: any) => h.id === edge.sourceHandle) : null) ?? sBounds[0];
  const tb = (edge.targetHandle ? tBounds.find((h: any) => h.id === edge.targetHandle) : null) ?? tBounds[0];
  if (!sb || !tb) return null;

  return {
    sourceX: sn.internals.positionAbsolute.x + sb.x + sb.width / 2,
    sourceY: sn.internals.positionAbsolute.y + sb.y + sb.height / 2,
    targetX: tn.internals.positionAbsolute.x + tb.x + tb.width / 2,
    targetY: tn.internals.positionAbsolute.y + tb.y + tb.height / 2,
    isHorizontal: ((tn as any).targetPosition ?? 'left') !== 'top',
  };
}

/**
 * 화면에 보이는 엣지들끼리의 H×V 교차 지점을 계산해 각 엣지 data.jumps에 부착.
 * 수평 세그먼트를 가진 쪽이 교차점에서 반원 아치로 "점프"한다.
 *
 * processEdgesWithOffsets 이후(오프셋 확정 후), 라인 타입 필터링 이후의
 * "실제로 보이는" 엣지 목록에 적용해야 한다 — 숨긴 선 위를 점프하면 어색하다.
 * getInternalNode는 useReactFlow()의 것 — 실측 핸들 좌표용 (마운트 전이면
 * handleBounds가 없어 해당 엣지는 건너뛰고, 측정 완료 후 재계산된다).
 */
export function attachEdgeJumps(
  edges: Edge[],
  getInternalNode: (id: string) => any
): Edge[] {
  if (edges.length < 2) return edges;

  const polylines = new Map<string, XY[]>();
  edges.forEach(e => {
    const info = getEdgeEndpointsFromInternals(e, getInternalNode);
    if (!info) return;
    const splitOffset = ((e as any).data?.splitOffset as number) ?? 0;
    polylines.set(e.id, getEdgePoints({ ...info, splitOffset }));
  });

  return edges.map(edge => {
    const points = polylines.get(edge.id);
    if (!points) return edge;
    const others: XY[][] = [];
    polylines.forEach((poly, id) => { if (id !== edge.id) others.push(poly); });
    const jumps = computeJumps(points, others);
    if (jumps.length === 0 && !(edge as any).data?.jumps) return edge;
    return {
      ...edge,
      data: { ...((edge as any).data || {}), jumps },
    };
  });
}

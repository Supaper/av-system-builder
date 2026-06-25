import type { Node, Edge } from '@xyflow/react';
import { calculateNodeHeight, getPortYOffset } from '../store';

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
    const sourceX = sourceNode.position.x + 200;
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
      return info && hasSpan(info);
    });
    if (active.length < 2) return;

    active.sort((a, b) => infoMap.get(a.id)!.sourceY - infoMap.get(b.id)!.sourceY);
    const n = active.length;
    active.forEach((e, i) => {
      edgeOffsets[e.id] = (i - (n - 1) / 2) * SPACING;
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
      return info && hasSpan(info) && edgeOffsets[e.id] === undefined;
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

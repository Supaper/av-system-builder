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

/** 양쪽 끝이 모두 양방향(bidi) 핸들인 엣지인가 — bidi 핸들만 source_/target_ 접두를 가진다 */
export function isBidiBidiEdge(edge: Edge): boolean {
  return !!edge.sourceHandle?.startsWith('source_') && !!edge.targetHandle?.startsWith('target_');
}

/** 노드 가로 중심 좌표 */
function nodeCenterX(node: Node): number {
  const w = (node as any).measured?.width ?? (node as any).width ?? 200;
  return node.position.x + w / 2;
}

/**
 * 양방향↔양방향 엣지의 렌더 방향 결정: 왼쪽 노드에서 나가 오른쪽 노드로
 * 들어가도록 뒤집을지 여부. (bidi 포트는 방향 개념이 없으므로 저장된
 * source/target은 연결 당시의 드래그 방향일 뿐이다)
 */
export function shouldFlipBidiEdge(edge: Edge, nodeMap: Record<string, Node>): boolean {
  if (!isBidiBidiEdge(edge)) return false;
  const s = nodeMap[edge.source];
  const t = nodeMap[edge.target];
  if (!s || !t) return false;
  return nodeCenterX(s) > nodeCenterX(t);
}

/**
 * 양방향↔양방향 엣지를 노드 상대 위치에 맞게 정방향(좌→우)으로 정규화.
 * 저장 데이터는 건드리지 않는 렌더 전용 변환 — 노드를 드래그해 좌우가
 * 바뀌면 다음 렌더에서 즉시 반대쪽 핸들로 붙는다.
 */
export function normalizeBidiEdges(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeMap: Record<string, Node> = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  return edges.map(edge => {
    if (!shouldFlipBidiEdge(edge, nodeMap)) return edge;
    return {
      ...edge,
      source: edge.target,
      target: edge.source,
      sourceHandle: `source_${edge.targetHandle!.substring(7)}`,
      targetHandle: `target_${edge.sourceHandle!.substring(7)}`,
    };
  });
}

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

  // 좌표는 스토어 노드 위치 + 교정된 상수(NODE_HEADER_HEIGHT 등) 기반 근사치.
  // RF internals를 여기서 읽으면 한 프레임 지난 좌표(레이아웃 직후 stale)를
  // 읽을 수 있어 오프셋 판단이 고착된다 — 픽셀 정밀도가 필요한 점프 계산은
  // 렌더 시점(CustomSmoothstepEdge)에서 수행한다.
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

  // ── Stage 4: 전역 세로 통로 충돌 해소 ─────────────────────────────────────
  // Stage 0~3은 "같은 그룹 안"의 오프셋만 조정한다. 서로 다른 그룹(다른 타겟/
  // 소스)의 세로 구간이 우연히 같은 X에 놓이면 선이 완전히 포개져 구분이
  // 불가능해진다 → 스윕으로 겹치는 세로선을 옆으로 밀어낸다.
  const MIN_V_GAP = 14;
  interface VSeg { id: string; splitX: number; yMin: number; yMax: number; minX: number; maxX: number }
  const vsegs: VSeg[] = [];
  edges.forEach(e => {
    const info = infoMap.get(e.id);
    if (!info || !info.isHorizontal) return;
    if (info.targetX < info.sourceX - 20) return;              // 백엣지는 별도 U자 경로
    if (Math.abs(info.sourceY - info.targetY) < 8) return;     // 직선 렌더링 — 세로 구간 없음
    const mid = (info.sourceX + info.targetX) / 2;
    const splitX = mid + (edgeOffsets[e.id] ?? 0);
    vsegs.push({
      id: e.id,
      splitX,
      yMin: Math.min(info.sourceY, info.targetY),
      yMax: Math.max(info.sourceY, info.targetY),
      minX: Math.min(info.sourceX, info.targetX) + 20,
      // 세로선이 중간 열의 노드 영역을 관통하지 않도록 출발 열 근처 통로로 제한
      maxX: Math.min(Math.max(info.sourceX, info.targetX) - 20, info.sourceX + 200),
    });
  });

  vsegs.sort((a, b) => a.splitX - b.splitX);
  const placed: VSeg[] = [];
  vsegs.forEach(seg => {
    // 통로 클램프를 "먼저" 적용한 뒤 충돌을 밀어낸다 — 순서를 바꾸면
    // 클램프가 이미 해소된 충돌을 같은 X로 다시 모아버린다.
    let x = Math.max(seg.minX, Math.min(seg.maxX, seg.splitX));
    // 이미 배치된 세로선들과 Y가 겹치면 최소 간격을 확보할 때까지 오른쪽으로 이동
    // (겹침이 통로 이탈보다 나쁘므로 이 단계에서는 maxX를 넘는 것을 허용)
    let moved = true;
    let guard = 0;
    while (moved && guard++ < 32) {
      moved = false;
      for (const p of placed) {
        const yOverlap = Math.min(seg.yMax, p.yMax) - Math.max(seg.yMin, p.yMin);
        if (yOverlap > 4 && Math.abs(x - p.splitX) < MIN_V_GAP) {
          x = p.splitX + MIN_V_GAP;
          moved = true;
        }
      }
    }
    if (x !== seg.splitX) {
      const info = infoMap.get(seg.id)!;
      edgeOffsets[seg.id] = x - (info.sourceX + info.targetX) / 2;
    }
    placed.push({ ...seg, splitX: x });
  });

  return edges.map(edge => ({
    ...edge,
    type: 'customSmoothstep',
    data: {
      ...((edge as any).data || {}),
      splitOffset: edgeOffsets[edge.id] ?? 0,
    },
  }));
}

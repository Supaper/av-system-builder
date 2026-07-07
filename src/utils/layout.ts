import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { calculateNodeHeight, getPortYOffset } from '../store';

const NODE_WIDTH = 220;
const MIN_NODE_GAP = 40; // 노드 간 최소 세로 간격 — 엣지 통로 확보를 위해 여유 있게

// These edge types define the directional signal flow (LR rank determination)
const SIGNAL_EDGE_TYPES = new Set(['sdi', 'video', 'audio', 'usb']);

export function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'LR') {
  const isHorizontal = direction === 'LR';

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: 90,    // 같은 열 노드 사이 세로 간격 (엣지 통로 확보)
    edgesep: 30,
    ranksep: 280,   // 열 사이 가로 간격 (splitOffset 분기 공간 확보)
    marginx: 50,
    marginy: 50,
  });

  const equipmentNodes = nodes.filter(n => n.type === 'equipment' || !n.type);
  const eqIds = new Set(equipmentNodes.map(n => n.id));

  equipmentNodes.forEach((node) => {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: calculateNodeHeight(node.data as any),
    });
  });

  // Separate signal edges (define LR rank) from network/control edges
  const signalEdges: Edge[] = [];
  const secondaryEdges: Edge[] = [];

  edges.forEach((edge) => {
    if (!eqIds.has(edge.source) || !eqIds.has(edge.target)) return;
    const lineTypeId = (edge.data as any)?.lineTypeId ?? '';
    if (SIGNAL_EDGE_TYPES.has(lineTypeId)) {
      signalEdges.push(edge);
    } else {
      secondaryEdges.push(edge);
    }
  });

  const useAllEdges = signalEdges.length === 0;

  if (useAllEdges) {
    // No signal edges at all — use everything
    edges.forEach((edge) => {
      if (!eqIds.has(edge.source) || !eqIds.has(edge.target)) return;
      graph.setEdge(edge.source, edge.target, { weight: 1, minlen: 1 });
    });
  } else {
    // Signal edges strongly define left-to-right rank
    signalEdges.forEach((edge) => {
      graph.setEdge(edge.source, edge.target, { weight: 3, minlen: 1 });
    });
    // Network/control edges: same-rank allowed (minlen: 0), low weight
    // This prevents them from forcing nodes into wrong ranks
    secondaryEdges.forEach((edge) => {
      // Only add if both nodes already in graph; use minlen:0 so rank can be same
      graph.setEdge(edge.source, edge.target, { weight: 1, minlen: 0 });
    });
  }

  dagre.layout(graph);

  const nodeMap: Record<string, Node> = {};

  const newNodes = nodes.map((node) => {
    if (node.type && node.type !== 'equipment') return node;

    const positioned = graph.node(node.id);
    if (!positioned) return node;

    const nodeHeight = calculateNodeHeight(node.data as any);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: Math.round(positioned.x - NODE_WIDTH / 2),
        y: Math.round(positioned.y - nodeHeight / 2),
      },
    } as any;

    nodeMap[node.id] = newNode;
    return newNode;
  });

  newNodes.forEach(n => {
    if (!nodeMap[n.id]) nodeMap[n.id] = n;
  });

  // Post-process: group nodes into columns, then:
  //   1. Barycenter reorder — sort each column's nodes by the average Y of incoming
  //      source ports (Sugiyama crossing-minimization heuristic). This fixes the
  //      common case where Dagre places two fan-out targets in the wrong vertical
  //      order (e.g. USB Capture above Display when Out 1→Display and Out 2→USB).
  //   2. Enforce minimum vertical gaps.
  const colThreshold = NODE_WIDTH + 40;
  const columns: Node[][] = [];
  const eqNodesPositioned = newNodes.filter(n => n.type === 'equipment' || !n.type);
  const sortedByX = [...eqNodesPositioned].sort((a, b) => a.position.x - b.position.x);

  sortedByX.forEach(node => {
    const col = columns.find(c => {
      const avgX = c.reduce((sum, n) => sum + n.position.x, 0) / c.length;
      return Math.abs(node.position.x - avgX) < colThreshold;
    });
    if (col) col.push(node);
    else columns.push([node]);
  });

  // Barycenter 계산용 인덱스: 들어오는 엣지(소스 포트 기준)와
  // 나가는 엣지(타겟 포트 기준) 양쪽 모두
  // 신호 엣지(SDI/HDMI/오디오/USB)는 배치를 지배하고, 네트워크/컨트롤은 보조 —
  // 랭크 결정과 같은 철학. LAN 스위치 포트 순서는 임의이므로 신호 순서가 우선이다.
  const barycenterWeight = (e: Edge) =>
    SIGNAL_EDGE_TYPES.has(((e.data as any)?.lineTypeId ?? '') as string) ? 3 : 1;

  const incomingMap = new Map<string, Array<{ sourceId: string; sourceHandle: string | undefined; w: number }>>();
  const outgoingMap = new Map<string, Array<{ targetId: string; targetHandle: string | undefined; w: number }>>();
  edges.forEach(e => {
    if (!eqIds.has(e.source) || !eqIds.has(e.target)) return;
    const w = barycenterWeight(e);
    if (!incomingMap.has(e.target)) incomingMap.set(e.target, []);
    incomingMap.get(e.target)!.push({ sourceId: e.source, sourceHandle: e.sourceHandle ?? undefined, w });
    if (!outgoingMap.has(e.source)) outgoingMap.set(e.source, []);
    outgoingMap.get(e.source)!.push({ targetId: e.target, targetHandle: e.targetHandle ?? undefined, w });
  });

  // Sort columns left-to-right
  const sortedCols = [...columns].sort((a, b) => {
    const ax = a.reduce((s, n) => s + n.position.x, 0) / a.length;
    const bx = b.reduce((s, n) => s + n.position.x, 0) / b.length;
    return ax - bx;
  });

  /**
   * 한 열의 노드들을 barycenter 순으로 재배치.
   * 'incoming': 왼쪽 이웃들의 소스 포트 Y 평균 (L→R 스윕)
   * 'outgoing': 오른쪽 이웃들의 "타겟 포트 Y" 평균 (R→L 스윕)
   *   → 장비 3대가 한 장비의 In 1/2/3에 꽂히면 소스 노드들이
   *     입력 포트 순번대로 위→아래 정렬되어 선이 곧게 펴진다.
   */
  const reorderColumn = (col: Node[], direction: 'incoming' | 'outgoing') => {
    if (col.length < 2) return;
    const colAvgX = col.reduce((s, n) => s + n.position.x, 0) / col.length;

    const barycenters = col.map(node => {
      if (direction === 'incoming') {
        const incoming = (incomingMap.get(node.id) ?? []).filter(e => {
          const src = nodeMap[e.sourceId];
          return src && src.position.x < colAvgX - colThreshold / 2; // 왼쪽 이웃만
        });
        if (incoming.length === 0) return node.position.y;
        let wSum = 0;
        const sum = incoming.reduce((s, e) => {
          const src = nodeMap[e.sourceId];
          if (!src) return s;
          wSum += e.w;
          return s + e.w * (src.position.y + getPortYOffset(src.data as any, e.sourceHandle));
        }, 0);
        return wSum > 0 ? sum / wSum : node.position.y;
      } else {
        const outgoing = (outgoingMap.get(node.id) ?? []).filter(e => {
          const tgt = nodeMap[e.targetId];
          return tgt && tgt.position.x > colAvgX + colThreshold / 2; // 오른쪽 이웃만
        });
        if (outgoing.length === 0) return node.position.y;
        let wSum = 0;
        const sum = outgoing.reduce((s, e) => {
          const tgt = nodeMap[e.targetId];
          if (!tgt) return s;
          wSum += e.w;
          return s + e.w * (tgt.position.y + getPortYOffset(tgt.data as any, e.targetHandle));
        }, 0);
        return wSum > 0 ? sum / wSum : node.position.y;
      }
    });

    const sortedYs = col.map(n => n.position.y).sort((a, b) => a - b);
    col
      .map((node, i) => ({ node, barycenter: barycenters[i] }))
      .sort((a, b) => a.barycenter - b.barycenter)
      .forEach(({ node }, i) => {
        node.position.y = sortedYs[i];
      });
  };

  // Sugiyama식 교대 스윕 2회: L→R(들어오는 선 기준) → R→L(나가는 선의 타겟 포트 순번 기준)
  for (let iter = 0; iter < 2; iter++) {
    sortedCols.forEach((col, ci) => {
      if (ci === 0) return; // 첫 열은 왼쪽 이웃이 없음
      reorderColumn(col, 'incoming');
    });
    for (let ci = sortedCols.length - 2; ci >= 0; ci--) {
      reorderColumn(sortedCols[ci], 'outgoing');
    }
  }

  // Enforce minimum vertical gaps within each column (top-to-bottom)
  columns.forEach(columnNodes => {
    if (columnNodes.length < 2) return;
    columnNodes.sort((a, b) => a.position.y - b.position.y);

    for (let i = 1; i < columnNodes.length; i++) {
      const prev = columnNodes[i - 1];
      const prevBottom = prev.position.y + calculateNodeHeight(prev.data as any);
      const minY = prevBottom + MIN_NODE_GAP;
      if (columnNodes[i].position.y < minY) {
        columnNodes[i].position.y = minY;
      }
    }
  });

  return { nodes: newNodes, edges };
}

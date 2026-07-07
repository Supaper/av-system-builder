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

  // Build incoming-edge index for barycenter computation
  const incomingMap = new Map<string, Array<{ sourceId: string; sourceHandle: string | undefined }>>();
  edges.forEach(e => {
    if (!eqIds.has(e.source) || !eqIds.has(e.target)) return;
    if (!incomingMap.has(e.target)) incomingMap.set(e.target, []);
    incomingMap.get(e.target)!.push({ sourceId: e.source, sourceHandle: e.sourceHandle ?? undefined });
  });

  // Sort columns left-to-right and run barycenter sweep (skip first column)
  const sortedCols = [...columns].sort((a, b) => {
    const ax = a.reduce((s, n) => s + n.position.x, 0) / a.length;
    const bx = b.reduce((s, n) => s + n.position.x, 0) / b.length;
    return ax - bx;
  });

  sortedCols.forEach((col, ci) => {
    if (ci === 0 || col.length < 2) return;

    const colAvgX = col.reduce((s, n) => s + n.position.x, 0) / col.length;

    const barycenters = col.map(node => {
      const incoming = (incomingMap.get(node.id) ?? []).filter(e => {
        // Only consider sources to the LEFT of this column
        const src = nodeMap[e.sourceId];
        return src && src.position.x < colAvgX - colThreshold / 2;
      });
      if (incoming.length === 0) return node.position.y;
      const sum = incoming.reduce((s, e) => {
        const src = nodeMap[e.sourceId];
        if (!src) return s;
        return s + src.position.y + getPortYOffset(src.data as any, e.sourceHandle);
      }, 0);
      return sum / incoming.length;
    });

    // Sort current Y positions and assign them to barycenter-sorted nodes
    const sortedYs = col.map(n => n.position.y).sort((a, b) => a - b);
    const sortedByBarycenter = col
      .map((node, i) => ({ node, barycenter: barycenters[i] }))
      .sort((a, b) => a.barycenter - b.barycenter);

    sortedByBarycenter.forEach(({ node }, i) => {
      node.position.y = sortedYs[i];
    });
  });

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

import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { calculateNodeHeight } from '../store';

const NODE_WIDTH = 220;
const MIN_NODE_GAP = 24;

// These edge types define the directional signal flow (LR rank determination)
const SIGNAL_EDGE_TYPES = new Set(['sdi', 'video', 'audio', 'usb']);

export function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'LR') {
  const isHorizontal = direction === 'LR';

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: 60,    // vertical gap between nodes in the same rank column
    edgesep: 30,
    ranksep: 260,   // horizontal gap between rank columns
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

  // Post-process: group nodes into columns and enforce strict minimum vertical gaps.
  // Deliberately simple — we trust Dagre's Y assignments and only push nodes DOWN to
  // fix any residual overlap caused by variable node heights.
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

  columns.forEach(columnNodes => {
    if (columnNodes.length < 2) return;

    // Sort top-to-bottom
    columnNodes.sort((a, b) => a.position.y - b.position.y);

    for (let i = 1; i < columnNodes.length; i++) {
      const prev = columnNodes[i - 1];
      const prevBottom = prev.position.y + calculateNodeHeight(prev.data as any);
      const minY = prevBottom + MIN_NODE_GAP;
      if (columnNodes[i].position.y < minY) {
        columnNodes[i].position.y = minY;
        nodeMap[columnNodes[i].id] = {
          ...nodeMap[columnNodes[i].id],
          position: { ...nodeMap[columnNodes[i].id].position, y: minY },
        };
      }
    }
  });

  return { nodes: newNodes, edges };
}

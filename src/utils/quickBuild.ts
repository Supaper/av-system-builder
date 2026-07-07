// ───────────────────────────────────────────────────────────────────────────
// 빠른제작 자동 배선 엔진
//
// 템플릿의 슬롯 연결 정의를 실제 노드/엣지로 변환한다.
// - 포트 매칭: TemplateConnection.lineTypeId와 포트 타입이 일치하는 포트만 후보
// - from 쪽: outputs → bidirectional 순으로 미사용 포트를 위에서부터 할당
// - to 쪽:   inputs → bidirectional 순
// - 양방향 포트는 물리 잭 1개 — 한 번 쓰면 반대 방향 후보에서도 제외 (단일 잭 규칙)
// - 양방향 핸들 id는 `source_both-*` / `target_both-*` 접두 규칙을 따른다
// - 포트가 부족하면 가능한 만큼만 연결하고 warning으로 보고 (80% 골격 원칙)
// ───────────────────────────────────────────────────────────────────────────
import type { Node, Edge } from '@xyflow/react';
import type { Equipment, LineType, Port, QuickBuildTemplate } from '../store';

export interface SlotAssignment {
  equipmentId: string | null; // null = 빈 슬롯 (건너뜀)
  quantity: number;
}

export interface QuickBuildResult {
  nodes: Node[];
  edges: Edge[];
  warnings: string[];
  connectedCount: number; // 생성된 엣지 수
  skippedCount: number;   // 포트 부족 등으로 만들지 못한 연결 수
}

/** 노드 1개의 포트 사용 현황 — 양방향 포트는 어느 방향으로든 1회만 사용 가능 */
class PortTracker {
  private used = new Set<string>();
  private eq: Equipment;
  constructor(eq: Equipment) { this.eq = eq; }

  private firstFree(ports: Port[] | undefined, lineTypeId: string): Port | null {
    if (!ports) return null;
    return ports.find(p => p.type === lineTypeId && !this.used.has(p.id)) ?? null;
  }

  /** 나가는 연결용 포트 할당 → 핸들 id 반환 (없으면 null) */
  allocOut(lineTypeId: string): string | null {
    const out = this.firstFree(this.eq.outputs, lineTypeId);
    if (out) { this.used.add(out.id); return out.id; }
    const bidi = this.firstFree(this.eq.bidirectional, lineTypeId);
    if (bidi) { this.used.add(bidi.id); return `source_${bidi.id}`; }
    return null;
  }

  /** 들어오는 연결용 포트 할당 → 핸들 id 반환 (없으면 null) */
  allocIn(lineTypeId: string): string | null {
    const inp = this.firstFree(this.eq.inputs, lineTypeId);
    if (inp) { this.used.add(inp.id); return inp.id; }
    const bidi = this.firstFree(this.eq.bidirectional, lineTypeId);
    if (bidi) { this.used.add(bidi.id); return `target_${bidi.id}`; }
    return null;
  }
}

/**
 * 슬롯의 기본 장비 자동 선택 — 템플릿 연결 정의가 요구하는 방향·타입의 포트를
 * 실제로 가진 장비를 우선한다 (카탈로그에는 포트 미입력 장비·옵션카드형 프레임이
 * 많아 단순히 첫 후보를 고르면 배선이 대부분 실패함).
 */
export function pickBestCandidate(
  slot: { slotId: string },
  template: QuickBuildTemplate,
  candidates: Equipment[],
): Equipment | null {
  if (candidates.length === 0) return null;

  const reqs: { dir: 'out' | 'in'; lineTypeId: string }[] = [];
  for (const c of template.connections) {
    if (c.fromSlot === slot.slotId) reqs.push({ dir: 'out', lineTypeId: c.lineTypeId });
    if (c.toSlot === slot.slotId) reqs.push({ dir: 'in', lineTypeId: c.lineTypeId });
  }
  if (reqs.length === 0) return candidates[0];

  let best = candidates[0];
  let bestScore = -1;
  for (const eq of candidates) {
    let score = 0;
    for (const r of reqs) {
      const main = (r.dir === 'out' ? eq.outputs : eq.inputs)?.filter(p => p.type === r.lineTypeId).length ?? 0;
      const bidi = eq.bidirectional?.filter(p => p.type === r.lineTypeId).length ?? 0;
      if (main + bidi > 0) score += 10;               // 요구 충족 여부가 최우선
      score += Math.min(main + bidi, 8);              // 여유 포트 수는 보조 지표
    }
    if (score > bestScore) { bestScore = score; best = eq; }
  }
  return best;
}

/**
 * 템플릿 + 슬롯 대입 → 노드/엣지 생성.
 * 위치는 슬롯 순서 기반의 임시 그리드 — 호출부에서 오토레이아웃을 돌리는 것을 전제.
 */
export function buildFromTemplate(
  template: QuickBuildTemplate,
  assignments: Record<string, SlotAssignment>,
  equipmentDB: Equipment[],
  lineTypes: LineType[],
): QuickBuildResult {
  const idPrefix = `qb_${Date.now()}`;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const warnings: string[] = [];
  let skippedCount = 0;

  // ── 1) 슬롯별 노드 인스턴스 생성 ──
  const slotNodes: Record<string, { node: Node; tracker: PortTracker }[]> = {};

  template.slots.forEach((slot, slotIdx) => {
    const assign = assignments[slot.slotId];
    const equipment = assign?.equipmentId
      ? equipmentDB.find(eq => eq.id === assign.equipmentId)
      : undefined;

    if (!assign || !equipment || assign.quantity <= 0) {
      warnings.push(`빈 슬롯 건너뜀: ${slot.label}`);
      slotNodes[slot.slotId] = [];
      return;
    }

    slotNodes[slot.slotId] = Array.from({ length: assign.quantity }, (_, i) => {
      const node: Node = {
        id: `${idPrefix}_${slot.slotId}_${i}`,
        type: 'equipment',
        // 오토레이아웃 전 임시 배치 (슬롯 = 열, 인스턴스 = 행)
        position: { x: slotIdx * 320, y: i * 240 },
        data: { ...equipment },
      };
      return { node, tracker: new PortTracker(equipment) };
    });
    nodes.push(...slotNodes[slot.slotId].map(s => s.node));
  });

  // ── 2) 연결 정의 → 실제 엣지 ──
  let edgeSeq = 0;
  for (const conn of template.connections) {
    const fromList = slotNodes[conn.fromSlot] ?? [];
    const toList = slotNodes[conn.toSlot] ?? [];
    if (fromList.length === 0 || toList.length === 0) continue; // 빈 슬롯 — 이미 경고됨

    const fromLabel = template.slots.find(s => s.slotId === conn.fromSlot)?.label ?? conn.fromSlot;
    const toLabel = template.slots.find(s => s.slotId === conn.toSlot)?.label ?? conn.toSlot;
    const lineType = lineTypes.find(lt => lt.id === conn.lineTypeId);
    const lineTypeName = lineType?.name ?? conn.lineTypeId;

    // 분배 방식별 (fromIdx, toIdx) 쌍 목록
    const pairs: [number, number][] = [];
    if (conn.distribution === 'one-to-one') {
      const n = Math.min(fromList.length, toList.length);
      for (let i = 0; i < n; i++) pairs.push([i, i]);
      if (fromList.length !== toList.length) {
        warnings.push(`${fromLabel}→${toLabel}: 수량 불일치 (${fromList.length}:${toList.length}) — ${n}건만 1:1 연결`);
      }
    } else if (conn.distribution === 'fan-out') {
      // to 노드마다 1개 입력 — from 노드에 균등 분산 (from 1대면 전부 그 장비에서)
      toList.forEach((_, j) => pairs.push([Math.floor(j * fromList.length / toList.length), j]));
    } else {
      // fan-in: from 노드마다 1개 출력 — to 노드에 균등 분산
      fromList.forEach((_, i) => pairs.push([i, Math.floor(i * toList.length / fromList.length)]));
    }

    let failed = 0;
    for (const [fi, ti] of pairs) {
      const from = fromList[fi];
      const to = toList[ti];
      const sourceHandle = from.tracker.allocOut(conn.lineTypeId);
      const targetHandle = to.tracker.allocIn(conn.lineTypeId);
      if (!sourceHandle || !targetHandle) {
        failed++;
        continue;
      }
      edges.push({
        id: `${idPrefix}_e${edgeSeq++}`,
        source: from.node.id,
        target: to.node.id,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        animated: false,
        style: { stroke: lineType?.color || '#94a3b8', strokeWidth: 2 },
        data: { lineTypeId: conn.lineTypeId, ...(conn.edgeLabel ? { label: conn.edgeLabel } : {}) },
      });
    }
    if (failed > 0) {
      skippedCount += failed;
      warnings.push(`${fromLabel}→${toLabel} (${lineTypeName}): 포트 부족으로 ${failed}건 미연결`);
    }
  }

  return { nodes, edges, warnings, connectedCount: edges.length, skippedCount };
}

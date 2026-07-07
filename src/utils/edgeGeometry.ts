// ───────────────────────────────────────────────────────────────────────────
// 엣지 지오메트리 공유 유틸
//
// CustomSmoothstepEdge(렌더링)와 edgeProcessing(교차 계산)이 반드시 같은 경로
// 지점을 봐야 한다 — 한쪽만 바꾸면 점프(hop)가 실제 교차 지점에서 어긋난다.
// 모든 엣지는 축 정렬(H/V) 세그먼트로만 구성되므로 교차 판정이 정확하다.
// ───────────────────────────────────────────────────────────────────────────

export interface XY { x: number; y: number }

export interface EdgeGeomInput {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isHorizontal: boolean;
  splitOffset: number;
}

/** 백엣지 판정 기준 (CustomSmoothstepEdge와 동일해야 함) */
export const BACK_EDGE_THRESHOLD = 20;

/**
 * 엣지의 직교 폴리라인 지점 목록.
 * - 정방향(H): H-V-H (source → splitX → target)
 * - 역방향(H): U자 우회 (아래로 내려갔다 되돌아옴)
 * - 수직 플로우: V-H-V
 */
export function getEdgePoints(g: EdgeGeomInput): XY[] {
  const { sourceX, sourceY, targetX, targetY, isHorizontal, splitOffset } = g;

  if (isHorizontal) {
    const isBackEdge = targetX < sourceX - BACK_EDGE_THRESHOLD;

    if (isBackEdge) {
      const exitH = 50;
      const loopY = Math.max(sourceY, targetY) + 90 + Math.abs(splitOffset);
      const exitX = sourceX + exitH;
      const entryX = targetX - exitH;
      return [
        { x: sourceX, y: sourceY },
        { x: exitX, y: sourceY },
        { x: exitX, y: loopY },
        { x: entryX, y: loopY },
        { x: entryX, y: targetY },
        { x: targetX, y: targetY },
      ];
    }

    // 수평 직선에 가까우면 굴곡 없이 직결
    if (Math.abs(sourceY - targetY) < 1) {
      return [
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
      ];
    }

    const splitX = (sourceX + targetX) / 2 + splitOffset;
    return [
      { x: sourceX, y: sourceY },
      { x: splitX, y: sourceY },
      { x: splitX, y: targetY },
      { x: targetX, y: targetY },
    ];
  }

  // 수직 플로우 (TB)
  if (Math.abs(sourceX - targetX) < 1) {
    return [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
    ];
  }
  const splitY = (sourceY + targetY) / 2 + splitOffset;
  return [
    { x: sourceX, y: sourceY },
    { x: sourceX, y: splitY },
    { x: targetX, y: splitY },
    { x: targetX, y: targetY },
  ];
}

const EPS = 0.5;
/** 세그먼트 끝에서 이 거리 안의 교차는 점프로 그리지 않음 (코너 라운드와 충돌 방지) */
const JUMP_END_MARGIN = 14;

/**
 * 이 엣지의 "수평" 세그먼트들이 다른 엣지들의 "수직" 세그먼트를 가로지르는
 * 지점 목록. 규칙: 수평 세그먼트를 가진 쪽이 점프한다 — 모든 H×V 교차는
 * 정확히 한 번, 수평 쪽에서 아치로 표현된다.
 */
export function computeJumps(points: XY[], otherPolylines: XY[][]): XY[] {
  const jumps: XY[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (Math.abs(a.y - b.y) > EPS) continue; // 수평 세그먼트만
    const y = a.y;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);

    for (const poly of otherPolylines) {
      for (let j = 0; j < poly.length - 1; j++) {
        const c = poly[j];
        const d = poly[j + 1];
        if (Math.abs(c.x - d.x) > EPS) continue; // 상대의 수직 세그먼트만
        const x = c.x;
        const yy1 = Math.min(c.y, d.y);
        const yy2 = Math.max(c.y, d.y);
        if (
          x > x1 + JUMP_END_MARGIN && x < x2 - JUMP_END_MARGIN &&
          y > yy1 + 4 && y < yy2 - 4
        ) {
          jumps.push({ x, y });
        }
      }
    }
  }
  return jumps;
}

/**
 * 직교 폴리라인 → SVG path.
 * - 내부 코너는 반경 cornerR 라운드 (세그먼트가 짧으면 자동 축소)
 * - 수평 세그먼트 위의 jump 지점에는 위로 볼록한 반원 아치
 */
export function buildOrthogonalPath(points: XY[], jumps: XY[], cornerR = 10, jumpR = 6): string {
  // 길이 0 세그먼트 제거 (동일 지점 연속)
  const pts: XY[] = [];
  points.forEach(p => {
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last.x - p.x) > EPS || Math.abs(last.y - p.y) > EPS) pts.push(p);
  });
  if (pts.length < 2) return '';

  // 각 내부 코너의 실제 반경 (양쪽 세그먼트 절반을 넘지 않게)
  const segLen = (i: number) =>
    Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
  const radii: number[] = pts.map((_, i) => {
    if (i === 0 || i === pts.length - 1) return 0;
    return Math.min(cornerR, segLen(i - 1) / 2, segLen(i) / 2);
  });

  let path = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const rA = radii[i];
    const rB = radii[i + 1];
    const horizontal = Math.abs(a.y - b.y) <= EPS;

    // 코너 라운드만큼 양 끝을 안쪽으로 당긴 실제 본체 구간
    const dirX = Math.sign(b.x - a.x);
    const dirY = Math.sign(b.y - a.y);
    const bodyStart = horizontal
      ? { x: a.x + rA * dirX, y: a.y }
      : { x: a.x, y: a.y + rA * dirY };
    const bodyEnd = horizontal
      ? { x: b.x - rB * dirX, y: b.y }
      : { x: b.x, y: b.y - rB * dirY };

    if (horizontal) {
      // 이 세그먼트 위의 점프들을 진행 방향 순으로 정렬해 아치 삽입.
      // 점프 좌표는 사전계산(edgeProcessing) 좌표계, 세그먼트는 React Flow의
      // 실제 핸들 좌표계라 소수점 단위로 어긋날 수 있음 → y 매칭은 느슨하게.
      const JUMP_MATCH_TOLERANCE = 4;
      const lo = Math.min(bodyStart.x, bodyEnd.x);
      const hi = Math.max(bodyStart.x, bodyEnd.x);
      const segJumps = jumps
        .filter(j => Math.abs(j.y - a.y) <= JUMP_MATCH_TOLERANCE && j.x - jumpR > lo && j.x + jumpR < hi)
        .sort((p, q) => dirX >= 0 ? p.x - q.x : q.x - p.x);

      for (const j of segJumps) {
        path += ` L ${j.x - jumpR * dirX} ${a.y}`;
        // 위로 볼록한 반원: 좌→우는 sweep=1, 우→좌는 sweep=0
        const sweep = dirX >= 0 ? 1 : 0;
        path += ` A ${jumpR} ${jumpR} 0 0 ${sweep} ${j.x + jumpR * dirX} ${a.y}`;
      }
      path += ` L ${bodyEnd.x} ${bodyEnd.y}`;
    } else {
      path += ` L ${bodyEnd.x} ${bodyEnd.y}`;
    }

    // 다음 세그먼트로 꺾이는 코너 (마지막 지점 제외)
    if (i < pts.length - 2 && rB > 0) {
      const c = pts[i + 2];
      const nDirX = Math.sign(c.x - b.x);
      const nDirY = Math.sign(c.y - b.y);
      const cornerExit = Math.abs(b.y - c.y) <= EPS
        ? { x: b.x + rB * nDirX, y: b.y }
        : { x: b.x, y: b.y + rB * nDirY };
      path += ` Q ${b.x} ${b.y} ${cornerExit.x} ${cornerExit.y}`;
    }
  }

  return path;
}

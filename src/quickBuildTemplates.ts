// ───────────────────────────────────────────────────────────────────────────
// 빠른제작 기본 제공 템플릿 3종
//
// 코드 상수로만 존재한다 (Firestore quickTemplates 컬렉션에 저장하지 않음).
// targetName은 팀 카탈로그의 표준 중분류명(normalize-catalog.mjs 기준)과
// 일치시켰고, 매칭되는 장비가 없으면 getCandidatesForSlot이 카테고리로
// 폴백하므로 카탈로그가 바뀌어도 템플릿은 계속 동작한다.
//
// ⚠ 연결의 lineTypeId는 실제 카탈로그의 포트 타입 분포에 맞춰져 있다
//   (2026-07-07 전수 확인: PTZ 카메라 출력은 video(HDMI)로 시드되어 있고,
//   usb/control 타입 포트는 카탈로그 전체에 0건이라 해당 연결은 넣지 않음).
//   프로젝터·LFD처럼 포트 미입력 그룹은 연결이 경고로 표시된다 — 장비 편집에서
//   포트를 채우면 자동으로 배선된다.
// ───────────────────────────────────────────────────────────────────────────
import type { QuickBuildTemplate } from './store';

export const builtInTemplates: QuickBuildTemplate[] = [
  {
    id: 'builtin-small-meeting',
    name: '소형 회의실',
    description: 'PC · 스위처 · 디스플레이 · 카메라 — 기본 회의실 구성',
    isBuiltIn: true,
    slots: [
      { slotId: 'pc', label: 'PC 소스', category: 'control', targetName: 'PC', quantity: 1 },
      { slotId: 'switcher', label: '스위처', category: 'video', targetName: '비디오 스위처', quantity: 1 },
      { slotId: 'display', label: '메인 디스플레이', category: 'display', targetName: 'TV', quantity: 1 },
      { slotId: 'camera', label: '화상/PTZ 카메라', category: 'conferencing', targetName: 'PTZ 카메라', quantity: 1 },
    ],
    connections: [
      { id: 'c1', fromSlot: 'pc', toSlot: 'switcher', lineTypeId: 'video', distribution: 'one-to-one', edgeLabel: 'HDMI' },
      { id: 'c2', fromSlot: 'switcher', toSlot: 'display', lineTypeId: 'video', distribution: 'one-to-one', edgeLabel: 'HDMI' },
      { id: 'c3', fromSlot: 'camera', toSlot: 'switcher', lineTypeId: 'video', distribution: 'one-to-one', edgeLabel: 'HDMI' },
    ],
  },
  {
    id: 'builtin-classroom',
    name: '교육장',
    description: 'PC · 스위처 · 프로젝터 · 무선마이크 · 앰프 · 스피커 2 — 강의 공간 구성',
    isBuiltIn: true,
    slots: [
      { slotId: 'pc', label: '교탁 PC', category: 'control', targetName: 'PC', quantity: 1 },
      { slotId: 'switcher', label: '전자교탁/스위처', category: 'video', targetName: '비디오 스위처', quantity: 1 },
      { slotId: 'projector', label: '프로젝터', category: 'display', targetName: '프로젝터', quantity: 1 },
      { slotId: 'mic', label: '무선마이크 수신기', category: 'audio', targetName: '무선 마이크', quantity: 1 },
      { slotId: 'amp', label: '파워 앰프', category: 'audio', targetName: '파워 앰프', quantity: 1 },
      { slotId: 'speaker', label: '스피커', category: 'audio', targetName: '실링 스피커', quantity: 2 },
    ],
    connections: [
      { id: 'c1', fromSlot: 'pc', toSlot: 'switcher', lineTypeId: 'video', distribution: 'one-to-one', edgeLabel: 'HDMI' },
      { id: 'c2', fromSlot: 'switcher', toSlot: 'projector', lineTypeId: 'video', distribution: 'one-to-one', edgeLabel: 'HDMI' },
      { id: 'c3', fromSlot: 'mic', toSlot: 'amp', lineTypeId: 'audio', distribution: 'one-to-one', edgeLabel: 'AUDIO' },
      { id: 'c4', fromSlot: 'amp', toSlot: 'speaker', lineTypeId: 'audio', distribution: 'fan-out', edgeLabel: 'SP' },
    ],
  },
  {
    id: 'builtin-auditorium',
    name: '강당',
    description: '매트릭스 · PTZ 2 · TV 2 · 프로젝터 · DSP · 앰프 2 · 스피커 4 — 대형 공간 구성',
    isBuiltIn: true,
    slots: [
      { slotId: 'ptz', label: 'PTZ 카메라', category: 'video', targetName: 'PTZ 카메라', quantity: 2 },
      { slotId: 'matrix', label: '매트릭스 스위처', category: 'video', targetName: '매트릭스 스위처', quantity: 1 },
      { slotId: 'projector', label: '프로젝터', category: 'display', targetName: '프로젝터', quantity: 1 },
      { slotId: 'display', label: '중계 디스플레이', category: 'display', targetName: 'TV', quantity: 2 },
      { slotId: 'dsp', label: '오디오 DSP', category: 'audio', targetName: '오디오 DSP', quantity: 1 },
      { slotId: 'amp', label: '파워 앰프', category: 'audio', targetName: '파워 앰프', quantity: 2 },
      { slotId: 'speaker', label: '스피커', category: 'audio', targetName: '실링 스피커', quantity: 4 },
      // 컨트롤 프로세서는 배치만 — 카탈로그에 control 타입 포트가 아직 없어 자동 배선 제외
      { slotId: 'ctrl', label: '컨트롤 프로세서', category: 'control', quantity: 1 },
    ],
    connections: [
      { id: 'c1', fromSlot: 'ptz', toSlot: 'matrix', lineTypeId: 'video', distribution: 'fan-in', edgeLabel: 'HDMI' },
      { id: 'c2', fromSlot: 'matrix', toSlot: 'projector', lineTypeId: 'video', distribution: 'fan-out', edgeLabel: 'HDMI' },
      { id: 'c3', fromSlot: 'matrix', toSlot: 'display', lineTypeId: 'video', distribution: 'fan-out', edgeLabel: 'HDMI' },
      { id: 'c4', fromSlot: 'dsp', toSlot: 'amp', lineTypeId: 'audio', distribution: 'fan-out', edgeLabel: 'AUDIO' },
      { id: 'c5', fromSlot: 'amp', toSlot: 'speaker', lineTypeId: 'audio', distribution: 'fan-out', edgeLabel: 'SP' },
    ],
  },
];

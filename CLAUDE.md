# AV System Builder — Project Context for Claude Code

## 프로젝트 개요
React + TypeScript + Vite 기반의 **AV System Configuration Builder**.
오디오-비디오 시스템 설계를 위한 인터랙티브 다이어그램 툴로, 장비 간 신호 연결을 시각적으로 구성하고 PDF/JSON으로 내보낼 수 있다.

---

## 기술 스택

| 역할 | 라이브러리 |
|---|---|
| Framework | React 19 + TypeScript 6 + Vite 8 |
| 다이어그램 | @xyflow/react (React Flow v12) |
| 오토 레이아웃 | Dagre (LR 방향) |
| 상태 관리 | Zustand 5 |
| 영속성 | LocalStorage Sync |
| PDF 내보내기 | html-to-image + jsPDF |
| 아이콘 | Lucide React |
| 스타일 | Vanilla CSS (App.css) — Glassmorphism 다크 테마 |

---

## 아키텍처 핵심 규칙

### 포트 & 엣지 Y좌표
- 노드 높이가 포트 수 + 이미지 유무에 따라 동적으로 변함
- 엣지가 포트 핸들 중앙에 정확히 붙도록 **`getPortYOffset()`** 함수로 Y좌표를 별도 계산
- XYFlow 기본 앵커링은 정적 노드 기준이므로 이 함수를 반드시 거쳐야 함

### 노드 높이 계산
- **`calculateNodeHeight()`** 로 이미지 여부 + 입출력 포트 수를 기반으로 높이 자동 산출
- 오토 레이아웃 시 노드 겹침 방지를 위해 Dagre에 이 값을 주입해야 함

### 평행 엣지 처리
- 동일 구간에 여러 신호선이 겹치지 않도록 **Concentric Nesting Layout Algorithm** 적용
- 각 엣지에 `splitOffset` (Y축 + X축 오프셋)을 동적 분산 부여

### 이미지 저장
- 사용자 이미지는 `FileReader` → **Base64 Data URL** 로 변환해 LocalStorage에 저장
- 서버 없이 완전히 클라이언트 독립형(Self-contained)으로 동작
- ⚠️ LocalStorage 용량 한계(~5–10MB) 주의 — 대형 프로젝트는 JSON Export 권장

### 레이아웃 정책
- 기본 자동 레이아웃은 **Left-to-Right(LR)** 단방향 신호 흐름 기준
- 링/루프 토폴로지는 오토 레이아웃 후 수동 조율 필요

### Diagram Lock
- Lock 활성화 시 노드 이동 불가 + Auto Layout 자동 비활성화 (연동 필수)

---

## 신호 분류 체계
포트는 방향(Input / Output / Bidirectional)과 신호 종류로 구분되며 컬러 코딩으로 시각화:

- **Video**
- **Audio**
- **Control**
- **Network**

---

## 현재 완료된 기능 (건드리지 말 것)
- 드래그 앤 드롭 노드 생성 (장비 DB 기반)
- JSON Import/Export + LocalStorage 자동 저장
- 프리셋 덮어쓰기 / 일괄 내보내기·불러오기
- 장비 이미지 업로드 (Base64)
- 동적 노드 높이 계산
- 엣지 필터링 + 고립 노드 dimming
- Diagram Lock
- 접이식 사이드바
- PDF 내보내기
- Windows 배치 파일 서버 구동 (`start.bat`, `start_hidden.vbs`, `stop.bat`)

---

## 다음 개발 우선순위 (Backlog)

1. **Undo / Redo** — Zustand 상태 히스토리 추적 액션 스택
2. **BOM 생성** — 배치 장비 + 엣지 기반 케이블 명세서(Bill of Materials) 원클릭 출력
3. **실시간 협업** — WebSockets 또는 CRDT 기반 동시 편집
4. **마이크 커버리지 시뮬레이션** — Shure MXA925 등 수음 범위 오버레이 위젯
5. **클라우드 장비 DB 동기화** — Shure, Crestron, Extron 등 글로벌 벤더 카탈로그 연동

---

## 로컬 실행

```bash
npm install
npm run dev
```

Windows 비개발자 환경: `start.bat` 또는 `start_hidden.vbs` 실행
서버 종료: `stop.bat`

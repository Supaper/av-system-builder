# Changelog

All notable changes to AV System Builder are documented here.  
Format: `## [vX.Y] — YYYY-MM-DD` / Added · Changed · Fixed · Removed

---

## [v1.5] — 2026-06-25

### Added
- **엣지 라벨 편집** — 연결선 더블클릭 시 라벨 입력 모달 (`EditEdgeModal`)
- **프리셋 불러오기 3옵션** — 캔버스 교체 / 현재 캔버스에 추가 / 새 탭에서 열기 (`LoadPresetModal`)
- **수량 배지** — 노드 헤더에 `quantity` 필드 표시 (예: ×3, 21ea)
- **재활용 배지** — `isReused: true` 장비에 황색 "재활용" 배지
- **LOD 수량 표시** — 줌아웃 오버레이에 장비명과 함께 수량 역스케일 표시
- **DS기흥 사무동 구성도 프리셋** (`DS기흥_구성도_presets.json`)
  - 1층 컨퍼런스홀 (PTZ×3, VS5, DSP BLU-50v2, Delegate×21, 무선마이크)
  - 2층 컨벤션룸 (PTZ×3, DSP BLU-101×3, Logic Controller×2, 구즈넥마이크×28)
  - 관제실 (비디오월 PC×5, VDM-16X 매트릭스, HDBaseT, KVM CS1798×2)
- **GitHub 저장소 연동** (`https://github.com/Supaper/av-system-builder`)
- **Git 자동화 스크립트** — `git-start.ps1` (작업 시작, 브랜치 생성) + `git-done.ps1` (커밋·push·PR 오픈)
- **브랜치 전략 확립** — `main` 직접 push 금지, `local/YYYYMMDD-HHmm` 브랜치 패턴, PR to merge

### Changed
- **평행 엣지 알고리즘 재설계** (`edgeProcessing.ts`) — 그래프 컬러링 → 3단계 정렬 기반
  - Stage 1 Fan-in: `sourceY` 순 정렬 → 목적지 동일 선들의 교차 방지
  - Stage 2 Fan-out: `targetY` 순 정렬
  - Stage 3 Generic: `midY` 순 정렬
- **역방향 엣지 라우팅** (`CustomSmoothstepEdge`) — 꺾임선 교차 → U자형 우회 경로
- **오토 레이아웃 개선** (`layout.ts`) — 신호 엣지만 Dagre 랭크 결정, 보조 엣지 `minlen:0`
- **포트 핸들 색상 통일** — Audio `#a855f7`(보라), Network `#22c55e`(녹색) 엣지 색상과 일치
- **모달 위치 수정** — `LoadPresetModal`, `EditEdgeModal` 화면 정중앙 표시
- **장비 DB 초기값 교체** — 25개 AV 장비 (v·a·c·n 카테고리, SVG 기본 이미지 매핑)
- **신호 컬러 체계 정립** — SDI `#374151` / HDMI `#ef4444` / A.AUDIO `#a855f7` / LAN `#22c55e` / USB `#3b82f6` / Control `#f59e0b`

### Fixed
- DS기흥 1층 프리셋 허브 포트 중복 (`target_both-lan-4` 두 개) → `both-lan-5` 추가
- DS기흥 2층 프리셋 마이크 소스 포트 중복 → Mic→Logic→DSP 흐름으로 재정립

---

## [v1.0] — 2026-05-15

### Added
- **캔버스** — @xyflow/react 기반 드래그 앤 드롭 노드 배치
- **장비 DB** — 사이드바에서 장비 검색·드롭
- **신호선 연결** — 포트 핸들 클릭으로 배선, 신호 종류별 컬러
- **오토 레이아웃** — Dagre LR 방향 자동 정렬
- **JSON Import/Export** — 구성도 저장·복원
- **LocalStorage** — 브라우저 자동 저장
- **프리셋** — 구성도 저장·불러오기·덮어쓰기·일괄 관리
- **장비 이미지 업로드** — Base64 변환, 서버 불필요
- **PDF 내보내기** — html-to-image + jsPDF
- **엣지 필터링** — 신호 종류별 필터, 고립 노드 dimming
- **Diagram Lock** — 잠금 시 노드 이동·레이아웃 비활성화
- **어노테이션 노드** — 텍스트 메모 노드
- **접이식 사이드바**
- **Windows 배치 파일** — `start.bat`, `start_hidden.vbs`, `stop.bat`

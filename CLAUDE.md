# AV System Builder — Project Context for Claude Code

## ⚠️ Claude Code 필수 행동 규칙

> 이 규칙은 매 세션 시작마다 읽고, 기능 작업이 끝날 때마다 반드시 실행한다.

### 기능 구현 완료 즉시 (선언 전에) 해야 할 일

기능 작업이 끝났다고 말하기 **전에** 아래 두 파일을 직접 편집한다:

1. **`CLAUDE.md`** (이 파일)
   - `## 완료된 기능` 섹션에 새 항목 추가
   - `## 다음 개발 우선순위 (Backlog)` 에서 해당 항목 제거 및 번호 재정렬

2. **`CHANGELOG.md`**
   - 해당 버전 항목에 구현 내용 기록 (Added / Changed / Fixed)

> 이 두 파일의 업데이트를 빠뜨리면 다음 세션의 Claude가 이미 완성된 기능을 "아직 할 일"로 잘못 안내하게 된다. 이것이 이 규칙이 존재하는 이유다.

---

## 프로젝트 개요
React + TypeScript + Vite 기반의 **AV System Configuration Builder**.
오디오-비디오 시스템 설계를 위한 인터랙티브 다이어그램 툴로, 장비 간 신호 연결을 시각적으로 구성하고 PDF/JSON으로 내보낼 수 있다.

**GitHub:** `https://github.com/Supaper/av-system-builder`
**개발자:** 서울AV (`soojhann@seoulav.co.kr`)

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

### 평행 엣지 처리 (`src/utils/edgeProcessing.ts`)
3단계 알고리즘으로 선 교차를 최소화:
- **Stage 1 (Fan-in):** 같은 목적지로 향하는 선들을 `sourceY` 오름차순 정렬 후 오프셋 배정 → 출발 Y 순서 = 분기점 X 순서로 맞춰 교차 방지
- **Stage 2 (Fan-out):** 같은 출발지에서 나가는 선들을 `targetY` 오름차순 정렬
- **Stage 3 (Generic):** 소스/타겟을 공유하지 않지만 경로가 겹치는 선들을 `midY` 기준 정렬
- 각 엣지에 `splitOffset`을 부여, `SPACING = 20px`

### 역방향 엣지 라우팅 (`src/CustomSmoothstepEdge.tsx`)
- `targetX < sourceX - 20` 이면 역방향(백엣지) 판정
- U자형 경로: 소스 우측 → 아래로 우회(loopY) → 타겟 좌측 진입
- `loopY = Math.max(sourceY, targetY) + 90 + |splitOffset|`
- 정방향은 기존 H-V-H 라운드 코너 경로 유지

### 오토 레이아웃 정책 (`src/utils/layout.ts`)
- **신호 엣지** (sdi, video, audio, usb): `weight=3, minlen=1` → Dagre 랭크 결정
- **보조 엣지** (network, control): `weight=1, minlen=0` → 같은 랭크 허용, 랭크에 영향 안 줌
- 신호 엣지가 없을 경우 전체 엣지 사용 (fallback)
- `NODE_WIDTH=220, nodesep=60, ranksep=260`
- 포스트 프로세싱: 같은 열 노드 간 최소 gap 24px 강제

### 이미지 저장
- 사용자 이미지는 `FileReader` → **Base64 Data URL** 로 변환해 LocalStorage에 저장
- 서버 없이 완전히 클라이언트 독립형(Self-contained)으로 동작
- ⚠️ LocalStorage 용량 한계(~5–10MB) 주의 — 대형 프로젝트는 JSON Export 권장

### Diagram Lock
- Lock 활성화 시 노드 이동 불가 + Auto Layout 자동 비활성화 (연동 필수)

---

## 신호 분류 체계 & 컬러

포트 핸들 색상과 엣지 선 색상이 일치해야 한다:

| 신호 | ID | 색상 |
|---|---|---|
| Video (SDI) | `sdi` | `#374151` |
| Video (HDMI) | `video` | `#ef4444` |
| Audio | `audio` | `#a855f7` |
| Network (LAN) | `network` | `#22c55e` |
| USB | `usb` | `#3b82f6` |
| Control | `control` | `#f59e0b` |

`portColors` 레코드 (`src/EquipmentNode.tsx`)가 위 색상과 반드시 일치해야 한다.

---

## 노드 데이터 구조

```typescript
interface Equipment {
  id: string;
  category: 'video' | 'audio' | 'control' | 'network';
  name: string;
  model: string;
  imageUrl?: string;
  quantity?: string;   // 예: "x3", "21ea" — 노드 헤더 배지 + LOD 오버레이에 표시
  isReused?: boolean;  // true면 노드 헤더에 "재활용" 황색 배지
  inputs: Port[];
  outputs: Port[];
  bidirectional: Port[];
}
```

포트 ID 규칙:
- 입력: `in-{type}-{n}` (예: `in-sdi-1`)
- 출력: `out-{type}-{n}` (예: `out-hdmi-1`)
- 양방향: `both-{type}-{n}` → 핸들 ID는 `source_both-*`, `target_both-*`

---

## 완료된 기능

- 드래그 앤 드롭 노드 생성 (장비 DB 기반)
- JSON Import/Export + LocalStorage 자동 저장
- 프리셋 덮어쓰기 / 일괄 내보내기·불러오기
- **프리셋 불러오기 3가지 옵션:** 캔버스 교체 / 현재 캔버스에 추가 / 새 탭에서 열기 (`LoadPresetModal`)
- 장비 이미지 업로드 (Base64)
- 동적 노드 높이 계산
- 엣지 라벨 편집 (더블클릭 → `EditEdgeModal`)
- 엣지 필터링 + 고립 노드 dimming
- **LOD(Level of Detail) 오버레이:** 줌 < 0.55 시 장비명 + 수량 역스케일 표시
- **수량/재활용 배지:** 노드 헤더에 quantity, isReused 배지
- Diagram Lock
- 접이식 사이드바
- PDF 내보내기
- Windows 배치 파일 서버 구동 (`start.bat`, `start_hidden.vbs`, `stop.bat`)
- **DS기흥 사무동 1,2층 회의실 구성도 프리셋** (`DS기흥_구성도_presets.json`)
- **Undo / Redo** — Ctrl+Z / Ctrl+Y, Zustand history 스택 (MAX 50), 드래그·연결·삭제 모두 추적 (`store.ts`)
- **Ctrl+C / Ctrl+V 복사·붙여넣기** — 선택 노드 + 연결 엣지 함께 복사 (`App.tsx`)
- **BulkImport** — Excel/CSV 기반 장비 일괄 등록 (`BulkImportModal`)
- **어노테이션 노드** — 텍스트 메모 노드 + 편집 모달 (`AnnotationNode`, `EditAnnotationModal`)
- **Shape/Zone 노드** — 영역 표시용 사각형 노드 (`ShapeNode`)
- **MiniMap** — 캔버스 전체 조망 미니맵 토글

---

## 프리셋 파일 구조

`DS기흥_구성도_presets.json` — 프로젝트 루트에 위치, 앱에서 일괄 불러오기로 임포트:
- `DS기흥 1층 컨퍼런스홀`: PTZ×3 → VS5 → UVC → PC, DSP BLU-50v2, Switching Hub GS728TPP
- `DS기흥 2층 컨벤션룸`: 동일 영상 체인, DSP BLU-101×3, Logic Controller MPCMPC×2, 구즈넥마이크×28
- `DS기흥 관제실`: 비디오월 PC×5, 2분배기×10, VDM-16X 매트릭스, CT-104-U HDBaseT, KVM CS1798×2, CE824

---

## 다음 개발 우선순위 (Backlog)

1. **BOM 생성** — 배치 장비 + 엣지 기반 케이블 명세서(Bill of Materials) 원클릭 출력
2. **실시간 협업** — WebSockets 또는 CRDT 기반 동시 편집
3. **마이크 커버리지 시뮬레이션** — Shure MXA925 등 수음 범위 오버레이 위젯
4. **클라우드 장비 DB 동기화** — Shure, Crestron, Extron 등 글로벌 벤더 카탈로그 연동

---

## 로컬 실행

```bash
npm install
npm run dev
```

Windows 비개발자 환경: `start.bat` 또는 `start_hidden.vbs` 실행
서버 종료: `stop.bat`

---

## 개발 환경 정보

- **OS:** Windows 11 Pro
- **Git 설치 경로:** `C:\Program Files\Git\bin\git.exe`
- **주의:** PowerShell 새 세션에서 git 명령어가 안 되면 PATH 수동 추가 필요:
  ```powershell
  $env:PATH += ";C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
  ```
  영구 해결: Windows 환경변수에 `C:\Program Files\Git\cmd` 추가

---

## 인프라 & 배포

### GitHub 저장소
- **URL:** `https://github.com/Supaper/av-system-builder`
- **브랜치:** `main`
- **가시성:** Private (필요 시 Public으로 변경 가능)

### 배포 (예정 — 아직 미완료)
- **플랫폼:** Vercel 예정
- **방식:** GitHub 저장소 연결 → `git push`마다 자동 재배포
- **전제조건:** Vercel 무료 플랜은 Public 저장소 필요
### 멀티 디바이스 데이터 주의사항
- 이 앱은 **LocalStorage 기반** → 기기마다 데이터가 독립적으로 저장됨
- 다른 기기에서 같은 구성도를 열려면 **JSON Export → Import** 방식 사용
- 진정한 멀티 디바이스 공유는 Backlog의 "실시간 협업" 기능 개발 시 해결

---

## 릴리즈노트 작성 규칙

### 버전 규칙
- `v1.X` — 기능 추가 또는 동작 변경이 있을 때 마이너 버전 올림
- `v1.X.Y` — 버그픽스만 있을 때 패치 버전 올림

### 항목 분류
```
### Added   — 새로운 기능
### Changed — 기존 동작 변경 또는 개선
### Fixed   — 버그 수정
### Removed — 제거된 기능
```

---

## Git 워크플로

### 브랜치 전략
- `main` — 완성된 공식 버전. **직접 push 절대 금지**
- `local/YYYYMMDD-HHmm` — 로컬 VS Code 작업 브랜치 (git-start.ps1이 자동 생성)
- `claude/epic-*` — 웹 Claude Code 작업 브랜치 (자동 생성)
- 모든 작업은 위 브랜치에서 진행 → PR → main Merge

### 로컬 VS Code 작업 흐름 (PowerShell 스크립트)

**작업 시작 전:**
```powershell
.\git-start.ps1
```
- main을 최신화하고 `local/YYYYMMDD-HHmm` 브랜치 자동 생성

**작업 완료 후:**
```powershell
.\git-done.ps1
# 또는 메시지를 바로 입력할 경우:
.\git-done.ps1 "feat: 오토레이아웃 개선"
```
- 변경사항 커밋 → push → GitHub PR 페이지 자동 오픈

**PR Merge 후 다음 작업:**
- 다시 `git-start.ps1` 실행 → main을 기준으로 새 브랜치 생성

### 웹 Claude Code 작업 흐름
- 접속 시 `claude/epic-*` 브랜치 자동 생성됨
- 작업 완료 후 GitHub에서 PR 생성 → Merge
- 다음 세션 시작 시 이전 브랜치가 아닌 최신 main 기준으로 시작되는지 확인

### Claude Code (AI) 세션 시작 시 수행 사항
새 대화 세션을 시작할 때 반드시 아래를 먼저 실행한다:
```bash
git fetch origin
git status
git log --oneline -5
```
- main이 아닌 작업 브랜치에 있는지 확인
- main에 있으면 `git-start.ps1` 실행을 안내
- 원격에 미merge 브랜치가 있으면 사용자에게 알림

### 주의사항
- `main`에 직접 커밋·push 하지 않는다
- 작업 브랜치에서만 커밋한다
- CHANGELOG.md를 커밋에 항상 포함한다

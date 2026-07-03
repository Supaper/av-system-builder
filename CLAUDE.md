# AV System Builder — Project Context for Claude Code

## ⚠️ Claude Code 필수 행동 규칙

> 이 규칙은 매 세션 시작마다 읽고, 기능 작업이 끝날 때마다 반드시 실행한다.

### 기능 구현 완료 즉시 (선언 전에) 해야 할 일

기능 작업이 끝났다고 말하기 **전에** 아래 세 파일을 직접 편집한다:

1. **`CLAUDE.md`** (이 파일)
   - `## 완료된 기능` 섹션에 새 항목 추가
   - `## 다음 개발 우선순위 (Backlog)` 에서 해당 항목 제거 및 번호 재정렬

2. **`CHANGELOG.md`**
   - 해당 버전 항목에 구현 내용 기록 (Added / Changed / Fixed)

3. **개발 참조 카드 아티팩트**
   - URL: `https://claude.ai/code/artifact/20228638-a37d-4fe7-b471-d4e3c6d632a0`
   - 릴리즈노트에 새 버전 추가 (이전 버전은 summary 형태로 축소)
   - 백로그에서 완료된 항목 제거 및 번호 재정렬
   - 헤더 배지 버전 업데이트
   - 아티팩트는 스크래치패드 파일(`av_ref_card.html`)을 수정 후 Artifact 툴로 재배포한다

> 이 세 파일의 업데이트를 빠뜨리면 다음 세션의 Claude가 이미 완성된 기능을 "아직 할 일"로 잘못 안내하거나, 아티팩트가 실제 코드베이스와 어긋난 상태로 공유된다. 이것이 이 규칙이 존재하는 이유다.

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
type EquipmentCategory =
  | 'video' | 'display' | 'conferencing' | 'audio'
  | 'control' | 'network' | 'broadcast' | 'etc';

interface Equipment {
  id: string;
  category: EquipmentCategory;
  name: string;         // 사이드바 소분류 그룹핑 키 겸용 (예: "매트릭스 카드", "PTZ 카메라")
  model: string;
  manufacturer?: string;
  description?: string;
  series?: string;      // 모듈형 프레임 제품군 태그 (예: "XDM 시리즈") — EquipmentOption.compatibleSeries와 매칭
  imageUrl?: string;
  quantity?: string;    // 예: "x3", "21ea" — 노드 헤더 배지 + LOD 오버레이에 표시
  isReused?: boolean;   // true면 노드 헤더에 "재활용" 황색 배지
  selectedOptionIds?: string[]; // 노드에 적용된 EquipmentOption id 목록
  optionPortIds?: string[];     // 옵션이 주입한 포트 id (옵션 해제 시 정확히 제거하기 위한 마커)
  inputs: Port[];
  outputs: Port[];
  bidirectional: Port[];
}

// 장비에 장착 가능한 옵션 카드/액세서리 (독립 카탈로그, 다대다 호환)
interface EquipmentOption {
  id: string;
  name: string;
  model?: string;
  manufacturer?: string;
  compatibleModels?: string[];  // 특정 모델명 (접두 일치)
  compatibleSeries?: string[];  // 제품군 단위 (Equipment.series와 정확히 일치)
  addPorts: { inputs: Port[]; outputs: Port[]; bidirectional: Port[] };
}
```

포트 ID 규칙:
- 입력: `in-{type}-{n}` (예: `in-sdi-1`)
- 출력: `out-{type}-{n}` (예: `out-hdmi-1`)
- 양방향: `both-{type}-{n}` → 핸들 ID는 `source_both-*`, `target_both-*`

### 카테고리 → 사이드바 그룹핑
- `EquipmentCategory` 8종은 사이드바 대분류 섹션 (`src/App.tsx`의 `categories` 배열)
- 각 카테고리 안에서 `name` 값이 같은 장비끼리 다시 묶어 접이식 소그룹으로 표시 (`App.tsx` 사이드바 렌더링, [1094행 부근](src/App.tsx#L1094)) — 새 필드 없이 기존 `name` 재사용. 그룹에 항목이 1개뿐이면 소그룹 UI 없이 바로 노출

### 장비 옵션 (`EquipmentOption`)
- `useStore().equipmentOptions`에 독립 카탈로그로 보관 (Firestore `equipmentOptions` 컬렉션과 실시간 동기화)
- `getAvailableOptionsForEquipment(equipment, catalog)` (`store.ts`)로 특정 장비에 적용 가능한 옵션 조회 — `compatibleModels`는 `equipment.model.startsWith()` 접두 일치, `compatibleSeries`는 `equipment.series`와 정확히 일치
- `EditNodeModal`에서 체크박스로 다중 선택 → 선택된 옵션들의 `addPorts`가 노드의 실제 inputs/outputs/bidirectional에 병합됨. 병합된 포트 id는 `optionPortIds`에 기록해두고, 옵션 해제 시 정확히 그 id들만 제거 (수동으로 추가한 base 포트는 건드리지 않음)

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
- 예시 구성도 프리셋 (고객사 실 데이터 포함 파일은 2026-07-01 저장소에서 삭제 — 고객정보 보호. "일괄 불러오기" 기능 자체는 유지, 필요 시 자체 JSON 파일로 대체)
- **Undo / Redo** — Ctrl+Z / Ctrl+Y, Zustand history 스택 (MAX 50), 드래그·연결·삭제 모두 추적 (`store.ts`)
- **Ctrl+C / Ctrl+V 복사·붙여넣기** — 선택 노드 + 연결 엣지 함께 복사 (`App.tsx`)
- **BulkImport** — Excel/CSV 기반 장비 일괄 등록 (`BulkImportModal`)
- **어노테이션 노드** — 텍스트 메모 노드 + 편집 모달 (`AnnotationNode`, `EditAnnotationModal`)
- **Shape/Zone 노드** — 영역 표시용 사각형 노드 (`ShapeNode`)
- **MiniMap** — 캔버스 전체 조망 미니맵 토글
- **BOM 케이블 명세 모드** — `BOM` 버튼으로 모드 전환. 일괄 입력(수량 장비 자동 행 분리, 케이블 종류 드롭다운) + 개별 편집(더블클릭) + BOM 보기(기성/제작 집계 + CSV 내보내기) (`BomBulkModal`, `BomEdgeModal`, `BomReportModal`)
- **새로만들기 버튼** — 헤더 `+` 버튼으로 빈 캔버스 생성. 기존 작업 있으면 저장 확인 후 이름 입력 2단계 플로우
- **장비 DB 프리셋 독립** — 프리셋 불러오기 시 기존 장비 DB 유지, 새 장비만 병합 추가
- **평행 엣지 교차 개선** — 같은 노드 쌍 연결 복수 엣지(예: SDI+Control 동시 연결)에 방향 인식 오프셋 할당 (Stage 0)
- **클라우드 공유 링크 (Firebase Firestore)** — `Share` 버튼으로 현재 구성도를 Firestore 문서에 저장하고 `?share=<id>` 링크 생성. 다른 브라우저·기기·동료가 링크만으로 동일 구성도 로드 (`ShareModal`, `cloud.ts`, `firebaseConfig.ts`). LocalStorage 기기 종속 문제 해결
- **팀 공용 라이브러리 실시간 동기화 (Firebase Firestore)** — 장비 DB·라인 타입·프리셋을 클라우드에 두고 로그인 없이 모든 기기에서 공통 표시. `onSnapshot` 실시간 반영 + 로컬 변경 자동 push (`librarySync.ts`). 헤더에 동기화 상태 배지
- **Firestore 데이터 정규화** — 장비 DB·라인 타입을 `equipment/{id}`·`lineTypes/{id}` 개별 문서로 분리(항목 1개 = 문서 1개), 프리셋·공유 링크는 `nodes`/`edges`만 저장하도록 경량화 (자세한 내용은 아래 클라우드 아키텍처 참고)
- **장비 라이브러리 검색** — 사이드바 검색창으로 이름·모델 기준 클라이언트 필터링. 매칭 없는 카테고리는 자동 숨김
- **카테고리 8종 세분화 + 소분류 그룹핑** — `video/audio/control/network` 4종 → `video/display/conferencing/audio/control/network/broadcast/etc` 8종으로 확장. 각 카테고리 안에서 `name`(제품유형) 기준 2단 접이식 그룹핑 추가 (새 필드 없이 기존 `name` 재사용)
- **장비 옵션 시스템** — 장비에 장착 가능한 카드/액세서리를 독립 카탈로그(`EquipmentOption`)로 관리. 하나의 옵션이 특정 모델(`compatibleModels`) 또는 모듈형 프레임 제품군 전체(`compatibleSeries`)에 다대다로 호환 가능. `EditNodeModal`에서 옵션 선택 시 포트 구성 자동 반영 (`getAvailableOptionsForEquipment`)
- **BOM 기성케이블 카탈로그 연동** — `CableCatalogItem` 독립 컬렉션 추가. BOM 일괄/개별 입력 화면에서 자유 텍스트 대신 카탈로그 검색·선택 가능 (직접 입력도 계속 허용)
- **엑셀 원본 데이터 기반 장비 DB 대량 확충** — 자체 정리한 장비 리스트(`av-system-builder-raw-data.xlsx`, 저장소 미포함)를 `scripts/seed-equipment-from-excel.mjs`로 일괄 변환해 장비 747개·옵션 137개·케이블 카탈로그 169개를 Firestore에 반영 (전원/랙/판넬류 25개는 제외, 자세한 매핑 규칙은 `EQUIPMENT_DB_SCHEMA.md` 참고)
- **다크/라이트 모드** — 헤더 해/달 토글, LocalStorage `av-builder-theme` 저장. 테마 색상은 전부 `src/index.css`의 CSS 변수로 관리 (`:root` = 다크 기본, `[data-theme='light']` 오버라이드) — 새 UI 작성 시 하드코딩 색상 대신 반드시 변수 사용 (`--subtle-bg`, `--hover-bg`, `--modal-bg`, `--input-bg`, `--divider` 등)
- **사이드바 계층 시각 구분** — 대분류는 악센트 배경 띠(`.category-title`), 중분류는 들여쓰기+왼쪽 가이드선(`.equipment-subgroup-title`, `.equipment-subgroup-items`)

---

## 클라우드 아키텍처 (Firebase)

**핵심 원칙 (v1.10 정규화 이후):** 캔버스 노드는 배치 시점의 장비 정보를 통째로 품고(`data: {...equipment}`), 엣지는 생성 시점의 색상을 직접 품는다(`style.stroke`). 즉 노드/엣지는 카탈로그 없이도 항상 정상 렌더링되는 자기완결적 데이터다. 그래서 카탈로그(장비 DB·라인 타입)는 정규화된 전용 컬렉션에만 두고, 프리셋·공유 링크는 카탈로그를 중복 저장하지 않는다.

### 1) 카탈로그 (실시간, 정규화) — `equipment` / `lineTypes` / `equipmentOptions` / `cableCatalog` 컬렉션
- **대상:** 장비 DB · 라인 타입 · 장비 옵션 · 기성케이블 카탈로그 (사용자가 추가/수정한 값)
- **저장 구조:** 항목 1개 = 문서 1개 — `equipment/{equipmentId}`, `lineTypes/{lineTypeId}`, `equipmentOptions/{optionId}`, `cableCatalog/{cableId}` (네이티브 필드, JSON 문자열 아님)
- **동작 (`librarySync.ts`):** 앱 마운트 시 `startLibrarySync()` 1회 호출 → 컬렉션 단위 `onSnapshot` 으로 원격→로컬 실시간 반영, `useStore.subscribe` 에서 변경 전/후 배열을 diff해 **바뀐 문서만** 개별 `setDoc`/`deleteDoc` (배열 전체를 통째로 재직렬화하지 않음)
- **무한 루프 방지:** 원격 반영 중에는 `applyingRemote` 플래그로 push 스킵
- **최초 시드:** 클라우드가 비어 있으면 현재 로컬 값 업로드, 이후 클라우드가 소스 오브 트루스
- **동시 편집:** last-write-wins, 항목 단위이므로 서로 다른 장비를 동시에 편집해도 충돌 없음 (완전한 동시 편집은 Backlog "실시간 협업")

### 2) 프리셋 (실시간) — `presets` 컬렉션
- `presets/{presetId}` = 프리셋 1개당 문서 1개, `{id, name, json, updatedAt}` — `json`은 `{id, name, nodes, edges, createdAt, updatedAt}` 직렬화 (카탈로그 필드 없음)
- 프리셋을 불러와도 로컬 장비 DB·라인 타입은 건드리지 않음 — 카탈로그는 항상 실시간 동기화된 전역 상태이므로 병합 자체가 불필요

### 3) 공유 링크 (스냅샷) — `diagrams` 컬렉션
- **저장:** `Share` 버튼 → `ShareModal` → `saveSharedDiagram()` (`cloud.ts`)가 `{nodes, edges}`만 **JSON 문자열**로 직렬화해 `diagrams` 문서에 추가 → 문서 ID 반환 → `?share=<id>` 링크 생성
- **불러오기:** 앱 마운트 시 `?share=<id>` 감지 → `loadSharedDiagram()` → `importDiagramState()` 로 캔버스 복원 → URL 정리. 노드/엣지가 자기완결적이라 렌더링은 카탈로그 유무와 무관하게 항상 정상 동작
- **카탈로그 보충:** 로드된 노드 중 로컬 장비 DB에 없는 장비는 `node.data`에서 그대로 복구해 사이드바에 추가 (`store.ts`의 `importDiagramState`) — 공유 시점 이후 카탈로그에서 삭제된 장비라도 다이어그램 자체는 항상 정상 렌더링
- **스냅샷 방식:** 링크는 생성 시점의 불변 스냅샷. 수정 후 재공유 시 새 링크 생성

### 설정 (`src/firebaseConfig.ts`)
- Firebase 웹 설정값은 **공개되어도 되는 식별자** (비밀 아님). 보안은 Firestore 규칙으로 처리
- `FIREBASE_CONFIG` 객체에 직접 값 입력 또는 `VITE_FIREBASE_*` 환경변수로 주입
- ⚠️ **GitHub Pages 자동 배포에도 쓰려면 `firebaseConfig.ts`에 직접 값 입력** (Actions는 `.env`를 읽지 못함)
- 미설정 시 공유/동기화 자동 비활성화 (헤더 배지 "로컬 전용")

### 필요한 Firestore 보안 규칙
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /diagrams/{docId}  { allow read: if true; allow create: if true; allow update, delete: if false; }
    match /equipment/{docId} { allow read, write: if true; }
    match /lineTypes/{docId} { allow read, write: if true; }
    match /presets/{docId}   { allow read, write: if true; }
    match /workspace/{docId} { allow read, write: if true; } // 마이그레이션 검증 끝나면 삭제 가능 (아래 참고)
    match /equipmentOptions/{docId} { allow read, write: if true; }
    match /cableCatalog/{docId}     { allow read, write: if true; }
  }
}
```
> `equipmentOptions`/`cableCatalog`는 2026-07-03 추가된 컬렉션 — Firebase 콘솔에서 규칙을 수동으로 갱신해야 동기화가 동작한다 (이 저장소에는 `firebase.json`/`firestore.rules`가 없어 콘솔에서 직접 게시하는 방식).

### 레거시 구조 마이그레이션 (v1.10)
- v1.9까지는 장비 DB·라인 타입이 `workspace/library` 문서 1개에 JSON 문자열로 통째로 저장되고, 프리셋·공유 링크도 카탈로그 전체를 매번 복제해 저장했다
- `scripts/migrate-firestore-normalize.mjs` 로 무중단 단계적 이전 (스크립트 상단 주석에 순서 상세):
  1. `--apply` — `equipment`/`lineTypes` 컬렉션 생성 (순수 추가, 기존 `workspace`/`presets` 문서는 안 건드림 → 언제 실행해도 구코드에 영향 없음)
  2. 새 코드 배포 → 정상 동작 확인
  3. `--apply --trim-presets` — 프리셋 문서에서 레거시 `equipmentDB`/`lineTypes` 필드 제거 (구코드가 아직 쓰이는 동안 실행하면 구코드의 `loadPreset`이 깨지므로 반드시 2단계 이후에만)
  4. `--apply --delete-legacy` — `workspace/library` 문서 삭제 (되돌릴 수 없는 마지막 단계)
- 2026-07-02 기준 1단계까지 운영 반영 완료 (장비 26개·라인 타입 6개 이전 확인)

### 엑셀 원본 데이터 일괄 시드 (`scripts/seed-equipment-from-excel.mjs`)
- 2026-07-03, 자체 정리한 장비 리스트를 장비 DB·옵션·케이블 카탈로그로 일괄 변환해 Firestore에 추가 (일회성 실행, 순수 추가라 재실행해도 안전 — 같은 id로 덮어씀)
- xlsx 파싱은 `xlsx`(SheetJS) 패키지 사용 — 자체 regex 파서는 셀 내부 줄바꿈을 별도 행으로 잘못 인식하는 버그가 있었으므로 반드시 이 라이브러리를 통해서만 파싱할 것
- 매핑 규칙(카테고리 8종 매핑, 옵션 상위 모델/시리즈 판정, 포트 정보 파싱 규칙 등) 전체는 `EQUIPMENT_DB_SCHEMA.md` 참고
- 원본 엑셀 파일(`av-system-builder-raw-data.xlsx`)은 일회성 입력 자료라 `.gitignore` 처리, 저장소에 커밋하지 않음

### 제약
- Firestore 문서 한도 1 MiB → 업로드 이미지(Base64) 많으면 초과 가능. `librarySync.ts`가 항목별 900KB 초과 시 경고하고 해당 항목 동기화 스킵. 대형 프로젝트는 JSON Export 권장
- `firebase` SDK는 동적 import로 코드 스플릿 (메인 번들 미포함)
- 프리셋·공유 링크의 `nodes`/`edges`는 React Flow 객체가 `undefined` 필드를 가질 수 있어 여전히 JSON 문자열로 저장. `equipment`/`lineTypes` 문서는 필드가 고정적이라 네이티브 필드로 저장

---

## 프리셋 파일

고객사 실 구성도가 담긴 예시 프리셋 파일(`DS기흥_구성도_presets.json`)은 2026-07-01 저장소 정리 시 삭제되었다 (고객정보 보호 목적).
"일괄 불러오기" 기능 자체는 유지되며, 팀 공용 프리셋은 이제 Firestore `presets` 컬렉션에 저장되어 실시간 동기화된다 (위 클라우드 아키텍처 참고). 예시가 필요하면 개인정보가 없는 자체 JSON 파일을 새로 만들어 사용한다.

---

## 다음 개발 우선순위 (Backlog)

1. **실시간 협업** — WebSockets 또는 CRDT 기반 동시 편집 (현재 팀 공용 동기화는 last-write-wins 방식)
2. **마이크 커버리지 시뮬레이션** — Shure MXA925 등 수음 범위 오버레이 위젯
3. **글로벌 벤더 카탈로그 연동** — Shure, Crestron, Extron 등 벤더 장비 DB 임포트 (사용자 장비 DB 클라우드 동기화는 v1.8에서 완료, 자체 정리 카탈로그 일괄 반영은 2026-07-03 완료 — 남은 건 해외 벤더 카탈로그 자동 연동)
4. **BOM 케이블 카탈로그 관리 UI** — `cableCatalog` 컬렉션은 현재 시드 스크립트로만 채워짐. 팀이 직접 카탈로그 항목을 추가·수정할 수 있는 화면 필요 (장비 DB의 `AddEquipmentModal`에 대응하는 것이 아직 없음)

---

## 실행 방법

- **일반 사용자:** 배포된 사이트 접속 — `https://supaper.github.io/av-system-builder/` (GitHub Pages, main push마다 자동 재배포). 별도 설치·서버 구동 불필요
- **개발자 (코드 수정/테스트):**
  ```bash
  npm install
  npm run dev
  ```

⚠️ 로컬 서버 구동용 Windows 배치 파일(`start.bat` 등)은 2026-07-01 GitHub Pages 배포 전환으로 삭제됨. 비개발자용 로컬 실행 경로가 더 이상 필요하지 않음.

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
- **가시성:** Private (Private 저장소에서도 GitHub Pages 배포 정상 동작 확인됨. Pages로 배포된 사이트 자체는 URL을 아는 누구나 접근 가능 — 저장소 코드가 Private인 것과는 별개)

### 배포 (완료 — GitHub Pages)
- **URL:** `https://supaper.github.io/av-system-builder/`
- **방식:** `.github/workflows/deploy.yml` — `main` 브랜치 push마다 `npm run build` → GitHub Pages 자동 재배포
- **vite.config.ts:** `base: '/av-system-builder/'` (GitHub Pages 서브패스 대응, 변경 시 배포 경로도 함께 깨짐 주의)
- Firebase 사용 시 `src/firebaseConfig.ts`에 값을 직접 넣어야 배포본에도 반영됨 (Actions는 `.env`를 읽지 않음)
### 멀티 디바이스 데이터 주의사항
- 이 앱은 **LocalStorage 기반** → 기기마다 데이터가 독립적으로 저장됨
- 다른 기기에서 같은 구성도를 열려면:
  1. **클라우드 공유 링크** (`Share` 버튼) — Firebase 설정 시 링크 하나로 어디서든 로드 (권장)
  2. **JSON Export → Import** — Firebase 미설정 시 파일로 이동
- 실시간 동시 편집은 Backlog의 "실시간 협업" 기능 개발 시 해결 (공유 링크는 스냅샷 방식)

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

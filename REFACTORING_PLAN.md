# 리팩토링 계획 (2026-07-06 전수 스캔 기준)

> v1.17에서 "포트 타입 4종 하드코딩이 라인 타입 6종과 어긋난" 버그를 고친 뒤,
> 같은 계열의 문제가 더 있는지 src/ 전체를 전수 스캔한 결과와 수정 계획.
> 완료한 항목은 체크하고, 구조가 바뀌면 이 문서를 갱신한다.

## 우선순위 1 — 버그로 이어질 수 있는 중복 정의 (v1.17 버그와 같은 계열)

### 1-1. 카테고리 8종 목록이 5곳에 하드코딩
`video/display/conferencing/audio/control/network/broadcast/etc` 목록이 산재:
- [x] `AddEquipmentModal.tsx` — CATEGORY_LABELS map으로 교체 (2026-07-06)
- [x] `EditEquipmentModal.tsx` — 동일 (2026-07-06)
- [x] `EditNodeModal.tsx` — 동일 (2026-07-06)
- [x] `BulkImportModal.tsx` — `category in CATEGORY_LABELS` 검증으로 교체 (2026-07-06, 한글→카테고리 매핑 로직은 유지)
- [x] `App.tsx` — openCategories 초기값·categories 배열 모두 CATEGORY_LABELS에서 파생, 아이콘은 Record<EquipmentCategory, LucideIcon>으로 명시 (2026-07-06)

**수정안:** `store.ts`에 이미 있는 `CATEGORY_LABELS`를 단일 소스로 사용.
`Object.entries(CATEGORY_LABELS).map(([id, label]) => <option .../>)` 패턴으로 통일.
`App.tsx`의 `categories` 배열(아이콘 포함)도 store로 이동하거나 CATEGORY_LABELS에서 파생.
카테고리를 추가하면 select·사이드바·검증에 자동 반영되게 한다.

### 1-2. 포트 행 높이 상수 이중 정의 (28 vs 24)
- `store.ts` `calculateNodeHeight`/`getPortYOffset`는 행당 **28px**로 계산
- `EquipmentNode.tsx` 실제 렌더는 `height: 24` (+암묵적 여백 4로 우연히 일치)

현재는 결과적으로 맞아떨어지지만, 한쪽만 수정하면 **엣지 Y좌표가 어긋나는** 아키텍처 핵심
규칙 위반이 조용히 발생한다.
**수정안:** `store.ts`에 `PORT_ROW_HEIGHT = 24`, `PORT_ROW_GAP = 4` (합 28) 상수를 export하고
양쪽 모두 이 상수만 참조. 수정 후 포트 많은 노드에서 엣지 접점 회귀 확인 필수.
✅ **완료 (2026-07-06)** — PORT_ROW_HEIGHT/GAP/PITCH 상수 도입, store.ts 계산식과 EquipmentNode 렌더 모두 교체. 핸들-행 정렬 오차 0.0px 회귀 확인.

### 1-3. `getDefaultPortTypeForCategory`의 switch에 `etc` 누락
7종만 명시하고 `etc`는 default로 흡수 — 카테고리 추가 시 누락 위험.
**수정안:** `Record<EquipmentCategory, PortType>` 매핑 테이블로 교체 (누락 시 타입 에러 발생).
✅ **완료 (2026-07-06)** — DEFAULT_PORT_TYPE_BY_CATEGORY Record로 교체.

## 우선순위 2 — 문자열/버전 상수화

### 2-1. localStorage 키 산재
`av-builder-theme`, `av-builder-group-mode`, `av-builder-presets`,
`av-builder-active-nodes/edges/eqdb`, `av-pending-preset-*` 등이 `App.tsx`와 `store.ts`에
리터럴로 반복. **수정안:** `src/constants.ts` 신설, `STORAGE_KEYS` 객체로 통합.

### 2-2. Firestore 컬렉션명 산재
`'equipment' | 'lineTypes' | 'equipmentOptions' | 'cableCatalog' | 'presets' | 'diagrams'`가
`librarySync.ts`, `cloud.ts`, `scripts/*.mjs`에 반복.
**수정안:** `constants.ts`에 `FIRESTORE_COLLECTIONS` 추가. scripts는 빌드 밖이라 중복 허용하되
상단 주석으로 constants.ts와 동기화 의무 명시.

### 2-3. 버전 문자열 단일화
- `App.tsx` 헤더 배지 `v1.17` 하드코딩 (릴리스마다 수동 갱신, 두 번 누락된 적 있음)
- `package.json`은 `0.0.0`으로 방치

**수정안:** `package.json` version을 진짜 버전으로 올리고, `vite.config.ts`에
`define: { __APP_VERSION__: JSON.stringify(pkg.version) }` 추가 → 배지가 자동 표시.
릴리스 절차가 "package.json 버전 올리기 + CHANGELOG 작성" 둘로 정리됨.

## 우선순위 3 — 중복 UI 코드 추출

### 3-1. 모달 공통 요소 (4개 모달에 반복)
- 포트 타입 `<select>` 옵션 생성 (`portTypeOptions` 동일 코드 3벌)
- 포트 편집 섹션 (라벨 입력 + 타입 select + 삭제 버튼 + 추가 버튼, 3벌 × ~40줄)
- 이미지 업로드 블록 (FileReader + 미리보기 + 제거 버튼, 3벌 × ~15줄)
- 모달 오버레이 래퍼 (`position:fixed; inset:0` + stopPropagation, 인라인/클래스 혼재)

**수정안:** `src/components/` 신설:
- `<Modal>` — 오버레이 + ESC/배경클릭 닫기 + `modal-panel` 스타일
- `<PortListEditor ports onChange>` — 포트 편집 섹션 (lineTypes 옵션 내장)
- `<ImageUploadField value onChange>` — 이미지 업로드
한 번에 다 하지 말고 **모달 하나 고칠 일이 생길 때마다 그 모달부터 전환** (기능 변경과 리팩토링 커밋 분리).

### 3-2. App.tsx 분해 (1,510줄 — 저장소 최대 파일)
혼재된 책임: 테마/그룹모드 영속, 공유 토큰 처리, 사이드바, 헤더, 캔버스, Export 4종(PDF 포함), 모달 오케스트레이션.
**분리 순서 (의존성 적은 것부터):**
1. `usePersistedState` 훅 (theme/groupMode 패턴 통합)
2. `useDiagramExport` (JSON/PDF 내보내기 로직)
3. `<Sidebar>` 컴포넌트 (검색 + 그룹핑 토글 + 섹션 렌더)
4. `<AppHeader>` 컴포넌트

## 우선순위 4 — 색상/테마 하드코딩 (라이트 모드 잠재 이슈)

`App.tsx` 인라인 색상 중 테마를 수동 분기(`theme === 'light' ? ... : ...`)하거나 다크 전용
리터럴을 쓰는 곳: 어노테이션 기본색(`#1e293b`/`#ffffff`), 클라우드 상태 배지 색, MiniMap/Background 분기,
오버레이 `rgba(0,0,0,x)` 등.
**수정안:** 반복 사용되는 것만 CSS 변수로 승격 (`--overlay-bg` 등). 어노테이션 기본 색상 프리셋은
사용자 콘텐츠 데이터이므로 유지. 일괄 변경보다 라이트 모드에서 실제 안 보이는 곳 발견 시 개별 수정.

## 참고 — 이번에 함께 처리한 것 (2026-07-06)
- [x] 카탈로그 중복 제거: `scripts/dedupe-catalog.mjs` (name+model 기준, 포트/이미지/제조사 많은 항목 유지, 부족 필드 병합 후 삭제). 장비 20·옵션 1·케이블 1 = 22개 정리, 잔여 중복 0 확인

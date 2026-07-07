# Changelog

All notable changes to AV System Builder are documented here.  
Format: `## [vX.Y] — YYYY-MM-DD` / Added · Changed · Fixed · Removed

---

## [v1.18] — 2026-07-07

### Fixed
- **장비 라이브러리 편집 시 "동기화 오류" 발생 및 새로고침 시 롤백되던 버그** — 편집 모달이 빈 입력을 `undefined` 필드로 저장하는데 Firestore `setDoc`이 undefined 값을 거부해 쓰기가 실패하던 것이 원인. 모든 Firestore 쓰기 경로(장비·라인 타입·옵션·케이블 카탈로그)에 undefined 제거(sanitize)를 추가. 빈 값 저장(필드 지우기)까지 정상 동작 검증 완료

### Added
- **양방향 포트 방향 자동 전환** — 양방향↔양방향 연결(LAN 등)은 노드의 좌우 상대 위치에 따라 어느 쪽 핸들에 붙을지 자동 결정. 노드를 드래그해 좌우가 바뀌면 선이 즉시 반대쪽 포트로 옮겨 붙어 U자 우회 없이 항상 정방향으로 흐름 (저장 데이터는 불변 — 렌더 시점 정규화)
- **노드 위치까지 고려한 오토레이아웃** — 기존 L→R(들어오는 선) 정렬에 R→L(나가는 선의 타겟 포트 순번) 스윕을 추가한 Sugiyama식 교대 스윕 2회. 장비 여러 대가 한 장비의 In 1/2/3에 꽂히면 소스 노드들이 입력 포트 순번대로 위→아래 배치되어 선이 곧게 펴짐. 신호 엣지(SDI/HDMI/오디오/USB)에 가중치 3을 줘 신호 체인이 배치를 지배 (LAN 순서는 보조)
- **양방향 포트 단일 연결 강제** — 양방향(bidirectional) 포트는 물리적으로 잭 하나이므로, 한쪽 핸들에 선이 연결되면 반대쪽 핸들은 자동 비활성화(흐리게 표시 + 연결 시작/수신 불가). 연결 해제 시 다시 활성화. `isValidConnection`에도 이중 방어선 추가
- **엣지 교차 점프(hop)** — 선이 불가피하게 교차하는 지점에서 수평선이 수직선 위를 반원 아치로 넘어가 어느 선이 어디로 가는지 즉시 구분 가능. 모든 엣지가 축 정렬(H/V) 세그먼트라 교차 판정이 정확하며, 좌표는 React Flow 실측 핸들 좌표(`getInternalNode`) 사용. 라인 타입 필터로 숨긴 선과는 점프하지 않음
- 엣지 지오메트리 공유 유틸(`src/utils/edgeGeometry.ts`) — 경로 지점 계산을 렌더러(CustomSmoothstepEdge)와 교차 계산(edgeProcessing)이 공유하도록 일원화
- **세로 통로 전역 충돌 해소(Stage 4)** — 서로 다른 연결 그룹의 세로선이 같은 X에 포개지는 문제를 스윕으로 해소, 다열을 건너는 선의 세로 구간은 출발 열 근처로 제한해 중간 열 노드 관통 방지
- **엣지 교차·겹침 자동 전수 검증** — 렌더링된 SVG를 파싱해 모든 교차의 점프 유무와 세로선 겹침을 검사하는 Playwright 테스트로 검증 (교차 강제 시나리오 포함: 수동 배치 6/6, 오토레이아웃 10/10·13/13 점프 처리, 겹침 0, 누락 0)

### Changed
- **노드 가독성 개선** — 큰 글씨=모델명(13px/800, 실무 식별 기준), 작은 글씨=제품유형으로 교체 (헤더·줌아웃 LOD 오버레이·사이드바 모두). 포트 라벨 10px 보조색 → 11px 본문색으로 대비 강화. 사이드바 항목에 제조사 병기
- **오토레이아웃 간격 조정** — 같은 열 노드 세로 간격 60→90px, 열 간격 260→280px, 최소 노드 간격 24→40px (엣지 통로 확보로 선 겹침 감소)
- 노드 헤더 높이 상수를 실측값(54px)으로 교정(`NODE_HEADER_HEIGHT`) — 기존 45px 가정으로 인한 ~10px 좌표 오차가 엣지 오프셋 정렬을 흐트러뜨리던 문제 해소. 점프 계산은 React Flow 렌더 시점 실측 좌표로 이동 (레이아웃 직후 한 프레임 지난 좌표로 고착되던 타이밍 버그 수정)

---

## [v1.17] — 2026-07-06

### 참고 (데이터 정비)
- **카탈로그 중분류 단순화** — `scripts/normalize-catalog.mjs` 신설·적용 (2026-07-06 결정 반영). ① 디스플레이: "삼성 43인치 LFD" 같은 사이즈 박힌 중분류를 `LFD`/`비디오월`로 통일하고 사이즈·스펙은 model로 이동 (TV/LFD/LED/비디오월 4종 체계, LED는 장비 등록 시 생성) ② 익스텐더: 흩어져 있던 익스텐더·송신기·수신기를 `광 익스텐더 TX/RX`, `UTP 익스텐더 TX/RX`, 세트형은 무접미 그룹으로 재분류 (총 39건) ③ 장비 DB 잔존 케이블 14건 → cableCatalog 이관 ④ 표기 통일(DSP→오디오 DSP, AMP→파워 앰프, PTZ CAM→PTZ 카메라 등) 및 video의 디스플레이류 → display 이동. 판정 불가 22건은 변경하지 않고 스크립트 리포트로 목록화 (equipment 765→750, cableCatalog 168→182)
- **수동 확인 항목 1차 처리** — A20/AC20/AC40/AD20/AD40 5건을 중분류 `무선 HDMI`(제조사 NORTHVISION)로 확정, RF 증폭기로 오분류됐던 KTX/KRX 5건과 그래픽카드 GTX1650 삭제, Ross 제어패널 2건(ULTRITOUCH-2, TD-TouchScreen)을 video/컨트롤러 중분류로 이동 (equipment 750→744, 잔여 확인 필요 8건)
- **수동 확인 항목 2차 처리 (완료)** — HEXA-01을 중분류 `MUX/DEMUX`(video)로 확정, 케이블로 오판해 cableCatalog로 보냈던 MEDUSA AUD를 장비 DB의 MUX/DEMUX로 복원, 잔여 7건(HEML-0034K6, V-JETn, MR-4S, Plixus NEXT, DBA SET, VD12, model 없는 스크린) 삭제 — 수동 확인 목록 전량 소진 (equipment 744→738, cableCatalog 182→181)
- **카탈로그 중복 제거** — `scripts/dedupe-catalog.mjs` 신설. name+model 기준으로 중복 판정, 포트/이미지/제조사가 많은 항목을 유지하고 부족한 필드는 병합 후 사본 삭제. 장비 20개(VS5 3중복 포함)·옵션 1개·케이블 1개 = 총 22개 정리 (장비 785→765)
- **리팩토링 계획 수립** — src/ 전수 스캔으로 하드코딩·중복 정의 목록화, `REFACTORING_PLAN.md`에 우선순위별 계획 기록 (카테고리 8종 5중복, 포트 행 높이 28/24 이중 정의 등)
- **리팩토링 우선순위 1 적용** — 카테고리 8종 5중복을 `CATEGORY_LABELS` 단일 소스로 통일 (모달 3곳 select + BulkImport 검증 + App.tsx 초기값·categories 배열), 포트 행 높이를 `PORT_ROW_HEIGHT/GAP/PITCH` 공유 상수로 통일 (store.ts 좌표 계산 ↔ EquipmentNode 렌더 동기화, 핸들 정렬 오차 0px 회귀 확인), `getDefaultPortTypeForCategory`를 Record 매핑으로 교체 (카테고리 추가 시 누락이 컴파일 에러로 검출)

### Changed
- **포트 타입을 라인 타입(케이블 타입)과 통일** — 노드/장비/옵션 편집 모달의 포트 타입 선택지가 구버전 4종(Video/Audio/Control/Network) 하드코딩에서 라인 타입 목록(기본 6종: SDI·HDMI·A.AUDIO·LAN·USB·Control) 동적 렌더링으로 변경. 상단 케이블 필터와 항상 일치하며, 라인 타입을 추가하면 포트 타입 선택지에도 자동 반영
- 포트 핸들 색상도 라인 타입 색상에서 동적 조회 (`EquipmentNode.tsx`의 하드코딩 4색 제거) — SDI 포트는 SDI 색(#374151), USB 포트는 USB 색(#3b82f6)으로 표시
- SDI/USB 포트 타입이 생기면서 연결 유효성 판정(같은 타입끼리만 연결)과 엣지 자동 색상도 세분화됨
- BulkImport 텍스트 파싱의 포트 타입 인식도 6종으로 확장 (`sdi`, `usb` 추가)

---

## [v1.16] — 2026-07-06

### Changed
- **옵션 카드 선택을 체크박스 → 수량 스테퍼로 변경** — 같은 카드를 여러 장 꽂는 경우(예: XDM-12에 HDMI 입력 카드 3장) 지원. 수량만큼 포트가 반복 추가되고, 2장 이상이면 포트 라벨에 `#n` 접미사로 몇 번째 카드인지 구분. 노드 데이터는 `selectedOptionQuantities`(옵션 id → 수량)로 저장하며, 구버전 `selectedOptionIds`(체크 배열) 노드는 로드 시 수량 1로 자동 이전

---

## [v1.15] — 2026-07-06

### Added
- **옵션 카드 카탈로그 관리 UI** — 장비 편집 모달(`EditEquipmentModal`)에 "호환 옵션 카드" 섹션 추가. 현재 장비(모델명 접두 또는 시리즈 태그)와 호환되는 옵션 목록 + 포트 수 표시(0포트는 ⚠ 경고). 각 옵션의 "편집" 버튼 → 옵션 편집 모달(`EditOptionModal`)에서 옵션명·모델·제조사·설명·호환 모델/시리즈·추가 포트 구성 수정 및 삭제 가능. "새 옵션 추가" 시 현재 장비의 시리즈(없으면 모델명)가 호환 조건으로 자동 프리필. 변경은 Firestore `equipmentOptions` 컬렉션에 실시간 동기화 — 기존에는 옵션 카탈로그를 시드 스크립트로만 관리 가능했음

---

## [v1.14] — 2026-07-06

### Added
- **장비 라이브러리 원본 편집** — 사이드바 장비 항목 더블클릭 시 편집 모달(`EditEquipmentModal`) 오픈. 제품유형·모델명·제조사·카테고리·설명·시리즈 태그·사진·포트 구성(입력/출력/양방향) 등 장비의 모든 필드를 수정 가능. "라이브러리에서 삭제" 버튼(확인 후 삭제) 포함
- store에 `updateEquipment`/`removeEquipment` 액션 추가 — 변경은 기존 `librarySync` diff push를 타고 Firestore `equipment` 컬렉션에 실시간 반영되어 전 팀원에게 공유

### 참고
- 카탈로그 수정은 이미 캔버스에 배치된 노드에 영향을 주지 않음 (노드는 배치 시점 정보를 자기완결적으로 보유) — 배치된 노드는 기존처럼 노드 더블클릭(`EditNodeModal`)으로 개별 수정

---

## [v1.13] — 2026-07-03

### Added
- **장비 라이브러리 그룹핑 토글 (카테고리 / 제조사)** — 사이드바 검색창 아래 토글 버튼으로 대분류 기준을 전환. 제조사 모드는 장비 DB의 `manufacturer` 값에서 동적으로 섹션 생성(한글 우선 정렬, 미지정은 맨 뒤), 각 제조사 안에서도 카테고리 모드와 동일한 `name`(제품유형) 기준 중분류 적용. 선택 모드는 LocalStorage(`av-builder-group-mode`)에 저장

### Changed
- 대분류 섹션 헤더에 아이콘 표시 (카테고리 모드는 카테고리별 아이콘, 제조사 모드는 공장 아이콘 + 장비 수)

---

## [v1.12] — 2026-07-03

### Added
- **다크/라이트 모드 전환** — 헤더의 해/달 토글 버튼으로 테마 전환. 선택은 LocalStorage(`av-builder-theme`)에 저장되어 새로고침 후에도 유지. 전체 색상을 CSS 변수(`[data-theme='light']` 오버라이드)로 정리해 사이드바·캔버스·노드·모달·미니맵·LOD 오버레이 모두 대응, PDF 내보내기 배경색도 테마 연동

### Changed
- **사이드바 대분류/중분류 시각 구분 강화** — 대분류(카테고리)는 악센트 색 배경 띠 + 테두리로, 중분류(제품유형)는 들여쓰기 + 왼쪽 세로 가이드선으로 계층을 명확히 표현. 중분류 hover 시 가이드선이 악센트 색으로 강조
- 헤더 버전 배지를 하드코딩된 v1.10에서 v1.12로 갱신

---

## [v1.11] — 2026-07-03

### Added
- **카테고리 8종 세분화** — 장비 대분류를 `video/audio/control/network` 4종에서 `video/display/conferencing/audio/control/network/broadcast/etc` 8종으로 확장
- **사이드바 소분류 그룹핑** — 각 카테고리 안에서 `name`(제품유형, 예: "매트릭스 카드", "PTZ 카메라") 기준으로 2단 접이식 그룹 표시. 새 필드 추가 없이 기존 `name` 필드 재사용
- **장비 옵션 시스템** — 장비에 장착 가능한 카드/액세서리를 독립 카탈로그(`EquipmentOption`, Firestore `equipmentOptions` 컬렉션)로 관리. 옵션 하나가 특정 모델 또는 모듈형 프레임 제품군 전체(예: RTCOM XDM/SPX/VDM 시리즈)에 다대다로 호환 가능. `EditNodeModal`에서 체크박스로 옵션 선택 시 포트 구성 자동 반영
- **BOM 기성케이블 카탈로그** — `CableCatalogItem` 독립 컬렉션(`cableCatalog`) 추가. BOM 일괄/개별 입력 화면에서 제조사·모델 기반 카탈로그 검색·선택 가능
- **`Equipment`에 `manufacturer`/`description`/`series` 필드 추가, `EquipmentOption`에 `description` 필드 추가**
- 자체 정리한 장비 리스트(엑셀)를 `scripts/seed-equipment-from-excel.mjs`로 일괄 변환해 장비 747개·옵션 137개·케이블 카탈로그 169개를 Firestore에 반영

### Changed
- Firestore 보안 규칙에 `equipmentOptions`/`cableCatalog` 컬렉션 추가 (기존 컬렉션과 동일하게 로그인 없이 읽기/쓰기 허용)
- 사이드바 소분류 그룹을 항목이 1개뿐이어도 항상 접이식으로 표시 (기존에는 1개짜리 그룹은 접기 UI 없이 바로 노출)

### Fixed
- **옵션 137개 전부 "포트 0개 추가"로 뜨던 문제** — 원본 엑셀의 "포트 정보" 컬럼이 옵션 행에서는 전부 비어있었던 것이 원인. 모델명에 채널 수 근거가 명확한 44개(RTCOM XDM/SPX/VDM/UX 매트릭스 카드 39개, Dante 카드 2개, SFP 트랜시버 8개... 중 일부 중복 제외)는 모델명 패턴(커넥터 코드+I/O+채널수) 기반으로 포트를 정확히 채웠고, 근거 없는 나머지 93개(컨트롤러·렌즈·램프·브라켓·전원공급장치 등)는 잘못된 스펙을 넣는 것보다 안전하도록 0포트로 유지

---

## [v1.10] — 2026-07-02

### Added
- **장비 라이브러리 검색** — 사이드바에 검색창 추가, 이름·모델 기준 대소문자 무시 부분일치 필터. 매칭 없는 카테고리는 자동으로 숨김

### Changed
- **Firestore 데이터 구조 정규화** — 장비 DB·라인 타입을 `workspace/library` 단일 blob 문서에서 `equipment/{id}`·`lineTypes/{id}` 개별 문서로 분리. 항목 하나만 바뀌어도 해당 문서 하나만 diff해서 쓰기 때문에 동시 편집 충돌 위험이 줄고, 카탈로그가 커져도(벤더 카탈로그 임포트 대비) 구조 변경 없이 확장 가능
- **프리셋·공유 링크 경량화** — 캔버스에 배치된 노드/엣지는 배치 시점의 장비·색상 정보를 이미 그대로 품고 있어(자기완결적) 렌더링에 카탈로그가 필요 없다는 점을 확인. 이에 따라 `presets/{id}`·`diagrams/{id}`(공유 링크) 문서가 더 이상 장비 DB·라인 타입 전체를 중복 저장하지 않고 `nodes`/`edges`만 저장 — 문서 크기 대폭 축소, 카탈로그와 프리셋 간 데이터 중복 제거
- 공유 링크로 불러온 구성도 중 로컬 카탈로그에 없는 장비는, 배치된 노드에 남아있는 정보로부터 자동 복구되어 사이드바에 보충됨 (카탈로그에서 그사이 삭제됐어도 다이어그램 자체는 항상 정상 렌더링)

### 참고
- 운영 Firestore 데이터는 `scripts/migrate-firestore-normalize.mjs`로 무중단 단계적 마이그레이션 (1단계: 신규 컬렉션 생성 → 배포 확인 → 2단계: 프리셋 문서 경량화 → 3단계: 레거시 `workspace/library` 문서 삭제)

---

## [v1.9] — 2026-07-01

### Removed
- **`DS기흥_구성도_presets.json`** — 고객사 실 구성도 데이터가 담긴 예시 프리셋 파일을 저장소에서 삭제 (고객정보 보호). git 히스토리에는 남아있음(과거 커밋 1개). "일괄 불러오기" 기능 자체는 영향 없음
- 로컬에만 있던 고객사 PDF 도면 파일 삭제 (git 미추적, 저장소엔 원래 없었음)
- 코드 전체 검색으로 미참조 확인된 Vite 템플릿 잔재 파일 4개 삭제: `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`
- **로컬 서버 구동용 Windows 스크립트 4개 삭제**: `start.bat`, `start-SOOJ.bat`, `start_hidden.vbs`, `stop.bat` — GitHub Pages 배포 전환으로 비개발자가 로컬 서버를 띄울 필요가 없어짐 (배포된 URL로 바로 접속)

### Changed
- CLAUDE.md · README.md에서 삭제된 예시 프리셋 파일 관련 설명을 클라우드 동기화 기반 설명으로 갱신
- GitHub 저장소의 main에 이미 merge된 로컬·원격 브랜치 6개 정리 (데이터 손실 없음)
- CLAUDE.md "배포" 섹션 — 실제 상태와 어긋난 "Vercel 예정" 문구를 실제 배포 중인 GitHub Pages 정보로 교정
- README.md 상단에 배포 URL 추가, "로컬 실행" 섹션을 개발자 전용 안내로 재정의

---

## [v1.8] — 2026-07-01

### Added
- **팀 공용 라이브러리 실시간 동기화 (Firebase Firestore)** — 장비 DB · 라인 타입 · 프리셋을 클라우드에 두고 모든 기기·브라우저에서 공통으로 표시
  - 로그인 없는 단일 팀 공용 방식. `onSnapshot` 으로 다른 기기의 변경이 실시간 반영, 로컬 변경은 자동 push (`librarySync.ts`)
  - `workspace/library` 문서(장비 DB + 라인 타입) + `presets/{id}` 컬렉션(프리셋 1개당 문서 1개, 1MB 한도 회피)
  - 최초 로드 시 클라우드가 비어 있으면 현재 로컬 값으로 시드, 이후 클라우드가 소스 오브 트루스
  - 헤더에 동기화 상태 배지(로컬 전용 / 동기화 중 / 클라우드 동기화 / 오류)

### Changed
- `importDiagramState` — 공유 링크·프리셋 열기·JSON 임포트 시 장비 DB·라인 타입을 **병합**(없는 항목만 추가)하도록 변경. 팀 공용 라이브러리를 통째로 덮어쓰지 않도록 보호
- `cloud.ts` — Firestore 저장 형식을 **JSON 문자열 필드**로 통일 (undefined 필드·중첩 배열 제약 회피). `getFirestoreDb()` 공용 export
- 헤더 버전 배지 `v1.7` → `v1.8`
- Firestore 보안 규칙에 `workspace`·`presets` 컬렉션 read/write 허용 필요 (README 참고)

---

## [v1.7] — 2026-06-30

### Added
- **클라우드 공유 링크 (Firebase Firestore)** — 헤더 `Share` 버튼으로 현재 구성도를 클라우드에 저장하고 공유 링크 생성
  - 생성된 `?share=<id>` 링크를 다른 브라우저·기기·동료에게 전달하면 동일 구성도를 그대로 로드 (LocalStorage 기기 종속 문제 해결)
  - `ShareModal` — 링크 자동 생성, 클립보드 복사, 새 탭 열기, 업로드 진행/오류 상태 표시
  - `cloud.ts` — `saveSharedDiagram()` / `loadSharedDiagram()` / `buildShareUrl()`, firebase SDK 동적 import 코드 스플릿
  - `firebaseConfig.ts` — 설정 파일(직접 입력) + `VITE_FIREBASE_*` 환경변수 지원, 미설정 시 공유 기능 자동 비활성화 + 안내 표시
  - 앱 진입 시 `?share=<id>` 자동 감지 → 로딩/오류 오버레이와 함께 구성도 복원
  - 링크는 생성 시점의 불변 스냅샷 (수정 후 재공유 시 새 링크)
- `.env.example` — Firebase 환경변수 템플릿

### Changed
- 헤더 버전 배지 `v1.6` → `v1.7`
- `.gitignore` — `.env` / `.env.*` 무시 (단 `.env.example` 은 커밋)

---

## [v1.6] — 2026-06-25

### Added
- **새로만들기 버튼** — 헤더 `+` 버튼으로 빈 캔버스 시작, 기존 작업 저장 여부 확인 2단계 모달
- **BOM 케이블 명세 모드** — 헤더 `BOM` 버튼으로 모드 전환
  - **일괄 입력** (`BomBulkModal`) — 전체 연결선을 테이블로 표시, 제품명·구분(기성/제작)·길이/수량 인라인 입력
  - 수량이 있는 장비(예: PTZ CAM ×3)는 연결선 1개당 자동으로 N행 분리, 각각 별도 길이 입력 가능
  - 행 추가(+) / 삭제(-) 버튼으로 수동 조정 가능
  - **개별 편집** (`BomEdgeModal`) — BOM 모드에서 연결선 더블클릭 시 개별 케이블 정보 편집
  - **BOM 보기** (`BomReportModal`) — 기성 케이블(제품별 수량) / 제작 케이블(제품별 총 길이) 집계 표, CSV 내보내기
  - BOM 모드 ON 시 각 연결선에 제품명·길이/수량 오버레이 표시, 미입력 선은 황색 ⚠ 경고

### Changed
- **BOM 일괄 입력 모달** — 너비 축소 (`88vw` → `min(96vw, 860px)`), 케이블 종류 드롭다운 추가 (변경 시 엣지 색상 자동 반영), 신호 색상 정확도 개선 (stroke 색상 역추산)
- **평행 엣지 오프셋 Stage 0** — 같은 소스·타겟 노드 쌍을 연결하는 복수 엣지에 방향 인식 정렬 적용 (DOWN 방향: sourceY 역순 → 상단 소스에 양수 오프셋), H-V-H 교차 최소화

### Fixed
- 프리셋 불러올 때 기존 장비 DB가 삭제되는 버그 — merge 방식으로 전환 (신규 ID만 추가, 기존 유지)

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

## [v1.2] — 2026-05 ~ 06 (미기록 기간 복원)

> CHANGELOG 작성 전 구현된 기능들. 코드베이스 실제 상태 기준으로 소급 기록.

### Added
- **Undo / Redo** — Ctrl+Z / Ctrl+Y, Zustand past/future 스택 (MAX 50), 드래그·연결·삭제·붙여넣기·레이아웃 모두 추적 (`store.ts`)
- **Ctrl+C / Ctrl+V 복사·붙여넣기** — 선택 노드 + 연결 엣지 함께 복사, 40px 오프셋 배치 (`App.tsx`)
- **BulkImport** — Excel/CSV 기반 장비 일괄 등록, append/overwrite 모드 (`BulkImportModal`)
- **어노테이션 노드** — 텍스트 메모 노드 + 더블클릭 편집 모달 (`AnnotationNode`, `EditAnnotationModal`)
- **Shape/Zone 노드** — 영역 표시용 사각형 노드 (`ShapeNode`)
- **MiniMap** — 캔버스 전체 조망 미니맵 (토글 가능)

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

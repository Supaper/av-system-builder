# 장비 DB 데이터 구조 설계 (초안 — 미구현)

> 이 문서는 `av-system-builder-raw-data.xlsx` 원본 데이터를 기존 장비 DB에 통합하기 위해
> **개발 착수 전** 데이터 형태를 먼저 확정하는 설계 문서다. 코드는 아직 한 줄도 변경되지 않았다.
> 결정 사항이 바뀌면 이 문서를 먼저 갱신한 뒤 구현에 들어간다.

## 0. 원본 데이터 개요

- 파일: `av-system-builder-raw-data.xlsx` (프로젝트 루트, git에는 미커밋 상태). **이번 세션에서 장비 DB 반영을 완료하면 더 이상 필요 없는 일회성 입력 자료 — 저장소에 커밋하지 않는다.**
- 시트 1개, 컬럼 9개: `카테고리 | 제품명 | 모델명 | 제조사 | 구분 | 설명 | 제품군 | 상위 모델 | 포트 정보`
- **정정:** 초기 분석 시 자체 제작한 regex 기반 XML 파서로 얻은 "1,211행" 수치는 부정확했다 (셀 내 줄바꿈이 별도 행으로 잘못 카운트됨 + 일부 컬럼 값이 밀리는 버그). `scripts/seed-equipment-from-excel.mjs`에서 정식 라이브러리(SheetJS `xlsx`)로 다시 파싱한 결과, **실제 데이터 행은 1,078개**이며 컬럼도 정확히 위 9개로 확인됨. 아래 수치는 전부 이 정식 파싱 기준으로 갱신된 값이다.
- 기존 수작업 장비 DB(코드에 하드코딩, [store.ts:234-262](src/store.ts#L234-L262))는 47개 항목 — 이번 통합 대상에 포함.

## 1. 엑셀 컬럼 → 최종 필드 매핑

| 엑셀 컬럼 | 매핑 대상 | 비고 |
|---|---|---|
| 카테고리 | `Equipment.category` (8종, §2 참고) | 원본 24종 값을 8종으로 축약 |
| 제품명 | `Equipment.name` | **소분류 역할 겸함** — 사이드바에서 이 값으로 그룹핑 (§6) |
| 모델명 | `Equipment.model` | |
| 제조사 | `Equipment.manufacturer` (신규 필드) | 현재 스키마에 없음 → 추가 필요 |
| 구분(제품/옵션) | 제품→장비 1건 / 옵션→상위 모델의 `EquipmentOption`으로 흡수 | §5 |
| 설명 | `Equipment.description` (신규 필드, optional) | 툴팁·상세정보용 |
| 제품군 | **사용 안 함** | 카테고리와 교차 검증한 결과 일관성이 낮음(예: "화상회의"가 카메라/마이크/스피커/케이블/회의시스템에 걸쳐 흩어짐). 별도 필드로 저장할 실익 없음 |
| 상위 모델 | 옵션 행에서만 사용, 부모 장비 매칭 키 | 매칭 후 저장하지 않음(§5) |
| 포트 정보 | `Equipment.inputs/outputs/bidirectional` 변환 시도 | 1,172건 중 313건만 값 존재(§7) |

## 2. 카테고리 체계 (8종 확정안)

| 신규 category | 원본 카테고리 매핑 | 건수(대략) |
|---|---|---|
| `video` | 영상 + 영상처리/스위칭 + CCTV | 242 |
| `display` | TV + 프로젝터,스크린 + 프로젝션 | 225 |
| `conferencing` | 화상회의 | 94 |
| `audio` | 오디오 + 음향처리 + 스피커 + 마이크 | 248 |
| `control` | 제어 + PC/주변기기 + CMS | 85 |
| `network` | 네트워크 | 15 |
| `broadcast` | Head-End, CATV | 43 |
| `etc` | 기타 + 기타 유통제품 + Cisco | 19 |
| *(DB 제외)* | 케이블 및 커넥터 + 케이블/광자재 + 케이블 → §4 케이블 카탈로그로 | 171 |
| *(완전 제외, 확정)* | 전원, 랙, 판넬, 몰드 및 보양 — 장비 DB·케이블 카탈로그 어디에도 포함하지 않음 | 25 |

원본 카테고리는 사람이 그때그때 입력한 값이라 내부적으로 일관되지 않는다(예: "TV" 밑에 "화상회의 코덱"이 1건 들어있음, "PC"가 제어/TV/오디오에 걸쳐 있음). 이런 소수 이상치는 임포트 후 앱의 편집 모달에서 개별 수정하는 걸 전제로 하고, 8종 매핑은 원본 "카테고리" 컬럼 기준으로 기계적으로 처리한다 (건별 수작업 재분류는 하지 않음).

## 3. 최종 스키마 (제안, v2 — 옵션 다대다 구조로 변경)

옵션 하나가 여러 상위 장비에 동시에 연결될 수 있어야 한다 (예: RTCOM 매트릭스 카드는 XDM-12/XDM-20/XDM-36 중 어떤 프레임에도 꽂을 수 있음). 그래서 옵션을 특정 장비에 종속된 배열(`Equipment.options`)로 두지 않고, **독립된 카탈로그 + 호환 조건**으로 설계한다.

```ts
export type EquipmentCategory =
  | 'video' | 'display' | 'conferencing' | 'audio'
  | 'control' | 'network' | 'broadcast' | 'etc';

// 독립 컬렉션 — equipment/lineTypes와 동급으로 Firestore에 별도 저장
export interface EquipmentOption {
  id: string;
  name: string;                  // 예: "BLUAEC-IN", "XDM-HI100"
  model?: string;
  manufacturer?: string;
  compatibleModels?: string[];   // 특정 모델명 지정 (예: ["BLU-101"])
  compatibleSeries?: string[];   // 제품군 단위 지정 (예: ["XDM 시리즈"]) — Equipment.series와 매칭
  addPorts: {
    inputs: Port[];
    outputs: Port[];
    bidirectional: Port[];
  };
}

export interface Equipment {
  id: string;
  category: EquipmentCategory;
  name: string;                 // = 엑셀 "제품명" (사이드바 소분류 그룹핑 키 겸용)
  model: string;                 // = 엑셀 "모델명"
  manufacturer?: string;         // 신규: 엑셀 "제조사"
  description?: string;          // 신규: 엑셀 "설명"
  series?: string;                // 신규: 모듈형 제품군 태그 (예: "XDM 시리즈"). 개별 모델에는 없고 프레임류에만 존재
  imageUrl?: string;
  quantity?: string;
  isReused?: boolean;
  inputs: Port[];
  outputs: Port[];
  bidirectional: Port[];
}
```

**적용 가능한 옵션 조회 규칙**: 노드 편집 화면에서 특정 장비에 적용 가능한 옵션 목록 =
`optionsCatalog.filter(opt => opt.compatibleModels?.some(m => equipment.model.startsWith(m)) || (equipment.series && opt.compatibleSeries?.includes(equipment.series)))`

노드 인스턴스 데이터에는 `selectedOptionIds?: string[]`를 추가한다 (다중 선택 — 슬롯형 DSP·매트릭스는 카드 여러 장을 동시에 꽂는 경우가 많음). 선택된 옵션들의 `addPorts`가 실제 렌더링되는 inputs/outputs/bidirectional에 합쳐진다.

## 4. 케이블 카탈로그 (장비 DB와 분리된 별도 컬렉션)

```ts
export interface CableCatalogItem {
  id: string;
  name: string;          // 엑셀 제품명 (예: "HDMI 케이블")
  model: string;          // 엑셀 모델명
  manufacturer?: string;
  lineTypeId?: string;    // 기존 LineType과 연결(색상/신호종류 매핑용)
  description?: string;
}
```

- 대상: 원본 "케이블 및 커넥터"+"케이블/광자재"+"케이블" = 171건
- BOM 기성케이블(`BomBulkModal`/`BomEdgeModal`의 `cableType: 'ready-made'`) 입력 시 이 카탈로그에서 검색·선택. 자유 텍스트 직접 입력도 계속 허용(카탈로그에 없는 케이블 대응)
- 장비 DB(`equipment` 컬렉션)에는 들어가지 않음 — 케이블은 캔버스 노드가 아니라 연결선(엣지)에 부속된 BOM 정보이기 때문

## 5. 옵션(구분="옵션", 141건) 처리 규칙 — 확정

- 기본 규칙: 옵션 행의 "상위 모델" 텍스트를 `EquipmentOption.compatibleModels`에 그대로 저장 (매칭은 저장 시점이 아니라 조회 시점에 §3 규칙으로 수행 — Equipment를 나중에 추가해도 자동으로 호환 관계가 성립함)
- **`BLU-101`** (BSS DSP 카드 3종) — 실제 제품 행의 모델명이 `BLU-101, AEC/Bluelink지원`으로 되어 있어 정확히 일치하지 않음 → `compatibleModels: ["BLU-101"]`로 저장하고, 조회 시 `equipment.model.startsWith("BLU-101")`로 판정 (완전 일치 대신 접두 일치 사용)
- **`XDM 시리즈`(16건) / `SPX 시리즈`(4건) / `VDM 시리즈`(9건)** — RTCOM 매트릭스 카드류. 실제로 XDM-12/XDM-20/XDM-36, SPX-M810~M24120 5종, VDM-8X~64X 5종의 프레임 제품이 각각 존재함을 확인했다. 이 프레임 장비들에 `series: "XDM 시리즈"` 등을 태깅하고, 카드 옵션에는 `compatibleSeries: ["XDM 시리즈"]`를 지정 → **동일 시리즈의 어떤 프레임 모델에서도 같은 카드 옵션 목록이 뜬다** (사용자 요청사항 반영 완료)

## 6. 사이드바 표시 규칙 (스키마 변경 없음)

카테고리(8) → **`name` 값으로 묶은 소그룹**(제품명, 그룹 내 항목이 2개 이상일 때만 접기 UI 적용) → 모델별 항목. 기존 `name`/`model` 필드를 그대로 재사용하므로 이 부분은 데이터 구조 추가가 필요 없다 — [App.tsx:1088-1129](src/App.tsx#L1088-L1129) 사이드바 렌더링 로직만 수정.

## 7. 포트 정보 파싱 규칙 (초안)

1,172건 중 313건에만 자유 텍스트로 존재. 패턴 예시:

| 원본 텍스트 | 해석 |
|---|---|
| `AEC 8CH` | bidirectional audio × 8 |
| `AUDIO 4IN` | input audio × 4 |
| `DANTE 4IN 4OUT` | input audio × 4 + output audio × 4 |
| `LAN 1PORT (PoE)` | bidirectional network × 1 |

나머지 859건은 포트 정보 없음 → 빈 배열(`inputs:[], outputs:[], bidirectional:[]`)로 시작하고, 다이어그램에 실제로 쓰이는 장비부터 수기로 보완하는 걸 전제로 한다 (1,172건 전체를 포트까지 정교하게 초기 세팅하는 건 비현실적).

## 8. 결정 완료 사항 (요약)

- [x] 케이블/커넥터류 → 장비 DB 제외, BOM 기성케이블 카탈로그로 분리
- [x] 옵션 → 장비 노드 내 다중 선택 방식으로 포트 구성 반영, **하나의 옵션이 여러 상위 장비(모델 또는 시리즈)에 동시 호환되는 다대다 구조**로 확정 (§3, §5)
- [x] 카테고리 8종으로 세분화
- [x] 소분류는 새 필드 없이 기존 `name` 필드 재사용
- [x] "전원, 랙, 판넬, 몰드 및 보양"(25건) — 장비 DB·케이블 카탈로그 어디에도 넣지 않고 완전 제외
- [x] 옵션 매칭 실패 4건 — §5 규칙(접두 일치 + 시리즈 태깅)으로 전부 해결
- [x] `av-system-builder-raw-data.xlsx` — 이번 세션에서 장비 DB 반영 완료 후 폐기, 저장소에 커밋하지 않음

## 9. 남은 미해결 사항

- [x] `BulkImportModal.tsx`는 8종 카테고리 인식만 추가하고 스펙(6개 컬럼)은 그대로 유지 — 로우데이터는 `scripts/seed-equipment-from-excel.mjs`로 일회성 반영

## 10. 실행 결과 (스크립트 dry-run, 정식 파서 기준)

```
총 1,078행 파싱
- 장비: 747개  (video 192 / display 151 / conferencing 84 / audio 218 / control 57 / broadcast 41 / etc 4 / network 0)
- 옵션: 137개 (상위 모델 텍스트 없음: 0개)
- 케이블 카탈로그: 169개
- 제외(전원/랙/판넬): 25개
- 포트 정보가 파싱된 장비: 229개 / 747개
```

- 검증: XDM(14)/SPX(4)/VDM(10) = 28개 옵션이 각 시리즈에 정상 연결, 프레임 장비 13개(XDM-12/20/36, SPX-M810~M24120 5종, VDM-8X~64X 5종) 전부 `series` 태그 정상 부여 확인
- 검증: BLU-101 옵션 3종(BLUAEC-IN, BLUCARD-IN, BLUCARD-OUT)이 `compatibleModels: ["BLU-101"]`로 저장되고, 실제 장비 모델명 `"BLU-101, AEC/Bluelink지원"`이 접두 일치로 정상 매칭됨
- 결과 JSON은 검토용으로 `.seed-dump/`(git 미추적)에 저장됨
- **Firestore 반영은 사용자 확인 후 `--apply`로 실행 예정** (운영 중인 공용 데이터베이스에 문서 약 1,053개 추가)

# AV System Builder

오디오-비디오 시스템 설계를 위한 인터랙티브 구성도 툴.
장비 간 신호 연결을 시각적으로 구성하고 PDF·JSON으로 내보낼 수 있습니다.

> 서울AV 내부 프로젝트 — 현장 AV 시스템 설계 및 제안서 작성 용도

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| 장비 드래그 앤 드롭 | 사이드바 장비 DB에서 캔버스로 끌어다 놓기 |
| 신호선 연결 | 포트 핸들 클릭으로 장비 간 배선 (SDI·HDMI·Audio·LAN·USB·Control) |
| 오토 레이아웃 | Dagre 기반 좌→우 신호 흐름 자동 정렬, 선 교차 최소화 알고리즘 |
| 프리셋 | 구성도 저장·불러오기 (캔버스 교체 / 추가 / 새 탭) |
| PDF 내보내기 | 현재 구성도를 PDF로 저장 |
| JSON Import/Export | 구성도 전체를 JSON으로 저장·복원 |
| 장비 이미지 업로드 | 제품 사진 삽입 (Base64, 서버 불필요) |
| 수량·재활용 표시 | 노드에 수량 배지·재활용 여부 마킹 |
| 줌 LOD | 축소 시 장비명+수량 크게 표시, 확대 시 포트 상세 표시 |
| Diagram Lock | 잠금 시 노드 이동 불가, 오토 레이아웃 비활성화 |

---

## 기술 스택

- **React 19** + **TypeScript 6** + **Vite 8**
- **@xyflow/react** (React Flow v12) — 다이어그램 캔버스
- **Dagre** — 자동 레이아웃
- **Zustand 5** — 상태 관리
- **jsPDF + html-to-image** — PDF 내보내기
- **Lucide React** — 아이콘
- Glassmorphism 다크 테마 (Vanilla CSS)

---

## 포함된 프리셋

`DS기흥_구성도_presets.json` — DS기흥 사무동 AV 시스템 3개 구성도

- **1층 컨퍼런스홀** — PTZ CAM×3, VS5 스위처, DSP BLU-50v2, 무선마이크 2CH, Delegate System×21
- **2층 컨벤션룸** — PTZ CAM×3, DSP BLU-101×3, Logic Controller MPCMPC×2, 구즈넥마이크×28
- **관제실** — 비디오월 PC×5, VDM-16X 매트릭스, HDBaseT 연장, KVM CS1798×2, CE824

앱 사이드바 → **일괄 불러오기**로 JSON 파일 임포트 후 프리셋 목록에서 로드.

---

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

**Windows 비개발자 환경:**
- `start.bat` 실행 → 자동으로 npm 설치 및 서버 시작
- `start_hidden.vbs` — 터미널 창 없이 백그라운드 실행
- `stop.bat` — 서버 종료

---

## 개발 워크플로

```bash
# 작업 시작 전
git pull

# 작업 완료 후
git add .
git commit -m "변경 내용 요약"
git push
```

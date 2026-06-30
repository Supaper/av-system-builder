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
| 클라우드 공유 링크 | `Share` 버튼으로 링크 생성 → 다른 브라우저·기기·동료가 링크만으로 동일 구성도 로드 (Firebase) |
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

## 클라우드 공유 링크 설정 (Firebase)

`Share` 버튼으로 만든 링크 하나로 어떤 브라우저·기기에서도 같은 구성도를 열 수 있습니다.
이 기능을 쓰려면 무료 Firebase 프로젝트를 한 번 연결해야 합니다. (미설정 시에는 JSON Export/Import 사용)

1. [console.firebase.google.com](https://console.firebase.google.com) 에서 프로젝트 생성
2. **빌드 → Firestore Database** 생성
3. **프로젝트 설정 ⚙️ → 내 앱 → 웹 앱(`</>`) 추가** → `firebaseConfig` 값 복사
4. `src/firebaseConfig.ts` 의 `FIREBASE_CONFIG` 객체에 값 붙여넣기
5. Firestore **규칙** 탭에 아래 규칙 적용 (링크를 아는 사람만 읽기/생성, 기존 공유본은 불변):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /diagrams/{docId} {
         allow read: if true;
         allow create: if true;
         allow update, delete: if false;
       }
     }
   }
   ```

> Firebase 웹 설정값은 공개되어도 되는 식별자입니다(비밀번호 아님). 실제 보안은 위 Firestore 규칙으로 처리합니다.
> GitHub Pages 자동 배포에도 공유 기능을 적용하려면 환경변수(`.env`)가 아닌 `src/firebaseConfig.ts` 에 직접 값을 넣으세요.
> 공유 한도는 약 0.9 MB이며, 업로드 이미지가 많은 대형 구성도는 JSON Export를 권장합니다.

---

## 개발 워크플로

**작업 시작 전** (PowerShell):
```powershell
.\git-start.ps1
```
main 최신화 → `local/YYYYMMDD-HHmm` 브랜치 자동 생성

**작업 완료 후** (PowerShell):
```powershell
.\git-done.ps1 "feat: 변경 내용 요약"
```
커밋 → push → GitHub PR 페이지 자동 오픈

GitHub: `https://github.com/Supaper/av-system-builder`

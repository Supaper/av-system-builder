// ───────────────────────────────────────────────────────────────────────────
// Firebase 설정
// ───────────────────────────────────────────────────────────────────────────
//
// 이 값들은 "비밀번호"가 아니라 클라이언트(브라우저)에 공개되어도 되는 식별자다.
// (실제 보안은 Firebase 콘솔의 Firestore 보안 규칙으로 처리한다.)
//
// 설정 방법 (최초 1회):
//   1. https://console.firebase.google.com 에서 프로젝트 생성
//   2. 좌측 "빌드 → Firestore Database" 생성 (프로덕션/테스트 모드 무관, 규칙은 아래 참고)
//   3. 프로젝트 설정 ⚙️ → "내 앱" → 웹 앱(</>) 추가 → firebaseConfig 값 복사
//   4. 아래 FIREBASE_CONFIG 의 각 항목에 붙여넣기
//
// Firestore 보안 규칙 예시 (링크 공유용 — 공유 링크를 아는 사람만 읽기/쓰기):
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /diagrams/{docId} {
//         allow read: if true;        // 링크(문서 ID)를 아는 사람은 열람 가능
//         allow create: if true;      // 누구나 새 구성도 공유 생성 가능
//         allow update, delete: if false; // 기존 공유본 수정/삭제 금지 (불변)
//       }
//     }
//   }
//
// 환경변수(VITE_FIREBASE_*)로도 덮어쓸 수 있다. 둘 다 비어 있으면
// 공유 기능은 자동으로 비활성화되고 버튼에 설정 안내가 표시된다.
// ───────────────────────────────────────────────────────────────────────────

const env = import.meta.env;

// 여기에 본인 프로젝트 값을 직접 붙여넣으면 GitHub Pages 자동 배포에도 그대로 반영된다.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDVgyemxoaw5YSMflP_ay0EysLH7X07_Gs',
  authDomain: 'av-system-builder.firebaseapp.com',
  projectId: 'av-system-builder',
  storageBucket: 'av-system-builder.firebasestorage.app',
  messagingSenderId: '696689042225',
  appId: '1:696689042225:web:f3edfd19f5663af7150610',
};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || FIREBASE_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || FIREBASE_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || FIREBASE_CONFIG.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || FIREBASE_CONFIG.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || FIREBASE_CONFIG.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || FIREBASE_CONFIG.appId,
};

// 핵심 값(apiKey, projectId)이 채워져 있으면 설정 완료로 간주한다.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

// ───────────────────────────────────────────────────────────────────────────
// 클라우드 (Firebase Firestore) 공통 모듈
//
// 1) 공유 링크: 구성도 스냅샷을 diagrams 컬렉션에 저장 → ?share=<id> 링크
// 2) getFirestoreDb(): 다른 모듈(librarySync)이 재사용하는 Firestore 인스턴스
//
// Firestore는 undefined 필드/중첩 배열에 제약이 있으므로, 구성도 데이터는
// JSON 문자열로 직렬화해 하나의 문자열 필드에 저장한다 (안정성 + 단순화).
//
// firebase SDK는 동적 import 하여 초기 번들에 포함되지 않도록 한다.
// ───────────────────────────────────────────────────────────────────────────
import type { Edge, Node } from '@xyflow/react';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

export interface SharedDiagram {
  nodes: Node[];
  edges: Edge[];
}

// Firestore 단일 문서 한도는 1 MiB. 여유를 두고 900 KB 에서 경고한다.
export const MAX_DOC_BYTES = 900 * 1024;

export function byteSize(str: string): number {
  return new Blob([str]).size;
}

// 동적 import + 싱글턴 캐시
let _dbPromise: Promise<import('firebase/firestore').Firestore> | null = null;

export async function getFirestoreDb() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase가 설정되지 않았습니다. src/firebaseConfig.ts 를 확인하세요.');
  }
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getFirestore } = await import('firebase/firestore');
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      return getFirestore(app);
    })();
  }
  return _dbPromise;
}

/**
 * 현재 구성도를 클라우드에 저장하고 공유용 문서 ID를 반환한다.
 */
export async function saveSharedDiagram(state: SharedDiagram, name?: string): Promise<string> {
  const payload: SharedDiagram = {
    nodes: state.nodes,
    edges: state.edges,
  };

  const json = JSON.stringify(payload);
  if (byteSize(json) > MAX_DOC_BYTES) {
    const mb = (byteSize(json) / 1024 / 1024).toFixed(2);
    throw new Error(
      `구성도 용량이 너무 큽니다 (${mb} MB). 업로드한 큰 이미지를 줄이거나 제거한 뒤 다시 시도하세요. ` +
        `(클라우드 공유 한도 약 0.9 MB — 대형 프로젝트는 JSON 내보내기를 사용하세요.)`
    );
  }

  const db = await getFirestoreDb();
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const ref = await addDoc(collection(db, 'diagrams'), {
    version: '1.1',
    name: name || '',
    data: json,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * 공유 문서 ID로 구성도를 불러온다. 없으면 null.
 */
export async function loadSharedDiagram(id: string): Promise<SharedDiagram | null> {
  const db = await getFirestoreDb();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'diagrams', id));
  if (!snap.exists()) return null;
  const raw = snap.data() as { data?: string };
  if (!raw.data) return null;
  const parsed = JSON.parse(raw.data) as Partial<SharedDiagram>;
  return {
    nodes: parsed.nodes || [],
    edges: parsed.edges || [],
  };
}

/**
 * 공유 링크 URL 생성 (현재 배포 경로 기준).
 */
export function buildShareUrl(id: string): string {
  return `${window.location.origin}${window.location.pathname}?share=${id}`;
}

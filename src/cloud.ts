// ───────────────────────────────────────────────────────────────────────────
// 클라우드 공유 (Firebase Firestore)
//
// 구성도 전체(nodes / edges / lineTypes / equipmentDB)를 Firestore 문서 하나에
// 저장하고, 그 문서 ID를 공유 링크(?share=<id>)로 만들어 어떤 브라우저·기기에서도
// 같은 구성도를 열 수 있게 한다.
//
// firebase SDK는 동적 import 하여, 공유 기능을 쓰지 않는 경우 초기 번들에
// 포함되지 않도록 한다.
// ───────────────────────────────────────────────────────────────────────────
import type { Edge, Node } from '@xyflow/react';
import type { Equipment, LineType } from './store';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

export interface SharedDiagram {
  nodes: Node[];
  edges: Edge[];
  lineTypes: LineType[];
  equipmentDB: Equipment[];
}

// Firestore 단일 문서 한도는 1 MiB. 여유를 두고 900 KB 에서 경고한다.
const MAX_DOC_BYTES = 900 * 1024;

// 동적 import + 싱글턴 캐시
let _dbPromise: Promise<import('firebase/firestore').Firestore> | null = null;

async function getDb() {
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
 * @param name 선택적 구성도 이름 (목록/식별용)
 */
export async function saveSharedDiagram(
  state: SharedDiagram,
  name?: string
): Promise<string> {
  const payload: SharedDiagram = {
    nodes: state.nodes,
    edges: state.edges,
    lineTypes: state.lineTypes,
    equipmentDB: state.equipmentDB,
  };

  const json = JSON.stringify(payload);
  const bytes = new Blob([json]).size;
  if (bytes > MAX_DOC_BYTES) {
    const mb = (bytes / 1024 / 1024).toFixed(2);
    throw new Error(
      `구성도 용량이 너무 큽니다 (${mb} MB). 업로드한 큰 이미지를 줄이거나 제거한 뒤 다시 시도하세요. ` +
        `(클라우드 공유 한도 약 0.9 MB — 대형 프로젝트는 JSON 내보내기를 사용하세요.)`
    );
  }

  const db = await getDb();
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const ref = await addDoc(collection(db, 'diagrams'), {
    version: '1.1',
    name: name || '',
    nodes: payload.nodes,
    edges: payload.edges,
    lineTypes: payload.lineTypes,
    equipmentDB: payload.equipmentDB,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * 공유 문서 ID로 구성도를 불러온다. 없으면 null.
 */
export async function loadSharedDiagram(id: string): Promise<SharedDiagram | null> {
  const db = await getDb();
  const { doc, getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'diagrams', id));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<SharedDiagram>;
  return {
    nodes: data.nodes || [],
    edges: data.edges || [],
    lineTypes: data.lineTypes || [],
    equipmentDB: data.equipmentDB || [],
  };
}

/**
 * 공유 링크 URL 생성 (현재 배포 경로 기준).
 */
export function buildShareUrl(id: string): string {
  return `${window.location.origin}${window.location.pathname}?share=${id}`;
}

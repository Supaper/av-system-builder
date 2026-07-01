// ───────────────────────────────────────────────────────────────────────────
// 팀 공용 라이브러리 실시간 동기화 (Firebase Firestore)
//
// 장비 DB · 라인 타입 · 프리셋을 클라우드에 두고, 로그인 없이 모든 기기에서
// 공통으로 보이게 한다. onSnapshot 으로 원격 변경을 실시간 반영하고,
// 로컬 변경은 클라우드로 push 한다.
//
//   workspace/library  : { equipmentDB, lineTypes }  (JSON 문자열 필드)
//   presets/{presetId} : 프리셋 1개당 문서 1개        (JSON 문자열 필드)
//
// 단일 팀 공용 방식 — 로그인/권한 없이 누구나 읽고 쓴다. 동시 편집 시
// 마지막 저장이 이김(last-write-wins). 완전한 동시 편집은 Backlog "실시간 협업".
// ───────────────────────────────────────────────────────────────────────────
import { useStore } from './store';
import type { DiagramPreset } from './store';
import { isFirebaseConfigured } from './firebaseConfig';
import { getFirestoreDb, byteSize, MAX_DOC_BYTES } from './cloud';

export type SyncStatus = 'off' | 'connecting' | 'synced' | 'error';

let started = false;
// 원격 스냅샷을 store 에 반영하는 동안 true — 이때 발생하는 store 변경은
// 다시 클라우드로 push 하지 않는다 (무한 루프 방지).
let applyingRemote = false;
let libraryPushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 실시간 동기화 시작. 앱 마운트 시 1회 호출한다 (중복 호출은 무시).
 */
export async function startLibrarySync(onStatus?: (s: SyncStatus) => void): Promise<void> {
  if (started || !isFirebaseConfigured) {
    onStatus?.(isFirebaseConfigured ? 'connecting' : 'off');
    return;
  }
  started = true;
  onStatus?.('connecting');

  try {
    const db = await getFirestoreDb();
    const { doc, collection, onSnapshot, deleteDoc } = await import('firebase/firestore');

    // ─── 장비 DB + 라인 타입 (workspace/library) ───────────────────────────
    const libRef = doc(db, 'workspace', 'library');
    let librarySeeded = false;

    onSnapshot(
      libRef,
      (snap) => {
        if (!snap.exists()) {
          // 클라우드가 비어 있으면 현재 로컬 값으로 최초 시드
          if (!librarySeeded) {
            librarySeeded = true;
            const { equipmentDB, lineTypes } = useStore.getState();
            void writeLibrary(equipmentDB, lineTypes, onStatus);
          }
          return;
        }
        librarySeeded = true;
        try {
          const raw = snap.data() as { equipmentDB?: string; lineTypes?: string };
          const equipmentDB = raw.equipmentDB ? JSON.parse(raw.equipmentDB) : [];
          const lineTypes = raw.lineTypes ? JSON.parse(raw.lineTypes) : [];
          applyingRemote = true;
          useStore.setState({ equipmentDB, lineTypes });
          applyingRemote = false;
          onStatus?.('synced');
        } catch (e) {
          applyingRemote = false;
          console.error('라이브러리 원격 반영 실패', e);
        }
      },
      (err) => {
        console.error('라이브러리 동기화 오류', err);
        onStatus?.('error');
      }
    );

    // ─── 프리셋 (presets 컬렉션) ────────────────────────────────────────────
    const presetsCol = collection(db, 'presets');
    let presetsSeeded = false;

    onSnapshot(
      presetsCol,
      (snap) => {
        if (snap.empty && !presetsSeeded) {
          // 클라우드에 프리셋이 없으면 현재 로컬 프리셋으로 최초 시드
          presetsSeeded = true;
          const { presets } = useStore.getState();
          presets.forEach((p) => void writePreset(p));
          return;
        }
        presetsSeeded = true;
        const remote: DiagramPreset[] = [];
        snap.forEach((d) => {
          try {
            const raw = d.data() as { json?: string };
            if (raw.json) remote.push(JSON.parse(raw.json) as DiagramPreset);
          } catch (e) {
            console.error('프리셋 파싱 실패', d.id, e);
          }
        });
        applyingRemote = true;
        useStore.setState({ presets: remote });
        applyingRemote = false;
      },
      (err) => console.error('프리셋 동기화 오류', err)
    );

    // ─── 로컬 변경 → 클라우드 push ─────────────────────────────────────────
    useStore.subscribe((state, prev) => {
      if (applyingRemote) return;

      if (state.equipmentDB !== prev.equipmentDB || state.lineTypes !== prev.lineTypes) {
        // 잦은 편집을 묶어서 저장 (디바운스)
        if (libraryPushTimer) clearTimeout(libraryPushTimer);
        libraryPushTimer = setTimeout(() => {
          void writeLibrary(state.equipmentDB, state.lineTypes, onStatus);
        }, 800);
      }

      if (state.presets !== prev.presets) {
        void syncPresets(prev.presets, state.presets, deleteDoc, doc, db);
      }
    });
  } catch (e) {
    console.error('동기화 시작 실패', e);
    onStatus?.('error');
    started = false;
  }
}

async function writeLibrary(
  equipmentDB: unknown,
  lineTypes: unknown,
  onStatus?: (s: SyncStatus) => void
): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');
    const payload = {
      equipmentDB: JSON.stringify(equipmentDB),
      lineTypes: JSON.stringify(lineTypes),
      updatedAt: Date.now(),
    };
    if (byteSize(payload.equipmentDB) > MAX_DOC_BYTES) {
      console.warn('공용 장비 DB 용량이 0.9MB를 초과하여 동기화를 건너뜁니다. 업로드 이미지를 줄이세요.');
      onStatus?.('error');
      return;
    }
    await setDoc(doc(db, 'workspace', 'library'), payload);
    onStatus?.('synced');
  } catch (e) {
    console.error('라이브러리 저장 실패', e);
    onStatus?.('error');
  }
}

async function writePreset(preset: DiagramPreset): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');
    const json = JSON.stringify(preset);
    if (byteSize(json) > MAX_DOC_BYTES) {
      console.warn(`프리셋 "${preset.name}" 용량이 0.9MB를 초과하여 동기화를 건너뜁니다.`);
      return;
    }
    await setDoc(doc(db, 'presets', preset.id), {
      id: preset.id,
      name: preset.name,
      json,
      updatedAt: preset.updatedAt || new Date().toISOString(),
    });
  } catch (e) {
    console.error('프리셋 저장 실패', e);
  }
}

// 로컬 프리셋 변경분만 골라 업서트/삭제
async function syncPresets(
  prev: DiagramPreset[],
  next: DiagramPreset[],
  deleteDoc: typeof import('firebase/firestore').deleteDoc,
  docFn: typeof import('firebase/firestore').doc,
  db: import('firebase/firestore').Firestore
): Promise<void> {
  try {
    const prevById = new Map(prev.map((p) => [p.id, p]));
    const nextIds = new Set(next.map((p) => p.id));

    // 신규 / 변경된 프리셋 업서트
    for (const p of next) {
      const old = prevById.get(p.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(p)) {
        await writePreset(p);
      }
    }
    // 삭제된 프리셋 제거
    for (const p of prev) {
      if (!nextIds.has(p.id)) {
        await deleteDoc(docFn(db, 'presets', p.id));
      }
    }
  } catch (e) {
    console.error('프리셋 동기화 실패', e);
  }
}

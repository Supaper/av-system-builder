// ───────────────────────────────────────────────────────────────────────────
// 팀 공용 라이브러리 실시간 동기화 (Firebase Firestore)
//
// 장비 · 라인 타입은 각각 1개 = 문서 1개로 정규화된 컬렉션에 저장한다.
// 항목 하나가 바뀌어도 그 문서 하나만 diff해서 쓰기 때문에, 배열 전체를
// 매번 직렬화해서 통째로 덮어쓰던 예전 방식보다 충돌 위험이 낮고 확장하기 쉽다.
//
//   equipment/{equipmentId} : 장비 1개 (category, name, model, ports, ...)
//   lineTypes/{lineTypeId}  : 라인 타입 1개 (name, color)
//   presets/{presetId}      : 프리셋 1개당 문서 1개 (JSON 문자열 필드)
//
// 단일 팀 공용 방식 — 로그인/권한 없이 누구나 읽고 쓴다. 동시 편집 시
// 마지막 저장이 이김(last-write-wins). 완전한 동시 편집은 Backlog "실시간 협업".
// ───────────────────────────────────────────────────────────────────────────
import { useStore } from './store';
import type { CableCatalogItem, DiagramPreset, Equipment, EquipmentOption, LineType } from './store';
import { isFirebaseConfigured } from './firebaseConfig';
import { getFirestoreDb, byteSize, MAX_DOC_BYTES } from './cloud';

export type SyncStatus = 'off' | 'connecting' | 'synced' | 'error';

let started = false;
// 원격 스냅샷을 store 에 반영하는 동안 true — 이때 발생하는 store 변경은
// 다시 클라우드로 push 하지 않는다 (무한 루프 방지).
let applyingRemote = false;

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

    // ─── 장비 (equipment 컬렉션) ────────────────────────────────────────────
    const equipmentCol = collection(db, 'equipment');
    let equipmentSeeded = false;

    onSnapshot(
      equipmentCol,
      (snap) => {
        if (snap.empty && !equipmentSeeded) {
          // 클라우드가 비어 있으면 현재 로컬 장비 DB로 최초 시드
          equipmentSeeded = true;
          const { equipmentDB } = useStore.getState();
          equipmentDB.forEach((eq) => void writeEquipmentItem(eq, onStatus));
          return;
        }
        equipmentSeeded = true;
        const remote: Equipment[] = [];
        snap.forEach((d) => remote.push({ id: d.id, ...(d.data() as object) } as Equipment));
        applyingRemote = true;
        useStore.setState({ equipmentDB: remote });
        applyingRemote = false;
        onStatus?.('synced');
      },
      (err) => {
        console.error('장비 DB 동기화 오류', err);
        onStatus?.('error');
      }
    );

    // ─── 라인 타입 (lineTypes 컬렉션) ───────────────────────────────────────
    const lineTypesCol = collection(db, 'lineTypes');
    let lineTypesSeeded = false;

    onSnapshot(
      lineTypesCol,
      (snap) => {
        if (snap.empty && !lineTypesSeeded) {
          lineTypesSeeded = true;
          const { lineTypes } = useStore.getState();
          lineTypes.forEach((lt) => void writeLineTypeItem(lt));
          return;
        }
        lineTypesSeeded = true;
        const remote: LineType[] = [];
        snap.forEach((d) => remote.push({ id: d.id, ...(d.data() as object) } as LineType));
        applyingRemote = true;
        useStore.setState({ lineTypes: remote });
        applyingRemote = false;
      },
      (err) => console.error('라인 타입 동기화 오류', err)
    );

    // ─── 장비 옵션 (equipmentOptions 컬렉션) ────────────────────────────────
    const equipmentOptionsCol = collection(db, 'equipmentOptions');
    let equipmentOptionsSeeded = false;

    onSnapshot(
      equipmentOptionsCol,
      (snap) => {
        if (snap.empty && !equipmentOptionsSeeded) {
          equipmentOptionsSeeded = true;
          const { equipmentOptions } = useStore.getState();
          equipmentOptions.forEach((opt) => void writeEquipmentOptionItem(opt));
          return;
        }
        equipmentOptionsSeeded = true;
        const remote: EquipmentOption[] = [];
        snap.forEach((d) => remote.push({ id: d.id, ...(d.data() as object) } as EquipmentOption));
        applyingRemote = true;
        useStore.setState({ equipmentOptions: remote });
        applyingRemote = false;
      },
      (err) => console.error('장비 옵션 동기화 오류', err)
    );

    // ─── 기성케이블 카탈로그 (cableCatalog 컬렉션) ───────────────────────────
    const cableCatalogCol = collection(db, 'cableCatalog');
    let cableCatalogSeeded = false;

    onSnapshot(
      cableCatalogCol,
      (snap) => {
        if (snap.empty && !cableCatalogSeeded) {
          cableCatalogSeeded = true;
          const { cableCatalog } = useStore.getState();
          cableCatalog.forEach((item) => void writeCableCatalogItem(item));
          return;
        }
        cableCatalogSeeded = true;
        const remote: CableCatalogItem[] = [];
        snap.forEach((d) => remote.push({ id: d.id, ...(d.data() as object) } as CableCatalogItem));
        applyingRemote = true;
        useStore.setState({ cableCatalog: remote });
        applyingRemote = false;
      },
      (err) => console.error('케이블 카탈로그 동기화 오류', err)
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

    // ─── 로컬 변경 → 클라우드 push (바뀐 항목만 diff해서 push) ───────────────
    useStore.subscribe((state, prev) => {
      if (applyingRemote) return;

      if (state.equipmentDB !== prev.equipmentDB) {
        void diffAndPushEquipment(prev.equipmentDB, state.equipmentDB, onStatus);
      }

      if (state.lineTypes !== prev.lineTypes) {
        void diffAndPushLineTypes(prev.lineTypes, state.lineTypes);
      }

      if (state.equipmentOptions !== prev.equipmentOptions) {
        void diffAndPushEquipmentOptions(prev.equipmentOptions, state.equipmentOptions);
      }

      if (state.cableCatalog !== prev.cableCatalog) {
        void diffAndPushCableCatalog(prev.cableCatalog, state.cableCatalog);
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

/**
 * Firestore setDoc은 값이 undefined인 필드를 거부한다 (편집 모달들이 빈 입력을
 * `manufacturer: undefined`처럼 저장하므로 그대로 쓰면 예외 → "동기화 오류").
 * JSON 왕복으로 undefined 프로퍼티를 제거한 페이로드를 만든다.
 */
function sanitizeForFirestore<T>(fields: T): { json: string; payload: Record<string, unknown> } {
  const json = JSON.stringify(fields);
  return { json, payload: JSON.parse(json) };
}

async function writeEquipmentItem(eq: Equipment, onStatus?: (s: SyncStatus) => void): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');
    const { id, ...fields } = eq;
    const { json, payload } = sanitizeForFirestore(fields);
    if (byteSize(json) > MAX_DOC_BYTES) {
      console.warn(`장비 "${eq.name}" 데이터가 0.9MB를 초과하여 동기화를 건너뜁니다. 업로드 이미지를 줄이세요.`);
      onStatus?.('error');
      return;
    }
    await setDoc(doc(db, 'equipment', id), payload);
    onStatus?.('synced');
  } catch (e) {
    console.error('장비 저장 실패', eq.id, e);
    onStatus?.('error');
  }
}

async function diffAndPushEquipment(
  prev: Equipment[],
  next: Equipment[],
  onStatus?: (s: SyncStatus) => void
): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, deleteDoc } = await import('firebase/firestore');
    const prevById = new Map(prev.map((e) => [e.id, e]));
    const nextIds = new Set(next.map((e) => e.id));

    for (const eq of next) {
      const old = prevById.get(eq.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(eq)) {
        await writeEquipmentItem(eq, onStatus);
      }
    }
    for (const eq of prev) {
      if (!nextIds.has(eq.id)) {
        await deleteDoc(doc(db, 'equipment', eq.id));
      }
    }
  } catch (e) {
    console.error('장비 DB 동기화 실패', e);
    onStatus?.('error');
  }
}

async function writeLineTypeItem(lt: LineType): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');
    const { id, ...fields } = lt;
    await setDoc(doc(db, 'lineTypes', id), sanitizeForFirestore(fields).payload);
  } catch (e) {
    console.error('라인 타입 저장 실패', lt.id, e);
  }
}

async function diffAndPushLineTypes(prev: LineType[], next: LineType[]): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, deleteDoc } = await import('firebase/firestore');
    const prevById = new Map(prev.map((l) => [l.id, l]));
    const nextIds = new Set(next.map((l) => l.id));

    for (const lt of next) {
      const old = prevById.get(lt.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(lt)) {
        await writeLineTypeItem(lt);
      }
    }
    for (const lt of prev) {
      if (!nextIds.has(lt.id)) {
        await deleteDoc(doc(db, 'lineTypes', lt.id));
      }
    }
  } catch (e) {
    console.error('라인 타입 동기화 실패', e);
  }
}

async function writeEquipmentOptionItem(opt: EquipmentOption): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');
    const { id, ...fields } = opt;
    await setDoc(doc(db, 'equipmentOptions', id), sanitizeForFirestore(fields).payload);
  } catch (e) {
    console.error('장비 옵션 저장 실패', opt.id, e);
  }
}

async function diffAndPushEquipmentOptions(prev: EquipmentOption[], next: EquipmentOption[]): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, deleteDoc } = await import('firebase/firestore');
    const prevById = new Map(prev.map((o) => [o.id, o]));
    const nextIds = new Set(next.map((o) => o.id));

    for (const opt of next) {
      const old = prevById.get(opt.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(opt)) {
        await writeEquipmentOptionItem(opt);
      }
    }
    for (const opt of prev) {
      if (!nextIds.has(opt.id)) {
        await deleteDoc(doc(db, 'equipmentOptions', opt.id));
      }
    }
  } catch (e) {
    console.error('장비 옵션 동기화 실패', e);
  }
}

async function writeCableCatalogItem(item: CableCatalogItem): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');
    const { id, ...fields } = item;
    await setDoc(doc(db, 'cableCatalog', id), sanitizeForFirestore(fields).payload);
  } catch (e) {
    console.error('케이블 카탈로그 저장 실패', item.id, e);
  }
}

async function diffAndPushCableCatalog(prev: CableCatalogItem[], next: CableCatalogItem[]): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, deleteDoc } = await import('firebase/firestore');
    const prevById = new Map(prev.map((c) => [c.id, c]));
    const nextIds = new Set(next.map((c) => c.id));

    for (const item of next) {
      const old = prevById.get(item.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
        await writeCableCatalogItem(item);
      }
    }
    for (const item of prev) {
      if (!nextIds.has(item.id)) {
        await deleteDoc(doc(db, 'cableCatalog', item.id));
      }
    }
  } catch (e) {
    console.error('케이블 카탈로그 동기화 실패', e);
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

// ───────────────────────────────────────────────────────────────────────────
// Firestore 정규화 마이그레이션 (1회성 실행 스크립트)
//
// 기존 구조:
//   workspace/library  : { equipmentDB: "[...]", lineTypes: "[...]" } (JSON 문자열 blob)
//   presets/{id}        : { json: "{ nodes, edges, lineTypes, equipmentDB, ... }" }
//
// 새 구조:
//   equipment/{id}      : 장비 1개 = 문서 1개
//   lineTypes/{id}      : 라인 타입 1개 = 문서 1개
//   presets/{id}        : { json: "{ nodes, edges, ... }" } — equipmentDB/lineTypes 제거
//
// 배포 순서가 중요하다 (구코드/신코드가 잠깐 섞여 돌아가는 롤아웃 구간을 깨뜨리지 않기 위해):
//
//   1단계 --apply           : equipment/lineTypes 컬렉션만 새로 생성 (순수 추가, 기존 문서는 안 건드림)
//                             → 언제 실행해도 안전. 구코드는 이 컬렉션을 아예 안 읽으므로 영향 없음.
//                             → 이 단계까지 마친 뒤 새 코드를 배포한다.
//   2단계 --trim-presets    : presets 문서에서 legacy equipmentDB/lineTypes 필드 제거
//                             → 새 코드가 실제 배포되어 다들 새 코드를 쓰는 걸 확인한 뒤에만 실행.
//                             → 구코드가 남아있는 상태에서 실행하면 구코드의 loadPreset이
//                               preset.equipmentDB.filter(...) 에서 TypeError로 죽는다.
//   3단계 --delete-legacy   : workspace/library 문서 삭제 (되돌릴 수 없음)
//                             → 1~2단계, 새 코드 배포까지 전부 확인한 뒤 마지막에 한 번만.
//
// 플래그 없이 실행하면 dry-run(읽기 전용, 아무것도 쓰지 않음)이다.
//
// 실행 예:
//   node scripts/migrate-firestore-normalize.mjs                         # dry-run
//   node scripts/migrate-firestore-normalize.mjs --apply                 # 1단계
//   node scripts/migrate-firestore-normalize.mjs --apply --trim-presets  # 2단계 (1단계 이미 했어도 재실행 안전)
//   node scripts/migrate-firestore-normalize.mjs --apply --delete-legacy # 3단계
//
// ⚠️ 운영 중인 실제 Firestore 데이터(전 팀이 쓰는 공용 라이브러리)를 대상으로 한다.
// ───────────────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';

// src/firebaseConfig.ts 의 FIREBASE_CONFIG 값과 동일하게 유지할 것.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDVgyemxoaw5YSMflP_ay0EysLH7X07_Gs',
  authDomain: 'av-system-builder.firebaseapp.com',
  projectId: 'av-system-builder',
  storageBucket: 'av-system-builder.firebasestorage.app',
  messagingSenderId: '696689042225',
  appId: '1:696689042225:web:f3edfd19f5663af7150610',
};

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const TRIM_PRESETS = args.includes('--trim-presets');
const DELETE_LEGACY = args.includes('--delete-legacy');

function safeParseArray(json, label) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`[경고] ${label} 파싱 실패, 빈 배열로 처리:`, e.message);
    return [];
  }
}

async function main() {
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);

  console.log(APPLY ? '=== 실제 적용 모드 (--apply) ===' : '=== DRY RUN (읽기 전용, --apply 없이 실행됨) ===');

  // 1) workspace/library 읽기
  const libSnap = await getDoc(doc(db, 'workspace', 'library'));
  const libData = libSnap.exists() ? libSnap.data() : {};
  const equipmentById = new Map();
  const lineTypesById = new Map();

  safeParseArray(libData.equipmentDB, 'workspace/library.equipmentDB').forEach((eq) => {
    if (eq?.id) equipmentById.set(eq.id, eq);
  });
  safeParseArray(libData.lineTypes, 'workspace/library.lineTypes').forEach((lt) => {
    if (lt?.id) lineTypesById.set(lt.id, lt);
  });

  console.log(`workspace/library → 장비 ${equipmentById.size}개, 라인 타입 ${lineTypesById.size}개`);

  // 2) presets 컬렉션 읽기 + 워크스페이스에 없는 장비/라인타입 보충
  const presetsSnap = await getDocs(collection(db, 'presets'));
  const presetDocs = [];
  let recoveredEquipment = 0;
  let recoveredLineTypes = 0;

  presetsSnap.forEach((d) => {
    const raw = d.data();
    let parsed;
    try {
      parsed = raw.json ? JSON.parse(raw.json) : null;
    } catch (e) {
      console.error(`[경고] 프리셋 ${d.id} JSON 파싱 실패, 건너뜀:`, e.message);
      return;
    }
    if (!parsed) return;

    (parsed.equipmentDB || []).forEach((eq) => {
      if (eq?.id && !equipmentById.has(eq.id)) {
        equipmentById.set(eq.id, eq);
        recoveredEquipment++;
      }
    });
    (parsed.lineTypes || []).forEach((lt) => {
      if (lt?.id && !lineTypesById.has(lt.id)) {
        lineTypesById.set(lt.id, lt);
        recoveredLineTypes++;
      }
    });

    presetDocs.push({
      docId: d.id,
      id: parsed.id || d.id,
      name: parsed.name || raw.name || '',
      nodes: parsed.nodes || [],
      edges: parsed.edges || [],
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || raw.updatedAt || new Date().toISOString(),
    });
  });

  console.log(`presets 컬렉션 ${presetDocs.length}개 문서 확인`);
  console.log(`프리셋에서만 발견되어 복구된 장비 ${recoveredEquipment}개, 라인 타입 ${recoveredLineTypes}개`);
  console.log(`최종 장비 ${equipmentById.size}개 → equipment/{id} 로 이전 예정`);
  console.log(`최종 라인 타입 ${lineTypesById.size}개 → lineTypes/{id} 로 이전 예정`);

  if (!APPLY) {
    console.log('\ndry-run 완료. 1단계 반영하려면: node scripts/migrate-firestore-normalize.mjs --apply');
    return;
  }

  // 1단계: equipment/{id}, lineTypes/{id} 문서 기록 (순수 추가 — 기존 문서는 안 건드림)
  for (const [id, eq] of equipmentById) {
    const { id: _drop, ...fields } = eq;
    await setDoc(doc(db, 'equipment', id), fields);
  }
  console.log(`[1단계] 장비 ${equipmentById.size}개 기록 완료 → equipment 컬렉션`);

  for (const [id, lt] of lineTypesById) {
    const { id: _drop, ...fields } = lt;
    await setDoc(doc(db, 'lineTypes', id), fields);
  }
  console.log(`[1단계] 라인 타입 ${lineTypesById.size}개 기록 완료 → lineTypes 컬렉션`);

  if (!TRIM_PRESETS) {
    console.log('\n1단계 완료. 이 상태로 새 코드를 배포하고 정상 동작을 확인하세요.');
    console.log('모두가 새 코드로 넘어온 걸 확인한 뒤 2단계: --apply --trim-presets 를 실행하세요.');
    return;
  }

  // 2단계: presets 문서를 nodes/edges만 남기도록 재작성
  // ⚠️ 구코드가 아직 쓰이고 있다면 구코드의 loadPreset이 깨진다 — 새 코드 배포 확인 후에만 실행할 것.
  for (const p of presetDocs) {
    const trimmed = {
      id: p.id,
      name: p.name,
      nodes: p.nodes,
      edges: p.edges,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
    await setDoc(doc(db, 'presets', p.docId), {
      id: p.id,
      name: p.name,
      json: JSON.stringify(trimmed),
      updatedAt: p.updatedAt,
    });
  }
  console.log(`[2단계] 프리셋 ${presetDocs.length}개 재작성 완료 (equipmentDB/lineTypes 필드 제거)`);

  // 3단계: workspace/library 삭제는 --delete-legacy 를 함께 줬을 때만
  if (DELETE_LEGACY) {
    await deleteDoc(doc(db, 'workspace', 'library'));
    console.log('[3단계] workspace/library 문서 삭제 완료 (되돌릴 수 없음)');
  } else {
    console.log('\nworkspace/library 문서는 아직 삭제하지 않았습니다.');
    console.log('완전히 확인됐으면 마지막으로: node scripts/migrate-firestore-normalize.mjs --apply --trim-presets --delete-legacy');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('마이그레이션 실패:', e);
    process.exit(1);
  });

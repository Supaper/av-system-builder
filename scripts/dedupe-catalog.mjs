// ───────────────────────────────────────────────────────────────────────────
// Firestore 카탈로그 중복 제거 (equipment / equipmentOptions / cableCatalog)
//
// 배경: 레거시 마이그레이션(v1.10) 때 프리셋에서 복구된 장비 사본과 이후
// 시드가 겹치면서 같은 (name, model) 항목이 여러 개 생김 (예: "비디오 스위처
// VS5" 3개, 그중 1개는 포트 0개). 캔버스 노드는 자기완결적이라 카탈로그
// 문서 삭제가 기존 다이어그램에 영향을 주지 않는다.
//
// 중복 판정: name + model (공백 정리, 대소문자 무시)이 같으면 같은 장비.
// 유지 항목 선택(점수 높은 것 1개만 유지):
//   포트 수(가장 중요) > 이미지 > 제조사 > 설명 > 시리즈
//   동점이면 시드 id(eq-xlsx-*)를 우선(엑셀 원본이 정본), 그다음 id 사전순.
//
// 실행:
//   node scripts/dedupe-catalog.mjs           # dry-run (삭제 예정 목록만 출력)
//   node scripts/dedupe-catalog.mjs --apply   # 실제 삭제
//
// ⚠️ 운영 중인 팀 공용 Firestore를 수정한다. dry-run 검토 후에만 --apply.
// ───────────────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, setDoc, doc } from 'firebase/firestore';

// src/firebaseConfig.ts 의 FIREBASE_CONFIG 값과 동일하게 유지할 것.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDVgyemxoaw5YSMflP_ay0EysLH7X07_Gs',
  authDomain: 'av-system-builder.firebaseapp.com',
  projectId: 'av-system-builder',
  storageBucket: 'av-system-builder.firebasestorage.app',
  messagingSenderId: '696689042225',
  appId: '1:696689042225:web:f3edfd19f5663af7150610',
};

const APPLY = process.argv.includes('--apply');

const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

function equipmentScore(eq) {
  const ports = (eq.inputs?.length || 0) + (eq.outputs?.length || 0) + (eq.bidirectional?.length || 0);
  let score = ports * 1000;
  if (eq.imageUrl) score += 100;
  if (eq.manufacturer) score += 10;
  if (eq.description) score += 5;
  if (eq.series) score += 3;
  return score;
}

function optionScore(o) {
  const ports = (o.addPorts?.inputs?.length || 0) + (o.addPorts?.outputs?.length || 0) + (o.addPorts?.bidirectional?.length || 0);
  let score = ports * 1000;
  if (o.manufacturer) score += 10;
  if (o.description) score += 5;
  if (o.compatibleModels?.length || o.compatibleSeries?.length) score += 50;
  return score;
}

function cableScore(c) {
  let score = 0;
  if (c.manufacturer) score += 10;
  if (c.description) score += 5;
  if (c.lineTypeId) score += 3;
  return score;
}

/** 시드 id 우선 → id 사전순. sort comparator에서 "우선 유지"가 앞으로 오게 */
function tieBreak(a, b) {
  const aSeed = a.id.includes('xlsx') ? 0 : 1;
  const bSeed = b.id.includes('xlsx') ? 0 : 1;
  if (aSeed !== bSeed) return aSeed - bSeed;
  return a.id.localeCompare(b.id);
}

async function dedupeCollection(db, colName, keyFn, scoreFn, describeFn) {
  const snap = await getDocs(collection(db, colName));
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

  const groups = {};
  items.forEach((it) => {
    const key = keyFn(it);
    (groups[key] ??= []).push(it);
  });

  // 삭제 항목에만 있는 단순 필드(제조사·설명·시리즈·이미지 등)는 유지 항목으로 병합
  const MERGE_FIELDS = ['manufacturer', 'description', 'series', 'imageUrl', 'lineTypeId'];

  const toDelete = [];
  const toUpdate = []; // { id, fields }
  let dupGroups = 0;
  Object.entries(groups).forEach(([key, group]) => {
    if (group.length < 2) return;
    dupGroups++;
    group.sort((a, b) => (scoreFn(b) - scoreFn(a)) || tieBreak(a, b));
    const keep = group[0];
    const drop = group.slice(1);
    console.log(`\n[${colName}] "${key}" — ${group.length}개 중복:`);
    console.log(`  유지: ${keep.id}  (${describeFn(keep)})`);

    const merged = {};
    drop.forEach((d) => {
      console.log(`  삭제: ${d.id}  (${describeFn(d)})`);
      toDelete.push(d.id);
      MERGE_FIELDS.forEach((f) => {
        if (!keep[f] && d[f] && !merged[f]) merged[f] = d[f];
      });
    });
    if (Object.keys(merged).length > 0) {
      console.log(`  병합: ${keep.id} ← ${JSON.stringify(Object.keys(merged))}`);
      const { id, ...fields } = keep;
      toUpdate.push({ id, fields: { ...fields, ...merged } });
    }
  });

  console.log(`\n=== ${colName}: 총 ${items.length}개, 중복 그룹 ${dupGroups}개, 삭제 대상 ${toDelete.length}개, 필드 병합 ${toUpdate.length}개 ===`);

  if (APPLY) {
    for (const u of toUpdate) {
      await setDoc(doc(db, colName, u.id), u.fields);
    }
    for (const id of toDelete) {
      await deleteDoc(doc(db, colName, id));
    }
    if (toDelete.length > 0) console.log(`>>> ${colName}: ${toUpdate.length}개 병합, ${toDelete.length}개 삭제 완료`);
  }
  return toDelete.length;
}

async function main() {
  console.log(APPLY ? '=== 실제 적용 모드 (--apply) ===' : '=== DRY RUN (읽기 전용) ===');
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);

  const eqPorts = (eq) => (eq.inputs?.length || 0) + (eq.outputs?.length || 0) + (eq.bidirectional?.length || 0);

  const n1 = await dedupeCollection(
    db, 'equipment',
    (eq) => `${norm(eq.name)}|${norm(eq.model)}`,
    equipmentScore,
    (eq) => `포트 ${eqPorts(eq)}, ${eq.manufacturer || '제조사없음'}${eq.imageUrl ? ', 이미지' : ''}`
  );

  const n2 = await dedupeCollection(
    db, 'equipmentOptions',
    (o) => `${norm(o.name)}|${norm(o.model)}|${norm((o.compatibleModels || []).join(','))}|${norm((o.compatibleSeries || []).join(','))}`,
    optionScore,
    (o) => `포트 ${(o.addPorts?.inputs?.length || 0) + (o.addPorts?.outputs?.length || 0) + (o.addPorts?.bidirectional?.length || 0)}`
  );

  const n3 = await dedupeCollection(
    db, 'cableCatalog',
    (c) => `${norm(c.name)}|${norm(c.model)}`,
    cableScore,
    (c) => `${c.manufacturer || '제조사없음'}`
  );

  console.log(`\n총 삭제 ${APPLY ? '완료' : '예정'}: 장비 ${n1} + 옵션 ${n2} + 케이블 ${n3} = ${n1 + n2 + n3}개`);
  if (!APPLY) console.log('실제 반영: node scripts/dedupe-catalog.mjs --apply');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('실패:', e);
    process.exit(1);
  });

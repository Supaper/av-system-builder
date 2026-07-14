// ───────────────────────────────────────────────────────────────────────────
// 카탈로그 2차 정리 (2026-07-14 전수 점검 결과 반영)
//
// 사용자 수동 정리 이후 남은 항목들:
//   1. 장비 완전 중복 4건 병합·삭제 (NX-1200 / VDM-16X / GSM4230P / UVC-01)
//   2. 옵션 5쌍 병합 — 같은 액세서리가 호환 모델별로 분리 등재되어 있어
//      compatibleModels 배열을 합치고 1개 문서만 유지 (완전 중복 아님)
//   3. broadcast 분배기 5건 model↔description 필드 뒤바뀜 교정 (WJD 시리즈)
//   4. 표기 통일 — KVM 스위치→KVM, 오디오 DSP→DSP(+audio 이동),
//      broadcast 앰프→RF 앰프 (CATV 증폭기, 오디오 파워 앰프와 구분)
//   5. conferencing 단독 중분류 병합 — 화상회의 마이크→마이크,
//      무선 프레젠테이션 Pod/화상회의 앰프/G7500 리모컨/화상회의 컨트롤러→화상회의 장비
//   6. Logitech 연장/카메라 케이블 4건 → cableCatalog 이관
//
// 실행:
//   node scripts/cleanup-catalog-20260714.mjs           # dry-run
//   node scripts/cleanup-catalog-20260714.mjs --apply   # 실제 반영
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

// ── 1) 장비 중복: 유지 id ← 삭제 id (삭제 항목의 단순 필드는 유지 항목에 병합) ──
const EQUIP_DEDUPE = [
  { keep: 'c1',          drop: 'eq-xlsx-779', why: '컨트롤러 NX-1200 — c1이 포트 2개로 더 완전, 제조사(AMX)만 병합' },
  { keep: 'v4',          drop: 'eq-xlsx-478', why: '비디오 매트릭스 VDM-16X — v4가 포트 20개' },
  { keep: 'eq-xlsx-817', drop: 'n1',          why: '스위칭허브 GSM4230P — 실물이 24+2포트라 817 유지' },
  { keep: 'v3',          drop: 'eq-xlsx-566', why: 'UVC-01 — v3(캡쳐보드, 포트 2)가 더 완전' },
];
const MERGE_FIELDS = ['manufacturer', 'description', 'series', 'imageUrl'];

// ── 2) 옵션 병합: keep에 drop의 compatibleModels/Series를 합치고 drop 삭제 ──
// (설명·제조사 등 단순 필드는 keep에 없을 때만 drop에서 가져옴)
const OPTION_MERGES = [
  { keep: 'eqopt-xlsx-913', drop: 'eqopt-xlsx-1073', why: 'NEXT-PEG4806JT — UVC85-BYOD용 + XRN-3210RB2-30TB용 분리 등재' },
  { keep: 'eqopt-xlsx-686', drop: 'eqopt-xlsx-690',  why: 'CY-TF65BBCXKR — 55인치/65인치 호환 모델 분리 등재' },
  { keep: 'eqopt-xlsx-688', drop: 'eqopt-xlsx-691',  why: 'HA-AFN-STAND-BK — 55인치/65인치 호환 모델 분리 등재' },
  { keep: 'eqopt-xlsx-693', drop: 'eqopt-xlsx-695',  why: 'HA-AFN-S7585 — 75인치/85인치 호환 모델 분리 등재' },
  { keep: 'eqopt-xlsx-699', drop: 'eqopt-xlsx-701',  why: 'HA-WAD-S7565-BK — 75인치/86인치 호환 모델 분리 등재' },
];

// ── 3) model↔description 뒤바뀜 교정 (WJD 분배기: model="2분배기", desc="WJD-2DV") ──
const FIELD_SWAPS = ['eq-xlsx-750', 'eq-xlsx-751', 'eq-xlsx-752', 'eq-xlsx-753', 'eq-xlsx-754'];

// ── 4·5) name/category 변경 ──
const RENAMES = {
  // KVM 표기 통일 (전부 "KVM")
  'eq-xlsx-572': { name: 'KVM' },  // CW-SW41-KVM-MV
  'eq-xlsx-573': { name: 'KVM' },  // CM1284
  'eq-xlsx-575': { name: 'KVM' },  // CS1794
  // DSP 표기 통일 (전부 "DSP") — AP08은 오디오 프로세서라 audio로 이동
  'eq-xlsx-924': { name: 'DSP', category: 'audio' },  // Yealink AP08
  // broadcast 앰프 → RF 앰프 (CATV 신호증폭기 — 오디오 파워 앰프와 구분)
  'eq-xlsx-743': { name: 'RF 앰프' },  // BFA101
  'eq-xlsx-772': { name: 'RF 앰프' },  // KOA-2G
  // conferencing 단독 중분류 병합
  'eq-xlsx-902': { name: '마이크' },        // VCM36-W (화상회의 마이크 → 마이크 15개 그룹)
  'eq-xlsx-927': { name: '화상회의 장비' }, // WPP30 무선 프레젠테이션 Pod
  'eq-xlsx-945': { name: '화상회의 장비' }, // Studio E70 Display Clamp
  'eq-xlsx-951': { name: '화상회의 장비' }, // G7500 Bluetooth Remote
  'eq-xlsx-972': { name: '화상회의 장비' }, // TC8 터치 컨트롤러
};

// ── 6) cableCatalog 이관 (equipment 삭제 + cableCatalog 추가) ──
// Logitech 전용 케이블이라 기본 6종 lineType에 해당 없음 → lineTypeId 미지정
const CABLE_MOVES = {
  'eq-xlsx-884': { name: '마이크 연장 케이블' },  // Rally Mic Pod Extension Cable
  'eq-xlsx-893': { name: '화상회의 케이블' },     // Group 10M Cable
  'eq-xlsx-894': { name: '화상회의 케이블' },     // Group 15M Cable
  'eq-xlsx-897': { name: '마이크 연장 케이블' },  // Meetup Mic Pod Extension Cable
};

/** id 필드 제거한 나머지 (setDoc용) */
const strip = ({ id, ...fields }) => fields;

async function loadCol(db, name) {
  const snap = await getDocs(collection(db, name));
  const map = {};
  snap.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
  return map;
}

async function main() {
  console.log(APPLY ? '=== 실제 적용 모드 (--apply) ===' : '=== DRY RUN (읽기 전용) ===');
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);
  const eq = await loadCol(db, 'equipment');
  const opts = await loadCol(db, 'equipmentOptions');

  const eqUpdates = [];   // { id, fields, why }
  const eqDeletes = [];   // { id, why }
  const cableAdds = [];   // { id, fields }
  const optUpdates = [];  // { id, fields, why }
  const optDeletes = [];  // { id, why }

  // 1) 장비 중복 병합·삭제
  for (const { keep, drop, why } of EQUIP_DEDUPE) {
    const k = eq[keep], d = eq[drop];
    if (!k || !d) { console.log(`[skip] 중복 ${keep}/${drop} — ${!k ? keep : drop} 없음`); continue; }
    const merged = {};
    MERGE_FIELDS.forEach((f) => { if (!k[f] && d[f]) merged[f] = d[f]; });
    if (Object.keys(merged).length > 0) {
      eqUpdates.push({ id: keep, fields: { ...strip(k), ...merged }, why: `${why} / 병합: ${Object.keys(merged).join(',')}` });
    }
    eqDeletes.push({ id: drop, why });
  }

  // 2) 옵션 병합 — compatibleModels/Series 합집합 + 단순 필드 보충 후 drop 삭제
  for (const { keep, drop, why } of OPTION_MERGES) {
    const k = opts[keep], d = opts[drop];
    if (!k || !d) { console.log(`[skip] 옵션 ${keep}/${drop} — ${!k ? keep : drop} 없음`); continue; }
    const models = [...new Set([...(k.compatibleModels || []), ...(d.compatibleModels || [])])];
    const series = [...new Set([...(k.compatibleSeries || []), ...(d.compatibleSeries || [])])];
    const merged = { ...strip(k), compatibleModels: models };
    if (series.length > 0) merged.compatibleSeries = series;
    ['manufacturer', 'description'].forEach((f) => { if (!k[f] && d[f]) merged[f] = d[f]; });
    optUpdates.push({ id: keep, fields: merged, why: `${why} → compat ${JSON.stringify(models)}` });
    optDeletes.push({ id: drop, why });
  }

  // 3) model↔description 스왑
  for (const id of FIELD_SWAPS) {
    const it = eq[id];
    if (!it) { console.log(`[skip] ${id} 없음`); continue; }
    if (!/^WJD-/.test(it.description || '')) { console.log(`[skip] ${id} — description이 WJD 모델명이 아님 ("${it.description}"), 이미 교정된 듯`); continue; }
    eqUpdates.push({ id, fields: { ...strip(it), model: it.description, description: it.model }, why: `필드 교정: model "${it.model}"↔desc "${it.description}"` });
  }

  // 4·5) rename
  for (const [id, patch] of Object.entries(RENAMES)) {
    const it = eq[id];
    if (!it) { console.log(`[skip] ${id} 없음`); continue; }
    eqUpdates.push({ id, fields: { ...strip(it), ...patch }, why: `"${it.name}" → "${patch.name}"${patch.category ? ` (${it.category}→${patch.category})` : ''} | ${it.model || ''}` });
  }

  // 6) 케이블 이관
  for (const [id, over] of Object.entries(CABLE_MOVES)) {
    const it = eq[id];
    if (!it) { console.log(`[skip] ${id} 없음`); continue; }
    cableAdds.push({
      id: `cable-mig-${id}`,
      fields: {
        name: over.name,
        model: it.model || '',
        ...(it.manufacturer ? { manufacturer: it.manufacturer } : {}),
        ...(it.description ? { description: it.description } : {}),
      },
    });
    eqDeletes.push({ id, why: `cableCatalog 이관 (${over.name} | ${it.model})` });
  }

  console.log(`\n===== equipment 갱신 ${eqUpdates.length}건 =====`);
  eqUpdates.forEach((u) => console.log(`  ${u.id}: ${u.why}`));
  console.log(`\n===== equipment 삭제 ${eqDeletes.length}건 =====`);
  eqDeletes.forEach((d) => console.log(`  ${d.id}: ${d.why}`));
  console.log(`\n===== equipmentOptions 병합 ${optUpdates.length}건 =====`);
  optUpdates.forEach((u) => console.log(`  ${u.id}: ${u.why}`));
  console.log(`\n===== equipmentOptions 삭제 ${optDeletes.length}건 =====`);
  optDeletes.forEach((d) => console.log(`  ${d.id}: ${d.why}`));
  console.log(`\n===== cableCatalog 추가 ${cableAdds.length}건 =====`);
  cableAdds.forEach((c) => console.log(`  ${c.id}: ${c.fields.name} | ${c.fields.model}`));

  if (!APPLY) { console.log('\ndry-run 완료. 반영: node scripts/cleanup-catalog-20260714.mjs --apply'); return; }

  for (const u of eqUpdates) await setDoc(doc(db, 'equipment', u.id), u.fields);
  console.log(`>>> equipment ${eqUpdates.length}건 갱신 완료`);
  for (const c of cableAdds) await setDoc(doc(db, 'cableCatalog', c.id), c.fields);
  console.log(`>>> cableCatalog ${cableAdds.length}건 추가 완료`);
  for (const d of eqDeletes) await deleteDoc(doc(db, 'equipment', d.id));
  console.log(`>>> equipment ${eqDeletes.length}건 삭제 완료`);
  for (const u of optUpdates) await setDoc(doc(db, 'equipmentOptions', u.id), u.fields);
  console.log(`>>> equipmentOptions ${optUpdates.length}건 병합 완료`);
  for (const d of optDeletes) await deleteDoc(doc(db, 'equipmentOptions', d.id));
  console.log(`>>> equipmentOptions ${optDeletes.length}건 삭제 완료`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('실패:', e); process.exit(1); });

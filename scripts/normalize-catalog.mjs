// ───────────────────────────────────────────────────────────────────────────
// 카탈로그 중분류(name) 정규화 (2026-07-06 카테고리 단순화 결정 반영)
//
// 결정 사항:
//   1. 디스플레이: TV / LFD / LED / 비디오월 4종 + 프로젝터·스크린·전자칠판·
//      스탠드 유지. 사이즈·스펙은 name에서 빼서 model 단계로 내림
//   2. 익스텐더: "광 익스텐더 TX/RX", "UTP 익스텐더 TX/RX"로 분리 (1안).
//      세트/프레임형은 접미사 없는 "광 익스텐더"/"UTP 익스텐더"
//   3. 장비 DB 잔존 케이블 → cableCatalog 이관
//   4. 표기 불일치 통일 (DSP→오디오 DSP, AMP→파워 앰프 등)
//
// 판정 근거가 명확한 항목만 명시적 id 매핑으로 변경하고,
// 애매한 항목은 변경하지 않고 "수동 확인 필요" 리포트로 출력한다.
//
// 실행:
//   node scripts/normalize-catalog.mjs           # dry-run
//   node scripts/normalize-catalog.mjs --apply   # 실제 반영
// ───────────────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, setDoc, doc } from 'firebase/firestore';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDVgyemxoaw5YSMflP_ay0EysLH7X07_Gs',
  authDomain: 'av-system-builder.firebaseapp.com',
  projectId: 'av-system-builder',
  storageBucket: 'av-system-builder.firebasestorage.app',
  messagingSenderId: '696689042225',
  appId: '1:696689042225:web:f3edfd19f5663af7150610',
};

const APPLY = process.argv.includes('--apply');

// ── 1) name/category 변경 매핑 (id → 패치) ─────────────────────────────────
// 디스플레이: "삼성 NN인치 LFD" → LFD, 사이즈를 model 접두로 이동
const lfdIds = ['eq-xlsx-636','eq-xlsx-637','eq-xlsx-638','eq-xlsx-639','eq-xlsx-640','eq-xlsx-641','eq-xlsx-642','eq-xlsx-643','eq-xlsx-644','eq-xlsx-645','eq-xlsx-646','eq-xlsx-647','eq-xlsx-648','eq-xlsx-649','eq-xlsx-650'];
const videoWallIds = ['eq-xlsx-651','eq-xlsx-652','eq-xlsx-653','eq-xlsx-654','eq-xlsx-655','eq-xlsx-656'];

// 익스텐더 분류 (모델명 규칙: FT/OPT-TX/광송신 = 광 TX, FR/OPT-RX = 광 RX,
// CT-***-U = UTP TX, CR-***-U = UTP RX, CTR = UTP 양방향 등)
const RENAMES = {
  // ── 광 익스텐더 TX ──
  'eq-xlsx-513': { name: '광 익스텐더 TX' },  // XDM-FT101
  'eq-xlsx-515': { name: '광 익스텐더 TX' },  // FT101-U
  'eq-xlsx-517': { name: '광 익스텐더 TX' },  // OBHD-2C-TX
  'eq-xlsx-519': { name: '광 익스텐더 TX' },  // SPX-TX
  'eq-xlsx-522': { name: '광 익스텐더 TX' },  // SPX-TX-R6
  'eq-xlsx-524': { name: '광 익스텐더 TX' },  // EXT-HDMI20-OPT-TX
  'eq-xlsx-526': { name: '광 익스텐더 TX' },  // HDMI20-OPTJ-TX90
  'eq-xlsx-616': { name: '광 익스텐더 TX' },  // UX-FT101 (4K 광송신기)
  'eq-xlsx-577': { name: '광 익스텐더 TX' },  // KT-6031L (Local unit)
  // ── 광 익스텐더 RX ──
  'eq-xlsx-514': { name: '광 익스텐더 RX' },  // XDM-FR101
  'eq-xlsx-516': { name: '광 익스텐더 RX' },  // FR101-U
  'eq-xlsx-518': { name: '광 익스텐더 RX' },  // OBHD-2C-RX
  'eq-xlsx-520': { name: '광 익스텐더 RX' },  // SPX-RX
  'eq-xlsx-523': { name: '광 익스텐더 RX' },  // SPX-RX-R6
  'eq-xlsx-525': { name: '광 익스텐더 RX' },  // EXT-HDMI20-OPT-RX
  'eq-xlsx-527': { name: '광 익스텐더 RX' },  // HDMI20-OPTJ-RX90
  'eq-xlsx-617': { name: '광 익스텐더 RX' },  // UX-FR101
  'eq-xlsx-578': { name: '광 익스텐더 RX' },  // KT-6031R (Remote unit)
  // ── 광 익스텐더 (세트/일체형 — TX/RX 구분 없는 제품) ──
  'eq-xlsx-521': { name: '광 익스텐더' },     // SPX-R6 (프레임)
  'eq-xlsx-528': { name: '광 익스텐더' },     // Bridge UHD M_OTR (양방향)
  'eq-xlsx-530': { name: '광 익스텐더' },     // Bridge M_OTR
  'eq-xlsx-532': { name: '광 익스텐더' },     // FTDS (OM3/OM4 전용)
  'eq-xlsx-533': { name: '광 익스텐더' },     // FTHS
  'eq-xlsx-535': { name: '광 익스텐더' },     // OMP-HM-A100 (광케이블 일체형)
  // ── UTP 익스텐더 TX ──
  'eq-xlsx-543': { name: 'UTP 익스텐더 TX' }, // CT-101-U
  'eq-xlsx-545': { name: 'UTP 익스텐더 TX' }, // CT-104-U
  'eq-xlsx-542': { name: 'UTP 익스텐더 TX' }, // CT-103-UH (셀렉터 내장 TX)
  'eq-xlsx-540': { name: 'UTP 익스텐더 TX' }, // XDM-CT103 (벽부형)
  'eq-xlsx-549': { name: 'UTP 익스텐더 TX' }, // VE801-T (ATEN)
  'c6':          { name: 'UTP 익스텐더 TX' }, // CT-104-U TX (레거시 수작업 항목)
  // ── UTP 익스텐더 RX ──
  'eq-xlsx-544': { name: 'UTP 익스텐더 RX' }, // CR-101-U
  'eq-xlsx-546': { name: 'UTP 익스텐더 RX' }, // CR-104-U
  'eq-xlsx-547': { name: 'UTP 익스텐더 RX' }, // CR-102-U (스케일러 내장)
  'c7':          { name: 'UTP 익스텐더 RX' }, // CT-104-U RX (레거시)
  // ── UTP 익스텐더 (세트/양방향) ──
  'eq-xlsx-548': { name: 'UTP 익스텐더' },    // VE801 (TX+RX 세트)
  'eq-xlsx-538': { name: 'UTP 익스텐더' },    // XDM-CTR100 (양방향)
  'eq-xlsx-539': { name: 'UTP 익스텐더' },    // XDM-CTR100 PSE
  // ── KVM 익스텐더 (신호 기준 명명 유지) ──
  'c4': { name: 'KVM 익스텐더 TX' },          // CE824
  'c5': { name: 'KVM 익스텐더 RX' },          // CE824
  // ── KVM 스위치 정정 (원본 엑셀에서 "HDMI 케이블"로 오분류된 KVM 장비) ──
  'c3':          { name: 'KVM 스위치' },                          // CS1798 (표기 통일)
  'eq-xlsx-575': { name: 'KVM 스위치', category: 'control' },     // CS1794
  'eq-xlsx-573': { name: 'KVM 스위치', category: 'control' },     // CM1284
  'eq-xlsx-572': { name: 'KVM 스위치', category: 'control' },     // CW-SW41-KVM-MV
  // ── video → display 이동 (디스플레이류) ──
  'v7': { name: '비디오월', category: 'display' },                // LH55VHCRBGBXKR 2×4
  'v8': { name: '비디오월', category: 'display' },                // LH55VMTEBGBXKR 1×3
  'v9': { name: '모니터/디스플레이', category: 'display' },        // 24인치 모니터
  // ── 표기 통일 ──
  'a1': { name: '오디오 DSP' },       // DSP BLU-50v2
  'a2': { name: '오디오 DSP' },       // DSP BLU-101
  'a4': { name: '실링 스피커' },      // CEILING SPEAKER
  'a5': { name: '파워 앰프' },        // AMP
  'a6': { name: '무선 마이크' },      // 무선마이크
  'v1': { name: 'PTZ 카메라' },       // PTZ CAM
  'v4': { name: '매트릭스 스위처' },  // 비디오 매트릭스 VDM-16X
  'v5': { name: 'HDMI 분배기' },      // 2분배기
  'v6': { name: 'HDMI 분배기' },      // 4분배기
};

// 카테고리 단위 일괄 룰 (id 지정 없이 조건 매칭)
const BULK_RULES = [
  // 주의: video의 "스크린" 3건은 Ross 제어패널 오표기라 일괄 이동에서 제외 (REVIEW_NEEDED 참고)
  { match: it => it.category === 'video' && it.name === '모니터/디스플레이' && it.id !== 'eq-xlsx-445', patch: { category: 'display' }, why: 'video→display 이동' },
  { match: it => it.category === 'audio' && it.name === '앰프', patch: { name: '파워 앰프' }, why: '표기 통일' },
  { match: it => it.category === 'audio' && it.name === '무선마이크', patch: { name: '무선 마이크' }, why: '표기 통일' },
];

// ── 2) cableCatalog 이관 대상 (equipment 삭제 + cableCatalog 추가) ─────────
const CABLE_MOVES = {
  'eq-xlsx-204': 'network', // LAN 케이블 CAT.5e (Televic)
  'eq-xlsx-205': 'network',
  'eq-xlsx-531': { lineTypeId: 'audio', name: '오디오 케이블' }, // MEDUSA AUD (오디오 멀티케이블 — name "HDMI 케이블"은 오기)
  'eq-xlsx-601': 'sdi',     // Ultrix-Conv Cable 12
  'eq-xlsx-738': 'control', // RS-232 케이블
  'eq-xlsx-888': 'usb',
  'eq-xlsx-890': 'usb',
  'eq-xlsx-899': 'usb',
  'eq-xlsx-904': 'usb',
  'eq-xlsx-905': 'usb',
  'eq-xlsx-917': 'network', // LAN 7.5m (Yealink)
  'eq-xlsx-930': 'sdi',     // Micro BNC
  'eq-xlsx-937': 'usb',
  'eq-xlsx-938': 'video',   // HDMI/USB3.0 콤보 (Jabra)
};

// ── 3) 삭제 대상 (다른 항목과 중복 확인된 것) ──────────────────────────────
const DELETES = {
  'eq-xlsx-574': 'CS1798 — c3(KVM 스위치 CS1798)와 중복',
};

// ── 4) 자동 변경하지 않고 수동 확인이 필요한 항목 ──────────────────────────
const REVIEW_NEEDED = {
  'eq-xlsx-537': 'HEML-0034K6 — 익스텐더 매체(광/UTP) 불명',
  'eq-xlsx-555': 'V-JETn — 익스텐더 매체 불명',
  'eq-xlsx-550': 'A20 — 무선 프레젠테이션 송신기로 보임 (익스텐더 아님?)',
  'eq-xlsx-551': 'AC20 — 동일',
  'eq-xlsx-552': 'AC40 — 동일',
  'eq-xlsx-553': 'AD20 — 동일',
  'eq-xlsx-554': 'AD40 — 동일',
  'eq-xlsx-541': 'MR-4S — 4채널 프레임, 광/UTP 불명',
  'eq-xlsx-208': 'Plixus NEXT (Televic) — 회의시스템 전용 익스텐더, 분류 유지 여부',
  'eq-xlsx-804': 'GTX1650 (NVIDIA) — 그래픽카드인데 name이 "익스텐더"로 잘못된 듯',
  'eq-xlsx-762': 'KTX-6G — dB 스펙으로 보아 RF 증폭기인데 name이 "익스텐더"',
  'eq-xlsx-763': 'KTX-4 — 동일',
  'eq-xlsx-764': 'KTX-6 — 동일',
  'eq-xlsx-765': 'KTX-12 — 동일',
  'eq-xlsx-766': 'KRX-2R — 동일',
  'eq-xlsx-969': 'DBA SET (Poly) — 화상회의 액세서리, 익스텐더 여부 불명',
  'eq-xlsx-593': 'ULTRITOUCH-2 (Ross) — name이 "스크린"이지만 방송 제어 패널로 보임',
  'eq-xlsx-598': 'TD-TouchScreen (Ross) — 동일 (제어용 터치스크린)',
  'eq-xlsx-599': 'model 없는 "스크린" — 실체 불명',
  'eq-xlsx-445': 'Video Assist 5\" (Blackmagic) — 프로덕션 모니터/레코더, display 이동 부적절하여 video 유지',
  'eq-xlsx-586': 'VD12 — "HDMI 케이블"로 되어 있으나 실체 불명',
  'eq-xlsx-556': 'HEXA-01 — 동일',
};

async function main() {
  console.log(APPLY ? '=== 실제 적용 모드 (--apply) ===' : '=== DRY RUN (읽기 전용) ===');
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'equipment'));
  const items = {};
  snap.forEach((d) => { items[d.id] = { id: d.id, ...d.data() }; });

  const updates = []; // { id, fields }
  const cableAdds = []; // { id, fields }
  const deletes = []; // id

  // 디스플레이 사이즈 → model 이동
  lfdIds.forEach((id) => {
    const it = items[id];
    if (!it) return console.log(`[skip] ${id} 없음`);
    const m = it.name.match(/(\d+)인치/);
    const size = m ? `${m[1]}인치 / ` : '';
    updates.push({ id, fields: { ...strip(it), name: 'LFD', model: `${size}${it.model}` }, why: `"${it.name}" → LFD, 사이즈를 model로` });
  });
  videoWallIds.forEach((id) => {
    const it = items[id];
    if (!it) return console.log(`[skip] ${id} 없음`);
    const size = (it.name.match(/(\d+)인치/) || [])[1];
    const spec = (it.name.match(/\(([^)]+)\)/) || [])[1];
    const prefix = [size ? `${size}인치` : '', spec || ''].filter(Boolean).join(' ');
    updates.push({ id, fields: { ...strip(it), name: '비디오월', model: `${prefix ? prefix + ' / ' : ''}${it.model}` }, why: `"${it.name}" → 비디오월, 사이즈·스펙을 model로` });
  });

  // 명시적 rename
  Object.entries(RENAMES).forEach(([id, patch]) => {
    const it = items[id];
    if (!it) return console.log(`[skip] ${id} 없음`);
    updates.push({ id, fields: { ...strip(it), ...patch }, why: `"${it.name}" → "${patch.name || it.name}"${patch.category ? ` (${it.category}→${patch.category})` : ''}` });
  });

  // 일괄 룰
  Object.values(items).forEach((it) => {
    if (updates.some(u => u.id === it.id)) return;
    BULK_RULES.forEach((rule) => {
      if (rule.match(it)) {
        updates.push({ id: it.id, fields: { ...strip(it), ...rule.patch }, why: `${rule.why}: "${it.name}" (${it.model})` });
      }
    });
  });

  // 케이블 이관
  Object.entries(CABLE_MOVES).forEach(([id, spec]) => {
    const it = items[id];
    if (!it) return console.log(`[skip] ${id} 없음`);
    const lineTypeId = typeof spec === 'string' ? spec : spec.lineTypeId;
    const nameOverride = typeof spec === 'object' ? spec.name : undefined;
    cableAdds.push({
      id: `cable-mig-${id}`,
      fields: {
        name: nameOverride || it.name,
        model: it.model || '',
        ...(it.manufacturer ? { manufacturer: it.manufacturer } : {}),
        ...(it.description ? { description: it.description } : {}),
        lineTypeId,
      },
    });
    deletes.push(id);
  });

  // 중복 삭제
  Object.entries(DELETES).forEach(([id, why]) => {
    if (!items[id]) return console.log(`[skip] ${id} 없음`);
    deletes.push(id);
    console.log(`[삭제 예정] ${id} — ${why}`);
  });

  console.log(`\n===== name/category 변경 ${updates.length}건 =====`);
  updates.forEach(u => console.log(`  ${u.id}: ${u.why}`));
  console.log(`\n===== cableCatalog 이관 ${cableAdds.length}건 (equipment에서 삭제) =====`);
  cableAdds.forEach(c => console.log(`  ${c.id}: ${c.fields.name} | ${c.fields.model} → lineType=${c.fields.lineTypeId}`));
  console.log(`\n===== 수동 확인 필요 (변경 안 함) ${Object.keys(REVIEW_NEEDED).length}건 =====`);
  Object.entries(REVIEW_NEEDED).forEach(([id, why]) => {
    const it = items[id];
    console.log(`  ${id}: ${it ? `[${it.category}] ${it.name} | ${it.model}` : '(없음)'} — ${why}`);
  });

  if (!APPLY) {
    console.log('\ndry-run 완료. 반영: node scripts/normalize-catalog.mjs --apply');
    return;
  }

  for (const u of updates) await setDoc(doc(db, 'equipment', u.id), u.fields);
  console.log(`>>> equipment ${updates.length}건 갱신 완료`);
  for (const c of cableAdds) await setDoc(doc(db, 'cableCatalog', c.id), c.fields);
  console.log(`>>> cableCatalog ${cableAdds.length}건 추가 완료`);
  for (const id of deletes) await deleteDoc(doc(db, 'equipment', id));
  console.log(`>>> equipment ${deletes.length}건 삭제 완료`);
}

/** id 필드 제거한 나머지 필드 (setDoc용) */
function strip(it) {
  const { id, ...fields } = it;
  return fields;
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('실패:', e); process.exit(1); });

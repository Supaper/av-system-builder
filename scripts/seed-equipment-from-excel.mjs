// ───────────────────────────────────────────────────────────────────────────
// 엑셀 원본(av-system-builder-raw-data.xlsx) → 장비 DB / 장비 옵션 / 케이블 카탈로그
// Firestore 시드 스크립트 (1회성 실행)
//
// 매핑 규칙 상세는 EQUIPMENT_DB_SCHEMA.md 참고. 요약:
//   - "케이블 및 커넥터"/"케이블/광자재"/"케이블" 카테고리 → cableCatalog 컬렉션
//   - "전원, 랙, 판넬, 몰드 및 보양" 카테고리 → 완전 제외
//   - 구분="옵션" 행 → equipmentOptions 컬렉션 (상위 모델 텍스트로 compatibleModels/
//     compatibleSeries 판정. "XDM/SPX/VDM 시리즈"는 시리즈 단위로 호환)
//   - 구분="제품" 행 → equipment 컬렉션. 제품명="매트릭스 스위처"이고 모델명이
//     XDM-/SPX-M/VDM- 로 시작하면 series 태그 부여
//   - 포트 정보 컬럼은 자유 텍스트 → 정규식 기반 최선 추정 파싱 (실패 시 빈 배열)
//
// 실행 예:
//   node scripts/seed-equipment-from-excel.mjs               # dry-run (읽기 전용)
//   node scripts/seed-equipment-from-excel.mjs --apply        # 실제 Firestore 반영
//
// ⚠️ 운영 중인 실제 Firestore 데이터(전 팀이 쓰는 공용 라이브러리)에 문서를 추가한다.
// ───────────────────────────────────────────────────────────────────────────
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.join(__dirname, '..', 'av-system-builder-raw-data.xlsx');
const DUMP_DIR = path.join(__dirname, '..', '.seed-dump');

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

const CATEGORY_MAP = {
  '영상': 'video',
  '영상처리/스위칭': 'video',
  'CCTV': 'video',
  'TV': 'display',
  '프로젝터,스크린': 'display',
  '프로젝션': 'display',
  '디스플레이': 'display',
  '화상회의': 'conferencing',
  '오디오': 'audio',
  '음향처리': 'audio',
  '스피커': 'audio',
  '마이크': 'audio',
  '제어': 'control',
  'PC/주변기기': 'control',
  'CMS': 'control',
  '네트워크': 'network',
  'Head-End, CATV': 'broadcast',
  '기타': 'etc',
  '기타 유통제품': 'etc',
  'Cisco': 'etc',
};

const CABLE_CATEGORIES = new Set(['케이블 및 커넥터', '케이블/광자재', '케이블']);
const RACK_CATEGORY = '전원, 랙, 판넬, 몰드 및 보양';
const SERIES_LABELS = new Set(['XDM 시리즈', 'SPX 시리즈', 'VDM 시리즈']);

function mapCategory(raw) {
  const key = (raw || '').trim();
  return CATEGORY_MAP[key] || 'etc';
}

function defaultPortType(appCategory) {
  if (appCategory === 'audio') return 'audio';
  if (appCategory === 'control') return 'control';
  if (appCategory === 'video' || appCategory === 'display' || appCategory === 'conferencing' || appCategory === 'broadcast') return 'video';
  return 'network';
}

function detectSeries(productName, model) {
  if (productName !== '매트릭스 스위처') return undefined;
  if (model.startsWith('XDM-')) return 'XDM 시리즈';
  if (model.startsWith('SPX-M')) return 'SPX 시리즈';
  if (model.startsWith('VDM-')) return 'VDM 시리즈';
  return undefined;
}

/** 자유 텍스트 "포트 정보" 컬럼 → Port[] 최선 추정 파싱. 매칭 실패 시 빈 배열. */
function parsePortInfo(text, appCategory, idPrefix) {
  const inputs = [];
  const outputs = [];
  const bidirectional = [];
  if (!text) return { inputs, outputs, bidirectional };

  const upper = text.toUpperCase();
  const fallbackType = defaultPortType(appCategory);
  const guessType = () => {
    if (/AEC|AUDIO|DANTE|BLU\s*LINK/.test(upper)) return 'audio';
    if (/(LAN|POE|PORT)/.test(upper) && !/(HDMI|SDI)/.test(upper)) return 'network';
    if (/(HDMI|SDI|HDBT|VIDEO)/.test(upper)) return 'video';
    return fallbackType;
  };

  let idx = 0;
  const mk = (label, type, direction) => ({ id: `${idPrefix}-${direction}-${++idx}`, label, type, direction });

  const aecMatch = upper.match(/AEC\s*(\d+)\s*CH/);
  if (aecMatch) {
    const n = parseInt(aecMatch[1], 10);
    for (let i = 0; i < n; i++) bidirectional.push(mk(`AEC ${i + 1}`, 'audio', 'both'));
  }

  for (const m of upper.matchAll(/(\d+)\s*(?:IN\b|입력)/g)) {
    const n = parseInt(m[1], 10);
    const type = guessType();
    for (let i = 0; i < n; i++) inputs.push(mk(`In ${i + 1}`, type, 'in'));
  }

  for (const m of upper.matchAll(/(\d+)\s*(?:OUT\b|출력)/g)) {
    const n = parseInt(m[1], 10);
    const type = guessType();
    for (let i = 0; i < n; i++) outputs.push(mk(`Out ${i + 1}`, type, 'out'));
  }

  if (inputs.length === 0 && outputs.length === 0 && bidirectional.length === 0) {
    const portMatch = upper.match(/(\d+)\s*PORT/);
    if (portMatch) {
      const n = parseInt(portMatch[1], 10);
      for (let i = 0; i < n; i++) bidirectional.push(mk(`LAN ${i + 1}`, 'network', 'both'));
    }
  }

  return { inputs, outputs, bidirectional };
}

function cleanOrUndefined(v) {
  return v ? v : undefined;
}

function buildPorts(count, type, direction, idPrefix) {
  const ports = [];
  for (let i = 0; i < count; i++) {
    ports.push({ id: `${idPrefix}-${direction}-${i + 1}`, label: `${direction === 'in' ? 'In' : 'Out'} ${i + 1}`, type, direction });
  }
  return ports;
}

/**
 * 옵션(카드류)의 "포트 정보" 컬럼은 원본에 전부 비어있어(0/141) parsePortInfo가 무용하다.
 * 대신 모델명에 근거가 명확한 것만 최선 추정한다 (RTCOM XDM/SPX/VDM/UX 매트릭스 카드,
 * Dante 카드, SFP 트랜시버). 근거 없는 나머지(컨트롤러/렌즈/램프/브라켓/전원 등)는
 * 잘못된 스펙을 박아넣는 것보다 0포트로 남기는 편이 안전하므로 건드리지 않는다.
 */
function inferOptionPorts(productName, model, description, idPrefix) {
  const inputs = [];
  const outputs = [];
  const bidirectional = [];

  if (productName === '매트릭스 카드') {
    // Dante 카드: XDM-DANI-8 / XDM-DANO-8 — 이름에 채널수 명시됨
    let m = model.match(/DAN(I|O)-(\d+)/i);
    if (m) {
      const dir = m[1].toUpperCase() === 'I' ? 'in' : 'out';
      const n = parseInt(m[2], 10);
      const ports = buildPorts(n, 'audio', dir, idPrefix);
      (dir === 'in' ? inputs : outputs).push(...ports);
      return { inputs, outputs, bidirectional };
    }

    // 설명에 "포트 N개" 식으로 명시된 특수 케이스 (예: QOS4S-U 쿼드뷰 카드)
    const explicitMatch = description.match(/포트\s*(\d+)\s*개/);
    if (explicitMatch) {
      const n = parseInt(explicitMatch[1], 10);
      outputs.push(...buildPorts(n, 'video', 'out', idPrefix));
      return { inputs, outputs, bidirectional };
    }

    // 일반 커넥터 카드: [XDM-|SPX-|UX-|12G-][H|S|C|F|W|DP][I|O]S?-?(채널수)
    // H=HDMI, S=SDI, C=HDBaseT, F=광, DP=DisplayPort / I=입력, O=출력
    m = model.match(/^(?:XDM-|SPX-|UX-|12G-)?(H|S|C|F|W|DP)(I|O)S?-?(\d+)/i);
    if (m) {
      const dir = m[2].toUpperCase() === 'I' ? 'in' : 'out';
      let n = parseInt(m[3], 10);
      // XDM "100"번대는 채널수가 아니라 카드 모델(시리즈) 번호 — 1채널 카드로 취급
      if (n >= 90) n = 1;
      const ports = buildPorts(n, 'video', dir, idPrefix);
      (dir === 'in' ? inputs : outputs).push(...ports);
      return { inputs, outputs, bidirectional };
    }
  }

  // SFP 트랜시버 모듈 = 물리 네트워크 포트 1개
  if (model.toUpperCase().startsWith('SFP')) {
    bidirectional.push(...buildPorts(1, 'network', 'both', idPrefix));
  }

  return { inputs, outputs, bidirectional };
}

/** Firestore setDoc은 값이 undefined인 필드를 허용하지 않으므로 기록 직전에 제거한다. */
function stripUndefined(obj) {
  const result = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) result[k] = v;
  });
  return result;
}

function parseWorkbook() {
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length > 0) {
    console.log('감지된 헤더 컬럼:', Object.keys(rows[0]));
  }

  const equipmentList = [];
  const optionList = [];
  const cableList = [];
  let skippedRack = 0;
  let skippedEmpty = 0;
  let unmatchedOptionParents = 0;

  rows.forEach((row, i) => {
    const category = (row['카테고리'] || '').toString().trim();
    const productName = (row['제품명'] || '').toString().trim();
    const model = (row['모델명'] || '').toString().trim();
    const manufacturer = (row['제조사'] || '').toString().trim();
    const kind = (row['구분'] || '').toString().trim(); // 제품 / 옵션
    const description = (row['설명'] || '').toString().trim();
    const parentModel = (row['상위 모델'] || '').toString().trim();
    const portInfo = (row['포트 정보'] || '').toString().trim();

    if (!productName && !model) {
      skippedEmpty++;
      return;
    }
    if (category === RACK_CATEGORY) {
      skippedRack++;
      return;
    }
    if (CABLE_CATEGORIES.has(category)) {
      cableList.push({
        id: `cable-xlsx-${i}`,
        name: productName,
        model,
        manufacturer: cleanOrUndefined(manufacturer),
        description: cleanOrUndefined(description),
      });
      return;
    }

    const appCategory = mapCategory(category);

    if (kind === '옵션') {
      const ports = inferOptionPorts(productName, model, description, `xlsxopt-${i}`);
      const compatibleModels = [];
      const compatibleSeries = [];
      if (parentModel) {
        if (SERIES_LABELS.has(parentModel)) compatibleSeries.push(parentModel);
        else compatibleModels.push(parentModel);
      } else {
        unmatchedOptionParents++;
      }
      optionList.push({
        id: `eqopt-xlsx-${i}`,
        name: model || productName,
        model: cleanOrUndefined(model),
        manufacturer: cleanOrUndefined(manufacturer),
        description: cleanOrUndefined(description),
        compatibleModels: compatibleModels.length ? compatibleModels : undefined,
        compatibleSeries: compatibleSeries.length ? compatibleSeries : undefined,
        addPorts: ports,
      });
    } else {
      const ports = parsePortInfo(portInfo, appCategory, `xlsx-${i}`);
      equipmentList.push({
        id: `eq-xlsx-${i}`,
        category: appCategory,
        name: productName,
        model,
        manufacturer: cleanOrUndefined(manufacturer),
        description: cleanOrUndefined(description),
        series: detectSeries(productName, model),
        inputs: ports.inputs,
        outputs: ports.outputs,
        bidirectional: ports.bidirectional,
      });
    }
  });

  return { equipmentList, optionList, cableList, skippedRack, skippedEmpty, unmatchedOptionParents, totalRows: rows.length };
}

async function main() {
  const { equipmentList, optionList, cableList, skippedRack, skippedEmpty, unmatchedOptionParents, totalRows } = parseWorkbook();

  console.log(`\n총 ${totalRows}행 파싱`);
  console.log(`- 장비: ${equipmentList.length}개`);
  console.log(`- 옵션: ${optionList.length}개 (상위 모델 텍스트 없음: ${unmatchedOptionParents}개)`);
  console.log(`- 케이블 카탈로그: ${cableList.length}개`);
  console.log(`- 제외(전원/랙/판넬): ${skippedRack}개`);
  console.log(`- 제외(빈 행): ${skippedEmpty}개`);

  const catCounts = {};
  equipmentList.forEach(e => { catCounts[e.category] = (catCounts[e.category] || 0) + 1; });
  console.log('카테고리별 장비 수:', catCounts);

  const withPorts = equipmentList.filter(e => e.inputs.length + e.outputs.length + e.bidirectional.length > 0).length;
  console.log(`포트 정보가 파싱된 장비: ${withPorts}개 / ${equipmentList.length}개`);

  fs.mkdirSync(DUMP_DIR, { recursive: true });
  fs.writeFileSync(path.join(DUMP_DIR, 'equipment.json'), JSON.stringify(equipmentList, null, 2));
  fs.writeFileSync(path.join(DUMP_DIR, 'equipmentOptions.json'), JSON.stringify(optionList, null, 2));
  fs.writeFileSync(path.join(DUMP_DIR, 'cableCatalog.json'), JSON.stringify(cableList, null, 2));
  console.log(`\n검토용 JSON 덤프 저장 완료 → ${DUMP_DIR}`);

  if (!APPLY) {
    console.log('\ndry-run 완료. 결과를 검토한 뒤 실제 반영하려면: node scripts/seed-equipment-from-excel.mjs --apply');
    return;
  }

  console.log('\n=== Firestore 반영 시작 ===');
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);

  for (const eq of equipmentList) {
    const { id, ...fields } = eq;
    await setDoc(doc(db, 'equipment', id), stripUndefined(fields));
  }
  console.log(`장비 ${equipmentList.length}개 기록 완료 → equipment 컬렉션`);

  for (const opt of optionList) {
    const { id, ...fields } = opt;
    await setDoc(doc(db, 'equipmentOptions', id), stripUndefined(fields));
  }
  console.log(`옵션 ${optionList.length}개 기록 완료 → equipmentOptions 컬렉션`);

  for (const cable of cableList) {
    const { id, ...fields } = cable;
    await setDoc(doc(db, 'cableCatalog', id), stripUndefined(fields));
  }
  console.log(`케이블 카탈로그 ${cableList.length}개 기록 완료 → cableCatalog 컬렉션`);

  console.log('\n=== 완료 ===');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  });

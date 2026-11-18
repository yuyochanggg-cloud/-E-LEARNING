// 門市對練第二階段（方案 4）訓練子類抽籤 — 可公開驗算
//
// 規則（2026/11/09 事先公告，開獎前固定）：
//   - 4 對門市：三創體驗館–中壢中正店、新竹光復店–桃園復興店、台北光華店–高雄鳳山店、台中英才店–台北市民店
//   - 每對擲 2 次「硬幣」：
//       第 1 次決定誰練「商用滑鼠」（另一店練「無線網路（路由器＋Mesh）」）
//       第 2 次決定誰練「電競鍵盤」（另一店練「物聯網（攝影機）」）
//     每店因此練 2 類、另 2 類當對照；同一對門市互為對照。
//   - 種子：2026/11/10（二）今彩 539 開獎號碼（依開出順序，5 個號碼以逗號連接，例如 03,17,22,31,38）
//     承辦人無法事先得知、也無法挑選；開獎後任何人都可查證並重跑本程式得到相同結果。
//   - 每次擲硬幣 = SHA-256("方案4門市分派|2026Q4|" + 種子 + "|" + 配對名 + "|" + 第幾次) 第一個位元組的奇偶。
//     混入專案代碼與期別，避免外部號碼重複時抽出同樣結果。
//
// 用法：
//   node scripts/draw-store-assignment.mjs 03,17,22,31,38     → 抽籤
//   node scripts/draw-store-assignment.mjs --check            → 用 10,000 組假種子驗證公平性（不抽籤）
import { createHash } from 'node:crypto';

const PREFIX = '方案4門市分派|2026Q4|';
const PAIRS = [
  ['三創體驗館', '中壢中正店'],
  ['新竹光復店', '桃園復興店'],
  ['台北光華店', '高雄鳳山店'],
  ['台中英才店', '台北市民店']
];
const FLIPS = [
  ['商用滑鼠', '無線網路（路由器＋Mesh）'],
  ['電競鍵盤', '物聯網（攝影機）']
];

function flip(seed, pairName, n) {
  return createHash('sha256').update(`${PREFIX}${seed}|${pairName}|${n}`, 'utf8').digest()[0] % 2; // 0 或 1
}

function draw(seed) {
  const result = {};
  PAIRS.forEach(([s1, s2]) => {
    const pairName = `${s1}–${s2}`;
    result[s1] = []; result[s2] = [];
    FLIPS.forEach(([c1, c2], i) => {
      const heads = flip(seed, pairName, i + 1) === 0;
      result[s1].push(heads ? c1 : c2);
      result[s2].push(heads ? c2 : c1);
    });
  });
  return result;
}

// ------------------------------------------------------------
// 2026/11/09 研究計畫 §3.4 修訂：限制隨機分派（取代上面的 256 種獨立擲硬幣）
// 允許配置：每對互補；四對中恰兩對為「滑鼠＋鍵盤／無線＋攝影機」型態、兩對為「滑鼠＋攝影機／無線＋鍵盤」型態
//   → 四種組合各兩店，共 C(4,2)×2⁴＝96 種。依固定順序列舉，SHA-256 取模 96 抽一種。
//   node scripts/draw-store-assignment.mjs --restricted --now            正式分派（只跑一次）
//   node scripts/draw-store-assignment.mjs --restricted --seed <毫秒>    驗算
//   node scripts/draw-store-assignment.mjs --restricted --check          均勻性檢查
// ------------------------------------------------------------
const R_PREFIX = '方案4門市分派|2026Q4|限制隨機96|';
const [M, W] = FLIPS[0];
const [K, C] = FLIPS[1];

function allowedConfigs() {
  const list = [];
  for (let typeMask = 0; typeMask < 16; typeMask++) {
    if ([0, 1, 2, 3].filter(p => (typeMask >> p) & 1).length !== 2) continue; // 恰兩對為「滑鼠＋鍵盤」型態
    for (let dirMask = 0; dirMask < 16; dirMask++) {
      const cfg = {};
      PAIRS.forEach(([s1, s2], p) => {
        const same = (typeMask >> p) & 1;              // 1：滑鼠＋鍵盤／無線＋攝影機；0：滑鼠＋攝影機／無線＋鍵盤
        const a = same ? [M, K] : [M, C];
        const b = same ? [W, C] : [W, K];
        const firstGetsA = ((dirMask >> p) & 1) === 0;  // 甲店拿到含商用滑鼠的組合
        cfg[s1] = firstGetsA ? a : b;
        cfg[s2] = firstGetsA ? b : a;
      });
      list.push(cfg);
    }
  }
  return list;
}

function restrictedIndex(seed, n) {
  const h = createHash('sha256').update(R_PREFIX + seed, 'utf8').digest();
  return Number(h.readUIntBE(0, 6) % n);
}

if (process.argv[2] === '--restricted') {
  const configs = allowedConfigs();
  const mode = process.argv[3];
  if (configs.length !== 96) { console.error('允許配置數不是 96：' + configs.length); process.exit(1); }
  if (mode === '--check') {
    const N = 96000, hit = new Array(96).fill(0);
    for (let k = 0; k < N; k++) hit[restrictedIndex('測試種子' + k, 96)]++;
    const exp = N / 96, chi = hit.reduce((x, o) => x + (o - exp) ** 2 / exp, 0);
    console.log(`96 種配置各被抽中次數：最少 ${Math.min(...hit)}、最多 ${Math.max(...hit)}（期望 ${exp}）；卡方 ${chi.toFixed(1)}（自由度 95，5% 臨界值約 118.8）`);
    const combos = {};
    configs.forEach(c => Object.values(c).forEach(v => { const k = v.join('+'); combos[k] = (combos[k] || 0) + 1; }));
    console.log('每種配置裡四種組合各 2 店：', Object.values(combos).every(v => v === 192) ? '是' : '否');
    process.exit(chi < 118.8 ? 0 : 1);
  }
  let seed;
  if (mode === '--now') seed = String(Date.now());
  else if (mode === '--seed') seed = String(process.argv[4] || '');
  if (!seed) { console.error('用法：--restricted --now｜--seed <毫秒>｜--check'); process.exit(1); }
  const idx = restrictedIndex(seed, 96);
  const cfg = configs[idx];
  const when = /^\d{13}$/.test(seed) ? new Date(Number(seed)).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) + '.' + seed.slice(-3) : '';
  console.log(`限制隨機分派（96 種允許配置）｜種子＝${seed}${when ? `（台北時間 ${when}）` : ''}｜抽中第 ${idx + 1} 種\n`);
  console.log('門市\t練習類別1\t練習類別2');
  PAIRS.flat().forEach(s => console.log(`${s}\t${cfg[s][0]}\t${cfg[s][1]}`));
  process.exit(0);
}

const arg = process.argv[2];

if (arg === '--check') {
  const N = 10000;
  const count = {};
  for (let k = 0; k < N; k++) {
    const r = draw(`測試種子${k}`);
    Object.keys(r).forEach(s => r[s].forEach(c => { count[s + '|' + c] = (count[s + '|' + c] || 0) + 1; }));
  }
  const sd = Math.sqrt(N * 0.25);
  let ok = true;
  Object.keys(count).sort().forEach(k => {
    const z = (count[k] - N / 2) / sd;
    if (Math.abs(z) > 3) ok = false;
    console.log(`${k.padEnd(28)} ${count[k]}  (z=${z.toFixed(2)})`);
  });
  console.log(ok ? `\n✅ ${N} 次空跑：每店每類被抽中次數都在期望值 ±3 標準差內` : '\n❌ 有組合偏離超過 3 標準差');
  process.exit(ok ? 0 : 1);
}

// 2026/11/09 使用者決定：公司網路查不到今彩 539，改用「執行當下的系統時間（毫秒）」當種子，只執行一次。
//   node scripts/draw-store-assignment.mjs --now          → 以 Date.now() 為種子抽籤（正式抽籤用這個，只跑一次）
//   node scripts/draw-store-assignment.mjs --seed 1762654321234  → 用紀錄下來的毫秒數重跑驗算
let seed = arg;
let label = '今彩 539';
if (arg === '--now') { seed = String(Date.now()); label = '系統時間毫秒'; }
else if (arg === '--seed') { seed = String(process.argv[3] || ''); label = '系統時間毫秒（驗算）'; }
else if (!arg || !/^\d{2}(,\d{2}){4}$/.test(arg)) {
  console.error('用法：--now（以現在時間抽籤）／--seed <毫秒數>（驗算）／今彩539 五碼，例如 03,17,22,31,38');
  process.exit(1);
}
if (!seed) { console.error('缺少種子'); process.exit(1); }

const r = draw(seed);
const when = /^\d{13}$/.test(seed) ? new Date(Number(seed)).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) + '.' + seed.slice(-3) : '';
console.log(`種子（${label}）＝ ${seed}${when ? `（台北時間 ${when}）` : ''}\n`);
console.log('門市\t練習類別1\t練習類別2');
PAIRS.flat().forEach(s => console.log(`${s}\t${r[s][0]}\t${r[s][1]}`));

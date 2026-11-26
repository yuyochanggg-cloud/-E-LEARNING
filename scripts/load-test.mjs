// staging 壓力測試：模擬一群人「同時」操作門市對練。
// 用法：node scripts/load-test.mjs <憑證CSV> [輪次，逗號分隔：boot,status,gettest,submit,practice]
//   憑證 CSV 由 staging 的 stagingIssueLoadTestTokens 產生（欄位：工號,角色,部門,憑證），放在本機暫存區，不要 commit。
//   API 網址讀 .env.staging.local 的 VITE_GAS_API_URL；偵測到正式部署 ID 會直接停止。
// 每輪把所有帳號的請求在同一瞬間送出，記錄成功／失敗、耗時與錯誤訊息。
import { readFileSync } from 'node:fs';

const PROD_DEPLOYMENT = 'AKfycbxTcxKoZtdvwAFNmSW994zfQEbuPA8yGk3yLiy-H43iiWdSFBCWji1a_DmlLTwo-fssIg';
const env = readFileSync(new URL('../.env.staging.local', import.meta.url), 'utf8');
const URL_ = (env.match(/^VITE_GAS_API_URL=(.+)$/m) || [])[1]?.trim();
if (!URL_) throw new Error('.env.staging.local 沒有 VITE_GAS_API_URL');
if (URL_.includes(PROD_DEPLOYMENT)) throw new Error('這是正式環境的網址，停止。');

const [csvPath, roundsArg] = process.argv.slice(2);
if (!csvPath) throw new Error('請給憑證 CSV 路徑');
const users = readFileSync(csvPath, 'utf8').trim().split(/\r?\n/).slice(1)
  .map(l => l.split(',').map(s => s.replace(/^"|"$/g, '')))
  .map(([id, role, dept, token]) => ({ id, role, dept, token }))
  .filter(u => u.token && u.role !== 'admin');
const rounds = (roundsArg || 'boot,status,gettest,submit,practice').split(',');

// CLIENT=1：模擬網頁前端（src/utils/gasClient.js）的自動重送——等超過 25 秒或 HTTP 錯誤就重送一次，
// 回「排隊逾時」最多再送 2 次。不設時就是原始請求，用來看後端本身的極限。
const CLIENT_MODE = process.env.CLIENT === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function once(action, payload, timeoutMs) {
  const ctl = timeoutMs ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(URL_, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      signal: ctl ? ctl.signal : undefined
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error(`非 JSON 回應（HTTP ${res.status}）`); }
  } finally { if (timer) clearTimeout(timer); }
}

async function call(action, payload) {
  const t0 = Date.now();
  let stall = 0, retries = 0;
  for (let attempt = 0; attempt <= (CLIENT_MODE ? 2 : 0); attempt++) {
    let json;
    try {
      json = await once(action, payload, CLIENT_MODE ? 25000 : 0);
    } catch (e) {
      if (CLIENT_MODE && stall < 1) { stall++; retries++; attempt--; await sleep(500 + Math.random() * 1500); continue; }
      return { ms: Date.now() - t0, ok: false, msg: e.name === 'AbortError' ? '等超過 25 秒' : String(e.message).replace(/^fetch failed$/, '連線失敗'), retries };
    }
    if (CLIENT_MODE && json.status === 'error' && /lock|鎖定|逾時|timeout/i.test(json.message || '') && attempt < 2) {
      retries++; await sleep(800 * (attempt + 1) + Math.random() * 1000); continue;
    }
    return { ms: Date.now() - t0, ok: json.status === 'success', msg: json.message || '', data: json.data, retries };
  }
}

function report(name, results) {
  const ms = results.map(r => r.ms).sort((a, b) => a - b);
  const ok = results.filter(r => r.ok).length;
  const errs = {};
  results.filter(r => !r.ok).forEach(r => { errs[r.msg] = (errs[r.msg] || 0) + 1; });
  const p = q => ms[Math.min(ms.length - 1, Math.floor(q * ms.length))];
  console.log(`\n■ ${name}：${results.length} 人同時送出 → 成功 ${ok}、失敗 ${results.length - ok}`);
  console.log(`  耗時：最快 ${(ms[0] / 1000).toFixed(1)}s／中位 ${(p(0.5) / 1000).toFixed(1)}s／九成在 ${(p(0.9) / 1000).toFixed(1)}s 內／最慢 ${(ms[ms.length - 1] / 1000).toFixed(1)}s`);
  Object.entries(errs).forEach(([m, n]) => console.log(`  失敗原因：${m}（${n} 人）`));
  const retried = results.filter(r => r.retries > 0).length;
  if (CLIENT_MODE && retried) console.log(`  其中 ${retried} 人有自動重送`);
}

const all = (fn) => Promise.all(users.map(fn));
const tests = {};
console.log(`staging 壓測：${users.length} 個帳號（不含 admin）；輪次 ${rounds.join(' → ')}${CLIENT_MODE ? '；模擬前端自動重送' : '；原始請求、不重送'}`);

for (const r of rounds) {
  if (r === 'boot') report('登入後載入首頁（bootstrap）', await all(u => call('bootstrap', { userId: u.id, sessionToken: u.token })));
  if (r === 'status') report('進入對練頁（getExperimentStatus）', await all(u => call('getExperimentStatus', { userId: u.id, sessionToken: u.token })));
  if (r === 'gettest') {
    const res = await all(async u => { const x = await call('getTest', { userId: u.id, courseId: 'EXP-PRE', sessionToken: u.token }); tests[u.id] = x.data; return x; });
    report('打開前測（getTest）', res);
    const open = users.filter(u => tests[u.id] && !tests[u.id].submitted && tests[u.id].items);
    console.log(`  其中可作答（尚未交過）${open.length} 人、已交過 ${users.filter(u => tests[u.id]?.submitted).length} 人`);
  }
  if (r === 'submit') {
    // 還沒交的人交全部作答；已交過的人也送一次，用來確認會被擋下、不會重複寫入
    const res = await all(u => {
      const items = tests[u.id]?.items || [];
      const answers = Object.fromEntries(items.map(it => [it.id, 'A']));
      return call('submitTest', { userId: u.id, courseId: 'EXP-PRE', answers, sessionToken: u.token });
    });
    report('同時交前測（submitTest）', res);
  }
  if (r === 'practice') report('同時回報自主練習（submitPractice）', await all(u => call('submitPractice', {
    userId: u.id, kind: 'self', category: '商用滑鼠', productName: '壓測用品項', note: 'loadtest',
    requestId: `lt-${Date.now()}-${u.id}`, sessionToken: u.token
  })));
}

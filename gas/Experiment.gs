// ============================================================
// 良興雲端學院 — 門市銷售對練實驗（第二階段 方案 4）
// 2026/11/16 會議版：品項排程（每類 4 品項 × 每品項 2 次 = 16 次）、每日最多 2 品項
//
// 員工端全部集中在左側「門市對練」頁，下面這幾種課程類型不會出現在課程資源庫：
//   test         → 商品知識測驗。Courses.TestPhase 填 pre（前測）或 post（後測）。
//                  只能作答一次、不顯示分數與答案，每題寫入「實驗_作答紀錄」。
//                  前測卷別看「實驗_卷別分配」；後測自動換另一卷。
//                  後測開放：全部正式練習完成，或到了後測課的 OpenFrom，先到者為準（前測要先交）。
//                  後測課的 Badges＝完課勳章：交後測「且」16 次正式練習都完成才發（哪個後完成就在那時發）。
//   practice     → 正式練習。系統每天派最多 2 個品項（當天不重複、優先派次數少的、練滿 2 次就退出），
//                  員工練完按「我已完成」自陳。前測沒交不能練；只在實驗期間內可回報。
//   selfpractice → 自主練習。不限類別與品項（可練每月主推），員工填類別＋商品留紀錄；不占每日上限、不計入正式次數。
// Courses 其他欄位（選填）：VisibleTo 只給哪些門市看（逗號分隔）、OpenFrom 開放日期。
//
// 實驗用工作表（標題列文字要完全一致）：
//   實驗_設定       項目 | 值   （開始日期、總週數、每品項次數、每日上限）
//   實驗_門市分派   門市 | 練習類別1 | 練習類別2
//   實驗_品項       品項編號 | 類別 | 品項名稱 | 練習指引 | 練習網址 | 啟用
//   實驗_題目       題號 | 子類 | 卷別 | 題幹 | 選項A | 選項B | 選項C | 選項D | 答案 | 啟用
//   實驗_卷別分配   工號 | 前測卷別 | 姓名 | 門市
//   實驗_參與者     工號 | 姓名 | 門市 | 建立時間    （開課時的分組快照；之後調店不影響分組）
//   實驗_調整紀錄   工號 | 新門市 | 原因 | 原門市 | 處理時間 | 處理人
//   實驗_作答紀錄   作答時間 | 工號 | 姓名 | 門市 | 階段 | 卷別 | 題號 | 子類 | 作答 | 正解 | 是否答對
//   實驗_練習紀錄   回報時間 | 工號 | 姓名 | 門市 | 週次 | 類型 | 類別 | 品項編號 | 品項名稱 | 備註
// ============================================================

const EXP_SHEETS = {
  CONFIG:     '實驗_設定',
  ASSIGN:     '實驗_門市分派',
  PITEMS:     '實驗_品項',
  ITEMS:      '實驗_題目',
  FORMS:      '實驗_卷別分配',
  PEOPLE:     '實驗_參與者',
  ADJUST:     '實驗_調整紀錄',
  RESPONSES:  '實驗_作答紀錄',
  PRACTICE:   '實驗_練習紀錄'
};

const EXP_HEADERS = {
  [EXP_SHEETS.CONFIG]:    ['項目', '值'],
  [EXP_SHEETS.ASSIGN]:    ['門市', '練習類別1', '練習類別2'],
  [EXP_SHEETS.PITEMS]:    ['品項編號', '門市', '類別', '品項名稱', '良興代碼', '練習指引', '練習網址', '啟用'],
  [EXP_SHEETS.ITEMS]:     ['題號', '子類', '卷別', '題幹', '選項A', '選項B', '選項C', '選項D', '答案', '啟用'],
  [EXP_SHEETS.FORMS]:     ['工號', '前測卷別', '姓名', '門市'],
  [EXP_SHEETS.PEOPLE]:    ['工號', '姓名', '門市', '建立時間'],
  [EXP_SHEETS.ADJUST]:    ['工號', '新門市', '原因', '原門市', '處理時間', '處理人'],
  [EXP_SHEETS.RESPONSES]: ['作答時間', '工號', '姓名', '門市', '階段', '卷別', '題號', '子類', '作答', '正解', '是否答對'],
  [EXP_SHEETS.PRACTICE]:  ['回報時間', '工號', '姓名', '門市', '週次', '類型', '類別', '品項編號', '品項名稱', '備註']
};

const EXP_TYPES = ['test', 'practice', 'selfpractice'];

// ---------- 類別名稱（定案的分組與選品放在 gas/seed/FinalData.js，不進 GitHub） ----------
const EXP_CAT = { W: '無線網路（路由器＋Mesh）', K: '電競鍵盤', M: '商用滑鼠', C: '物聯網（攝影機）' };
// 自主練習輸入時的建議清單：從「實驗_品項」取不重複的品項名稱（不依賴程式內的資料）
function _expKnownProducts() {
  const { cols, rows } = _expRead(EXP_SHEETS.PITEMS);
  const seen = {}, out = [];
  for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i][cols['品項名稱']] || '').trim();
    if (!name || seen[name]) continue;
    seen[name] = true;
    out.push({ code: String(rows[i][cols['良興代碼']] || '').trim(), name, category: String(rows[i][cols['類別']] || '').trim() });
  }
  return out;
}

// 定案資料（gas/seed/FinalData.js）；沒有這個檔就回 null
function _expFinal() {
  return (typeof _expFinalData === 'function') ? _expFinalData() : null;
}

// 轉成「實驗_品項」的列：品項編號 | 門市 | 類別 | 品項名稱 | 良興代碼 | 練習指引 | 練習網址 | 啟用
// storeMap 可把正式門市名換成別的（staging 用測試門市）
function _expFinalItemRows(storeMap) {
  const rows = [];
  const fin = _expFinal();
  if (!fin) return rows;
  fin.items.forEach(([prefix, store, cats]) => {
    const s = storeMap ? storeMap[store] : store;
    if (!s) return;
    Object.keys(cats).forEach(k => cats[k].forEach(([code, name], i) => {
      rows.push([`${prefix}-${k}${i + 1}`, s, EXP_CAT[k], name, code, '', '', true]);
    }));
  });
  return rows;
}

// ---------- 日期：一律當成「台北的那一天 00:00」，不受試算表時區設定影響 ----------
function _taipeiDateOnly(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return new Date(Utilities.formatDate(d, tz, 'yyyy-MM-dd') + 'T00:00:00+08:00');
}

function _taipeiDayKey(d) {
  return Utilities.formatDate(new Date(d), 'Asia/Taipei', 'yyyy-MM-dd');
}

function _fmtDay(d) {
  return d ? Utilities.formatDate(new Date(d), 'Asia/Taipei', 'yyyy/MM/dd') : '';
}

// ---------- 課程可見性（Code.gs 也會用到） ----------

function _parseVisibleTo(v) {
  return String(v || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean);
}

function _isVisibleToDept(visibleTo, dept) {
  if (!visibleTo || visibleTo.length === 0) return true;
  return visibleTo.indexOf(String(dept || '').trim()) !== -1;
}

function _getUserInfo(userId) {
  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.USERS));
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols.UserId]).trim() !== String(userId).trim()) continue;
    return {
      userId: String(userId).trim(),
      name:   rows[i][cols.Name] || '',
      dept:   String(rows[i][cols.Department] || '').trim(),
      role:   String(rows[i][cols.Role] || '').toLowerCase()
    };
  }
  return null;
}

function _canSeeCourse(userId, courseId) {
  const course = _getCourseCatalog().find(c => c.id === String(courseId).trim());
  if (!course) return true; // 找不到課程交給呼叫端回「找不到課程」
  const user = _getUserInfo(userId);
  if (!user) return false;
  return user.role === 'admin' || _isVisibleToDept(course.visibleTo, user.dept);
}

// ---------- 實驗表讀取 ----------

// 讀實驗表：用原始中文標題對應欄位（不走 HEADER_ALIASES，避免「工號」被改名）
function _expRead(name) {
  const sheet = getSheet(name);
  if (!sheet) throw new Error('找不到工作表：' + name + '（請先執行 setupExperimentSheets）');
  const rows = _getDataRangeWithRetry(sheet);
  const cols = {};
  (rows[0] || []).forEach((h, i) => { if (h) cols[String(h).trim()] = i; });
  return { sheet, cols, rows };
}

function _expAppend(name, objs) {
  if (!objs.length) return;
  const { sheet, cols } = _expRead(name);
  const width = Math.max.apply(null, Object.keys(cols).map(k => cols[k])) + 1;
  const values = objs.map(o => {
    const row = new Array(width).fill('');
    Object.keys(o).forEach(k => { if (cols[k] !== undefined) row[cols[k]] = o[k]; });
    return row;
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, width).setValues(values);
}

function _expConfig() {
  const { cols, rows } = _expRead(EXP_SHEETS.CONFIG);
  const map = {};
  for (let i = 1; i < rows.length; i++) map[String(rows[i][cols['項目']]).trim()] = rows[i][cols['值']];
  const start = _taipeiDateOnly(map['開始日期']);
  const totalWeeks = Number(map['總週數']) || 8;
  const perItem = Number(map['每品項次數']) || 2;
  const dailyMax = Number(map['每日上限']) || 2;
  const perWeek = Number(map['每週次數']) || 2;
  const end = start ? new Date(start.getTime() + totalWeeks * 7 * 86400000) : null; // 不含當天
  const botUrl = String(map['練習網址'] || '').trim();
  return { start, end, totalWeeks, perItem, dailyMax, perWeek, botUrl };
}

function _expWeekNo(start, when) {
  if (!start) return 0;
  const days = Math.floor((when.getTime() - start.getTime()) / 86400000);
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}

function _expStoreCategories(store) {
  const { cols, rows } = _expRead(EXP_SHEETS.ASSIGN);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols['門市']]).trim() !== store) continue;
    return [rows[i][cols['練習類別1']], rows[i][cols['練習類別2']]].map(s => String(s || '').trim()).filter(Boolean);
  }
  return [];
}

// 參與者的實驗門市：有快照就用快照（開課後調店不改分組），沒有就用目前部門
function _expStoreOf(user) {
  const { cols, rows } = _expRead(EXP_SHEETS.PEOPLE);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols['工號']]).trim() === user.userId) return String(rows[i][cols['門市']] || '').trim();
  }
  return user.dept;
}

// 某門市的練習品項（每店各自 4 款／類）。「門市」欄空白＝該類所有門市共用。
// 品項沒填練習網址時，用「實驗_設定」的「練習網址」。
function _expPracticeItems(store, categories, cfg) {
  const { cols, rows } = _expRead(EXP_SHEETS.PITEMS);
  const fallbackUrl = (cfg && cfg.botUrl) || '';
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const cat = String(r[cols['類別']] || '').trim();
    const itemStore = cols['門市'] !== undefined ? String(r[cols['門市']] || '').trim() : '';
    const enabled = r[cols['啟用']];
    if (categories.indexOf(cat) === -1) continue;
    if (itemStore && itemStore !== store) continue;
    if (!(enabled === true || String(enabled).toUpperCase() === 'TRUE')) continue;
    const name = String(r[cols['品項名稱']] || '');
    out.push({
      id:       String(r[cols['品項編號']]).trim(),
      category: cat,
      name,
      guide:    String(r[cols['練習指引']] || '') || `打開下方 AI 對練，選「${name}」，扮演顧客完成一輪完整對話並拿到評分，再回來按「我已完成」。`,
      url:      String(r[cols['練習網址']] || '').trim() || fallbackUrl
    });
  }
  return out;
}

function _expTestSubmitted(userId, phase) {
  const { cols, rows } = _expRead(EXP_SHEETS.RESPONSES);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols['工號']]).trim() === userId && String(rows[i][cols['階段']]).trim() === phase) return true;
  }
  return false;
}

function _expPreForm(userId) {
  const { cols, rows } = _expRead(EXP_SHEETS.FORMS);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols['工號']]).trim() !== userId) continue;
    const f = String(rows[i][cols['前測卷別']] || '').trim().toUpperCase();
    return (f === 'A' || f === 'B') ? f : '';
  }
  return '';
}

function _expFormFor(userId, phase) {
  const pre = _expPreForm(userId);
  if (!pre) return '';
  return phase === 'pre' ? pre : (pre === 'A' ? 'B' : 'A');
}

function _expItems(form) {
  const { cols, rows } = _expRead(EXP_SHEETS.ITEMS);
  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cols['卷別']]).trim().toUpperCase() !== form) continue;
    const enabled = r[cols['啟用']];
    if (!(enabled === true || String(enabled).toUpperCase() === 'TRUE')) continue;
    items.push({
      id:       String(r[cols['題號']]).trim(),
      category: String(r[cols['子類']]).trim(),
      question: String(r[cols['題幹']]),
      options:  ['選項A', '選項B', '選項C', '選項D'].map(k => String(r[cols[k]] || '')),
      answer:   String(r[cols['答案']]).trim().toUpperCase()
    });
  }
  return items;
}

// 0～1 的固定亂數：同一人同一天同一品項永遠得到同一個值（當天派題才會穩定）
function _expHash01(s) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return (((b[0] & 255) << 16) | ((b[1] & 255) << 8) | (b[2] & 255)) / 16777216;
}

// 讀某人的練習紀錄 → [{ day:'yyyy-MM-dd', type:'正式'|'自主', id }]
function _expUserRecords(userId) {
  const p = _expRead(EXP_SHEETS.PRACTICE);
  const out = [];
  for (let i = 1; i < p.rows.length; i++) {
    const r = p.rows[i];
    if (String(r[p.cols['工號']]).trim() !== userId) continue;
    out.push({
      day:  _taipeiDayKey(r[p.cols['回報時間']]),
      type: String(r[p.cols['類型']]).trim(),
      id:   String(r[p.cols['品項編號']]).trim()
    });
  }
  return out;
}

// 練習狀態（純計算，不讀表；冒煙測試可直接餵假紀錄）。2026/11/17 定案規則：
//   1. 一款第 1 次練完，隔天起它的第 2 次一定出現在今天清單（直到練完）。
//   2. 清單空位才隨機補新的款，兩類盡量平均（先補已開款數較少的那類）。
//   3. 每天最多 dailyMax 次；每週 perWeek 次，練滿就關到下週一。
//   4. 上一週沒練滿的次數，只能在這一週補（再更早的不能補）。
// 「今天清單」以今天之前的紀錄決定，當天練完一款不會換題。
function _expComputeState(uid, records, items, cfg, now) {
  const today = _taipeiDayKey(now);
  const weekOf = day => _expWeekNo(cfg.start, new Date(day + 'T00:00:00+08:00'));
  const before = {}, todayDone = {}, firstDay = {}, weekCount = {};
  let selfTotal = 0, todayCount = 0;
  items.forEach(it => { before[it.id] = 0; });
  records.forEach(r => {
    if (r.type === '自主') { selfTotal++; return; }
    if (before[r.id] === undefined) return;
    const w = weekOf(r.day);
    weekCount[w] = (weekCount[w] || 0) + 1;
    if (!firstDay[r.id] || r.day < firstDay[r.id]) firstDay[r.id] = r.day;
    if (r.day === today) { todayDone[r.id] = true; todayCount++; }
    else before[r.id]++;
  });
  const count = {};
  items.forEach(it => { count[it.id] = before[it.id] + (todayDone[it.id] ? 1 : 0); });

  const weekNo = _expWeekNo(cfg.start, now);
  const lastWeekShort = weekNo > 1 ? Math.max(0, cfg.perWeek - (weekCount[weekNo - 1] || 0)) : 0;
  const weekQuota = weekNo >= 1 ? cfg.perWeek + lastWeekShort : 0;
  const weekDone = weekCount[weekNo] || 0;
  const weekRemaining = Math.max(0, weekQuota - weekDone);
  const slots = Math.max(0, Math.min(cfg.dailyMax, weekQuota - (weekDone - todayCount)));

  // 1. 隔天起必出現：之前練過 1 次、還沒練滿的款
  const pinned = items.filter(it => before[it.id] > 0 && before[it.id] < cfg.perItem).map(it => it.id);
  // 2. 空位補新款，兩類平均
  const picks = [];
  if (slots > pinned.length) {
    const started = {};
    items.forEach(it => { if (before[it.id] > 0) started[it.category] = (started[it.category] || 0) + 1; });
    const pool = items.filter(it => before[it.id] === 0)
      .map(it => ({ it, h: _expHash01(uid + '|' + today + '|' + it.id) }));
    while (pinned.length + picks.length < slots && pool.length) {
      pool.sort((a, b) => (started[a.it.category] || 0) - (started[b.it.category] || 0) || a.h - b.h);
      const x = pool.shift();
      picks.push(x.it.id);
      started[x.it.category] = (started[x.it.category] || 0) + 1;
    }
  }
  const todayList = slots > 0 ? pinned.concat(picks) : [];

  const missedWeeks = [];
  for (let w = 1; w < weekNo; w++) if ((weekCount[w] || 0) < cfg.perWeek) missedWeeks.push(w);

  const formalDone = items.reduce((s, it) => s + Math.min(count[it.id], cfg.perItem), 0);
  const formalTarget = items.length * cfg.perItem;
  return {
    count, selfTotal, todayList, todayDone, todayCount, firstDay, pinned,
    weekNo, weekQuota, weekDone, weekRemaining, lastWeekShort, missedWeeks,
    formalDone, formalTarget, allDone: items.length > 0 && formalDone >= formalTarget
  };
}

function _expPracticeState(user, items, cfg, now) {
  return _expComputeState(user.userId, _expUserRecords(user.userId), items, cfg, now);
}

// 使用者的實驗課程（依可見性）
function _expCourses(user) {
  const all = _getCourseCatalog().filter(c => EXP_TYPES.indexOf(c.materialType) !== -1);
  return user.role === 'admin' ? all : all.filter(c => _isVisibleToDept(c.visibleTo, user.dept));
}

// 一次算好頁面需要的全部東西
function _expContext(userId) {
  const user = _getUserInfo(userId);
  if (!user) return { error: '找不到使用者' };
  const cfg = _expConfig();
  const now = new Date();
  const store = _expStoreOf(user);
  const categories = store ? _expStoreCategories(store) : [];
  const items = _expPracticeItems(store, categories, cfg);
  const state = _expPracticeState(user, items, cfg, now);
  const courses = _expCourses(user);
  const pre  = courses.find(c => c.materialType === 'test' && c.testPhase === 'pre');
  const post = courses.find(c => c.materialType === 'test' && c.testPhase === 'post');
  const phase = !cfg.start || now < cfg.start ? 'notStarted' : (now >= cfg.end ? 'ended' : 'running');
  const pretestDone  = _expTestSubmitted(user.userId, 'pre');
  const posttestDone = _expTestSubmitted(user.userId, 'post');
  const postOpenFrom = post && post.openFrom ? post.openFrom : 0;
  const posttestOpen = !!post && pretestDone && (state.allDone || (postOpenFrom && now.getTime() >= postOpenFrom));
  // 常駐層：AI 門市對練＋自主練習紀錄（selfpractice 課；VisibleTo 決定誰看得到、OpenFrom 決定幾號開）
  const self = courses.find(c => c.materialType === 'selfpractice');
  const selfOpen = !!self && _expIsOpen(self, now);
  // 本期任務：有派品項、看得到前測、而且在檔期內；檔期結束後只留給「前測做了、後測還沒交」的人補交後測
  const eligible = !!store && categories.length > 0 && !!pre && _expIsOpen(pre, now);
  const hasTask = eligible && (phase === 'running' || (phase === 'ended' && pretestDone && !posttestDone));
  return { user, cfg, now, store, categories, items, state, courses, pre, post, phase, pretestDone, posttestDone, postOpenFrom, posttestOpen, self, selfOpen, hasTask };
}

function _expIsOpen(course, now) {
  return !course.openFrom || now.getTime() >= course.openFrom;
}

// 後測交了＋16 次都完成 → 後測課完課並發勳章（重複呼叫不會重複寫）
function _expMaybeComplete(ctx, sessionToken) {
  if (!ctx.post || !ctx.posttestDone || !ctx.state.allDone) return false;
  _completeCourseRecord(ctx.user.userId, ctx.post.id, ctx.post.badges || []);
  return true;
}

// ---------- API ----------

// 「門市對練」頁需要的全部狀態
function getExperimentStatus({ userId, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };
  const ctx = _expContext(userId);
  if (ctx.error) return { status: 'error', message: ctx.error };
  const { user, cfg, state, items } = ctx;

  // 常駐層：所有看得到 AI 門市對練的人都有
  const base = {
    hasTask: ctx.hasTask,
    selfOpen: ctx.selfOpen,
    selfOpenDate: ctx.self && ctx.self.openFrom ? _fmtDay(ctx.self.openFrom) : '',
    selfLocked: ctx.hasTask && !ctx.pretestDone, // 本期任務的前測做完前，先不開放自主練習（避免影響前測）
    selfTotal: state.selfTotal,
    selfCategories: _expSelfCategories(),
    knownProducts: _expKnownProducts().map(p => ({ name: p.name, category: p.category })),
    botUrl: cfg.botUrl
  };
  if (!ctx.hasTask) return { status: 'success', data: base };

  const view = it => ({
    id: it.id, name: it.name, category: it.category, guide: it.guide, url: it.url,
    count: state.count[it.id], doneToday: !!state.todayDone[it.id],
    firstDay: state.firstDay[it.id] ? state.firstDay[it.id].replace(/-/g, '/') : '',
    isSecond: state.pinned.indexOf(it.id) !== -1
  });
  return {
    status: 'success',
    data: Object.assign(base, {
      dept: user.dept,
      store: ctx.store,
      phase: ctx.phase,
      startDate: _fmtDay(cfg.start),
      endDate: cfg.end ? _fmtDay(new Date(cfg.end.getTime() - 86400000)) : '',
      weekNo: state.weekNo,
      perWeek: cfg.perWeek,
      weekQuota: state.weekQuota,
      weekDone: state.weekDone,
      weekRemaining: state.weekRemaining,
      lastWeekShort: state.lastWeekShort,
      nextWeekStart: cfg.start && state.weekNo >= 1 ? _fmtDay(new Date(cfg.start.getTime() + state.weekNo * 7 * 86400000)) : '',
      totalWeeks: cfg.totalWeeks,
      perItem: cfg.perItem,
      dailyMax: cfg.dailyMax,
      categories: ctx.categories,
      preCourseId:  ctx.pre ? ctx.pre.id : '',
      postCourseId: ctx.post ? ctx.post.id : '',
      selfCourse: !!ctx.courses.find(c => c.materialType === 'selfpractice'),
      pretestDone: ctx.pretestDone,
      posttestDone: ctx.posttestDone,
      posttestOpen: ctx.posttestOpen,
      posttestOpenDate: ctx.postOpenFrom ? _fmtDay(ctx.postOpenFrom) : '',
      formalDone: state.formalDone,
      formalTarget: state.formalTarget,
      allDone: state.allDone,
      completed: ctx.posttestDone && state.allDone,
      badges: ctx.post ? (ctx.post.badges || []) : [],
      today: ctx.phase === 'running' ? state.todayList.map(id => view(items.find(it => it.id === id))) : [],
      items: items.map(view)
    })
  };
}

function _expTestCourse(ctx, courseId) {
  const course = ctx.courses.find(c => c.id === String(courseId).trim());
  if (!course || course.materialType !== 'test') return { error: '找不到測驗' };
  if (!ctx.hasTask) return { error: '目前沒有進行中的本期任務' };
  if (course.testPhase === 'pre') return { course, phase: 'pre' };
  if (course.testPhase !== 'post') return { error: '測驗設定錯誤（TestPhase 要填 pre 或 post），請洽 HR' };
  if (!ctx.posttestOpen) {
    return { error: '完成全部正式練習後就能作答' + (ctx.postOpenFrom ? `；沒練完的話 ${_fmtDay(ctx.postOpenFrom)} 起也會開放` : '') };
  }
  return { course, phase: 'post' };
}

// 取得測驗題目（不含答案）。已交過就只回 submitted。
function getTest({ userId, courseId, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };
  const ctx = _expContext(userId);
  if (ctx.error) return { status: 'error', message: ctx.error };

  const t = _expTestCourse(ctx, courseId);
  if (t.error) return { status: 'error', message: t.error };
  const uid = ctx.user.userId;

  if (_expTestSubmitted(uid, t.phase)) return { status: 'success', data: { submitted: true } };

  const form = _expFormFor(uid, t.phase);
  if (!form) return { status: 'error', message: '你還沒有被分配卷別，請洽 HR' };
  const items = _expItems(form);
  if (items.length === 0) return { status: 'error', message: '題目尚未上架，請洽 HR' };

  return {
    status: 'success',
    data: { submitted: false, phase: t.phase, total: items.length, items: items.map(it => ({ id: it.id, question: it.question, options: it.options })) }
  };
}

// 交卷：只能一次；全部題目都要作答；不回傳分數與答案
function submitTest({ userId, courseId, answers, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };
  const ctx = _expContext(userId);
  if (ctx.error) return { status: 'error', message: ctx.error };

  const t = _expTestCourse(ctx, courseId);
  if (t.error) return { status: 'error', message: t.error };
  const uid = ctx.user.userId;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (_expTestSubmitted(uid, t.phase)) return { status: 'error', message: '你已經交過這份測驗了' };

    const form = _expFormFor(uid, t.phase);
    if (!form) return { status: 'error', message: '你還沒有被分配卷別，請洽 HR' };
    const items = _expItems(form);
    if (items.length === 0) return { status: 'error', message: '題目尚未上架，請洽 HR' };

    const ans = answers || {};
    const missing = items.filter(it => ['A', 'B', 'C', 'D'].indexOf(String(ans[it.id] || '').toUpperCase()) === -1);
    if (missing.length) return { status: 'error', message: `還有 ${missing.length} 題沒有作答` };

    const now = new Date();
    _expAppend(EXP_SHEETS.RESPONSES, items.map(it => {
      const a = String(ans[it.id]).toUpperCase();
      return {
        '作答時間': now, '工號': uid, '姓名': ctx.user.name, '門市': ctx.store, '階段': t.phase, '卷別': form,
        '題號': it.id, '子類': it.category, '作答': a, '正解': it.answer, '是否答對': a === it.answer
      };
    }));
  } finally {
    lock.releaseLock();
  }

  if (t.phase === 'pre') {
    _completeCourseRecord(uid, t.course.id, []);
  } else {
    ctx.posttestDone = true;
    _expMaybeComplete(ctx, sessionToken);
  }
  return getExperimentStatus({ userId, sessionToken });
}

// 自主練習可選的類別（不限本店兩類；2026/11/17 使用者決定：自主練習不設限、但要留紀錄）
const EXP_SELF_OTHER = '其他（每月主推等）';
function _expSelfCategories() { return [EXP_CAT.M, EXP_CAT.K, EXP_CAT.W, EXP_CAT.C, EXP_SELF_OTHER]; }

// 員工自陳完成一次練習。
//   kind=formal：正式，只能練今天派到的品項（itemId）
//   kind=self：自主，不限品項。填 category＋productName（自由輸入，可對到定案品項）；計入紀錄但不計正式次數
function submitPractice({ userId, itemId, kind, category, productName, note, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let ctx;
  try {
    ctx = _expContext(userId);
    if (ctx.error) return { status: 'error', message: ctx.error };
    let rec;
    if (kind === 'self') {
      if (!ctx.selfOpen) return { status: 'error', message: 'AI 門市對練目前沒有開放給你' };
      if (ctx.hasTask && !ctx.pretestDone) return { status: 'error', message: '請先完成本期任務的商品知識測驗，再開始自主練習' };
      const cat = String(category || '').trim();
      const name = String(productName || '').trim().slice(0, 80);
      if (_expSelfCategories().indexOf(cat) === -1) return { status: 'error', message: '請選擇練習的類別' };
      if (!name) return { status: 'error', message: '請填寫練習的商品' };
      const known = _expKnownProducts().find(p => p.name === name);
      rec = { '類型': '自主', '類別': cat, '品項編號': known ? known.code : '', '品項名稱': name };
    } else {
      if (!ctx.hasTask) return { status: 'error', message: '目前沒有進行中的本期任務' };
      if (!ctx.pretestDone) return { status: 'error', message: '請先完成商品知識測驗，才能開始練習' };
      const item = ctx.items.find(it => it.id === String(itemId || '').trim());
      if (!item) return { status: 'error', message: '這個品項不在你的正式練習範圍內' };
      if (ctx.phase === 'ended') return { status: 'error', message: '正式練習期間已結束' };
      if (ctx.state.todayList.indexOf(item.id) === -1) return { status: 'error', message: '這個品項不是今天的正式練習，請改用自主練習' };
      if (ctx.state.todayDone[item.id]) return { status: 'error', message: '這個品項今天已經回報過了' };
      if (ctx.state.weekRemaining <= 0) return { status: 'error', message: '本週正式練習已完成，下週一再開放' };
      if (ctx.state.todayCount >= ctx.cfg.dailyMax) return { status: 'error', message: '今天的正式練習已達上限' };
      rec = { '類型': '正式', '類別': item.category, '品項編號': item.id, '品項名稱': item.name };
    }

    _expAppend(EXP_SHEETS.PRACTICE, [Object.assign({
      // 週次只在檔期內記（檔期外的自主練習留空，分析時好區分）
      '回報時間': ctx.now, '工號': ctx.user.userId, '姓名': ctx.user.name, '門市': ctx.store || ctx.user.dept,
      '週次': ctx.phase === 'running' ? _expWeekNo(ctx.cfg.start, ctx.now) : '', '備註': String(note || '').slice(0, 200)
    }, rec)]);
  } finally {
    lock.releaseLock();
  }

  if (kind !== 'self') {
    const after = _expContext(userId);
    _expMaybeComplete(after, sessionToken);
  }
  return getExperimentStatus({ userId, sessionToken });
}

// ============================================================
// 維運工具（只能在 Apps Script 編輯器手動執行，沒有開放給網頁呼叫）
// ============================================================

// 正式／測試環境通用：建立缺少的實驗分頁、補 Courses 新欄位。可重跑；已有資料不動、不寫示範資料。
function setupExperimentSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const courses = ss.getSheetByName(SHEET_NAMES.COURSES);
  const head = courses.getRange(1, 1, 1, courses.getLastColumn()).getValues()[0].map(h => String(h).trim());
  ['VisibleTo', 'OpenFrom', 'TestPhase'].forEach(h => {
    if (head.indexOf(h) === -1) {
      courses.getRange(1, courses.getLastColumn() + 1).setValue(h).setFontWeight('bold');
      head.push(h);
    }
  });

  const created = [];
  Object.keys(EXP_HEADERS).forEach(name => {
    if (ss.getSheetByName(name)) return;
    const sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, EXP_HEADERS[name].length).setValues([EXP_HEADERS[name]]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    created.push(name);
  });

  const cfg = ss.getSheetByName(EXP_SHEETS.CONFIG);
  if (cfg.getLastRow() < 2) cfg.getRange(2, 1, 6, 2).setValues([['開始日期', '2026/11/30'], ['總週數', 8], ['每品項次數', 2], ['每日上限', 2], ['每週次數', 2], ['練習網址', '']]);

  // 定案的門市分派與選品：表是空的才寫入，已有資料不動
  const assign = ss.getSheetByName(EXP_SHEETS.ASSIGN);
  const fin = _expFinal();
  if (!fin) Logger.log('⚠️ 沒有 FinalData.js：「實驗_門市分派」「實驗_品項」請手動貼上（定案選品與教材對照 xlsx）');
  if (fin && assign.getLastRow() < 2) assign.getRange(2, 1, fin.assign.length, 3).setValues(fin.assign);
  const pitems = ss.getSheetByName(EXP_SHEETS.PITEMS);
  if (fin && pitems.getLastRow() < 2) {
    const rows = _expFinalItemRows();
    pitems.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  _invalidateCourseCache();
  Logger.log(created.length ? '✅ 已建立：' + created.join('、') : '✅ 實驗分頁都已存在，沒有變動');
}

// 開課時執行一次：把實驗門市「目前」的人寫進「實驗_參與者」當分組快照。
// 可重跑：已在名單裡的人不動（不會因為調店被改），只補新進人員。
function snapshotParticipants() {
  const stores = {};
  const a = _expRead(EXP_SHEETS.ASSIGN);
  for (let i = 1; i < a.rows.length; i++) {
    const s = String(a.rows[i][a.cols['門市']] || '').trim();
    if (s) stores[s] = 0;
  }
  const have = {};
  const p = _expRead(EXP_SHEETS.PEOPLE);
  for (let i = 1; i < p.rows.length; i++) have[String(p.rows[i][p.cols['工號']]).trim()] = true;

  const out = [];
  const now = new Date();
  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.USERS));
  for (let i = 1; i < rows.length; i++) {
    const uid = String(rows[i][cols.UserId] || '').trim();
    const dept = String(rows[i][cols.Department] || '').trim();
    if (!uid || stores[dept] === undefined || have[uid]) continue;
    out.push({ '工號': uid, '姓名': rows[i][cols.Name] || '', '門市': dept, '建立時間': now });
    stores[dept]++;
  }
  _expAppend(EXP_SHEETS.PEOPLE, out);
  Logger.log(`✅ 新增 ${out.length} 人：` + Object.keys(stores).map(s => `${s} ${stores[s]}`).join('、'));
}

// 調店／門市資料有誤：在「實驗_調整紀錄」填 工號、新門市、原因，然後執行這個。
// 會改「實驗_參與者」的門市，並在同一列補上原門市、處理時間、處理人（留下紀錄）。已處理的列不會重做。
function applyParticipantAdjustments() {
  const adj = _expRead(EXP_SHEETS.ADJUST);
  const ppl = _expRead(EXP_SHEETS.PEOPLE);
  const me = Session.getEffectiveUser().getEmail();
  let done = 0;
  for (let i = 1; i < adj.rows.length; i++) {
    const r = adj.rows[i];
    if (r[adj.cols['處理時間']]) continue;
    const uid = String(r[adj.cols['工號']] || '').trim();
    const to = String(r[adj.cols['新門市']] || '').trim();
    if (!uid || !to) continue;
    let row = -1;
    for (let j = 1; j < ppl.rows.length; j++) if (String(ppl.rows[j][ppl.cols['工號']]).trim() === uid) { row = j; break; }
    if (row === -1) { Logger.log(`⚠️ 第 ${i + 1} 列：${uid} 不在實驗_參與者，略過`); continue; }
    const from = String(ppl.rows[row][ppl.cols['門市']] || '').trim();
    ppl.sheet.getRange(row + 1, ppl.cols['門市'] + 1).setValue(to);
    ppl.rows[row][ppl.cols['門市']] = to;
    adj.sheet.getRange(i + 1, adj.cols['原門市'] + 1).setValue(from);
    adj.sheet.getRange(i + 1, adj.cols['處理時間'] + 1).setValue(new Date());
    adj.sheet.getRange(i + 1, adj.cols['處理人'] + 1).setValue(me);
    done++;
  }
  Logger.log(`✅ 已處理 ${done} 筆調整`);
}

// 題目檢查：改完「實驗_題目」後執行，只讀不寫。結果看執行記錄。
// 每類每卷應有幾題可在「實驗_設定」加「每類每卷題數」（預設 7）。
function checkTestItems() {
  const { rows } = _expRead(EXP_SHEETS.ITEMS);
  const cfg = _expRead(EXP_SHEETS.CONFIG);
  let perCat = 7;
  for (let i = 1; i < cfg.rows.length; i++) {
    if (String(cfg.rows[i][cfg.cols['項目']]).trim() === '每類每卷題數') perCat = Number(cfg.rows[i][cfg.cols['值']]) || 7;
  }
  const r = _expCheckItemRows(rows, perCat);
  Logger.log(r.problems.length ? '❌ 發現 ' + r.problems.length + ' 個問題：\n' + r.problems.join('\n') : '✅ 題目檢查通過');
  Logger.log(r.summary);
}

// 純檢查（不讀表，可單獨測試）。rows 含標題列；回傳 { problems:[...], summary }
function _expCheckItemRows(rows, perCat) {
  const need = EXP_HEADERS[EXP_SHEETS.ITEMS];
  const head = (rows[0] || []).map(h => String(h).trim());
  const missingHead = need.filter(h => head.indexOf(h) === -1);
  if (missingHead.length) return { problems: ['標題列缺少欄位：' + missingHead.join('、')], summary: '' };
  const c = {}; need.forEach(h => { c[h] = head.indexOf(h); });

  const cats = [EXP_CAT.M, EXP_CAT.K, EXP_CAT.W, EXP_CAT.C];
  const problems = [];
  const seen = {}, count = {};
  cats.forEach(k => { count[k] = { A: 0, B: 0 }; });
  let enabledRows = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(v => String(v).trim() === '')) continue;
    const rowNo = i + 1;
    const en = row[c['啟用']];
    const enabled = en === true || String(en).trim().toUpperCase() === 'TRUE';
    const enText = String(en).trim().toUpperCase();
    if (!enabled && enText !== 'FALSE' && en !== false) problems.push(`第 ${rowNo} 列：「啟用」要填 TRUE 或 FALSE（現在是「${en}」），系統會當成不啟用`);
    const id = String(row[c['題號']]).trim();
    if (!id) problems.push(`第 ${rowNo} 列：題號空白`);
    else if (seen[id]) problems.push(`第 ${rowNo} 列：題號「${id}」和第 ${seen[id]} 列重複`);
    else seen[id] = rowNo;
    if (!enabled) continue;
    enabledRows++;
    const cat = String(row[c['子類']]).trim();
    const form = String(row[c['卷別']]).trim().toUpperCase();
    if (cats.indexOf(cat) === -1) problems.push(`第 ${rowNo} 列（${id}）：子類「${cat}」不是四類之一（要完全一樣：${cats.join('／')}）`);
    if (form !== 'A' && form !== 'B') problems.push(`第 ${rowNo} 列（${id}）：卷別要填 A 或 B（現在是「${row[c['卷別']]}」）`);
    if (!String(row[c['題幹']]).trim()) problems.push(`第 ${rowNo} 列（${id}）：題幹空白`);
    const opts = ['選項A', '選項B', '選項C', '選項D'].map(k => String(row[c[k]]).trim());
    opts.forEach((o, j) => { if (!o) problems.push(`第 ${rowNo} 列（${id}）：選項${'ABCD'[j]}空白`); });
    const filled = opts.filter(Boolean);
    if (new Set(filled).size !== filled.length) problems.push(`第 ${rowNo} 列（${id}）：有兩個選項文字完全相同`);
    const ans = String(row[c['答案']]).trim().toUpperCase();
    if (['A', 'B', 'C', 'D'].indexOf(ans) === -1) problems.push(`第 ${rowNo} 列（${id}）：答案要填 A、B、C、D 其中一個（現在是「${row[c['答案']]}」）`);
    if (count[cat] && (form === 'A' || form === 'B')) count[cat][form]++;
  }
  cats.forEach(k => ['A', 'B'].forEach(f => {
    if (count[k][f] !== perCat) problems.push(`題數：${k} ${f} 卷有 ${count[k][f]} 題（應為 ${perCat} 題）`);
  }));
  const summary = `啟用 ${enabledRows} 題｜` + cats.map(k => `${k} A${count[k].A}／B${count[k].B}`).join('｜');
  return { problems, summary };
}

// A/B 卷分配：實驗門市裡「還沒分配」的人，在各門市內隨機分 A／B，讓每店兩卷人數盡量相等。
// 先執行 previewTestForms 看結果（只寫執行記錄），確認後執行 assignTestForms 寫入。已分配的人不會被改。
function previewTestForms() { _planTestForms(false); }
function assignTestForms()  { _planTestForms(true); }

function _planTestForms(write) {
  const stores = {};
  const a = _expRead(EXP_SHEETS.ASSIGN);
  for (let i = 1; i < a.rows.length; i++) {
    const s = String(a.rows[i][a.cols['門市']] || '').trim();
    if (s) stores[s] = { A: 0, B: 0, todo: [] };
  }

  const assigned = {};
  const f = _expRead(EXP_SHEETS.FORMS);
  for (let i = 1; i < f.rows.length; i++) {
    assigned[String(f.rows[i][f.cols['工號']]).trim()] = String(f.rows[i][f.cols['前測卷別']] || '').trim().toUpperCase();
  }

  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.USERS));
  for (let i = 1; i < rows.length; i++) {
    const uid  = String(rows[i][cols.UserId] || '').trim();
    const dept = String(rows[i][cols.Department] || '').trim();
    if (!uid || !stores[dept]) continue;
    const form = assigned[uid];
    if (form === 'A' || form === 'B') stores[dept][form]++;
    else stores[dept].todo.push({ uid, name: rows[i][cols.Name] || '' });
  }

  const out = [];
  Object.keys(stores).forEach(s => {
    const st = stores[s];
    const list = st.todo.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    list.forEach(p => {
      const form = st.A < st.B ? 'A' : st.B < st.A ? 'B' : (Math.random() < 0.5 ? 'A' : 'B');
      st[form]++;
      out.push({ '工號': p.uid, '前測卷別': form, '姓名': p.name, '門市': s });
    });
    Logger.log(`${s}：A ${st.A} 人、B ${st.B} 人（這次新分配 ${st.todo.length} 人）`);
  });

  if (!write) { Logger.log('（預覽，沒有寫入。確認人數後執行 assignTestForms）'); return; }
  _expAppend(EXP_SHEETS.FORMS, out);
  Logger.log(`✅ 已寫入 ${out.length} 人。每次執行都會重新抽，寫入結果可能和預覽的個別名單不同（各店人數一樣平衡）。`);
}

// 檢核彙總：重算「實驗_檢核」分頁（整頁重寫，只放計算結果，不要在這頁手動輸入）。
function refreshExperimentSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = _expConfig();
  const nowWeek = _expWeekNo(cfg.start, new Date());

  const storeCats = {};
  const a = _expRead(EXP_SHEETS.ASSIGN);
  for (let i = 1; i < a.rows.length; i++) {
    const s = String(a.rows[i][a.cols['門市']] || '').trim();
    if (s) storeCats[s] = [a.rows[i][a.cols['練習類別1']], a.rows[i][a.cols['練習類別2']]].map(x => String(x || '').trim());
  }
  const storeItems = {};
  Object.keys(storeCats).forEach(s => { storeItems[s] = _expPracticeItems(s, storeCats[s], cfg); });
  const itemsOf = s => storeItems[s] || [];

  // 名單：有快照用快照，沒有就用 Users 目前在實驗門市的人
  const people = {};
  const pp = _expRead(EXP_SHEETS.PEOPLE);
  for (let i = 1; i < pp.rows.length; i++) {
    const uid = String(pp.rows[i][pp.cols['工號']]).trim();
    const s = String(pp.rows[i][pp.cols['門市']] || '').trim();
    if (uid && storeCats[s]) people[uid] = { uid, name: pp.rows[i][pp.cols['姓名']] || '', dept: s };
  }
  if (!Object.keys(people).length) {
    const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.USERS));
    for (let i = 1; i < rows.length; i++) {
      const uid = String(rows[i][cols.UserId] || '').trim();
      const dept = String(rows[i][cols.Department] || '').trim();
      if (uid && storeCats[dept]) people[uid] = { uid, name: rows[i][cols.Name] || '', dept };
    }
  }
  Object.keys(people).forEach(k => Object.assign(people[k], { form: '', pre: false, post: false, cnt: {}, self: 0, selfCtrl: 0, week: 0, wk: {} }));

  const f = _expRead(EXP_SHEETS.FORMS);
  for (let i = 1; i < f.rows.length; i++) {
    const p = people[String(f.rows[i][f.cols['工號']]).trim()];
    if (p) p.form = String(f.rows[i][f.cols['前測卷別']] || '').trim();
  }
  const r = _expRead(EXP_SHEETS.RESPONSES);
  for (let i = 1; i < r.rows.length; i++) {
    const p = people[String(r.rows[i][r.cols['工號']]).trim()];
    if (!p) continue;
    const phase = String(r.rows[i][r.cols['階段']]).trim();
    if (phase === 'pre') p.pre = true;
    if (phase === 'post') p.post = true;
  }

  const weeks = Math.max(cfg.totalWeeks, nowWeek);
  const storeWeek = {};
  const pr = _expRead(EXP_SHEETS.PRACTICE);
  for (let i = 1; i < pr.rows.length; i++) {
    const p = people[String(pr.rows[i][pr.cols['工號']]).trim()];
    if (!p) continue;
    if (String(pr.rows[i][pr.cols['類型']]).trim() === '自主') {
      if (!(Number(pr.rows[i][pr.cols['週次']]) >= 1)) continue; // 檔期外的自主練習（週次空白）不算進本期統計
      p.self++;
      const sc = String(pr.rows[i][pr.cols['類別']]).trim();
      if (sc !== EXP_SELF_OTHER && storeCats[p.dept].indexOf(sc) === -1) p.selfCtrl++; // 練到本店的對照類
      continue;
    }
    const id = String(pr.rows[i][pr.cols['品項編號']]).trim();
    const wk = Number(pr.rows[i][pr.cols['週次']]) || 0;
    p.cnt[id] = (p.cnt[id] || 0) + 1;
    if (wk === nowWeek) p.week++;
    p.wk[wk] = (p.wk[wk] || 0) + 1;
    if (!storeWeek[p.dept]) storeWeek[p.dept] = new Array(weeks + 1).fill(0);
    if (wk >= 1 && wk <= weeks) storeWeek[p.dept][wk]++;
  }
  const done = p => itemsOf(p.dept).reduce((s, it) => s + Math.min(p.cnt[it.id] || 0, cfg.perItem), 0);
  const target = s => itemsOf(s).length * cfg.perItem;
  const missed = p => { const m = []; for (let w = 1; w < nowWeek; w++) if ((p.wk[w] || 0) < cfg.perWeek) m.push('第' + w + '週'); return m.join('、'); };

  const W = Math.max(weeks + 3, 13);
  const pad = row => { while (row.length < W) row.push(''); return row.slice(0, W); };
  const list = s => Object.keys(people).map(k => people[k]).filter(p => p.dept === s);
  const out = [];
  out.push(pad([`門市對練檢核（更新：${Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm')}；${_fmtDay(cfg.start)} 起共 ${cfg.totalWeeks} 週，目前第 ${nowWeek} 週；每品項 ${cfg.perItem} 次、每週 ${cfg.perWeek} 次（可補前一週）、每日最多 ${cfg.dailyMax} 次）`]));
  out.push(pad([]));
  out.push(pad(['一、各店完成狀況']));
  out.push(pad(['門市', '名冊人數', '已分配卷別', '前測已交', '前測完成率', '正式練習人均完成', '全部練完人數', '後測已交', '完課（後測＋練完）', '自主練習合計', '其中對照類']));
  Object.keys(storeCats).forEach(s => {
    const l = list(s);
    const pre = l.filter(p => p.pre).length;
    const avg = l.length ? Math.round(l.reduce((x, p) => x + done(p), 0) / l.length * 10) / 10 : '-';
    const full = l.filter(p => target(s) > 0 && done(p) >= target(s)).length;
    out.push(pad([s, l.length, l.filter(p => p.form).length, pre, l.length ? Math.round(pre / l.length * 100) + '%' : '-',
      `${avg} / ${target(s)}`, full, l.filter(p => p.post).length, l.filter(p => p.post && target(s) > 0 && done(p) >= target(s)).length,
      l.reduce((x, p) => x + p.self, 0), l.reduce((x, p) => x + p.selfCtrl, 0)]));
  });
  out.push(pad([]));
  out.push(pad(['二、各店每週正式練習回報次數']));
  const wkHead = ['門市'];
  for (let w = 1; w <= weeks; w++) wkHead.push('第' + w + '週');
  out.push(pad(wkHead.concat(['合計'])));
  Object.keys(storeCats).forEach(s => {
    const arr = storeWeek[s] || new Array(weeks + 1).fill(0);
    out.push(pad([s].concat(arr.slice(1, weeks + 1)).concat([arr.reduce((x, y) => x + y, 0)])));
  });
  out.push(pad([]));
  out.push(pad([`三、個人明細（本週＝第 ${nowWeek} 週；「未完成品項」列出還沒練滿 ${cfg.perItem} 次的品項）`]));
  out.push(pad(['工號', '姓名', '門市', '卷別', '前測', '正式完成', '本週正式', '未完成品項', '後測', '完課', '自主練習', '其中對照類', `沒練滿 ${cfg.perWeek} 次的週`]));
  Object.keys(people).map(k => people[k]).sort((x, y) => (x.dept + x.uid).localeCompare(y.dept + y.uid)).forEach(p => {
    const lack = itemsOf(p.dept).filter(it => (p.cnt[it.id] || 0) < cfg.perItem).map(it => `${it.name}(${p.cnt[it.id] || 0})`);
    const full = target(p.dept) > 0 && done(p) >= target(p.dept);
    out.push(pad([p.uid, p.name, p.dept, p.form || '未分配', p.pre ? '已交' : '未交', `${done(p)} / ${target(p.dept)}`,
      p.week, lack.join('、'), p.post ? '已交' : '未交', p.post && full ? '是' : '', p.self, p.selfCtrl, missed(p)]));
  });

  let sheet = ss.getSheetByName('實驗_檢核');
  if (!sheet) sheet = ss.insertSheet('實驗_檢核');
  sheet.clearContents();
  sheet.getRange(1, 1, out.length, W).setValues(out);
  sheet.getRange(1, 1).setFontWeight('bold');
  Logger.log('✅ 實驗_檢核 已更新');
}

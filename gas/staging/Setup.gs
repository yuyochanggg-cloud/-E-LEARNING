// ============================================================
// 良興雲端學院 — 測試環境（staging）初始化
//
// 這個檔案「只」推到 staging 專案，不要推到正式專案。
// 正式專案推的是 gas/Code.gs（線上檔名 程式碼.js），本檔不在裡面。
//
// 第一次使用：在 staging 的 Apps Script 編輯器選 setupStaging → 執行 → 授權。
// 要把正式課程表複製過來：Script Properties 設 PROD_SHEET_ID（正式試算表網址 /d/ 後面那段），
// 再執行 importCoursesFromProd。這個動作只「讀」正式表，不會寫入正式表。
// ============================================================

const STAGING_HEADERS = {
  Users:         ['UserId', 'Email', 'Name', 'Role', 'CreatedAt', 'LastLogin', 'Password', 'IsFirstLogin', 'Department'],
  Courses:       ['CourseId', 'Title', 'Category', 'IsMandatory', 'Duration', 'Badges', 'MaterialType', 'MaterialUrl',
                  'MaterialTextUrl', 'OjtRequired', 'OjtDescription', 'AiSummary', 'AiQuiz', 'Transcript', 'DueDate',
                  'Pinned', 'CreatedAt', 'VisibleTo', 'OpenFrom', 'TestPhase'],
  Progress:      ['UserId', 'CourseId', 'Badges', 'CompletedAt'],
  UserProgress:  ['UserId', 'CompletedCourses', 'EarnedBadges', 'TotalLearningMinutes'],
  OJT_Tasks:     ['TaskId', 'UserId', 'CourseId', 'Status', 'SubmittedAt', 'ApprovedAt', 'OjtFileUrl', 'IsSyncedToBQ', 'RejectReason'],
  DeptMandatory: ['DeptId', 'CourseId', 'DueDays']
};

// 測試帳號：部門用「測試」開頭，正式員工的部門不會撞名
const STAGING_USERS = [
  { id: 'T0001', name: '測試管理員', role: 'admin',    dept: '測試管理部' },
  { id: 'T0002', name: '測試三創店長', role: 'manager', dept: '測試三創' },
  { id: 'T0003', name: '測試三創店員', role: 'employee', dept: '測試三創' },
  { id: 'T0004', name: '測試中壢店員', role: 'employee', dept: '測試中壢' }
];

function _assertStagingSpreadsheet() {
  const users = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (users && users.getLastRow() > 20) {
    throw new Error('Users 表超過 20 列，看起來不是測試試算表，停止執行。');
  }
}

function setupStaging() {
  _assertStagingSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const me = Session.getEffectiveUser().getEmail();
  props.setProperty('APP_ENV', 'staging');
  if (!props.getProperty('STAGING_MAIL_TO')) props.setProperty('STAGING_MAIL_TO', me);

  if (!props.getProperty('OJT_FOLDER_ID')) {
    const folder = DriveApp.createFolder('良興雲端學院（staging）OJT 上傳');
    props.setProperty('OJT_FOLDER_ID', folder.getId());
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Taipei'); // 新建的試算表預設不是台北時區，會讓日期與逾期判斷錯位
  Object.keys(STAGING_HEADERS).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, STAGING_HEADERS[name].length).setValues([STAGING_HEADERS[name]]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });
  const blank = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  _seedUsers(ss.getSheetByName('Users'), me);
  _seedCourses(ss.getSheetByName('Courses'));

  Logger.log('✅ staging 初始化完成。測試帳號與密碼請看 Users 表；通知信一律改寄 ' + props.getProperty('STAGING_MAIL_TO'));
}

function _seedUsers(sheet, email) {
  if (sheet.getLastRow() > 1) { Logger.log('Users 已有資料，略過建立測試帳號'); return; }
  const now = new Date();
  const rows = STAGING_USERS.map(u => [
    u.id, email, u.name, u.role, now, '',
    'stg-' + Utilities.getUuid().slice(0, 8),   // 每次初始化隨機產生，只存在測試表
    false, u.dept
  ]);
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function _seedCourses(sheet) {
  if (sheet.getLastRow() > 1) { Logger.log('Courses 已有資料，略過建立範例課程'); return; }
  const h = STAGING_HEADERS.Courses;
  const row = (o) => h.map(k => (o[k] !== undefined ? o[k] : ''));
  const quiz = JSON.stringify([
    { question: '測試題 1：1+1=?', options: ['1', '2', '3', '4'], answer: 1 },
    { question: '測試題 2：台北在台灣的哪裡？', options: ['北部', '南部', '東部', '外島'], answer: 0 }
  ]);
  const now = new Date();
  const rows = [
    row({ CourseId: '範例', Title: '第 2 列是範例列，程式會跳過，不要刪' }),
    row({ CourseId: 'STG001', Title: '[測試] 一般測驗課', Category: '生存百寶箱', Duration: 5, Badges: '測試徽章',
          MaterialType: 'link', MaterialUrl: 'https://example.com', AiSummary: '[]', AiQuiz: quiz, CreatedAt: now }),
    row({ CourseId: 'STG002', Title: '[測試] OJT 課', Category: '實戰解鎖', Duration: 5,
          MaterialType: 'link', MaterialUrl: 'https://example.com', OjtRequired: true,
          OjtDescription: '上傳任一張圖片測試審核流程', AiSummary: '[]', AiQuiz: quiz, CreatedAt: now }),
    row({ CourseId: 'STG003', Title: '[測試] 全公司必修（已逾期）', Category: '初心補給站', IsMandatory: true, Duration: 5,
          MaterialType: 'link', MaterialUrl: 'https://example.com', AiSummary: '[]', AiQuiz: quiz,
          DueDate: new Date(now.getTime() - 86400000), CreatedAt: now })
  ];
  sheet.getRange(2, 1, rows.length, h.length).setValues(rows);
}

// 把正式課程表整張複製到 staging（只讀正式表）。會覆蓋 staging 的 Courses。
function importCoursesFromProd() {
  _assertStagingSpreadsheet();
  const prodId = PropertiesService.getScriptProperties().getProperty('PROD_SHEET_ID');
  if (!prodId) throw new Error('請先在 Script Properties 設定 PROD_SHEET_ID');
  if (prodId === SpreadsheetApp.getActiveSpreadsheet().getId()) throw new Error('PROD_SHEET_ID 不能是自己');

  const src = SpreadsheetApp.openById(prodId).getSheetByName('Courses');
  const values = src.getDataRange().getValues();
  const dst = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Courses');
  dst.clearContents();
  dst.getRange(1, 1, values.length, values[0].length).setValues(values);
  _invalidateCourseCache(); // Code.gs 的函式，同專案共用
  Logger.log(`✅ 已從正式表複製 ${values.length - 1} 列課程（含第 2 列範例列）`);
}

// ============================================================
// 門市對練實驗（2026/11/16 會議版）：整組重建 staging 的實驗資料
// 會刪掉所有「實驗_」分頁與 EXP- 開頭的課程再重建（只限 staging）。
// 示範：測試三創、測試中壢分別照三創、中壢的定案分組與選品（資料在 gas/seed/FinalData.js），每類 4 品項。
// ============================================================
function setupExperimentDemo() {
  _assertStagingSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Taipei');
  // 日期一律用文字寫入（跟 HR 手打一樣由試算表解析成日期），不用 Date 物件，避免跨時區差一天

  ss.getSheets().filter(sh => sh.getName().indexOf('實驗_') === 0).forEach(sh => ss.deleteSheet(sh));

  const courses = ss.getSheetByName('Courses');
  const head = courses.getRange(1, 1, 1, courses.getLastColumn()).getValues()[0].map(String);
  ['VisibleTo', 'OpenFrom', 'TestPhase'].forEach(h => {
    if (head.indexOf(h) === -1) { courses.getRange(1, courses.getLastColumn() + 1).setValue(h).setFontWeight('bold'); head.push(h); }
  });
  const idCol = head.indexOf('CourseId');
  const ids = courses.getRange(1, idCol + 1, courses.getLastRow(), 1).getValues().map(r => String(r[0]));
  for (let i = ids.length - 1; i >= 1; i--) if (ids[i].indexOf('EXP-') === 0) courses.deleteRow(i + 1);

  const widget = 'https://altatech.ai/widget/ee7pnwndhfawddifdfm5jdt/chat.html';
  // 測試三創＝三創體驗館、測試中壢＝中壢中正店：用定案的分派與選品（指引與網址留空，走預設）
  const items = _expFinalItemRows({ '三創體驗館': '測試三創', '中壢中正店': '測試中壢' });
  if (!_expFinal()) throw new Error('缺 gas/seed/FinalData.js');
  const assign = _expFinal().assign.filter(r => r[0] === '三創體驗館' || r[0] === '中壢中正店')
    .map(r => [r[0] === '三創體驗館' ? '測試三創' : '測試中壢', r[1], r[2]]);

  const seed = {
    [EXP_SHEETS.CONFIG]: [['開始日期', '2026/11/16'], ['總週數', 8], ['每品項次數', 2], ['每日上限', 2], ['每週次數', 2], ['練習網址', widget]],
    [EXP_SHEETS.ASSIGN]: assign,
    [EXP_SHEETS.PITEMS]: items,
    [EXP_SHEETS.ITEMS]: (typeof SEED_TEST_ITEMS !== 'undefined') ? SEED_TEST_ITEMS : [],
    [EXP_SHEETS.FORMS]: [['T0001', 'A', '', ''], ['T0002', 'A', '', ''], ['T0003', 'A', '', ''], ['T0004', 'B', '', '']]
  };
  Object.keys(EXP_HEADERS).forEach(name => {
    const sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, EXP_HEADERS[name].length).setValues([EXP_HEADERS[name]]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    const data = seed[name];
    if (data && data.length) sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  });

  const { cols } = _readSheet(courses);
  const stores = '測試三創,測試中壢';
  const now = new Date();
  const demo = [
    { CourseId: 'EXP-PRE',  Title: '商品知識測驗', Category: '職人練功坊', Duration: 25, MaterialType: 'test', TestPhase: 'pre', VisibleTo: stores },
    { CourseId: 'EXP-PRAC', Title: '門市對練｜正式練習', Category: '職人練功坊', Duration: 15, MaterialType: 'practice', VisibleTo: stores },
    { CourseId: 'EXP-SELF', Title: '門市對練｜自主練習', Category: '職人練功坊', Duration: 15, MaterialType: 'selfpractice', VisibleTo: stores },
    { CourseId: 'EXP-POST', Title: '商品知識測驗', Category: '職人練功坊', Duration: 25, MaterialType: 'test', TestPhase: 'post',
      Badges: '門市對練完課', VisibleTo: stores, OpenFrom: '2027/01/04' }
  ];
  const width = courses.getLastColumn();
  const values = demo.map(o => { o.CreatedAt = now; const row = new Array(width).fill(''); Object.keys(o).forEach(k => { if (cols[k] !== undefined) row[cols[k]] = o[k]; }); return row; });
  courses.getRange(courses.getLastRow() + 1, 1, values.length, width).setValues(values);
  _invalidateCourseCache();
  snapshotParticipants();
  Logger.log('✅ 實驗示範資料重建完成：品項 ' + items.length + '、題目 ' + seed[EXP_SHEETS.ITEMS].length + ' 題、課程 ' + demo.length + ' 堂');
}

// 門市對練冒煙測試（只限 staging）：先重建示範資料，再用 T0004（全部練完路線）、T0003（到期開放路線）走完整流程。
// 結果看執行記錄的 PASS／FAIL。跑完後資料留著方便看；要重來就再跑一次。
function stagingSmokeExperiment() {
  _assertStagingSpreadsheet();
  setupExperimentDemo();
  stagingPostOpenLater();
  const results = [];
  const check = (name, ok, extra) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? '：' + extra : ''}`);
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');

  // ---- T0004：測試中壢 ----
  let tk = _generateSessionToken('T0004');
  let s = getExperimentStatus({ userId: 'T0004', sessionToken: tk }).data;
  const finRows = store => _expFinalItemRows({ '三創體驗館': '測試三創', '中壢中正店': '測試中壢' }).filter(r => r[1] === store);
  const finCats = store => _expFinal().assign.filter(r => r[0] === (store === '測試三創' ? '三創體驗館' : '中壢中正店'))[0].slice(1).join();
  check('中壢只看到自己的兩類 8 品項', s.items.length === 8 && s.categories.join() === finCats('測試中壢'));
  check('目標 16 次', s.formalTarget === 16);
  check('前測前不能練', submitPractice({ userId: 'T0004', itemId: s.today[0].id, kind: 'formal', sessionToken: tk }).status === 'error');
  check('前測前後測不開放', getTest({ userId: 'T0004', courseId: 'EXP-POST', sessionToken: tk }).status === 'error');
  check('中壢品項＝定案資料 8 款', s.items.map(i => i.id).join() === finRows('測試中壢').map(r => r[0]).join());
  const ctrlCat = [EXP_CAT.M, EXP_CAT.K, EXP_CAT.W, EXP_CAT.C].find(c => s.categories.indexOf(c) === -1);
  check('品項沒填網址時用設定的練習網址', s.items.every(i => i.url.indexOf('altatech.ai') !== -1));
  check('別店（三創）的品項不能正式練', submitPractice({ userId: 'T0004', itemId: 'SC-W1', kind: 'formal', sessionToken: tk }).status === 'error');

  const pre = getTest({ userId: 'T0004', courseId: 'EXP-PRE', sessionToken: tk }).data;
  const ans = {}; pre.items.forEach(it => { ans[it.id] = 'A'; });
  check('前測題數 28', pre.items.length === 28, String(pre.items.length));
  check('前測題目不含答案', pre.items.every(it => it.answer === undefined));
  s = submitTest({ userId: 'T0004', courseId: 'EXP-PRE', answers: ans, sessionToken: tk }).data;
  check('交前測後 pretestDone', s.pretestDone === true);
  check('前測不能交第二次', submitTest({ userId: 'T0004', courseId: 'EXP-PRE', answers: ans, sessionToken: tk }).status === 'error');
  check('今天派 2 款新的、兩類各一', s.today.length === 2 && s.today[0].category !== s.today[1].category, s.today.map(i => i.id).join(','));
  check('本週額度 2', s.weekQuota === 2 && s.weekRemaining === 2);
  const again = getExperimentStatus({ userId: 'T0004', sessionToken: tk }).data;
  check('同一天重查派題不變', again.today.map(i => i.id).join() === s.today.map(i => i.id).join());

  const t0 = s.today[0], t1 = s.today[1];
  s = submitPractice({ userId: 'T0004', itemId: t0.id, kind: 'formal', sessionToken: tk }).data;
  check('正式練習 +1', s.formalDone === 1);
  check('練完一項後今日清單不變', s.today.map(i => i.id).join() === [t0.id, t1.id].join() && s.today[0].doneToday);
  check('同品項當天不能再回報', submitPractice({ userId: 'T0004', itemId: t0.id, kind: 'formal', sessionToken: tk }).status === 'error');
  const other = s.items.find(i => i.id !== t0.id && i.id !== t1.id);
  check('非今日品項不能正式回報', submitPractice({ userId: 'T0004', itemId: other.id, kind: 'formal', sessionToken: tk }).status === 'error');
  check('自主練習沒填類別／商品會被擋', submitPractice({ userId: 'T0004', kind: 'self', category: '', productName: 'x', sessionToken: tk }).status === 'error'
    && submitPractice({ userId: 'T0004', kind: 'self', category: '電競鍵盤', productName: '', sessionToken: tk }).status === 'error');
  s = submitPractice({ userId: 'T0004', kind: 'self', category: ctrlCat, productName: '對照類某商品', sessionToken: tk }).data;
  check('自主練習可練對照類且不計入正式', s.formalDone === 1 && s.selfTotal === 1);
  s = submitPractice({ userId: 'T0004', kind: 'self', category: '其他（每月主推等）', productName: '某主推耳機', sessionToken: tk }).data;
  check('自主練習可自由輸入主推商品', s.selfTotal === 2 && s.formalDone === 1);
  check('自主練習選單有 5 個類別、建議清單＝品項表不重複名稱', s.selfCategories.length === 5 && s.knownProducts.length === _expKnownProducts().length && s.knownProducts.length > 0);
  s = submitPractice({ userId: 'T0004', itemId: t1.id, kind: 'formal', sessionToken: tk }).data;
  check('今天兩款都做完 → 本週額度用完', s.formalDone === 2 && s.today.every(i => i.doneToday) && s.weekRemaining === 0);
  check('本週練滿後不能再正式回報', submitPractice({ userId: 'T0004', itemId: other.id, kind: 'formal', sessionToken: tk }).status === 'error');

  // 補「過去日期」的正式紀錄到剩 1 次，模擬前幾週
  const past = new Date(Date.now() - 3 * 86400000);
  const rows = [];
  s.items.forEach(it => {
    const need = 2 - it.count;
    for (let k = 0; k < need; k++) rows.push({ '回報時間': past, '工號': 'T0004', '姓名': '測試中壢店員', '門市': '測試中壢', '週次': 1, '類型': '正式', '類別': it.category, '品項編號': it.id, '品項名稱': it.name, '備註': 'smoke' });
  });
  rows.pop(); // 留最後一次
  _expAppend(EXP_SHEETS.PRACTICE, rows);
  s = getExperimentStatus({ userId: 'T0004', sessionToken: tk }).data;
  check('15/16 時後測尚未開放', s.formalDone === 15 && !s.posttestOpen, `${s.formalDone}/${s.formalTarget}`);
  // 最後一筆也用過去日期補（今天已達每日上限）
  const last = s.items.find(i => i.count < 2);
  _expAppend(EXP_SHEETS.PRACTICE, [{ '回報時間': past, '工號': 'T0004', '姓名': '測試中壢店員', '門市': '測試中壢', '週次': 1, '類型': '正式', '類別': last.category, '品項編號': last.id, '品項名稱': last.name, '備註': 'smoke' }]);
  s = getExperimentStatus({ userId: 'T0004', sessionToken: tk }).data;
  check('16/16 後測開放', s.allDone && s.posttestOpen);
  const post = getTest({ userId: 'T0004', courseId: 'EXP-POST', sessionToken: tk }).data;
  check('後測換成另一卷（B→A）', post.items.length === 28 && post.items[0].id !== pre.items[0].id);
  const ans2 = {}; post.items.forEach(it => { ans2[it.id] = 'B'; });
  s = submitTest({ userId: 'T0004', courseId: 'EXP-POST', answers: ans2, sessionToken: tk }).data;
  check('交後測＋練完 → 完課', s.completed === true);
  const prog = getProgress({ userId: 'T0004', sessionToken: tk });
  check('發完課勳章', !!prog && JSON.stringify(prog.data.earnedBadges).indexOf('門市對練完課') !== -1, prog && JSON.stringify(prog.data.earnedBadges));

  // ---- T0003：測試三創，走「到期開放」路線 ----
  tk = _generateSessionToken('T0003');
  const pre3 = getTest({ userId: 'T0003', courseId: 'EXP-PRE', sessionToken: tk }).data;
  const a3 = {}; pre3.items.forEach(it => { a3[it.id] = 'C'; });
  s = submitTest({ userId: 'T0003', courseId: 'EXP-PRE', answers: a3, sessionToken: tk }).data;
  check('三創類別＝定案資料', s.categories.join() === finCats('測試三創'));
  check('三創品項＝定案資料', s.items.map(i => i.id).join() === finRows('測試三創').map(r => r[0]).join());
  check('三創沒練完、未到期後測不開放', !s.posttestOpen);
  stagingPostOpenToday();
  s = getExperimentStatus({ userId: 'T0003', sessionToken: tk }).data;
  check('到期日起沒練完也開放後測', s.posttestOpen && !s.allDone);
  const post3 = getTest({ userId: 'T0003', courseId: 'EXP-POST', sessionToken: tk }).data;
  const b3 = {}; post3.items.forEach(it => { b3[it.id] = 'D'; });
  s = submitTest({ userId: 'T0003', courseId: 'EXP-POST', answers: b3, sessionToken: tk }).data;
  check('交後測但沒練完 → 不算完課', s.posttestDone && !s.completed);
  stagingPostOpenLater();

  // ---- 沒綁門市 ----
  const tk1 = _generateSessionToken('T0001');
  const s1 = getExperimentStatus({ userId: 'T0001', sessionToken: tk1 }).data;
  check('管理員（非實驗門市）不會開放練習', s1.isExperimentStore === false || s1.unbound === true);

  refreshExperimentSummary();
  Logger.log(results.join('\n'));
  Logger.log(results.some(r => r.indexOf('FAIL') === 0) ? '❌ 有失敗項目' : `✅ 全部 ${results.length} 項通過`);
}

// 資安冒煙測試（只限 staging）：模擬員工直接呼叫 API 偽造完課／勳章／時數，確認都會被擋；正常流程仍可用。
// 用 T0003（測試三創店員）、STG001（一般測驗課，正解 [1,0]）、STG002（OJT 課）。
function stagingSmokeSecurity() {
  _assertStagingSpreadsheet();
  const results = [];
  const check = (name, ok, extra) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? '：' + extra : ''}`);
  const uid = 'T0003';
  const tk = _generateSessionToken(uid);
  CacheService.getScriptCache().remove(_quizPassKey(uid, 'STG001'));

  check('沒考測驗就完課 → 擋', completeCourse({ userId: uid, courseId: 'STG001', sessionToken: tk }).status === 'error');
  check('測驗沒滿分 → 不能完課', submitQuiz({ userId: uid, courseId: 'STG001', answers: [0, 0], sessionToken: tk }).score < 100
    && completeCourse({ userId: uid, courseId: 'STG001', sessionToken: tk }).status === 'error');
  check('測驗滿分', submitQuiz({ userId: uid, courseId: 'STG001', answers: [1, 0], sessionToken: tk }).score === 100);
  const r = completeCourse({ userId: uid, courseId: 'STG001', badges: ['偽造勳章'], isOJT: false, sessionToken: tk });
  check('滿分後可以完課', r.status === 'success');
  const badges = JSON.stringify(getProgress({ userId: uid, sessionToken: tk }).data.earnedBadges);
  check('勳章用課程設定，前端傳的偽造勳章不會寫入', badges.indexOf('測試徽章') !== -1 && badges.indexOf('偽造勳章') === -1, badges);

  // 用沒有 STG002 完課紀錄的 T0004 測（T0003 在 11/16 測 OJT 審核時已被核准過）
  const tk4 = _generateSessionToken('T0004');
  const progRows = () => _readSheet(getSheet(SHEET_NAMES.PROGRESS)).rows
    .filter(x => String(x[0]).trim() === 'T0004' && String(x[1]).trim() === 'STG002').length;
  const n0 = progRows();
  const o = completeCourse({ userId: 'T0004', courseId: 'STG002', isOJT: false, sessionToken: tk4 });
  check('OJT 課謊報 isOJT=false 也不會直接完課', o.pendingOJT === true && progRows() === n0, `pendingOJT=${o.pendingOJT}，完課紀錄 ${n0}→${progRows()}`);
  check('門市對練的課不能用 completeCourse 完課', completeCourse({ userId: uid, courseId: 'EXP-POST', sessionToken: tk }).status === 'error');
  check('不存在的課 → 擋', completeCourse({ userId: uid, courseId: 'NOPE-999', sessionToken: tk }).status === 'error');
  check('冒用別人的工號 → 擋', completeCourse({ userId: 'T0004', courseId: 'STG001', sessionToken: tk }).status === 'error');

  const before = getProgress({ userId: uid, sessionToken: tk }).data.totalLearningMinutes;
  updateProgress({ userId: uid, addMinutes: 9999, sessionToken: tk });
  const once = getProgress({ userId: uid, sessionToken: tk }).data.totalLearningMinutes - before;
  check('單次灌 9999 分鐘 → 最多加 120', once <= 120, `加了 ${once}`);
  for (let k = 0; k < 5; k++) updateProgress({ userId: uid, addMinutes: 120, sessionToken: tk });
  const total = getProgress({ userId: uid, sessionToken: tk }).data.totalLearningMinutes - before;
  check('一天最多加 480', total <= 480, `今天這輪共加 ${total}`);

  Logger.log(results.join('\n'));
  Logger.log(results.some(x => x.indexOf('FAIL') === 0) ? '❌ 有失敗項目' : `✅ 全部 ${results.length} 項通過`);
}

// staging 測後測「到期開放」用：把後測開放日改成今天（或改回 2027/01/04）
function stagingPostOpenToday() { _stagingSetPostOpen(Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd')); }
function stagingPostOpenLater() { _stagingSetPostOpen('2027/01/04'); }
function _stagingSetPostOpen(v) {
  _assertStagingSpreadsheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Courses');
  const { cols, rows } = _readSheet(sheet);
  for (let i = 1; i < rows.length; i++) if (rows[i][cols.CourseId] === 'EXP-POST') sheet.getRange(i + 1, cols.OpenFrom + 1).setValue(v);
  _invalidateCourseCache();
  Logger.log('EXP-POST OpenFrom → ' + v);
}

// 用本機產生的 SeedItems.js 整批取代「實驗_題目」（只在 staging 用；舊題目會被清掉）
function replaceTestItemsFromSeed() {
  _assertStagingSpreadsheet();
  if (typeof SEED_TEST_ITEMS === 'undefined' || !SEED_TEST_ITEMS.length) throw new Error('沒有 SEED_TEST_ITEMS');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EXP_SHEETS.ITEMS);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  sheet.getRange(2, 1, SEED_TEST_ITEMS.length, SEED_TEST_ITEMS[0].length).setValues(SEED_TEST_ITEMS);
  const a = SEED_TEST_ITEMS.filter(r => r[2] === 'A').length;
  Logger.log(`✅ 實驗_題目 已換成 ${SEED_TEST_ITEMS.length} 題（A 卷 ${a}、B 卷 ${SEED_TEST_ITEMS.length - a}）`);
}

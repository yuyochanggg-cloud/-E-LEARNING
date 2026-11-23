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
  // 正式 Users 約 200 列；staging 含多視角測試帳號（setupViewDemo）約 30 列
  if (users && users.getLastRow() > 60) {
    throw new Error('Users 表超過 60 列，看起來不是測試試算表，停止執行。');
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
    { CourseId: 'EXP-SELF', Title: 'AI 門市對練', Category: '職人練功坊', Duration: 15, MaterialType: 'selfpractice', VisibleTo: stores },
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
  check('本期任務出現（檔期內＋實驗門市）', s.hasTask === true && s.selfOpen === true && s.selfLocked === true);
  check('前測前不能自主練習', submitPractice({ userId: 'T0004', kind: 'self', category: s.selfCategories[0], productName: 'x', sessionToken: tk }).status === 'error');
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
  check('非參與者沒有本期任務、但有常駐 AI 對練', s1.hasTask === false && s1.selfOpen === true && !s1.items);
  check('非參與者不能回報正式練習', submitPractice({ userId: 'T0001', itemId: 'x', kind: 'formal', sessionToken: tk1 }).status === 'error');
  const sr = submitPractice({ userId: 'T0001', kind: 'self', category: s1.selfCategories[4], productName: '每月主推測試', sessionToken: tk1 });
  check('非參與者可以記錄自主練習', sr.status === 'success' && sr.data.selfTotal === s1.selfTotal + 1);

  // ---- 開放日期還沒到：常駐層與本期任務都關 ----
  const later = '2099/01/01';
  _stagingSetOpen('EXP-SELF', later);
  _stagingSetOpen('EXP-PRE', later);
  const tk3 = _generateSessionToken('T0003');
  const s3 = getExperimentStatus({ userId: 'T0003', sessionToken: tk3 }).data;
  check('開放日前：沒有本期任務、常駐層關閉', s3.hasTask === false && s3.selfOpen === false && s3.selfOpenDate === '2099/01/01');
  check('開放日前：自主練習被擋', submitPractice({ userId: 'T0003', kind: 'self', category: s3.selfCategories[0], productName: 'x', sessionToken: tk3 }).status === 'error');
  check('開放日前：測驗被擋', getTest({ userId: 'T0003', courseId: 'EXP-PRE', sessionToken: tk3 }).status === 'error');
  _stagingSetOpen('EXP-SELF', '');
  _stagingSetOpen('EXP-PRE', '');

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

// OJT 上傳權限測試（只限 staging）：用 T0001 上傳一張 1×1 圖，確認檔案在 OJT_FOLDER_ID 資料夾、權限是「網域內知道連結」；
// 測完把測試檔丟垃圾桶、刪掉測試列，再跑一次舊檔搬家「預覽」。
function stagingCheckOjtSharing() {
  _assertStagingSpreadsheet();
  const results = [];
  const check = (name, ok, extra) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? '：' + extra : ''}`);
  const tk = _generateSessionToken('T0001');
  const courseId = 'STG-OJTSHARE-' + Date.now();
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const r = submitOJT({ userId: 'T0001', courseId, submitType: 'file', fileName: 'ojt-share-test.png', mimeType: 'image/png', base64Data: png, sessionToken: tk });
  check('上傳成功', r.status === 'success', r.message);
  const sheet = getSheet(SHEET_NAMES.OJT_TASKS);
  const { cols, rows } = _readSheet(sheet);
  let rowNo = -1, url = '';
  for (let i = rows.length - 1; i >= 1; i--) if (String(rows[i][cols.CourseId]) === courseId) { rowNo = i + 1; url = String(rows[i][cols.OjtFileUrl]); break; }
  const id = (url.match(/\/d\/([A-Za-z0-9_-]{20,})/) || [])[1];
  if (id) {
    const f = DriveApp.getFileById(id);
    check('權限＝公司網域知道連結可看', f.getSharingAccess() === DriveApp.Access.DOMAIN_WITH_LINK, String(f.getSharingAccess()));
    const folderId = PropertiesService.getScriptProperties().getProperty('OJT_FOLDER_ID');
    let inFolder = false; const it = f.getParents(); while (it.hasNext()) if (it.next().getId() === folderId) inFolder = true;
    check('檔案在 OJT_FOLDER_ID 資料夾', inFolder);
    f.setTrashed(true);
  } else {
    check('找到上傳檔', false, url);
  }
  if (rowNo > 0) sheet.deleteRow(rowNo);
  _invalidateTableCache(OJT_TASKS_CACHE_KEY);
  Logger.log(results.join('\n'));
  Logger.log('--- 舊檔搬家預覽 ---');
  previewOjtFileMigration();
}

// 舊檔搬家實測（只限 staging）：在「我的雲端硬碟」根目錄造一個公開測試檔＋一筆 OJT 紀錄，
// 跑 applyOjtFileMigration，確認變成網域內＋移進資料夾，再清掉測試檔與測試列。
function stagingCheckOjtMigration() {
  _assertStagingSpreadsheet();
  const results = [];
  const check = (name, ok, extra) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? '：' + extra : ''}`);
  const f = DriveApp.createFile('ojt-migrate-test.txt', 'staging 搬家測試');
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const sheet = getSheet(SHEET_NAMES.OJT_TASKS);
  const courseId = 'STG-OJTMIG-' + Date.now();
  sheet.appendRow(_buildRow(_colMap(sheet), { TaskId: 'TEST-' + courseId, UserId: 'T0001', CourseId: courseId, Status: 'approved', SubmittedAt: new Date(), OjtFileUrl: f.getUrl() }));
  applyOjtFileMigration();
  const g = DriveApp.getFileById(f.getId());
  const folderId = PropertiesService.getScriptProperties().getProperty('OJT_FOLDER_ID');
  let inFolder = false; const it = g.getParents(); while (it.hasNext()) if (it.next().getId() === folderId) inFolder = true;
  check('公開檔 → 網域內', g.getSharingAccess() === DriveApp.Access.DOMAIN_WITH_LINK, String(g.getSharingAccess()));
  check('移進 OJT 資料夾', inFolder);
  g.setTrashed(true);
  const { cols, rows } = _readSheet(sheet);
  for (let i = rows.length - 1; i >= 1; i--) if (String(rows[i][cols.CourseId]) === courseId) sheet.deleteRow(i + 1);
  _invalidateTableCache(OJT_TASKS_CACHE_KEY);
  Logger.log(results.join('\n'));
}

// ============================================================
// 店長／督導看 AI 對練進度＋每月 25 號月報（只限 staging）
// 會重建實驗示範資料，把開始日期改成 15 天前（第 3 週、應完成 4 次），再塞練習紀錄：
//   T0004（測試中壢）正式 4 次＋前測 → 達標；T0003（測試三創）正式 1 次＋自主 1 次 → 落後 3 次；T0002（三創店長）0 次。
// 督導帳號 T0006（測試營業通路處，role=supervisor）沒有就自動補。
// ============================================================
function _stagingEnsureUser(id, name, role, dept) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const { cols, rows } = _readSheet(sheet);
  if (rows.some((r, i) => i > 0 && String(r[cols.UserId]).trim() === id)) return;
  const email = PropertiesService.getScriptProperties().getProperty('STAGING_MAIL_TO') || '';
  sheet.appendRow(_buildRow(cols, { UserId: id, Email: email, Name: name, Role: role, CreatedAt: new Date(),
    Password: 'stg-' + Utilities.getUuid().slice(0, 8), IsFirstLogin: false, Department: dept }));
}

function _stagingSetConfig(key, value) {
  const { sheet, cols, rows } = _expRead(EXP_SHEETS.CONFIG);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols['項目']]).trim() === key) { sheet.getRange(i + 1, cols['值'] + 1).setValue(value); return; }
  }
  sheet.appendRow([key, value]);
}

function stagingSmokeTeam() {
  _assertStagingSpreadsheet();
  setupExperimentDemo();
  _stagingEnsureUser('T0006', '測試督導', 'supervisor', '測試營業通路處');
  const results = [];
  const check = (name, ok, extra) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? '：' + extra : ''}`);
  const day = n => new Date(Date.now() - n * 86400000);
  const fmt = d => Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/MM/dd');
  _stagingSetConfig('開始日期', fmt(day(15)));

  // 練習紀錄（直接寫表，模擬前兩週的回報）
  const cfg = _expConfig();
  const itemsOf = store => _expPracticeItems(store, _expStoreCategories(store), cfg);
  const zl = itemsOf('測試中壢'), sc = itemsOf('測試三創');
  const rec = (uid, name, store, d, it, type) => ({ '回報時間': d, '工號': uid, '姓名': name, '門市': store, '週次': _expWeekNo(cfg.start, d),
    '類型': type || '正式', '類別': it ? it.category : EXP_CAT.K, '品項編號': it ? it.id : '', '品項名稱': it ? it.name : '自主測試商品' });
  _expAppend(EXP_SHEETS.PRACTICE, [
    rec('T0004', '測試中壢店員', '測試中壢', day(14), zl[0]), rec('T0004', '測試中壢店員', '測試中壢', day(13), zl[4]),
    rec('T0004', '測試中壢店員', '測試中壢', day(7), zl[0]), rec('T0004', '測試中壢店員', '測試中壢', day(6), zl[4]),
    rec('T0003', '測試三創店員', '測試三創', day(12), sc[0]), rec('T0003', '測試三創店員', '測試三創', day(5), null, '自主')
  ]);
  _expAppend(EXP_SHEETS.RESPONSES, [{ '作答時間': day(14), '工號': 'T0004', '姓名': '測試中壢店員', '門市': '測試中壢', '階段': 'pre', '卷別': 'B', '題號': 'X1', '作答': 'A', '正解': 'A', '是否答對': true }]);

  const get = uid => getPracticeProgress({ requestUserId: uid, sessionToken: _generateSessionToken(uid) });
  const bad = res => res.status !== 'success' && !res.success;

  // ---- 權限 ----
  check('員工看不到進度', get('T0003').status === 'error');
  check('冒用別人的工號 → 擋', getPracticeProgress({ requestUserId: 'T0006', sessionToken: _generateSessionToken('T0003') }).status === 'error');
  const m = get('T0002').data;
  check('店長只看到自己門市', m.stores.length === 1 && m.stores[0].store === '測試三創' && m.people.every(p => p.store === '測試三創'), m.stores.map(s => s.store).join());
  const sv = get('T0006').data;
  check('督導看到全部門市', sv.stores.length === 2 && sv.people.some(p => p.store === '測試中壢') && sv.people.some(p => p.store === '測試三創'));
  check('管理員看到全部門市', get('T0001').data.stores.length === 2);
  const tk6 = _generateSessionToken('T0006');
  check('督導不能看 OJT 待審', bad(getPendingOJTTasks({ requestUserId: 'T0006', sessionToken: tk6 })));
  check('督導不能審核 OJT', bad(reviewOJTTask({ taskId: 'X', newStatus: 'approved', requestUserId: 'T0006', sessionToken: tk6 })));
  check('督導不能看部門學習報表', bad(getDeptReport({ deptId: '測試三創', requestUserId: 'T0006', sessionToken: tk6 })));
  check('督導不能改必修課', bad(setDeptMandatory({ deptId: '測試三創', courseId: 'STG001', isAdd: true, requestUserId: 'T0006', sessionToken: tk6 })));
  const json = JSON.stringify(sv);
  check('回傳不含分數、答對、類別／對照類', ['score', '答對', '正解', 'category', '對照', EXP_CAT.W, EXP_CAT.C].every(k => json.indexOf(k) === -1));

  // ---- 計算 ----
  const p4 = sv.people.find(p => p.uid === 'T0004'), p3 = sv.people.find(p => p.uid === 'T0003'), p2 = sv.people.find(p => p.uid === 'T0002');
  check('第 3 週、應完成 4 次', sv.weekNo === 3 && sv.stores.every(s => s.expected === 4), `第 ${sv.weekNo} 週、應完成 ${sv.stores.map(s => s.expected).join('/')}`);
  check('T0004 累計 4／16、達標、前測已交', p4.formalDone === 4 && p4.target === 16 && p4.onTrack && p4.pre && !p4.post);
  check('T0004 還沒練滿的品項＝6 款（2 款各練 2 次）', p4.lack.length === 6, String(p4.lack.length));
  check('T0003 落後 3 次、自主 1 次', p3.formalDone === 1 && p3.behind === 3 && !p3.onTrack && p3.selfTotal === 1);
  check('店長本人也列在門市名單（0 次、落後 4）', !!p2 && p2.formalDone === 0 && p2.behind === 4);
  const s3 = sv.stores.find(s => s.store === '測試三創');
  check('三創門市摘要：人數 2、達標 0、人均 0.5', s3.headcount === 2 && s3.onTrack === 0 && s3.avgDone === 0.5, JSON.stringify(s3));
  check('排序：落後多的在前', m.people[0].uid === 'T0002');

  // ---- 開放日前 ----
  _stagingSetConfig('開始日期', '2099/01/01');
  const mClosed = get('T0002').data, aClosed = get('T0001').data;
  check('開始日前：店長看不到（只回開放日）', mClosed.open === false && !mClosed.stores && mClosed.openDate === '2099/01/01');
  check('開始日前：督導看不到', get('T0006').data.open === false && !get('T0006').data.stores);
  check('開始日前：管理員可預覽', aClosed.open === false && aClosed.stores.length === 2);
  _stagingSetConfig('開始日期', fmt(day(15)));

  // ---- 月報區間 ----
  const per = s => { const p = _expReportPeriod(new Date(s)); return fmt(p.from) + '–' + fmt(p.to); };
  check('12/25 08:00 → 11/25–12/25', per('2026-12-25T08:00:00+08:00') === '2026/11/25–2026/12/25', per('2026-12-25T08:00:00+08:00'));
  check('12/24 23:59 → 10/25–11/25', per('2026-12-24T23:59:00+08:00') === '2026/10/25–2026/11/25', per('2026-12-24T23:59:00+08:00'));
  check('跨年 1/25 → 12/25–1/25', per('2027-01-25T08:00:00+08:00') === '2026/12/25–2027/01/25', per('2027-01-25T08:00:00+08:00'));
  check('1/5 → 11/25–12/25', per('2027-01-05T08:00:00+08:00') === '2026/11/25–2026/12/25', per('2027-01-05T08:00:00+08:00'));

  // ---- 月報內容與收件人 ----
  const now = new Date();
  const c2 = _expConfig();
  const rep = _expBuildReport(now, day(40), new Date(now.getTime() + 1));
  const mailOf = k => rep.mails.find(x => (k === '督導' ? x.kind === '督導' : x.store === k));
  const staffMail = PropertiesService.getScriptProperties().getProperty('STAGING_MAIL_TO');
  check('月報：2 封店長＋1 封督導', rep.mails.length === 3 && !!mailOf('測試三創') && !!mailOf('測試中壢') && !!mailOf('督導'));
  check('月報區間從開始日起算（不早於開始日）', rep.label.indexOf(fmt(c2.start)) === 0, rep.label);
  check('三創店長信寄給 T0002', mailOf('測試三創').to.length === 1 && mailOf('測試三創').to[0] === staffMail);
  check('中壢沒有店長 → 沒收件人', mailOf('測試中壢').to.length === 0);
  check('督導信寄給 T0006', mailOf('督導').to.indexOf(staffMail) !== -1);
  check('三創店長信有同仁明細、沒有別店', mailOf('測試三創').html.indexOf('測試三創店員') !== -1 && mailOf('測試三創').html.indexOf('測試中壢店員') === -1);
  check('督導信有兩店、含 ⚠', mailOf('督導').html.indexOf('測試三創') !== -1 && mailOf('督導').html.indexOf('測試中壢') !== -1 && mailOf('督導').html.indexOf('⚠') !== -1);
  check('月報不含類別／對照類／分數', rep.mails.every(x => ['對照', '答對', '分數', EXP_CAT.W, EXP_CAT.C].every(k => x.html.indexOf(k) === -1)));
  check('區間內正式次數：三創 1、中壢 4', mailOf('督導').text.indexOf('測試三創｜2｜1｜') !== -1 && mailOf('督導').text.indexOf('測試中壢｜1｜4｜') !== -1, mailOf('督導').text.split('\n').slice(2, 5).join(' / '));
  check('區間在開始日前 → 不寄', !!_expBuildReport(now, day(60), day(20)).skip);
  check('區間在檔期結束後 → 不寄', !!_expBuildReport(now, c2.end, new Date(c2.end.getTime() + 30 * 86400000)).skip);
  check('區間涵蓋檔期結束 → 整期總結', _expBuildReport(now, day(10), c2.end).final === true);
  check('檔期中 → 一般月報', rep.final === false && mailOf('督導').subject.indexOf('月報') !== -1);
  check('設定沒填月報寄送 → 測試', c2.reportMode === '測試');

  // ---- 重複寄送保護 ----
  const label = 'TEST-' + Date.now();
  check('沒寄過 → 可以寄', !_expReportAlreadySent(label));
  _expReportLog([{ '寄送時間': now, '模式': '正式', '統計區間': label, '對象': '測試', '收件人': '', '結果': '成功' }]);
  check('同一區間寄過（正式成功）→ 不重寄', _expReportAlreadySent(label));

  Logger.log(results.join('\n'));
  Logger.log(results.some(r => r.indexOf('FAIL') === 0) ? '❌ 有失敗項目' : `✅ 全部 ${results.length} 項通過`);
}

// 把目前資料的月報預覽寄給自己看排版（staging 一律改寄 STAGING_MAIL_TO）
function stagingPreviewReport() {
  _assertStagingSpreadsheet();
  const now = new Date();
  _expSendReport(now, new Date(now.getTime() - 40 * 86400000), new Date(now.getTime() + 1), '測試');
}

// staging 測後測「到期開放」用：把後測開放日改成今天（或改回 2027/01/04）
function stagingPostOpenToday() { _stagingSetPostOpen(Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd')); }
function stagingPostOpenLater() { _stagingSetPostOpen('2027/01/04'); }
function _stagingSetPostOpen(v) { _stagingSetOpen('EXP-POST', v); }
function _stagingSetOpen(courseId, v) {
  _assertStagingSpreadsheet();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Courses');
  const { cols, rows } = _readSheet(sheet);
  for (let i = 1; i < rows.length; i++) if (rows[i][cols.CourseId] === courseId) sheet.getRange(i + 1, cols.OpenFrom + 1).setValue(v);
  _invalidateCourseCache();
  Logger.log(courseId + ' OpenFrom → ' + v);
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

// 畫面實測用（只限 staging）：產生 T0002 店長、T0003 店員、T0006 督導的登入憑證（6 小時有效），印在執行記錄。
// 本機 staging 前端把憑證放進 localStorage 就能以該身分進站，不需要輸入密碼。
function stagingIssueTokens() {
  _assertStagingSpreadsheet();
  ['T0002', 'T0003', 'T0006', 'V-SC-E', 'V-SC-M', 'V-SUP'].forEach(id => {
    const u = _getUserInfo(id);
    Logger.log(`${id} ${u ? u.role : '?'} TOKEN=${_generateSessionToken(id)}`);
  });
}

// ============================================================
// 多視角測試帳號（只限 staging）：8 家定案門市各一個「店員」「店長」「示範同仁」，加一個「督導」。
//   店員／店長：沒有任何紀錄，可以從前測開始自己走一遍。
//   示範同仁：已交前測、塞了不同次數的正式練習，讓店長／督導的進度頁有達標、落後可看（不用登入）。
// 共用密碼放在 gas/staging/seed/ViewAccounts.js（gitignore，只在本機有，推 staging 時一起帶上）。
// 會先重建實驗示範資料（setupExperimentDemo），再把 8 家店加進分派、品項、課程可見範圍。
// 冒煙測試會清掉實驗資料，跑完冒煙測試後再執行一次本函式即可恢復（帳號不會重複建立）。
// ============================================================
function setupViewDemo() {
  _assertStagingSpreadsheet();
  const fin = _expFinal();
  if (!fin) throw new Error('缺 gas/seed/FinalData.js');
  const pw = (typeof _stagingViewPassword === 'function') ? _stagingViewPassword() : '';
  if (!pw) throw new Error('缺 gas/staging/seed/ViewAccounts.js（共用密碼）');

  setupExperimentDemo();

  // 分派與品項：加上 8 家真實店名（測試三創／測試中壢照舊，給冒煙測試用）
  const assign = _expRead(EXP_SHEETS.ASSIGN);
  assign.sheet.getRange(assign.sheet.getLastRow() + 1, 1, fin.assign.length, 3).setValues(fin.assign);
  const rows = _expFinalItemRows();
  const pitems = _expRead(EXP_SHEETS.PITEMS);
  pitems.sheet.getRange(pitems.sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  // 課程可見範圍加上 8 家店
  const stores = fin.items.map(([prefix, store]) => ({ prefix, store }));
  const courses = getSheet(SHEET_NAMES.COURSES);
  const { cols, rows: cRows } = _readSheet(courses);
  for (let i = 1; i < cRows.length; i++) {
    if (String(cRows[i][cols.CourseId]).indexOf('EXP-') !== 0) continue;
    const vis = String(cRows[i][cols.VisibleTo] || '');
    courses.getRange(i + 1, cols.VisibleTo + 1).setValue([vis].concat(stores.map(s => s.store)).filter(Boolean).join(','));
  }
  _invalidateCourseCache();

  // 帳號
  _stagingUpsertUser('V-SUP', '督導（測試）', 'supervisor', '測試營業通路處', pw);
  const forms = [];
  stores.forEach(({ prefix, store }, i) => {
    _stagingUpsertUser(`V-${prefix}-E`, `${store} 店員`, 'employee', store, pw);
    _stagingUpsertUser(`V-${prefix}-M`, `${store} 店長`, 'manager', store, pw);
    _stagingUpsertUser(`V-${prefix}-D`, `${store} 示範同仁`, 'employee', store, pw);
    forms.push([`V-${prefix}-E`, i % 2 ? 'B' : 'A', `${store} 店員`, store], [`V-${prefix}-M`, i % 2 ? 'A' : 'B', `${store} 店長`, store],
      [`V-${prefix}-D`, 'A', `${store} 示範同仁`, store]);
  });
  const f = _expRead(EXP_SHEETS.FORMS);
  f.sheet.getRange(f.sheet.getLastRow() + 1, 1, forms.length, 4).setValues(forms);
  snapshotParticipants();

  // 示範同仁：已交前測＋各店不同的正式練習次數（每天最多 2 次，從開始日隔天起排）
  const cfg = _expConfig();
  const counts = [4, 2, 1, 0, 3, 2, 0, 5];
  const prac = [], resp = [];
  stores.forEach(({ prefix, store }, i) => {
    const uid = `V-${prefix}-D`, name = `${store} 示範同仁`;
    resp.push({ '作答時間': new Date(cfg.start.getTime() + 86400000), '工號': uid, '姓名': name, '門市': store, '階段': 'pre', '卷別': 'A', '題號': 'DEMO', '作答': '', '正解': '', '是否答對': '' });
    const items = _expPracticeItems(store, _expStoreCategories(store), cfg);
    for (let k = 0; k < counts[i % counts.length] && k < items.length; k++) {
      const d = new Date(cfg.start.getTime() + (1 + Math.floor(k / 2)) * 86400000 + 10 * 3600000);
      if (d > new Date()) break;
      const it = items[k % items.length];
      prac.push({ '回報時間': d, '工號': uid, '姓名': name, '門市': store, '週次': _expWeekNo(cfg.start, d), '類型': '正式',
        '類別': it.category, '品項編號': it.id, '品項名稱': it.name, '備註': 'demo' });
    }
  });
  if (resp.length) _expAppend(EXP_SHEETS.RESPONSES, resp);
  if (prac.length) _expAppend(EXP_SHEETS.PRACTICE, prac);
  Logger.log(`✅ 多視角測試帳號就緒：督導 1、門市 ${stores.length} 家 × 店員／店長／示範同仁；示範練習 ${prac.length} 筆。帳號清單見本機 gas/staging/seed/`);
}

function _stagingUpsertUser(id, name, role, dept, pw) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const { cols, rows } = _readSheet(sheet);
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols.UserId]).trim() !== id) continue;
    const set = (k, v) => sheet.getRange(i + 1, cols[k] + 1).setValue(v);
    set('Name', name); set('Role', role); set('Department', dept); set('Password', pw); set('IsFirstLogin', false);
    return;
  }
  const email = PropertiesService.getScriptProperties().getProperty('STAGING_MAIL_TO') || '';
  sheet.appendRow(_buildRow(cols, { UserId: id, Email: email, Name: name, Role: role, CreatedAt: new Date(),
    Password: pw, IsFirstLogin: false, Department: dept }));
}

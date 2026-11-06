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
                  'Pinned', 'CreatedAt'],
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

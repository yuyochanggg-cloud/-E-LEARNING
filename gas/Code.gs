// ============================================================
// 良興雲端學院 - GAS Web App
// Code.gs
//
// Sheet 結構（欄位「順序」不再重要，但「標題文字」必須跟下面完全一致，
// 大小寫、拼字都要對，程式是用標題列文字查欄位位置，不是用寫死的數字）：
//   Users:        UserId | Email | Name | Role | CreatedAt | LastLogin | Password | IsFirstLogin | Department
//   Courses:      CourseId | Title | Category | IsMandatory | Duration | Badges | MaterialType | MaterialUrl | MaterialTextUrl | OjtRequired | OjtDescription | AiSummary | AiQuiz | Transcript | DueDate
//                 （DueDate＝固定日期，僅用於全域必修課的逾期通知，選填）
//   Progress:     UserId | CourseId | Badges | CompletedAt
//   UserProgress: UserId | CompletedCourses | EarnedBadges | TotalLearningMinutes
//   OJT_Tasks:    TaskId | UserId | CourseId | Status | SubmittedAt | ApprovedAt | OjtFileUrl | IsSyncedToBQ
//   DeptMandatory: DeptId | CourseId | DueDays
//                 （DueDays＝到職後幾天內要完成，選填，用於部門必修課的逾期通知）
//
// 現在可以放心在任何一欄「後面」插入新欄位，欄位名稱對照表會自動抓到新位置；
// 唯一要注意的是新欄位一律加在最右邊的空欄，標題文字打對即可，不用管順序。
//
// Script Properties（GAS 後台 > 專案設定 > 指令碼屬性）：
//   VERTEX_PROJECT_ID → Vertex AI 所在的 GCP 專案 ID（此 GAS 專案須已綁定
//                        standard GCP 專案，且該專案已啟用 Vertex AI API + 帳單）
//   VERTEX_LOCATION   → Vertex AI region，選填，預設 us-central1
//   OJT_FOLDER_ID     → OJT 上傳檔案的 Google Drive 資料夾 ID（選填）
//
// AI 呼叫改用 Vertex AI（ScriptApp.getOAuthToken()），不再需要 GEMINI_API_KEY。
// appsscript.json 需加入 oauthScopes:
//   "https://www.googleapis.com/auth/cloud-platform"
//   "https://www.googleapis.com/auth/script.send_mail"（逾期通知寄信用）
// ============================================================

const SHEET_NAMES = {
  USERS:          'Users',
  COURSES:        'Courses',
  PROGRESS:       'Progress',
  USER_PROGRESS:  'UserProgress',
  OJT_TASKS:      'OJT_Tasks',
  DEPT_MANDATORY: 'DeptMandatory',
  NOTIFICATION_LOG: 'NotificationLog'
};

// ============================================================
// Entry Points
// ============================================================

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: '良興雲端學院 API 運作中' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;

    const handlers = {
      verifyLogin:        verifyLogin,
      changePassword:     changePassword,
      updateNotifyEmail:  updateNotifyEmail,
      bootstrap:          bootstrap,
      getCourses:         getCourses,
      getCourseDetail:    getCourseDetail,
      getProgress:        getProgress,
      completeCourse:     completeCourse,
      updateProgress:     updateProgress,
      submitOJT:          submitOJT,
      getPendingOJTTasks: getPendingOJTTasks,
      reviewOJTTask:      reviewOJTTask,
      generateAiContent:  generateAiContent,
      getDeptReport:      getDeptReport,
      getDeptMandatory:   getDeptMandatory,
      setDeptMandatory:   setDeptMandatory,
      getDepartments:     getDepartments,
      submitQuiz:         submitQuiz,
    };

    if (!handlers[action]) {
      return respond({ status: 'error', message: '未知的 action: ' + action });
    }

    return respond(handlers[action](payload));

  } catch (err) {
    return respond({ status: 'error', message: err.toString() });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Helper
// ============================================================

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// 取得 NotificationLog 表，第一次呼叫時自動建立（含表頭），之後直接沿用既有表
function _getNotificationLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.NOTIFICATION_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.NOTIFICATION_LOG);
    sheet.appendRow(['RunAt', 'NotifiedEmployeeCount', 'FailedEmployeeIds', 'FailedManagerDepts', 'NoEmailEmployeeIds', 'NoEmailManagerDepts', 'Status']);
  }
  return sheet;
}

function safeParseJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; }
  catch (e) { return fallback; }
}

// ------------------------------------------------------------
// 標題別名對照：實際 Sheet 有些表用中文標題（例如 Progress 表是
// 工號/課程ID/獲得徽章/完成時間），程式內部一律用英文欄位名稱。
// 這裡把已知的中文標題正規化成程式用的英文名稱，兩種寫法都能相容，
// 不需要手動去改 Sheet 標題（改標題容易打錯或漏改，風險更高）。
// 之後若有新的中文標題，加進這張表即可，不用改任何邏輯。
// ------------------------------------------------------------
const HEADER_ALIASES = {
  '工號':     'UserId',
  '員工編號': 'UserId',
  '課程ID':   'CourseId',
  '課程編號': 'CourseId',
  '獲得徽章': 'Badges',
  '徽章':     'Badges',
  '完成時間': 'CompletedAt',
  '完課時間': 'CompletedAt',
  '姓名':     'Name',
  '部門':     'Department',
  '角色':     'Role',
  '信箱':     'Email',
  '電子郵件': 'Email',
  '建立時間': 'CreatedAt',
  '新增時間': 'CreatedAt'
};

function _normalizeHeader(h) {
  const raw = String(h).trim();
  return HEADER_ALIASES[raw] || raw;
}

// ------------------------------------------------------------
// 欄位名稱對照表：讀取 Sheet 第一列標題文字，回傳 { 欄位名稱: 0-based 欄位位置 }
// 之後所有讀寫都用 cols.欄位名稱，不用寫死的數字，插入新欄不會讓舊邏輯錯位。
// 只需要欄位對照、不需要整表資料時用這個（例如只讀特定一列）。
// ------------------------------------------------------------
function _colMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const header  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  header.forEach((h, i) => { if (h) map[_normalizeHeader(h)] = i; });
  return map;
}

// ------------------------------------------------------------
// 效能優化：需要「欄位對照表」又要「整表資料」時，兩者都能從同一次
// getDataRange() 拿到（標題列就是 rows[0]），不用像 _colMap 那樣另外
// 多打一次 Sheets API。所有「讀整表」的函式都應該用這個，不要各自呼叫
// _colMap(sheet) 再呼叫一次 sheet.getDataRange().getValues()——那樣同一
//張表會被讀兩次，每個請求會多出等同於表數的 API 往返時間。
// ------------------------------------------------------------
function _readSheet(sheet) {
  const rows = sheet.getDataRange().getValues();
  const cols = {};
  (rows[0] || []).forEach((h, i) => { if (h) cols[_normalizeHeader(h)] = i; });
  return { cols, rows };
}

// ------------------------------------------------------------
// 依欄位名稱組出 appendRow 用的陣列（順序照實際 Sheet 欄位位置排，不用管傳入順序）
// values: { 欄位名稱: 值, ... }，沒填到的欄位自動補空字串
// ------------------------------------------------------------
function _buildRow(cols, values) {
  // 防呆：Sheet 標題列少了任何一個要寫入的欄位名稱時，cols[k] 會是 undefined，
  // arr[undefined]=value 會變成設字串屬性而不是陣列索引，導致 appendRow 收到
  // 空陣列或破損陣列、丟出很難看懂的錯誤。這裡先明確指出是哪個欄位對不上。
  const missing = Object.keys(values).filter(k => cols[k] === undefined);
  if (missing.length > 0) {
    throw new Error(
      'Sheet 標題列找不到這些欄位：' + missing.join('、') +
      '（請確認標題文字完全一致，大小寫與拼字都要對）'
    );
  }

  const arr = [];
  Object.keys(values).forEach(k => { arr[cols[k]] = values[k]; });
  for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = '';
  return arr;
}

// ============================================================
// Session Token Helpers（CacheService，不需異動 Sheet 結構）
// ============================================================
function _generateSessionToken(userId) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, String(userId), 21600); // 6小時
  return token;
}

function _validateSession(sessionToken) {
  if (!sessionToken) return null;
  return CacheService.getScriptCache().get('sess_' + sessionToken);
}

function _requireSession(sessionToken, expectedUserId) {
  const uid = _validateSession(sessionToken);
  if (!uid) return '登入已逾期，請重新登入';
  if (expectedUserId && String(uid) !== String(expectedUserId).trim()) return '身分驗證失敗';
  return null;
}

function _getRole(userId) {
  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.USERS));
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols.UserId]).trim() === String(userId).trim()) {
      return String(rows[i][cols.Role] || '').toLowerCase();
    }
  }
  return '';
}

function _requireManagerOrAdmin(sessionToken, userId) {
  const err = _requireSession(sessionToken, userId);
  if (err) return err;
  const role = _getRole(userId);
  if (role !== 'manager' && role !== 'admin') return '權限不足';
  return null;
}

function _isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

// ============================================================
// 密碼比對
//
// 【目前設計：密碼以明碼存放，這是使用者刻意選擇的取捨】
// 原因：HR 需要能直接在 Sheet 上查看員工密碼以協助忘記密碼的同仁。
// 代價：任何能開啟這份 Sheet 的人都看得到全公司密碼，請把 Sheet 的
//      共用權限控制在最少人。
//
// 下面的 hash 相關函式「不會主動把密碼轉成 hash」，只保留驗證能力：
// 萬一 Sheet 裡有任何一筆密碼曾經被轉成 hash（例如測試期間），
// 那位同仁還是能正常登入，不會被鎖在門外。
// 之後若改變決定要改存 hash，把 verifyLogin 登入成功後與 changePassword
// 的寫入改成 _hashPassword(...) 即可，比對邏輯不用動。
// ============================================================
const HASH_PREFIX = 'sha256:';

function _passwordSalt() {
  return PropertiesService.getScriptProperties().getProperty('PASSWORD_SALT') || 'lx-academy-default-salt';
}

function _isHashedPassword(stored) {
  return String(stored || '').indexOf(HASH_PREFIX) === 0;
}

function _hashPassword(plain) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(plain) + _passwordSalt(),
    Utilities.Charset.UTF_8
  );
  // 轉成 hex 字串
  const hex = bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  return HASH_PREFIX + hex;
}

function _passwordMatches(input, stored) {
  if (_isHashedPassword(stored)) return _hashPassword(input) === stored;
  return input === String(stored || '').trim(); // 還沒升級的明碼
}

// ------------------------------------------------------------
// 登入失敗次數限制（CacheService，15 分鐘視窗）
// ------------------------------------------------------------
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_SECONDS  = 900; // 15 分鐘

function _loginFailKey(userId) { return 'loginfail_' + userId; }

function _checkLoginLock(userId) {
  const n = Number(CacheService.getScriptCache().get(_loginFailKey(userId))) || 0;
  if (n >= MAX_LOGIN_FAILURES) {
    return '密碼錯誤次數過多，請稍後約 15 分鐘後再試，或聯繫人資部門';
  }
  return null;
}

function _recordLoginFailure(userId) {
  const cache = CacheService.getScriptCache();
  const key   = _loginFailKey(userId);
  const n     = (Number(cache.get(key)) || 0) + 1;
  cache.put(key, String(n), LOGIN_LOCK_SECONDS);
}

function _clearLoginFailures(userId) {
  CacheService.getScriptCache().remove(_loginFailKey(userId));
}

// ============================================================
// 1. verifyLogin
// POST { userId, password }
// → { status:'success', data:{ userId, name, role, isFirstLogin } }
// ============================================================

function verifyLogin({ userId, password }) {
  const uid = String(userId || '').trim();

  // 登入嘗試次數限制：同一工號連續失敗 5 次鎖 15 分鐘。
  // 預設密碼多為生日等易猜字串，沒有限制等於可暴力破解。
  const lockMsg = _checkLoginLock(uid);
  if (lockMsg) return { status: 'error', message: lockMsg };

  const sheet = getSheet(SHEET_NAMES.USERS);
  const { cols, rows } = _readSheet(sheet);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cols.UserId]).trim() !== uid) continue;

    const stored = String(r[cols.Password]).trim();
    if (!_passwordMatches(String(password).trim(), stored)) {
      _recordLoginFailure(uid);
      return { status: 'error', message: '密碼錯誤' };
    }
    _clearLoginFailures(uid);

    // 更新最後登入時間
    sheet.getRange(i + 1, cols.LastLogin + 1).setValue(new Date());

    const sessionToken = _generateSessionToken(r[cols.UserId]);
    return {
      status: 'success',
      data: {
        userId:       r[cols.UserId],
        email:        r[cols.Email],
        name:         r[cols.Name],
        role:         r[cols.Role],
        department:   String(r[cols.Department] || '').trim(),
        isFirstLogin: r[cols.IsFirstLogin] === true || r[cols.IsFirstLogin] === 'TRUE',
        needsEmail:   !String(r[cols.Email] || '').trim(),
        sessionToken
      }
    };
  }
  return { status: 'error', message: '找不到此員工編號' };
}

// ============================================================
// 2. changePassword
// POST { userId, oldPassword, newPassword, sessionToken }
// → { status:'success' }
// ============================================================

function changePassword({ userId, oldPassword, newPassword, notifyEmail, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  if (notifyEmail && !_isValidEmail(notifyEmail)) {
    return { status: 'error', message: '請輸入有效的信箱' };
  }

  const sheet = getSheet(SHEET_NAMES.USERS);
  const { cols, rows } = _readSheet(sheet);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cols.UserId]).trim() !== String(userId).trim()) continue;

    const isFirstLogin = r[cols.IsFirstLogin] === true || r[cols.IsFirstLogin] === 'TRUE';
    if (!isFirstLogin && !_passwordMatches(String(oldPassword || '').trim(), String(r[cols.Password]).trim())) {
      return { status: 'error', message: '舊密碼錯誤' };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      sheet.getRange(i + 1, cols.Password + 1).setValue(newPassword);
      sheet.getRange(i + 1, cols.IsFirstLogin + 1).setValue(false);
      if (notifyEmail) {
        sheet.getRange(i + 1, cols.Email + 1).setValue(String(notifyEmail).trim());
      }
    } finally {
      lock.releaseLock();
    }
    return { status: 'success' };
  }
  return { status: 'error', message: '找不到此員工' };
}

// ============================================================
// updateNotifyEmail
// POST { userId, email, sessionToken }
// → { status:'success' }
// 用途：既有帳號（已完成首次登入、不會再走 changePassword 那條路）
//      登入時如果 Email 欄位是空的，前端會彈一個小視窗補填，呼叫這個。
// ============================================================

function updateNotifyEmail({ userId, email, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  if (!_isValidEmail(email)) {
    return { status: 'error', message: '請輸入有效的信箱' };
  }

  const sheet = getSheet(SHEET_NAMES.USERS);
  const { cols, rows } = _readSheet(sheet);

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][cols.UserId]).trim() !== String(userId).trim()) continue;
      sheet.getRange(i + 1, cols.Email + 1).setValue(String(email).trim());
      return { status: 'success' };
    }
    return { status: 'error', message: '找不到此員工' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 課程目錄快取
//
// 效能關鍵：Courses 表含 Transcript（逐字稿可能上萬字）與 AiQuiz／AiSummary
// 這些大欄位，每次請求都 getDataRange() 整表拉回來是首屏慢的主因。
// 這裡只留課程清單需要的輕量欄位（題庫／摘要／逐字稿一律不含，只留
// hasQuiz 旗標），快取 5 分鐘。課程內容變動時呼叫 _invalidateCourseCache()。
//
// 摘要與題目改由 getCourseDetail 在「點開課程時」才拉，不在清單階段付代價。
// ============================================================
const COURSE_CATALOG_CACHE_KEY = 'course_catalog_v1';

function _invalidateCourseCache() {
  CacheService.getScriptCache().remove(COURSE_CATALOG_CACHE_KEY);
}

function _getCourseCatalog() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get(COURSE_CATALOG_CACHE_KEY);
  if (cached) {
    const parsed = safeParseJSON(cached, null);
    if (parsed) return parsed;
  }

  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.COURSES));
  const catalog = [];
  // Row 1=標題列, Row 2=範例列, Row 3~=實際資料
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r[cols.CourseId]) continue;
    catalog.push({
      id:              String(r[cols.CourseId]).trim(),
      title:           r[cols.Title],
      category:        r[cols.Category],
      globalMandatory: r[cols.IsMandatory] === true || r[cols.IsMandatory] === 'TRUE',
      duration:        r[cols.Duration],
      badges:          r[cols.Badges] ? String(r[cols.Badges]).split(',').map(b => b.trim()) : [],
      materialType:    r[cols.MaterialType] || 'video',
      materialUrl:     r[cols.MaterialUrl] || '',
      materialTextUrl: r[cols.MaterialTextUrl] || '',
      ojtRequired:     r[cols.OjtRequired] === true || r[cols.OjtRequired] === 'TRUE',
      ojtDescription:  r[cols.OjtDescription] || '',
      hasQuiz:         !!r[cols.AiQuiz],
      hasSummary:      !!r[cols.AiSummary],
      // 沒有 CreatedAt（舊課程、或還沒被 onEdit 蓋過時間）一律當最舊處理，
      // 前端「最新 4 堂」排序時會自然排到後面，不會噴錯或排到最前面。
      createdAt:       r[cols.CreatedAt] ? new Date(r[cols.CreatedAt]).getTime() : 0
    });
  }

  try {
    cache.put(COURSE_CATALOG_CACHE_KEY, JSON.stringify(catalog), 300); // 5分鐘
  } catch (e) {
    // 超過 CacheService 單鍵 100KB 上限就不快取，功能不受影響只是比較慢
    Logger.log('課程目錄快取失敗（可能過大）：' + e.toString());
  }
  return catalog;
}

// ============================================================
// onEdit 簡易觸發器：Courses 表新增課程列時自動蓋 CreatedAt
//
// 維持原本「直接在 Sheet 打一列新課程」的習慣，不用另外記得填時間——
// 只要那一列 Category 有填、CreatedAt 還空著，編輯存檔時就自動蓋上當下
// 時間。函式名稱固定叫 onEdit 是簡易觸發器的寫法，不用另外部署或授權，
// 但也因此權限受限：只能寫回目前這個試算表，不能呼叫其他服務。
// ============================================================
function onEdit(e) {
  try {
    const sheet = e.range.getSheet();
    if (sheet.getName() !== SHEET_NAMES.COURSES) return;

    const row = e.range.getRow();
    if (row <= 2) return; // 1=標題列，2=範例列

    const cols = _colMap(sheet);
    if (cols.CreatedAt === undefined || cols.Category === undefined) return;

    const rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!rowValues[cols.Category]) return; // 這列還沒填分類，不算一門課
    if (rowValues[cols.CreatedAt]) return; // 已經蓋過時間，不重複覆寫

    sheet.getRange(row, cols.CreatedAt + 1).setValue(new Date());
    _invalidateCourseCache();
  } catch (err) {
    // 簡易觸發器不能跳錯誤視窗給使用者看，吞掉錯誤避免卡住正常編輯，
    // 有需要診斷時看 Apps Script 的執行紀錄（不是 Logger.log，簡易觸發器
    // 的 Logger 不一定看得到，改看「執行項目」列表）。
  }
}

// ============================================================
// bootstrap
// POST { userId, sessionToken }
// → { status:'success', courses:[...], progress:{...} }
//
// 用途：首屏一次拿齊課程清單與個人進度。原本前端要分別打 getCourses 與
//      getProgress 兩次，每次都要付一趟 GAS 冷啟＋往返，合併成一次明顯較快。
// ============================================================

function bootstrap({ userId, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const courses  = getCourses({ userId, sessionToken });
  if (courses && courses.status === 'error') return courses;

  const progress = getProgress({ userId, sessionToken });
  if (progress && progress.status === 'error') return progress;

  return { status: 'success', courses: courses, progress: progress.data };
}

// ============================================================
// getCourseDetail
// POST { courseId, userId, sessionToken }
// → { status:'success', data:{ AiSummary, quiz:[{question,options}] } }
//
// 題目一律剝掉 answer 才回傳（判分走 submitQuiz），摘要與題目都只在
// 點開單一課程時才拉，不在課程清單階段付整表序列化的代價。
// ============================================================

function getCourseDetail({ courseId, userId, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.COURSES));
  for (let i = 2; i < rows.length; i++) {
    if (String(rows[i][cols.CourseId]).trim() !== String(courseId).trim()) continue;
    const quizRaw = safeParseJSON(rows[i][cols.AiQuiz], []);
    return {
      status: 'success',
      data: {
        AiSummary: rows[i][cols.AiSummary] || '',
        quiz: (Array.isArray(quizRaw) ? quizRaw : [])
          .filter(q => q && q.question && Array.isArray(q.options))
          .map(q => ({ question: q.question, options: q.options }))
      }
    };
  }
  return { status: 'error', message: '找不到課程' };
}

// ============================================================
// 3. getCourses
// POST { userId }
// → Array of course objects（前端容錯：直接回陣列）
//    注意：不含 AiSummary／AiQuiz，那兩項改由 getCourseDetail 提供
// ============================================================

function getCourses({ userId, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const catalog = _getCourseCatalog();
  const { cols: ojtCols,      rows: ojtRows }      = _readSheet(getSheet(SHEET_NAMES.OJT_TASKS));
  const { cols: progressCols, rows: progressRows } = _readSheet(getSheet(SHEET_NAMES.PROGRESS));
  const { cols: userCols,     rows: userRows }     = _readSheet(getSheet(SHEET_NAMES.USERS));
  const { cols: dmCols,       rows: dmRows }       = _readSheet(getSheet(SHEET_NAMES.DEPT_MANDATORY));

  // 取得使用者部門
  let userDept = '';
  for (let i = 1; i < userRows.length; i++) {
    if (String(userRows[i][userCols.UserId]).trim() === String(userId).trim()) {
      userDept = String(userRows[i][userCols.Department] || '').trim();
      break;
    }
  }

  // 部門必修課集合
  const deptMandatorySet = new Set();
  if (userDept) {
    for (let i = 1; i < dmRows.length; i++) {
      if (String(dmRows[i][dmCols.DeptId]).trim() === userDept) {
        deptMandatorySet.add(String(dmRows[i][dmCols.CourseId]).trim());
      }
    }
  }

  // 已完成課程（一般完課）
  const completedSet = new Set();
  for (let i = 1; i < progressRows.length; i++) {
    if (String(progressRows[i][progressCols.UserId]).trim() === String(userId).trim()) {
      completedSet.add(String(progressRows[i][progressCols.CourseId]).trim());
    }
  }

  // OJT 狀態
  // ojtPending／ojtApproved：曾經有過就算（核准是永久性的，不該因為後面雜訊列而消失）
  // ojtLatest：依 Sheet 列順序覆寫，跑完迴圈後留下的是「這門課最新一筆」的狀態＋退回理由，
  // 用來判斷退回後、還沒重新提交這段期間該顯示什麼（提交表單不能跟「從沒交過」長一樣）
  const ojtPending  = new Set();
  const ojtApproved = new Set();
  const ojtLatest    = new Map();
  for (let i = 1; i < ojtRows.length; i++) {
    if (String(ojtRows[i][ojtCols.UserId]).trim() !== String(userId).trim()) continue;
    const status   = String(ojtRows[i][ojtCols.Status]).trim();
    const courseId = String(ojtRows[i][ojtCols.CourseId]).trim();
    if (status === 'pending')  ojtPending.add(courseId);
    if (status === 'approved') ojtApproved.add(courseId);
    ojtLatest.set(courseId, {
      status,
      reason: (ojtCols.RejectReason !== undefined ? ojtRows[i][ojtCols.RejectReason] : '') || ''
    });
  }

  // 用快取的課程目錄 + 這位使用者的狀態疊加，不再每次整表讀 Courses
  const courses = catalog.map(c => ({
    id:              c.id,
    CourseId:        c.id,
    title:           c.title,
    category:        c.category,
    isGlobalMandatory: c.globalMandatory,                              // 不含部門加疊，給主管設定頁判斷用
    isMandatory:     c.globalMandatory || deptMandatorySet.has(c.id),  // 這位使用者實際的必修判定
    duration:        c.duration,
    badges:          c.badges,
    materialType:    c.materialType,
    materialUrl:     c.materialUrl,
    materialTextUrl: c.materialTextUrl,
    ojtRequired:     c.ojtRequired,
    ojtDescription:  c.ojtDescription,
    hasQuiz:         c.hasQuiz,       // 摘要與題目改由 getCourseDetail 取得
    hasSummary:      c.hasSummary,
    isCompleted:     completedSet.has(c.id) || ojtApproved.has(c.id),
    ojtStatus:       ojtApproved.has(c.id) ? 'approved'
                   : ojtPending.has(c.id)  ? 'pending'
                   : (ojtLatest.get(c.id) || {}).status === 'rejected' ? 'rejected'
                   : null,
    ojtRejectReason: (ojtLatest.get(c.id) || {}).status === 'rejected' ? (ojtLatest.get(c.id).reason || '') : ''
  }));

  return courses; // 前端直接收陣列
}

// ============================================================
// 4. getProgress
// POST { userId }
// → { status:'success', data:{ completedCourses, earnedBadges, totalLearningMinutes } }
// ============================================================

function getProgress({ userId, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.USER_PROGRESS));

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols.UserId]).trim() !== String(userId).trim()) continue;
    return {
      status: 'success',
      data: {
        completedCourses:    safeParseJSON(rows[i][cols.CompletedCourses], []),
        earnedBadges:        safeParseJSON(rows[i][cols.EarnedBadges], []),
        totalLearningMinutes: Number(rows[i][cols.TotalLearningMinutes]) || 0
      }
    };
  }

  // 新員工，尚無紀錄
  return {
    status: 'success',
    data: { completedCourses: [], earnedBadges: [], totalLearningMinutes: 0 }
  };
}

// ============================================================
// 5. completeCourse
// POST { userId, courseId, badges, isOJT, sessionToken }
// → { status:'success', success:true }
// ============================================================

function completeCourse({ userId, courseId, badges, isOJT, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  // OJT 課程的完課由 reviewOJTTask（主管核准後）觸發，這裡不寫入任何東西
  if (isOJT) return { status: 'success', success: true };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet(SHEET_NAMES.PROGRESS);
    const { cols, rows } = _readSheet(sheet);

    let alreadyExists = false;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][cols.UserId]).trim() === String(userId).trim() &&
          String(rows[i][cols.CourseId]).trim() === String(courseId).trim()) {
        alreadyExists = true;
        break;
      }
    }
    if (!alreadyExists) {
      sheet.appendRow(_buildRow(cols, {
        UserId: String(userId),
        CourseId: String(courseId),
        Badges: JSON.stringify(badges || []),
        CompletedAt: new Date()
      }));
    }

    // 同步彙總表：在後端 merge，不讓前端傳整包快照回來覆寫
    // （前端快照會抹掉 reviewOJTTask 或另一個分頁剛寫進去的完課與徽章）
    const merged = _mergeUserProgress(userId, {
      addCourseIds: [String(courseId)],
      addBadges:    badges || []
    });

    return { status: 'success', success: true, data: merged };
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// 內部：UserProgress 彙總表的唯一寫入點，一律「讀出來 merge 再寫回」
//
// 為什麼不讓前端傳整包快照：兩個分頁同時開、或主管核准 OJT 的同時員工
// 剛完課，後寫的那一方會用自己手上的舊快照覆蓋掉對方剛寫進去的資料
// （last-write-wins）。改成只收 delta、在後端做聯集／累加就沒有這問題。
//
// 呼叫者若已持有 script lock，這裡不再重複取得（GAS 的 lock 不可重入）。
// ------------------------------------------------------------
function _mergeUserProgress(userId, { addCourseIds, addBadges, addMinutes }) {
  const sheet = getSheet(SHEET_NAMES.USER_PROGRESS);
  const { cols, rows } = _readSheet(sheet);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols.UserId]).trim() !== String(userId).trim()) continue;

    const completed = safeParseJSON(rows[i][cols.CompletedCourses], []);
    const earned    = safeParseJSON(rows[i][cols.EarnedBadges], []);
    const minutes   = Number(rows[i][cols.TotalLearningMinutes]) || 0;

    const nextCompleted = [...new Set([...completed, ...(addCourseIds || [])])];
    const nextEarned    = [...new Set([...earned,    ...(addBadges    || [])])];
    const nextMinutes   = minutes + (Number(addMinutes) || 0);

    sheet.getRange(i + 1, cols.CompletedCourses + 1).setValue(JSON.stringify(nextCompleted));
    sheet.getRange(i + 1, cols.EarnedBadges + 1).setValue(JSON.stringify(nextEarned));
    sheet.getRange(i + 1, cols.TotalLearningMinutes + 1).setValue(nextMinutes);

    return {
      completedCourses: nextCompleted,
      earnedBadges: nextEarned,
      totalLearningMinutes: nextMinutes
    };
  }

  // 這位使用者還沒有彙總列，建一列
  const fresh = {
    completedCourses: [...new Set(addCourseIds || [])],
    earnedBadges: [...new Set(addBadges || [])],
    totalLearningMinutes: Number(addMinutes) || 0
  };
  sheet.appendRow(_buildRow(cols, {
    UserId: String(userId),
    CompletedCourses: JSON.stringify(fresh.completedCourses),
    EarnedBadges: JSON.stringify(fresh.earnedBadges),
    TotalLearningMinutes: fresh.totalLearningMinutes
  }));
  return fresh;
}

// ============================================================
// 6. updateProgress
// POST { userId, addMinutes, sessionToken }
// → { status:'success', data:{ ...merged progress } }
//
// 現在只用來累加學習時數（delta），不再接受整包快照覆寫。
// 完課與徽章一律走 completeCourse／reviewOJTTask，由後端 merge。
// ============================================================

function updateProgress({ userId, addMinutes, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const delta = Number(addMinutes) || 0;
  if (delta <= 0) return { status: 'error', message: 'addMinutes 必須大於 0' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const merged = _mergeUserProgress(userId, { addMinutes: delta });
    return { status: 'success', data: merged };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 7. submitOJT
// POST { userId, courseId, submitType:'file'|'link', fileName?, mimeType?, base64Data?, linkUrl? }
// → { status:'success' }
// ============================================================

function submitOJT({ userId, courseId, submitType, fileName, mimeType, base64Data, linkUrl, sessionToken }) {
  const authErr = _requireSession(sessionToken, userId);
  if (authErr) return { status: 'error', message: authErr };

  const MAX_BASE64_LENGTH = 5 * 1024 * 1024 * 1.37; // 對應前端 5MB 上限（base64 膨脹約1.37倍）
  if (submitType === 'file' && base64Data && base64Data.length > MAX_BASE64_LENGTH) {
    return { status: 'error', message: '檔案過大，請上傳 5MB 以內的檔案' };
  }

  const sheet = getSheet(SHEET_NAMES.OJT_TASKS);

  // 防重複送出：同一人同一課程若已經有一筆 pending，不再新增第二筆。
  // 鎖要包住「檢查＋寫入」整段，只鎖檢查那一下沒有用——兩個幾乎同時
  // 進來的請求會都通過檢查、都各自寫一筆，鎖等於沒鎖。
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const { cols: checkCols, rows: checkRows } = _readSheet(sheet);
    for (let i = 1; i < checkRows.length; i++) {
      if (String(checkRows[i][checkCols.UserId]).trim() === String(userId).trim()
        && String(checkRows[i][checkCols.CourseId]).trim() === String(courseId).trim()
        && String(checkRows[i][checkCols.Status]).trim() === 'pending') {
        return { status: 'error', message: '已經有一筆提交在等待審核，請勿重複送出' };
      }
    }

    const cols   = _colMap(sheet); // 純寫入（appendRow），不需要整表資料，維持單獨查欄位
    const taskId = `OJT-${courseId}-${userId}-${Date.now()}`;
    let fileUrl  = '';

    if (submitType === 'file' && base64Data) {
      try {
        const props    = PropertiesService.getScriptProperties();
        const folderId = props.getProperty('OJT_FOLDER_ID');
        const folder   = folderId
          ? DriveApp.getFolderById(folderId)
          : DriveApp.getRootFolder();

        const decoded = Utilities.base64Decode(base64Data);
        const blob    = Utilities.newBlob(decoded, mimeType, fileName);
        const file    = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      } catch (err) {
        return { status: 'error', message: '檔案上傳失敗：' + err.toString() };
      }
    } else if (submitType === 'link') {
      fileUrl = linkUrl || '';
    }

    sheet.appendRow(_buildRow(cols, {
      TaskId: taskId,
      UserId: String(userId),
      CourseId: String(courseId),
      Status: 'pending',
      SubmittedAt: new Date(),
      ApprovedAt: '',
      OjtFileUrl: fileUrl,
      IsSyncedToBQ: false
    }));
    return { status: 'success' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 8. getPendingOJTTasks
// POST { requestUserId, sessionToken }
// → { success:true, tasks:[ { rowNumber, taskId, userId, userName, courseId, courseTitle, ... } ] }
// ============================================================

function getPendingOJTTasks({ requestUserId, sessionToken } = {}) {
  const err = _requireManagerOrAdmin(sessionToken, requestUserId);
  if (err) return { status: 'error', message: err };

  const { cols: ojtCols,  rows: ojtRows }  = _readSheet(getSheet(SHEET_NAMES.OJT_TASKS));
  const { cols: userCols, rows: userRows } = _readSheet(getSheet(SHEET_NAMES.USERS));

  // Lookup maps
  const userMap = {};
  for (let i = 1; i < userRows.length; i++) {
    userMap[String(userRows[i][userCols.UserId]).trim()] = {
      name: userRows[i][userCols.Name],
      role: userRows[i][userCols.Role],
      department: String(userRows[i][userCols.Department] || '').trim()
    };
  }
  const courseMap = {};
  _getCourseCatalog().forEach(c => { courseMap[c.id] = { title: c.title, category: c.category }; });

  // manager 只能看自己部門的待審清單；admin 不限（跟 getDeptReport / reviewOJTTask 一致）
  const requester = userMap[String(requestUserId).trim()] || {};
  const requesterRole = String(requester.role || '').toLowerCase();
  const requesterDept = requester.department || '';

  const tasks = [];
  for (let i = 1; i < ojtRows.length; i++) {
    const r = ojtRows[i];
    if (!r[ojtCols.TaskId] || String(r[ojtCols.Status]).trim() !== 'pending') continue;

    const uid = String(r[ojtCols.UserId]).trim();
    const cid = String(r[ojtCols.CourseId]).trim();

    if (requesterRole === 'manager' && (userMap[uid] || {}).department !== requesterDept) continue;

    tasks.push({
      rowNumber:     i + 1,
      taskId:        r[ojtCols.TaskId],
      userId:        uid,
      courseId:      cid,
      status:        String(r[ojtCols.Status]).trim(),
      submittedAt:   r[ojtCols.SubmittedAt] ? new Date(r[ojtCols.SubmittedAt]).toISOString() : '',
      ojtFileUrl:    r[ojtCols.OjtFileUrl] || '',
      userName:      (userMap[uid]   || {}).name     || uid,
      userRole:      (userMap[uid]   || {}).role     || '',
      courseTitle:   (courseMap[cid] || {}).title    || cid,
      courseCategory:(courseMap[cid] || {}).category || ''
    });
  }

  return { success: true, status: 'success', tasks };
}

// ============================================================
// 9. reviewOJTTask
// POST { rowNumber, newStatus:'approved'|'rejected', requestUserId, sessionToken }
// → { success:true }
// ============================================================

function reviewOJTTask({ rowNumber, taskId, newStatus, rejectReason, requestUserId, sessionToken }) {
  const err = _requireManagerOrAdmin(sessionToken, requestUserId);
  if (err) return { status: 'error', message: err };

  if (newStatus !== 'approved' && newStatus !== 'rejected') {
    return { status: 'error', message: '無效的審核狀態' };
  }
  if (newStatus === 'rejected' && !String(rejectReason || '').trim()) {
    return { status: 'error', message: '退回請填寫理由，員工才知道要怎麼修改' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ojtSheet = getSheet(SHEET_NAMES.OJT_TASKS);
    const { cols: ojtCols, rows: ojtRows } = _readSheet(ojtSheet);

    // 用 taskId 定位，不信任前端傳來的 rowNumber（列號會因為插入/刪除列而位移，
    // 或被竄改成別人的作業）。rowNumber 只當找不到 taskId 時的相容退路。
    let targetIdx = -1;
    if (taskId) {
      for (let i = 1; i < ojtRows.length; i++) {
        if (String(ojtRows[i][ojtCols.TaskId]).trim() === String(taskId).trim()) {
          targetIdx = i;
          break;
        }
      }
      if (targetIdx === -1) return { status: 'error', message: '找不到這筆作業（可能已被處理）' };
    } else if (rowNumber && rowNumber >= 2 && rowNumber <= ojtRows.length) {
      targetIdx = rowNumber - 1;
    } else {
      return { status: 'error', message: '缺少 taskId' };
    }

    const row      = ojtRows[targetIdx];
    const targetRow = targetIdx + 1; // 1-indexed 供 getRange 使用
    const userId   = String(row[ojtCols.UserId]).trim();
    const courseId = String(row[ojtCols.CourseId]).trim();

    // 只有還在 pending 的作業可以審核，避免重複核准或覆蓋已審結果
    if (String(row[ojtCols.Status]).trim() !== 'pending') {
      return { status: 'error', message: '這筆作業已經審核過了，請重新整理' };
    }

    // manager 只能審自己部門的人；admin 不限
    const { cols: userCols, rows: userRows } = _readSheet(getSheet(SHEET_NAMES.USERS));
    let reviewerRole = '', reviewerDept = '', targetDept = '';
    for (let i = 1; i < userRows.length; i++) {
      const uid = String(userRows[i][userCols.UserId]).trim();
      if (uid === String(requestUserId).trim()) {
        reviewerRole = String(userRows[i][userCols.Role] || '').toLowerCase();
        reviewerDept = String(userRows[i][userCols.Department] || '').trim();
      }
      if (uid === userId) {
        targetDept = String(userRows[i][userCols.Department] || '').trim();
      }
    }
    if (reviewerRole === 'manager' && reviewerDept !== targetDept) {
      return { status: 'error', message: '只能審核自己部門同仁的作業' };
    }

    ojtSheet.getRange(targetRow, ojtCols.Status + 1).setValue(newStatus);

    if (newStatus === 'rejected' && ojtCols.RejectReason !== undefined) {
      ojtSheet.getRange(targetRow, ojtCols.RejectReason + 1).setValue(String(rejectReason).trim());
    }

    if (newStatus === 'approved') {
      ojtSheet.getRange(targetRow, ojtCols.ApprovedAt + 1).setValue(new Date());

      // Progress sheet：新增完課紀錄
      const progressSheet = getSheet(SHEET_NAMES.PROGRESS);
      const { cols: progressCols, rows: progressRows } = _readSheet(progressSheet);
      let exists = false;
      for (let i = 1; i < progressRows.length; i++) {
        if (String(progressRows[i][progressCols.UserId]).trim() === userId &&
            String(progressRows[i][progressCols.CourseId]).trim() === courseId) {
          exists = true; break;
        }
      }
      if (!exists) {
        progressSheet.appendRow(_buildRow(progressCols, {
          UserId: userId, CourseId: courseId, Badges: '[]', CompletedAt: new Date()
        }));
      }

      // 該課程的徽章（從快取的課程目錄拿，不用整表讀 Courses）
      const course = _getCourseCatalog().filter(c => c.id === courseId)[0];
      const badges = course ? course.badges : [];

      // 彙總表一律走共用的 merge，不自己讀寫（避免又出現覆寫問題）
      _mergeUserProgress(userId, { addCourseIds: [courseId], addBadges: badges });
    }

    return { success: true, status: 'success' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 10. generateAiContent
// POST { courseId, userId, sessionToken }
//
// 優先順序：
//   1. Transcript 有逐字稿 → 直接文字分析（最快最穩）
//   2. MaterialTextUrl（Google Doc）→ 直接讀文件文字
//   3. materialType = pdf → inline 讀 PDF
//   4. materialType = audio → inline 讀音檔
//   5. 其他 → 用標題 fallback
// ============================================================

function generateAiContent({ courseId, userId, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const courseSheet = getSheet(SHEET_NAMES.COURSES);
  const { cols, rows } = _readSheet(courseSheet);

  let targetRow = -1, title = '', category = '', materialType = '', materialUrl = '', materialTextUrl = '', ojtDesc = '', transcript = '', existingSummary = '';
  for (let i = 2; i < rows.length; i++) {
    if (String(rows[i][cols.CourseId]).trim() === String(courseId).trim()) {
      targetRow       = i + 1;
      title           = rows[i][cols.Title];
      category        = rows[i][cols.Category];
      materialType    = String(rows[i][cols.MaterialType] || '').toLowerCase();
      materialUrl     = rows[i][cols.MaterialUrl] || '';
      materialTextUrl = rows[i][cols.MaterialTextUrl] || '';
      ojtDesc         = rows[i][cols.OjtDescription] || '';
      existingSummary = rows[i][cols.AiSummary] || '';
      transcript      = rows[i][cols.Transcript] || '';
      break;
    }
  }
  if (targetRow === -1) return { status: 'error', message: '找不到課程' };

  // 已生成過就不重打 Vertex AI（防止重複觸發浪費費用）
  if (existingSummary) return { status: 'success', success: true, message: '已存在，略過重新生成' };

  try {
    let result;

    if (transcript) {
      // 優先 1：有逐字稿
      result = _aiFromTranscript(title, category, transcript);

    } else if (materialTextUrl) {
      // 優先 2：有 MaterialTextUrl（Google Doc）→ 直接讀文件文字
      const docText = _getGoogleDocText(materialTextUrl);
      result = _aiFromTranscript(title, category, docText);

    } else if (materialType === 'pdf') {
      // 優先 3：PDF → inline 讀檔
      result = _aiFromFile(materialUrl, 'pdf', title, category);

    } else if (materialType === 'audio') {
      // 優先 4：音檔 → inline 讀檔
      result = _aiFromAudioInline(materialUrl, title, category);

    } else {
      // Fallback：用標題生成
      result = _aiFromTitle(title, category, ojtDesc);
    }

    courseSheet.getRange(targetRow, cols.AiSummary + 1).setValue(JSON.stringify(result.summary || []));
    courseSheet.getRange(targetRow, cols.AiQuiz + 1).setValue(JSON.stringify(result.quiz || []));
    _invalidateCourseCache(); // hasQuiz/hasSummary 旗標變了，快取要失效
    return { status: 'success', success: true };

  } catch (err) {
    return { status: 'error', message: 'AI 生成失敗：' + err.toString() };
  }
}

// ------------------------------------------------------------
// 內部：從 PDF（小檔）直接 inline 送 Vertex AI
// ------------------------------------------------------------
function _aiFromFile(driveUrl, fileType, title, category) {
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('無法解析 Drive 連結：' + driveUrl);

  const fileId = match[1];
  const file   = DriveApp.getFileById(fileId);
  const blob   = file.getBlob();
  const base64 = Utilities.base64Encode(blob.getBytes());

  let mimeType = blob.getContentType();
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = 'application/pdf';
  }

  const prompt = _buildPrompt(title, category, fileType);

  const response = _fetchGemini({
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: prompt }
      ]
    }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
  });

  return _parseGeminiResponse(response);
}

// ------------------------------------------------------------
// 內部：音檔 inline 送 Vertex AI（Vertex 無 Files API，故不走上傳流程）
// 注意：inline 請求有大小限制（約 20MB），過大的音檔請改用逐字稿（Transcript）方式
// ------------------------------------------------------------
function _aiFromAudioInline(driveUrl, title, category) {
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('無法解析 Drive 連結：' + driveUrl);

  const fileId   = match[1];
  const file     = DriveApp.getFileById(fileId);
  const blob     = file.getBlob();
  let   mimeType = blob.getContentType();
  if (!mimeType || mimeType === 'application/octet-stream') mimeType = 'audio/mp4';

  const base64 = Utilities.base64Encode(blob.getBytes());
  const prompt = _buildPrompt(title, category, 'audio');

  const response = _fetchGemini({
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: prompt }
      ]
    }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
  });

  return _parseGeminiResponse(response);
}

// ------------------------------------------------------------
// [工具函式] batchGenerateAllAiContent()
//
// 用途：批次為所有「尚無 AiSummary」的課程產生 AI 內容
//       優先順序跟 generateAiContent 一致：逐字稿 > Google Doc > PDF > 音檔 inline > 標題 fallback
//
// 使用方式：
//   直接在 GAS 編輯器執行此函式（非 web app 觸發）
//   每次處理一門課，若 timeout 就再執行一次，會跳過已完成的
// ------------------------------------------------------------
function batchGenerateAllAiContent() {
  const sheet = getSheet(SHEET_NAMES.COURSES);
  const { cols, rows } = _readSheet(sheet);

  let processed = 0;

  for (let i = 2; i < rows.length; i++) {
    const r               = rows[i];
    const courseId        = String(r[cols.CourseId]).trim();
    const title           = r[cols.Title];
    const category        = r[cols.Category];
    const matType         = String(r[cols.MaterialType] || '').toLowerCase();
    const matUrl           = r[cols.MaterialUrl] || '';
    const materialTextUrl = r[cols.MaterialTextUrl] || '';
    const aiSummary        = r[cols.AiSummary];
    const transcript       = r[cols.Transcript] || '';

    if (!courseId) continue;
    if (aiSummary)  { Logger.log(`⏭ 跳過（已有內容）：${courseId} ${title}`); continue; }
    if (!matUrl && !transcript && !materialTextUrl) { Logger.log(`⚠️ 無媒體連結，跳過：${courseId}`); continue; }

    Logger.log(`🔄 處理中：${courseId} ${title} [${matType}]`);

    try {
      let result;
      if (transcript) {
        result = _aiFromTranscript(title, category, transcript);
      } else if (materialTextUrl) {
        result = _aiFromTranscript(title, category, _getGoogleDocText(materialTextUrl));
      } else if (matType === 'pdf') {
        result = _aiFromFile(matUrl, 'pdf', title, category);
      } else if (matType === 'audio') {
        result = _aiFromAudioInline(matUrl, title, category);
      } else {
        result = _aiFromTitle(title, category, r[cols.OjtDescription] || '');
      }

      sheet.getRange(i + 1, cols.AiSummary + 1).setValue(JSON.stringify(result.summary || []));
      sheet.getRange(i + 1, cols.AiQuiz + 1).setValue(JSON.stringify(result.quiz || []));
      Logger.log(`✅ 完成：${courseId}`);
      processed++;

      // 每處理一個稍停，避免 API rate limit
      Utilities.sleep(2000);

    } catch (err) {
      Logger.log(`❌ 失敗：${courseId}｜${err.toString()}`);
    }
  }

  _invalidateCourseCache(); // 課程內容有變，清掉目錄快取
  Logger.log(`\n批次完成，共處理 ${processed} 門課程。`);
}

// ------------------------------------------------------------
// 內部：共用 Prompt 產生器
// ------------------------------------------------------------
function _buildPrompt(title, category, fileType) {
  const context = fileType === 'audio'
    ? `這是一段企業培訓音檔（課程：${title}，分類：${category}）。請完整理解音檔內容後輸出。`
    : fileType === 'pdf'
    ? `這是一份企業培訓文件（課程：${title}，分類：${category}）。請閱讀全文後輸出。`
    : `課程名稱：${title}，分類：${category}。`;

  return `${context}

請根據內容的豐富程度自行判斷：summary 條數（2～6條）與 quiz 題數（3～8題），不要硬湊也不要刪減重要內容。
輸出純 JSON，不要有 markdown 或說明文字：
{
  "summary": ["重點1（約50字，根據實際內容）","重點2",...],
  "quiz": [
    {"question":"情境題題幹","options":["A","B","C","D"],"answer":0},
    ...
  ]
}
summary 每條必須來自實際內容；quiz 為情境選擇題，answer 為正確選項 index（0-3）。`;
}

// ------------------------------------------------------------
// 內部：從 Google Doc URL 取得純文字內容
// ------------------------------------------------------------
function _getGoogleDocText(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('無法解析 Google Doc 連結：' + url);
  const doc = DocumentApp.openById(match[1]);
  return doc.getBody().getText();
}

// ------------------------------------------------------------
// 內部：從逐字稿文字生成摘要 + 題目（最穩定的方式）
// ------------------------------------------------------------
function _aiFromTranscript(title, category, transcript) {
  const prompt = `你是一位企業培訓設計師。以下是一門課程的逐字稿內容。

課程名稱：${title}
課程分類：${category}

逐字稿：
${transcript}

請根據逐字稿的豐富程度自行判斷 summary 條數（2～6條）與 quiz 題數（3～8題），不要硬湊也不要刪減重要內容。
輸出純 JSON（不要有 markdown 或說明文字）：
{
  "summary": ["重點1（約50字，直接摘自內容的核心觀念）","重點2",...],
  "quiz": [
    {"question":"根據逐字稿內容設計的情境題","options":["A","B","C","D"],"answer":0},
    ...
  ]
}
summary 每條必須來自逐字稿內容；quiz 為情境選擇題，answer 為正確選項 index（0-3）。`;

  const response = _fetchGemini({
    contents:         [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
  });

  return _parseGeminiResponse(response);
}

// ------------------------------------------------------------
// 內部：純文字 fallback（video 或沒有媒體檔的課程）
// ------------------------------------------------------------
function _aiFromTitle(title, category, ojtDesc) {
  const prompt = `你是一位企業培訓設計師。請針對以下課程，輸出純 JSON（不要有 markdown、不要有說明文字）。

課程名稱：${title}
課程分類：${category}
OJT說明：${ojtDesc}

請根據課程內容的豐富程度自行判斷 summary 條數（2～4條）與 quiz 題數（2～5題）。
{
  "summary": ["重點1（約50字）", "重點2", ...],
  "quiz": [
    { "question": "情境題", "options": ["A","B","C","D"], "answer": 0 },
    ...
  ]
}`;

  const response = _fetchGemini({
    contents:         [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } }
  });

  return _parseGeminiResponse(response);
}

// ------------------------------------------------------------
// 內部：Vertex AI generateContent endpoint
// ------------------------------------------------------------
function _vertexEndpoint(model) {
  const props     = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('VERTEX_PROJECT_ID');
  const location  = props.getProperty('VERTEX_LOCATION') || 'us-central1';
  if (!projectId) throw new Error('未設定 VERTEX_PROJECT_ID（Script Properties）');
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

// ------------------------------------------------------------
// 內部：帶 retry 的 Vertex AI fetch（OAuth，自動重試 503）
// ------------------------------------------------------------
function _fetchGemini(payload, model) {
  const url   = _vertexEndpoint(model || 'gemini-2.5-flash');
  const token = ScriptApp.getOAuthToken();

  for (let i = 0; i < 3; i++) {
    const resp = UrlFetchApp.fetch(url, {
      method:      'post',
      contentType: 'application/json',
      headers:     { Authorization: 'Bearer ' + token },
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 503) return resp;
    Utilities.sleep(2000);
  }
  throw new Error('Gemini 服務暫時忙碌中，請稍後再試');
}

// ------------------------------------------------------------
// 內部：解析 Gemini 回應
// ------------------------------------------------------------
function _parseGeminiResponse(response) {
  const raw  = response.getContentText();
  const json = JSON.parse(raw);

  if (!json.candidates || !json.candidates[0]) {
    throw new Error('Gemini 無回應：' + raw.substring(0, 200));
  }

  let text = json.candidates[0].content.parts[0].text;
  // 去掉 Gemini 可能包的 markdown code block
  text = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini 回應無法解析為 JSON：' + text.substring(0, 200));

  return JSON.parse(match[0]);
}

// ============================================================
// [工具函式] testVertexConnection()
// 用途：單獨測試 Vertex AI 連線是否成功，不動任何 Sheet 資料
// 使用方式：GAS 編輯器選這個函式，直接執行，看「執行紀錄」的輸出
// ============================================================
function testVertexConnection() {
  try {
    Logger.log('專案 ID：' + PropertiesService.getScriptProperties().getProperty('VERTEX_PROJECT_ID'));
    Logger.log('Region：' + (PropertiesService.getScriptProperties().getProperty('VERTEX_LOCATION') || 'us-central1（預設）'));

    const response = _fetchGemini({
      contents: [{ role: 'user', parts: [{ text: '請回覆「連線成功」兩個字即可，不要有其他文字。' }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 50 }
    });

    Logger.log('HTTP 狀態碼：' + response.getResponseCode());
    Logger.log('回應內容：' + response.getContentText());
  } catch (err) {
    Logger.log('❌ 錯誤：' + err.toString());
  }
}

// ============================================================
// [工具函式] checkSheetHeaders()
//
// 用途：一次檢查六張表的標題列是否跟程式碼期待的欄位名稱完全一致。
//       欄位名稱查表機制的唯一前提就是「標題文字要對」，這個函式
//       把所有對不上的地方一次列出來，不用一個一個猜。
//
// 使用方式：GAS 編輯器選這個函式執行，看「執行紀錄」。
//          全部顯示 ✅ 才代表 Sheet 結構跟程式碼一致。
// ============================================================
function checkSheetHeaders() {
  const expected = {
    [SHEET_NAMES.USERS]:          ['UserId', 'Email', 'Name', 'Role', 'CreatedAt', 'LastLogin', 'Password', 'IsFirstLogin', 'Department'],
    [SHEET_NAMES.COURSES]:        ['CourseId', 'Title', 'Category', 'IsMandatory', 'Duration', 'Badges', 'MaterialType', 'MaterialUrl', 'MaterialTextUrl', 'OjtRequired', 'OjtDescription', 'AiSummary', 'AiQuiz', 'Transcript'],
    [SHEET_NAMES.PROGRESS]:       ['UserId', 'CourseId', 'Badges', 'CompletedAt'],
    [SHEET_NAMES.USER_PROGRESS]:  ['UserId', 'CompletedCourses', 'EarnedBadges', 'TotalLearningMinutes'],
    [SHEET_NAMES.OJT_TASKS]:      ['TaskId', 'UserId', 'CourseId', 'Status', 'SubmittedAt', 'ApprovedAt', 'OjtFileUrl', 'IsSyncedToBQ'],
    [SHEET_NAMES.DEPT_MANDATORY]: ['DeptId', 'CourseId']
  };
  // 注意：NotificationLog 不在這裡檢查——它是 checkOverdueAndNotify 第一次執行時
  // 自動建立的紀錄表，不是使用者維護的資料表，執行前不存在是正常狀態
  // 選填欄位（沒有也不算錯，只是對應功能不會生效）
  const optional = {
    [SHEET_NAMES.COURSES]:        ['DueDate'],
    [SHEET_NAMES.DEPT_MANDATORY]: ['DueDays']
  };

  let allOk = true;

  Object.keys(expected).forEach(sheetName => {
    const sheet = getSheet(sheetName);
    if (!sheet) {
      Logger.log(`❌ 找不到工作表：${sheetName}`);
      allOk = false;
      return;
    }

    const cols    = _colMap(sheet);
    const missing = expected[sheetName].filter(c => cols[c] === undefined);
    // 原始標題（未經別名正規化），方便對照 Sheet 上實際看到的文字
    const rawHeader = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h).trim()).filter(h => h);

    if (missing.length === 0) {
      Logger.log(`✅ ${sheetName}`);
    } else {
      Logger.log(`❌ ${sheetName} 缺少欄位：${missing.join('、')}`);
      Logger.log(`   Sheet 上的實際標題：${rawHeader.join(' | ')}`);
      Logger.log(`   程式實際認得的欄位：${Object.keys(cols).join(' | ')}`);
      allOk = false;
    }

    (optional[sheetName] || []).forEach(c => {
      if (cols[c] === undefined) {
        Logger.log(`   ⚠️ ${sheetName} 沒有選填欄位 ${c}（該功能不會生效，不影響其他功能）`);
      }
    });
  });

  Logger.log(allOk ? '\n全部通過，Sheet 結構與程式碼一致。' : '\n有欄位對不上，請照上面訊息修正標題文字。');
}

// ============================================================
// [工具函式] dumpProblemSheets()
//
// 用途：把 Users 與 DeptMandatory 兩張表的前幾列「逐格」印出來（含空白格
//       與隱藏字元），用來判斷欄位到底是「標題格空白但有資料」還是
//       「整欄沒資料」、以及一格裡面是不是塞了 Tab 之類的隱藏字元。
//       checkSheetHeaders 會過濾空白標題，看不出這些狀況，所以另開這個。
//
// 使用方式：GAS 編輯器選這個函式執行，把「執行紀錄」整段貼回來。
// ============================================================
function dumpProblemSheets() {
  [SHEET_NAMES.USERS, SHEET_NAMES.DEPT_MANDATORY].forEach(name => {
    const sheet = getSheet(name);
    if (!sheet) { Logger.log(`找不到工作表：${name}`); return; }

    const lastCol = Math.max(sheet.getLastColumn(), 10);
    const lastRow = Math.min(sheet.getLastRow(), 4); // 只看前幾列，避免印出全部個資
    const values  = sheet.getRange(1, 1, lastRow, lastCol).getValues();

    Logger.log(`\n===== ${name}（共 ${sheet.getLastColumn()} 欄 / ${sheet.getLastRow()} 列）=====`);
    values.forEach((row, r) => {
      const cells = row.map((v, c) => {
        const letter = String.fromCharCode(65 + c);
        let shown;
        if (v === '' || v === null) {
          shown = '(空白)';
        } else {
          // 把 Tab / 換行顯示成看得見的符號，找出貼上時混進來的隱藏字元
          shown = String(v).replace(/\t/g, '⇥').replace(/\n/g, '⏎');
        }
        return `${letter}${r + 1}=${shown}`;
      });
      Logger.log(cells.join('  |  '));
    });
  });
}

// ============================================================
// [工具函式] forceVertexAuth_v2()
// 用途：全新函式，強迫 GAS 重新計算這次執行需要的權限範圍，
//       避免舊的授權快取讓 cloud-platform scope 被跳過檢查。
// 使用方式：函式下拉選單選「forceVertexAuth_v2」直接執行，
//       務必觀察是否跳出全新授權視窗，並檢查視窗列出的權限項目。
// ============================================================
function forceVertexAuth_v2() {
  const token = ScriptApp.getOAuthToken();
  Logger.log('取得 token 長度：' + (token ? token.length : 0));

  const projectId = PropertiesService.getScriptProperties().getProperty('VERTEX_PROJECT_ID');
  const location   = PropertiesService.getScriptProperties().getProperty('VERTEX_LOCATION') || 'us-central1';
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash:generateContent`;

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 10 }
    }),
    muteHttpExceptions: true
  });

  Logger.log('狀態碼：' + resp.getResponseCode());
  Logger.log('內容：' + resp.getContentText());
}

// ============================================================
// [工具函式] fixInflatedLearningMinutes()
//
// 用途：修正計時器 bug 造成的歷史時數膨脹。前端計時器除數原本寫死
//       6000（6秒算1分鐘），正式上線後才修正為 60000，這之前用
//       updateProgress 存進 UserProgress 的 TotalLearningMinutes
//       全部是實際值的 10 倍，跑這個函式把現有數字除以 10 修正回來。
//
// 使用方式：GAS 編輯器選這個函式，執行一次即可（只需要跑一次，
//          重複執行會把已經修正過的值再除一次 10，變成錯誤數字）
//          執行後看「執行紀錄」確認修正了幾筆、每筆修正前後的值
// ============================================================
function fixInflatedLearningMinutes() {
  const sheet = getSheet(SHEET_NAMES.USER_PROGRESS);
  const { cols, rows } = _readSheet(sheet);

  let fixed = 0;
  for (let i = 1; i < rows.length; i++) {
    const current = Number(rows[i][cols.TotalLearningMinutes]) || 0;
    if (current <= 0) continue;

    const corrected = Math.round(current / 10);
    sheet.getRange(i + 1, cols.TotalLearningMinutes + 1).setValue(corrected);
    Logger.log(`${rows[i][cols.UserId]}：${current} → ${corrected}`);
    fixed++;
  }

  Logger.log(`\n完成，共修正 ${fixed} 筆。`);
}

// ============================================================
// [工具函式] fixMaterialUrls(folderId)
//
// 用途：把 Drive 資料夾內的檔案批次對應到 Courses sheet，
//       自動更新 MaterialUrl 欄位。
//
// 使用方式：
//   1. 把所有課程檔案上傳到同一個 Google Drive 資料夾
//   2. 開啟資料夾，從網址取得 folder ID
//      (網址格式: drive.google.com/drive/folders/[FOLDER_ID])
//   3. 在 GAS 編輯器把下面的 FOLDER_ID 換掉，然後執行此函式
//   4. 執行後到「執行紀錄」確認哪些有更新、哪些沒對到
// ============================================================

function fixMaterialUrls() {
  const FOLDER_ID = '1rSdkIWVc8I2uqoAzqQVePAxnuarNm-sM';

  const folder  = DriveApp.getFolderById(FOLDER_ID);
  const files   = folder.getFiles();
  const sheet   = getSheet(SHEET_NAMES.COURSES);
  const { cols, rows } = _readSheet(sheet);

  // 建立 Drive 檔案 map：{ 檔名小寫 → { id, name, mimeType } }
  const driveMap = {};
  while (files.hasNext()) {
    const file     = files.next();
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    driveMap[file.getName().toLowerCase()] = {
      id:       file.getId(),
      name:     file.getName(),
      mimeType: file.getMimeType()
    };
    Logger.log(`Drive 檔案: ${file.getName()} (${file.getMimeType()})`);
  }

  // 對應規則：CourseId 前綴 → 關鍵字
  // EP 系列用 EP+數字對應，其他用關鍵字
  const matchRules = {
    'A000': ['ep00', 'ep-00'],
    'A001': ['ep01', 'ep-01'],
    'A002': ['ep02', 'ep-02'],
    'A003': ['ep03', 'ep-03'],
    'A004': ['ep04', 'ep-04'],
    'A005': ['ep05', 'ep-05'],
    'A006': ['ep06', 'ep-06'],
    'A007': ['ep07', 'ep-07'],
    'A008': ['ep08', 'ep-08'],
    'A009': ['ep09', 'ep-09'],
    'A010': ['ep10', 'ep-10'],
    'A011': ['ep11', 'ep-11'],
    'A012': ['ep12', 'ep-12'],
    'A013': ['ep13', 'ep-13'],
    'A014': ['ep14', 'ep-14'],
    'A015': ['ep15', 'ep-15'],
    'A016': ['ep16', 'ep-16'],
    'A017': ['ep17', 'ep-17'],
    'A018': ['ep18', 'ep-18'],
    'A019': ['ep19', 'ep-19'],
    'A020': ['ep20', 'ep-20'],
    'B001': ['創意思維', 'creative'],
    'C001': ['ai基礎', 'ai實作', 'ai-1', 'ai_1', 'ai基礎功-1', '基礎課-1'],
    'C002': ['ai基礎功-2', '基礎課-2', 'ai-2'],
    'C003': ['ai基礎功-3', '基礎課-3', 'ai-3'],
  };

  let updated = 0;
  let skipped = 0;

  for (let i = 2; i < rows.length; i++) {
    const courseId = String(rows[i][cols.CourseId]).trim();
    if (!courseId) continue;

    const keywords = matchRules[courseId];
    if (!keywords) {
      Logger.log(`⚠️ 無對應規則：${courseId}`);
      skipped++;
      continue;
    }

    // 找符合關鍵字的 Drive 檔案
    let matchedUrl = null;
    for (const [fileName, url] of Object.entries(driveMap)) {
      if (keywords.some(kw => fileName.includes(kw.toLowerCase()))) {
        matchedUrl = url;
        break;
      }
    }

    if (matchedUrl) {
      const fileId   = matchedUrl.id;
      const mime     = matchedUrl.mimeType || '';
      const isAudio  = mime.startsWith('audio/') || /\.(m4a|mp3|ogg|wav|aac)$/i.test(matchedUrl.name);
      const isPdf    = mime === 'application/pdf' || /\.pdf$/i.test(matchedUrl.name);

      // 音檔用直接串流 URL（HTML5 Audio 可直接播放）
      // PDF 用 Google Docs Viewer（避開 frame-ancestors 限制）
      // 其他用 /preview
      let url;
      if (isAudio) {
        url = `https://drive.google.com/uc?export=download&id=${fileId}`;
      } else if (isPdf) {
        url = `https://docs.google.com/viewer?url=https://drive.google.com/uc%3Fid%3D${fileId}&embedded=true`;
      } else {
        url = `https://drive.google.com/file/d/${fileId}/preview`;
      }

      sheet.getRange(i + 1, cols.MaterialUrl + 1).setValue(url);
      Logger.log(`✅ ${courseId} [${isAudio ? 'audio' : isPdf ? 'pdf' : 'other'}] → ${url}`);
      updated++;
    } else {
      Logger.log(`❌ 找不到對應檔案：${courseId}（關鍵字：${keywords.join(', ')}）`);
      skipped++;
    }
  }

  _invalidateCourseCache(); // MaterialUrl 有變，清掉目錄快取
  Logger.log(`\n完成！更新：${updated} 筆 / 未對應：${skipped} 筆`);
}

// ============================================================
// 11. getDeptReport
// POST { deptId, requestUserId }
// → { status:'success', data:{ totalUsers, overallMandatoryRate, employees, courseStats } }
// ============================================================

function getDeptReport({ deptId, requestUserId, sessionToken }) {
  const authErr = _requireManagerOrAdmin(sessionToken, requestUserId);
  if (authErr) return { status: 'error', message: authErr };

  const { cols: userCols, rows: userRows } = _readSheet(getSheet(SHEET_NAMES.USERS));

  // 驗證權限：manager 只能看自己部門，admin 可以看全部
  let requesterRole = '', requesterDept = '';
  for (let i = 1; i < userRows.length; i++) {
    if (String(userRows[i][userCols.UserId]).trim() === String(requestUserId).trim()) {
      requesterRole = String(userRows[i][userCols.Role] || '').toLowerCase();
      requesterDept = String(userRows[i][userCols.Department] || '').trim();
      break;
    }
  }
  if (requesterRole === 'manager' && requesterDept !== deptId) {
    return { status: 'error', message: '無權限查看此部門' };
  }
  if (requesterRole !== 'admin' && requesterRole !== 'manager') {
    return { status: 'error', message: '權限不足' };
  }

  // 取得部門員工（employee 角色）
  const deptUsers = [];
  for (let i = 1; i < userRows.length; i++) {
    const dept = String(userRows[i][userCols.Department] || '').trim();
    const role = String(userRows[i][userCols.Role] || '').toLowerCase();
    if (dept === deptId && role === 'employee') {
      deptUsers.push({ userId: String(userRows[i][userCols.UserId]).trim(), name: userRows[i][userCols.Name] });
    }
  }

  // 取得全域 + 部門必修課（課程用快取目錄，不整表讀 Courses）
  const catalog = _getCourseCatalog();
  const { cols: dmCols, rows: dmRows } = _readSheet(getSheet(SHEET_NAMES.DEPT_MANDATORY));

  const deptMandatorySet = new Set();
  for (let i = 1; i < dmRows.length; i++) {
    if (String(dmRows[i][dmCols.DeptId]).trim() === deptId) {
      deptMandatorySet.add(String(dmRows[i][dmCols.CourseId]).trim());
    }
  }

  const allCourses       = catalog.map(c => ({ courseId: c.id, title: c.title }));
  const mandatoryCourses = catalog
    .filter(c => c.globalMandatory || deptMandatorySet.has(c.id))
    .map(c => ({ courseId: c.id, title: c.title }));

  // 建立每位員工的完課 Set
  const { cols: progressCols, rows: progressRows } = _readSheet(getSheet(SHEET_NAMES.PROGRESS));
  const { cols: ojtCols,      rows: ojtRows }      = _readSheet(getSheet(SHEET_NAMES.OJT_TASKS));
  const completionMap = {};
  for (const u of deptUsers) completionMap[u.userId] = new Set();

  for (let i = 1; i < progressRows.length; i++) {
    const uid = String(progressRows[i][progressCols.UserId]).trim();
    if (completionMap[uid]) completionMap[uid].add(String(progressRows[i][progressCols.CourseId]).trim());
  }
  for (let i = 1; i < ojtRows.length; i++) {
    const uid = String(ojtRows[i][ojtCols.UserId]).trim();
    if (String(ojtRows[i][ojtCols.Status]).trim() === 'approved' && completionMap[uid]) {
      completionMap[uid].add(String(ojtRows[i][ojtCols.CourseId]).trim());
    }
  }

  // 每位員工報告
  const employees = deptUsers.map(u => {
    const completed = completionMap[u.userId] || new Set();
    const mandatoryIncomplete = mandatoryCourses
      .filter(c => !completed.has(c.courseId))
      .map(c => ({ courseId: c.courseId, title: c.title }));
    return {
      userId:             u.userId,
      name:               u.name,
      completedCount:     completed.size,
      totalCourses:       allCourses.length,
      mandatoryTotal:     mandatoryCourses.length,
      mandatoryCompleted: mandatoryCourses.length - mandatoryIncomplete.length,
      mandatoryIncomplete
    };
  });

  // 每門必修課的完成率
  const courseStats = mandatoryCourses.map(c => {
    const completedCount = deptUsers.filter(u =>
      (completionMap[u.userId] || new Set()).has(c.courseId)
    ).length;
    return {
      courseId:       c.courseId,
      title:          c.title,
      completedCount,
      totalUsers:     deptUsers.length,
      completionRate: deptUsers.length > 0
        ? Math.round(completedCount / deptUsers.length * 100) : 0
    };
  });

  const totalSlots     = deptUsers.length * mandatoryCourses.length;
  const completedSlots = employees.reduce((acc, e) => acc + e.mandatoryCompleted, 0);

  return {
    status: 'success',
    data: {
      deptId,
      totalUsers:           deptUsers.length,
      mandatoryCourseCount: mandatoryCourses.length,
      overallMandatoryRate: totalSlots > 0
        ? Math.round(completedSlots / totalSlots * 100) : 0,
      employees,
      courseStats,
      mandatoryCourses
    }
  };
}

// ============================================================
// 12. getDeptMandatory
// POST { deptId }
// → { status:'success', courseIds:[] }
// ============================================================

function getDeptMandatory({ deptId, requestUserId, sessionToken }) {
  const err = _requireManagerOrAdmin(sessionToken, requestUserId);
  if (err) return { status: 'error', message: err };

  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.DEPT_MANDATORY));
  const courseIds = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][cols.DeptId]).trim() === deptId) {
      courseIds.push(String(rows[i][cols.CourseId]).trim());
    }
  }
  return { status: 'success', courseIds };
}

// ============================================================
// 13. setDeptMandatory
// POST { deptId, courseId, isAdd:true|false, requestUserId, sessionToken }
// → { status:'success' }
// ============================================================

function setDeptMandatory({ deptId, courseId, isAdd, requestUserId, sessionToken }) {
  const err = _requireManagerOrAdmin(sessionToken, requestUserId);
  if (err) return { status: 'error', message: err };

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getSheet(SHEET_NAMES.DEPT_MANDATORY);
    const { cols, rows } = _readSheet(sheet);

    if (isAdd) {
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][cols.DeptId]).trim() === deptId && String(rows[i][cols.CourseId]).trim() === courseId) {
          return { status: 'success', message: '已存在' };
        }
      }
      sheet.appendRow(_buildRow(cols, { DeptId: deptId, CourseId: courseId }));
      return { status: 'success' };
    } else {
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][cols.DeptId]).trim() === deptId && String(rows[i][cols.CourseId]).trim() === courseId) {
          sheet.deleteRow(i + 1);
          return { status: 'success' };
        }
      }
      return { status: 'success', message: '不存在' };
    }
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// submitQuiz
// POST { userId, courseId, answers:[0,2,1,...], sessionToken }
// → { status:'success', score, correct, total, correctAnswers }
// ============================================================
function submitQuiz({ userId, courseId, answers, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const { cols, rows } = _readSheet(getSheet(SHEET_NAMES.COURSES));
  let quizData = null;
  for (let i = 2; i < rows.length; i++) {
    if (String(rows[i][cols.CourseId]).trim() === String(courseId).trim()) {
      quizData = safeParseJSON(rows[i][cols.AiQuiz], null);
      break;
    }
  }

  if (!quizData || !Array.isArray(quizData) || quizData.length === 0) {
    return { status: 'error', message: '找不到題目' };
  }

  const correctAnswers = quizData.map(function(q) { return q.answer; });
  const userAnswers    = Array.isArray(answers) ? answers : [];
  let correct = 0;
  correctAnswers.forEach(function(ans, idx) {
    if (userAnswers[idx] === ans) correct++;
  });

  const score = Math.round(correct / quizData.length * 100);
  return { status: 'success', score: score, correct: correct, total: quizData.length, correctAnswers: correctAnswers };
}

// ============================================================
// 14. getDepartments
// POST { requestUserId }
// → { status:'success', departments:[] }
// ============================================================

function getDepartments({ requestUserId, sessionToken }) {
  const authErr = _requireManagerOrAdmin(sessionToken, requestUserId);
  if (authErr) return { status: 'error', message: authErr };

  const { cols, rows: userRows } = _readSheet(getSheet(SHEET_NAMES.USERS));

  const deptMap = {};
  for (let i = 1; i < userRows.length; i++) {
    const dept = String(userRows[i][cols.Department] || '').trim();
    if (!dept) continue;
    if (!deptMap[dept]) deptMap[dept] = { deptId: dept, manager: null, employeeCount: 0 };
    const role = String(userRows[i][cols.Role] || '').toLowerCase();
    if (role === 'manager') {
      deptMap[dept].manager = { userId: String(userRows[i][cols.UserId]).trim(), name: userRows[i][cols.Name] };
    } else if (role === 'employee') {
      deptMap[dept].employeeCount++;
    }
  }

  return { status: 'success', departments: Object.values(deptMap) };
}

// ============================================================
// [排程函式] checkOverdueAndNotify()
//
// 用途：每日掃描逾期必修課，寄信通知員工本人 + 部門主管彙總
//
// 期限規則：
//   - 全域必修（Courses.IsMandatory=TRUE）→ 看 Courses 的 DueDate（固定日期）
//   - 部門必修（DeptMandatory）→ 看 DueDays（到職後天數），
//     以 Users.CreatedAt（到職日）+ DueDays 天算出個人期限
//   兩者都沒填期限就不算逾期（沒設期限視為不設限，不會被通知）
//
// 設定方式：GAS 編輯器選 setupDailyOverdueTrigger() 執行一次即可建立每日排程，
//          之後 GAS 會自動在設定時間執行本函式，不需要手動再跑。
//          appsscript.json 的 oauthScopes 需加入
//          "https://www.googleapis.com/auth/script.send_mail"，
//          否則寄信會遇到跟 Vertex AI 一樣的權限不足錯誤。
// ============================================================
function checkOverdueAndNotify() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { cols: userCols,     rows: userRows }     = _readSheet(getSheet(SHEET_NAMES.USERS));
  const { cols: courseCols,   rows: courseRows }   = _readSheet(getSheet(SHEET_NAMES.COURSES));
  const { cols: dmCols,       rows: dmRows }       = _readSheet(getSheet(SHEET_NAMES.DEPT_MANDATORY));
  const { cols: progressCols, rows: progressRows } = _readSheet(getSheet(SHEET_NAMES.PROGRESS));
  const { cols: ojtCols,      rows: ojtRows }      = _readSheet(getSheet(SHEET_NAMES.OJT_TASKS));

  // 全域必修課 + 固定期限
  const globalMandatory = [];
  const courseTitleMap  = {};
  for (let i = 2; i < courseRows.length; i++) {
    const r = courseRows[i];
    if (!r[courseCols.CourseId]) continue;
    const courseId = String(r[courseCols.CourseId]).trim();
    courseTitleMap[courseId] = r[courseCols.Title];
    const isMandatory = r[courseCols.IsMandatory] === true || r[courseCols.IsMandatory] === 'TRUE';
    if (!isMandatory) continue;
    const dueDate = r[courseCols.DueDate] ? new Date(r[courseCols.DueDate]) : null;
    globalMandatory.push({ courseId, title: r[courseCols.Title], dueDate });
  }

  // 部門必修課 + 到職後天數
  const deptMandatoryByDept = {};
  for (let i = 1; i < dmRows.length; i++) {
    const deptId   = String(dmRows[i][dmCols.DeptId]).trim();
    const courseId = String(dmRows[i][dmCols.CourseId]).trim();
    if (!deptId || !courseId) continue;
    const dueDaysRaw = dmRows[i][dmCols.DueDays];
    const dueDays = dueDaysRaw !== '' && dueDaysRaw != null ? Number(dueDaysRaw) : null;
    if (!deptMandatoryByDept[deptId]) deptMandatoryByDept[deptId] = [];
    deptMandatoryByDept[deptId].push({ courseId, dueDays });
  }

  // 完課 Set：userId -> Set(courseId)（一般完課 + 已核准 OJT）
  const completedMap = {};
  for (let i = 1; i < progressRows.length; i++) {
    const uid = String(progressRows[i][progressCols.UserId]).trim();
    if (!completedMap[uid]) completedMap[uid] = new Set();
    completedMap[uid].add(String(progressRows[i][progressCols.CourseId]).trim());
  }
  for (let i = 1; i < ojtRows.length; i++) {
    if (String(ojtRows[i][ojtCols.Status]).trim() !== 'approved') continue;
    const uid = String(ojtRows[i][ojtCols.UserId]).trim();
    if (!completedMap[uid]) completedMap[uid] = new Set();
    completedMap[uid].add(String(ojtRows[i][ojtCols.CourseId]).trim());
  }

  const deptOverdueSummary = {}; // deptId -> [{ name, count }]
  let notifiedCount = 0;
  const failedEmployeeIds   = [];
  const noEmailEmployeeIds  = [];
  const failedManagerDepts  = [];
  const noEmailManagerDepts = [];
  let runStatus = 'success';

  for (let i = 1; i < userRows.length; i++) {
    const row = userRows[i];
    const userId = String(row[userCols.UserId]).trim();
    if (!userId) continue;

    const role = String(row[userCols.Role] || '').toLowerCase();
    if (role !== 'employee') continue; // 只對一般員工計算必修完成要求

    const email     = row[userCols.Email];
    const name      = row[userCols.Name];
    const createdAt = row[userCols.CreatedAt] ? new Date(row[userCols.CreatedAt]) : null;
    const dept      = String(row[userCols.Department] || '').trim();

    const completed = completedMap[userId] || new Set();
    const overdueTitles = [];

    globalMandatory.forEach(c => {
      if (completed.has(c.courseId)) return;
      if (!c.dueDate) return;
      if (c.dueDate < today) overdueTitles.push(`${c.title}（期限：${_formatDate(c.dueDate)}）`);
    });

    if (dept && deptMandatoryByDept[dept] && createdAt) {
      deptMandatoryByDept[dept].forEach(dm => {
        if (completed.has(dm.courseId)) return;
        if (dm.dueDays == null) return;
        const deadline = new Date(createdAt);
        deadline.setDate(deadline.getDate() + dm.dueDays);
        if (deadline < today) {
          const title = courseTitleMap[dm.courseId] || dm.courseId;
          overdueTitles.push(`${title}（期限：${_formatDate(deadline)}）`);
        }
      });
    }

    if (overdueTitles.length === 0) continue;

    if (email) {
      try {
        MailApp.sendEmail({
          to: email,
          subject: '【良興雲端學院】必修課逾期提醒',
          body: `${name} 您好，\n\n以下必修課程已超過完成期限，請盡快完成：\n\n` +
                overdueTitles.map(t => '・' + t).join('\n') +
                `\n\n請登入良興雲端學院完成上述課程。`
        });
        notifiedCount++;
      } catch (err) {
        Logger.log(`寄信失敗（${userId}）：${err.toString()}`);
        failedEmployeeIds.push(userId);
      }
    } else {
      Logger.log(`沒有 Email，無法通知（${userId}）`);
      noEmailEmployeeIds.push(userId);
    }

    if (dept) {
      if (!deptOverdueSummary[dept]) deptOverdueSummary[dept] = [];
      deptOverdueSummary[dept].push({ name, titles: overdueTitles });
    }
  }

  // 部門主管彙總信
  for (let i = 1; i < userRows.length; i++) {
    const row  = userRows[i];
    const role = String(row[userCols.Role] || '').toLowerCase();
    if (role !== 'manager') continue;

    const dept  = String(row[userCols.Department] || '').trim();
    const email = row[userCols.Email];
    const overdueList = deptOverdueSummary[dept];
    if (!overdueList || overdueList.length === 0) continue;

    if (!email) {
      Logger.log(`主管沒有 Email，無法寄彙總信（${dept}）`);
      noEmailManagerDepts.push(dept);
      continue;
    }

    const body = overdueList.map(o =>
      `・${o.name}：\n` + o.titles.map(t => `    - ${t}`).join('\n')
    ).join('\n\n');
    try {
      MailApp.sendEmail({
        to: email,
        subject: `【良興雲端學院】部門必修逾期彙總（${dept}）`,
        body: `以下同仁有必修課逾期未完成：\n\n${body}\n\n請登入主管審核中心查看詳情。`
      });
    } catch (err) {
      Logger.log(`寄主管彙總信失敗（${dept}）：${err.toString()}`);
      failedManagerDepts.push(dept);
    }
  }

  if (failedEmployeeIds.length > 0 || failedManagerDepts.length > 0
    || noEmailEmployeeIds.length > 0 || noEmailManagerDepts.length > 0) runStatus = 'partial_failure';

  try {
    _getNotificationLogSheet().appendRow([
      new Date(),
      notifiedCount,
      failedEmployeeIds.join(','),
      failedManagerDepts.join(','),
      noEmailEmployeeIds.join(','),
      noEmailManagerDepts.join(','),
      runStatus
    ]);
  } catch (err) {
    Logger.log(`寫入 NotificationLog 失敗：${err.toString()}`);
  }

  Logger.log(`完成逾期檢查，共通知 ${notifiedCount} 位員工。`);
}

function _formatDate(d) {
  return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
}

// ============================================================
// [工具函式] setupDailyOverdueTrigger()
// 用途：建立每日定時觸發器，之後會自動執行 checkOverdueAndNotify()
// 使用方式：GAS 編輯器選這個函式，執行一次即可（只需要執行一次）
//          要取消排程：GAS 編輯器左側「觸發器」（時鐘圖示）手動刪除
// ============================================================
function setupDailyOverdueTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkOverdueAndNotify') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('checkOverdueAndNotify')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('已建立每日 09:00 的逾期檢查觸發器。');
}

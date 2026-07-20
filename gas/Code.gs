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
  DEPT_MANDATORY: 'DeptMandatory'
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
      getCourses:         getCourses,
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

function safeParseJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; }
  catch (e) { return fallback; }
}

// ------------------------------------------------------------
// 欄位名稱對照表：讀取 Sheet 第一列標題文字，回傳 { 標題文字: 0-based 欄位位置 }
// 之後所有讀寫都用 cols.欄位名稱，不用寫死的數字，插入新欄不會讓舊邏輯錯位。
// ------------------------------------------------------------
function _colMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const header  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  header.forEach((h, i) => { if (h) map[String(h).trim()] = i; });
  return map;
}

// ------------------------------------------------------------
// 依欄位名稱組出 appendRow 用的陣列（順序照實際 Sheet 欄位位置排，不用管傳入順序）
// values: { 欄位名稱: 值, ... }，沒填到的欄位自動補空字串
// ------------------------------------------------------------
function _buildRow(cols, values) {
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
  const sheet = getSheet(SHEET_NAMES.USERS);
  const cols  = _colMap(sheet);
  const rows  = sheet.getDataRange().getValues();
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

// ============================================================
// 1. verifyLogin
// POST { userId, password }
// → { status:'success', data:{ userId, name, role, isFirstLogin } }
// ============================================================

function verifyLogin({ userId, password }) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const cols  = _colMap(sheet);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cols.UserId]).trim() !== String(userId).trim()) continue;

    if (String(r[cols.Password]).trim() !== String(password).trim()) {
      return { status: 'error', message: '密碼錯誤' };
    }

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

  const sheet = getSheet(SHEET_NAMES.USERS);
  const cols  = _colMap(sheet);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[cols.UserId]).trim() !== String(userId).trim()) continue;

    const isFirstLogin = r[cols.IsFirstLogin] === true || r[cols.IsFirstLogin] === 'TRUE';
    if (!isFirstLogin && String(r[cols.Password]).trim() !== String(oldPassword || '').trim()) {
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
// 3. getCourses
// POST { userId }
// → Array of course objects（前端容錯：直接回陣列）
// ============================================================

function getCourses({ userId }) {
  const courseSheet   = getSheet(SHEET_NAMES.COURSES);
  const ojtSheet      = getSheet(SHEET_NAMES.OJT_TASKS);
  const progressSheet = getSheet(SHEET_NAMES.PROGRESS);
  const userSheet     = getSheet(SHEET_NAMES.USERS);
  const dmSheet       = getSheet(SHEET_NAMES.DEPT_MANDATORY);

  const courseCols   = _colMap(courseSheet);
  const ojtCols      = _colMap(ojtSheet);
  const progressCols = _colMap(progressSheet);
  const userCols     = _colMap(userSheet);
  const dmCols       = _colMap(dmSheet);

  const courseRows   = courseSheet.getDataRange().getValues();
  const ojtRows      = ojtSheet.getDataRange().getValues();
  const progressRows = progressSheet.getDataRange().getValues();
  const userRows     = userSheet.getDataRange().getValues();
  const dmRows       = dmSheet.getDataRange().getValues();

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
  const ojtPending  = new Set();
  const ojtApproved = new Set();
  for (let i = 1; i < ojtRows.length; i++) {
    if (String(ojtRows[i][ojtCols.UserId]).trim() !== String(userId).trim()) continue;
    const status   = String(ojtRows[i][ojtCols.Status]).trim();
    const courseId = String(ojtRows[i][ojtCols.CourseId]).trim();
    if (status === 'pending')  ojtPending.add(courseId);
    if (status === 'approved') ojtApproved.add(courseId);
  }

  // Row 1=標題列, Row 2=範例列, Row 3~=實際資料
  const courses = [];
  for (let i = 2; i < courseRows.length; i++) {
    const r = courseRows[i];
    if (!r[courseCols.CourseId]) continue;

    const courseId = String(r[courseCols.CourseId]).trim();

    courses.push({
      id:             courseId,
      CourseId:       courseId,
      title:          r[courseCols.Title],
      category:       r[courseCols.Category],
      isMandatory:    r[courseCols.IsMandatory] === true || r[courseCols.IsMandatory] === 'TRUE' || deptMandatorySet.has(courseId),
      duration:       r[courseCols.Duration],
      badges:         r[courseCols.Badges] ? String(r[courseCols.Badges]).split(',').map(b => b.trim()) : [],
      materialType:   r[courseCols.MaterialType] || 'video',
      materialUrl:    r[courseCols.MaterialUrl] || '',
      materialTextUrl:r[courseCols.MaterialTextUrl] || '',
      ojtRequired:    r[courseCols.OjtRequired] === true || r[courseCols.OjtRequired] === 'TRUE',
      ojtDescription: r[courseCols.OjtDescription] || '',
      AiSummary:      r[courseCols.AiSummary] || '',
      AiQuiz:         r[courseCols.AiQuiz] ? JSON.stringify(
        safeParseJSON(r[courseCols.AiQuiz], []).map(function(q) { return { question: q.question, options: q.options }; })
      ) : '',
      isCompleted:    completedSet.has(courseId) || ojtApproved.has(courseId),
      ojtStatus:      ojtApproved.has(courseId) ? 'approved'
                    : ojtPending.has(courseId)  ? 'pending'
                    : null
    });
  }

  return courses; // 前端直接收陣列
}

// ============================================================
// 4. getProgress
// POST { userId }
// → { status:'success', data:{ completedCourses, earnedBadges, totalLearningMinutes } }
// ============================================================

function getProgress({ userId }) {
  const sheet = getSheet(SHEET_NAMES.USER_PROGRESS);
  const cols  = _colMap(sheet);
  const rows  = sheet.getDataRange().getValues();

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

  if (!isOJT) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getSheet(SHEET_NAMES.PROGRESS);
      const cols  = _colMap(sheet);
      const rows  = sheet.getDataRange().getValues();

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][cols.UserId]).trim() === String(userId).trim() &&
            String(rows[i][cols.CourseId]).trim() === String(courseId).trim()) {
          return { status: 'success', success: true, message: '已存在紀錄' };
        }
      }
      sheet.appendRow(_buildRow(cols, {
        UserId: String(userId),
        CourseId: String(courseId),
        Badges: JSON.stringify(badges || []),
        CompletedAt: new Date()
      }));
    } finally {
      lock.releaseLock();
    }
  }
  // OJT 課程的完課由 reviewOJTTask（核准後）觸發，這裡不寫入
  return { status: 'success', success: true };
}

// ============================================================
// 6. updateProgress
// POST { userId, progressData:{ completedCourses, earnedBadges, totalLearningMinutes }, sessionToken }
// → { status:'success' }
// ============================================================

function updateProgress({ userId, progressData, sessionToken }) {
  const err = _requireSession(sessionToken, userId);
  if (err) return { status: 'error', message: err };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet(SHEET_NAMES.USER_PROGRESS);
    const cols  = _colMap(sheet);
    const rows  = sheet.getDataRange().getValues();

    const completedJSON = JSON.stringify(progressData.completedCourses || []);
    const badgesJSON    = JSON.stringify(progressData.earnedBadges || []);
    const minutes       = progressData.totalLearningMinutes || 0;

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][cols.UserId]).trim() !== String(userId).trim()) continue;
      sheet.getRange(i + 1, cols.CompletedCourses + 1).setValue(completedJSON);
      sheet.getRange(i + 1, cols.EarnedBadges + 1).setValue(badgesJSON);
      sheet.getRange(i + 1, cols.TotalLearningMinutes + 1).setValue(minutes);
      return { status: 'success' };
    }

    // 新員工，建立一列
    sheet.appendRow(_buildRow(cols, {
      UserId: String(userId),
      CompletedCourses: completedJSON,
      EarnedBadges: badgesJSON,
      TotalLearningMinutes: minutes
    }));
    return { status: 'success' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// 7. submitOJT
// POST { userId, courseId, submitType:'file'|'link', fileName?, mimeType?, base64Data?, linkUrl? }
// → { status:'success' }
// ============================================================

function submitOJT({ userId, courseId, submitType, fileName, mimeType, base64Data, linkUrl }) {
  const sheet  = getSheet(SHEET_NAMES.OJT_TASKS);
  const cols   = _colMap(sheet);
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
}

// ============================================================
// 8. getPendingOJTTasks
// POST { requestUserId, sessionToken }
// → { success:true, tasks:[ { rowNumber, taskId, userId, userName, courseId, courseTitle, ... } ] }
// ============================================================

function getPendingOJTTasks({ requestUserId, sessionToken } = {}) {
  const err = _requireManagerOrAdmin(sessionToken, requestUserId);
  if (err) return { status: 'error', message: err };

  const ojtSheet    = getSheet(SHEET_NAMES.OJT_TASKS);
  const userSheet   = getSheet(SHEET_NAMES.USERS);
  const courseSheet = getSheet(SHEET_NAMES.COURSES);

  const ojtCols    = _colMap(ojtSheet);
  const userCols   = _colMap(userSheet);
  const courseCols = _colMap(courseSheet);

  const ojtRows    = ojtSheet.getDataRange().getValues();
  const userRows   = userSheet.getDataRange().getValues();
  const courseRows = courseSheet.getDataRange().getValues();

  // Lookup maps
  const userMap = {};
  for (let i = 1; i < userRows.length; i++) {
    userMap[String(userRows[i][userCols.UserId]).trim()] = { name: userRows[i][userCols.Name], role: userRows[i][userCols.Role] };
  }
  const courseMap = {};
  for (let i = 2; i < courseRows.length; i++) {
    courseMap[String(courseRows[i][courseCols.CourseId]).trim()] = { title: courseRows[i][courseCols.Title], category: courseRows[i][courseCols.Category] };
  }

  const tasks = [];
  for (let i = 1; i < ojtRows.length; i++) {
    const r = ojtRows[i];
    if (!r[ojtCols.TaskId] || String(r[ojtCols.Status]).trim() !== 'pending') continue;

    const uid = String(r[ojtCols.UserId]).trim();
    const cid = String(r[ojtCols.CourseId]).trim();

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

function reviewOJTTask({ rowNumber, newStatus, requestUserId, sessionToken }) {
  const err = _requireManagerOrAdmin(sessionToken, requestUserId);
  if (err) return { status: 'error', message: err };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ojtSheet = getSheet(SHEET_NAMES.OJT_TASKS);
    const ojtCols  = _colMap(ojtSheet);
    const row      = ojtSheet.getRange(rowNumber, 1, 1, ojtSheet.getLastColumn()).getValues()[0];

    ojtSheet.getRange(rowNumber, ojtCols.Status + 1).setValue(newStatus);

    if (newStatus === 'approved') {
      ojtSheet.getRange(rowNumber, ojtCols.ApprovedAt + 1).setValue(new Date());

      const userId   = String(row[ojtCols.UserId]).trim();
      const courseId = String(row[ojtCols.CourseId]).trim();

      // Progress sheet：新增完課紀錄
      const progressSheet = getSheet(SHEET_NAMES.PROGRESS);
      const progressCols  = _colMap(progressSheet);
      const progressRows  = progressSheet.getDataRange().getValues();
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

      // UserProgress：加入 completedCourses + earnedBadges
      const courseSheet = getSheet(SHEET_NAMES.COURSES);
      const courseCols   = _colMap(courseSheet);
      const courseRows   = courseSheet.getDataRange().getValues();
      let badges = [];
      for (let i = 2; i < courseRows.length; i++) {
        if (String(courseRows[i][courseCols.CourseId]).trim() === courseId) {
          badges = courseRows[i][courseCols.Badges]
            ? String(courseRows[i][courseCols.Badges]).split(',').map(b => b.trim())
            : [];
          break;
        }
      }

      const upSheet = getSheet(SHEET_NAMES.USER_PROGRESS);
      const upCols  = _colMap(upSheet);
      const upRows  = upSheet.getDataRange().getValues();
      for (let i = 1; i < upRows.length; i++) {
        if (String(upRows[i][upCols.UserId]).trim() !== userId) continue;

        let completed = safeParseJSON(upRows[i][upCols.CompletedCourses], []);
        let earned    = safeParseJSON(upRows[i][upCols.EarnedBadges], []);

        if (!completed.includes(courseId)) {
          completed.push(courseId);
          upSheet.getRange(i + 1, upCols.CompletedCourses + 1).setValue(JSON.stringify(completed));
        }
        if (badges.length > 0) {
          const merged = [...new Set([...earned, ...badges])];
          upSheet.getRange(i + 1, upCols.EarnedBadges + 1).setValue(JSON.stringify(merged));
        }
        break;
      }
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
  const cols        = _colMap(courseSheet);
  const rows        = courseSheet.getDataRange().getValues();

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
  const cols  = _colMap(sheet);
  const rows  = sheet.getDataRange().getValues();

  let processed = 0;

  for (let i = 2; i < rows.length; i++) {
    const r               = rows[i];
    const courseId        = String(r[cols.CourseId]).trim();
    const title           = r[cols.Title];
    const category        = r[cols.Category];
    const matType         = String(r[cols.MaterialType] || '').toLowerCase();
    const matUrl          = r[cols.MaterialUrl] || '';
    const materialTextUrl = r[cols.MaterialTextUrl] || '';
    const aiSummary       = r[cols.AiSummary];
    const transcript      = r[cols.Transcript] || '';

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
  const cols    = _colMap(sheet);
  const rows    = sheet.getDataRange().getValues();

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

  Logger.log(`\n完成！更新：${updated} 筆 / 未對應：${skipped} 筆`);
}

// ============================================================
// 11. getDeptReport
// POST { deptId, requestUserId }
// → { status:'success', data:{ totalUsers, overallMandatoryRate, employees, courseStats } }
// ============================================================

function getDeptReport({ deptId, requestUserId }) {
  const userSheet = getSheet(SHEET_NAMES.USERS);
  const userCols  = _colMap(userSheet);
  const userRows  = userSheet.getDataRange().getValues();

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

  // 取得全域 + 部門必修課
  const courseSheet = getSheet(SHEET_NAMES.COURSES);
  const courseCols  = _colMap(courseSheet);
  const courseRows  = courseSheet.getDataRange().getValues();
  const dmSheet     = getSheet(SHEET_NAMES.DEPT_MANDATORY);
  const dmCols      = _colMap(dmSheet);
  const dmRows      = dmSheet.getDataRange().getValues();

  const deptMandatorySet = new Set();
  for (let i = 1; i < dmRows.length; i++) {
    if (String(dmRows[i][dmCols.DeptId]).trim() === deptId) {
      deptMandatorySet.add(String(dmRows[i][dmCols.CourseId]).trim());
    }
  }

  const allCourses = [];
  const mandatoryCourses = [];
  for (let i = 2; i < courseRows.length; i++) {
    const r = courseRows[i];
    if (!r[courseCols.CourseId]) continue;
    const courseId = String(r[courseCols.CourseId]).trim();
    const title    = r[courseCols.Title];
    allCourses.push({ courseId, title });
    if (r[courseCols.IsMandatory] === true || r[courseCols.IsMandatory] === 'TRUE' || deptMandatorySet.has(courseId)) {
      mandatoryCourses.push({ courseId, title });
    }
  }

  // 建立每位員工的完課 Set
  const progressSheet = getSheet(SHEET_NAMES.PROGRESS);
  const progressCols  = _colMap(progressSheet);
  const progressRows  = progressSheet.getDataRange().getValues();
  const ojtSheet      = getSheet(SHEET_NAMES.OJT_TASKS);
  const ojtCols       = _colMap(ojtSheet);
  const ojtRows       = ojtSheet.getDataRange().getValues();
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

function getDeptMandatory({ deptId }) {
  const sheet = getSheet(SHEET_NAMES.DEPT_MANDATORY);
  const cols  = _colMap(sheet);
  const rows  = sheet.getDataRange().getValues();
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
    const cols  = _colMap(sheet);
    const rows  = sheet.getDataRange().getValues();

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

  const sheet = getSheet(SHEET_NAMES.COURSES);
  const cols  = _colMap(sheet);
  const rows  = sheet.getDataRange().getValues();
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

function getDepartments({ requestUserId }) {
  const userSheet = getSheet(SHEET_NAMES.USERS);
  const cols      = _colMap(userSheet);
  const userRows  = userSheet.getDataRange().getValues();

  // 驗證：admin 或 manager 都可以呼叫
  let requesterRole = '';
  for (let i = 1; i < userRows.length; i++) {
    if (String(userRows[i][cols.UserId]).trim() === String(requestUserId).trim()) {
      requesterRole = String(userRows[i][cols.Role] || '').toLowerCase();
      break;
    }
  }
  if (requesterRole !== 'admin' && requesterRole !== 'manager') {
    return { status: 'error', message: '權限不足' };
  }

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

  const userSheet     = getSheet(SHEET_NAMES.USERS);
  const courseSheet   = getSheet(SHEET_NAMES.COURSES);
  const dmSheet       = getSheet(SHEET_NAMES.DEPT_MANDATORY);
  const progressSheet = getSheet(SHEET_NAMES.PROGRESS);
  const ojtSheet      = getSheet(SHEET_NAMES.OJT_TASKS);

  const userCols     = _colMap(userSheet);
  const courseCols   = _colMap(courseSheet);
  const dmCols       = _colMap(dmSheet);
  const progressCols = _colMap(progressSheet);
  const ojtCols      = _colMap(ojtSheet);

  const userRows      = userSheet.getDataRange().getValues();
  const courseRows    = courseSheet.getDataRange().getValues();
  const dmRows        = dmSheet.getDataRange().getValues();
  const progressRows  = progressSheet.getDataRange().getValues();
  const ojtRows       = ojtSheet.getDataRange().getValues();

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
      }
    }

    if (dept) {
      if (!deptOverdueSummary[dept]) deptOverdueSummary[dept] = [];
      deptOverdueSummary[dept].push({ name, count: overdueTitles.length });
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
    if (!overdueList || overdueList.length === 0 || !email) continue;

    const body = overdueList.map(o => `・${o.name}：${o.count} 門逾期`).join('\n');
    try {
      MailApp.sendEmail({
        to: email,
        subject: `【良興雲端學院】部門必修逾期彙總（${dept}）`,
        body: `以下同仁有必修課逾期未完成：\n\n${body}\n\n請登入主管審核中心查看詳情。`
      });
    } catch (err) {
      Logger.log(`寄主管彙總信失敗（${dept}）：${err.toString()}`);
    }
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

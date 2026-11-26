// src/utils/gasClient.js
const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_API_URL;

// 完課／時數更新／OJT 提交等寫入動作都用 LockService 全域序列化，太多人
// 同時寫入時會排隊逾時（後端回傳的訊息含「逾時」）。這種情況稍等一下重送
// 通常就會成功，值得自動重試；其他類型的錯誤（帳密錯誤、權限不足等）重試
// 也不會變好，不處理。
const LOCK_TIMEOUT_PATTERN = /lock|鎖定|逾時|timeout/i;
const MAX_LOCK_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;

// 同時上線的人太多時，Google 偶爾會直接拒絕執行，但瀏覽器要等約 120 秒才收到錯誤
// （2026/11/25 staging 壓測）。下面這些動作等超過 25 秒就放棄、自動重送一次，
// 不讓同仁傻等。只放「重送不會重複寫入」的動作：讀取類、交卷（後端擋已交過）、
// 練習回報（帶 requestId，同一次只記一次）、完課（後端擋重複）。
// AI 產生內容等本來就會跑很久的動作不在名單裡，不設時限。
const FAST_RETRY_ACTIONS = new Set([
  'verifyLogin', 'bootstrap', 'getCourses', 'getCourseDetail', 'getProgress',
  'getExperimentStatus', 'getTest', 'submitTest', 'submitPractice', 'getPracticeProgress',
  'getDeptReport', 'getPendingOJTTasks', 'getDeptMandatory', 'getDepartments', 'completeCourse'
]);
const REQUEST_TIMEOUT_MS = 25000;
const MAX_STALL_RETRIES = 1;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendOnce(action, payload, timeoutMs) {
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      mode: 'cors', // GAS 跨域必備
      // ⚠️ GAS 接收 POST 時，為了避開嚴苛的 CORS 預檢，通常使用 text/plain
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      signal: controller ? controller.signal : undefined
    });
    if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const gasClient = {
  // 🔒 帶 session token 的 POST（自動從 localStorage 讀取）
  securePost: async (action, payload = {}) => {
    const token = localStorage.getItem('cloud_academy_token') || '';
    return gasClient.post(action, { ...payload, sessionToken: token });
  },

  post: async (action, payload = {}) => {
    const fast = FAST_RETRY_ACTIONS.has(action);
    let stallRetries = 0;
    try {
      for (let attempt = 0; attempt <= MAX_LOCK_RETRIES; attempt++) {
        let result;
        try {
          result = await sendOnce(action, payload, fast ? REQUEST_TIMEOUT_MS : 0);
        } catch (err) {
          // 逾時、連線失敗、HTTP 500：名單內的動作重送一次，其他照舊丟給呼叫端處理
          if (fast && stallRetries < MAX_STALL_RETRIES) {
            stallRetries++;
            attempt--; // 這次不算排隊重試的次數
            await sleep(500 + Math.random() * 1500); // 稍微錯開，避免大家同一瞬間又一起重送
            continue;
          }
          throw err;
        }

        const isLockTimeout = result.status === 'error' && LOCK_TIMEOUT_PATTERN.test(result.message || '');
        if (isLockTimeout && attempt < MAX_LOCK_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * (attempt + 1) + Math.random() * 1000);
          continue;
        }

        // 回傳整個 result，讓外面的程式判斷 result.status 是 'success' 還是 'error'
        return result;
      }
    } catch (error) {
      console.error(`[POST Error action=${action}]:`, error);
      throw error;
    }
  }
};

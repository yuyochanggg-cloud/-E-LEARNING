// src/utils/gasClient.js
const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_API_URL;

// 完課／時數更新／OJT 提交等寫入動作都用 LockService 全域序列化，太多人
// 同時寫入時會排隊逾時直接失敗（doPost 統一把逾時例外包成 {status:'error'}）。
// 這種情況稍等一下重送通常就會成功，值得自動重試；其他類型的錯誤
// （帳密錯誤、權限不足等）重試也不會變好，不處理。
const LOCK_TIMEOUT_PATTERN = /lock|鎖定|逾時|timeout/i;
const MAX_LOCK_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 800;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const gasClient = {
  // 🔒 帶 session token 的 POST（自動從 localStorage 讀取）
  securePost: async (action, payload = {}) => {
    const token = localStorage.getItem('cloud_academy_token') || '';
    return gasClient.post(action, { ...payload, sessionToken: token });
  },

  // 🔴 ✨ 新增的 POST 方法 (用來處理登入、存檔等寫入動作)
  post: async (action, payload = {}) => {
    try {
      for (let attempt = 0; attempt <= MAX_LOCK_RETRIES; attempt++) {
        const response = await fetch(GAS_WEB_APP_URL, {
          method: 'POST',
          mode: 'cors', // GAS 跨域必備
          // ⚠️ GAS 接收 POST 時，為了避開嚴苛的 CORS 預檢，通常使用 text/plain
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          // 將 action 與你要傳的資料 (例如 userId) 包裝成 JSON 字串送給 GAS
          body: JSON.stringify({ action, ...payload })
        });

        if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);

        const result = await response.json();

        const isLockTimeout = result.status === 'error' && LOCK_TIMEOUT_PATTERN.test(result.message || '');
        if (isLockTimeout && attempt < MAX_LOCK_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
          continue;
        }

        // POST 我們通常會把整個 result 回傳，讓外面的程式可以判斷 result.status 是 'success' 還是 'error'
        return result;
      }
    } catch (error) {
      console.error(`[POST Error action=${action}]:`, error);
      throw error;
    }
  }
};
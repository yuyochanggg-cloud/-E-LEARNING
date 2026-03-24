// src/utils/gasClient.js
const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_API_URL;

export const gasClient = {
  // 🟢 你原本的 GET 方法 (完美保留，完全不變)
  get: async (action, params = {}) => {
    const query = new URLSearchParams({ action, ...params }).toString();
    const url = `${GAS_WEB_APP_URL}?${query}`;
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
      const result = await response.json();
      if (result.status === 'error') throw new Error(result.message);
      return result.data;
    } catch (error) {
      console.error(`[GET Error]:`, error);
      throw error; 
    }
  },

  // 🔴 ✨ 新增的 POST 方法 (用來處理登入、存檔等寫入動作)
  post: async (action, payload = {}) => {
    try {
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
      
      // POST 我們通常會把整個 result 回傳，讓外面的程式可以判斷 result.status 是 'success' 還是 'error'
      return result; 
    } catch (error) {
      console.error(`[POST Error action=${action}]:`, error);
      throw error;
    }
  }
};
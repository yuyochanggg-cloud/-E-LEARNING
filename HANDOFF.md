# HANDOFF: 良興雲端學院 9月上線前置作業

> 更新：2026-08-17｜上手模型建議：sonnet（涉及 GAS+React+Sheets 三方協調，判斷成分高，不建議降級 haiku）
> 位置：C:\Users\User\LxProjects\lx-elearning｜相關日誌：H:\我的雲端硬碟\Obsidian筆記用\創作庫\Vibe Coding專案\日誌\2026-07-23 良興雲端學院安全強化與Vertex遷移.md
> 目前主機：本機 Windows（C:\Users\User）｜目前 harness：Claude Code｜換手原因：使用者主動要求留存交接記錄（工作階段查核點，非緊急中斷）

## 1. 目標與驗收條件

原始需求（使用者原話，不改寫）：
> 我們這個雲端學院打算9月正式上線 請給我短期 中期 長期的計劃 包含功能 要放上哪些課程 以及預期的目標等等

驗收條件（全勾才算完成）：
- [ ] 正式 GAS Web App 已確認貼上最新 `gas/Code.gs` 並重新部署（使用者從頭到尾沒有明確回報「已部署」，只有我反覆提醒）
- [ ] 使用者實測過一次主管 OJT 審核流程（核准／駁回都要試），這是本輪最大的安全+正確性修補、目前完全未驗證
- [ ] `fixInflatedLearningMinutes()` 在 GAS 編輯器手動執行過一次，修正歷史時數灌水
- [ ] 職人練功坊／心靈充電站／領導與溝通三個頻道至少各上架 1 門課（目前是 0）
- [ ] 至少 1 個部門在 `DeptMandatory` 表設定過必修課（目前整張表空白）
- [ ] Vercel／GitHub 帳號歸屬從個人帳號轉移到公司名下（或至少加一個公司帳號當共同 Owner）

## 2. 現況

已完成並驗證：
- 課程資源庫改版：六頻道固定顯示、每頻道預覽 4 堂+查看更多展開、空頻道顯示「內容製作中」——瀏覽器實測過（桌面+375px 手機模擬）
- `Courses` 表新增 `CreatedAt` 欄位（P1 標題，透過 Claude in Chrome 直接在正式 Sheet 手動打上）+ GAS `onEdit` 簡易觸發器自動蓋時間戳記
- Dashboard「T 型選修池」原本無限制攤開全部選修課，改成只顯示最新 6 堂+「更多選修課」連去資源庫——驗證過
- 兩個無障礙阻斷項修復並驗證（桌面鍵盤 Tab+手機觸控都測過）：
  - 測驗選項改真正 `<input type="radio">`（原本是假的 `<label onClick>` 包裝飾圓圈，鍵盤/螢幕閱讀器完全選不了答案）
  - 課程卡片、側邊選單 logo 改用真正 `<button>`（原本是 `<div onClick>` 沒有鍵盤語意）
- 手機版檢查通過（375px，無橫向捲動，觸控尺寸達標），「查看更多」按鈕從 37px 補到 44px
- 課程資源庫文案簡化：拿掉「結合後台 KSA 戰略建模」「HR 戰略維度」這類內部術語
- 以上全部已 commit、push 到 GitHub、部署到 GitHub Pages + Vercel

已完成未驗證：
- `gas/Code.gs` 本機檔案是最新版（含 bootstrap API、課程快取、`_mergeUserProgress`、密碼明碼決定、CreatedAt/onEdit），已 push 到 GitHub，但**正式 Apps Script 編輯器是否已貼上並重新部署，使用者從未明確回報**——這是目前最大的風險點，前端很多功能（排序、效能優化）都假設後端已是最新版

未開始：
- 4 項非阻斷無障礙優化（icon-only 按鈕缺 `aria-label`、登入表單 `<label>` 沒用 `htmlFor` 綁定+沒有 `autoComplete`、密碼欄沒有顯示/隱藏切換、`text-slate-400` 大量用於次要文字對比度可能低於 WCAG AA）
- 三個空頻道的課程內容製作（職人練功坊／心靈充電站／領導與溝通）
- `DeptMandatory` 部門必修設定
- 150 人帳號的 Email 補齊（靠既有的首次登入強制填寫+溫和提示機制自然累積，非阻斷）

## 3. 已排除的路徑（禁止重試）

- 不要自動用程式改 Google Sheets 的結構（新增欄位、改標題）——本 session 需要改 Sheet 結構時，都是先跟使用者確認、再透過 Claude in Chrome 用使用者已登入的瀏覽器親手操作，不要寫 GAS 腳本自動改表結構，風險太高
- 不要重新啟用密碼 hash——使用者明確決定保留明碼存放（HR 需要能直接在 Sheet 查看員工密碼協助忘記密碼同仁）。程式碼裡故意留了 `_hashPassword`/`_passwordMatches` 等函式但不主動呼叫，這是刻意的取捨，不是沒做完，不要「順便」修成主動 hash
- gas 資料夾沒有 `.clasp.json`，clasp 沒有針對這個專案設定過，不要假設可以直接 `clasp push/deploy`——GAS 部署目前只能靠使用者手動貼進 Apps Script 編輯器
- 不要在沒有明確詢問使用者的情況下執行 `git push` 或部署（`npm run deploy` / `vercel --prod`）——本 session 固定模式是每次改完都先問「要推嗎」才動手，即使看起來像小改動也一樣

## 4. 關鍵檔案

- C:\Users\User\LxProjects\lx-elearning\gas\Code.gs — GAS 後端全部邏輯，本機最新但正式環境部署狀態未確認（見第 2 節）
- C:\Users\User\LxProjects\lx-elearning\src\App.jsx:1008 — `LibraryView`（課程資源庫）
- C:\Users\User\LxProjects\lx-elearning\src\App.jsx:847 — `DashboardView`（含 T 型選修池）
- C:\Users\User\LxProjects\lx-elearning\src\App.jsx:2130 — `QuizSection`（測驗，含剛修好的 radio）
- H:\我的雲端硬碟\Obsidian筆記用\創作庫\Vibe Coding專案\日誌\2026-07-23 良興雲端學院安全強化與Vertex遷移.md — 完整決策脈絡，接手前務必先讀
- C:\Users\User\claude\outputs\reports\lx-elearning-launch-roadmap-2026-09.md — 9月上線短中長期計畫草稿（含真實 Sheet 數據）

## 5. 下一步（從這裡開始）

第一個動作：跟使用者確認「最新 `gas/Code.gs` 是否已經貼進 GAS Apps Script 編輯器並重新部署」——這是目前最關鍵的未驗證項目，沒有這一步，後續的效能優化、CreatedAt 排序、onEdit 自動蓋章都不會真的生效。

之後依序：
1. 若已部署，請使用者實測一次主管 OJT 審核流程（用真實的 pending 任務跑一次核准+一次駁回）
2. 提醒使用者手動在 GAS 編輯器執行一次 `fixInflatedLearningMinutes()`
3. 視使用者意願處理剩下的 4 項非阻斷無障礙優化，可以小批次做，不用一次做完

## 6. 邊界（不要動的東西）

- 不改密碼儲存邏輯（明碼），因為這是使用者明確做過取捨的決定
- 不在未經確認下改 Google Sheets 分享權限或欄位結構
- git push／部署（GitHub Pages、Vercel）動作一律先問過使用者再做
- 遇到「使用者說已經測過某功能但程式碼邏輯看起來不像會通過」的情況，停下來問清楚，不要假設使用者測錯或程式碼一定有 bug

---

## 使用規則

- 進行中任務要中斷、或主對話 context 快滿要換 session、或要降級給便宜模型接手時，寫 HANDOFF.md 到該專案資料夾根部
- **換主機時**：專案本身要是 git 專案，HANDOFF.md 隨程式碼一起 commit + push；換到另一台主機先 `git pull` 該專案，再讀 HANDOFF.md
- 接手 session 的開場指令固定為：「讀 C:\Users\User\LxProjects\lx-elearning\HANDOFF.md，從第 5 節第一個動作開始」——接手模型不需要讀任何歷史對話
- 任務完成即刪 HANDOFF.md（可重用的教訓先蒸餾進 memory）；它是拋棄式紀錄，不是長期文件

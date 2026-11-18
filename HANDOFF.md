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

## 5.5 測試環境（staging，2026-11-05 建立）—— 改後端一律先走這裡

| 項目 | 位置 |
|---|---|
| 測試試算表 | https://drive.google.com/open?id=1IU5uvSFy0BvSIeBLCAgraZaDeFFEIrTjf4QFcTJumtU （測試帳號與密碼在 Users 表，部門都以「測試」開頭） |
| 測試 GAS 編輯器 | https://script.google.com/d/1ejLAbCrOBDlCJuYmR7rguQScopY_XnpK4FK16H5qo9-Tzj4OoAALYUWp/edit |
| 測試 GAS 部署 ID | AKfycbw0OtD6zQrut0jtgxqr_Zacsyjj_q8es3V3LOi_5tji6iLWkSQ8RG7hsODo7DqQmuQ9tQ |
| 隔離機制 | Script Properties `APP_ENV=staging`：所有信改寄 `STAGING_MAIL_TO`（主旨加「[測試環境]」）；OJT 上傳到獨立的 staging 資料夾；前端頂端有橘色「測試環境」標示 |

固定流程：
1. 改 `gas/Code.gs` → `npm run deploy-gas:staging`（複製 Code.gs＋`gas/staging/Setup.gs` 推到 staging 並更新部署；不碰正式專案）
2. 前端：本機 `npm run dev:staging`，或 `npm run deploy:staging` 部署成 Vercel 預覽網址（有 Vercel 登入保護）
3. 用測試帳號走過受影響的流程，並到測試試算表確認資料寫對
4. 通過後才推正式：clone 正式專案（scriptId `1VsvmCYls0Y-p2YVFeY3y8iaJT3USNGSOeEBVpkT8vAM2wkSJCba72iQu`）→ **先 diff 線上 `程式碼.js` 與本機 Code.gs（之後還有 `Experiment.js`），不同就停** → 覆蓋 `程式碼.js`＝Code.gs、`Experiment.js`＝gas/Experiment.gs（**不要**放 Setup／SeedItems）→ `clasp push -f` → `clasp create-deployment -i AKfycbxTcxKo...`（既有正式部署 ID）。正式推送一律先問使用者
5. 2026-11 起後端有兩個檔：`gas/Code.gs`（主程式）＋`gas/Experiment.gs`（門市對練實驗：課程可見性 helper、前後測、練習自陳）。Code.gs 會呼叫 Experiment.gs 的 `_parseVisibleTo`／`_isVisibleToDept`／`_canSeeCourse`，**正式專案少推 Experiment.js 會整個壞掉**

注意：
- `gas/staging/Setup.gs` 只推 staging，不要推到正式專案；`gas/staging/appsscript.json` 比正式多一個 `userinfo.email` 權限（Setup 需要）
- 正式課程複製到測試：staging 的 Script Properties 設 `PROD_SHEET_ID` 後執行 `importCoursesFromProd`（只讀正式表）
- 正式專案沒有設 `APP_ENV`，`_sendMail` 會照常寄信；**不要在正式專案設 `APP_ENV`**

## 5.6 門市對練實驗（方案 4，2026/11/30 開課、8 週到 2027/01/24）上線清單

規格依 2026/11/16 會議：左側獨立「門市對練」入口；每店受訓 2 類 × 每類 4 品項 × 每品項正式練習 2 次＝16 次；排程（11/17 定案）：每週 2 次可同一天、練滿關到下週一、上週不足只能本週補；某款第 1 次後隔天起第 2 次必出現；空位隨機補新款、兩類平均、員工不自選；每日最多 2 次；員工端前後測都叫「商品知識測驗」、不顯示分數；後測在「16 次練完」或「後測課 OpenFrom」先到者開放；交後測＋16 次都完成才發完課勳章；自主練習另一堂課、不限類別與商品但要填類別＋商品、不計入正式。
程式：`gas/Experiment.gs`＋`src/Experiment.jsx`（DrillView）。staging 冒煙測試 `stagingSmokeExperiment`（Setup.gs）27 項全過，並用前端實走前測→今日派題→回報→bot→自主練習。

上正式前依序：
1. 門市分派與選品已定案，放在 **`gas/seed/FinalData.js`（gitignore，不進 GitHub；repo 是公開的，分組與對照類別不能公開）**，原始清單見 Codex 資料夾的定案選品 xlsx。換電腦時要從 xlsx 或舊電腦把這個檔帶過來。使用者還要提供：定稿題目（每類 7 題 × A/B、啟用=TRUE）→`實驗_題目`、正式 bot 網址
2. 推正式後端（Code.gs＋Experiment.js＋**FinalData.js**，見 5.5 第 4 點；少推 FinalData.js 時分派與品項不會自動填，要手貼）→ 正式編輯器執行 `setupExperimentSheets`（建分頁；`實驗_門市分派`、`實驗_品項` 空的會自動寫入定案資料；`實驗_設定` 預設 開始日期 2026/11/30、總週數 8、每品項次數 2、每日上限 2、每週次數 2、練習網址＝要填 bot 網址）
3. 題目貼進 `實驗_題目` 後先執行 `checkTestItems`（只讀不寫；檢查標題欄、題號重複、子類名稱、卷別 A/B、題幹與四選項不空白、選項不重複、答案 A–D、啟用 TRUE/FALSE、每類每卷 7 題，問題列出第幾列），通過再 `previewTestForms` → `assignTestForms`；開課當天（或前一天）執行 `snapshotParticipants` 存分組快照（之後調店不改分組；調整請填 `實驗_調整紀錄` 再跑 `applyParticipantAdjustments`，會留原門市／時間／處理人）
4. Courses 加四列（VisibleTo＝8 店）：EXP-PRE（test、pre、標題「商品知識測驗」）、EXP-PRAC（practice）、EXP-SELF（selfpractice）、EXP-POST（test、post、標題「商品知識測驗」、Badges＝完課勳章名、OpenFrom＝2027/01/18 第 8 週）。這四種類型不會出現在課程資源庫
5. 部署正式前端（GitHub Pages `npm run deploy`）
6. 每週在正式編輯器執行 `refreshExperimentSummary` → 看「實驗_檢核」（各店完成率、每週次數、個人 x/16、未完成品項、後測、完課、自主練習）

效能備註：`getExperimentStatus` 每次讀約 8 張表，`submitPractice` 會算 3 次狀態，staging 單次約 2–4 秒；80 人規模可接受，若門市反映慢再加快取。

注意：日期欄（開始日期、OpenFrom、DueDate）一律在試算表手打，程式以「台北的那一天」解讀；不要用程式寫 Date 物件。

## 5.7 資安（2026/11/18 檢查與修正）

已修（staging 驗證：`stagingSmokeSecurity` 11 項、`stagingSmokeExperiment` 35 項全過；尚未上正式）：
- `completeCourse` 不再相信前端：課程要存在且看得到；門市對練課只能走門市對練流程；OJT（OjtRequired 或「實戰解鎖」）只回 `pendingOJT`、不寫入；一般課要 6 小時內 `submitQuiz` 後端算到 100 分（CacheService `quizpass_`）；勳章一律用 Courses 設定。內部寫入改 `_completeCourseRecord`（門市對練也用它）。
- `updateProgress`：單次最多 120 分、每人每天 480 分。

待決（使用者決定）：
- GitHub repo 為 PUBLIC。改私人會讓 GitHub Pages 正式站失效（免費帳號），要先改用 Vercel 正式站或升級 Pro。已推上去的 48 個 commit 查過沒有個資、密碼、金鑰、分組選品，只有試算表／GAS 的 ID 與 API 網址（無共用權限就打不開），不改寫歷史。**分組與選品在未 push 的 commit 裡，repo 公開期間不要 push。**
- OJT 上傳：**正式 GAS 沒有設 `OJT_FOLDER_ID`（11/18 查指令碼屬性）→ 檔案存進部署者「我的雲端硬碟」根目錄**，且每個檔設「知道連結的任何人」可看。建議：建專用資料夾＋設 OJT_FOLDER_ID、程式改網域內可看、既有檔依 OJT_Tasks 的 OjtFileUrl 批次改權限（待使用者決定）。
- 密碼明碼＋預設生日（既有取捨）：確認 Users 試算表共用名單最少。
- 低：店長可改他部門必修課（`setDeptMandatory` 未檢查部門）；登入訊息可分辨工號存不存在；可惡意連錯 5 次鎖人 15 分鐘。
- 未查：正式試算表、OJT 資料夾、GAS 部署、Vercel 的實際共用設定（要後台）。

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

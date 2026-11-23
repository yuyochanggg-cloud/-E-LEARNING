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
2. 前端：本機 `npm run dev:staging`，或 `npm run deploy:staging` 部署成 Vercel 預覽（有 Vercel 登入保護）；腳本會把固定網址 **https://lx-elearning-staging.vercel.app** 指到最新部署（2026/11/19 起），demo／測試一律用這個網址，不用每次換
3. 用測試帳號走過受影響的流程，並到測試試算表確認資料寫對
4. 通過後才推正式：clone 正式專案（scriptId `1VsvmCYls0Y-p2YVFeY3y8iaJT3USNGSOeEBVpkT8vAM2wkSJCba72iQu`）→ **先 diff 線上 `程式碼.js` 與本機 Code.gs（之後還有 `Experiment.js`），不同就停** → 覆蓋 `程式碼.js`＝Code.gs、`Experiment.js`＝gas/Experiment.gs（**不要**放 Setup／SeedItems）→ `clasp push -f` → `clasp create-deployment -i AKfycbxTcxKo...`（既有正式部署 ID）。正式推送一律先問使用者
5. 2026-11 起後端有兩個檔：`gas/Code.gs`（主程式）＋`gas/Experiment.gs`（門市對練實驗：課程可見性 helper、前後測、練習自陳）。Code.gs 會呼叫 Experiment.gs 的 `_parseVisibleTo`／`_isVisibleToDept`／`_canSeeCourse`，**正式專案少推 Experiment.js 會整個壞掉**

注意：
- `gas/staging/Setup.gs` 只推 staging，不要推到正式專案；`gas/staging/appsscript.json` 比正式多一個 `userinfo.email` 權限（Setup 需要）
- 正式課程複製到測試：staging 的 Script Properties 設 `PROD_SHEET_ID` 後執行 `importCoursesFromProd`（只讀正式表）
- 正式專案沒有設 `APP_ENV`，`_sendMail` 會照常寄信；**不要在正式專案設 `APP_ENV`**

## 5.6 門市對練實驗（方案 4，2026/11/30 開課、8 週到 2027/01/24）上線清單

規格依 2026/11/16 會議：左側獨立「門市對練」入口；每店受訓 2 類 × 每類 4 品項 × 每品項正式練習 2 次＝16 次；排程（11/17 定案）：每週 2 次可同一天、練滿關到下週一、上週不足只能本週補；某款第 1 次後隔天起第 2 次必出現；空位隨機補新款、兩類平均、員工不自選；每日最多 2 次；員工端前後測都叫「商品知識測驗」、不顯示分數；後測在「16 次練完」或「後測課 OpenFrom」先到者開放；交後測＋16 次都完成才發完課勳章；自主練習另一堂課、不限類別與商品但要填類別＋商品、不計入正式。
程式：`gas/Experiment.gs`＋`src/Experiment.jsx`（DrillView）。staging 冒煙測試 `stagingSmokeExperiment`（Setup.gs）42 項全過，並用前端實走前測→今日派題→回報→bot→自主練習。

**11/18 改成兩層（使用者決定：AI 對練會一直存在，實驗與指定品項只是這一期）**：
- 常駐層「AI 門市對練」＝ EXP-SELF（selfpractice）課：到 OpenFrom 就出現在課程資源庫（職人練功坊）與左側入口，點了進對練頁；內容是 bot＋自主練習紀錄；不算完課、不進儀表板。VisibleTo 決定誰看得到（空白＝全公司）。
- 本期任務：檔期內（`實驗_設定` 開始日期起 8 週）、有派品項（`實驗_門市分派`）、看得到且已開放 EXP-PRE 的人，對練頁最上面才出現（前測、本週次數、今天的正式練習、品項進度、後測）。檔期結束後只留給「前測做了、後測沒交」的人補後測。前測做完前自主練習先鎖住（避免影響前測）。
- 檔期外的自主練習「週次」留空，`refreshExperimentSummary` 不算進本期。
- 下一期換商品或規則：改 `實驗_品項`／`實驗_門市分派`／`實驗_設定`，不必改程式（前後測紀錄目前一人一次，下一期若要再測需另處理）。
- 前端驗證：預覽站用模擬回應看過 4 種狀態（任務進行中、前測未做、無任務只剩常駐層、未開放）與資源庫卡片／左側入口在開放日前隱藏。

上正式前依序：
1. 門市分派與選品已定案，放在 **`gas/seed/FinalData.js`（gitignore，不進 GitHub；repo 是公開的，分組與對照類別不能公開）**，原始清單見 Codex 資料夾的定案選品 xlsx。換電腦時要從 xlsx 或舊電腦把這個檔帶過來。使用者還要提供：定稿題目（每類 7 題 × A/B、啟用=TRUE）→`實驗_題目`、正式 bot 網址
2. 推正式後端（Code.gs＋Experiment.js＋**FinalData.js**，見 5.5 第 4 點；少推 FinalData.js 時分派與品項不會自動填，要手貼）→ 正式編輯器執行 `setupExperimentSheets`（建分頁；`實驗_門市分派`、`實驗_品項` 空的會自動寫入定案資料；`實驗_設定` 預設 開始日期 2026/11/30、總週數 8、每品項次數 2、每日上限 2、每週次數 2、練習網址＝要填 bot 網址）
3. 題目貼進 `實驗_題目` 後先執行 `checkTestItems`（只讀不寫；檢查標題欄、題號重複、子類名稱、卷別 A/B、題幹與四選項不空白、選項不重複、答案 A–D、啟用 TRUE/FALSE、每類每卷 7 題，問題列出第幾列），通過再 `previewTestForms` → `assignTestForms`；開課當天（或前一天）執行 `snapshotParticipants` 存分組快照（之後調店不改分組；調整請填 `實驗_調整紀錄` 再跑 `applyParticipantAdjustments`，會留原門市／時間／處理人）
4. Courses 加四列（VisibleTo＝8 店；Category＝職人練功坊）：EXP-PRE（test、pre、標題「商品知識測驗」、**OpenFrom＝2026/11/30**）、EXP-PRAC（practice、**OpenFrom＝2026/11/30**）、EXP-SELF（selfpractice、標題「AI 門市對練」、**OpenFrom＝2026/11/30**；這張會出現在資源庫）、EXP-POST（test、post、標題「商品知識測驗」、Badges＝完課勳章名、OpenFrom＝2027/01/18 第 8 週）。**OpenFrom 沒到之前，資源庫卡片、左側入口、測驗與練習 API 全部關閉**，所以可以提前上正式
5. 部署正式前端（GitHub Pages `npm run deploy`）
6. 每週在正式編輯器執行 `refreshExperimentSummary` → 看「實驗_檢核」（各店完成率、每週次數、個人 x/16、未完成品項、後測、完課、自主練習）

**2026/11/18 已上正式**：後端正式部署 @56（上一版 @55，退版用 `clasp update-deployment AKfycbxTcxKo... -V 55`）；正式推送方式＝clone 正式專案到暫存資料夾，`程式碼.js`＝Code.gs＋`Experiment.js`＋`FinalData.js`，appsscript.json 沿用正式版。已完成第 2、4、5 步：`setupExperimentSheets` 已跑（門市分派 8 列、品項 64 列自動寫入）、`實驗_設定` 練習網址已填 altatech bot、Courses 第 30–33 列為 EXP-PRE／PRAC／SELF／POST。上線前唯讀檢查：27 堂一般課都有 AiQuiz（資安修正不會讓課完不了）；8 店名稱與 Users 部門一字不差（共 76 人；高雄中華店、高雄時代店不在 VisibleTo）。GitHub Pages 前端 index-CyYxNqgo.js。**未完成**：第 3 步（題目、snapshotParticipants）；正式 appsscript.json 沒有 `userinfo.email`，`previewOjtFileMigration`／`applyParticipantAdjustments` 呼叫 `Session.getEffectiveUser().getEmail()` 會「權限不足」失敗 → 改用 `_myEmail()`（DriveApp 根資料夾擁有者信箱，不需新權限）。11/19 clasp 重新登入後：staging `stagingCheckOjtMigration` 通過 → 正式部署 @57（上一版 @56）→ 正式 `previewOjtFileMigration`：要改 0、已符合 0、非我擁有 0、外部連結 5、找不到 3（第 3–5 列檔案已不存在）→ **沒有舊檔需要搬，不用跑 apply**。
**2026/11/19 前端更新上正式**（GitHub Pages index-BisMZu17.js）：品項卡按鈕改「複製品名並開啟 AI 對練」、對練視窗接在該卡片下方（卡片展開整行）、移除「指定品項進度」；自主練習同樣接在按鈕下方。staging 加了 demo 帳號 T0005（測試市民＝台北市民店的類別與 8 款，密碼由使用者自填）。

**2026/11/20 店長／督導看 AI 對練進度＋每月 25 號月報（staging 完成，未上正式）**
長期方向（使用者 11/19）：這兩個月實驗是「先跑統計＋讓大家習慣」；之後由店長自己指定要練的品項、督導查看；**之後不再需要前後測**。
- 角色：Users.Role 新增 `supervisor`（督導，唯讀）：左側只有「AI 對練進度」，看全部門市；不能 OJT 審核、部門報表、必修設定（API 本來就擋）。`manager` 在主管審核中心多「AI 對練進度」分頁，只看自己部門；開始日前或門市沒派品項就不顯示分頁。`admin` 全部可看，開始日前也可預覽。副作用：supervisor 不算 employee → 不會收到必修逾期通知、不計入部門報表人數。
- API `getPracticeProgress`（Experiment.gs）；計算共用 `_expTeamData`（之後改成店長指定品項，只要換「哪些門市派了哪些品項」那段來源）。只回完成狀況：**不含測驗分數、不分類別／對照類**（研究欄位只在「實驗_檢核」）。達標＝累計正式 ≥ 每週次數 × 已過週數（上週不足可本週補）。「本月」＝最近一次 25 號起。
- 月報：`sendMonthlyPracticeReport`（排程用 `setupMonthlyReportTrigger` 建，每月 25 號 08:00 台北），區間＝上月 25 日～本月 24 日（不早於開始日）。店長信＝自己門市摘要＋同仁明細；督導信＝各店總覽（達標率低→高，⚠＝人均低於應有進度）。開始日前、檔期結束後的區間不寄；涵蓋檔期結束那封＝「整期總結」（1/25）。`實驗_設定`「月報寄送」只有填「正式」才寄店長督導，其他一律只寄執行者自己（合成一封預覽，附每封收件人與沒填信箱名單）；同區間正式寄過不重寄；紀錄在「實驗_月報紀錄」。手動預覽 `previewMonthlyPracticeReport`。`_sendMail` staging 改寄時 htmlBody 也加註原收件人。
- 驗證：staging `stagingSmokeTeam` 40 項、`stagingSmokeExperiment` 42 項、`stagingSmokeSecurity` 11 項全過；`stagingPreviewReport` 寄出預覽；本機 staging 前端用 `stagingIssueTokens` 產生的測試憑證以 T0006 督導／T0002 店長／T0003 員工實點（督導看兩店＋點店看明細、店長只看自己店、員工沒有入口）；模擬資料看過手機寬度與開始日前隱藏。staging 前端已部署。
- **上正式步驟**：推正式後端（程式碼.js＋Experiment.js＋FinalData.js）→ 正式編輯器跑 `setupExperimentSheets`（補「月報寄送＝測試」與「實驗_月報紀錄」）→ `setupMonthlyReportTrigger` → Users 把督導 Role 改 `supervisor`（名單待使用者提供）→ 唯讀查店長／督導 Email 空白名單給使用者 → 前端 `npm run deploy`。第一封（12/25）先維持「測試」只寄使用者，確認後使用者自己改「正式」。

**2026/11/20 A/B 卷題目已貼進正式「實驗_題目」**：來源＝使用者提供的 `Store_Test_AB_Reviewed_Package.zip`（Codex 產出，`Final_56Q_Import.csv`；含答案，不進 repo）。題號 A01–A28／B01–B28；子類對應「無線網路→無線網路（路由器＋Mesh）」「物聯網攝影機→物聯網（攝影機）」；全部啟用 TRUE。貼上後以 gviz 讀回逐字比對 SHA-256 與來源一致；正式 `checkTestItems` 通過（四類 A7／B7）。答案鍵與套件盲審作答 56 題一致；正解 ABCD 各 7 題。正式 `previewTestForms`（只讀）：8 店共 77 人待分配，各店 A/B 差 ≤1。**`assignTestForms` 尚未執行**（等使用者確認）；之後新進人員再跑一次只會補沒卷別的人。
- 11/20 正式 Users 的 Email 欄依公司 Workspace 帳號清單（使用者提供，含個資不進 repo）以姓名比對補齊：空白補公司信箱 59 筆、改 2 筆（使用者指定），讀回逐列比對工號／姓名／Email 全符合；Email 空白 155 → 96。影響：這些人登入不再跳補填信箱視窗，並開始收得到系統通知信（必修逾期等）。督導 3 人（營業通路處，目前 Role＝manager，該部門無一般員工）Email 皆為公司信箱，待上正式時改 `supervisor`。另有 1 人有公司帳號但 Users 無資料，待使用者給工號新增。
- **2026/11/23 督導＋月報已上正式**：clasp 又 `invalid_rapt` → 重新登入 → gas_safe_push（線上已與本機相同，快照更新）→ 正式編輯器 `setupExperimentSheets`（建立「實驗_月報紀錄」；「月報寄送」預設「測試」）→ `setupMonthlyReportTrigger`（每月 25 號 08:00）→ 版本 58、正式部署 @57→@58（未登入呼叫 `getPracticeProgress` 正確回「登入已逾期」）→ Users 督導 3 人 Role 改 `supervisor`（manager 28→25）→ 前端 GitHub Pages index-BwqSG69u.js。退版：`clasp update-deployment AKfycbxTcxKo... -V 57`。
- 11/23 正式：督導共 4 人（營業通路處，含處長秘書；業務部經理不列）。參與者快照 77 人、A/B 卷已分派（刪掉混入的測試帳號；該帳號 Users 部門仍是門市，11/30 再跑快照會被加回，需改部門或再刪）。Users 標題列曾被誤改導致快照 0 人／登入失效，已修回 → 建議保護第 1 列。
- **staging 多視角測試帳號**（`setupViewDemo`，Setup.gs）：8 家定案門市各 `V-<代碼>-E` 店員、`V-<代碼>-M` 店長、`V-<代碼>-D` 示範同仁（已交前測＋不同練習次數），加 `V-SUP` 督導；共用密碼在 `gas/staging/seed/ViewAccounts.js`、清單在 `gas/staging/seed/測試帳號清單.md`（皆 gitignore）。冒煙測試會清實驗資料 → 跑完再執行 `setupViewDemo`。`_assertStagingSpreadsheet` 門檻 20→60 列。staging 編輯器若報「找不到工作表 <數字>」→ 先開 staging 試算表點任一分頁再跑。已用憑證實點督導（10 店總覽）、三創店長（只看本店 3 人、新品項）、三創店員（前測入口）。
- **staging 題庫已換假題（11/23）**：`gas/staging/seed/SeedItems.js`（gitignore）改為 56 題明顯標示「測試假題，與正式卷無關」的數字題（題號 `FAKE-<類>-<卷><序>`、四類 × A/B 各 7 題、答案 ABCD 各 14），取代原 v2 候選題（約 5 題與正式卷相近，而 staging 試算表全公司可看）。已推 staging（部署 @15）並重跑 `setupViewDemo`，讀回 `實驗_題目` 56 列全為假題。注意：staging 試算表／GAS 的「版本記錄」仍留有舊題，只有編輯者看得到。
- 前端：測驗題幹加 `whitespace-pre-line`（A05、B05 題幹有換行列四把鍵盤規格），要在 11/30 前隨前端部署；因 main 已含督導前端，須與督導後端一起上。

效能備註：`getExperimentStatus` 每次讀約 8 張表，`submitPractice` 會算 3 次狀態，staging 單次約 2–4 秒；80 人規模可接受，若門市反映慢再加快取。

注意：日期欄（開始日期、OpenFrom、DueDate）一律在試算表手打，程式以「台北的那一天」解讀；不要用程式寫 Date 物件。

## 5.7 資安（2026/11/18 檢查與修正）

已修（staging 驗證：`stagingSmokeSecurity` 11 項、`stagingSmokeExperiment` 35 項全過；2026/11/18 已上正式 @56）：
- `completeCourse` 不再相信前端：課程要存在且看得到；門市對練課只能走門市對練流程；OJT（OjtRequired 或「實戰解鎖」）只回 `pendingOJT`、不寫入；一般課要 6 小時內 `submitQuiz` 後端算到 100 分（CacheService `quizpass_`）；勳章一律用 Courses 設定。內部寫入改 `_completeCourseRecord`（門市對練也用它）。
- `updateProgress`：單次最多 120 分、每人每天 480 分。

待決（使用者決定）：
- GitHub repo 為 PUBLIC。改私人會讓 GitHub Pages 正式站失效（免費帳號），要先改用 Vercel 正式站或升級 Pro。已推上去的 48 個 commit 查過沒有個資、密碼、金鑰、分組選品，只有試算表／GAS 的 ID 與 API 網址（無共用權限就打不開），不改寫歷史。分組與選品已移到 gitignore 的 `gas/seed/FinalData.js`；11/18 push 前掃過：commit 中只有店名（抽籤腳本配對、staging 測試對照），沒有店別×類別、沒有型號、沒有抽籤種子。
- OJT 上傳：11/18 前正式 GAS 沒有 `OJT_FOLDER_ID`，檔案存在部署者「我的雲端硬碟」根目錄、每檔「知道連結的任何人」可看。
  - **11/18 已在正式 GAS 指令碼屬性設定 `OJT_FOLDER_ID`＝「良興雲端學院用」資料夾（1lwIjuLCjUDQRNzJf-AB98AgHZT0hcBPe，擁有者使用者、一般存取＝良興網域知道連結可看）**，新上傳檔會集中到這裡（權限仍由程式設定）。
  - OJT 連結只出現在「主管審核中心」（店長／管理員）；員工上傳由 GAS 以部署者身分寫入，員工有無公司帳號不影響上傳。
  - **11/18 定案**：使用者確認審核店長都有公司帳號（部分一般同仁用外部信箱，但他們只上傳、不開連結）→ 新上傳檔改 `DOMAIN_WITH_LINK`（staging `stagingCheckOjtSharing` 通過）。舊檔搬家工具 `previewOjtFileMigration`／`applyOjtFileMigration` 已在 staging 用 `stagingCheckOjtMigration` 實測（公開→網域內、移進資料夾）。**推正式後：先 preview 看數量 → 使用者同意 → apply**；審核者要登入公司 Google 帳號才能看照片。
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

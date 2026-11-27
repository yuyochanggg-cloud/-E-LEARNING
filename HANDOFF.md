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
5. 部署正式前端（11/26 起 `npm run deploy`＝`vercel --prod`，正式網址 lx-elearning.vercel.app；GitHub Pages 只放跳轉頁，見 5.7 末）
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
- **11/23 正式 Users 測試帳號處理**：三創測試帳號（第 200 列）部門由門市名改為「測試」，11/30 再跑 `snapshotParticipants` 不會被加回；讀回確認，實驗_參與者／卷別分配仍各 77 人、無測試帳號。正式角色核對（只讀）：8 家實驗門市各有 1 位 manager，營業通路處 4 位 supervisor。正式店長／督導實際登入畫面尚未驗證（需本人或使用者登入）。
- **11/23 開跑前檢查（只讀）**：實驗_設定 開始 2026/11/30、8 週、每品項 2 次／每週 2／每日 2；練習網址＝使用者確認的正式 bot；8 店 × 2 類 × 4 品項＝64 列全啟用；EXP-PRE／PRAC／SELF 開放 11/30、EXP-POST 2027/01/18（VisibleTo 用「、」分隔，程式支援）；名單／卷別 77 人（A40／B37）與 Users 8 店人數一致；GAS @58、前端 index-BwqSG69u.js。待辦：77 人中 69 人 LastLogin 空白（含 6 位店長）→ 建議開課前發登入通知；bot 是否已有 KC200／G515 待確認。
- **11/25–26 壓力測試與修正（commit 637a981，正式 GAS @60＋前端 index-BlLywcYY.js）**：staging 30 帳號同時操作（`scripts/load-test.mjs`，憑證用 staging `stagingIssueLoadTestTokens` 產生、測完 `stagingLoadTestCleanup`；`CLIENT=1` 模擬前端重送）。發現並修正：① `_expAppend` 寫完沒 flush 就放鎖 → 同時交卷答案被覆蓋（6 人成功只留 2 人）；② 交卷／回報鎖 10 秒＋逾時訊息被包成系統錯誤 → 大量失敗、前端重送沒生效；改 tryLock 30 秒、鎖內只做檢查與寫入、前測完課同鎖、Code.gs 放鎖前 flush；③ 讀表加速：網頁請求內同表只讀一次、靜態實驗表與 Users 對照表（不含密碼）暫存 5 分鐘、已交卷記號暫存；**手動改實驗表或人員角色要立即生效 → 正式編輯器執行 `expClearCache`**（snapshot／assign 會自動清）；④ 前端名單內動作 25 秒逾時自動重送一次、練習回報 requestId 防重複、排隊提示。結果：單人進對練頁 4.7–7.3s→2.3–2.9s；30 人同時讀取全成功、交卷 19/19、回報 27/27，讀回無覆蓋無重複。冒煙：Security 11/11、Team 40/40、Experiment 40/42（2 項因 staging 已進第 2 週、測試寫死第 1 週額度，非本次問題）。注意：推正式時誤帶到另一個 session 未 commit 的 _cellSafe（@59 約數分鐘），已改回 637a981 部署 @60；退版用 `-V 58`。正式店員／店長實際登入仍待驗證。
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

**2026/11/26 Security Gate**（報告 `~/claude/outputs/reports/良興雲端學院_SecurityGate_2026-11-26.md`；結果 FAIL，阻擋原因是既有的 F-01 密碼明碼、F-02 公式注入；督導＋月報新功能本身沒有阻擋問題）
- **F-02 試算表公式注入**：使用者輸入以「=」開頭的字串會被存成公式（staging 實測：自主練習商品名 `=1+1` 存成 2）。修正：Code.gs 新增 `_cellSafe`（以 `= + - @`、tab、換行開頭的字串前面加 `'`），套用到 `_buildRow`、`_expAppend`、密碼、通知信箱 ×2、退回理由。staging 推送並部署 @19；`stagingCheckFormulaInjection` 6/6、`stagingSmokeSecurity` 11/11 通過。commit fe418f1（基礎＝637a981）。**11/26 已上正式 @61**：推送前確認線上是 @60＝637a981（程式碼.js、Experiment.js 與 637a981 逐字相同），gas_safe_push 只推這兩檔（FinalData.js 維持正式原檔不動）→ 建版本 61 → 正式部署 @60→@61；未登入呼叫 `getPracticeProgress`／`bootstrap` 都回「登入已逾期」，doGet 正常。退版：`clasp update-deployment AKfycbxTcxKo... -V 60`。前端沒有改。之後新增任何「把使用者輸入寫進試算表」的程式，都要經過 `_cellSafe`。
- **F-01 密碼改存雜湊（使用者 11/26 決定）**：commit 52f500c。`Users.Password` 存 `h2$200$鹽$雜湊`（每人隨機鹽，SHA-256 重複 200 次；2000 次實測產生 1.4 秒／比對 1.1 秒太慢，200 次約 0.09 秒）。舊 `sha256:` 格式和還沒轉換的明碼仍可登入。`changePassword` 一律存雜湊、擋空白新密碼；**新密碼可以跟舊的一樣**（使用者決定不強制，也不加長度或英數規則）。**HR 做法不變**：新增同仁或重設密碼，就在 Password 欄打臨時密碼、IsFirstLogin 設 TRUE；排程 `hashPlainPasswords` 每 10 分鐘把明碼轉成雜湊（單次最多跑 4 分鐘，剩下的下一輪再轉）。轉換後 HR 就查不到密碼，只能重設。staging @21 `stagingCheckPasswordHash` 18/18 通過（暫時帳號 T9PW，測完刪除；沒有動其他測試帳號的密碼）。**還沒上正式**。上正式步驟：從 commit 取檔推正式 → 建版本、更新部署 → 正式編輯器執行 `previewPlainPasswords` 看筆數 → 使用者同意後執行 `hashPlainPasswords` → `setupPasswordHashTrigger`。注意：試算表的「版本記錄」仍看得到轉換前的明碼，有編輯權的人都能看。
- **管理員密碼重設（使用者 11/26 選「系統產生隨機臨時密碼」，不用生日或全公司共用密碼）**：commit 7aff4b1。系統管理中心新增「密碼重設」分頁（只限 admin）：輸入工號 → 查詢確認姓名 → 重設 → 畫面只顯示一次 6 碼臨時密碼，請 HR 轉告本人。後端 `resetUserPassword`（只限 admin；`dryRun` 只查姓名）：存雜湊、IsFirstLogin＝TRUE、解除連錯鎖定，寫入「密碼重設紀錄」（時間、工號、姓名、處理人，不記密碼）。前端 gasClient 不會自動重送這個動作（重送會產生另一組密碼）。staging @22 `stagingCheckPasswordReset` 12/12 通過；畫面實測：以 T0001 管理員重設暫時帳號 T9UI，顯示 6 碼，用臨時密碼登入成功且要求改密碼，測完以 `stagingDropTempUser` 刪除。HR 直接在試算表打明碼的舊做法仍可用（排程會轉成雜湊）。**還沒上正式**；前端上正式要 GitHub Pages 和 Vercel 兩邊都部署。
- **11/26 密碼雜湊＋管理員重設已上正式**：推之前確認線上是 @61，程式碼.js／Experiment.js 與 fe418f1 一字不差；從 commit 取檔，gas_safe_push 只改了程式碼.js → 版本 62 → 部署 @61→@62。未登入呼叫 `resetUserPassword`／`bootstrap` 都回「登入已逾期」。前端 `npm run deploy`（GitHub Pages）＋`vercel --prod`：兩站都是 index-ThzH-Po7.js，含「密碼重設」、指向正式 API，登入頁正常、console 沒有錯誤。退版：後端 `-V 61`。**正式 `previewPlainPasswords`（唯讀）：明碼 200 筆、空白 0 筆。`hashPlainPasswords` 和 `setupPasswordHashTrigger` 等使用者同意才執行**（執行後就無法還原：HR 會查不到任何人原本的密碼）。在那之前，正式密碼仍是明碼，但新改的密碼和管理員重設的密碼已經存成雜湊。
- **11/26 正式網址統一為 Vercel**（使用者選項 1、2、3）：commit 67ad658。`npm run deploy` 改成 `vercel --prod --yes`（只部署一處；`.env` 是正式 API）；`npm run deploy:pages-redirect` 把 `pages-redirect/`（index.html＋404.html）發布到 GitHub Pages，舊網址一律跳轉 lx-elearning.vercel.app 並保留 `?courseId=`。網頁標題改「良興雲端學院」、`lang=zh-Hant`。`vercel.json` 加安全標頭：nosniff、X-Frame-Options DENY、Referrer-Policy、CSP（`connect-src` 只開 script.google.com／script.googleusercontent.com；`frame-src https:` 給教材和 AI 對練 bot；`script-src 'self'`）。之後如果新增外部服務（字型、分析、其他 API），要記得加進 CSP，不然會被擋。staging 驗證：登入與讀資料、AI 對練 bot、Drive 教材 iframe、音訊都正常，外部 script 會被擋；跳轉頁本機測試保留查詢參數。**11/26 已上正式**：`npm run deploy`（Vercel）→ 回應標頭裡 CSP、XFO、nosniff、Referrer-Policy 都在，標題「良興雲端學院」、lang=zh-Hant，bundle 仍是 index-ThzH-Po7.js；在正式站頁面裡呼叫 GAS 正常，沒有任何 CSP 違規；`npm run deploy:pages-redirect` → 舊網址 `…github.io/-E-LEARNING/?courseId=STG001` 會跳到 `lx-elearning.vercel.app/?courseId=STG001`，其他找不到的路徑（404）也會跳轉。同仁在新網址要重新登入一次（登入狀態是各網址分開存的）。之後 GitHub repo 可以改成私人（使用者在 GitHub 設定；改私人後 Pages 跳轉頁也會失效，舊網址就打不開了）。
- **11/26 前後測加作答提醒（使用者要求）**：`src/Experiment.jsx` 前測／後測入口卡片與作答頁頂端，粗體「不能查資料，也不要討論，請憑直覺直接作答」。staging 以 V-SC-E 看過入口卡片與作答頁（未交卷）；後測卡片只確認程式碼。已部署 staging 與正式（Vercel，bundle index-DLLasVHh.js，內含 3 處新文字）。正式前端以 HEAD d9255a2＋此改動部署；兩項同一個 commit（訊息開頭「門市對練：前後測加」）。
- **11/26 品項卡「今天已完成」隱藏「複製品名並開啟 AI 對練」按鈕（使用者要求）**：`ItemCard` 以 `!doneToday` 包住按鈕；說明文字（打開下方 AI 對練…）沒動。staging 以 V-SC-D 回報 Deco X10 一次實測（staging 多一筆紀錄，可重跑 setupViewDemo）。已部署 staging 與正式（Vercel，bundle index-kAONNcr2.js，含前一項作答提醒）。兩項同一個 commit（訊息開頭「門市對練：前後測加」）。
- **11/26 今日清單依當天空位截斷（實測 F18／F21 修正，使用者要求）**：`_expComputeState` 的 todayList 改為 pinned（依第 1 次日期由早到晚）＋picks 取前 slots 個。修正前：待補第 2 次的款全列（V-SC-D 一天 4 張卡但只能回報 2 次）、本週練滿後未完成卡仍可按。只看今天之前的紀錄排序，當天清單固定、練過的卡一定留著。冒煙 stagingSmokeExperiment 改依當週額度（原本寫死第 1 週）＋新增 4 項純計算檢查 → 46/46；Team 40/40。staging GAS @23；畫面以 V-SC-D 實測：2 張卡、回報兩次後只剩「✓ 今天已完成」。**11/26 已上正式 @63**：clone 正式專案比對，程式碼.js、Experiment.js 與 HEAD 一字不差；gas_safe_push 只改 Experiment.js → 版本 63 → 部署 @62→@63；未登入呼叫 getExperimentStatus／bootstrap 都回「登入已逾期」。退版：`clasp update-deployment AKfycbxTcxKo... -V 62`。前端沒有改。
- **11/27 月報副本（使用者要求：管理部主管要收月報、但保留 manager 權限）**：`實驗_設定` 新增「月報副本」（逗號／頓號／分號／空白分隔多個信箱）。督導月報另外寄給這些信箱，收件人整份不分大小寫去重（staging 兩個督導共用信箱也只寄一次）；格式錯的信箱列在寄件紀錄的「沒填信箱」。店長信不受影響，不改任何人角色。`setupExperimentSheets` 沒有這一列會補空白列。stagingSmokeTeam 新增 5 項 → 45/45；staging GAS @25；跑完已 setupViewDemo。**11/27 已上正式 @64**（gas_safe_push 只改 Experiment.js；@63→@64；未登入呼叫回「登入已逾期」；退版 `-V 63`）。正式「實驗_設定」尚未加「月報副本」列，沒加之前行為與原本相同。上正式後：正式「實驗_設定」手動加一列「月報副本｜信箱」（或跑 setupExperimentSheets 補空白列）。
- 其他待決：F-03 月報只寄公司網域信箱，以及報告列出的 Low 項目。
- staging「實驗_練習紀錄」留有一列修正前的測試資料（V-SC-E 自主，商品名與備註是公式 2／5），重建示範資料時會一起清掉。

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

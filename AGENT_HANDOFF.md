# Agent 交接紀錄

> 工作區規則：每次修改網站程式、樣式、資料或部署設定後，必須在本檔新增一筆紀錄。紀錄要包含日期、修改內容、驗證方式、Git 狀態與尚未完成事項，方便切換 Agent 後快速接手。

## 2026-09-08｜Phase 2 教師派作業與學生「我的任務」第一版

### 修改

- 新增 `lib/typing-schema.js` 與 `database/assignments.sql`，建立 `typing_assignments`、`typing_assignment_targets`、`typing_student_access`、`typing_student_sessions`，並以相容 migration 為 `typing_records` 增加 nullable `assignment_id` 與索引；既有成績不刪除、不重建。
- 新增 `api/assignments.js`：教師可建立、查看、修改、停用／重新啟用測速作業；第一版支援英文／中文、15／30／60／120 秒、最低正確率、最低速度、有效次數、開始／截止時間與多班指派。學生端 `GET /api/assignments?view=mine` 只在有效學生 session 下回傳該生所屬班級的作業與 `未開始／進行中／已完成／已逾期` 狀態。
- 新增 `api/student-access.js` 與 `lib/student-session.js`：教師為單一啟用中學生產生一次性隨機啟用碼，資料庫只保存 SHA-256 hash；明碼 7 天內可兌換一次，兌換後建立 HttpOnly、Secure、SameSite=Strict 的 8 小時學生 session。重新發碼會撤銷該生舊 session；學生可按「結束使用」撤銷目前 session。
- 新增 `assignments.js`：首頁「我的任務」登入與任務卡、教師端「作業管理」分頁、作業建立／編輯／停用、一次性學生啟用碼發放，以及一鍵把指定語言／秒數帶入既有測速流程。
- `teacher-auth.js` 改為頁面 load 後先載入 `cloud-students.js`，再載入 `assignments.js`，避免外掛模組早於 `app.js` globals。
- `api/records.js` 支援 `assignmentId`：自由練習維持既有公開寫入；正式作業成績必須有學生 session、student ID 必須與 session 完全一致，伺服器再覆蓋班級／姓名／座號並核對作業語言、秒數與 builtin 類型。正式作業建立時間改用伺服器時間；相同 record ID 仍以 `ON CONFLICT DO NOTHING` 去重。
- 待傳正式作業若在共用電腦換成另一學生登入，伺服器會因 student ID 不一致回 403，不會把前一位學生的待傳紀錄錯掛到目前學生。
- 教師完整成績查詢現在會先安全執行 assignment schema 相容檢查，避免 Production 尚未新增 `assignment_id` 時查詢舊資料表失敗；schema 初始化在單一 Vercel instance 內以 Promise 快取，冷啟動失敗仍可重試。
- 所有新增 POST／PATCH 流程加入同源檢查；學生作業列表不提供匿名全校／全班名單。
- 新增 `tests/assignments.test.cjs`，並擴充 GitHub Actions 測試／syntax check 範圍。

### 驗證

- `tests/assignments.test.cjs` 驗證作業欄位、班級去重、門檻／秒數拒絕、`assignmentId` 驗證與學生 cookie helper。
- 舊 `tests/records-auth.test.cjs` 已更新 mock 依賴，確認新增 schema/session helper 不破壞原教師成績授權測試。
- GitHub Actions run `34231444450`：Node tests、Syntax checks 全部 success（含待傳作業身分綁定與 schema 相容修補）。
- GitHub Actions run `34231524301`：Node tests、Syntax checks 全部 success（含 schema instance cache）。
- Vercel 對 commit `8e52945` 回報 deployment status `success`。
- 未讀取、顯示或變更教師密碼／session secret；未使用正式教師密碼做 production assignment 寫入，因此尚未完成真實教師→學生完整 E2E。

### Git／部署

- Phase 2 主要 commits：`92325f3`（schema helper）、`4655b88`（一次性學生啟用碼）、`7509021`（作業 API）、`78ff3dc`／`eeba824`（assignment 成績與安全修補）、`64f4fc7`（前端 UI）、`8e52945`（schema cache）。
- 已全部推送 `main`；Vercel 對目前已檢查 HEAD 回報 success，正式站仍為 `https://typing-practice-room.vercel.app`。

### 待辦／下一階段

- 必做 production 人工驗收：教師登入→確認雲端名單→建立一份 701 英文 60 秒／90%／20 WPM／3 次作業→替一位 701 學生產生啟用碼→學生兌換→完成 1／3、2／3、3／3→重新整理與另一瀏覽器確認狀態一致。因本次未使用真實教師密碼，不能把這項標為已通過。
- Phase 3「教師作業完成度儀表板／課堂投影模式」尚未做；目前教師可管理作業，但不會在作業列表直接顯示每位學生完成表。
- 第一版正式作業會驗證學生 session、作業歸屬、語言與秒數，但速度／正確率仍源自既有 client 計分；本系統仍不是正式考試防作弊系統。後續若要提高可信度，再做 attempt token／伺服器核對策略。
- 一次性啟用碼具高隨機性且只存 hash，但目前沒有額外 Postgres rate-limit table；若未來公開大量使用，可依安全規格第 37 節補跨 serverless instance 限流。
- 學生按「結束使用」後需要教師重新發新的單次啟用碼；這是目前共用電腦優先的安全取捨。
- 停用學生是否排除「公開排行榜」仍沿用 Phase 1 待辦；課程進度仍在 localStorage。

## 2026-09-08｜Phase 1 雲端學生名單第一版

### 修改

- 新增 `database/cloud-students.sql` 與教師專用 `api/students.js`，建立 `typing_students`：學生 ID、班級、座號、姓名、啟用狀態、建立／更新時間；班級＋座號＋姓名有唯一索引。
- `/api/students` 的 GET／POST／PATCH 全部要求有效教師 session；未登入不讀名單。POST 每次最多 200 位，前端會分批送出；PATCH 用於編輯、停用與恢復，不提供直接 DELETE。
- API 在通過教師驗證後會以 `CREATE ... IF NOT EXISTS` 確認 schema，因此 Production 不需要另外手動執行 migration 才能首次啟用；SQL 檔仍保留供部署／稽核使用。
- 新增 `cloud-students.js`，在 `app.js` 初始化完成後掛入現有教師介面。第一次教師登入會把該瀏覽器既有 localStorage 名單合併至雲端，之後以雲端啟用名單作為教師端正式來源，本機資料保留為快取／離線 fallback。
- 教師編輯學生時同步更新同 student ID 的成績顯示欄位；若不同裝置曾以不同 ID 建立完全相同身分，匯入時會採雲端既有 ID，並嘗試把同身分舊紀錄歸一到 canonical ID。
- 原「刪除學生」改為「停用」：歷史成績保留，學生移出一般名單；教師端新增「已停用學生」區，可恢復。
- 「清除全部資料」在雲端名單模式改為「清除這台瀏覽器資料」，不刪除雲端名單與資料庫成績。
- `teacher-auth.js` 在 window load 後載入 `cloud-students.js`，避免 script 順序早於 `app.js`。
- 新增 `.github/workflows/test.yml`，main push／PR 自動執行 Node tests 與 JS syntax checks。
- 更新 README 說明雲端名單、停用／恢復、資料邊界與新的驗證命令。

### 驗證

- 新增 `tests/students-api.test.cjs`：學生欄位驗證、未登入不得查詢 roster table、真實教師 session cookie 可讀取雲端名單。
- GitHub Actions run `34229485842`：完成，success。
- GitHub Actions run `34229666000`：`npm ci`、Node tests、Syntax checks 全部 success。
- 最新 README commit `a1f716c` 的 Vercel status：success。
- 未使用或變更教師密碼、session secret；未以正式教師帳號進行 production 名單寫入 smoke test。
- 因 `/api/students` 先驗證教師 session 才 `ensureSchema`，正式 `typing_students` table 會在第一次合法教師名單請求時自動建立；目前不能僅由未登入檢查斷言 production table 已建立。

### Git／部署

- 功能與文件已連續推送 `main`；Phase 1 主要 commits 從 `36ef3ef`（schema）到 `a1f716c`（README）。
- Vercel 對最新已檢查 commit 回報 success，正式站沿用 `https://typing-practice-room.vercel.app`。
- GitHub Actions 已建立並成功跑過兩次，可作為後續 Codex／Agent 共用驗收門檻。

### 待辦／Phase 1 尚未完整收尾

- 尚未用真實教師登入在 Production 實際新增／編輯／停用／恢復一位測試學生，因此跨兩台瀏覽器的 production E2E 尚未人工驗證。
- 公開排行榜目前仍直接依 `typing_records` 身分欄位計算；本版停用學生已從教師／一般選單移除，但「停用狀態是否同步排除公開排行榜」尚未接入，避免在 `typing_students` table 首次建立前讓既有排行榜查詢失敗。下一步可在 records API 加安全的 schema 初始化／inactive 排除。
- 學生在測速頁自行新增的身分仍先存本機，會在教師下次登入同一瀏覽器時併入雲端；尚未提供匿名公開學生名單 API，這是刻意的隱私界線。
- 課程進度仍為 localStorage，未進入本 Phase。
- Phase 2 教師派作業、assignment_id 與學生「我的任務」尚未開始。
- 下一個 Agent 若要繼續，先做一次 Production 教師名單 smoke test，再決定補 inactive 公開排行規則或直接進 Phase 2 assignment schema。


## 2026-09-08｜開發規格安全檢查（僅文件）

- 目標：檢查 e2d5fee 進階規格的安全完整性。
- 修改：新增 security_best_practices_report.md，列出 4 高／3 中規格缺口；主規格第 37 節補學生驗證、逐筆授權、session、CSRF、限流、作業去重、注入防護、共用裝置與遷移驗收。README 增加入口。
- Database migration／Production：無；未改秘密、程式、資料或部署，未進行滲透測試。
- 驗證：文件行號、連結與 git diff --check；安全驗收仍全部待實作，不標示為漏洞已修復。
- Git：文件提交並推送 main，SHA 以 Git log 為準。
- 下一步：第一輪開發同步落實第 37 節，學生私有資料與派課上線前執行負向測試。

## 2026-09-08｜整合進階開發規畫（僅文件）

- 目標：將使用者提供的 ChatGPT 進階規格整合至 typing-practice-room-codex-spec.md。
- 修改：建立現況／待開發狀態表、完整 Phase 1–11 與第一輪範圍，保留原文第 0–36 節；釐清多班目標、舊 ID 關聯、學生存取、有效成績與離線範圍。原初版規格封存 docs/initial-development-spec.md，README 新增入口。
- Database migration：無；未改程式、正式資料或教師密碼。
- 測試：文件完整性、連結目標與 diff 檢查；未重跑應用程式測試，未將規畫驗收標示為通過。
- Production 驗證：本次未部署，沿用 17466ff 功能基準。
- Git：本次文件變更提交並推送 main，SHA 以 Git log 為準。
- 未完成：Phase 1–11 尚待後續實作。
- 下一步：使用者啟動開發後，依第一輪範圍先做雲端名單，再做測速作業與我的任務。

## 2026-09-08｜英文鍵位課程可調練習字數

### 修改

- 英文課程預設 200 字元，可輸入 50–2,000 字元並按套用重新開始；教材沿用本課鍵位循環延長。
- 顯示已輸入／總字元，長教材捲動追蹤目前字元；設定儲存在 settings.lessonLength，支援 JSON 備份還原。
- 中文課程保持原教材。

### 驗證

- Playwright 驗證預設值、50／375／2,000 字元精確長度與完成判定、超界拒絕、重新載入保存、跨英文課程共用與中文不受影響。
- 360px 無水平溢出，檢視設定區截圖；Node 既有測試及語法檢查通過。
- 前次資料庫排行榜已部署，正式公開排行榜 API 回 HTTP 200。

### Git／部署

- 以 44ab84b 為基準提交 main 並部署既有 Vercel 正式站。

### 待辦

- 本次功能無未完成項目。

## 2026-09-08｜排行榜預設使用資料庫

### 修改

- 學生排行榜直接查詢 Postgres，以班級、姓名、座號合併跨裝置最佳成績；公開 API 僅回傳排名欄位，教師完整紀錄維持登入保護。
- 新測驗預設上傳；失敗寫入獨立 localStorage 待傳佇列，重開頁面、連線恢復、每 30 秒及手動操作重試，資料庫以紀錄 ID 去重。
- 更新全站儲存說明，明示身分與成績將存入資料庫並公開排名；讀取失敗不以本機排名替代。

### 驗證

- Node 13 項測試通過，含公開排名欄位限制及教師 API 權限。
- Playwright 驗證資料庫排名、上傳失敗持久保存、重開頁面補傳、手動重試與讀取錯誤提示。
- 語法檢查與 git diff --check 通過。

### Git／部署

- 以 44c4358 為基準提交到 main，部署既有 Vercel 正式站。

### 待辦／限制

- 舊版本機未同步歷史紀錄不自動回補；新完成測驗預設入庫。
- 名單及課程進度仍為本機資料；此變更不改教師密碼。

## 2026-09-08｜補齊鍵盤標點符號

### 修改

- 首頁／教學使用的 `assets/hand-placement.svg` 補上 `{ } | : " < > ?` 的鍵帽上層標示。
- `data.js` 將 SHIFT_PAIRS 擴充為 21 組，符號課程增加八種標點與混合句子。
- `app.js` 補齊方括號、反斜線、單引號的右手小指對應；保留逗號右中指、句號右無名指，所有新增符號搭配左 Shift。
- 新手教學第四步補上對照、指法說明與試打內容；更新 README。

### 驗證

- Playwright 檢查八種符號的按鍵高亮、負責手指與 Shift，21 個鍵帽符號完整顯示。
- 新手試打完整符號列回報全部正確；360／768／1440px 無頁面水平溢出。
- 已檢視首頁完整鍵盤圖與課程鍵帽截圖；新增符號清楚顯示。
- Node 語法與既有測試於提交前執行。

### Git／部署

- 本次修改以 `68b03fc` 為基準，與交接紀錄一併提交並部署到既有 Vercel 正式站。

### 待辦

- 本次符號補齊無未完成項目；教師密碼功能已由前次交接完成部署，本次未更動實際密碼。


## 2026-09-07｜Codex 教師密碼儲存功能接手完成

### 修改

- 接手 Codex 新增的教師密碼變更、資料庫雜湊儲存與雲端 API session 驗證修改。
- 新增 `lib/teacher-credentials.js`、`database/teacher-credentials.sql` 與 `tests/records-auth.test.cjs`。
- 教師密碼資料表已在 Vercel Production Postgres 成功執行，僅保存 salted scrypt hash 與 revision。

### 驗證

- 清除本機殘留資料庫環境變數後執行：`node --test tests/core.test.cjs tests/teacher-auth.test.cjs tests/records-auth.test.cjs`。
- 結果：12 tests passed, 0 failed。
- `node --check app.js`、`node --check core.js`、`node --check data.js`、`node --check api/records.js`：通過。
- `git diff --check`：通過。

### Git／部署

- GitHub commit `8885a77` 已推送到 `main`。
- Vercel Production：`https://typing-practice-room.vercel.app`，已完成部署。
- Production schema 已建立；正式部署完成。

### 待辦

- 已測試正式 `/api/teacher` 未登入回 HTTP 200。
- 已測試正式 `/api/records` 未登入回 HTTP 401，雲端查詢權限正常。
- 尚未在正式站執行真實密碼變更，以避免未經使用者要求修改教師密碼。

## 2026-09-07｜新手引導最後一步改為進入教學

### 修改

- 移除第六步的「試試打字測速」按鈕，只保留「進入基準鍵第一課」。
- 標題與說明改為先練基準鍵，再於熟悉後挑戰測速。

### 驗證

- Playwright 確認第六步僅剩第一課按鈕，點擊後正確開啟基準鍵課程。
- 本次僅調整指定引導頁入口，未新增全站課程解鎖限制。

### Git／部署

- 與本次 HTML 修改一起提交並發布至既有 Vercel 正式站。

### 待辦

- 本次功能無未完成事項；其他既有待辦見前次紀錄。


## 2026-09-07｜接手驗證班級資料與修正雲端登入驗證

### 修改

- 以 `9b909cd` 為接手基準，保留獨立排行榜、Postgres API 與鍵帽直接指法提示。
- 確認既有班級／姓名／座號皆必填，不同班級不共用同名同座號的學生 ID；排行榜與雲端送出內容包含三欄。
- 修正 `api/records.js` 把 base64url 簽章誤認為固定 64 字元的錯誤，改為與預期簽章的實際長度比較，保留 timing-safe 比對。
- 新增跨 API 登入憑證測試及班級備份／CSV 測試，更新 README 的必填欄位與部署說明。

### 驗證

- 修正前，新測試確認有效教師登入憑證查詢雲端會得到 401；修正後得到 200（資料庫使用 mock）。
- `node --test tests/core.test.cjs tests/teacher-auth.test.cjs tests/records-auth.test.cjs`：12 tests passed。
- Playwright 驗證班級／姓名／座號必填、跨班分離、重複報名沿用 ID、排行顯示、重新整理與 360／768／1440px 無水平溢出。
- 瀏覽器雲端送出使用攔截 API 驗證欄位，沒有寫入正式測試成績。

### Git／部署

- 功能 commit `f0c64b7` 已推送 GitHub main，Vercel Production 已部署。
- 正式網址：https://typing-practice-room.vercel.app
- 正式站驗證：未登入查詢回傳 401；使用既有本機憑證登入後，Postgres 查詢回傳 200／陣列，檢查後已登出。未顯示或寫入學生成績。

### 待辦

- 保留先前交接中的密碼輪替與雲端端到端管理限制待辦；本次未變更密碼或資料庫資料。


## 2026-09-07｜移除鍵盤上方浮貼手指圖

### 修改

- `app.js`：移除英文課程鍵盤上方的左右手浮貼區塊與相關動態更新。
- `styles.css`：移除浮貼卡片樣式，保留直接貼在鍵帽上的指法簡碼與目前鍵高亮。
- 移除不再使用的 `assets/left-hand.svg` 與 `assets/right-hand.svg`。
- `README.md`：更新英文鍵位提示說明。

### 驗證

- 待執行：`node --check app.js`、既有 Node 測試與瀏覽器英文課程檢查。

### Git／部署

- GitHub 功能 commit `3503c49` 已推送到 `main`。
- Vercel Production：`https://typing-practice-room.vercel.app`，已完成部署。

### 待辦

- 已確認正式英文課程移除上方浮貼，保留 47 個鍵帽指法標記，下一鍵 `a` 顯示「左小」。

## 2026-09-07｜鍵帽直接指法提示與手掌方向修正

### 修改

- `app.js`：每個英文鍵帽直接顯示左右手／手指簡碼；目前下一鍵在字母鍵上顯示橘色指法提示，不再只依賴鍵盤上方浮貼圖。
- `styles.css`：修正左右手 SVG 的鍵盤視角方向，拇指朝鍵盤中央；目前按鍵的字母與指法徽章同步加強。

### 驗證

- `node --check app.js`：通過。
- `node --test tests/core.test.cjs tests/teacher-auth.test.cjs`：10 tests passed, 0 failed。
- 本機瀏覽器確認鍵帽顯示「左小、左無、左中、左食、右食…」，第一課下一鍵 `a` 高亮「左小」。
- 360px 檢查：`scrollWidth` 345，小於 viewport 360，無橫向溢出。

### Git／部署

- GitHub 功能 commit `0dce8ca` 已推送到 `main`。
- Vercel Production：`https://typing-practice-room.vercel.app`，已完成部署。

### 待辦

- 已確認正式網站鍵帽直接顯示指法簡碼，`a` 鍵顯示「左小」，左手提示卡同步 active。

## 2026-09-07｜英文鍵位浮貼手指提示

### 修改

- 新增 `assets/left-hand.svg` 與 `assets/right-hand.svg` 原創左右手指法圖。
- `app.js`：英文課程鍵盤上方顯示左右手圖、中央下一鍵與負責手指；輸入狀態會即時高亮左手／右手，大小寫另顯示 Shift 手。
- `styles.css`：新增浮貼手指卡片、中央按鍵提示與手機版排列。
- `README.md`：補充英文鍵位課手指提示功能。

### 驗證

- `node --check app.js`：通過。
- `node --test tests/core.test.cjs tests/teacher-auth.test.cjs`：10 tests passed, 0 failed。
- 瀏覽器確認英文第一課顯示浮貼手指圖，下一鍵 `a` 顯示「左手小指」。
- 360px 檢查：`scrollWidth` 345，小於 viewport 360，無橫向溢出。

### Git／部署

- GitHub 功能 commit `db80a39` 已推送到 `main`。
- Vercel Production：`https://typing-practice-room.vercel.app`，已完成部署。

### 待辦

- 已確認正式網站英文課程可載入左右手 SVG，下一鍵 `a` 顯示左手 active 提示。

## 2026-09-07｜排行榜獨立頁面

### 修改

- `index.html`：主導覽新增「排行榜」入口。
- `app.js`：將既有 `player-ranking` 區塊從測速頁移到主頁層級，獨立成可切換的 view；保留語言切換、目前練習者標示、正確率門檻與既有排名資料來源。
- `styles.css`：補上獨立排行榜頁面桌面／手機版樣式。

### 驗證

- `node --check app.js`：通過。
- `node --test tests/core.test.cjs tests/teacher-auth.test.cjs`：10 tests passed, 0 failed。
- 瀏覽器確認排行榜導覽可切換，主內容只顯示 `player-ranking`。
- 360px 檢查：`scrollWidth` 345，小於 viewport 360，無橫向溢出。

### Git／部署

- GitHub 功能 commit `8e6926f` 已推送到 `main`。
- Vercel Production：`https://typing-practice-room.vercel.app`，已完成部署。

### 待辦

- 已確認正式網站排行榜入口與頁面切換正常；後續若修改排行榜邏輯，需同步測試雲端成績載入。

## 2026-09-07｜Supabase 改用 Vercel Postgres

### 修改

- 因 Supabase 免費方案流量不足，雲端資料層改為 Vercel Postgres／Neon serverless driver。
- `api/records.js` 改用 `@neondatabase/serverless`，保留成績寫入與教師查詢 API。
- 新增 `database/schema.sql`；移除 Supabase 專用 schema 與 `SUPABASE_*` 設定說明。
- 新增 `package.json`／`package-lock.json` 依賴 `@neondatabase/serverless`，確保 Vercel 部署會安裝資料庫 driver。
- 前端 `/api/records` 介面不變，現有本機快取、雲端同步與查詢篩選流程可沿用。

### 驗證

- `node --check api/records.js`、`node --check app.js`：通過。
- `node --test tests/core.test.cjs tests/teacher-auth.test.cjs`：10 tests passed, 0 failed。
- `npm install --package-lock-only`：通過，0 vulnerabilities。
- Vercel Production Postgres 環境變數已確認存在。
- 已使用加密的 Production 連線初始化 `database/schema.sql`，回報 `Database schema initialized.`；連線暫存檔已刪除。
- 尚未連接新的 Vercel Postgres，因此尚未完成正式資料庫 smoke test。

### Git／部署

- 尚未提交、推送或部署。
- Vercel 需建立／連結 Postgres，並設定 `POSTGRES_URL`（或 `DATABASE_URL`）。

### 待辦

- 重新部署後測試寫入、教師查詢與篩選。
- `npm install` 回報目前依賴樹有 3 個 high severity audit 警告，部署前應檢查是否為可接受的間接依賴風險。

### 發布結果

- GitHub commit `f1a81f0` 已推送到 `main`。
- Vercel Production：`https://typing-practice-room.vercel.app`。
- 已部署 Vercel Postgres／Neon API；未登入 GET `/api/records` 回傳 HTTP 401，查詢權限保護正常。
- Production `typing_records` schema 已在部署前初始化完成。

## 2026-09-07｜新增 Supabase 雲端成績與查詢 API

### 修改

- 新增 `supabase/schema.sql`：建立 `typing_records` 資料表、欄位檢查、索引與 RLS。
- 新增 `api/records.js`：測驗成績 POST 寫入 Supabase；教師登入後 GET 雲端紀錄，支援學生、語言、時長與日期篩選參數。
- `app.js`：測驗完成後本機保存並背景同步雲端；教師頁進入時載入雲端紀錄，再沿用現有篩選、排行榜與 CSV 匯出。
- `README.md`：補充 Supabase 初始化、Vercel 環境變數與雲端資料限制。

### 驗證

- `node --check app.js`：通過。
- `node --check api/records.js`：通過。
- `node --test tests/core.test.cjs tests/teacher-auth.test.cjs`：10 tests passed, 0 failed。
- `git diff --check`：通過。
- 尚未連接真實 Supabase 專案，因此尚未完成正式雲端寫入／查詢 smoke test。

### Git／部署

- 尚未提交、推送或部署。
- 部署前必須在 Supabase 執行 `supabase/schema.sql`，並在 Vercel 設定 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。

### 待辦

- 設定 Supabase 環境變數後部署 Vercel。
- 測試測驗完成寫入雲端、教師登入後查詢與篩選。
- 不要把 Supabase service role key 寫入 Git、前端或交接文件。

## 2026-09-07｜首頁手指定位圖與 QWERTY 鍵盤修正

### 修改

- `app.js`：課程練習鍵盤改為標準 QWERTY 五排排列，加入數字列、Tab、Caps Lock、Enter、左右 Shift、Ctrl、Win、Alt 與空白鍵；保留目前字元與 Shift 的按鍵高亮。
- `app.js`：首頁總覽最前方加入 `assets/hand-placement.svg`，提供開啟大圖、鍵盤方向與 F/J 定位提示。
- 保留既有的鍵盤圖響應式水平捲動，避免小螢幕被完整鍵盤撐出頁面寬度。

### 驗證

- `node --check app.js`：通過。
- `node --test tests/core.test.cjs tests/teacher-auth.test.cjs`：10 tests passed, 0 failed。
- 本機瀏覽器確認首頁有 `hand-placement.svg`，課程鍵盤實際生成 5 排、60 個鍵位。
- 360px 瀏覽器檢查：`scrollWidth` 345，小於 viewport 360，無橫向溢出。

### Git／部署

- 尚未提交；目前修改包含 `app.js`，以及本交接紀錄。
- 尚未推送或重新部署 Vercel。

### 待辦

- 部署前需確認正式網站取得最新 `assets/hand-placement.svg` 與前端修改。
- 仍需依既有安全待辦輪替教師密碼與 session secret。

### 發布前補充

- Vercel CLI 身分：`similaitw`。
- Vercel 專案：`typing-practice-room`，已連結目前工作區。
- 發布前自動測試：10 tests passed, 0 failed。

### 發布結果

- GitHub：commit `3c75147` 已推送到 `main`。
- Vercel Production：`https://typing-practice-room.vercel.app`。
- Vercel deployment alias 已成功更新，正式頁面 smoke test 確認首頁手指定位圖可見。
- 本次正式部署包含首頁定位圖與 QWERTY 鍵盤修改。

## 2026-09-07｜接手現況盤點

### 目前版本

- Repository：`similaitw/typing-practice-room`
- Branch：`main`
- HEAD：`6a7ffef Protect teacher tools with server-verified password sessions`
- Remote：`origin` 已指向 GitHub repository
- Vercel 正式網址：`https://typing-practice-room.vercel.app`

### 已完成能力

- 六步新手教學、英文鍵位、數字列符號、注音與中文課程
- 英文 WPM、中文 CPM、15／30／60／120 秒測速
- 自訂文章、中文輸入法 composition、Backspace 重新計算
- 學生自註冊、個人排行榜、教師名單與學生 ID 關聯
- 成績篩選、排行榜、UTF-8 BOM CSV 匯出、JSON 備份／還原
- localStorage 損壞資料容錯與備份格式驗證
- Vercel Function 教師登入、HttpOnly Secure SameSite Strict session，登入期限 4 小時

### 已驗證

```text
node --test tests/core.test.cjs tests/teacher-auth.test.cjs
10 tests passed, 0 failed

node --check app.js
node --check core.js
node --check data.js
git diff --check
```

`TESTING.md` 另有桌面、360／768／1440px、測速、排行榜、備份與教師登入的 Playwright 驗證紀錄。

### 目前未提交變更

- `app.js`
- `core.js`
- `index.html`
- `styles.css`

這些檔案包含自註冊、玩家排行榜、資料驗證與前端介面更新；目前尚未提交到 `main`，也不能假設已部署到正式網站。

### 安全待辦

- `output/teacher-access/` 被 `.gitignore` 排除，教師密碼與 session secret 沒有被 Git 追蹤。
- 但登入資訊已出現在工作區與對話內容，應視為已暴露。
- 正式發布前應在 Vercel 輪替 `TEACHER_PASSWORD` 與 `TEACHER_SESSION_SECRET`，再重新部署。
- 不要把任何密碼、Token 或 session secret 寫入 Git、前端程式或新的 Markdown 紀錄。

### 下一步建議

1. 檢查並確認四個未提交檔案的差異。
2. 執行完整測試與正式網站 smoke test。
3. 輪替 Vercel 教師密碼與 session secret。
4. 提交、推送 `main` 並部署 Vercel。
5. 部署後在本檔新增驗證結果、commit SHA 與正式網址狀態。

## 變更紀錄格式

之後每次修改請新增以下格式，放在本檔最上方、上一筆紀錄之前：

```markdown
## YYYY-MM-DD｜簡短標題

### 修改

- 修改了哪些檔案與行為

### 驗證

- 執行的測試、命令或瀏覽器檢查
- 結果：通過／失敗，以及失敗原因

### Git／部署

- Commit 或未提交狀態
- 是否已推送、是否已部署

### 待辦

- 尚未完成或需要下一個 Agent 注意的事項
```
# Agent 交接紀錄

> 工作區規則：每次修改網站程式、樣式、資料或部署設定後，必須在本檔新增一筆紀錄。紀錄要包含日期、修改內容、驗證方式、Git 狀態與尚未完成事項，方便切換 Agent 後快速接手。



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

- 目前 Codex 修改尚未提交、推送或部署。
- Production schema 已建立；部署後需確認正式教師登入與密碼變更流程。

### 待辦

- 提交並推送目前修改。
- 部署 Vercel Production。
- 測試正式 `/api/teacher` 與 `/api/records`，確認未登入仍拒絕查詢。

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

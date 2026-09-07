# Agent 交接紀錄

> 工作區規則：每次修改網站程式、樣式、資料或部署設定後，必須在本檔新增一筆紀錄。紀錄要包含日期、修改內容、驗證方式、Git 狀態與尚未完成事項，方便切換 Agent 後快速接手。

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

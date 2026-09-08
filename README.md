# 指尖練習室 | Typing Practice Room

給國中資訊課使用的打字新手教學、課程、測速與班級成績工具。前端使用 HTML、CSS、原生 JavaScript，無建置步驟；教師登入由 Vercel Function 驗證。

## 一步一步開始

1. 開啟網站，按「新手教學：一步一步來」。
2. 依序學習坐姿、F／J 基準鍵及十指位置。
3. 第三步試打 `asdf jkl;`，畫面即時提示正確或錯字。
4. 按「進入基準鍵第一課」，完整輸入範例且達到 90% 正確率後，按「完成本課」，再進入下一課。
5. 熟悉後選「打字測速」，自行填班級、姓名與座號（三項必填），按「使用此姓名開始」，或選擇已有練習者。再選語言與時間，輸入第一個確認的字元才開始計時。完成後可直接前往排行榜。

## 功能

- 六步互動新手教學，可隨時回到上一步；第二步有實體鍵盤配置與雙手指法圖，第三步可展開複習，支援開啟大圖。
- 7 課英文、8 課注音與中文；虛擬鍵盤、下一字手指提示、正確率與速度。
- 英文鍵位課程直接在 QWERTY 字母鍵上顯示左右手／手指簡碼，下一個按鍵會加強高亮，大小寫另提示另一手 Shift。
- 數字列特殊符號教學與完整練習：Shift 搭配另一手、小指位置、上下層字元對照；包含 `! @ # $ % ^ & * ( ) ~ _ + { } | : " < > ?`。
- 注音鍵位課切換英文輸入，實體按鍵自動轉成標準注音符號；中文詞句課使用自己的中文輸入法。
- 英文 WPM、中文 CPM，15／30／60／120 秒；各 15 篇題庫、相鄰測驗避免重複。
- 自訂文章最多 10,000 字元；含中文或注音以 CPM 計算。
- 中文組字確認後計分；Backspace 重新計算；結束只存一次；Ctrl + Enter 重測。
- 測速頁可自行報名，班級、姓名、座號必填；相同身分沿用紀錄，測速期間鎖定姓名，獨立排行榜頁顯示中英文排名與目前練習者。
- 學生名單貼上／CSV 匯入、編輯、刪除；重存名單保留學生 ID 與歷史成績關聯。
- 成績可依學生、語言、時長篩選；中英文分開統計及排名；預設最低正確率 90%。
- 同速以正確率優先，再以較新紀錄優先；訪客與已刪除學生不列入班級排行榜。
- UTF-8 BOM CSV 匯出目前篩選結果；JSON 完整備份／還原。
- 刪除需確認，清除全部資料需二次確認；損壞資料提供原始檔下載與還原入口。

## 教師操作

1. 點「教師端」，輸入教師密碼登入，再到「學生名單」，每行貼上 `701 01 練習同學甲`，也支援舊版座號及姓名格式，按「儲存名單」。此操作為新增，完全相同的班級、姓名與座號會略過。
2. CSV 首列包含「座號、姓名」，可另加「班級」欄並交換欄位順序；讀取後確認名單，再按「儲存名單」。檔案上限 1 MB，最多 2,000 位學生。
3. 學生到「打字測速」選自己的名字後測驗。
4. 到「成績與排行榜」設定篩選，按「匯出篩選結果 CSV」。Excel 可辨識 UTF-8 BOM 中文編碼。
5. 下課前到「備份與資料」匯出 JSON。換電腦時匯入備份；還原會取代該瀏覽器目前資料，操作前會提示確認。備份匯入上限 20 MB／50,000 筆測驗。

## 本機執行

直接雙擊 `index.html`，或使用 Python：

```sh
python -m http.server 4173
```

開啟 `http://localhost:4173`。程式與字型不依賴外部 CDN；學生可離線練習。教師端必須連線到已設定密碼的 Vercel 網站；直接開啟 HTML 或 Python 靜態伺服器不提供教師登入，會保持鎖定。

## 資料與限制

名單、設定、課程進度與離線快取存在瀏覽器 `localStorage`，key 為 `typingPracticeRoomData`。完成測驗後，成績會同步至 Vercel Postgres 雲端資料庫；教師登入後可從雲端載入紀錄並依學生、語言、測驗時間查詢。教師登入會建立 HttpOnly、Secure、SameSite=Strict 的工作階段 Cookie，有效 4 小時。自訂文章只保留在目前頁面，JSON 備份不含文章內容。

不同電腦、瀏覽器與本機網址的名單／課程進度不會自動同步；正式網站的測驗成績會同步到 Vercel Postgres。教師頁需密碼登入，管理操作會重新驗證登入憑證；資料庫連線字串只存在 Vercel 伺服器環境變數。這是教師介面操作保護，瀏覽器 localStorage 仍可能被裝置使用者查看或修改。JSON 還原只更新目前瀏覽器資料，不會刪除雲端紀錄。

網頁不能設定作業系統輸入法；實際選字與標點快捷鍵依輸入法而異。平板與手機可使用，練十指指法建議接實體鍵盤。貼上與拖放不計入練習／測速；本工具不提供正式考試監考。離開測速頁、修改語言或時長會重設進行中的測驗。

## 計算方式

- 英文 WPM：`(correctChars / 5) / elapsedMinutes`
- 中文 CPM：`correctChars / elapsedMinutes`
- 正確率：`correctChars / typedLength × 100%`
- 依目前輸入內容與目標逐字比較，空格、標點計入字元，支援 Unicode 字元。
- 結果四捨五入為整數。空白顯示 100%，但不存成績；最小計算間隔 0.1 秒以避免除以零。
- 文章完成或倒數結束時停止；提前完成以實際經過時間計算。

## 部署

GitHub 儲存庫：`https://github.com/similaitw/typing-practice-room`

Vercel 專案名稱：`typing-practice-room`。使用 Other／靜態網站，根目錄輸出，前端不需要建置；Vercel 會依 package-lock.json 安裝雲端資料庫驅動。

```sh
git add .
git commit -m "Update typing practice room"
git push origin main
vercel --prod
```

GitHub Pages 僅能提供學生端靜態功能，不支援本專案教師登入 API。完整功能請使用 Vercel。

## 雲端資料庫設定

本專案使用 Vercel Postgres（目前由 Neon 提供 serverless driver）保存測驗紀錄。先在 Vercel Storage／Marketplace 建立並連結 Postgres，再執行 [database/schema.sql](database/schema.sql)，最後於 Vercel Production 設定以下環境變數並重新部署：

- `POSTGRES_URL`：Vercel Postgres／Neon 提供的資料庫連線字串；也支援 `DATABASE_URL`
- 原有的 `TEACHER_PASSWORD` 與 `TEACHER_SESSION_SECRET` 仍需保留

`POST /api/records` 由測驗完成流程使用；`GET /api/records` 需要教師登入，支援 `studentId`、`language`、`duration`、`from`、`to` 查詢參數。學生排行榜使用公開的 `GET /api/records?view=leaderboard&language=en&threshold=90`，只回傳排名所需欄位，以班級、姓名、座號合併跨裝置最佳紀錄，最多 2,000 位；完整紀錄仍需教師登入。完成測驗預設寫入資料庫；失敗存於 `typingPracticeRoomPendingRecords` 待傳佇列，重開頁面、恢復連線或每 30 秒會重試，也可按「重新同步／整理」。待傳成績不列入資料庫排行榜。舊版僅留在本機且未成功同步的紀錄不會自動回補。

## 驗證

```sh
node --test tests/core.test.cjs tests/teacher-auth.test.cjs tests/records-auth.test.cjs
node --check app.js
node --check core.js
node --check data.js
```

測試說明見 `TESTING.md`。

## 檔案

- `AGENT_HANDOFF.md`：每次修改後更新的 Agent 交接紀錄、驗證結果與待辦事項
- `index.html`：頁面與六步新手教學
- `styles.css`：響應式介面
- `app.js`：導覽、課程、測速、教師工具
- `core.js`：計分、排名、CSV 解析、備份驗證
- `data.js`：課程、英中文題庫
- `favicon.svg`：圖示
- `tests/core.test.cjs`：資料與計算測試
- `vercel.json`：靜態網站設定
- `api/records.js`：Vercel Postgres 成績寫入與教師查詢 API
- `database/schema.sql`：雲端測驗紀錄資料表與索引

## 教師密碼管理

- Vercel Production 環境變數 `TEACHER_PASSWORD`：教師密碼，至少 12 字；建議保留高強度隨機密碼。
- `TEACHER_SESSION_SECRET`：至少 32 字的隨機簽章密鑰，不可提供给學生或放在前端。
- 修改環境變數後重新部署；變更密碼或簽章密鑰會讓舊的登入憑證失效。
- 預覽環境需另行設定環境變數，未設定時教師登入會拒絕開放。
- 初始密碼另行交付，不存入 GitHub。
- `api/teacher.js`：登入、工作階段確認與登出；`teacher-auth.js`：登入介面與管理操作保護。

英文鍵位課程預設 200 字元，可在「練習字數」設定 50–2,000 字元（含空格與標點），按「套用字數」重新開始。本課教材循環延長，設定保存在瀏覽器並包含於 JSON 備份。

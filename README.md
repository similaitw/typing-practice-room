# 指尖練習室 | Typing Practice Room

給國中資訊課使用的打字新手教學、課程、測速、教師派作業與班級成績工具。前端使用 HTML、CSS、原生 JavaScript，無建置步驟；教師登入與學生作業 session 由 Vercel Function 驗證。

## 一步一步開始

1. 開啟網站，按「新手教學：一步一步來」。
2. 依序學習坐姿、F／J 基準鍵及十指位置。
3. 第三步試打 `asdf jkl;`，畫面即時提示正確或錯字。
4. 按「進入基準鍵第一課」，完整輸入範例且達到 90% 正確率後，按「完成本課」，再進入下一課。
5. 熟悉後選「打字測速」，自行填班級、姓名與座號（三項必填），按「使用此姓名開始」，或選擇已有練習者。再選語言與時間，輸入第一個確認的字元才開始計時。完成後可直接前往排行榜。
6. 若老師有派作業，學生在首頁「我的任務」輸入老師提供的一次性啟用碼，登入後可直接開啟指定的語言、秒數與門檻。

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
- 教師學生名單同步至 Postgres；第一次使用雲端名單時會將既有本機名單合併上傳，之後教師換電腦登入仍可載入同一份啟用名單。
- 學生名單支援貼上／CSV 匯入、編輯、停用與恢復；停用不刪除歷史成績，本機保留快取供既有介面與離線練習使用。
- 教師可建立、編輯、停用／重新啟用測速作業，支援英文／中文、15／30／60／120 秒、最低正確率、最低速度、有效次數、開始／截止時間與多班指派。
- 學生「我的任務」使用一次性高強度啟用碼登入；啟用碼只存 hash，兌換後建立 8 小時 HttpOnly／Secure／SameSite=Strict session，學生只會讀到自己的指定作業。
- 指定作業一鍵帶入語言與秒數；符合最低正確率、最低速度且在截止時間前完成的紀錄才計入有效次數，顯示 1/3、2/3、3/3 與未開始／進行中／已完成／已逾期。
- 正式作業成績會寫入 `assignment_id`；伺服器會驗證學生 session、student ID、作業班級、語言與秒數。自由練習維持原本流程。
- 教師可在每份作業按「完成度」查看全班或單一班級：班級人數、已完成、進行中、未開始、完成率，以及每位學生的達標次數、總嘗試、最佳速度、最佳正確率與最近練習時間。
- 作業完成度每 12 秒自動更新；「課堂投影模式」以班級為單位，只顯示座號與未開始／進行中／已完成／已逾期狀態，不把學生全名投影到大螢幕，可切換瀏覽器全螢幕。
- 英文測速會記錄「應按鍵 → 實際按鍵 → 次數」的聚合錯鍵資料；即使用 Backspace 立即修正，該次錯按仍會列入診斷。系統不保存完整學生輸入文章。
- 英文測驗完成後，結果區會顯示本次常見錯鍵與最需要留意的手指；教師端新增「錯鍵分析」，可依班級或學生查看最常錯鍵、手指錯按分布與常見錯鍵配對。
- 中文輸入涉及注音／拼音／倉頡等輸入法組字，無法可靠對應實體鍵位，因此目前不做中文鍵位／手指錯鍵診斷。
- 成績可依學生、語言、時長篩選；中英文分開統計及排名；預設最低正確率 90%。
- 同速以正確率優先，再以較新紀錄優先；訪客不列入班級排行榜。
- UTF-8 BOM CSV 匯出目前篩選結果；JSON 完整備份／還原。
- 清除資料需二次確認；雲端名單上線後「清除這台瀏覽器資料」只清本機快取、課程進度與本機成績，不刪除雲端名單或資料庫成績。

## 教師操作

1. 點「教師端」，輸入教師密碼登入。教師端會先讀取雲端學生名單；若目前瀏覽器已有舊版本機名單，第一次同步會自動合併到雲端。
2. 到「學生名單」，每行貼上 `701 01 練習同學甲`，也支援舊版座號及姓名格式，按「儲存名單」。相同班級、姓名與座號會合併，既有學生 ID 儘量沿用。
3. CSV 首列包含「座號、姓名」，可另加「班級」欄並交換欄位順序；讀取後確認名單，再按「儲存名單」。檔案上限 1 MB，最多 2,000 位學生。
4. 編輯學生會同步更新雲端名單與該 student ID 的成績顯示欄位；「停用」只把學生移出一般名單，歷史成績仍保留，可在「已停用學生」恢復。
5. 到「作業管理」建立測速作業，設定名稱、語言、秒數、最低正確率、最低速度、有效次數、班級與截止時間；可後續編輯或停用。
6. 在「學生一次性啟用碼」選學生並產生啟用碼，直接交給該學生。重新發碼會撤銷該生舊學生 session；明碼不寫入 localStorage 或 GitHub。
7. 學生在首頁「我的任務」兌換啟用碼後，可直接開始老師指定測驗。學生按「結束使用」後，目前學生 session 會失效，下次需向老師取得新啟用碼。
8. 在「作業管理」的作業列按「完成度」，可切換全部指派班級或單一班級。畫面每 12 秒更新學生完成狀態；按「課堂投影模式」後只顯示座號與狀態，可切班並進入全螢幕。
9. 到「錯鍵分析」選擇班級或學生，可查看英文錯鍵總次數、最常錯鍵、手指錯按分布與常見「應按 → 實際按」配對。舊版成績沒有錯鍵欄位，不會自動回填。
10. 到「成績與排行榜」設定篩選，並可匯出 CSV。
11. JSON 備份仍用於本機課程進度、設定與本機資料攜帶；還原不會刪除雲端學生名單、作業或資料庫成績。

## 本機執行

直接雙擊 `index.html`，或使用 Python：

```sh
python -m http.server 4173
```

開啟 `http://localhost:4173`。程式與字型不依賴外部 CDN；學生可離線自由練習。教師端、雲端名單、「我的任務」、作業完成度與雲端錯鍵分析需要正式 Vercel Functions／Postgres；直接開啟 HTML 或 Python 靜態伺服器時，這些雲端能力不會啟用。

## 資料與限制

設定、課程進度、學生名單快取與離線快取存在瀏覽器 `localStorage`，key 為 `typingPracticeRoomData`。完成測驗後，成績會同步至 Vercel Postgres；教師學生名單、作業、學生啟用碼 hash 與學生 session 也存在 Postgres。教師登入會建立 HttpOnly、Secure、SameSite=Strict 的工作階段 Cookie，有效 4 小時；學生作業登入 session 有效 8 小時。自訂文章只保留在目前頁面，JSON 備份不含文章內容。

正式網站的教師名單與作業可跨電腦同步；課程進度目前仍以本機瀏覽器為主。學生在測速頁自行填寫的新身分先保存在目前瀏覽器，教師下次登入該瀏覽器時會併入雲端名單。教師頁需密碼登入，雲端名單、作業管理、作業完成度與錯鍵分析 API 不對未登入使用者開放；學生私人作業清單需要學生 session。資料庫連線字串只存在 Vercel 伺服器環境變數。

正式作業目前會驗證學生 session、作業歸屬、語言、秒數與待傳紀錄 student ID；速度與正確率仍使用既有瀏覽器端計分，因此本工具仍不是正式考試防作弊系統。待傳作業若在共用電腦切換成另一學生，伺服器會拒絕錯誤身分補傳，必須切回原學生 session 再同步。

教師完成度儀表板可顯示學生姓名，僅在教師 session 下提供；課堂投影模式刻意只顯示座號與狀態。停用學生不列入完成度班級人數，但既有歷史成績仍保留。

錯鍵資料只記錄英文測速的聚合配對，例如 `R → T × 4`，不儲存完整輸入內容。教師班級分析只納入具有 student ID 與班級的英文紀錄；訪客不進班級錯鍵統計。Phase 4 上線前的舊紀錄沒有錯鍵資料，不自動推測或回填。

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

GitHub Pages 僅能提供學生端靜態自由練習，不支援本專案教師登入、雲端名單或指定作業 API。完整功能請使用 Vercel。

## 雲端資料庫設定

本專案使用 Vercel Postgres（目前由 Neon 提供 serverless driver）保存測驗紀錄、教師學生名單與作業資料。測驗成績 schema 在 [database/schema.sql](database/schema.sql)；雲端學生名單 schema 在 [database/cloud-students.sql](database/cloud-students.sql)；Phase 2 作業與學生 session migration 在 [database/assignments.sql](database/assignments.sql)；Phase 4 錯鍵欄位 migration 在 [database/mistakes.sql](database/mistakes.sql)。新 API 也會以 `CREATE ... IF NOT EXISTS`／`ALTER ... ADD COLUMN IF NOT EXISTS` 做相容初始化，不會刪除既有成績。

- `POSTGRES_URL`：Vercel Postgres／Neon 提供的資料庫連線字串；也支援 `DATABASE_URL`
- 原有的 `TEACHER_PASSWORD` 與 `TEACHER_SESSION_SECRET` 仍需保留

`POST /api/records` 由測驗完成流程使用；自由練習沿用既有格式，指定作業另帶 `assignmentId`。英文新紀錄可另帶已驗證的 `mistakes` 聚合陣列；中文只接受空錯鍵陣列。指定作業 POST 需要學生 session，伺服器核對學生與作業設定；`GET /api/records` 需要教師登入，另支援 `assignmentId` 查詢參數。學生排行榜仍使用公開的 `GET /api/records?view=leaderboard&language=en&threshold=90`。

`GET /api/students`、`POST /api/students`、`PATCH /api/students` 全部需要有效教師 session。GET 讀取啟用與停用學生；POST 批次合併名單；PATCH 編輯、停用或恢復單一學生。API 不提供匿名全校名單，也不提供直接刪除有歷史資料學生的端點。

`GET /api/assignments`、`POST /api/assignments`、`PATCH /api/assignments` 為教師作業管理；`GET /api/assignments?view=mine` 需要有效學生 session，只回傳目前學生所屬班級的作業與完成狀態。`POST /api/student-access` 的 `issue` 動作需要教師 session；`redeem` 使用一次性啟用碼建立學生 session；`logout` 撤銷目前學生 session。

`GET /api/assignment-dashboard?id=<assignmentId>` 需要教師 session，回傳該作業所有指派班級的啟用學生完成度；可加 `class=<班級>` 只看單一班。完成度狀態由伺服器依總嘗試、達標次數、作業門檻與截止時間計算。

`GET /api/mistake-analytics` 需要教師 session，只分析英文且已有聚合錯鍵資料的學生紀錄；支援 `class`、`studentId`、`assignmentId`、`from`、`to` 篩選，回傳常錯鍵、錯鍵配對與手指錯按統計。

## 驗證

```sh
node --test tests/core.test.cjs tests/teacher-auth.test.cjs tests/records-auth.test.cjs tests/students-api.test.cjs tests/assignments.test.cjs tests/assignment-dashboard.test.cjs tests/mistake-analysis.test.cjs
node --check app.js
node --check core.js
node --check data.js
node --check teacher-auth.js
node --check cloud-students.js
node --check assignments.js
node --check assignment-dashboard.js
node --check mistake-analytics.js
node --check api/records.js
node --check api/students.js
node --check api/assignments.js
node --check api/assignment-dashboard.js
node --check api/student-access.js
node --check api/mistake-analytics.js
node --check lib/typing-schema.js
node --check lib/student-session.js
node --check lib/mistake-analysis.js
```

GitHub Actions 會在 `main` push 與 pull request 自動執行上述測試與語法檢查。測試說明見 `TESTING.md`。

## 檔案

- `AGENT_HANDOFF.md`：每次修改後更新的 Agent 交接紀錄、驗證結果與待辦事項
- `index.html`：頁面與六步新手教學
- `styles.css`：響應式介面
- `app.js`：導覽、課程、測速、教師工具
- `cloud-students.js`：教師雲端名單同步、本機快取整合、停用／恢復操作
- `assignments.js`：教師作業管理、學生一次性登入、「我的任務」與指定測速前端整合
- `assignment-dashboard.js`：教師作業完成度、班級篩選、12 秒 polling 與課堂投影模式
- `mistake-analytics.js`：英文錯鍵按鍵監聽、學生結果診斷與教師錯鍵分析 UI
- `core.js`：計分、排名、CSV 解析、備份驗證
- `data.js`：課程、英中文題庫
- `api/records.js`：Vercel Postgres 成績寫入、指定作業驗證、錯鍵欄位驗證與教師查詢 API
- `api/students.js`：教師雲端學生名單 API
- `api/assignments.js`：教師作業 CRUD 與學生本人作業查詢
- `api/assignment-dashboard.js`：教師專用作業完成度統計 API
- `api/student-access.js`：學生一次性啟用碼、session 查詢與登出
- `api/mistake-analytics.js`：教師專用班級／個人英文錯鍵分析 API
- `lib/typing-schema.js`：相容 schema 初始化與 instance cache
- `lib/student-session.js`：學生 session cookie、token hash、同源檢查與 session 讀取
- `lib/mistake-analysis.js`：錯鍵資料驗證、Shift 鍵正規化、手指映射與聚合統計
- `database/schema.sql`：雲端測驗紀錄資料表與索引
- `database/cloud-students.sql`：雲端學生名單資料表與索引
- `database/assignments.sql`：作業、作業班級、學生 access/session 與 `assignment_id` migration
- `database/mistakes.sql`：`typing_records.mistakes` JSONB 相容 migration
- `tests/assignments.test.cjs`：作業欄位、assignment ID 與學生 session helper 測試
- `tests/assignment-dashboard.test.cjs`：完成度狀態、查詢格式與教師 session 測試
- `tests/mistake-analysis.test.cjs`：錯鍵資料驗證、Shift／手指映射、聚合與教師 session 測試
- `.github/workflows/test.yml`：main／PR 自動測試與 syntax check

## 教師密碼管理

- Vercel Production 環境變數 `TEACHER_PASSWORD`：教師密碼，至少 12 字；建議保留高強度隨機密碼。
- `TEACHER_SESSION_SECRET`：至少 32 字的隨機簽章密鑰，不可提供給學生或放在前端。
- 修改環境變數後重新部署；變更密碼或簽章密鑰會讓舊的教師登入憑證失效。
- 預覽環境需另行設定環境變數，未設定時教師登入會拒絕開放。
- 初始密碼另行交付，不存入 GitHub。
- `api/teacher.js`：登入、工作階段確認與登出；`teacher-auth.js`：登入介面、管理操作保護與雲端模組載入。

英文鍵位課程預設 200 字元，可在「練習字數」設定 50–2,000 字元（含空格與標點），按「套用字數」重新開始。本課教材循環延長，設定保存在瀏覽器並包含於 JSON 備份。

## 後續開發規格

[整合開發規格與進階 Roadmap](typing-practice-room-codex-spec.md)包含目前功能基準、Phase 1–11、資料遷移與驗收要求。Phase 1 雲端學生名單、Phase 2 教師測速派作業／學生「我的任務」、Phase 3 教師完成度儀表板／課堂投影模式、Phase 4 英文錯鍵診斷／手指弱點分析皆已有第一版；下一階段優先做 Phase 5 弱鍵特訓與自動補強練習。

[規格安全檢查報告](security_best_practices_report.md)：設計審查與持續安全驗收要求，詳細要求見開發規格第 37 節；不是正式站安全認證。
# 指尖練習室 | Typing Practice Room

給國中資訊課使用的打字教學、測速、教師派作業、班級完成度與個人化補強工具。前端使用 HTML、CSS、Vanilla JavaScript；雲端功能使用 Vercel Functions 與 Vercel Postgres／Neon。

正式站：`https://typing-practice-room.vercel.app`

## 學生可以做什麼

- 六步新手教學、QWERTY 十指定位、Shift／標點符號教學。
- 7 課英文、8 課注音與中文課程。
- 英文 WPM、中文 CPM，15／30／60／120 秒測速。
- 自訂文章最多 10,000 字元。
- 班級＋姓名＋座號身分與資料庫排行榜。
- 老師派發作業後，以一次性啟用碼登入「我的任務」，直接進入指定語言與秒數。
- 作業顯示 `1/3 → 2/3 → 3/3`、未開始／進行中／已完成／已逾期。
- 英文測速會記錄聚合錯鍵，例如 `R → T × 4`；即使 Backspace 修正，錯按仍會列入診斷。
- 測驗結果會顯示本次常見錯鍵與最需要留意的手指。
- Phase 5「我的弱鍵」：學生 session 下只讀取自己的錯鍵資料，顯示前 4 個弱鍵與錯按次數。
- 可選 1 分鐘或 2 分鐘「弱鍵特訓」，系統用本機規則與單字庫自動生成針對性英文練習，不使用 AI API。
- Phase 6 課程進度雲端同步：學生登入後，英文／注音與中文課程完成勾選會跨電腦恢復；離線時仍保留每位學生自己的本機快取。

## 教師可以做什麼

- 雲端學生名單：新增、貼上匯入、CSV 匯入、編輯、停用、恢復。
- 雲端作業管理：英文／中文、15／30／60／120 秒、最低正確率、最低速度、完成次數、多班、開始／截止時間。
- 產生單一學生的一次性啟用碼；兌換後建立 8 小時學生 session。
- 每份作業可按「完成度」查看全班或單班：完成數、進行中、未開始、完成率、達標次數、總嘗試、最佳速度、最佳正確率、最近練習。
- 作業儀表板每 12 秒更新。
- 「課堂投影模式」只顯示座號與狀態，不顯示學生完整姓名。
- 「錯鍵分析」可依班級或學生查看最常錯鍵、手指錯按分布與常見錯鍵配對。
- 成績依學生、語言、時長篩選，CSV 匯出；JSON 備份保留舊版本機課程進度與設定。

## Phase 1–6 目前狀態

- Phase 1：雲端學生名單 ✅
- Phase 2：教師派測速作業／學生「我的任務」✅
- Phase 3：教師完成度儀表板／課堂投影模式 ✅
- Phase 4：英文錯鍵診斷／手指弱點分析 ✅
- Phase 5：學生「我的弱鍵」／弱鍵特訓 ✅
- Phase 6：學生課程進度雲端同步 ✅
- 下一階段：Phase 7 成長分析

## 學生操作

1. 開啟網站，先完成新手教學與基準鍵課程。
2. 自由測速時填班級、姓名、座號，或選既有練習者。
3. 若老師有派作業，在首頁「我的任務」輸入一次性啟用碼。
4. 登入後可直接開始老師指定作業；共用電腦用完請按「結束使用」。
5. 學生登入後，課程頁會切換到該學生自己的課程完成進度，並與 Postgres 雲端同步；換電腦登入後會恢復已完成課程。
6. 完成英文測速後，可在結果區看錯鍵診斷。
7. 回首頁「我的弱鍵」可看前 4 個弱鍵，選 1／2 分鐘後按「開始弱鍵特訓」。

## 教師操作

1. 點「教師端」並登入。
2. 在「學生名單」建立或匯入班級名單。
3. 在「作業管理」建立作業並指定班級。
4. 在「學生一次性啟用碼」選學生、產生啟用碼。
5. 學生完成後，在作業列按「完成度」查看進度；需要投影時開「課堂投影模式」。
6. 到「錯鍵分析」查看班級或個人的英文錯鍵與手指弱點。
7. 到「成績與排行榜」篩選與匯出 CSV。

## 課程進度雲端同步

Phase 6 新增 `typing_progress`，以 `(student_id, lesson_id)` 為唯一鍵，保存：

- 課程 ID 與語言。
- 第一次完成時間。
- 最佳正確率。
- 最佳速度。
- 完成次數。
- 最後更新時間。

學生登入後，課程完成狀態由 student session 決定，不接受前端指定其他學生 ID。每位學生另有獨立的本機快取 `typingPracticeRoomLessonProgressByStudent`；離線時先使用本機快取，連線恢復後再與雲端取聯集。

舊版本的 `typingPracticeRoomData.lessonProgress` 是「整台瀏覽器共用」，沒有學生歸屬資訊。為避免共用電腦把前一位學生進度套給下一位，Phase 6 **保留舊進度但不自動認領或上傳**。未登入學生時仍可看到這份舊版／離線進度；登入後改顯示目前學生自己的進度。

若學生 A 同步途中快速切換成學生 B，進度 POST 仍必須帶預期 `studentId`，server 會與目前 student session 比對；不一致直接回 403。GET 回傳也包含 session student，前端會再次核對，避免跨學生競態污染。

## 錯鍵與弱鍵資料

錯鍵資料只保存英文測速的聚合資料：

```text
[應按鍵, 實際按鍵, 次數]
```

例如：

```text
R → T × 4
```

系統不保存學生完整輸入文章。Phase 4 上線前的舊成績沒有 `mistakes`，不會推測或回填。

中文輸入涉及注音／拼音／倉頡等組字流程，無法可靠反推實體按鍵，因此目前不做中文鍵位／手指診斷。

「我的弱鍵」必須有有效學生 session。`GET /api/mistake-analytics?view=mine` 由 server 依 cookie 決定 student ID；學生端即使自行加入 `studentId` 或 `class` query，也不能改成讀取其他學生資料。

弱鍵特訓目前沿用既有自訂文章測速，支援 60／120 秒。先不加入 180 秒，避免破壞既有 `typing_records.duration` schema 與作業驗證規則。

## 雲端資料與安全邊界

- `typing_students`：雲端學生名單；停用不刪歷史成績。
- `typing_records`：測速成績、nullable `assignment_id`、nullable `mistakes jsonb`。
- `typing_assignments`／`typing_assignment_targets`：作業與班級指派。
- `typing_student_access`／`typing_student_sessions`：一次性啟用碼 hash 與學生 session。
- `typing_progress`：學生個人課程完成進度。
- 教師登入：HttpOnly、Secure、SameSite=Strict cookie，最長 4 小時。
- 學生作業登入：HttpOnly、Secure、SameSite=Strict cookie，最長 8 小時。
- 正式作業寫入會由 server 核對學生 session、student ID、班級、語言、秒數與 assignment。
- 課程進度 GET／POST 只允許目前 student session 的學生；POST 額外核對 body `studentId` 與 session。
- 公開排行榜只回傳必要排名欄位；完整紀錄、名單、作業、完成度與教師錯鍵分析都需要教師 session。
- 學生私有作業、「我的弱鍵」與雲端課程進度都需要學生 session。

本系統仍不是正式考試監考工具；速度與正確率主要由瀏覽器端既有計分邏輯計算。

## API 摘要

- `POST /api/records`：成績寫入；正式作業可帶 `assignmentId`，英文可帶 `mistakes`。
- `GET /api/records?view=leaderboard...`：公開排行榜。
- `GET /api/records`：教師完整成績查詢。
- `GET|POST|PATCH /api/students`：教師雲端學生名單。
- `GET|POST|PATCH /api/assignments`：教師作業管理。
- `GET /api/assignments?view=mine`：學生自己的作業。
- `GET|POST /api/student-access`：學生 session、啟用碼兌換、登出與教師發碼。
- `GET /api/assignment-dashboard?id=...`：教師作業完成度。
- `GET /api/mistake-analytics`：教師錯鍵分析。
- `GET /api/mistake-analytics?view=mine`：學生自己的弱鍵資料。
- `GET /api/progress`：目前 student session 的課程進度。
- `POST /api/progress`：合併本機個人進度或記錄完成課程；只能寫目前 student session。

## 本機執行

```sh
python -m http.server 4173
```

開啟 `http://localhost:4173`。

學生自由練習可用純靜態頁面；教師登入、雲端名單、作業、學生 session、完成度、雲端錯鍵分析、「我的弱鍵」與跨裝置課程進度需要 Vercel Functions／Postgres。

## 部署

GitHub：`https://github.com/similaitw/typing-practice-room`

Vercel 專案：`typing-practice-room`

```sh
git add .
git commit -m "Update typing practice room"
git push origin main
vercel --prod
```

環境變數：

- `POSTGRES_URL` 或 `DATABASE_URL`
- `TEACHER_PASSWORD`
- `TEACHER_SESSION_SECRET`

不要把密碼、Token、session secret 或資料庫連線字串放進 GitHub 或前端程式。

## 資料庫 SQL

- `database/schema.sql`：測速紀錄基礎 schema
- `database/cloud-students.sql`：雲端學生名單
- `database/assignments.sql`：作業與學生 access/session
- `database/mistakes.sql`：`typing_records.mistakes` 相容 migration
- `database/progress.sql`：學生課程進度

API 仍會使用 `CREATE IF NOT EXISTS`／相容 schema helper，不會刪除既有成績或舊進度。

## 驗證

GitHub Actions 在 `main` push 與 PR 自動執行：

```sh
node --test tests/core.test.cjs tests/teacher-auth.test.cjs tests/records-auth.test.cjs tests/students-api.test.cjs tests/assignments.test.cjs tests/assignment-dashboard.test.cjs tests/mistake-analysis.test.cjs tests/weak-key-practice.test.cjs tests/progress.test.cjs
```

並執行主要前後端 JavaScript `node --check`。

Phase 6 測試額外確認：

- 15 個現有課程 ID／語言白名單。
- 只有正確率至少 90% 的已知課程可以寫入 complete progress。
- 沒有 student cookie 時直接回 401。
- POST 的預期 student ID 與 session 不一致時回 403，且不碰 progress table。
- 合法完成只使用目前 student session 的 student ID。
- `cloud-progress.js`、`api/progress.js`、lesson catalog 與 progress schema helper 都納入 syntax check。

## 主要檔案

- `app.js`：課程、測速、排行榜、教師基礎工具
- `cloud-students.js`：雲端名單
- `assignments.js`：作業與學生「我的任務」
- `assignment-dashboard.js`：完成度與投影
- `mistake-analytics.js`：英文錯鍵蒐集、學生結果診斷、教師分析 UI
- `weak-key-core.js`：弱鍵教材生成器
- `weak-key-practice.js`：學生「我的弱鍵」與 Phase 6 模組載入入口
- `cloud-progress.js`：每位學生本機課程快取、登入切換、雲端 merge／completion sync
- `api/mistake-analytics.js`：教師分析與學生私有 `view=mine`
- `api/progress.js`：學生私有課程進度 API
- `lib/mistake-analysis.js`：錯鍵驗證、Shift 正規化、手指映射與聚合
- `lib/lesson-catalog.js`：server 端課程 ID／語言白名單
- `lib/progress-schema.js`：`typing_progress` 相容初始化
- `AGENT_HANDOFF.md`：目前可直接接手的功能基準
- `typing-practice-room-codex-spec.md`：完整 Phase 1–11 開發 Roadmap

## 後續開發

下一階段優先：**Phase 7 成長分析**。

建議從個人／班級的 first → recent → improvement 開始，分開英文 WPM／中文 CPM 與 15／30／60／120 秒，避免把不同時長直接混在一起比較。

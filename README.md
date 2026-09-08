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
- 「我的弱鍵」只讀取目前學生自己的錯鍵資料，顯示前 4 個弱鍵與錯按次數。
- 可選 1 分鐘或 2 分鐘弱鍵特訓；教材由本機規則與單字庫生成，不使用 AI API。
- 課程進度雲端同步：學生登入後，英文／注音與中文課程完成勾選會跨電腦恢復；離線時仍保留每位學生自己的本機快取。

## 教師可以做什麼

- 雲端學生名單：新增、貼上匯入、CSV 匯入、編輯、停用、恢復。
- 雲端作業管理：英文／中文、15／30／60／120 秒、最低正確率、最低速度、完成次數、多班、開始／截止時間。
- 產生單一學生的一次性啟用碼；兌換後建立 8 小時學生 session。
- 每份作業可按「完成度」查看全班或單班：完成數、進行中、未開始、完成率、達標次數、總嘗試、最佳速度、最佳正確率、最近練習。
- 作業儀表板每 12 秒更新；「課堂投影模式」只顯示座號與狀態。
- 「錯鍵分析」可依班級或學生查看最常錯鍵、手指錯按分布與常見錯鍵配對。
- 「成長分析」比較每位學生同語言、同秒數、同正確率門檻下的首次與最近速度，並顯示班級平均、中位數、平均進步與平均正確率。
- 成長分析預設只算標準題庫，避免把自訂文章／弱鍵特訓混入班級趨勢；可手動切成全部來源。
- 成績依學生、語言、時長篩選，CSV 匯出；JSON 備份保留舊版本機課程進度與設定。

## Phase 1–7 目前狀態

- Phase 1：雲端學生名單 ✅
- Phase 2：教師派測速作業／學生「我的任務」✅
- Phase 3：教師完成度儀表板／課堂投影模式 ✅
- Phase 4：英文錯鍵診斷／手指弱點分析 ✅
- Phase 5：學生「我的弱鍵」／弱鍵特訓 ✅
- Phase 6：學生課程進度雲端同步 ✅
- Phase 7：教師成長分析 ✅
- 下一階段：Phase 8 報表與列印／PDF

## 學生操作

1. 開啟網站，先完成新手教學與基準鍵課程。
2. 自由測速時填班級、姓名、座號，或選既有練習者。
3. 若老師有派作業，在首頁「我的任務」輸入一次性啟用碼。
4. 登入後可直接開始老師指定作業；共用電腦用完請按「結束使用」。
5. 學生登入後，課程頁會切換到該學生自己的課程完成進度，並與 Postgres 雲端同步。
6. 完成英文測速後，可在結果區看錯鍵診斷。
7. 回首頁「我的弱鍵」可看前 4 個弱鍵，選 1／2 分鐘後開始特訓。

## 教師操作

1. 點「教師端」並登入。
2. 在「學生名單」建立或匯入班級名單。
3. 在「作業管理」建立作業並指定班級。
4. 在「學生一次性啟用碼」選學生、產生啟用碼。
5. 學生完成後，在作業列按「完成度」查看進度；需要投影時開「課堂投影模式」。
6. 到「錯鍵分析」查看班級或個人的英文錯鍵與手指弱點。
7. 到「成長分析」選班級／學生、語言、15／30／60／120 秒、來源、最低正確率與日期範圍。
8. 到「成績與排行榜」篩選與匯出 CSV。

## Phase 7 成長分析規則

教師端「成長分析」遵守以下原則，避免產生看似漂亮但不可比較的統計：

- 英文 WPM 與中文 CPM 分開。
- 15／30／60／120 秒分開，不把不同時長直接混算。
- 可設定最低正確率，預設 90%。
- 預設只統計 `builtin` 標準題庫；自訂文章與弱鍵特訓不進預設成長值。
- 可依班級、單一學生與日期範圍篩選；日期輸入以瀏覽器所在地的完整一天計算。
- 每位學生以篩選範圍內「最早一筆」與「最近一筆」計算絕對進步與百分比。
- 只有一筆有效測驗時顯示首次／最近／最佳，但不計成長率。
- 班級平均與中位數使用「每位學生的最近值」，不會讓練習次數多的學生被重複加權。
- 停用學生不列入目前班級成長母體，但舊成績仍保留。

目前摘要包含：有紀錄學生／班級人數、參與率、最新平均、最新中位數、平均進步、平均成長率與平均正確率。逐生表格包含有效測驗數、首次、最近、變化、成長率、最佳速度與平均正確率。

## 課程進度雲端同步

Phase 6 使用 `typing_progress`，以 `(student_id, lesson_id)` 為唯一鍵，保存課程 ID／語言、第一次完成時間、最佳正確率、最佳速度、完成次數與最後更新時間。

學生登入後，課程完成狀態由 student session 決定。每位學生另有獨立本機快取 `typingPracticeRoomLessonProgressByStudent`；離線時先使用本機快取，連線恢復後再與雲端取聯集。

舊版 `typingPracticeRoomData.lessonProgress` 是整台瀏覽器共用、沒有學生歸屬。為避免共用電腦誤歸屬，保留舊進度但不自動認領或上傳。學生 A／B 快速切換時，server 與前端都會核對 student ID，避免跨學生競態污染。

## 錯鍵與弱鍵資料

錯鍵資料只保存英文測速的聚合資料：

```text
[應按鍵, 實際按鍵, 次數]
```

例如：`R → T × 4`。系統不保存學生完整輸入文章；Phase 4 上線前的舊成績不推測或回填錯鍵。

中文輸入涉及注音／拼音／倉頡等組字流程，無法可靠反推實體按鍵，因此目前不做中文鍵位／手指診斷。

「我的弱鍵」必須有有效 student session；server 依 cookie 決定 student ID，學生端不能透過 query 改成讀其他學生資料。弱鍵特訓目前沿用自訂文章測速，支援 60／120 秒。

## 雲端資料與安全邊界

- `typing_students`：雲端學生名單；停用不刪歷史成績。
- `typing_records`：測速成績、nullable `assignment_id`、nullable `mistakes jsonb`。
- `typing_assignments`／`typing_assignment_targets`：作業與班級指派。
- `typing_student_access`／`typing_student_sessions`：一次性啟用碼 hash 與學生 session。
- `typing_progress`：學生個人課程完成進度。
- 教師登入：HttpOnly、Secure、SameSite=Strict cookie，最長 4 小時。
- 學生登入：HttpOnly、Secure、SameSite=Strict cookie，最長 8 小時。
- 正式作業寫入由 server 核對學生 session、student ID、班級、語言、秒數與 assignment。
- 課程進度 GET／POST 只允許目前 student session 的學生。
- 公開排行榜只回傳必要排名欄位；完整紀錄、名單、作業、完成度、教師錯鍵分析與成長分析都需要教師 session。
- 學生私有作業、「我的弱鍵」與雲端課程進度都需要 student session。

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
- `POST /api/progress`：合併本機個人進度或記錄完成課程。
- `GET /api/growth-analytics`：教師成長分析；支援 `class`、`studentId`、`language`、`duration`、`source`、`threshold`、`from`、`to`。

## 本機執行

```sh
python -m http.server 4173
```

開啟 `http://localhost:4173`。學生自由練習可用純靜態頁面；教師登入、雲端名單、作業、學生 session、完成度、雲端錯鍵分析、成長分析、「我的弱鍵」與跨裝置課程進度需要 Vercel Functions／Postgres。

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

Phase 7 不新增資料表，直接從既有 `typing_students` 與 `typing_records` 做教師端統計。

## 驗證

GitHub Actions 在 `main` push 與 PR 自動執行：

```sh
node --test tests/core.test.cjs tests/teacher-auth.test.cjs tests/records-auth.test.cjs tests/students-api.test.cjs tests/assignments.test.cjs tests/assignment-dashboard.test.cjs tests/mistake-analysis.test.cjs tests/weak-key-practice.test.cjs tests/progress.test.cjs tests/growth-analytics.test.cjs
```

並執行主要前後端 JavaScript `node --check`。

Phase 7 測試額外確認：

- 最早／最近／最佳速度與絕對、百分比進步。
- 班級平均、中位數不按學生測驗次數重複加權。
- 英文／中文、15／30／60／120 秒篩選分離。
- 標準題庫為預設來源；可切全部來源。
- 最低正確率與日期範圍格式驗證。
- 真實教師登入 cookie 可授權，tampered cookie 被拒絕。

## 主要檔案

- `app.js`：課程、測速、排行榜、教師基礎工具
- `cloud-students.js`：雲端名單
- `assignments.js`：作業與學生「我的任務」
- `assignment-dashboard.js`：完成度與投影
- `mistake-analytics.js`：英文錯鍵蒐集、學生結果診斷、教師分析 UI
- `weak-key-core.js`／`weak-key-practice.js`：弱鍵教材與學生補強
- `cloud-progress.js`：學生課程進度同步
- `growth-analytics.js`：教師成長分析 UI
- `api/growth-analytics.js`：教師成長分析 API
- `lib/growth-analysis.js`：first／recent／median／improvement 聚合規則
- `api/progress.js`／`lib/progress-schema.js`：學生課程進度 API 與 schema
- `AGENT_HANDOFF.md`：目前可直接接手的功能基準
- `typing-practice-room-codex-spec.md`：完整 Phase 1–11 Roadmap

## 後續開發

下一階段優先：**Phase 8 報表**。

建議先做教師端 CSV 報表與列印友善版：班級、座號、姓名、作業狀態、有效次數、最佳速度／正確率、首次／最近速度、進步幅度與常錯鍵；PDF 先沿用瀏覽器「列印成 PDF」，不急著引入新的 PDF 套件。

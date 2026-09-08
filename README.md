# 指尖練習室 | Typing Practice Room

給國中資訊課使用的打字教學、測速、教師派作業、班級分析與個人化補強工具。前端使用 HTML、CSS、Vanilla JavaScript；雲端功能使用 Vercel Functions 與 Vercel Postgres／Neon。

正式站：`https://typing-practice-room.vercel.app`

## 學生功能

- 六步新手教學、QWERTY 十指定位、Shift／標點符號教學。
- 7 課英文、8 課注音與中文課程。
- 英文 WPM、中文 CPM，15／30／60／120 秒測速。
- 自訂文章最多 10,000 字元。
- 班級＋姓名＋座號身分與資料庫排行榜。
- 老師派發作業後，以一次性啟用碼登入「我的任務」。
- 作業顯示 `1/3 → 2/3 → 3/3`、未開始／進行中／已完成／已逾期。
- 英文測速保存聚合錯鍵，例如 `R → T × 4`；即使 Backspace 修正，錯按仍會列入診斷。
- 「我的弱鍵」只讀取目前學生自己的錯鍵資料，顯示前 4 個弱鍵與錯按次數。
- 1／2 分鐘弱鍵特訓由本機規則與單字庫生成，不使用 AI API。
- 課程完成進度會依 student session 同步到雲端，換電腦可恢復；離線時仍保留每位學生自己的本機快取。

## 教師功能

- 雲端學生名單：新增、貼上匯入、CSV 匯入、編輯、停用、恢復。
- 雲端作業管理：英文／中文、15／30／60／120 秒、最低正確率、最低速度、完成次數、多班、開始／截止時間。
- 產生單一學生的一次性啟用碼；兌換後建立 8 小時學生 session。
- 作業「完成度」：已完成、進行中、未開始、逾期、有效次數、總嘗試、最佳速度／正確率與最近練習。
- 課堂投影模式每 12 秒更新，只顯示座號與狀態，不顯示學生完整姓名。
- 「錯鍵分析」：班級／個人常錯鍵、手指錯按分布與常見錯鍵配對。
- 「成長分析」：同語言、同秒數、同正確率門檻下比較首次／最近／最佳、班級平均、中位數、平均進步與正確率。
- 成長分析預設只算標準題庫，避免自訂文章／弱鍵特訓污染班級趨勢；可切全部來源。
- **Phase 8「報表」**：整合作業完成度、成長與英文錯鍵，可依班級、學生、作業、語言、秒數、來源、正確率與日期篩選。
- 報表可下載 UTF-8 BOM CSV，並使用瀏覽器列印成 A4 橫式／另存 PDF。

## Phase 1–8 狀態

- Phase 1：雲端學生名單 ✅
- Phase 2：教師派測速作業／學生「我的任務」✅
- Phase 3：教師完成度儀表板／課堂投影模式 ✅
- Phase 4：英文錯鍵診斷／手指弱點分析 ✅
- Phase 5：學生「我的弱鍵」／弱鍵特訓 ✅
- Phase 6：學生課程進度雲端同步 ✅
- Phase 7：教師成長分析 ✅
- Phase 8：教師統一報表／CSV／列印 PDF ✅
- 下一階段：Phase 9 徽章、班級挑戰與學習動機機制

## 學生操作

1. 開啟網站，先完成新手教學與基準鍵課程。
2. 自由測速時填班級、姓名、座號，或選既有練習者。
3. 若老師有派作業，在首頁「我的任務」輸入一次性啟用碼。
4. 登入後可直接開始指定作業；共用電腦用完請按「結束使用」。
5. 登入後課程頁會切換到該學生自己的課程完成進度並同步 Postgres。
6. 英文測速完成後可看錯鍵診斷；首頁「我的弱鍵」可開始 1／2 分鐘補強。

## 教師操作

1. 點「教師端」並登入。
2. 在「學生名單」建立或匯入班級名單。
3. 在「作業管理」建立作業並指定班級。
4. 產生學生一次性啟用碼。
5. 在作業列按「完成度」查看進度；需要投影時開「課堂投影模式」。
6. 到「錯鍵分析」查看班級或個人的英文錯鍵與手指弱點。
7. 到「成長分析」查看首次／最近／班級平均與中位數。
8. 到「報表」選班級、學生、作業、語言、秒數、來源、最低正確率與日期範圍。
9. 按「下載 CSV」匯出目前報表，或按「列印／儲存 PDF」開啟 A4 橫式列印頁。

## Phase 7 成長分析規則

- 英文 WPM 與中文 CPM 分開。
- 15／30／60／120 秒分開，不把不同時長直接混算。
- 可設定最低正確率，預設 90%。
- 預設只統計 `builtin` 標準題庫；自訂文章與弱鍵特訓不進預設成長值。
- 日期 input 以瀏覽器所在地的完整一天計算。
- 每位學生以篩選範圍內最早一筆與最近一筆計算絕對進步與百分比。
- 只有一筆有效測驗時不計成長率。
- 班級平均與中位數使用「每位學生的最近值」，不按測驗次數重複加權。
- 停用學生不列入目前班級母體，但舊成績仍保留。

## Phase 8 報表規則

`GET /api/report` 為教師 session 專用統一報表 API。前端「報表」分頁可篩選：

- 班級、單一學生。
- 作業（可不指定）。
- 英文／中文。
- 15／30／60／120 秒。
- 標準題庫／全部來源。
- 最低正確率。
- 起訖日期。

報表每位學生可顯示：

- 班級、座號、姓名。
- 作業名稱、作業狀態、有效次數。
- 作業最佳速度、作業最佳正確率。
- 成長條件下的首次速度、最近速度、進步幅度、成長率。
- 英文常錯鍵（最多前 3 個）。

作業狀態依該作業自己的最低正確率／速度／完成次數／截止日判定；成長值則依報表上方的語言、秒數、來源、正確率與日期範圍計算，兩者不混用。

選定作業時，常錯鍵只統計該作業的英文紀錄；未指定作業時，依目前英文、秒數、來源與日期範圍統計。錯鍵統計不保存完整輸入文章。

CSV 使用現有 `TypingCore.csvCell`，保留公式注入防護並輸出 UTF-8 BOM。列印版只輸出報表標題、篩選條件與表格，不輸出教師登入控制、密碼欄位或操作介面；PDF 由瀏覽器「列印 → 儲存成 PDF」完成，不引入額外 PDF 套件。

## 課程進度雲端同步

Phase 6 使用 `typing_progress`，以 `(student_id, lesson_id)` 為唯一鍵，保存課程 ID／語言、完成時間、最佳正確率、最佳速度、完成次數與最後更新時間。

每位學生另有獨立本機快取 `typingPracticeRoomLessonProgressByStudent`。舊版 `typingPracticeRoomData.lessonProgress` 沒有學生歸屬，因此保留但不自動認領或上傳；避免共用電腦把前一位學生進度套給下一位。

## 錯鍵與弱鍵資料

錯鍵資料只保存英文測速的聚合資料：

```text
[應按鍵, 實際按鍵, 次數]
```

例如：`R → T × 4`。系統不保存學生完整輸入文章；Phase 4 上線前的舊成績不推測或回填錯鍵。

中文輸入涉及注音／拼音／倉頡等組字流程，無法可靠反推實體按鍵，因此目前不做中文鍵位／手指診斷。

## 雲端資料與安全邊界

- `typing_students`：雲端學生名單；停用不刪歷史成績。
- `typing_records`：測速成績、nullable `assignment_id`、nullable `mistakes jsonb`。
- `typing_assignments`／`typing_assignment_targets`：作業與班級指派。
- `typing_student_access`／`typing_student_sessions`：一次性啟用碼 hash 與學生 session。
- `typing_progress`：學生個人課程完成進度。
- 教師登入：HttpOnly、Secure、SameSite=Strict cookie，最長 4 小時。
- 學生登入：HttpOnly、Secure、SameSite=Strict cookie，最長 8 小時。
- 完整紀錄、名單、作業、完成度、教師錯鍵分析、成長分析與報表均需要教師 session。
- 學生私有作業、「我的弱鍵」與雲端課程進度需要 student session。

本系統仍不是正式考試監考工具；速度與正確率主要由瀏覽器端既有計分邏輯計算。

## API 摘要

- `POST /api/records`：成績寫入。
- `GET /api/records?view=leaderboard...`：公開排行榜。
- `GET /api/records`：教師完整成績查詢。
- `GET|POST|PATCH /api/students`：教師雲端學生名單。
- `GET|POST|PATCH /api/assignments`：教師作業管理。
- `GET /api/assignments?view=mine`：學生自己的作業。
- `GET|POST /api/student-access`：學生 session、啟用碼兌換、登出與教師發碼。
- `GET /api/assignment-dashboard?id=...`：教師作業完成度。
- `GET /api/mistake-analytics`：教師錯鍵分析。
- `GET /api/mistake-analytics?view=mine`：學生自己的弱鍵資料。
- `GET|POST /api/progress`：學生自己的課程進度。
- `GET /api/growth-analytics`：教師成長分析。
- `GET /api/report`：教師統一報表。

## 本機執行

```sh
python -m http.server 4173
```

開啟 `http://localhost:4173`。學生自由練習可用純靜態頁面；教師登入、雲端名單、作業、學生 session、完成度、雲端分析、報表與跨裝置課程進度需要 Vercel Functions／Postgres。

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

## 驗證

GitHub Actions 在 `main` push 與 PR 執行完整 Node tests 與主要前後端 JavaScript `node --check`。

Phase 8 新增測試：

- 作業 `completed / in_progress / not_started / overdue` 報表狀態。
- 將成長、作業與每位學生常錯鍵合併到同一列。
- 常錯鍵跨紀錄聚合與前 3 鍵摘要。
- 報表篩選的班級、作業、語言、秒數、來源、正確率與日期驗證。
- 真實教師登入 cookie 可授權；tampered cookie 被拒絕。

## 主要檔案

- `app.js`：課程、測速、排行榜、教師基礎工具
- `cloud-students.js`：雲端名單
- `assignments.js`：作業與學生「我的任務」
- `assignment-dashboard.js`：完成度與投影
- `mistake-analytics.js`：英文錯鍵與教師分析
- `weak-key-core.js`／`weak-key-practice.js`：學生弱鍵補強
- `cloud-progress.js`：學生課程進度同步
- `growth-analytics.js`／`api/growth-analytics.js`：教師成長分析
- `report.js`：教師報表 UI、CSV 與列印版
- `api/report.js`：教師統一報表 API
- `lib/report-analysis.js`：報表狀態、錯鍵與資料合併規則
- `AGENT_HANDOFF.md`：目前可直接接手的功能基準
- `typing-practice-room-codex-spec.md`：完整 Phase 1–11 Roadmap

## 後續開發

下一階段優先：**Phase 9 徽章、班級挑戰與學習動機機制**。

先以可解釋、非競爭傷害性的徽章與班級共同目標開始，例如：首次完成 90% 正確率、連續完成課程、弱鍵改善、全班作業完成率達 80%／100%；避免公開顯示落後學生姓名。

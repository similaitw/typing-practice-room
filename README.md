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
- **Phase 9「我的紀錄」**：登入後查看自己的英文／中文、15／30／60／120 秒測速歷程，顯示首次、最近、最佳、平均正確率、進步幅度、成長率與最近 20 次 SVG 趨勢圖。
- 「我的紀錄」預設只看標準題庫，可切全部練習；最低正確率可選全部／80／90／95%。英文另顯示弱鍵與「錯按事件／100 字元」前後半變化。

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

## Phase 1–9 狀態

- Phase 1：雲端學生名單 ✅
- Phase 2：教師派測速作業／學生「我的任務」✅
- Phase 3：教師完成度儀表板／課堂投影模式 ✅
- Phase 4：英文錯鍵診斷／手指弱點分析 ✅
- Phase 5：學生「我的弱鍵」／弱鍵特訓 ✅
- Phase 6：學生課程進度雲端同步 ✅
- Phase 7：教師成長分析 ✅
- Phase 8：教師統一報表／CSV／列印 PDF ✅
- Phase 9：學生「我的紀錄」／輕量趨勢圖 ✅
- Phase 10／11：成就系統／班級挑戰目前依使用者決定暫緩。

## 學生操作

1. 開啟網站，先完成新手教學與基準鍵課程。
2. 自由測速時填班級、姓名、座號，或選既有練習者。
3. 若老師有派作業，在首頁「我的任務」輸入一次性啟用碼。
4. 登入後可直接開始指定作業；共用電腦用完請按「結束使用」。
5. 登入後課程頁會切換到該學生自己的課程完成進度並同步 Postgres。
6. 英文測速完成後可看錯鍵診斷；首頁「我的弱鍵」可開始 1／2 分鐘補強。
7. 首頁「我的紀錄」可切語言、秒數、來源與最低正確率，查看自己的最近 20 次趨勢與最近紀錄。

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

## Phase 9 我的紀錄規則

`GET /api/my-records` 只接受目前有效 student session，不接受前端指定 `studentId`。因此學生即使自行修改 query string，也不能讀取其他學生的紀錄。

可篩選：

- 英文 WPM／中文 CPM。
- 15／30／60／120 秒。
- `builtin` 標準題庫／`all` 全部練習。
- 最低正確率 0／80／90／95%。

學生摘要顯示：測驗次數、第一次、最近一次、個人最佳、平均正確率、絕對進步與百分比成長。折線圖只畫目前條件最近 20 次紀錄，不引入大型 chart library，使用原生 SVG。

英文模式另聚合目前條件的弱鍵。至少 4 筆紀錄時，系統將紀錄按時間分成前半／後半，使用「過程中錯按事件 ÷ 已輸入字元 × 100」比較錯按率。這包含已用 Backspace 修正的錯按，因此是鍵位操作診斷，不等同最終文字錯字率。

「我的紀錄」預設最低正確率為 0%，讓學生看到完整學習歷程；若要只比較較穩定表現，可自行切 80／90／95%。預設來源仍是標準題庫，避免文章難度不同造成主趨勢失真。

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

`GET /api/report` 為教師 session 專用統一報表 API。前端「報表」分頁可篩選班級、學生、作業、語言、時長、來源、最低正確率與日期。作業狀態依該作業自己的門檻判定；成長值則依報表篩選條件計算，兩者不混用。

CSV 使用現有 `TypingCore.csvCell`，保留公式注入防護並輸出 UTF-8 BOM。列印版只輸出報表標題、篩選條件與表格，不輸出教師登入控制或密碼欄位；PDF 由瀏覽器「列印 → 儲存成 PDF」完成。

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
- 完整教師資料、班級分析與報表需要教師 session。
- 學生私有作業、「我的弱鍵」、雲端課程進度與「我的紀錄」需要 student session。
- `/api/my-records` 由 server 直接使用 session student ID，不接受查詢其他學生 ID。

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
- `GET /api/my-records`：目前 student session 的私人學習歷程與輕量趨勢資料。

## 本機執行

```sh
python -m http.server 4173
```

開啟 `http://localhost:4173`。學生自由練習可用純靜態頁面；教師登入、雲端名單、作業、學生 session、完成度、雲端分析、報表、私人學習歷程與跨裝置課程進度需要 Vercel Functions／Postgres。

## 部署

GitHub：`https://github.com/similaitw/typing-practice-room`

Vercel 專案：`typing-practice-room`

環境變數：

- `POSTGRES_URL` 或 `DATABASE_URL`
- `TEACHER_PASSWORD`
- `TEACHER_SESSION_SECRET`

不要把密碼、Token、session secret 或資料庫連線字串放進 GitHub 或前端程式。

## 驗證

GitHub Actions 在 `main` push 與 PR 執行完整 Node tests 與主要前後端 JavaScript `node --check`。

Phase 9 新增測試：

- first／recent／best、絕對與百分比成長。
- 趨勢只回傳最近 20 筆。
- 英文錯按事件／100 字元與前後半減少比例。
- `language`／`duration`／`source`／`threshold` 篩選。
- query 即使帶 `studentId` 也不影響 server session 身分。
- 缺少 student cookie 時在資料庫查詢前直接回 401。

## 主要檔案

- `app.js`：課程、測速、排行榜、教師基礎工具
- `cloud-students.js`：雲端名單
- `assignments.js`：作業與學生「我的任務」
- `assignment-dashboard.js`：完成度與投影
- `mistake-analytics.js`：英文錯鍵與教師分析
- `weak-key-core.js`／`weak-key-practice.js`：學生弱鍵補強
- `cloud-progress.js`：學生課程進度同步
- `growth-analytics.js`／`api/growth-analytics.js`：教師成長分析
- `report.js`／`api/report.js`：教師統一報表、CSV 與列印版
- `my-records.js`：學生「我的紀錄」、SVG 趨勢與弱鍵變化 UI
- `api/my-records.js`：student-session 私有學習歷程 API
- `lib/student-history.js`：學生 first／recent／best、趨勢與錯按率規則
- `AGENT_HANDOFF.md`：目前可直接接手的功能基準
- `typing-practice-room-codex-spec.md`：完整 Phase 1–11 Roadmap

## 後續開發

原 Roadmap 的 Phase 10「正向成就系統」與 Phase 11「班級挑戰」目前依使用者決定暫緩。下一輪若不做遊戲化，優先處理既有技術待辦與 Production E2E，例如公開排行榜排除已停用學生、學生／教師完整真實流程驗證，以及必要的安全性與可維護性整理。

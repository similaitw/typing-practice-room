# Agent 交接紀錄

> 每次修改網站程式、樣式、資料或部署設定後，都要更新本檔。較早的逐次紀錄保留在 Git 歷史；本檔只維護目前可直接接手的功能基準與最近階段。

## 2026-09-08｜目前功能基準

- Production：`https://typing-practice-room.vercel.app`
- Branch：`main`
- 技術：HTML／CSS／Vanilla JS、Vercel Functions、Vercel Postgres／Neon。
- Phase 1：雲端學生名單完成第一版。
- Phase 2：教師派測速作業、學生「我的任務」、一次性學生啟用碼完成第一版。
- Phase 3：教師作業完成度儀表板、課堂投影模式完成第一版。
- Phase 4：英文錯鍵診斷、手指弱點分析完成第一版。
- Phase 5：學生「我的弱鍵」、1／2 分鐘弱鍵特訓完成第一版。
- Phase 6：學生課程進度雲端同步完成第一版。
- 下一階段：Phase 7 成長分析。

## Phase 6｜學生課程進度雲端同步

### 修改

- 新增 `lib/lesson-catalog.js`：server 端固定 15 個現有課程 ID 與語言白名單，避免任意 lesson ID 寫入資料庫。
- 新增 `lib/progress-schema.js` 與 `database/progress.sql`，建立 `typing_progress`：
  - `student_id`
  - `lesson_id`
  - `language`
  - `completed_at`
  - `best_accuracy`
  - `best_speed`
  - `attempts`
  - `updated_at`
  - `(student_id, lesson_id)` primary key
- 新增 `api/progress.js`：
  - `GET /api/progress` 只讀目前 student session 的進度。
  - `POST action=merge` 將該學生本機個人快取補到雲端，既有 row 不重複增加 attempts。
  - `POST action=complete` 記錄完成課程，更新最佳正確率／速度並增加完成次數。
  - complete 只接受已知課程且正確率至少 90%。
  - POST 必須帶預期 `studentId`，server 與目前 student session 完全比對；不一致直接 403。
  - 沒有 student cookie 時在 progress schema／progress table 前直接回 401。
- 新增 `cloud-progress.js`：
  - 每位學生本機快取使用 `typingPracticeRoomLessonProgressByStudent`，格式為 `studentId -> {lessonId:true}`。
  - 登入時先把該學生個人快取 merge 到雲端，再 GET 雲端進度並取聯集。
  - 換電腦登入後可以恢復英文／注音與中文課程完成勾選。
  - 離線時保留該學生個人快取；恢復連線後再同步。
  - 完成課程後沿用既有 `#complete-lesson` 行為，不重寫課程計分／輸入邏輯。
  - 模組包裝既有 `save()`，學生登入時顯示個人進度，但 base `typingPracticeRoomData.lessonProgress` 仍保存舊版共用／離線進度，不被學生個人進度污染。
  - 舊版 `lessonProgress` 沒有學生歸屬資訊，刻意保留但不自動認領／上傳，避免共用電腦把前一位學生進度套給下一位。
  - 登出後立即切回舊版／離線進度；登入後切回目前學生自己的進度。
  - GET／POST 回傳 student identity 後前端再次核對預期 student ID；若同步途中切換學生，停止舊同步並重新抓目前 session，避免競態污染。
- `weak-key-practice.js` 在自身邏輯開始前先載入 `cloud-progress.js`，因此即使弱鍵 UI 後續失效，Phase 6 仍可獨立載入。
- `.github/workflows/test.yml` 已加入 progress tests 與新檔 syntax checks。

### 驗證

- 新增 `tests/progress.test.cjs`：
  - 15 個現有課程 ID／語言白名單。
  - complete 只接受已知課程、正確率至少 90%、合理速度。
  - merge 去重並拒絕未知課程。
  - 缺少 student cookie 時回 401。
  - body 預期 student ID 與 session 不一致時回 403，且不查 progress table。
  - 合法完成只使用目前 session student ID。
- GitHub Actions run `34238865194`：最新 Phase 6 安全規則與測試全部 success；Node tests、Syntax checks 全綠。
- Vercel 對 commit `34034c1` 回報 deployment `success`。
- 中間 commit `c57d387` 曾因安全規則先改、舊測試尚未同步而 CI failure；後續 `34034c1` 已修正測試並全綠，不能把中間 failure 當成目前 HEAD 狀態。
- 未讀取、顯示或修改教師密碼／session secret。
- 尚未用真實學生啟用碼人工完成「電腦 A 完成課程 → 電腦 B 登入恢復進度 → 切換另一學生確認互不污染」Production E2E，因此此項不可標為人工通過。

### Phase 6 主要 commits

- `c329a8b` lesson catalog
- `c5b4cd6` progress schema helper
- `b527b33` progress SQL
- `ff9c943` private progress API
- `a07fb51` cloud progress client
- `e4b9d1a` module loading
- `ff3441f` observer recursion fix
- `fa62571` progress tests
- `aad39c4` CI
- `4d9167e` bind writes to active student session
- `c57d387` cross-student race protection
- `34034c1` updated security tests
- `acfa517` README

## Phase 1–5 接手摘要

### Phase 1｜雲端學生名單

- `typing_students` 為教師正式名單來源；localStorage 保留快取／離線 fallback。
- 教師可新增、CSV 匯入、編輯、停用、恢復。
- 停用不刪歷史成績。
- 遺留：公開排行榜是否排除 `active=false` 尚未完成。

### Phase 2｜教師派作業／我的任務

- `typing_assignments`、`typing_assignment_targets`、`typing_student_access`、`typing_student_sessions` 已建立。
- `typing_records.assignment_id` 已上線。
- 學生一次性啟用碼換取 8 小時 HttpOnly／Secure／SameSite=Strict session。
- 正式作業由 server 核對學生 session、班級、語言、秒數與 assignment。

### Phase 3｜完成度／投影

- 每份作業可查看班級與逐生狀態。
- 顯示達標次數、總嘗試、最佳速度、最佳正確率、最近練習。
- 每 12 秒 polling。
- 課堂投影模式只顯示座號與狀態，不顯示姓名。

### Phase 4｜錯鍵／手指分析

- `typing_records.mistakes jsonb` 保存英文聚合錯鍵，不保存完整輸入內容。
- 英文測驗結果顯示本次錯鍵與弱手指。
- 教師「錯鍵分析」可看班級／學生的最常錯鍵、手指分布與配對。
- 中文因輸入法組字不做實體鍵位診斷。

### Phase 5｜我的弱鍵／特訓

- 學生 session 下顯示自己的前 4 個弱鍵。
- 1／2 分鐘弱鍵特訓使用本機規則生成，不使用 AI API。
- `view=mine` 強制使用目前 student session，不能 query 別人的弱鍵。

## 尚未人工 Production E2E

仍建議以正式教師／學生 session 跑一次完整流程：

1. 教師登入並確認雲端名單。
2. 建立 701 英文 60 秒／90%／20 WPM／3 次作業。
3. 發一位學生啟用碼並兌換。
4. 完成 1／3、2／3、3／3，確認完成度與投影同步。
5. 故意錯按並 Backspace 修正，確認學生結果與教師錯鍵分析一致。
6. 回首頁確認「我的弱鍵」只顯示該學生資料。
7. 啟動 1／2 分鐘弱鍵特訓，確認不是正式 assignment，完成後重新整理弱鍵統計。
8. 在電腦 A 完成至少一課，確認 `typing_progress` 同步；換電腦 B 以同一學生 session 登入後恢復課程勾選。
9. 在共用電腦切換另一學生，確認課程勾選切換成另一人的個人進度；舊版共用進度不會被自動認領。

目前未使用真實教師密碼或學生啟用碼，所以以上不能標為已通過。

## 下一階段

### Phase 7｜成長分析

建議下一個 Agent 先做：

- 個人 first → recent → improvement：絕對值與百分比。
- 英文 WPM／中文 CPM 分開。
- 15／30／60／120 秒分開，不把不同時長直接混成一個成長值。
- 班級平均、median、正確率與完成率。
- 日期範圍、語言、時長、最低正確率篩選。
- 先做教師端分析，再延伸學生「我的紀錄」。
- 不需要先引入大型 chart library；SVG／Canvas／CSS 即可。

## 其他持續待辦

- Phase 4 前的歷史成績沒有錯鍵資料，不回填。
- 公開排行榜排除停用學生尚未完成。
- 舊版共用 `lessonProgress` 刻意不自動認領給學生；如未來要遷移，應做明確人工「這是我的舊進度」操作，不可自動猜測。
- 正式作業速度／正確率仍由 client 計分；本系統不是正式考試防作弊工具。
- 若未來要求更高可信度，再做 attempt token／server-side 核對。

## 歷史紀錄

Phase 5 以前的完整逐次交接可從 Git commit `ca690a0`、`fd6acea`、`e7dc26d` 與更早的 `AGENT_HANDOFF.md` 歷史追溯。

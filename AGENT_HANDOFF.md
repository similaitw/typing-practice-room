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
- 課程進度仍主要保存在 localStorage；Phase 6 尚未開始。

## Phase 5｜學生「我的弱鍵」與弱鍵特訓

### 修改

- 新增 `weak-key-core.js`：純前端／Node 可共用的弱鍵練習產生器。會把英文大寫鍵正規化到同一實體字母鍵，保留 Shift 標點作為訓練目標，最多取前 4 個弱鍵。
- 練習產生器使用本機單字集合、弱鍵重複與鍵位組合，自動產生約 1 分鐘（約 420 字元）或 2 分鐘（約 760 字元）教材；不呼叫外部 AI API。
- 新增 `weak-key-practice.js`：首頁「我的任務」附近新增「我的弱鍵」，學生登入後顯示前 4 個弱鍵、錯按次數與負責手指。
- 「開始弱鍵特訓」沿用既有自訂文章測速流程，因此不另外複製 timer、WPM、accuracy、Backspace 或錯鍵統計邏輯。
- 啟動弱鍵特訓時會透過既有 UI 切到 custom／60 或 120 秒，因此若前一刻正在正式 assignment context，會觸發現有作業 context 清除邏輯，不會把弱鍵自由練習誤記成老師指定作業。
- `GET /api/mistake-analytics?view=mine` 新增學生私有模式：student ID 完全由目前 8 小時 student session 決定，學生端傳入 `studentId`、`class` 等 query 不會改變查詢對象。
- `view=mine` 沒有 student cookie 時會在 schema／成績查詢前直接回 401；有 cookie 才進一步驗證 student session。
- 教師版 `/api/mistake-analytics` 仍維持先驗證教師 session 再做資料庫工作。
- `teacher-auth.js` 模組載入順序改為 `cloud-students.js` → `assignments.js` → `assignment-dashboard.js` → `mistake-analytics.js` → `weak-key-core.js` → `weak-key-practice.js`。後段模組失敗仍不阻斷核心打字／作業功能。
- Phase 5 暫不加入 180 秒；目前 `typing_records.duration` 與正式作業 schema 只允許 15／30／60／120 秒，先保持資料庫相容。

### 驗證

- 新增 `tests/weak-key-practice.test.cjs`：
  - 弱鍵正規化與去重。
  - 1／2 分鐘教材長度與目標鍵覆蓋。
  - Shift 標點可生成弱鍵練習。
  - `view=mine` 強制使用 session student ID。
  - 惡意 `studentId=其他人`／`class=其他班` query 被忽略。
  - 缺少 student cookie 時，在成績查詢前回 401。
- GitHub Actions run `34236581283`：新增弱鍵 privacy／generator 測試，success。
- GitHub Actions run `34236621931`：Phase 5 CI 加入新 tests 與 syntax checks，success。
- 安全授權順序調整後 run `34236868629`：Node tests、Syntax checks 全部 success。
- Vercel 對 Phase 5 CI commit `961314d` 回報 deployment `success`；最終文件 commit 需再確認 deployment status。
- 未使用、讀取或修改教師密碼／session secret。
- 尚未用正式學生啟用碼人工完成「我的弱鍵 → 產生特訓 → 完成測速 → 弱鍵重新統計」Production E2E，因此此項不可標為人工通過。

### Phase 5 主要 commits

- `4b33eef` weak-key generator
- `fdd0321` student private mistake analytics
- `db37645` student weak-key UI
- `6bae796` module loading
- `cbfb2fd` privacy／generator tests
- `961314d` CI
- `1a19be3` authenticate before DB work
- `876e00c` auth-order test fix
- `08ecb7c` README

## Phase 1–4 接手摘要

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

## 尚未人工 Production E2E

仍建議以正式教師／學生 session 跑一次完整流程：

1. 教師登入並確認雲端名單。
2. 建立 701 英文 60 秒／90%／20 WPM／3 次作業。
3. 發一位學生啟用碼並兌換。
4. 完成 1／3、2／3、3／3，確認完成度與投影同步。
5. 故意錯按並 Backspace 修正，確認學生結果與教師錯鍵分析一致。
6. 回首頁確認「我的弱鍵」只顯示該學生資料。
7. 啟動 1／2 分鐘弱鍵特訓，確認不是正式 assignment，完成後重新整理弱鍵統計。

目前未使用真實教師密碼或學生啟用碼，所以以上不能標為已通過。

## 下一階段

### Phase 6｜課程進度雲端同步

建議下一個 Agent 先做：

- 建立 `typing_progress`。
- student session 下把 lesson progress 同步到 Postgres。
- localStorage 保留離線 cache。
- 學生換電腦後可恢復英文／注音課程進度。
- 不要直接刪除現有 localStorage progress；採合併與相容 migration。

## 其他持續待辦

- Phase 4 前的歷史成績沒有錯鍵資料，不回填。
- 公開排行榜排除停用學生尚未完成。
- 正式作業速度／正確率仍由 client 計分；本系統不是正式考試防作弊工具。
- 若未來要求更高可信度，再做 attempt token／server-side 核對。

## 歷史紀錄

Phase 4 以前的完整逐次交接可從 Git commit `fd6acea`、`e7dc26d` 與更早的 `AGENT_HANDOFF.md` 歷史追溯。

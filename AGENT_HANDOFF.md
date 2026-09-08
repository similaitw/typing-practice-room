# Agent 交接紀錄

> 每次修改網站程式、樣式、資料或部署設定後，都要更新本檔。較早的逐次紀錄仍保留在 Git 歷史；本檔改為維護目前可直接接手的功能基準與最近階段。

## 2026-09-08｜目前功能基準

- Production：`https://typing-practice-room.vercel.app`
- Branch：`main`
- 技術：HTML／CSS／Vanilla JS、Vercel Functions、Vercel Postgres／Neon。
- Phase 1：雲端學生名單完成第一版。
- Phase 2：教師派測速作業、學生「我的任務」、一次性學生啟用碼完成第一版。
- Phase 3：教師作業完成度儀表板、課堂投影模式完成第一版。
- Phase 4：英文錯鍵診斷、手指弱點分析完成第一版。
- 課程進度仍主要保存在 localStorage；尚未進入雲端進度 Phase。

## Phase 4｜英文錯鍵診斷與手指弱點分析

### 修改

- 新增 `lib/mistake-analysis.js`：驗證、合併與統計聚合錯鍵；資料格式為 `[應按鍵, 實際按鍵, 次數]`。
- `typing_records` 新增 nullable `mistakes jsonb`；`lib/typing-schema.js`、`database/schema.sql`、`database/mistakes.sql` 都採相容 migration，不刪除舊成績。
- `api/records.js` 驗證並保存英文錯鍵；中文只接受空錯鍵陣列。舊紀錄沒有 `mistakes` 時正常相容。
- `mistake-analytics.js` 在英文測速 `keydown` 當下記錄錯按，所以即使學生之後 Backspace 修正，該次錯按仍會列入。
- 英文測驗完成後，結果區顯示常見錯鍵、錯按總次數與最需要留意的手指。
- Shift 上層符號會映射到底鍵判斷手指，例如 `!` 對應 `1`、`?` 對應 `/`。
- 新增教師專用 `/api/mistake-analytics`，支援 `class`、`studentId`、`assignmentId`、`from`、`to` 篩選。
- 教師端新增「錯鍵分析」：可看班級或單一學生的最常錯鍵、手指錯按分布與常見錯鍵配對。
- 中文因輸入法組字無法可靠反推實體按鍵，本 Phase 不做中文鍵位／手指診斷。
- 系統只保存錯鍵聚合資料，不保存學生完整輸入文章。
- 模組載入順序：`cloud-students.js` → `assignments.js` → `assignment-dashboard.js` → `mistake-analytics.js`；後段模組失敗時不阻斷核心打字功能。

### 驗證

- GitHub Actions run `34234752734`：Node tests、Syntax checks 全部 success。
- GitHub Actions run `34234923441`：更新教師 session 測試與 base schema 後，完整測試 success。
- README commit `5e6c893` 的 GitHub Actions run `34235257714`：success。
- Vercel 對 `6800abf` 與 `5e6c893` 均回報 deployment `success`。
- 未使用、讀取或修改教師密碼／session secret。
- 尚未用正式教師帳號完成「英文測速錯按 → DB mistakes → 教師錯鍵分析」人工 E2E，因此不可宣稱此項已人工驗證。

### Phase 4 主要 commits

- `f22dc1d` mistake helper
- `e99bb6e` mistakes schema
- `c757f6b` records persistence
- `0b5e00a` migration SQL
- `02b2925` teacher analytics API
- `d64a259`／`448770a` student + teacher UI and Shift mapping fix
- `2866f77` module loading
- `189cde6`／`fd462da` tests
- `804e858` CI
- `6800abf` base schema
- `5e6c893` README

## Phase 1–3 接手摘要

### Phase 1｜雲端學生名單

- `typing_students` 為教師正式名單來源；localStorage 保留快取／離線 fallback。
- 教師可新增、CSV 匯入、編輯、停用、恢復。
- 停用不刪歷史成績。
- 仍待辦：公開排行榜是否排除 `active=false`。

### Phase 2｜教師派作業／我的任務

- `typing_assignments`、`typing_assignment_targets`、`typing_student_access`、`typing_student_sessions` 已建立。
- `typing_records.assignment_id` 已上線。
- 教師可建立英文／中文測速作業，設定秒數、正確率、速度、完成次數、多班、開始／截止時間。
- 學生以一次性啟用碼換取 8 小時 HttpOnly／Secure／SameSite=Strict session。
- 正式作業成績由 server 核對學生 session、班級、語言、秒數與 assignment。

### Phase 3｜完成度／投影

- 每份作業可開「完成度」查看班級與逐生狀態。
- 顯示達標次數、總嘗試、最佳速度、最佳正確率、最近練習。
- 儀表板每 12 秒 polling。
- 課堂投影模式只顯示座號與狀態，不顯示姓名。

## 尚未人工 Production E2E

仍建議以正式教師帳號跑一次完整流程：

1. 教師登入並確認雲端名單。
2. 建立 701 英文 60 秒／90%／20 WPM／3 次作業。
3. 發一位學生啟用碼並由學生兌換。
4. 完成 1／3、2／3、3／3，確認教師完成度與投影同步。
5. 再完成一筆故意錯按並 Backspace 修正的英文測速，確認結果診斷與教師「錯鍵分析」一致。

目前未使用真實教師密碼，所以以上不能標為已通過。

## 下一階段

### Phase 5｜弱鍵特訓

- 依學生個人常錯鍵自動產生 1–3 分鐘弱鍵練習。
- 優先使用本機規則、既有 `data.js` 題庫與單字集合，不使用外部 AI API。
- 建議入口：學生首頁「我的弱鍵」與測驗結果「針對弱鍵練習」。
- 先支援英文；中文暫不做實體鍵位弱鍵生成。

## 其他持續待辦

- Phase 4 前的歷史成績沒有錯鍵資料，不回填。
- 公開排行榜排除停用學生尚未完成。
- 課程進度雲端同步尚未完成。
- 正式作業速度／正確率仍由 client 計分；本系統不是正式考試防作弊工具。
- 若未來要求更高可信度，再做 attempt token／server-side 核對。

## 歷史紀錄

Phase 3 以前的完整逐次交接內容可從 Git commit `e7dc26d` 與更早的 `AGENT_HANDOFF.md` 歷史追溯。
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
- Phase 7：教師班級／個人成長分析完成第一版。
- 下一階段：Phase 8 報表與列印／PDF。

## Phase 7｜教師成長分析

### 修改

- 新增 `lib/growth-analysis.js`：集中處理 first／recent／best、平均、median、絕對進步、百分比進步等規則。
- 新增 `api/growth-analytics.js`：僅有效教師 session 可讀取；支援：
  - `class`
  - `studentId`
  - `language=en|zh`
  - `duration=15|30|60|120`
  - `source=builtin|all`
  - `threshold=0..100`
  - `from`／`to`
- 預設 `language=en`、`duration=60`、`threshold=90`、`source=builtin`。
- 成長值只在同語言、同秒數、同門檻、同日期範圍內比較，不混算不同測驗條件。
- 預設只算標準題庫 `builtin`，避免自訂文章與 Phase 5 弱鍵特訓因文章難度不同污染班級成長；老師可切「全部來源」。
- 每位學生以目前篩選範圍內最早一筆與最近一筆計算：首次、最近、變化、成長率；另顯示最佳速度與平均正確率。
- 只有一筆有效紀錄的學生不計成長率。
- 班級平均與中位數以「每位學生最近值」計算，不按測驗次數重複加權，避免練很多次的學生過度影響班級統計。
- 只統計 `typing_students.active=true` 的目前學生；停用學生歷史成績保留但不列入目前班級母體。
- 新增 `growth-analytics.js` 教師 UI：「成長分析」分頁，提供班級、學生、語言、秒數、來源、最低正確率、起訖日期篩選。
- 摘要顯示：有紀錄學生／總人數、參與率、最新平均、最新中位數、平均進步、平均成長率、平均正確率。
- 逐生表顯示：班級、座號、姓名、有效測驗數、首次、最近、變化、成長率、最佳與平均正確率。
- 日期 input 由瀏覽器轉成所在地完整一天：開始日 00:00:00、結束日 23:59:59.999，再送 ISO 給 server，避免只統計到結束日午夜。
- `teacher-auth.js` 在既有 Phase 1–6 模組後載入 `growth-analytics.js`；成長模組失敗不阻斷既有教師工具。
- Phase 7 不新增資料表，直接使用既有 `typing_students`／`typing_records`。

### 驗證

- 新增 `tests/growth-analytics.test.cjs`：
  - first／recent／best 與絕對、百分比進步。
  - 班級平均／median 不依單一學生練習次數重複加權。
  - 語言、秒數、最低正確率、日期範圍格式驗證。
  - `source=builtin` 預設與 `source=all`。
  - 真實教師登入 cookie 可通過，tampered／空 cookie 被拒絕。
- GitHub Actions run `34243115709`：Phase 7 初版 Node tests、Syntax checks 全部 success。
- 中間 run `34243350092` 曾因先新增 source filter、測試舊預期尚未同步而 failure；後續測試已修正。
- GitHub Actions run `34243384384`：source-filter 修正版全部 success。
- README 已更新 Phase 1–7、成長統計定義、API 與下一階段。
- Vercel 對 README commit `a0f8b80` 回報 deployment `success`。
- 未讀取、顯示或修改教師密碼／session secret。
- 尚未用真實教師密碼人工打開 Production「成長分析」讀取真實班級資料，因此不能宣稱正式班級人工 E2E 已通過。

### Phase 7 主要 commits

- `564a7c4` growth aggregation helper
- `d6df36e` growth API
- `350ac7f` teacher growth UI
- `43cb6e1` module loading
- `027964b` growth tests
- `ce46de1` CI
- `1dd1bf6` local full-day date filters
- `a54f193` builtin source default
- `5d9b46c` source selector UI
- `be96f9f` updated source-filter tests
- `a0f8b80` README

### 接手過程補充

- 本輪開始時發現 Phase 6 已由另一輪 Agent 完整推上 `main`，但當下尚未先讀到最新 handoff；因此曾短暫新增重複的 Phase 6 helper／schema 草稿。
- 已立即刪除重複 `lib/lesson-progress.js`，並把 `lib/typing-schema.js` 恢復成原本 Phase 6 前的 assignment schema；正式 Phase 6 仍使用已驗證的 `lib/progress-schema.js`／`api/progress.js`／`cloud-progress.js`，沒有被覆蓋。
- 相關清理 commits：`f8f1b46`、`a3cf3ef`。

## Phase 1–6 接手摘要

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

### Phase 6｜課程進度雲端同步

- `typing_progress` 保存每位學生 15 個既有課程的完成進度、最佳正確率／速度、完成次數。
- `cloud-progress.js` 以 `typingPracticeRoomLessonProgressByStudent` 保存學生個人本機快取。
- student session 下跨電腦恢復；舊版共用 `lessonProgress` 不自動認領給某位學生。
- server／client 都防止快速切換學生造成跨學生 progress 污染。

## 尚未人工 Production E2E

仍建議以正式教師／學生 session 跑一次完整流程：

1. 教師登入並確認雲端名單。
2. 建立 701 英文 60 秒／90%／20 WPM／3 次作業。
3. 發一位學生啟用碼並兌換。
4. 完成 1／3、2／3、3／3，確認完成度與投影同步。
5. 故意錯按並 Backspace 修正，確認學生結果與教師錯鍵分析一致。
6. 回首頁確認「我的弱鍵」只顯示該學生資料。
7. 啟動 1／2 分鐘弱鍵特訓，確認不是正式 assignment。
8. 電腦 A 完成課程，電腦 B 登入恢復 Phase 6 進度；切另一學生確認互不污染。
9. 教師「成長分析」選 701／英文／60 秒／90%／標準題庫，確認首次、最近、班級平均與中位數符合實際成績。
10. 切「全部來源」確認弱鍵／自訂文章只在此模式納入；切日期範圍確認結束日整天均納入。

目前未使用真實教師密碼或學生啟用碼，所以以上不能標為已通過。

## 下一階段

### Phase 8｜報表與列印／PDF

建議下一個 Agent 先做：

- 教師端建立統一報表頁。
- CSV 欄位：班級、座號、姓名、作業、狀態、有效次數、最佳速度、最佳正確率、首次速度、最近速度、進步幅度、成長率、常錯鍵。
- 可依班級、作業、語言、秒數、日期範圍篩選。
- 先做 print-friendly CSS，使用瀏覽器「列印 → 儲存成 PDF」，不急著引入 PDF 套件。
- 列印版避免顯示登入控制、操作按鈕與不必要個資。
- CSV 續用現有 `csvCell` 的公式注入防護與 UTF-8 BOM。

## 其他持續待辦

- Phase 4 前的歷史成績沒有錯鍵資料，不回填。
- 公開排行榜排除停用學生尚未完成。
- 舊版共用 `lessonProgress` 刻意不自動認領給學生；若未來要遷移，必須做明確人工操作。
- 正式作業速度／正確率仍由 client 計分；本系統不是正式考試防作弊工具。
- 若未來要求更高可信度，再做 attempt token／server-side 核對。

## 歷史紀錄

Phase 6 以前的完整逐次交接可從 Git commit `a4efaa4`、`ca690a0`、`fd6acea`、`e7dc26d` 與更早的 `AGENT_HANDOFF.md` 歷史追溯。

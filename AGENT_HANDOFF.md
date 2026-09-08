# Agent 交接紀錄

> 本檔只維護目前可直接接手的功能基準；較早逐次紀錄保留在 Git 歷史。

## 2026-09-08｜目前功能基準

- Production：`https://typing-practice-room.vercel.app`
- Branch：`main`
- 技術：HTML／CSS／Vanilla JS、Vercel Functions、Vercel Postgres／Neon。
- Phase 1：雲端學生名單 ✅
- Phase 2：教師派作業／學生「我的任務」／一次性學生啟用碼 ✅
- Phase 3：教師完成度儀表板／課堂投影模式 ✅
- Phase 4：英文錯鍵診斷／手指弱點分析 ✅
- Phase 5：學生「我的弱鍵」／1、2 分鐘弱鍵特訓 ✅
- Phase 6：學生課程進度雲端同步 ✅
- Phase 7：教師班級／個人成長分析 ✅
- Phase 8：教師統一報表／CSV／列印 PDF ✅
- 下一階段：Phase 9 徽章、班級挑戰與學習動機機制。

## Phase 8｜教師報表、CSV 與列印 PDF

### 新增

- `lib/report-analysis.js`
  - 合併每位學生的成長資料、作業完成度與英文錯鍵摘要。
  - 作業狀態規則：`completed / in_progress / not_started / overdue`。
  - 每位學生常錯鍵取前 3 個，格式例如 `r ×5、t ×4`。
- `api/report.js`
  - 僅有效教師 session 可讀。
  - 支援 `class`、`studentId`、`assignmentId`、`language`、`duration`、`source`、`threshold`、`from`、`to`。
  - 預設英文／60 秒／標準題庫／90%。
  - 選作業時，只列該作業指派班級的啟用學生。
  - 作業狀態依作業自己的最低正確率、最低速度、完成次數、截止時間判定。
  - 成長資料仍依 Phase 7 報表篩選條件計算，不與作業門檻混用。
  - 英文錯鍵：選作業時只統計該作業紀錄；未選作業時依英文、秒數、來源與日期範圍統計。
- `report.js`
  - 教師端新增「報表」分頁。
  - 可篩選班級、學生、作業、語言、15／30／60／120 秒、來源、最低正確率與日期範圍。
  - 顯示：班級、座號、姓名、作業、狀態、有效次數、作業最佳速度／正確率、首次、最近、進步幅度、成長率、常錯鍵。
  - 摘要：學生人數、有成長比較人數、最近平均、平均進步、選定作業完成數。
  - 選定作業時，自動把語言、秒數、最低正確率帶成作業預設，老師仍可再調整成長比較條件。
  - CSV 使用 `TypingCore.csvCell`，保留公式注入防護與 UTF-8 BOM。
  - 列印版使用 A4 landscape，只輸出報表與篩選條件，不輸出教師登入控制／密碼欄位；PDF 由瀏覽器「列印 → 儲存成 PDF」。
- `teacher-auth.js`
  - 模組載入鏈尾端新增 `report.js`。
  - `growth-analytics.js` 若失敗，仍會繼續嘗試載入報表；報表失敗不阻斷既有教師工具。

### Phase 8 統計語意

- 作業欄與成長欄是兩個獨立尺度：
  - 作業狀態／有效次數：依作業自身門檻。
  - 首次／最近／進步／成長率：依報表上方語言、秒數、來源、最低正確率、日期範圍。
- 預設成長只使用 `builtin` 標準題庫。
- 班級平均仍沿用 Phase 7「每位學生最近值」規則，不依練習次數重複加權。
- 停用學生不列入目前報表母體，歷史成績不刪除。
- 中文報表不產生實體鍵位錯鍵摘要。

### 測試

新增 `tests/report.test.cjs`：

- 作業完成／進行中／未開始／逾期狀態。
- 成長、作業與錯鍵摘要合併到同一位學生。
- 常錯鍵跨紀錄聚合。
- 報表 parser 的班級、作業、語言、秒數、來源、正確率與日期驗證。
- 真實教師登入 cookie 可授權；tampered／空 cookie 被拒絕。

`.github/workflows/test.yml` 已加入：

- `tests/report.test.cjs`
- `report.js`
- `api/report.js`
- `lib/report-analysis.js`

GitHub Actions run `34245429815`：Node tests、Syntax checks 全部 success。
Vercel 對 Phase 8 CI commit `2439187` 回報 deployment `success`。

### Phase 8 主要 commits

- `76d695b` report aggregation helper
- `5030a15` unified report API
- `0950677` teacher report / CSV / print UI
- `bd1ccff` report module loading
- `27b0bf2` report tests
- `2439187` Phase 8 CI
- `7afc9e7` README

## 尚未人工 Production E2E

仍未使用真實教師密碼，因此以下不能標成人工通過：

1. 教師登入 Production。
2. 報表選 701、某份正式作業。
3. 確認作業狀態／有效次數與「完成度」頁一致。
4. 確認首次／最近／成長與 Phase 7「成長分析」一致。
5. 確認英文常錯鍵與「錯鍵分析」一致。
6. 下載 CSV，確認 Excel／Google Sheets 中文正常、公式注入防護仍有效。
7. 開列印版，確認 A4 landscape 可列印／另存 PDF。

自動測試與部署已通過，但不可宣稱上述真實資料人工 E2E 已完成。

## Phase 1–7 接手摘要

- Phase 1：`typing_students` 為教師雲端名單；停用不刪歷史成績。
- Phase 2：作業、班級 targets、一次性啟用碼、8 小時學生 session；正式作業由 server 核對 session／班級／語言／秒數。
- Phase 3：完成度與課堂投影；投影只顯示座號。
- Phase 4：`typing_records.mistakes jsonb`；只保存英文聚合錯鍵，不保存完整文章。
- Phase 5：學生私有「我的弱鍵」與 1／2 分鐘補強，不使用 AI API。
- Phase 6：`typing_progress` 與每位學生的本機快取；跨裝置恢復課程進度。
- Phase 7：教師成長分析；英文／中文、秒數、來源、門檻、日期分開，班級平均不重複加權。

## 下一階段｜Phase 9

建議先做「低壓力、可解釋」的學習動機機制：

- 個人徽章：首次 90% 正確率、完成 3 課、完成全英文課程、弱鍵改善、連續完成作業等。
- 班級共同目標：作業完成率 50%／80%／100%、全班平均正確率等。
- 投影時只顯示共同進度與已達成數，不公開落後學生姓名。
- 不做付費、抽卡、賭博式隨機獎勵。
- 優先使用既有 records／progress／assignment 資料推導，不急著新增大量資料表。

## 持續待辦

- Phase 4 前歷史成績沒有錯鍵資料，不回填。
- 公開排行榜排除 `active=false` 尚未完成。
- 舊版共用 `lessonProgress` 不自動認領給學生。
- 正式作業速度／正確率仍主要由 client 計分；本系統不是正式考試防作弊工具。
- 若未來要求更高可信度，再做 attempt token／server-side 核對。

## 歷史

Phase 7 以前的完整逐次交接可從 Git commit `33fb533`、`a4efaa4`、`ca690a0`、`fd6acea`、`e7dc26d` 與更早的 `AGENT_HANDOFF.md` 歷史追溯。

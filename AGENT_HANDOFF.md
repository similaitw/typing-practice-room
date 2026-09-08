# Agent 交接紀錄

> 本檔只維護目前可直接接手的功能基準；較早逐次紀錄保留在 Git 歷史。

## 2026-09-09｜目前功能基準

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
- Phase 9：學生「我的紀錄」／輕量 SVG 趨勢圖 ✅
- 原 Roadmap Phase 10「正向成就系統」與 Phase 11「班級挑戰」目前依使用者決定暫緩。

## Phase 9｜學生「我的紀錄」與學習趨勢

### 新增

- `lib/student-history.js`
  - 計算學生 first／recent／best、測驗次數、平均正確率、絕對進步與百分比成長。
  - 趨勢只取目前篩選條件最近 20 筆。
  - 英文可聚合既有 `mistakes`。
  - 至少 4 筆英文紀錄時，按時間分前半／後半，用 `錯按事件 ÷ typedLength × 100` 比較「每 100 個已輸入字元的錯按事件」。
  - 錯按事件包含已用 Backspace 修正的過程錯按，不等同最終文字錯字率。

- `api/my-records.js`
  - `GET` only。
  - 只認目前 HttpOnly student session；不接受 `studentId` 作為查詢身分。
  - 沒有 student cookie 時，在 schema／records 查詢前直接回 401。
  - 支援：`language=en|zh`、`duration=15|30|60|120`、`source=builtin|all`、`threshold=0..100`。
  - 預設：英文、60 秒、標準題庫、最低正確率 0%。
  - 只查目前 session student 的 `typing_records`，最多 10,000 筆；若達上限回 `truncated=true`。
  - 最近紀錄會附 assignment title（若是正式作業）。
  - 中文不回傳實體鍵位弱鍵趨勢。

- `my-records.js`
  - 首頁新增「我的紀錄」。
  - 未登入時只顯示登入提示；有效 student session 才讀私人紀錄。
  - 可切英文／中文、15／30／60／120 秒、標準題庫／全部練習、最低正確率全部／80／90／95%。
  - 摘要：測驗次數、第一次、最近一次、個人最佳、平均正確率、成長值與成長率。
  - 使用原生 SVG 畫最近 20 筆折線趨勢，不加入大型 chart library。
  - 最近紀錄顯示速度、正確率、來源／作業與時間。
  - 英文顯示弱鍵與前半／後半錯按率；用「每 100 字元錯按事件」正規化。
  - 完成新測速後會延遲刷新；學生啟用碼登入／登出、回到分頁時也會重新確認。

- `teacher-auth.js`
  - 現有 optional module 載入鏈最後加入 `my-records.js`。
  - `report.js` 成功或失敗後都會繼續嘗試載入學生紀錄模組；Phase 9 失敗不阻斷既有功能。

### 驗證

- 新增 `tests/my-records.test.cjs`：
  - first／recent／best、進步與百分比。
  - 趨勢最近 20 筆。
  - 英文錯按事件／100 字元、前後半 reduction。
  - `language`／`duration`／`source`／`threshold` parser。
  - query 帶其他 `studentId` 不會改變 server session 身分規則。
  - 沒有 student cookie 時直接 401。
- `.github/workflows/test.yml` 已加入：
  - `tests/my-records.test.cjs`
  - `my-records.js`
  - `api/my-records.js`
  - `lib/student-history.js`
- GitHub Actions run `34285275199`：Node tests、Syntax checks 全部 success。
- Vercel 對 Phase 9 CI commit `ddbbbd6` 回報 deployment `success`。
- README 已更新 Phase 1–9、Phase 9 安全規則與後續暫緩項目。

### Phase 9 主要 commits

- `0403b6c` student history helper
- `cd237d3` private student history API
- `6db97fe` student My Records UI
- `bbfc7c6` module loading
- `382d1ac` Phase 9 tests
- `ddbbbd6` Phase 9 CI
- `11a33d7` README

## Phase 1–8 接手摘要

- Phase 1：`typing_students` 為教師雲端名單；停用不刪歷史成績。
- Phase 2：作業、班級 targets、一次性啟用碼、8 小時學生 session；正式作業由 server 核對 session／班級／語言／秒數。
- Phase 3：完成度與課堂投影；投影只顯示座號。
- Phase 4：`typing_records.mistakes jsonb`；只保存英文聚合錯鍵，不保存完整文章。
- Phase 5：學生私有「我的弱鍵」與 1／2 分鐘補強，不使用 AI API。
- Phase 6：`typing_progress` 與每位學生本機快取；跨裝置恢復課程進度。
- Phase 7：教師成長分析；英文／中文、秒數、來源、門檻、日期分開，班級平均不重複加權。
- Phase 8：教師統一報表，整合作業狀態、成長、常錯鍵；CSV 與瀏覽器列印 PDF。

## 尚未人工 Production E2E

仍未使用真實教師密碼／學生啟用碼，因此以下不能標成人工通過：

1. 學生正式兌換啟用碼。
2. 「我的紀錄」只出現該學生自己的資料。
3. 英文 60 秒標準題庫在不同裝置登入後可看到相同趨勢。
4. 切換中文、15／30／60／120 秒與來源／最低正確率，確認結果正確分離。
5. 完成新測速後，首頁趨勢與最近紀錄自動刷新。
6. 故意錯按並 Backspace 修正，累積至少 4 筆後確認每 100 字元錯按率前後半計算合理。
7. 共用電腦登出 A、登入 B，確認「我的紀錄」不殘留 A 的私人資料。

自動測試與部署已通過，但不可宣稱上述真實資料人工 E2E 已完成。

## 使用者目前決定暫緩

- 徽章／正向成就系統。
- 班級挑戰／遊戲化共同目標。

不要自動往 Phase 10／11 開發，除非使用者重新要求。

## 下一步建議（非遊戲化）

若使用者說「繼續」且沒有指定方向，優先從技術／教學實用待辦選擇：

1. **公開排行榜排除已停用學生**：目前 handoff 持續列為遺留，應讓 `active=false` 不再出現在公開排行榜，但保留歷史成績。
2. Production 真實 E2E：教師→學生→作業→錯鍵→弱鍵→課程進度→我的紀錄→報表完整流程。
3. 安全／可信度：若需求提高，再做 attempt token／server-side 核對；目前系統不是正式考試防作弊工具。
4. 可維護性：逐步抽共用 teacher/student session 驗證與重複 filter parser，但不要改框架。

## 持續待辦

- Phase 4 前歷史成績沒有錯鍵資料，不回填。
- 公開排行榜排除 `active=false` 尚未完成。
- 舊版共用 `lessonProgress` 不自動認領給學生。
- 正式作業速度／正確率仍主要由 client 計分。
- 若未來要求更高可信度，再做 attempt token／server-side 核對。

## 歷史

Phase 8 以前完整交接可從 Git commit `a74be59`、`33fb533`、`a4efaa4`、`ca690a0`、`fd6acea`、`e7dc26d` 與更早的 `AGENT_HANDOFF.md` 歷史追溯。

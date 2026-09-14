# Agent 交接紀錄

> 本檔只維護目前可直接接手的功能基準；較早逐次紀錄保留在 Git 歷史。

## 2026-09-14｜目前功能基準：簡化排行榜版

- Production：`https://typing-practice-room.vercel.app`
- Branch：`main`
- 技術：HTML／CSS／Vanilla JS、Vercel Functions、Vercel Postgres／Neon。
- 使用者決定把教師端與排行榜大幅簡化，不再讓一般操作畫面載入錯鍵分析、弱鍵特訓、成長分析、報表、作業管理等進階模組。
- 舊功能程式與資料表仍保留在 repository／database，沒有刪除歷史資料；只是目前 `teacher-auth.js` 不再載入那些 optional modules。

## 現行學生流程

1. 進入「打字測速」。
2. 只填寫：班級、姓名、座號。
3. 按「登錄排行榜」。
4. `POST /api/ranking-register` 會建立或沿用雲端 `typing_students` 身分。
5. 完成測速後，成績照既有 `/api/records` 寫入資料庫並更新排行榜。

### 排行榜身分規則

- 班級、姓名、座號皆必填。
- 座號限制 1–999，會補成至少兩位數，例如 `7` → `07`。
- 相同班級＋姓名＋座號沿用同一個雲端學生 ID。
- 若教師已將該學生設為 `active=false`，學生不可自行重新啟用，必須由教師端恢復。
- 公開排行榜仍只列 `typing_students.active=true` 的學生；歷史成績不刪除。

## 現行排行榜 UI

`simple-ranking.js` 會在載入後取代原本複雜排行榜畫面。

公開排行榜與教師排行榜都只保留：

- 語言：英文 WPM／中文 CPM。
- 顯示名次：前 10／20／30／50／100 名。
- 姓名查詢：輸入姓名後只回報目前名次；若同名，會列出各班級／座號的名次。
- 排行列只顯示：名次、班級／姓名／座號、速度。
- 不顯示日期、錯鍵、弱鍵、成長曲線、測驗明細等資訊。
- 排名規則仍沿用既有資料庫邏輯：個人最佳速度、最低正確率 90%，同速再比較正確率與時間。

## 現行教師端

教師端目前只保留三個主要頁面：

1. 學生名單
2. 排行榜
3. 備份與資料

`teacher-auth.js` 現在只載入：

- `cloud-students.js`
- `simple-ranking.js`

以下舊模組仍留在 repo，但目前不自動載入：

- `assignments.js`
- `assignment-dashboard.js`
- `mistake-analytics.js`
- `weak-key-core.js`
- `weak-key-practice.js`
- `cloud-progress.js`
- `growth-analytics.js`
- `report.js`
- `my-records.js`

除非使用者明確要求，不要自行把這些進階頁面重新加回教師 UI。

## 2026-09-14 主要變更

- `8ab7534`：修復資料庫 schema 權限不足時的成績上傳。
- `4e691ed`：公開排行榜排除已停用學生。
- `b48b534`：更新排行榜測試並通過 CI。
- `72db7f8`：新增簡單排行榜公開登錄 API。
- `0138bfc`：新增 `simple-ranking.js`，簡化公開／教師排行榜。
- `570d75e`：教師端只載入雲端名單與簡化排行榜。
- `9d0b048`：新增排行榜登錄測試。
- `7c518f1`：CI 加入新檔案 syntax checks。

## 驗證

- GitHub Actions run `34805327198`（run #106）：`success`。
- Vercel 對 commit `7c518f18f4dd65cfee209e316c01cb70c8838030`：deployment `success`。
- `simple-ranking.js`、`api/ranking-register.js` 均納入 syntax check。
- `tests/ranking-register.test.cjs` 已納入 `node --test`。

## 尚未人工 Production E2E

仍建議使用真實資料人工驗證：

1. 新學生輸入班級／姓名／座號後可建立雲端排行榜身分。
2. 同一學生第二次使用相同資料會沿用相同 ID，不重複建立。
3. 完成測速後可在排行榜看到成績。
4. 公開排行榜可切前 10／20／30／50／100 名。
5. 姓名查詢可找到顯示範圍外（例如第 37 名）的目前名次。
6. 教師停用學生後，該學生不再出現在排行榜，且不能自行重新登錄啟用。
7. 教師端重新整理後只看到「學生名單／排行榜／備份與資料」，不再出現進階分析頁籤。

自動測試與部署已通過，但上述真實 Production 操作尚不可宣稱人工 E2E 通過。

## 後續原則

- 目前產品方向是「簡單、課堂可直接用」，不要優先恢復遊戲化或複雜分析。
- 不刪除舊資料與舊模組，除非使用者明確要求清理。
- 若要再擴充排行榜，優先考慮：班級篩選、教師設定全站預設顯示名次、姓名＋班級查詢。
- 若未來要求正式考試可信度，再另做 server-side attempt token／成績核對；目前仍是練習工具，不是防作弊考試系統。

## 歷史

Phase 1–9 舊版完整功能可從 Git 歷史追溯，重要 handoff commits 包含：`79f990e`、`a74be59`、`33fb533`、`a4efaa4`、`ca690a0`、`fd6acea`、`e7dc26d`。

## 2026-09-15｜教師端精簡

- 移除名單、備份與其他教師管理分頁，保留成績排行、篩選、CSV 與資料編輯／刪除。
- PATCH／DELETE /api/records 驗證教師登入與同源，變更寫入資料庫。
- 整合遠端簡易公開排行榜、姓名搜尋與雲端登錄；不再載入教師名單模組。

# 指尖練習室｜整合開發規格與進階 Roadmap

更新日期：2026-09-08。現況基準：`17466ff`（英文練習字數調整）。

- Repository：[similaitw/typing-practice-room](https://github.com/similaitw/typing-practice-room)
- Production：[指尖練習室](https://typing-practice-room.vercel.app/)
- 本文件整合使用者提供的 ChatGPT 進階規畫，作為後續開發依據。本次僅更新文件，Phase 1–11 均未因本次整理而實作。
- 閱讀順序：本節現況與整合決議 → 第一輪範圍（第 32–35 節）→ 各階段詳細規格。
- 實際操作看 [README.md](README.md)，驗證紀錄看 [TESTING.md](TESTING.md)，最新異動看 [AGENT_HANDOFF.md](AGENT_HANDOFF.md)。
- [初版完整開發規格](docs/initial-development-spec.md)保留為歷史需求，不能用其中「不使用後端／不連資料庫」等舊條款覆蓋目前系統。

## 現況與開發狀態

| 範圍 | 狀態／基準 |
| --- | --- |
| 技術 | HTML、CSS、Vanilla JavaScript、Vercel Functions、Postgres／Neon；沿用既有 repo 與 Production |
| 教學 | 六步新手教學、實體鍵盤與手位圖；末步僅提供基準鍵第一課入口 |
| 課程 | 7 課英文、8 課注音／中文，完整 Shift 符號與指法提示 |
| 英文練習量 | 已完成：預設 200 字元，可設 50–2,000 字元，含空格與標點；本機保存設定與 JSON 備份 |
| 測速 | WPM／CPM，15／30／60／120 秒、自訂文章與既有計分規則 |
| 身分 | 班級、姓名、座號；目前自行輸入，尚非學生帳號驗證 |
| 成績與公開排行榜 | 已使用資料庫；按班級、姓名、座號合併最佳成績，公開 API 僅回傳排名欄位 |
| 斷線補傳 | 已完成持久待傳佇列及自動／手動重試；舊版本機未同步歷史成績尚不自動回補 |
| 教師保護 | 已有教師 session、可自訂共用密碼及雲端雜湊儲存；不可擅自修改實際密碼 |
| 學生名單、課程進度 | 目前以 localStorage 保存；雲端名單為 Phase 1，雲端進度為 Phase 6 |
| CSV／JSON | 既有匯入、匯出及備份還原必須保留 |
| 進階 Phase 1–11 | 待開發；原文的「目前已有」只描述既有功能，不表示派課等功能已完成 |

## 整合決議與實作前須落實的細節

1. **第一輪範圍**：Phase 1 雲端名單，加上 Phase 2 測速作業資料模型、教師管理、學生「我的任務」與完成計算。課程類型作業是後續 Phase 2 擴充；第一輪只做 `speed_test`。
2. **多班派發**：以 `typing_assignment_targets` 為正式目標班級來源，schema 範例中的 `target_class` 不另存為相互矛盾的單班來源。第一輪含基本完成狀態查詢，進階儀表板／投影／polling 留 Phase 3。
3. **學生關聯遷移**：既有跨裝置 `student_id` 可能不同；導入雲端學生 ID 時須按既有班級／姓名／座號建立對應、去重並保留歷史紀錄。身分更名及停用不可讓舊成績失聯；不得直接以新的 ID 取代所有既有關聯而不驗證。
4. **學生端資料存取**：名單管理需要教師 session。學生選身分流程不能直接公開全校名單；第一輪需設計受限班級選擇／身分確認與授權範圍。自行填寫姓名不等於可讀取該人的完整私人歷史。
5. **有效作業成績**：伺服器須驗證學生、目標班級、作業是否啟用、語言、時長與紀錄 ID 去重，再依門檻計算有效次數。作業起訖、時區（預設 Asia/Taipei）、逾期提交、離線晚到紀錄及已交作業修改規則，須在該階段實作時明確定義並測試；不能只相信 client 的完成旗標或時間。
6. **課程作業資料**：後續新增 `lesson` 作業時需定義 `lesson_id` 與課程練習成果記錄方式，包含派課指定字數；不可將課程結果硬塞成既有限時測速紀錄。保留現有可調字數功能。
7. **離線範圍**：保留已載入頁面的自由練習及待傳快取；目前不宣稱尚未載入網站即可完整離線啟動。未來離線作業狀態必須標示快取／待同步，避免誤報已送出。
8. **錯鍵分析定義**：Phase 4 須區分最後輸入內容的錯誤與過程中已修正錯誤，避免每次 input 重複累加；中文 IME 不可直接推論實體錯鍵。只保存聚合統計。
9. **安全與相容性**：所有 migration 保存於 database/，可重複執行且向後相容。保留既有資料、教師 session 保護及 API 驗證；寫入驗證、速率限制與公開回傳欄位需納入階段驗收。
10. **驗證紀錄**：以下驗收均是待執行需求，不是已通過的測試報告；完成後才更新 TESTING.md 與交接紀錄。文件更新本身不需要資料庫 migration 或網站部署。

## 階段索引

| 順序 | 工作 | 狀態 |
| --- | --- | --- |
| P0 | 持續維持現有 Production 與回歸驗證 | 持續 |
| Phase 1 | 雲端學生名單、班級、停用與還原 | 待開發，第一輪 |
| Phase 2 | 多班作業、我的任務、有效次數與完成狀態 | 第一輪先測速，課程作業後續擴充 |
| Phase 3 | 教師即時儀表板、課堂投影、10–15 秒 polling | 待開發 |
| Phase 4 | 聚合錯鍵與手指診斷 | 待開發 |
| Phase 5 | 客戶端規則生成弱鍵補強 | 待開發 |
| Phase 6 | 課程進度雲端同步 | 待開發 |
| Phase 7 | 個人與班級成長分析 | 待開發 |
| Phase 8 | CSV 班級報表與列印 | 待開發 |
| Phase 9 | 我的紀錄與輕量趨勢圖 | 待開發 |
| Phase 10 | 正向成就系統 | 待開發 |
| Phase 11 | 班級挑戰，以中位數比較 | 待開發 |

排行榜進階篩選為跨階段需求（第 16 節），以合理語言／時長／日期範圍比較；不搶先於雲端名單與派課主流程。

## 進階規格正文

以下保留提供規畫的第 0–36 節需求與驗收細節；遇到第一版／最終版範圍差異，以前述整合決議及第一輪限定為準。

## 0. 任務定位

以下為後續開發任務的規格；使用者啟動實作時，接手目前專案繼續開發。

這不是重新製作網站，也不要更換技術框架。

現有架構：

* HTML
* CSS
* Vanilla JavaScript
* Vercel Functions
* Vercel Postgres / Neon
* GitHub main
* Vercel Production

目前已有：

* 六步新手教學
* 英文鍵位課程
* 注音鍵位課程
* 中文打字課程
* 英文 WPM 測速
* 中文 CPM 測速
* 15／30／60／120 秒測驗
* 自訂文章
* 學生身分：班級／座號／姓名
* 公開排行榜
* 教師登入
* 教師密碼雲端驗證
* 學生名單
* CSV 匯入／匯出
* JSON 備份
* Postgres 成績資料庫
* 失敗成績待傳佇列
* 跨裝置資料庫排行榜

---

## 1. 開始工作前必做

開始修改之前：

1. 閱讀：

   * `README.md`
   * `AGENT_HANDOFF.md`
   * `TESTING.md`

2. 檢查：

   * `index.html`
   * `app.js`
   * `core.js`
   * `data.js`
   * `styles.css`
   * `api/`
   * `database/`
   * `tests/`

3. 查看最新 Git commit。

4. 以目前 production 行為為 baseline。

5. 不可破壞既有功能。

6. 不要擅自改教師密碼。

7. 不要把 password、session secret、database URL 寫入 repository。

8. 每完成一個階段：

   * 跑完整測試
   * 做瀏覽器驗證
   * 更新 README
   * 更新 AGENT_HANDOFF.md
   * commit
   * push main
   * 確認 Vercel production

若某階段牽涉 database migration：

* migration 必須 backward compatible
* 既有 typing_records 不可遺失
* 舊欄位不可直接破壞
* 新欄位優先 nullable 或提供合理 default
* SQL 必須可安全重複執行

---

## 2. 產品最終方向

將目前的：

> 打字練習網站

升級為：

> 國中資訊課「打字學習＋教師派課＋學習診斷＋班級管理」系統

完整流程應為：

教師建立班級
↓
匯入學生
↓
教師派發打字任務
↓
學生開啟網站
↓
看到自己的待完成任務
↓
直接進入指定練習
↓
完成後自動送出
↓
教師端即時看到完成狀態
↓
分析速度、正確率、錯鍵、進步幅度
↓
匯出班級成績

---

## 3. 開發原則

### 3.1 不要現在改框架

目前不要轉成：

* React
* Vue
* Next.js
* TypeScript

先維持現有架構。

只有當目前架構真的無法維護時才做模組化，而且必須逐步進行。

---

## 3.2 Desktop classroom first

主要使用情境：

* 國中電腦教室
* Chromebook
* Windows PC
* 實體鍵盤

同時保持：

* 平板可用
* 手機可用
* 360px 無橫向捲動

---

## 3.3 Classroom UX

學生操作應盡可能少。

理想流程：

開網站
→ 選班級
→ 選座號／姓名
→ 顯示「老師指定作業」
→ 按開始
→ 打字
→ 完成

不要要求學生理解複雜設定。

---

## 4. 開發 Roadmap

---

## Phase 1｜雲端班級與學生名單

目前：

* 成績已存在 Postgres
* 教師本機學生名單仍依賴 localStorage

這會造成：

老師換電腦後，名單不同步。

因此第一階段先做：

### 4.1 Cloud students

新增資料表，例如：

```sql
typing_students
```

建議欄位：

```text
id
student_class
student_seat
student_name
active
created_at
updated_at
```

建議 unique identity：

```text
student_class
student_seat
student_name
```

但必須考量：

舊 typing_records 已有：

```text
student_id
student_class
student_seat
student_name
```

不要破壞舊成績關聯。

---

### 4.2 教師端名單改成雲端

教師：

「學生名單」

應由 Postgres 讀取。

支援：

* 新增學生
* 批次新增
* CSV 匯入
* 編輯
* 停用
* 還原
* 搜尋
* 班級篩選

原本 localStorage 名單：

可以保留做 cache／fallback。

但：

> Postgres 才是正式資料來源。

---

### 4.3 不直接刪除有歷史成績學生

教師按刪除時：

預設改成：

```text
active = false
```

不要直接破壞歷史成績。

介面顯示：

* 在籍
* 已停用

可提供：

「永久刪除沒有成績紀錄的學生」

但要二次確認。

---

### 4.4 班級管理

從學生資料自動整理班級。

例如：

```text
701
702
703
704
705
706
707
708
709
710
```

教師端增加：

「班級」

頁面。

顯示：

```text
701　28 人
702　29 人
703　27 人
```

不用一開始另外建立複雜 school / teacher / class schema。

先以 student_class 為班級識別即可。

---

## Phase 1 驗收

必須確認：

* 教師電腦 A 新增學生
* 教師電腦 B 登入
* 可以看到相同名單
* 舊成績仍存在
* 舊 leaderboard 正常
* CSV 匯入正常
* 不會產生重複學生
* inactive 學生不出現在一般學生選單
* inactive 學生歷史成績仍保留

---

## Phase 2｜教師派發作業

這是本次進階版最重要功能。

新增：

```text
typing_assignments
```

最初版本先不要做得過度複雜。

---

## 5. Assignment schema

建議資料：

```text
id
title
description
assignment_type
language
duration
min_accuracy
min_speed
required_attempts
target_class
start_at
due_at
active
created_at
updated_at
```

assignment_type 第一版支援：

```text
speed_test
lesson
```

---

## 5.1 Speed Test Assignment

例如教師建立：

```text
作業名稱：
701 英文打字測驗 1

類型：
英文測速

時間：
60 秒

最低正確率：
90%

最低速度：
20 WPM

要求完成：
3 次

班級：
701

期限：
2026/09/15
```

---

## 5.2 Lesson Assignment

教師也能指定：

```text
英文
第 1 課 基準鍵
```

或：

```text
注音
第 3 課
```

第一版可直接使用現在 data.js 裡現有 lesson ID。

不要複製教材。

assignment 只儲存：

```text
lessonId
```

---

## 5.3 多班派發

可以選：

```text
701
702
705
```

不要只允許單一班。

建議使用 assignment target table：

```text
typing_assignment_targets
```

欄位：

```text
assignment_id
student_class
```

之後才能擴充指定單一學生。

---

## 6. Student Assignment View

學生選好：

```text
班級
座號
姓名
```

後：

首頁新增明顯區塊：

## 我的任務

例如：

```text
今天要完成

英文打字 60 秒
要求：90% / 20 WPM
完成：1 / 3
截止：9/15

[開始練習]
```

完成顯示：

```text
✓ 已完成
最佳 27 WPM
正確率 96%
```

---

## 6.1 作業狀態

支援：

```text
未開始
進行中
已完成
已逾期
```

使用視覺清楚的 badge。

---

## 6.2 一鍵進入

按：

```text
開始練習
```

自動：

* 切到正確語言
* 設定時間
* 設定學生
* 設定 assignment ID
* 開始該任務

學生不需要重新選設定。

---

## 7. typing_records 擴充

現有 typing_records 增加：

```text
assignment_id nullable
```

不要讓既有資料失效。

舊資料：

```text
assignment_id = null
```

---

## 7.1 判斷作業是否完成

不要另外保存容易失真的「完成」布林值。

應由成績計算。

例如：

```text
required_attempts = 3
min_accuracy = 90
min_speed = 20
```

找出符合：

```text
assignment_id
student
accuracy >= 90
speed >= 20
```

的有效紀錄。

達到 3 次：

```text
completed
```

---

## 8. Phase 2 教師作業管理

教師端新增：

## 作業管理

包含：

### 建立作業

### 目前作業

### 已結束

### 複製作業

### 編輯

### 停用

不要真的刪除已有學生成績的 assignment。

---

## Phase 2 驗收

建立：

```text
701
60 秒英文
90%
20 WPM
3 次
```

測試：

學生 A：

```text
85%
30 WPM
```

不算。

學生 A：

```text
92%
18 WPM
```

不算。

學生 A：

```text
92%
22 WPM
```

算 1 次。

完成三筆後：

```text
已完成
```

教師端與學生端狀態必須一致。

---

## Phase 3｜教師班級即時儀表板

完成 assignment 後進入下一階段。

教師點某項作業：

```text
701 英文 60 秒
```

顯示：

```text
完成 18 / 29
62%
```

---

## 9. 學生狀態表

例如：

| 座號 | 姓名  | 狀態  | 次數 | 最佳速度 | 正確率 |
| -- | --- | --- | -: | ---: | --: |
| 01 | 王○明 | 完成  |  3 |   31 | 96% |
| 02 | 林○婷 | 進行中 |  2 |   24 | 93% |
| 03 | 陳○華 | 未開始 |  0 |    - |   - |

支援排序：

* 座號
* 完成狀態
* 速度
* 正確率
* 進步幅度

---

## 9.1 課堂投影模式

新增：

## 課堂模式

適合投影幕使用。

不顯示完整成績細節。

顯示：

```text
701 英文打字
18 / 29 完成
```

學生用座號呈現：

```text
01 ✓
02 ✓
03 …
04 ✓
05 …
```

避免投影學生完整姓名。

---

## 9.2 自動更新

教師儀表板可以：

每 10～15 秒更新一次。

不要用過度複雜 WebSocket。

第一版 polling 即可。

離開頁面停止 polling。

---

## Phase 4｜錯鍵診斷

這是下一個真正有教學價值的功能。

現在 typing_records 只有：

```text
correct_chars
errors
```

不足以知道：

學生到底哪個鍵最容易錯。

---

## 10. Mistake Analytics

測驗時前端統計：

```text
expected key
actual key
count
```

例如：

```json
{
  "r>t": 4,
  "e>r": 2,
  "i>o": 3
}
```

但不要保存：

完整學生輸入內容。

只保存 aggregate mistake statistics。

避免無意義保存學生完整文字。

---

## 10.1 Database

typing_records 可增加：

```text
mistakes jsonb
```

或另外建立：

```text
typing_record_mistakes
```

若使用 JSONB 較簡單，可先採：

```text
mistakes jsonb
```

---

## 10.2 Finger Analytics

利用目前已經存在的鍵位／手指 mapping。

將錯誤整理成：

```text
左小指
左無名指
左中指
左食指
右食指
右中指
右無名指
右小指
```

---

## 10.3 教師診斷

顯示：

### 701 最常錯的鍵

```text
R  34 次
T  29 次
B  24 次
P  17 次
```

### 最弱手指

```text
右小指 31%
左小指 24%
```

---

## 10.4 個人診斷

學生完成後顯示：

```text
你最容易按錯：

R → T
P → [
B → N
```

再提供：

```text
[針對弱鍵練習]
```

---

## Phase 5｜自動補強練習

使用錯鍵分析，自動產生練習內容。

例如：

學生常錯：

```text
r
t
f
g
```

產生：

```text
rt tr rf fr
tree free great
```

但：

不要使用 AI API。

全部在 client 端利用：

* 錯誤鍵
* data.js 題庫
* 規則
* 單字集合

產生即可。

---

## 11. 弱鍵練習

首頁新增：

```text
我的弱鍵
```

例如：

```text
R
T
B
N
```

按：

```text
開始弱鍵特訓
```

建立 1～3 分鐘短練習。

---

## Phase 6｜課程進度雲端同步

目前 lesson progress 在 localStorage。

升級為：

```text
typing_progress
```

例如：

```text
student identity
lesson_id
language
best_accuracy
best_speed
attempts
completed_at
updated_at
```

---

## 12. 課程進度

學生換電腦後：

仍然知道：

```text
英文 1 ✓
英文 2 ✓
英文 3 進行中
英文 4 尚未
```

---

## 12.1 localStorage

localStorage 仍可：

* 快取
* 離線使用

但正式網站：

Postgres 為主要進度來源。

---

## Phase 7｜學習成長分析

教師端新增：

## 學習分析

---

## 13. 個人成長

例如：

```text
王小明

第一次：
13 WPM

目前：
27 WPM

提升：
+14 WPM
+108%
```

---

## 13.1 班級分析

顯示：

```text
701

平均：
24 WPM

中位數：
22 WPM

平均正確率：
94%

達標：
23 / 29
```

---

## 13.2 Speed bands

例如：

```text
< 10
10–19
20–29
30–39
40+
```

顯示人數分布。

---

## 13.3 只比較合理資料

分析要能設定：

```text
語言
測驗時間
最低正確率
日期範圍
```

不要把：

15 秒與 120 秒測驗直接混成同一比較基準。

---

## Phase 8｜報表

教師端提供：

## 匯出班級報表

CSV 至少包含：

```text
班級
座號
姓名
作業
完成狀態
有效次數
最佳速度
最佳正確率
第一次速度
最近速度
進步幅度
常錯鍵
```

---

## 14. Print Report

新增適合列印的：

```text
班級作業成績表
```

CSS：

```css
@media print
```

不需要立即產生 PDF。

瀏覽器即可：

```text
列印 → PDF
```

---

## Phase 9｜學生學習歷程

學生頁新增：

## 我的紀錄

顯示：

```text
英文最佳
中文最佳
已完成課程
最近作業
最近 10 次測驗
```

---

## 15. 趨勢圖

不要引入大型 chart library。

第一版可以：

* SVG
* Canvas
* CSS

畫簡單折線圖。

資料：

```text
日期
WPM / CPM
accuracy
```

---

## Phase 10｜成就系統

最後才做。

不要優先於教師功能。

學生達成：

```text
第一次完成
英文 20 WPM
英文 30 WPM
英文 40 WPM
正確率 95%
正確率 100%
連續完成 5 次
完成所有英文鍵位課
完成所有注音鍵位課
```

顯示徽章。

不要做：

* 公開同學嘲諷型排名
* 負面徽章
* 倒數排名

---

## Phase 11｜Class Challenge

作為進階趣味功能。

教師建立：

```text
701 vs 702
英文 60 秒
```

比較：

不要只比較全班平均。

優先使用：

```text
median
```

避免單一高手影響整班。

可顯示：

```text
701  中位數 27 WPM
702  中位數 25 WPM
```

---

## 16. 排行榜進階

目前排行榜保留。

增加篩選：

```text
全校
班級
英文
中文
15
30
60
120 秒
本週
本月
全部
```

預設仍需：

```text
accuracy >= 90%
```

---

## 17. 隱私與安全

學生資料已涉及：

```text
班級
姓名
座號
成績
```

因此：

### 公開 API

只能回傳必要資訊。

不要提供：

* 全部測驗歷史
* teacher-only 資訊
* database internal fields

---

## 17.1 Teacher API

下列功能全部要求教師 session：

* 名單
* 作業建立
* 作業修改
* 成績完整查詢
* 班級報表
* 班級統計

---

## 17.2 Student API

學生端只能取得：

* 自己目前需要的 assignment
* 必要公開排行榜資料
* 必要進度資料

不要建立一個 API：

```text
GET /students
```

直接公開全校姓名名單。

---

## 17.3 Rate limiting / validation

所有寫入 API：

server side 驗證：

* string length
* language
* duration
* speed
* accuracy
* timestamp
* assignment
* student identity

不要相信 client 傳入的所有資料。

---

## 18. 防作弊定位

本系統不是正式考試系統。

但仍維持：

* paste 不計
* drag/drop 不計
* typing 才開始 timer
* 完成只存一次

可記錄：

```text
visibility change count
```

但先不要據此判定作弊。

最多在教師端顯示：

```text
測驗期間曾離開頁面
```

作為參考。

不要直接顯示：

```text
作弊
```

---

## 19. UX 改進

學生首頁最終應有：

```text
繼續練習
老師指定
自由練習
我的紀錄
```

不要讓：

```text
課程
測速
排行榜
教師功能
```

全部同權重擠在一起。

---

## 19.1 Teacher / Student separation

主介面：

Student first。

教師端放：

```text
教師管理
```

登入後才出現：

```text
班級
學生
作業
成績
分析
備份
設定
```

---

## 20. Accessibility

保持：

* keyboard navigation
* visible focus
* button label
* form label
* sufficient contrast
* 不只靠顏色判斷對錯

---

## 21. Performance

不要因加入教師管理功能讓學生打字頁變慢。

特別注意：

`keydown/input`

不能每打一個字：

向 server 發 API。

測驗期間：

所有即時運算在 client。

只在：

```text
完成
```

後送結果。

---

## 22. API 建議

可依實際架構調整，不必完全照此命名。

例如：

```text
/api/students
/api/assignments
/api/assignment-status
/api/progress
/api/records
/api/analytics
```

---

## 23. Database 建議

最終可包含：

```text
typing_students

typing_records

typing_assignments

typing_assignment_targets

typing_progress
```

先不要做過度正規化。

---

## 24. JavaScript 架構改善

目前 app.js 已偏大。

後續增加功能時：

不要持續把所有程式塞進 app.js。

可以逐步拆成：

```text
js/
  api.js
  students.js
  assignments.js
  teacher-dashboard.js
  analytics.js
```

但：

不要為了重構一次改完整專案。

採：

「新功能模組化，舊功能逐步搬移」

策略。

---

## 25. 測試要求

每個 Phase 必須有 automated tests。

至少涵蓋：

### Students

* duplicate
* edit
* inactive
* cloud persistence

### Assignments

* create
* edit
* class target
* due date
* inactive

### Completion

* accuracy threshold
* speed threshold
* required attempts

### Records

* assignment_id
* old record compatibility

### Analytics

* mistake aggregation
* finger aggregation

---

## 25.1 Browser tests

至少：

```text
360px
768px
1440px
```

確認：

* no horizontal overflow
* keyboard usable
* student assignment usable
* teacher dashboard usable

---

## 26. 資料 migration 特別注意

目前已有 production 資料。

因此：

不可：

```sql
drop table typing_records;
```

不可：

重建正式表而清掉資料。

必須：

```sql
alter table...
```

或建立新 table。

migration SQL 應保存於：

```text
database/
```

---

## 27. Offline

既有學生練習支援離線。

請保留。

如果 assignment API 無法連線：

顯示：

```text
目前無法取得老師指定作業，
仍可使用自由練習。
```

不要讓整個網站不能用。

---

## 28. Error UX

不要顯示：

```text
Failed
undefined
500
fetch error
```

給學生。

改成：

```text
成績已暫存在這台電腦，
網路恢復後會自動補傳。
```

教師端可以看到較詳細錯誤。

---

## 29. AGENT_HANDOFF

每次功能 commit 應一併更新交接紀錄；部署結果可在後續紀錄補上，以 Git log 核對確切 SHA：

必須更新：

```text
AGENT_HANDOFF.md
```

內容：

```text
日期

本次目標

修改

Database migration

測試

Production 驗證

Commit

未完成

下一步
```

---

## 30. Commit 原則

不要一個 commit 完成十個 Phase。

例如：

```text
feat: add cloud student roster

feat: add assignment data model

feat: add student assignment view

feat: add teacher assignment dashboard

feat: add typing mistake analytics
```

每一階段可獨立 rollback。

---

## 31. 優先順序

依下列順序實作：

### P0

穩定現有 production。

### P1

Cloud Students

### P2

Assignments

### P3

Student My Tasks

### P4

Teacher Assignment Dashboard

### P5

Classroom Projection Mode

### P6

Mistake Analytics

### P7

Weak-key Practice

### P8

Cloud Lesson Progress

### P9

Progress Analytics

### P10

Reports

### P11

Achievements / Class Challenge

不要跳著做。

---

## 32. 第一輪 Codex 任務

本次先完成：

## Phase 1 + Phase 2 基礎

也就是：

### A. Cloud Students

完成：

```text
typing_students
```

以及教師端：

* 查看
* 新增
* CSV 匯入
* 編輯
* 停用

---

### B. Assignment Database

完成：

```text
typing_assignments
typing_assignment_targets
```

以及：

```text
typing_records.assignment_id
```

---

### C. Teacher Assignment UI

教師可以：

```text
建立
查看
修改
停用
```

作業。

第一版 assignment：

只需要支援：

```text
speed_test
```

欄位：

```text
title
language
duration
min_accuracy
min_speed
required_attempts
target classes
due date
```

---

### D. Student My Tasks

學生選好：

```text
班級
座號
姓名
```

之後：

看到自己的作業。

點：

```text
開始
```

直接進入指定測速設定。

---

### E. Completion

測驗完成：

typing_records 寫入：

```text
assignment_id
```

並正確計算：

```text
未開始
進行中
已完成
```

---

## 33. 第一輪不要做

第一輪先不要實作：

* 徽章
* Class Challenge
* AI
* WebSocket
* 多教師帳號
* Google Login
* OAuth
* React
* Next.js
* 複雜圖表
* 弱鍵生成
* 完整 lesson cloud progress

這些留後面。

---

## 34. 第一輪完成條件

以下情境必須實際成立：

教師：

1. 登入。
2. 新增 701 學生。
3. 建立：

```text
英文 60 秒
90%
20 WPM
完成 3 次
```

4. 指派 701。

學生：

1. 開網站。
2. 選 701／座號／姓名。
3. 首頁看到作業。
4. 按開始。
5. 自動進入英文 60 秒。
6. 測驗完成。
7. 成績成功寫入 assignment_id。
8. 回首頁看到 1 / 3。

完成三次有效測驗：

```text
3 / 3
✓ 已完成
```

教師：

重新整理後：

仍能看到：

```text
該學生已完成。
```

換另一台電腦登入：

也能看到相同資料。

---

## 35. Regression

完成以上功能後：

以下舊功能全部必須仍可使用：

* 新手教學
* 英文課程
* 注音課程
* 中文課程
* 自由測速
* 自訂文章
* 英文排行榜
* 中文排行榜
* 教師登入
* 成績查詢
* CSV
* JSON backup
* pending record retry
* 手機版

---

## 36. 最後要求

後續收到實作要求時，依第一輪範圍完成程式與驗證，不只交付計畫。本次整合文件不代表已啟動或完成第一輪。

若遇到可以自行合理判斷的細節：

自行做最佳工程判斷，不要停下來反覆詢問。

只有遇到：

* 會刪除 production data
* 需要修改教師密碼
* 需要新的付費服務
* 需要使用者提供秘密金鑰

才停止要求確認。

其他情況請持續完成。

完成後回報：

1. Implemented
2. Database changes
3. Files changed
4. Tests
5. Production validation
6. Commit SHA
7. Remaining roadmap
8. 下一階段建議

並更新：

`AGENT_HANDOFF.md`


## 37. 安全檢查補充規格（2026-09-08）

本節補足第 17、25、26 節，作為進階功能的安全驗收要求；目前尚未實作或驗證通過。檢查詳見 [安全檢查報告](security_best_practices_report.md)。不改既有公開排行榜展示政策，不宣稱正式考試防作弊或個別教師責任追蹤。

### 37.1 學生身分與資源授權（第一輪上線必要條件）

- 班級、座號、姓名、student_id、assignment_id 均不是秘密，也不是登入憑證。不可僅依請求中這些值回傳個人歷程或接受正式作業提交。
- 第一輪採教師發放個人隨機啟用碼的簡易身分確認方案，或實作同等保護的方案；不需 Google Login、多教師帳號或新付費服務。啟用碼至少 128 位元隨機性、僅顯示給教師、資料庫只存雜湊、單次兌換且具到期時間；不得放在 URL、日誌、localStorage 或公開 API。
- 兌換後建立伺服器可驗證、可撤銷的學生 session，綁定不可任意修改的雲端學生 ID。名單與作業的查詢範圍由伺服器推導，不能信任 client 傳入班級。
- 學生被停用、教師重發啟用碼或使用者登出後，對應舊 session 必須失效。失效期間保留待傳紀錄，但不能繞過授權補傳；重新確認同一身分後才能送出。
- 未確認身分者可自由練習與查看現有公開排名；此類成績不得直接視為已認證的作業成果。既有匿名成績 API 與新增作業提交必須區分信任等級。
- 公開班級入口不回傳全班或全校完整姓名名單；教師管理名單與學生選身分流程使用不同權限。

| 資源／操作 | 未登入 | 學生 session | 教師 session |
| --- | --- | --- | --- |
| 既有公開排行榜摘要 | 允許白名單欄位 | 同左 | 同左 |
| 自由練習 | 允許 | 允許 | 允許 |
| 作業與個人進度／歷程 | 拒絕私人資料 | 僅自己與所屬目標作業 | 可管理全站（目前共用教師角色） |
| 正式作業提交 | 拒絕 | 僅自己、有效作業 | 不以教師身分冒充學生提交 |
| 名單、派課修改、報表、班級分析 | 拒絕 | 拒絕 | 允許並留操作紀錄 |

每次 API 呼叫都重新檢查權限，包括批次與匯出；UUID 不代替授權。授權服務失敗時拒絕存取，不能退回無驗證模式。依據：[OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)。

### 37.2 教師與學生 session

- Production 使用 HTTPS 與 HttpOnly、Secure、SameSite 的 host-only Cookie；機密憑證不得放在前端 bundle 或瀏覽器持久儲存。
- 教師保留既有 4 小時絕對到期；學生預設 4 小時絕對到期。登出及撤銷須伺服器失效，不能只刪除 Cookie；驗收須以登出前 Cookie 重播確認拒絕。
- 教師改密碼須再次驗證目前密碼並使舊 session 失效。不得因開發或測試擅改正式密碼；測試使用隔離憑證。
- Cookie 驗證的狀態修改要求可信來源與 CSRF 防護（例如 Origin 白名單及 CSRF token）；GET 不改資料。拒絕未允許來源與缺失必要防護的請求；CORS 不能替代授權。
- 密碼仍用已建立的 salted scrypt 雜湊流程；登入、啟用碼與密碼修改需防暴力嘗試。共用教師密碼只代表管理角色，不提供個別教師識別或責任歸屬。

依據：[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)。

### 37.3 寫入、防重送與資源限制

- 作業 ID、學生 ID、語言、時長、門檻、班級與起訖均在伺服器驗證；速度與正確率依合法計數重新計算並比對。這可排除矛盾資料，但不能證明 client 真實打字。
- 作業測驗開始時發放綁定學生、作業版本與設定的 attempt ID；完成交易原子化寫入且每個 attempt 只計一次。相同 ID、相同內容重送回傳既有成功結果；同 ID 改內容或換學生須拒絕。
- 同一作業的設定修改需版本化或保留已提交紀錄的判定基準，不可無痕改變舊成績。伺服器保留 received_at；client created_at 不得單獨決定是否準時。離線逾期補傳標示待教師處理，不自動當作準時完成。
- 第一輪限制提案：單筆成績 JSON 64 KiB、CSV 1 MiB／2,000 人、JSON 備份 20 MiB／50,000 筆；新增 mistakes 最多 256 組且 count 為非負有界整數。伺服器在處理前限制 body、集合數量與字串長度。
- 限流必須跨 Vercel 執行個體持續有效，不只用 process 記憶體計數。使用現有資料庫或平台能力，不自動啟用付費服務。初始登入策略為來源每 15 分鐘 10 次失敗；啟用碼再以憑證雜湊分桶，避免全站教師帳號被單人永久鎖住。已登入成績提交可先限制每學生每分鐘 20 次；需依班級共用 NAT 情境驗證與調整。
- 限流回 HTTP 429 與 Retry-After；待傳採有上限的指數退避與抖動。400 類無效資料移入可查看的失敗清單，不可堵住後續有效成績；401 等待重新登入，不能丟棄原資料。
- 查詢使用參數化 SQL、欄位／排序白名單、分頁上限與逾時；錯誤回覆不包含 SQL、堆疊、連線字串或 session。

依據：[OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)。以上具體數值是本專案初始設計值，不是 OWASP 強制值。

### 37.4 顯示、匯出與共用電腦

- 作業名稱、說明、姓名、CSV／JSON 匯入、API 回應及本機快取皆視為不可信輸入；優先以 textContent 顯示，不把文字當 HTML 執行。需要模板時依輸出情境編碼，不能依賴只擋 script 標籤。
- CSV 匯出除正確引號處理外，須防試算表公式注入，測試以 =、+、-、@、Tab、CR／LF 開頭的惡意文字；匯入只接受白名單欄位，不能覆寫權限或 session。
- 新增教師名單、完整歷程與報表回應使用 Cache-Control: no-store；不得無期限留在共用裝置。教師登出清除本次載入的敏感快取，不能刪除學生未上傳成績；既有混合 localStorage 必須先分離再遷移。
- 新增學生「結束使用／切換學生」流程，清除 session 與私人畫面；待傳資料以身分隔離保存，不可用下一位學生憑證送出前一人的紀錄。明示未上傳資料仍留本機及可安全清理方式。
- 公開排行榜維持目前授權的必要摘要欄位；遮罩姓名／退出公開排名作為後續產品選項，不在本次默默改動。不得因進階分析擴大公開完整歷史。
- 新增資料保存期限、到期清理與個別資料更正／刪除流程的設定與測試；期限由網站管理者依實際使用需求決定，未設定前不得宣稱自動刪除。只保留聚合錯鍵，不保存完整輸入文章或按鍵流水。
- 部署檢查 CSP、禁止被未授權頁面嵌入、nosniff 等回應設定；策略需相容現有字型與頁面，先驗證再強制，不以關閉防護解決錯誤。

### 37.5 資料庫與部署

- 正式遷移前備份，於隔離資料庫執行重複 migration、舊資料關聯與還原演練。交易與唯一約束處理名單同時匯入；失敗不得留下半套對應。
- 應用程式資料庫角色僅有必要 DML 權限；migration 使用分開的管理權限。Preview／測試不得直接使用 Production 資料或秘密。
- 建立名單變更、作業修改、教師認證異常、匯出與遷移的最小稽核紀錄，含時間、動作、結果、非秘密追蹤 ID；不記密碼、Cookie、啟用碼、完整匯出內容。
- 保留相容舊版部署的回復方案；應用程式回退不能假設 schema 已回退，不可為 rollback 清空 typing_records。

### 37.6 第一輪安全驗收清單（全部待驗證）

- [ ] 未登入／學生 session 呼叫教師名單、寫入、批次與報表 API 全數被拒絕。
- [ ] 學生 A 修改 student_id、班級、assignment_id 仍無法讀寫學生 B 的私人資料；猜中 UUID 也無效。
- [ ] 僅知道班級、姓名與座號不能兌換 session；啟用碼過期、重用與撤銷均被拒絕。
- [ ] 教師／學生登出後重播舊 Cookie、改密碼後重播舊教師 Cookie 均失敗；跨來源修改被拒絕。
- [ ] 偽造門檻、時長、速度、client 日期、未指派作業與停用作業提交被拒絕或依明確規則待處理。
- [ ] 同 attempt 同時重送只增加一次；同 ID 不同內容／不同學生不能覆寫或偽報成功。
- [ ] 冷啟動與多執行個體限流有效，共用教室 IP 的合法操作可用；超大 body 與集合在寫入前被拒絕。
- [ ] 名稱／說明／匯入中的 XSS 只顯示文字，CSV 惡意公式不執行；公開回傳不含額外私人欄位。
- [ ] 斷線、401、429、無效待傳資料與切換學生不會遺失、錯綁或重複成績。
- [ ] 共享電腦登出不再顯示前位使用者私人資料；migration／rollback 保留舊資料並通過還原演練。

未完成對應驗收前，不得將學生私人歷程與正式作業提交宣告為可安全上線；既有自由練習與公開排名持續依原有功能運作。

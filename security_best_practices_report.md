# 開發規格安全檢查報告

日期：2026-09-08。受檢版本：e2d5fee 的 typing-practice-room-codex-spec.md。

結論：進階規格已有秘密保護、教師 session、公開資料最小化與相容遷移原則，但不足以直接驗收學生私人資料與正式派課功能。確認 4 項高、3 項中等優先的**規格缺口**，已補入第 37 節；程式修補與安全測試仍未執行。

範圍：文件設計審查，非正式站滲透測試、完整程式碼稽核或合規認證。不因規格漏寫就推論目前 Production 存在可利用漏洞。現有共用教師密碼與公開排行榜是既定產品行為，未在本次更改。

方法：依 Vanilla JavaScript 前端安全技能與 OWASP 授權、session、REST 指引檢查；技能庫沒有專屬 Vercel Functions／Neon 後端參考，不套用 Express 特有設定。新增的身分流程與限流數值為本專案設計提案，須經實作與教室使用驗證。

## 發現與處理

### SEC-01｜高｜學生本人驗證未定義

- 證據：[開發規格第 34 行](typing-practice-room-codex-spec.md#L34)。原文指出姓名不是驗證，但未提供驗證流程；若僅依身分欄位取資料，可能冒名讀寫個人作業。
- 規格補強：37.1 定義個人啟用碼、可撤銷 session、逐筆授權與權限矩陣。
- 狀態：文件已補充；實作與負向測試待完成，尚不能關閉為已修復漏洞。

### SEC-02｜高｜正式作業成績缺少重送與偽造界線

- 證據：[開發規格第 35 行](typing-practice-room-codex-spec.md#L35)。原文將時間與有效次數規則留待實作；重送、跨學生 ID 或竄改 client 結果可能造成誤判。
- 規格補強：37.3 補 attempt 綁定、交易去重、伺服器計分核對、版本與晚到處理；不宣稱消除 client 作弊。
- 狀態：文件已補充；實作與負向測試待完成，尚不能關閉為已修復漏洞。

### SEC-03｜高｜教師保護未涵蓋 session 撤銷與跨站修改

- 證據：[開發規格第 1362 行](typing-practice-room-codex-spec.md#L1362)。要求 session 但未要求登出後重播拒絕或 CSRF 驗收；後續端點可能只驗 Cookie 是否存在。
- 規格補強：37.2 補伺服器撤銷、到期、可信來源與 CSRF 防護。
- 狀態：文件已補充；實作與負向測試待完成，尚不能關閉為已修復漏洞。

### SEC-04｜高｜Rate limiting 只有標題，缺少可執行要求

- 證據：[開發規格第 1393 行](typing-practice-room-codex-spec.md#L1393)。原文僅列欄位驗證；未規定 serverless 跨實例限流、body 上限與失敗重試，可能遭暴力嘗試或大量寫入。
- 規格補強：37.3 補限流範圍、初始數值、429、請求上限與分頁。
- 狀態：文件已補充；實作與負向測試待完成，尚不能關閉為已修復漏洞。

### SEC-05｜中｜匯入與顯示缺少注入測試

- 證據：[開發規格第 1604 行](typing-practice-room-codex-spec.md#L1604)。原測試未明列新增作業文字 XSS、CSV 公式或權限欄位注入。
- 規格補強：37.4 與 37.6 加入文字顯示、CSV 公式與匯入白名單驗收。
- 狀態：文件已補充；實作與負向測試待完成，尚不能關閉為已修復漏洞。

### SEC-06｜中｜共用電腦快取與私人資料保存不完整

- 證據：[開發規格第 1694 行](typing-practice-room-codex-spec.md#L1694)。離線功能要求未區分不同學生與教師私人快取；可能讓下一位使用者看到資料或錯用待傳身分。
- 規格補強：37.4 定義結束使用、快取分離、待傳歸屬與保存期限。
- 狀態：文件已補充；實作與負向測試待完成，尚不能關閉為已修復漏洞。

### SEC-07｜中｜遷移規格缺少可恢復性驗收

- 證據：[開發規格第 1662 行](typing-practice-room-codex-spec.md#L1662)。禁止刪表與要求相容已具備，但未要求備份還原演練、Preview 隔離及執行權限分離。
- 規格補強：37.5 增加隔離遷移、還原、最小權限與 rollback 驗證。
- 狀態：文件已補充；實作與負向測試待完成，尚不能關閉為已修復漏洞。

## 發布條件與限制

以主規格第 37.6 節逐項負向測試作為第一輪安全驗收：跨學生存取、匿名作業提交、登出重播、CSRF、限流、重送、注入、離線與遷移。結果未完成前，不將新增私人資料能力宣告為安全上線。這不要求停止既有自由練習服務。

未檢查實際 CSP／邊緣設定、正式憑證、資料庫權限、帳務方案或弱點掃描；無法據此斷言這些項目通過或失敗。本次未讀取或變更秘密，未修改程式、資料庫與正式站。

## 參考依據

- 逐筆資源授權與預設拒絕：[OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)。
- Cookie 與 session 生命週期：[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)。
- API 驗證、限制與錯誤處理：[OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)。

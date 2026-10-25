# 使用者提供 ZIP 政見資料覆蓋紀錄

匯入日期：2026-10-25。這份紀錄證明本地來源文字的匯入完整性，**不是政見、數據、執行進度或現行法規的獨立查證**。

## 來源與界線

- 使用者提供檔名：`taichung-machine-site.zip`。
- 實際 ZIP SHA256：`fd4c2ebf572160971de4cb1c4a2def74bb8b8747dfca79936cfc071543942a2b`。
- ZIP 恰有 16 個檔案：15 個編號政策子頁及 `index.html`；已與使用者指定的本地解壓目錄逐檔比對，16/16 位元組一致。
- 讀取子頁 `<title>`、內嵌 JavaScript 中的 JSON `const STAGES`、`const PADS`、`const DETAIL_NOTE`。只用 JSON 解碼與 HTML 文字解析，不執行來源腳本，不使用 `eval`。
- 保留 STAGES 的全部 `n/t/s/note/chips`、PADS 的全部 `o/d/b` 文字，以及全部 DETAIL_NOTE。只移除 HTML 標籤、解碼 HTML entities，`br` 轉換為換行；不改寫原有措辭、數字或限制條件。
- `index.html` 是入口索引，不另建政策主題；動畫路徑、繪圖座標、CSS、圖片與其他非上述政策欄位不屬知識卡匯入範圍。
- **未把來源 HTML、JavaScript、圖像或其他素材複製進公開 repository。** 未推定取得原站版面／素材重製或再授權權利；這份純文字衍生資料的對外使用仍須由權利人確認。沒有把「使用者提供」當作官方背書。
- 來源 URL 由 `https://taichung.sowork.ai/` 加原始檔名組成，保留精確路徑；本工作未驗證公開 URL 可達性，也沒有線上查證提案與統計主張。

## 實際完整覆蓋數量

| 原始檔案 | stages | pads | pad bullets | stage chips | 新增卡數 |
|---|---:|---:|---:|---:|---:|
| 01-exhibition-168.html | 6 | 6 | 16 | 26 | 7 |
| 02-robot-city.html | 6 | 5 | 18 | 22 | 6 |
| 03-parenting.html | 6 | 5 | 17 | 29 | 6 |
| 04-senior-care.html | 6 | 6 | 23 | 23 | 7 |
| 05-culture-starlight.html | 6 | 5 | 22 | 25 | 6 |
| 06-smart-agriculture.html | 6 | 5 | 21 | 21 | 6 |
| 07-airport-gateway.html | 6 | 4 | 16 | 19 | 5 |
| 08-smart-transport.html | 6 | 5 | 21 | 22 | 6 |
| 09-city-safety.html | 6 | 4 | 15 | 21 | 5 |
| 10-twenty-minute-city.html | 6 | 5 | 12 | 20 | 6 |
| 11-new-residents.html | 6 | 4 | 13 | 24 | 5 |
| 12-indigenous.html | 6 | 5 | 19 | 21 | 6 |
| 13-animal-welfare.html | 6 | 3 | 14 | 20 | 4 |
| 14-hakka.html | 6 | 5 | 23 | 22 | 6 |
| 15-education.html | 6 | 6 | 25 | 23 | 7 |
| **總計** | **90** | **73** | **275** | **338** | **88** |

- 共 15 主題；每主題 1 張 overview、每 pad 1 張細項卡：新增 15 + 73 = **88 張**。
- 原有 **12 張卡的文字、數值、欄位順序與各物件原始 JSON 位元組不變**，只在陣列尾端附加；最終 **100 張**，ID 全部唯一。
- 原始 12 張完整檔案 SHA256：`4076c5acfc557cecb52e69cff9c168e6c962ee1dd6c674bf8638b67a2892995c`。測試以原始前綴雜湊驗證保留，匯入器遇到原始卡遭改動會拒絕覆寫。
- 45 個非空 stage note、15 個 DETAIL_NOTE 全數保留。空 note 也保留於 catalog 及 overview details。
- overview details 依來源順序保留每 stage 的編號、標題、敘述、備註及所有 chips；pad details 依來源順序保留描述、每一個 bullet 及主題限制說明，**全文不截斷**。
- 摘要採來源短摘錄，本次最長 75 字；完整 bullet 最長 130 字，全部保留於 details。每張新增卡有 3 個來源字串摘錄的 mechanismSteps，不產生新的資格、日期、金額或成果。
- aliases 採具體 chip／pad／主題標題，排除 2 字以下通用詞；不改動原有 12 張卡的 aliases。

## 可供整合的固定合約

- `data/policy-catalog.json` 與 `public/policy-catalog.json` 完全一致。
- Catalog：`{version:1, source, topics:[...]}`；`source.verification` 為 `supplied-not-independently-verified`。
- topic id 為原始檔名去除 `NN-` 與 `.html`；`topic.recordIds` 的順序固定為 overview，再按來源 pad 順序。
- Overview ID：`archive-TOPICID-overview`；pad ID：`archive-TOPICID-pad-N`，N 從 1 開始。
- `data/knowledge.json` 與 `public/knowledge.json` 完全一致。
- 全部新增卡使用 `status:'proposed'`、`provenance:'user-provided-archive'`、`sourceDate:null`、`verifiedAt:'2026-10-25'`。**verifiedAt 在此只代表本地匯入／完整性核對日期，不代表內容獨立查證日期。**
- 每張新增卡摘要明示「使用者提供的政見提案；未獨立查證，不代表已施行。」來源所述案例、歷史數字、未來日期、示意動畫與成果保留原文，但不能因匯入而提升為已驗證事實。

## 重現與測試

只依賴 Python 3 標準函式庫與專案既有 Node 測試器；不下載第三方套件，不需要網路。

```sh
python3 scripts/import-policy-zip.py /explicit/path/to/taichung-machine-site.zip
POLICY_SOURCE_ZIP=/explicit/path/to/taichung-machine-site.zip node --test tests/policy-source.test.cjs
POLICY_SOURCE_ZIP=/explicit/path/to/taichung-machine-site.zip npm test
```

CLI 必須明確提供 ZIP 路徑，程式沒有使用者機器內部來源路徑硬編碼；可用 `--root /explicit/output/repository` 指定測試輸出根目錄，該根目錄必須有原始 12 張卡的 `data/knowledge.json`。重複匯入位元組一致，不重複附加卡片。CLI 輸出實算：

```json
{"topics":15,"stages":90,"pads":73,"bullets":275,"chips":338,"addedRecords":88,"totalRecords":100}
```

### 實際 TDD 記錄

| 垂直切片 | RED 實際結果 | GREEN 實際結果 |
|---|---|---|
| 缺少完整來源 catalog | 1 test：0 pass / 1 fail，`missing full-source policy catalog` | 1/1 pass |
| 原 12 卡後新增全部來源卡 | 2 tests：1 pass / 1 fail，`12 !== 100` | 2/2 pass |
| 嚴格 JSON，拒絕 NaN／Infinity／重複 key／JS expressions | 19 tests：18 pass / 1 fail，接受 `[NaN]` | 19/19 pass |
| 明確 ZIP CLI、實算統計與可重現輸出 | 20 tests：19 pass / 1 fail，缺少完整統計輸出 | **20/20 pass，0 skipped** |

15 個逐頁測試使用獨立直接 ZIP 解碼得到的全文 SHA256 指紋，涵蓋每個欄位、chip、bullet、備註，不只抽查關鍵字。另測原 12 卡位元組、全部新增卡來源對應、唯一 ID、提案標記、data/public 一致、嚴格 JSON、重複匯入、錯誤 ZIP hash 不得寫檔、原卡遭改動不得寫檔，以及不得複製原始 HTML／素材。

未提供 `POLICY_SOURCE_ZIP` 時，正常公開 checkout 可跑 19 個離線測試，另 1 個真實私有 ZIP CLI 測試明確 skip；本次驗收有提供實際 ZIP，20 個全數執行。

整合測試首次觀測：87 tests，86 pass / 1 fail。唯一失敗為其他工作者範圍的 `tests/pk-server.test.cjs`：`missing GET heartbeat after 20 seconds marks disconnected and aborts without phantom winner`，斷線後狀態實際 `playing`、預期 `waiting`。未修改該檔或後端。其他工作者持續更新後，最終重新執行上述帶有實際 ZIP 的 `npm test`：**93/93 pass，0 fail、0 skipped**。本任務完整性測試維持 **20/20 pass**；`git diff --check`、Python AST 語法檢查、文件表格總計檢查均通過。整合測試數量因並行工作者新增測試而改變，這不是本任務額外修改後端的聲明。

## 產物雜湊與交付狀態

- catalog（data/public）：`e6c45abfa07d1990ae570ce6d4116a72587673bc4755f092d4084780f7f81f06`。
- knowledge（data/public）：`659c179de0eb589f7ecf496cbbca10e49f2792eae917c3cb8b304202a2475bc2`。
- 僅變更本任務指定的 7 個路徑；沒有 commit、push 或 deploy。其他工作者的 UI、世界與 PK 後端修改不屬本紀錄的完成聲明。

# 真實雙人政策 PK API

本服務僅使用 Node.js 內建模組；目標執行環境為 **Node 22.22.2**。無帳號、無資料庫、無分析追蹤、無外部模型或伺服器供應商依賴。不會建立 AI／假對手。只有使用者主動開房、加入或配對後，前端才同步暱稱、選項與裝飾性座標；沒有上傳自由提問的 API。

## 啟動與嵌入

```sh
HOST=127.0.0.1 PORT=8788 node server/pk-server.cjs
```

CLI 預設只提供 API，不提供首頁或靜態檔案。成功綁定後 stdout 僅輸出一行 startup health JSON：`{"ok":true,"mode":"live","port":8788}`（port 為實際綁定值）；不輸出 IP、房間、token 或請求日誌。模組嵌入模式保持安靜，由呼叫端決定如何顯示啟動結果。公開部署請由同源反向代理提供前端及 `/api/pk/*`，並指定正式來源：

```sh
HOST=127.0.0.1 PORT=8788 HOST_ORIGIN=https://city.example node server/pk-server.cjs
```

```js
const { createPkServer, buildQuestionBank } = require('./server/pk-server.cjs');
const server = createPkServer({
  hostOrigin: 'http://127.0.0.1:8788', // 可省略；必須是無尾斜線的完整 HTTP(S) origin
  // questionBank,                      // 測試可注入；格式見下方
  // now: Date.now,                     // 回傳 epoch 毫秒
  roomTtlMs: 30 * 60 * 1000,
  roundMs: 25000,
  resultMs: 3500,
  maxRooms: 100,
  trustProxy: false,
  // staticDir: require('node:path').resolve('public'), // 僅本機 E2E 選用
});
server.listen(8788, '127.0.0.1');
```

`createPkServer(options)` 回傳**尚未 listen 的 `http.Server`**。所有時長須為正安全整數，`maxRooms` 為 1–100。沒有注入 `questionBank` 時，固定載入相對伺服器檔案的 `../public/policy-catalog.json`；缺檔、無效 JSON、無效來源或題量不足均直接拋錯，CLI 以非零碼結束，絕不替換假題。CLI 讀取 `HOST`、`PORT`、`HOST_ORIGIN`，僅 `TRUST_PROXY=1` 啟用代理信任；不從環境啟用 staticDir。

## HTTP 規則

- POST 必須使用 `Content-Type: application/json`（可帶 charset），且內容為 JSON object。最大 **4096 bytes**，不是 4096 字元；超限 `413`、不支援媒體類型 `415`、無效 JSON／型別 `400`。
- 房號是伺服器產生的 6 碼大寫十六進位字串；伺服器不修正、trim 或轉換傳入房號。
- 開房、加入、配對以外的房間 API 均需 `Authorization: Bearer TOKEN`。Token 是 32 隨機 bytes 的 64 碼 hex，只在加入回應交付本人，不能放在網址、公開 players、持久化儲存或日誌。
- API query 只接受 `code`；網址 `token` 等其他欄位直接拒絕。靜態頁允許 `?room=房號` 邀請連結，不允許 token。
- POST 若有 `Origin`，必須完全等於設定的 `hostOrigin`；未設定則與目前請求的 HTTP(S) scheme／Host 比對。無 Origin 的本機／伺服器呼叫可用。不存在跨來源 CORS 或預檢授權。
- 全部 JSON 回應 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff`；服務不設定 Cookie，不輸出 body、token、IP 或存取日誌。
- 所有成功 API 回應為 HTTP `200`。一般錯誤為 `{ "error": "machine_code", "message": "safe description" }`；內部錯誤不暴露 stack、檔案路徑或提交內容。

## 端點及回應包裝（前端整合必讀）

| 方法／路徑 | JSON body 或 query | 成功回應 |
|---|---|---|
| GET `/api/pk/health` | 無 | `{ok:true,mode:"live",rooms:number,players:number}` |
| POST `/api/pk/create` | `{nickname?}` | `{code,token,playerId,state}` |
| POST `/api/pk/join` | `{code,nickname?}` | `{code,token,playerId,state}` |
| POST `/api/pk/match` | `{nickname?}` | `{code,token,playerId,state}` |
| GET `/api/pk/state?code=CODE` | Bearer header | **State 本體**，不是 `{state}` |
| POST `/api/pk/ready` | `{code}` | `{state}` |
| POST `/api/pk/answer` | `{code,roundId,choiceIndex}` | `{state}` |
| POST `/api/pk/position` | `{code,x,y,zoneId}` | `{state}` |
| POST `/api/pk/rematch` | `{code}` | `{state}` |
| POST `/api/pk/leave` | `{code}` | `{left:true}` |

`health.rooms` 為當下未過期的真實房間數，`health.players` 為這些房間保留的真人玩家席次總數（包括尚未主動離房的離線玩家）；沒有預設／填充人數。配對只尋找經 `/match` 建立、仍 waiting、有一位連線真人的房間；邀請房不會被陌生快速配對填入。無可用房間就建立單人 waiting 房，不假裝找到對手。每房最多兩席，第三人加入 `409`。

暱稱預設 `訪客`，最多 12 個 Unicode code points；空字串也使用預設值。拒絕空白暱稱、控制字元、Email 及電話樣式（也檢查 NFKC 全形數字）。暱稱是純文字，前端必須以 `textContent` 等方式呈現，不得用 `innerHTML` 解譯。

## State 固定結構

```js
{
  code: 'A1B2C3',
  status: 'waiting', // waiting | playing | round-result | finished
  you: 'your-player-id',
  players: [{
    id: 'player-id', nickname: '訪客', score: 0,
    ready: false, connected: true,
    x: 1500, y: 900, zoneId: 'living'
  }],
  round: null, // 或下方結構
  winnerIds: [],
  serverTime: 1760000000000, // epoch 毫秒；以實際伺服器時間為準
  expiresAt: 1760001800000
}
```

```js
// playing / round-result / finished 可出現的 round
{
  id: 'opaque-round-id',
  index: 1, // 1-based，依序 1..5
  total: 5,
  question: '依提供文件，哪一項屬於「主題標題」？',
  choices: ['選項 A', '選項 B', '選項 C', '選項 D'],
  topicId: 'topic-id', sourceTitle: '主題標題', sourceUrl: 'https://source.example/proposal',
  deadline: 1760000025000,
  answered: ['player-id'],
  result: null // 揭曉前永遠為 null
}
```

```js
// 揭曉後的 round.result
{
  correctIndex: 2, // 0-based 選項索引；此值僅為格式示例
  explanation: '原始第一項 detail（依提供提案文件整理，非已實施政策。）',
  sourceUrl: 'https://source.example/proposal', sourceTitle: '主題標題',
  points: [{playerId: 'player-id', delta: 150}, {playerId: 'peer-id', delta: 0}],
  nextAt: 1760000028500
}
```

State／players 永不含 token。未雙方作答且尚未截止時，無 `correctIndex`、`explanation`，也不提前增加分數，避免從分數反推答案；`answered` 只公開已提交者 ID，不公開對方選項或時間。

## 一局生命週期與計分

1. 建房是 waiting。兩位真人各按 `/ready` 且都 connected 後開始 5 題，每題優先選不同主題。
2. 每題預設 25 秒，`choiceIndex` 是 0–3 整數。未指定的客戶端 score、delta、時間戳、正解等欄位不參與計分，也不覆寫伺服器狀態。
3. 雙方提交或截止後轉 `round-result`。答對得 `100 + clamp(floor(50 * (deadline - serverReceivedAt) / roundMs), 0, 50)`；答錯、未作答為 0。分數只代表文件理解，不評斷政策立場、偏好或實施成效。
4. `round-result` 預設 3500ms；請求觸發 lazy advancement，`nextAt` 到期才開下一題。逾時揭曉以 deadline 作為結果起點；若首次輪詢已超過整段結果期間，可直接看到下一題，下一題從此次伺服器時間開始計時。
5. 第五題結果期間結束為 finished。最高總分者列入 `winnerIds`，平手兩人皆列入。此時 ready 重設 false，保留最後結果。
6. finished 時兩人各按 `/rematch`；第一人按只表示意願，不清分。第二人確認且雙方連線才重新開始、歸零分數及 winners，並發新 roundId。

同人重複提交、過期 roundId、截止後提交及非 playing 提交為 `409`；無效選項為 `400`；錯 token 為 `401`。`/ready` 只接受 waiting，`/rematch` 只接受 finished。

## 連線、座標、保留時間與容量

- **只有成功 GET state 是 heartbeat**；開房／加入時初始化 lastSeen。20 秒沒有 heartbeat 後 `connected=false`。position、answer、ready 不會延長 heartbeat。
- playing 或 round-result 有任一人斷線，立刻在下次請求觀察時中止回 waiting，清空 round、ready、score、winners，不產生幽靈勝利。斷線者仍保留席次，原 token 可 GET 重連，再由雙方準備。
- `/leave` 立即刪除本人席次、撤銷 token；剩一人則回 waiting、清分且不判勝，無人則刪房。
- 座標僅為視覺同步，**不構成移動反作弊或得分權限**。x、y 須為有限數字，分別 `12..2988`、`12..1788`；zoneId 只能是 `living`、`innovation`、`culture`、`nature`、`connection`。
- 房間固定 TTL 預設建立後 30 分鐘，不因輪詢或 rematch 延長。到期移除房間及 token。容量預設且最高 100 房。
- 房間清理、斷線檢查、回合推進皆由請求惰性觸發，沒有背景持續工作。沒有請求時記憶體仍受硬上限約束，下一次請求會清掉過期資料；程序重啟全部房間消失。
- 限流固定時間窗：**每個 IP 每 60 秒 600 次請求**，含 health、輪詢、座標、靜態檔及失敗 API；同 IP 兩人每人 GET 900ms／position 1800ms 可正常使用。超限 `429` 並附 `Retry-After`。Rate bucket 最多 2048 個、60 秒到期，後續請求清理。
- `trustProxy:false` 忽略 `X-Forwarded-For`；只有明確 `true` 才使用第一個合法 IP。只能在代理確實覆寫轉送標頭、且後端不可被公網繞過時啟用。IP 僅存在有期限的限流記憶體，不寫入日誌。

## 題庫來源與審核

`buildQuestionBank(catalog)` 接受 `{topics:[{id,title,sourceUrl,pads:[{title,description,details:[]}]}]}`，每個 pad 產生一題、每個主題都涵蓋，總共至少 15 題。題目固定詢問「依提供文件，哪一項屬於『主題』？」；正解是該主題 pad 的標題，三個唯一干擾選項取自其他主題 pad 標題，排除同主題所有標題以避免多解。選項及答案索引用 cryptographic randomness 洗牌。解釋逐字保留 pad 的第一項 detail，再明示「依提供提案文件整理，非已實施政策」。來源標題／網址直接取自該主題。資料不足或無法構成不歧義四選一時拒絕建庫。

注入測試用 questionBank 最少 5 題，每題格式：

```js
{ question, choices: ['A','B','C','D'], correctIndex: 0,
  explanation, topicId, sourceTitle, sourceUrl }
```

注入資料亦經驗證並複製，不能靠後續修改原陣列改變遊戲正解。只有預設建庫強制至少 15 題；測試可注入最少 5 題。

本次實際 `public/policy-catalog.json` 審核：**15 主題、73 pads、73 題、15/15 主題覆蓋、0 漏主題**；逐題驗證正解 pad、第一項 detail 與 sourceUrl，沒有把提案聲稱為已實施。

## 僅本機 E2E 的靜態 allowlist

`staticDir` 可選，僅接受 GET／HEAD，明確允許以下檔案，`/` 映射 index.html：

```text
index.html app.js engine.js quest-core.js quest.js taichung-elements.js pk.js
style.css quest.css world.css pk.css
policy-catalog.json knowledge.json icon.svg robots.txt
```

不提供目錄列出，不自動開放其他 public 檔案；不提供 dotfiles、tests、server、任意 JSON。拒絕 traversal、百分比編碼路徑、反斜線、雙斜線及 symbolic links。缺檔回 `404`。CLI 本身不啟用此模式。

## 驗證證據

```sh
npx --yes --package=node@22.22.2 node --test tests/pk-server.test.cjs
```

本次執行：**28 tests，28 pass，0 fail，0 skipped**。功能逐輪先觀察 RED，再補實作至 GREEN；另外追加已實作 rate bucket 容量及實際 catalog 回歸覆蓋。測試使用真實 `127.0.0.1` HTTP ephemeral port、可注入伺服器時鐘及本地來源 fixture；另起真正 CLI 子程序驗證 HOST／PORT、API-only 與無存取日誌。覆蓋完整五題、重賽、timeout、斷線、不洩漏正解／token、偽造分數／時間、過期與重複答案、Origin、JSON／byte cap、TTL、限流與 bucket 上限、靜態 allowlist 和實際來源題庫。

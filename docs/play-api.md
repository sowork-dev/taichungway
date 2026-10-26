# 即時遊戲 API（Node HTTP + ws 8.22.0）

新服務獨立於舊 PK API；不代理任何 `/api/pk/*` 路徑。權威物理、碰撞、拾取、送達、奪包、計分與回合狀態皆由 `public/arena-core.js` 決定。沒有機器對手、公開管理端點、改分或瞬移端點。

## 啟動與模組介面

目標環境：Node 22.22.2，依賴使用專案已鎖定的 `ws@8.22.0`。

```sh
HOST=127.0.0.1 PORT=8790 HOST_ORIGIN=https://your-game.example TRUST_PROXY=false node server/play-server.cjs
```

CLI 預設 `HOST=127.0.0.1`、`PORT=8790`，**只提供 API／WebSocket**，不提供網站目錄。`HOST_ORIGIN` 請設定成瀏覽器實際載入網站的完整 origin（協定、主機、必要時連接埠；不含尾斜線／路徑）。`TRUST_PROXY=true` 僅適用於前方是明確可信的本機 reverse proxy。啟動只印連接埠，不記錄 request、token 或 IP。SIGINT／SIGTERM 清理連線並退出。

```js
const { createPlayServer } = require('./server/play-server.cjs');
const server = createPlayServer({
  hostOrigin: 'http://127.0.0.1:8790',
  // staticDir: require('node:path').resolve('public'), // 僅本機整合／E2E 明確啟用
  now: Date.now,
  roundMs: 60000,
  countdownMs: 2000,
  roomTtlMs: 900000,
  maxRooms: 50,
  autoTick: true,
  trustProxy: false
});
server.listen(8790, '127.0.0.1');
// await server.closePlay(); // 冪等，關閉 HTTP、WS 與計時器
```

回傳原生 `http.Server`，另外提供 `tickPlay()` 供注入 clock 後手動推進。正常執行每 50ms 模擬一次，每個房間最多每 100ms 廣播；不以瀏覽器傳來的位置決定人物座標。`server.playRooms` 是 **僅供程序內測試** 的 Map，不會透過 HTTP 暴露。每個 room 的 `game` 是真實核心模型。

## HTTP

所有 JSON 回應都有 `Content-Type: application/json; charset=utf-8`、`Cache-Control: no-store`、`X-Content-Type-Options: nosniff`；不提供 CORS。

### `GET /api/play/health`

```json
{"ok":true,"mode":"realtime","rooms":0,"players":0}
```

`rooms` 是仍存在、受 TTL 限制的房間數（可能含尚待驗證的保留房間）；`players` 僅計算已完成 hello 且 WebSocket 仍為 OPEN 的真人，不計 HTTP 保留名額或離線玩家。

### `GET /api/play/lobby`

```json
{"rooms":[{"code":"A1B2C3","players":1,"phase":"practice","joinable":true}],"online":1}
```

只列出有已驗證連線的實際房間。`players` 與 `online` 只算實際連線。只有 `practice`、一位實際玩家、且含保留席在內仍有空位時 `joinable` 為 true。公開大廳不含任何 token 或 playerId。

### `POST /api/play/enter`

只接受 `Content-Type: application/json`，body 上限 **1024 bytes**。只能送 `{}` 或 `{"code":"A1B2C3"}`。房號必須是六位大寫十六進位，不會自動修正大小寫。

```json
{"code":"A1B2C3","token":"64位隨機小寫十六進位","playerId":"伺服器產生的識別碼","state":null}
```

- 無 code：優先加入第一個有一名已驗證真人且仍有空位的練習房；否則建立新房。
- 指定 code：不存在回 404，含保留席已滿回 409；不會偷偷建立指定房號。
- 每房最多兩席（包含保留）。HTTP 只保留席位，**不呼叫核心 addPlayer**；必須在五秒內完成 WebSocket hello 才成為核心玩家。
- `state` 在該房沒有已驗證真人時為 null；否則是當前核心 snapshot。此時新保留者仍不會出現在 players 裡。
- token 是 32 bytes 加密安全亂數，只在此次 HTTP enter 回應交付；不寫 URL、公開大廳、廣播或 log。
- 其他狀態：400 格式錯誤、403 origin 不符、413 body 過大、415 非 JSON、429 請求過量、503 房間容量已滿。

約每來源 IP 每 60 秒最多 120 次 HTTP 請求（也計算 WS upgrade）；limiter Map 最多 1024 個來源，拒絕新來源而非無限擴張。預設忽略 `X-Forwarded-For`。只有 `trustProxy:true` **且實際 TCP peer 為 loopback**，才採用合法的最右端 forwarded IP，避免信任攻擊者自行加在最左端的值；多層代理應先在受信任邊界正規化此 header。

POST 與 WS upgrade 若帶 Origin，必須精確符合 `hostOrigin`；未設定時比對直接 HTTP origin。沒有 Origin 的非瀏覽器工具仍可連線，但仍須有隨機 token。所有未知路徑／錯誤 HTTP method 回 404。

## WebSocket

路徑必須完全是 `/ws/play`，不接受尾斜線或 query string。Origin 在 upgrade **之前**驗證。最多 100 條 WS 連線，含尚未驗證者；`perMessageDeflate:false`、`maxPayload:2048`。

### 1. Hello

連線後五秒內第一則文字訊息：

```json
{"type":"hello","code":"A1B2C3","token":"HTTP enter 回應的 token"}
```

伺服器成功驗證後回傳：

```json
{"type":"state","you":"你的 playerId","code":"A1B2C3","state":{"phase":"practice","players":[]}}
```

上例 `state` 只示意結構；真實 hello snapshot 一定包含已加入的本人。之後每 100ms 用相同 wrapper 廣播，每個 socket 的 `you` 不同，而同次權威 `state` 相同。

Snapshot 完整內容以 `ArenaCore.snapshot(game)` 為準，包括 `width`、`height`、`now`、`remainingMs`、`endsAt`、`phaseUntil`、`phase`、`winnerIds`、`roundId`、`mode`（solo／pvp）、含位置／carry／score 的 players、含 kind／active 的 pickups、targets、landmarks 與最多 40 筆 events。server 不再另外實作物理或計分。

同 token 新連線會取代舊連線，舊連線以 1008 關閉；不重複 addPlayer，也不因舊 socket 的 close 清掉新 socket。每 token 的訊息速率預算不會因替換 socket 歸零。開始離房或關閉連線時立即撤銷 token 與核心玩家，不等待傳輸層 close 握手；剩餘真人重回練習，不產生幽靈勝利，沒有席位時刪除房間。關閉握手最多額外500ms即強制終止。斷線後需重新 enter。

### 2. 手動輸入

```json
{"type":"input","x":1,"y":0,"dash":false,"tag":false}
```

x／y 必須為有限數，介於 -1 與 1，方向正規化由核心處理。dash／tag 為可省略的 boolean。socket 身分決定操控玩家；任何自訂 playerId、score、position 或額外欄位均拒絕。手動軸超過 500ms 未更新自動歸零。dash／tag 合併為一次性旗標，下個模擬 tick 消耗，不會持續觸發。

### 3. 點地移動（適用手機畫布）

```json
{"type":"navigate","x":650,"y":600}
```

x／y 是有限世界座標，限於世界範圍。伺服器從**本人當前真實座標**呼叫 `A.findPath`，沿路每 tick 以一般 `A.setInput` 走路，讓核心處理速度、碰撞與拾取；不直接設定人物 x／y。到終點九單位內停止；中間轉折點使用更小容差，避免抄近路穿越建物。

合法但被建物阻擋／不可達的目標會停止導航，不移動、不切斷連線；非法／越界／非數值／額外欄位關閉 1008。只在 `practice` 或 `playing` 接受新導航。有效導航不受 500ms **手動軸**逾時影響。任何 input（包含 input 0,0）立即取消導航；頁面 blur／hidden 應送 input 0,0。回合 roundId 改變、倒數重置、斷線或回到練習時清除舊導航。

### 4. 導航途中動作

```json
{"type":"action","action":"dash"}
```

action 只能為 `dash` 或 `tag`。合併進下個 tick 的待消耗旗標，不取消現有路徑。能否實際衝刺／奪包、冷卻與命中皆由核心決定；例如 solo 空揮 tag 不會產生奪包成功或冷卻。

### 5. 其他訊息

```json
{"type":"rematch"}
{"type":"leave"}
{"type":"ping"}
```

rematch 交由核心處理雙方 readiness；leave 以 1000 關閉並清理本人；ping 回 `{"type":"pong","now":伺服器毫秒時間}`。除列出的欄位外不接受任意資料。

格式錯誤 JSON、binary、未知訊息、驗證失敗或每 token 每秒超過 60 則訊息，以 1008 關閉；大於 2048 bytes 的 frame 由 ws 以 1009 關閉。WebSocket protocol ping 每十秒發送一次，距上次 pong 達二十秒便 terminate；應用層 JSON ping 不能代替 protocol pong。未 hello 與 HTTP 保留席五秒清理；房間預設建立後十五分鐘絕對 TTL，不因 ping 無限延長。每條連線 outbound bufferedAmount 超過64KiB時立即撤銷身分並 terminate，不因主動 pong 而無限堆積狀態；最多存在上限加一筆狀態的傳輸佇列。

## 本機靜態資源界線

只有呼叫 `createPlayServer({staticDir:...})` 才啟用。`/` 固定提供 `index.html`。不是通用目錄伺服器；只允許以下平面檔名：

`index.html app.js engine.js knowledge.json policy-catalog.json taichung-elements.js style.css world.css icon.svg robots.txt pk.js pk.css quest.js quest.css quest-core.js arena-core.js play.js play.css policies.html`

不存在檔案、點檔、內部／測試／node_modules 路徑、編碼 traversal、額外任意檔名與 symlink 均 404；不跟隨 allowlist 名稱指向的符號連結。CLI 不因設定環境變數而開啟靜態目錄。

## 驗證

```sh
node --test tests/play-server.test.cjs
```

測試使用真實本機 HTTP 與 ws 客戶端、可注入 clock；含真人匹配／預約、公開資訊不洩 token、相同 peer snapshot、正常移動／導航繞障礙、一次性動作、同時拾取唯一性與一次送達、偽造拒絕、重賽、斷線、Origin／body／訊息／frame 限制、protocol heartbeat、TTL、100 客戶端上限、靜態 allowlist、CLI 與獨立程序 closePlay 乾淨退出。拾取與送達測試透過公開 navigate 真實走路，沒有測試專用 HTTP 控制或座標瞬移。

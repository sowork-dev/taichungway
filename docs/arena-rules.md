# 臺中同圖搬運對戰規則（ArenaCore）

這是**遊戲模擬**：拾取、送達、攔截與分數只代表本局操作表現，不代表政治支持度、民意、真實政策執行量或政策成效。地標與服務類型是遊戲場景／查詢入口，不是虛構的施政成果。

## 載入與固定 API

無套件依賴、無網路、無秘密資訊、無系統時鐘與亂數呼叫。瀏覽器載入 `public/arena-core.js` 後使用 `window.ArenaCore`；Node 使用 `require('./public/arena-core.js')`。

```js
const g = ArenaCore.createGame({ now: 0, roundMs: 60000, countdownMs: 2000 });
ArenaCore.addPlayer(g, 'player-a');
ArenaCore.setInput(g, 'player-a', { x: 1, y: 0, dash: false, tag: false });
ArenaCore.step(g, 50);
const view = ArenaCore.snapshot(g);
```

- `createGame({now=0,roundMs=60000,countdownMs=2000}={})`：建立 `practice`。有限數值時鐘、正數回合長度、非負倒數長度；不合法設定拋出 `RangeError`。
- `addPlayer(g,id,now=g.now)`／`removePlayer(g,id,now=g.now)`／`rematch(g,id,now=g.now)`：成功回傳 `true`，不適用／不合法回傳 `false`。
- `setInput(g,id,{x,y,dash:false,tag:false})`：成功回傳 `true`；未知玩家或非物件回傳 `false`。只接受方向與布林動作，不接受客戶端座標、分數、攜帶物或勝負。待處理的 dash／tag 與後續輸入以 logical OR 累積到下一次 step 消耗，伺服器自動導航刷新方向不會清掉剛收到的動作。
- `step(g,now)`：回傳同一 `g`。時間單位為毫秒；反向、非有限、非數值時間不改變狀態。同時間不重複更新；零秒倒數到期的狀態轉換除外。
- `snapshot(g)`：可修改而不影響核心的公開深複本，含 `width,height,phase,now,roundId,phaseUntil,endsAt,remainingMs,mode,players,pickups,targets,landmarks,events,winnerIds`。`mode` 為 `solo|pvp`；非比賽中 `remainingMs=0`。
- `canStand(x,y)`：半徑 14 的角色是否能站立。
- `findPath(x,y,tx,ty)`：回傳 `{x,y}[]`，包含精確起終點；無合法路徑或端點不合法回傳 `[]`；同點回傳一點。直達安全時直接連線，其餘使用 20 格、四鄰 BFS 與經碰撞驗證的端點接線。
- `movePlayer(p,x,y,dt,speed=230)`：選用的本地預測；`dt` 單位為秒且上限 0.05，速度上限 360。只更新 `p.x/y` 並回傳 `p`，不更新分數、動作計時或拾取狀態。

公開常數：`WORLD_WIDTH=1200`、`WORLD_HEIGHT=1100`、`SPEED=230`、`DASH_SPEED=360`、`LANDMARKS`、`TARGETS`、`PICKUP_SLOTS`。地標、目標、拾取點依委派的固定幾何；常數陣列與列物件凍結。

## 狀態與公平性

- `g` 公開欄位：`phase,now,roundId,phaseUntil,endsAt,players,pickups,events,winnerIds`。
- 玩家欄位：`id,team,x,y,score,carry,dashUntil,dashReadyAt,tagReadyAt,immuneUntil,stunUntil,ready`。輸入、設定與事件序號存在模組內部 WeakMap，未放入快照。
- 第一人：`practice`，team 0 出生 `(420,600)`。真的能走、撿、送，沒有回合截止或勝負。
- 第二人：team 1 出生 `(780,600)`；兩人同時歸零、清空攜帶、計時器、ready 與輸入，重設全部拾取點，`roundId+1`，進入預設 2 秒 `countdown`。
- 倒數時不能走、撿、送、衝刺或攔截；一次性動作丟棄。倒數到期發出一次 `start`，開啟 60 秒 `playing`；轉換當幀不補走倒數期間路程。`endsAt` 依原定倒數到期點加回合長度，延遲幀不延長比賽。
- 截止時先結算再處理動作；最高分 ID 進 `winnerIds`，同分兩人都列入。`finished` 不再移動、得分、拾取或攔截，僅發出一次 `finish`。跨越整段倒數與回合的延遲幀直接依序 start／finish。
- 完賽後兩人各呼叫 `rematch` 表示 ready；一人 ready 仍停留完賽，重複 ready 回傳 false 且不推進時間。兩人都 ready 才完整重設、新 `roundId`、新倒數。
- 斷線直接回 `practice`，重設剩餘玩家的分數、攜帶、位置、所有計時器、ready、輸入、拾取點與勝負。保留剩餘 ID／team；下一位填補空缺 team。移除不是模擬 tick，不會因延遲的斷線時間製造幽靈勝利。
- 重複 ID、第三人、未知玩家、錯誤時間的失敗請求不先推進時鐘，原子拒絕。核心不進行網路身分驗證；連線層必須把合法 socket 綁到自己的玩家 ID，不能照單全收任意訊息／反序列化快照回核心。

## 即時操作

- 有限方向向量上限長度 1，保留小於 1 的類比力度；NaN／Infinity 等非法方向停下。大數值也安全正規化，不會放大移動距離。
- 每幀移動最多 50ms；圓形半徑 14 與六個非裝飾地標實心矩形碰撞，逐軸滑動，細分位移並驗證掃掠線段，不能穿牆或越界。高美濕地為可穿越裝飾。
- 點地自動走路應取得 `findPath` 後逐點發一般方向輸入，**不可直接寫玩家座標或瞬移**。起點包含在路徑內，UI 可從下一點開始。
- `dash`：一次請求一次消耗；成功時速度 360、持續 300ms、從觸發時計冷卻 1200ms。`now < dashUntil` 使用衝刺速度；`now >= dashReadyAt` 才可再次觸發。冷卻／暈眩／倒數期間的按鍵不延遲排到之後發動。
- 同幀順序：狀態／截止轉換 → 拾取點重生 → 全員移動與衝刺 → 依玩家陣列順序攔截 → 依玩家陣列順序拾取與送達。時間依外部 tick；移動受 50ms 上限，計時器不受上限拖延。

## 拾取、送達與攔截

- 六個拾取物 ID `box-0`～`box-5`；`{id,kind,x,y,active,respawnAt}`。
- 空手進入半徑 28 自動拿第一個可用箱子；同箱同幀以穩定玩家順序決定。`carry` 是種類字串或 `null`，不是物件。
- 箱子在**拾取當下**停用並排定 `now+1000` 重生；到期只復原一次並將 `respawnAt=0`。在場景凍結時不更新；下一個可操作 tick 按到期時間恢復。
- 攜帶物進入相符目標半徑 45 自動送達、加 100、清空攜帶；錯誤目標不計分。重複輸入不能重複加同一份分數。
- TAG 只限 2 人 `playing`；攻方須空手、非暈眩、攔截冷卻到期。對方須攜帶、免疫到期且距離 ≤65。
- 成功攔截轉移種類，受害者暈眩 450ms、免疫 1200ms；攻方冷卻 2200ms，新持有者免疫 600ms（不縮短既有更長免疫），避免同幀／短時間來回搶。失敗 TAG 也會消耗請求，但不開始成功冷卻。
- 所有距離與計時截止皆含等號：剛好 28／45／65 有效、剛好到期可重生／再操作。

## 事件

`{id,type,playerId,kind,x,y,points?}`；type 為 `pickup|deliver|steal|dash|start|finish|left`，只保留最後 40 筆，ID 在同一遊戲持續遞增。送達帶 `points:100`；全局 start／finish 的 playerId／kind 是 null、座標 `(0,0)`。事件歷史跨回合保留，UI 應依 ID 去重，不應在每次 snapshot 重播。

## 驗證紀錄

核心測試命令：`node --test tests/arena-core.test.cjs`；完整命令：`npm test`（`node --test tests/*.test.cjs`）。

開發實際 RED → GREEN（數字為整份核心測試的通過／失敗數）：

| 階段 | RED | GREEN |
|---|---:|---:|
| 缺少 UMD 匯出 | 0 / 1 | 1 / 0 |
| 固定幾何、碰撞與 BFS | 1 / 4 | 5 / 0 |
| 單人出生、移動、時鐘與預測 | 5 / 4 | 9 / 0 |
| 拾取、送達、重生與公開快照 | 9 / 4 | 13 / 0 |
| 公平入場、倒數、競拾與原子拒絕 | 13 / 4 | 17 / 0 |
| 衝刺、暈眩與攔截計時 | 18 / 4 | 22 / 0 |
| 完賽、平手、重賽與斷線 | 22 / 4 | 26 / 0 |
| 零秒倒數與非法設定防護 | 26 / 2 | 28 / 0 |

最後補上 4 項已實作行為的整合回歸：40 筆事件界限、跨 Node／瀏覽器 UMD 的逐位元相同重播、完全透過一般方向輸入在 10 秒內撿箱並送達且實際繞過臺中驛、導航方向更新不清除待消耗的 dash／tag。最終核心 **32 / 32 通過**。精確半徑與冷卻邊界測試會使用受信任核心狀態 fixture；自動走路測試不改座標。未修改既有測試，未在此工作進行提交、推送或部署。

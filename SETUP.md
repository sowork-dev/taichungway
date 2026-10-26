# Setup

## 完整本機執行

需要 Node.js 22 以上；`ws` 版本由 package-lock.json 鎖定。沒有模型 API、帳號或資料庫。

```sh
npm ci --ignore-scripts
npm start
```

預設只綁定 `127.0.0.1:8765`，不會自動公開。`PORT=8791 npm start` 可另選埠；啟動程式輸出實際 URL。完整功能需要即時後端，單人練習分數也由後端處理。

- 第一個視窗點「立即開玩」，直接走格子、放水球、躲十字水波。
- 第二個獨立瀏覽器／無痕視窗可同樣點「立即開玩」自動配對，或從大廳點實際等候場次加入。
- 第二人接通後雙方歸零，倒數開賽；困住對手得1分，先3分勝；60秒到時比得分。
- 分享入口產生 `?room=場次碼` 邀請；不含認證 token。接收者仍需點加入。
- 雙方點再戰才重開；離開一方不算另一方獲勝，剩餘玩家回練習。

只看靜態政策資料可另用：

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory public
```

然後開啟 `/policies.html#topics`。純靜態伺服器沒有遊戲後端；首頁只呈現預覽，不能提供實際練習計分或多人，更不能補假對手。不要直接使用 file://。

## 單元、HTTP 與 WebSocket 測試

```sh
npm test
# 等同 node --test tests/*.test.cjs
```

測試包含舊檢索與完整來源、新格子／水球／水波／困住／勝負／歸零／計時與舊核心回歸、實際本機 HTTP 與 WebSocket、token 隔離、大廳真實人數、斷線／逾時與本機完整啟動。開發測試內可注入時間與直接安排規則 fixture；對外 API 沒有傳送、加分或管理作弊入口。

## 瀏覽器驗收

另開終端保持 npm start：

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium webkit
python tests/bubble_browser_qa.py http://127.0.0.1:8765
python tests/bubble_touch_qa.py http://127.0.0.1:8765
python tests/bubble_webkit_qa.py http://127.0.0.1:8765
```

Windows 使用 `.venv\Scripts\activate`。部分 Linux 需要依 Playwright 提示補 Chromium 系統依賴。

主流程測試會用實際導航與放球清出路線、從公開大廳加入、困住另一個客戶端、由0到3分同步勝負、再戰與離房；另驗原生雙指觸控與WebKit引擎。測試透過明確新場入口建立自己的場次，不主動加入別人的練習。輸出與截圖在 `qa/`（不入 Git）。兩個自動化 context 不是兩名真人；沒有宣稱已驗證十秒上手或好玩。中斷會留下本次 incomplete 報告，而非沿用舊成功結果。

`arena_browser_qa.py`、`arena_webkit_qa.py`、`browser_qa.py`、`quest_browser_qa.py`、`world_browser_qa.py` 與 `pk_browser_qa.py` 對應前版探索／答題首頁，保留作歷史參考，並非目前主入口的驗收指令。

## 提供文件匯入

ZIP 不含在公開 repo。取得有權使用的完整版本後，依 `scripts/import-policy-zip.py` CLI 明確傳入路徑。匯入器不掃描個人資料夾，也不執行 ZIP 的 JavaScript。數量、來源 hash 與邊界見 `docs/policy-source-coverage.md`；匯入日不是施政日期。

## 對外託管

1. 經確認公開授權後，將 `public/` 放到 TLS 網站根目錄；來源資料與瀏覽器資產使用同源絕對路徑。
2. 安裝鎖定依賴，啟動 `server/play-server.cjs`。環境 `HOST` 僅綁 loopback，`PORT` 選私有埠，`HOST_ORIGIN` 設成確切公開 HTTPS origin。
3. 同源反向代理 `/api/play/` 與 `/ws/play`。WebSocket 需 HTTP/1.1、Upgrade/Connection 標頭、關閉 buffering，並保留 ping/pong 的讀取時限。
4. 僅當可信 loopback proxy 會覆寫轉寄標頭時，才設定 `TRUST_PROXY=true`。不要信任客戶端任意提供的來源 IP。
5. 保留 CSP、來源檢查、no-store、安全標頭與資源限制；不得為了瀏覽器測試開 unsafe-eval。實際公開 WSS、兩端動作、計分與離房都需重驗，READY log 不算上線證據。
6. 純記憶體房間有上限、握手與待加入保留位逾時、輸入限流與心跳清除。重啟會清除所有遊戲場次，不保留帳號、偏好或永久戰績。

舊 `server/pk-server.cjs` 僅是前版政策問答 API，不可拿它冒充新動作遊戲後端；單獨啟動它無法支援新主入口。公開 repo 不包含內部 DNS、主機帳號、憑證、service unit 或發布腳本，push 不會自行切換正式網站。

# Setup

## 完整本機執行（單人＋雙人 PK）

需要 Node.js 22 以上；只使用 Node 內建模組，不需要 npm install、API Key 或資料庫。

```sh
npm start
```

開啟 `http://127.0.0.1:8765`。此設定只綁定 loopback，不會對外公開。開兩個獨立瀏覽器／無痕視窗，一方開房，另一方輸入六碼房號，即可驗證真實兩端同步。重新整理會失去暫存的房間 token，房間狀態不是永久戰績。

只要單人靜態功能可另用：

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory public
```

此靜態伺服器沒有多人 API，PK 介面會誠實顯示服務不可用，不會補假玩家或假戰績。不要直接用 file://，因為資料載入使用同源 HTTP。

## 單元與 HTTP 測試

```sh
npm test
# 等同：
node --test tests/*.test.cjs
```

測試包含來源覆蓋、檢索、城市碰撞／路徑、真實本機 HTTP 房間、作答揭露時機、token 隔離、計分、再戰與基本拒絕邊界。通過測試不等於完成正式資安滲透測試或真人驗收。

## 瀏覽器驗收

另開終端保持 npm start 執行：

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/browser_qa.py http://127.0.0.1:8765
python tests/quest_browser_qa.py http://127.0.0.1:8765
python tests/world_browser_qa.py http://127.0.0.1:8765
python tests/pk_browser_qa.py http://127.0.0.1:8765
```

Windows 使用 .venv\Scripts\activate。部分 Linux 環境需依 Playwright 提示補裝 Chromium 系統依賴。

輸出與截圖存於 qa/，不提交 Git。PK 腳本建立兩個獨立自動化瀏覽器 context，測試真實服務端同步，不冒充真人使用者。腳本會留下不完整／失敗報告，不以先前成功結果代替本次執行。

閒置重載測試會實際等待 70 秒：

```sh
python tests/reload_qa.py http://127.0.0.1:8765
```

## 文件匯入

原始 ZIP 不包含在公開 repo。先取得有權使用的完整版本，再依 scripts/import-policy-zip.py 的 CLI 說明明確傳入路徑。匯入器不會掃描個人資料夾或執行 ZIP 中的 JavaScript。內容保留範圍與資料版本見 docs/policy-source-coverage.md；匯入日不是政策實施日。

## 對外託管

- 靜態託管 public/ 可提供單人功能；首頁位於網域根目錄，資料使用 /knowledge.json 與 /policy-catalog.json。
- 多人需額外啟動 server/pk-server.cjs，並由 HTTPS 同源反向代理 /api/pk/ 到該私有綁定位址；不要把 API 原始埠直接對外暴露。
- CLI 參數由 HOST、PORT、HOST_ORIGIN 與 TRUST_PROXY 環境變數設定；只有由可信反向代理覆寫轉寄標頭時才啟用 TRUST_PROXY。
- 必須提供有效完整 policy-catalog.json；缺少來源資料時應啟動失敗，不使用範例題替代。
- 房間只存在程序記憶中，重啟會清除。沒有持久帳號、戰績、管理後台或文字聊天；這是有界的公開互動原型，不是經壓測的競技遊戲服務。
- 部署前需確認對外公開授權、配置 TLS、隱私紀錄政策與資源上限，再以實際公開網址重跑兩端驗收。

此公開 repo 不含正式主機帳號、DNS、憑證或內部自動部署設定；push 不會自行修改體驗網站。

# 臺中搶送 · Taichung Rush

手機優先、真人同場的動作 PK：跑 → 拿補給 → 送同色市民 → 得分。不先讀政策或做測驗；完整政策與提問保留在次要入口。

**體驗網站：https://taichungway.sowork.ai**

> 本專案是獨立製作的 AI 分身介面原型，非江啟臣本人即時回覆，不代表本人、競選團隊或立法院授權／背書。
> **目前沒有接入生成式 AI**；自由輸入會依關鍵字檢索已收錄的公開資料卡，不是全領域對話或經本人訓練的模型。

## 主玩法

- 一鍵開玩，自動加入可用真人場次；沒人時先在同一張地圖練習，不用填房號。
- 公開大廳顯示實際連線與可加入場次；也能傳邀請連結，不放假對手。
- 第二人接通後歸零、倒數，開始一分鐘 PK；練習分數不帶入競賽。
- 靠近補給自動拿，送同色市民得分。搖桿／點地走路、衝刺；空手靠近持有補給的對手可攔截。
- WebSocket 同步；伺服器維護移動、碰撞、物資、攔截、比分與勝負。客戶端只送意圖，不直接加分或交座標；點地導航仍受正常速度限制。
- 到時結算，雙方點再戰才重開；一方離線後回練習，不製造勝利。
- 臺中驛、第二市場、水湳會展、歌劇院、新社菇園、東勢客家、高美風車等原創意象，非比例、非真實行政區地圖。
- 接駁、托育、照護是目前三種補給情境；全部15主題原文仍在 `/policies.html#topics`。遊戲效果不是施政預測、支持度或投票意向。

## 快速啟動

```sh
git clone https://github.com/sowork-dev/taichungway.git
cd taichungway
npm ci --ignore-scripts
npm start
```

需要 Node.js 22 以上；以瀏覽器開啟 `http://127.0.0.1:8765`。唯一依賴是鎖定版本的 ws；不需要模型 API Key 或資料庫。開兩個獨立瀏覽器 context，可測試真實兩端房間同步；自動化測試不等於真人驗收。本機預設只綁定 loopback，不會自動對外公開。

## 程式與驗收

- `public/arena-core.js`：共用物理、拿取、送達、攔截與計時。
- `public/play.js`、`play.css`、`index.html`：低文字手機遊戲。
- `server/play-server.cjs`：即時 WebSocket、公開大廳、暫存房間。
- `server/local.cjs`：完整本機啟動入口。
- `public/policies.html`、`app.js`、`engine.js`：完整資料、來源與確定性提問。
- `data/`、`scripts/`：來源維護與明確指定 ZIP 的安全匯入。

```sh
npm test
# 保持 npm start 執行，另安裝 Playwright 後：
python tests/arena_browser_qa.py http://127.0.0.1:8765
```

主流程實測走路、拿取、送達、大廳加入、歸零、兩端攔截、同步比分、結算、再戰與離房。兩個自動化 context 不是兩名真人，不宣稱已證明好玩或十秒上手。舊探索／答題瀏覽器腳本保留作歷史參考，不替代新主入口；Node 測試仍保留完整來源與舊核心契約。詳見 [SETUP.md](SETUP.md)。

## 資料與限制

保留原本 12 筆公開來源資料，並匯入完整 `taichung-machine-site.zip` 的首頁＋15 個政策子頁。來源版本與逐項保留數量見 [文件覆蓋說明](docs/policy-source-coverage.md)。提供文件標示為「提供文件主張、待獨立核實」；匯入日不等於政策發布日或實施日，沒有持續自動更新。原始 ZIP、HTML 與第三方圖像不放入公開 repo。

來源包含候選人公開政策網站與立法院公開人物頁。政見不代表已立法、編列預算、施工或開放申請；金額、資格與進度仍須查主管機關。資料整理不構成任何單位的背書。

修改資料時同步更新 `data/knowledge.json` 與 `public/knowledge.json`，詳見 [data/README.md](data/README.md)。

## 隱私與安全

不使用 Cookies、localStorage、sessionStorage、追蹤分析或永久戰績。自由政策提問只在瀏覽器處理，不送到遊戲後端。主動開玩後同步匿名身分、操作、遊戲座標與暫存分數；房間在記憶體中、離房／逾時清除，重啟會失去對局。分享連結只含場次碼、不含 token；公開場次與邀請連結不是存取控制。

沒有帳號、付費獎品、永久排名、文字聊天或完整競技防外掛。基本限制與測試不等於資安稽核、壓測或真人可用性驗收。即時規格見 [play-api.md](docs/play-api.md)，舊答題規格保留於 [multiplayer-api.md](docs/multiplayer-api.md)。託管連線紀錄須另行配置；不是陳情或政府服務申請入口。

公開版本不含內部部署、主機設定、SSH 金鑰或憑證；請見 [公開範圍](docs/sanitization-policy.md) 與 [SECURITY.md](SECURITY.md)。

## 授權

原創程式碼採 MIT License。第三方網站內容、人物姓名／肖像及其他第三方權利不因此授權；請閱讀 [NOTICE.md](NOTICE.md)。

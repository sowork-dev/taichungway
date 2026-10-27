# 台中味互動網站群 · Taichung Way

**開發入口是 [`platform/`](platform/README.md)，不是根目錄保留的舊版泡泡 PK。**

公開體驗：**https://taichungway.sowork.ai**。這是 SoWork 獨立製作，非官方網站，未取得競選團隊授權或背書。新版視覺採乾淨留白與江啟臣藍色識別，美術與真人可用性仍待使用者驗收。

## 五個可玩體驗

- `/comic/` 巷口四格漫畫：六場景、三種藍色筆觸、四格可編輯旁白、政策故事與 PNG。**預製故事版，不使用 AI**；私人原文單獨標示，不宣稱讀懂或改編。
- `/check/` 對開支票本：填生活願望 → 產生自己的支票 → 對開公開政見 → 保存。**保守本機關鍵字對照，不是 AI 語意分類**；找不到不硬配。
- `/postcard/` 台中聲音明信片：29 區選單、最多三軌混音、獨立音量、留言圖卡、可重現混音的聆聽網址。**原創合成聲景，非在地實錄**。
- `/fortune/` 沾福氣：長按、翻卡揭曉政策、本機圖卡。
- `/flavor/` 你是哪一味：三題配對，途中替市場開冷氣，保留八種結果。

「替他說一句」「台中機器」已從清單移除。所有來源與非官方／非成果聲明都須保留。

## 啟動目前版本

需要 Node.js 22.22.2 與 pnpm 10.30.3，不需 API Key、帳號或資料庫。

```sh
git clone https://github.com/SOWORK-DEV/taichungway.git
cd taichungway/platform
corepack enable
corepack prepare pnpm@10.30.3 --activate
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm typecheck
pnpm build
pnpm serve
```

開啟 `http://127.0.0.1:4189`。`pnpm serve` 使用編譯輸出，修改後須再次建置。開發三個新體驗可在 `platform/apps/hub` 執行 `pnpm exec next dev --hostname 127.0.0.1 --port 4194`，不要與正式建置同時改寫同一個 `.next` 目錄。

## 主要修改入口

- `platform/apps/hub/app/{comic,check,postcard}/`：本輪三個完整體驗；各自資料、互動與 CSS。
- `platform/apps/hub/app/page.tsx`：新版乾淨入口卡片。
- `platform/packages/ui/src/studio.{tsx,css}`：新版共用頁首、白色留白版型、來源聲明、圖卡／分享。
- `platform/apps/{fortune,flavor}/app/page.tsx`：原本兩個互動。
- `platform/packages/policy-data/src/policies.json`：117 項官網原文，不能自行創造政見。
- `platform/scripts/studio-browser-qa.py`：三體驗的實際瀏覽器操作、聲音解碼、下載與響應式驗收。
- `platform/scripts/package-release.ts`：只打包建置輸出，保留來源版本、逐檔雜湊與 CSP script hashes。

已實際整合現成開源 GitHub 元件：Rough.js、StPageFlip、Howler.js、html-to-image；版本、用途及 MIT 授權見 [開源元件說明](docs/open-source-components.md)。不是只列推薦名單，也未複製參考網站的圖片或品牌素材。

協作請 Fork → 分支 → 修改 → 測試與手機截圖 → PR。public repo 不代表任何人都能直接 push。更多限制見 [設計交接](docs/design-handoff.md) 與 [platform 說明](platform/README.md)。程式 MIT；第三方內容、人物及字型權利另依 [NOTICE.md](NOTICE.md)。

<details>
<summary>舊版泡泡 PK 說明（歷史版本，非本次設計交接入口）</summary>

# 臺中泡泡 PK · Taichung Bubble

手機優先、真人同場的格子水球 PK：走 → 放水球 → 躲十字水波 → 困住對手得分。不先讀政策或做測驗；完整政策與提問保留在次要入口。

**體驗網站：https://taichungway.sowork.ai**

> 本專案是獨立製作的 AI 分身介面原型，非江啟臣本人即時回覆，不代表本人、競選團隊或立法院授權／背書。
> **「啟臣，聊一下」（`/`）接入 Anthropic Claude 模型**，只依檢索到的公開資料卡回答，不是經本人訓練的模型；需在伺服器設定 `ANTHROPIC_API_KEY`（可選 `CHAT_MODEL`，預設 `claude-sonnet-5-5`），金鑰不得放進 repo，未設定時聊天回 503。對話不儲存；隱私與立場類問題在伺服器端直接拒答，不送模型。「城市冒險」與泡泡 PK 的自由提問仍是關鍵字檢索，沒有生成式 AI。
>
> 頁面：`/` 啟臣，聊一下（AI 聊天）、`/adventure.html` 啟程，城市冒險、`/bubble.html` 臺中泡泡 PK。

## 主玩法

- 完整9×13格單屏，兩名大角色一直可見；不再沿用搶送與跟隨鏡頭。
- 一鍵開玩，自動加入可用真人場次；沒人先練習，不補假人。大廳也能明確開新場、傳連結邀朋友。
- 左手搖桿上下左右走，右手唯一動作「水球」；也可點地面走、鍵盤方向鍵／WASD＋空白鍵。
- 水球倒數後十字散開，障礙擋住水波，街區可清除開路；自己也要躲水波。
- 困住對手得1分，先3分勝；60秒到時比得分。自己的水波也會困住自己，但不送分。練習清格計數在真人加入後歸零。
- 真實WebSocket同步；伺服器維護移動、碰撞、水球、水波、泡泡、得分與勝負。客戶端只送操作意圖，點地仍受正常速度限制。
- 雙方點再戰才重開；一方離開，留下者回練習，不製造幽靈勝利。
- 原創臺中驛、第二市場、水湳會展、高美風車意象，非比例、非行政區地圖。參考格子水球規則，未使用原作角色、地圖圖像、音效或程式碼，非《爆爆王》官方／授權作品。
- 街區開通後才顯示既有政策主題，不把文字閱讀當開玩門檻；全部15主題與100筆資料仍在 `/policies.html#topics`。遊戲清格、點亮、分數都不是政策施行、預算或成效。

## 快速啟動

```sh
git clone https://github.com/sowork-dev/taichungway.git
cd taichungway
npm ci --ignore-scripts
npm start
```

需要 Node.js 22 以上；以瀏覽器開啟 `http://127.0.0.1:8765`。唯一依賴是鎖定版本的 ws；不需要模型 API Key 或資料庫。開兩個獨立瀏覽器 context，可測試真實兩端房間同步；自動化測試不等於真人驗收。本機預設只綁定 loopback，不會自動對外公開。

## 程式與驗收

- `public/bubble-core.js`：共用格子碰撞、水球／水波、困住、勝負與重賽；`arena-core.js`保留作舊版回歸。
- `public/play.js`、`play.css`、`index.html`：低文字手機遊戲。
- `server/play-server.cjs`：即時 WebSocket、公開大廳、暫存房間。
- `server/local.cjs`：完整本機啟動入口。
- `public/policies.html`、`app.js`、`engine.js`：完整資料、來源與確定性提問。
- `data/`、`scripts/`：來源維護與明確指定 ZIP 的安全匯入。

```sh
npm test
# 保持 npm start 執行，另安裝 Playwright 後：
python tests/bubble_browser_qa.py http://127.0.0.1:8765
```

主流程實測正常移動、放水球清格開路、大廳加入、歸零、0到3分困住對手、同步勝負、再戰與離房。另有原生雙指觸控與WebKit引擎測試，均非實體手機／真人驗收。兩個自動化 context 不是兩名真人，不宣稱已證明好玩或十秒上手。舊搶送／探索／答題瀏覽器腳本保留作歷史參考，不替代新主入口；Node 測試仍保留完整來源與舊核心契約。詳見 [SETUP.md](SETUP.md)。

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

</details>

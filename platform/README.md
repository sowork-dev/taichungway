# 台中味互動平台

本目錄是 pnpm monorepo，與上層保留的水球遊戲分開。三個 Next.js 靜態 app：hub、fortune、flavor；本輪新增 comic/check/postcard 為 hub 中的獨立路由，共用同源資源與版型，不另開 repo。五個體驗可玩，thanks/machine 仍為 soon。

正式公開網址：`https://taichungway.sowork.ai`。使用此網域不表示官方授權；所有頁面保留非官方、未獲授權／背書與政見非成果聲明。

## 安裝、驗證、啟動

Node.js 22.22.2、pnpm 10.30.3。依賴精確鎖定；不需要 API key、AI 服務或資料庫。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm typecheck
pnpm build
pnpm serve
```

預覽只監聽 `127.0.0.1:4189`，也可 `PORT=4193 pnpm serve`。`PREVIEW_ORIGIN=https://taichungway.sowork.ai` 指定 metadata／預覽連結 origin；此環境變數不是憑證。

路由：`/`、`/comic/`、`/check/`、`/postcard/`、`/postcard/m/?mix=d01%3A60%2Cd12%3A50`、`/fortune/`、`/flavor/`、`/privacy/`。

Hub 的站點狀態由 `data/sites.json` 驅動；本機 preview 每次請求讀取後映射到目前 origin。正式靜態 release 使用同一檔案的已打包版本，改上下架需更新正式 sites.json，不能把本機動態讀檔誤稱為靜態正式站的即時後台。

## 三個新體驗

- `apps/hub/app/comic/`：原創幾何線稿＋Rough.js，六公開場景、三風格。用預製故事承載相關公開提案，四格旁白可編輯；使用者原文獨立保留，不宣稱 AI 已改編事件。換場景／風格重設編輯，重玩清除輸入。
- `apps/hub/app/check/`：八組明確本機規則對照117原文；無匹配或多主題時不硬湊。自己的支票先產生，對開後才可匯出政策那一張。可選 StPageFlip 翻頁，不阻擋手機／減少動態效果的靜態版。
- `apps/hub/app/postcard/`：29真實行政區選單，但聲音是六種原創合成示意，非29區實錄。最多三軌、0–100整數音量、200ms漸變、Howler播放，隱藏／離頁釋放。收件人頁不自動載入或播放，必須點播放。分享只保留區碼與音量。
- `packages/ui/src/studio.tsx`：來源元件、私人文字不進網址的分享、html-to-image本機擷取後完整置入1080×1350PNG；圖卡不含音訊。

不使用候選人肖像、聲音、簽名，不推論政治立場。輸入只在頁面記憶體，無AI外送、Cookie、localStorage、會員與追蹤。本機個資檢查只是保守提醒，不是完整去識別保證。真正的現場錄音、生成式漫畫服務、LIFF/Flex Message、實體LINE端到端、人工文案／法務與設計驗收仍未完成。

## 政策與素材

`packages/policy-data` 保留117項官網原文，標題／來源與編輯情境分開。趣味場景不是現況記錄、效果模擬或兌現證明，不捏造預算、期程與成效。每個下載作品帶來源與非成果／非官方聲明。改資料前重新查核 `https://taichungway.tw/future`，不把無匹配等同官網沒有。

字型來源及SIL OFL在 `assets/fonts/`。舊Satori圖卡延遲載入本機字型；新三站擷取裝置實際字型。開源元件與MIT文本見 `../docs/open-source-components.md` 與 `../docs/licenses/`。

```sh
python3 scripts/prepare-city-audio.py # stdlib，重建六段10秒合成PCM WAV
python3 scripts/prepare-studio-og.py  # Pillow，重建三張1200×630 OG
```

## 可重跑的實際瀏覽器驗證

需Python Playwright瀏覽器與Pillow；先建置並啟動預覽。

```sh
python3 scripts/studio-browser-qa.py
TEST_ORIGIN=https://taichungway.sowork.ai QA_LABEL=public python3 scripts/studio-browser-qa.py
python3 scripts/browser-qa.py # 原兩體驗舊腳本，部分歷史視覺／目錄數量假設需依新版調整
```

新腳本包含真實四格編輯、翻頁、PNG下載、29區選擇、實際非零10秒WebAudio解碼／running播放、相同混音收件人頁、惡意參數拒絕、360/390/768和WebKit reduced-motion render。這是自動化瀏覽器證據，不是人耳聽感、真人好玩程度或實體iPhone／LINE驗收。結果逐項寫入 `artifacts/three-studios/`（不進Git）；中斷或失敗會保留failed狀態，不當成passed。

## 靜態發佈

```sh
PREVIEW_ORIGIN=https://taichungway.sowork.ai pnpm exec tsx scripts/package-release.ts /ABSOLUTE/EMPTY/OUTSIDE_DIR FULL_40_CHAR_GIT_SHA
```

只複製三個 app 的 `out/`，不複製原始碼、node_modules、.env與主機設定。`release.json`紀錄來源SHA、逐檔hash與inline-script CSP hashes，正式Nginx須容許這些精確hash、同源字型／音訊與本機blob圖卡，不用unsafe-eval。部署應保留前一release／vhost設定以便回滾，公開讀回版本與圖卡／聲音操作後才能報完成。真實主機、SSH與憑證不得加入本repo。

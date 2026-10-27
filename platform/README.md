# 台中味 Phase 1 — 獨立互動預覽

本目錄是新的 pnpm monorepo，與上層既有遊戲分離。第一階段只交付 Hub、沾福氣、你是哪一味；其餘三站（對開支票本、台中聲音明信片、巷口四格漫畫）僅列為 soon，不代表已實作。非官方網站、未取得競選團隊授權或背書。

## 結構與執行

- `apps/hub`：入口站及隱私說明。
- `apps/fortune`：長按抽福氣 → 翻卡揭曉同一心願對應的官網政見 → 本機政策圖卡。
- `apps/flavor`：三題趣味配對＋第一題後的市場冷氣互動；每位玩家都經過相同市場示意，不以答案做政治立場推斷。
- `packages/experience`：原創娛樂文案及計分規則，尚待人工審核。
- `packages/policy-data`：保留 117 項擷取原文。可玩範圍只採 TRA-06 與 IND-19 兩項，已重新核對官方頁面存在相同原文；其餘政策未接入。人工審核與雙人簽核尚未完成。
- `packages/experience/src/policy.ts`：共用政策／情境模型。原文標題與編輯解釋分欄；無實際降溫數值、經費、時程或已施政成果宣稱。
- `packages/share-card`：Satori 在瀏覽器生成 1080×1350 PNG，不上傳。
- `packages/line`：原生 Web Share 或複製連結，**不是 LIFF/Flex Message**。
- `packages/ai-guard`、`packages/analytics`：僅保留套件位置；目前不啟用、不可當作完整 AI 閘道或匿名統計交付。

使用 Node 22.22.2、pnpm 10.30.3。相依版本見 package.json 與 pnpm-lock.yaml。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm typecheck
pnpm build
pnpm serve
```

主機的預設 Node 非 LTS 時：

```sh
npx --yes --package=node@22.22.2 -c "pnpm test && pnpm typecheck && pnpm build"
```

預覽伺服器僅監聽 `127.0.0.1:4189`。三個 apps 分別編譯，預覽時以 `/`、`/fortune/`、`/flavor/` 聚合；不是五個正式子網域部署。設定 `PREVIEW_ORIGIN=https://...` 可指定 OG 與站點網址。公開存取使用暫時 tunnel，無正式可用性承諾，不覆蓋既有 SoWork 網站。

`data/sites.json` 每次請求讀取，Hub 重新取得後反映上下架，不需重建；伺服器會把設定的 URL 路徑映射到當前預覽 origin。正式子網域部署需另調整路由與經核准的完整網址，不能直接把本預覽的同源映射視為正式架構。

## 字型與素材

本地字型由 Google Fonts 的 Noto Sans TC 固定 revision 產生，SIL OFL-1.1；衍生名稱 LocalSansTC，保留 `assets/fonts/OFL.txt` 與 `SOURCE.json`，來源及輸出 SHA256 可核對。產圖時才載入約 5.9MB 本地字型，不計入首次 JS；不依賴外部字型服務。圖卡以 BMP CJK 字符為主，少見擴充漢字與 emoji 需再確認字形。

```sh
python3 scripts/prepare-font.py  # 需要 fontTools，會讀公開固定 revision
python3 scripts/prepare-assets.py  # 需要 Pillow
```

所有介面插畫與 OG 幾何圖形為本專案原創，無候選人形象、第三方角色或官方背書標誌。祝福及結果文字為本專案撰寫，尚未人工簽核，不宣稱法務核可。

## 驗收

```sh
python3 scripts/browser-qa.py
TEST_ORIGIN=https://your-preview.example python3 scripts/browser-qa.py
```

腳本使用實際 Chromium/WebKit 操作，輸出 `artifacts/local/browser-qa.json`、64 組 UI 結果及截圖；公開網址以 `ARTIFACT_SUBDIR=public` 保存獨立結果，抽測 8 種結果各一條完整路徑，任一必要案例失敗即非零退出。此為桌面引擎／行動 viewport 測試，不等於實體 iOS/Android/LINE 驗收。正式上線尚需：實體雙平台 LINE 端到端、文案人工審核、法務與素材授權確認、正式網域及部署環境、效能／流量驗證。其餘五站不在本次已完成聲明內。

## 政策互動驗證

```sh
pnpm exec tsx --test tests/policy-experience.test.ts tests/policy-card.test.ts tests/policy-ui.test.ts
pnpm exec tsx scripts/policy-card-layout.ts
python3 scripts/policy-card-bounds-qa.py
python3 scripts/policy-browser-qa.py
```

`artifacts/policy-play/source-verification.json` 保留官方查核時間、回應雜湊與兩項標題的逐字匹配結果，不代表適用條件、預算或實施成果已驗證。福氣抽籤隨機取兩項共同目錄；所有味道配對玩家皆玩同一市場場景，沒有立場推斷或客製政治勸說。結果圖卡同樣呈現政策原文、來源、概念示意與非成果聲明，分享連結仍不含暱稱、答案或結果。

## 磁碟不足恢復

此次安裝遭遇 `ENOSPC`，先 `df -h .` 與限定路徑 `du -sh` 查明，僅執行 `npm cache clean --force` 清可再下載快取，保留所有專案、附件、登入與歷史。恢復空間後重新跑完整安裝與測試。不要因為套件目錄存在就假定安裝完整，也不要刪除 `.hermes` 工作資料或其他專案。

TypeScript 7 移除 `baseUrl`；本目錄改用實際 pnpm workspace links 與 package exports，不靠失真的 wildcard alias。UI 的入口實際為 `index.tsx`。Satori 的 fflate 0.7.3 在稽核時有公告漏洞，已以精確 override 0.7.5 修復，並重新通過實際 Satori 產圖測試與 pnpm audit；未將此掃描當作全面滲透測試。

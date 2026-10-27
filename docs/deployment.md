# 部署（taichungway.sowork.ai）

## 結構

| 內容 | 由誰提供 | 路徑 |
|---|---|---|
| 入口站、沾福氣、你是哪一味、四格漫畫、支票本、聲音明信片 | 靜態 release（`platform/`） | `/`、`/fortune/`、`/flavor/`、`/comic/`、`/check/`、`/postcard/` |
| 啟臣聊一下、城市冒險、泡泡 PK 的網頁與資源 | 同一個靜態 release（`public/` 會被複製進來） | `/chat.html`、`/adventure.html`、`/bubble.html`、`/*.css`、`/*.js`、`/*.json` |
| 即時對戰與 AI 聊天 API | Node 後端（`node server/play-server.cjs`） | `/api/play/*`、`/ws/play`、`/api/chat` |

首頁 `/` 是入口站；聊天頁在 `/chat.html`。

## 產生 release

```sh
cd platform
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
PREVIEW_ORIGIN=https://taichungway.sowork.ai pnpm exec tsx scripts/package-release.ts /ABSOLUTE/EMPTY/OUTSIDE_DIR $(git rev-parse HEAD)
```

把 `OUTSIDE_DIR` 的內容放到 nginx 的網站根目錄。`release.json` 內的 `revision` 就是這次部署的 commit，部署後請核對：

```sh
curl -s https://taichungway.sowork.ai/release.json | grep revision
```

## 後端

```sh
HOST=127.0.0.1 PORT=8790 HOST_ORIGIN=https://taichungway.sowork.ai TRUST_PROXY=true \
ANTHROPIC_API_KEY=（只放在伺服器環境變數，不放進 repo） node server/play-server.cjs
```

- 沒設 `ANTHROPIC_API_KEY` 時，`POST /api/chat` 回 503，聊天頁顯示「尚未開放」。
- 可選 `CHAT_MODEL`（預設 `claude-sonnet-5-5`）。
- 後端只綁 loopback。

## nginx 需要轉送的路徑

靜態檔放網站根目錄；下列三組路徑轉到後端（埠依你的設定）：

```nginx
location /api/ { proxy_pass http://127.0.0.1:8790; }
location /ws/  { proxy_pass http://127.0.0.1:8790; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
```

既有的 `/api/play/*` 與 `/ws/play` 若已轉送，只需再確認 `/api/chat` 也在轉送範圍內。保留既有的 CSP 與安全標頭。

## 驗收清單

1. `https://taichungway.sowork.ai/release.json` 的 `revision` 等於要部署的 commit。
2. `/` 顯示入口站，並有「城市冒險／啟臣，聊一下／泡泡 PK」三張卡。
3. `/chat.html`、`/adventure.html`、`/bubble.html` 都是 200。
4. `/api/play/health` 回 `ok: true`；`POST /api/chat`（空訊息）回 400，不是 404。
5. 設好金鑰後，在聊天頁問一題並確認有回覆與來源。
6. 手機實機開啟立體標題與表情符號，確認字型顯示正常。

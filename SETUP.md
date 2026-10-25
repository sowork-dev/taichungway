# Setup

## 本機執行

需要 Python 3。網站本身是靜態 HTML / CSS / JavaScript，沒有建置步驟。

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory public
```

開啟 `http://127.0.0.1:8765`；不要直接用 `file://` 開啟，因為資料載入使用同源 HTTP 請求。

## 單元測試

需要 Node.js 20 以上，不需 npm install。

```sh
npm test
# 或：
node --test tests/*.test.cjs
```

## 瀏覽器驗收

另開終端機，保持上述 HTTP 服務執行：

```sh
python3 -m venv .venv
# macOS / Linux：
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/browser_qa.py http://127.0.0.1:8765
```

Windows 請改用 `.venv\Scripts\activate` 啟用虛擬環境。部分 Linux 環境可能需要依 Playwright 的錯誤提示安裝 Chromium 系統依賴。

驗收輸出及截圖會儲存在 `qa/`，預設不提交到 Git。腳本使用目前這批政策資料的固定核對日期與案例；更新資料時須同步審核測試，不能把過期資料測試通過當作最新政策證明。

另可執行閒置後重載測試；此測試實際等待 70 秒：

```sh
python tests/reload_qa.py http://127.0.0.1:8765
```

## 託管

僅需託管 `public/` 內容，使用 HTTPS。資料載入使用 `/knowledge.json`，因此此版本預設部署在網域根目錄，而非子目錄。

不需要 `.env` 或後端金鑰。此公開 repo 不含正式主機帳號、DNS 修改或自動部署腳本，也不會在 push 後自動修改體驗網站。

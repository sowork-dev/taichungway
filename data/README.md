# Policy records

`knowledge.json` 是政策資料的維護來源；`public/knowledge.json` 是供網頁載入的相同內容。兩者必須保持位元組一致。

每筆包含：唯一 `id`、分類、標題、示範問題、檢索別名、精簡摘要、`status`、來源標題與 HTTPS URL、發布日期、核對日期與補充細節。

- `proposed`：公開競選提案，不代表已實施。
- `profile`：公開人物紀錄，不是政策承諾或授權證明。
- `sourceDate`：來源正文可確認的發布日期；無法確認時保留 `null`。
- `verifiedAt`：實際核對日，不等於發布日。

本版保留原有 12 張公開來源卡，追加提供 ZIP 的 15 張主題總覽與 73 張細項卡，共 100 張。Catalog 保存 15 主題、90 個階段、73 組支柱、275 條支柱原文與 338 個標籤；卡片數不等於互不重複的政策數。新增卡 provenance 為 user-provided-archive，verifiedAt 只代表檔案匯入／完整性核對日，並非獨立事實查證。來源與覆蓋細節見 ../docs/policy-source-coverage.md。

每次更新須重新開啟來源正文、檢核摘要支持範圍、同步兩份 JSON，並執行測試。不得捏造來源日期、預算、實施進度、申請資格或候選人授權。

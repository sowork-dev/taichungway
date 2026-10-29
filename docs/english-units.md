# 一口好英文：主題路線（已實作）

## 目標
把「每課隨機抽 8 個單字」改成多鄰國式的路線：6 個主題單元，單字有熟練度，使用者看得出自己走到哪裡。

## 單元與單字（共 50 個，每個單字只在一個單元）
| 單元 | 單字 |
|---|---|
| 1 早餐桌（10） | egg 蛋、soy milk 豆漿、rice ball 飯糰、bread 麵包、scallion pancake 蔥油餅、tea 茶、coffee 咖啡、hot 燙、cold 冰、high-mountain tea 高山茶 |
| 2 菜市場（8） | vegetables 蔬菜、fresh fish 鮮魚、rice 白飯、shopping basket 菜籃、food stall 攤位、taro 芋頭、shiitake mushroom 香菇、tofu pudding 豆花 |
| 3 夜市小吃（10） | night market 夜市、popcorn chicken 鹹酥雞、stinky tofu 臭豆腐、oyster omelet 蚵仔煎、ba-wan 肉圓、rice sausage roll 大腸包小腸、grilled corn 烤玉米、sweet potato 烤地瓜、bubble tea 珍珠奶茶、oyster 蚵仔 |
| 4 湯麵飯（7） | hot soup 熱湯、beef noodle soup 牛肉麵、braised pork rice 滷肉飯、bamboo-tube sticky rice 筒仔米糕、fried pork rib soup 排骨酥湯、dumplings 水餃、spicy 辣 |
| 5 甜點（7） | sun cake 太陽餅、pineapple cake 鳳梨酥、taro pastry 芋頭酥、mochi 麻糬、shaved ice 剉冰、ice cream 冰淇淋、sweet 甜 |
| 6 水果（8） | fruit 水果、pineapple 鳳梨、peach 水蜜桃、sweet persimmon 甜柿、lychee 荔枝、apple 蘋果、pear 水梨、tangerine 橘子 |

## 規則
- 每個單字有熟練度 0–3：答對 +1（同一課內答錯回題不加），答錯 −1（最低 0）。3 = 熟。
- 一課從目前單元挑 8 題：優先熟練度低的字；單元內 60% 的字達 2 以上，下一單元才解鎖（單元 1 一開始就開放）。
- 單元完成度用 3 格進度（0 / 1 / 2 / 3 星），首頁路線圖顯示每個單元的星與解鎖狀態。
- 每日目標：今天完成 1 課；首頁顯示「今天還差 1 課」。
- 進度仍只存在這台裝置（`taichung-english-v1` 升級為 v2，讀到 v1 時轉換：已學會的字熟練度 = 1）。

## 待決定
- 各單元名稱與單字分配是否合適、是否要增刪單字。
- 英文名稱需要懂英文的人審稿；是否加入「這道菜在台中哪裡有名」的一句話（需要有人查證資料）。

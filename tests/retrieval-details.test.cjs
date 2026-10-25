const test=require('node:test');const assert=require('node:assert/strict');
const {answer}=require('../public/engine.js');
const card={id:'source-detail',category:'育兒友善城市',title:'守護爸媽身心',question:'守護爸媽身心有哪些提供文件主張？',aliases:['育兒友善城市'],summary:'提供文件記錄父母身心支持的提案。',status:'proposed',details:['示意：卡尺量測。補助新手爸媽心理諮商（父母各 3 次）、月嫂補助增至 40 小時、好孕專車延長一年。','補助育齡女性抽血檢測 AMH 指標；經醫師檢測發現影響生育力的可能性，逐步擴大凍卵補助適用範圍。']};
test('specific policy detail can be found beyond title and aliases',()=>assert.equal(answer('月嫂補助有幾小時？',[card]).records[0]?.id,card.id));

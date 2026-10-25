/* Policy-card retrieval. No remote model calls; no user-data storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PolicyEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const NOTICE='以下是公開資料整理，不是江啟臣本人回覆。政見不等於已實施政策；申請資格與現行措施請向主管機關確認。';
 function normalize(s){return String(s).toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'').replace(/台中/g,'臺中');}
 function searchRecords(question,records){
  const q=normalize(question);if(!q||!Array.isArray(records))return [];
  return records.map((r,i)=>{let score=0;if(r.status==='profile'&&!/職務|背景|學歷|經歷|副院長|立法委員|是誰|介紹/.test(q)&&!['江啟臣','chiangchichen'].includes(q))return{r,score:0,i};const categoryKey=r.category&&!r.category.startsWith('城市')?r.category.slice(0,2):'';const keys=[...(r.aliases||[]),r.category,categoryKey,r.title].filter(Boolean);for(const key of new Set(keys.map(normalize))){if(key.length>=2&&q.includes(key))score+=key.length+(normalize(r.title)===key?3:0);}const detailText=normalize([r.title,r.summary,...(r.details||[])].join(' '));const tokens=q.split(/有幾|多少|是什麼|有什麼|什麼|對於|關於|請問|江啟臣|這項|那項|的|嗎|呢|如何|怎麼|有哪些|相關|目前|政策|主張|規劃|方案|可以|是否|以及|申請|補助/g).filter(t=>t.length>=2&&t.length<=30);for(const token of new Set(tokens)){if(detailText.includes(token))score+=Math.min(12,token.length);}if(normalize(r.question||'')===q)score+=50;return{r,score,i};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,3).map(x=>x.r);
 }
 function answer(q,records){
  const reply=(kind,intro,rs=[])=>({kind,intro,records:rs,notice:NOTICE});
  if(typeof q!=='string'||!q.trim()||q.length>360)return reply('error','請輸入 1–360 字的政策問題。');
  if(/(?:09\d{8}|[A-Z][12]\d{8}|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(q))return reply('privacy','請不要輸入電話、身分證字號或電子郵件。此公開原型不受理個人案件，也不會替你送出申請；請移除個資後再問政策。');
  if(/忽略.{0,8}(規則|指令)|系統提示|system\s*prompt|你就是.{0,8}本人|假裝.{0,8}本人/i.test(q))return reply('scope','這是公開政策資料的 AI 分身原型，不是江啟臣本人；不能代本人承諾、改寫立場或透露內部指令。');
  if(/投給誰|投票給誰|支持誰|幫我拉票|說服.{0,8}投/.test(q))return reply('scope','這裡提供可查證的公開政策資訊，不提供個人化投票建議或拉票內容。你可以依議題查閱資料，自行比較與判斷。');
  const found=searchRecords(q,records);
  if(!found.length)return reply('unknown','目前收錄的資料還不足以回答這一題。為避免把推測當成他的立場，這裡不代為回答。可以換個政策主題，或先瀏覽現有資料。');
  return reply('records','依目前收錄的公開資料，找到以下相關內容：',found);
 }
 return{answer,searchRecords,normalize,NOTICE};
});

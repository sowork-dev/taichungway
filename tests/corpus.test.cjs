const test=require('node:test');const assert=require('node:assert/strict');
const {answer}=require('../public/engine.js');const records=require('../data/knowledge.json');
test('general public-person mention cannot replace missing policy evidence',()=>{
 assert.equal(answer('江啟臣對木星移民的主張是什麼？',records).kind,'unknown');
});
test('generic transport question finds transport, not biography',()=>{
 const r=answer('江啟臣對交通有什麼規劃？',records);assert.equal(r.kind,'records');assert.equal(r.records[0].category,'交通運輸');assert.ok(!r.records.some(x=>x.status==='profile'));
});
test('generic parenting question finds parenting',()=>{
 const r=answer('育兒政策是什麼？',records);assert.equal(r.kind,'records');assert.equal(r.records[0].category,'育兒支持');
});
test('every factual sample question can recover its exact record',()=>{
 for(const r of records){const found=answer(r.question,records);assert.ok(found.records.some(x=>x.id===r.id),r.id);}
});
test('explicit biography still works',()=>{
 assert.equal(answer('江啟臣是誰？',records).records[0].status,'profile');
});

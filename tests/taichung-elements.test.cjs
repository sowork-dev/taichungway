const test=require('node:test');const assert=require('node:assert/strict');
const T=require('../public/taichung-elements.js');
test('Taichung scene palette covers five zones without presenting game coordinates as geography',()=>{
 assert.deepEqual(Object.keys(T.ZONES).sort(),['connection','culture','innovation','living','nature']);
 assert.match(T.MAP_NOTICE,/非比例/);
 assert.equal(T.ZONES.living.label,'舊城生活');
 assert.equal(T.ZONES.innovation.label,'水湳創新');
 assert.equal(T.ZONES.nature.label,'山城田野');
 assert.equal(T.ZONES.connection.label,'海線門戶');
 assert.ok(T.REFERENCES.length>=8);
 for(const r of T.REFERENCES){assert.match(r.sourceUrl,/^https:\/\/(?:[\w-]+\.)*(?:taichung\.gov\.tw|taichung\.travel|culture\.tw|npac-ntt\.org)\//);assert.equal(r.rights,'reference-only-original-drawing');assert.ok(r.realArea);}
});
test('each local landmark has an original canvas drawing rather than downloaded artwork',()=>{
 const calls=[];const ctx=new Proxy({}, {get(o,k){return (...args)=>calls.push([k,args]);},set(o,k,v){o[k]=v;return true;}});
 for(const kind of ['station','market','theater','expo','mushroom','hakka','windmill']){calls.length=0;assert.equal(T.draw(ctx,kind,40,120,210,145,0),true,kind);assert.ok(calls.length>12,kind);}
 assert.equal(T.draw(ctx,'unrecognized',0,0,10,10,0),false);
});

'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPlayServer}=require('../server/play-server.cjs');
test('metrics endpoint hands only origin status to aggregate collector, not client IP',async t=>{
 let context;
 const server=createPlayServer({metrics:async(req,res,ctx)=>{context=ctx;for await(const part of req){};res.writeHead(204);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.closePlay());
 const url='http://127.0.0.1:'+server.address().port;
 const r=await fetch(url+'/api/metrics',{method:'POST',headers:{'content-type':'application/json',origin:url},body:JSON.stringify({type:'page_view',page:'/'})});
 assert.equal(r.status,204);assert.deepEqual(context,{originAllowed:true});
 for(const path of ['/api/metrics','/metrics.json','/analytics.json'])assert.equal((await fetch(url+path)).status,404);
});

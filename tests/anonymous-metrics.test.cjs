'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createMetricsHandler}=require('../server/anonymous-metrics.cjs');

async function boot(t,opts={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'anonymous-metrics-'));
 const filePath=opts.filePath||path.join(dir,'metrics.json');
 const handler=createMetricsHandler({filePath,...opts});
 const server=http.createServer((req,res)=>handler(req,res,{originAllowed:req.headers.origin==='https://site.example'}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port+'/api/metrics';
 const post=(body={type:'page_view',page:'/'},headers={})=>fetch(url,{method:'POST',headers:{origin:'https://site.example','content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 return{dir,filePath,post,url,server,read:async()=>JSON.parse(await fs.readFile(filePath,'utf8'))};
}
const PAGES=['/','/chat.html','/adventure.html','/bubble.html','/policies.html','/comic/','/check/','/postcard/','/postcard/m/','/fortune/','/flavor/','/privacy/'];
const FEATURES=['/chat.html','/adventure.html','/bubble.html','/comic/','/check/','/postcard/','/postcard/m/','/fortune/','/flavor/'];
async function absent(filePath){await assert.rejects(fs.stat(filePath),{code:'ENOENT'});}

test('validates origin, media type, size and exact event schema without saving rejects',async t=>{
 const s=await boot(t,{enabled:true});
 assert.equal((await s.post(undefined,{origin:'https://evil.example'})).status,403);
 assert.equal((await s.post(undefined,{'content-type':'text/plain'})).status,415);
 const invalid=['{','null','[]','42','"hello"',{}, {type:'page_view'}, {type:'unknown',page:'/'}, {type:'page_view',page:'/',email:'private@example.com'}, {type:'page_view',page:'/',__proto__:null,extra:null}];
 for(const page of ['https://site.example/','/?email=private@example.com','/#private','/unknown/','/chat.html/','/CHAT.html','/postcard/m/private','//','/../','/%63omic/','0912345678',null,1,{}])invalid.push({type:'page_view',page});
 for(const page of PAGES.filter(p=>!FEATURES.includes(p)))invalid.push({type:'feature_use',page});
 for(const body of invalid)assert.equal((await s.post(body)).status,400,JSON.stringify(body));
 assert.equal((await s.post(' '.repeat(513))).status,413);
 assert.equal((await s.post('漢'.repeat(171))).status,413,'byte count, not character count');
 await absent(s.filePath);
});

test('QA validates but never records and opt-out requests never touch storage',async t=>{
 const s=await boot(t,{enabled:true});
 const qa=await s.post(undefined,{'x-analytics-test':'1'});
 assert.equal(qa.status,204);assert.equal(qa.headers.get('x-analytics-recorded'),'0');assert.equal(qa.headers.get('x-analytics-test'),'1');
 assert.equal((await s.post({type:'page_view',page:'/?private=yes'},{'x-analytics-test':'1'})).status,400);
 for(const headers of [{dnt:'1'},{'sec-gpc':'1'},{dnt:'1','x-analytics-test':'1'}]){
  const r=await s.post(undefined,headers);assert.equal(r.status,204);assert.equal(r.headers.get('x-analytics-recorded'),'0');
 }
 await absent(s.filePath);
});

test('records only daily allowlisted aggregates in a private atomically replaced file',async t=>{
 const instant=Date.parse('2026-10-27T01:02:03.456Z');const s=await boot(t,{enabled:true,now:()=>instant});
 const headers={'user-agent':'PRIVATE-UA',referer:'https://private.example/?secret=1',cookie:'user=PRIVATE-USER','x-forwarded-for':'192.0.2.99'};
 for(const page of PAGES){const r=await s.post({type:'page_view',page},headers);assert.equal(r.status,204);assert.equal(r.headers.get('x-analytics-recorded'),'1');assert.equal(await r.text(),'');}
 for(const page of FEATURES)assert.equal((await s.post({type:'feature_use',page})).status,204);
 const expected={};for(const page of PAGES)expected[page]={pageViews:1,featureUses:FEATURES.includes(page)?1:0};
 assert.deepEqual(await s.read(),{version:1,startedAt:'2026-10-27T01:02:03.456Z',timezone:'Asia/Taipei',retentionDays:90,days:{'2026-10-27':{pages:expected}}});
 assert.equal((await fs.stat(s.filePath)).mode&0o777,0o600);
 assert.deepEqual(await fs.readdir(s.dir),['metrics.json']);
 const raw=await fs.readFile(s.filePath,'utf8');assert.doesNotMatch(raw,/PRIVATE|192\.0\.2|referrer|referer|cookie|session|userId|timestamp|rawquery/i);
 const before=raw;await s.post(undefined,{'x-analytics-test':'1'});await s.post(undefined,{dnt:'1'});await s.post(undefined,{'sec-gpc':'1'});assert.equal(await fs.readFile(s.filePath,'utf8'),before);
});

test('serializes concurrent updates and reloads committed counts after restart',async t=>{
 const now=()=>Date.parse('2026-10-27T02:00:00Z');const s=await boot(t,{enabled:true,now});
 const replies=await Promise.all(Array.from({length:80},(_,i)=>s.post({type:i%2?'feature_use':'page_view',page:'/chat.html'})));
 for(const r of replies){assert.equal(r.status,204);assert.equal(r.headers.get('x-analytics-recorded'),'1');}
 assert.deepEqual((await s.read()).days['2026-10-27'].pages['/chat.html'],{pageViews:40,featureUses:40});
 const restarted=await boot(t,{enabled:true,now,filePath:s.filePath});
 assert.equal((await restarted.post({type:'page_view',page:'/chat.html'})).status,204);
 assert.deepEqual((await s.read()).days['2026-10-27'].pages['/chat.html'],{pageViews:41,featureUses:40});
});

test('Taipei midnight, not UTC midnight, determines daily buckets',async t=>{
 let instant=Date.parse('2026-12-31T15:59:59.999Z');const s=await boot(t,{enabled:true,now:()=>instant});
 await s.post();instant=Date.parse('2026-12-31T16:00:00.000Z');await s.post();
 assert.deepEqual(Object.keys((await s.read()).days),['2026-12-31','2027-01-01']);
 assert.equal((await s.read()).startedAt,'2026-12-31T15:59:59.999Z');
});

test('prunes to the inclusive latest 90 Taipei calendar days across gaps and year boundaries',async t=>{
 let instant=Date.parse('2025-12-01T04:00:00Z');const s=await boot(t,{enabled:true,now:()=>instant});
 for(let i=0;i<100;i++){await s.post();instant+=24*60*60*1000;}
 const state=await s.read();const keys=Object.keys(state.days).sort();
 assert.equal(keys.length,90);assert.equal(keys[0],'2025-12-11');assert.equal(keys.at(-1),'2026-03-10');
 instant=Date.parse('2026-12-31T16:00:00Z');await s.post();
 assert.deepEqual(Object.keys((await s.read()).days),['2027-01-01']);
});

test('corrupt or schema-unsafe stored data fails closed without overwriting or exposing contents',async t=>{
 const s=await boot(t,{enabled:true,now:()=>Date.parse('2026-10-27T01:00:00Z')});await s.post();const original=await s.read();
 const corrupt=['{private-secret', 'null', '[]', '{}'];
 const mutations=[state=>state.version=2,state=>state.timezone='UTC',state=>state.startedAt='not-a-date',state=>state.retentionDays=91,state=>state.private='private-secret',state=>state.days['2026-02-30']={pages:{}},state=>state.days['2026-10-27'].private='private-secret',state=>state.days['2026-10-27'].pages['/?private=1']={pageViews:1,featureUses:0},state=>state.days['2026-10-27'].pages['/'].pageViews=-1,state=>state.days['2026-10-27'].pages['/'].pageViews='1',state=>state.days['2026-10-27'].pages['/'].pageViews=1.5,state=>state.days['2026-10-27'].pages['/'].featureUses=1,state=>state.days['2026-10-27'].pages['/'].userId='private-secret'];
 for(const mutate of mutations){const state=structuredClone(original);mutate(state);corrupt.push(JSON.stringify(state));}
 for(const raw of corrupt){
  await fs.writeFile(s.filePath,raw);const r=await s.post();assert.equal(r.status,503,raw);assert.notEqual(r.headers.get('x-analytics-recorded'),'1');assert.doesNotMatch(await r.text(),/private|secret|metrics\.json/);assert.equal(await fs.readFile(s.filePath,'utf8'),raw);
 }
 await fs.writeFile(s.filePath,JSON.stringify(original));assert.equal((await s.post()).status,204);assert.equal((await s.read()).days['2026-10-27'].pages['/'].pageViews,2);
});

test('rejects unsafe retention settings and honors a shorter retention window',async t=>{
 for(const retentionDays of [0,-1,91,Infinity,NaN,1.5,'90',null])assert.throws(()=>createMetricsHandler({filePath:'/unused',enabled:true,retentionDays}),TypeError);
 let instant=Date.parse('2026-01-01T12:00:00Z');const s=await boot(t,{enabled:true,retentionDays:3,now:()=>instant});
 for(let i=0;i<5;i++){assert.equal((await s.post()).status,204);instant+=24*60*60*1000;}
 assert.equal((await s.read()).retentionDays,3);assert.deepEqual(Object.keys((await s.read()).days),['2026-01-03','2026-01-04','2026-01-05']);
});

test('opt-out ignores even unsafe bodies and disabled QA still validates without storage',async t=>{
 const enabled=await boot(t,{enabled:true});
 for(const headers of [{dnt:'1'},{'sec-gpc':'1'}]){
  const r=await enabled.post('unsafe secret input',headers);assert.equal(r.status,204);assert.equal(r.headers.get('x-analytics-recorded'),'0');
 }
 const disabled=await boot(t);
 const qa=await disabled.post(undefined,{'x-analytics-test':'1'});assert.equal(qa.status,204);assert.equal(qa.headers.get('x-analytics-test'),'1');assert.equal(qa.headers.get('x-analytics-recorded'),'0');
 assert.equal((await disabled.post('invalid',{'x-analytics-test':'1'})).status,400);
 await absent(enabled.filePath);await absent(disabled.filePath);
});

test('aborted request bodies never produce an unhandled rejection or a count',async t=>{
 const s=await boot(t,{enabled:true});let client;
 const aborted=new Promise(resolve=>s.server.once('request',req=>{req.once('aborted',resolve);client.destroy();}));
 client=http.request(s.url,{method:'POST',headers:{origin:'https://site.example','content-type':'application/json','content-length':'100'}});client.on('error',()=>{});client.write('{');
 await aborted;await new Promise(resolve=>setImmediate(resolve));await absent(s.filePath);
 assert.equal((await s.post()).status,204);
});

test('512-byte boundary is inclusive and oversized chunked bodies receive 413 before end',async t=>{
 const s=await boot(t,{enabled:true});const body=JSON.stringify({type:'page_view',page:'/'}).padEnd(512,' ');
 assert.equal(Buffer.byteLength(body),512);assert.equal((await s.post(body,{'content-type':'application/json; charset=utf-8','x-analytics-test':'1'})).status,204);
 const status=await new Promise((resolve,reject)=>{
  const client=http.request(s.url,{method:'POST',headers:{origin:'https://site.example','content-type':'application/json','transfer-encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode);client.end();});
  client.on('error',reject);client.write(' '.repeat(256));setImmediate(()=>client.write(' '.repeat(257)));
 });
 assert.equal(status,413);await absent(s.filePath);
});

test('safe-integer counter overflow fails closed instead of saving inaccurate totals',async t=>{
 const s=await boot(t,{enabled:true,now:()=>Date.parse('2026-10-27T01:00:00Z')});await s.post();const state=await s.read();state.days['2026-10-27'].pages['/'].pageViews=Number.MAX_SAFE_INTEGER;
 const raw=JSON.stringify(state);await fs.writeFile(s.filePath,raw);const r=await s.post();assert.equal(r.status,503);assert.equal(r.headers.get('x-analytics-recorded'),'0');assert.equal(await fs.readFile(s.filePath,'utf8'),raw);
});

test('disk write failure returns generic 503 and the queue recovers after directory provisioning',async t=>{
 const owner=await boot(t);const parent=path.join(owner.dir,'provisioned');const s=await boot(t,{enabled:true,filePath:path.join(parent,'metrics.json')});
 const r=await s.post();assert.equal(r.status,503);assert.equal(r.headers.get('x-analytics-recorded'),'0');assert.doesNotMatch(await r.text(),/ENOENT|provisioned|metrics/);await absent(parent);
 await fs.mkdir(parent,{mode:0o700});assert.equal((await s.post()).status,204);
 const state=await s.read();assert.equal(Object.values(state.days)[0].pages['/'].pageViews,1);assert.deepEqual(await fs.readdir(parent),['metrics.json']);
});

test('rejects duplicate JSON fields including overwritten unsafe values',async t=>{
 const s=await boot(t,{enabled:true});
 for(const raw of ['{"type":"page_view","page":"private@example.com","page":"/"}','{"type":"private-secret","type":"page_view","page":"/"}','{"type":"page_view","page":"/","pa\\u0067e":"/"}'])assert.equal((await s.post(raw)).status,400);
 await absent(s.filePath);
});

test('restart applies a shorter configured retention policy without resetting existing sums',async t=>{
 let instant=Date.parse('2026-10-01T01:00:00Z');const s=await boot(t,{enabled:true,now:()=>instant});await s.post();
 instant=Date.parse('2026-10-27T01:00:00Z');await s.post();const startedAt=(await s.read()).startedAt;
 const restarted=await boot(t,{enabled:true,filePath:s.filePath,retentionDays:3,now:()=>instant});await restarted.post();
 const state=await s.read();assert.equal(state.retentionDays,3);assert.equal(state.startedAt,startedAt);assert.deepEqual(Object.keys(state.days),['2026-10-27']);assert.equal(state.days['2026-10-27'].pages['/'].pageViews,2);
});

test('a backwards calendar clock fails closed rather than deleting future committed counts',async t=>{
 let instant=Date.parse('2026-10-27T01:00:00Z');const s=await boot(t,{enabled:true,now:()=>instant});await s.post();const raw=await fs.readFile(s.filePath,'utf8');
 instant=Date.parse('2026-10-26T01:00:00Z');assert.equal((await s.post()).status,503);assert.equal(await fs.readFile(s.filePath,'utf8'),raw);
 instant=Date.parse('2026-10-27T01:00:00Z');assert.equal((await s.post()).status,204);assert.equal((await s.read()).days['2026-10-27'].pages['/'].pageViews,2);
});

test('disabled by default returns 204 without creating storage',async t=>{
 const s=await boot(t);const r=await s.post();assert.equal(r.status,204);assert.notEqual(r.headers.get('x-analytics-recorded'),'1');await absent(s.filePath);
});

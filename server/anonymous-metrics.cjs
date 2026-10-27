'use strict';
const fs=require('node:fs/promises');
const {randomUUID}=require('node:crypto');
const dayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
function taipeiDay(instant){
 const parts=Object.fromEntries(dayFormatter.formatToParts(instant).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
async function save(filePath,state){
 const temporary=filePath+'.'+randomUUID()+'.tmp';let handle;
 try{
  handle=await fs.open(temporary,'wx',0o600);
  await handle.writeFile(JSON.stringify(state)+'\n','utf8');await handle.sync();await handle.close();handle=null;
  await fs.rename(temporary,filePath);
 }finally{if(handle)await handle.close().catch(()=>{});await fs.unlink(temporary).catch(()=>{});}
}
const PAGES=new Set(['/','/chat.html','/adventure.html','/bubble.html','/policies.html','/comic/','/check/','/postcard/','/postcard/m/','/fortune/','/flavor/','/privacy/']);
const FEATURES=new Set(['/chat.html','/adventure.html','/bubble.html','/comic/','/check/','/postcard/','/postcard/m/','/fortune/','/flavor/']);
function exactKeys(value,keys){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
function validState(state){
 if(!exactKeys(state,['version','startedAt','timezone','retentionDays','days'])||state.version!==1||state.timezone!=='Asia/Taipei'||
  !Number.isInteger(state.retentionDays)||state.retentionDays<1||state.retentionDays>90||typeof state.startedAt!=='string'||
  !Number.isFinite(Date.parse(state.startedAt))||new Date(state.startedAt).toISOString()!==state.startedAt||
  state.days===null||typeof state.days!=='object'||Array.isArray(state.days))return false;
 for(const [day,bucket] of Object.entries(state.days)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||
   !exactKeys(bucket,['pages'])||bucket.pages===null||typeof bucket.pages!=='object'||Array.isArray(bucket.pages))return false;
  for(const [page,counts] of Object.entries(bucket.pages)){
   if(!PAGES.has(page)||!exactKeys(counts,['pageViews','featureUses'])||
    !Number.isSafeInteger(counts.pageViews)||counts.pageViews<0||!Number.isSafeInteger(counts.featureUses)||counts.featureUses<0||
    (!FEATURES.has(page)&&counts.featureUses!==0))return false;
  }
 }
 return true;
}
function reply(res,status){res.writeHead(status);res.end();}
function validEvent(event){
 return event!==null&&typeof event==='object'&&!Array.isArray(event)&&
  Object.keys(event).length===2&&Object.hasOwn(event,'type')&&Object.hasOwn(event,'page')&&
  (event.type==='page_view'?PAGES.has(event.page):event.type==='feature_use'&&FEATURES.has(event.page));
}
async function readEvent(req){
 let size=0;const chunks=[];
 try{
  for await(const chunk of req){size+=chunk.length;if(size>512)return{status:413};chunks.push(chunk);}
  const text=Buffer.concat(chunks).toString('utf8');const event=JSON.parse(text);
  // A validated event is flat with two string values: count lexical member
  // names as well, so duplicate keys cannot hide an overwritten unsafe value.
  if(!validEvent(event)||[...text.matchAll(/"(?:[^"\\]|\\.)*"\s*:/g)].length!==2)return{status:400};
  return{event};
 }catch{return{status:400};}
}
function createMetricsHandler({filePath,enabled=false,now=Date.now,retentionDays=90}){
 if(!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>90)throw new TypeError('retentionDays must be an integer from 1 to 90');
 // One handler owns one file; the parent must reuse it for all requests.
 let queue=Promise.resolve();
 return async function metrics(req,res,ctx={}){
  const qa=req.headers['x-analytics-test']==='1';
  if(qa)res.setHeader('X-Analytics-Test','1');
  res.setHeader('X-Analytics-Recorded','0');
  if(!qa&&(!enabled||req.headers.dnt==='1'||req.headers['sec-gpc']==='1'))return reply(res,204);
  if(ctx.originAllowed!==true)return reply(res,403);
  if(!/^application\/json(?:\s*;[^\r\n]*)?$/i.test(req.headers['content-type']||''))return reply(res,415);
  const parsed=await readEvent(req);
  if(parsed.status)return reply(res,parsed.status);
  if(qa)return reply(res,204);
  const update=queue.then(async()=>{
   const instant=now();const day=taipeiDay(instant);let state;
   try{state=JSON.parse(await fs.readFile(filePath,'utf8'));}
   catch(error){if(error.code!=='ENOENT')throw error;state={version:1,startedAt:new Date(instant).toISOString(),timezone:'Asia/Taipei',retentionDays,days:{}};}
   if(!validState(state)||Object.keys(state.days).some(storedDay=>storedDay>day))throw new Error('Invalid metrics state');
   state.retentionDays=retentionDays;
   // Interpret the Taipei calendar label as a date for calendar arithmetic only.
   const cutoff=new Date(day+'T00:00:00.000Z');cutoff.setUTCDate(cutoff.getUTCDate()-retentionDays+1);
   const earliest=cutoff.toISOString().slice(0,10);
   for(const storedDay of Object.keys(state.days))if(storedDay<earliest)delete state.days[storedDay];
   const pages=(state.days[day]??={pages:{}}).pages;
   const counts=(pages[parsed.event.page]??={pageViews:0,featureUses:0});
   counts[parsed.event.type==='page_view'?'pageViews':'featureUses']++;
   if(!validState(state))throw new Error('Invalid metrics state');
   await save(filePath,state);
  });
  queue=update.catch(()=>{});
  try{await update;res.setHeader('X-Analytics-Recorded','1');reply(res,204);}
  catch{reply(res,503);}
 };
}
module.exports={createMetricsHandler};

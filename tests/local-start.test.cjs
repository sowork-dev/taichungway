'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
test('documented local launcher serves real game, WS health, and preserved policy library',{timeout:18000},async t=>{
 const child=spawn(process.execPath,['server/local.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 let err='';child.stderr.on('data',b=>{err+=b;});
 t.after(async()=>{if(child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},1500);child.once('exit',()=>{clearTimeout(timer);resolve();});});}});
 const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('local launcher did not become ready: '+err)),7000);child.stdout.on('data',b=>{out+=b;try{const data=JSON.parse(out.trim());if(data.url){clearTimeout(timer);resolve(data.url);}}catch{}});child.once('exit',c=>{clearTimeout(timer);reject(Error('local launcher exited '+c+': '+err));});});
 assert.match(url,/^http:\/\/127\.0\.0\.1:\d+$/);
 const health=await(await fetch(url+'/api/play/health')).json();assert.equal(health.ok,true);assert.equal(health.mode,'realtime');
 const home=await(await fetch(url)).text();assert.match(home,/id="form"/);assert.match(home,/啟臣，聊一下/);assert.doesNotMatch(home,/questCanvas/);
 const adventure=await(await fetch(url+'/adventure.html')).text();assert.match(adventure,/id="questCanvas"/);
 const bubble=await(await fetch(url+'/bubble.html')).text();assert.match(bubble,/id="startGame"/);assert.match(bubble,/id="avatarDisclosure"/);assert.doesNotMatch(bubble,/id="pkQuestion"/);
 for(const asset of ['/arena-core.js','/play.js','/play.css','/policies.html','/chat.js','/chat.css','/chat.html','/gamekit.css','/pop.css','/passport.css','/passport.js'])assert.equal((await fetch(url+asset)).status,200,asset);
 const records=await(await fetch(url+'/knowledge.json')).json();assert.equal(records.length,100);
});

/* Original civic-game UI: explore a fictional city, use sourced policy cards, then question the limits. */
(function(){
'use strict';
if(!window.QuestCore)return;
const C=window.QuestCore,s=C.createState(),q=document.getElementById('questDialog');
const canvas=document.getElementById('questCanvas'),ctx=canvas.getContext('2d');
const mini=document.getElementById('questMinimap'),mc=mini.getContext('2d');
const demo=document.getElementById('missionCanvas'),dc=demo.getContext('2d');
const get=id=>document.getElementById(id),keys=new Set();
let width=390,height=500,scale=.65,cameraY=0,active=true,last=0,walk=false,dashUntil=0,joy={x:0,y:0},joyPointer=null,showTimer=0,demoStarted=0,returnFromChat=false,frame=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mechanisms={
 'transport-public-transit':['路網與班次','轉乘銜接','通勤支持'],
 'transport-smart-roads':['辨識車流','調節號誌','道路管理'],
 'parenting-childcare':['找托育資源','預約與媒合','托育支援'],
 'parenting-family-support':['察覺照顧壓力','心理與到宅支持','家庭支持網'],
 'senior-care-single-window':['提出照護需求','整合服務窗口','評估與照顧串接']
};
function currentMission(){return C.MISSIONS.find(m=>m.id===s.missionId);}
function record(id){return records.find(r=>r.id===id);}
function clearInput(){keys.clear();joy={x:0,y:0};joyPointer=null;get('questStick').style.transform='translate(0,0)';}
function resize(){const r=get('questStage').getBoundingClientRect();if(r.width<1||r.height<1)return;width=r.width;height=r.height;scale=width/600;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);ctx.setTransform(d,0,0,d,0,0);}
function rr(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function text(c,value,x,y,size=16,color='#eef0d9',align='left'){c.font='700 '+size+'px -apple-system,"PingFang TC",sans-serif';c.textAlign=align;c.fillStyle=color;c.fillText(value,x,y);}
function tree(x,y){ctx.fillStyle='#445942';ctx.fillRect(x-3,y-20,6,25);ctx.fillStyle='#567c54';ctx.beginPath();ctx.arc(x,y-30,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6f965e';ctx.beginPath();ctx.arc(x-4,y-36,13,0,Math.PI*2);ctx.fill();}
function building(x,y,w,h,color,label,type){
 ctx.fillStyle='#334d3b35';ctx.beginPath();ctx.moveTo(x+14,y+15);ctx.lineTo(x+w+21,y+17);ctx.lineTo(x+w+21,y+h+30);ctx.lineTo(x+15,y+h+30);ctx.fill();
 rr(ctx,x,y,w,h,5,color,'#4d665b');ctx.fillStyle='#6f806c';ctx.fillRect(x+6,y+h-12,w-12,23);rr(ctx,x-5,y-12,w+10,27,3,'#e6dcc0','#778978');
 for(let i=0;i<4;i++){rr(ctx,x+15+i*48,y+30,30,31,2,'#628c90','#4a7277');ctx.fillStyle='#b4d2b5';ctx.fillRect(x+18+i*48,y+32,7,27);}
 rr(ctx,x+w/2-22,y+h-49,44,55,1,'#415c5d','#a4b6a0');ctx.fillStyle='#c9d4b4';ctx.fillRect(x+w/2-1,y+h-46,2,48);
 rr(ctx,x+20,y+73,w-40,27,3,'#f5e8b7','#b8b18e');text(ctx,label,x+w/2,y+92,16,'#456454','center');
 if(type==='care'){ctx.fillStyle='#bd796c';ctx.fillRect(x+w/2-5,y+26,10,34);ctx.fillRect(x+w/2-17,y+38,34,10);}
 if(type==='child'){ctx.fillStyle='#b6ca8a';ctx.beginPath();ctx.arc(x+30,y+10,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e5bb80';ctx.beginPath();ctx.arc(x+w-28,y+10,13,0,Math.PI*2);ctx.fill();}
}
function person(c,x,y,color,time,hero=false,moving=false){
 const bob=moving?Math.sin(time*14)*2:0,foot=moving?Math.sin(time*14)*4:0;c.save();c.translate(x,y+bob);
 c.fillStyle='#193e4530';c.beginPath();c.ellipse(0,0,hero?20:12,hero?7:4,0,0,Math.PI*2);c.fill();const z=hero?1:.64;c.scale(z,z);
 rr(c,-12,-23+foot,10,23,2,'#263f4b');rr(c,3,-23-foot,10,23,2,'#263f4b');rr(c,-15,-3+foot,15,7,2,'#19323d');rr(c,1,-3-foot,16,7,2,'#19323d');
 rr(c,-19,-49,38,31,6,color,'#294655');c.fillStyle='#f3eee0';c.beginPath();c.moveTo(-7,-48);c.lineTo(8,-48);c.lineTo(0,-24);c.fill();
 rr(c,-25,-45,8,23,3,color);rr(c,17,-45,8,23,3,color);rr(c,-25,-25,8,8,3,'#e6bc99');rr(c,18,-25,8,8,3,'#e6bc99');
 rr(c,-25,-91,50,45,16,'#efd0a9','#aa997b');rr(c,-28,-77,6,12,3,'#e2b991');rr(c,22,-77,6,12,3,'#e2b991');
 c.fillStyle='#414b44';c.beginPath();c.moveTo(-25,-69);c.lineTo(-27,-83);c.quadraticCurveTo(-23,-105,5,-98);c.quadraticCurveTo(27,-100,26,-80);c.lineTo(24,-69);c.lineTo(18,-84);c.quadraticCurveTo(2,-83,-1,-91);c.quadraticCurveTo(-9,-79,-22,-80);c.fill();
 if(hero){c.strokeStyle='#838c77';c.lineWidth=2;c.beginPath();c.moveTo(-20,-87);c.lineTo(-2,-94);c.stroke();}
 const blink=!reduced&&(time%5.2>5.0);c.fillStyle='#35433c';c.fillRect(-12,-72,3,blink?1:4);c.fillRect(10,-72,3,blink?1:4);
 if(hero){rr(c,-20,-77,17,14,4,null,'#71867e');rr(c,4,-77,17,14,4,null,'#71867e');c.beginPath();c.moveTo(-3,-72);c.lineTo(4,-72);c.stroke();}
 c.strokeStyle='#a98069';c.lineWidth=2;c.beginPath();c.moveTo(-7,-56);c.quadraticCurveTo(0,-51,8,-56);c.stroke();c.restore();
}
function marker(m,time){const done=s.completed.includes(m.id),near=C.nearestMission(s,100)?.id===m.id;const y=m.y-108-(reduced?0:Math.sin(time*3)*3);ctx.save();ctx.translate(m.x,y);rr(ctx,-62,-13,124,28,5,done?'#3d685d':'#183b45','#d4c387');text(ctx,m.label,0,6,16,done?'#e6d69c':'#f6e6b4','center');ctx.fillStyle=done?'#9db78e':'#e9c46b';ctx.beginPath();ctx.arc(0,35,near?15:12,0,Math.PI*2);ctx.fill();text(ctx,done?'✓':'!',0,41,17,'#365246','center');ctx.restore();}
function bus(c,x,y,ratio=1){c.save();c.translate(x,y);c.scale(ratio,ratio);rr(c,-36,-24,72,36,5,'#3c8c8b','#2f5a60');rr(c,-30,-18,60,16,2,'#c1d8c1');c.fillStyle='#25434b';c.fillRect(-17,-18,3,16);c.fillRect(8,-18,3,16);c.beginPath();c.arc(-22,13,7,0,Math.PI*2);c.arc(22,13,7,0,Math.PI*2);c.fill();rr(c,-9,2,18,5,1,'#f3d289');c.restore();}
function drawCity(time){
 ctx.clearRect(0,0,width,height);ctx.save();ctx.scale(scale,scale);cameraY=Math.max(0,Math.min(1080-height/scale,s.y-height/scale*.56));ctx.translate(0,-cameraY);
 ctx.fillStyle='#acba9e';ctx.fillRect(0,0,600,1080);ctx.fillStyle='#d1d0b6';ctx.fillRect(24,75,552,300);ctx.fillRect(24,580,552,320);ctx.fillStyle='#c1c5a7';for(let y=80;y<1080;y+=28){ctx.fillRect(0,y,600,1);}for(let x=0;x<600;x+=28){ctx.fillRect(x,0,1,1080);}
 ctx.fillStyle='#5c7377';ctx.fillRect(270,0,60,1080);ctx.fillRect(0,440,600,85);ctx.fillStyle='#768a86';ctx.fillRect(263,0,7,1080);ctx.fillRect(330,0,7,1080);ctx.fillRect(0,433,600,7);ctx.fillRect(0,525,600,7);
 ctx.fillStyle='#d9d2ac';for(let y=0;y<1080;y+=58)ctx.fillRect(298,y,4,28);for(let x=5;x<600;x+=66)ctx.fillRect(x,479,34,3);
 ctx.fillStyle='#dce0c4';for(let i=0;i<7;i++){ctx.fillRect(243+i*17,410,9,23);ctx.fillRect(243+i*17,537,9,23);}
 building(45,125,210,145,'#d2bc96','轉乘站 · 情境','bus');building(345,125,210,145,'#caac8c','親子資源 · 情境','child');building(45,610,210,135,'#d5d7ba','照護窗口 · 情境','care');building(345,610,210,135,'#a4b9a4','政策資料館','library');
 for(const [x,y] of [[20,110],[582,110],[22,330],[577,329],[20,620],[579,620],[25,900],[575,900],[370,930],[445,940]])tree(x,y);
 rr(ctx,365,772,170,37,4,'#365b5c','#e1d6a7');text(ctx,'點資料館，看全部來源',450,796,13,'#efe6bd','center');
 // A moving bus illustrates city life, not a measured policy improvement.
 bus(ctx,reduced?150:70+((time*28)%460),465,.8);
 person(ctx,117,350,'#b68c6b',time,false);person(ctx,174,355,'#7b9e87',time+1,false);person(ctx,449,350,'#b99279',time+2,false);person(ctx,480,359,'#8c9a78',time,false);person(ctx,120,832,'#ad8f71',time,false);person(ctx,177,837,'#7a8e8f',time+1,false);
 for(const m of C.MISSIONS)marker(m,time);
 if(s.path.length){ctx.strokeStyle='#ede3a54f';ctx.lineWidth=4;ctx.setLineDash([5,8]);ctx.beginPath();ctx.moveTo(s.x,s.y);for(const p of s.path)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);}
 person(ctx,s.x,s.y,'#3b6f8c',time,true,walk);rr(ctx,s.x-37,s.y+13,74,23,4,'#173b47e8','#a9bba0');text(ctx,'數位啟臣',s.x,s.y+29,11,'#f6e8bd','center');
 ctx.restore();drawMini();
}
function drawMini(){mc.fillStyle='#213d43';mc.fillRect(0,0,60,108);mc.fillStyle='#728c76';for(const o of C.OBSTACLES)mc.fillRect(o.x/10,o.y/10,o.w/10,o.h/10);mc.fillStyle='#adbb9c';mc.fillRect(27,0,6,108);for(const m of C.MISSIONS){mc.fillStyle=s.completed.includes(m.id)?'#a0c783':'#edc86d';mc.beginPath();mc.arc(m.x/10,m.y/10,2.5,0,Math.PI*2);mc.fill();}mc.fillStyle='#fff6d0';mc.beginPath();mc.arc(s.x/10,s.y/10,2.5,0,Math.PI*2);mc.fill();}
function refresh(){const box=get('homeTopics');box.replaceChildren();for(const [i,m] of C.MISSIONS.entries()){const b=el('button','topic-tile'+(s.completed.includes(m.id)?' completed':''));b.dataset.mission=m.id;b.append(icon(i===0?'train':i===1?'family':'care'),el('span','',(s.completed.includes(m.id)?'✓ ':'')+m.label));b.disabled=!m.policyIds.every(id=>record(id));b.addEventListener('click',()=>go(m.id));box.append(b);}get('questProgress').textContent=s.completed.length+' / 3';}
function go(id){if(corpusState!=='ready'){toast('資料未載入，暫不開始任務。');return;}if(s.paused){toast('先點「繼續走訪」，再選任務。');return;}clearInput();if(C.goToMission(s,id)){get('questGuide').textContent='走近生活難題，再選擇政策卡。';}else toast('這個位置暫時無法抵達。');}
function openMission(id){if(corpusState!=='ready')return;if(!C.selectMission(s,id))return;clearInput();renderMission();if(!q.open)q.showModal();}
function renderMission(){const m=currentMission();if(!m)return;q.dataset.mission=m.id;q.dataset.phase=s.phase;get('questTitle').textContent=m.label;get('questLabel').textContent='生活關卡 '+String(C.MISSIONS.indexOf(m)+1).padStart(2,'0')+' / 03';get('questScenario').textContent=m.scenario;get('questChoose').hidden=s.phase!=='choose';get('questDemonstrate').hidden=s.phase!=='demonstrate';get('questReview').hidden=s.phase!=='review';
 if(s.phase==='choose'){const box=get('policySkills');box.replaceChildren();for(const id of m.policyIds){const r=record(id);if(!r)continue;const b=el('button','policy-skill'+(id===s.selectedPolicyId?' selected':''));b.dataset.policy=id;b.setAttribute('aria-pressed',id===s.selectedPolicyId?'true':'false');b.append(el('span','skill-level','政見技能卡 · 公開提案'),el('strong','',r.title),el('p','',r.summary),el('span','skill-selector',id===s.selectedPolicyId?'✓':''));b.addEventListener('click',()=>{if(C.choosePolicy(s,id))renderMission();});box.append(b);}get('activatePolicy').disabled=!s.selectedPolicyId;get('activatePolicy').textContent=s.selectedPolicyId?'啟用這張卡，看看作用機制 →':'選一張政策卡，再看作用機制';}
 if(s.phase==='review'){const r=record(s.selectedPolicyId);get('reviewPolicyTitle').textContent=r.title;get('reviewSummary').textContent=r.summary;const chain=get('reviewMechanism');chain.replaceChildren();for(const [i,word] of mechanisms[r.id].entries()){if(i)chain.append(el('i','','→'));chain.append(el('span','',word));}get('questSource').href=r.sourceUrl;get('questSource').textContent=r.sourceTitle+' ↗';get('questSourceDates').textContent=(r.sourceDate?'來源發布 '+r.sourceDate:'來源未標示發布日期')+' · 資料核對 '+r.verifiedAt;}
}
function activate(){if(!C.activatePolicy(s))return;demoStarted=performance.now();get('mechanismCopy').textContent='這是把公開主張轉成理解用流程，不是預算、時程或改善成效的預測。';renderMission();clearTimeout(showTimer);showTimer=setTimeout(()=>{if(s.phase==='demonstrate'){C.showReview(s);renderMission();}},reduced?100:1800);}
function closeMission(){clearTimeout(showTimer);returnFromChat=false;C.closeMission(s);if(q.open)q.close();refresh();clearInput();}
function metaQuestion(facet){const r=record(s.selectedPolicyId);if(!r||s.phase!=='review')return;const facets={cost:['這項政策的預算從哪裡來？','目前收錄資料未確認這項政策的整體預算與財源，不能把公開提案當成已核定預算。'],timeline:['這項政策何時能實施？','目前收錄資料未確認這項政策確切的上路或完工日期；不代本人承諾時程。'],eligibility:['這項政策適用哪些人、如何申請？','目前收錄資料未確認正式適用辦法與申請資格。競選主張不等於現行可申請福利，仍須查主管機關公告。']};const info=facets[facet];if(!info)return;returnFromChat=true;q.close();openChat();const msg=el('article','message user');msg.append(el('span','message-label','你對「'+r.title+'」的追問'),el('div','bubble',info[0]));get('messages').append(msg);appendReply({kind:'records',intro:info[1],records:[r],notice:PolicyEngine.NOTICE});}
function drawDemo(time){if(!q.open)return;const m=currentMission();if(!m)return;const chosen=s.selectedPolicyId,used=s.phase!=='choose',p=used?Math.min(1,(performance.now()-demoStarted)/1500):0;const w=720,h=340;dc.clearRect(0,0,w,h);dc.fillStyle='#c7d1b5';dc.fillRect(0,0,w,h);for(let x=0;x<w;x+=30){dc.fillStyle='#afc19a50';dc.fillRect(x,0,1,h);}for(let y=0;y<h;y+=30){dc.fillStyle='#afc19a50';dc.fillRect(0,y,w,1);}text(dc,used?'政策想處理的環節':'生活情境 · 尚未選擇政策卡',25,35,17,'#5c765c');
 if(m.id==='commute'){dc.fillStyle='#6b8586';dc.fillRect(0,150,w,105);dc.fillStyle='#d5d6ad';for(let x=15;x<w;x+=85)dc.fillRect(x,202,42,3);for(const x of [100,590]){dc.fillStyle='#486c65';dc.fillRect(x,90,6,70);rr(dc,x-24,65,56,34,4,'#e9d893','#7a8f73');text(dc,'站',x+4,89,19,'#5b735c','center');}bus(dc,used?100+((reduced?180:time*85)%490):250,192,1.3);person(dc,110,278,'#aa8967',time,false);person(dc,160,278,'#7e9c88',time,false);
 if(used){dc.strokeStyle='#f1d26e';dc.lineWidth=5;dc.setLineDash([10,8]);dc.beginPath();dc.moveTo(110,128);dc.lineTo(110+480*p,128);dc.stroke();dc.setLineDash([]);text(dc,chosen==='transport-smart-roads'?'辨識車流 → 調節號誌':'路網銜接 → 轉乘支持',360,305,21,'#315d59','center');if(chosen==='transport-smart-roads'){rr(dc,350,57,36,78,5,'#365157');for(let i=0;i<3;i++){dc.fillStyle=i===(Math.floor(time)%2?0:2)?['#e69b78','#ead088','#9bbd78'][i]:'#708578';dc.beginPath();dc.arc(368,72+23*i,8,0,Math.PI*2);dc.fill();}}}}
 else{const words=chosen?mechanisms[chosen]:(m.id==='childcare'?['臨時有需要','資源在哪裡？','怎麼找支援？']:['照護需求','不同服務窗口','資訊怎麼串？']);for(let i=0;i<3;i++){const x=120+i*240;rr(dc,x-79,111,158,103,10,used?'#e7edd4':'#d8dcc5','#829e7b');text(dc,words[i],x,175,17,'#476b5b','center');if(i<2){dc.strokeStyle=used?'#d0ad5f':'#8d9e82';dc.lineWidth=5;dc.beginPath();dc.moveTo(x+86,161);dc.lineTo(x+154*(used?p:1),161);dc.stroke();text(dc,'›',x+125,173,36,'#6f8b6a','center');}}person(dc,110,285,'#ac8f76',time,false);person(dc,610,285,'#6d9391',time,false);text(dc,m.id==='childcare'?'找資源、預約與家庭支持（提案）':'照護評估與服務整合（提案）',360,304,20,'#315d59','center');}
}
function input(){return{x:(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0)+joy.x,y:(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0)+joy.y,dash:performance.now()<dashUntil||keys.has('Shift')};}
function tick(t){const dt=Math.min((t-last)/1000,.05)||0;last=t;const blocked=q.open||get('chatDialog').open||get('detailDialog').open;walk=false;if(active&&!blocked&&!document.hidden){const result=C.step(s,input(),dt);walk=result.moved;if(result.arrivedMissionId)openMission(result.arrivedMissionId);}if(active){drawCity(t/1000);if(++frame%8===0){const near=C.nearestMission(s,100);get('questNearby').textContent=near?'附近：'+near.label+' · 按「問」互動':'點地標開始，或拖曳搖桿走近';get('avatarButton').classList.toggle('nearby',!!near);}}if(q.open)drawDemo(t/1000);requestAnimationFrame(tick);}
function pause(value){s.paused=value;get('questPaused').hidden=!value;get('questPause').setAttribute('aria-pressed',String(value));get('questPause').textContent=value?'▶':'Ⅱ';get('questPause').setAttribute('aria-label',value?'繼續角色移動':'暫停角色移動');clearInput();}
function interact(){if(s.paused)return;const m=C.nearestMission(s,100);if(m)openMission(m.id);else openChat();}
get('avatarButton').addEventListener('click',interact);get('questPause').addEventListener('click',()=>pause(!s.paused));get('questResume').addEventListener('click',()=>pause(false));get('questReset').addEventListener('click',()=>{C.resetPosition(s);clearInput();});get('questDash').addEventListener('pointerdown',()=>{dashUntil=performance.now()+550;});get('closeQuest').addEventListener('click',closeMission);q.addEventListener('cancel',e=>{e.preventDefault();closeMission();});get('activatePolicy').addEventListener('click',activate);get('skipDemonstration').addEventListener('click',()=>{clearTimeout(showTimer);if(C.showReview(s))renderMission();});get('completeMission').addEventListener('click',()=>{if(C.completeMission(s)){q.close();refresh();get('questGuide').textContent=s.completed.length===3?'三個議題已走訪。理解政策，不等於支持或投票。':'已理解一個議題，下一個生活難題呢？';}});document.querySelectorAll('[data-meta]').forEach(b=>b.addEventListener('click',()=>metaQuestion(b.dataset.meta)));
get('chatDialog').addEventListener('close',()=>{if(returnFromChat&&s.phase==='review'){returnFromChat=false;renderMission();q.showModal();}});
canvas.addEventListener('pointerup',e=>{if(s.paused||q.open||corpusState!=='ready')return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/scale,y=(e.clientY-r.top)/scale+cameraY;const target=C.MISSIONS.find(m=>Math.hypot(m.x-x,m.y-45-y)<85);if(target){go(target.id);return;}if(x>=345&&x<=555&&y>=610&&y<=815){setView('sources');return;}C.setDestination(s,x,y);});
const joystick=get('questJoystick');function updateJoy(e){const r=joystick.getBoundingClientRect();let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const d=Math.hypot(x,y);if(d>30){x*=30/d;y*=30/d;}joy={x:x/30,y:y/30};get('questStick').style.transform='translate('+x+'px,'+y+'px)';}
joystick.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);updateJoy(e);e.preventDefault();});joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)updateJoy(e);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(ev,()=>{joyPointer=null;joy={x:0,y:0};get('questStick').style.transform='translate(0,0)';});
window.addEventListener('keydown',e=>{if(!active||q.open||get('chatDialog').open||get('detailDialog').open||/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','Shift',' ','j'].includes(k)){e.preventDefault();if(k==='j'&&!e.repeat)interact();else if(k===' ')dashUntil=performance.now()+550;else keys.add(k);}});window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);document.addEventListener('policy:view',e=>{active=e.detail.view==='home';clearInput();if(active)requestAnimationFrame(resize);});document.addEventListener('policy:ready',refresh);new ResizeObserver(resize).observe(get('questStage'));
window.QuestGame={refresh,snapshot:()=>({x:s.x,y:s.y,phase:s.phase,missionId:s.missionId,selectedPolicyId:s.selectedPolicyId,completed:[...s.completed],paused:s.paused,walking:walk}),goToMission:go};if(corpusState==='ready')refresh();resize();requestAnimationFrame(tick);
})();

/* Game-first client. Only direction/goal/action intent leaves the browser.
 * The server owns pickups, carrying, scores, clock, and round results.
 * No account, storage, analytics, fake opponent, or client-awarded points. */
(function(){
'use strict';
const A=window.ArenaCore,T=window.TaichungElements,$=id=>document.getElementById(id);
if(!A||!T){$('networkStatus').textContent='遊戲載入失敗，請重新整理。';$('startGame').disabled=true;return;}
const canvas=$('arenaCanvas'),ctx=canvas.getContext('2d'),mini=$('arenaMini'),mc=mini.getContext('2d');
const colors={bus:'#e7b75e',family:'#bd88b9',care:'#64b5a8'},names={bus:'接駁',family:'托育',care:'照護'},teamColors=['#388cbb','#de7967'];
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
let state=null,you=null,code='',socket=null,connected=false,entering=false,generation=0,lastPacket=0,rtt=120,pingAt=0;
let cw=390,ch=600,scale=1,cam={x:0,y:0},lastFrame=performance.now(),manual={x:0,y:0},stick={x:0,y:0},stickId=null,keys=new Set(),wasManual=false,cursor=null;
let display=new Map(),previous=new Map(),seen=new Set(),floaters=[],toastUntil=0,lastRound=-1,lastPhase='',lobbyTimer=null,connectTimer=null;
const demo=A.createGame({now:Date.now()});A.addPlayer(demo,'preview');const preview=A.snapshot(demo);
const ground=document.createElement('canvas');ground.width=A.WORLD_WIDTH;ground.height=A.WORLD_HEIGHT;const gc=ground.getContext('2d');
function rect(c,x,y,w,h,fill,r=0){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function circle(c,x,y,r,fill){c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function text(c,s,x,y,size=14,fill='#304e42',weight=800){c.fillStyle=fill;c.font=weight+' '+size+'px -apple-system,"PingFang TC",sans-serif';c.textAlign='center';c.fillText(s,x,y);}
function path(c,points,width,color){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();}
function bakeGround(){
 gc.fillStyle='#cbd9b0';gc.fillRect(0,0,ground.width,ground.height);
 for(let y=0;y<1100;y+=38)for(let x=0;x<1200;x+=38){gc.fillStyle=((x+y)/38)%3?'#b8ca971f':'#e4e4be32';gc.fillRect(x,y,35,35);}
 rect(gc,30,42,1140,1004,'#bfcfa5',50);rect(gc,45,57,1110,974,'#d3deb7',42);
 const roads=[[[260,410],[260,525],[400,640],[600,640],[820,640],[940,570],[940,310]],[[600,260],[600,800],[600,880]],[[330,410],[600,410],[850,410]],[[330,920],[430,800],[780,800],[865,920]]];
 roads.forEach(ps=>{path(gc,ps,77,'#b6bea0');path(gc,ps,65,'#ede2bf');path(gc,ps,2,'#d6cbaa');});
 // A symbolic Liuchuan waterfront. Decorative, not real geography or policy evidence.
 path(gc,[[39,420],[85,470],[95,550],[70,625],[37,665]],39,'#89b9b0');path(gc,[[39,420],[85,470],[95,550],[70,625],[37,665]],22,'#a6cbc0');
 for(const [x,y] of [[48,100],[380,120],[800,120],[1150,310],[1135,620],[40,930],[350,1030],[810,1000],[1150,990],[390,340],[820,330]]){
  circle(gc,x+4,y+13,22,'#789a6850');rect(gc,x-3,y-1,7,30,'#8d9170',3);circle(gc,x,y-5,23,'#7e9f68');circle(gc,x-8,y-12,13,'#99b17a');
 }
 A.LANDMARKS.forEach(l=>T.draw(gc,l.kind,l.x,l.y,l.w,l.h,0));
 rect(gc,470,46,260,24,'#f3e8cbd9',10);text(gc,'舊城 · 跑一趟日常',600,63,12,'#597458');
 for(const [x,y] of [[360,280],[780,270],[1090,650],[150,580],[805,940]]){rect(gc,x,y,33,11,'#a18e65',3);rect(gc,x+4,y+11,4,10,'#7e8367');rect(gc,x+25,y+11,4,10,'#7e8367');}
}
bakeGround();
function symbol(c,kind,x,y,k=1){c.save();c.translate(x,y);c.scale(k,k);c.strokeStyle='#fffdf1';c.fillStyle='#fffdf1';c.lineWidth=2.6;c.lineCap='round';
 if(kind==='bus'){rect(c,-12,-10,24,17,'#fffdf1',4);rect(c,-8,-6,7,6,colors.bus,1);rect(c,2,-6,7,6,colors.bus,1);circle(c,-7,9,3,'#fffdf1');circle(c,7,9,3,'#fffdf1');}
 else if(kind==='family'){circle(c,-4,-6,6,'#fffdf1');circle(c,7,-1,4,'#fffdf1');rect(c,-11,2,15,12,'#fffdf1',5);rect(c,4,5,9,9,'#fffdf1',4);}
 else{c.beginPath();c.moveTo(0,11);c.bezierCurveTo(-25,-3,-8,-18,0,-6);c.bezierCurveTo(8,-18,25,-3,0,11);c.fill();}
 c.restore();}
function drawTarget(t,carrying,now){
 const hot=carrying===t.kind,beat=reduced?0:Math.sin(now/180)*3;
 circle(ctx,t.x,t.y+4,49,colors[t.kind]+'5c');circle(ctx,t.x,t.y+4,38,colors[t.kind]);
 if(hot){ctx.strokeStyle='#fffdf2';ctx.lineWidth=5;ctx.beginPath();ctx.arc(t.x,t.y+4,50+beat,0,Math.PI*2);ctx.stroke();}
 circle(ctx,t.x-12,t.y-15,12,'#f1d7b1');rect(ctx,t.x-27,t.y-3,31,33,'#657c65',10);circle(ctx,t.x+16,t.y-10,10,'#e8c59d');rect(ctx,t.x+5,t.y,26,29,'#8d9b78',8);
 circle(ctx,t.x-16,t.y-17,1.4,'#3b5144');circle(ctx,t.x-9,t.y-17,1.4,'#3b5144');
 rect(ctx,t.x-23,t.y-61,46,31,colors[t.kind],11);symbol(ctx,t.kind,t.x,t.y-45,.68);
 rect(ctx,t.x-35,t.y+34,70,25,hot?'#fffdf0':'#fffdf0db',8);text(ctx,t.label,t.x,t.y+51,13);
}
function drawBox(p,now){if(p.active===false)return;const b=reduced?0:Math.sin(now/270+Number(String(p.id).replace(/\D/g,'')))*2;
 circle(ctx,p.x,p.y+9,24,'#46674418');ctx.save();ctx.translate(p.x,p.y-2+b);ctx.rotate(-.045);rect(ctx,-20,-20,40,40,'#3c5c48',7);rect(ctx,-18,-22,36,36,colors[p.kind],6);path(ctx,[[-15,-10],[15,-10]],3,'#fff8');symbol(ctx,p.kind,0,0,.85);ctx.restore();}
function person(p,d,now,isSelf,previewing){
 const col=teamColors[p.team]||teamColors[0],moving=Math.hypot(d.x-d.oldX,d.y-d.oldY)>.05,bob=(!reduced&&moving)?Math.sin(now/90)*2:0;
 ctx.save();ctx.translate(d.x,d.y+bob);circle(ctx,1,5,21,'#2b423a30');
 if(isSelf){ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,5,24,12,0,0,Math.PI*2);ctx.stroke();}
 rect(ctx,-16,-29,32,31,col,10);rect(ctx,-13,-4,10,17,'#3a4e54',4);rect(ctx,3,-4,10,17,'#3a4e54',4);rect(ctx,-17,8,15,6,'#273e45',3);rect(ctx,2,8,15,6,'#273e45',3);
 circle(ctx,0,-46,24,'#f1d5ad');circle(ctx,-23,-45,5,'#e4bf95');circle(ctx,23,-45,5,'#e4bf95');
 ctx.fillStyle='#626d68';ctx.beginPath();ctx.ellipse(0,-56,24,15,0,Math.PI,0);ctx.lineTo(23,-46);ctx.quadraticCurveTo(8,-66,-19,-49);ctx.lineTo(-24,-42);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#3f5450';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-18,-49,15,12,4);ctx.roundRect(3,-49,15,12,4);ctx.moveTo(-3,-44);ctx.lineTo(3,-44);ctx.stroke();circle(ctx,-10,-43,2,'#334840');circle(ctx,10,-43,2,'#334840');path(ctx,[[-5,-31],[0,-29],[5,-31]],1.8,'#a97864');
 rect(ctx,-23,-85,46,18,isSelf?col:'#fffdf0e8',7);text(ctx,previewing?'分身':(isSelf?'你':'對手'),0,-72,11,isSelf?'#fffef3':'#6e5149');
 if(p.carry){rect(ctx,-19,-120,38,31,colors[p.carry],8);symbol(ctx,p.carry,0,-105,.8);}
 if(p.stunUntil>now){text(ctx,'✦',-23,-91,24,'#f2b942');text(ctx,'✧',23,-80,18,'#fffcf1');}
 if(p.dashUntil>now){ctx.strokeStyle='#fffdf5aa';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-28-i*10,-23+i*9);ctx.lineTo(-43-i*10,-23+i*9);ctx.stroke();}}
 ctx.restore();}
function drawDirection(p,target,now){if(!target)return;const dx=target.x-p.x,dy=target.y-p.y,len=Math.hypot(dx,dy);if(len<65)return;
 const a=Math.atan2(dy,dx),r=83+(reduced?0:Math.sin(now/170)*3);ctx.save();ctx.translate(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);ctx.rotate(a);ctx.fillStyle=target.color||colors[target.kind]||'#fff8';ctx.strokeStyle='#fffdf2';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-7,-9);ctx.lineTo(-3,0);ctx.lineTo(-7,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
function resize(){const r=canvas.getBoundingClientRect();cw=Math.max(1,r.width);ch=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe(canvas);resize();
function self(){return state?.players?.find(p=>p.id===you)||null;}
function send(o){if(connected&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(o));}
function resetInput(){keys.clear();manual={x:0,y:0};stick={x:0,y:0};stickId=null;wasManual=false;cursor=null;$('stickKnob').style.transform='translate(0,0)';send({type:'input',x:0,y:0});}
function walkTo(x,y){const p=self();if(!connected||!p||!Number.isFinite(x)||!Number.isFinite(y)||!A.canStand(x,y)||!['practice','playing'].includes(state.phase))return false;
 const route=A.findPath(p.x,p.y,x,y);if(!route.length)return false;resetInput();cursor={x,y,path:route};send({type:'navigate',x,y});return true;}
function screenPoint(x,y){const r=canvas.getBoundingClientRect();return{x:r.left+(x-cam.x)*scale,y:r.top+(y-cam.y)*scale};}
function flash(s,stolen=false){$('eventToast').textContent=s;$('eventToast').classList.toggle('stolen',stolen);$('eventToast').hidden=false;toastUntil=performance.now()+1550;}
function updateHUD(){const p=self(),other=state?.players.find(q=>q.id!==you),phase=state?.phase||'preview';
 $('selfScore').textContent=p?.score??0;$('rivalScore').textContent=other?.score??'—';$('rivalLabel').textContent=other?'對手':'等對手';$('carryText').textContent=p?.carry?'拿著'+names[p.carry]+'補給':'空手';$('rivalCarry').textContent=other?(other.carry?'拿著'+names[other.carry]+'補給':'空手'):'真人加入就開賽';
 const ownCard=document.querySelector('.self-score'),peerCard=document.querySelector('.rival-score');ownCard.style.borderLeftColor=teamColors[p?.team??0];ownCard.style.backgroundColor=p?.team===1?'#f9e8df':'#e5f0f4';peerCard.style.borderRightColor=teamColors[other?.team??1];peerCard.style.backgroundColor=other?.team===0?'#e5f0f4':'#f9e8df';
 $('matchPhase').textContent=phase==='practice'?'自由練習':phase==='countdown'?'真人到場':phase==='playing'?'搶送 PK':phase==='finished'?'本局結束':'同城搶送';
 $('networkStatus').textContent=connected?(phase==='practice'?'邊玩邊等 · 真人可直接加入':phase==='countdown'?'雙方歸零，準備開搶！':''):$('networkStatus').textContent;
 $('gameControls').hidden=!connected;$('entryLayer').hidden=connected;$('inviteButton').hidden=!connected;$('leaveButton').hidden=!connected;$('resultLayer').hidden=phase!=='finished';
 if(phase==='finished'&&p){const w=state.winnerIds||[];$('resultTitle').textContent=w.length===2?'平手，再來！':w.includes(you)?'這局你贏！':'差一點，再來！';$('resultScores').textContent='你 '+p.score+'  :  '+(other?.score??0)+' 對手';$('rematchButton').disabled=!!p.ready;$('rematchButton').textContent=p.ready?'等對手再戰…':'再比一場 ↻';}
}
function accept(packet){if(!packet||packet.type!=='state'||!packet.state||!Array.isArray(packet.state.players))return;
 const old=state;previous=new Map((old?.players||[]).map(p=>[p.id,{x:p.x,y:p.y,at:lastPacket}]));state=packet.state;you=packet.you;code=packet.code;lastPacket=performance.now();connected=true;entering=false;clearTimeout(connectTimer);$('startGame').disabled=false;
 const p=self();if(!p)return;
 if(lastRound!==state.roundId){lastRound=state.roundId;display.clear();resetInput();if(state.players.length===2)flash('真人到場，歸零開賽！');}
 if(state.phase!==lastPhase){if(['countdown','finished'].includes(state.phase))resetInput();if(state.phase==='playing'&&lastPhase==='countdown')flash('開搶！');lastPhase=state.phase;}
 for(const e of state.events||[]){if(seen.has(e.id))continue;seen.add(e.id);if(!old)continue;
  if(e.type==='deliver'){floaters.push({x:e.x,y:e.y,label:'+100',color:colors[e.kind]||'#d9ec76',at:performance.now()});flash(e.playerId===you?'+100 送達！':'對手 +100');}
  if(e.type==='steal'){flash(e.playerId===you?'搶到了！':'補給被攔截！',e.playerId!==you);floaters.push({x:e.x,y:e.y,label:'✦',color:'#ffb978',at:performance.now()});}
 }
 if(seen.size>180)seen=new Set((state.events||[]).map(e=>e.id));floaters=floaters.slice(-20);
 if(cursor&&Math.hypot(p.x-cursor.x,p.y-cursor.y)<15)cursor=null;
 updateHUD();
}
async function enter(wanted){if(entering)return;resetInput();if(socket){generation++;socket.close();socket=null;}connected=false;state=null;you=null;display.clear();lastRound=-1;lastPhase='';seen.clear();entering=true;const gen=++generation;
 $('startGame').disabled=true;$('startGame').textContent='連線中…';$('networkStatus').textContent='';if($('lobbyDialog').open)$('lobbyDialog').close();
 try{const r=await fetch('/api/play/enter',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(wanted?{code:wanted}:{}),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw new Error(r.status===404?'邀請已失效，可直接開新場。':r.status===409?'這場已滿，請加入其他場。':r.status===429?'連線太頻繁，稍等再試。':'暫時無法連線，請稍後再試。');
  const session=await r.json();if(gen!==generation)return;
  if(!/^[A-F0-9]{6}$/.test(session.code)||typeof session.token!=='string'||typeof session.playerId!=='string')throw new Error('連線資料異常，請重新開玩。');
  const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws/play');socket=ws;
  connectTimer=setTimeout(()=>{if(gen===generation&&!connected){ws.close();fail('連線逾時，請重新開玩。');}},8500);
  ws.addEventListener('open',()=>{if(gen!==generation){ws.close();return;}ws.send(JSON.stringify({type:'hello',code:session.code,token:session.token}));});
  ws.addEventListener('message',ev=>{if(gen!==generation)return;let packet;try{packet=JSON.parse(ev.data);}catch{return;}if(packet.type==='pong'){rtt=Math.min(1000,performance.now()-pingAt);return;}accept(packet);});
  ws.addEventListener('close',()=>{if(gen!==generation)return;connected=false;entering=false;clearTimeout(connectTimer);resetInput();$('startGame').disabled=false;$('startGame').textContent='重新加入 ↗';$('networkStatus').textContent='連線已中斷，點重新加入。';$('entryLayer').hidden=false;$('resultLayer').hidden=true;$('gameControls').hidden=true;$('inviteButton').hidden=true;$('leaveButton').hidden=true;state=null;you=null;updateHUD();});
  ws.addEventListener('error',()=>{if(gen===generation)$('networkStatus').textContent='連線暫時中斷。';});
 }catch(e){if(gen===generation)fail(e.name==='TimeoutError'?'連線逾時，請稍後重試。':e.message);}}
function fail(message){connected=false;entering=false;clearTimeout(connectTimer);$('startGame').disabled=false;$('startGame').textContent='重新開玩 ↗';$('networkStatus').textContent=message;state=null;you=null;updateHUD();}
function leave(){resetInput();send({type:'leave'});generation++;clearTimeout(connectTimer);socket?.close();socket=null;connected=false;entering=false;state=null;you=null;code='';display.clear();$('startGame').disabled=false;$('startGame').textContent='立即開玩 ↗';$('networkStatus').textContent='';$('countdownFlash').hidden=true;$('eventToast').hidden=true;updateHUD();}
function action(which){if(connected&&['practice','playing'].includes(state?.phase))send({type:'action',action:which});}
let requested=new URL(location.href).searchParams.get('room');if(requested&&!/^[A-F0-9]{6}$/.test(requested)){requested=null;$('networkStatus').textContent='邀請已失效，可重新開玩。';}if(requested)$('startGame').textContent='加入朋友 ↗';
$('startGame').addEventListener('click',()=>{const first=requested;requested=null;enter(first);});$('leaveButton').addEventListener('click',leave);$('rematchButton').addEventListener('click',()=>send({type:'rematch'}));
$('dashButton').addEventListener('pointerdown',e=>{e.preventDefault();action('dash');});$('tagButton').addEventListener('pointerdown',e=>{e.preventDefault();action('tag');});
canvas.addEventListener('pointerdown',e=>{if(!connected)return;const r=canvas.getBoundingClientRect();let x=cam.x+(e.clientX-r.left)/scale,y=cam.y+(e.clientY-r.top)/scale;
 // Generous touch hitboxes snap a tap to a visible box/citizen, never teleport.
 const items=[...(state.pickups||[]).filter(p=>p.active!==false),...A.TARGETS];let hit=items.filter(p=>Math.hypot(p.x-x,p.y-y)<50).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(hit){x=hit.x;y=hit.y;}walkTo(x,y);});
const stickEl=$('moveStick');function moveStick(e){const r=stickEl.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy),limit=r.width*.30,ratio=Math.min(1,len/limit);stick={x:len>6?dx/len*ratio:0,y:len>6?dy/len*ratio:0};$('stickKnob').style.transform='translate('+(stick.x*limit)+'px,'+(stick.y*limit)+'px)';cursor=null;}
stickEl.addEventListener('pointerdown',e=>{if(!connected)return;e.preventDefault();stickId=e.pointerId;stickEl.setPointerCapture(stickId);moveStick(e);});stickEl.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});
function stopStick(e){if(e.pointerId!==stickId)return;stickId=null;stick={x:0,y:0};$('stickKnob').style.transform='translate(0,0)';send({type:'input',x:0,y:0});wasManual=false;}
stickEl.addEventListener('pointerup',stopStick);stickEl.addEventListener('pointercancel',stopStick);stickEl.addEventListener('lostpointercapture',stopStick);
const directionKeys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
window.addEventListener('keydown',e=>{if(!connected||$('lobbyDialog').open||$('infoDialog').open||e.ctrlKey||e.metaKey||e.altKey)return;if(directionKeys.includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());cursor=null;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)action('dash');}if(e.key.toLowerCase()==='j'){e.preventDefault();if(!e.repeat)action('tag');}});
window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(!keys.size&&!stick.x&&!stick.y){manual={x:0,y:0};send({type:'input',x:0,y:0});wasManual=false;}});window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
setInterval(()=>{if(!connected)return;const x=stick.x+(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),y=stick.y+(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0),n=Math.max(1,Math.hypot(x,y));manual={x:x/n,y:y/n};if(x||y){send({type:'input',x:manual.x,y:manual.y});wasManual=true;}else if(wasManual){send({type:'input',x:0,y:0});wasManual=false;}},50);
setInterval(()=>{if(connected){pingAt=performance.now();send({type:'ping'});}},4000);
async function loadLobby(){try{const r=await fetch('/api/play/lobby',{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error();const data=await r.json();if(!Array.isArray(data.rooms))throw new Error();$('onlineDot').classList.toggle('online',data.online>0);$('onlineCount').textContent=(Number.isFinite(data.online)?data.online:0)+' 人在線';if(!$('lobbyDialog').open)return;
 const host=$('lobbyRooms');host.replaceChildren();const rooms=data.rooms.filter(r=>r.joinable&&r.code!==code);
 for(const room of rooms){const row=document.createElement('div');row.className='room-row';const icons=document.createElement('div');icons.className='room-people';icons.innerHTML='<i></i><i class="empty"></i>';const label=document.createElement('span');label.textContent='真人等你加入';const detail=document.createElement('small');detail.textContent=room.players+'/2 · 正在練習';label.append(detail);const button=document.createElement('button');button.textContent='加入';button.dataset.room=room.code;button.addEventListener('click',()=>enter(room.code));row.append(icons,label,button);host.append(row);}
 if(!rooms.length){const note=document.createElement('p');note.className='lobby-empty';note.textContent=connected?'目前沒有其他可加入的場。':'還沒有人等候，先跑起來！';host.append(note);}
 }catch{if($('lobbyDialog').open){$('onlineCount').textContent='暫時離線';$('lobbyRooms').textContent='無法讀取場次，請稍後再試。';}}}
$('lobbyButton').addEventListener('click',()=>{resetInput();$('lobbyDialog').showModal();loadLobby();clearInterval(lobbyTimer);lobbyTimer=setInterval(loadLobby,2000);});$('closeLobby').addEventListener('click',()=>$('lobbyDialog').close());$('lobbyDialog').addEventListener('close',()=>{clearInterval(lobbyTimer);lobbyTimer=null;});$('lobbyPractice').addEventListener('click',()=>{if(connected)$('lobbyDialog').close();else enter();});
$('infoButton').addEventListener('click',()=>{resetInput();$('infoDialog').showModal();});$('closeInfo').addEventListener('click',()=>$('infoDialog').close());
$('inviteButton').addEventListener('click',async()=>{if(!code||!connected)return;const link=new URL('/',location.origin);link.searchParams.set('room',code);
 try{if(navigator.share){await navigator.share({title:'來臺中搶送',text:'同圖搶補給，一起 PK！',url:link.href});return;}if(navigator.clipboard){await navigator.clipboard.writeText(link.href);flash('邀請連結已複製');return;}}catch(e){if(e.name==='AbortError')return;}
 const host=$('infoDialog').querySelector('.info-copy');host.querySelector('.share-box')?.remove();const field=document.createElement('input');field.className='share-box';field.readOnly=true;field.value=link.href;field.setAttribute('aria-label','朋友邀請連結，長按複製');host.prepend(field);$('infoDialog').showModal();field.focus();field.select();});
loadLobby();
function drawMini(s){mc.clearRect(0,0,84,77);const k=84/A.WORLD_WIDTH;mc.fillStyle='#bad39b44';A.LANDMARKS.filter(l=>!l.decor).forEach(l=>mc.fillRect(l.x*k,l.y*k,l.w*k,l.h*k));A.TARGETS.forEach(t=>circle(mc,t.x*k,t.y*k,2.5,colors[t.kind]));(s.players||[]).forEach(p=>{circle(mc,p.x*k,p.y*k,3.4,p.id===you||!connected?'#fffcec':teamColors[p.team]);});mc.strokeStyle='#fff8';mc.lineWidth=.7;mc.strokeRect(cam.x*k,cam.y*k,cw/scale*k,ch/scale*k);}
function frame(now){const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;const s=state||preview,p=self()||s.players[0],virtualNow=(state?.now||0)+Math.min(200,now-lastPacket);
 const active=['practice','playing'].includes(s.phase);
 (s.players||[]).forEach(q=>{let d=display.get(q.id);if(!d){d={x:q.x,y:q.y,oldX:q.x,oldY:q.y};display.set(q.id,d);}d.oldX=d.x;d.oldY=d.y;
  if(q.id===you&&connected&&active&&(manual.x||manual.y)&&virtualNow>q.stunUntil){const speed=virtualNow<q.dashUntil?A.DASH_SPEED:A.SPEED,nx=d.x+manual.x*speed*dt,ny=d.y+manual.y*speed*dt;if(A.canStand(nx,d.y))d.x=nx;if(A.canStand(d.x,ny))d.y=ny;d.x+=(q.x-d.x)*Math.min(.08,dt);d.y+=(q.y-d.y)*Math.min(.08,dt);}
  else{const prev=previous.get(q.id),age=Math.min(90,now-lastPacket),span=prev?Math.max(50,lastPacket-prev.at):100,vx=prev?(q.x-prev.x)/span:0,vy=prev?(q.y-prev.y)/span:0,tx=q.x+vx*age,ty=q.y+vy*age;d.x+=(tx-d.x)*Math.min(1,dt*20);d.y+=(ty-d.y)*Math.min(1,dt*20);}
  if(Math.hypot(d.x-q.x,d.y-q.y)>105){d.x=q.x;d.y=q.y;}
 });
 const focus=display.get(p?.id)||p||{x:420,y:600};const viewWidth=cw>=700?Math.min(1200,cw*1.15):800;scale=Math.max(cw/viewWidth,ch/A.WORLD_HEIGHT);const visibleWidth=cw/scale,viewHeight=ch/scale,peer=s.players?.find(q=>q.id!==p?.id),shared=connected&&peer&&Math.abs(peer.x-focus.x)<visibleWidth-120;const centerX=shared?(focus.x+peer.x)/2:focus.x;cam.x=Math.max(0,Math.min(Math.max(0,A.WORLD_WIDTH-visibleWidth),centerX-visibleWidth/2));cam.y=Math.max(0,Math.min(Math.max(0,A.WORLD_HEIGHT-viewHeight),focus.y-viewHeight*.56));
 ctx.fillStyle='#b8cda3';ctx.fillRect(0,0,cw,ch);ctx.save();ctx.scale(scale,scale);ctx.translate(-cam.x,-cam.y);ctx.drawImage(ground,0,0);
 A.TARGETS.forEach(t=>drawTarget(t,p?.carry,now));(s.pickups||[]).forEach(b=>drawBox(b,now));
 if(cursor&&p){ctx.strokeStyle='#fffdf29c';ctx.lineWidth=3;ctx.setLineDash([4,9]);ctx.beginPath();ctx.moveTo(p.x,p.y);let current=cursor.path;for(const n of current)if(Math.hypot(n.x-p.x,n.y-p.y)<900)ctx.lineTo(n.x,n.y);ctx.stroke();ctx.setLineDash([]);circle(ctx,cursor.x,cursor.y,7,'#fff9');}
 (s.players||[]).slice().sort((a,b)=>a.y-b.y).forEach(q=>{const d=display.get(q.id)||q;person(q,d,virtualNow,q.id===you||!connected,!connected);});
 if(p){const target=p.carry?A.TARGETS.find(t=>t.kind===p.carry):(s.pickups||[]).filter(b=>b.active!==false).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(connected)drawDirection(focus,target,now);}
 floaters=floaters.filter(f=>now-f.at<1100);floaters.forEach(f=>{const age=(now-f.at)/1100;ctx.globalAlpha=1-age;text(ctx,f.label,f.x,f.y-70-age*65,33,f.color,1000);ctx.globalAlpha=1;});ctx.restore();drawMini(s);
 if(connected){const age=now-lastPacket,remaining=s.phase==='playing'?Math.max(0,(s.remainingMs??s.endsAt-s.now)-Math.min(age,1000)):0;$('gameClock').textContent=s.phase==='playing'?Math.ceil(remaining/1000):s.phase==='countdown'?'…':s.phase==='finished'?'0':'∞';$('gameClock').parentElement.classList.toggle('urgent',s.phase==='playing'&&remaining<11000);
  $('countdownFlash').hidden=s.phase!=='countdown';if(s.phase==='countdown')$('countdownFlash').textContent=Math.max(1,Math.ceil((s.phaseUntil-s.now-Math.min(age,250))/1000));
  const other=s.players.find(q=>q.id!==you),canTag=!!(p&&other&&!p.carry&&other.carry&&Math.hypot(p.x-other.x,p.y-other.y)<=65&&p.tagReadyAt<=virtualNow&&other.immuneUntil<=virtualNow&&s.phase==='playing');$('tagButton').classList.toggle('ready',canTag);$('tagButton').classList.toggle('cooldown',!!p&&p.tagReadyAt>virtualNow);$('dashButton').classList.toggle('cooldown',!!p&&p.dashReadyAt>virtualNow);$('gameHint').textContent=p?.carry?'送到同色市民 → +100':canTag?'靠近對手，按「搶」！':'拿補給 → 送同色市民';
  if(age>2500)$('networkStatus').textContent='同步暫停，等候連線…';
 }else{$('gameClock').textContent='∞';$('gameHint').textContent='拿補給 → 送同色市民';$('countdownFlash').hidden=true;}
 if(toastUntil&&now>toastUntil){$('eventToast').hidden=true;toastUntil=0;}
 requestAnimationFrame(frame);
}
window.PlayGame=Object.freeze({walkTo,screenPoint,snapshot:()=>({connected,code,you,self:self()?structuredClone(self()):null,state:state?structuredClone(state):null})});
updateHUD();requestAnimationFrame(frame);
})();

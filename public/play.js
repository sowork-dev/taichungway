/* Original single-screen bubble client. Only movement/placement intent leaves the browser.
 * The server owns pickups, carrying, scores, clock, and round results.
 * No account, storage, analytics, fake opponent, or client-awarded points. */
(function(){
'use strict';
const A=window.BubbleCore,T=window.TaichungElements,$=id=>document.getElementById(id);
if(!A||!T){$('networkStatus').textContent='遊戲載入失敗，請重新整理。';$('startGame').disabled=true;return;}
const canvas=$('arenaCanvas'),ctx=canvas.getContext('2d');let ox=0,oy=0,firstAction=false;
const teamColors=['#348cff','#ff7b71'];
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
let state=null,you=null,code='',socket=null,connected=false,entering=false,generation=0,lastPacket=0,rtt=120,pingAt=0;
let cw=390,ch=600,scale=1,cam={x:0,y:0},lastFrame=performance.now(),manual={x:0,y:0},stick={x:0,y:0},stickId=null,keys=new Set(),wasManual=false,cursor=null;
let display=new Map(),previous=new Map(),seen=new Set(),floaters=[],toastUntil=0,lastRound=-1,lastPhase='',lobbyTimer=null,connectTimer=null;
const demo=A.createGame({now:Date.now()});A.addPlayer(demo,'preview');const preview=A.snapshot(demo);

function rect(c,x,y,w,h,fill,r=0){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function circle(c,x,y,r,fill){c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function text(c,t,x,y,size=16,fill='#204a80',weight=900){c.fillStyle=fill;c.font=weight+' '+size+'px -apple-system,"PingFang TC",sans-serif';c.textAlign='center';c.fillText(t,x,y);}
function line(c,ps,width,color){c.lineWidth=width;c.strokeStyle=color;c.lineCap='round';c.lineJoin='round';c.beginPath();ps.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();}
function city(){const c=$('cityBanner').getContext('2d');c.fillStyle='#bcdcf8';c.fillRect(0,0,720,100);for(const [kind,x,w]of[['station',50,130],['market',215,145],['expo',395,145],['windmill',574,100]])T.draw(c,kind,x,8,w,80,0);}
city();
function tile(c,r){return{x:c*A.CELL,y:r*A.CELL};}
function drawBoard(s,now){
 const C=A.CELL;for(let r=0;r<A.ROWS;r++)for(let c=0;c<A.COLS;c++){
  const p=tile(c,r);rect(ctx,p.x,p.y,C,C,(c+r)%2?'#d1e7fa':'#cce6f9');
  ctx.strokeStyle='#99c5f250';ctx.lineWidth=1;ctx.strokeRect(p.x,p.y,C,C);
  if((c*7+r*3)%11===0){circle(ctx,p.x+12,p.y+51,2,'#8bbef1');circle(ctx,p.x+17,p.y+47,1.6,'#8bbef1');}
 }
 for(const w of s.walls||[]){const p=tile(w.c,w.r),edge=w.c===0||w.r===0||w.c===A.COLS-1||w.r===A.ROWS-1;
  rect(ctx,p.x+2,p.y+5,C-4,C-6,edge?'#1755a7':'#1d6cd3',9);rect(ctx,p.x+2,p.y+1,C-4,C-10,edge?'#4e9be9':'#86bbf0',9);rect(ctx,p.x+8,p.y+7,C-16,6,edge?'#a0c9f3':'#c0def8',4);
  if(edge){circle(ctx,p.x+20,p.y+26,14,'#3480e3');circle(ctx,p.x+40,p.y+26,14,'#529eea');circle(ctx,p.x+31,p.y+17,14,'#71afee');}
  else{line(ctx,[[p.x+10,p.y+33],[p.x+C-10,p.y+33]],2,'#4c9ae9');line(ctx,[[p.x+C/2,p.y+34],[p.x+C/2,p.y+C-15]],2,'#4c9ae9');}
 }
 for(const b of s.crates||[]){const p=tile(b.c,b.r);if(!b.alive){rect(ctx,p.x+5,p.y+5,C-10,C-10,'#aed1f5',8);circle(ctx,p.x+C/2,p.y+23,12,'#60a5eb');line(ctx,[[p.x+24,p.y+22],[p.x+30,p.y+29],[p.x+40,p.y+17]],3,'#e2f0fc');text(ctx,b.label||'通行',p.x+C/2,p.y+49,(b.label||'').length>2?12:14,'#195db6');continue;}
  rect(ctx,p.x+4,p.y+7,C-8,C-9,'#1768d2',8);rect(ctx,p.x+4,p.y+1,C-8,C-9,'#60b2ed',8);rect(ctx,p.x+10,p.y+6,C-20,8,'#a1d2f5',4);
  line(ctx,[[p.x+8,p.y+42],[p.x+23,p.y+54]],3,'#3a86e9');line(ctx,[[p.x+C-8,p.y+42],[p.x+C-23,p.y+54]],3,'#3a86e9');rect(ctx,p.x+9,p.y+20,C-18,26,'#d8ebfc',7);line(ctx,[[p.x+17,p.y+30],[p.x+26,p.y+35],[p.x+36,p.y+29],[p.x+46,p.y+34]],3,'#4a8ee6');
 }
}
function ownerColor(s,id){return teamColors[s.players.find(p=>p.id===id)?.team??0];}
function waterCells(s,b){try{return A.blastCells(s,b);}catch{return[{c:b.c,r:b.r}];}}
function drawBall(b,s,now){const C=A.CELL,k=ownerColor(s,b.ownerId),left=Math.max(0,b.explodeAt-now),pulse=reduced?0:Math.sin(now/90)*1.8;
 ctx.save();ctx.globalAlpha=.11;for(const q of waterCells(s,b)){const p=tile(q.c,q.r);rect(ctx,p.x+4,p.y+4,C-8,C-8,k,9);}ctx.restore();
 circle(ctx,b.x,b.y+11,25,'#16519f28');circle(ctx,b.x,b.y,23+pulse,k);circle(ctx,b.x-5,b.y-7,15,'#91c1f1');circle(ctx,b.x-10,b.y-13,6,'#eaf4fd');
 ctx.strokeStyle='#eaf4fd';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,27,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,left/1800));ctx.stroke();
 text(ctx,String(Math.max(1,Math.ceil(left/1000))),b.x+2,b.y+6,21,'#144585');
}
function drawWater(b,s,now){const color=ownerColor(s,b.ownerId);ctx.save();ctx.globalAlpha=Math.max(.2,Math.min(.85,(b.expiresAt-now)/450));
 for(const q of b.cells||[]){const p=tile(q.c,q.r);rect(ctx,p.x+1,p.y+1,A.CELL-2,A.CELL-2,color,13);rect(ctx,p.x+7,p.y+12,A.CELL-14,A.CELL-24,'#93c2f2',9);line(ctx,[[p.x+12,p.y+27],[p.x+23,p.y+32],[p.x+36,p.y+25],[p.x+51,p.y+31]],4,'#e7f2fc');}
 ctx.restore();}
function person(p,d,now,isSelf,previewing){const col=teamColors[p.team]||teamColors[0],moving=Math.hypot(d.x-d.oldX,d.y-d.oldY)>.05,bob=!reduced&&moving?Math.sin(now/90)*1.5:0,trapped=p.trappedUntil>now;
 ctx.save();ctx.translate(d.x,d.y+bob);circle(ctx,0,14,24,'#18417628');
 if(isSelf){ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,14,25,10,0,0,Math.PI*2);ctx.stroke();}
 rect(ctx,-17,-10,34,31,col,12);rect(ctx,-14,13,12,13,'#1f467a',5);rect(ctx,2,13,12,13,'#1f467a',5);rect(ctx,-18,22,17,7,'#163865',4);rect(ctx,1,22,17,7,'#163865',4);
 circle(ctx,0,-31,26,'#f4d5ae');circle(ctx,-25,-28,5,'#e5bd99');circle(ctx,25,-28,5,'#e5bd99');
 ctx.fillStyle='#5e696b';ctx.beginPath();ctx.ellipse(0,-40,26,17,0,Math.PI,0);ctx.lineTo(25,-28);ctx.quadraticCurveTo(10,-48,-20,-32);ctx.lineTo(-26,-24);ctx.closePath();ctx.fill();
 ctx.lineWidth=2.2;ctx.strokeStyle='#1c4171';ctx.beginPath();ctx.roundRect(-20,-36,17,13,4);ctx.roundRect(3,-36,17,13,4);ctx.moveTo(-3,-30);ctx.lineTo(3,-30);ctx.stroke();
 if(trapped){line(ctx,[[-14,-29],[-11,-32],[-8,-29]],1.7,'#1c4171');line(ctx,[[8,-29],[11,-32],[14,-29]],1.7,'#1c4171');}else{circle(ctx,-11,-29,2.3,'#1c4171');circle(ctx,11,-29,2.3,'#1c4171');}
 line(ctx,[[-6,-18],[0,-15],[6,-18]],2,'#ad8066');rect(ctx,-24,-79,48,20,isSelf?col:'#ffffffec',7);text(ctx,previewing?'分身':isSelf?'你':'對手',0,-64,14,isSelf?'white':'#245492');
 if(trapped){const g=ctx.createRadialGradient(-11,-45,2,0,-21,42);g.addColorStop(0,'#e0eefc99');g.addColorStop(.75,'#9ac6f255');g.addColorStop(1,'#b0d2f5bb');circle(ctx,0,-22,40,g);ctx.strokeStyle='#eaf4fd';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-22,40,0,Math.PI*2);ctx.stroke();circle(ctx,-19,-45,8,'#ffffffc9');}
 else if(p.immuneUntil>now){ctx.strokeStyle='#ffffffbb';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-17,34,0,Math.PI*2);ctx.stroke();}
 ctx.restore();}
function fitBoard(){scale=Math.max(.01,Math.min((cw-12)/A.WORLD_WIDTH,(ch-8)/A.WORLD_HEIGHT));ox=(cw-A.WORLD_WIDTH*scale)/2;oy=(ch-A.WORLD_HEIGHT*scale)/2;cam={x:0,y:0};}
function resize(){const r=canvas.getBoundingClientRect();cw=Math.max(1,r.width);ch=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);fitBoard();}
new ResizeObserver(resize).observe(canvas);resize();
function self(){return state?.players?.find(p=>p.id===you)||null;}
function send(o){if(connected&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(o));}
function resetInput(){keys.clear();manual={x:0,y:0};stick={x:0,y:0};stickId=null;wasManual=false;cursor=null;$('stickKnob').style.transform='translate(0,0)';send({type:'input',x:0,y:0});}
function walkTo(x,y){const p=self();if(!connected||!p||!Number.isFinite(x)||!Number.isFinite(y)||!A.canStand(x,y,state)||!['practice','playing'].includes(state.phase))return false;
 const route=A.findPath(p.x,p.y,x,y,state);if(!route.length)return false;resetInput();cursor={x,y,path:route};send({type:'navigate',x,y});return true;}
function screenPoint(x,y){const r=canvas.getBoundingClientRect();return{x:r.left+ox+x*scale,y:r.top+oy+y*scale};}
function flash(s,stolen=false){$('eventToast').textContent=s;$('eventToast').classList.toggle('stolen',stolen);$('eventToast').hidden=false;toastUntil=performance.now()+1550;}
function updateHUD(){const p=self(),other=state?.players.find(q=>q.id!==you),phase=state?.phase||'preview';
 $('selfScore').textContent=p?.score??0;$('rivalScore').textContent=other?.score??'—';$('rivalLabel').textContent=other?'對手':'等對手';const used=(state?.bombs||[]).filter(b=>b.ownerId===you).length;
 $('carryText').textContent=p?.trappedUntil>(state?.now??0)?'泡泡中…':'水球 '+('●'.repeat(Math.max(0,2-used)))+('○'.repeat(used));$('rivalCarry').textContent=other?'先 3 分勝':'真人加入就開賽';
 const ownCard=document.querySelector('.self-score'),peerCard=document.querySelector('.rival-score');ownCard.style.borderLeftColor=teamColors[p?.team??0];ownCard.style.backgroundColor=p?.team===1?'#ffe5df':'#e2efff';peerCard.style.borderRightColor=teamColors[other?.team??1];peerCard.style.backgroundColor=other?.team===0?'#e2efff':'#ffe5df';
 $('matchPhase').textContent=phase==='practice'?'自由練習':phase==='countdown'?'準備開賽':phase==='playing'?'先 3 分勝':phase==='finished'?'本局結束':'先 3 分勝';
 $('networkStatus').textContent=connected?(phase==='practice'?'真人隨時加入 · 先玩不乾等':phase==='countdown'?'真人到場，歸零開賽！':''):$('networkStatus').textContent;
 $('tapCoach').hidden=firstAction||!connected;
 $('gameControls').hidden=!connected;$('entryLayer').hidden=connected;$('inviteButton').hidden=!connected;$('leaveButton').hidden=!connected;$('resultLayer').hidden=phase!=='finished';
 if(phase==='finished'&&p){const w=state.winnerIds||[];$('resultTitle').textContent=w.length===2?'平手，再來！':w.includes(you)?'這局你贏！':'差一點，再來！';$('resultScores').textContent='你 '+p.score+'  :  '+(other?.score??0)+' 對手';$('rematchButton').disabled=!!p.ready;$('rematchButton').textContent=p.ready?'等對手再戰…':'再比一場 ↻';}
}
function accept(packet){if(!packet||packet.type!=='state'||!packet.state||!Array.isArray(packet.state.players))return;if(packet.state.kind!=='bubble'){generation++;socket?.close();socket=null;fail('遊戲正在更新，請重新整理。');return;}
 const old=state;previous=new Map((old?.players||[]).map(p=>[p.id,{x:p.x,y:p.y,at:lastPacket}]));state=packet.state;you=packet.you;code=packet.code;lastPacket=performance.now();connected=true;entering=false;clearTimeout(connectTimer);$('startGame').disabled=false;
 const p=self();if(!p)return;
 if(lastRound!==state.roundId){lastRound=state.roundId;display.clear();resetInput();if(state.players.length===2)flash('雙人開賽！');}
 if(state.phase!==lastPhase){if(['countdown','finished'].includes(state.phase))resetInput();if(state.phase==='playing'&&lastPhase==='countdown')flash('放水球，躲水波！');lastPhase=state.phase;}
 for(const e of state.events||[]){if(seen.has(e.id))continue;seen.add(e.id);if(!old)continue;
  if(e.type==='place'&&e.playerId===you){firstAction=true;$('tapCoach').hidden=true;}
  if(e.type==='destroy'){floaters.push({x:e.x,y:e.y,label:'✦',color:'#97cdf4',at:performance.now()});}
  if(e.type==='capture'){const points=Number.isFinite(e.points)&&e.points>0?e.points:0,victimIsYou=e.victimId===you,selfSplash=e.victimId===e.playerId;if(points>0){flash(e.playerId===you?'困住對手！＋'+points:victimIsYou?'被泡泡困住了！':'對手得分',victimIsYou);floaters.push({x:e.x,y:e.y,label:'+'+points,color:teamColors[state.players.find(p=>p.id===e.playerId)?.team??0],at:performance.now()});}else{flash(victimIsYou?(selfSplash?'被自己的水波困住了！':'被泡泡困住了！'):(selfSplash?'對手被自己的水波困住了':'對手被泡泡困住了'),victimIsYou);}}

 }
 if(seen.size>180)seen=new Set((state.events||[]).map(e=>e.id));floaters=floaters.slice(-20);
 if(cursor&&Math.hypot(p.x-cursor.x,p.y-cursor.y)<15)cursor=null;
 updateHUD();
}
async function enter(wanted,fresh=false){if(entering)return;resetInput();if(socket){generation++;socket.close();socket=null;}connected=false;state=null;you=null;display.clear();lastRound=-1;lastPhase='';seen.clear();entering=true;const gen=++generation;
 $('startGame').disabled=true;$('startGame').textContent='連線中…';$('networkStatus').textContent='';if($('lobbyDialog').open)$('lobbyDialog').close();
 try{const r=await fetch('/api/play/enter',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(wanted?{code:wanted}:fresh?{fresh:true}:{}),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(9000)});
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
function action(which){if(connected&&['practice','playing'].includes(state?.phase))send({type:'action',action:'bomb'});}
let requested=new URL(location.href).searchParams.get('room');if(requested&&!/^[A-F0-9]{6}$/.test(requested)){requested=null;$('networkStatus').textContent='邀請已失效，可重新開玩。';}if(requested)$('startGame').textContent='加入朋友 ↗';
$('startGame').addEventListener('click',()=>{const first=requested;requested=null;enter(first);});$('leaveButton').addEventListener('click',leave);$('rematchButton').addEventListener('click',()=>send({type:'rematch'}));
$('bombButton').addEventListener('pointerdown',e=>{e.preventDefault();action('bomb');});
canvas.addEventListener('pointerdown',e=>{if(!connected)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-ox)/scale,y=(e.clientY-r.top-oy)/scale;if(x<0||y<0||x>A.WORLD_WIDTH||y>A.WORLD_HEIGHT)return;const c=Math.floor(x/A.CELL),row=Math.floor(y/A.CELL);walkTo((c+.5)*A.CELL,(row+.5)*A.CELL);});
const stickEl=$('moveStick');function moveStick(e){const r=stickEl.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy),limit=r.width*.30,ratio=Math.min(1,len/limit);stick={x:len>6?dx/len*ratio:0,y:len>6?dy/len*ratio:0};$('stickKnob').style.transform='translate('+(stick.x*limit)+'px,'+(stick.y*limit)+'px)';cursor=null;}
stickEl.addEventListener('pointerdown',e=>{if(!connected)return;e.preventDefault();stickId=e.pointerId;stickEl.setPointerCapture(stickId);moveStick(e);});stickEl.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});
function stopStick(e){if(e.pointerId!==stickId)return;stickId=null;stick={x:0,y:0};$('stickKnob').style.transform='translate(0,0)';send({type:'input',x:0,y:0});wasManual=false;}
stickEl.addEventListener('pointerup',stopStick);stickEl.addEventListener('pointercancel',stopStick);stickEl.addEventListener('lostpointercapture',stopStick);
const directionKeys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'];
window.addEventListener('keydown',e=>{if(!connected||$('lobbyDialog').open||$('infoDialog').open||e.ctrlKey||e.metaKey||e.altKey)return;if(directionKeys.includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());cursor=null;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)action('bomb');}});
window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(!keys.size&&!stick.x&&!stick.y){manual={x:0,y:0};send({type:'input',x:0,y:0});wasManual=false;}});window.addEventListener('blur',resetInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
setInterval(()=>{if(!connected)return;const x=stick.x+(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),y=stick.y+(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0),n=Math.max(1,Math.hypot(x,y));manual={x:x/n,y:y/n};if(x||y){send({type:'input',x:manual.x,y:manual.y});wasManual=true;}else if(wasManual){send({type:'input',x:0,y:0});wasManual=false;}},50);
setInterval(()=>{if(connected){pingAt=performance.now();send({type:'ping'});}},4000);
async function loadLobby(){try{const r=await fetch('/api/play/lobby',{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error();const data=await r.json();if(!Array.isArray(data.rooms))throw new Error();$('onlineDot').classList.toggle('online',data.online>0);$('onlineCount').textContent=(Number.isFinite(data.online)?data.online:0)+' 人在線';if(!$('lobbyDialog').open)return;
 const host=$('lobbyRooms');host.replaceChildren();const rooms=data.rooms.filter(r=>r.joinable&&r.code!==code);
 for(const room of rooms){const row=document.createElement('div');row.className='room-row';const icons=document.createElement('div');icons.className='room-people';icons.innerHTML='<i></i><i class="empty"></i>';const label=document.createElement('span');label.textContent='真人等你加入';const detail=document.createElement('small');detail.textContent=room.players+'/2 · 正在練習';label.append(detail);const button=document.createElement('button');button.textContent='加入';button.dataset.room=room.code;button.addEventListener('click',()=>enter(room.code));row.append(icons,label,button);host.append(row);}
 if(!rooms.length){const note=document.createElement('p');note.className='lobby-empty';note.textContent=connected?'目前沒有其他可加入的場。':'還沒有人等候，先跑起來！';host.append(note);}
 }catch{if($('lobbyDialog').open){$('onlineCount').textContent='暫時離線';$('lobbyRooms').textContent='無法讀取場次，請稍後再試。';}}}
$('lobbyButton').addEventListener('click',()=>{resetInput();$('lobbyDialog').showModal();loadLobby();clearInterval(lobbyTimer);lobbyTimer=setInterval(loadLobby,2000);});$('closeLobby').addEventListener('click',()=>$('lobbyDialog').close());$('lobbyDialog').addEventListener('close',()=>{clearInterval(lobbyTimer);lobbyTimer=null;});$('lobbyPractice').addEventListener('click',()=>enter(null,true));
$('infoButton').addEventListener('click',()=>{resetInput();$('infoDialog').showModal();});$('closeInfo').addEventListener('click',()=>$('infoDialog').close());
$('inviteButton').addEventListener('click',async()=>{if(!code||!connected)return;const link=new URL('/bubble.html',location.origin);link.searchParams.set('room',code);
 try{if(navigator.share){await navigator.share({title:'來臺中泡泡PK',text:'放水球，一起 PK！',url:link.href});return;}if(navigator.clipboard){await navigator.clipboard.writeText(link.href);flash('邀請連結已複製');return;}}catch(e){if(e.name==='AbortError')return;}
 const host=$('infoDialog').querySelector('.info-copy');host.querySelector('.share-box')?.remove();const field=document.createElement('input');field.className='share-box';field.readOnly=true;field.value=link.href;field.setAttribute('aria-label','朋友邀請連結，長按複製');host.prepend(field);$('infoDialog').showModal();field.focus();field.select();});
loadLobby();
function frame(now){const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;const s=state||preview,p=self()||s.players[0],virtualNow=(state?.now||0)+Math.min(180,now-lastPacket);
 (s.players||[]).forEach(q=>{let d=display.get(q.id);if(!d){d={x:q.x,y:q.y,oldX:q.x,oldY:q.y};display.set(q.id,d);}d.oldX=d.x;d.oldY=d.y;d.x+=(q.x-d.x)*Math.min(1,dt*24);d.y+=(q.y-d.y)*Math.min(1,dt*24);if(Math.hypot(d.x-q.x,d.y-q.y)>70){d.x=q.x;d.y=q.y;}});
 fitBoard();
 ctx.fillStyle='#4d9be9';ctx.fillRect(0,0,cw,ch);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);drawBoard(s,now);(s.bombs||[]).forEach(b=>drawBall(b,s,virtualNow));(s.blasts||[]).filter(b=>b.expiresAt>virtualNow).forEach(b=>drawWater(b,s,virtualNow));
 if(cursor&&p){ctx.strokeStyle='#2363b69c';ctx.lineWidth=3;ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(p.x,p.y);for(const n of cursor.path)ctx.lineTo(n.x,n.y);ctx.stroke();ctx.setLineDash([]);circle(ctx,cursor.x,cursor.y,5,'#ffffffcc');}
 (s.players||[]).slice().sort((a,b)=>a.y-b.y).forEach(q=>person(q,display.get(q.id)||q,virtualNow,q.id===you||!connected,!connected));
 floaters=floaters.filter(f=>now-f.at<900);floaters.forEach(f=>{const age=(now-f.at)/900;ctx.globalAlpha=1-age;text(ctx,f.label,f.x,f.y-45-age*40,30,f.color,1000);ctx.globalAlpha=1;});ctx.restore();
 if(connected){const age=now-lastPacket,remaining=s.phase==='playing'?Math.max(0,(s.remainingMs??s.endsAt-s.now)-Math.min(age,1000)):0;$('gameClock').textContent=s.phase==='playing'?Math.ceil(remaining/1000):s.phase==='countdown'?'…':s.phase==='finished'?'0':'∞';$('gameClock').parentElement.classList.toggle('urgent',s.phase==='playing'&&remaining<11000);
  $('countdownFlash').hidden=s.phase!=='countdown';if(s.phase==='countdown')$('countdownFlash').textContent=Math.max(1,Math.ceil((s.phaseUntil-s.now-Math.min(age,250))/1000));
  const full=(s.bombs||[]).filter(b=>b.ownerId===you).length>=2,blocked=p?.trappedUntil>virtualNow||p?.bombReadyAt>virtualNow; $('bombButton').classList.toggle('cooldown',full||blocked||!['practice','playing'].includes(s.phase));$('gameHint').textContent=p?.trappedUntil>virtualNow?'泡泡困住了！':s.phase==='playing'?'困住對手 ＋1 · 先3分勝':'放水球 → 躲水波';
  if(age>2500)$('networkStatus').textContent='等候同步…';
 }else{$('gameClock').textContent='60';$('gameHint').textContent='放水球 → 躲水波';$('countdownFlash').hidden=true;}
 if(toastUntil&&now>toastUntil){$('eventToast').hidden=true;toastUntil=0;}requestAnimationFrame(frame);
}
window.PlayGame=Object.freeze({walkTo,screenPoint,snapshot:()=>({connected,code,you,self:self()?structuredClone(self()):null,state:state?structuredClone(state):null,view:{cameraX:0,cameraY:0,x:ox,y:oy,scale,width:A.WORLD_WIDTH*scale,height:A.WORLD_HEIGHT*scale,canvasWidth:cw,canvasHeight:ch}})});
updateHUD();requestAnimationFrame(frame);
})();

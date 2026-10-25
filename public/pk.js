/* Real-player rooms. Tokens and answers stay in transient memory, never URLs/storage. */
(function(){
'use strict';
const node=id=>document.getElementById(id),dialog=node('pkDialog');
if(!dialog)return;
let session=null,state=null,polling=false,actionBusy=false,generation=0,lastPosition=0,serverOffset=0,choiceKey='',selectedChoice=null,submittedRound=null,playerSignature='';
const words={room_not_found:'房間不存在或已逾時，請重新開房。',room_full:'房間已滿，請朋友另開一間房。',invalid_token:'房間連線已失效，請重新加入。',invalid_code:'請輸入正確的 6 碼房號。',rate_limited:'操作太快了，請稍等一下再試。',already_answered:'這一題已收到你的答案。',round_mismatch:'題目已換到下一題，正在更新。',invalid_nickname:'請使用不含電話、Email 的簡短暱稱。',origin_not_allowed:'連線來源不符，請從正式網址開啟。'};
function say(text,error=false){node('pkNetwork').textContent=text;node('pkNetwork').classList.toggle('error',error);}
function roomCode(){return node('pkJoinCode').value.trim().toUpperCase();}
function nickname(){const value=node('pkNickname').value.trim();if(/09\d{8}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value))throw Error('請不要用電話或 Email 當暱稱。');return value;}
function resetSession(message){generation++;session=null;state=null;choiceKey='';playerSignature='';submittedRound=null;node('pkEntry').hidden=false;node('pkRoom').hidden=true;node('pkPlayers').replaceChildren();node('openPk').textContent='雙人 PK ↗';if(message)say(message);}
async function api(path,body,auth=true){
 const headers={'Accept':'application/json'};if(body!==undefined)headers['Content-Type']='application/json';
 if(auth){if(!session)throw Error('請先開房或加入朋友的房間。');headers.Authorization='Bearer '+session.token;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
 try{const response=await fetch('/api/pk/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller.signal});let data;try{data=await response.json();}catch{throw Error('多人連線暫時不可用，單人政策走訪仍可使用。');}if(!response.ok){const code=typeof data.error==='string'?data.error:data.error?.code||data.code||'';const error=Error(words[code]||data.message||data.error?.message||'連線未成功，請稍候重試。');error.status=response.status;error.code=code;throw error;}return data;}finally{clearTimeout(timer);}
}
function accept(data){const next=data.state||data;if(!next||!Array.isArray(next.players)||!next.code)return;state=next;serverOffset=Number(next.serverTime||Date.now())-Date.now();render();}
function make(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function renderPlayers(){const sig=JSON.stringify(state.players.map(p=>[p.id,p.nickname,p.score,p.ready,p.connected]));if(sig===playerSignature)return;playerSignature=sig;const list=node('pkPlayers');list.replaceChildren();for(const p of state.players){const card=make('article','pk-player'+(p.id===state.you?' you':'')),name=make('strong','',p.nickname);if(p.id===state.you)name.append(make('i','','你'));const score=make('div','pk-score',String(p.score||0));score.append(make('small','','分'));card.append(name,score,make('span','',!p.connected?'暫時離線':p.ready?'已準備':'探索城市中'));list.append(card);}}
function render(){
 if(!state)return;node('pkEntry').hidden=true;node('pkRoom').hidden=false;node('pkRoomCode').textContent=state.code;renderPlayers();
 const me=state.players.find(p=>p.id===state.you),waiting=state.status==='waiting',finished=state.status==='finished',round=state.round;
 node('pkRoomStatus').textContent=waiting?(state.players.length<2?'等待另一位真人加入。可以先回城市走走。':me?.ready?'你已準備，等待另一位玩家。':'朋友到齊了，兩人按準備就開賽。'):finished?'5 題完成。回看來源，或再比一場。':state.status==='round-result'?'答案已揭曉，下一題即將開始。':'兩位玩家同題作答。讀懂文件，比快也比準。';
 node('pkReady').hidden=!waiting;node('pkReady').disabled=actionBusy||!!me?.ready;node('pkReady').textContent=me?.ready?'已準備，等朋友…':'我準備好了';node('pkRematch').hidden=!finished;node('pkRematch').disabled=actionBusy||!!me?.ready;
 node('pkOutcome').hidden=!finished;
 if(finished){const winners=state.winnerIds||[],names=state.players.filter(p=>winners.includes(p.id)).map(p=>p.nickname);const result=names.length===2?'平手！一起把城市讀懂。':names.length?names.join('、')+'，本局領先。':'本局已結束。';node('pkOutcome').replaceChildren(make('span','',result),make('small','','分數只代表本局文件理解，不代表政策成效或政治立場。'));}
 node('pkRound').hidden=waiting||!round;
 if(round&&!waiting){
  node('pkRoundLabel').textContent='第 '+round.index+' / '+round.total+' 題';node('pkQuestion').textContent=round.question;
  const key=round.id+'|'+JSON.stringify(round.choices);if(key!==choiceKey){choiceKey=key;selectedChoice=null;submittedRound=null;const list=node('pkChoices');list.replaceChildren();round.choices.forEach((label,i)=>{const b=make('button','');b.dataset.choice=String(i);b.append(make('span','',String.fromCharCode(65+i)),make('b','',label));b.addEventListener('click',()=>answer(i));list.append(b);});}
  const done=(round.answered||[]).includes(state.you)||submittedRound===round.id,result=round.result;
  node('pkChoices').querySelectorAll('button').forEach((b,i)=>{b.disabled=done||state.status!=='playing';b.classList.toggle('selected',i===selectedChoice);b.classList.toggle('correct',!!result&&i===result.correctIndex);b.classList.toggle('wrong',!!result&&i===selectedChoice&&i!==result.correctIndex);});
  node('pkFeedback').hidden=!result;
  if(result){const points=result.points?.find(p=>p.playerId===state.you)?.delta||0;node('pkFeedbackTitle').textContent=points?'讀懂了！本題 +'+points+' 分':'這一題，一起回到文件看看。';node('pkExplanation').textContent=result.explanation||'';const source=node('pkSource');if(/^https:\/\//.test(result.sourceUrl||round.sourceUrl||'')){source.href=result.sourceUrl||round.sourceUrl;source.textContent=(result.sourceTitle||round.sourceTitle||'本題原始文件')+' ↗';source.hidden=false;}else source.hidden=true;}
  else if(done)node('pkRoomStatus').textContent='已送出，等待另一位玩家。答案還不揭曉。';
 }
 node('openPk').textContent=finished?'PK 結算 ↗':waiting?'PK 房間 '+state.players.length+'/2 ↗':'PK 進行中 ↗';updateCountdown();
}
function updateCountdown(){if(!state?.round)return;const time=Date.now()+serverOffset;if(state.status==='playing')node('pkCountdown').textContent=Math.max(0,Math.ceil((state.round.deadline-time)/1000))+'s';else if(state.status==='round-result')node('pkCountdown').textContent='下一題 '+Math.max(0,Math.ceil(((state.round.result?.nextAt||time)-time)/1000))+'s';else node('pkCountdown').textContent='FINISH';}
async function enter(mode){if(actionBusy||session)return;try{const name=nickname(),code=roomCode();if(mode==='join'&&!/^[A-Z0-9]{6}$/.test(code))throw Error('請輸入正確的 6 碼房號。');busy(true);say(mode==='match'?'正在尋找另一位真人…':'正在連線房間…');const data=await api(mode,{nickname:name,...(mode==='join'?{code}:{})},false);if(!data.token||!data.code)throw Error('房間資料不完整，請稍候重試。');session={token:data.token,code:data.code,playerId:data.playerId};generation++;accept(data);say('已連上真實房間；每局暫存，沒有 AI 假玩家。');lastPosition=0;}catch(e){say(e.message,true);}finally{busy(false);}}
function busy(value){actionBusy=value;for(const id of ['pkCreate','pkMatch','pkJoin'])node(id).disabled=value;if(state)render();}
async function action(path){if(!session||actionBusy)return;busy(true);const g=generation;try{const result=await api(path,{code:session.code});if(g!==generation)return;if(path==='leave')resetSession('已離開房間，本次房間身分已從本頁清除。');else accept(result);}catch(e){say(e.message,true);}finally{busy(false);}}
async function answer(index){if(!session||!state?.round||state.status!=='playing'||submittedRound===state.round.id)return;const g=generation,id=state.round.id;submittedRound=id;selectedChoice=index;render();try{const data=await api('answer',{code:session.code,roundId:id,choiceIndex:index});if(g===generation)accept(data);}catch(e){if(g===generation){submittedRound=null;say(e.message,true);render();}}}
async function poll(){if(!session||polling)return;polling=true;const g=generation;try{const data=await api('state?code='+encodeURIComponent(session.code));if(g!==generation)return;accept(data);say('已連線 · 與同房玩家同步中');if(Date.now()-lastPosition>1800&&window.QuestGame){const p=window.QuestGame.snapshot();lastPosition=Date.now();await api('position',{code:session.code,x:p.x,y:p.y,zoneId:p.zoneId||'living'});}}catch(e){if(g===generation){if([401,404,410].includes(e.status))resetSession('房間已失效或逾時，請重新開房。');else say('連線暫停，正在重試；不會自動判你落敗。',true);}}finally{polling=false;}}
async function copyInvite(){if(!session)return;const url=new URL(location.origin+location.pathname);url.searchParams.set('room',session.code);url.hash='home';try{await navigator.clipboard.writeText(url.href);say('邀請連結已複製，傳給朋友即可加入。');}catch{if(navigator.share){try{await navigator.share({title:'一起探索城市，政策 PK',text:'雙人政策理解賽 · AI 分身原型',url:url.href});}catch{say('房號 '+session.code+'，請朋友從多人 PK 輸入加入。');}}else say('房號 '+session.code+'，請朋友從多人 PK 輸入加入。');}}
function open(){if(!dialog.open)dialog.showModal();if(!session)api('health',undefined,false).then(data=>say(data.ok&&data.mode==='live'?'真人連線服務可用。開房或加入後才開始同步。':'多人連線暫時不可用。',!data.ok)).catch(()=>say('多人連線暫時不可用，單人城市仍可探索。',true));else poll();}
for(const id of ['openPk','navPk'])node(id).addEventListener('click',open);
for(const id of ['closePk','pkWalk'])node(id).addEventListener('click',()=>dialog.close());
node('pkCreate').addEventListener('click',()=>enter('create'));node('pkMatch').addEventListener('click',()=>enter('match'));node('pkJoin').addEventListener('click',()=>enter('join'));
node('pkReady').addEventListener('click',()=>action('ready'));node('pkRematch').addEventListener('click',()=>action('rematch'));node('pkLeave').addEventListener('click',()=>action('leave'));node('pkCopy').addEventListener('click',copyInvite);
node('pkJoinCode').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);});
window.PolicyPK={open,snapshot:()=>state?JSON.parse(JSON.stringify(state)):null,peers:()=>state?state.players.filter(p=>p.id!==state.you&&p.connected).map(p=>({id:p.id,nickname:p.nickname,x:p.x,y:p.y,zoneId:p.zoneId})):[],inRoom:()=>!!session};
setInterval(poll,900);setInterval(updateCountdown,200);
const invitation=new URLSearchParams(location.search).get('room');if(invitation&&/^[A-Z0-9]{6}$/.test(invitation)){node('pkJoinCode').value=invitation;setTimeout(open,100);}
})();

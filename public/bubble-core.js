(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BubbleCore = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const COLS=9, ROWS=13, CELL=64, WORLD_WIDTH=576, WORLD_HEIGHT=832, SPEED=200, DASH_SPEED=200;
  const ACTIONS=Object.freeze(['bomb']), LANDMARKS=Object.freeze([]), TARGETS=Object.freeze([]), PICKUP_SLOTS=Object.freeze([]);
  const internal=new WeakMap();
  const TOPICS=[['exhibition-168','會展'],['robot-city','機械'],['parenting','托育'],['senior-care','照護'],['culture-starlight','文化'],['smart-agriculture','農業'],['airport-gateway','空港'],['smart-transport','交通'],['city-safety','安全'],['twenty-minute-city','生活'],['new-residents','新住民'],['indigenous','原民'],['animal-welfare','毛孩'],['hakka','客家'],['education','教育']];
  const CRATE_CELLS=[[3,1],[5,11],[3,3],[5,9],[5,3],[3,9],[1,5],[7,7],[3,5],[5,7],[5,5],[3,7],[1,7],[7,5],[3,11],[5,1]];
  const cellCenter=(c,r)=>({x:(c+.5)*CELL,y:(r+.5)*CELL});
  const cellOf=(x,y)=>({c:Math.floor(x/CELL),r:Math.floor(y/CELL)});
  const isWall=(c,r)=>c<=0||r<=0||c>=COLS-1||r>=ROWS-1||(c%2===0&&r%2===0);
  const WALLS=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(isWall(c,r)) WALLS.push(Object.freeze({c,r,...cellCenter(c,r)}));
  Object.freeze(WALLS);
  function freshCrates(){return CRATE_CELLS.map(([c,r],i)=>({id:'crate-'+i,c,r,...cellCenter(c,r),alive:true,topicId:TOPICS[i%15][0],label:TOPICS[i%15][1]}));}
  function bombBlocks(b,x,y,world,id){
    if(id&&b.passIds.includes(id))return false;
    const p=id&&world&&world.players&&world.players.find(p=>p.id===id);
    // A radius can still overlap the old tile after its center has left.
    // Permit only outward separation, never a return into that balloon.
    if(p&&Math.abs(p.x-b.x)<CELL/2+15&&Math.abs(p.y-b.y)<CELL/2+15&&
      Math.abs(x-b.x)>=Math.abs(p.x-b.x)&&Math.abs(y-b.y)>=Math.abs(p.y-b.y))return false;
    return true;
  }
  function canStand(x,y,world,id){
    if(!Number.isFinite(x)||!Number.isFinite(y)) return false;
    const crates=world?world.crates:freshCrates(), bombs=world?world.bombs:[];
    for(let r=Math.floor((y-15)/CELL);r<=Math.floor((y+15)/CELL);r++) for(let c=Math.floor((x-15)/CELL);c<=Math.floor((x+15)/CELL);c++) {
      if(isWall(c,r)||crates.some(q=>q.alive&&q.c===c&&q.r===r)||bombs.some(b=>b.c===c&&b.r===r&&bombBlocks(b,x,y,world,id))) return false;
    }
    return true;
  }
  const validTime=(g,now)=>Number.isFinite(now)&&now>=g.now;
  function newPlayer(id,team){return {id,team,...cellCenter(team===0?1:7,team===0?1:11),score:0,trappedUntil:0,immuneUntil:0,bombReadyAt:0,ready:false};}
  function addPlayer(g,id,now=g.now){
    if(typeof id!=='string'||!id.length||g.players.some(p=>p.id===id)||g.players.length>=2||!validTime(g,now)) return false;
    step(g,now);g.players.push(newPlayer(id,g.players.some(p=>p.team===0)?1:0));
    internal.get(g).inputs.set(id,{x:0,y:0,bomb:false});
    if(g.players.length===2)beginCountdown(g);return true;
  }
  function resetArena(g){
    for(const p of g.players)Object.assign(p,newPlayer(p.id,p.team));
    g.bombs=[];g.blasts=[];g.crates=freshCrates();g.winnerIds=[];
    const inputs=internal.get(g).inputs;inputs.clear();for(const p of g.players)inputs.set(p.id,{x:0,y:0,bomb:false});
  }
  function beginCountdown(g){resetArena(g);g.roundId++;g.phase='countdown';g.phaseUntil=g.now+internal.get(g).countdownMs;g.endsAt=0;}
  function finish(g){
    g.phase='finished';const high=Math.max(...g.players.map(p=>p.score));g.winnerIds=g.players.filter(p=>p.score===high).map(p=>p.id);emit(g,'finish');
  }
  function removePlayer(g,id,now=g.now){
    const i=g.players.findIndex(p=>p.id===id);if(i<0||!validTime(g,now))return false;
    g.now=now;const [p]=g.players.splice(i,1);emit(g,'left',{playerId:p.id,x:p.x,y:p.y});resetArena(g);g.phase='practice';g.phaseUntil=0;g.endsAt=0;return true;
  }
  function rematch(g,id,now=g.now){
    const p=g.players.find(p=>p.id===id);if(!p||p.ready||g.phase!=='finished'||g.players.length!==2||!validTime(g,now))return false;
    step(g,now);p.ready=true;if(g.players.every(p=>p.ready))beginCountdown(g);return true;
  }
  function direction(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y)) return {x:0,y:0};
    return Math.abs(x)>=Math.abs(y)?{x:Math.max(-1,Math.min(1,x)),y:0}:{x:0,y:Math.max(-1,Math.min(1,y))};
  }
  function setInput(g,id,input){
    const inputs=internal.get(g).inputs,old=inputs.get(id);
    if(!old||!input||typeof input!=='object') return false;
    inputs.set(id,{...direction(input.x,input.y),bomb:old.bomb||input.bomb===true});return true;
  }
  function movePlayer(p,x,y,dt,speed=SPEED,g){
    if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(speed)||speed<=0) return p;
    const v=direction(x,y), amount=Math.min(dt,.05)*Math.min(speed,SPEED);
    if(v.x===0&&v.y===0) return p;
    const center=cellCenter(...Object.values(cellOf(p.x,p.y)));
    const next={x:p.x,y:p.y};
    if(v.x&&Math.abs(p.y-center.y)<=12) next.y=center.y;
    if(v.y&&Math.abs(p.x-center.x)<=12) next.x=center.x;
    if(canStand(next.x,next.y,g,p.id)){p.x=next.x;p.y=next.y;}
    const slices=Math.max(1,Math.ceil(amount/2));
    for(let i=0;i<slices;i++) if(canStand(p.x+v.x*amount/slices,p.y+v.y*amount/slices,g,p.id)){p.x+=v.x*amount/slices;p.y+=v.y*amount/slices;}
    p.x=Math.round(p.x*1e6)/1e6;p.y=Math.round(p.y*1e6)/1e6;
    return p;
  }
  function findPath(x,y,tx,ty,world){
    const id=world&&world.players&&world.players.find(p=>Math.abs(p.x-x)<1e-6&&Math.abs(p.y-y)<1e-6)?.id;
    if(!canStand(x,y,world,id)||!canStand(tx,ty,world,id))return [];
    if(x===tx&&y===ty)return [{x,y}];
    const start=cellOf(x,y),end=cellOf(tx,ty),key=q=>q.c+','+q.r;
    const queue=[start],prev=new Map([[key(start),null]]);
    for(let head=0;head<queue.length;head++){
      const p=queue[head];if(p.c===end.c&&p.r===end.r)break;
      for(const [dc,dr]of [[0,-1],[0,1],[-1,0],[1,0]]){
        const q={c:p.c+dc,r:p.r+dr},center=cellCenter(q.c,q.r);
        if(!prev.has(key(q))&&canStand(center.x,center.y,world,id)){prev.set(key(q),p);queue.push(q);}
      }
    }
    if(!prev.has(key(end)))return [];
    const cells=[];for(let p=end;p;p=prev.get(key(p)))cells.push(cellCenter(p.c,p.r));cells.reverse();
    const result=[{x,y}];
    function append(p){
      let last=result.at(-1);if(last.x===p.x&&last.y===p.y)return true;
      if(last.x!==p.x&&last.y!==p.y){if(!append({x:p.x,y:last.y}))return false;last=result.at(-1);}
      const steps=Math.max(1,Math.ceil(Math.hypot(p.x-last.x,p.y-last.y)/2));
      for(let i=1;i<=steps;i++)if(!canStand(last.x+(p.x-last.x)*i/steps,last.y+(p.y-last.y)*i/steps,world,id))return false;
      result.push(p);return true;
    }
    for(const p of [...cells,{x:tx,y:ty}])if(!append(p))return [];
    return result;
  }
  function emit(g,type,data={}){
    g.events.push({id:++internal.get(g).eventId,type,...data});
    if(g.events.length>40)g.events.splice(0,g.events.length-40);
  }
  function placeBomb(g,p){
    const {c,r}=cellOf(p.x,p.y);
    if(g.now<p.trappedUntil||g.now<p.bombReadyAt||isWall(c,r)||g.crates.some(q=>q.alive&&q.c===c&&q.r===r)||g.bombs.some(b=>b.c===c&&b.r===r)||g.bombs.filter(b=>b.ownerId===p.id).length>=2)return;
    const b={id:'bomb-'+(++internal.get(g).bombId),ownerId:p.id,c,r,...cellCenter(c,r),placedAt:g.now,explodeAt:g.now+1800,range:2,passIds:g.players.filter(q=>{const s=cellOf(q.x,q.y);return s.c===c&&s.r===r;}).map(q=>q.id)};
    g.bombs.push(b);p.bombReadyAt=g.now+350;emit(g,'place',{playerId:p.id,x:b.x,y:b.y});
  }
  function updatePasses(g){for(const b of g.bombs)b.passIds=b.passIds.filter(id=>g.players.some(p=>{const tile=cellOf(p.x,p.y);return p.id===id&&tile.c===b.c&&tile.r===b.r;}));}
  function blastCells(g,bomb){
    const cells=[{c:bomb.c,r:bomb.r}];
    for(const [dc,dr] of [[0,-1],[0,1],[-1,0],[1,0]])for(let i=1;i<=bomb.range;i++){
      const c=bomb.c+dc*i,r=bomb.r+dr*i;if(isWall(c,r))break;cells.push({c,r});if(g.crates.some(q=>q.alive&&q.c===c&&q.r===r))break;
    }
    return cells;
  }
  function detonate(g){
    while(g.bombs.some(b=>b.explodeAt<=g.now)){
      const first=g.bombs.filter(b=>b.explodeAt<=g.now).sort((a,b)=>a.explodeAt-b.explodeAt||a.placedAt-b.placedAt||a.id.localeCompare(b.id))[0];
      const at=first.explodeAt, queue=[first], seen=new Set(), waves=[];
      for(let i=0;i<queue.length;i++){
        const b=queue[i];if(seen.has(b.id))continue;seen.add(b.id);const cells=blastCells(g,b);waves.push({b,cells});
        for(const q of g.bombs)if(!seen.has(q.id)&&cells.some(c=>c.c===q.c&&c.r===q.r))queue.push(q);
      }
      g.bombs=g.bombs.filter(b=>!seen.has(b.id));
      for(const {b,cells} of waves){
        g.blasts.push({id:'blast-'+(++internal.get(g).blastId),ownerId:b.ownerId,cells,expiresAt:at+450});
        emit(g,'splash',{playerId:b.ownerId,x:b.x,y:b.y});
        for(const q of g.crates)if(q.alive&&cells.some(c=>c.c===q.c&&c.r===q.r)){
          q.alive=false;const p=g.players.find(p=>p.id===b.ownerId);if(p&&g.phase==='practice')p.score++;
          emit(g,'destroy',{playerId:b.ownerId,topicId:q.topicId,x:q.x,y:q.y});
        }
      }
    }
    g.blasts=g.blasts.filter(b=>b.expiresAt>g.now);
  }
  function resolveHits(g){
    const hits=[];
    for(const p of g.players){
      if(g.now<p.immuneUntil||g.now<p.trappedUntil)continue;
      const tile=cellOf(p.x,p.y), touching=g.blasts.filter(b=>b.cells.some(c=>c.c===tile.c&&c.r===tile.r));
      const blast=touching.find(b=>b.ownerId!==p.id)||touching[0];if(blast)hits.push({p,blast});
    }
    for(const {p,blast} of hits){
      p.trappedUntil=g.now+1000;p.immuneUntil=g.now+2500;
      const scorer=g.players.find(q=>q.id===blast.ownerId);const points=g.phase==='playing'&&scorer&&scorer.id!==p.id?1:0;
      if(points)scorer.score++;
      emit(g,'capture',{playerId:blast.ownerId,victimId:p.id,x:p.x,y:p.y,points});
    }
    if(g.phase==='playing'&&g.players.some(p=>p.score>=3))finish(g);
  }
  function step(g,now){
    if(!validTime(g,now)) return g;
    const dt=Math.min((now-g.now)/1000,.05);g.now=now;
    if(g.phase==='countdown'){
      for(const input of internal.get(g).inputs.values()){input.x=0;input.y=0;input.bomb=false;}
      if(now>=g.phaseUntil){g.phase='playing';g.endsAt=g.phaseUntil+internal.get(g).roundMs;g.phaseUntil=0;emit(g,'start');if(now>=g.endsAt)finish(g);}return g;
    }
    if(g.phase==='playing'&&now>=g.endsAt)finish(g);
    if(g.phase==='finished'){for(const input of internal.get(g).inputs.values())input.bomb=false;return g;}
    for(const p of g.players){const input=internal.get(g).inputs.get(p.id);if(now>=p.trappedUntil){movePlayer(p,input.x,input.y,dt,SPEED,g);if(input.bomb)placeBomb(g,p);}input.bomb=false;}
    updatePasses(g);detonate(g);resolveHits(g);
    return g;
  }
  function snapshot(g){
    return JSON.parse(JSON.stringify({kind:'bubble',cols:COLS,rows:ROWS,cell:CELL,width:WORLD_WIDTH,height:WORLD_HEIGHT,
      phase:g.phase,now:g.now,roundId:g.roundId,phaseUntil:g.phaseUntil,endsAt:g.endsAt,
      remainingMs:g.phase==='playing'?Math.max(0,g.endsAt-g.now):0,mode:g.players.length===2?'pvp':'solo',
      players:g.players.map(p=>({id:p.id,team:p.team,x:p.x,y:p.y,score:p.score,trappedUntil:p.trappedUntil,immuneUntil:p.immuneUntil,bombReadyAt:p.bombReadyAt,ready:p.ready})),
      bombs:g.bombs,blasts:g.blasts,crates:g.crates,walls:WALLS,events:g.events,winnerIds:g.winnerIds}));
  }
  function createGame({now=0,roundMs=60000,countdownMs=2000}={}) {
    if(!Number.isFinite(now)||!Number.isFinite(roundMs)||roundMs<=0||!Number.isFinite(countdownMs)||countdownMs<0)throw new RangeError('Finite clock, positive roundMs and nonnegative countdownMs required');
    const g={phase:'practice',now,roundId:0,phaseUntil:0,endsAt:0,players:[],events:[],winnerIds:[],bombs:[],blasts:[],crates:freshCrates(),walls:WALLS};
    internal.set(g,{roundMs,countdownMs,inputs:new Map(),eventId:0,bombId:0,blastId:0});
    return g;
  }
  return {GAME_KIND:'bubble',COLS,ROWS,CELL,WORLD_WIDTH,WORLD_HEIGHT,SPEED,DASH_SPEED,ACTIONS,LANDMARKS,TARGETS,PICKUP_SLOTS,createGame,cellCenter,cellOf,canStand,addPlayer,removePlayer,rematch,setInput,movePlayer,step,blastCells,findPath,snapshot};
});

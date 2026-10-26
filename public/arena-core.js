(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ArenaCore = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WORLD_WIDTH = 1200, WORLD_HEIGHT = 1100, SPEED = 230, DASH_SPEED = 360;
  const internal = new WeakMap();
  function createGame({ now = 0, roundMs = 60000, countdownMs = 2000 } = {}) {
    if(!Number.isFinite(now)||!Number.isFinite(roundMs)||roundMs<=0||!Number.isFinite(countdownMs)||countdownMs<0) throw new RangeError('Finite clock, positive roundMs and nonnegative countdownMs required');
    const g = { phase: 'practice', now, roundId: 0, phaseUntil: 0, endsAt: 0,
      players: [], pickups: freshPickups(), events: [], winnerIds: [] };
    internal.set(g, { roundMs, countdownMs, inputs: new Map(), eventId: 0 });
    return g;
  }
  const validTime = (g, now) => Number.isFinite(now) && now >= g.now;
  function newPlayer(id,team) {
    return { id, team, x:team===0?420:780, y:600, score:0, carry:null,
      dashUntil:0, dashReadyAt:0, tagReadyAt:0, immuneUntil:0, stunUntil:0, ready:false };
  }
  function addPlayer(g,id,now=g.now) {
    if(typeof id!=='string'||!id.length||g.players.some(p=>p.id===id)||g.players.length>=2||!validTime(g,now)) return false;
    step(g,now);
    g.players.push(newPlayer(id,g.players.some(p=>p.team===0)?1:0));
    internal.get(g).inputs.set(id,{x:0,y:0,dash:false,tag:false});
    if(g.players.length===2) beginCountdown(g);
    return true;
  }
  function resetArena(g) {
    for(const p of g.players) Object.assign(p,newPlayer(p.id,p.team));
    g.pickups=freshPickups();g.winnerIds=[];
    const inputs=internal.get(g).inputs;inputs.clear();
    for(const p of g.players) inputs.set(p.id,{x:0,y:0,dash:false,tag:false});
  }
  function beginCountdown(g) {
    resetArena(g);g.roundId++;g.phase='countdown';
    g.phaseUntil=g.now+internal.get(g).countdownMs;g.endsAt=0;
  }
  function removePlayer(g,id,now=g.now) {
    const index=g.players.findIndex(p=>p.id===id);
    if(index<0||!validTime(g,now)) return false;
    // A disconnect is not a simulation tick: never manufacture a late win.
    g.now=now;const [leaver]=g.players.splice(index,1);emit(g,'left',leaver,leaver.carry);
    resetArena(g);g.phase='practice';g.phaseUntil=0;g.endsAt=0;
    return true;
  }
  function direction(x,y) {
    if(!Number.isFinite(x)||!Number.isFinite(y)) return {x:0,y:0};
    const scale=Math.max(1,Math.abs(x),Math.abs(y));
    const sx=x/scale, sy=y/scale, length=Math.hypot(sx,sy);
    const divisor=scale>1?length:Math.max(1,length);
    return {x:sx/divisor,y:sy/divisor};
  }
  function setInput(g,id,input) {
    const inputs=internal.get(g).inputs, old=inputs.get(id);
    if(!old||!input||typeof input!=='object') return false;
    inputs.set(id,{...direction(input.x,input.y),dash:old.dash||input.dash===true,tag:old.tag||input.tag===true});
    return true;
  }
  function movePlayer(p,x,y,dt,speed=SPEED) {
    if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(speed)||speed<=0||!canStand(p.x,p.y)) return p;
    const v=direction(x,y), seconds=Math.min(dt,0.05), velocity=Math.min(speed,DASH_SPEED);
    const dx=v.x*velocity*seconds, dy=v.y*velocity*seconds;
    const slices=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));
    for(let i=0;i<slices;i++) {
      let next={x:p.x+dx/slices,y:p.y};
      if(safeSegment(p,next)) p.x=next.x;
      next={x:p.x,y:p.y+dy/slices};
      if(safeSegment(p,next)) p.y=next.y;
    }
    return p;
  }
  function step(g,now) {
    if(!validTime(g,now)||(now===g.now && !(g.phase==='countdown' && now>=g.phaseUntil))) return g;
    const dt=Math.min((now-g.now)/1000,0.05);
    g.now=now;
    if(g.phase==='countdown') {
      for(const input of internal.get(g).inputs.values()) {input.dash=false;input.tag=false;}
      if(now>=g.phaseUntil) {
        g.phase='playing';g.endsAt=g.phaseUntil+internal.get(g).roundMs;g.phaseUntil=0;
        emit(g,'start',null);
        if(now>=g.endsAt) finish(g);
      }
      return g;
    }
    if(g.phase==='playing' && now>=g.endsAt) finish(g);
    if(g.phase==='finished') {
      for(const input of internal.get(g).inputs.values()) {input.dash=false;input.tag=false;}
      return g;
    }
    if(g.phase==='practice'||g.phase==='playing') {
      for(const box of g.pickups) if(!box.active && now>=box.respawnAt) {box.active=true;box.respawnAt=0;}
      for(const p of g.players) {
        const input=internal.get(g).inputs.get(p.id);
        if(now>=p.stunUntil) {
          if(input.dash && now>=p.dashReadyAt) {
            p.dashUntil=now+300;p.dashReadyAt=now+1200;emit(g,'dash',p,p.carry);
          }
          movePlayer(p,input.x,input.y,dt,now<p.dashUntil?DASH_SPEED:SPEED);
        }
        input.dash=false;
      }
      for(const p of g.players) {
        const input=internal.get(g).inputs.get(p.id);
        if(input.tag) tryTag(g,p);
        input.tag=false;
      }
      for(const p of g.players) if(now>=p.stunUntil) collectAndDeliver(g,p);
    }
    return g;
  }
  function freshPickups() { return PICKUP_SLOTS.map((p,i)=>({id:`box-${i}`,kind:p.kind,x:p.x,y:p.y,active:true,respawnAt:0})); }
  function emit(g,type,p,kind=null,points) {
    const event={id:++internal.get(g).eventId,type,playerId:p?p.id:null,kind,x:p?p.x:0,y:p?p.y:0};
    if(points!==undefined) event.points=points;
    g.events.push(event);
    if(g.events.length>40) g.events.splice(0,g.events.length-40);
  }
  const distance = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function collectAndDeliver(g,p) {
    if(p.carry===null) {
      const box=g.pickups.find(b=>b.active && distance(p,b)<=28);
      if(box) {
        box.active=false;box.respawnAt=g.now+1000;p.carry=box.kind;
        emit(g,'pickup',p,box.kind);
      }
    }
    const target=TARGETS.find(t=>t.kind===p.carry && distance(p,t)<=45);
    if(target) { const kind=p.carry;p.carry=null;p.score+=100;emit(g,'deliver',p,kind,100); }
  }
  function tryTag(g,p) {
    if(g.phase!=='playing'||g.players.length!==2||p.carry!==null||g.now<p.stunUntil||g.now<p.tagReadyAt) return;
    const victim=g.players.find(v=>v!==p && v.carry!==null && g.now>=v.immuneUntil && distance(p,v)<=65);
    if(!victim) return;
    p.carry=victim.carry;victim.carry=null;
    victim.stunUntil=g.now+450;victim.immuneUntil=Math.max(victim.immuneUntil,g.now+1200);
    p.immuneUntil=Math.max(p.immuneUntil,g.now+600);p.tagReadyAt=g.now+2200;
    emit(g,'steal',p,p.carry);
  }
  function finish(g) {
    g.phase='finished';
    const high=Math.max(...g.players.map(p=>p.score));
    g.winnerIds=g.players.filter(p=>p.score===high).map(p=>p.id);
    emit(g,'finish',null);
  }
  function rematch(g,id,now=g.now) {
    const p=g.players.find(p=>p.id===id);
    if(!p||p.ready||g.phase!=='finished'||g.players.length!==2||!validTime(g,now)) return false;
    step(g,now);p.ready=true;
    if(g.players.every(p=>p.ready)) beginCountdown(g);
    return true;
  }
  function snapshot(g) {
    return JSON.parse(JSON.stringify({width:WORLD_WIDTH,height:WORLD_HEIGHT,
      phase:g.phase,now:g.now,roundId:g.roundId,phaseUntil:g.phaseUntil,endsAt:g.endsAt,
      remainingMs:g.phase==='playing'?Math.max(0,g.endsAt-g.now):0,
      mode:g.players.length===2?'pvp':'solo',players:g.players,pickups:g.pickups,
      targets:TARGETS,landmarks:LANDMARKS,events:g.events,winnerIds:g.winnerIds}));
  }
  const freezeRows = rows => Object.freeze(rows.map(row => Object.freeze(row)));
  const LANDMARKS = freezeRows([
    {id:'station',kind:'station',label:'臺中驛',x:475,y:80,w:250,h:160},
    {id:'market',kind:'market',label:'第二市場',x:100,y:180,w:220,h:150},
    {id:'expo',kind:'expo',label:'水湳會展',x:860,y:100,w:240,h:160},
    {id:'theater',kind:'theater',label:'歌劇院',x:80,y:690,w:220,h:160},
    {id:'mushroom',kind:'mushroom',label:'新社菇園',x:900,y:710,w:220,h:150},
    {id:'hakka',kind:'hakka',label:'東勢客家',x:490,y:900,w:220,h:140},
    {id:'coast',kind:'windmill',label:'高美濕地',x:995,y:390,w:150,h:130,decor:true}
  ]);
  const TARGETS = freezeRows([
    {id:'bus',kind:'bus',label:'接駁',color:'#e7b75e',topicId:'smart-transport',x:600,y:330},
    {id:'family',kind:'family',label:'托育',color:'#bd88b9',topicId:'parenting',x:260,y:450},
    {id:'care',kind:'care',label:'照護',color:'#64b5a8',topicId:'senior-care',x:940,y:570}
  ]);
  const PICKUP_SLOTS = freezeRows([
    {x:400,y:640,kind:'bus'},{x:600,y:600,kind:'family'},{x:800,y:640,kind:'care'},
    {x:500,y:480,kind:'care'},{x:700,y:480,kind:'bus'},{x:600,y:730,kind:'family'}
  ]);
  const SOLIDS = LANDMARKS.filter(l => !l.decor);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function canStand(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 14 || y < 14 || x > WORLD_WIDTH - 14 || y > WORLD_HEIGHT - 14) return false;
    return SOLIDS.every(l => Math.hypot(x - clamp(x, l.x, l.x+l.w), y - clamp(y, l.y, l.y+l.h)) >= 14);
  }
  function pointSegmentDistance(p, a, b) {
    const dx=b.x-a.x, dy=b.y-a.y;
    const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
  }
  function segmentDistance(a,b,c,d) {
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
    if (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) return 0;
    return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
  }
  function safeSegment(a,b) {
    if (!canStand(a.x,a.y) || !canStand(b.x,b.y)) return false;
    return SOLIDS.every(l => {
      const corners=[{x:l.x,y:l.y},{x:l.x+l.w,y:l.y},{x:l.x+l.w,y:l.y+l.h},{x:l.x,y:l.y+l.h}];
      return corners.every((c,i)=>segmentDistance(a,b,c,corners[(i+1)%4])>=14-1e-9);
    });
  }
  let grid;
  function pathGrid() {
    if (grid) return grid;
    const nodes=[], byKey=new Map();
    for (let y=20;y<WORLD_HEIGHT;y+=20) for(let x=20;x<WORLD_WIDTH;x+=20) if(canStand(x,y)) {
      const node={x,y,index:nodes.length,next:[]}; nodes.push(node); byKey.set(`${x},${y}`,node);
    }
    for(const n of nodes) for(const [dx,dy] of [[20,0],[0,20],[-20,0],[0,-20]]) {
      const q=byKey.get(`${n.x+dx},${n.y+dy}`);
      if(q && safeSegment(n,q)) n.next.push(q.index);
    }
    grid=nodes; return nodes;
  }
  function findPath(x,y,tx,ty) {
    const start={x,y}, end={x:tx,y:ty};
    if(!canStand(x,y)||!canStand(tx,ty)) return [];
    if(x===tx && y===ty) return [start];
    if(safeSegment(start,end)) return [start,end];
    const nodes=pathGrid();
    const connectors=p=>nodes.filter(n=>Math.hypot(n.x-p.x,n.y-p.y)<=40 && safeSegment(p,n));
    const starts=connectors(start), goals=new Set(connectors(end).map(n=>n.index));
    const prev=new Int32Array(nodes.length).fill(-2), queue=[];
    for(const n of starts) {prev[n.index]=-1;queue.push(n.index);}
    for(let head=0;head<queue.length;head++) {
      const index=queue[head];
      if(goals.has(index)) {
        const route=[];
        for(let i=index;i!==-1;i=prev[i]) route.push({x:nodes[i].x,y:nodes[i].y});
        return [start,...route.reverse().filter(p=>(p.x!==x||p.y!==y)&&(p.x!==tx||p.y!==ty)),end];
      }
      for(const next of nodes[index].next) if(prev[next]===-2) {prev[next]=index;queue.push(next);}
    }
    return [];
  }
  return { WORLD_WIDTH, WORLD_HEIGHT, SPEED, DASH_SPEED, LANDMARKS, TARGETS, PICKUP_SLOTS,
    createGame, addPlayer, removePlayer, setInput, step, rematch, snapshot, canStand, findPath, movePlayer };
});

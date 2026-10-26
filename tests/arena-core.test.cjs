'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CORE = '../public/arena-core.js';
const A = require(CORE);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('geometry exports exact landmarks, targets and pickup slots', () => {
  assert.equal(A.LANDMARKS.length, 7);
  assert.deepEqual(A.LANDMARKS.map(l => l.id), ['station', 'market', 'expo', 'theater', 'mushroom', 'hakka', 'coast']);
  assert.deepEqual(A.LANDMARKS[0], { id: 'station', kind: 'station', label: '臺中驛', x: 475, y: 80, w: 250, h: 160 });
  assert.deepEqual(A.TARGETS.map(t => [t.kind, t.x, t.y]), [['bus', 600, 330], ['family', 260, 450], ['care', 940, 570]]);
  assert.deepEqual(A.PICKUP_SLOTS.map(p => [p.x,p.y,p.kind]), [[400,640,'bus'],[600,600,'family'],[800,640,'care'],[500,480,'care'],[700,480,'bus'],[600,730,'family']]);
});

test('canStand applies radius14 to world edges and solid rectangles, not decor', () => {
  assert.equal(A.canStand(14, 14), true);
  for (const [x,y] of [[13.99,14],[1186.01,500],[500,1086.01],[NaN,1],[500,200],[474,200],[100,700]]) assert.equal(A.canStand(x,y), false, `${x},${y}`);
  assert.equal(A.canStand(461, 200), true);
  assert.equal(A.canStand(1060, 450), true);
});

test('findPath returns safe grid20 BFS route with exact arbitrary endpoints around obstacles', () => {
  const path = A.findPath(400.3, 160.7, 800.1, 160.2);
  assert.ok(path.length > 2);
  assert.deepEqual(path[0], {x:400.3,y:160.7});
  assert.deepEqual(path.at(-1), {x:800.1,y:160.2});
  for (let i = 1; i < path.length; i++) {
    const a=path[i-1], b=path[i];
    const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y));
    for (let s=0;s<=n;s++) assert.ok(A.canStand(a.x+(b.x-a.x)*s/n,a.y+(b.y-a.y)*s/n), `unsafe connector ${i}`);
  }
  assert.deepEqual(A.findPath(600,160,800,160), []);
  assert.deepEqual(A.findPath(400,400,NaN,5), []);
  assert.deepEqual(A.findPath(400,400,400,400), [{x:400,y:400}]);
});

test('every spawn, pickup and target is walkable and mutually reachable', () => {
  const points = [{x:420,y:600},{x:780,y:600},...A.PICKUP_SLOTS,...A.TARGETS];
  for (const p of points) {
    assert.ok(A.canStand(p.x,p.y));
    for (const q of points) assert.ok(A.findPath(p.x,p.y,q.x,q.y).length, `${p.x},${p.y} -> ${q.x},${q.y}`);
  }
});

function solo(options) { const g=A.createGame(options); assert.ok(A.addPlayer(g,'a')); return g; }

test('first player spawns as team0 in live practice with public player fields', () => {
  const g=solo({now:100});
  assert.deepEqual(g.players[0], {id:'a',team:0,x:420,y:600,score:0,carry:null,dashUntil:0,dashReadyAt:0,tagReadyAt:0,immuneUntil:0,stunUntil:0,ready:false});
  assert.equal(g.phase,'practice');
  assert.equal(g.now,100);
});

test('practice movement normalizes finite input and caps a delayed frame to 50ms', () => {
  const g=solo();
  assert.ok(A.setInput(g,'a',{x:30,y:40,score:999,xPosition:999}));
  A.step(g,10000);
  near(g.players[0].x,426.9); near(g.players[0].y,609.2);
  assert.equal(g.players[0].score,0);
  A.setInput(g,'a',{x:NaN,y:Infinity}); A.step(g,10050);
  near(g.players[0].x,426.9); near(g.players[0].y,609.2);
  A.setInput(g,'a',{x:0.5,y:0}); A.step(g,10100);
  near(g.players[0].x,432.65);
});

test('step rejects backwards or nonfinite time without changing state', () => {
  const g=solo({now:500}); A.setInput(g,'a',{x:1,y:0});
  const before=A.snapshot(g);
  for(const time of [499,NaN,Infinity,'600']) { A.step(g,time); assert.deepEqual(A.snapshot(g),before); }
  A.step(g,500); assert.deepEqual(A.snapshot(g),before);
});

test('prediction movePlayer slides along solids, stops at boundaries and never mutates score', () => {
  assert.equal(typeof A.movePlayer,'function');
  const p={x:460,y:160,score:77,carry:'bus'};
  A.movePlayer(p,1,1,0.05); assert.ok(p.x<462); assert.ok(p.y>160); assert.ok(A.canStand(p.x,p.y));
  const edge={x:1186,y:1086,score:11}; A.movePlayer(edge,1,1,500,99999);
  assert.deepEqual(edge,{x:1186,y:1086,score:11});
  assert.equal(p.score,77); assert.equal(p.carry,'bus');
});

test('autopickup uses radius28, carries kind string and disables exactly one slot', () => {
  const g=solo(), p=g.players[0];
  assert.equal(g.pickups.length,6);
  assert.deepEqual(g.pickups[0],{id:'box-0',kind:'bus',x:400,y:640,active:true,respawnAt:0});
  p.x=428.01; p.y=640; A.step(g,50); assert.equal(p.carry,null);
  p.x=428; A.step(g,100); assert.equal(p.carry,'bus');
  assert.equal(g.pickups[0].active,false); assert.equal(g.pickups[0].respawnAt,1100);
  p.x=600;p.y=600;A.step(g,150); assert.equal(p.carry,'bus'); assert.equal(g.pickups[1].active,true);
  assert.equal(g.events.filter(e=>e.type==='pickup').length,1);
});

test('matching radius45 delivery awards only100 once; wrong target and duplicate input do not score', () => {
  const g=solo(), p=g.players[0]; p.x=400;p.y=640;A.step(g,50);
  p.x=260;p.y=450;A.step(g,100); assert.equal(p.score,0); assert.equal(p.carry,'bus');
  p.x=645.01;p.y=330;A.step(g,150); assert.equal(p.score,0);
  p.x=645;A.step(g,200); assert.equal(p.score,100); assert.equal(p.carry,null);
  for(let i=0;i<3;i++) { A.setInput(g,'a',{x:0,y:0,score:1000,carry:'bus'});A.step(g,250+i*50); }
  assert.equal(p.score,100);
  const e=g.events.find(e=>e.type==='deliver');
  assert.deepEqual(e,{id:2,type:'deliver',playerId:'a',kind:'bus',x:645,y:330,points:100});
});

test('picked slot respawns at exactly1000ms only once and practice never ends', () => {
  const g=solo(), p=g.players[0]; p.x=400;p.y=640;A.step(g,50);
  p.x=600;p.y=330;A.step(g,100);
  A.step(g,1049); assert.equal(g.pickups[0].active,false);
  A.step(g,1050); assert.equal(g.pickups[0].active,true); assert.equal(g.pickups[0].respawnAt,0);
  A.step(g,100000); assert.equal(g.phase,'practice'); assert.deepEqual(g.winnerIds,[]); assert.equal(p.score,100);
});

test('snapshot is detached public world state with no queued input internals', () => {
  const g=solo(); A.setInput(g,'a',{x:1,y:0,dash:true});
  const s=A.snapshot(g);
  assert.equal(s.width,1200);assert.equal(s.height,1100);assert.equal(s.mode,'solo');assert.equal(s.remainingMs,0);
  assert.deepEqual(s.targets,A.TARGETS);assert.deepEqual(s.landmarks,A.LANDMARKS);
  assert.equal('input' in s.players[0],false); assert.equal('inputs' in s,false);
  s.players[0].score=999;s.pickups[0].active=false;s.targets[0].x=1;s.events.push({});s.winnerIds.push('fake');
  assert.equal(g.players[0].score,0);assert.equal(g.pickups[0].active,true);assert.equal(A.TARGETS[0].x,600);assert.equal(g.events.length,0);assert.deepEqual(g.winnerIds,[]);
});

function pvp(options) { const g=solo(options); assert.ok(A.addPlayer(g,'b')); A.step(g,g.phaseUntil); assert.equal(g.phase,'playing'); return g; }

test('second join starts fresh countdown resetting both players, inputs and pickups', () => {
  const g=solo({now:100}), p=g.players[0];p.x=400;p.y=640;A.step(g,150);
  p.x=600;p.y=330;A.step(g,200);A.setInput(g,'a',{x:1,y:0,dash:true});
  assert.ok(A.addPlayer(g,'b',500));
  assert.equal(g.phase,'countdown');assert.equal(g.roundId,1);assert.equal(g.phaseUntil,2500);assert.equal(g.endsAt,0);
  assert.deepEqual(g.players.map(p=>[p.id,p.team,p.x,p.y,p.score,p.carry,p.ready]),[['a',0,420,600,0,null,false],['b',1,780,600,0,null,false]]);
  assert.ok(g.pickups.every(b=>b.active&&b.respawnAt===0));
  A.step(g,2499);assert.equal(g.players[0].x,420);
  A.step(g,2500);assert.equal(g.phase,'playing');assert.equal(g.endsAt,62500);
  A.step(g,2550);assert.equal(g.players[0].x,420);assert.equal(g.players[0].dashUntil,0);
  assert.equal(A.snapshot(g).mode,'pvp');assert.equal(A.snapshot(g).remainingMs,59950);
  assert.equal(g.events.filter(e=>e.type==='start').length,1);
});

test('countdown blocks movement, pickup and queued action; delayed start keeps exact deadline', () => {
  const g=solo({now:1000,roundMs:5000,countdownMs:300});A.addPlayer(g,'b');
  A.setInput(g,'a',{x:1,y:0,dash:true,tag:true});A.step(g,1299);
  assert.equal(g.phase,'countdown');assert.equal(g.players[0].x,420);
  A.step(g,1600);assert.equal(g.phase,'playing');assert.equal(g.endsAt,6300);
  assert.equal(g.players[0].dashUntil,0);assert.equal(g.players[0].x,420);
});

test('same-slot pickup tie is won by stable first-player order', () => {
  const g=pvp(); for(const p of g.players) {p.x=600;p.y=600;}
  A.step(g,2050);assert.equal(g.players[0].carry,'family');assert.equal(g.players[1].carry,null);
  assert.equal(g.events.filter(e=>e.type==='pickup').length,1);
});

test('duplicate, third, unknown and invalid-time requests reject atomically', () => {
  const g=pvp();const before=A.snapshot(g);
  for(const [fn,args] of [[A.addPlayer,['a',9999]],[A.addPlayer,['c',9999]],[A.addPlayer,['',9999]],[A.removePlayer,['missing',9999]],[A.setInput,['missing',{x:1,y:1}]],[A.rematch,['missing',9999]],[A.addPlayer,['c',NaN]]]) {
    assert.equal(fn(g,...args),false);assert.deepEqual(A.snapshot(g),before);
  }
});

test('dash is one-shot360 speed for300ms with exact1200ms cooldown', () => {
  const g=solo(),p=g.players[0];A.setInput(g,'a',{x:1,y:0,dash:true});A.step(g,50);
  near(p.x,438);assert.equal(p.dashUntil,350);assert.equal(p.dashReadyAt,1250);
  A.step(g,300);near(p.x,456);
  A.setInput(g,'a',{x:1,y:0,dash:true});A.step(g,350);near(p.x,467.5);
  A.step(g,1249);assert.equal(g.events.filter(e=>e.type==='dash').length,1);
  A.setInput(g,'a',{x:1,y:0,dash:true});A.step(g,1250);
  assert.equal(p.dashUntil,1550);assert.equal(g.events.filter(e=>e.type==='dash').length,2);
});

test('stun blocks movement and consumes queued dash rather than firing after stun', () => {
  const g=solo(),p=g.players[0];p.stunUntil=500;
  A.setInput(g,'a',{x:1,y:0,dash:true});A.step(g,100);assert.equal(p.x,420);assert.equal(p.dashUntil,0);
  A.step(g,500);near(p.x,431.5);assert.equal(p.dashUntil,0);
});

function contest() { const g=pvp();const [a,b]=g.players;Object.assign(a,{x:500,y:600});Object.assign(b,{x:565,y:600,carry:'bus'});return g; }

test('playing empty-hand TAG transfers carry within65, applies450 stun and immunity timers', () => {
  const g=contest(),[a,b]=g.players;A.setInput(g,'a',{x:0,y:0,tag:true});A.step(g,2050);
  assert.equal(a.carry,'bus');assert.equal(b.carry,null);assert.equal(b.stunUntil,2500);assert.equal(b.immuneUntil,3250);
  assert.equal(a.immuneUntil,2650);assert.equal(a.tagReadyAt,4250);assert.equal(a.score,0);
  const steal=g.events.find(e=>e.type==='steal');assert.equal(steal.playerId,'a');assert.equal(steal.kind,'bus');
  A.setInput(g,'b',{x:1,y:0,tag:true});A.step(g,2499);assert.equal(b.x,565);assert.equal(a.carry,'bus');
  A.setInput(g,'b',{x:0,y:0,tag:true});A.step(g,2649);assert.equal(a.carry,'bus');
  A.setInput(g,'b',{x:0,y:0,tag:true});A.step(g,2650);assert.equal(b.carry,'bus');assert.equal(a.carry,null);
});

test('TAG rejects wrong phase, range, occupied attacker or protected victim; requests do not persist', () => {
  const practice=solo();practice.players[0].carry='bus';A.setInput(practice,'a',{x:0,y:0,tag:true});A.step(practice,50);
  assert.equal(practice.events.some(e=>e.type==='steal'),false);
  const g=contest(),[a,b]=g.players;
  b.x=565.01;A.setInput(g,'a',{x:0,y:0,tag:true});A.step(g,2050);assert.equal(a.carry,null);
  b.x=565;A.step(g,2100);assert.equal(a.carry,null);
  a.carry='care';A.setInput(g,'a',{x:0,y:0,tag:true});A.step(g,2150);assert.equal(b.carry,'bus');
  a.carry=null;b.immuneUntil=2300;A.setInput(g,'a',{x:0,y:0,tag:true});A.step(g,2299);assert.equal(a.carry,null);
  A.setInput(g,'a',{x:0,y:0,tag:true});A.step(g,2300);assert.equal(a.carry,'bus');
});

test('successful TAG2200 cooldown prevents a second theft until exact deadline', () => {
  const g=contest(),[a,b]=g.players;A.setInput(g,'a',{x:0,y:0,tag:true});A.step(g,2050);
  a.carry=null;b.carry='care';b.immuneUntil=0;b.stunUntil=0;
  A.setInput(g,'a',{x:0,y:0,tag:true});A.step(g,4249);assert.equal(a.carry,null);
  A.setInput(g,'a',{x:0,y:0,tag:true});A.step(g,4250);assert.equal(a.carry,'care');assert.equal(g.events.filter(e=>e.type==='steal').length,2);
});

test('round ends exactly at deadline with highest-score winner and no late deliveries', () => {
  const g=pvp({roundMs:1000}),[a,b]=g.players;a.score=200;b.score=100;
  A.step(g,2999);assert.equal(g.phase,'playing');assert.equal(A.snapshot(g).remainingMs,1);
  Object.assign(b,{x:600,y:330,carry:'bus'});A.setInput(g,'b',{x:1,y:0,dash:true,tag:true});
  A.step(g,3000);assert.equal(g.phase,'finished');assert.deepEqual(g.winnerIds,['a']);assert.equal(b.score,100);
  const x=b.x;A.step(g,4000);assert.equal(b.x,x);assert.equal(b.score,100);
  assert.equal(g.events.filter(e=>e.type==='finish').length,1);assert.equal(A.snapshot(g).remainingMs,0);
});

test('draw reports both IDs and a frame beyond entire countdown and round finishes immediately', () => {
  const g=solo();A.addPlayer(g,'b');A.step(g,62000);
  assert.equal(g.phase,'finished');assert.deepEqual(g.winnerIds,['a','b']);assert.equal(g.endsAt,62000);
  assert.deepEqual(g.events.map(e=>e.type),['start','finish']);
});

test('rematch requires both ready, clears all game state and starts new numbered countdown', () => {
  const g=pvp({roundMs:1000});const before=A.snapshot(g);
  assert.equal(A.rematch(g,'a',2200),false);assert.deepEqual(A.snapshot(g),before);
  A.step(g,3000);g.players[0].score=300;g.players[0].carry='care';
  A.setInput(g,'a',{x:1,y:0,dash:true});
  assert.ok(A.rematch(g,'a',3050));assert.equal(g.phase,'finished');assert.equal(g.players[0].ready,true);
  const readyState=A.snapshot(g);assert.equal(A.rematch(g,'a',3099),false);assert.deepEqual(A.snapshot(g),readyState);
  assert.ok(A.rematch(g,'b',3100));assert.equal(g.phase,'countdown');assert.equal(g.roundId,2);assert.equal(g.phaseUntil,5100);
  assert.ok(g.players.every(p=>p.score===0&&p.carry===null&&!p.ready&&p.dashUntil===0&&p.immuneUntil===0));assert.deepEqual(g.winnerIds,[]);
  A.step(g,5100);A.step(g,5150);assert.equal(g.players[0].x,420);assert.equal(g.endsAt,6100);
});

test('disconnect returns survivor to practice, preserves identity/team and removes phantom wins and navigation', () => {
  const g=pvp({roundMs:1000});const b=g.players[1];b.score=300;b.carry='bus';
  A.setInput(g,'b',{x:1,y:0,dash:true,tag:true});
  assert.ok(A.removePlayer(g,'a',9000));assert.equal(g.phase,'practice');assert.equal(g.now,9000);assert.equal(g.endsAt,0);assert.equal(g.phaseUntil,0);
  assert.equal(g.players.length,1);assert.equal(g.players[0].id,'b');assert.equal(g.players[0].team,1);assert.equal(g.players[0].score,0);assert.equal(g.players[0].carry,null);
  assert.deepEqual(g.winnerIds,[]);assert.equal(g.events.some(e=>e.type==='finish'),false);assert.equal(g.events.at(-1).type,'left');
  const x=g.players[0].x;A.step(g,9050);assert.equal(g.players[0].x,x);assert.equal(A.snapshot(g).mode,'solo');
  assert.ok(A.addPlayer(g,'c',9100));assert.equal(g.phase,'countdown');assert.equal(g.roundId,2);assert.equal(g.players[1].team,0);
  assert.ok(A.removePlayer(g,'b',9150));assert.equal(g.phase,'practice');assert.ok(A.removePlayer(g,'c',9200));assert.equal(g.players.length,0);
});

test('zero-length countdown can start at the same monotonic timestamp without moving', () => {
  const g=solo({now:100,countdownMs:0});A.addPlayer(g,'b');A.setInput(g,'a',{x:1,y:0,dash:true});
  A.step(g,100);assert.equal(g.phase,'playing');assert.equal(g.endsAt,60100);assert.equal(g.players[0].x,420);assert.equal(g.players[0].dashUntil,0);
  A.step(g,100);assert.equal(g.events.filter(e=>e.type==='start').length,1);
});

test('createGame rejects invalid clock/duration config instead of poisoning deterministic state', () => {
  for(const options of [{now:NaN},{now:Infinity},{now:'0'},{roundMs:0},{roundMs:-1},{roundMs:Infinity},{countdownMs:-1},{countdownMs:NaN}]) assert.throws(()=>A.createGame(options),RangeError);
});

test('event history is bounded40 with unique increasing deterministic IDs', () => {
  const g=solo();for(let i=0;i<50;i++) {A.setInput(g,'a',{x:0,y:0,dash:true});A.step(g,50+i*1200);}
  assert.equal(g.events.length,40);assert.deepEqual(g.events.map(e=>e.id),Array.from({length:40},(_,i)=>i+11));
  for(const e of g.events) for(const key of ['id','type','playerId','kind','x','y']) assert.ok(Object.hasOwn(e,key));
  A.removePlayer(g,'a');assert.equal(g.events.length,40);assert.equal(g.events.at(-1).id,51);
});

test('identical input/time replay is byte-identical in independent Node and browser UMD games', () => {
  const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve(CORE),'utf8'),context);
  const replay=api=>{
    const g=api.createGame();api.addPlayer(g,'a');api.addPlayer(g,'b');api.step(g,2000);
    for(let i=1;i<=300;i++) {
      api.setInput(g,'a',{x:Math.sin(i/31),y:Math.cos(i/23),dash:i%30===0,tag:i%13===0});
      api.setInput(g,'b',{x:-Math.sin(i/31),y:-Math.cos(i/23),dash:i%27===0,tag:i%11===0});
      api.step(g,2000+i*50);
    }
    return JSON.stringify(api.snapshot(g));
  };
  assert.equal(replay(A),replay(A));assert.equal(replay(A),replay(context.window.ArenaCore));
});

function walk(g,id,tx,ty) {
  const p=g.players.find(p=>p.id===id), route=A.findPath(p.x,p.y,tx,ty);assert.ok(route.length);
  for(const target of route.slice(1)) {
    let ticks=0;
    while(Math.hypot(p.x-target.x,p.y-target.y)>0.01) {
      assert.ok(++ticks<300,`autopilot stuck at ${p.x},${p.y}`);
      const dx=target.x-p.x,dy=target.y-p.y,dist=Math.hypot(dx,dy),old={x:p.x,y:p.y};
      A.setInput(g,id,{x:dx/dist,y:dy/dist});A.step(g,g.now+Math.min(40,dist/A.SPEED*1000));
      assert.ok(A.canStand(p.x,p.y));assert.ok(Math.hypot(p.x-old.x,p.y-old.y)<=9.2+1e-8);
    }
  }
  A.setInput(g,id,{x:0,y:0});
}

test('ordinary direction-input autopilot picks and delivers within first10seconds without teleport', () => {
  const g=solo();walk(g,'a',400,640);assert.equal(g.players[0].carry,'bus');
  walk(g,'a',600,330);assert.equal(g.players[0].score,100);assert.ok(g.now<10000);
  walk(g,'a',400.3,160.7);walk(g,'a',800.1,160.2);near(g.players[0].x,800.1);near(g.players[0].y,160.2);
});

test('navigation direction refresh preserves pending dash and TAG until one step consumes both', () => {
  const g=contest(),[a,b]=g.players;b.x=540;
  A.setInput(g,'a',{x:0,y:0,dash:true,tag:true});
  A.setInput(g,'a',{x:0,y:1,dash:false,tag:false});
  A.step(g,2050);near(a.y,618);assert.equal(a.carry,'bus');assert.equal(b.carry,null);
  assert.equal(g.events.filter(e=>e.type==='dash').length,1);assert.equal(g.events.filter(e=>e.type==='steal').length,1);
  A.setInput(g,'a',{x:0,y:0});A.step(g,3300);
  assert.equal(g.events.filter(e=>e.type==='dash').length,1);assert.equal(g.events.filter(e=>e.type==='steal').length,1);
});

// Tracer 1: the same rules load without browser dependencies.
test('UMD exposes the fixed API in Node and window.ArenaCore', () => {
  assert.ok(fs.existsSync(require('node:path').join(__dirname, CORE)), 'arena-core export is missing');
  const A = require(CORE);
  for (const key of ['createGame', 'addPlayer', 'removePlayer', 'setInput', 'step', 'rematch', 'snapshot', 'canStand', 'findPath']) assert.equal(typeof A[key], 'function', key);
  assert.equal(A.WORLD_WIDTH, 1200);
  assert.equal(A.WORLD_HEIGHT, 1100);
  assert.equal(A.SPEED, 230);
  assert.equal(A.DASH_SPEED, 360);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve(CORE), 'utf8'), context);
  assert.equal(typeof context.window.ArenaCore.createGame, 'function');
  const g = A.createGame();
  assert.equal(g.phase, 'practice');
  assert.equal(g.now, 0);
  assert.equal(g.roundId, 0);
  assert.deepEqual(g.players, []);
  assert.deepEqual(g.winnerIds, []);
});

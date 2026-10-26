'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = path.join(__dirname, '../public/bubble-core.js');
const core = () => require(engine);
function solo(){ const C=core(),g=C.createGame(); C.addPlayer(g,'a',0); return g; }
function duel(){ const C=core(),g=solo(); C.addPlayer(g,'b',0); C.step(g,2000); return g; }
function tick(g,ms=50){core().step(g,g.now+ms);}

test('map has symmetric catalog crates, safe spawn corridors and radius-aware walls',()=>{
  const C=core(),g=solo(),catalog=require('../data/policy-catalog.json');
  assert.equal(g.crates.length,16); assert.equal(new Set(g.crates.map(c=>c.topicId)).size,15);
  for(const c of g.crates){ assert.ok(catalog.topics.some(t=>t.id===c.topicId)); assert.ok(c.alive); assert.deepEqual(C.cellCenter(c.c,c.r),{x:c.x,y:c.y}); assert.ok(g.crates.some(q=>q.c===8-c.c&&q.r===12-c.r)); }
  assert.deepEqual(C.cellOf(96,96),{c:1,r:1});
  for(const [c,r] of [[1,1],[1,2],[2,1],[1,3],[7,11],[7,10],[6,11],[7,9]]){ const p=C.cellCenter(c,r); assert.ok(C.canStand(p.x,p.y,g)); }
  assert.equal(C.canStand(160,160,g),false); assert.equal(C.canStand(78,96,g),false);
  assert.equal(C.canStand(224,96),false); assert.equal(C.canStand(NaN,96,g),false);
});

test('authoritative cardinal movement has capped delta, solid crates and smooth lane turns',()=>{
 const C=core(),g=solo(),p=g.players[0];
 C.setInput(g,'a',{x:1,y:.2}); tick(g); assert.equal(p.x,106); assert.equal(p.y,96);
 C.setInput(g,'a',{x:0,y:1}); tick(g); assert.equal(p.x,96); assert.equal(p.y,106);
 p.x=180;p.y=96; C.setInput(g,'a',{x:1,y:0}); tick(g,10000); assert.ok(p.x<=193); assert.equal(p.y,96);
 p.x=96;p.y=96; tick(g,10000); assert.equal(p.x,106);
});

test('bomb action is OR-pending, consumed once, tile-centered and cooldown limited',()=>{
 const C=core(),g=solo(),p=g.players[0];
 C.setInput(g,'a',{x:0,y:0,bomb:true}); C.setInput(g,'a',{x:0,y:0,bomb:false}); tick(g);
 assert.equal(g.bombs.length,1); const b=g.bombs[0];
 assert.deepEqual([b.ownerId,b.c,b.r,b.x,b.y,b.placedAt,b.explodeAt,b.range],['a',1,1,96,96,50,1850,2]);
 assert.deepEqual(b.passIds,['a']); assert.equal(g.events.filter(e=>e.type==='place').length,1);
 tick(g); assert.equal(g.bombs.length,1);
 p.x=160; C.setInput(g,'a',{x:0,y:0,bomb:true}); tick(g); assert.equal(g.bombs.length,1);
 C.step(g,400); C.setInput(g,'a',{x:0,y:0,bomb:true}); tick(g); assert.equal(g.bombs.length,2);
 p.x=96;p.y=160;C.step(g,800);C.setInput(g,'a',{x:0,y:0,bomb:true});tick(g);assert.equal(g.bombs.length,2);
});

test('owner can leave fresh bomb but cannot re-enter after crossing its tile',()=>{
 const C=core(),g=solo(),p=g.players[0]; C.setInput(g,'a',{x:0,y:0,bomb:true});tick(g);
 C.setInput(g,'a',{x:1,y:0});for(let i=0;i<7;i++)tick(g);
 assert.equal(p.x,166); assert.deepEqual(g.bombs[0].passIds,[]);
 C.setInput(g,'a',{x:-1,y:0});for(let i=0;i<9;i++)tick(g);
 assert.ok(p.x>=143); assert.equal(C.canStand(96,96,g),false);
});

test('second real player starts clean countdown then anchored 60s round',()=>{
 const C=core(),g=solo();g.players[0].score=8;C.setInput(g,'a',{x:1,y:0,bomb:true});tick(g);
 assert.equal(C.addPlayer(g,'b',50),true);assert.equal(g.phase,'countdown');assert.equal(g.phaseUntil,2050);assert.equal(g.roundId,1);assert.equal(g.bombs.length,0);assert.equal(g.players[0].score,0);
 assert.deepEqual(g.players.map(p=>[p.x,p.y]),[[96,96],[480,736]]);
 C.setInput(g,'a',{x:1,y:0,bomb:true});C.step(g,2049);assert.equal(g.players[0].x,96);assert.equal(g.bombs.length,0);
 C.step(g,2050);assert.equal(g.phase,'playing');assert.equal(g.endsAt,62050);tick(g);assert.equal(g.bombs.length,0);
});

test('deadline finishes before queued late bomb and both zero scores tie',()=>{
 const C=core(),g=duel();C.setInput(g,'a',{x:1,y:0,bomb:true});C.step(g,62000);
 assert.equal(g.phase,'finished');assert.equal(g.bombs.length,0);assert.deepEqual(g.winnerIds,['a','b']);assert.equal(g.players[0].x,96);
});

test('disconnect clears dangerous state to practice without phantom winner',()=>{
 const C=core(),g=duel();C.setInput(g,'a',{x:0,y:0,bomb:true});tick(g);assert.equal(C.removePlayer(g,'b',70000),true);
 assert.equal(g.phase,'practice');assert.deepEqual(g.winnerIds,[]);assert.equal(g.bombs.length,0);assert.equal(g.players.length,1);assert.equal(g.players[0].score,0);assert.equal(g.endsAt,0);
 assert.equal(g.events.filter(e=>e.type==='finish').length,0);
});

test('both humans must request rematch with reset map scores and action state',()=>{
 const C=core(),g=duel();C.step(g,62000);g.crates[0].alive=false;
 assert.equal(C.rematch(g,'a',62000),true);assert.equal(g.phase,'finished');assert.equal(C.rematch(g,'a',62000),false);
 assert.equal(C.rematch(g,'b',62000),true);assert.equal(g.phase,'countdown');assert.equal(g.roundId,2);assert.equal(g.phaseUntil,64000);assert.ok(g.crates.every(c=>c.alive));assert.ok(g.players.every(p=>!p.ready&&p.score===0));
});

function drop(g,id='a'){const C=core();C.setInput(g,id,{x:0,y:0,bomb:true});tick(g);return g.bombs.at(-1);}

test('water cross stops before walls and includes only first crate',()=>{
 const C=core(),g=solo();
 assert.deepEqual(C.blastCells(g,{c:1,r:1,range:2}),[{c:1,r:1},{c:1,r:2},{c:1,r:3},{c:2,r:1},{c:3,r:1}]);
 const cells=C.blastCells(g,{c:3,r:2,range:2});assert.ok(!cells.some(q=>q.c===2&&q.r===2));assert.ok(cells.some(q=>q.c===3&&q.r===3));assert.ok(!cells.some(q=>q.c===3&&q.r===4));
});

test('1800ms fuse destroys once, practice scores crate and expires water after 450ms',()=>{
 const C=core(),g=solo(),b=drop(g);C.step(g,b.explodeAt-1);assert.equal(g.bombs.length,1);C.step(g,b.explodeAt);
 assert.equal(g.bombs.length,0);assert.equal(g.blasts.length,1);assert.equal(g.blasts[0].expiresAt,b.explodeAt+450);
 assert.equal(g.crates[0].alive,false);assert.equal(g.players[0].score,1);assert.equal(g.events.filter(e=>e.type==='destroy').length,1);
 const d=g.events.find(e=>e.type==='destroy');assert.deepEqual([d.playerId,d.topicId,d.x,d.y],['a','exhibition-168',224,96]);
 C.step(g,b.explodeAt+449);assert.equal(g.blasts.length,1);C.step(g,b.explodeAt+450);assert.equal(g.blasts.length,0);assert.equal(g.events.filter(e=>e.type==='splash').length,1);
});

test('detonation chains younger bombs in same wave deterministically without repeats',()=>{
 const C=core(),g=solo(),b1=drop(g);g.players[0].x=160;C.step(g,400);const b2=drop(g);assert.ok(b2.explodeAt>b1.explodeAt);
 C.step(g,b1.explodeAt);assert.equal(g.bombs.length,0);assert.equal(g.blasts.length,2);assert.equal(g.events.filter(e=>e.type==='splash').length,2);assert.equal(g.events.filter(e=>e.type==='destroy').length,1);
 assert.ok(g.blasts.every(b=>b.expiresAt===b1.explodeAt+450));C.step(g,b2.explodeAt);assert.equal(g.events.filter(e=>e.type==='splash').length,2);
});

test('PvP crate destruction opens walkable floor without points',()=>{
 const C=core(),g=duel(),b=drop(g);g.players[0].y=224;C.step(g,b.explodeAt);
 assert.equal(g.players[0].score,0);assert.equal(C.canStand(224,96,g),true);assert.equal(C.canStand(224,96),false);
});

test('opponent capture scores once, traps 1s and grants 2.5s immunity',()=>{
 const C=core(),g=duel(),b=drop(g);g.players[0].y=288;g.players[1].x=160;g.players[1].y=96;
 C.step(g,b.explodeAt);const victim=g.players[1];assert.equal(g.players[0].score,1);assert.equal(victim.trappedUntil,g.now+1000);assert.equal(victim.immuneUntil,g.now+2500);
 const e=g.events.find(e=>e.type==='capture');assert.deepEqual([e.playerId,e.victimId,e.x,e.y],['a','b',160,96]);
 C.setInput(g,'b',{x:1,y:0,bomb:true});tick(g);assert.equal(victim.x,160);assert.equal(g.bombs.length,0);assert.equal(g.players[0].score,1);
 C.step(g,b.explodeAt+1000);assert.equal(victim.x,170);assert.equal(g.events.filter(e=>e.type==='capture').length,1);
});

test('self splash traps without points and already immune victim ignores another splash',()=>{
 const C=core(),g=duel(),b=drop(g);g.players[1].x=160;g.players[1].y=96;g.players[1].immuneUntil=9999;
 C.step(g,b.explodeAt);assert.equal(g.players[0].score,0);assert.equal(g.players[0].trappedUntil,g.now+1000);assert.equal(g.players[1].trappedUntil,0);
});

test('first to three resolves all hits before finishing with highest scorer',()=>{
 const C=core(),g=duel();g.players[0].score=2;const b=drop(g);g.players[0].y=288;g.players[1].x=160;g.players[1].y=96;
 C.step(g,b.explodeAt);assert.equal(g.phase,'finished');assert.deepEqual(g.winnerIds,['a']);assert.equal(g.players[0].score,3);
 const events=g.events.length;tick(g,10000);assert.equal(g.players[0].score,3);assert.equal(g.events.length,events);
});

test('same tick mutual captures produce a genuine tied win',()=>{
 const C=core(),g=duel();g.crates.forEach(c=>c.alive=false);g.players[0].score=2;g.players[1].score=2;
 g.players[1].x=224;g.players[1].y=96;C.setInput(g,'a',{x:0,y:0,bomb:true});C.setInput(g,'b',{x:0,y:0,bomb:true});tick(g);
 C.step(g,3850);assert.equal(g.phase,'finished');assert.deepEqual(g.players.map(p=>p.score),[3,3]);assert.deepEqual(g.winnerIds,['a','b']);assert.equal(g.events.filter(e=>e.type==='capture').length,2);
});

test('live BFS uses cardinal centers, rejects blocked targets, honors new clear paths',()=>{
 const C=core(),g=solo();assert.deepEqual(C.findPath(96,96,224,96,g),[]);
 const b=drop(g);g.players[0].y=288;C.step(g,b.explodeAt+450);
 const path=C.findPath(96,96,230,96,g);assert.deepEqual(path[0],{x:96,y:96});assert.deepEqual(path.at(-1),{x:230,y:96});
 for(let i=1;i<path.length;i++){assert.ok(path[i].x===path[i-1].x||path[i].y===path[i-1].y);assert.ok(C.canStand(path[i].x,path[i].y,g));}
 assert.deepEqual(C.findPath(96,96,224,96),[]);assert.deepEqual(C.findPath(NaN,96,96,96,g),[]);
});

test('BFS infers actual bomb owner start and allows escape route',()=>{
 const C=core(),g=solo();drop(g);const path=C.findPath(96,96,96,224,g);
 assert.ok(path.length>=3);assert.deepEqual(path.at(-1),{x:96,y:224});
});

test('actual authoritative movement follows connected cleared-board BFS to opponent spawn',()=>{
 const C=core(),g=solo();g.crates.forEach(c=>c.alive=false);const p=g.players[0],path=C.findPath(p.x,p.y,480,736,g);assert.ok(path.length>2);
 for(const target of path.slice(1)){
   let iterations=0;
   while(Math.hypot(p.x-target.x,p.y-target.y)>.01&&iterations++<30){
    const dx=target.x-p.x,dy=target.y-p.y;C.setInput(g,'a',{x:Math.max(-1,Math.min(1,dx/10)),y:Math.max(-1,Math.min(1,dy/10))});tick(g);
   }
   assert.ok(iterations<30,JSON.stringify({p,target}));
 }
 assert.deepEqual([p.x,p.y],[480,736]);assert.equal(g.phase,'practice');
});

test('snapshot is detached public bubble state without private input or credentials',()=>{
 const C=core(),g=duel();g.authToken='secret';g.players[0].resumeToken='secret';drop(g);const s=C.snapshot(g);
 assert.deepEqual([s.kind,s.cols,s.rows,s.cell,s.width,s.height,s.mode],['bubble',9,13,64,576,832,'pvp']);
 assert.equal(s.remainingMs,59950);assert.ok(s.walls.some(q=>q.c===2&&q.r===2&&q.x===160&&q.y===160));
 for(const key of ['players','bombs','blasts','crates','events','winnerIds'])assert.deepEqual(s[key],key==='players'?g[key].map(({resumeToken,...p})=>p):g[key]);
 assert.ok(!JSON.stringify(s).includes('secret'));s.players[0].x=1;s.bombs[0].passIds.length=0;assert.equal(g.players[0].x,96);assert.equal(g.bombs[0].passIds.length,1);
 assert.equal(C.canStand(224,96,s),false);assert.deepEqual(C.findPath(96,96,96,224,C.snapshot(g)).at(-1),{x:96,y:224});
});

test('invalid clocks and options never mutate engine, malformed input stays finite',()=>{
 const C=core();for(const opts of [{now:NaN},{roundMs:0},{countdownMs:-1},{roundMs:Infinity}])assert.throws(()=>C.createGame(opts),RangeError);
 const g=solo();assert.equal(C.addPlayer(g,'',0),false);assert.equal(C.addPlayer(g,'a',0),false);assert.equal(C.setInput(g,'missing',{x:1,y:0}),false);
 assert.equal(C.setInput(g,'a',null),false);assert.equal(C.removePlayer(g,'missing',0),false);assert.equal(C.rematch(g,'a',0),false);
 C.setInput(g,'a',{x:Infinity,y:1,bomb:'yes'});tick(g);assert.deepEqual([g.players[0].x,g.players[0].y,g.bombs.length],[96,96,0]);
 const before=C.snapshot(g);C.step(g,NaN);C.step(g,0);assert.deepEqual(C.snapshot(g),before);
 C.addPlayer(g,'b',50);assert.equal(C.addPlayer(g,'c',50),false);
});

test('event ring retains latest 40 with monotonically increasing IDs through resets',()=>{
 const C=core(),g=solo();for(let i=0;i<45;i++){assert.ok(C.addPlayer(g,'b',g.now));assert.ok(C.removePlayer(g,'b',g.now));}
 assert.equal(g.events.length,40);assert.ok(g.events[0].id>1);for(let i=1;i<g.events.length;i++)assert.equal(g.events[i].id,g.events[i-1].id+1);
});

test('browser UMD and Node produce byte-identical snapshots for same clocks and input',()=>{
 const vm=require('node:vm'),sandbox={window:{}};vm.runInNewContext(fs.readFileSync(engine,'utf8'),sandbox);
 const run=C=>{const g=C.createGame();C.addPlayer(g,'a',0);C.addPlayer(g,'b',0);C.step(g,2000);C.setInput(g,'a',{x:1,y:0,bomb:true});C.step(g,2050);C.setInput(g,'a',{x:0,y:1,bomb:false});for(let t=2100;t<=4200;t+=50)C.step(g,t);return JSON.stringify(C.snapshot(g));};
 assert.equal(run(core()),run(sandbox.window.BubbleCore));
});

test('practice never creates a fake opponent or timed ending',()=>{
 const C=core(),g=solo();C.step(g,900000);assert.equal(g.phase,'practice');assert.equal(g.players.length,1);assert.deepEqual(C.snapshot(g).winnerIds,[]);assert.equal(C.snapshot(g).mode,'solo');
});

test('leaving bomb cell revokes pass immediately yet radius overlap never blocks onward escape',()=>{
 const C=core(),g=solo(),p=g.players[0];drop(g);C.setInput(g,'a',{x:1,y:0});for(let i=0;i<4;i++)tick(g);
 assert.equal(p.x,136);assert.deepEqual(g.bombs[0].passIds,[]);
 C.setInput(g,'a',{x:-1,y:0});tick(g);assert.equal(p.x,136);
 C.setInput(g,'a',{x:1,y:0});tick(g);assert.equal(p.x,146);
});

test('constructor exposes the original single-screen bubble contract', () => {
  assert.ok(fs.existsSync(engine), 'BubbleCore engine must exist');
  const C = core(), g = C.createGame();
  assert.equal(C.GAME_KIND, 'bubble');
  assert.deepEqual([C.COLS,C.ROWS,C.CELL,C.WORLD_WIDTH,C.WORLD_HEIGHT,C.SPEED,C.DASH_SPEED], [9,13,64,576,832,200,200]);
  assert.deepEqual(C.ACTIONS,['bomb']);
  assert.deepEqual([C.LANDMARKS,C.TARGETS,C.PICKUP_SLOTS],[[],[],[]]);
  assert.equal(g.phase,'practice'); assert.equal(g.now,0); assert.equal(g.roundId,0);
  for(const key of ['players','events','winnerIds','bombs','blasts','crates']) assert.ok(Array.isArray(g[key]),key);
});

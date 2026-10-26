'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { createPlayServer } = require('../server/play-server.cjs');

async function setup(t, options = {}) {
  let clock = 10000;
  const server = createPlayServer({ core: require('../public/arena-core.js'), now: () => clock, autoTick: false, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];
  t.after(async () => { for (const ws of sockets) ws.terminate(); await server.closePlay(); });
  async function req(path, body, headers = {}) {
    const response = await fetch(base + path, body === undefined ? { headers } : {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body)
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function connect(seat, extra = {}) {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws/play', extra);
    sockets.push(ws);
    ws.on('error', () => {});
    await once(ws, 'open');
    if (seat) {
      const state = next(ws);
      ws.send(JSON.stringify({ type: 'hello', code: seat.code, token: seat.token }));
      ws.initial = await state;
    }
    return ws;
  }
  return { server, base, sockets, req, connect, advance(ms) { clock += ms; server.tickPlay(); }, now: () => clock };
}
function next(ws) { return new Promise((resolve, reject) => {
  const timer = setTimeout(() => { ws.off('message', onMessage); reject(new Error('WS message timeout')); }, 2000);
  function onMessage(data) { clearTimeout(timer); resolve(JSON.parse(data.toString())); }
  ws.once('message', onMessage);
}); }
function closed(ws) { return new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('WS close timeout')), 2000);
  ws.once('close', code => { clearTimeout(timer); resolve(code); });
}); }
async function rejectedUpgrade(f, path, origin) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(f.base.replace('http:', 'ws:') + path, origin ? { origin } : {});
    f.sockets.push(ws); ws.on('error', () => {});
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('Upgrade unexpectedly accepted')); }, 1500);
    ws.once('unexpected-response', (_req, res) => { clearTimeout(timer); res.resume(); ws.terminate(); resolve(res.statusCode); });
  });
}
function turn() { return new Promise(resolve => setTimeout(resolve, 12)); }
async function enter(f, code) {
  const r = await f.req('/api/play/enter', code ? { code } : {});
  assert.equal(r.status, 200);
  return r.body;
}

test('reserved seats are not humans until a real WebSocket hello', async t => {
  const f = await setup(t);
  const seat = await enter(f);
  assert.match(seat.code, /^[A-F0-9]{6}$/);
  assert.match(seat.token, /^[a-f0-9]{64}$/);
  assert.equal(seat.state, null);
  assert.equal((await f.req('/api/play/health')).body.players, 0);
  assert.deepEqual((await f.req('/api/play/lobby')).body, { rooms: [], online: 0 });
  const ws = await f.connect(seat);
  assert.equal(ws.initial.type, 'state');
  assert.equal(ws.initial.you, seat.playerId);
  assert.equal(ws.initial.state.players.length, 1);
  assert.equal(ws.initial.state.phase, 'practice');
  assert.equal((await f.req('/api/play/health')).body.players, 1);
});

test('public matching pairs only connected humans and rejects a third seat', async t => {
  const f = await setup(t);
  const a = await enter(f); await f.connect(a);
  const lobby = (await f.req('/api/play/lobby')).body;
  assert.deepEqual(lobby.rooms, [{ code: a.code, players: 1, phase: 'practice', joinable: true }]);
  const b = await enter(f);
  assert.equal(b.code, a.code);
  const wb = await f.connect(b);
  assert.equal(wb.initial.state.players.length, 2);
  assert.equal((await f.req('/api/play/health')).body.players, 2);
  assert.equal((await f.req('/api/play/enter', { code: a.code })).status, 409);
  const c = await enter(f); assert.notEqual(c.code, a.code);
  const safe = JSON.stringify((await f.req('/api/play/lobby')).body);
  for (const value of [a.token, b.token, a.playerId]) assert.ok(!safe.includes(value));
});

test('reservation expiry deletes seats without introducing core players', async t => {
  const f = await setup(t); const seat = await enter(f);
  f.advance(5001);
  assert.equal(f.server.playRooms.size, 0);
  assert.equal((await f.req('/api/play/health')).body.players, 0);
  assert.equal((await f.req('/api/play/enter', { code: seat.code })).status, 404);
});

test('HTTP rejects foreign origins and non-JSON enter requests', async t => {
  const f = await setup(t, { hostOrigin: 'https://play.example' });
  assert.equal((await f.req('/api/play/enter', {}, { origin: 'https://evil.example' })).status, 403);
  const r = await fetch(f.base + '/api/play/enter', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(r.status, 415);
  assert.equal((await f.req('/api/play/enter', {}, { origin: 'https://play.example' })).status, 200);
});

test('HTTP rejects malformed codes, oversized bodies, arrays and score injection', async t => {
  const f = await setup(t);
  for (const body of [{ code: 'abcdef' }, { code: 'ABC12' }, { code: 123456 }, [], null, { score: 9000 }]) {
    assert.equal((await f.req('/api/play/enter', body)).status, 400);
  }
  const r = await fetch(f.base + '/api/play/enter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(1100) }) });
  assert.equal(r.status, 413);
  const bad = await fetch(f.base + '/api/play/enter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(bad.status, 400);
  assert.equal((await f.req('/api/play/enter', { code: 'FFFFFF' })).status, 404);
});

test('room cap bounds reservations and old PK endpoints stay isolated', async t => {
  const f = await setup(t, { maxRooms: 1 });
  await enter(f);
  assert.equal((await f.req('/api/play/enter', {})).status, 503);
  assert.equal((await f.req('/api/pk/health')).status, 404);
  assert.equal((await f.req('/api/play/admin', {})).status, 404);
});

test('WebSocket upgrades reject foreign Origin and query credentials', async t => {
  const f = await setup(t, { hostOrigin: 'https://play.example' });
  assert.equal(await rejectedUpgrade(f, '/ws/play', 'https://evil.example'), 403);
  assert.equal(await rejectedUpgrade(f, '/ws/play?token=secret'), 404);
  assert.equal(await rejectedUpgrade(f, '/ws/play/'), 404);
  const a = await enter(f); const ws = await f.connect(a, { origin: 'https://play.example' });
  assert.equal(ws.initial.you, a.playerId);
});

test('unauthenticated and reserved sockets expire after five seconds', async t => {
  const f = await setup(t); const seat = await enter(f); const ws = await f.connect();
  const done = closed(ws); f.advance(5001);
  assert.equal(await done, 1008);
  const stale = await f.connect(); const done2 = closed(stale);
  stale.send(JSON.stringify({ type: 'hello', code: seat.code, token: seat.token }));
  assert.equal(await done2, 1008);
});

test('malformed JSON, binary and invalid hello safely close 1008', async t => {
  const f = await setup(t);
  for (const payload of ['{', Buffer.from('{}'), JSON.stringify({ type: 'input', x: 1, y: 0 }), JSON.stringify({ type: 'hello', code: 'ABCDEF', token: 'f'.repeat(64) })]) {
    const ws = await f.connect(); const done = closed(ws); ws.send(payload);
    assert.equal(await done, 1008);
  }
  assert.equal((await f.req('/api/play/health')).body.ok, true);
});

test('replacing one token socket preserves one player and ignores old close', async t => {
  const f = await setup(t); const seat = await enter(f); const first = await f.connect(seat);
  const done = closed(first); const replacement = await f.connect(seat);
  assert.equal(await done, 1008);
  assert.equal(replacement.initial.state.players.length, 1);
  assert.equal(replacement.initial.you, seat.playerId);
  assert.equal((await f.req('/api/play/health')).body.players, 1);
});

test('real WS input moves authoritative positions identically for both peers', async t => {
  const f = await setup(t, { countdownMs: 100 });
  const a = await enter(f), wa = await f.connect(a);
  const b = await enter(f), wb = await f.connect(b);
  f.advance(100); await turn();
  wa.send(JSON.stringify({ type: 'input', x: 1, y: 0 })); await turn();
  const pa = next(wa), pb = next(wb); f.advance(100);
  const [ma, mb] = await Promise.all([pa, pb]);
  assert.deepEqual(ma.state, mb.state);
  assert.equal(ma.you, a.playerId); assert.equal(mb.you, b.playerId);
  assert.ok(ma.state.players.find(p => p.id === a.playerId).x > 420);
  assert.equal(ma.state.players.find(p => p.id === b.playerId).x, 780);
  assert.ok(!JSON.stringify(ma).includes(a.token));
});

test('stale input stops after 500ms and dash is a one-shot edge', async t => {
  const f = await setup(t); const a = await enter(f); const ws = await f.connect(a);
  ws.send(JSON.stringify({ type: 'input', x: 1, y: 0, dash: true })); await turn();
  f.advance(50); const g = f.server.playRooms.get(a.code).game;
  const p = g.players[0]; const until = p.dashUntil;
  assert.ok(until > f.now());
  for (let i = 0; i < 70; i++) f.advance(50);
  assert.equal(p.dashUntil, until);
  const x = p.x; f.advance(100); assert.equal(p.x, x);
});

test('score, position and custom playerId forgeries close without mutating score', async t => {
  const f = await setup(t);
  for (const fields of [{ score: 9999 }, { playerId: 'victim' }, { position: { x: 99, y: 99 } }]) {
    const a = await enter(f); const ws = await f.connect(a);
    const g = f.server.playRooms.get(a.code).game;
    const done = closed(ws); ws.send(JSON.stringify({ type: 'input', x: 0, y: 0, ...fields }));
    assert.equal(await done, 1008);
    assert.ok(g.players.every(p => p.score === 0));
  }
});

test('disconnect removes membership, invalidates token and leaves real solo practice', async t => {
  const f = await setup(t); const a = await enter(f), wa = await f.connect(a);
  const b = await enter(f); const wb = await f.connect(b);
  let done = closed(wb); wb.close(); await done; await turn();
  const g = f.server.playRooms.get(a.code).game;
  assert.equal(g.players.length, 1); assert.equal(g.phase, 'practice');
  assert.deepEqual(g.winnerIds, []);
  const stale = await f.connect(); done = closed(stale);
  stale.send(JSON.stringify({ type: 'hello', code: a.code, token: b.token }));
  assert.equal(await done, 1008);
  done = closed(wa); wa.close(); await done; await turn();
  assert.equal(f.server.playRooms.size, 0);
});

test('ping answers with injected clock and unknown authenticated messages close', async t => {
  const f = await setup(t); const a = await enter(f); const ws = await f.connect(a);
  const pong = next(ws); ws.send(JSON.stringify({ type: 'ping' }));
  assert.deepEqual(await pong, { type: 'pong', now: f.now() });
  const done = closed(ws); ws.send(JSON.stringify({ type: 'teleport', x: 0, y: 0 }));
  assert.equal(await done, 1008);
});

test('rematch uses core mutual readiness, fresh round and zero scores', async t => {
  const f = await setup(t, { countdownMs: 100, roundMs: 200 });
  const a = await enter(f), wa = await f.connect(a); const b = await enter(f), wb = await f.connect(b);
  f.advance(100); f.advance(200);
  const g = f.server.playRooms.get(a.code).game;
  assert.equal(g.phase, 'finished'); const round = g.roundId;
  wa.send(JSON.stringify({ type: 'rematch' })); await turn(); assert.equal(g.phase, 'finished');
  wb.send(JSON.stringify({ type: 'rematch' })); await turn();
  assert.equal(g.phase, 'countdown'); assert.equal(g.roundId, round + 1);
  assert.ok(g.players.every(p => p.score === 0));
});

test('authenticated message rate is limited per token to sixty per second', async t => {
  const f = await setup(t); const a = await enter(f); const ws = await f.connect(a);
  const done = closed(ws);
  for (let i = 0; i < 61; i++) ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
  assert.equal(await done, 1008);
});

test('maxPayload rejects frames larger than 2048 bytes without crashing', async t => {
  const f = await setup(t); const a = await enter(f); const ws = await f.connect(a);
  const done = closed(ws); ws.send('x'.repeat(2049));
  assert.equal(await done, 1009);
  assert.equal((await f.req('/api/play/health')).body.ok, true);
});

test('room TTL expires connected rooms, clears tokens and bounds maps', async t => {
  const f = await setup(t, { roomTtlMs: 1000 }); const a = await enter(f); const ws = await f.connect(a);
  const done = closed(ws); f.advance(1001); assert.equal(await done, 1008);
  assert.equal(f.server.playRooms.size, 0);
  assert.deepEqual((await f.req('/api/play/lobby')).body, { rooms: [], online: 0 });
});

test('heartbeat sends real ping and terminates a socket missing the pong deadline', { timeout: 3000 }, async t => {
  const f = await setup(t); const a = await enter(f); const ws = await f.connect(a, { autoPong: false });
  const ping = once(ws, 'ping'); f.advance(10000); await ping;
  const done = closed(ws); f.advance(10001); assert.equal(await done, 1006);
  await turn(); assert.equal((await f.req('/api/play/health')).body.players, 0);
});

test('HTTP rate limit ignores spoofed forwarding by default', async t => {
  const f = await setup(t);
  for (let i = 0; i < 120; i++) assert.equal((await f.req('/api/play/health', undefined, { 'x-forwarded-for': `192.0.2.${i % 250}` })).status, 200);
  assert.equal((await f.req('/api/play/health', undefined, { 'x-forwarded-for': '198.51.100.9' })).status, 429);
  f.advance(60001); assert.equal((await f.req('/api/play/health')).status, 200);
});

test('explicit trusted loopback proxy gives distinct client rate buckets', async t => {
  const f = await setup(t, { trustProxy: true });
  for (let i = 0; i < 120; i++) assert.equal((await f.req('/api/play/health', undefined, { 'x-forwarded-for': '192.0.2.1' })).status, 200);
  assert.equal((await f.req('/api/play/health', undefined, { 'x-forwarded-for': '192.0.2.1' })).status, 429);
  assert.equal((await f.req('/api/play/health', undefined, { 'x-forwarded-for': '192.0.2.2' })).status, 200);
});

test('optional static server serves only named public assets and rejects symlinks', async t => {
  const dir = await fs.mkdtemp(path.join(process.env.TMPDIR, 'play-static-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const allowed = ['index.html', 'app.js', 'engine.js', 'knowledge.json', 'policy-catalog.json', 'taichung-elements.js', 'style.css', 'world.css', 'icon.svg', 'robots.txt', 'pk.js', 'pk.css', 'quest.js', 'quest.css', 'quest-core.js', 'arena-core.js', 'play.js', 'play.css', 'policies.html'];
  for (const name of [...allowed, 'private.txt', '.env']) await fs.writeFile(path.join(dir, name), 'fixture:' + name);
  const f = await setup(t, { staticDir: dir });
  for (const name of allowed) {
    const r = await fetch(f.base + '/' + name); assert.equal(r.status, 200, name);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await r.text(), 'fixture:' + name);
  }
  assert.equal(await (await fetch(f.base + '/')).text(), 'fixture:index.html');
  for (const url of ['/private.txt', '/.env', '/server/play-server.cjs', '/tests/play-server.test.cjs', '/%2e%2e%2fserver/play-server.cjs', '/%2eenv', '/internal/', '/node_modules/ws/package.json']) assert.equal((await fetch(f.base + url)).status, 404, url);
  await fs.unlink(path.join(dir, 'play.js')); await fs.symlink(path.join(dir, 'private.txt'), path.join(dir, 'play.js'));
  assert.equal((await fetch(f.base + '/play.js')).status, 404);
  assert.equal((await fetch(f.base + '/play.css', { method: 'POST' })).status, 404);
});

test('API-only default never serves source or homepage', async t => {
  const f = await setup(t);
  assert.equal((await fetch(f.base + '/')).status, 404);
  assert.equal((await fetch(f.base + '/play.js')).status, 404);
});

test('autoTick simulates every 50ms and broadcasts on 100ms cadence', async t => {
  const f = await setup(t, { autoTick: true, now: Date.now });
  const a = await enter(f); const ws = await f.connect(a);
  const initial = ws.initial.state.now; const started = Date.now();
  const state = await next(ws);
  assert.ok(state.state.now > initial); assert.ok(Date.now() - started >= 40);
});

test('closePlay shuts down open websocket clients and exits cleanly', async () => {
  const source = `const {createPlayServer}=require('./server/play-server.cjs');
const {WebSocket}=require('ws');
(async()=>{ const s=createPlayServer({core:require('./public/arena-core.js')}); s.listen(0,'127.0.0.1',async()=>{
const u='http://127.0.0.1:'+s.address().port;
const r=await fetch(u+'/api/play/enter',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const a=await r.json();
const w=new WebSocket(u.replace('http:','ws:')+'/ws/play');w.on('open',()=>w.send(JSON.stringify({type:'hello',code:a.code,token:a.token})));
w.once('message',async()=>{await s.closePlay();await s.closePlay();console.log('closed');});
});})();`;
  const r = spawnSync(process.execPath, ['-e', source], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 5000 });
  assert.equal(r.error, undefined); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /closed/);
});

test('maximum one hundred actual websocket clients includes pending authentication', async t => {
  const f = await setup(t);
  for (let i = 0; i < 100; i++) await f.connect();
  assert.equal(await rejectedUpgrade(f, '/ws/play'), 503);
  assert.equal((await f.req('/api/play/health')).body.players, 0);
});

test('real navigate follows ordinary movement to a goal beyond manual idle timeout', async t => {
  const f = await setup(t); const a = await enter(f), ws = await f.connect(a);
  const p = f.server.playRooms.get(a.code).game.players[0];
  ws.send(JSON.stringify({ type: 'navigate', x: 650, y: 600 })); await turn();
  f.advance(50); assert.ok(p.x > 420 && p.x - 420 <= 18); assert.equal(p.y, 600);
  for (let i = 0; i < 40; i++) { f.advance(50); if (i % 8 === 0) await turn(); }
  assert.ok(Math.hypot(p.x - 650, p.y - 600) <= 10);
  const x = p.x; f.advance(100); assert.equal(p.x, x);
  assert.equal(ws.readyState, WebSocket.OPEN);
});

test('navigation cannot cross blocked goals and rejects invalid world coordinates', async t => {
  const f = await setup(t); const a = await enter(f), ws = await f.connect(a);
  const p = f.server.playRooms.get(a.code).game.players[0];
  ws.send(JSON.stringify({ type: 'navigate', x: 600, y: 150 })); await turn();
  f.advance(50); assert.equal(p.x, 420); assert.equal(p.y, 600);
  assert.equal(ws.readyState, WebSocket.OPEN);
  const done = closed(ws); ws.send(JSON.stringify({ type: 'navigate', x: -1, y: 600 }));
  assert.equal(await done, 1008);
});

test('manual input zero cancels navigation immediately', async t => {
  const f = await setup(t); const a = await enter(f), ws = await f.connect(a);
  const p = f.server.playRooms.get(a.code).game.players[0];
  ws.send(JSON.stringify({ type: 'navigate', x: 650, y: 600 })); await turn(); f.advance(50);
  assert.ok(p.x > 420);
  ws.send(JSON.stringify({ type: 'input', x: 0, y: 0 })); await turn();
  const x = p.x; for (let i = 0; i < 10; i++) f.advance(50);
  assert.equal(p.x, x);
});

test('dash and tag actions remain pending through navigation updates until one tick', async t => {
  const f = await setup(t); const a = await enter(f), ws = await f.connect(a);
  const p = f.server.playRooms.get(a.code).game.players[0];
  ws.send(JSON.stringify({ type: 'navigate', x: 650, y: 600 }));
  ws.send(JSON.stringify({ type: 'action', action: 'dash' }));
  ws.send(JSON.stringify({ type: 'action', action: 'tag' })); await turn();
  const member = f.server.playRooms.get(a.code).members.get(a.token);
  assert.equal(member.input.dash, true); assert.equal(member.input.tag, true);
  f.advance(50); assert.ok(p.dashUntil > f.now());
  assert.equal(member.input.dash, false); assert.equal(member.input.tag, false);
  // Solo tag is consumed but correctly has no victim/cooldown in the authoritative core.
  assert.equal(p.tagReadyAt, 0);
  const until = p.dashUntil; for (let i = 0; i < 22; i++) { f.advance(50); if (i % 8 === 0) await turn(); }
  assert.ok(Math.hypot(p.x - 650, p.y - 600) <= 10); assert.equal(p.dashUntil, until);
});

test('round countdown clears a practice navigation before movement resumes', async t => {
  const f = await setup(t, { countdownMs: 100 }); const a = await enter(f), ws = await f.connect(a);
  ws.send(JSON.stringify({ type: 'navigate', x: 650, y: 600 })); await turn(); f.advance(50);
  const b = await enter(f); await f.connect(b); f.advance(100); f.advance(50);
  const p = f.server.playRooms.get(a.code).game.players.find(p => p.id === a.playerId);
  assert.equal(p.x, 420);
});

test('real WS contested pickup and delivery are atomic without test teleport routes', async t => {
  const f = await setup(t, { countdownMs: 100 });
  const a = await enter(f), wa = await f.connect(a); const b = await enter(f), wb = await f.connect(b);
  f.advance(100);
  const g = f.server.playRooms.get(a.code).game;
  for (const ws of [wa, wb]) ws.send(JSON.stringify({ type: 'navigate', x: 600, y: 600 }));
  await turn();
  for (let i = 0; i < 14; i++) f.advance(50);
  const pickupEvents = g.events.filter(e => e.type === 'pickup');
  assert.equal(pickupEvents.length, 1);
  assert.equal(g.players.filter(p => p.carry !== null).length, 1);
  assert.equal(g.pickups.find(p => p.kind === 'family' && p.y === 600).active, false);
  const carrier = g.players.find(p => p.carry !== null), carrierWs = carrier.id === a.playerId ? wa : wb;
  const otherWs = carrierWs === wa ? wb : wa;
  otherWs.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
  carrierWs.send(JSON.stringify({ type: 'navigate', x: 260, y: 450 })); await turn();
  for (let i = 0; i < 45; i++) { f.advance(50); if (i % 8 === 0) await turn(); }
  assert.equal(carrier.score, 100); assert.equal(carrier.carry, null);
  assert.equal(g.events.filter(e => e.type === 'deliver' && e.playerId === carrier.id).length, 1);
  for (let i = 0; i < 8; i++) f.advance(50);
  assert.equal(carrier.score, 100);
  assert.equal((await f.req('/api/play/teleport', { playerId: carrier.id, x: 260, y: 450 })).status, 404);
});

test('navigation detours through authoritative collision-safe waypoints', async t => {
  const A = require('../public/arena-core.js');
  const f = await setup(t); const a = await enter(f), ws = await f.connect(a);
  const p = f.server.playRooms.get(a.code).game.players[0];
  ws.send(JSON.stringify({ type: 'navigate', x: 600, y: 30 })); await turn();
  for (let i = 0; i < 220; i++) {
    const old = { x: p.x, y: p.y }; f.advance(50);
    assert.ok(A.canStand(p.x, p.y)); assert.ok(Math.hypot(p.x - old.x, p.y - old.y) <= 18.001);
    if (i % 8 === 0) await turn();
  }
  assert.ok(Math.hypot(p.x - 600, p.y - 30) <= 10, `${p.x},${p.y}`);
});

test('invalid navigation and action payloads close rather than granting authority', async t => {
  const f = await setup(t);
  for (const msg of [{ type: 'navigate', x: null, y: 10 }, { type: 'navigate', x: 1e9, y: 600 }, { type: 'navigate', x: 600, y: 600, playerId: 'victim' }, { type: 'action', action: 'teleport' }, { type: 'action', action: 'dash', score: 99 }]) {
    const a = await enter(f), ws = await f.connect(a); const done = closed(ws);
    ws.send(JSON.stringify(msg)); assert.equal(await done, 1008);
  }
});

test('CLI starts API-only on explicit host/port and handles clean SIGTERM', { timeout: 5000 }, async t => {
  const child = spawn(process.execPath, ['server/play-server.cjs'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, HOST: '127.0.0.1', PORT: '0', HOST_ORIGIN: 'https://play.example', TRUST_PROXY: 'true' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = ''; let errors = '';
  child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { errors += data; });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const done = once(child, 'exit'); child.kill('SIGTERM'); await done; } });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI did not listen: ' + errors)), 1500);
    child.stdout.on('data', () => { const match = output.match(/port (\d+)/); if (match) { clearTimeout(timer); resolve(Number(match[1])); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('CLI exited before listening: ' + code)); });
  });
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await (await fetch(base + '/api/play/health')).json()).mode, 'realtime');
  assert.equal((await fetch(base + '/')).status, 404);
  assert.equal((await fetch(base + '/api/play/enter', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.ok(!output.includes('127.0.0.1')); assert.equal(errors, '');
  const done = once(child, 'exit'); child.kill('SIGTERM');
  assert.deepEqual(await done, [0, null]);
});

test('two reserved seats stay invisible until hello and cannot be oversubscribed', async t => {
  const f = await setup(t); const a = await enter(f), b = await enter(f, a.code);
  assert.equal((await f.req('/api/play/enter', { code: a.code })).status, 409);
  assert.equal((await f.req('/api/play/health')).body.players, 0);
  const wa = await f.connect(a);
  assert.equal(wa.initial.state.phase, 'practice');
  assert.equal((await f.req('/api/play/lobby')).body.rooms[0].joinable, false);
  const wb = await f.connect(b); assert.equal(wb.initial.state.players.length, 2);
});

test('authenticated leave cleans its member and remaining practice immediately', async t => {
  const f = await setup(t); const a = await enter(f), wa = await f.connect(a); const b = await enter(f); await f.connect(b);
  const done = closed(wa); wa.send(JSON.stringify({ type: 'leave' })); assert.equal(await done, 1000);
  await turn();
  const r = f.server.playRooms.get(a.code);
  assert.equal(r.game.phase, 'practice'); assert.equal(r.members.size, 1);
  assert.equal(r.game.players[0].id, b.playerId);
});

test('token replacement cannot reset a shared per-token frame rate budget', async t => {
  const f = await setup(t); const a = await enter(f), first = await f.connect(a);
  for (let i = 0; i < 60; i++) first.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
  await turn(); const firstDone = closed(first); const replacement = await f.connect(a); await firstDone;
  const done = closed(replacement); replacement.send(JSON.stringify({ type: 'input', x: 0, y: 0 }));
  assert.equal(await done, 1008);
});

test('health starts empty and sends privacy/security headers', async t => {
  const f = await setup(t);
  const r = await f.req('/api/play/health');
  assert.deepEqual(r.body, { ok: true, mode: 'realtime', rooms: 0, players: 0 });
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  assert.deepEqual((await f.req('/api/play/lobby')).body, { rooms: [], online: 0 });
});


test('closing handshake immediately revokes leaver before a deadline can create ghost winners', async t => {
 const f=await setup(t,{countdownMs:100,roundMs:500});
 const a=await enter(f),wa=await f.connect(a),b=await enter(f),wb=await f.connect(b);f.advance(100);
 const room=f.server.playRooms.get(a.code);wb._socket.pause();wb.send(JSON.stringify({type:'leave'}));await turn();
 assert.equal(room.game.players.length,1,'CLOSING peer must not remain a game participant');
 assert.equal(room.members.has(b.token),false);assert.equal(room.game.phase,'practice');
 f.advance(600);assert.equal(room.game.phase,'practice');assert.deepEqual(room.game.winnerIds,[]);
 const lobby=(await f.req('/api/play/lobby')).body;assert.equal(lobby.rooms[0].players,1);assert.equal(lobby.rooms[0].joinable,true);
});

test('outbound state queue cap detaches and terminates a congested real socket', async t => {
 const f=await setup(t),a=await enter(f),wa=await f.connect(a),b=await enter(f),wb=await f.connect(b);
 const room=f.server.playRooms.get(a.code),peer=room.members.get(b.token).ws;
 // Deterministic transport-pressure boundary; real WS membership and cleanup, no fake game state.
 Object.defineProperty(peer,'bufferedAmount',{get:()=>65537,configurable:true});f.advance(100);
 assert.equal(room.members.has(b.token),false);assert.equal(room.game.players.length,1);assert.equal(room.game.phase,'practice');
 assert.notEqual(peer.readyState,WebSocket.OPEN);
});

test('closing authentication timeout releases an unresponsive transport within bounded grace', async t => {
 const f=await setup(t),ws=await f.connect();ws._socket.pause();f.advance(5001);await turn();f.advance(600);await turn();
 assert.equal(f.server._connections,0,'An unread close handshake cannot retain a TCP slot for30seconds');
});

test('real paused reader with unsolicited pongs cannot accumulate megabytes of snapshots', async t => {
 const f=await setup(t,{roundMs:300000,countdownMs:100}),a=await enter(f),wa=await f.connect(a),b=await enter(f),wb=await f.connect(b);
 const room=f.server.playRooms.get(a.code),peer=room.members.get(b.token).ws;f.advance(100);wb._socket.pause();
 for(let i=0;i<1800&&room.members.has(b.token);i++){
  if(i%10===0&&wb.readyState===WebSocket.OPEN)wb.pong();
  f.advance(100);if(i%10===0)await turn();
 }
 assert.equal(room.members.has(b.token),false,'Slow reader must be removed before growing MB queues');
 assert.ok(peer.bufferedAmount<131072,'Bound outbound queue to cap plus one snapshot');
 assert.equal(room.game.phase,'practice');assert.deepEqual(room.game.winnerIds,[]);
});

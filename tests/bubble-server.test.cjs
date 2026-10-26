'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const path = require('node:path');
const { WebSocket } = require('ws');
const { createPlayServer } = require('../server/play-server.cjs');
const turn = () => new Promise(r => setTimeout(r, 12));
async function setup(t, options = {}) {
  let clock = 10000;
  const server = createPlayServer({ now: () => clock, autoTick: false, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`, sockets = [];
  t.after(async () => { sockets.forEach(w => w.terminate()); await server.closePlay(); });
  async function req(url, body) {
    const r = await fetch(base + url, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  }
  async function enter(code) { const r = await req('/api/play/enter', code ? { code } : {}); assert.equal(r.status, 200); return r.body; }
  async function connect(seat) {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws/play'); sockets.push(ws); ws.on('error', () => {}); await once(ws, 'open');
    if (seat) { const p = next(ws); ws.send(JSON.stringify({ type: 'hello', code: seat.code, token: seat.token })); ws.initial = await p; }
    return ws;
  }
  return { server, base, req, enter, connect, now: () => clock, advance(ms) { clock += ms; server.tickPlay(); } };
}
function next(ws) { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('state timeout')), 2000); ws.once('message', d => { clearTimeout(timer); resolve(JSON.parse(d)); }); }); }
function closed(ws) { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('close timeout')), 2000); ws.once('close', code => { clearTimeout(timer); resolve(code); }); }); }
async function send(ws, value) { ws.send(JSON.stringify(value)); await turn(); }
async function walk(f, ws, x, y, ticks = 30) { await send(ws, { type: 'navigate', x, y }); for (let i = 0; i < ticks; i++) f.advance(50); await turn(); }

test('bubble core is an explicitly allowlisted public asset', async t => {
  const f = await setup(t, { staticDir: path.resolve(__dirname, '../public') });
  const response = await fetch(f.base + '/bubble-core.js');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /BubbleCore/);
});

test('real clients auto-match and replicate the same native bomb identity and fuse', async t => {
  const f = await setup(t, { countdownMs: 100 });
  const a = await f.enter(), wa = await f.connect(a), b = await f.enter(), wb = await f.connect(b);
  assert.equal(a.code, b.code); assert.equal(wb.initial.state.players.length, 2);
  assert.equal(wb.initial.state.kind, 'bubble');
  assert.equal((await f.req('/api/play/health')).body.players, 2);
  f.advance(100); await turn();
  await send(wa, { type: 'action', action: 'bomb' });
  assert.equal(wa.readyState, WebSocket.OPEN, 'native bomb action must be accepted');
  await send(wa, { type: 'input', x: 0, y: 0 });
  await send(wa, { type: 'navigate', x: 160, y: 96 });
  const ma = next(wa), mb = next(wb); f.advance(100);
  const [sa, sb] = await Promise.all([ma, mb]);
  assert.deepEqual(sa.state, sb.state); assert.equal(sa.state.bombs.length, 1);
  assert.ok(sa.state.bombs[0].id); assert.ok(sa.state.bombs[0].explodeAt > f.now());
  const room = f.server.playRooms.get(a.code), member = room.members.get(a.token);
  assert.equal(member.input.bomb, false);
  for (let i = 0; i < 10; i++) f.advance(50);
  assert.equal(room.game.bombs.length, 1, 'a native bomb action must be one-shot');
});

test('explicit room joining counts only completed real socket hellos', async t => {
  const f = await setup(t), a = await f.enter(), b = await f.enter(a.code);
  assert.equal((await f.req('/api/play/health')).body.players, 0);
  await f.connect(a); assert.equal((await f.req('/api/play/health')).body.players, 1);
  const wb = await f.connect(b); assert.equal(wb.initial.state.players.length, 2);
  assert.equal((await f.req('/api/play/health')).body.players, 2);
  assert.equal((await f.req('/api/play/enter', { code: a.code })).status, 409);
});

test('bubble rejects dash and tag native actions', async t => {
  const f = await setup(t);
  for (const action of ['dash', 'tag']) {
    const a = await f.enter(), ws = await f.connect(a), done = closed(ws);
    ws.send(JSON.stringify({ type: 'action', action })); assert.equal(await done, 1008);
  }
});

test('clients cannot select an engine or inject score, position, owner or bomb flags', async t => {
  const f = await setup(t);
  assert.equal((await f.req('/api/play/enter', { core: 'arena' })).status, 400);
  for (const msg of [
    { type: 'input', x: 0, y: 0, score: 3 }, { type: 'input', x: 0, y: 0, position: { x: 480, y: 736 } },
    { type: 'input', x: 0, y: 0, bomb: true }, { type: 'action', action: 'bomb', ownerId: 'other' },
    { type: 'action', action: 'bomb', x: 480, y: 736 }, { type: 'hello', core: 'arena' }
  ]) {
    const a = await f.enter(), ws = await f.connect(a), game = f.server.playRooms.get(a.code).game, done = closed(ws);
    ws.send(JSON.stringify(msg)); assert.equal(await done, 1008);
    assert.ok(game.players.every(p => p.score === 0)); assert.equal(game.bombs.length, 0);
  }
});

test('public navigation reaches an exact open-grid goal without teleporting', async t => {
  const f = await setup(t), a = await f.enter(), ws = await f.connect(a), g = f.server.playRooms.get(a.code).game, p = g.players[0];
  await send(ws, { type: 'navigate', x: 96, y: 288 });
  for (let i = 0; i < 35; i++) {
    const old = { x: p.x, y: p.y }; f.advance(50);
    assert.ok(Math.hypot(p.x - old.x, p.y - old.y) <= 10.001);
    assert.equal(require('../public/bubble-core.js').canStand(p.x, p.y, g, p.id), true);
  }
  assert.ok(Math.hypot(p.x - 96, p.y - 288) <= 4, `${p.x},${p.y}`);
  const y = p.y; f.advance(100); assert.equal(p.y, y);
});

test('paused leave immediately removes a bubble participant before round timeout', async t => {
  const f = await setup(t, { countdownMs: 100, roundMs: 500 });
  const a = await f.enter(); await f.connect(a); const b = await f.enter(), wb = await f.connect(b); f.advance(100);
  const room = f.server.playRooms.get(a.code), peer = room.members.get(b.token).ws; wb._socket.pause();
  await send(wb, { type: 'leave' });
  assert.equal(room.members.has(b.token), false); assert.equal(room.game.players.length, 1);
  f.advance(600); assert.equal(room.game.phase, 'practice'); assert.deepEqual(room.game.winnerIds, []);
  assert.equal((await f.req('/api/play/lobby')).body.rooms[0].joinable, true);
  f.advance(500); await turn(); assert.equal(room.members.size, 1); assert.equal(peer.readyState, WebSocket.CLOSED);
});

test('bubble outbound 64KiB cap immediately detaches the congested real peer', async t => {
  const f = await setup(t), a = await f.enter(); await f.connect(a); const b = await f.enter(); await f.connect(b);
  const room = f.server.playRooms.get(a.code), peer = room.members.get(b.token).ws;
  Object.defineProperty(peer, 'bufferedAmount', { get: () => 65537, configurable: true }); f.advance(100);
  assert.equal(room.members.has(b.token), false); assert.equal(room.game.players.length, 1);
  assert.equal(room.game.phase, 'practice'); assert.notEqual(peer.readyState, WebSocket.OPEN);
});

test('bubble disconnect revokes its token and restores real solo practice', async t => {
  const f = await setup(t), a = await f.enter(); await f.connect(a); const b = await f.enter(), wb = await f.connect(b);
  const done = closed(wb); wb.close(); await done; await turn();
  const room = f.server.playRooms.get(a.code); assert.equal(room.members.size, 1); assert.equal(room.game.phase, 'practice');
  assert.deepEqual(room.game.winnerIds, []);
  const stale = await f.connect(), rejected = closed(stale); stale.send(JSON.stringify({ type: 'hello', code: b.code, token: b.token }));
  assert.equal(await rejected, 1008);
});

test('bubble rematch requires both real peers and resets the authoritative round', async t => {
  const f = await setup(t, { countdownMs: 100, roundMs: 200 }), a = await f.enter(), wa = await f.connect(a), b = await f.enter(), wb = await f.connect(b);
  f.advance(100); f.advance(200); const g = f.server.playRooms.get(a.code).game, round = g.roundId;
  assert.equal(g.phase, 'finished'); await send(wa, { type: 'rematch' }); assert.equal(g.phase, 'finished');
  await send(wb, { type: 'rematch' }); assert.equal(g.phase, 'countdown'); assert.equal(g.roundId, round + 1);
  assert.ok(g.players.every(p => p.score === 0)); assert.equal(g.bombs.length, 0);
});

async function destroyFirstCrate(f, ws) {
  await walk(f, ws, 160, 96, 12); await send(ws, { type: 'action', action: 'bomb' }); f.advance(50);
  await walk(f, ws, 96, 224, 30); for (let i = 0; i < 20; i++) f.advance(50);
}

test('navigation respects walls and live crates then walks the actually bomb-cleared path', async t => {
  const f = await setup(t), a = await f.enter(), ws = await f.connect(a), g = f.server.playRooms.get(a.code).game, p = g.players[0];
  for (const goal of [{ x: 160, y: 160 }, { x: 224, y: 96 }]) {
    await walk(f, ws, goal.x, goal.y, 5); assert.equal(p.x, 96); assert.equal(p.y, 96);
  }
  await destroyFirstCrate(f, ws);
  assert.equal(g.crates.find(q => q.c === 3 && q.r === 1).alive, false);
  await walk(f, ws, 224, 96, 50);
  assert.ok(Math.hypot(p.x - 224, p.y - 96) <= 4, `cleared path arrival ${p.x},${p.y}`);
});

test('real practice crate points and bombs reset when the second human joins', async t => {
  const f = await setup(t), a = await f.enter(), ws = await f.connect(a), g = f.server.playRooms.get(a.code).game;
  await destroyFirstCrate(f, ws); assert.ok(g.players[0].score > 0);
  const b = await f.enter(a.code), wb = await f.connect(b);
  assert.equal(wb.initial.state.phase, 'countdown'); assert.ok(g.players.every(p => p.score === 0));
  assert.equal(g.bombs.length, 0); assert.ok(g.crates.every(q => q.alive));
});

test('public navigation and native bombs capture a real stationary opponent from zero to three', async t => {
  const f = await setup(t, { countdownMs: 100, roundMs: 300000 }), a = await f.enter(), wa = await f.connect(a), b = await f.enter(), wb = await f.connect(b);
  const g = f.server.playRooms.get(a.code).game; f.advance(100);
  const player = () => g.players.find(p => p.id === a.playerId), victim = () => g.players.find(p => p.id === b.playerId);
  async function go(x, y, ticks = 100) {
    await walk(f, wa, x, y, ticks);
    assert.ok(Math.hypot(player().x - x, player().y - y) <= 4, `route ${x},${y}: ${player().x},${player().y}`);
  }
  async function clear(x, y, ex, ey) {
    await go(x, y); await send(wa, { type: 'action', action: 'bomb' }); f.advance(50);
    await go(ex, ey, 32); for (let i = 0; i < 20; i++) f.advance(50);
  }
  // All arena changes arise from actual bombs; no fixture coordinates or crate mutations.
  await clear(160, 96, 96, 224); await clear(288, 96, 96, 96);
  await clear(480, 224, 416, 96); await clear(480, 416, 480, 224);
  assert.equal(player().score, 0); assert.equal(victim().score, 0);
  for (let score = 1; score <= 3; score++) {
    await go(480, 672); await send(wa, { type: 'action', action: 'bomb' }); f.advance(50);
    await go(480, 480, 25);
    for (let i = 0; i < 12; i++) f.advance(50);
    assert.ok(victim().trappedUntil > f.now(), 'opponent must actually be trapped by the native splash');
    assert.equal(player().score, score); assert.equal(victim().score, 0);
    if (score < 3) { assert.equal(g.phase, 'playing'); for (let i = 0; i < 30; i++) f.advance(50); }
  }
  assert.equal(g.phase, 'finished'); assert.deepEqual(g.winnerIds, [a.playerId]);
  assert.equal((await f.req('/api/play/teleport', { x: 1, y: 1 })).status, 404);
  assert.equal(wb.readyState, WebSocket.OPEN);
});

test('native SPEED fallback and four-unit arrival place a precise near-edge bomb', async t => {
  const core = { ...require('../public/bubble-core.js'), DASH_SPEED: undefined };
  const f = await setup(t, { core }), a = await f.enter(), ws = await f.connect(a), g = f.server.playRooms.get(a.code).game, p = g.players[0];
  await walk(f, ws, 166, 96, 25);
  assert.ok(Math.hypot(p.x - 166, p.y - 96) <= 4, `precise arrival ${p.x},${p.y}`);
  await send(ws, { type: 'action', action: 'bomb' }); f.advance(50);
  assert.equal(g.bombs.length, 1); assert.deepEqual([g.bombs[0].c, g.bombs[0].r], [2, 1]);
});

test('default health identifies the authoritative bubble game', async t => {
  const f = await setup(t);
  assert.deepEqual((await f.req('/api/play/health')).body, { ok: true, mode: 'realtime', game: 'bubble', rooms: 0, players: 0 });
});


test('fresh room creation never autojoins an existing real practice player', async t => {
  const f = await setup(t), a = await f.enter(); await f.connect(a);
  const b = await f.req('/api/play/enter', { fresh: true });
  assert.equal(b.status, 200); assert.notEqual(b.body.code, a.code);
  assert.equal((await f.req('/api/play/health')).body.players, 1, 'reservation is not another online player');
  const wb = await f.connect(b.body); assert.equal(wb.initial.state.phase, 'practice');
  assert.equal(wb.initial.state.players.length, 1);
});

test('fresh room creation validates its exact schema and respects room capacity', async t => {
  const f = await setup(t, { maxRooms: 1 }), a = await f.enter(); await f.connect(a);
  for (const body of [{ fresh: false }, { fresh: 1 }, { fresh: true, code: a.code }, { fresh: true, core: 'arena' }])
    assert.equal((await f.req('/api/play/enter', body)).status, 400);
  assert.equal((await f.req('/api/play/enter', { fresh: true })).status, 503);
  assert.equal(f.server.playRooms.size, 1);
});

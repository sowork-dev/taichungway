'use strict';
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { isIP } = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');
const BubbleCore = require('../public/bubble-core.js');
// Flat, explicit deployment surface. Never expose arbitrary files or directories.
const PUBLIC_ASSETS = new Set([
  'index.html', 'app.js', 'engine.js', 'knowledge.json', 'policy-catalog.json',
  'taichung-elements.js', 'style.css', 'world.css', 'icon.svg', 'robots.txt',
  'pk.js', 'pk.css', 'quest.js', 'quest.css', 'quest-core.js',
  'arena-core.js', 'bubble-core.js', 'play.js', 'play.css', 'policies.html', 'bubble.html', 'adventure.html', 'chat.css', 'chat.js'
]);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

function createPlayServer(options = {}) {
  const A = options.core || BubbleCore;
  const { now = Date.now, roundMs = 60000, countdownMs = 2000, hostOrigin,
    maxRooms = 50, roomTtlMs = 900000, trustProxy = false } = options;
  const requestRates = new Map();
  function clientIp(req) {
    const peer = req.socket.remoteAddress || '';
    const loopback = peer === '::1' || peer === '127.0.0.1' || peer === '::ffff:127.0.0.1';
    let ip = peer;
    if (trustProxy && loopback && typeof req.headers['x-forwarded-for'] === 'string') {
      const chain = req.headers['x-forwarded-for'].split(',').map(s => s.trim());
      // Walk from the trusted loopback side; never trust an attacker-supplied leftmost prefix.
      const candidate = chain[chain.length - 1];
      if (isIP(candidate)) ip = candidate;
    }
    return ip;
  }
  function requestAllowed(req) {
    const ip = clientIp(req);
    const time = now();
    for (const [key, rate] of requestRates) if (time - rate.start >= 60000) requestRates.delete(key);
    let rate = requestRates.get(ip);
    if (!rate) {
      if (requestRates.size >= 1024) return false;
      rate = { start: time, count: 0 }; requestRates.set(ip, rate);
    }
    return ++rate.count <= 120;
  }
  function originAllowed(req) {
    if (!req.headers.origin) return true; // Non-browser clients have no ambient browser credentials.
    return req.headers.origin === (hostOrigin || `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`);
  }
  function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function keys(value, allowed) { return Object.keys(value).every(key => allowed.includes(key)); }
  const rooms = new Map();
  const connected = room => [...room.members.values()].filter(m => m.ws && m.ws.readyState === WebSocket.OPEN);
  const count = () => [...rooms.values()].reduce((n, r) => n + connected(r).length, 0);
  // Game membership ends before the transport close handshake can be delayed.
  function detach(ws) {
    const { room, member } = ws.play || {};
    if (!member || member.ws !== ws) return;
    room.members.delete(member.token); member.ws = null;
    A.removePlayer(room.game, member.playerId, now());
    if (!room.members.size) rooms.delete(room.code);
  }
  function closePeer(ws, code, reason, force = false) {
    detach(ws);
    if (ws.play && ws.play.closingAt === undefined) ws.play.closingAt = now();
    if (force) ws.terminate();
    else ws.close(code, reason);
  }

  function json(res, status, value) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  const server = http.createServer(async (req, res) => {
    if (!requestAllowed(req)) return json(res, 429, { error: 'Request limit reached' });
    if (options.chat && req.method === 'POST' && req.url === '/api/chat') return options.chat(req, res, { ip: clientIp(req), originAllowed: originAllowed(req) });
    if (req.method === 'GET' && req.url === '/api/play/health') return json(res, 200, { ok: true, mode: 'realtime', ...(A.GAME_KIND === 'bubble' ? { game: 'bubble' } : {}), rooms: rooms.size, players: count() });
    if (req.method === 'GET' && req.url === '/api/play/lobby') return json(res, 200, {
      rooms: [...rooms.values()].filter(r => connected(r).length).map(r => ({ code: r.code, players: connected(r).length, phase: r.game.phase, joinable: r.game.phase === 'practice' && connected(r).length === 1 && r.members.size < 2 })), online: count()
    });
    if (req.method === 'POST' && req.url === '/api/play/enter') {
      if (!originAllowed(req)) return json(res, 403, { error: 'Origin rejected' });
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'JSON required' });
      let body;
      try {
        let size = 0; const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1024) { json(res, 413, { error: 'Body too large' }); return; }
          chunks.push(chunk);
        }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch { return json(res, 400, { error: 'Invalid JSON' }); }
      if (!plain(body) || !keys(body, ['code', 'fresh']) || (Object.hasOwn(body, 'fresh') && (body.fresh !== true || Object.hasOwn(body, 'code'))) || (Object.hasOwn(body, 'code') && (typeof body.code !== 'string' || !/^[A-F0-9]{6}$/.test(body.code)))) return json(res, 400, { error: 'Invalid enter request' });
      server.tickPlay();
      let room = body.code ? rooms.get(body.code) : body.fresh ? null : [...rooms.values()].find(r => r.game.phase === 'practice' && connected(r).length === 1 && r.members.size < 2);
      if (body.code && !room) return json(res, 404, { error: 'Room not found' });
      if (room && room.members.size >= 2) return json(res, 409, { error: 'Room full' });
      if (!room) {
        if (rooms.size >= Math.min(maxRooms, 50)) return json(res, 503, { error: 'Lobby full' });
        let code; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
        room = { code, game: A.createGame({ now: now(), roundMs, countdownMs }), members: new Map(), createdAt: now(), lastBroadcast: now() };
        rooms.set(code, room);
      }
      const token = randomBytes(32).toString('hex');
      const member = { playerId: randomBytes(12).toString('hex'), token, ws: null, reservedAt: now() };
      room.members.set(token, member);
      return json(res, 200, { code: room.code, token, playerId: member.playerId, state: connected(room).length ? A.snapshot(room.game) : null });
    }
    if (options.staticDir && req.method === 'GET') {
      const pathname = req.url.split('?')[0];
      const name = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (pathname === '/' || (pathname === '/' + name && PUBLIC_ASSETS.has(name))) {
        let file;
        try {
          const root = path.resolve(options.staticDir);
          const stat = await fs.promises.lstat(root);
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Not a static root');
          file = await fs.promises.open(path.join(root, name), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          if (!(await file.stat()).isFile()) throw new Error('Not a file');
          const body = await file.readFile();
          res.writeHead(200, { 'content-type': `${MIME[path.extname(name)] || 'application/octet-stream'}; charset=utf-8`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
          return res.end(body);
        } catch { /* The same 404 covers missing, forbidden and symlink assets. */ }
        finally { if (file) await file.close(); }
      }
    }
    return json(res, 404, { error: 'Not found' });
  });
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 2048 });
  const rawSockets = new Set();
  server.on('connection', socket => { rawSockets.add(socket); socket.on('close', () => rawSockets.delete(socket)); });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws/play') { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return; }
    if (!originAllowed(req)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    if (wss.clients.size >= 100) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
    if (!requestAllowed(req)) { socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  function syncRound(room, member) {
    const phase = room.game.phase;
    if (member.navRound !== room.game.roundId || !['practice', 'playing'].includes(phase) || (member.navPhase !== phase && phase === 'practice')) {
      member.nav = null;
      member.input = { x: 0, y: 0, dash: false, tag: false, bomb: false };
    }
    member.navRound = room.game.roundId; member.navPhase = phase;
  }
  function navigationInput(room, member) {
    if (!member.nav) return;
    const player = room.game.players.find(p => p.id === member.playerId);
    if (!player) { member.nav = null; return; }
    while (member.nav.length) {
      const goal = member.nav[0], distance = Math.hypot(goal.x - player.x, goal.y - player.y);
      if (distance <= (member.nav.length === 1 ? (A.GAME_KIND === 'bubble' ? 4 : 9) : 0.5)) { member.nav.shift(); continue; }
      // A normal bounded vector: the core still owns speed, collision and all positions.
      const scale = Math.max(distance, (A.DASH_SPEED || A.SPEED) * 0.05);
      member.input.x = (goal.x - player.x) / scale;
      member.input.y = (goal.y - player.y) / scale;
      return;
    }
    member.nav = null; member.input.x = 0; member.input.y = 0;
  }
  function sendState(room, member) {
    const ws = member.ws;
    if (ws?.readyState !== WebSocket.OPEN) return;
    // Bound each consumer's memory independently, even if it keeps sending pong.
    if (ws.bufferedAmount > 65536) return closePeer(ws, 1008, 'Slow consumer', true);
    ws.send(JSON.stringify({ type: 'state', you: member.playerId, code: room.code, state: A.snapshot(room.game) }), error => {
      if (error) closePeer(ws, 1008, 'Send failed', true);
    });
  }
  wss.on('connection', ws => {
    ws.play = { connectedAt: now(), lastPing: now(), lastPong: now(), room: null, member: null };
    ws.on('pong', () => { ws.play.lastPong = now(); });
    ws.on('error', () => {});
    ws.on('message', (data, binary) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (binary) return closePeer(ws, 1008, 'Text JSON required');
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return closePeer(ws, 1008, 'Invalid JSON'); }
      if (!plain(msg)) return closePeer(ws, 1008, 'Invalid message');
      if (!ws.play.member) {
        if (msg.type !== 'hello' || !keys(msg, ['type', 'code', 'token']) || typeof msg.code !== 'string' || !/^[A-F0-9]{6}$/.test(msg.code) || typeof msg.token !== 'string' || !/^[a-f0-9]{64}$/.test(msg.token)) return closePeer(ws, 1008, 'Authentication required');
        const room = rooms.get(msg.code), member = room?.members.get(msg.token);
        if (!member || now() - ws.play.connectedAt >= 5000 || (!member.ws && now() - member.reservedAt >= 5000)) return closePeer(ws, 1008, 'Authentication required');
        const previous = member.ws;
        member.ws = ws;
        ws.play.room = room; ws.play.member = member;
        if (previous) closePeer(previous, 1008, 'Connection replaced');
        else {
          member.rateStart = now(); member.rateCount = 0;
          member.input = { x: 0, y: 0, dash: false, tag: false, bomb: false };
          member.lastInput = now();
          A.addPlayer(room.game, member.playerId, now());
          member.navRound = room.game.roundId; member.navPhase = room.game.phase; member.nav = null;
        }
        sendState(room, member);
        return;
      }
      const { room, member } = ws.play;
      if (member.ws !== ws || !rooms.has(room.code)) return closePeer(ws, 1008, 'Session expired');
      if (now() - member.rateStart >= 1000) { member.rateStart = now(); member.rateCount = 0; }
      if (++member.rateCount > 60) return closePeer(ws, 1008, 'Message limit reached');
      syncRound(room, member);
      if (msg.type === 'navigate') {
        if (!keys(msg, ['type', 'x', 'y']) || !Number.isFinite(msg.x) || !Number.isFinite(msg.y) || msg.x < 0 || msg.y < 0 || msg.x > A.WORLD_WIDTH || msg.y > A.WORLD_HEIGHT) return closePeer(ws, 1008, 'Invalid navigation');
        if (!['practice', 'playing'].includes(room.game.phase)) return;
        const player = room.game.players.find(p => p.id === member.playerId);
        member.nav = player ? A.findPath(player.x, player.y, msg.x, msg.y, room.game) : null;
        member.input.x = 0; member.input.y = 0;
        member.lastInput = now();
        return;
      }
      if (msg.type === 'action') {
        if (!keys(msg, ['type', 'action']) || !(A.ACTIONS || ['dash', 'tag']).includes(msg.action)) return closePeer(ws, 1008, 'Invalid action');
        if (['practice', 'playing'].includes(room.game.phase)) member.input[msg.action] = true;
        return;
      }
      if (msg.type === 'input') {
        if (!keys(msg, ['type', 'x', 'y', 'dash', 'tag']) || !Number.isFinite(msg.x) || !Number.isFinite(msg.y) || Math.abs(msg.x) > 1 || Math.abs(msg.y) > 1 || (Object.hasOwn(msg, 'dash') && typeof msg.dash !== 'boolean') || (Object.hasOwn(msg, 'tag') && typeof msg.tag !== 'boolean')) return closePeer(ws, 1008, 'Invalid input');
        member.nav = null;
        member.input = { x: msg.x, y: msg.y, dash: member.input.dash || msg.dash === true, tag: member.input.tag || msg.tag === true, bomb: member.input.bomb === true };
        member.lastInput = now();
        return;
      }
      if (!keys(msg, ['type'])) return closePeer(ws, 1008, 'Invalid message');
      if (msg.type === 'ping') return ws.send(JSON.stringify({ type: 'pong', now: now() }));
      if (msg.type === 'rematch') { A.rematch(room.game, member.playerId, now()); return; }
      if (msg.type === 'leave') return closePeer(ws, 1000, 'Left room');
      closePeer(ws, 1008, 'Unknown message');
    });
    ws.on('close', () => detach(ws));
  });
  server.playRooms = rooms;
  server.tickPlay = () => {
    const time = now();
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        detach(ws);
        if (ws.play.closingAt === undefined) ws.play.closingAt = time;
        if (time - ws.play.closingAt >= 500) ws.terminate();
        continue;
      }
      if (!ws.play.member && time - ws.play.connectedAt >= 5000) { closePeer(ws, 1008, 'Hello timeout'); continue; }
      if (ws.bufferedAmount > 65536) { closePeer(ws, 1008, 'Slow consumer', true); continue; }
      if (time - ws.play.lastPong >= 20000) { closePeer(ws, 1008, 'Heartbeat timeout', true); continue; }
      if (time - ws.play.lastPing >= 10000) { ws.play.lastPing = time; ws.ping(); }
    }
    for (const [key, rate] of requestRates) if (time - rate.start >= 60000) requestRates.delete(key);
    for (const [code, room] of rooms) {
      if (time - room.createdAt >= roomTtlMs) {
        rooms.delete(code);
        for (const member of room.members.values()) if (member.ws) closePeer(member.ws, 1008, 'Room expired');
        room.members.clear();
        continue;
      }
      for (const [token, member] of room.members) {
        if (!member.ws && time - member.reservedAt >= 5000) room.members.delete(token);
      }
      if (!room.members.size) { rooms.delete(code); continue; }
      for (const member of connected(room)) {
        syncRound(room, member);
        if (member.nav) navigationInput(room, member);
        else if (time - member.lastInput > 500) { member.input.x = 0; member.input.y = 0; }
        A.setInput(room.game, member.playerId, member.input);
      }
      A.step(room.game, time);
      for (const member of connected(room)) { member.input.dash = false; member.input.tag = false; member.input.bomb = false; }
      if (time - room.lastBroadcast >= 100) {
        room.lastBroadcast = time;
        for (const member of connected(room)) sendState(room, member);
      }
    }
  };
  const timer = options.autoTick === false ? null : setInterval(() => server.tickPlay(), 50);
  if (timer) timer.unref();
  server.on('close', () => { if (timer) clearInterval(timer); });
  let closing;
  server.closePlay = () => {
    if (closing) return closing;
    if (timer) clearInterval(timer);
    for (const ws of wss.clients) ws.terminate();
    rooms.clear(); requestRates.clear();
    closing = Promise.all([
      new Promise(resolve => wss.close(resolve)),
      new Promise(resolve => {
        for (const socket of rawSockets) socket.destroy();
        server.close(resolve);
      })
    ]).then(() => undefined);
    return closing;
  };
  return server;
}
module.exports = { createPlayServer };

if (require.main === module) {
  const host = process.env.HOST || '127.0.0.1';
  const port = process.env.PORT === undefined ? 8790 : Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    process.stderr.write('Invalid PORT\n'); process.exitCode = 1;
  } else {
    const server = createPlayServer({ hostOrigin: process.env.HOST_ORIGIN || undefined, trustProxy: process.env.TRUST_PROXY === 'true' });
    server.listen(port, host, () => process.stdout.write(`Realtime play API listening on port ${server.address().port}\n`));
    server.on('error', () => { process.stderr.write('Play API could not listen\n'); server.closePlay().then(() => { process.exitCode = 1; }); });
    const stop = () => server.closePlay().then(() => { process.exitCode = 0; });
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
  }
}

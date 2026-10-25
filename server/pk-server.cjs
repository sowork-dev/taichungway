'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { isIP } = require('node:net');
const { randomBytes, randomInt } = require('node:crypto');

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function buildQuestionBank(catalog) {
  if (!catalog || !Array.isArray(catalog.topics) || catalog.topics.length < 2) throw new Error('Invalid policy catalog');
  const topics = catalog.topics;
  const ids = new Set();
  for (const topic of topics) {
    if (!topic || typeof topic.id !== 'string' || !topic.id || ids.has(topic.id) || typeof topic.title !== 'string' || !topic.title.trim() || typeof topic.sourceUrl !== 'string' || !/^https?:\/\//.test(topic.sourceUrl) || !Array.isArray(topic.pads) || !topic.pads.length) throw new Error('Invalid policy topic');
    ids.add(topic.id);
    for (const pad of topic.pads) {
      if (!pad || typeof pad.title !== 'string' || !pad.title.trim() || !Array.isArray(pad.details) || typeof pad.details[0] !== 'string' || !pad.details[0].trim()) throw new Error('Missing source detail');
    }
  }
  const questions = [];
  for (const topic of topics) {
    const ownTitles = new Set(topic.pads.map(pad => pad.title));
    const distractors = [...new Set(topics.filter(other => other.id !== topic.id).flatMap(other => other.pads.map(pad => pad.title)))].filter(title => !ownTitles.has(title));
    if (distractors.length < 3) throw new Error('Not enough unambiguous distractors');
    for (const pad of topic.pads) {
      const choices = shuffled([pad.title, ...shuffled(distractors).slice(0, 3)]);
      questions.push({ id: `${topic.id}:${questions.length}`, question: `依提供文件，哪一項屬於「${topic.title}」？`, choices, correctIndex: choices.indexOf(pad.title), topicId: topic.id, sourceTitle: topic.title, sourceUrl: topic.sourceUrl, explanation: `${pad.details[0]}（依提供提案文件整理，非已實施政策。）` });
    }
  }
  if (questions.length < 15) throw new Error('At least 15 source-backed questions required');
  return questions;
}
function createPkServer(options = {}) {
  const { now = Date.now, roomTtlMs = 30 * 60 * 1000, roundMs = 25000, resultMs = 3500, maxRooms = 100 } = options;
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  for (const [key, value] of Object.entries({ roomTtlMs, roundMs, resultMs, maxRooms })) {
    if (!Number.isSafeInteger(value) || value < 1 || (key === 'maxRooms' && value > 100)) throw new TypeError(`Invalid ${key}`);
  }
  if (options.hostOrigin !== undefined) {
    const origin = new URL(options.hostOrigin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== options.hostOrigin) throw new TypeError('hostOrigin must be an exact HTTP(S) origin');
  }
  const inputBank = options.questionBank === undefined ? buildQuestionBank(JSON.parse(fs.readFileSync(path.join(__dirname, '../public/policy-catalog.json'), 'utf8'))) : options.questionBank;
  if (!Array.isArray(inputBank) || inputBank.length < 5) throw new TypeError('At least 5 valid questions required');
  const questionBank = inputBank.map(q => {
    if (!q || !['question', 'explanation', 'topicId', 'sourceTitle', 'sourceUrl'].every(key => typeof q[key] === 'string' && q[key].trim()) || !/^https?:\/\//.test(q.sourceUrl) || !Array.isArray(q.choices) || q.choices.length !== 4 || !q.choices.every(choice => typeof choice === 'string' && choice.trim()) || new Set(q.choices).size !== 4 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) throw new TypeError('Invalid question bank');
    return Object.freeze({ question: q.question, explanation: q.explanation, topicId: q.topicId, sourceTitle: q.sourceTitle, sourceUrl: q.sourceUrl, choices: Object.freeze([...q.choices]), correctIndex: q.correctIndex });
  });
  const staticRoot = options.staticDir === undefined ? null : fs.realpathSync(options.staticDir);
  const publicFiles = new Map([
    ['index.html', 'text/html; charset=utf-8'], ['app.js', 'text/javascript; charset=utf-8'],
    ['engine.js', 'text/javascript; charset=utf-8'], ['quest-core.js', 'text/javascript; charset=utf-8'],
    ['quest.js', 'text/javascript; charset=utf-8'], ['taichung-elements.js', 'text/javascript; charset=utf-8'], ['pk.js', 'text/javascript; charset=utf-8'],
    ['style.css', 'text/css; charset=utf-8'], ['quest.css', 'text/css; charset=utf-8'],
    ['world.css', 'text/css; charset=utf-8'], ['pk.css', 'text/css; charset=utf-8'],
    ['policy-catalog.json', 'application/json; charset=utf-8'], ['knowledge.json', 'application/json; charset=utf-8'],
    ['icon.svg', 'image/svg+xml'], ['robots.txt', 'text/plain; charset=utf-8']
  ]);
  const rooms = new Map();
  const buckets = new Map();
  function rateLimit(req, res) {
    const time = now();
    for (const [key, bucket] of buckets) if (time >= bucket.expiresAt) buckets.delete(key);
    const forwarded = options.trustProxy === true && typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : '';
    const key = isIP(forwarded) ? forwarded : req.socket.remoteAddress;
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 2048) { res.setHeader('retry-after', '60'); fail(429, 'Rate capacity reached'); }
      bucket = { count: 0, expiresAt: time + 60000 }; buckets.set(key, bucket);
    }
    if (++bucket.count > 600) { res.setHeader('retry-after', String(Math.max(1, Math.ceil((bucket.expiresAt - time) / 1000)))); fail(429, 'Rate limit exceeded'); }
  }
  function snapshot(room, player) {
    return { code: room.code, status: room.status, you: player.id,
      players: room.players.map(({ id, nickname, score, ready, connected, x, y, zoneId }) => ({ id, nickname, score, ready, connected, x, y, zoneId })),
      round: room.round ? {
        id: room.round.id, index: room.round.index, total: 5,
        question: room.round.question.question, choices: [...room.round.question.choices], topicId: room.round.question.topicId,
        sourceTitle: room.round.question.sourceTitle, sourceUrl: room.round.question.sourceUrl,
        deadline: room.round.deadline, answered: [...room.round.answers.keys()], result: room.round.result
      } : null, winnerIds: [...(room.winnerIds || [])], serverTime: now(), expiresAt: room.expiresAt };
  }
  function finishRound(room, time) {
    const round = room.round;
    const points = room.players.map(player => {
      const answer = round.answers.get(player.id);
      const delta = answer && answer.choiceIndex === round.question.correctIndex ? 100 + Math.max(0, Math.min(50, Math.floor(50 * (round.deadline - answer.time) / roundMs))) : 0;
      player.score += delta; return { playerId: player.id, delta };
    });
    room.status = 'round-result';
    round.result = { correctIndex: round.question.correctIndex, explanation: round.question.explanation, sourceUrl: round.question.sourceUrl, sourceTitle: round.question.sourceTitle, points, nextAt: time + resultMs };
  }
  function beginRound(room, index, time) {
    room.status = 'playing';
    room.round = { id: randomBytes(12).toString('hex'), index, question: room.questions[index - 1], deadline: time + roundMs, startedAt: time, answers: new Map(), result: null };
  }
  function beginGame(room) {
    const distinct = new Map();
    for (const question of shuffled(questionBank)) if (!distinct.has(question.topicId)) distinct.set(question.topicId, question);
    const preferred = [...distinct.values()];
    room.questions = [...preferred, ...shuffled(questionBank.filter(q => !preferred.includes(q)))].slice(0, 5);
    room.winnerIds = [];
    for (const player of room.players) player.score = 0;
    beginRound(room, 1, now());
  }
  function abortGame(room) {
    room.status = 'waiting'; room.round = null; room.winnerIds = []; room.questions = [];
    for (const player of room.players) { player.ready = false; player.score = 0; }
  }
  function maintain() {
    const time = now();
    for (const room of rooms.values()) {
      if (time >= room.expiresAt) { rooms.delete(room.code); continue; }
      for (const player of room.players) player.connected = time - player.lastSeen <= 20000;
      if (['playing', 'round-result'].includes(room.status) && room.players.some(p => !p.connected)) abortGame(room);
      if (room.status === 'playing' && time >= room.round.deadline) finishRound(room, room.round.deadline);
      if (room.status === 'round-result' && time >= room.round.result.nextAt) {
        if (room.round.index < 5) beginRound(room, room.round.index + 1, time);
        else {
          room.status = 'finished';
          const best = Math.max(...room.players.map(p => p.score));
          room.winnerIds = room.players.filter(p => p.score === best).map(p => p.id);
          for (const player of room.players) player.ready = false;
        }
      }
    }
  }
  function authenticate(req, code) {
    maintain();
    const room = rooms.get(code);
    if (!room) fail(404, 'Room not found');
    const bearer = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
    const player = bearer && room.players.find(p => p.token === bearer[1]);
    if (!player) fail(401, 'Bearer token required');
    return { room, player };
  }
  function newPlayer(nickname) {
    if (nickname === undefined || nickname === '') nickname = '訪客';
    if (typeof nickname !== 'string' || [...nickname].length > 12 || !nickname.trim() || /[\u0000-\u001f\u007f]/.test(nickname) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(nickname.normalize('NFKC')) || /\+?(?:\d[\s().-]*){7,}/.test(nickname.normalize('NFKC'))) fail(400, 'Nickname must be at most 12 plaintext characters without email or phone');
    return { id: randomBytes(12).toString('hex'), token: randomBytes(32).toString('hex'), nickname: nickname || '訪客', score: 0, ready: false, connected: true, x: 1500, y: 900, zoneId: 'living', lastSeen: now() };
  }
  function createRoom(player, quick = false) {
    if (rooms.size >= maxRooms) fail(503, 'Room capacity reached');
    let code;
    do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
    const room = { code, status: 'waiting', players: [player], expiresAt: now() + roomTtlMs, quick };
    rooms.set(code, room); return room;
  }
  async function readBody(req) {
    if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type'] || '')) { req.resume(); fail(415, 'application/json required'); }
    if (Number(req.headers['content-length']) > 4096) { req.resume(); fail(413, 'Body exceeds 4096 bytes'); }
    const raw = await new Promise((resolve, reject) => {
      const chunks = []; let size = 0; let oversized = false;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > 4096) {
          if (!oversized) { oversized = true; chunks.length = 0; const error = new Error('Body exceeds 4096 bytes'); error.status = 413; reject(error); }
        } else if (!oversized) chunks.push(chunk);
      });
      req.on('end', () => { if (!oversized) resolve(Buffer.concat(chunks).toString('utf8')); });
      req.on('error', reject);
      req.on('aborted', () => reject(Object.assign(new Error('Aborted body'), { status: 400 })));
    });
    let body;
    try { body = JSON.parse(raw); } catch { fail(400, 'Invalid JSON'); }
    if (!body || Array.isArray(body) || typeof body !== 'object') fail(400, 'JSON object required');
    maintain();
    return body;
  }
  function send(res, status, value) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
  const server = http.createServer(async (req, res) => {
    try {
      const rawPath = req.url.split('?')[0];
      if (!rawPath.startsWith('/') || rawPath.includes('%') || rawPath.includes('\\') || rawPath.includes('..') || rawPath.includes('//')) fail(404, 'Not found');
      const url = new URL(req.url, 'http://localhost');
      maintain();
      rateLimit(req, res);
      if (req.method === 'POST' && req.headers.origin) {
        const expected = options.hostOrigin || `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
        if (req.headers.origin !== expected) fail(403, 'Foreign origin rejected');
      }
      const allowedQuery = url.pathname.startsWith('/api/pk/') ? 'code' : 'room';
      if ([...url.searchParams.keys()].some(key => key !== allowedQuery)) fail(400, 'Unsupported query parameter');
      if (req.method === 'GET' && url.pathname === '/api/pk/state') {
        const { room, player } = authenticate(req, url.searchParams.get('code'));
        player.lastSeen = now(); player.connected = true;
        return send(res, 200, snapshot(room, player));
      }
      if (req.method === 'GET' && url.pathname === '/api/pk/health') {
        return send(res, 200, { ok: true, mode: 'live', rooms: rooms.size, players: [...rooms.values()].reduce((sum, room) => sum + room.players.length, 0) });
      }
      if (req.method === 'POST' && ['/api/pk/create', '/api/pk/join', '/api/pk/match'].includes(url.pathname)) {
        const body = await readBody(req);
        const player = newPlayer(body.nickname);
        let room;
        if (url.pathname === '/api/pk/join') {
          room = rooms.get(body.code);
          if (!room) fail(404, 'Room not found');
          if (room.players.length >= 2 || room.status !== 'waiting') fail(409, 'Room unavailable');
          room.players.push(player);
        } else if (url.pathname === '/api/pk/match') {
          room = [...rooms.values()].find(candidate => candidate.quick && candidate.status === 'waiting' && candidate.players.length === 1 && candidate.players[0].connected);
          if (room) room.players.push(player);
          else room = createRoom(player, true);
        } else room = createRoom(player);
        return send(res, 200, { code: room.code, token: player.token, playerId: player.id, state: snapshot(room, player) });
      }
      if (req.method === 'POST' && url.pathname === '/api/pk/position') {
        const body = await readBody(req);
        const { room, player } = authenticate(req, body.code);
        if (!Number.isFinite(body.x) || !Number.isFinite(body.y) || body.x < 12 || body.x > 2988 || body.y < 12 || body.y > 1788 || !['living', 'innovation', 'culture', 'nature', 'connection'].includes(body.zoneId)) fail(400, 'Invalid position');
        player.x = body.x; player.y = body.y; player.zoneId = body.zoneId;
        return send(res, 200, { state: snapshot(room, player) });
      }
      if (req.method === 'POST' && url.pathname === '/api/pk/leave') {
        const body = await readBody(req);
        const { room, player } = authenticate(req, body.code);
        room.players = room.players.filter(p => p !== player);
        if (!room.players.length) rooms.delete(room.code);
        else abortGame(room);
        return send(res, 200, { left: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/pk/answer') {
        const body = await readBody(req);
        const { room, player } = authenticate(req, body.code);
        if (room.status !== 'playing' || body.roundId !== room.round.id) fail(409, 'Stale or inactive round');
        if (!Number.isInteger(body.choiceIndex) || body.choiceIndex < 0 || body.choiceIndex >= room.round.question.choices.length) fail(400, 'Invalid choice');
        if (room.round.answers.has(player.id)) fail(409, 'Already answered');
        room.round.answers.set(player.id, { choiceIndex: body.choiceIndex, time: now() });
        if (room.round.answers.size === 2) finishRound(room, now());
        return send(res, 200, { state: snapshot(room, player) });
      }
      if (req.method === 'POST' && url.pathname === '/api/pk/rematch') {
        const body = await readBody(req);
        const { room, player } = authenticate(req, body.code);
        if (room.status !== 'finished') fail(409, 'Game is not finished');
        player.ready = true;
        if (room.players.length === 2 && room.players.every(p => p.ready && p.connected)) beginGame(room);
        return send(res, 200, { state: snapshot(room, player) });
      }
      if (req.method === 'POST' && url.pathname === '/api/pk/ready') {
        const body = await readBody(req);
        const { room, player } = authenticate(req, body.code);
        if (room.status !== 'waiting') fail(409, 'Room is not waiting');
        player.ready = true;
        if (room.players.length === 2 && room.players.every(p => p.ready && p.connected)) beginGame(room);
        return send(res, 200, { state: snapshot(room, player) });
      }
      if (staticRoot && ['GET', 'HEAD'].includes(req.method)) {
        const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        if (publicFiles.has(filename)) {
          const target = path.join(staticRoot, filename);
          let contents;
          try { if (!fs.lstatSync(target).isFile()) fail(404, 'Not found'); contents = fs.readFileSync(target); }
          catch { fail(404, 'Not found'); }
          res.writeHead(200, { 'content-type': publicFiles.get(filename), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
          return res.end(req.method === 'HEAD' ? undefined : contents);
        }
      }
      fail(404, 'Not found');
    } catch (error) {
      const codes = {
        'Room not found': 'room_not_found', 'Room unavailable': 'room_full', 'Bearer token required': 'invalid_token',
        'Foreign origin rejected': 'origin_not_allowed', 'Already answered': 'already_answered',
        'Stale or inactive round': 'round_mismatch', 'Rate limit exceeded': 'rate_limited', 'Rate capacity reached': 'rate_limited',
        'Nickname must be at most 12 plaintext characters without email or phone': 'invalid_nickname',
        'Room capacity reached': 'server_full', 'Invalid choice': 'invalid_choice', 'Invalid position': 'invalid_position'
      };
      send(res, error.status || 500, { error: error.status ? (codes[error.message] || 'invalid_request') : 'internal_error', message: error.status ? error.message : 'Internal server error' });
    }
  });
  return server;
}
module.exports = { buildQuestionBank, createPkServer };
if (require.main === module) {
  try {
    const server = createPkServer({ hostOrigin: process.env.HOST_ORIGIN || undefined, trustProxy: process.env.TRUST_PROXY === '1' });
    server.on('error', () => { process.stderr.write('PK server could not bind.\n'); process.exitCode = 1; });
    server.listen(Number(process.env.PORT || 8788), process.env.HOST || '127.0.0.1', () => {
      process.stdout.write(`${JSON.stringify({ ok: true, mode: 'live', port: server.address().port })}\n`);
    });
  } catch {
    process.stderr.write('PK server unavailable: source catalog or configuration invalid.\n');
    process.exitCode = 1;
  }
}

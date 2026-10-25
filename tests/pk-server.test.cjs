'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const modulePath = path.resolve(__dirname, '../server/pk-server.cjs');
function api() { assert.ok(fs.existsSync(modulePath), 'PK backend must exist'); return require(modulePath); }
function catalog() {
  return { topics: Array.from({ length: 5 }, (_, i) => ({ id: `topic-${i}`, title: `主題${i}`, sourceUrl: `https://example.org/proposal/${i}`, pads: Array.from({ length: 3 }, (_, j) => ({ title: `政策${i}-${j}`, description: `說明${i}-${j}`, details: [`文件細節${i}-${j}`, '第二項'] })) })) };
}
function bank() { return api().buildQuestionBank(catalog()); }
async function start(t, options = {}) {
  let clock = 100000;
  const server = api().createPkServer({ questionBank: bank(), now: () => clock, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const port = server.address().port;
  async function request(route, body, token, extra = {}) {
    return new Promise((resolve, reject) => {
      const raw = extra.raw === undefined ? (body === undefined ? undefined : JSON.stringify(body)) : extra.raw;
      const headers = { ...(raw === undefined ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra.headers };
      const req = http.request({ host: '127.0.0.1', port, path: route, method: extra.method || (raw === undefined ? 'GET' : 'POST'), headers }, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', data => { text += data; });
        res.on('end', () => { let data; try { data = JSON.parse(text); } catch { data = text; } resolve({ status: res.statusCode, headers: res.headers, data }); });
      });
      req.on('error', reject); req.end(raw);
    });
  }
  return { server, request, advance: ms => { clock += ms; }, port };
}
async function pair(ctx, route = '/api/pk/create') {
  const a = (await ctx.request(route, { nickname: '甲' })).data;
  const b = (await ctx.request('/api/pk/join', { code: a.code, nickname: '乙' })).data;
  return { a, b };
}
async function ready(ctx, a, b) {
  await ctx.request('/api/pk/ready', { code: a.code }, a.token);
  return (await ctx.request('/api/pk/ready', { code: b.code }, b.token)).data.state;
}
function correct(round) { return round.choices.findIndex(x => x.startsWith(`政策${round.topicId.slice(-1)}-`)); }
async function state(ctx, a) { return (await ctx.request(`/api/pk/state?code=${a.code}`, undefined, a.token)).data; }

test('question bank derives 15 source-backed questions with unambiguous shuffled choices', () => {
  const { buildQuestionBank } = api();
  const source = catalog(); const questions = buildQuestionBank(source);
  assert.ok(questions.length >= 15);
  assert.equal(new Set(questions.map(q => q.topicId)).size, source.topics.length);
  const indexes = new Set();
  for (const q of questions) {
    const topic = source.topics.find(x => x.id === q.topicId);
    assert.equal(q.question, `依提供文件，哪一項屬於「${topic.title}」？`);
    assert.equal(q.choices.length, 4); assert.equal(new Set(q.choices).size, 4);
    const pad = topic.pads.find(x => x.title === q.choices[q.correctIndex]);
    assert.ok(pad); assert.ok(q.explanation.includes(pad.details[0]));
    assert.match(q.explanation, /提供提案/); assert.match(q.explanation, /非已實施/);
    assert.equal(q.sourceUrl, topic.sourceUrl); assert.equal(q.sourceTitle, topic.title);
    assert.equal(q.choices.filter(x => topic.pads.some(p => p.title === x)).length, 1);
    indexes.add(q.correctIndex);
  }
  // Repeat enough independent draws to avoid mistaking one random ordering for a fixed index.
  for (let n = 0; n < 10; n++) for (const q of buildQuestionBank(source)) indexes.add(q.correctIndex);
  assert.ok(indexes.size > 1, 'answer positions must actually shuffle');
});

test('invalid or ambiguous catalogs fail closed instead of generating fake fixtures', () => {
  for (const bad of [null, {}, { topics: [] }, { topics: catalog().topics.slice(0, 1) }]) assert.throws(() => api().buildQuestionBank(bad));
  const emptyDetail = catalog(); emptyDetail.topics[0].pads[0].details = [];
  assert.throws(() => api().buildQuestionBank(emptyDetail));
  const duplicate = catalog(); duplicate.topics[1].id = duplicate.topics[0].id;
  assert.throws(() => api().buildQuestionBank(duplicate));
});
test('real ephemeral loopback HTTP health reports live and actual empty counts', async t => {
  const ctx = await start(t);
  assert.ok(ctx.server instanceof http.Server);
  const response = await ctx.request('/api/pk/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.data, { ok: true, mode: 'live', rooms: 0, players: 0 });
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal((await ctx.request('/api/pk/unknown')).status, 404);
});
test('create allocates only one real player, opaque token and exact public state', async t => {
  const ctx = await start(t);
  const created = await ctx.request('/api/pk/create', {});
  assert.equal(created.status, 200);
  const a = created.data;
  assert.match(a.code, /^[A-Z0-9]{6}$/); assert.match(a.token, /^[a-f0-9]{64}$/);
  assert.equal(a.state.status, 'waiting'); assert.equal(a.state.you, a.playerId);
  assert.deepEqual(Object.keys(a.state).sort(), ['code','status','you','players','round','winnerIds','serverTime','expiresAt'].sort());
  assert.deepEqual(Object.keys(a.state.players[0]).sort(), ['id','nickname','score','ready','connected','x','y','zoneId'].sort());
  assert.equal(a.state.players[0].nickname, '訪客'); assert.equal(a.state.round, null);
  assert.equal(a.state.players[0].score, 0); assert.equal(a.state.players[0].connected, true);
  assert.ok(!JSON.stringify(a.state).includes(a.token));
  assert.deepEqual((await ctx.request('/api/pk/health')).data, { ok:true, mode:'live', rooms:1, players:1 });
});
test('join admits a second real peer and rejects third or nonexistent rooms', async t => {
  const ctx = await start(t); const a = (await ctx.request('/api/pk/create', { nickname:'甲' })).data;
  const joined = await ctx.request('/api/pk/join', { code:a.code, nickname:'乙' });
  assert.equal(joined.status, 200); const b = joined.data;
  assert.equal(b.state.players.length, 2); assert.notEqual(b.token, a.token); assert.notEqual(b.playerId, a.playerId);
  assert.equal(b.code, a.code); assert.equal(b.state.you, b.playerId);
  assert.ok(!JSON.stringify(b.state).includes(a.token)); assert.ok(!JSON.stringify(b.state).includes(b.token));
  assert.equal((await ctx.request('/api/pk/join', { code:a.code })).status, 409);
  assert.equal((await ctx.request('/api/pk/join', { code:'000000' })).status, 404);
  assert.equal((await ctx.request('/api/pk/health')).data.players, 2);
});
test('state is bearer authenticated and never accepts URL tokens or leaks secrets', async t => {
  const ctx = await start(t); const { a,b } = await pair(ctx);
  const response = await ctx.request(`/api/pk/state?code=${a.code}`, undefined, a.token);
  assert.equal(response.status, 200); assert.equal(response.data.you, a.playerId);
  assert.equal(response.data.players.length, 2);
  assert.ok(!JSON.stringify(response.data).includes('token'));
  assert.equal((await ctx.request(`/api/pk/state?code=${a.code}`)).status, 401);
  assert.equal((await ctx.request(`/api/pk/state?code=${a.code}`, undefined, 'wrong')).status, 401);
  assert.equal((await ctx.request(`/api/pk/state?code=${a.code}&token=${a.token}`)).status, 400);
  const other = (await ctx.request('/api/pk/create', {})).data;
  assert.equal((await ctx.request(`/api/pk/state?code=${other.code}`, undefined, b.token)).status, 401);
});
test('quickmatch waits honestly then matches only an existing quickmatch waiting player', async t => {
  const ctx = await start(t);
  const invite = (await ctx.request('/api/pk/create', {})).data;
  const a = (await ctx.request('/api/pk/match', {nickname:'配對甲'})).data;
  assert.equal(a.state.players.length, 1); assert.equal(a.state.status, 'waiting'); assert.notEqual(a.code, invite.code);
  const b = (await ctx.request('/api/pk/match', {nickname:'配對乙'})).data;
  assert.equal(b.code, a.code); assert.equal(b.state.players.length, 2);
  const c = (await ctx.request('/api/pk/match', {})).data;
  assert.notEqual(c.code, a.code); assert.equal(c.state.players.length, 1);
});
test('both ready starts five-round game with one-based index and concealed answers', async t => {
  const ctx = await start(t); const {a,b} = await pair(ctx);
  const one = await ctx.request('/api/pk/ready', {code:a.code}, a.token);
  assert.equal(one.status, 200); assert.equal(one.data.state.status, 'waiting'); assert.equal(one.data.state.round, null);
  const s = await ready(ctx,a,b);
  assert.equal(s.status,'playing'); assert.equal(s.round.index,1); assert.equal(s.round.total,5);
  assert.equal(s.round.deadline,s.serverTime + 25000); assert.equal(s.round.result,null);
  assert.equal(s.round.choices.length,4); assert.deepEqual(s.round.answered,[]);
  assert.deepEqual(Object.keys(s.round).sort(), ['id','index','total','question','choices','topicId','sourceTitle','sourceUrl','deadline','answered','result'].sort());
  assert.ok(!JSON.stringify(s).includes('correctIndex')); assert.ok(!JSON.stringify(s).includes('explanation'));
  assert.equal((await ctx.request('/api/pk/ready',{code:a.code},'wrong')).status,401);
  assert.equal((await ctx.request('/api/pk/ready',{code:a.code},a.token)).status,409);
});
test('answers use server-time scoring and reveal only after both peers answer', async t => {
  const ctx = await start(t); const {a,b} = await pair(ctx); const s = await ready(ctx,a,b);
  const answer = {code:a.code,roundId:s.round.id,choiceIndex:correct(s.round),score:999999,delta:999999,correctIndex:0,answeredAt:0};
  const first = await ctx.request('/api/pk/answer', answer, a.token);
  assert.equal(first.status,200); assert.equal(first.data.state.status,'playing');
  assert.deepEqual(first.data.state.round.answered,[a.playerId]);
  assert.ok(!JSON.stringify(first.data.state).includes('correctIndex'));
  assert.equal(first.data.state.players[0].score,0, 'defer scores to avoid answer side-channel');
  ctx.advance(12500);
  const second = await ctx.request('/api/pk/answer',{...answer,choiceIndex:correct(s.round)},b.token);
  assert.equal(second.status,200); const result = second.data.state;
  assert.equal(result.status,'round-result'); assert.equal(result.round.result.correctIndex,correct(s.round));
  assert.equal(result.round.result.nextAt,result.serverTime+3500);
  assert.deepEqual(result.round.result.points,[{playerId:a.playerId,delta:150},{playerId:b.playerId,delta:125}]);
  assert.deepEqual(result.players.map(p=>p.score),[150,125]);
  assert.match(result.round.result.explanation,/非已實施/);
});
test('duplicates, stale rounds, bad choices and late answers cannot change server scores', async t => {
  const ctx = await start(t,{roundMs:1000}); const {a,b} = await pair(ctx); const s = await ready(ctx,a,b);
  const body = {code:a.code,roundId:s.round.id,choiceIndex:correct(s.round)};
  assert.equal((await ctx.request('/api/pk/answer',{...body,roundId:'stale'},a.token)).status,409);
  for (const value of [-1,4,1.5,'0',null]) assert.equal((await ctx.request('/api/pk/answer',{...body,choiceIndex:value},a.token)).status,400);
  assert.equal((await ctx.request('/api/pk/answer',body,'wrong')).status,401);
  assert.equal((await ctx.request('/api/pk/answer',body,a.token)).status,200);
  assert.equal((await ctx.request('/api/pk/answer',body,a.token)).status,409);
  ctx.advance(1000);
  const late = await ctx.request('/api/pk/answer',body,b.token);
  assert.equal(late.status,409); const result = await state(ctx,a);
  assert.equal(result.status,'round-result'); assert.deepEqual(result.players.map(p=>p.score),[150,0]);
  assert.deepEqual(result.round.result.points,[{playerId:a.playerId,delta:150},{playerId:b.playerId,delta:0}]);
});
test('lazy polling advances exactly five rounds then finishes with real tied winners', async t => {
  const ctx = await start(t,{roundMs:1000,resultMs:100}); const {a,b} = await pair(ctx); let s = await ready(ctx,a,b);
  const seen = new Set();
  for(let index=1;index<=5;index++) {
    assert.equal(s.status,'playing'); assert.equal(s.round.index,index); seen.add(s.round.id);
    const wrong = (correct(s.round)+1)%4;
    for(const p of [a,b]) await ctx.request('/api/pk/answer',{code:a.code,roundId:s.round.id,choiceIndex:wrong},p.token);
    s = await state(ctx,a); assert.equal(s.status,'round-result');
    ctx.advance(99); assert.equal((await state(ctx,b)).status,'round-result');
    ctx.advance(1); s=await state(ctx,a);
  }
  assert.equal(seen.size,5); assert.equal(s.status,'finished');
  assert.deepEqual(s.winnerIds.sort(),[a.playerId,b.playerId].sort());
  assert.deepEqual(s.players.map(p=>p.score),[0,0]); assert.ok(s.players.every(p=>!p.ready));
});
test('rematch needs both peers and resets scores, winners and round IDs only at restart', async t => {
  const ctx = await start(t,{roundMs:1000,resultMs:100}); const {a,b}=await pair(ctx); let s=await ready(ctx,a,b);
  assert.equal((await ctx.request('/api/pk/rematch',{code:a.code},a.token)).status,409);
  for(let i=0;i<5;i++) {
    const body={code:a.code,roundId:s.round.id,choiceIndex:correct(s.round)};
    await ctx.request('/api/pk/answer',body,a.token);
    await ctx.request('/api/pk/answer',{...body,choiceIndex:(body.choiceIndex+1)%4},b.token);
    ctx.advance(100); s=await state(ctx,a);
  }
  assert.equal(s.status,'finished'); assert.deepEqual(s.winnerIds,[a.playerId]); assert.equal(s.players[0].score,750);
  const oldId=s.round.id;
  const first=(await ctx.request('/api/pk/rematch',{code:a.code},a.token)).data.state;
  assert.equal(first.status,'finished'); assert.equal(first.players[0].score,750); assert.equal(first.players[0].ready,true);
  const second=(await ctx.request('/api/pk/rematch',{code:a.code},b.token)).data.state;
  assert.equal(second.status,'playing'); assert.equal(second.round.index,1); assert.notEqual(second.round.id,oldId);
  assert.deepEqual(second.players.map(p=>p.score),[0,0]); assert.deepEqual(second.winnerIds,[]);
});
test('missing GET heartbeat after 20 seconds marks disconnected and aborts without phantom winner', async t => {
  const ctx=await start(t); const {a,b}=await pair(ctx); await ready(ctx,a,b);
  ctx.advance(10000); await state(ctx,a); ctx.advance(10001);
  const s=await state(ctx,a);
  assert.equal(s.status,'waiting'); assert.equal(s.round,null); assert.deepEqual(s.winnerIds,[]);
  assert.equal(s.players.find(p=>p.id===b.playerId).connected,false);
  assert.equal(s.players.find(p=>p.id===a.playerId).connected,true);
  assert.ok(s.players.every(p=>!p.ready && p.score===0));
  const reconnected=await state(ctx,b); assert.ok(reconnected.players.every(p=>p.connected));
  assert.equal(reconnected.status,'waiting'); assert.equal((await ready(ctx,a,b)).status,'playing');
});
test('leave removes the real player, revokes token and clears game without awarding win', async t => {
  const ctx=await start(t); const {a,b}=await pair(ctx); await ready(ctx,a,b);
  const left=await ctx.request('/api/pk/leave',{code:a.code},a.token);
  assert.equal(left.status,200); assert.deepEqual(left.data,{left:true});
  assert.equal((await ctx.request(`/api/pk/state?code=${a.code}`,undefined,a.token)).status,401);
  const s=await state(ctx,b); assert.equal(s.players.length,1); assert.equal(s.status,'waiting'); assert.deepEqual(s.winnerIds,[]); assert.equal(s.round,null);
  await ctx.request('/api/pk/leave',{code:b.code},b.token);
  assert.deepEqual((await ctx.request('/api/pk/health')).data,{ok:true,mode:'live',rooms:0,players:0});
});
test('position validates finite bounded world coordinates and known zones without touching scores', async t => {
  const ctx=await start(t); const {a}=await pair(ctx);
  for(const zoneId of ['living','innovation','culture','nature','connection']) {
    const r=await ctx.request('/api/pk/position',{code:a.code,x:12,y:1788,zoneId,score:99999},a.token);
    assert.equal(r.status,200); const p=r.data.state.players.find(p=>p.id===a.playerId);
    assert.deepEqual([p.x,p.y,p.zoneId,p.score],[12,1788,zoneId,0]);
  }
  assert.equal((await ctx.request('/api/pk/position',{code:a.code,x:2988,y:12,zoneId:'living'},a.token)).status,200);
  for(const bad of [{x:11},{x:2989},{y:11},{y:1789},{x:null},{x:'100'},{zoneId:'unknown'}]) {
    assert.equal((await ctx.request('/api/pk/position',{code:a.code,x:100,y:100,zoneId:'living',...bad},a.token)).status,400);
  }
  assert.equal((await ctx.request('/api/pk/position',undefined,a.token,{raw:`{"code":"${a.code}","x":1e400,"y":100,"zoneId":"living"}`})).status,400);
  assert.equal((await ctx.request('/api/pk/position',{code:a.code,x:20,y:20,zoneId:'living'},'wrong')).status,401);
});
test('nickname is short plaintext with default guest and rejects emails or phone numbers', async t => {
  const ctx=await start(t);
  for(const nickname of ['john@x.co','0912345678','０９１２３４５６７８','1234567890123','line\nname',42]) {
    assert.equal((await ctx.request('/api/pk/create',{nickname})).status,400);
  }
  const literal=(await ctx.request('/api/pk/create',{nickname:'<b>訪客</b>'})).data;
  assert.equal(literal.state.players[0].nickname,'<b>訪客</b>');
  const twelve=(await ctx.request('/api/pk/create',{nickname:'甲'.repeat(12)})).data;
  assert.equal(twelve.state.players[0].nickname.length,12);
  assert.equal((await ctx.request('/api/pk/match',{nickname:'a@b.co'})).status,400);
  assert.equal((await ctx.request('/api/pk/join',{code:literal.code,nickname:'0912345678'})).status,400);
});
test('JSON mutations reject unsupported media types, invalid bodies and over 4096 bytes', async t => {
  const ctx=await start(t);
  assert.equal((await ctx.request('/api/pk/create',{},undefined,{headers:{'content-type':'text/plain'}})).status,415);
  assert.equal((await ctx.request('/api/pk/create',{},undefined,{headers:{'content-type':'application/jsonp'}})).status,415);
  for(const raw of ['{','null','[]','42','"text"']) assert.equal((await ctx.request('/api/pk/create',undefined,undefined,{raw})).status,400);
  assert.equal((await ctx.request('/api/pk/create',undefined,undefined,{raw:JSON.stringify({padding:'x'.repeat(4090)})})).status,413);
  assert.equal((await ctx.request('/api/pk/create',undefined,undefined,{raw:JSON.stringify({padding:'台'.repeat(1500)})})).status,413);
  assert.equal((await ctx.request('/api/pk/create',{},undefined,{headers:{'content-type':'application/json; charset=utf-8'}})).status,200);
  assert.equal((await ctx.request('/api/pk/health')).data.rooms,1);
});
test('foreign-origin mutations are rejected without CORS while same-origin and no-origin work', async t => {
  const ctx=await start(t,{hostOrigin:'https://city.example'});
  const foreign={headers:{origin:'https://evil.example'}};
  for(const route of ['create','join','match','ready','answer','position','leave','rematch']) assert.equal((await ctx.request(`/api/pk/${route}`,{},undefined,foreign)).status,403);
  const r=await ctx.request('/api/pk/create',{},undefined,{headers:{origin:'https://city.example'}});
  assert.equal(r.status,200); assert.equal(r.headers['access-control-allow-origin'],undefined);
  assert.equal((await ctx.request('/api/pk/create',{})).status,200);
  assert.equal((await ctx.request('/api/pk/create',{},undefined,{headers:{origin:'null'}})).status,403);
  assert.equal((await ctx.request('/api/pk/create',undefined,undefined,{method:'OPTIONS',headers:{origin:'https://evil.example'}})).status,404);
});
test('room TTL cleanup frees bounded capacity and expires bearer sessions', async t => {
  const ctx=await start(t,{roomTtlMs:1000,maxRooms:2});
  const a=(await ctx.request('/api/pk/create',{})).data;
  await ctx.request('/api/pk/create',{});
  assert.equal((await ctx.request('/api/pk/create',{})).status,503);
  assert.equal((await ctx.request('/api/pk/health')).data.rooms,2);
  ctx.advance(1000);
  assert.deepEqual((await ctx.request('/api/pk/health')).data,{ok:true,mode:'live',rooms:0,players:0});
  assert.equal((await ctx.request(`/api/pk/state?code=${a.code}`,undefined,a.token)).status,404);
  assert.equal((await ctx.request('/api/pk/create',{})).status,200);
});
test('600 requests per minute permit two clients polling then rate-limit even spoofed forwarding headers', async t => {
  const ctx=await start(t);
  for(let i=0;i<600;i++) {
    const r=await ctx.request('/api/pk/health',undefined,undefined,{headers:{'x-forwarded-for':`198.51.100.${i%250+1}`}});
    assert.equal(r.status,200,`request ${i+1} must fit legitimate same-IP budget`);
  }
  const blocked=await ctx.request('/api/pk/health'); assert.equal(blocked.status,429); assert.ok(Number(blocked.headers['retry-after'])>0);
  ctx.advance(60000); assert.equal((await ctx.request('/api/pk/health')).status,200);
});
test('trusted-proxy rate identities are opt-in and bucket map expires after bounded capacity', async t => {
  const ctx=await start(t,{trustProxy:true});
  for(let i=0;i<2048;i++) {
    const ip=`10.0.${Math.floor(i/256)}.${i%256}`;
    assert.equal((await ctx.request('/api/pk/health',undefined,undefined,{headers:{'x-forwarded-for':ip}})).status,200);
  }
  assert.equal((await ctx.request('/api/pk/health',undefined,undefined,{headers:{'x-forwarded-for':'10.99.0.1'}})).status,429);
  ctx.advance(60000);
  assert.equal((await ctx.request('/api/pk/health',undefined,undefined,{headers:{'x-forwarded-for':'10.99.0.1'}})).status,200);
});
test('server rejects invalid banks/configuration and default catalog loading fails closed when missing', t => {
  for(const questionBank of [[],null,[{}],Array(5).fill({question:'x',choices:['a','b','c','d'],correctIndex:9})]) assert.throws(()=>api().createPkServer({questionBank}));
  for(const options of [{maxRooms:101},{maxRooms:0},{roundMs:0},{roomTtlMs:Infinity},{resultMs:-1},{now:42},{hostOrigin:'garbage'}]) assert.throws(()=>api().createPkServer({questionBank:bank(),...options}));
  const temp=fs.mkdtempSync(path.join(process.env.TMPDIR||require('node:os').tmpdir(),'pk-missing-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  fs.mkdirSync(path.join(temp,'server')); const copy=path.join(temp,'server/pk-server.cjs'); fs.copyFileSync(modulePath,copy);
  assert.throws(()=>require(copy).createPkServer(),/ENOENT/);
  fs.mkdirSync(path.join(temp,'public')); fs.writeFileSync(path.join(temp,'public/policy-catalog.json'),'{}');
  assert.throws(()=>require(copy).createPkServer(),/catalog/);
});
test('optional staticDir serves only explicit public allowlist and denies traversal, dotfiles, tests and symlinks', async t => {
  const temp=fs.mkdtempSync(path.join(process.env.TMPDIR||require('node:os').tmpdir(),'pk-static-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  for(const file of ['index.html','taichung-elements.js','world.css','pk.css','pk.js','policy-catalog.json','app.js','engine.js','style.css','quest-core.js','quest.js','quest.css','robots.txt','knowledge.json','.env','secret.txt','tests.cjs']) fs.writeFileSync(path.join(temp,file),`fixture:${file}`);
  fs.symlinkSync(path.join(temp,'secret.txt'),path.join(temp,'icon.svg'));
  const ctx=await start(t,{staticDir:temp});
  for(const route of ['/','/taichung-elements.js','/world.css','/pk.css','/pk.js','/policy-catalog.json','/app.js','/engine.js','/style.css','/quest-core.js','/quest.js','/quest.css','/robots.txt','/knowledge.json']) {
    const r=await ctx.request(route); assert.equal(r.status,200,route); assert.match(r.data,/^fixture:/); assert.equal(r.headers['x-content-type-options'],'nosniff');
  }
  for(const route of ['/.env','/secret.txt','/tests.cjs','/icon.svg','/tests/pk-server.test.cjs','/server/pk-server.cjs','/../index.html','/%2e%2e/index.html','/nested/../index.html','//index.html','/index.html%00']) assert.equal((await ctx.request(route)).status,404,route);
  assert.equal((await ctx.request('/pk.js',undefined,undefined,{method:'HEAD'})).status,200);
  const apiOnly=await start(t); assert.equal((await apiOnly.request('/')).status,404);
});
test('CLI process binds HOST/PORT using source catalog and exposes API only without request logs', async t => {
  const temp=fs.mkdtempSync(path.join(process.env.TMPDIR||require('node:os').tmpdir(),'pk-cli-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  fs.mkdirSync(path.join(temp,'server')); fs.mkdirSync(path.join(temp,'public'));
  fs.copyFileSync(modulePath,path.join(temp,'server/pk-server.cjs'));
  fs.writeFileSync(path.join(temp,'public/policy-catalog.json'),JSON.stringify(catalog()));
  fs.writeFileSync(path.join(temp,'public/index.html'),'must not serve');
  const probe=http.createServer(); await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port; await new Promise(resolve=>probe.close(resolve));
  const child=spawn(process.execPath,[path.join(temp,'server/pk-server.cjs')],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let output=''; child.stdout.on('data',x=>output+=x); child.stderr.on('data',x=>output+=x);
  t.after(async()=>{if(child.exitCode===null && child.signalCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('close',resolve));}});
  function get(route) {return new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,path:route},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);});}
  let response;
  for(let i=0;i<100;i++) {
    try {response=await get('/api/pk/health');break;}catch{if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,20));}
  }
  assert.ok(response,'CLI must keep a real HTTP server running');
  assert.deepEqual(JSON.parse(response.text),{ok:true,mode:'live',rooms:0,players:0});
  assert.equal((await get('/')).status,404);
  assert.deepEqual(JSON.parse(output.trim()),{ok:true,mode:'live',port});
  assert.equal(output.trim().split('\n').length,1,'only one startup health line, never request logs');
});
test('static invitation room query works while URL token transport remains forbidden', async t => {
  const ctx=await start(t,{staticDir:path.resolve(__dirname,'../public')});
  assert.equal((await ctx.request('/?room=ABCDEF')).status,200);
  assert.equal((await ctx.request('/?token=secret')).status,400);
  assert.equal((await ctx.request('/api/pk/health?room=ABCDEF')).status,400);
});
test('a join body finishing after room TTL cannot revive an expired room', async t => {
  const ctx=await start(t,{roomTtlMs:1000}); const a=(await ctx.request('/api/pk/create',{})).data;
  const result=await new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:ctx.port,path:'/api/pk/join',method:'POST',headers:{'content-type':'application/json','transfer-encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject); req.flushHeaders(); req.write('{"code":');
    // Finish the entity only after the request handler has started reading it.
    setTimeout(()=>{ctx.advance(1000);req.end(`"${a.code}"}`);},20);
  });
  assert.equal(result,404); assert.equal((await ctx.request('/api/pk/health')).data.rooms,0);
});
test('errors expose safe machine codes understood by the public client', async t => {
  const ctx=await start(t); const {a}=await pair(ctx);
  assert.equal((await ctx.request('/api/pk/join',{code:a.code})).data.error,'room_full');
  assert.equal((await ctx.request('/api/pk/join',{code:'000000'})).data.error,'room_not_found');
  assert.equal((await ctx.request(`/api/pk/state?code=${a.code}`,undefined,'wrong')).data.error,'invalid_token');
  assert.equal((await ctx.request('/api/pk/create',{nickname:'a@b.co'})).data.error,'invalid_nickname');
});
test('actual policy catalog audit covers every topic and preserves exact first source details', t => {
  const file=path.resolve(__dirname,'../public/policy-catalog.json');
  if(!fs.existsSync(file)) return t.skip('source catalog not delivered yet; fixture contract tests remain mandatory');
  const source=JSON.parse(fs.readFileSync(file,'utf8')); const questions=api().buildQuestionBank(source);
  assert.ok(questions.length>=15); assert.equal(new Set(questions.map(q=>q.topicId)).size,source.topics.length);
  for(const q of questions){
    const topic=source.topics.find(x=>x.id===q.topicId);
    const pad=topic.pads.find(x=>x.title===q.choices[q.correctIndex]);
    assert.ok(pad); assert.ok(q.explanation.startsWith(pad.details[0])); assert.equal(q.sourceUrl,topic.sourceUrl);
    assert.match(q.explanation,/提供提案.*非已實施/);
  }
  const server=api().createPkServer(); assert.ok(server instanceof http.Server); server.close();
});

// NEXT_TEST

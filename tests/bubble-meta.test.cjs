'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../public/bubble-meta.js');
const Core = require('../public/bubble-core.js');

const ev = (type, extra = {}) => ({ id: Math.random(), type, ...extra });
function run(opts = {}) {
  const r = M.createRun();
  r.startedAt = 0; r.finishedAt = opts.ms ?? 50000; r.balloons = opts.balloons ?? 10; r.cleared = opts.cleared ?? 16; r.selfTraps = opts.selfTraps ?? 0;
  return r;
}
test('levels are well formed: goals within the board, three monotone star specs', () => {
  assert.ok(M.LEVELS.length >= 4);
  const ids = new Set();
  for (const level of M.LEVELS) {
    assert.ok(!ids.has(level.id)); ids.add(level.id);
    assert.ok(level.goal >= 1 && level.goal <= Core.createGame().crates.length, level.id);
    assert.equal(level.stars.length, 3); assert.equal(level.starText.length, 3);
    for (const key of ['maxMs', 'maxBalloons', 'maxSelfTraps']) {
      const vals = level.stars.map(s => s[key]).filter(v => v !== undefined);
      assert.deepEqual(vals, vals.slice().sort((a, b) => b - a), `${level.id} ${key} must tighten`);
    }
  }
  assert.equal(M.CRATES, Core.createGame().crates.length);
});
test('feed counts only this player\'s balloons, cleared streets and self-traps, and starts the clock on the first balloon', () => {
  const r = M.createRun();
  M.feed(r, ev('destroy', { playerId: 'me', topicId: 'robot-city' }), 'me', 500);
  assert.equal(r.startedAt, null); assert.equal(r.cleared, 1);
  M.feed(r, ev('place', { playerId: 'me' }), 'me', 1000);
  M.feed(r, ev('place', { playerId: 'rival' }), 'me', 1100);
  M.feed(r, ev('destroy', { playerId: 'rival', topicId: 'x' }), 'me', 1200);
  M.feed(r, ev('capture', { playerId: 'me', victimId: 'me', points: 0 }), 'me', 1300);
  M.feed(r, ev('capture', { playerId: 'rival', victimId: 'me', points: 1 }), 'me', 1400);
  M.feed(r, ev('capture', { playerId: 'me', victimId: 'rival', points: 1 }), 'me', 1500);
  assert.deepEqual([r.startedAt, r.balloons, r.cleared, r.selfTraps, r.topics], [1000, 1, 1, 1, ['robot-city']]);
  M.feed(r, null, 'me', 1); M.feed(r, 'junk', 'me', 1); M.feed(r, { type: 'place' }, 'me', 1);
  assert.equal(r.balloons, 1);
  M.finish(r, 5000); M.feed(r, ev('place', { playerId: 'me' }), 'me', 6000);
  assert.equal(r.balloons, 1, 'a finished run ignores later events');
  assert.equal(M.elapsedMs(r, 9999), 4000);
});
test('stars: goal needed, each star needs its own spec, and star order is cumulative', () => {
  const clear = M.levelById('clear-all'), water = M.levelById('save-water'), steady = M.levelById('steady'), first = M.levelById('first-drop');
  assert.equal(M.evaluate(clear, run({ cleared: 15 })).stars, 0);
  assert.equal(M.evaluate(clear, run({ ms: 120000 })).stars, 1);
  assert.equal(M.evaluate(clear, run({ ms: 80000 })).stars, 2);
  assert.equal(M.evaluate(clear, run({ ms: 55000 })).stars, 3);
  assert.equal(M.evaluate(water, run({ balloons: 21 })).stars, 0);
  assert.equal(M.evaluate(water, run({ balloons: 20 })).stars, 1);
  assert.equal(M.evaluate(water, run({ balloons: 12 })).stars, 3);
  assert.equal(M.evaluate(steady, run({ selfTraps: 2 })).stars, 1);
  assert.equal(M.evaluate(steady, run({ selfTraps: 1 })).stars, 2);
  assert.equal(M.evaluate(steady, run({ selfTraps: 0, ms: 95000 })).stars, 2);
  assert.equal(M.evaluate(steady, run({ selfTraps: 0, ms: 80000 })).stars, 3);
  assert.equal(M.evaluate(first, run({ cleared: 6, balloons: 7 })).stars, 3);
  assert.equal(M.evaluate(first, run({ cleared: 5 })).done, false);
});
test('daily level is deterministic per date, never the newcomer level, and covers every other level over a year', () => {
  assert.equal(M.dailyLevel('2026-10-27').id, M.dailyLevel('2026-10-27').id);
  const seen = new Set();
  for (let d = 0; d < 365; d++) { const key = M.dateKey(new Date(2026, 0, 1 + d)); const level = M.dailyLevel(key); assert.notEqual(level.id, 'first-drop'); seen.add(level.id); }
  assert.equal(seen.size, M.LEVELS.length - 1);
  assert.equal(M.dailyLevel('not a date').id, 'clear-all');
  assert.equal(M.dateKey(new Date(2026, 8, 5)), '2026-09-05');
});
test('progress keeps the best stars, lights streets only on a finished level, and records the daily once per date', () => {
  const level = M.levelById('clear-all');
  let p = M.emptyProgress();
  const r1 = run({ ms: 120000 }); r1.topics = ['robot-city', 'parenting'];
  p = M.applyResult(p, level, M.evaluate(level, r1), r1, '2026-10-27');
  assert.equal(p.stars['clear-all'], 1); assert.deepEqual(p.lit, ['robot-city', 'parenting']);
  const r2 = run({ ms: 50000 }); r2.topics = ['parenting', 'hakka'];
  p = M.applyResult(p, level, M.evaluate(level, r2), r2, '2026-10-27');
  assert.equal(p.stars['clear-all'], 3); assert.deepEqual(p.lit, ['robot-city', 'parenting', 'hakka']);
  const worse = run({ ms: 130000 });
  p = M.applyResult(p, level, M.evaluate(level, worse), worse, '2026-10-27');
  assert.equal(p.stars['clear-all'], 3, 'a worse replay never lowers the best result');
  const failed = run({ cleared: 5 }); failed.topics = ['ghost'];
  const q = M.applyResult(p, level, M.evaluate(level, failed), failed, '2026-10-27');
  assert.deepEqual(q, p, 'an unfinished run records nothing');
  assert.equal(M.totalStars(p), 3);
  const dailyId = M.dailyLevel('2026-10-27');
  const rd = run({ ms: 50000 }); const dp = M.applyResult(M.emptyProgress(), dailyId, M.evaluate(dailyId, rd), rd, '2026-10-27');
  assert.equal(dp.daily.date, '2026-10-27');
});
test('progress storage fails closed on bad data', () => {
  const good = M.applyResult(M.emptyProgress(), M.levelById('steady'), { done: true, stars: 2 }, Object.assign(M.createRun(), { topics: ['hakka'] }), '2026-10-27');
  assert.deepEqual(M.restore(M.serialize(good)), good);
  const bad = [null, '', 'nope', '{}', '{"v":2}', '{"v":1,"stars":[],"lit":[],"seenCoach":false,"daily":null}', '{"v":1,"stars":{"zzz":1},"lit":[],"seenCoach":false,"daily":null}', '{"v":1,"stars":{"steady":4},"lit":[],"seenCoach":false,"daily":null}', '{"v":1,"stars":{},"lit":[1],"seenCoach":false,"daily":null}', '{"v":1,"stars":{},"lit":[],"seenCoach":"yes","daily":null}', '{"v":1,"stars":{},"lit":[],"seenCoach":false,"daily":{"date":"x","stars":1}}', '{"v":1,"stars":{},"lit":["x"],"seenCoach":false,"daily":null}'];
  for (const raw of bad) assert.equal(M.restore(raw, ['hakka']), null, String(raw));
});
test('share text has no names or room codes and no endorsement words', () => {
  const level = M.levelById('clear-all'); const r = run({ ms: 50000 }); const result = M.evaluate(level, r);
  const text = M.shareText(level, result, r, '2026-10-27');
  assert.match(text, /泡泡 PK「清光街區」 ★★★/);
  for (const word of ['投票', '支持', '推薦', '贊成', '拉票', '選我']) assert.equal(text.includes(word), false);
  assert.doesNotMatch(text, /[A-F0-9]{6}/);
});
test('the meta layer is pure: no DOM, network or storage access in the module itself', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/bubble-meta.js'), 'utf8');
  assert.doesNotMatch(source, /document\.|window\.|localStorage|fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
});
test('challenge UI sends nothing itself and the page loads meta before play and ui after', () => {
  const ui = fs.readFileSync(path.join(__dirname, '../public/bubble-ui.js'), 'utf8');
  assert.doesNotMatch(ui, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|innerHTML/);
  const html = fs.readFileSync(path.join(__dirname, '../public/bubble.html'), 'utf8');
  const at = name => html.indexOf('/' + name + '"');
  assert.ok(at('bubble-core.js') > 0 && at('bubble-meta.js') > at('bubble-core.js') && at('play.js') > at('bubble-meta.js') && at('bubble-ui.js') > at('play.js'));
  assert.match(html, /bubble-ui\.css/);
});
test('static server allows the new bubble assets', async () => {
  const { createPlayServer } = require('../server/play-server.cjs');
  const server = createPlayServer({ staticDir: path.join(__dirname, '../public') });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    for (const name of ['bubble-meta.js', 'bubble-ui.js', 'bubble-ui.css']) {
      const res = await fetch('http://127.0.0.1:' + server.address().port + '/' + name);
      assert.equal(res.status, 200, name);
    }
  } finally { await (server.closePlay ? server.closePlay() : new Promise(r => server.close(r))); }
});

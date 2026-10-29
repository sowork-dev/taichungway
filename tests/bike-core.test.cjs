'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const B = require('../public/bike-core.js');
const English = require('../public/english-core.js');

const rowsOf = course => { const m = new Map(); for (const i of course) { if (!m.has(i.row)) m.set(i.row, []); m.get(i.row).push(i); } return m; };

test('routes have unique ids and foods that exist in the English word list', () => {
  assert.equal(new Set(B.ROUTES.map(r => r.id)).size, B.ROUTES.length);
  for (const r of B.ROUTES) for (const id of r.foods) assert.ok(English.wordById(id), r.id + ' ' + id);
});
test('courses are deterministic and never block every lane in a row', () => {
  for (const r of B.ROUTES) {
    assert.deepEqual(B.makeCourse('seed', r), B.makeCourse('seed', r));
    for (const [row, items] of rowsOf(B.makeCourse('a-' + r.id, r))) {
      assert.ok(row >= 6 && row < r.length);
      const blocked = new Set(items.filter(i => i.type === 'obstacle').map(i => i.lane));
      assert.ok(blocked.size <= 2, r.id + ' row ' + row);
      for (const f of items.filter(i => i.type === 'food')) assert.equal(blocked.has(f.lane), false, 'food on an obstacle');
    }
  }
});
test('a clean ride always exists: moving at most one lane per row can avoid every obstacle', () => {
  for (const r of B.ROUTES) for (let seed = 1; seed <= 30; seed++) {
    const course = B.makeCourse(seed, r), rows = rowsOf(course);
    let ok = new Set([1]);
    for (let row = 0; row < r.length; row++) {
      const blocked = new Set((rows.get(row) || []).filter(i => i.type === 'obstacle').map(i => i.lane));
      const next = new Set();
      for (const lane of ok) for (const d of [-1, 0, 1]) { const l = lane + d; if (l >= 0 && l < 3 && !blocked.has(l)) next.add(l); }
      ok = next; assert.ok(ok.size > 0, `${r.id} seed ${seed} row ${row} unavoidable`);
    }
  }
});
test('staying in one lane eventually hits something and can fail the ride; steering around finishes it', () => {
  const r = B.ROUTES[3], course = B.makeCourse('x', r), run = B.createRun(r, course);
  for (let t = 0; t < 400 && !run.done && !run.failed; t++) B.step(run, 0.05);
  assert.equal(run.failed, true); assert.equal(run.done, false); assert.equal(B.stars(run), 0);
  // A bot that looks one row ahead and takes the nearest free lane.
  const rows = rowsOf(course), bot = B.createRun(r, course);
  for (let t = 0; t < 4000 && !bot.done && !bot.failed; t++) {
    const ahead = Math.floor(bot.dist) + 1;
    const blocked = new Set((rows.get(ahead) || []).filter(i => i.type === 'obstacle').map(i => i.lane));
    if (blocked.has(bot.lane)) { const options = [bot.lane - 1, bot.lane + 1].filter(l => l >= 0 && l < 3 && !blocked.has(l)); if (options.length) B.setLane(bot, options[0] < bot.lane ? -1 : 1); }
    B.step(bot, 0.05);
  }
  assert.equal(bot.done, true); assert.equal(bot.failed, false); assert.ok(B.stars(bot) >= 1);
});
test('collecting: food in the bike lane is picked up once per kind; hitting an obstacle costs a heart', () => {
  const r = B.ROUTES[0];
  const course = [{ row: 7, lane: 1, type: 'food', wordId: 'tea' }, { row: 8, lane: 1, type: 'food', wordId: 'tea' }, { row: 9, lane: 1, type: 'obstacle', emoji: '🚧' }, { row: 10, lane: 0, type: 'food', wordId: 'mochi' }];
  const run = B.createRun(r, course);
  for (let t = 0; t < 90; t++) B.step(run, 0.05);
  assert.deepEqual(run.collected, ['tea']); assert.equal(run.hits, 1); assert.equal(run.hearts, 2);
  B.setLane(run, -1); B.setLane(run, -1); assert.equal(run.lane, 0);
  B.setLane(run, 1); B.setLane(run, 1); B.setLane(run, 1); assert.equal(run.lane, 2);
});
test('stars: 3 needs no hits and 3/4 of the route foods; at most one hit is 2 stars; more is 1', () => {
  const r = B.ROUTES[0], mk = (hits, collected) => ({ route: r, course: [], done: true, hits, collected });
  assert.equal(B.stars(mk(0, ['bubbletea', 'tea', 'mochi'])), 3);
  assert.equal(B.stars(mk(0, ['tea'])), 2);
  assert.equal(B.stars(mk(1, ['bubbletea', 'tea', 'mochi', 'sweetpotato'])), 2);
  assert.equal(B.stars(mk(2, [])), 1);
  assert.equal(B.stars({ ...mk(0, []), done: false }), 0);
});
test('progress: best stars per route, collected foods, fail-closed restore', () => {
  const r = B.ROUTES[0];
  const finished = { route: r, course: [], done: true, hits: 0, collected: ['tea', 'mochi', 'bubbletea'] };
  let p = B.applyResult(B.emptyProgress(), finished);
  assert.equal(p.stars.greenway, 3); assert.deepEqual(p.foods, ['tea', 'mochi', 'bubbletea']);
  p = B.applyResult(p, { ...finished, hits: 3, collected: ['tea'] });
  assert.equal(p.stars.greenway, 3);
  assert.deepEqual(B.restore(B.serialize(p)), p);
  for (const bad of [null, '', 'x', '{}', JSON.stringify({ ...p, v: 2 }), JSON.stringify({ ...p, stars: { nope: 1 } }), JSON.stringify({ ...p, stars: { greenway: 4 } }), JSON.stringify({ ...p, foods: [1] })]) assert.equal(B.restore(bad), null, String(bad));
  assert.equal(B.applyResult(B.emptyProgress(), { ...finished, done: false }).foods.length, 0);
});
test('share text has no names or codes; the core is pure', () => {
  const r = B.ROUTES[1];
  const text = B.shareText({ route: r, course: [], done: true, hits: 0, collected: ['porkrice', 'noodles', 'riceball'] });
  assert.match(text, /單車逛台中「后豐鐵馬道」 ★★★/);
  const source = fs.readFileSync(path.join(__dirname, '../public/bike-core.js'), 'utf8');
  assert.doesNotMatch(source, /document\.|window\.|localStorage|fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
});
test('static server serves the bike page and files; the page loads the cores before the ui; the ui sends nothing', async () => {
  const { createPlayServer } = require('../server/play-server.cjs');
  const server = createPlayServer({ staticDir: path.join(__dirname, '../public') });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    for (const name of ['bike.html', 'bike.js', 'bike.css', 'bike-core.js']) {
      const res = await fetch('http://127.0.0.1:' + server.address().port + '/' + name);
      assert.equal(res.status, 200, name);
    }
  } finally { await (server.closePlay ? server.closePlay() : new Promise(r => server.close(r))); }
  const html = fs.readFileSync(path.join(__dirname, '../public/bike.html'), 'utf8');
  assert.ok(html.indexOf('/bike-core.js') > 0 && html.indexOf('/bike.js"') > html.indexOf('/bike-core.js') && html.indexOf('/english-core.js') > 0);
  const ui = fs.readFileSync(path.join(__dirname, '../public/bike.js'), 'utf8');
  assert.doesNotMatch(ui, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|innerHTML/);
});

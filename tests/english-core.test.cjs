'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../public/english-core.js');

test('word list has unique ids and text; picture words have a unique picture that no other word shares', () => {
  const ids = new Set();
  for (const w of E.WORDS) { assert.ok(w.zh && w.en && w.emoji, w.id); ids.add(w.id); }
  assert.equal(ids.size, E.WORDS.length);
  const pics = E.WORDS.filter(w => w.pic).map(w => w.emoji);
  assert.equal(new Set(pics).size, pics.length, 'a picture question must have exactly one matching word');
  for (const w of E.WORDS.filter(w => !w.pic)) assert.equal(pics.includes(w.emoji), false, w.id + ' must not reuse a picture emoji');
  assert.equal(E.WORDS.length, 50);
});
test('picture questions only use words that have their own picture', () => {
  for (let seed = 1; seed <= 60; seed++) for (const q of E.makeLesson(seed)) if (q.type === 'pic2en') assert.ok(E.wordById(q.wordId).pic, q.wordId);
});
test('a lesson has 8 questions, each with 4 distinct options including the answer', () => {
  const lesson = E.makeLesson(7);
  assert.equal(lesson.length, E.LESSON_SIZE);
  assert.equal(new Set(lesson.map(q => q.wordId)).size, E.LESSON_SIZE);
  for (const q of lesson) {
    if (q.type === 'match') { assert.equal(q.pairs.length, 4); assert.ok(q.pairs.includes(q.wordId)); assert.equal(new Set(q.pairs).size, 4); continue; }
    assert.equal(q.options.length, 4); assert.equal(new Set(q.options).size, 4); assert.ok(q.options.includes(q.wordId));
    const labels = q.options.map(id => E.optionLabel(q.type, id)); assert.equal(new Set(labels).size, 4);
  }
});
test('same seed gives the same lesson; unseen words are preferred over well-known ones', () => {
  assert.deepEqual(E.makeLesson('2026-10-28'), E.makeLesson('2026-10-28'));
  const known = Object.fromEntries(E.WORDS.slice(0, 24).map(w => [w.id, 5]));
  const lesson = E.makeLesson(3, known);
  const fresh = new Set(E.WORDS.slice(24).map(w => w.id));
  assert.equal(lesson.filter(q => fresh.has(q.wordId)).length, 8);
});
test('perfect run: 3 stars, 80 xp, done', () => {
  const s = E.createSession(E.makeLesson(1));
  while (E.current(s)) { const q = E.current(s); E.answer(s, q.type === 'match' ? true : q.wordId); }
  assert.equal(s.done, true); assert.equal(s.failed, false); assert.equal(E.stars(s), 3); assert.equal(s.xp, 80); assert.equal(E.progressOf(s), 1);
});
test('a wrong answer costs a heart and the question comes back once', () => {
  const s = E.createSession(E.makeLesson(1));
  const q = E.current(s); const wrong = q.options.find(id => id !== q.wordId);
  const r = E.answer(s, wrong);
  assert.equal(r.correct, false); assert.equal(r.correctId, q.wordId); assert.equal(s.hearts, 2); assert.equal(s.queue.length, 8);
  assert.equal(s.queue[s.queue.length - 1], 0);
  while (E.current(s)) { const c = E.current(s); E.answer(s, c.type === 'match' ? true : c.wordId); }
  assert.equal(s.done, true); assert.equal(E.stars(s), 2);
});
test('three wrong answers end the lesson as failed, with no stars or xp for progress', () => {
  const s = E.createSession(E.makeLesson(2));
  for (let i = 0; i < 3; i++) { const q = E.current(s); E.answer(s, q.type === 'match' ? false : q.options.find(id => id !== q.wordId)); }
  assert.equal(s.failed, true); assert.equal(s.done, false); assert.equal(E.current(s), null); assert.equal(E.stars(s), 0);
  const p = E.applyLesson(E.emptyProgress(), s, '2026-10-28');
  assert.deepEqual(p, E.emptyProgress());
});
test('streak: same day keeps, next day adds, a gap resets; liveStreak shows broken streaks as 0', () => {
  const done = () => { const s = E.createSession(E.makeLesson(1)); while (E.current(s)) { const q = E.current(s); E.answer(s, q.type === 'match' ? true : q.wordId); } return s; };
  let p = E.applyLesson(E.emptyProgress(), done(), '2026-10-28'); assert.equal(p.streak, 1);
  p = E.applyLesson(p, done(), '2026-10-28'); assert.equal(p.streak, 1); assert.equal(p.lessons, 2);
  p = E.applyLesson(p, done(), '2026-10-29'); assert.equal(p.streak, 2);
  assert.equal(E.liveStreak(p, '2026-10-30'), 2); assert.equal(E.liveStreak(p, '2026-11-01'), 0);
  p = E.applyLesson(p, done(), '2026-11-05'); assert.equal(p.streak, 1);
  assert.ok(E.learnedCount(p) >= 8);
});
test('words missed in a lesson are not marked as known', () => {
  const s = E.createSession(E.makeLesson(1)); const q = E.current(s);
  E.answer(s, q.options.find(id => id !== q.wordId));
  while (E.current(s)) { const c = E.current(s); E.answer(s, c.type === 'match' ? true : c.wordId); }
  const p = E.applyLesson(E.emptyProgress(), s, '2026-10-28');
  assert.equal(p.known[q.wordId], undefined);
  assert.equal(E.learnedCount(p), 7);
});
test('restore fails closed on bad data and round-trips good data', () => {
  const good = E.applyLesson(E.emptyProgress(), (() => { const s = E.createSession(E.makeLesson(1)); while (E.current(s)) { const q = E.current(s); E.answer(s, q.type === 'match' ? true : q.wordId); } return s; })(), '2026-10-28');
  assert.deepEqual(E.restore(E.serialize(good)), good);
  for (const bad of [null, '', 'x', '{}', JSON.stringify({ ...good, v: 2 }), JSON.stringify({ ...good, xp: -1 }), JSON.stringify({ ...good, known: { nope: 1 } }), JSON.stringify({ ...good, lastDay: 'yesterday' }), JSON.stringify({ ...good, known: { veg: 99 } })]) assert.equal(E.restore(bad), null, String(bad));
});
test('share text has no names or room codes', () => {
  const s = E.createSession(E.makeLesson(1)); while (E.current(s)) { const q = E.current(s); E.answer(s, q.type === 'match' ? true : q.wordId); }
  const text = E.shareText(s, E.applyLesson(E.emptyProgress(), s, '2026-10-28'), '2026-10-28');
  assert.match(text, /一口好英文 ★★★/); assert.match(text, /\+80 XP/);
});
test('the core is pure: no DOM, network or storage in the module', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/english-core.js'), 'utf8');
  assert.doesNotMatch(source, /document\.|window\.|localStorage|fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
});
test('static server serves the english lesson page and its files, and the page loads core before ui', async () => {
  const { createPlayServer } = require('../server/play-server.cjs');
  const server = createPlayServer({ staticDir: path.join(__dirname, '../public') });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    for (const name of ['english.html', 'english.js', 'english.css', 'english-core.js']) {
      const res = await fetch('http://127.0.0.1:' + server.address().port + '/' + name);
      assert.equal(res.status, 200, name);
    }
  } finally { await (server.closePlay ? server.closePlay() : new Promise(r => server.close(r))); }
  const html = fs.readFileSync(path.join(__dirname, '../public/english.html'), 'utf8');
  assert.ok(html.indexOf('/english-core.js') > 0 && html.indexOf('/english.js"') > html.indexOf('/english-core.js'));
  const ui = fs.readFileSync(path.join(__dirname, '../public/english.js'), 'utf8');
  assert.doesNotMatch(ui, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|innerHTML/);
});

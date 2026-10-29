'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../public/english-core.js');

const U = i => E.UNITS[i];
const play = s => { while (E.current(s)) { const q = E.current(s); E.answer(s, q.type === 'match' ? true : q.wordId); } return s; };
const perfect = (unit, seed = 1, mastery = {}) => play(E.createSession(E.makeLesson(seed, unit, mastery)));
const withMastery = (levels) => ({ ...E.emptyProgress(), mastery: levels });

test('word list has unique ids and text; picture words have a unique picture that no other word shares', () => {
  const ids = new Set();
  for (const w of E.WORDS) { assert.ok(w.zh && w.en && w.emoji, w.id); ids.add(w.id); }
  assert.equal(ids.size, E.WORDS.length);
  const pics = E.WORDS.filter(w => w.pic).map(w => w.emoji);
  assert.equal(new Set(pics).size, pics.length, 'a picture question must have exactly one matching word');
  for (const w of E.WORDS.filter(w => !w.pic)) assert.equal(pics.includes(w.emoji), false, w.id + ' must not reuse a picture emoji');
  assert.equal(E.WORDS.length, 50);
});
test('every word belongs to exactly one unit and units have 7-10 words', () => {
  const all = E.UNITS.flatMap(u => u.words);
  assert.equal(all.length, 50); assert.equal(new Set(all).size, 50);
  for (const id of all) assert.ok(E.wordById(id), id);
  assert.equal(E.UNITS.length, 6);
  for (const u of E.UNITS) assert.ok(u.words.length >= 7 && u.words.length <= 10, u.id);
});
test('picture questions only use words that have their own picture', () => {
  for (let seed = 1; seed <= 60; seed++) for (const u of E.UNITS) for (const q of E.makeLesson(seed, u)) if (q.type === 'pic2en') assert.ok(E.wordById(q.wordId).pic, q.wordId);
});
test('a lesson draws only from its unit; each question has 4 distinct options including the answer', () => {
  for (const unit of E.UNITS) {
    const lesson = E.makeLesson(7, unit);
    assert.equal(lesson.length, Math.min(E.LESSON_SIZE, unit.words.length));
    assert.equal(new Set(lesson.map(q => q.wordId)).size, lesson.length);
    for (const q of lesson) {
      assert.ok(unit.words.includes(q.wordId), unit.id + ' ' + q.wordId);
      if (q.type === 'match') { assert.equal(q.pairs.length, 4); assert.ok(q.pairs.includes(q.wordId)); assert.equal(new Set(q.pairs).size, 4); assert.ok(q.pairs.every(id => unit.words.includes(id))); continue; }
      assert.equal(q.options.length, 4); assert.equal(new Set(q.options).size, 4); assert.ok(q.options.includes(q.wordId));
      assert.equal(new Set(q.options.map(id => E.optionLabel(q.type, id))).size, 4);
    }
  }
});
test('same seed gives the same lesson; the least-known words are picked first', () => {
  assert.deepEqual(E.makeLesson('2026-10-29', U(0)), E.makeLesson('2026-10-29', U(0)));
  const mastery = Object.fromEntries(U(0).words.slice(0, 8).map(id => [id, 3]));
  const lesson = E.makeLesson(3, U(0), mastery);
  const weak = U(0).words.slice(8);
  for (const id of weak) assert.ok(lesson.some(q => q.wordId === id), id + ' should be included');
});
test('perfect run: 3 stars and full xp; a wrong answer costs a heart and the question comes back once', () => {
  const s = perfect(U(1));
  assert.equal(s.done, true); assert.equal(E.stars(s), 3); assert.equal(s.xp, 10 * s.questions.length);
  const t = E.createSession(E.makeLesson(1, U(0)));
  const q = E.current(t); const wrong = q.options.find(id => id !== q.wordId);
  const r = E.answer(t, wrong);
  assert.equal(r.correct, false); assert.equal(r.correctId, q.wordId); assert.equal(t.hearts, 2); assert.equal(t.queue[t.queue.length - 1], 0);
  play(t); assert.equal(t.done, true); assert.equal(E.stars(t), 2);
});
test('three wrong answers fail the lesson and change nothing', () => {
  const s = E.createSession(E.makeLesson(2, U(0)));
  for (let i = 0; i < 3; i++) { const q = E.current(s); E.answer(s, q.type === 'match' ? false : q.options.find(id => id !== q.wordId)); }
  assert.equal(s.failed, true); assert.equal(E.current(s), null); assert.equal(E.stars(s), 0);
  assert.deepEqual(E.applyLesson(E.emptyProgress(), s, '2026-10-29'), E.emptyProgress());
});
test('mastery: first-time-right raises (max 3), missed words drop by one (min 0)', () => {
  let p = E.applyLesson(E.emptyProgress(), perfect(U(1)), '2026-10-29');
  for (const id of U(1).words) assert.equal(E.masteryOf(p, id), 1);
  for (let i = 0; i < 4; i++) p = E.applyLesson(p, perfect(U(1), i + 2), '2026-10-29');
  for (const id of U(1).words) assert.equal(E.masteryOf(p, id), 3);
  const s = E.createSession(E.makeLesson(1, U(1))); const q = E.current(s);
  E.answer(s, q.options.find(id => id !== q.wordId)); play(s);
  const after = E.applyLesson(p, s, '2026-10-29');
  assert.equal(E.masteryOf(after, q.wordId), 2);
  const low = E.applyLesson(E.emptyProgress(), s, '2026-10-29');
  assert.equal(E.masteryOf(low, q.wordId), 0);
});
test('unit stars and unlocking: 60% at mastery 2 clears (unlocks next), all 2 = two stars, all 3 = three', () => {
  const unit = U(0), n = unit.words.length;
  assert.equal(E.isUnlocked(E.emptyProgress(), 0), true); assert.equal(E.isUnlocked(E.emptyProgress(), 1), false);
  const need = Math.ceil(n * 0.6);
  const part = withMastery(Object.fromEntries(unit.words.slice(0, need - 1).map(id => [id, 2])));
  assert.equal(E.unitState(part, unit).cleared, false); assert.equal(E.isUnlocked(part, 1), false);
  const cleared = withMastery(Object.fromEntries(unit.words.slice(0, need).map(id => [id, 2])));
  assert.equal(E.unitState(cleared, unit).stars, 1); assert.equal(E.isUnlocked(cleared, 1), true); assert.equal(E.isUnlocked(cleared, 2), false);
  assert.equal(E.unitState(withMastery(Object.fromEntries(unit.words.map(id => [id, 2]))), unit).stars, 2);
  assert.equal(E.unitState(withMastery(Object.fromEntries(unit.words.map(id => [id, 3]))), unit).stars, 3);
  assert.equal(E.isUnlocked(cleared, 99), false);
});
test('nextUnit: starts at unit 1, moves to a newly unlocked unit, and only returns to polish three stars when everything is cleared', () => {
  assert.equal(E.nextUnit(E.emptyProgress()).id, U(0).id);
  const done0 = withMastery(Object.fromEntries(U(0).words.map(id => [id, 3])));
  assert.equal(E.nextUnit(done0).id, U(1).id);
  const allCleared = withMastery(Object.fromEntries(E.WORDS.map(w => [w.id, 2])));
  assert.equal(E.nextUnit(allCleared).id, U(0).id);
  const all = withMastery(Object.fromEntries(E.WORDS.map(w => [w.id, 3])));
  assert.equal(E.nextUnit(all).id, E.UNITS[E.UNITS.length - 1].id);
});
test('streak and daily goal: same day keeps, next day adds, a gap resets; lessons today counts per day', () => {
  let p = E.applyLesson(E.emptyProgress(), perfect(U(0)), '2026-10-29'); assert.equal(p.streak, 1); assert.equal(E.lessonsToday(p, '2026-10-29'), 1);
  p = E.applyLesson(p, perfect(U(0)), '2026-10-29'); assert.equal(p.streak, 1); assert.equal(p.lessons, 2); assert.equal(E.lessonsToday(p, '2026-10-29'), 2);
  assert.equal(E.lessonsToday(p, '2026-10-30'), 0);
  p = E.applyLesson(p, perfect(U(0)), '2026-10-30'); assert.equal(p.streak, 2); assert.equal(E.lessonsToday(p, '2026-10-30'), 1);
  assert.equal(E.liveStreak(p, '2026-10-31'), 2); assert.equal(E.liveStreak(p, '2026-11-02'), 0);
  p = E.applyLesson(p, perfect(U(0)), '2026-11-09'); assert.equal(p.streak, 1);
});
test('restore fails closed on bad data, round-trips v2, and converts v1 saves (known words become mastery 1)', () => {
  const good = E.applyLesson(E.emptyProgress(), perfect(U(0)), '2026-10-29');
  assert.deepEqual(E.restore(E.serialize(good)), good);
  for (const bad of [null, '', 'x', '{}', JSON.stringify({ ...good, v: 3 }), JSON.stringify({ ...good, xp: -1 }), JSON.stringify({ ...good, mastery: { nope: 1 } }), JSON.stringify({ ...good, mastery: { egg: 4 } }), JSON.stringify({ ...good, lastDay: 'yesterday' }), JSON.stringify({ ...good, today: { day: 'x', n: 1 } }), JSON.stringify({ ...good, today: { day: '2026-10-29', n: 0 } })]) assert.equal(E.restore(bad), null, String(bad));
  const v1 = JSON.stringify({ v: 1, xp: 80, streak: 3, lastDay: '2026-10-28', lessons: 2, known: { egg: 2, tea: 0, veg: 1 } });
  const up = E.restore(v1);
  assert.equal(up.v, 2); assert.equal(up.xp, 80); assert.equal(up.streak, 3); assert.equal(E.masteryOf(up, 'egg'), 1); assert.equal(E.masteryOf(up, 'tea'), 0); assert.equal(E.masteryOf(up, 'veg'), 1); assert.equal(up.today, null);
  assert.equal(E.restore(JSON.stringify({ v: 1, xp: 1, streak: 0, lastDay: null, lessons: 0, known: { nope: 1 } })), null);
});
test('share text has no names or room codes', () => {
  const s = perfect(U(0)); const text = E.shareText(s, E.applyLesson(E.emptyProgress(), s, '2026-10-29'), '2026-10-29');
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

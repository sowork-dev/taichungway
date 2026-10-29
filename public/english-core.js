/* Taichung food English: lesson logic in the Duolingo style (one question per screen, 3 hearts, wrong answers come back).
 * Pure functions: no DOM, no network, no storage. Words are everyday food/market vocabulary; no policy content. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EnglishCore = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // [id, emoji, zh, en]. Common English names used on menus and in travel guides.
  const WORDS = Object.freeze([
    ['veg', '🥬', '蔬菜', 'vegetables'], ['fish', '🐟', '鮮魚', 'fresh fish'], ['rice', '🍚', '白飯', 'rice'],
    ['tea', '🍵', '茶', 'tea'], ['basket', '🧺', '菜籃', 'shopping basket'], ['coffee', '☕', '咖啡', 'coffee'],
    ['egg', '🥚', '蛋', 'egg'], ['soymilk', '🥛', '豆漿', 'soy milk'], ['riceball', '🍙', '飯糰', 'rice ball'],
    ['soup', '🍲', '熱湯', 'hot soup'], ['bubbletea', '🧋', '珍珠奶茶', 'bubble tea'], ['noodles', '🍜', '牛肉麵', 'beef noodle soup'],
    ['dumpling', '🥟', '水餃', 'dumplings'], ['pineapple', '🍍', '鳳梨', 'pineapple'], ['oyster', '🦪', '蚵仔', 'oyster'],
    ['tofu', '🍽️', '豆花', 'tofu pudding', false], ['porkrice', '🍛', '滷肉飯', 'braised pork rice'], ['cake', '🥮', '太陽餅', 'sun cake'],
    ['fruit', '🍉', '水果', 'fruit'], ['bread', '🍞', '麵包', 'bread'], ['spicy', '🌶️', '辣', 'spicy'],
    ['sweet', '🍬', '甜', 'sweet'], ['hot', '🔥', '燙', 'hot'], ['cold', '🧊', '冰', 'cold'],
    // Taichung specialties. A word without its own unmistakable emoji uses a generic plate and never appears as a picture question.
    ['sausage', '🌭', '大腸包小腸', 'rice sausage roll'], ['shavedice', '🍧', '剉冰', 'shaved ice'], ['popchicken', '🍗', '鹹酥雞', 'popcorn chicken'],
    ['peach', '🍑', '水蜜桃', 'peach'], ['shiitake', '🍄', '香菇', 'shiitake mushroom'],
    ['bawan', '🍽️', '肉圓', 'ba-wan (meat dumpling)', false], ['bamboorice', '🍽️', '筒仔米糕', 'bamboo-tube sticky rice', false],
    ['ribsoup', '🍽️', '排骨酥湯', 'fried pork rib soup', false], ['taropastry', '🍽️', '芋頭酥', 'taro pastry', false],
    ['mochi', '🍽️', '麻糬', 'mochi', false], ['mountaintea', '⛰️', '高山茶', 'high-mountain tea', false],
    ['persimmon', '🍽️', '甜柿', 'sweet persimmon', false], ['lychee', '🍽️', '荔枝', 'lychee', false],
    ['nightmarket', '🌃', '夜市', 'night market', false], ['stall', '🏮', '攤位', 'food stall', false],
    ['taro', '🍽️', '芋頭', 'taro', false], ['icecream', '🍦', '冰淇淋', 'ice cream'], ['apple', '🍎', '蘋果', 'apple'], ['pear', '🍐', '水梨', 'pear'],
    ['tangerine', '🍊', '橘子', 'tangerine'], ['corn', '🌽', '烤玉米', 'grilled corn'], ['sweetpotato', '🍠', '烤地瓜', 'sweet potato'],
    ['scallionpancake', '🥞', '蔥油餅', 'scallion pancake'], ['stinkytofu', '🍽️', '臭豆腐', 'stinky tofu', false],
    ['oysteromelet', '🍽️', '蚵仔煎', 'oyster omelet', false], ['pineapplecake', '🍽️', '鳳梨酥', 'pineapple cake', false]
  ].map(([id, emoji, zh, en, pic]) => Object.freeze({ id, emoji, zh, en, pic: pic !== false })));
  const wordById = id => WORDS.find(w => w.id === id) || null;

  // Small deterministic RNG so tests and daily lessons are reproducible.
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function shuffle(list, rand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function seedFromString(text) { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }

  // Route: 6 themed units (each word belongs to exactly one). docs/english-units.md explains the plan.
  const UNITS = Object.freeze([
    ['breakfast', '早餐桌', '🥞', ['egg', 'soymilk', 'riceball', 'bread', 'scallionpancake', 'tea', 'coffee', 'hot', 'cold', 'mountaintea']],
    ['market', '菜市場', '🧺', ['veg', 'fish', 'rice', 'basket', 'stall', 'taro', 'shiitake', 'tofu']],
    ['nightmarket', '夜市小吃', '🌃', ['nightmarket', 'popchicken', 'stinkytofu', 'oysteromelet', 'bawan', 'sausage', 'corn', 'sweetpotato', 'bubbletea', 'oyster']],
    ['bowls', '湯麵飯', '🍜', ['soup', 'noodles', 'porkrice', 'bamboorice', 'ribsoup', 'dumpling', 'spicy']],
    ['sweets', '甜點', '🥮', ['cake', 'pineapplecake', 'taropastry', 'mochi', 'shavedice', 'icecream', 'sweet']],
    ['fruit', '水果', '🍉', ['fruit', 'pineapple', 'peach', 'persimmon', 'lychee', 'apple', 'pear', 'tangerine']]
  ].map(([id, title, emoji, words]) => Object.freeze({ id, title, emoji, words: Object.freeze(words) })));
  const unitById = id => UNITS.find(u => u.id === id) || null;

  const LESSON_SIZE = 8;
  const MASTERY_MAX = 3;
  /** Builds a lesson from one unit. `mastery` = { wordId: 0..3 }: the least-known words come first. Returns the frozen question list. */
  function makeLesson(seed, unit, mastery = {}) {
    const rand = rng(typeof seed === 'string' ? seedFromString(seed) : seed);
    const pool = (unit ? unit.words.map(wordById) : WORDS).filter(Boolean);
    const order = shuffle(pool, rand).sort((a, b) => (mastery[a.id] || 0) - (mastery[b.id] || 0));
    const picked = order.slice(0, Math.min(LESSON_SIZE, order.length));
    const types = ['pic2en', 'zh2en', 'en2zh', 'pic2en', 'zh2en', 'en2zh', 'pic2en', 'match'];
    const questions = [];
    picked.forEach((word, i) => {
      let type = types[i % types.length];
      if (type === 'pic2en' && !word.pic) type = 'zh2en';
      if (type === 'match') {
        const pairs = shuffle(picked.filter(w => w.id !== word.id), rand).slice(0, 3).concat(word);
        questions.push({ type, wordId: word.id, pairs: shuffle(pairs, rand).map(w => w.id) });
        return;
      }
      const others = WORDS.filter(w => w.id !== word.id);
      const wrong = shuffle(others, rand).slice(0, 3);
      const options = shuffle([word, ...wrong], rand).map(w => w.id);
      questions.push({ type, wordId: word.id, options });
    });
    return Object.freeze(questions);
  }

  /** What the player sees as the answer text for an option id, by question type. */
  function optionLabel(type, id) { const w = wordById(id); return !w ? '' : type === 'en2zh' ? w.zh : w.en; }

  function createSession(questions) {
    return { questions: questions.slice(), queue: questions.map((_, i) => i), hearts: 3, correct: 0, wrong: 0, retries: [], missedIds: [], done: false, failed: false, xp: 0 };
  }
  const current = s => (s.done || s.failed) ? null : s.questions[s.queue[0]];
  /** Answer the current question. `answer` is an option id (choice questions) or true (match: all pairs solved). */
  function answer(s, answer) {
    const q = current(s); if (!q) return null;
    const ok = q.type === 'match' ? answer === true : answer === q.wordId;
    if (ok) { s.correct++; s.xp += 10; s.queue.shift(); }
    else {
      s.wrong++; s.hearts--; if (!s.missedIds.includes(q.wordId)) s.missedIds.push(q.wordId);
      const idx = s.queue.shift(); if (s.retries.indexOf(idx) === -1) { s.queue.push(idx); s.retries.push(idx); } // wrong ones come back once
      if (s.hearts <= 0) s.failed = true;
    }
    if (!s.failed && !s.queue.length) s.done = true;
    return { correct: ok, correctId: q.wordId, heartsLeft: s.hearts };
  }
  const progressOf = s => Math.min(1, s.correct / s.questions.length);
  function stars(s) { if (!s.done) return 0; return s.wrong === 0 ? 3 : s.wrong <= 2 ? 2 : 1; }

  // ---- Local progress (this device only) ----
  const STORAGE_KEY = 'taichung-english-v1';
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const emptyProgress = () => ({ v: 2, xp: 0, streak: 0, lastDay: null, lessons: 0, mastery: {}, today: null });
  const dayNumber = key => Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000);
  const masteryOf = (p, id) => p.mastery[id] || 0;
  /** A finished lesson raises the mastery of every word answered right first time and lowers the ones missed. */
  function applyLesson(p, s, dayKey) {
    const next = { v: 2, xp: p.xp, streak: p.streak, lastDay: p.lastDay, lessons: p.lessons, mastery: { ...p.mastery }, today: p.today };
    if (!s.done) return next;
    next.xp += s.xp; next.lessons++;
    for (const q of s.questions) {
      const now = masteryOf(next, q.wordId);
      next.mastery[q.wordId] = s.missedIds.includes(q.wordId) ? Math.max(0, now - 1) : Math.min(MASTERY_MAX, now + 1);
    }
    if (DAY.test(dayKey)) {
      if (p.lastDay === dayKey) { /* same day: keep streak */ }
      else if (p.lastDay && dayNumber(dayKey) - dayNumber(p.lastDay) === 1) next.streak = p.streak + 1;
      else next.streak = 1;
      next.lastDay = dayKey;
      next.today = { day: dayKey, n: (p.today && p.today.day === dayKey ? p.today.n : 0) + 1 };
    }
    return next;
  }
  const learnedCount = p => WORDS.filter(w => masteryOf(p, w.id) >= 1).length;
  const masteredCount = p => WORDS.filter(w => masteryOf(p, w.id) >= MASTERY_MAX).length;
  const lessonsToday = (p, dayKey) => (p.today && p.today.day === dayKey ? p.today.n : 0);
  /** Unit state: `cleared` (unlocks the next unit) needs 60% of its words at mastery 2+; stars: 1 cleared, 2 all words 2+, 3 all words mastered. */
  function unitState(p, unit) {
    const words = unit.words, total = words.length;
    const at2 = words.filter(id => masteryOf(p, id) >= 2).length, at3 = words.filter(id => masteryOf(p, id) >= MASTERY_MAX).length;
    const known = words.filter(id => masteryOf(p, id) >= 1).length;
    const cleared = at2 >= Math.ceil(total * 0.6);
    return { total, known, at2, at3, cleared, stars: at3 === total ? 3 : at2 === total ? 2 : cleared ? 1 : 0 };
  }
  const isUnlocked = (p, index) => index <= 0 || (index < UNITS.length && unitState(p, UNITS[index - 1]).cleared);
  /** The unit the big "continue" button starts: the first unlocked unit not yet cleared, else the first below 3 stars, else the last. */
  function nextUnit(p) {
    for (let i = 0; i < UNITS.length; i++) if (isUnlocked(p, i) && !unitState(p, UNITS[i]).cleared) return UNITS[i];
    for (let i = 0; i < UNITS.length; i++) if (isUnlocked(p, i) && unitState(p, UNITS[i]).stars < 3) return UNITS[i];
    return UNITS[UNITS.length - 1];
  }
  const serialize = p => JSON.stringify(p);
  /** Fails closed: anything unexpected returns null so the caller starts from empty. v1 saves (known counts) are converted. */
  function restore(raw) {
    if (!raw) return null;
    let d; try { d = JSON.parse(raw); } catch { return null; }
    if (!d || (d.v !== 1 && d.v !== 2) || !Number.isInteger(d.xp) || d.xp < 0 || !Number.isInteger(d.streak) || d.streak < 0 || !Number.isInteger(d.lessons) || d.lessons < 0) return null;
    if (d.lastDay !== null && !DAY.test(d.lastDay)) return null;
    const mastery = {};
    if (d.v === 1) {
      if (!d.known || typeof d.known !== 'object' || Array.isArray(d.known)) return null;
      for (const [id, n] of Object.entries(d.known)) { if (!wordById(id) || !Number.isInteger(n) || n < 0 || n > 9) return null; if (n >= 1) mastery[id] = 1; }
      return { v: 2, xp: d.xp, streak: d.streak, lastDay: d.lastDay, lessons: d.lessons, mastery, today: null };
    }
    if (!d.mastery || typeof d.mastery !== 'object' || Array.isArray(d.mastery)) return null;
    for (const [id, n] of Object.entries(d.mastery)) { if (!wordById(id) || !Number.isInteger(n) || n < 0 || n > MASTERY_MAX) return null; if (n > 0) mastery[id] = n; }
    let today = null;
    if (d.today !== null) {
      if (!d.today || typeof d.today !== 'object' || !DAY.test(d.today.day) || !Number.isInteger(d.today.n) || d.today.n < 1 || d.today.n > 999) return null;
      today = { day: d.today.day, n: d.today.n };
    }
    return { v: 2, xp: d.xp, streak: d.streak, lastDay: d.lastDay, lessons: d.lessons, mastery, today };
  }
  /** Streak shown today: a streak that was not continued yesterday or today is already broken. */
  function liveStreak(p, dayKey) {
    if (!p.lastDay || !DAY.test(dayKey)) return 0;
    const gap = dayNumber(dayKey) - dayNumber(p.lastDay);
    return gap <= 1 ? p.streak : 0;
  }
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function shareText(s, p, dayKey) {
    return `一口好英文 ${'★'.repeat(stars(s))}${'☆'.repeat(3 - stars(s))}　+${s.xp} XP　🔥${liveStreak(p, dayKey)}　${learnedCount(p)}/${WORDS.length} 個單字`;
  }
  return { WORDS, wordById, UNITS, unitById, LESSON_SIZE, MASTERY_MAX, makeLesson, masteryOf, masteredCount, lessonsToday, unitState, isUnlocked, nextUnit, optionLabel, createSession, current, answer, progressOf, stars, STORAGE_KEY, emptyProgress, applyLesson, learnedCount, serialize, restore, liveStreak, dateKey, shareText };
}));

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
    ['tofu', '🍮', '豆花', 'tofu pudding'], ['porkrice', '🍛', '滷肉飯', 'braised pork rice'], ['cake', '🥮', '太陽餅', 'sun cake'],
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

  const LESSON_SIZE = 8;
  /** Builds a lesson. `known` = { wordId: correctCount } so unseen/weak words are picked first. Returns frozen question list. */
  function makeLesson(seed, known = {}) {
    const rand = rng(typeof seed === 'string' ? seedFromString(seed) : seed);
    const order = shuffle(WORDS, rand).sort((a, b) => (known[a.id] || 0) - (known[b.id] || 0));
    const picked = order.slice(0, LESSON_SIZE);
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
      const pool = WORDS.filter(w => w.id !== word.id);
      const wrong = shuffle(pool, rand).slice(0, 3);
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
  const emptyProgress = () => ({ v: 1, xp: 0, streak: 0, lastDay: null, lessons: 0, known: {} });
  const dayNumber = key => Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000);
  function applyLesson(p, s, dayKey) {
    const next = { v: 1, xp: p.xp, streak: p.streak, lastDay: p.lastDay, lessons: p.lessons, known: { ...p.known } };
    if (!s.done) return next;
    next.xp += s.xp; next.lessons++;
    for (const q of s.questions) if (!s.missedIds.includes(q.wordId)) next.known[q.wordId] = Math.min(9, (next.known[q.wordId] || 0) + 1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
      if (p.lastDay === dayKey) { /* same day: keep streak */ }
      else if (p.lastDay && dayNumber(dayKey) - dayNumber(p.lastDay) === 1) next.streak = p.streak + 1;
      else next.streak = 1;
      next.lastDay = dayKey;
    }
    return next;
  }
  const learnedCount = p => Object.values(p.known).filter(n => n >= 1).length;
  const serialize = p => JSON.stringify(p);
  /** Fails closed: anything unexpected returns null so the caller starts from empty. */
  function restore(raw) {
    if (!raw) return null;
    let d; try { d = JSON.parse(raw); } catch { return null; }
    if (!d || d.v !== 1 || !Number.isInteger(d.xp) || d.xp < 0 || !Number.isInteger(d.streak) || d.streak < 0 || !Number.isInteger(d.lessons) || d.lessons < 0) return null;
    if (d.lastDay !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d.lastDay)) return null;
    if (!d.known || typeof d.known !== 'object' || Array.isArray(d.known)) return null;
    const known = {};
    for (const [id, n] of Object.entries(d.known)) { if (!wordById(id) || !Number.isInteger(n) || n < 0 || n > 9) return null; known[id] = n; }
    return { v: 1, xp: d.xp, streak: d.streak, lastDay: d.lastDay, lessons: d.lessons, known };
  }
  /** Streak shown today: a streak that was not continued yesterday or today is already broken. */
  function liveStreak(p, dayKey) {
    if (!p.lastDay || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return 0;
    const gap = dayNumber(dayKey) - dayNumber(p.lastDay);
    return gap <= 1 ? p.streak : 0;
  }
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function shareText(s, p, dayKey) {
    return `一口好英文 ${'★'.repeat(stars(s))}${'☆'.repeat(3 - stars(s))}　+${s.xp} XP　🔥${liveStreak(p, dayKey)}　${learnedCount(p)}/${WORDS.length} 個單字`;
  }
  return { WORDS, wordById, LESSON_SIZE, makeLesson, optionLabel, createSession, current, answer, progressOf, stars, STORAGE_KEY, emptyProgress, applyLesson, learnedCount, serialize, restore, liveStreak, dateKey, shareText };
}));

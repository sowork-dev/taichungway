/* Bike ride around Taichung: one-hand lane game logic. Pure functions: no DOM, no network, no storage.
 * The route names are place names for flavour only; this is not an official event or certification. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BikeCore = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LANES = 3, ROW_HEIGHT = 1; // distance is counted in rows
  // [id, title, emoji, length(rows), speed(rows/s), density(0..1), foodWordIds, palette]
  const ROUTES = Object.freeze([
    ['greenway', '東豐綠廊', '🌿', 60, 3.2, 0.34, ['bubbletea', 'tea', 'mochi', 'sweetpotato'], ['#BFE9C8', '#7CC48E']],
    ['ironhorse', '后豐鐵馬道', '🚉', 80, 3.6, 0.42, ['porkrice', 'noodles', 'riceball', 'sausage'], ['#FFE6A0', '#F4B94A']],
    ['parkway', '潭雅神綠園道', '🌳', 100, 4.0, 0.5, ['cake', 'popchicken', 'corn', 'icecream'], ['#BFE0FB', '#7FC0F0']],
    ['alley', '市場巷弄', '🏮', 120, 4.4, 0.58, ['bawan', 'stinkytofu', 'oysteromelet', 'shavedice', 'pineapplecake'], ['#F9C2C3', '#F4797B']]
  ].map(([id, title, emoji, length, speed, density, foods, palette]) => Object.freeze({ id, title, emoji, length, speed, density, foods: Object.freeze(foods), palette: Object.freeze(palette) })));
  const routeById = id => ROUTES.find(r => r.id === id) || null;
  const OBSTACLES = Object.freeze(['🚧', '🕳️', '🐈', '🪨']);

  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  const seedFrom = text => { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

  /** Deterministic course. A safe lane runs through the course and moves at most one lane every 2 rows, so a clean ride always exists. */
  function makeCourse(seed, route) {
    const rand = rng(typeof seed === 'string' ? seedFrom(seed) : seed);
    const items = [];
    let foodIndex = 0, safe = 1, lastChange = -9;
    for (let row = 6; row < route.length; row++) {
      if (row - lastChange >= 2 && rand() < 0.4) { const moved = Math.max(0, Math.min(LANES - 1, safe + (rand() < 0.5 ? -1 : 1))); if (moved !== safe) { safe = moved; lastChange = row; } }
      if (rand() > route.density) continue;
      const others = [0, 1, 2].filter(l => l !== safe);
      const blocked = rand() < 0.35 ? others : [others[Math.floor(rand() * others.length)]];
      for (const lane of blocked) items.push({ row, lane, type: 'obstacle', emoji: OBSTACLES[Math.floor(rand() * OBSTACLES.length)] });
      if (rand() < 0.55) {
        const free = [0, 1, 2].filter(l => !blocked.includes(l));
        const lane = free[Math.floor(rand() * free.length)];
        items.push({ row, lane, type: 'food', wordId: route.foods[foodIndex++ % route.foods.length] });
      }
    }
    return Object.freeze(items);
  }

  function createRun(route, course) {
    return { route, course, dist: 0, lane: 1, hearts: 3, hits: 0, collected: [], foodsSeen: 0, hitRows: [], done: false, failed: false, lastRow: -1 };
  }
  const foodTotal = course => course.filter(i => i.type === 'food').length;
  function setLane(run, direction) { if (run.done || run.failed) return run; run.lane = Math.max(0, Math.min(LANES - 1, run.lane + (direction < 0 ? -1 : 1))); return run; }
  /** Advances the ride by `dt` seconds. Items are resolved when the bike passes their row, in the lane the bike is in at that moment. */
  function step(run, dt) {
    if (run.done || run.failed || !(dt > 0)) return run;
    run.dist += run.route.speed * Math.min(dt, 0.1);
    const row = Math.floor(run.dist);
    for (let r = run.lastRow + 1; r <= row; r++) {
      for (const item of run.course) {
        if (item.row !== r || item.lane !== run.lane) continue;
        if (item.type === 'obstacle') { run.hits++; run.hearts--; run.hitRows.push(r); }
        else if (!run.collected.includes(item.wordId)) run.collected.push(item.wordId);
      }
      if (run.hearts <= 0) { run.failed = true; break; }
    }
    run.lastRow = Math.max(run.lastRow, row);
    if (!run.failed && run.dist >= run.route.length) run.done = true;
    return run;
  }
  const progressOf = run => Math.min(1, run.dist / run.route.length);
  /** 1 star: finished. 2 stars: at most one hit. 3 stars: no hit and at least 3/4 of the route's different foods collected. */
  function stars(run) {
    if (!run.done) return 0;
    const need = Math.ceil(run.route.foods.length * 0.75);
    if (run.hits === 0 && run.collected.length >= need) return 3;
    return run.hits <= 1 ? 2 : 1;
  }

  const STORAGE_KEY = 'taichung-bike-v1';
  const emptyProgress = () => ({ v: 1, stars: {}, foods: [] });
  function applyResult(p, run, foodIds) {
    const next = { v: 1, stars: { ...p.stars }, foods: p.foods.slice() };
    if (!run.done) return next;
    next.stars[run.route.id] = Math.max(next.stars[run.route.id] || 0, stars(run));
    for (const id of run.collected) if (!next.foods.includes(id)) next.foods.push(id);
    return next;
  }
  const totalStars = p => Object.values(p.stars).reduce((a, b) => a + b, 0);
  const serialize = p => JSON.stringify(p);
  /** Fails closed: anything unexpected returns null so the caller starts empty. */
  function restore(raw, knownFoods) {
    if (!raw) return null;
    let d; try { d = JSON.parse(raw); } catch { return null; }
    if (!d || d.v !== 1 || !d.stars || typeof d.stars !== 'object' || Array.isArray(d.stars) || !Array.isArray(d.foods)) return null;
    const starsOut = {};
    for (const [id, n] of Object.entries(d.stars)) { if (!routeById(id) || !Number.isInteger(n) || n < 1 || n > 3) return null; starsOut[id] = n; }
    if (d.foods.length > 80 || !d.foods.every(f => typeof f === 'string' && f.length <= 40 && (!knownFoods || knownFoods.includes(f)))) return null;
    return { v: 1, stars: starsOut, foods: Array.from(new Set(d.foods)) };
  }
  function shareText(run) {
    const s = stars(run);
    return `單車逛台中「${run.route.title}」 ${'★'.repeat(s)}${'☆'.repeat(3 - s)}　撿到 ${run.collected.length} 種小吃`;
  }
  return { LANES, ROUTES, routeById, makeCourse, createRun, setLane, step, progressOf, stars, foodTotal, STORAGE_KEY, emptyProgress, applyResult, totalStars, serialize, restore, shareText, seedFrom };
}));

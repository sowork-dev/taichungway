/* Solo challenge layer for the bubble game: levels, stars, daily pick, lit streets. Pure functions, no DOM, no network.
 * It only reads the public event stream of the authoritative practice game; it never changes game rules or awards server points.
 * Stars and lit streets are play records, not policy outcomes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BubbleMeta = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CRATES = 16;
  // Thresholds are tunable settings (not measured with real players yet). Each star spec is cumulative with the one before it.
  const LEVELS = Object.freeze([
    { id: 'first-drop', title: '第一滴水', goal: 6, goalText: '炸開 6 個街區', stars: Object.freeze([{}, { maxBalloons: 9 }, { maxBalloons: 7 }]),
      starText: Object.freeze(['炸開 6 個', '水球 9 顆內', '水球 7 顆內']) },
    { id: 'clear-all', title: '清光街區', goal: CRATES, goalText: '炸開全部 16 個街區', stars: Object.freeze([{}, { maxMs: 90000 }, { maxMs: 60000 }]),
      starText: Object.freeze(['清光', '90 秒內', '60 秒內']) },
    { id: 'save-water', title: '省水球', goal: CRATES, goalText: '用最少的水球清光', stars: Object.freeze([{ maxBalloons: 20 }, { maxBalloons: 15 }, { maxBalloons: 12 }]),
      starText: Object.freeze(['20 顆內', '15 顆內', '12 顆內']) },
    { id: 'steady', title: '穩穩的', goal: CRATES, goalText: '清光，且別被自己的水波困住', stars: Object.freeze([{}, { maxSelfTraps: 1 }, { maxSelfTraps: 0, maxMs: 90000 }]),
      starText: Object.freeze(['清光', '自困 1 次內', '不自困，90 秒內']) },
  ]);
  const levelById = id => LEVELS.find(level => level.id === id) || null;

  function createRun() { return { startedAt: null, finishedAt: null, balloons: 0, cleared: 0, selfTraps: 0, topics: [] }; }
  /** Feed one public game event. `you` is this player's id, `now` the game's virtual clock. Dedupe by event id in the caller. */
  function feed(run, event, you, now) {
    if (!event || typeof event !== 'object' || run.finishedAt !== null) return run;
    if (event.type === 'place' && event.playerId === you) {
      if (run.startedAt === null && Number.isFinite(now)) run.startedAt = now;
      run.balloons++;
    } else if (event.type === 'destroy' && event.playerId === you) {
      run.cleared++;
      if (typeof event.topicId === 'string' && !run.topics.includes(event.topicId)) run.topics.push(event.topicId);
    } else if (event.type === 'capture' && event.victimId === you && event.playerId === you && !(event.points > 0)) {
      run.selfTraps++;
    }
    return run;
  }
  const elapsedMs = (run, now) => run.startedAt === null ? 0 : Math.max(0, (run.finishedAt ?? now) - run.startedAt);
  const isDone = (level, run) => run.cleared >= level.goal;
  function finish(run, now) { if (run.finishedAt === null && Number.isFinite(now)) run.finishedAt = now; return run; }

  function meets(spec, run) {
    if (spec.maxMs !== undefined && elapsedMs(run, run.finishedAt ?? 0) > spec.maxMs) return false;
    if (spec.maxBalloons !== undefined && run.balloons > spec.maxBalloons) return false;
    if (spec.maxSelfTraps !== undefined && run.selfTraps > spec.maxSelfTraps) return false;
    return true;
  }
  /** Returns { done, stars (0-3), checks: boolean[3] }. Stars need the goal; a star needs its own spec. */
  function evaluate(level, run) {
    const done = isDone(level, run);
    const checks = level.stars.map(spec => done && meets(spec, run));
    let stars = 0;
    for (const ok of checks) { if (ok) stars++; else break; }
    return { done, stars, checks };
  }
  /** Same calendar date gives the same level anywhere; the very first level is for newcomers and never the daily one. */
  function dailyLevel(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return LEVELS[1];
    let h = 2166136261;
    for (const ch of dateStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return LEVELS[1 + (h % (LEVELS.length - 1))];
  }
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  // ---- Local progress (this device only) ----
  const STORAGE_KEY = 'taichung-bubble-v1';
  const emptyProgress = () => ({ v: 1, stars: {}, lit: [], seenCoach: false, daily: null });
  function applyResult(progress, level, result, run, date) {
    const next = { v: 1, stars: { ...progress.stars }, lit: progress.lit.slice(), seenCoach: progress.seenCoach, daily: progress.daily };
    if (result.done) {
      next.stars[level.id] = Math.max(next.stars[level.id] || 0, Math.max(1, result.stars));
      for (const topic of run.topics) if (!next.lit.includes(topic)) next.lit.push(topic);
      if (date && dailyLevel(date).id === level.id) next.daily = { date, stars: Math.max(progress.daily && progress.daily.date === date ? progress.daily.stars : 0, Math.max(1, result.stars)) };
    }
    return next;
  }
  const totalStars = progress => Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const serialize = progress => JSON.stringify(progress);
  /** Fails closed: anything unexpected returns null so the caller starts empty instead of trusting bad data. */
  function restore(raw, knownTopics) {
    if (!raw) return null;
    let d; try { d = JSON.parse(raw); } catch { return null; }
    if (!d || d.v !== 1 || !d.stars || typeof d.stars !== 'object' || Array.isArray(d.stars) || !Array.isArray(d.lit) || typeof d.seenCoach !== 'boolean') return null;
    const stars = {};
    for (const [id, n] of Object.entries(d.stars)) { if (!levelById(id) || !Number.isInteger(n) || n < 1 || n > 3) return null; stars[id] = n; }
    if (d.lit.length > 64 || !d.lit.every(t => typeof t === 'string' && t.length <= 40 && (!knownTopics || knownTopics.includes(t)))) return null;
    let daily = null;
    if (d.daily !== null) {
      if (!d.daily || typeof d.daily !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(d.daily.date) || !Number.isInteger(d.daily.stars) || d.daily.stars < 1 || d.daily.stars > 3) return null;
      daily = { date: d.daily.date, stars: d.daily.stars };
    }
    return { v: 1, stars, lit: Array.from(new Set(d.lit)), seenCoach: d.seenCoach, daily };
  }
  /** Plain-text result for sharing: no names, no room code. */
  function shareText(level, result, run, dateStr) {
    const filled = Math.min(CRATES, run.cleared);
    return `泡泡 PK「${level.title}」 ${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}　${'🟦'.repeat(Math.round(filled / 2))}${'⬜'.repeat(8 - Math.round(filled / 2))}${dateStr ? `　${dateStr}` : ''}`;
  }
  return { CRATES, LEVELS, levelById, createRun, feed, finish, elapsedMs, isDone, evaluate, dailyLevel, dateKey, STORAGE_KEY, emptyProgress, applyResult, totalStars, serialize, restore, shareText };
}));

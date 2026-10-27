/* Solo challenge UI for the bubble game. Reads the public practice-room state from play.js, never sends anything of its own,
 * and never changes game rules. Progress (stars, lit streets) is stored only in this browser. */
(function () {
  'use strict';
  const M = window.BubbleMeta, A = window.BubbleCore;
  const $ = id => document.getElementById(id);
  if (!M || !A || !$('entryLayer')) return;

  const invited = /^[A-F0-9]{6}$/.test(new URL(location.href).searchParams.get('room') || '');
  const topicLabels = (() => {
    const labels = new Map();
    const g = A.createGame({ now: 0 });
    for (const c of A.snapshot(g).crates) if (!labels.has(c.topicId)) labels.set(c.topicId, c.label);
    return labels;
  })();
  const knownTopics = [...topicLabels.keys()];

  let progress = M.emptyProgress();
  try { progress = M.restore(localStorage.getItem(M.STORAGE_KEY), knownTopics) || M.emptyProgress(); } catch { /* storage blocked: play without saving */ }
  function save() { try { localStorage.setItem(M.STORAGE_KEY, M.serialize(progress)); } catch { /* ignore */ } }

  const today = M.dateKey();
  const daily = M.dailyLevel(today);
  let selected = (M.LEVELS.find(l => !progress.stars[l.id]) || daily).id;
  let challenge = null; // { level, run, lastEvent, stage, done }

  const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }

  // ---------- entry: level panel ----------
  const entry = $('entryLayer'), startGame = $('startGame');
  const panel = el('div', 'level-panel'), go = el('button', 'start-button', '開始闖關 ▶');
  go.id = 'startChallenge'; go.type = 'button';
  if (!invited) { entry.insertBefore(panel, startGame); entry.insertBefore(go, startGame); }
  else startGame.classList.add('primary-join');
  startGame.classList.add('pvp-link');

  function renderPanel() {
    if (invited) return;
    panel.replaceChildren();
    const head = el('div', 'level-head');
    head.append(el('b', '', '選一關'), el('span', '', '★ ' + M.totalStars(progress) + ' / ' + M.LEVELS.length * 3));
    const list = el('div', 'level-list');
    for (const level of M.LEVELS) {
      const b = el('button', 'level-card' + (level.id === selected ? ' on' : ''));
      b.type = 'button'; b.dataset.level = level.id;
      b.append(el('span', 'lv-title', level.title), el('span', 'lv-stars', stars(progress.stars[level.id] || 0)), el('small', '', level.goalText));
      if (level.id === daily.id) b.append(el('i', 'lv-daily', '今日'));
      b.addEventListener('click', () => { selected = level.id; renderPanel(); });
      list.append(b);
    }
    const lit = el('div', 'lit-row');
    lit.append(el('span', '', '點亮街區 ' + progress.lit.length + ' / ' + knownTopics.length));
    const dots = el('span', 'lit-dots');
    for (const t of knownTopics) { const d = el('i', progress.lit.includes(t) ? 'on' : ''); d.title = topicLabels.get(t); dots.append(d); }
    lit.append(dots);
    panel.append(head, list, lit);
    const level = M.levelById(selected);
    go.textContent = progress.stars[level.id] ? '再挑戰 ▶' : '開始闖關 ▶';
  }
  renderPanel();

  go.addEventListener('click', () => begin(selected));

  function begin(levelId) {
    const level = M.levelById(levelId);
    if (!level || !window.PlayGame) return;
    closeResult();
    challenge = { level, run: M.createRun(), lastEvent: 0, stage: 0, done: false };
    selected = level.id;
    buildGoalBar();
    go.disabled = true;
    window.PlayGame.start(true);
  }

  // ---------- goal bar ----------
  const stage = $('arenaStage');
  let bar = null;
  function buildGoalBar() {
    removeGoalBar();
    bar = el('div', 'goal-bar');
    bar.append(el('div', 'goal-line'), el('div', 'goal-stars'));
    stage.parentNode.insertBefore(bar, stage);
    document.body.classList.add('in-challenge');
    updateGoalBar(0);
  }
  function removeGoalBar() { document.body.classList.remove('in-challenge'); if (bar) { bar.remove(); bar = null; } }
  function liveState(spec, run, now) {
    if (spec.maxMs !== undefined && M.elapsedMs(run, now) > spec.maxMs) return 'lost';
    if (spec.maxBalloons !== undefined && run.balloons > spec.maxBalloons) return 'lost';
    if (spec.maxSelfTraps !== undefined && run.selfTraps > spec.maxSelfTraps) return 'lost';
    return 'ok';
  }
  function updateGoalBar(now) {
    if (!bar || !challenge) return;
    const { level, run } = challenge, shown = Math.min(level.goal, run.cleared);
    const line = bar.querySelector('.goal-line');
    line.replaceChildren(el('b', '', level.title), el('span', 'goal-track'), el('em', '', shown + ' / ' + level.goal), el('span', 'goal-water', '💧' + run.balloons));
    line.querySelector('.goal-track').append(Object.assign(el('i'), { style: 'width:' + Math.round(shown / level.goal * 100) + '%' }));
    const chips = bar.querySelector('.goal-stars');
    chips.replaceChildren();
    level.stars.forEach((spec, i) => {
      const status = i === 0 && !Object.keys(spec).length ? (shown >= level.goal ? 'got' : 'ok') : liveState(spec, run, now);
      chips.append(el('span', 'star-chip ' + status, '★ ' + level.starText[i]));
    });
  }

  // ---------- hints, toast ----------
  function hint() {
    if (!challenge || challenge.done) return '';
    const { run, level } = challenge;
    if (run.balloons === 0) return '按右下「水球」放一顆 💧';
    if (run.cleared === 0) return '十字水波會炸開街區，快走開！';
    if (run.cleared < level.goal) return '還差 ' + (level.goal - run.cleared) + ' 個街區';
    return '';
  }
  function toast(text) {
    const t = $('eventToast'); t.textContent = text; t.hidden = false;
    setTimeout(() => { if (t.textContent === text) t.hidden = true; }, 1800);
  }

  // ---------- state from play.js ----------
  function onState(state, you) {
    if (!challenge || challenge.done || !state) return;
    go.disabled = false;
    if (state.players.length > 1 || state.phase !== 'practice') {
      toast('真人加入了，改成對戰！');
      endChallenge();
      return;
    }
    for (const e of state.events || []) {
      if (e.id <= challenge.lastEvent) continue;
      challenge.lastEvent = e.id;
      M.feed(challenge.run, e, you, state.now);
    }
    updateGoalBar(state.now);
    if (M.isDone(challenge.level, challenge.run)) complete(state.now);
  }
  function endChallenge() { removeGoalBar(); closeResult(); challenge = null; renderPanel(); }
  function onLeave() { go.disabled = false; if (challenge) endChallenge(); else renderPanel(); }

  // ---------- result ----------
  let result = null;
  function closeResult() { if (result) { result.remove(); result = null; } }
  function complete(now) {
    const c = challenge; c.done = true;
    M.finish(c.run, now);
    const evaluation = M.evaluate(c.level, c.run);
    const before = progress.stars[c.level.id] || 0;
    progress = M.applyResult(progress, c.level, evaluation, c.run, today);
    save();
    removeGoalBar();
    setTimeout(() => showResult(c, evaluation, before), 900);
  }
  function showResult(c, evaluation, before) {
    if (challenge !== c) return;
    closeResult();
    result = el('div', 'challenge-result');
    const row = el('div', 'result-stars');
    for (let i = 0; i < 3; i++) { const s = el('span', 'rs' + (i < evaluation.stars ? ' on' : ''), '★'); s.style.animationDelay = (i * 0.25) + 's'; row.append(s); }
    const missing = c.level.stars.map((_, i) => i).find(i => !evaluation.checks[i]);
    const tip = missing === undefined ? '三顆星全拿！' : '下一顆星：' + c.level.starText[missing];
    const seconds = Math.round(M.elapsedMs(c.run, c.run.finishedAt) / 1000);
    const next = M.LEVELS[M.LEVELS.findIndex(l => l.id === c.level.id) + 1] || null;
    const newly = progress.stars[c.level.id] > before;
    result.append(el('h2', '', c.level.title + (newly && before ? ' · 進步了！' : ' · 過關！')), row,
      el('p', 'result-stats', '水球 ' + c.run.balloons + ' 顆 · ' + seconds + ' 秒' + (c.run.selfTraps ? ' · 自困 ' + c.run.selfTraps + ' 次' : '')),
      el('p', 'result-tip', tip));
    const primary = el('button', 'start-button', next ? '下一關「' + next.title + '」▶' : '再挑戰一次 ↻');
    primary.type = 'button';
    primary.addEventListener('click', () => begin(next ? next.id : c.level.id));
    const links = el('div', 'result-links');
    const again = el('button', '', '重玩這關'); again.type = 'button'; again.addEventListener('click', () => begin(c.level.id));
    const share = el('button', '', '分享'); share.type = 'button'; share.addEventListener('click', () => shareResult(c, evaluation));
    const menu = el('button', '', '選關'); menu.type = 'button'; menu.addEventListener('click', () => { endChallenge(); window.PlayGame.leave(); });
    links.append(again, share, menu);
    result.append(primary, links);
    stage.append(result);
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  }
  async function shareResult(c, evaluation) {
    const text = M.shareText(c.level, evaluation, c.run, today) + '\n' + location.origin + '/bubble.html';
    try {
      if (navigator.share) { await navigator.share({ title: '臺中泡泡 PK', text }); return; }
      await navigator.clipboard.writeText(text); toast('成績已複製');
    } catch (e) { if (e && e.name !== 'AbortError') toast('分享不了，請截圖'); }
  }

  window.BubbleUI = Object.freeze({ onState, onLeave, hint, active: () => !!challenge && !challenge.done, begin });
})();

/* Taichung food English: screens and interaction. Everything stays in this browser (progress in localStorage, fails closed).
 * No network calls, no account, no sound files (the speaker button uses the browser's own speech voice if it has one). */
(function () {
  'use strict';
  const E = window.EnglishCore;
  const app = document.getElementById('app');
  if (!E || !app) return;

  let progress = E.emptyProgress();
  try { progress = E.restore(localStorage.getItem(E.STORAGE_KEY)) || E.emptyProgress(); } catch { /* storage blocked: play without saving */ }
  function save() { try { localStorage.setItem(E.STORAGE_KEY, E.serialize(progress)); } catch { /* ignore */ } }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  function say(text) {
    if (!canSpeak) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = .85; speechSynthesis.speak(u); } catch { /* ignore */ }
  }
  function buzz(ms) { if (!reduced && navigator.vibrate) navigator.vibrate(ms); }
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function button(cls, text, onClick) { const b = el('button', cls, text); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); return b; }
  function mount(...nodes) { app.replaceChildren(...nodes); }

  const today = () => E.dateKey();
  let session = null, picked = null, checked = false;

  // ---------- home ----------
  function home() {
    session = null;
    const top = el('div', 'top');
    top.append(el('span', 'chip', '🔥 ' + E.liveStreak(progress, today())), el('span', 'chip', '⚡ ' + progress.xp + ' XP'));
    const hero = el('div', 'hero');
    hero.append(el('h1', '', '味道英文'), el('div', 'big', '🍜'), el('p', '', '台中小吃，每天學一課'));
    const book = el('div', 'book');
    const head = el('b', '');
    head.append(el('span', '', '我的單字冊'), el('span', '', E.learnedCount(progress) + ' / ' + E.WORDS.length));
    const words = el('div', 'words');
    for (const w of E.WORDS) { const s = el('span', (progress.known[w.id] || 0) >= 1 ? 'on' : '', w.emoji); s.title = w.zh + ' · ' + w.en; words.append(s); }
    book.append(head, words);
    const start = button('eng-btn', progress.lessons ? '再來一課 ▶' : '開始第一課 ▶', startLesson);
    const back = el('a', 'eng-link', '← 回台中味');
    back.href = '/'; back.style.textAlign = 'center';
    const wrap = el('div', 'home');
    wrap.append(top, hero, book, el('div', 'spacer'), start, back);
    mount(wrap);
  }

  // ---------- lesson ----------
  function startLesson() {
    // The lesson seed mixes today's date with how many lessons were done, so each lesson of the day differs but is reproducible.
    session = E.createSession(E.makeLesson(today() + '#' + progress.lessons, progress.known));
    renderQuestion();
  }
  function topBar() {
    const bar = el('div', 'bar');
    const x = button('x', '✕', () => { if (!session.done && session.correct === 0 || confirm('現在離開，這一課不會計分。')) home(); });
    x.setAttribute('aria-label', '離開這一課');
    const track = el('div', 'track'); const fill = el('i'); fill.style.width = Math.round(E.progressOf(session) * 100) + '%'; track.append(fill);
    const hearts = el('div', 'hearts', '❤️ ' + session.hearts); hearts.id = 'hearts';
    bar.append(x, track, hearts);
    return bar;
  }
  function renderQuestion() {
    const q = E.current(session);
    if (!q) return finish();
    picked = null; checked = false;
    const word = E.wordById(q.wordId);
    const body = el('div', 'body');
    const foot = el('div', 'foot');
    const check = button('eng-btn', '檢查');
    check.disabled = true;
    foot.append(check);

    if (q.type === 'match') {
      body.append(el('p', 'prompt', '把中文和英文連起來'));
      matchBoard(body, q, () => { finishCheck(true, word, foot, body, null); });
      check.remove();
    } else {
      if (q.type === 'pic2en') { body.append(el('p', 'prompt', '這個的英文是？'), el('div', 'pic', word.emoji)); }
      else if (q.type === 'zh2en') { body.append(el('p', 'prompt', '「' + word.zh + '」的英文是？'), el('div', 'pic', word.emoji)); }
      else {
        body.append(el('p', 'prompt', '這是什麼意思？'), el('div', 'word', word.en));
        if (canSpeak) { const row = el('div', 'say'); row.append(button('', '🔊 聽聽看', () => say(word.en))); body.append(row); }
      }
      const opts = el('div', 'opts' + (q.type === 'en2zh' ? '' : ' one'));
      for (const id of q.options) {
        const b = button('opt', E.optionLabel(q.type, id));
        b.dataset.id = id;
        b.addEventListener('click', () => { if (checked) return; picked = id; opts.querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o === b)); check.disabled = false; buzz(8); });
        opts.append(b);
      }
      body.append(opts);
      check.addEventListener('click', () => {
        if (checked || picked === null) return;
        checked = true;
        const ok = picked === q.wordId;
        opts.querySelectorAll('.opt').forEach(o => { o.disabled = true; if (o.dataset.id === q.wordId) o.classList.add('right'); else if (o.dataset.id === picked) o.classList.add('wrong'); });
        finishCheck(ok, word, foot, body, picked);
      });
    }
    mount(...[el('div', 'lesson')].map(l => { l.append(topBar(), body, foot); return l; }));
    if (q.type === 'zh2en' || q.type === 'pic2en') { /* answers are read in English; speaker appears on the feedback sheet */ }
  }
  function matchBoard(body, q, onSolved) {
    const left = shuffleStable(q.pairs, 1), right = shuffleStable(q.pairs, 2);
    const grid = el('div', 'match'), colA = el('div', 'col'), colB = el('div', 'col');
    let a = null, b = null, solved = 0;
    const btns = [];
    function make(id, side) {
      const w = E.wordById(id);
      const btn = button('opt', side === 'zh' ? w.emoji + ' ' + w.zh : w.en);
      btn.dataset.id = id; btn.dataset.side = side; btns.push(btn);
      btn.addEventListener('click', () => {
        if (btn.classList.contains('done')) return;
        if (side === 'zh') { a = btn; } else { b = btn; }
        btns.filter(x => x.dataset.side === side).forEach(x => x.classList.toggle('sel', x === btn));
        buzz(8);
        if (a && b) {
          if (a.dataset.id === b.dataset.id) {
            [a, b].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; });
            solved++; a = b = null;
            if (solved === q.pairs.length) setTimeout(onSolved, 350);
          } else {
            const pair = [a, b]; pair.forEach(x => { x.classList.remove('sel'); x.classList.add('shake'); });
            setTimeout(() => pair.forEach(x => x.classList.remove('shake')), 320);
            a = b = null; buzz(30);
          }
        }
      });
      return btn;
    }
    left.forEach(id => colA.append(make(id, 'zh'))); right.forEach(id => colB.append(make(id, 'en')));
    grid.append(colA, colB); body.append(grid);
  }
  // A fixed shuffle of a short list (reproducible per question, no extra RNG state needed).
  function shuffleStable(list, k) { return list.slice().sort((x, y) => ((x.charCodeAt(0) * (k + 3)) % 7) - ((y.charCodeAt(0) * (k + 3)) % 7) || (x < y ? -1 : 1)); }

  function finishCheck(ok, word, foot, body, pickedId) {
    const result = E.answer(session, ok ? (pickedId === null ? true : pickedId) : pickedId);
    buzz(ok ? 15 : 60);
    const hearts = document.getElementById('hearts');
    if (hearts) { hearts.textContent = '❤️ ' + session.hearts; if (!ok) { hearts.classList.add('hit'); } }
    document.querySelector('.track i').style.width = Math.round(E.progressOf(session) * 100) + '%';
    foot.className = 'foot ' + (ok ? 'ok' : 'bad');
    const title = el('h3', '', ok ? '答對了！' : '再看一次');
    const line = el('p', '', ok ? word.emoji + ' ' + word.zh + ' = ' + word.en : '正確答案：' + word.en + '（' + word.zh + '）');
    const next = button('eng-btn ' + (ok ? 'ok' : 'bad'), session.failed ? '看結果' : '繼續', () => { if (session.failed || session.done) finish(); else renderQuestion(); });
    foot.replaceChildren(title, line);
    if (canSpeak) { const sp = button('eng-link', '🔊 ' + word.en, () => say(word.en)); foot.append(sp); }
    foot.append(next);
    next.focus();
    void result;
  }

  // ---------- result ----------
  function finish() {
    const s = session;
    const wrap = el('div', 'result');
    if (s.failed) {
      wrap.append(el('h2', '', '愛心用完了 💔'), el('p', '', '沒關係，再試一次，題目會換一批。'));
      wrap.append(button('eng-btn', '再試一次', startLesson), button('eng-link', '回首頁', home));
      mount(wrap); return;
    }
    const before = progress;
    progress = E.applyLesson(progress, s, today());
    save();
    const rs = el('div', 'rstars');
    for (let i = 0; i < 3; i++) { const st = el('span', i < E.stars(s) ? 'on' : '', '★'); st.style.animationDelay = (i * .25) + 's'; rs.append(st); }
    const stats = el('div', 'stats');
    stats.append(el('span', 'stat', '⚡ +' + s.xp), el('span', 'stat', '🔥 ' + E.liveStreak(progress, today())), el('span', 'stat', '📖 ' + E.learnedCount(progress) + '/' + E.WORDS.length));
    const learned = el('div', 'learned');
    const seen = new Set();
    for (const q of s.questions) {
      if (seen.has(q.wordId)) continue; seen.add(q.wordId);
      const w = E.wordById(q.wordId);
      const row = el('div'); row.append(el('em', '', w.emoji), el('span', '', w.zh), el('small', '', w.en));
      if (canSpeak) row.append(button('', '🔊', () => say(w.en)));
      learned.append(row);
    }
    const newWords = E.learnedCount(progress) - E.learnedCount(before);
    wrap.append(el('h2', '', s.wrong === 0 ? '全對！' : '完成一課！'), rs, stats, el('p', '', newWords > 0 ? '新學會 ' + newWords + ' 個單字' : '複習完成'), learned);
    const more = button('eng-btn', '再來一課 ▶', startLesson);
    const share = button('eng-link', '分享成績', async () => {
      const text = E.shareText(s, progress, today()) + '\n' + location.origin + '/english.html';
      try { if (navigator.share) { await navigator.share({ title: '味道英文', text }); return; } await navigator.clipboard.writeText(text); share.textContent = '已複製'; } catch (e) { if (e && e.name !== 'AbortError') share.textContent = '分享不了，請截圖'; }
    });
    wrap.append(more, share, button('eng-link', '回首頁', home));
    mount(wrap);
  }

  home();
  window.EnglishApp = Object.freeze({ home, startLesson });
})();

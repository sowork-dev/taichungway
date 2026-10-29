/* Bike ride around Taichung: screens, canvas drawing and input. Everything stays in this browser (progress in localStorage, fails closed).
 * No network calls, no account. */
(function () {
  'use strict';
  const B = window.BikeCore, E = window.EnglishCore;
  const app = document.getElementById('app');
  if (!B || !app) return;

  const knownFoods = E ? E.WORDS.map(w => w.id) : null;
  let progress = B.emptyProgress();
  try { progress = B.restore(localStorage.getItem(B.STORAGE_KEY), knownFoods) || B.emptyProgress(); } catch { /* storage blocked: play without saving */ }
  function save() { try { localStorage.setItem(B.STORAGE_KEY, B.serialize(progress)); } catch { /* ignore */ } }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buzz = ms => { if (!reduced && navigator.vibrate) navigator.vibrate(ms); };
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function button(cls, text, onClick) { const b = el('button', cls, text); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); return b; }
  function mount(...nodes) { app.replaceChildren(...nodes); }
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const wordOf = id => (E && E.wordById(id)) || { zh: id, en: id, emoji: '🍽️', pic: false };

  let route = B.ROUTES[0], run = null, raf = 0, stopLoop = null;

  // ---------- menu ----------
  function menu() {
    if (stopLoop) stopLoop();
    run = null;
    const scroll = el('div', 'menu-scroll');
    const title = el('div', 'title'); title.append(el('h1', '', '單車逛台中'), el('p', '', '左右換車道，撿沿路的台中小吃'));
    const list = el('div', 'routes');
    for (const r of B.ROUTES) {
      const row = button('route' + (r.id === route.id ? ' on' : ''), '', () => { route = r; menu(); });
      const info = el('span', 'r-info'); info.append(el('b', '', r.title), el('small', '', r.length + ' 格 · 小吃 ' + r.foods.length + ' 種'));
      row.append(el('span', 'r-emoji', r.emoji), info, el('span', 'r-stars', starText(progress.stars[r.id] || 0)));
      list.append(row);
    }
    const stamps = el('div', 'stamps', '完騎章 ' + Object.keys(progress.stars).length + ' / ' + B.ROUTES.length + '　· 撿過的小吃 ' + progress.foods.length + ' 種');
    scroll.append(title, list, stamps);
    const foot = el('div', 'menu-foot');
    const back = el('a', 'bk-link', '← 回台中味'); back.href = '/';
    foot.append(button('bk-btn', (progress.stars[route.id] ? '再騎一次：' : '出發：') + route.title + ' ▶', start), back);
    const wrap = el('div', 'menu'); wrap.append(scroll, foot);
    mount(wrap);
  }

  // ---------- ride ----------
  function start() {
    run = B.createRun(route, B.makeCourse(route.id + '#' + new Date().toDateString() + '#' + Math.floor(Math.random() * 1e6), route));
    const hud = el('div', 'hud');
    const x = button('x', '✕', menu); x.setAttribute('aria-label', '離開');
    const track = el('div', 'track'), fill = el('i'); fill.style.width = '0%'; track.append(fill);
    const hearts = el('div', 'hearts', '❤️❤️❤️');
    hud.append(x, track, hearts);
    const stage = el('div', 'stage'), canvas = el('canvas'); stage.append(canvas);
    const tip = el('div', 'tip', '點左邊或右邊換車道'); stage.append(tip);
    const pad = el('div', 'pad');
    const left = button('', '◀', () => steer(-1)), right = button('', '▶', () => steer(1));
    left.setAttribute('aria-label', '往左'); right.setAttribute('aria-label', '往右');
    pad.append(left, right);
    const game = el('div', 'game'); game.append(hud, stage, pad);
    mount(game);

    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, laneX = 1, last = performance.now(), readyUntil = last + 1200, ended = false, shake = 0;
    const flashes = [];
    function resize() { const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); w = Math.max(1, r.width); h = Math.max(1, r.height); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(stage);
    function steer(d) { if (!run || ended || performance.now() < readyUntil) return; B.setLane(run, d); tip.hidden = true; }
    const onKey = e => { if (['ArrowLeft', 'a', 'A'].includes(e.key)) { e.preventDefault(); steer(-1); } else if (['ArrowRight', 'd', 'D'].includes(e.key)) { e.preventDefault(); steer(1); } };
    const onTap = e => { const r = stage.getBoundingClientRect(); steer(e.clientX < r.left + r.width / 2 ? -1 : 1); };
    window.addEventListener('keydown', onKey); stage.addEventListener('pointerdown', onTap);
    stopLoop = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); ro.disconnect(); stopLoop = null; ended = true; };

    const rowPx = () => h / 9; // 9 rows visible, the bike sits near the bottom
    function draw(now) {
      const [sky, side] = route.palette, laneW = Math.min(w / 3.4, 110), roadW = laneW * 3, x0 = (w - roadW) / 2, rp = rowPx(), bikeY = h * 0.78;
      ctx.save();
      if (shake > now && !reduced) ctx.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = side; ctx.fillRect(0, 0, x0 - 6, h); ctx.fillRect(x0 + roadW + 6, 0, w, h);
      ctx.fillStyle = '#6b7a8d'; ctx.fillRect(x0, 0, roadW, h);
      ctx.strokeStyle = '#06162B'; ctx.lineWidth = 4; ctx.strokeRect(x0, -4, roadW, h + 8);
      ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 3; ctx.setLineDash([rp * .5, rp * .5]);
      const offset = (run.dist % 1) * rp;
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x0 + laneW * i, -rp + offset); ctx.lineTo(x0 + laneW * i, h + rp + offset); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const item of run.course) {
        const y = bikeY - (item.row - run.dist) * rp;
        if (y < -rp || y > h + rp) continue;
        const cx = x0 + laneW * (item.lane + .5);
        if (item.type === 'obstacle') { ctx.font = Math.round(laneW * .6) + 'px sans-serif'; ctx.fillText(item.emoji, cx, y); }
        else if (!run.collected.includes(item.wordId) || item.row > run.dist) {
          const wd = wordOf(item.wordId);
          ctx.fillStyle = '#ffffffd9'; ctx.beginPath(); ctx.arc(cx, y, laneW * .36, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#06162B'; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = '#06162B'; ctx.font = Math.round(laneW * .42) + 'px sans-serif'; ctx.fillText(wd.emoji, cx, y - 3);
          ctx.font = '900 ' + Math.round(laneW * .16) + 'px sans-serif'; ctx.fillText(wd.zh.slice(0, 4), cx, y + laneW * .26);
        }
      }
      laneX += (run.lane - laneX) * Math.min(1, (now - last) / 1000 * 18);
      const bx = x0 + laneW * (laneX + .5), bob = reduced ? 0 : Math.sin(now / 90) * 2;
      ctx.fillStyle = '#06162B33'; ctx.beginPath(); ctx.ellipse(bx, bikeY + laneW * .32, laneW * .26, laneW * .08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.font = Math.round(laneW * .78) + 'px sans-serif'; ctx.fillStyle = '#06162B'; ctx.fillText('🚲', bx, bikeY + bob);
      ctx.fillText('🙂', bx, bikeY - laneW * .5 + bob);
      for (const f of flashes) { const a = (now - f.at) / 700; if (a < 1) { ctx.globalAlpha = 1 - a; ctx.font = '900 22px sans-serif'; ctx.fillStyle = f.color; ctx.fillText(f.text, bx, bikeY - laneW * .9 - a * 40); ctx.globalAlpha = 1; } }
      ctx.restore();
    }
    let prevHearts = 3, prevCollected = 0;
    function frame(now) {
      if (ended) return;
      const dt = (now - last) / 1000;
      if (now >= readyUntil) {
        B.step(run, dt);
        if (run.hearts < prevHearts) { prevHearts = run.hearts; flashes.push({ at: now, text: '哎呀！', color: '#E4423F' }); shake = now + 260; buzz(60); hearts.classList.remove('hit'); void hearts.offsetWidth; hearts.classList.add('hit'); }
        if (run.collected.length > prevCollected) { const id = run.collected[run.collected.length - 1], wd = wordOf(id); prevCollected = run.collected.length; flashes.push({ at: now, text: wd.en, color: '#0F4AA0' }); buzz(10); }
        fill.style.width = Math.round(B.progressOf(run) * 100) + '%';
        hearts.textContent = '❤️'.repeat(Math.max(0, run.hearts)) + '🤍'.repeat(Math.max(0, 3 - run.hearts));
        if (run.done || run.failed) { draw(now); last = now; ended = true; stopLoop = null; window.removeEventListener('keydown', onKey); ro.disconnect(); setTimeout(() => finish(run), 700); return; }
      } else tip.hidden = false;
      draw(now); last = now; raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  // ---------- result ----------
  function finish(r) {
    const wrap = el('div', 'result');
    if (r.failed) {
      wrap.append(el('h2', '', '車翻了 🚲💥'), el('p', '', '別灰心，路線每次都不一樣。'), button('bk-btn', '再騎一次 ▶', start), button('bk-link', '選路線', menu));
      mount(wrap); return;
    }
    progress = B.applyResult(progress, r);
    save();
    const s = B.stars(r);
    const rs = el('div', 'rstars');
    for (let i = 0; i < 3; i++) { const st = el('span', i < s ? 'on' : '', '★'); st.style.animationDelay = (i * .25) + 's'; rs.append(st); }
    const got = el('div', 'got');
    for (const id of r.collected) { const wd = wordOf(id), row = el('div'); row.append(el('em', '', wd.emoji), el('span', '', wd.zh), el('small', '', wd.en)); got.append(row); }
    const idx = B.ROUTES.indexOf(r.route), next = B.ROUTES[idx + 1] || null;
    wrap.append(el('div', 'stamp', '完騎 ✓'), el('h2', '', r.route.title), rs, el('p', '', r.collected.length ? '撿到 ' + r.collected.length + ' 種小吃' : '這次沒撿到小吃'), got);
    wrap.append(button('bk-btn', next ? '下一條：' + next.title + ' ▶' : '再騎一次 ▶', () => { route = next || r.route; start(); }));
    const share = button('bk-link', '分享成績', async () => {
      const text = B.shareText(r) + '\n' + location.origin + '/bike.html';
      try { if (navigator.share) { await navigator.share({ title: '單車逛台中', text }); return; } await navigator.clipboard.writeText(text); share.textContent = '已複製'; } catch (e) { if (e && e.name !== 'AbortError') share.textContent = '分享不了，請截圖'; }
    });
    const learn = el('a', 'bk-link', '學這些單字 → 一口好英文'); learn.href = '/english.html';
    wrap.append(share, learn, button('bk-link', '選路線', menu));
    mount(wrap);
  }

  menu();
  window.BikeApp = Object.freeze({ menu, start, snapshot: () => run && { dist: run.dist, lane: run.lane, hearts: run.hearts, done: run.done, failed: run.failed, collected: run.collected.slice() }, course: () => run && run.course });
})();

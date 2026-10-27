/* City passport: dialog rendering and the shareable achievement card. Local only: nothing is uploaded.
 * Stars and badges record understanding, never support. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Passport = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ZONE_SHORT = { living: '生活', innovation: '創新', culture: '文化', nature: '山海', connection: '連結' };
  const ZONE_FILL = { living: '#4C9BF2', innovation: '#6EC6F0', culture: '#F4797B', nature: '#FFE6A0', connection: '#1A63C8' };
  // Everything printed on the card, so tests can scan it for forbidden wording.
  const CARD_TEXT = Object.freeze({
    head: '我走完了', headSecond: '15 個城市議題', done: '城市護照完成',
    mine: '我的城市護照', starsLabel: '理解星星',
    footer: Object.freeze(['概念示意・非施政成果・非官方互動', '尚未取得競選團隊授權或背書；理解議題，不代表立場。'])
  });
  const FORBIDDEN = Object.freeze(['投票', '支持', '推薦', '贊成', '拉票', '選我']);

  function cleanNick(value) {
    return Array.from(String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 10).join('');
  }
  function nickIssue(value) {
    const v = cleanNick(value);
    if (/(?:09\d{8}|[A-Z][12]\d{8}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\d{6,})/i.test(v)) return '請不要在暱稱放電話、身分證字號、電子郵件或長串數字。';
    return '';
  }

  const INK = '#06162B';
  const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function dotPattern(c) {
    const p = document.createElement('canvas'); p.width = p.height = 14;
    const k = p.getContext('2d'); k.fillStyle = '#FFFFFF'; k.fillRect(0, 0, 14, 14);
    k.fillStyle = INK; k.beginPath(); k.arc(7, 7, 3, 0, Math.PI * 2); k.fill();
    return c.createPattern(p, 'repeat');
  }
  function title3d(c, text, x, y, size, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); c.font = '900 ' + size + 'px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'top'; c.lineJoin = 'round';
    c.fillStyle = '#1A63C8'; for (let i = 1; i <= 14; i++) c.fillText(text, i, i);
    c.strokeStyle = INK; c.lineWidth = size * 0.13; c.strokeText(text, 14, 14); c.strokeText(text, 0, 0);
    c.fillStyle = dotPattern(c); c.fillText(text, 0, 0);
    c.restore();
  }
  function sparkle(c, x, y, r) {
    c.save(); c.strokeStyle = INK; c.lineWidth = r * 0.16; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; c.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.stroke(); c.restore();
  }
  /** data: { badges: zone ids, zones: [{id}], stars, maxStars, nickname } */
  function drawCard(canvas, data) {
    const c = canvas.getContext('2d'), W = 1080, H = 1350;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#FFE6A0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#6EC6F0'; c.beginPath(); c.arc(0, 0, 640, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F4797B'; c.beginPath(); c.arc(W, H, 560, 0, Math.PI * 2); c.fill();
    sparkle(c, 900, 150, 40); sparkle(c, 960, 560, 26); sparkle(c, 110, 1180, 30);
    title3d(c, CARD_TEXT.head, 80, 130, 150, -0.07);
    title3d(c, CARD_TEXT.headSecond, 120, 330, 118, -0.05);
    // sticker
    c.save(); c.translate(760, 560); c.rotate(-0.08); c.fillStyle = INK; rr(c, -196, -34, 400, 84, 42); c.fill(); c.fillStyle = '#FFFFFF'; rr(c, -204, -44, 400, 84, 42); c.fill();
    c.lineWidth = 8; c.strokeStyle = INK; rr(c, -204, -44, 400, 84, 42); c.stroke(); c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = '900 44px ' + FONT; c.fillText(CARD_TEXT.done, -4, 18); c.restore();
    // panel
    c.fillStyle = INK; rr(c, 76, 666, 936, 560, 56); c.fill();
    c.fillStyle = '#FFFFFF'; rr(c, 64, 650, 936, 560, 56); c.fill();
    c.lineWidth = 12; c.strokeStyle = INK; rr(c, 64, 650, 936, 560, 56); c.stroke();
    c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = '900 52px ' + FONT;
    const nick = cleanNick(data.nickname);
    c.fillText(nick ? nick + ' 的城市護照' : CARD_TEXT.mine, 532, 740);
    const zones = data.zones, gap = 176, startX = 532 - gap * (zones.length - 1) / 2;
    zones.forEach(function (z, i) {
      const x = startX + gap * i, y = 880, got = data.badges.indexOf(z.id) >= 0;
      c.fillStyle = got ? ZONE_FILL[z.id] : '#E3EFFF'; c.beginPath(); c.arc(x, y, 70, 0, Math.PI * 2); c.fill();
      c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
      c.fillStyle = got ? (z.id === 'nature' ? INK : '#FFFFFF') : '#9CC4F0'; c.font = '900 36px ' + FONT; c.fillText(ZONE_SHORT[z.id], x, y + 13);
    });
    c.fillStyle = INK; c.font = '800 40px ' + FONT; c.fillText(CARD_TEXT.starsLabel, 532, 1040);
    c.font = '900 92px ' + FONT; c.fillText('★ ' + data.stars + ' / ' + data.maxStars, 532, 1135);
    c.font = '700 26px ' + FONT; c.fillStyle = INK;
    CARD_TEXT.footer.forEach(function (line, i) { c.fillText(line, 540, 1262 + i * 38); });
  }

  function init(api) {
    const C = api.C, s = api.state, get = id => document.getElementById(id);
    const dlg = get('passportDialog'); if (!dlg) return { render() {} };
    function render() {
      const done = s.completed.length, total = C.MISSIONS.length, badges = C.badges(s);
      const bx = get('passportBadges'); bx.replaceChildren();
      C.ZONES.forEach(function (z) {
        const st = C.zoneStatus(s, z.id), b = document.createElement('div');
        b.className = 'passport-badge' + (st.complete ? ' is-got' : '') + (st.unlocked ? '' : ' is-locked');
        b.style.setProperty('--fill', ZONE_FILL[z.id]);
        b.innerHTML = '<i></i><b></b><small></small>';
        b.querySelector('i').textContent = st.unlocked ? ZONE_SHORT[z.id] : '🔒';
        b.querySelector('b').textContent = z.title;
        b.querySelector('small').textContent = st.done + ' / ' + st.total;
        b.setAttribute('aria-label', z.title + ' ' + st.done + ' / ' + st.total + (st.complete ? ' 已得徽章' : st.unlocked ? '' : ' 尚未開放'));
        bx.append(b);
      });
      const sx = get('passportStamps'); sx.replaceChildren();
      C.MISSIONS.forEach(function (m) {
        const cell = document.createElement('div'), got = s.completed.includes(m.id), open = C.missionUnlocked(s, m.id);
        cell.className = 'passport-stamp' + (got ? ' is-got' : '') + (!open ? ' is-locked' : '');
        cell.innerHTML = '<i></i><small></small>';
        cell.querySelector('i').textContent = got ? '✓' : open ? '？' : '🔒';
        cell.querySelector('small').textContent = got ? '★'.repeat(s.stars[m.id] || 1) : m.label;
        cell.setAttribute('aria-label', m.label + (got ? ' 已完成，' + (s.stars[m.id] || 1) + ' 顆星' : open ? ' 尚未完成' : ' 尚未開放'));
        sx.append(cell);
      });
      get('passportTotals').textContent = '已理解 ' + done + ' / ' + total + ' ・ 星星 ' + C.totalStars(s) + ' / ' + total * 3;
      const complete = C.passportComplete(s);
      get('passportCardBox').hidden = !complete;
      get('passportLocked').textContent = complete ? '' : '還差 ' + (total - done) + ' 個任務，集滿就能下載成就卡。';
      if (complete) drawCard(get('passportCard'), { badges, zones: C.ZONES, stars: C.totalStars(s), maxStars: total * 3, nickname: get('passportNick').value });
    }
    function open() { render(); if (!dlg.open) dlg.showModal(); }
    get('closePassport').addEventListener('click', () => dlg.close());
    get('passportNick').addEventListener('input', () => {
      const issue = nickIssue(get('passportNick').value);
      get('passportNickNote').textContent = issue;
      get('passportDownload').disabled = !!issue;
      if (!issue && C.passportComplete(s)) drawCard(get('passportCard'), { badges: C.badges(s), zones: C.ZONES, stars: C.totalStars(s), maxStars: C.MISSIONS.length * 3, nickname: get('passportNick').value });
    });
    get('passportDownload').addEventListener('click', () => {
      if (nickIssue(get('passportNick').value)) return;
      get('passportCard').toBlob(function (blob) {
        if (!blob) return;
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'taichung-city-passport.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      }, 'image/png');
    });
    get('passportClear').addEventListener('click', () => { if (api.onClear) api.onClear(); render(); });
    return { render, open };
  }
  return { init, drawCard, cleanNick, nickIssue, CARD_TEXT, FORBIDDEN, ZONE_SHORT };
}));

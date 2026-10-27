/* Anonymous interaction counters only. No identity, storage, or input collection. */
(function () {
  'use strict';

  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;

  var pathname = location.pathname;
  var pages = ['/', '/chat.html', '/adventure.html', '/bubble.html', '/policies.html',
    '/comic/', '/check/', '/postcard/', '/postcard/m/', '/fortune/', '/flavor/', '/privacy/'];
  var page = pages.find(function (candidate) {
    return pathname === candidate || (candidate !== '/' && (
      candidate.endsWith('.html') ? pathname === candidate + '/' : pathname === candidate.slice(0, -1)
    ));
  });
  if (!page) return;

  function send(type) {
    try {
      if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
      fetch('/api/metrics', {
        method: 'POST',
        credentials: 'omit',
        keepalive: true,
        mode: 'same-origin',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, page: page }),
      }).catch(function () { /* Best effort only: no retry queue. */ });
    } catch (_) { /* Offline, unavailable fetch, or request construction failure. */ }
  }

  send('page_view');

  var used = false;
  function observe(type, selector, qualifies) {
    // Capture catches controls before React handlers can rerender/remove them.
    document.addEventListener(type, function (event) {
      try {
        if (used || event.isTrusted !== true) return;
        if (type !== 'submit' && event.button !== 0) return;
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        if (target.closest(':disabled, [aria-disabled="true"]')) return;
        var control = target.closest(selector);
        if (!control || (qualifies && !qualifies(control))) return;
        used = true;
        send('feature_use');
      } catch (_) { /* Instrumentation must never interfere with the page. */ }
    }, true);
  }

  var clickSelectors = {
    '/bubble.html': 'button#startGame',
    '/adventure.html': 'button#avatarButton, button#openCityMap',
    '/flavor/': 'button#start-flavor',
    '/comic/': 'button[data-testid="comic-create"]',
    '/postcard/': 'button.postcard-play',
    '/postcard/m/': 'button.postcard-play',
  };
  if (clickSelectors[page]) observe('click', clickSelectors[page]);

  // Current /fortune/ is the capsule machine, not the older classic hold UI.
  // Count an explicit attempt, not a completed draw/hold. No card IDs are read.
  if (page === '/fortune/') {
    observe('click', 'button[data-testid="fortune-tap"], .fc-page button.fc-primary[data-primary="true"]', function (control) {
      return control.matches('button[data-testid="fortune-tap"]') ||
        !!control.closest('.fc-page').querySelector('.fc-machine');
    });
    observe('pointerdown', '.fc-machine .knob, button[data-testid="hold-button"]');
  }
  if (page === '/chat.html') observe('submit', 'form#form');
  // The actual check UI has no create testid: hold completion calls requestSubmit.
  if (page === '/check/') observe('submit', '.check-controls form');
}());

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '../public/anonymous-metrics.js');

// A deliberately small DOM: actual production IIFE runs unchanged in node:vm.
function browser(options = {}) {
  const requests = [];
  const listeners = new Map();
  const forbiddenReads = [];
  const document = {
    hidden: false,
    addEventListener(type, listener, capture) {
      const entries = listeners.get(type) || [];
      entries.push({ listener, capture });
      listeners.set(type, entries);
    },
  };
  const location = { pathname: options.pathname || '/' };
  const navigator = { doNotTrack: options.dnt, globalPrivacyControl: options.gpc };
  const context = { document, location, navigator, fetch(url, init) {
    requests.push({ url, init: JSON.parse(JSON.stringify(init)) });
    if (options.fetchThrows) throw new Error('offline');
    return options.fetchRejects ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true });
  } };
  for (const [object, names] of [
    [context, ['localStorage', 'sessionStorage', 'XMLHttpRequest']],
    [document, ['cookie', 'referrer']],
    [location, ['search', 'hash', 'href']],
    [navigator, ['userAgent', 'sendBeacon']],
  ]) for (const name of names) Object.defineProperty(object, name, { get() {
    forbiddenReads.push(name);
    throw new Error(`forbidden access: ${name}`);
  }, set() {
    forbiddenReads.push(`write:${name}`);
    throw new Error(`forbidden write: ${name}`);
  } });
  if (options.noFetch) delete context.fetch;
  context.window = context;
  context.self = context;
  vm.createContext(context);
  function run() {
    // No script yet means no behavior, giving a meaningful initial RED assertion.
    const source = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';
    vm.runInContext(source, context, { filename: scriptPath });
  }
  run();
  return {
    requests, forbiddenReads, listeners, navigator, location, document, run,
    payloads: () => requests.map(request => JSON.parse(request.init.body)),
    emit(type, target, extra = {}) {
      const event = { type, target, isTrusted: true, button: 0, ...extra };
      for (const { listener } of listeners.get(type) || []) listener(event);
      return event;
    },
  };
}

// Supports the standard compound/descendant selectors used by the client.
function element(tagName, attributes = {}, parentElement = null) {
  const node = {
    tagName: tagName.toUpperCase(), parentElement, children: [], nodeType: 1,
    disabled: attributes.disabled === true,
    textContent: attributes.textContent || '',
    getAttribute: name => attributes[name] ?? null,
    matches(selector) {
      return selector.split(',').some(part => {
        const tokens = part.trim().split(/\s+(?![^[]*\])/);
        function compound(candidate, token) {
          if (!candidate) return false;
          if (token === ':disabled') return candidate.disabled;
          const tag = token.match(/^[a-z]+/i)?.[0];
          if (tag && candidate.tagName !== tag.toUpperCase()) return false;
          for (const match of token.matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)) {
            if (match[1] && candidate.getAttribute('id') !== match[1]) return false;
            if (match[2] && !(candidate.getAttribute('class') || '').split(' ').includes(match[2])) return false;
            if (match[3] && (match[4] === undefined ? candidate.getAttribute(match[3]) === null
              : candidate.getAttribute(match[3]) !== match[4])) return false;
          }
          return true;
        }
        if (!compound(node, tokens.pop())) return false;
        let ancestor = node.parentElement;
        while (tokens.length) {
          const token = tokens.pop();
          while (ancestor && !compound(ancestor, token)) ancestor = ancestor.parentElement;
          if (!ancestor) return false;
          ancestor = ancestor.parentElement;
        }
        return true;
      });
    },
    closest(selector) {
      for (let candidate = node; candidate; candidate = candidate.parentElement) {
        if (candidate.matches(selector)) return candidate;
      }
      return null;
    },
    querySelector(selector) {
      for (const child of node.children) {
        if (child.matches(selector)) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    },
  };
  if (parentElement) parentElement.children.push(node);
  return node;
}

function privateElement(tagName, attributes, parent) {
  const node = element(tagName, attributes, parent);
  for (const key of ['value', 'innerHTML', 'innerText', 'textContent', 'id', 'name']) {
    Object.defineProperty(node, key, { get() { throw new Error(`must not read ${key}`); } });
  }
  return node;
}

test('a privacy opt-out enabled after startup suppresses subsequent feature requests', () => {
  for (const [key, value] of [['doNotTrack', '1'], ['globalPrivacyControl', true]]) {
    const app = browser({ pathname: '/chat.html' });
    app.navigator[key] = value;
    app.emit('submit', element('form', { id: 'form' }));
    assert.deepEqual(app.payloads(), [{ type: 'page_view', page: '/chat.html' }], key);
  }
});

test('synchronous, rejected and unavailable network transports fail silently without retries', async () => {
  for (const failure of [{ fetchThrows: true }, { fetchRejects: true }, { noFetch: true }]) {
    let app;
    assert.doesNotThrow(() => { app = browser({ pathname: '/chat.html', ...failure }); });
    const form = element('form', { id: 'form' });
    assert.doesNotThrow(() => app.emit('submit', form));
    assert.doesNotThrow(() => app.emit('submit', form));
    // Let rejected promises surface to node:test if the script failed to catch them.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.requests.length, failure.noFetch ? 0 : 2);
    assert.deepEqual(app.forbiddenReads, []);
  }
});

test('disabled controls, right clicks and non-element targets never count or break the UI', () => {
  const app = browser({ pathname: '/bubble.html' });
  const disabled = element('button', { id: 'startGame', disabled: true });
  const ariaDisabled = element('button', { id: 'startGame', 'aria-disabled': 'true' });
  const fieldset = element('fieldset', { disabled: true });
  const inheritedDisabled = element('button', { id: 'startGame' }, fieldset);
  // Native :disabled includes fieldset inheritance (modeled explicitly here).
  inheritedDisabled.disabled = true;
  for (const button of [disabled, ariaDisabled, inheritedDisabled]) {
    app.emit('click', element('svg', {}, button));
  }
  const enabled = element('button', { id: 'startGame' });
  app.emit('click', enabled, { button: 2 });
  for (const target of [null, {}, { nodeType: 3, parentElement: null }]) {
    assert.doesNotThrow(() => app.emit('click', target));
  }
  assert.equal(app.requests.length, 1);
  const event = app.emit('click', enabled, {
    preventDefault() { throw new Error('must not block default'); },
    stopPropagation() { throw new Error('must not stop propagation'); },
  });
  assert.equal(event.type, 'click');
  assert.equal(app.requests.length, 2);
});

test('fortune recognizes the current machine spin/knob, plus explicit tap/hold controls only', () => {
  for (const action of ['spin', 'knob', 'tap', 'hold']) {
    const app = browser({ pathname: '/fortune/' });
    const page = element('div', { class: 'fc-page' });
    const share = element('button', { class: 'fc-primary', 'data-primary': 'true' }, page);
    app.emit('click', share); // primary share/open/collection buttons are not spin
    const machine = element('div', { class: 'fc-machine' }, page);
    const knob = element('div', { class: 'knob' }, machine);
    app.emit('click', element('button', { class: 'fc-chip' }, page));
    app.emit('pointerdown', knob, { isTrusted: false });
    assert.equal(app.requests.length, 1, 'no navigation or auto-start counts');
    const target = action === 'spin' ? share : action === 'knob' ? knob
      : element('button', { 'data-testid': action === 'tap' ? 'fortune-tap' : 'hold-button' });
    const eventType = action === 'knob' || action === 'hold' ? 'pointerdown' : 'click';
    app.emit(eventType, element('span', {}, target));
    app.emit(eventType, target);
    app.emit('click', share);
    assert.deepEqual(app.payloads(), [
      { type: 'page_view', page: '/fortune/' }, { type: 'feature_use', page: '/fortune/' },
    ], action + ': attempt/interaction, not a verified completed draw or hold');
    assert.deepEqual(app.forbiddenReads, []);
  }
});

test('check counts the actual scoped create submit including requestSubmit after stamp hold', () => {
  const app = browser({ pathname: '/check/' });
  const controls = element('section', { class: 'check-controls' });
  const form = privateElement('form', {}, controls);
  const stamp = privateElement('button', { class: 'check-generate', type: 'submit' }, form);
  app.emit('input', privateElement('textarea', { id: 'check-wish' }, form));
  app.emit('pointerdown', stamp);
  app.emit('click', stamp);
  app.emit('submit', element('form'));
  app.emit('submit', form, { isTrusted: false });
  assert.equal(app.requests.length, 1, 'press alone is not a completed create submission');
  app.emit('submit', form); // browsers emit trusted submit for requestSubmit()
  app.emit('submit', form);
  assert.deepEqual(app.payloads(), [
    { type: 'page_view', page: '/check/' }, { type: 'feature_use', page: '/check/' },
  ]);
  assert.deepEqual(app.forbiddenReads, []);
});

test('delegated clicks count only frozen meaningful selectors on their own feature route', () => {
  const cases = [
    ['/bubble.html', { id: 'startGame' }],
    ['/adventure.html', { id: 'avatarButton' }],
    ['/adventure.html', { id: 'openCityMap' }],
    ['/flavor/', { id: 'start-flavor' }],
    ['/comic/', { 'data-testid': 'comic-create' }],
    ['/postcard/', { class: 'postcard-play' }],
    ['/postcard/m/', { class: 'postcard-play' }],
  ];
  for (const [pathname, attributes] of cases) {
    const app = browser({ pathname });
    app.emit('click', element('button', { id: 'other', 'data-testid': 'studio-share' }));
    app.emit('click', element('a', { ...attributes, href: '/comic/' }));
    const button = privateElement('button', attributes); // created after IIFE ran
    const child = privateElement('svg', {}, button);
    app.emit('click', child, { isTrusted: false });
    app.emit('pointerdown', child);
    app.emit('input', child);
    assert.equal(app.requests.length, 1, pathname + ': no auto or unrelated use');
    app.emit('click', child);
    app.emit('click', button);
    app.emit('click', child);
    assert.deepEqual(app.payloads(), [
      { type: 'page_view', page: pathname }, { type: 'feature_use', page: pathname },
    ], pathname);
    assert.deepEqual(app.forbiddenReads, [], pathname);
    assert.equal(app.listeners.get('click')[0].capture, true, 'capture before React rerender');
  }
  for (const pathname of ['/', '/policies.html', '/privacy/', '/chat.html']) {
    const app = browser({ pathname });
    for (const [, attributes] of cases) app.emit('click', element('button', attributes));
    assert.equal(app.requests.length, 1, pathname + ': not an eligible feature');
  }
});

test('chat counts only the first explicit form#form submit, not input, navigation or rendering', () => {
  const app = browser({ pathname: '/chat.html' });
  assert.equal(app.requests.length, 1);
  const form = privateElement('form', { id: 'form' });
  app.emit('input', privateElement('input', { id: 'input' }, form));
  app.emit('click', element('a', { href: '/bubble.html' }));
  app.emit('submit', element('form', { id: 'other' }));
  app.emit('submit', form, { isTrusted: false });
  assert.equal(app.requests.length, 1);
  app.emit('submit', form);
  app.emit('submit', form);
  app.emit('pageshow', form);
  assert.deepEqual(app.payloads(), [
    { type: 'page_view', page: '/chat.html' },
    { type: 'feature_use', page: '/chat.html' },
  ]);
  assert.deepEqual(app.forbiddenReads, []);
});

test('DNT and Global Privacy Control opt out before any request or event listeners', () => {
  for (const privacy of [{ dnt: '1' }, { gpc: true }, { dnt: '0', gpc: true }]) {
    const app = browser({ pathname: '/chat.html', ...privacy });
    assert.deepEqual(app.payloads(), []);
    assert.equal(app.listeners.size, 0);
    assert.deepEqual(app.forbiddenReads, []);
  }
  for (const privacy of [{ dnt: '0' }, { dnt: 'unspecified' }, { gpc: false }]) {
    assert.equal(browser(privacy).requests.length, 1);
  }
});

test('canonicalizes only the exact public route allowlist without reading query or hash', () => {
  const routes = ['/', '/chat.html', '/adventure.html', '/bubble.html', '/policies.html',
    '/comic/', '/check/', '/postcard/', '/postcard/m/', '/fortune/', '/flavor/', '/privacy/'];
  for (const canonical of routes) {
    const variants = canonical === '/' ? ['/'] : canonical.endsWith('.html')
      ? [canonical, canonical + '/'] : [canonical, canonical.slice(0, -1)];
    for (const pathname of variants) {
      const app = browser({ pathname });
      assert.deepEqual(app.payloads(), [{ type: 'page_view', page: canonical }], pathname);
      assert.deepEqual(app.forbiddenReads, [], pathname);
    }
  }
  // No verified /bubble/ redirect exists in source: do not invent that alias.
  for (const pathname of ['/unknown', '/bubble/', '/chat', '/fortune/classic/', '/comic/story',
    '//comic/', '/COMIC/', '/%63omic/', '/postcard/m/private', '/chat.html//', '/comic//',
    '/comic/?private=1', '/comic/#private']) {
    const app = browser({ pathname });
    assert.deepEqual(app.payloads(), [], pathname);
    assert.equal(app.listeners.size, 0, pathname);
  }
});

test('auto-runs one bounded first-party page view with credentials omitted', () => {
  const app = browser({ pathname: '/chat.html' });
  assert.deepEqual(app.payloads(), [{ type: 'page_view', page: '/chat.html' }]);
  assert.equal(app.requests[0].url, '/api/metrics');
  assert.deepEqual(app.requests[0].init, {
    method: 'POST', credentials: 'omit', keepalive: true,
    mode: 'same-origin', referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'page_view', page: '/chat.html' }),
  });
  assert.deepEqual(app.forbiddenReads, []);
});

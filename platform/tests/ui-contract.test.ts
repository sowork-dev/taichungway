import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const root = resolve(import.meta.dirname, '..');

const fixtureSites = () => ['check', 'fortune', 'flavor', 'postcard', 'comic'].map(id => ({
  id, title: id === 'fortune' ? '沾福氣' : '互動體驗', tagline: '玩一口日常',
  url: `https://${id}.example.test/`, durationSec: 30, usesAI: ['check', 'comic'].includes(id),
  accent: '#173F4C', status: id === 'fortune' || id === 'flavor' ? 'live' : 'soon',
}));

test('live directory accepts exactly five safe records and builds tagged live links only', async () => {
  const ui = await import('../packages/ui/src/index');
  assert.equal(typeof ui.validateSites, 'function', 'shared live-directory validator must exist');
  const valid = ui.validateSites(fixtureSites(), 'http://localhost:4173');
  assert.equal(valid?.length, 5);
  assert.equal(ui.siteHref(valid![0]!), undefined, 'soon cards must not have a navigation target');
  const live = new URL(ui.siteHref(valid![1]!)!);
  assert.equal(live.searchParams.get('utm_source'), 'hub');
  assert.equal(live.searchParams.get('utm_medium'), 'card');
  assert.equal(live.searchParams.get('utm_campaign'), 'fortune');
  for (const invalid of [fixtureSites().slice(1), [...fixtureSites().slice(0, 6), fixtureSites()[0]]]) {
    assert.equal(ui.validateSites(invalid, 'http://localhost:4173'), null);
  }
  for (const unsafe of ['javascript:alert(1)', 'http://fortune.example.test/', 'http://localhost:5000/', 'https://user:pass@example.test/']) {
    const data = fixtureSites(); data[1]!.url = unsafe;
    assert.equal(ui.validateSites(data, 'http://localhost:4173'), null, unsafe);
  }
  const local = fixtureSites(); local[1]!.url = 'http://localhost:4173/fortune/';
  assert.equal(ui.validateSites(local, 'http://localhost:4173')?.length, 5);
  const secure = fixtureSites(); secure[1]!.url = 'https://fortune.example.test/?keep=yes';
  assert.equal(new URL(ui.siteHref(ui.validateSites(secure, 'http://localhost:4173')![1]!)!).searchParams.get('keep'), 'yes');
});
const read = (file: string) => { assert.ok(existsSync(resolve(root, file)), `Missing UI deliverable: ${file}`); return readFileSync(resolve(root, file), 'utf8'); };

test('hub source contract renders the live directory without making soon cards clickable', () => {
  const hub = read('apps/hub/app/page.tsx');
  assert.match(hub, /useSites/);
  assert.match(hub, /siteHref/);
  assert.match(hub, /durationSec/);
  assert.match(hub, /usesAI/);
  assert.match(hub, /即將上線/);
  const shell = read('packages/ui/src/index.tsx');
  assert.match(shell, /cache: 'no-store'/);
  assert.match(shell, /30_000/);
  assert.match(shell, /visibilitychange/);
  assert.match(shell, /addEventListener\('focus'/);
  assert.match(shell, /SitesContext.Provider/);
  const css = read('packages/ui/src/styles.css');
  assert.match(css, /#F3F8FF/i); // CJ: all surfaces now use the candidate-blue family.
  assert.match(css, /max-width:\s*480px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /large-type/);
  assert.match(css, /\.hub-hero h1\s*\{[^}]*font-size:\s*clamp\(/, 'editorial heading must fit beside its stamp without an orphan character at 390px');
  assert.match(css, /\.result-heading h1:focus/, 'programmatic result-heading focus must not paint an interactive-button outline');
});

test('fortune feedback starts immediately, grows linearly, and caps at sixty particles at 1.5 seconds', async () => {
  const ui = await import('../packages/ui/src/index');
  assert.equal(typeof ui.holdFeedback, 'function', 'fortune hold feedback must be implemented');
  assert.deepEqual(ui.holdFeedback(0), { progress: 0, particles: 1 });
  assert.deepEqual(ui.holdFeedback(750), { progress: 0.5, particles: 30 });
  assert.deepEqual(ui.holdFeedback(1500), { progress: 1, particles: 60 });
  assert.deepEqual(ui.holdFeedback(9000), { progress: 1, particles: 60 });
  for (let elapsed = 0; elapsed <= 1600; elapsed += 16) {
    const frame = ui.holdFeedback(elapsed);
    assert.ok(frame.particles >= 1 && frame.particles <= 60);
    assert.ok(frame.progress >= 0 && frame.progress <= 1);
  }
  const fortune = read('apps/fortune/app/classic/page.tsx'); // the hold-to-bless page moved to /fortune/classic/
  for (const selector of ['result-card', 'hold-button', 'fortune-tap']) assert.ok(fortune.includes(selector));
  assert.match(fortune, /onPointerCancel/);
  assert.match(fortune, /onLostPointerCapture/);
  assert.match(fortune, /visibilitychange/);
  assert.match(fortune, /requestAnimationFrame/);
  assert.match(fortune, /prefers-reduced-motion/);
  assert.match(fortune, /onKeyDown/);
});

test('flavor maps eight original results to distinct local scenes and provides a three-question replayable flow', async () => {
  const ui = await import('../packages/ui/src/index');
  assert.ok(ui.FLAVOR_ART, 'every flavor needs a local illustration mapping');
  assert.deepEqual(Object.keys(ui.FLAVOR_ART).sort(), ['market', 'tea', 'sea', 'home', 'oldtown', 'port', 'field', 'craft'].sort());
  assert.equal(new Set(Object.values(ui.FLAVOR_ART)).size, 8);
  const flavor = read('apps/flavor/app/page.tsx');
  assert.match(flavor, /scoreFlavor\(nextAnswers\)/);
  assert.match(flavor, /QUESTIONS\[/);
  assert.match(flavor, /question\.options\.map/);
  assert.match(flavor, /answer-\$\{index\}/);
  assert.match(flavor, /question-title/);
  assert.match(flavor, /result-card/);
  assert.match(flavor, /再玩一次/);
  assert.match(flavor, /https:\/\/taichungway.tw\/taste/);
  assert.doesNotMatch(flavor, /fetch\(|localStorage|sessionStorage|document\.cookie/);
});

test('share targets preserve deployed paths but exclude all nickname, answer and inbound query data', async () => {
  const ui = await import('../packages/ui/src/index');
  assert.equal(typeof ui.gameShareUrl, 'function', 'sharing must support both path and root deployments');
  assert.equal(ui.gameShareUrl('https://preview.example/fortune/?nickname=private&answers=012#result'), 'https://preview.example/fortune/');
  assert.equal(ui.gameShareUrl('https://flavor.example/?utm_source=hub#result'), 'https://flavor.example/');
  const source = read('packages/ui/src/index.tsx');
  assert.doesNotMatch(source, /^import .*from ['"]@taichung\/share-card['"]/m, 'heavy card renderer must stay lazy');
});

test('actual initial React markup includes five disabled-until-validated cards and accessible game controls', async () => {
  const require = createRequire(resolve(root, 'apps/hub/package.json'));
  const { createElement } = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const hub = (await import('../apps/hub/app/page')).default;
  const fortune = (await import('../apps/fortune/app/classic/page')).default;
  const flavor = (await import('../apps/flavor/app/page')).default;
  const hubHtml = renderToStaticMarkup(createElement(hub));
  assert.equal((hubHtml.match(/data-site-id=/g) ?? []).length, 5);
  assert.equal((hubHtml.match(/class="experience-card soon-card(?: wip-card)?"/g) ?? []).length, 5);
  assert.equal((hubHtml.match(/wip-card/g) ?? []).length, 4, 'comic, check, postcard and flavor are marked 趕工中');
  assert.equal((hubHtml.match(/趕工中/g) ?? []).length, 8, 'once on each card and once in the footer nav');
  assert.doesNotMatch(hubHtml, /href="(?:\/fortune\/|\/flavor\/)"/, 'initial state cannot assert stale availability');
  for (const Page of [fortune, flavor]) {
    const html = renderToStaticMarkup(createElement(Page));
    assert.match(html, /獨立互動預覽，非官方網站；尚未取得競選團隊授權或背書。/);
    assert.match(html, /aria-pressed="false"/);
    assert.doesNotMatch(html, /id="result-card"/);
  }
  const fortuneHtml = renderToStaticMarkup(createElement(fortune));
  assert.match(fortuneHtml, /id="hold-button"/);
  assert.match(fortuneHtml, /id="fortune-tap"/);
  assert.match(renderToStaticMarkup(createElement(flavor)), /id="start-flavor"/);
});

test('all three independent apps use the shared shell, styles, language and individual OG metadata', () => {
  const shell = read('packages/ui/src/index.tsx');
  assert.match(shell, /export function AppShell/);
  assert.match(shell, /大字模式/);
  assert.match(shell, /aria-pressed/);
  assert.match(shell, /獨立互動預覽，非官方網站；尚未取得競選團隊授權或背書。/);
  assert.match(shell, /https:\/\/taichungway.tw\//);
  assert.match(shell, /href="\/privacy\/"/);
  assert.match(shell, /href="\/"/);
  for (const app of ['hub', 'fortune', 'flavor']) {
    const layout = read(`apps/${app}/app/layout.tsx`);
    assert.match(layout, /@taichung\/ui\/styles.css/);
    assert.match(layout, /zh-Hant-TW/);
    assert.ok(layout.includes(`/og/${app}.png`));
    assert.match(layout, /1200/); assert.match(layout, /630/);
    assert.match(read(`apps/${app}/app/page.tsx`), /AppShell/);
  }
});

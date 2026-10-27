import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server');

test('real Rough.js SVG renders original scene geometry, four different actions, and three blue styles deterministically', async () => {
  const { ComicDrawing, buildPanelPaths } = await import('../apps/hub/app/comic/drawing');
  const { COMIC_SCENES, COMIC_STYLES, createComic } = await import('../apps/hub/app/comic/story');
  const sceneArt: string[] = [];
  for (const scene of COMIC_SCENES) {
    const story = createComic({ sceneId: scene.id, styleId: 'ink', nickname: '', event: '' });
    const drawings = story.panels.map((panel, index) => renderToStaticMarkup(createElement(ComicDrawing, { sceneId: scene.id, styleId: 'ink', panel, index })));
    assert.equal(new Set(drawings).size, 4, scene.id);
    for (const html of drawings) {
      assert.match(html, /<svg[^>]+role="img"/);
      assert.match(html, /<title>/);
      assert.ok((html.match(/<path /g) ?? []).length > 20);
      assert.doesNotMatch(html, /<text|<image|foreignObject|https?:/);
    }
    const generated = buildPanelPaths(scene.id, 0, 'ink');
    assert.deepEqual(generated, buildPanelPaths(scene.id, 0, 'ink'));
    assert.ok(generated.every(path => typeof path.d === 'string' && path.d.length > 2));
    sceneArt.push(JSON.stringify(generated));
  }
  assert.equal(new Set(sceneArt).size, 6);
  const styles = COMIC_STYLES.map(style => JSON.stringify(buildPanelPaths('market', 0, style.id)));
  assert.equal(new Set(styles).size, 3);
});

test('local story preserves supplied event separately and produces four distinct narrative beats in each scene', async () => {
  const { COMIC_SCENES, COMIC_STYLES, createComic } = await import('../apps/hub/app/comic/story');
  assert.equal(COMIC_STYLES.length, 3);
  assert.equal(new Set(COMIC_STYLES.map(style => style.id)).size, 3);
  for (const scene of COMIC_SCENES) {
    const story = createComic({ sceneId: scene.id, styleId: 'ink', nickname: '  小藍  ', event: '買菜時發現忘了帶購物袋' });
    assert.equal(story.nickname, '小藍');
    assert.equal(story.event, '買菜時發現忘了帶購物袋');
    assert.equal(story.sceneId, scene.id);
    assert.equal(story.policyId, scene.policyId);
    assert.equal(story.panels.length, 4);
    assert.deepEqual(story.panels.map(panel => panel.beat), ['起', '承', '轉', '合']);
    assert.equal(new Set(story.panels.map(panel => panel.action)).size, 4);
    assert.equal(new Set(story.panels.map(panel => panel.caption)).size, 4);
    for (const panel of story.panels) {
      assert.ok(Array.from(panel.caption).length <= 20);
      assert.ok(panel.description.length > 8);
      assert.ok(!panel.caption.includes(story.event), 'a supplied event must not become invented character dialogue');
    }
  }
});

test('caption edits cap Unicode safely, preserve input safety, and regeneration clears edits', async () => {
  const { createComic, editComicCaption } = await import('../apps/hub/app/comic/story');
  const input = { sceneId: 'market' as const, styleId: 'ink' as const, nickname: '😀'.repeat(15), event: '🌊'.repeat(70) };
  const original = createComic(input);
  assert.equal(Array.from(original.nickname).length, 10);
  assert.equal(Array.from(original.event).length, 60);
  const edited = editComicCaption(original, 1, '🍃'.repeat(24));
  assert.equal(Array.from(edited.panels[1].caption).length, 20);
  assert.notEqual(edited.panels[1].caption, original.panels[1].caption);
  assert.equal(original.panels[1].caption, createComic(input).panels[1].caption);
  assert.deepEqual(editComicCaption(original, 99, 'invalid'), original);
  assert.equal(editComicCaption(original, 0, '<img onerror=alert(1)>').panels[0].caption, Array.from('<img onerror=alert(1)>').slice(0, 20).join(''));
  const changed = createComic({ ...input, sceneId: 'coast', styleId: 'print' });
  assert.equal(changed.sceneId, 'coast');
  assert.equal(changed.styleId, 'print');
  assert.equal(changed.policyId, 'RES-14');
  assert.notEqual(changed.panels[1].caption, edited.panels[1].caption);
});

test('editor state actually generates, edits, regenerates on scene/style change, and replays cleanly', async () => {
  const { comicReducer, initialComicState } = await import('../apps/hub/app/comic/editor');
  let state = comicReducer(initialComicState, { type: 'generate' });
  assert.equal(state.story, null, 'a blank event cannot generate a personal comic');
  state = comicReducer(state, { type: 'event', value: '  今天在公園散步  ' });
  state = comicReducer(state, { type: 'nickname', value: '阿藍' });
  state = comicReducer(state, { type: 'generate' });
  assert.ok(state.story);
  assert.equal(state.story.event, '今天在公園散步');
  state = comicReducer(state, { type: 'caption', index: 2, value: '我自己改寫的第三格' });
  assert.equal(state.story?.panels[2].caption, '我自己改寫的第三格');
  state = comicReducer(state, { type: 'scene', value: 'park' });
  assert.equal(state.story?.policyId, 'RES-12');
  assert.notEqual(state.story?.panels[2].caption, '我自己改寫的第三格');
  state = comicReducer(state, { type: 'caption', index: 0, value: '再修改' });
  state = comicReducer(state, { type: 'style', value: 'notebook' });
  assert.equal(state.story?.styleId, 'notebook');
  assert.notEqual(state.story?.panels[0].caption, '再修改');
  assert.deepEqual(comicReducer(state, { type: 'replay' }), initialComicState);
});

test('exported artwork includes four real drawings, safe supplied text, exact policy and visible nonofficial disclosures', async () => {
  const { ComicArtwork } = await import('../apps/hub/app/comic/comic-artwork');
  const { createComic, editComicCaption } = await import('../apps/hub/app/comic/story');
  const { POLICIES } = await import('../packages/policy-data/src/index');
  let story = createComic({ sceneId: 'mountain', styleId: 'print', nickname: '<小藍>', event: '<script>alert(1)</script>' });
  story = editComicCaption(story, 0, '<img src=x>');
  const html = renderToStaticMarkup(createElement(ComicArtwork, { story }));
  assert.equal((html.match(/data-testid="comic-panel-[1-4]"/g) ?? []).length, 4);
  assert.equal((html.match(/class="comic-drawing"/g) ?? []).length, 4);
  for (const text of ['巷口四格漫畫', '你的原文', '預製故事版・不使用 AI', '江啟臣政見 · 非施政成果 · 概念示意非實測結果', '非官方互動；尚未取得競選團隊授權或背書。']) assert.ok(html.includes(text), text);
  assert.ok(html.includes(POLICIES.find(policy => policy.id === 'EDU-27')!.title));
  assert.ok(html.includes('href="https://taichungway.tw/future"'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.doesNotMatch(html, /<script|<img|dangerouslySetInnerHTML|<input|<textarea/);
});

test('client studio renders usable controls and gates four editable captions plus export until generation', async () => {
  const { ComicStudio } = await import('../apps/hub/app/comic/studio');
  const { comicReducer, initialComicState } = await import('../apps/hub/app/comic/editor');
  const initial = renderToStaticMarkup(createElement(ComicStudio));
  assert.match(initial, /data-testid="comic-create"/);
  assert.match(initial, /data-testid="comic-replay"/);
  assert.equal((initial.match(/data-testid="comic-scene-/g) ?? []).length, 6);
  assert.equal((initial.match(/data-testid="comic-style-/g) ?? []).length, 3);
  assert.match(initial, /id="comic-event"[^>]+required=""/);
  assert.match(initial, /aria-describedby="comic-event-help"/);
  assert.match(initial, /範例預覽/);
  assert.doesNotMatch(initial, /data-testid="comic-caption-[1-4]"|data-testid="studio-download"/);
  let generated = comicReducer(initialComicState, { type: 'event', value: '今天路過市場買了蔥' });
  generated = comicReducer(generated, { type: 'generate' });
  const result = renderToStaticMarkup(createElement(ComicStudio, { initialState: generated }));
  assert.equal((result.match(/data-testid="comic-caption-[1-4]"/g) ?? []).length, 4);
  assert.match(result, /data-testid="studio-download"/);
  assert.match(result, /data-testid="studio-share"/);
  assert.match(result, /class="studio-artwork comic-artwork"/);
  assert.match(result, /今天路過市場買了蔥/);
  assert.match(result, /data-policy-id="IND-19"/);
  assert.match(result, /role="status"/);
});

test('route declares production metadata and its own accessible editorial two-by-two comic styling', () => {
  const read = (name: string) => readFileSync(new URL(`../apps/hub/app/comic/${name}`, import.meta.url), 'utf8');
  const layout = read('layout.tsx');
  assert.match(layout, /metadataBase:\s*new URL\('https:\/\/taichungway.sowork.ai'\)/);
  assert.match(layout, /canonical:\s*'\/comic\/'/);
  assert.match(layout, /import '\.\/comic.css'/);
  const css = read('comic.css');
  assert.match(css, /\.comic-panels\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /min-height:\s*44px/);
  for (const name of ['page.tsx', 'studio.tsx', 'editor.ts', 'story.ts', 'drawing.tsx', 'comic-artwork.tsx']) assert.doesNotMatch(read(name), /fetch\s*\(|localStorage|sessionStorage|dangerouslySetInnerHTML|document.cookie/);
});

test('obvious contact details, identity numbers, and street addresses cannot generate or regenerate comics', async () => {
  const { comicInputIssue, comicReducer, initialComicState } = await import('../apps/hub/app/comic/editor');
  const blocked = ['請打 0912-345-678', '電話 04-22334455', '找我 hello@example.com', '證號 A123456789', '住台中市西區公益路12號', '寄到 123 Main Street', '０９１２３４５６７８'];
  for (const value of blocked) {
    assert.ok(comicInputIssue({ event: value, nickname: '' }), value);
    const state = comicReducer({ ...initialComicState, event: value }, { type: 'generate' });
    assert.equal(state.story, null, value);
  }
  assert.equal(comicInputIssue({ event: '等了公車 10 分鐘，去台中市西區散步', nickname: '小藍' }), null);
  assert.ok(comicInputIssue({ event: '去公園散步', nickname: 'A123456789' }));
  let state = comicReducer({ ...initialComicState, event: '今天在市場買菜' }, { type: 'generate' });
  state = comicReducer(state, { type: 'event', value: '聯絡我 hello@example.com' });
  state = comicReducer(state, { type: 'scene', value: 'coast' });
  assert.equal(state.story, null, 'scene changes may not bypass privacy validation');
});

test('privacy rejection is visibly explained next to inputs and disables generation', async () => {
  const { ComicStudio } = await import('../apps/hub/app/comic/studio');
  const { initialComicState } = await import('../apps/hub/app/comic/editor');
  const html = renderToStaticMarkup(createElement(ComicStudio, { initialState: { ...initialComicState, event: '聯絡 hello@example.com' } }));
  assert.match(html, /id="comic-privacy-warning"[^>]*role="alert"/);
  assert.match(html, /請移除電話、Email、證號或詳細地址/);
  assert.match(html, /data-testid="comic-create"[^>]*disabled=""/);
  assert.match(html, /id="comic-event"[^>]*aria-invalid="true"/);
  assert.doesNotMatch(html, /data-testid="studio-download"/);
});

test('changing a scene before creation updates both sample event and the policy source coherently', async () => {
  const { ComicStudio } = await import('../apps/hub/app/comic/studio');
  const { initialComicState } = await import('../apps/hub/app/comic/editor');
  const html = renderToStaticMarkup(createElement(ComicStudio, { initialState: { ...initialComicState, sceneId: 'coast' } }));
  const sample = html.match(/class="comic-supplied"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.ok(sample.includes('海線'));
  assert.ok(!sample.includes('市場'));
  assert.ok(html.includes('data-policy-id="RES-14"'));
});

// Real local story helpers; no network, generated fixture API, or mocked policies.
test('six public scenes map to the same canonical policy catalog for every visitor', async () => {
  const { COMIC_SCENES } = await import('../apps/hub/app/comic/story');
  const { POLICIES } = await import('../packages/policy-data/src/index');
  assert.deepEqual(COMIC_SCENES.map(scene => scene.label), ['市場', '巷口', '公園', '車站', '山線', '海線']);
  assert.deepEqual(COMIC_SCENES.map(scene => scene.policyId), ['IND-19', 'TRA-06', 'RES-12', 'TRA-07', 'EDU-27', 'RES-14']);
  for (const scene of COMIC_SCENES) {
    const canonical = POLICIES.find(policy => policy.id === scene.policyId);
    assert.ok(canonical);
    assert.equal(scene.policy.title, canonical.title);
    assert.equal(scene.policy.sourceUrl, canonical.sourceUrl);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve(import.meta.dirname, '../apps/hub/package.json'));
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('studio canonical policy lookup fails closed and preserves exact source wording', async () => {
  const { readPolicy, cleanText } = await import('../packages/ui/src/studio');
  assert.equal(readPolicy('TRA-06').title, '打造全齡友善人本道路');
  assert.equal(readPolicy('IND-19').sourceUrl, 'https://taichungway.tw/future');
  assert.throws(() => readPolicy('TRA-06?fake=1'));
  assert.equal(cleanText(' 你好😀世界 ', 3), '你好😀');
  assert.equal(cleanText('ab\u0000cd', 20), 'abcd');
});

test('new studio shell labels current route and source/disclosure remains inside exported content', async () => {
  const { StudioShell, PolicySource, safeStudioShareUrl } = await import('../packages/ui/src/studio');
  const source = renderToStaticMarkup(createElement(PolicySource, {policyId:'IND-19'}));
  for (const text of ['公有市場裝冷氣，打造特色市場', 'https://taichungway.tw/future']) assert.ok(source.includes(text), text);
  const html = renderToStaticMarkup(createElement(StudioShell, {id:'comic', kicker:'COMIC', title:'巷口四格漫畫', description:'自己的日常'}, createElement('p', null, '測試內容')));
  assert.match(html, /aria-current="page"/);
  assert.match(html, /href="\/check\/"/);
  assert.match(html, /href="\/postcard\/"/);
  assert.match(html, /未取得競選團隊授權或背書/);
  assert.equal(safeStudioShareUrl('https://taichungway.sowork.ai/comic/?note=private#result'), 'https://taichungway.sowork.ai/comic/');
  assert.equal(safeStudioShareUrl('https://taichungway.sowork.ai/postcard/m/?mix=d01:80,d17:30&note=private'), 'https://taichungway.sowork.ai/postcard/m/?mix=d01%3A80%2Cd17%3A30');
  for (const mix of ['d01:101','d01:50,d01:20','d00:40','d01:50,d02:50,d03:50,d04:50','d01:3.2','d01:5evil']) assert.equal(safeStudioShareUrl('https://taichungway.sowork.ai/postcard/m/?mix='+encodeURIComponent(mix)), 'https://taichungway.sowork.ai/postcard/m/');
});

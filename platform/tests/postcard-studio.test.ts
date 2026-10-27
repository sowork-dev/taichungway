import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const dataPath = resolve(root, 'apps/hub/app/postcard/postcard-data.ts');
const districts = ['中區','東區','南區','西區','北區','西屯區','南屯區','北屯區','豐原區','東勢區','大甲區','清水區','沙鹿區','梧棲區','后里區','神岡區','潭子區','大雅區','新社區','石岡區','外埔區','大肚區','烏日區','霧峰區','大里區','太平區','龍井區','和平區','大安區'];

test('29 unique real Taichung districts have explicit editorial synthetic beds in four visual groups', async () => {
  assert.ok(existsSync(dataPath), 'postcard district catalog must exist');
  const { DISTRICTS, GROUPS, SOUND_BEDS, SYNTHETIC_NOTICE } = await import('../apps/hub/app/postcard/postcard-data');
  assert.deepEqual(DISTRICTS.map(d => d.name).sort(), [...districts].sort());
  assert.equal(new Set(DISTRICTS.map(d => d.id)).size, 29);
  assert.deepEqual(GROUPS, ['山', '海', '屯', '城']);
  for (const d of DISTRICTS) {
    assert.match(d.id, /^d(?:0[1-9]|[12][0-9])$/);
    assert.ok(GROUPS.includes(d.group));
    assert.ok(SOUND_BEDS[d.bed]);
    assert.match(SOUND_BEDS[d.bed].src, /^\/audio\/city-(market|sea|birds|rain|train|bell)\.wav$/);
  }
  for (const [name, bed] of [['中區','market'],['西區','birds'],['清水區','sea'],['東勢區','birds'],['和平區','rain'],['大里區','train']]) {
    assert.equal(DISTRICTS.find(d => d.name === name)?.bed, bed);
  }
  assert.equal(SYNTHETIC_NOTICE, '合成聲景示意・非在地實錄');
});

test('strict mix codec round trips at most three allowlisted unique districts and integer gains', async () => {
  const data = await import('../apps/hub/app/postcard/postcard-data');
  assert.equal(typeof data.parseMix, 'function', 'strict mix parser must exist');
  const entries = [{ id: 'd01', volume: 80 }, { id: 'd17', volume: 60 }, { id: 'd22', volume: 40 }];
  assert.deepEqual(data.parseMix('d01:80,d17:60,d22:40'), entries);
  assert.equal(data.serializeMix(entries), 'd01:80,d17:60,d22:40');
  assert.deepEqual(data.parseMix('d01:0,d29:100'), [{ id: 'd01', volume: 0 }, { id: 'd29', volume: 100 }]);
  for (const invalid of [null, '', 'd01:80,d01:60', 'd00:80', 'd30:60', 'd1:80', 'd01:-1', 'd01:101', 'd01:3.5', 'd01:01', 'd01:+1', 'd01:1e2', 'd01:NaN', 'd01:80,', ',d01:80', 'd01:80,d02:70,d03:60,d04:50', 'junkd01:80', 'd01:80junk', ' d01:80', 'd01:80\n', 'd01:80&note=private', 'D01:80', 'd01:80,,d02:20']) {
    assert.equal(data.parseMix(invalid), null, String(invalid));
  }
  for (const invalid of [[], [{ id: 'd30', volume: 50 }], [{ id: 'd01', volume: 1.1 }], [{ id: 'd01', volume: 50 }, { id: 'd01', volume: 40 }]]) {
    assert.throws(() => data.serializeMix(invalid), TypeError);
  }
});

test('receiver accepts only the mix key and generated URLs never carry private text or inbound query data', async () => {
  const data = await import('../apps/hub/app/postcard/postcard-data');
  assert.equal(typeof data.parseReceiverSearch, 'function', 'receiver query validator must exist');
  const mix = [{ id: 'd01', volume: 80 }, { id: 'd17', volume: 60 }];
  assert.deepEqual(data.parseReceiverSearch('?mix=d01:80,d17:60'), mix);
  assert.deepEqual(data.parseReceiverSearch('?mix=d01%3A80%2Cd17%3A60'), mix);
  for (const invalid of ['', '?mix=', '?mix=d01:80&mix=d02:80', '?mix=d01:80&note=private', '?note=private&mix=d01:80', '?junkmix=d01:80', '?mix=junkd01:80']) assert.equal(data.parseReceiverSearch(invalid), null, invalid);
  const url = new URL(data.buildMixUrl('http://localhost:4173/postcard/?note=private#nickname', mix));
  assert.equal(url.pathname, '/postcard/m/');
  assert.equal(url.hash, '');
  assert.deepEqual([...url.searchParams.keys()], ['mix']);
  assert.deepEqual(data.parseReceiverSearch(url.search), mix);
});

test('mixer preloads selected assets only, overlaps gesture playback, confirms play events, fades and releases removed/hidden clips', async () => {
  const path = resolve(root, 'apps/hub/app/postcard/postcard-audio.ts');
  assert.ok(existsSync(path), 'gesture-driven Howler adapter must exist');
  const { PostcardAudio } = await import('../apps/hub/app/postcard/postcard-audio');
  const sounds: any[] = [];
  const factory = (options: any) => {
    const calls: any[] = [];
    let gain = 0;
    const sound = { options, calls, play: () => { calls.push(['play']); return 1; }, stop: () => calls.push(['stop']), unload: () => calls.push(['unload']), loop: (v: boolean) => calls.push(['loop', v]), volume: (v?: number) => { if (v !== undefined) { gain = v; calls.push(['volume', v]); } return gain; }, fade: (a: number, b: number, ms: number) => { gain = b; calls.push(['fade', a, b, ms]); } };
    sounds.push(sound); return sound;
  };
  let updates = 0;
  const player = new PostcardAudio(factory, () => { updates++; });
  assert.equal(sounds.length, 0);
  player.select([{ id: 'd01', volume: 80 }, { id: 'd12', volume: 60 }]);
  assert.equal(sounds.length, 2);
  for (const sound of sounds) {
    assert.equal(sound.options.html5, false);
    assert.equal(sound.options.preload, true);
    assert.equal(sound.options.autoplay, false);
    assert.equal(sound.options.loop, true);
    assert.equal(sound.calls.filter((c: any[]) => c[0] === 'play').length, 0);
    sound.options.onload();
  }
  player.play();
  assert.equal(player.status('d01').state, 'starting', 'play() return is not proof of playback');
  for (const sound of sounds) { assert.equal(sound.calls.filter((c: any[]) => c[0] === 'play').length, 1); sound.options.onplay(1); }
  assert.equal(player.status('d01').state, 'playing');
  assert.ok(sounds[0].calls.some((c: any[]) => JSON.stringify(c) === JSON.stringify(['fade', 0, .8, 200])));
  player.select([{ id: 'd01', volume: 20 }, { id: 'd12', volume: 60 }]);
  assert.ok(sounds[0].calls.some((c: any[]) => c[0] === 'fade' && c[2] === .2 && c[3] === 200));
  player.select([{ id: 'd01', volume: 20 }]);
  assert.ok(sounds[1].calls.some((c: any[]) => c[0] === 'stop'));
  assert.ok(sounds[1].calls.some((c: any[]) => c[0] === 'unload'));
  player.stop(true);
  assert.equal(player.status('d01').state, 'stopped');
  assert.ok(sounds[0].calls.some((c: any[]) => c[0] === 'unload'));
  sounds[0].options.onplay(1);
  assert.equal(player.status('d01').state, 'stopped', 'stale callbacks cannot resume hidden audio');
  player.dispose();
  assert.ok(updates > 0);
});

test('load/play errors remain visible and repeat gesture recreates a failed clip without false success', async () => {
  const path = resolve(root, 'apps/hub/app/postcard/postcard-audio.ts');
  assert.ok(existsSync(path), 'gesture-driven Howler adapter must exist');
  const { PostcardAudio } = await import('../apps/hub/app/postcard/postcard-audio');
  const sounds: any[] = [];
  const player = new PostcardAudio((options: any) => {
    const sound = { options, play: () => 1, stop: () => {}, unload: () => {}, loop: () => {}, volume: () => 0, fade: () => {} }; sounds.push(sound); return sound;
  }, () => {});
  player.select([{ id: 'd01', volume: 50 }]);
  sounds[0].options.onloaderror(1, 'missing');
  assert.equal(player.status('d01').state, 'error');
  assert.match(player.status('d01').message, /載入失敗/);
  player.play();
  assert.equal(sounds.length, 2);
  assert.equal(player.status('d01').state, 'starting');
  sounds[1].options.onplayerror(1, 'blocked');
  assert.equal(player.status('d01').state, 'error');
  assert.match(player.status('d01').message, /播放失敗/);
  player.play();
  assert.equal(sounds.length, 3);
  sounds[2].options.onplay(1);
  assert.equal(player.status('d01').state, 'playing');
  player.dispose();
});

test('private note guard rejects email, phone, identity and address content before it can enter PNG text', async () => {
  const data = await import('../apps/hub/app/postcard/postcard-data');
  assert.equal(typeof data.privateTextReason, 'function', 'local-only private-text guard must exist');
  for (const value of ['寄給 hello@example.com', '打給 0912-345-678', '+886 912 345 678', '04-2345-6789', 'A123456789', '台中市西區公益路123號', '台灣大道二段99號', '123 Main Street']) assert.ok(data.privateTextReason(value), value);
  for (const value of ['', '今天，想把晚風寄給你。', '一位聽風的人', '山海屯城', '一起搭 302 公車']) assert.equal(data.privateTextReason(value), null, value);
});

test('studio and receiver SSR render honest blue postcard controls without audio autoplay or private URL fields', async () => {
  for (const route of ['page.tsx', 'm/page.tsx']) assert.ok(existsSync(resolve(root, 'apps/hub/app/postcard', route)), `postcard ${route} must exist`);
  const require = createRequire(resolve(root, 'apps/hub/package.json'));
  const { createElement } = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Studio = (await import('../apps/hub/app/postcard/page')).default;
  const Receiver = (await import('../apps/hub/app/postcard/m/page')).default;
  const html = renderToStaticMarkup(createElement(Studio));
  assert.equal((html.match(/data-postcard-district=/g) ?? []).length, 29);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length >= 29, true);
  for (const phrase of ['台中聲音明信片', '合成聲景示意・非在地實錄', '最多選 3 區', '不是地理地圖', '圖卡不含音訊；請另分享聆聽連結', '推動智慧噪音監測系統', '非監測數據', '非官方', '不是施政成果']) assert.ok(html.includes(phrase), phrase);
  assert.match(html, /maxlength="30"/i);
  assert.match(html, /maxlength="10"/i);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /<audio|autoplay="|nickname=/);
  const receiver = renderToStaticMarkup(createElement(Receiver));
  assert.match(receiver, /收到一張聲音明信片/);
  assert.match(receiver, /不會自動播放/);
  const client = readFileSync(resolve(root, 'apps/hub/app/postcard/postcard-studio.tsx'), 'utf8');
  assert.doesNotMatch(client, /useSearchParams|localStorage|sessionStorage|document\.cookie|getUserMedia|fetch\(/);
  assert.match(client, /visibilitychange/);
  assert.match(client, /pagehide/);
  assert.match(client, /new Howl\(options\)/);
});

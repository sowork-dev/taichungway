import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderCardSvg, validateCard } from '../packages/share-card/src/index.ts';
import { cleanShareUrl, shareResult } from '../packages/line/src/index.ts';

test('share URLs never carry nickname, answers, fragments or arbitrary query parameters', () => {
 const cleaned=cleanShareUrl('https://preview.example/fortune/?nickname=private&answers=123#secret');
 const u=new URL(cleaned); assert.equal(u.pathname,'/fortune/'); assert.equal(u.hash,'');
 assert.deepEqual([...u.searchParams.keys()],['utm_source','utm_medium','utm_campaign']);
 assert.equal(u.searchParams.get('utm_campaign'),'fortune');
 for(const url of ['javascript:alert(1)','https://preview.example/other/','https://user:pass@preview.example/flavor/','http://preview.example/flavor/'])assert.throws(()=>cleanShareUrl(url));
 assert.ok(cleanShareUrl('http://localhost:4189/flavor/').startsWith('http://localhost:4189/flavor/'));
});
test('native share, cancellation and clipboard fallback are explicit and preserve only sanitized URL', async()=>{
 let payload:unknown;
 assert.equal(await shareResult({title:'來玩',url:'https://preview.example/flavor/?nickname=private'},{share:async data=>{payload=data;}}),'shared');
 assert.doesNotMatch(JSON.stringify(payload),/private|nickname/);
 assert.equal(await shareResult({title:'來玩',url:'https://preview.example/flavor/'},{share:async()=>{throw Object.assign(new Error('cancel'),{name:'AbortError'});}}),'cancelled');
 let copied='';assert.equal(await shareResult({title:'來玩',url:'https://preview.example/flavor/'},{writeText:async value=>{copied=value;}}),'copied');
 assert.equal(new URL(copied).searchParams.get('utm_source'),'share');
});
test('card validates kind, nickname length and colors before any browser/network work',()=>{
 assert.equal(validateCard({kind:'fortune',title:'沾福氣',body:'願你有一口好茶。',nickname:'小王',accent:'#173F4C'}).nickname,'小王');
 assert.throws(()=>validateCard({kind:'fortune',title:'a',body:'b',nickname:'一二三四五六七八九十一',accent:'#173F4C'}));
 assert.throws(()=>validateCard({kind:'fortune',title:'a',body:'b',accent:'url(https://evil.example)'}));
 assert.throws(()=>validateCard({kind:'fortune',title:'a',body:'b\u0000',accent:'#173F4C'}));
});
test('actual Satori render embeds Chinese text as paths with no external references',async()=>{
 const bytes=readFileSync(new URL('../assets/fonts/LocalSansTC-Regular.ttf',import.meta.url));
 const font=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const svg=await renderCardSvg({kind:'fortune',title:'沾福氣',body:'願早餐的熱氣，也暖到今天的心情。',nickname:'小王',accent:'#173F4C',variant:'sea'},font);
 assert.match(svg,/<svg[^>]*width="1080"[^>]*height="1350"/);
 assert.match(svg,/<path/); assert.doesNotMatch(svg,/<script|<foreignObject|https?:\/\/[^" ]+\.(?:png|jpg|svg)/);
 assert.ok(svg.length>10000);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FORTUNE_STYLES,FLAVORS} from '../packages/experience/src/index.ts';
const root=new URL('../',import.meta.url);
const read=(path:string)=>readFileSync(new URL(path,root),'utf8');
const BRAND='#1A63C8';
function rgb(hex:string){const s=hex.slice(1,7);return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255);}
function blueOrNeutral(hex:string){const [r,g,b]=rgb(hex),max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;if(delta<.015)return true;let hue=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;hue=(hue*60+360)%360;return hue>=200&&hue<=225;}
function luminance(hex:string){return rgb(hex).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);}
function contrast(a:string,b:string){const la=luminance(a),lb=luminance(b);return (Math.max(la,lb)+.05)/(Math.min(la,lb)+.05);}
test('all shipped UI, scene artwork, card renderer, OG generator and directory colors stay blue or neutral',()=>{
 for(const path of ['packages/ui/src/styles.css','packages/ui/src/index.tsx','packages/share-card/src/index.ts','packages/experience/src/index.ts','data/sites.json','scripts/prepare-assets.py']){
  const colors=[...read(path).matchAll(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g)].map(match=>match[0]);
  assert.ok(colors.length>0,path);for(const color of colors)assert.ok(blueOrNeutral(color),`${path} contains non-blue ${color}`);
 }
});
test('candidate blue is the main CTA and every site/result accent, not just a small decorative stripe',()=>{
 const css=read('packages/ui/src/styles.css');assert.match(css,/--brand:\s*#1A63C8/);assert.match(css,/\.button\.primary\s*\{[^}]*background:\s*var\(--brand\)/);
 const sites=JSON.parse(read('data/sites.json'))as Array<{accent:string}>;assert.equal(sites.length,7);for(const site of sites)assert.equal(site.accent,BRAND);
 for(const flavor of FLAVORS)assert.equal(flavor.accent,BRAND);
});
test('twelve blue fortune palettes remain distinct, readable, and honestly named',()=>{
 assert.equal(FORTUNE_STYLES.length,12);assert.equal(new Set(FORTUNE_STYLES.map(style=>style.bg)).size,12);
 for(const style of FORTUNE_STYLES){assert.match(style.name,/藍/);assert.ok(contrast(style.ink,style.bg)>=4.5,`${style.id} text contrast`);assert.ok(contrast(style.accent,style.bg)>=3,`${style.id} accent contrast`);}
 assert.ok(contrast('#FFFFFF',BRAND)>=4.5);
});

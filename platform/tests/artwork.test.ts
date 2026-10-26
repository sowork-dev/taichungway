import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCardSvg} from '../packages/share-card/src/index.ts';
import {FLAVORS} from '../packages/experience/src/index.ts';
test('downloaded flavor cards retain eight distinct scene geometries rather than reusing a generic boat',async()=>{
 const bytes=readFileSync(new URL('../assets/fonts/LocalSansTC-Regular.ttf',import.meta.url));const font=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const geometries=[];
 for(const flavor of FLAVORS){
  const svg=await renderCardSvg({kind:'flavor',title:flavor.name,body:flavor.description,accent:flavor.accent,variant:flavor.id},font);
  const embed=svg.match(/href="data:image\/svg\+xml;utf8,([^"]+)"/);assert.ok(embed,flavor.id);
  const art=decodeURIComponent(embed[1]);const shapes=[...art.matchAll(/\bd="([^"]+)"/g)].map(match=>match[1]);assert.ok(shapes.length>0,flavor.id);geometries.push(JSON.stringify(shapes));
 }
 assert.equal(new Set(geometries).size,8,'each result needs a scene matching its identity');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

test('all three requested studios are live without falsely claiming live AI',()=>{
 const rows=JSON.parse(readFileSync(resolve(import.meta.dirname,'../data/sites.json'),'utf8'));
 for(const id of ['comic','check','postcard']) {const row=rows.find((x:{id:string})=>x.id===id);assert.equal(row.status,'live',id);assert.equal(row.usesAI,false,id);assert.equal(new URL(row.url).pathname,`/${id}/`);}
 assert.equal(rows.filter((x:{status:string})=>x.status==='soon').length,0);
});

test('three studio routes declare their own 1200x630 social preview image',()=>{
 for(const id of ['comic','check','postcard']){
  const layout=readFileSync(resolve(import.meta.dirname,`../apps/hub/app/${id}/layout.tsx`),'utf8');
  assert.ok(layout.includes(`/og/${id}.png`),id);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPreviewServer} from '../scripts/serve.ts';

test('preview isolates three built apps, blocks traversal and derives same-origin live site links',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'taichung-server-'));
 for(const app of ['hub','fortune','flavor']){await mkdir(join(dir,'apps',app,'out'),{recursive:true});await writeFile(join(dir,'apps',app,'out','index.html'),`<!doctype html><h1>${app}</h1><script>window.ready=true</script>`);}
 await mkdir(join(dir,'data'),{recursive:true});
 await writeFile(join(dir,'data','sites.json'),JSON.stringify([{id:'fortune',title:'沾福氣',url:'https://preview.invalid/fortune/',status:'live'},{id:'flavor',title:'你是哪一味',url:'https://preview.invalid/flavor/',status:'soon'}]));
 const server=createPreviewServer({root:dir});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
 try{
  for(const [route,body]of [['/','hub'],['/fortune/','fortune'],['/flavor/','flavor']]){const r=await fetch(base+route);assert.equal(r.status,200);assert.match(await r.text(),new RegExp(`<h1>${body}</h1>`));assert.match(r.headers.get('content-security-policy')??'',/sha256-/);}
  const r=await fetch(base+'/sites.json');assert.match(r.headers.get('cache-control')??'',/no-store/);const rows=await r.json();assert.equal(rows[0].url,base+'/fortune/');assert.equal(rows[1].status,'soon');
  for(const route of ['/package.json','/.env','/%2e%2e%2fpackage.json','/fortune/%2e%2e%2fpackage.json','/fonts/../../package.json'])assert.equal((await fetch(base+route)).status,404,route);
  assert.equal((await fetch(base+'/api/anything',{method:'POST',body:'private'})).status,405);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await rm(dir,{recursive:true,force:true});}
});

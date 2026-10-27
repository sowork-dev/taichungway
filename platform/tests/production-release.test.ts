import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('production release packages built files only, pins source and same-origin directory, hashes hydration scripts',async()=>{
 const {packageRelease}=await import('../scripts/package-release');
 const root=await mkdtemp(join(tmpdir(),'taichung-release-'));const dest=join(root,'release');const source=join(root,'source');
 try{
  for(const app of ['hub','fortune','flavor']){await mkdir(join(source,'apps',app,'out'),{recursive:true});await writeFile(join(source,'apps',app,'out','index.html'),`<html><script>window.app='${app}'</script><h1>${app}</h1></html>`);}
  await mkdir(join(source,'apps/hub/out/comic'),{recursive:true});await writeFile(join(source,'apps/hub/out/comic/index.html'),'<h1>巷口四格漫畫</h1>');
  await mkdir(join(source,'data'),{recursive:true});await writeFile(join(source,'data/sites.json'),JSON.stringify([{id:'comic',url:'https://preview.invalid/comic/',status:'live'}]));await writeFile(join(source,'.env'),'PRIVATE=do-not-package');
  await packageRelease({root:source,dest,origin:'https://taichungway.sowork.ai',revision:'a'.repeat(40)});
  assert.match(await readFile(join(dest,'index.html'),'utf8'),/<h1>hub/);
  assert.match(await readFile(join(dest,'comic/index.html'),'utf8'),/四格/);
  assert.match(await readFile(join(dest,'fortune/index.html'),'utf8'),/<h1>fortune/);
  assert.match(await readFile(join(dest,'flavor/index.html'),'utf8'),/<h1>flavor/);
  const sites=JSON.parse(await readFile(join(dest,'sites.json'),'utf8'));assert.equal(sites[0].url,'https://taichungway.sowork.ai/comic/');
  const manifest=JSON.parse(await readFile(join(dest,'release.json'),'utf8'));assert.equal(manifest.revision,'a'.repeat(40));assert.equal(manifest.files.length,5);assert.equal(manifest.inlineScriptHashes.length,3);assert.ok(manifest.files.every((x:{path:string})=>x.path!=='.env'));
  await assert.rejects(readFile(join(dest,'.env')));
 }finally{await rm(root,{recursive:true,force:true});}
});

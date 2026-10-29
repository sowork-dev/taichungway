import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {packageRelease} from '../scripts/package-release';
test('anonymous metrics is injected once before hashing every HTML without inline code or query data',async()=>{
 const root=await mkdtemp(join(tmpdir(),'metrics-package-'));const source=join(root,'platform');const dest=join(root,'release');
 try{
  for(const app of ['hub','fortune','flavor']){await mkdir(join(source,'apps',app,'out'),{recursive:true});await writeFile(join(source,'apps',app,'out','index.html'),'<html><head><title>Page</title></head><body>Safe</body></html>');}
  await mkdir(join(source,'data'),{recursive:true});await writeFile(join(source,'data/sites.json'),'[]');
  await mkdir(join(root,'public'),{recursive:true});await writeFile(join(root,'public','anonymous-metrics.js'),'/* first-party aggregate-only tracker */');await writeFile(join(root,'public','adventure.html'),'<html><head></head><body>City</body></html>');
  const result=await packageRelease({root:source,dest,revision:'c'.repeat(40),origin:'https://taichungway.sowork.ai'});
  for(const name of ['index.html','fortune/index.html','flavor/index.html','adventure.html']){
   const html=await readFile(join(dest,name),'utf8');assert.equal((html.match(/src="\/anonymous-metrics\.js"/g)||[]).length,1,name);assert.match(html,/<script defer src="\/anonymous-metrics\.js"><\/script><\/head>/);assert.equal(result.files.find(f=>f.path===name)?.sha256,createHash('sha256').update(html).digest('hex'));
  }
  assert.ok(result.files.some(f=>f.path==='anonymous-metrics.js'));
 }finally{await rm(root,{recursive:true,force:true});}
});

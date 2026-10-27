import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPreviewServer} from '../scripts/serve';

test('studio audio has a browser-compatible MIME while arbitrary source paths stay private',async()=>{
 const root=await mkdtemp(join(tmpdir(),'city-audio-server-'));
 await mkdir(join(root,'apps/hub/out/audio'),{recursive:true});await writeFile(join(root,'apps/hub/out/audio/city-sea.wav'),'RIFF-DEMO');
 const server=createPreviewServer({root});await new Promise<void>(ok=>server.listen(0,'127.0.0.1',ok));const addr=server.address();assert.ok(addr&&typeof addr!=='string');
 try {const response=await fetch(`http://127.0.0.1:${addr.port}/audio/city-sea.wav`);assert.equal(response.status,200);assert.match(response.headers.get('content-type')??'',/^audio\/wav/);assert.equal((await fetch(`http://127.0.0.1:${addr.port}/packages/ui/src/studio.tsx`)).status,404);}
 finally {await new Promise<void>((ok,fail)=>server.close(error=>error?fail(error):ok()));await rm(root,{recursive:true,force:true});}
});

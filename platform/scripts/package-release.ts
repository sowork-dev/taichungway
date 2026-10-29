import {cp,readFile,readdir,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,relative,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

/** Static outputs only; no repository files, runtime env or dependencies. */
export async function packageRelease({root,dest,origin,revision}:{root:string;dest:string;origin:string;revision:string}) {
 const base=resolve(root);const output=resolve(dest);const site=new URL(origin);
 if(!/^[0-9a-f]{40}$/.test(revision))throw new Error('Full source revision required');
 if(site.protocol!=='https:'||site.username||site.password||site.pathname!=='/'||site.search||site.hash)throw new Error('HTTPS origin required');
 if(output===base||output.startsWith(base+sep))throw new Error('Release must be outside source checkout');
 await mkdir(output,{recursive:true});
 if((await readdir(output)).length)throw new Error('Use an empty release directory');
 for(const app of ['hub','fortune','flavor']) {
  const input=join(base,'apps',app,'out');const target=app==='hub'?output:join(output,app);
  await mkdir(target,{recursive:true});
  for(const item of await readdir(input))await cp(join(input,item),join(target,item),{recursive:true,errorOnExist:true,force:false});
 }
 // Static client files of the main-site games (AI chat, city adventure, bubble PK) live in the repository's public/ folder.
 // The chat page is published as /chat.html because / is the hub. Existing hub files always win a name clash.
 const gamePublic=join(base,'..','public');
 if(await stat(gamePublic).then(info=>info.isDirectory(),()=>false)){
  for(const item of await readdir(gamePublic,{withFileTypes:true})){
   if(!item.isFile()||item.isSymbolicLink())continue;
   const name=item.name==='index.html'?'chat.html':item.name;
   await cp(join(gamePublic,item.name),join(output,name),{errorOnExist:false,force:false});
  }
 }
 const sites=JSON.parse(await readFile(join(base,'data/sites.json'),'utf8'))as Array<{url:string}>;
 for(const row of sites)row.url=new URL(new URL(row.url).pathname,site.origin).href;
 await writeFile(join(output,'sites.json'),JSON.stringify(sites,null,2)+'\n');
 const metricsReady=await stat(join(output,'anonymous-metrics.js')).then(info=>info.isFile(),()=>false);
 const files:Array<{path:string;sha256:string;bytes:number}>=[];const hashes=new Set<string>();
 async function scan(path:string):Promise<void>{
  for(const item of await readdir(path,{withFileTypes:true})){
   const file=join(path,item.name);
   if(item.isSymbolicLink())throw new Error('Symlink in static output');
   if(item.isDirectory()){await scan(file);continue;}
   if(!item.isFile())throw new Error('Nonregular output');
   let data=await readFile(file);
   if(metricsReady&&item.name.endsWith('.html')){
    const html=data.toString('utf8');
    if(!html.includes('src="/anonymous-metrics.js"')){
     const instrumented=html.replace(/<\/head>/i,'<script defer src="/anonymous-metrics.js"></script></head>');
     if(instrumented!==html){await writeFile(file,instrumented);data=Buffer.from(instrumented);}
    }
   }
   files.push({path:relative(output,file).split(sep).join('/'),sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length});
   if(item.name.endsWith('.html'))for(const match of data.toString('utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1])hashes.add(`'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
  }
 }
 await scan(output);files.sort((a,b)=>a.path.localeCompare(b.path));
 const manifest={revision,origin:site.origin,files,inlineScriptHashes:[...hashes].sort()};
 await writeFile(join(output,'release.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [dest,revision]=process.argv.slice(2);if(!dest||!revision)throw new Error('Usage: tsx scripts/package-release.ts OUTSIDE_DIR FULL_SHA');
 void packageRelease({root:resolve(import.meta.dirname,'..'),dest,revision,origin:process.env.PREVIEW_ORIGIN??'https://taichungway.sowork.ai'}).then(manifest=>{
  console.log(JSON.stringify({revision:manifest.revision,fileCount:manifest.files.length,inlineHashes:manifest.inlineScriptHashes.length}));
 }).catch(error=>{console.error(error instanceof Error?error.message:'Packaging failed');process.exitCode=1;});
}

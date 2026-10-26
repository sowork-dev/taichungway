import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const MIME:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2','.ico':'image/x-icon'};
function publicOrigin(host:string|undefined,port:number,override?:string):string {
 if(override)return new URL(override).origin;
 if(host&&/^[a-z0-9-]+\.trycloudflare\.com$/i.test(host))return `https://${host}`;
 if(host&&/^(?:localhost|127\.0\.0\.1):\d+$/.test(host))return `http://${host}`;
 return `http://127.0.0.1:${port}`;
}
export function createPreviewServer({root=resolve(import.meta.dirname,'..'),origin}:{root?:string;origin?:string}={}):Server {
 const base=resolve(root);
 const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try{
   const raw=(req.url??'/').split('?')[0];
   if(/%(?:2f|5c|00)/i.test(raw)){res.writeHead(404);res.end();return;}
   const pathname=decodeURIComponent(raw);
   if(pathname.includes('\\')||pathname.split('/').some(x=>x==='..'||x==='.')||pathname.includes('\0'))throw new Error('Invalid path');
   const address=server.address(),port=address&&typeof address!=='string'?address.port:4189;
   if(pathname==='/sites.json'){
    const data=JSON.parse(await readFile(resolve(base,'data/sites.json'),'utf8'))as Array<{url:string;[key:string]:unknown}>;
    const currentOrigin=publicOrigin(req.headers.host,port,origin);
    const rows=data.map(row=>({...row,url:new URL(new URL(row.url).pathname,currentOrigin).href}));
    res.setHeader('Content-Type',MIME['.json']);res.end(req.method==='HEAD'?undefined:JSON.stringify(rows));return;
   }
   const app=pathname.startsWith('/fortune/')?'fortune':pathname.startsWith('/flavor/')?'flavor':'hub';
   const prefix=app==='hub'?'':`/${app}`;
   let relative=pathname.slice(prefix.length);
   if(relative===''||relative.endsWith('/'))relative+='index.html';
   const exportRoot=resolve(base,'apps',app,'out');
   let filename=resolve(exportRoot,relative.replace(/^\//,''));
   if(!filename.startsWith(exportRoot+sep))throw new Error('Outside export');
   if((await stat(filename)).isDirectory())filename=resolve(filename,'index.html');
   const data=await readFile(filename),ext=extname(filename);
   if(ext==='.html'){
    const text=data.toString('utf8');const hashes=[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(Boolean).map(script=>`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
    res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
   }
   if(pathname.includes('/_next/'))res.setHeader('Cache-Control','public, max-age=31536000, immutable');
   res.setHeader('Content-Type',MIME[ext]??'application/octet-stream');res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Not found');}
 });return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT??4189);const server=createPreviewServer({origin:process.env.PREVIEW_ORIGIN});
 server.listen(port,'127.0.0.1',()=>console.log(`台中味獨立預覽 http://127.0.0.1:${port}`));
}

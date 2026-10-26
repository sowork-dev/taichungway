export interface ShareInput {title:string;url:string}
export interface SharePlatform {share?:(data:{title:string;url:string})=>Promise<void>;writeText?:(value:string)=>Promise<void>}
export function cleanShareUrl(value:string):string {
 const url=new URL(value);
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!(local&&url.protocol==='http:'))||url.username||url.password)throw new TypeError('Invalid share URL');
 const match=url.pathname.match(/^\/(fortune|flavor)\/$/);if(!match)throw new TypeError('Unknown experience');
 url.search='';url.hash='';url.searchParams.set('utm_source','share');url.searchParams.set('utm_medium','link');url.searchParams.set('utm_campaign',match[1]);return url.href;
}
function browserPlatform():SharePlatform {
 if(typeof navigator==='undefined')return {};
 return {share:navigator.share?.bind(navigator),writeText:navigator.clipboard?.writeText.bind(navigator.clipboard)};
}
export async function shareResult(input:ShareInput,platform:SharePlatform=browserPlatform()):Promise<'shared'|'copied'|'cancelled'> {
 const url=cleanShareUrl(input.url),title=input.title.slice(0,80);
 if(platform.share){try{await platform.share({title,url});return 'shared';}catch(error){if(error instanceof Error&&error.name==='AbortError')return 'cancelled';}}
 if(platform.writeText){await platform.writeText(url);return 'copied';}
 if(typeof document!=='undefined'){
  const field=document.createElement('textarea');field.value=url;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();
  try{if(!document.execCommand('copy'))throw new Error('Clipboard unavailable');return 'copied';}finally{field.remove();}
 }
 throw new Error('Sharing unavailable');
}

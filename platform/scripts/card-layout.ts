import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {renderCardSvg} from '../packages/share-card/src/index.ts';
import {FORTUNE_STYLES,FLAVORS,FORTUNES} from '../packages/experience/src/index.ts';
const bytes=readFileSync(new URL('../assets/fonts/LocalSansTC-Regular.ttf',import.meta.url));
const font=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
async function main(){
 const directory=new URL('../artifacts/card-layouts/',import.meta.url);mkdirSync(directory,{recursive:true});
 const longest=[...FORTUNES].sort((a,b)=>b.length-a.length)[0];
 for(const style of FORTUNE_STYLES){const svg=await renderCardSvg({kind:'fortune',title:'今日小福氣｜台中味',body:longest,nickname:'一二三四五六七八九十',accent:style.accent,variant:style.id},font);writeFileSync(new URL(`fortune-${style.id}.svg`,directory),svg);}
 for(const flavor of FLAVORS){const svg=await renderCardSvg({kind:'flavor',title:`${flavor.name}｜台中味`,body:flavor.description,nickname:'一二三四五六七八九十',accent:flavor.accent,variant:flavor.id},font);writeFileSync(new URL(`flavor-${flavor.id}.svg`,directory),svg);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

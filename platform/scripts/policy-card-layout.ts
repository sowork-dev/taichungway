import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { renderCardSvg, type CardInput } from '../packages/share-card/src/index.ts';
import { POLICY_MISSIONS, MARKET_MISSION, FORTUNE_STYLES, FLAVORS } from '../packages/experience/src/index.ts';
const bytes=readFileSync(new URL('../assets/fonts/LocalSansTC-Regular.ttf',import.meta.url));
const font=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
async function main(){
 const directory=new URL('../artifacts/policy-play/card-layouts/',import.meta.url);mkdirSync(directory,{recursive:true});
 const cases: {id:string,input:CardInput}[]=[];
 for(const mission of POLICY_MISSIONS)for(const style of FORTUNE_STYLES)cases.push({id:`fortune-${mission.id}-${style.id}`,input:{kind:'fortune',title:'今日小福氣｜台中味',body:mission.wish,nickname:'一二三四五六七八九十',accent:style.accent,variant:style.id,policyId:mission.policyId}});
 for(const flavor of FLAVORS)cases.push({id:`flavor-${flavor.id}`,input:{kind:'flavor',title:`${flavor.name}｜台中味`,body:flavor.description,nickname:'一二三四五六七八九十',accent:flavor.accent,variant:flavor.id,policyId:MARKET_MISSION.policyId}});
 for(const mission of POLICY_MISSIONS)cases.push({id:`max-legal-${mission.id}`,input:{kind:'fortune',title:'最'.repeat(24),body:'內'.repeat(120),nickname:'暱'.repeat(10),accent:'#1A63C8',variant:'night',policyId:mission.policyId}});
 for(const entry of cases)writeFileSync(new URL(`${entry.id}.svg`,directory),await renderCardSvg(entry.input,font));
 writeFileSync(new URL('../cases.json',directory),JSON.stringify(cases.map(({id,input})=>({id,policyId:input.policyId})),null,2));
 console.log(`Rendered ${cases.length} policy cards`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

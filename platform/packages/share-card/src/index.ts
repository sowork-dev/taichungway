import satori from 'satori';
import { createElement as h, type CSSProperties } from 'react';
import { FORTUNE_STYLES, policyMissionById, type PolicyMission } from '@taichung/experience';

export interface CardInput {title:string;body:string;nickname?:string;accent:string;kind:'fortune'|'flavor';variant?:string;policyId?:string}
export function validateCard(input:CardInput):CardInput {
 if(!input||!['fortune','flavor'].includes(input.kind)||!/^#[\da-f]{6}$/i.test(input.accent))throw new TypeError('Invalid card options');
 for(const [key,max]of [['title',24],['body',120],['nickname',10],['variant',24]]as const){
  const value=input[key]??'';
  if(typeof value!=='string'||Array.from(value).length>max||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value))throw new TypeError(`Invalid ${key}`);
 }
 if(input.policyId!==undefined){if(typeof input.policyId!=='string')throw new TypeError('Invalid policyId');policyMissionById(input.policyId);}
 if(!input.title.trim()||!input.body.trim())throw new TypeError('Empty card');
 return {...input,nickname:input.nickname?.trim()??''};
}
const box=(style:CSSProperties,...children:Parameters<typeof h>[2][])=>h('div',{style:{display:'flex',...style}},...children);
function flavorArt(accent:string,scene:string,height=330){
 const path=(d:string,fill=accent,stroke?:string)=>h('path',{d,fill,stroke,strokeWidth:3,strokeLinecap:'round',strokeLinejoin:'round'});
 const ink='#112A4D',paper='#BDD8FA';
 const scenes:Record<string,ReturnType<typeof h>[]>={
  market:[path('M61 100H258V178H61Z',paper,ink),path('M49 103L70 58H251L271 103Z',accent,ink),path('M83 124H154V178H83ZM176 118H235V158H176Z',ink),path('M53 160H267V178H53Z',ink),path('M70 60L60 100H83L89 60ZM114 60L110 100H132L134 60ZM160 60V100H182L178 60ZM205 60L210 100H232L225 60Z','#F3F8FF')],
  tea:[path('M12 154L74 68L129 137L178 48L302 164Z','#1A63C8'),path('M59 163L114 89L183 166L241 115L307 177Z',accent),path('M128 124H191V163Q160 186 128 163Z',paper,ink),path('M191 132C218 126 214 161 191 156M147 111Q137 98 147 87M162 111Q152 98 162 87','none',ink)],
  sea:[path('M10 147Q49 127 85 147T160 147T235 147T310 147V192H10Z','#1A63C8'),path('M89 127L117 156H210L236 127Z',ink),path('M157 48V126M164 52L222 114H164Z',paper,ink),path('M149 69L103 114H149Z',accent),path('M10 165Q49 145 85 165T160 165T235 165T310 165','none','#F3F8FF')],
  home:[path('M47 174V99L110 51L173 99V174Z',paper,ink),path('M37 102L110 45L184 102','none',accent),path('M93 174V123H127V174M62 104H81V130H62ZM140 104H158V130H140Z',accent,ink),path('M195 174V115H253V174M188 115H262','none',ink),path('M214 112V91M214 98Q188 97 192 80Q212 76 214 98M214 94Q237 95 236 77Q215 77 214 94','#1A63C8',ink)],
  oldtown:[path('M52 176V68H141V176M153 176V93H264V176',paper,ink),path('M69 105H122V176H69ZM170 111H203V147H170ZM215 111H247V147H215Z',accent,ink),path('M123 182V143Q146 134 160 146Q177 134 199 143V182Q176 174 160 185Q143 174 123 182Z','#F3F8FF',ink),path('M160 146V185M80 115H109M80 125H109M80 135H100','none',ink)],
  port:[path('M13 152Q50 135 87 152T161 152T235 152T309 152V188H13Z','#1A63C8'),path('M55 137V59H148M55 59L106 94M132 59V106M124 106H140V119H124Z','none',ink),path('M125 134L147 161H250L276 134Z',ink),path('M151 115H186V134H151ZM191 98H228V134H191ZM234 113H257V134H234Z',accent,ink),path('M202 97V79H223V97','none',ink)],
  field:[path('M18 125L82 66L143 132L197 83L306 140','#7FC0F0'),path('M14 152Q150 95 306 152V184H14Z',accent),path('M41 177Q161 127 285 173M26 162Q159 112 290 157M160 143V183M103 152L79 182M206 155L241 183','none','#BDD8FA'),path('M96 86H183V136H96ZM86 86L140 54L194 86Z',paper,ink),path('M129 136V105H151V136M232 124V83M232 102L219 90M232 90L245 77','none',ink)],
  craft:[path('M54 158H267V178H54Z',ink),path('M78 96H237V158H78Z','#BDD8FA',ink),h('circle',{cx:157,cy:111,r:42,stroke:ink,strokeWidth:13,strokeDasharray:'13 7'}),h('circle',{cx:157,cy:111,r:17,fill:accent,stroke:ink,strokeWidth:3}),path('M229 115L259 73L271 82L241 124M101 158L85 133L94 126L118 158','none',ink)]
 };
 return h('svg',{width:760,height,viewBox:'0 0 320 210',fill:'none'},h('circle',{cx:246,cy:48,r:27,fill:'#7FC0F0'}),path('M28 61H66M44 52H84M257 87H291M273 78H302','none','#BDD8FA'),...(scenes[scene]??scenes.market),path('M32 194H289','none','#7FC0F0'));
}
function cardArt(accent:string,kind:string,variant='market',height=330){
 if(kind==='flavor')return flavorArt(accent,variant,height);
 return h('svg',{width:760,height,viewBox:'0 0 760 330',fill:'none'},
  h('circle',{cx:598,cy:83,r:54,fill:'#7FC0F0'}),
  h('path',{d:kind==='fortune'?'M80 274H680M190 270V110H570V270M164 110H594V87H164ZM142 85L225 40H535L618 85Z':'M50 260Q140 210 220 250T400 250T580 250T750 250V330H50Z',fill:accent,opacity:.18}),
  h('path',{d:kind==='fortune'?'M267 275V145H493V275H443V228A63 63 0 0 0 317 228V275Z':'M165 210L230 266H550L605 210ZM373 30V210M390 43L548 187H390Z',fill:accent}),
  h('path',{d:'M60 80H150M90 65H185M590 185H710M626 169H732',stroke:accent,strokeWidth:6,strokeLinecap:'round',opacity:.3}),
  h('path',{d:'M96 157L105 130L114 157L142 166L114 175L105 203L96 175L68 166Z',fill:'#1A63C8'}));
}
function policyTree(input:CardInput,policy:PolicyMission,bg:string,ink:string,accent:string){
 return box({boxSizing:'border-box',width:'100%',height:'100%',padding:'56px',background:bg,color:ink,fontFamily:'LocalSansTC',flexDirection:'column'},
  box({justifyContent:'space-between',fontSize:27,letterSpacing:3},h('span',{},'台中味・把政策玩進日常'),h('span',{},input.kind==='fortune'?'福氣政策卡':'市場小實驗')),
  box({marginTop:20,borderTop:`2px solid ${accent}`}),
  box({justifyContent:'center',marginTop:18},cardArt(accent,input.kind,input.variant,210)),
  box({fontSize:input.title.length>16?50:62,lineHeight:1.3,justifyContent:'center',textAlign:'center',marginTop:12},input.title),
  box({fontSize:Array.from(input.body).length>60?28:34,lineHeight:1.5,textAlign:'center',justifyContent:'center',marginTop:22,padding:'0 16px'},input.body),
  box({fontSize:28,justifyContent:'center',marginTop:18},input.nickname?`給 ${input.nickname}`:'一點生活心願，一份城市提案。'),
  box({flexDirection:'column',marginTop:24,padding:'24px',background:'#FFFFFF',color:'#112A4D',borderLeft:'6px solid #1A63C8',flexShrink:0},
   h('span',{style:{fontSize:24,color:'#134E9E'}},'江啟臣政見・非施政成果'),
   h('span',{style:{fontSize:38,lineHeight:1.35,marginTop:12}},policy.title),
   h('span',{style:{fontSize:23,lineHeight:1.5,marginTop:12}},policy.limitation)),
  box({marginTop:'auto',paddingTop:22,borderTop:`2px solid ${accent}`,flexDirection:'column',fontSize:22,lineHeight:1.6,flexShrink:0},
   h('span',{},'政策原文來源：taichungway.tw/future'),h('span',{},'概念示意，不是實測結果。'),h('span',{},'SoWork 獨立預覽，非官方網站；尚未取得競選團隊授權或背書。')));
}
const escapeXml=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
export async function renderCardSvg(raw:CardInput,font:ArrayBuffer):Promise<string> {
 const input=validateCard(raw),style=FORTUNE_STYLES.find(s=>s.id===input.variant);
 const bg=input.kind==='fortune'&&style?style.bg:'#F3F8FF',ink=input.kind==='fortune'&&style?style.ink:'#112A4D';
 const accent=input.kind==='fortune'&&style?style.accent:input.accent;
 const policy=input.policyId===undefined?undefined:policyMissionById(input.policyId);
 const tree=policy?policyTree(input,policy,bg,ink,accent):box({boxSizing:'border-box',width:'100%',height:'100%',padding:'68px',background:bg,color:ink,fontFamily:'LocalSansTC',flexDirection:'column',position:'relative'},
  box({justifyContent:'space-between',fontSize:28,letterSpacing:4},h('span',{},'台中味・日常遊樂場'),h('span',{},input.kind==='fortune'?'一點福氣':'我的台中味')),
  box({marginTop:28,borderTop:`2px solid ${accent}`,opacity:.4}),
  box({justifyContent:'center',marginTop:30},cardArt(accent,input.kind,input.variant)),
  box({fontSize:30,letterSpacing:6,justifyContent:'center',marginTop:20},input.kind==='fortune'?(style?.name??'今天的小小祝福'):'三個選擇・一種日常'),
  box({fontSize:input.kind==='fortune'?78:74,lineHeight:1.3,justifyContent:'center',textAlign:'center',marginTop:28},input.title),
  box({fontSize:48,lineHeight:1.65,textAlign:'center',justifyContent:'center',marginTop:38,padding:'0 24px'},input.body),
  box({fontSize:30,justifyContent:'center',marginTop:32},input.nickname?`給 ${input.nickname}`:'把喜歡，留給今天的自己。'),
  box({marginTop:'auto',paddingTop:28,borderTop:`2px solid ${accent}`,flexDirection:'column',fontSize:24,lineHeight:1.7},
   h('span',{},'原創互動預覽・本卡未使用 AI'),h('span',{},'官網參考：taichungway.tw'),h('span',{},'SoWork 獨立預覽，非官方網站；尚未取得競選團隊授權或背書。')));
 const svg=await satori(tree,{width:1080,height:1350,fonts:[{name:'LocalSansTC',data:font,weight:400,style:'normal'}]});
 return policy?svg.replace(/(<svg[^>]*>)/,`$1<title>${escapeXml(`${policy.title}；江啟臣政見・非施政成果；來源：${policy.sourceUrl}`)}</title>`):svg;
}
let fontPromise:Promise<ArrayBuffer>|undefined;
export async function downloadCard(raw:CardInput):Promise<void> {
 const input=validateCard(raw);
 if(typeof document==='undefined')throw new Error('Browser required');
 fontPromise??=fetch('/fonts/LocalSansTC-Regular.ttf',{credentials:'omit'}).then(response=>{if(!response.ok)throw new Error('Font unavailable');return response.arrayBuffer();}).catch(error=>{fontPromise=undefined;throw error;});
 const svg=await renderCardSvg(input,await fontPromise);
 const svgUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
 try {
  const image=new Image();image.src=svgUrl;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');ctx.drawImage(image,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('PNG unavailable')),'image/png'));
  const pngUrl=URL.createObjectURL(blob);const link=document.createElement('a');link.href=pngUrl;link.download=`taichung-${input.kind}.png`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(pngUrl),60000);
 }finally{URL.revokeObjectURL(svgUrl);}
}

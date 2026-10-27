(()=>{
'use strict';
const $=id=>document.getElementById(id);
const log=$('log'),form=$('form'),input=$('input'),send=$('send'),chips=$('chips');
const history=[];let busy=false;const TOPICS=[['公車與通勤有什麼主張？','🚌 公車'],['托育與育兒怎麼支持？','🍼 托育'],['公有市場裝冷氣是什麼？','🛒 市場'],['對長照有什麼規劃？','🧓 長照'],['青年住宅有什麼規劃？','🏠 住宅'],['對教育有什麼主張？','📚 教育']];const asked=new Set();
function nextChips(){const rest=TOPICS.filter(t=>!asked.has(t[0])).slice(0,3);if(!rest.length)return;const box=document.createElement('div');box.className='chips next';for(const [q,t] of rest){const b=document.createElement('button');b.type='button';b.dataset.q=q;b.textContent=t;box.appendChild(b);}box.addEventListener('click',e=>{const b=e.target.closest('button');if(b)ask(b.dataset.q);});log.appendChild(box);scroll();}
const avatar=$('avatar'),caption=$('caption'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const GREET=['嗨！今天想聊哪一題？','我在這～想問交通、托育還是長照？','點我很開心！換你問問題囉','慢慢問，我依公開資料回答'];let greetIndex=0;
function state(name,text){avatar.classList.remove('is-thinking','is-talking');if(name)avatar.classList.add(name);if(text)caption.textContent=text;}
function play(cls,ms){avatar.classList.remove(cls);void avatar.offsetWidth;avatar.classList.add(cls);setTimeout(()=>avatar.classList.remove(cls),ms);}
avatar.addEventListener('click',()=>{if(busy)return;play('is-wave',1400);play('is-hop',500);caption.textContent=GREET[greetIndex++%GREET.length];if(navigator.vibrate)navigator.vibrate(10);});
function scroll(){log.scrollTop=log.scrollHeight;}
function add(role,text,extra){
 const wrap=document.createElement('div');wrap.className='msg '+role;
 const b=document.createElement('div');b.className='bubble'+(extra&&extra.error?' error':'');b.textContent=extra&&extra.type&&!reduced?'':text;wrap.appendChild(b);
 if(extra&&extra.type&&!reduced){let i=0;const chars=[...text],step=Math.max(1,Math.ceil(chars.length/70));b.classList.add('typing-caret');const timer=setInterval(()=>{i=Math.min(chars.length,i+step);b.textContent=chars.slice(0,i).join('');scroll();if(i>=chars.length){clearInterval(timer);b.classList.remove('typing-caret');state(null,'還想聊哪一題？');nextChips();}},28);}
 if(extra&&extra.sources&&extra.sources.length){const s=document.createElement('div');s.className='sources';for(const r of extra.sources){if(!r.sourceUrl)continue;const a=document.createElement('a');a.href=r.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='來源 · '+r.title;s.appendChild(a);}if(s.children.length)wrap.appendChild(s);}
 log.appendChild(wrap);scroll();return wrap;
}
function typing(){const w=document.createElement('div');w.className='msg bot typing';w.setAttribute('aria-label','啟臣正在回覆');w.innerHTML='<div class="bubble"><i></i><i></i><i></i></div>';log.appendChild(w);scroll();return w;}
async function ask(text){
 text=text.trim();if(!text||busy)return;
 if(chips)chips.remove();document.querySelectorAll('.chips.next').forEach(n=>n.remove());asked.add(text);
 busy=true;send.disabled=true;input.value='';
 add('user',text);history.push({role:'user',content:text});
 const wait=typing();state('is-thinking','想一想…');
 try{
  const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history.slice(-11)})});
  wait.remove();
  if(r.status===429){state(null,'我先喘口氣…');history.pop();add('bot','你問得有點快，請稍等一分鐘再試。',{error:true});return;}
  if(!r.ok){state(null,'有點狀況，晚點再試');history.pop();add('bot',r.status===503?'聊天服務目前尚未開放，請稍後再試。':'暫時連不上，請稍後再試。',{error:true});return;}
  const d=await r.json();history.push({role:'assistant',content:d.reply});
  state('is-talking','我來說明…');add('bot',d.reply,{sources:d.sources,type:true});if(reduced){state(null,'還想聊哪一題？');nextChips();}
 }catch{wait.remove();state(null,'網路好像斷了');history.pop();add('bot','網路好像斷了，請稍後再試。',{error:true});}
 finally{busy=false;send.disabled=false;input.focus();}
}
form.addEventListener('submit',e=>{e.preventDefault();ask(input.value);});
if(chips)chips.addEventListener('click',e=>{const b=e.target.closest('button');if(b)ask(b.dataset.q||b.textContent);});
const dlg=$('about');$('aboutButton').addEventListener('click',()=>dlg.showModal());$('aboutClose').addEventListener('click',()=>dlg.close());
})();

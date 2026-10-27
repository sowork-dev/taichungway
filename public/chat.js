(()=>{
'use strict';
const $=id=>document.getElementById(id);
const log=$('log'),form=$('form'),input=$('input'),send=$('send'),chips=$('chips');
const history=[];let busy=false;
function scroll(){log.scrollTop=log.scrollHeight;}
function add(role,text,extra){
 const wrap=document.createElement('div');wrap.className='msg '+role;
 const b=document.createElement('div');b.className='bubble'+(extra&&extra.error?' error':'');b.textContent=text;wrap.appendChild(b);
 if(extra&&extra.sources&&extra.sources.length){const s=document.createElement('div');s.className='sources';for(const r of extra.sources){if(!r.sourceUrl)continue;const a=document.createElement('a');a.href=r.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='來源 · '+r.title;s.appendChild(a);}if(s.children.length)wrap.appendChild(s);}
 if(extra&&extra.notice){const n=document.createElement('p');n.className='notice';n.textContent=extra.notice;wrap.appendChild(n);}
 log.appendChild(wrap);scroll();return wrap;
}
function typing(){const w=document.createElement('div');w.className='msg bot typing';w.setAttribute('aria-label','啟臣正在回覆');w.innerHTML='<div class="bubble"><i></i><i></i><i></i></div>';log.appendChild(w);scroll();return w;}
async function ask(text){
 text=text.trim();if(!text||busy)return;
 if(chips)chips.remove();
 busy=true;send.disabled=true;input.value='';
 add('user',text);history.push({role:'user',content:text});
 const wait=typing();
 try{
  const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:history.slice(-11)})});
  wait.remove();
  if(r.status===429){history.pop();add('bot','你問得有點快，請稍等一分鐘再試。',{error:true});return;}
  if(!r.ok){history.pop();add('bot',r.status===503?'聊天服務目前尚未開放，請稍後再試。':'暫時連不上，請稍後再試。',{error:true});return;}
  const d=await r.json();history.push({role:'assistant',content:d.reply});
  add('bot',d.reply,{sources:d.sources,notice:d.notice});
 }catch{wait.remove();history.pop();add('bot','網路好像斷了，請稍後再試。',{error:true});}
 finally{busy=false;send.disabled=false;input.focus();}
}
form.addEventListener('submit',e=>{e.preventDefault();ask(input.value);});
if(chips)chips.addEventListener('click',e=>{const b=e.target.closest('button');if(b)ask(b.textContent);});
const dlg=$('about');$('aboutButton').addEventListener('click',()=>dlg.showModal());$('aboutClose').addEventListener('click',()=>dlg.close());
})();

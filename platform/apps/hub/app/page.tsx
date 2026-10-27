'use client';
import { AppShell, cssVars, siteHref, useSites, type SiteId } from '@taichung/ui';

const order: SiteId[] = ['comic','check','postcard','fortune','flavor','thanks','machine'];
const captions:Partial<Record<SiteId,string>> = { comic:'選一件小事，畫進四格裡',check:'開一張給自己的四年支票',postcard:'把想念的聲音，混成一張卡',fortune:'長按、翻卡，收一張城市祝福',flavor:'從三個選擇，遇見台中日常' };
function Icon({id}: {id:SiteId}) {
 return <svg viewBox="0 0 120 100" className="clean-card-icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
  {id==='comic'?<><rect x="18" y="12" width="84" height="76"/><path d="M60 12v76M18 50h84"/><circle cx="37" cy="29" r="6"/><path d="M29 43q8-10 16 0M73 24h17v14H73zM30 64h16v13H30zM75 67l7 8 10-16"/></>:id==='check'?<><rect x="12" y="19" width="96" height="62"/><path d="M39 19v62" strokeDasharray="3 4"/><path d="M50 34h44M50 46h26M50 68h31"/><circle cx="91" cy="65" r="10"/><path d="m85 66 4 4 8-10"/></>:id==='postcard'?<><rect x="12" y="16" width="96" height="68"/><path d="M71 25v50M82 59h17M82 68h17M27 46v8m7-17v25m7-36v45m7-34v24m7-17v9"/><rect x="84" y="25" width="15" height="19" strokeDasharray="2 2"/></>:id==='fortune'?<><path d="M34 14h52v72H34zM45 28h30M45 70h30"/><circle cx="60" cy="49" r="13"/><path d="M60 40v18m-8-9h16"/></>:id==='flavor'?<><circle cx="60" cy="48" r="32"/><path d="M37 46q23-24 46 0M42 65q18-20 36 0M48 33h24M59 15v66"/></>:<><circle cx="60" cy="49" r="28"/><path d="M43 49h34M60 32v34"/></>}
 </svg>;
}
function Directory() {
 const {sites,loading,error}=useSites();
 const sorted=[...sites].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
 return <section id="experiences" className="directory clean-directory" aria-labelledby="directory-title"><div className="clean-section-heading"><p>互動體驗 / EXPERIENCES</p><h2 id="directory-title">從你喜歡的方式，開始。</h2></div><p className="directory-notice" role="status">{loading?'正在確認各站開放狀態…':error?'暫時讀不到開放狀態，請稍後重試。':'不用登入，沒有標準答案。你的文字，只留在你的裝置。'}</p><div className="experience-list">{sorted.map((site,index)=>{
 const href=siteHref(site);const content=<><div className="experience-top"><span className="experience-number">{String(index+1).padStart(2,'0')}</span><span className={`status-badge ${href?'is-live':''}`}>{href?'現在可以玩':'即將上線'}</span></div><Icon id={site.id}/><div className="experience-copy"><h3>{site.title}</h3><p>{site.tagline}</p></div><div className="experience-meta"><span>{site.durationSec} 秒</span><span className={site.usesAI?'ai-badge':'offline-badge'}>{site.usesAI?'AI':'無 AI'}</span></div><div className="experience-bottom"><span>{href?captions[site.id]:'好玩的，正在準備'}</span><span className="card-arrow" aria-hidden="true">{href?'↗':'—'}</span></div></>;
 return href?<a className={`experience-card live-card ${site.id}`} key={site.id} href={href} style={cssVars({'--accent':site.accent})} data-site-id={site.id}>{content}</a>:<article className="experience-card soon-card" key={site.id} aria-disabled="true" data-site-id={site.id}>{content}</article>;
 })}</div></section>;
}
export default function Page() {
 return <AppShell title="台中味" eyebrow="TAICHUNG WAY / 城市日常提案"><section className="hub-hero clean-hero"><p className="clean-hero-index">日常，是認識城市的開始。</p><h1>一件小事，<br/>一座城市的<span>想像。</span></h1><div className="clean-hero-bottom"><p>畫四格、開支票、寄一段聲音。<br/>用一點好奇，看看生活背後的城市提案。</p><a href="#experiences" className="clean-explore">開始體驗 <span aria-hidden="true">↓</span></a></div><p className="clean-hero-disclosure">江啟臣官網政見 × 原創生活互動 · 非官方製作</p></section><Directory/></AppShell>;
}

'use client';

import { AppShell, LocalArt, cssVars, siteHref, useSites, type ArtKind, type SiteId } from '@taichung/ui';

const art: Record<SiteId, ArtKind> = { fortune: 'gate', flavor: 'market', check: 'letter', thanks: 'letter', postcard: 'sea', comic: 'comic', machine: 'machine' };
const order: SiteId[] = ['fortune', 'flavor', 'check', 'thanks', 'postcard', 'comic', 'machine'];

function Directory() {
  const { sites, loading, error } = useSites();
  const sorted = [...sites].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return <section id="experiences" className="directory" aria-labelledby="directory-title">
    <div className="section-heading"><div><p className="eyebrow">一點時間，一點好心情</p><h2 id="directory-title">今天，想玩哪一味？</h2></div><span className="section-flower" aria-hidden="true">✳</span></div>
    <p className="directory-notice" role="status">{loading ? '正在確認各站開放狀態…' : error ? '暫時讀不到開放狀態，先看看介紹；連線恢復後會自動更新。' : '選一個喜歡的開始。不用登入，也不留作答紀錄。'}</p>
    <div className="experience-list">{sorted.map((site, index) => {
      const href = siteHref(site);
      const content = <>
        <div className="experience-top"><span className="experience-number">{String(index + 1).padStart(2, '0')} / 日常提案</span><span className={`status-badge ${href ? 'is-live' : ''}`}>{href ? '現在可以玩' : '即將上線'}</span></div>
        <div className="experience-body"><div className="experience-copy"><h3>{site.title}</h3><p>{site.tagline}</p><div className="experience-meta"><span>{site.durationSec} 秒</span><span className={site.usesAI ? 'ai-badge' : 'offline-badge'}>{site.usesAI ? 'AI' : '無 AI'}</span></div></div><LocalArt kind={art[site.id]} /></div>
        <div className="experience-bottom"><span>{href ? site.id === 'fortune' ? '收一張今日福氣' : '找找我的台中味' : '好玩的，正在慢慢準備'}</span><span className="card-arrow" aria-hidden="true">{href ? '↗' : '—'}</span></div>
      </>;
      return href ? <a className={`experience-card live-card ${site.id}`} key={site.id} href={href} style={cssVars({ '--accent': site.accent })} data-site-id={site.id}>{content}</a> : <article className="experience-card soon-card" key={site.id} style={cssVars({ '--accent': site.accent })} aria-disabled="true" data-site-id={site.id}>{content}</article>;
    })}</div>
  </section>;
}

export default function Page() {
  return <AppShell title="台中味" eyebrow="TAICHUNG · 日常遊樂場">
    <section className="hub-hero" aria-labelledby="hub-title">
      <div className="hero-title-row"><h1 id="hub-title">把日常，<br />玩成<span className="warm-underline">一點喜歡。</span></h1><span className="round-stamp" aria-hidden="true">慢慢玩<br />好好過</span></div>
      <p className="hero-description">市場的早安、山裡的茶香、海邊的風。<br />用一點時間，遇見你喜歡的台中。</p>
      <div className="hub-panorama"><LocalArt kind="market" className="panorama-market" /><LocalArt kind="tea" className="panorama-tea" /><span className="panorama-note">風土有味，日子有趣。</span></div>
      <a className="hero-jump" href="#experiences">挑一個，開始玩 <span aria-hidden="true">↓</span></a>
    </section>
    <Directory />
    <aside className="editorial-note"><span className="note-mark" aria-hidden="true">味</span><div><h2>城市的味道，從日常開始。</h2><p>這裡沒有標準答案。<br />只有一點好奇，和屬於你的小小趣味。</p></div></aside>
  </AppShell>;
}

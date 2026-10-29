'use client';
import { AppShell, WIP_SITES, cssVars, siteHref, useSites, type SiteId } from '@taichung/ui';
import { Coin, GameDefs, GameIcon, type GameIconName } from '@taichung/ui/gamekit';

const order: SiteId[] = ['comic', 'check', 'postcard', 'fortune', 'flavor'];
const icons: Record<SiteId, GameIconName> = { comic: 'comic', check: 'check', postcard: 'postcard', fortune: 'fortune', flavor: 'flavor' };
const colors: Record<SiteId, string> = { comic: 'sun', check: 'white', postcard: 'cyan', fortune: 'coral', flavor: 'blue' };
const tags: Record<SiteId, string> = { comic: '畫四格', check: '寫願望', postcard: '混聲音', fortune: '長按', flavor: '3 題' };
// Games served by the main site (public/): adventure, bubble PvP and AI chat.
const MAIN = 'https://taichungway.sowork.ai';
const games = [
  { id: 'adventure', title: '城市冒險', tag: '探索 · 解任務', href: `${MAIN}/adventure.html`, icon: 'city' as GameIconName, featured: true, color: 'blue' },
  { id: 'bubble', title: '泡泡 PK', tag: '雙人對戰', href: `${MAIN}/bubble.html`, icon: 'bubble' as GameIconName, color: 'coral' },
  { id: 'chat', title: '啟臣，聊一下', tag: 'AI 聊天', href: `${MAIN}/chat.html`, icon: 'chat' as GameIconName, color: 'cyan' },
  { id: 'english', title: '一口好英文', tag: '每天一課', href: `${MAIN}/english.html`, icon: 'english' as GameIconName, color: 'sun' },
  { id: 'bike', title: '單車逛台中', tag: '騎車撿小吃', href: `${MAIN}/bike.html`, icon: 'bike' as GameIconName, color: 'cyan' },
];
const HIGHLIGHT: SiteId = 'fortune';

function Directory() {
  const { sites, loading, error } = useSites();
  const sorted = [...sites].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const card = (site: (typeof sites)[number]) => {
    const wip = WIP_SITES.includes(site.id);
    const href = wip ? undefined : siteHref(site);
    const content = <><GameIcon name={icons[site.id]} /><span className="gk-tile-title">{site.title}</span><span className="gk-tile-tag">{href ? `${tags[site.id]} · ${site.durationSec} 秒${site.usesAI ? ' · AI' : ''}` : wip ? '趕工中' : '即將上線'}</span></>;
    return href ? <a className={`experience-card live-card gk-tile gk-tile--${colors[site.id]} ${site.id}`} key={site.id} href={href} style={cssVars({ '--accent': site.accent })} data-site-id={site.id}>{content}</a>
      : <article className={`experience-card soon-card${wip ? ' wip-card' : ''}`} key={site.id} aria-disabled="true" data-site-id={site.id}>{content}</article>;
  };
  const gameTile = (game: (typeof games)[number]) => <a key={game.id} className={`hub-tile gk-tile gk-tile--${game.color}${game.featured ? ' is-featured gk-shine' : ''}`} href={game.href} data-game-id={game.id}>
    <GameIcon name={game.icon} /><span className="gk-tile-title">{game.title}</span><span className="gk-tile-tag">{game.tag}</span>
  </a>;
  return <section id="experiences" className="directory clean-directory hub-game" aria-labelledby="directory-title">
    <h2 id="directory-title" className="sr-only">互動體驗</h2>
    <div className="hub-grid hub-grid-main">{gameTile(games[0]!)}{gameTile(games[1]!)}{sorted.filter(site => site.id === HIGHLIGHT).map(card)}</div>
    <p className="hub-divider"><span>更多好玩的</span></p>
    <p className="directory-notice" role="status">{loading ? '正在確認各站開放狀態…' : error ? '暫時讀不到開放狀態，請稍後重試。' : '不用登入，你的文字只留在你的裝置。'}</p>
    <div className="experience-list hub-grid">{gameTile(games[2]!)}{gameTile(games[3]!)}{gameTile(games[4]!)}{sorted.filter(site => site.id !== HIGHLIGHT).map(card)}</div>
  </section>;
}
export default function Page() {
  return <AppShell title="台中味" eyebrow="">
    <section className="hub-hero clean-hero hub-game-hero" aria-labelledby="hub-title">
      <GameDefs />
      <div className="hub-hero-top"><Coin>{games.length + order.length} 關</Coin></div>
      <h1 id="hub-title" className="gk-title-stack" aria-label="台中味，開玩！"><b className="gk-3d" data-text="台中味" style={cssVars({ '--s': '78px' })} aria-hidden="true"><span>台中味</span></b><b className="gk-3d gk-3d--coral" data-text="開玩！" style={cssVars({ '--s': '78px', '--r': '-3deg' })} aria-hidden="true"><span>開玩！</span></b></h1><i className="gk-sparkle hub-spark-1" aria-hidden="true" /><i className="gk-sparkle hub-spark-2" aria-hidden="true" />
      <div className="hub-host"><svg className="hub-host-fig gk-float" viewBox="0 0 120 150" aria-hidden="true" focusable="false"><ellipse cx="60" cy="144" rx="30" ry="6" fill="#0d203a55" /><rect x="40" y="108" width="14" height="30" rx="4" fill="#0d2039" /><rect x="66" y="108" width="14" height="30" rx="4" fill="#0d2039" /><rect x="34" y="132" width="22" height="9" rx="4" fill="#06162b" /><rect x="64" y="132" width="22" height="9" rx="4" fill="#06162b" /><rect x="30" y="68" width="60" height="50" rx="14" fill="#1a63c8" stroke="#06162b" strokeWidth="4" /><path d="M50 68h20l-10 30z" fill="#fff" /><path d="M57 76h6l3 22-6 6-6-6z" fill="#004c9f" /><rect x="18" y="72" width="14" height="38" rx="7" fill="#1a63c8" stroke="#06162b" strokeWidth="3" /><rect x="88" y="72" width="14" height="38" rx="7" fill="#1a63c8" stroke="#06162b" strokeWidth="3" /><circle cx="25" cy="112" r="7" fill="#efd0a9" /><circle cx="95" cy="112" r="7" fill="#efd0a9" /><rect x="36" y="14" width="48" height="56" rx="22" fill="#efd0a9" stroke="#06162b" strokeWidth="3" /><path d="M34 40c-2-26 10-34 28-33 18-1 26 9 24 33-3-8-6-14-12-17-8 6-20 6-30 0-6 3-9 9-10 17z" fill="#1c2a44" /><g fill="none" stroke="#0d2039" strokeWidth="2.6"><rect x="40" y="38" width="17" height="14" rx="5" /><rect x="63" y="38" width="17" height="14" rx="5" /><path d="M57 44h6" /></g><circle cx="48.5" cy="45" r="2.6" fill="#0d2039" /><circle cx="71.5" cy="45" r="2.6" fill="#0d2039" /><path d="M52 59q8 7 16 0" fill="none" stroke="#a65c4a" strokeWidth="2.6" strokeLinecap="round" /></svg><p className="gk-speech hub-speech">今天想玩哪一個？</p></div>
    </section>
    <Directory />
  </AppShell>;
}

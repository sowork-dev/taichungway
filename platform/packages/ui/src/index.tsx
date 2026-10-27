'use client';

export { PolicyPlay } from './policy-play';

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

export const SITE_IDS = ['check', 'fortune', 'flavor', 'postcard', 'comic'] as const;
export type SiteId = typeof SITE_IDS[number];
export interface SiteRecord {
  id: SiteId; title: string; tagline: string; url: string; durationSec: number;
  usesAI: boolean; accent: string; status: 'live' | 'soon';
}

/** Fail closed: an invalid or incomplete directory never creates a live link. */
export function validateSites(input: unknown, origin: string): SiteRecord[] | null {
  if (!Array.isArray(input) || input.length !== SITE_IDS.length) return null;
  const seen = new Set<string>();
  const records: SiteRecord[] = [];
  for (const value of input) {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || !SITE_IDS.includes(row.id as SiteId) || seen.has(row.id)) return null;
    if (typeof row.title !== 'string' || !row.title.trim() || Array.from(row.title).length > 8 ||
        typeof row.tagline !== 'string' || !row.tagline.trim() || Array.from(row.tagline).length > 20 ||
        typeof row.durationSec !== 'number' || !Number.isFinite(row.durationSec) || row.durationSec <= 0 ||
        typeof row.usesAI !== 'boolean' || typeof row.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(row.accent) ||
        (row.status !== 'live' && row.status !== 'soon') || typeof row.url !== 'string') return null;
    try {
      const url = new URL(row.url);
      const local = url.origin === origin && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null;
    } catch { return null; }
    seen.add(row.id);
    records.push({ id: row.id as SiteId, title: row.title, tagline: row.tagline, url: row.url,
      durationSec: row.durationSec, usesAI: row.usesAI, accent: row.accent, status: row.status });
  }
  return records;
}

// Experiences still being finished: shown as 趕工中 and not linked from the hub or footer.
export const WIP_SITES: SiteId[] = ['comic', 'check', 'postcard', 'flavor'];
export function siteHref(site: SiteRecord): string | undefined {
  if (site.status !== 'live') return undefined;
  const url = new URL(site.url);
  url.searchParams.set('utm_source', 'hub');
  url.searchParams.set('utm_medium', 'card');
  url.searchParams.set('utm_campaign', site.id);
  return url.href;
}

const placeholderSites: SiteRecord[] = [
  { id: 'fortune', title: '沾福氣', tagline: '長按一下，收下一點日常的暖', durationSec: 10, usesAI: false, accent: '#1A63C8' },
  { id: 'flavor', title: '你是哪一味', tagline: '三個小選擇，找到你的台中味', durationSec: 30, usesAI: false, accent: '#1A63C8' },
  { id: 'check', title: '對開支票本', tagline: '寫下心願，看看城市的想像', durationSec: 45, usesAI: false, accent: '#1A63C8' },
  { id: 'postcard', title: '台中聲音明信片', tagline: '把一座城市的聲音，寄給你', durationSec: 45, usesAI: false, accent: '#1A63C8' },
  { id: 'comic', title: '巷口四格漫畫', tagline: '一件身邊小事，畫成四格日常', durationSec: 60, usesAI: false, accent: '#1A63C8' },
].map(site => ({ ...site, status: 'soon', url: '' }) as SiteRecord);

interface DirectoryState { sites: SiteRecord[]; loading: boolean; error: boolean }
const SitesContext = createContext<DirectoryState>({ sites: placeholderSites, loading: true, error: false });
export function useSites() { return useContext(SitesContext); }
function useLiveDirectory(): DirectoryState {
  const [directory, setDirectory] = useState<DirectoryState>({ sites: placeholderSites, loading: true, error: false });
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function refresh() {
      controller?.abort();
      const request = new AbortController(); controller = request;
      try {
        const response = await fetch('/sites.json', { cache: 'no-store', signal: request.signal });
        if (!response.ok) throw new Error('Directory unavailable');
        const sites = validateSites(await response.json(), window.location.origin);
        if (!sites) throw new Error('Directory invalid');
        if (active && !request.signal.aborted) setDirectory({ sites, loading: false, error: false });
      } catch {
        if (active && !request.signal.aborted) setDirectory({ sites: placeholderSites, loading: false, error: true });
      }
    }
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(onVisibility, 30_000);
    return () => { active = false; controller?.abort(); window.clearInterval(interval);
      window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  return directory;
}

export type ArtKind = 'market' | 'tea' | 'sea' | 'gate' | 'home' | 'oldtown' | 'port' | 'field' | 'craft' | 'breakfast' | 'letter' | 'comic' | 'machine';
export const FLAVOR_ART = Object.freeze({ market: 'market', tea: 'tea', sea: 'sea', home: 'home', oldtown: 'oldtown', port: 'port', field: 'field', craft: 'craft' } as const satisfies Record<string, ArtKind>);

/** Hand-drawn geometry, authored for this preview; no remote art or likeness. */
export function LocalArt({ kind = 'gate', className = '' }: { kind?: ArtKind; className?: string }) {
  const sea = kind === 'sea' || kind === 'port';
  const tea = kind === 'tea' || kind === 'field';
  const shop = kind === 'market' || kind === 'breakfast';
  return <svg className={`local-art ${className}`} viewBox="0 0 320 210" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <circle cx="246" cy="48" r="27" fill="#7FC0F0" />
    <path d="M28 61h38m-22-9h40M257 87h34m-18-9h29" stroke="#BDD8FA" strokeWidth="4" strokeLinecap="round" />
    <path d="M18 176c59-18 104 13 151-2s93-7 133 5" stroke="#7FC0F0" strokeWidth="2" />
    {kind === 'field' ? <>
      <path d="m18 125 64-59 61 66 54-49 109 57" fill="#7FC0F0" />
      <path d="M14 152q136-57 292 0v32H14Z" fill="#134E9E" />
      <path d="M41 177q120-50 244-4M26 162q133-50 264-5m-130-14v40m-57-31-24 30m127-27 35 28" stroke="#BDD8FA" strokeWidth="3" />
      <path d="M96 86h87v50H96Zm-10 0 54-32 54 32Z" fill="#BDD8FA" stroke="#112A4D" strokeWidth="3" strokeLinejoin="round" />
      <path d="M129 136v-31h22v31m81-12V83m0 19-13-12m13 0 13-13" stroke="#112A4D" strokeWidth="3" />
      <path d="m222 78 9-15 9 15" stroke="#134E9E" strokeWidth="5" strokeLinecap="round" />
    </> : kind === 'home' ? <>
      <path d="M47 174V99l63-48 63 48v75Z" fill="#BDD8FA" stroke="#112A4D" strokeWidth="3" strokeLinejoin="round" />
      <path d="m37 102 73-57 74 57" stroke="#134E9E" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M93 174v-51h34v51M62 104h19v26H62Zm78 0h18v26h-18Z" fill="#134E9E" stroke="#112A4D" strokeWidth="2" />
      <path d="M195 174v-59h58v59m-65-59h74M47 178h237" stroke="#112A4D" strokeWidth="3" strokeLinecap="round" />
      <path d="M214 112v-21m0 7q-26-1-22-18 20-4 22 18m0-4q23 1 22-17-21 0-22 17" fill="#1A63C8" stroke="#134E9E" strokeWidth="2" />
      <circle cx="221" cy="155" r="14" fill="#1A63C8" /><path d="M220 144v21m-8-12h17" stroke="#F3F8FF" strokeWidth="2" />
    </> : kind === 'oldtown' ? <>
      <path d="M52 176V68h89v108m12 0V93h111v83" fill="#BDD8FA" stroke="#112A4D" strokeWidth="3" />
      <path d="M47 67h99m-93 20h87m13 5h115" stroke="#112A4D" strokeWidth="5" />
      <path d="M69 105h53v71H69Zm101 6h33v36h-33Zm45 0h32v36h-32Z" fill="#134E9E" stroke="#112A4D" strokeWidth="2" />
      <path d="M80 115h29m-29 10h29m-29 10h20m58 25h91" stroke="#BDD8FA" strokeWidth="3" />
      <path d="M123 182v-39q23-9 37 3 17-12 39-3v39q-23-8-39 3-17-11-37-3Z" fill="#F3F8FF" stroke="#112A4D" strokeWidth="3" />
      <path d="M160 146v39m-28-30 17 2m22 0 17-2M39 185h241" stroke="#112A4D" strokeWidth="2" strokeLinecap="round" />
    </> : kind === 'port' ? <>
      <path d="M13 152q37-17 74 0t74 0 74 0 74 0v36H13Z" fill="#1A63C8" />
      <path d="M13 172q37-17 74 0t74 0 74 0 74 0" stroke="#F3F8FF" strokeWidth="3" />
      <path d="M55 137V59h93m-93 0 51 35m-51-35v78m77-78v47m-8 0h16v13h-16Z" stroke="#112A4D" strokeWidth="4" strokeLinejoin="round" />
      <path d="m125 134 22 27h103l26-27Z" fill="#112A4D" />
      <path d="M151 115h35v19h-35Zm40-17h37v36h-37Zm43 15h23v21h-23Z" fill="#1A63C8" stroke="#112A4D" strokeWidth="2" />
      <path d="M202 97V79h21v18m-65 29h21m22-16h17m23 14h9" stroke="#112A4D" strokeWidth="3" />
      <path d="m252 70 8-8 8 8" stroke="#112A4D" strokeWidth="2" strokeLinecap="round" />
    </> : tea ? <>
      <path d="m12 154 62-86 55 69 49-89 124 116Z" fill="#1A63C8" />
      <path d="m59 163 55-74 69 77 58-51 66 62Z" fill="#134E9E" />
      <path d="M37 153q51-20 105 15m-97-2q46-12 83 5m48-20q48-22 103 13m-92-1q42-16 97 13" stroke="#BDD8FA" strokeWidth="3" />
      <path d="M128 124h63v39q-31 23-63 0Z" fill="#E3EFFF" stroke="#112A4D" strokeWidth="3" />
      <path d="M191 132c27-6 23 29 0 24m-44-45q-10-13 0-24m15 24q-10-13 0-24" stroke="#112A4D" strokeWidth="3" strokeLinecap="round" />
      <path d="M119 175h85" stroke="#112A4D" strokeWidth="4" strokeLinecap="round" />
    </> : sea ? <>
      <path d="M10 147q39-20 75 0t75 0 75 0 75 0v45H10Z" fill="#1A63C8" />
      <path d="M10 165q39-20 75 0t75 0 75 0 75 0m-285 16q39-20 75 0t75 0 75 0" stroke="#F3F8FF" strokeWidth="3" />
      <path d="m89 127 28 29h93l26-29Z" fill="#112A4D" />
      <path d="M157 48v78m7-74 58 62h-58Z" stroke="#112A4D" strokeWidth="3" fill="#E3EFFF" />
      <path d="m149 69-46 45h46Z" fill="#1A63C8" />
      <path d="m42 99 9-9 9 9m190 9 8-8 8 8" stroke="#112A4D" strokeWidth="2" strokeLinecap="round" />
    </> : shop ? <>
      <path d="M61 100h197v78H61Z" fill="#BDD8FA" stroke="#112A4D" strokeWidth="3" />
      <path d="m49 103 21-45h181l20 45Z" fill="#1A63C8" stroke="#112A4D" strokeWidth="3" strokeLinejoin="round" />
      {[65, 108, 151, 194, 237].map(x => <path key={x} d={`m${x} 59-9 43h22l4-43`} fill="#E3EFFF" />)}
      <path d="M83 124h71v54H83Zm93-6h59v40h-59Z" fill="#134E9E" />
      <path d="M53 160h214v18H53Z" fill="#112A4D" />
      <circle cx="88" cy="152" r="10" fill="#7FC0F0" /><circle cx="111" cy="151" r="12" fill="#7FC0F0" /><circle cx="138" cy="153" r="9" fill="#1A63C8" />
      <path d="M183 134h44m-44 9h29" stroke="#BDD8FA" strokeWidth="3" />
      <path d="M38 180h247" stroke="#112A4D" strokeWidth="3" strokeLinecap="round" />
    </> : kind === 'craft' || kind === 'machine' ? <>
      <path d="M54 158h213v20H54Z" fill="#112A4D" /><path d="M78 96h159v62H78Z" fill="#BDD8FA" stroke="#112A4D" strokeWidth="3" />
      <circle cx="157" cy="111" r="42" stroke="#112A4D" strokeWidth="13" strokeDasharray="13 7" /><circle cx="157" cy="111" r="17" fill="#7FC0F0" stroke="#112A4D" strokeWidth="3" />
      <path d="m229 115 30-42 12 9-30 42m-140 34-16-25 9-7 24 32" stroke="#112A4D" strokeWidth="5" strokeLinecap="round" />
    </> : kind === 'letter' || kind === 'comic' ? <>
      <rect x="62" y="61" width="197" height="119" rx="9" fill="#BDD8FA" stroke="#112A4D" strokeWidth="3" />
      <path d="m65 67 95 68 96-68m-191 108 65-61m125 61-65-61" stroke="#112A4D" strokeWidth="3" />
      <circle cx="160" cy="125" r="19" fill="#1A63C8" /><path d="m153 125 6 6 10-13" stroke="#F3F8FF" strokeWidth="3" />
    </> : <>
      <path d="M45 164h50V88h130v76h50v14H45Z" fill="#7FC0F0" />
      <path d="M88 91h144V79H88Zm-14-13 30-17h112l31 17Z" fill="#112A4D" />
      <path d="M106 167V101h108v66h-23v-27a31 31 0 0 0-62 0v27Z" fill="#1A63C8" stroke="#112A4D" strokeWidth="3" />
      <path d="M103 59h115m-60-15v16" stroke="#112A4D" strokeWidth="4" strokeLinecap="round" />
      <path d="M52 92v12m0 35v13m217-60v12m0 35v13" stroke="#112A4D" strokeWidth="3" />
      <ellipse cx="52" cy="122" rx="17" ry="22" fill="#7FC0F0" /><ellipse cx="269" cy="122" rx="17" ry="22" fill="#7FC0F0" />
      <path d="M52 102v40m217-40v40" stroke="#134E9E" strokeWidth="2" />
      <path d="m141 178 18-35 22 35" fill="#BDD8FA" /><path d="M32 181h257" stroke="#112A4D" strokeWidth="3" strokeLinecap="round" />
      <path d="m41 39 3-9 3 9 9 3-9 3-3 9-3-9-9-3Z" fill="#1A63C8" />
    </>}
    <path d="M92 194h136" stroke="#7FC0F0" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

export function AppShell({ children, title = '台中味', eyebrow = '把日常，玩成一點喜歡。' }: { children: ReactNode; title?: string; eyebrow?: string }) {
  const [large, setLarge] = useState(false);
  const directory = useLiveDirectory();
  const others = directory.sites.filter(site => site.title !== title);
  return <SitesContext.Provider value={directory}><div className={`app-shell gk-root${large ? ' large-type' : ''}`}>
    <a className="skip-link" href="#main">跳到主要內容</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="台中味互動首頁"><span className="brand-mark" aria-hidden="true">味</span><span>台中味<span className="brand-sub">日常遊樂場</span></span></a>
      <button className="type-toggle" type="button" aria-pressed={large} onClick={() => setLarge(v => !v)}><span aria-hidden="true">Aa</span> 大字模式</button>
    </header>
    <main id="main" tabIndex={-1}>{eyebrow && <p className="page-eyebrow">{eyebrow}</p>}{children}</main>
    <footer className="site-footer">
      <a className="more-link" href="/">更多台中味 <span aria-hidden="true">↗</span></a>
      <nav className="other-sites" aria-label="其他互動體驗">{others.map(site => {
        const href = WIP_SITES.includes(site.id) ? undefined : siteHref(site);
        return href ? <a key={site.id} href={href}>{site.title}<span aria-hidden="true"> ↗</span></a> : <span key={site.id} aria-disabled="true">{site.title}<span className="soon-note">・{WIP_SITES.includes(site.id) ? '趕工中' : '即將上線'}</span></span>;
      })}</nav>
      <p className="preview-disclosure">獨立互動預覽，非官方網站；尚未取得競選團隊授權或背書。</p>
      <nav className="legal-links" aria-label="網站資訊"><a href="https://taichungway.tw/" target="_blank" rel="noopener noreferrer">臺中味官網 ↗</a><a href="/privacy/">隱私權聲明</a></nav>
      <p>本階段不使用 AI、不設 Cookie、不追蹤。<br />所有作答與暱稱只留在此頁，重新整理即清除。</p>
      <p className="footer-sign">原創插畫與文字 · 互動預覽</p>
    </footer>
  </div></SitesContext.Provider>;
}

export function NicknameField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="nickname-field"><label htmlFor="nickname">留個暱稱在卡片上 <span>（選填）</span></label>
    <input id="nickname" type="text" value={value} maxLength={20} autoComplete="off" placeholder="怎麼稱呼你？" aria-describedby="nickname-help" onChange={event => onChange(Array.from(event.target.value).slice(0, 10).join(''))} />
    <p id="nickname-help">最多 10 字，只在本機使用，不放進分享連結。</p></div>;
}

export function ResultActions({ title, body, nickname, accent, kind, variant, policyId }: { title: string; body: string; nickname: string; accent: string; kind: 'fortune' | 'flavor'; variant?: string; policyId?: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function download() {
    setBusy(true); setNotice('');
    try { const { downloadCard } = await import('@taichung/share-card'); await downloadCard({ title, body, nickname, accent, kind, variant, policyId }); setNotice('圖卡已準備好；可在下載項目中查看。'); }
    catch { setNotice('這個瀏覽器暫時無法下載，請換瀏覽器再試，或截圖保存。'); }
    finally { setBusy(false); }
  }
  async function share() {
    setBusy(true); setNotice('');
    try { const { shareResult } = await import('@taichung/line'); const status = await shareResult({ title, url: gameShareUrl(window.location.href) }); setNotice(status === 'copied' ? '已複製遊戲連結，不含暱稱與作答。' : status === 'shared' ? '已開啟分享。連結讓朋友重新開始玩。' : '已取消分享。'); }
    catch { setNotice('暫時無法分享，請從網址列複製遊戲連結。'); }
    finally { setBusy(false); }
  }
  return <><div className="result-actions"><button type="button" className="button primary" disabled={busy} onClick={download}>下載圖卡 <span aria-hidden="true">↓</span></button><button type="button" className="button secondary" disabled={busy} onClick={share}>分享連結 <span aria-hidden="true">↗</span></button></div><p className="action-notice" role="status" aria-live="polite">{notice || '圖卡在裝置上產生，不上傳；分享的只有遊戲連結。'}</p></>;
}

export function holdFeedback(elapsedMs: number): { progress: number; particles: number } {
  const progress = Math.min(1, Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs / 1500 : 0));
  return { progress, particles: Math.max(1, Math.ceil(progress * 60)) };
}

/** Keep the deployment path, never a query containing personal text or answers. */
export function gameShareUrl(currentUrl: string): string {
  const url = new URL(currentUrl);
  url.search = ''; url.hash = '';
  return url.href;
}

export function cssVars(values: Record<string, string | number>): CSSProperties { return values as CSSProperties; }

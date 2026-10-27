'use client';

import { useState, type ReactNode, type RefObject } from 'react';
import { POLICIES } from '@taichung/policy-data';
import { GameDefs } from './gamekit';

export function cleanText(value: string, max: number): string {
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, Math.max(0, max)).join('');
}
export function readPolicy(id: string) {
  const row = POLICIES.find(policy => policy.id === id);
  if (!row) throw new RangeError('Unknown canonical policy');
  return row;
}
const studios = [{ id:'comic', title:'巷口四格漫畫', hint:'畫一件日常' }, { id:'check', title:'對開支票本', hint:'寫一張願望' }, { id:'postcard', title:'台中聲音明信片', hint:'寄一段聲音' }] as const;
export function StudioShell({id, kicker, title, description, children}: {id:string;kicker:string;title:string;description:string;children:ReactNode}) {
  const [large, setLarge] = useState(false);
  return <div className={`studio-shell gk-root gk-stage${large ? ' large-type' : ''}`}><GameDefs />
    <a href="#studio-main" className="skip-link">跳到主要內容</a>
    <header className="studio-header"><a className="studio-brand" href="/" aria-label="台中味互動首頁"><span className="studio-brand-square">味</span><span>台中味<span className="studio-brand-caption">TAICHUNG WAY</span></span></a><nav aria-label="互動主選單">{studios.map(item => <a key={item.id} href={`/${item.id}/`} aria-current={id === item.id ? 'page' : undefined}>{item.title}</a>)}</nav><button type="button" className="studio-type" aria-pressed={large} onClick={() => setLarge(!large)}>Aa<span>大字模式</span></button></header>
    <main className="studio-main" id="studio-main" tabIndex={-1}><div className="studio-breadcrumb"><a href="/">互動首頁</a><span aria-hidden="true">／</span><span>{title}</span></div><section className="studio-intro"><p className="studio-kicker">{kicker}</p><h1>{title}<span className="studio-title-period" aria-hidden="true">。</span></h1><p className="studio-description">{description}</p><p className="studio-independent">江啟臣政見互動 · 非官方製作</p></section>{children}</main>
    <footer className="studio-footer"><div className="studio-footer-top"><a href="/" className="studio-footer-brand">台中味<span>日常，是認識城市的開始。</span></a><nav aria-label="更多台中味"><a href="/fortune/">沾福氣 ↗</a><a href="/flavor/">你是哪一味 ↗</a><a href="https://taichungway.tw/future" target="_blank" rel="noopener noreferrer">官網政見來源 ↗</a><a href="/privacy/">隱私權聲明</a></nav></div><div className="studio-footer-bottom"><p>SoWork 獨立製作，非官方網站；未取得競選團隊授權或背書。政見不等於施政成果。</p><p>本版本不使用 AI、不設 Cookie、不追蹤；輸入僅在此頁暫存。分享網址不包含私人文字。</p></div></footer>
  </div>;
}
export function PolicySource({policyId}: {policyId:string}) {
  const policy = readPolicy(policyId);
  return <aside className="studio-policy" data-policy-id={policy.id}>
    <p className="studio-policy-kicker">日常背後的城市提案 <span>{policy.category} · {policy.id}</span></p>
    <h3>{policy.title}</h3>
    <a href={policy.sourceUrl} target="_blank" rel="noopener noreferrer">出處：taichungway.tw 臺中未來 ↗</a>
    <p className="studio-policy-disclosure">江啟臣政見 · 非施政成果 · 概念示意非實測結果<br />非官方互動；尚未取得競選團隊授權或背書。</p>
  </aside>;
}
/** Only a strict, public district/volume mix may survive; no message/name/answer data. */
export function safeStudioShareUrl(input: string): string {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new TypeError('Invalid share origin');
  const mix = url.pathname === '/postcard/m/' ? url.searchParams.get('mix') : null;
  url.search = ''; url.hash = '';
  if (mix) {
    const items = mix.split(','); const seen = new Set<string>();
    if (items.length <= 3 && items.every(item => {
      const match = /^(d(?:0[1-9]|1[0-9]|2[0-9])):(0|[1-9]\d?|100)$/.exec(item);
      if (!match || seen.has(match[1]!)) return false;
      seen.add(match[1]!); return true;
    })) url.searchParams.set('mix', mix);
  }
  return url.href;
}
export function StudioActions({targetRef, fileName, title, shareUrl}: {targetRef:RefObject<HTMLDivElement|null>;fileName:string;title:string;shareUrl?:string}) {
  const [busy,setBusy] = useState(false); const [notice,setNotice] = useState('');
  async function download() {
    if (!targetRef.current) return;
    setBusy(true); setNotice('正在裝置上排版圖卡…');
    try {
      await document.fonts.ready;
      const { toCanvas } = await import('html-to-image');
      const element = targetRef.current;
      // A4:5 canvas fits the entire real artwork rather than clipping its source/disclosure.
      const source = await toCanvas(element, {backgroundColor:'#FFFFFF', pixelRatio:2, cacheBust:false, skipAutoScale:true, filter:node => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true')});
      const canvas = document.createElement('canvas'); canvas.width=1080; canvas.height=1350;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
      context.fillStyle='#FFFFFF'; context.fillRect(0,0,1080,1350);
      const scale = Math.min(1024/source.width,1294/source.height); const width=source.width*scale;const height=source.height*scale;
      context.drawImage(source,(1080-width)/2,(1350-height)/2,width,height);
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image unavailable')),'image/png'));
      const objectUrl=URL.createObjectURL(blob); const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=`${fileName.replace(/[^a-z0-9_-]/gi,'') || 'taichungway'}.png`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30_000);
      setNotice('圖卡已準備好，可在下載項目查看。1080 × 1350 PNG；不含音訊。');
    } catch { setNotice('目前瀏覽器無法匯出；請重試、以 Safari／Chrome 開啟，或截圖保存。'); }
    finally { setBusy(false); }
  }
  async function share() {
    setBusy(true);setNotice('');
    try {
      const url=safeStudioShareUrl(shareUrl ?? window.location.href);
      if (navigator.share) { await navigator.share({title,url});setNotice('已開啟分享；網址不含暱稱與私人文字。'); }
      else { await navigator.clipboard.writeText(url);setNotice('已複製連結；網址不含暱稱與私人文字。'); }
    } catch(error) { setNotice(error instanceof DOMException && error.name==='AbortError' ? '已取消分享。' : '分享未成功，請複製下方連結。'); }
    finally {setBusy(false);}
  }
  return <div className="studio-actions"><div><button className="studio-button" type="button" disabled={busy} onClick={download} data-testid="studio-download">下載圖卡 <span aria-hidden="true">↓</span></button><button className="studio-button secondary" type="button" disabled={busy} onClick={share} data-testid="studio-share">分享連結 <span aria-hidden="true">↗</span></button></div><p role="status" aria-live="polite">{notice || '圖卡在裝置上產生，不上傳；私人文字只留在你的圖卡。'}</p>{shareUrl && <a className="studio-listen-link" href={safeStudioShareUrl(shareUrl)}>開啟聆聽連結 ↗</a>}</div>;
}

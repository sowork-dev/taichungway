/// <reference path="./page-flip.d.ts" />
'use client';

import { useEffect, useRef, useState } from 'react';
import { cleanText, readPolicy } from '@taichung/ui/studio';
import type { PageFlip } from 'page-flip';
import type { CheckResult } from './check-model';
import { LOCAL_MATCH_LABEL, NO_LOCAL_MATCH } from './check-artwork';

/** Optional duplicate presentation. The exact accessible/exportable result stays above. */
export function CheckBooklet({ result }: { result: CheckResult }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const [eligible, setEligible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1100px) and (prefers-reduced-motion: no-preference)');
    const measure = () => setEligible(query.matches && (measureRef.current?.clientWidth ?? 0) >= 540);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (measureRef.current) observer?.observe(measureRef.current);
    query.addEventListener('change', measure); window.addEventListener('resize', measure); measure();
    return () => { observer?.disconnect(); query.removeEventListener('change', measure); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => {
    if (!enabled || !eligible || !hostRef.current) return;
    const host = hostRef.current;
    let cancelled = false;
    let instance: PageFlip | null = null;
    let initialized = false;
    // PageFlip removes/moves its root and pages. All of these nodes are vanilla-owned,
    // never React children, so destroy cannot break React reconciliation on reset.
    const root = document.createElement('div'); root.className = 'check-flip-root';
    host.appendChild(root); setStatus('loading'); setPage(0);
    const dispose = () => {
      if (instance && initialized) {
        try { instance.destroy(); } catch { root.remove(); }
        instance = null;
      }
      root.remove();
    };
    void import('page-flip').then(({ PageFlip: Flip }) => {
      if (cancelled) return;
      const policy = result.policyId ? readPolicy(result.policyId) : null;
      const pages = [
        ['對開支票本', '把生活願望，寫給下一個四年。', '翻開，是你的日常與公開政見的並排閱讀。'],
        ['01 / 我的生活願望', `「${cleanText(result.wish, 60)}」`, `願望署名：${cleanText(result.nickname, 10) || '一位台中生活者'}`],
        ['02 / 公開政見對照', policy?.title ?? NO_LOCAL_MATCH, policy ? `${policy.category} · ${policy.id}\n出處：${policy.sourceUrl}` : '查閱完整政見：taichungway.tw/future'],
        ['我們的四年', '把想要的日常，留給未來持續關心。', `${LOCAL_MATCH_LABEL}。非官方互動，非有價證券，無金額與兌付效力。`],
      ].map(([heading, body, note], index) => {
        const sheet = document.createElement('div'); sheet.className = `check-book-page${index === 0 || index === 3 ? ' is-cover' : ''}`;
        if (index === 0 || index === 3) sheet.dataset.density = 'hard';
        const title = document.createElement('h3'); title.textContent = heading;
        const text = document.createElement('p'); text.className = 'check-book-body'; text.textContent = body;
        const foot = document.createElement('p'); foot.className = 'check-book-note'; foot.textContent = note;
        sheet.append(title, text, foot); root.appendChild(sheet); return sheet;
      });
      instance = new Flip(root, { width: 260, height: 370, size: 'fixed', showCover: true, usePortrait: false, autoSize: false, flippingTime: 650, maxShadowOpacity: .15, useMouseEvents: true, mobileScrollSupport: false, disableFlipByClick: true, clickEventForward: false });
      flipRef.current = instance;
      instance.on('init', () => {
        initialized = true;
        if (cancelled) dispose(); else setStatus('ready');
      });
      instance.on('flip', event => { if (!cancelled && typeof event.data === 'number') setPage(event.data); });
      instance.loadFromHTML(pages);
    }).catch(() => {
      if (!cancelled) setStatus('fallback');
      initialized = true; dispose(); flipRef.current = null;
    });
    return () => {
      cancelled = true; flipRef.current = null;
      // loadFromHTML schedules its init callback; let it initialize before destroy.
      if (initialized) dispose(); else root.remove();
    };
  }, [enabled, eligible, result]);

  const labels = ['封面', '我的願望／公開政見', '我的願望／公開政見', '我們的四年'];
  return <section className="check-booklet" ref={measureRef} aria-labelledby="check-booklet-title">
    <div className="check-booklet-heading"><div><p className="check-eyebrow">ONE MORE WAY TO READ</p><h3 id="check-booklet-title">也可以，翻成一本。</h3></div><span>選用預覽</span></div>
    <p>這是同一份願望與政見的翻頁版本；完整文字與下載仍在上方，不必翻頁也能使用。</p>
    {eligible ? <button type="button" className="studio-button secondary" aria-pressed={enabled} onClick={() => setEnabled(value => !value)}>{enabled ? '關閉翻頁預覽' : '開啟翻頁預覽'}</button> : <p className="studio-note">小螢幕或減少動態效果模式：使用上方靜態對開版，所有內容與保存功能完全相同。</p>}
    {enabled && eligible && <>
      <div className="check-book-host" ref={hostRef} aria-hidden="true" />
      {status === 'ready' && <div className="check-book-buttons"><button type="button" className="studio-button secondary" disabled={page === 0} onClick={() => flipRef.current?.flipPrev('top')}>← 前一頁</button><span role="status">{labels[page] ?? '翻頁中'}</span><button type="button" className="studio-button secondary" disabled={page >= 3} onClick={() => flipRef.current?.flipNext('top')}>下一頁 →</button></div>}
      <p role="status">{status === 'loading' ? '正在準備本機翻頁預覽…你仍可使用上方完整內容。' : status === 'fallback' ? '本機翻頁預覽未能載入；上方靜態版與下載不受影響。' : ''}</p>
    </>}
  </section>;
}

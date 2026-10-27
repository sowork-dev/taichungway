'use client';

import { useState } from 'react';
import { CARDS, RARITY_INFO, TYPE_INFO, WEAK_TO, RESISTS, cardCp, cardCost, cardDamage, SET_NAME, type ObjectCard } from '@taichung/experience';
import { CARD_ART } from './card-art';

const pad = (n: number) => String(n).padStart(3, '0');
const dots = (n: number) => Array.from({ length: n }, (_, i) => <i key={i} />);

export function CardFront({ card, foil = false, size }: { card: ObjectCard; foil?: boolean; size?: 'mini' }) {
  const type = TYPE_INFO[card.type], weak = TYPE_INFO[WEAK_TO[card.type]], res = TYPE_INFO[RESISTS[card.type]];
  const rarity = RARITY_INFO[card.rarity], cost = cardCost(card);
  return <div className={`cd t-${card.type} fin-${card.rarity}${foil ? ' cd-foil' : ''}`} data-card-no={card.no} data-rarity={card.rarity} data-foil={foil ? 'true' : 'false'} role="img" aria-label={`${card.name}，${rarity.name}${foil ? '，閃卡' : ''}，戰鬥力 ${cardCp(card)}，屬性${type.name}`}>
    <div className="hd"><span className="nm">{card.name}</span><span className="ty" title={type.name}>{type.glyph}</span><span className="cp"><small>CP</small><b>{cardCp(card)}</b></span></div>
    <div className="art"><svg viewBox="0 0 200 150" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: CARD_ART[card.no] ?? '' }} /><span className="no">{type.name}・{card.policyShort}</span></div>
    {foil && <span className="cd-foilmark">閃卡</span>}
    <div className="info">{card.status}</div>
    <div className="skill"><div className="en">{dots(cost)}</div><div><b>{card.skill}</b></div><span className="dm">{cardDamage(card)}</span></div>
    <div className="stats">{(['人氣', '底蘊', '規模'] as const).map((label, i) => <div className="st" key={label}><span>{label}</span><div className="bar"><span style={{ width: `${card.stats[i]}%` }} /></div><em>{card.stats[i]}</em></div>)}</div>
    <div className="wr"><div>弱點 <span className="ty">{weak.glyph}</span>×2</div><div>抗性 <span className="ty">{res.glyph}</span>−30</div><div>換場 <span className="dots">{dots(cost)}</span></div></div>
    <div className="ft"><span>{pad(card.no)}/{pad(CARDS.length)} <span className="rar">{rarity.symbol}</span></span><span>{SET_NAME}・原型</span><span>插畫：原創草稿</span></div>
  </div>;
}

export function CardBack({ card }: { card: ObjectCard }) {
  const setStats = (['人氣', '底蘊', '規模'] as const).filter((_, i) => card.statBasis[i] === 'set');
  return <div className="cd bk">
    <div className="coin" aria-hidden="true">福</div>
    <div className="fact"><h4>{card.name}</h4>{card.fact}</div>
    <div className="pol"><b>對應政策：</b>{card.policyTitle}<br /><b>來源：</b>使用者提供的「{card.doc}」文件<br /><b>數值：</b>{setStats.join('、')}為設定值{card.statBasis.includes('doc') ? '，規模依公開席位換算' : ''}</div>
    <div className="sm">遊戲數值，不是政策評價；提案不等於已實施。<br />非官方互動；未取得競選團隊授權或背書。</div>
  </div>;
}

/** Tap to flip between front (card) and back (source and notes). */
export function FlipCard({ card, foil = false, isNew = false }: { card: ObjectCard; foil?: boolean; isNew?: boolean }) {
  const [back, setBack] = useState(false);
  return <button type="button" className={`cd-flip cd-pop${back ? ' is-back' : ''}`} aria-pressed={back} aria-label={back ? '翻回卡面' : '翻到卡背，看來源與說明'} onClick={() => setBack(v => !v)}>
    {isNew && <span className="cd-new" aria-hidden="true">NEW!</span>}
    <span className="cd-in"><CardFront card={card} foil={foil} /><CardBack card={card} /></span>
  </button>;
}

/** Render a card element into a 1080x1350 share image (local only; nothing is uploaded) and share or download it. */
export async function shareCardImage(el: HTMLElement, opts: { headline: string; text: string; fileName: string }): Promise<'shared' | 'downloaded' | 'cancelled'> {
  await document.fonts.ready;
  const { toCanvas } = await import('html-to-image');
  // The clone is rendered in place; neutralise the off-screen positioning of the source element.
  const shot = await toCanvas(el, { pixelRatio: 3, cacheBust: false, skipAutoScale: true, style: { position: 'static', left: 'auto', top: 'auto' } });
  const W = 1080, H = 1350, canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas unavailable');
  c.fillStyle = '#FFE6A0'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#6EC6F0'; c.beginPath(); c.arc(0, 0, 620, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#F4797B'; c.beginPath(); c.arc(W, H, 540, 0, Math.PI * 2); c.fill();
  c.textAlign = 'center'; c.lineJoin = 'round';
  c.font = '900 92px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  c.lineWidth = 16; c.strokeStyle = '#06162B'; c.strokeText(opts.headline, W / 2, 150);
  c.fillStyle = '#FFFFFF'; c.fillText(opts.headline, W / 2, 150);
  const scale = Math.min(780 / shot.width, 1000 / shot.height), w = shot.width * scale, h = shot.height * scale;
  c.save(); c.translate(W / 2, 190 + h / 2); c.rotate(-0.035); c.drawImage(shot, -w / 2, -h / 2, w, h); c.restore();
  c.fillStyle = '#06162B'; c.font = '700 26px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  c.fillText('遊戲數值，不是政策評價；提案不等於已實施', W / 2, 1268);
  c.fillText('非官方互動；未取得競選團隊授權或背書', W / 2, 1306);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image unavailable')), 'image/png'));
  const file = new File([blob], `${opts.fileName.replace(/[^a-z0-9_-]/gi, '') || 'taichung-card'}.png`, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: opts.text }); return 'shared'; }
  } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = file.name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

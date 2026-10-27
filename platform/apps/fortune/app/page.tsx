'use client';

import { useEffect, useRef, useState } from 'react';
import { CARDS, RARITY_INFO, TYPE_INFO, WEAK_TO, FOIL_ODDS, COLLECTION_KEY, drawCard, addToCollection, emptyCollection, ownedCount, foilCount, isComplete, restoreCollection, serializeCollection, shareText, cardCp, type Collection, type Draw, type ObjectCard } from '@taichung/experience';
import { AppShell } from '@taichung/ui';
import { CardFront, FlipCard, shareCardImage } from '@taichung/ui/cards';
import { GameDefs } from '@taichung/ui/gamekit';

type Stage = 'machine' | 'spin' | 'capsule' | 'reveal' | 'book';
const TYPES = Object.keys(TYPE_INFO) as (keyof typeof TYPE_INFO)[];

export default function Page() {
  const [stage, setStage] = useState<Stage>('machine');
  const [col, setCol] = useState<Collection>(emptyCollection());
  const [draw, setDraw] = useState<Draw | null>(null);
  const [fresh, setFresh] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [reduced, setReduced] = useState(false);
  const help = useRef<HTMLDialogElement>(null);
  const shot = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try { setCol(restoreCollection(localStorage.getItem(COLLECTION_KEY)) ?? emptyCollection()); } catch { /* storage unavailable */ }
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [stage]);

  function spin() {
    setStage('spin');
    window.setTimeout(() => setStage('capsule'), reduced ? 50 : 1100);
  }
  function open() {
    const next = drawCard();
    const result = addToCollection(col, next);
    setDraw(next); setFresh(result.isNew || result.isNewFoil); setCol(result.collection); setNote('');
    try { localStorage.setItem(COLLECTION_KEY, serializeCollection(result.collection)); } catch { /* storage unavailable */ }
    if (navigator.vibrate) navigator.vibrate(next.card.rarity === 'SSR' || next.foil ? [20, 40, 20, 40, 60] : 15);
    setStage('reveal');
  }
  async function share() {
    if (!draw || !shot.current || busy) return;
    setBusy(true); setNote('');
    try {
      const rarity = RARITY_INFO[draw.card.rarity];
      const result = await shareCardImage(shot.current, { headline: `我抽到${rarity.name}卡！`, text: shareText(draw), fileName: `taichung-card-${draw.card.no}` });
      setNote(result === 'shared' ? '已開啟分享。圖片不含暱稱與位置。' : result === 'downloaded' ? '圖片已存到下載項目。' : '已取消分享。');
    } catch { setNote('這個瀏覽器無法產生圖片，請改用截圖。'); }
    finally { setBusy(false); }
  }
  function clearAll() {
    try { localStorage.removeItem(COLLECTION_KEY); } catch { /* ignore */ }
    setCol(emptyCollection()); setNote('已清除這台裝置上的福氣冊。');
  }
  function show(card: ObjectCard, foil: boolean) { setDraw({ card, foil }); setFresh(false); setNote(''); setStage('reveal'); }

  const owned = ownedCount(col), total = CARDS.length;
  const bar = <div className="fc-bar"><button type="button" className="fc-chip" onClick={() => setStage('book')} aria-label={`福氣冊，已收集 ${owned} / ${total}`}>福氣冊 {owned}/{total}{foilCount(col) ? ` ・閃 ${foilCount(col)}` : ''}</button><button type="button" className="fc-chip" onClick={() => help.current?.showModal()}>說明</button></div>;

  return <AppShell title="沾福氣" eyebrow="">
    <GameDefs />
    <section className="fc-wrap" aria-live="polite">
      {stage === 'machine' || stage === 'spin' ? <div className="fc-page">
        {bar}
        <h1 ref={heading} tabIndex={-1} className="sr-only">沾福氣：轉一下，抽一張在地物件卡</h1>
        <div className={`fc-machine${stage === 'spin' ? ' is-spinning' : ''}`} aria-hidden="true">
          <div className="dome">{[['#F4797B', 8, 70], ['#FFE6A0', 54, 84], ['#7FC0F0', 100, 66], ['#FFFFFF', 30, 30], ['#4C9BF2', 84, 28]].map(([c, x, y], i) => <i key={i} style={{ left: x as number, top: y as number, ['--c' as string]: c as string }} />)}</div>
          <div className="base" /><div className="knob">福</div>
        </div>
        <button type="button" className="gk-btn gk-btn--wide fc-primary" data-primary="true" onClick={spin} disabled={stage === 'spin'}>轉</button>
      </div> : null}

      {stage === 'capsule' ? <div className="fc-page">
        {bar}
        <h1 ref={heading} tabIndex={-1} className="sr-only">福氣膠囊掉出來了</h1>
        <div className="fc-capsule" aria-hidden="true" />
        <button type="button" className="gk-btn gk-btn--wide fc-primary" data-primary="true" onClick={open}>開</button>
      </div> : null}

      {stage === 'reveal' && draw ? <div className="fc-page">
        <div className="fc-bar"><span className="fc-chip">{RARITY_INFO[draw.card.rarity].symbol} {RARITY_INFO[draw.card.rarity].name}{draw.foil ? ' ・閃卡' : ''}</span><button type="button" className="fc-chip" onClick={() => setStage('book')}>福氣冊 {owned}/{total}</button></div>
        <h1 ref={heading} tabIndex={-1} className="sr-only">你抽到了{draw.card.name}</h1>
        <div className="fc-shot"><FlipCard card={draw.card} foil={draw.foil} isNew={fresh} /></div>
        <div ref={shot} className="fc-offscreen" aria-hidden="true"><CardFront card={draw.card} foil={draw.foil} /></div>
        <p className="fc-hint" role="status">{note || '點卡片翻面，看來源與說明'}</p>
        <button type="button" className="gk-btn gk-btn--wide fc-primary" data-primary="true" onClick={share} disabled={busy}>分享</button>
        <button type="button" className="fc-link" onClick={() => setStage('machine')}>再轉一次</button>
      </div> : null}

      {stage === 'book' ? <div className="fc-page">
        <div className="fc-bar"><span className="fc-chip">福氣冊 {owned}/{total}</span><button type="button" className="fc-chip" onClick={() => help.current?.showModal()}>說明</button></div>
        <h1 ref={heading} tabIndex={-1} className="sr-only">福氣冊</h1>
        {isComplete(col) ? <p className="fc-hint">集滿了！{foilCount(col)} 張有閃卡版本。</p> : <p className="fc-hint">再 {total - owned} 張集滿這一彈</p>}
        <div className="fc-book">{CARDS.map(card => {
          const e = col.cards[String(card.no)], has = !!e && e.n + e.foil > 0;
          return has
            ? <button key={card.no} type="button" className={`fc-slot t-${card.type} fin-${card.rarity}`} onClick={() => show(card, !!e && e.foil > 0 && e.n === 0)} aria-label={`${card.name}，${RARITY_INFO[card.rarity].name}，收藏 ${e!.n + e!.foil} 張${e!.foil ? '，含閃卡' : ''}`}><span className="fc-slot-ty">{TYPE_INFO[card.type].glyph}</span><b>{card.name}</b><small>{RARITY_INFO[card.rarity].symbol} CP {cardCp(card)}</small>{e!.foil ? <em>閃</em> : null}{e!.n + e!.foil > 1 ? <u>×{e!.n + e!.foil}</u> : null}</button>
            : <div key={card.no} className="fc-slot is-empty" role="img" aria-label={`第 ${card.no} 張，尚未收集`}>？<small>{String(card.no).padStart(3, '0')}</small></div>;
        })}</div>
        <button type="button" className="gk-btn gk-btn--wide fc-primary" data-primary="true" onClick={() => setStage('machine')}>再轉一次</button>
      </div> : null}
    </section>

    <dialog ref={help} className="fc-help" aria-labelledby="fc-help-title">
      <h2 id="fc-help-title">怎麼玩</h2>
      <p>轉一下、開膠囊，抽到一張政策文件裡提到的在地物件卡，收集 {total} 張。</p>
      <h3>稀有度（公開機率）</h3>
      <ul>{(['N', 'R', 'SR', 'SSR'] as const).map(r => <li key={r}>{RARITY_INFO[r].symbol} {RARITY_INFO[r].name}：{Math.round(RARITY_INFO[r].odds * 100)}%（{CARDS.filter(c => c.rarity === r).length} 張）</li>)}</ul>
      <p>任何一張都有 {Math.round(FOIL_ODDS * 100)}% 機會是「閃卡」版本，閃卡另外計算。稀有度只代表抽到的機會，和政策重要性、卡牌強弱無關。</p>
      <h3>戰鬥力 CP</h3>
      <p>CP＝人氣＋底蘊＋規模。招式傷害＝人氣；規模有公開席位時，1 點＝500 席，其他數值是設定值。屬性環狀相剋：{TYPES.map(t => TYPE_INFO[t].name).join('›')}›{TYPE_INFO[TYPES[0]!].name}（弱點 ×2、抗性 −30）。這只是遊戲規則，不代表地區或政策優劣。</p>
      <h3>隱私與聲明</h3>
      <p>福氣冊只存在這台裝置，不上傳、不排行；分享圖片不含暱稱與位置。卡片內容來自提供的政策文件，提案不等於已實施；本互動非官方，未取得競選團隊授權或背書。</p>
      <div className="fc-help-actions"><button type="button" className="fc-link" onClick={clearAll}>清除我的福氣冊</button><button type="button" className="gk-btn gk-btn--small" onClick={() => help.current?.close()}>知道了</button></div>
    </dialog>
  </AppShell>;
}

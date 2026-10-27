'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  CARDS, RARITY_INFO, TYPE_INFO, FOIL_ODDS, COLLECTION_KEY, drawCard, addToCollection, emptyCollection, ownedCount, foilCount, isComplete,
  restoreCollection, serializeCollection, shareText, cardCp, cardById, compareCards, encodeGift, decodeGift, giveSpare, spareCount, receiveGift,
  advanceTurn, turnProgress, type Collection, type Draw, type ObjectCard,
} from '@taichung/experience';
import { AppShell } from '@taichung/ui';
import { AchievementCard, CardFront, CompareSheet, FlipCard, shareCardImage } from '@taichung/ui/cards';
import { GameDefs } from '@taichung/ui/gamekit';

type Stage = 'machine' | 'spin' | 'capsule' | 'reveal' | 'book' | 'compare' | 'gift';
const TYPES = Object.keys(TYPE_INFO) as (keyof typeof TYPE_INFO)[];
const entryOf = (col: Collection, no: number) => col.cards[String(no)];
const has = (col: Collection, no: number) => { const e = entryOf(col, no); return !!e && e.n + e.foil > 0; };

export default function Page() {
  const [stage, setStage] = useState<Stage>('machine');
  const [col, setCol] = useState<Collection>(emptyCollection());
  const [draw, setDraw] = useState<Draw | null>(null);
  const [fresh, setFresh] = useState(false);
  const [gift, setGift] = useState<ObjectCard | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [turn, setTurn] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [reduced, setReduced] = useState(false);
  const help = useRef<HTMLDialogElement>(null);
  const shot = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sweep = useRef<{ acc: number; prev: number; id: number } | null>(null);
  const knob = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setCol(restoreCollection(localStorage.getItem(COLLECTION_KEY)) ?? emptyCollection()); } catch { /* storage unavailable */ }
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const card = decodeGift(window.location.hash);
    if (card) { setGift(card); setStage('gift'); }
  }, []);
  useEffect(() => { heading.current?.focus(); }, [stage]);

  function save(next: Collection) {
    setCol(next);
    try { localStorage.setItem(COLLECTION_KEY, serializeCollection(next)); } catch { /* storage unavailable */ }
  }
  function spin() {
    if (stage !== 'machine') return;
    setStage('spin'); setTurn(0);
    window.setTimeout(() => setStage('capsule'), reduced ? 50 : 1100);
  }
  function open() {
    const next = drawCard(), result = addToCollection(col, next);
    setDraw(next); setFresh(result.isNew || result.isNewFoil); save(result.collection); setNote('');
    if (navigator.vibrate) navigator.vibrate(next.card.rarity === 'SSR' || next.foil ? [20, 40, 20, 40, 60] : 15);
    setStage('reveal');
  }
  // knob: sweep a near-full circle with a finger or mouse; the button does the same for everyone else
  function angleOf(event: PointerEvent<HTMLDivElement>) {
    const box = knob.current!.getBoundingClientRect();
    return (Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180) / Math.PI;
  }
  function knobDown(event: PointerEvent<HTMLDivElement>) {
    if (stage !== 'machine') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    sweep.current = { acc: 0, prev: angleOf(event), id: event.pointerId };
  }
  function knobMove(event: PointerEvent<HTMLDivElement>) {
    const s = sweep.current; if (!s || s.id !== event.pointerId) return;
    const angle = angleOf(event); s.acc = advanceTurn(s.acc, s.prev, angle); s.prev = angle;
    setTurn(s.acc);
    if (turnProgress(s.acc) >= 1) { sweep.current = null; if (navigator.vibrate) navigator.vibrate(12); spin(); }
  }
  function knobUp() { sweep.current = null; if (stage === 'machine') setTurn(0); }

  async function shareImage(el: HTMLElement | null, headline: string, text: string, fileName: string) {
    if (!el || busy) return;
    setBusy(true); setNote('');
    try {
      const result = await shareCardImage(el, { headline, text, fileName });
      setNote(result === 'shared' ? '已開啟分享。圖片不含暱稱與位置。' : result === 'downloaded' ? '圖片已存到下載項目。' : '已取消分享。');
    } catch { setNote('這個瀏覽器無法產生圖片，請改用截圖。'); }
    finally { setBusy(false); }
  }
  const shareDraw = () => draw && shareImage(shot.current, `我抽到${RARITY_INFO[draw.card.rarity].name}卡！`, shareText(draw), `taichung-card-${draw.card.no}`);

  async function sendSpare() {
    if (!draw) return;
    const next = giveSpare(col, draw.card.no);
    if (!next) { setNote('這張只有一張，不能送出。'); return; }
    const url = `${window.location.origin}${window.location.pathname}#${encodeGift(draw.card.no)}`;
    const text = `送你一張【${draw.card.name}】，來台中味收下吧`;
    try {
      const canShare = typeof navigator.share === 'function';
      if (canShare) await navigator.share({ text, url });
      else await navigator.clipboard.writeText(url);
      save(next);
      setNote(canShare ? '已開啟分享，這張已從你的福氣冊送出。' : '連結已複製，這張已從你的福氣冊送出。');
    } catch (error) {
      setNote(error instanceof DOMException && error.name === 'AbortError' ? '已取消，這張沒有送出。' : '無法分享，這張沒有送出。');
    }
  }
  function acceptGift() {
    if (!gift) return;
    const r = receiveGift(col, gift); save(r.collection);
    window.history.replaceState(null, '', window.location.pathname);
    setDraw({ card: gift, foil: false }); setFresh(r.isNew); setGift(null); setNote('已收進福氣冊。'); setStage('reveal');
  }
  function skipGift() { window.history.replaceState(null, '', window.location.pathname); setGift(null); setStage('machine'); }
  function clearAll() {
    try { localStorage.removeItem(COLLECTION_KEY); } catch { /* ignore */ }
    setCol(emptyCollection()); setPicked([]); setNote('已清除這台裝置上的福氣冊。');
  }
  function showCard(card: ObjectCard) {
    const e = entryOf(col, card.no);
    setDraw({ card, foil: !!e && e.foil > 0 && e.n === 0 }); setFresh(false); setNote(''); setStage('reveal');
  }
  function togglePick(no: number) { setPicked(p => p.includes(no) ? p.filter(x => x !== no) : p.length >= 2 ? [p[1]!, no] : [...p, no]); }

  const owned = ownedCount(col), total = CARDS.length, complete = isComplete(col);
  const ownedMap = Object.fromEntries(CARDS.map(c => [c.no, entryOf(col, c.no) ?? { n: 0, foil: 0 }]));
  const bar = <div className="fc-bar"><button type="button" className="fc-chip" onClick={() => setStage('book')} aria-label={`福氣冊，已收集 ${owned} / ${total}`}>福氣冊 {owned}/{total}{foilCount(col) ? ` ・閃 ${foilCount(col)}` : ''}</button><button type="button" className="fc-chip" onClick={() => help.current?.showModal()}>說明</button></div>;
  const a = picked[0] ? cardById(picked[0]) : undefined, b = picked[1] ? cardById(picked[1]) : undefined;
  const cmp = a && b ? compareCards(a, b) : null;
  const holdFoil = (no: number) => { const e = entryOf(col, no); return !!e && e.foil > 0 && e.n === 0; };
  const spare = draw ? spareCount(col, draw.card.no) : 0;

  return <AppShell title="沾福氣" eyebrow="">
    <GameDefs />
    <section className="fc-wrap" aria-live="polite">
      {stage === 'machine' || stage === 'spin' ? <div className="fc-page">
        {bar}
        <h1 ref={heading} tabIndex={-1} className="sr-only">沾福氣：轉一下，抽一張在地物件卡</h1>
        <div className={`fc-machine${stage === 'spin' ? ' is-spinning' : ''}`}>
          <div className="dome" aria-hidden="true">{[['#F4797B', 8, 70], ['#FFE6A0', 54, 84], ['#7FC0F0', 100, 66], ['#FFFFFF', 30, 30], ['#4C9BF2', 84, 28]].map(([c, x, y], i) => <i key={i} style={{ left: x as number, top: y as number, ['--c' as string]: c as string }} />)}</div>
          <div className="base" aria-hidden="true" />
          <div className="fc-knob-ring" style={{ ['--turn' as string]: turnProgress(turn) }} aria-hidden="true" />
          <div ref={knob} className="knob" aria-hidden="true" style={{ transform: `translateX(-50%) rotate(${stage === 'machine' ? turn : 0}deg)` }} onPointerDown={knobDown} onPointerMove={knobMove} onPointerUp={knobUp} onPointerCancel={knobUp}>福</div>
        </div>
        <p className="fc-hint">{stage === 'machine' ? '轉動把手一圈，或按「轉」' : ''}</p>
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
        <h1 ref={heading} tabIndex={-1} className="sr-only">{draw.card.name}</h1>
        <div className="fc-shot"><FlipCard card={draw.card} foil={draw.foil} isNew={fresh} /></div>
        <div ref={shot} className="fc-offscreen" aria-hidden="true"><CardFront card={draw.card} foil={draw.foil} /></div>
        <p className="fc-hint" role="status">{note || '點卡片翻面，看來源與說明'}</p>
        <button type="button" className="gk-btn gk-btn--wide fc-primary" data-primary="true" onClick={shareDraw} disabled={busy}>分享</button>
        {spare > 0 ? <button type="button" className="fc-link" onClick={sendSpare}>送給朋友（你有 {spare} 張多的）</button> : null}
        <button type="button" className="fc-link" onClick={() => setStage('machine')}>再轉一次</button>
      </div> : null}

      {stage === 'gift' && gift ? <div className="fc-page">
        <div className="fc-bar"><span className="fc-gift-from">🤝 朋友送你一張</span><button type="button" className="fc-chip" onClick={() => help.current?.showModal()}>說明</button></div>
        <h1 ref={heading} tabIndex={-1} className="sr-only">朋友送你【{gift.name}】</h1>
        <div className="fc-shot"><FlipCard card={gift} /></div>
        <p className="fc-hint">收下後會放進你的福氣冊</p>
        <button type="button" className="gk-btn gk-btn--wide fc-primary" data-primary="true" onClick={acceptGift}>收下</button>
        <button type="button" className="fc-link" onClick={skipGift}>我也來轉</button>
      </div> : null}

      {stage === 'book' ? <div className="fc-page">
        <div className="fc-bar"><span className="fc-chip">福氣冊 {owned}/{total}</span><span className="fc-bar-r"><button type="button" className="fc-chip" onClick={() => { setPicked([]); setStage('compare'); }}>比較</button><button type="button" className="fc-chip" onClick={() => help.current?.showModal()}>說明</button></span></div>
        <h1 ref={heading} tabIndex={-1} className="sr-only">福氣冊</h1>
        {complete ? <p className="fc-hint">集滿了！{foilCount(col) ? `${foilCount(col)} 張有閃卡版本。` : '再抽閃卡版本當作下一個目標。'}</p> : <p className="fc-hint">再 {total - owned} 張集滿這一彈</p>}
        <div className="fc-book">{CARDS.map(card => {
          const e = entryOf(col, card.no);
          return has(col, card.no)
            ? <button key={card.no} type="button" className={`fc-slot t-${card.type} fin-${card.rarity}`} onClick={() => showCard(card)} aria-label={`${card.name}，${RARITY_INFO[card.rarity].name}，收藏 ${e!.n + e!.foil} 張${e!.foil ? '，含閃卡' : ''}`}><span className="fc-slot-ty">{TYPE_INFO[card.type].glyph}</span><b>{card.name}</b><small>{RARITY_INFO[card.rarity].symbol} CP {cardCp(card)}</small>{e!.foil ? <em>閃</em> : null}{e!.n + e!.foil > 1 ? <u>×{e!.n + e!.foil}</u> : null}</button>
            : <div key={card.no} className="fc-slot is-empty" role="img" aria-label={`第 ${card.no} 張，尚未收集`}>？<small>{String(card.no).padStart(3, '0')}</small></div>;
        })}</div>
        <div ref={shot} className="fc-offscreen fc-offscreen--ach" aria-hidden="true"><AchievementCard owned={ownedMap} foil={foilCount(col)} /></div>
        <p className="fc-hint" role="status">{note}</p>
        <button type="button" className="gk-btn gk-btn--wide fc-primary" data-primary="true" disabled={busy} onClick={complete ? () => shareImage(shot.current, '集滿文化旗艦！', `我在台中味集滿了 ${total} 張在地物件卡`, 'taichung-fortune-complete') : () => setStage('machine')}>{complete ? '分享成就卡' : '再轉一次'}</button>
        {complete ? <button type="button" className="fc-link" onClick={() => setStage('machine')}>再轉一次</button> : null}
      </div> : null}

      {stage === 'compare' ? <div className="fc-page">
        <div className="fc-bar"><button type="button" className="fc-chip" onClick={() => setStage('book')}>← 福氣冊</button><button type="button" className="fc-chip" onClick={() => help.current?.showModal()}>說明</button></div>
        <h1 ref={heading} tabIndex={-1} className="sr-only">比較兩張卡</h1>
        <p className="fc-hint">{owned < 2 ? '至少收集 2 張卡才能比較' : '點兩張卡來比較'}</p>
        <div className="fc-pick">{CARDS.filter(c => has(col, c.no)).map(card => <button key={card.no} type="button" className={`fc-slot t-${card.type} fin-${card.rarity}`} aria-pressed={picked.includes(card.no)} onClick={() => togglePick(card.no)}><span className="fc-slot-ty">{TYPE_INFO[card.type].glyph}</span><b>{card.name}</b><small>{RARITY_INFO[card.rarity].symbol} CP {cardCp(card)}</small></button>)}</div>
        {a && b && cmp ? <div className="fc-cmp-sum"><div>CP {cardCp(a)} 對 {cardCp(b)}：{cmp.stronger === 'tie' ? '平手' : `${(cmp.stronger === 'a' ? a : b).name} 較高`}</div><div>{a.name} 打 {b.name}：{cmp.aToB}　｜　{b.name} 打 {a.name}：{cmp.bToA}</div></div> : null}
        {a && b ? <div ref={shot} className="fc-offscreen fc-offscreen--cmp" aria-hidden="true"><CompareSheet a={a} b={b} aFoil={holdFoil(a.no)} bFoil={holdFoil(b.no)} /></div> : null}
        <p className="fc-hint" role="status">{note}</p>
        <button type="button" className="gk-btn gk-btn--wide fc-primary" data-primary="true" disabled={!(a && b) || busy} onClick={() => a && b && shareImage(shot.current, '卡牌比較', `${a.name} CP ${cardCp(a)} 對 ${b.name} CP ${cardCp(b)}`, 'taichung-compare')}>分享比較</button>
      </div> : null}
    </section>

    <dialog ref={help} className="fc-help" aria-labelledby="fc-help-title">
      <h2 id="fc-help-title">怎麼玩</h2>
      <p>轉動把手（或按「轉」）、開膠囊，抽到一張政策文件裡提到的在地物件卡，收集 {total} 張。</p>
      <h3>稀有度（公開機率）</h3>
      <ul>{(['N', 'R', 'SR', 'SSR'] as const).map(r => <li key={r}>{RARITY_INFO[r].symbol} {RARITY_INFO[r].name}：{Math.round(RARITY_INFO[r].odds * 100)}%（{CARDS.filter(c => c.rarity === r).length} 張）</li>)}</ul>
      <p>任何一張都有 {Math.round(FOIL_ODDS * 100)}% 機會是「閃卡」版本，閃卡另外計算。稀有度只代表抽到的機會，和政策重要性、卡牌強弱無關。</p>
      <h3>戰鬥力 CP</h3>
      <p>CP＝人氣＋底蘊＋規模。招式傷害＝人氣；規模有公開席位時，1 點＝500 席，其他數值是設定值。屬性環狀相剋：{TYPES.map(t => TYPE_INFO[t].name).join('›')}›{TYPE_INFO[TYPES[0]!].name}（弱點 ×2、抗性 −30）。</p>
      <h3>送給朋友</h3>
      <p>多出來的普通卡可以用連結送給朋友。沒有伺服器，所以這是「送禮」：同一條連結可能被多人打開，各自收到一張；連結只含卡號，無法變出更稀有的卡，閃卡也不能送。送出後這張會從你的福氣冊扣掉。請勿買賣或標價。</p>
      <h3>隱私與聲明</h3>
      <p>福氣冊只存在這台裝置，不上傳、不排行；分享圖片不含暱稱與位置。本互動非官方，未取得競選團隊授權或背書。</p>
      <div className="fc-help-actions"><button type="button" className="fc-link" onClick={clearAll}>清除我的福氣冊</button><button type="button" className="gk-btn gk-btn--small" onClick={() => help.current?.close()}>知道了</button></div>
    </dialog>
  </AppShell>;
}

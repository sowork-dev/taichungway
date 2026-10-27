'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { FORTUNE_STYLES, POLICY_MISSIONS, pickPolicyFortune } from '@taichung/experience';
import { Stars, GameDefs } from '@taichung/ui/gamekit';
import { AppShell, NicknameField, PolicyPlay, ResultActions, cssVars, holdFeedback } from '@taichung/ui';

type Fortune = ReturnType<typeof pickPolicyFortune>;

export default function Page() {
  const [result, setResult] = useState<Fortune | null>(null);
  const [nickname, setNickname] = useState('');
  const [policyRevealed, setPolicyRevealed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [feedback, setFeedback] = useState({ progress: 0, particles: 0 });
  const [reduced, setReduced] = useState(false);
  const activePointer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const started = useRef(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const holdButton = useRef<HTMLButtonElement>(null);

  function stop() {
    activePointer.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setHolding(false);
    setFeedback({ progress: 0, particles: 0 });
  }
  function reveal() {
    stop();
    setResult(current => current ?? pickPolicyFortune());
  }
  function begin(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || activePointer.current !== null || result) return;
    event.preventDefault();
    activePointer.current = event.pointerId;
    started.current = performance.now();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHolding(true);
    setFeedback(holdFeedback(0)); // First particle is in the first paint, not behind a timer.
    const tick = (now: number) => {
      if (activePointer.current === null) return;
      const next = holdFeedback(now - started.current);
      setFeedback(next);
      if (next.progress >= 1) reveal();
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }
  function release(event: PointerEvent<HTMLButtonElement>) {
    if (activePointer.current === event.pointerId) reveal();
  }
  function cancel(event: PointerEvent<HTMLButtonElement>) {
    if (activePointer.current === event.pointerId) stop();
  }

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduced(preference.matches);
    const onVisibility = () => { if (document.visibilityState === 'hidden') stop(); };
    updatePreference();
    preference.addEventListener('change', updatePreference);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', stop);
    return () => {
      preference.removeEventListener('change', updatePreference);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', stop);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      activePointer.current = null;
    };
  }, []);
  useEffect(() => { if (result) resultHeading.current?.focus(); }, [result]);
  function replay() {
    stop(); setResult(null); setNickname(''); setPolicyRevealed(false);
    requestAnimationFrame(() => holdButton.current?.focus());
  }

  return <AppShell title="沾福氣" eyebrow=""><GameDefs />
    {!result ? <>
      <section className="game-header" aria-labelledby="fortune-title"><h1 id="fortune-title" className="gk-title-stack" aria-label="長按，沾一點福氣。"><b className="gk-3d" data-text="長按，" style={cssVars({ '--s': '58px' })} aria-hidden="true"><span>長按，</span></b><b className="gk-3d gk-3d--coral" data-text="沾一點福氣" style={cssVars({ '--s': '58px', '--r': '-3deg' })} aria-hidden="true"><span>沾一點福氣</span></b></h1><p className="hero-description">按住金幣 1.5 秒，收下今天的祝福。</p></section>
      <section className={`fortune-stage${reduced ? ' reduced-motion' : ''}`} aria-label="領取今日福氣">
        <button ref={holdButton} id="hold-button" data-testid="hold-button" type="button" className={`hold-button${holding ? ' is-holding' : ''}`} style={cssVars({ '--hold': feedback.progress })} aria-label="長按一點五秒，沾一點福氣；也可按 Enter 或空白鍵" aria-describedby="hold-help" onPointerDown={begin} onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={cancel} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
          if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { event.preventDefault(); reveal(); }
        }} onClick={event => { if (event.detail === 0) reveal(); }}>
          <span className="coin-face" aria-hidden="true"><b>福</b></span>
          <span className="hold-caption"><svg viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M8 15V5a2 2 0 0 1 4 0v8-2a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v7c0 4-3 6-6 6h-3c-2 0-4-1-5-3l-4-7a2 2 0 0 1 3-2l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>{holding ? '福氣，慢慢聚起來了' : '手指放這裡，長按一下'}</span>
          <span className="fortune-particles" aria-hidden="true">{Array.from({ length: feedback.particles }, (_, i) => <span className="fortune-particle" data-testid="fortune-particle" key={i} style={cssVars({ '--x': `${8 + (i * 37) % 85}%`, '--y': `${12 + (i * 23) % 60}%`, '--size': `${4 + i % 5}px`, '--delay': `${-(i % 9) * .13}s` })} />)}</span>
        </button>
        <div className="hold-meter" aria-hidden="true" style={cssVars({ '--hold': feedback.progress })}><span /></div>
        <p id="hold-help" className="hold-help" role="status">{holding ? '停留 1.5 秒，或放開手指，就能收下祝福。' : reduced ? '已開啟減少動態，以靜態星點呈現福氣。' : '長按 1.5 秒，讓小小福氣慢慢聚集。'}</p>
        <div className="fortune-alternative"><button id="fortune-tap" data-testid="fortune-tap" type="button" className="text-button" onClick={reveal}>不方便長按？點一下也可以 <span aria-hidden="true">↗</span></button></div>
      </section>
      <div className="game-privacy"><span>無 AI</span><span>不必登入</span><span>不留資料</span></div>
      <aside className="fortune-footnote"><span aria-hidden="true">✳</span><div><h2>好玩是載體，政策才是內容。</h2><p>{POLICY_MISSIONS.length} 個政策心願、{FORTUNE_STYLES.length} 款藍白卡面。<br />隨機抽取，不依個人資料選擇政見。</p></div></aside>
    </> : <section className="result-panel" aria-labelledby="fortune-result-title">
      <div className="result-heading"><div className="result-burst" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={cssVars({ '--i': i })} />)}</div><div className="result-stars"><Stars value={3} label="福氣滿格" /></div><h1 ref={resultHeading} tabIndex={-1} id="fortune-result-title">今天的福氣，收好了。</h1><p>{policyRevealed ? '把心願和政策，一起留下來。' : '翻開心願，看看它連到哪一項政策。'}</p></div>
      <article id="result-card" data-testid="result-card" className="result-card fortune-result" data-pattern={result.style.pattern} data-variant={result.style.id} style={cssVars({ '--card-bg': result.style.bg, '--card-ink': result.style.ink, '--card-accent': result.style.accent })} aria-label="今日福氣卡">
        <p className="card-kicker">台中味 / 一張政策福氣籤</p>
        {nickname && <p className="card-dedication">給 {nickname}</p>}
        <PolicyPlay mission={result.mission} mode="flip" onComplete={() => setPolicyRevealed(true)} />
        <div className="card-sign"><span>{result.style.name}</span><span>日常有福</span></div>
      </article>
      {policyRevealed && <>
        <NicknameField value={nickname} onChange={setNickname} />
        <ResultActions key={result.text + result.style.id} title="今日政策福氣｜台中味" body={result.text} nickname={nickname} accent={result.style.accent} kind="fortune" variant={result.style.id} policyId={result.mission.policyId} />
      </>}
      <div className="result-replay"><button type="button" className="text-button" onClick={replay}>再沾一次 <span aria-hidden="true">↻</span></button></div>
    </section>}
  </AppShell>;
}

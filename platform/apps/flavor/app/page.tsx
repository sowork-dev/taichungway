'use client';

import { useEffect, useRef, useState } from 'react';
import { FLAVORS, MARKET_MISSION, QUESTIONS, scoreFlavor, type Flavor } from '@taichung/experience';
import { Stars, GameDefs } from '@taichung/ui/gamekit';
import { AppShell, FLAVOR_ART, LocalArt, NicknameField, PolicyPlay, ResultActions, cssVars, type ArtKind } from '@taichung/ui';

const scenes: readonly { kind: ArtKind; label: string }[] = [
  { kind: 'breakfast', label: '第一站 / 巷口早餐店' },
  { kind: 'market', label: '第二站 / 黃昏的市場' },
  { kind: 'tea', label: '第三站 / 週末慢慢走' },
];

export default function Page() {
  const [stage, setStage] = useState<'intro' | 'questions' | 'market' | 'result'>('intro');
  const [marketReady, setMarketReady] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Flavor | null>(null);
  const [nickname, setNickname] = useState('');
  const questionTitle = useRef<HTMLHeadingElement>(null);
  const resultTitle = useRef<HTMLHeadingElement>(null);
  const marketTitle = useRef<HTMLHeadingElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const questionIndex = Math.min(answers.length, 2);
  const question = QUESTIONS[questionIndex]!;
  const scene = scenes[questionIndex]!;

  useEffect(() => {
    if (stage === 'questions') questionTitle.current?.focus();
    if (stage === 'result') resultTitle.current?.focus();
    if (stage === 'market') marketTitle.current?.focus();
  }, [stage, answers.length]);

  function answer(index: number) {
    const nextAnswers = [...answers, index];
    setAnswers(nextAnswers);
    if (nextAnswers.length === 1) { setMarketReady(false); setStage('market'); }
    if (nextAnswers.length === 3) { setResult(scoreFlavor(nextAnswers)); setStage('result'); }
  }
  function replay() {
    setAnswers([]); setResult(null); setNickname(''); setMarketReady(false); setStage('intro');
    requestAnimationFrame(() => startButton.current?.focus());
  }

  return <AppShell title="你是哪一味" eyebrow=""><GameDefs />
    {stage === 'intro' && <>
      <section className="game-header" aria-labelledby="flavor-title"><h1 id="flavor-title" className="gk-title-stack" aria-label="你是哪一種台中味？"><b className="gk-3d" data-text="你是哪一種" style={cssVars({ '--s': '54px' })} aria-hidden="true"><span>你是哪一種</span></b><b className="gk-3d gk-3d--coral" data-text="台中味？" style={cssVars({ '--s': '62px', '--r': '-3deg' })} aria-hidden="true"><span>台中味？</span></b></h1><p className="hero-description">3 個選擇，找到你的日常滋味。</p></section>
      <div className="flavor-intro-art"><LocalArt kind="market" /><span className="intro-sticker" aria-hidden="true">八種味，各有喜歡。</span></div>
      <div className="intro-steps" aria-label="遊戲方式"><span>3 個小選擇</span><span>1 次市場實驗</span><span>8 種原創結果</span></div>
      <button ref={startButton} id="start-flavor" type="button" className="button primary wide" onClick={() => setStage('questions')}>開始測驗 <span aria-hidden="true">→</span></button>
      <div className="game-privacy"><span>無 AI</span><span>作答不送出</span><span>不留紀錄</span></div>
    </>}
    {stage === 'market' && <section className="market-interlude" aria-labelledby="market-interlude-title">
      <h1 ref={marketTitle} tabIndex={-1} id="market-interlude-title" className="market-interlude-title">先替市場開個冷氣。</h1>
      <PolicyPlay mission={MARKET_MISSION} mode="market" onComplete={() => setMarketReady(true)} />
      <button type="button" data-testid="market-continue" className="policy-button" disabled={!marketReady} onClick={() => { if (marketReady) setStage('questions'); }}>繼續找我的台中味 <span aria-hidden="true">→</span></button>
      <button type="button" className="text-button" onClick={() => { setAnswers([]); setMarketReady(false); setStage('questions'); }}>← 回第一題</button>
    </section>}
    {stage === 'questions' && <section className="question-panel q-flow" aria-labelledby="question-title">
      <div className="q-top"><button type="button" className="q-back" aria-label={answers.length ? '回上一題' : '回到介紹'} onClick={() => { if (answers.length) setAnswers(answers.slice(0, -1)); else setStage('intro'); }}>✕</button><div className="gk-progress q-bar" role="img" aria-label={`第 ${questionIndex + 1} 題，共 3 題`} style={cssVars({ '--p': (questionIndex + 1) / 3 })}><span /></div><span className="q-step">{questionIndex + 1}/3</span></div>
      <h1 ref={questionTitle} tabIndex={-1} id="question-title" data-testid="question-title" className="question-title">{question.title}</h1>
      <div className="answer-list q-cards" role="group" aria-labelledby="question-title">{question.options.map((option, index) => <button key={`${questionIndex}-${index}`} id={`answer-${index}`} data-testid={`answer-${index}`} type="button" className="answer-button q-card" onClick={event => { if (event.detail <= 1) answer(index); }}>
        <span className="q-emoji" aria-hidden="true">{option.emoji}</span><span className="answer-copy"><strong>{option.label}</strong><span>{option.subtitle}</span></span>
      </button>)}</div>
    </section>}
    {stage === 'result' && result && <section className="result-panel" aria-labelledby="flavor-result-title">
      <div className="result-heading"><div className="result-burst" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={cssVars({ '--i': i })} />)}</div><div className="result-stars"><Stars value={3} label="配對完成" /></div><h1 ref={resultTitle} tabIndex={-1} id="flavor-result-title">原來，你的日常是這一味。</h1><p>一座城市，裝得下好多種喜歡。</p></div>
      <article id="result-card" data-testid="result-card" className="result-card flavor-result" data-flavor={result.id} style={cssVars({ '--accent': result.accent })} aria-label={`你的台中味：${result.name}`}>
        <p className="card-kicker">台中味 / 我的日常風景</p><LocalArt kind={FLAVOR_ART[result.id]} />
        {nickname && <p className="card-dedication">{nickname} 的台中味</p>}<h2>{result.name}</h2><p className="result-description">{result.description}</p>
        <section className="policy-result-quote" aria-label="每位玩家共同體驗的市場政見">
          <p className="policy-kicker">剛才一起試過的城市提案 / {MARKET_MISSION.policyId}</p>
          <h3 className="policy-title">「{MARKET_MISSION.title}」</h3>
          <dl className="policy-notes"><div><dt>政策怎麼連到日常</dt><dd>{MARKET_MISSION.mechanism}</dd></div></dl>
          <a className="policy-source" href={MARKET_MISSION.sourceUrl} target="_blank" rel="noopener noreferrer">查看官網政見原文 ↗</a>
        </section>
        <div className="card-sign"><span>有你喜歡的，就是好滋味。</span><span>日常有味</span></div>
      </article>
      <NicknameField value={nickname} onChange={setNickname} />
      <ResultActions title={`${result.name}｜台中味`} body={result.description} nickname={nickname} accent={result.accent} kind="flavor" variant={result.id} policyId={MARKET_MISSION.policyId} />
      <div className="result-replay"><button type="button" className="text-button" onClick={replay}>再玩一次 <span aria-hidden="true">↻</span></button></div>
      <a className="reading-link" href="https://taichungway.tw/taste" target="_blank" rel="noopener noreferrer"><span>官網看更多台中味</span><span aria-hidden="true">↗</span></a>
      <details className="flavor-collection"><summary>看看其他 7 種日常滋味</summary><div className="flavor-list">{FLAVORS.filter(flavor => flavor.id !== result.id).map(flavor => <div className="flavor-list-item" key={flavor.id}><LocalArt kind={FLAVOR_ART[flavor.id]} /><div><h3>{flavor.name}</h3><p>{flavor.description}</p></div></div>)}</div></details>
    </section>}
  </AppShell>;
}

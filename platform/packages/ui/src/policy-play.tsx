'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PolicyMission } from '@taichung/experience';

export function PolicyPlay({ mission, mode, onComplete }: {
  mission: PolicyMission;
  mode: 'flip' | 'market';
  onComplete?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [cooling, setCooling] = useState(false);
  const completed = useRef(false);
  const policyHeading = useRef<HTMLHeadingElement>(null);
  const detailsId = useId();
  useEffect(() => { if (revealed) policyHeading.current?.focus(); }, [revealed]);
  function complete() {
    setRevealed(true);
    if (!completed.current) { completed.current = true; onComplete?.(); }
  }
  return <section className={`policy-play policy-${mode}${revealed ? ' policy-is-revealed' : ''}`} aria-label={mode === 'flip' ? '福氣背後的政策' : '市場冷氣概念實驗'}>
    {mode === 'flip' ? <div className="policy-front" hidden={revealed}>
      <div className="policy-receipt-head"><span>一張日常心願</span><span>台中 / 福氣籤</span></div>
      <p className="policy-wish">{mission.wish}</p>
      <p className="policy-action">{mission.action}</p>
      <button className="policy-button" type="button" data-testid="policy-reveal" aria-expanded={revealed} aria-controls={detailsId} onClick={complete}>翻開福氣背後的政策 <span aria-hidden="true">↗</span></button>
    </div> : <>
      <div className="market-heading"><p className="policy-kicker">日常情境 / 市場買菜</p><h2 className="market-title">逛市場，<br />也想有一點涼。</h2><p>{mission.context}</p></div>
      <div className={`market-plan${cooling ? ' market-is-cooling' : ''}`} role="img" aria-label={`市場平面概念圖：六個攤位與中央走道，冷氣${cooling ? '開啟，顯示氣流路徑' : '關閉'}`}>
        <div className="market-plan-heading"><span>市場平面 / 非實景照片</span><span aria-hidden="true">入口 ↓</span></div>
        <div className="market-layout">
          <div className="market-stalls">{['蔬果', '鮮魚', '米糧'].map((label, i) => <div className="market-stall" key={label}><span className="market-stall-number">0{i + 1}</span><span>{label}</span></div>)}</div>
          <div className="market-aisle"><span className="market-ac" aria-hidden="true">冷氣</span><span className="market-air" aria-hidden="true"><i /><i /><i /></span><span className="market-aisle-label">中央走道</span></div>
          <div className="market-stalls">{['熟食', '茶點', '雜貨'].map((label, i) => <div className="market-stall" key={label}><span className="market-stall-number">0{i + 4}</span><span>{label}</span></div>)}</div>
        </div>
        <p className="market-plan-status" aria-hidden="true">{cooling ? '冷氣開啟 / 氣流路徑示意' : '冷氣關閉 / 試著打開開關'}</p>
      </div>
      <button className="policy-button" type="button" data-testid="market-cool" aria-label={cooling ? '關閉冷氣，比較原情境' : '幫市場開冷氣'} aria-pressed={cooling} aria-controls={detailsId} onClick={() => { setCooling(value => !value); complete(); }}><span className="market-switch" aria-hidden="true"><span /></span>{cooling ? '關閉冷氣，比較原情境' : '幫市場開冷氣'}</button>
    </>}
    <div id={detailsId} className="policy-back" hidden={!revealed} aria-live="polite">
      <div className="policy-receipt-head"><span>心願背後 / 政見原文</span><span>{mission.policyId}</span></div>
      <h3 ref={policyHeading} tabIndex={-1} className="policy-title">「{mission.title}」</h3>
      <dl className="policy-notes"><div><dt>政策怎麼連到日常</dt><dd>{mission.mechanism}</dd></div><div><dt>示意的界線</dt><dd>{mission.limitation}</dd></div></dl>
      <a className="policy-source" href={mission.sourceUrl} target="_blank" rel="noopener noreferrer">查看官網政見原文 <span aria-hidden="true">↗</span></a>
    </div>
    <div className="policy-disclosure"><p>江啟臣政見・非施政成果</p><p>概念示意，不是實測結果</p></div>
  </section>;
}

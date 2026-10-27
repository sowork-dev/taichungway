'use client';

import { useEffect, useReducer, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { StudioShell, StudioActions } from '@taichung/ui/studio';
import { Stars } from '@taichung/ui/gamekit';
import { CheckArtwork, LOCAL_MATCH_LABEL } from './check-artwork';
import { CheckBooklet } from './check-booklet';
import { checkReducer, initialCheckState } from './check-model';

const EXAMPLES = [
  { label: '市場涼一點', wish: '希望市場有冷氣，買菜也能舒服一點。', icon: 'market' },
  { label: '人行道好走', wish: '希望人行道更平整，推娃娃車也安心。', icon: 'walk' },
  { label: '住得起', wish: '希望有更多社會住宅，讓生活安定下來。', icon: 'home' },
  { label: '共融公園', wish: '希望多一點共融公園，大小朋友都能一起玩。', icon: 'park' },
] as const;
const INK = { stroke: '#06162B', strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
function ChipIcon({ kind }: { kind: typeof EXAMPLES[number]['icon'] }) {
  const art: Record<typeof EXAMPLES[number]['icon'], ReactNode> = {
    market: <><path d="M5 22h54l-4-13H9z" fill="#1A63C8" {...INK} /><rect x="10" y="22" width="44" height="30" rx="3" fill="#FFFFFF" {...INK} /><path d="M22 34v-4m10 4v-8m10 8v-4" stroke="#4C9BF2" strokeWidth="4" strokeLinecap="round" /></>,
    walk: <><path d="M4 56h56" {...INK} /><circle cx="32" cy="12" r="7" fill="#FFFFFF" {...INK} /><path d="M32 20v18l-8 14m8-14l8 14M20 28l12-4 12 4" fill="none" {...INK} /></>,
    home: <><path d="M6 30L32 8l26 22z" fill="#1A63C8" {...INK} /><rect x="12" y="30" width="40" height="24" rx="2" fill="#FFFFFF" {...INK} /><rect x="27" y="38" width="10" height="16" fill="#7FC0F0" {...INK} /></>,
    park: <><circle cx="32" cy="24" r="17" fill="#4C9BF2" {...INK} /><path d="M32 41v14" {...INK} /><path d="M18 56h28" {...INK} /><circle cx="26" cy="20" r="3" fill="#FFFFFF" /></>,
  };
  return <svg className="check-chip-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">{art[kind]}</svg>;
}

/** Press-and-hold stamp. Pointer users hold ~0.7s; keyboard/assistive click (detail 0) submits at once. */
function StampButton({ formRef }: { formRef: { current: HTMLFormElement | null } }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  function stop() { window.clearTimeout(timer.current); setHolding(false); }
  function start(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    setHolding(true);
    timer.current = window.setTimeout(() => { setHolding(false); formRef.current?.requestSubmit(); }, 700);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return <div className="check-seal-pad">
    <button className={`check-generate${holding ? ' is-holding' : ''}`} type="submit" aria-describedby="check-hold-hint"
      onPointerDown={start} onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop} onContextMenu={event => event.preventDefault()}
      onClick={(event: MouseEvent<HTMLButtonElement>) => { if (event.detail !== 0) event.preventDefault(); }}>
      <svg className="check-ring" viewBox="0 0 120 120" aria-hidden="true"><circle className="check-ring-track" cx="60" cy="60" r="52" /><circle className="check-ring-fill" cx="60" cy="60" r="52" /></svg>
      <span className="check-seal-face" aria-hidden="true">印</span>
      <span className="check-generate-label">簽下我的四年</span>
    </button>
    <p id="check-hold-hint" className="check-hold-hint">按住蓋章　<small>（鍵盤：Enter／空白鍵）</small></p>
  </div>;
}

const CONFETTI = [8, 18, 28, 38, 48, 58, 68, 78, 88].map((x, i) => ({ x, d: 1.6 + (i % 4) * 0.25, r: (i * 47) % 360 }));

export default function CheckPage() {
  const [wish, setWish] = useState('');
  const [nickname, setNickname] = useState('');
  const [state, dispatch] = useReducer(checkReducer, initialCheckState);
  const artworkRef = useRef<HTMLDivElement>(null);
  const wishRef = useRef<HTMLTextAreaElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const resetFocus = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [popKey, setPopKey] = useState(0);
  const locked = state.stage !== 'write';

  useEffect(() => {
    if (state.error) (state.error.field === 'wish' ? wishRef.current : nicknameRef.current)?.focus();
    else if (state.result) resultHeading.current?.focus();
    else if (resetFocus.current) { wishRef.current?.focus(); resetFocus.current = false; }
  }, [state]);

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: 'generate', wish, nickname });
  }
  function reset() {
    setWish(''); setNickname(''); resetFocus.current = true;
    dispatch({ type: 'reset' });
  }

  return <StudioShell id="check" kicker="02 / 把日常，寫給未來" title="對開支票本" description="一張寫你的生活願望，一張對照公開政見。把兩張對開，留下你想關心的下一個四年。">
    <div className="check-progress" data-stage={state.stage}>
      <div className="gk-progress" role="presentation" style={{ ['--p' as string]: state.stage === 'write' ? 0.12 : state.stage === 'signed' ? 0.62 : 1 }}><span /></div>
      <Stars value={state.stage === 'write' ? 0 : state.stage === 'signed' ? 2 : 3} label={`${state.stage === 'write' ? 0 : state.stage === 'signed' ? 2 : 3} / 3 步完成`} />
      <ol className="check-steps" aria-label="製作步驟">
        <li aria-current={state.stage === 'write' ? 'step' : undefined}><span>01</span>寫願望</li>
        <li aria-current={state.stage === 'signed' ? 'step' : undefined}><span>02</span>蓋章</li>
        <li aria-current={state.stage === 'open' ? 'step' : undefined}><span>03</span>對開</li>
      </ol>
    </div>
    <div className="studio-workspace check-workspace">
      <section className={`studio-controls check-controls${locked ? ' is-locked' : ''}`} aria-labelledby="check-write-title">
        <h2 id="check-write-title">我希望，台中…</h2>
        <form ref={formRef} onSubmit={generate} noValidate>
          <div className="studio-field">
            <label className="studio-label" htmlFor="check-wish">寫一個小願望 <span>必填</span></label>
            <textarea key={popKey} ref={wishRef} id="check-wish" className={`studio-textarea${popKey ? ' gk-pop' : ''}`} required rows={3} value={wish} disabled={locked} onChange={event => setWish(event.target.value)} placeholder="例如：希望市場有冷氣，買菜也能舒服一點。" aria-describedby="check-wish-help check-privacy check-error" aria-invalid={state.error?.field === 'wish' || [...wish.trim()].length > 60} />
            <div className="check-field-meta"><span id="check-wish-help">1–60 字</span><span aria-live="polite">{[...wish.trim()].length} / 60</span></div>
          </div>
          <fieldset className="check-examples" disabled={locked}>
            <legend>點一個，或自己寫</legend>
            <div className="studio-choice-grid check-chip-grid">{EXAMPLES.map(example => <button key={example.label} type="button" className="studio-choice check-chip" data-check-example="true" aria-pressed={wish === example.wish} onClick={() => { setWish(example.wish); setPopKey(key => key + 1); }}><ChipIcon kind={example.icon} /><span>{example.label}</span></button>)}</div>
          </fieldset>
          <div className="studio-field">
            <label className="studio-label" htmlFor="check-nickname">署名 <span>選填</span></label>
            <input ref={nicknameRef} id="check-nickname" className="studio-input" type="text" autoComplete="off" value={nickname} disabled={locked} onChange={event => setNickname(event.target.value)} placeholder="暱稱，最多 10 字" aria-describedby="check-nickname-help check-error" aria-invalid={state.error?.field === 'nickname' || [...nickname.trim()].length > 10} />
          </div>
          <p id="check-error" className="check-error" role="alert">{state.error?.message}</p>
          {!locked && <StampButton formRef={formRef} />}
          {locked && <p className="check-locked-note">願望已蓋章。想改？按「再開一張」。</p>}
        </form>
        <p className="check-safe"><span aria-hidden="true">🔒</span> 私人文字不傳送、不儲存；僅匿名計次</p>
        <details className="check-info">
          <summary>說明</summary>
          <p className="studio-muted">不用寫得很宏大。你每天走的路、逛的市場、想安定下來的家，都可以。</p>
          <p className="studio-muted" id="check-nickname-help">暱稱最多 10 字。留白會署名「一位台中生活者」，不用真名。</p>
          <p id="check-privacy" className="studio-note check-privacy">私人文字不傳送、不儲存；僅匿名計次。請勿填入電話、Email、門牌地址或證件號碼；可辨識的資料會被攔下，仍請自行檢查。</p>
          <p className="check-method">{LOCAL_MATCH_LABEL}。本頁不使用 AI；輸入中的指令也只當作文字，不會執行。</p>
        </details>
      </section>
      <section className={`studio-preview check-preview check-stage is-${state.stage}`} aria-labelledby="check-preview-title">
        <div className="check-preview-heading"><h2 id="check-preview-title" ref={resultHeading} tabIndex={-1}>{state.stage === 'write' ? '你的支票本' : state.stage === 'signed' ? '蓋好章了！' : '對開成功！'}</h2><span className="check-preview-tag">{state.stage === 'write' ? '等你寫願望' : state.stage === 'signed' ? '再對開第二張' : '可存成圖卡'}</span></div>
        {state.stage === 'open' && <div className="check-win" aria-hidden="true"><span className="gk-ribbon gk-pop">兩張對開</span><Stars value={3} />{CONFETTI.map(piece => <i key={piece.x} style={{ ['--x' as string]: `${piece.x}%`, ['--d' as string]: `${piece.d}s`, ['--r' as string]: `${piece.r}deg` }} />)}</div>}
        {state.result ? <>
          <div className="check-artwork-wrap">
            <div ref={artworkRef} className="studio-artwork check-artwork"><CheckArtwork result={state.result} revealed={state.stage === 'open'} /></div>
            {state.stage === 'signed' && <div className="check-slam" aria-hidden="true">已簽</div>}
          </div>
          <div className="check-result-controls">
            {state.stage === 'signed' && <button type="button" className="gk-btn gk-btn--wide check-reveal" aria-expanded={false} onClick={() => dispatch({ type: 'reveal' })}>把兩張對開 <span aria-hidden="true">↔</span></button>}
            {state.stage === 'open' && <StudioActions targetRef={artworkRef} fileName="taichung-my-four-years" title="對開支票本｜我們的四年" />}
            <button type="button" className="studio-button secondary" onClick={reset}>再開一張 <span aria-hidden="true">↺</span></button>
          </div>
          <p className="check-status" role="status">{state.stage === 'signed' ? '按「把兩張對開」看政見。' : '已對開。分享連結不含願望與暱稱。'}</p>
          {state.stage === 'open' && <CheckBooklet result={state.result} />}
        </> : <div className="check-empty-preview" aria-label="支票本樣式預覽，尚未產生願望">
          <div className="check-empty-topline"><span>台中・對開支票本</span><span>YOUR FOUR YEARS</span></div>
          <p className="check-empty-title">想要的日常，<br />值得好好寫下。</p>
          <div className="check-empty-pair" aria-hidden="true"><div><span>01 / 我的生活願望</span><i /><i /><i /></div><div><span>02 / 公開政見對照</span><i /><i /><i /></div></div>
          <p className="check-empty-caption">先寫願望，再對開閱讀。</p>
        </div>}
        <details className="check-info check-info-preview">
          <summary>說明</summary>
          <p className="check-empty-caption">先寫願望，再對開閱讀。不替你改寫，也不替任何人承諾。</p>
          <p className="check-preview-note">「支票」只是願望與公共討論的概念，不是金錢。</p>
        </details>
      </section>
    </div>
  </StudioShell>;
}

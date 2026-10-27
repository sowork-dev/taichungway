'use client';

import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { StudioShell, StudioActions } from '@taichung/ui/studio';
import { CheckArtwork, LOCAL_MATCH_LABEL } from './check-artwork';
import { CheckBooklet } from './check-booklet';
import { checkReducer, initialCheckState } from './check-model';

const EXAMPLES = [
  { label: '市場買菜不再悶熱', wish: '希望市場有冷氣，買菜也能舒服一點。' },
  { label: '人行道安心好走', wish: '希望人行道更平整，推娃娃車也安心。' },
  { label: '住得起，安下心', wish: '希望有更多社會住宅，讓生活安定下來。' },
  { label: '一起玩的共融公園', wish: '希望多一點共融公園，大小朋友都能一起玩。' },
] as const;

export default function CheckPage() {
  const [wish, setWish] = useState('');
  const [nickname, setNickname] = useState('');
  const [state, dispatch] = useReducer(checkReducer, initialCheckState);
  const artworkRef = useRef<HTMLDivElement>(null);
  const wishRef = useRef<HTMLTextAreaElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const resetFocus = useRef(false);
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
    <ol className="check-steps" aria-label="製作步驟">
      <li aria-current={state.stage === 'write' ? 'step' : undefined}><span>01</span>寫下願望</li>
      <li aria-current={state.stage === 'signed' ? 'step' : undefined}><span>02</span>簽下這一張</li>
      <li aria-current={state.stage === 'open' ? 'step' : undefined}><span>03</span>對開看四年</li>
    </ol>
    <div className="studio-workspace check-workspace">
      <section className="studio-controls check-controls" aria-labelledby="check-write-title">
        <p className="check-eyebrow">MY NEXT FOUR YEARS</p>
        <h2 id="check-write-title">從一件小事開始。</h2>
        <p className="studio-muted">不用寫得很宏大。你每天走的路、逛的市場、想安定下來的家，都可以。</p>
        <form onSubmit={generate} noValidate>
          <div className="studio-field">
            <label className="studio-label" htmlFor="check-wish">我希望，未來的台中… <span>必填</span></label>
            <textarea ref={wishRef} id="check-wish" className="studio-textarea" required rows={4} value={wish} disabled={locked} onChange={event => setWish(event.target.value)} placeholder="例如：希望市場有冷氣，買菜也能舒服一點。" aria-describedby="check-wish-help check-privacy check-error" aria-invalid={state.error?.field === 'wish' || [...wish.trim()].length > 60} />
            <div className="check-field-meta"><span id="check-wish-help">寫一個主題，1–60 字</span><span aria-live="polite">{[...wish.trim()].length} / 60</span></div>
          </div>
          <fieldset className="check-examples" disabled={locked}>
            <legend>還沒靈感？選一句再改寫</legend>
            <div className="studio-choice-grid">{EXAMPLES.map(example => <button key={example.label} type="button" className="studio-choice" data-check-example="true" aria-pressed={wish === example.wish} onClick={() => { setWish(example.wish); wishRef.current?.focus(); }}>{example.label}<span aria-hidden="true"> ↗</span></button>)}</div>
          </fieldset>
          <div className="studio-field">
            <label className="studio-label" htmlFor="check-nickname">我的暱稱 <span>選填</span></label>
            <input ref={nicknameRef} id="check-nickname" className="studio-input" type="text" autoComplete="off" value={nickname} disabled={locked} onChange={event => setNickname(event.target.value)} placeholder="留一個只有你知道的名字" aria-describedby="check-nickname-help check-error" aria-invalid={state.error?.field === 'nickname' || [...nickname.trim()].length > 10} />
            <p className="studio-muted" id="check-nickname-help">最多 10 字。留白會署名「一位台中生活者」，不用真名。</p>
          </div>
          <p id="check-privacy" className="studio-note check-privacy">不傳送、不儲存、不追蹤。請勿填入電話、Email、門牌地址或證件號碼；可辨識的資料會被攔下，仍請自行檢查。</p>
          <p id="check-error" className="check-error" role="alert">{state.error?.message}</p>
          {!locked && <button className="studio-button check-generate" type="submit">簽下我的四年 <span aria-hidden="true">→</span></button>}
          {locked && <p className="check-locked-note">願望已寫好。想修改內容？請按「再開一張」重新開始。</p>}
        </form>
        <p className="check-method">{LOCAL_MATCH_LABEL}。本頁不使用 AI；輸入中的指令也只當作文字，不會執行。</p>
      </section>
      <section className="studio-preview check-preview" aria-labelledby="check-preview-title">
        <div className="check-preview-heading"><h2 id="check-preview-title" ref={resultHeading} tabIndex={-1}>{state.stage === 'write' ? '你的四年，從這裡開始' : state.stage === 'signed' ? '第一張，寫好了。' : '兩張對開，我們的四年。'}</h2><span className="check-preview-tag">{state.stage === 'write' ? '等待你的願望' : state.stage === 'signed' ? '再對開第二張' : '可保存的圖卡'}</span></div>
        {state.result ? <>
          <div ref={artworkRef} className="studio-artwork check-artwork"><CheckArtwork result={state.result} revealed={state.stage === 'open'} /></div>
          <div className="check-result-controls">
            {state.stage === 'signed' && <button type="button" className="studio-button check-reveal" aria-expanded={false} onClick={() => dispatch({ type: 'reveal' })}>把兩張對開 <span aria-hidden="true">↔</span></button>}
            {state.stage === 'open' && <StudioActions targetRef={artworkRef} fileName="taichung-my-four-years" title="對開支票本｜我們的四年" />}
            <button type="button" className="studio-button secondary" onClick={reset}>再開一張 <span aria-hidden="true">↺</span></button>
          </div>
          <p className="check-status" role="status">{state.stage === 'signed' ? '你的願望已產生；按「把兩張對開」查看本機對照，之後才能下載。' : '已對開。圖卡包含來源與說明；分享連結不包含願望或暱稱。'}</p>
          {state.stage === 'open' && <CheckBooklet result={state.result} />}
        </> : <div className="check-empty-preview" aria-label="支票本樣式預覽，尚未產生願望">
          <div className="check-empty-topline"><span>台中・對開支票本</span><span>YOUR FOUR YEARS</span></div>
          <p className="check-empty-title">想要的日常，<br />值得好好寫下。</p>
          <div className="check-empty-pair" aria-hidden="true"><div><span>01 / 我的生活願望</span><i /><i /><i /></div><div><span>02 / 公開政見對照</span><i /><i /><i /></div></div>
          <p className="check-empty-caption">先寫願望，再對開閱讀。<br />不替你改寫，也不替任何人承諾。</p>
        </div>}
        <p className="check-preview-note">「支票」是願望與公共討論的概念，不是金錢或成果保證。候選人政見非已兌現。</p>
      </section>
    </div>
  </StudioShell>;
}

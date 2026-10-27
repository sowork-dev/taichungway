'use client';

import { useReducer, useRef, useState, type FormEvent } from 'react';
import { StudioShell, StudioActions, readPolicy } from '@taichung/ui/studio';
import { ComicArtwork } from './comic-artwork';
import { COMIC_SCENES, COMIC_STYLES, createComic } from './story';
import { comicInputIssue, comicReducer, initialComicState, type ComicEditorState } from './editor';

export function ComicStudio({ initialState = initialComicState }: { initialState?: ComicEditorState }) {
  const [state, dispatch] = useReducer(comicReducer, initialState);
  const [notice, setNotice] = useState('選一個場景，留一句原文；不需要登入。');
  const ref = useRef<HTMLDivElement>(null);
  const eventRef = useRef<HTMLTextAreaElement>(null);
  const scene = COMIC_SCENES.find(row => row.id === state.sceneId)!;
  const policy = readPolicy(scene.policyId);
  const sample = createComic({ ...state, nickname: '', event: `今天到${scene.label}走走，想把普通的一刻留下來。` });
  const preview = state.story ?? sample;
  const privacyIssue = comicInputIssue(state);
  const dirty = !!state.story && (state.event !== state.story.event || state.nickname !== state.story.nickname);

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.event.trim()) { setNotice('先寫下一件小事，再開始畫四格。'); eventRef.current?.focus(); return; }
    if (privacyIssue) { setNotice(privacyIssue); eventRef.current?.focus(); return; }
    dispatch({ type: 'generate' });
    setNotice('四格已排好。可以逐格修改旁白，或下載包含原文與政見來源的圖卡。');
  }
  function replay() {
    dispatch({ type: 'replay' });
    setNotice('已清空原文、暱稱與四格編輯。換一件小事重新開始。');
    eventRef.current?.focus();
  }
  return <StudioShell id="comic" kicker="EVERYDAY COMIC / 日常創作室" title="巷口四格漫畫" description="把一件身邊小事，留成一頁藍色日常。選場景、寫一句，再替四格加上自己的旁白。">
    <div className="comic-guide"><span className="comic-mode">預製故事版・不使用 AI</span><p>圖像與四格情節由原創範本組成，不會讀懂或改編你的事件；你的文字會標示為原文，完整留在作品上。</p></div>
    <div className="studio-workspace comic-workspace">
      <section className="studio-controls" aria-label="漫畫創作設定">
        <form onSubmit={generate}>
          <fieldset className="comic-fieldset"><legend className="studio-label"><span className="comic-step">01</span> 選一個日常場景</legend>
            <div className="studio-choice-grid comic-scene-choices">{COMIC_SCENES.map((item, index) => <button key={item.id} type="button" className="studio-choice comic-scene-choice" aria-pressed={state.sceneId === item.id} data-testid={`comic-scene-${item.id}`} onClick={() => {
              dispatch({ type: 'scene', value: item.id });
              setNotice(state.story ? `已換成${item.label}故事；四格旁白已重設，原文保留。` : `已選${item.label}。所有人看到相同的場景與政見對照。`);
            }}><span className="comic-choice-number" aria-hidden="true">0{index + 1}</span><span>{item.label}<small>{item.hint}</small></span></button>)}</div>
          </fieldset>
          <div className="studio-field"><label className="studio-label" htmlFor="comic-event"><span className="comic-step">02</span> 今天發生什麼小事？</label>
            <textarea ref={eventRef} id="comic-event" className="studio-textarea comic-event-input" value={state.event} required aria-invalid={privacyIssue ? true : undefined} aria-describedby={privacyIssue ? 'comic-event-help comic-privacy-warning' : 'comic-event-help'} placeholder="例如：買菜時，發現購物袋還留在家裡。" rows={3} onChange={event => dispatch({ type: 'event', value: event.target.value })} />
            <p className="comic-input-help" id="comic-event-help"><span>最多 60 字 · 會以「你的原文」呈現</span><span>{Array.from(state.event).length}/60</span></p>
          </div>
          <fieldset className="comic-fieldset"><legend className="studio-label"><span className="comic-step">03</span> 挑一種藍色筆觸</legend>
            <div className="comic-style-choices">{COMIC_STYLES.map(item => <button key={item.id} type="button" className="studio-choice comic-style-choice" data-testid={`comic-style-${item.id}`} aria-pressed={state.styleId === item.id} onClick={() => {
              dispatch({ type: 'style', value: item.id });
              setNotice(state.story ? `已改用${item.label}；四格旁白回到原創範本。` : `已選${item.label}，可在右側預覽筆觸。`);
            }}><span className={`comic-style-swatch comic-swatch-${item.id}`} aria-hidden="true"><i /><i /><i /></span><span>{item.label}<small>{item.description}</small></span><span className="comic-style-check" aria-hidden="true">{state.styleId === item.id ? '✓' : ''}</span></button>)}</div>
          </fieldset>
          <div className="studio-field"><label className="studio-label" htmlFor="comic-nickname">作品上的暱稱 <span className="studio-muted">（選填）</span></label>
            <input id="comic-nickname" className="studio-input" autoComplete="off" value={state.nickname} placeholder="怎麼稱呼你？" aria-invalid={privacyIssue ? true : undefined} aria-describedby={privacyIssue ? 'comic-nickname-help comic-privacy-warning' : 'comic-nickname-help'} onChange={event => dispatch({ type: 'nickname', value: event.target.value })} />
            <p className="studio-muted" id="comic-nickname-help">最多 10 字，不會放進分享網址。</p>
          </div>
          {privacyIssue && <p id="comic-privacy-warning" role="alert" className="studio-note">{privacyIssue}</p>}
          <div className="comic-form-actions"><button className="studio-button" type="submit" data-testid="comic-create" disabled={!!privacyIssue}>{state.story ? '重新畫成四格' : '畫成我的四格'} <span aria-hidden="true">↗</span></button><button type="button" className="studio-button secondary" data-testid="comic-replay" onClick={replay}>清空重玩</button></div>
          <p className="studio-note">更換場景、筆觸或重新產生，都會清除逐格編輯。沒有 AI 請求，也不會儲存輸入。</p>
        </form>
        <aside className="comic-policy-context"><p className="studio-label">場景連到哪一項公開政見？</p><p>{policy.title}</p><p className="studio-muted">依公開場景固定對照，每個人都一樣；不是政治立場測驗，也不依原文或暱稱推測偏好。</p></aside>
      </section>
      <section className="studio-preview" aria-label="四格漫畫預覽與編輯">
        <div className="comic-preview-heading"><p className="studio-label">{state.story ? '你的四格，排好了。' : '先看看，四格長這樣。'}</p><span>{state.story ? '作品預覽' : '範例預覽'}</span></div>
        <div ref={ref} className="studio-artwork comic-artwork"><ComicArtwork story={preview} sample={!state.story} /></div>
        {state.story && <>
          <fieldset className="comic-fieldset comic-editors"><legend className="studio-label">替四格寫旁白 <span className="studio-muted">每格最多 20 字</span></legend>
            <p className="studio-muted">原創範本的旁白可以改寫；上方「你的原文」會原樣保留。</p>
            <div className="comic-editor-grid">{state.story.panels.map((panel, index) => <div className="studio-field" key={index}><label className="studio-label" htmlFor={`comic-caption-${index + 1}`}>{String(index + 1).padStart(2, '0')} · {panel.beat}</label><input id={`comic-caption-${index + 1}`} className="studio-input" data-testid={`comic-caption-${index + 1}`} value={panel.caption} aria-describedby={`comic-caption-help-${index + 1}`} onChange={event => dispatch({ type: 'caption', index, value: event.target.value })} /><span className="comic-caption-counter" id={`comic-caption-help-${index + 1}`}>{Array.from(panel.caption).length}/20 字</span></div>)}</div>
          </fieldset>
          {dirty && <p className="studio-note">原文或暱稱已修改，按「重新畫成四格」才會更新作品；目前下載仍是上方這一版。</p>}
          <StudioActions targetRef={ref} fileName="taichungway-comic" title="巷口四格漫畫・台中味" />
        </>}
        <p className="comic-status studio-muted" role="status" aria-live="polite">{notice}</p>
      </section>
    </div>
  </StudioShell>;
}

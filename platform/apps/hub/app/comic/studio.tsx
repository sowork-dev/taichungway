'use client';

import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { StudioShell, StudioActions, readPolicy } from '@taichung/ui/studio';
import { Stars } from '@taichung/ui/gamekit';
import { ComicArtwork } from './comic-artwork';
import { COMIC_SCENES, COMIC_STYLES, createComic } from './story';
import { comicInputIssue, comicReducer, initialComicState, type ComicEditorState } from './editor';
import { CAPTION_PRESETS, QUICK_EVENTS } from './quick';
import { SceneIcon } from './scene-icons';

const CONFETTI = Array.from({ length: 16 }, (_, i) => i);

export function ComicStudio({ initialState = initialComicState }: { initialState?: ComicEditorState }) {
  const [state, dispatch] = useReducer(comicReducer, initialState);
  const [notice, setNotice] = useState('點一個場景，開始畫。');
  const [scenePicked, setScenePicked] = useState(false);
  const [stylePicked, setStylePicked] = useState(false);
  const [activePanel, setActivePanel] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const eventRef = useRef<HTMLTextAreaElement>(null);
  const scene = COMIC_SCENES.find(row => row.id === state.sceneId)!;
  const policy = readPolicy(scene.policyId);
  const sample = createComic({ ...state, nickname: '', event: `今天到${scene.label}走走，想把普通的一刻留下來。` });
  const preview = state.story ?? sample;
  const privacyIssue = comicInputIssue(state);
  const dirty = !!state.story && (state.event !== state.story.event || state.nickname !== state.story.nickname);
  const done = [scenePicked || !!state.story, !!state.event.trim() || !!state.story, stylePicked || !!state.story];
  const steps = done.filter(Boolean).length;

  useEffect(() => {
    if (!celebrate) return undefined;
    const timer = window.setTimeout(() => setCelebrate(false), 2600);
    return () => window.clearTimeout(timer);
  }, [celebrate]);

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.event.trim()) { setNotice('先寫一件小事，或點一句靈感。'); eventRef.current?.focus(); return; }
    if (privacyIssue) { setNotice(privacyIssue); eventRef.current?.focus(); return; }
    dispatch({ type: 'generate' });
    setActivePanel(0);
    setCelebrate(true);
    setNotice('四格排好了！點上面的數字，換一句旁白。');
  }
  function replay() {
    dispatch({ type: 'replay' });
    setScenePicked(false); setStylePicked(false); setCelebrate(false); setActivePanel(0);
    setNotice('已清空，再畫一張吧。');
    eventRef.current?.focus();
  }
  return <StudioShell id="comic" kicker="EVERYDAY COMIC / 日常創作室" title="巷口四格漫畫" description="選場景、寫一句，四格開畫。">
    <div className="comic-guide"><span className="comic-mode">預製故事版・不使用 AI</span>
      <details className="comic-more"><summary>說明</summary>
        <p>圖像與四格情節由原創範本組成，不會讀懂或改編你的事件；你的文字會標示為原文，完整留在作品上。</p>
        <p className="comic-policy-line">場景連到公開政見：{policy.title}。依公開場景固定對照，每個人都一樣；不是政治立場測驗，也不依原文或暱稱推測偏好。</p>
        <p>更換場景、筆觸或重新產生，都會清除逐格編輯。沒有 AI 請求，也不會儲存輸入。</p>
      </details>
    </div>
    <div className="comic-hud" aria-label="創作進度">
      <div className="comic-hud-bar"><div className="gk-progress" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={steps} aria-label="創作進度"><span style={{ ['--p' as string]: steps / 3 }} /></div></div>
      <Stars value={state.story ? 3 : steps} max={3} label={`已完成 ${steps} / 3 步`} />
    </div>
    <div className="studio-workspace comic-workspace">
      <section className="studio-controls" aria-label="漫畫創作設定">
        <form onSubmit={generate}>
          <fieldset className="comic-fieldset"><legend className="studio-label"><span className="comic-step">1</span> 選場景</legend>
            <div className="studio-choice-grid comic-scene-choices">{COMIC_SCENES.map(item => <button key={item.id} type="button" className="studio-choice comic-scene-choice" aria-pressed={state.sceneId === item.id && (scenePicked || !!state.story)} data-testid={`comic-scene-${item.id}`} onClick={() => {
              dispatch({ type: 'scene', value: item.id });
              setScenePicked(true);
              setNotice(state.story ? `換成${item.label}，旁白已重設。` : `${item.label}，好選擇！接著寫一句。`);
            }}><SceneIcon id={item.id} /><span className="comic-scene-name">{item.label}</span><span className="sr-only">{item.hint}</span></button>)}</div>
          </fieldset>
          <div className="studio-field"><label className="studio-label" htmlFor="comic-event"><span className="comic-step">2</span> 今天的小事</label>
            <div className="comic-quick" role="group" aria-label="點一句靈感">{QUICK_EVENTS[scene.id].map(text => <button key={text} type="button" className="comic-quick-chip" onClick={() => { dispatch({ type: 'event', value: text }); setNotice('靈感放進去了，可以再改。'); }}>{text}</button>)}</div>
            <textarea ref={eventRef} id="comic-event" className="studio-textarea comic-event-input" value={state.event} required aria-invalid={privacyIssue ? true : undefined} aria-describedby={privacyIssue ? 'comic-event-help comic-privacy-warning' : 'comic-event-help'} placeholder="或自己寫：買菜時，發現購物袋忘了帶。" rows={2} onChange={event => dispatch({ type: 'event', value: event.target.value })} />
            <p className="comic-input-help" id="comic-event-help"><span className="sr-only">最多 60 字 · 會以「你的原文」呈現</span><span aria-hidden="true">你的原文</span><span>{Array.from(state.event).length}/60</span></p>
          </div>
          <fieldset className="comic-fieldset"><legend className="studio-label"><span className="comic-step">3</span> 挑筆觸</legend>
            <div className="comic-style-choices">{COMIC_STYLES.map(item => <button key={item.id} type="button" className="studio-choice comic-style-choice" data-testid={`comic-style-${item.id}`} aria-pressed={state.styleId === item.id && (stylePicked || !!state.story)} title={item.description} onClick={() => {
              dispatch({ type: 'style', value: item.id });
              setStylePicked(true);
              setNotice(state.story ? `改用${item.label}，旁白已重設。` : `${item.label}，右邊預覽看看。`);
            }}><span className={`comic-style-swatch comic-swatch-${item.id}`} aria-hidden="true"><i /><i /><i /></span><span className="comic-style-name">{item.label}</span><span className="sr-only">{item.description}</span></button>)}</div>
          </fieldset>
          <div className="studio-field comic-nick"><label className="studio-label" htmlFor="comic-nickname">暱稱 <span className="studio-muted">（選填）</span></label>
            <input id="comic-nickname" className="studio-input" autoComplete="off" value={state.nickname} placeholder="怎麼稱呼你？" aria-invalid={privacyIssue ? true : undefined} aria-describedby={privacyIssue ? 'comic-nickname-help comic-privacy-warning' : 'comic-nickname-help'} onChange={event => dispatch({ type: 'nickname', value: event.target.value })} />
            <p className="studio-muted comic-tiny" id="comic-nickname-help">最多 10 字，不會放進分享網址。</p>
          </div>
          {privacyIssue && <p id="comic-privacy-warning" role="alert" className="studio-note">{privacyIssue}</p>}
          <div className="comic-form-actions"><button className="studio-button comic-go" type="submit" data-testid="comic-create" disabled={!!privacyIssue}>{state.story ? '重新畫四格' : '開畫！'} <span aria-hidden="true">✎</span></button><button type="button" className="studio-button secondary" data-testid="comic-replay" onClick={replay}>重玩</button></div>
        </form>
      </section>
      <section className="studio-preview" aria-label="四格漫畫預覽與編輯">
        <div className="comic-preview-heading"><p className="studio-label">{state.story ? '你的四格，排好了。' : '先看看，四格長這樣。'}</p><span className="comic-preview-tag">{state.story ? '作品預覽' : '範例預覽'}</span></div>
        {celebrate && <div className="comic-celebrate" aria-hidden="true"><div className="comic-celebrate-card gk-pop"><span className="comic-celebrate-title">完成！</span><Stars value={3} max={3} label="三顆星" /></div>{CONFETTI.map(i => <i key={i} style={{ ['--i' as string]: i }} />)}</div>}
        <div ref={ref} className={`studio-artwork comic-artwork${celebrate ? ' comic-reveal' : ''}`}><ComicArtwork story={preview} sample={!state.story} /></div>
        {state.story && <>
          <fieldset className="comic-fieldset comic-editors"><legend className="studio-label">換旁白 <span className="studio-muted">點格子數字</span></legend>
            <div className="comic-panel-tabs" role="group" aria-label="選一格換旁白">{state.story.panels.map((panel, index) => <button key={index} type="button" className="gk-btn gk-btn--round comic-panel-tab" aria-pressed={activePanel === index} aria-label={`第 ${index + 1} 格 ${panel.beat}`} onClick={() => setActivePanel(index)}>{index + 1}</button>)}</div>
            <div className="comic-presets" role="group" aria-label={`第 ${activePanel + 1} 格旁白靈感`}>
              <p className="comic-preset-now">{state.story.panels[activePanel]!.caption || '（這格留白）'}</p>
              {CAPTION_PRESETS[activePanel]!.map(text => <button key={text} type="button" className="comic-quick-chip" aria-pressed={state.story!.panels[activePanel]!.caption === text} onClick={() => dispatch({ type: 'caption', index: activePanel, value: text })}>{text}</button>)}
            </div>
            <details className="comic-more comic-own"><summary>自己寫旁白</summary>
              <p className="studio-muted">每格最多 20 字；上方「你的原文」會原樣保留。</p>
              <div className="comic-editor-grid">{state.story.panels.map((panel, index) => <div className="studio-field" key={index}><label className="studio-label" htmlFor={`comic-caption-${index + 1}`}>{String(index + 1).padStart(2, '0')} · {panel.beat}</label><input id={`comic-caption-${index + 1}`} className="studio-input" data-testid={`comic-caption-${index + 1}`} value={panel.caption} aria-describedby={`comic-caption-help-${index + 1}`} onChange={event => dispatch({ type: 'caption', index, value: event.target.value })} /><span className="comic-caption-counter" id={`comic-caption-help-${index + 1}`}>{Array.from(panel.caption).length}/20 字</span></div>)}</div>
            </details>
          </fieldset>
          {dirty && <p className="studio-note">原文或暱稱已改，按「重新畫四格」才會更新；下載的仍是上方這一版。</p>}
          <StudioActions targetRef={ref} fileName="taichungway-comic" title="巷口四格漫畫・台中味" />
        </>}
        <p className="comic-status studio-muted" role="status" aria-live="polite">{notice}</p>
      </section>
    </div>
  </StudioShell>;
}

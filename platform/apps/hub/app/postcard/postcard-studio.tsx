'use client';

import { useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';
import { StudioShell, PolicySource, StudioActions, cleanText } from '@taichung/ui/studio';
import { Stars } from '@taichung/ui/gamekit';
import { DISTRICTS, GROUPS, SOUND_BEDS, SYNTHETIC_NOTICE, buildMixUrl, parseReceiverSearch, privateTextReason, type DistrictGroup, type MixEntry } from './postcard-data';
import { PostcardAudio } from './postcard-audio';

const GROUP_HINT: Record<DistrictGroup, string> = { 山: '山線', 海: '海線', 屯: '屯區', 城: '市區' };
const BED_GLYPH = { market: '市', sea: '潮', birds: '鳥', rain: '雨', train: '軌', bell: '鐘' } as const;
const RING = 2 * Math.PI * 44;

export default function PostcardStudio({ receiver = false }: { receiver?: boolean }) {
  const [mix, setMix] = useState<MixEntry[]>([]);
  const [note, setNote] = useState('');
  const [nickname, setNickname] = useState('');
  const [privateWarning, setPrivateWarning] = useState('');
  const updateText = (value: string, kind: 'note' | 'nickname') => {
    const reason = privateTextReason(value);
    const setter = kind === 'note' ? setNote : setNickname;
    if (reason) {
      setter('');
      setPrivateWarning(`偵測到可能的${reason}，已清空這個欄位。請勿填入本人或他人的聯絡方式、證號與住址。`);
      return;
    }
    setPrivateWarning('');
    setter(cleanText(value, kind === 'note' ? 30 : 10));
  };
  const [announcement, setAnnouncement] = useState('選擇行政區後，再按播放。最多選 3 區。');
  const [receiverState, setReceiverState] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [origin, setOrigin] = useState('');
  const [, refresh] = useState(0);
  const [group, setGroup] = useState<DistrictGroup>('城');
  const [touched, setTouched] = useState(false);
  const audio = useRef<PostcardAudio | null>(null);
  const artwork = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const player = new PostcardAudio(options => new Howl(options), () => refresh(value => value + 1));
    audio.current = player;
    setOrigin(window.location.origin);
    if (receiver) {
      const received = parseReceiverSearch(window.location.search);
      setReceiverState(received ? 'valid' : 'invalid');
      if (received) {
        // Restore the exact public mix, but do not load/play any audio here.
        setMix(received);
        setAnnouncement('已還原收到的聲景配方。不會自動播放，請按「播放／重試」。');
      } else {
        setAnnouncement('聆聽連結無效：僅接受 1–3 個不同行政區及 0–100 的整數音量。請向寄件人索取完整連結。');
      }
    }
    const hidden = () => {
      if (document.hidden) { player.stop(true); setAnnouncement('已因切換分頁停止。回到本頁後，請重新按播放。'); }
    };
    const pagehide = () => player.stop(true);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pagehide);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pagehide);
      player.dispose();
      audio.current = null;
    };
  }, [receiver]);

  const replaceMix = (next: MixEntry[]) => {
    setMix(next);
    audio.current?.select(next);
  };
  const toggleDistrict = (id: string) => {
    const existing = mix.some(entry => entry.id === id);
    if (!existing && mix.length >= 3) { setAnnouncement('最多選 3 區；請先移除一區，再加入新聲景。'); return; }
    const next = existing ? mix.filter(entry => entry.id !== id) : [...mix, { id, volume: 60 }];
    replaceMix(next);
    setAnnouncement(`${existing ? '已移除' : '已選擇'}${DISTRICTS.find(d => d.id === id)!.name}。目前 ${next.length} / 3 區。新增聲景請按播放才會加入。`);
  };
  const changeVolume = (id: string, volume: number) => { setTouched(true); replaceMix(mix.map(entry => entry.id === id ? { ...entry, volume } : entry)); };
  const play = () => {
    if (!mix.length || !audio.current || document.hidden) return;
    // This path is synchronous inside the user's click: Howler unlocks audio here.
    audio.current.select(mix);
    audio.current.play();
    setTouched(true);
    setAnnouncement('正在啟動聲景，請以各軌狀態為準；失敗可再按播放／重試。');
  };
  const stop = () => { audio.current?.stop(); setAnnouncement('已停止全部聲景；按播放可重新聆聽。'); };
  const shareUrl = mix.length && origin ? buildMixUrl(origin, mix) : undefined;
  const names = mix.map(entry => DISTRICTS.find(d => d.id === entry.id)!.name);
  const playing = mix.filter(entry => audio.current?.status(entry.id).state === 'playing').length;
  const stars = receiver ? 0 : (mix.length ? 1 : 0) + (mix.length && touched ? 1 : 0) + (mix.length && (note || nickname) ? 1 : 0);
  const stepLabels = ['選地名', '調音量', '寄出'];

  return <StudioShell id="postcard" kicker="03 / SOUND POSTCARD" title={receiver ? '收到一張聲音明信片' : '台中聲音明信片'} description="挑幾個地名、調一點音量，把日常想像疊成一段聲景。無 AI、無人聲，也不需要麥克風。">
    <div className="postcard-top">
      <span className="gk-chip postcard-notice-chip"><span className="gk-coin" aria-hidden="true">♪</span><strong>{SYNTHETIC_NOTICE}</strong></span>
      {!receiver && <div className="postcard-quest gk-panel gk-panel--dark">
        <div className="gk-progress" style={{ ['--p' as string]: stars / 3 }} role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={stars} aria-label="製作進度"><span /></div>
        <ol className="postcard-quest-steps">{stepLabels.map((label, i) => <li key={label} className={i < stars ? 'is-done' : ''}><Stars value={i < stars ? 1 : 0} max={1} label={`${label}${i < stars ? '已完成' : '未完成'}`} /><span>{label}</span></li>)}</ol>
      </div>}
      <details className="postcard-help postcard-help--dark"><summary>說明</summary><p>全部音檔皆為原創合成環境音，非田野錄音、非各區真實聲音。行政區與聲音的搭配是編輯選配，不代表在地聲景特徵。</p></details>
    </div>
    <div className="studio-workspace postcard-workspace">
      <section className="studio-controls" aria-label={receiver ? '收到的聲景配方' : '編輯聲音明信片'}>
        {!receiver ? <fieldset className="postcard-districts">
          <legend className="postcard-step"><span className="gk-badge">01</span> 選幾個地名</legend>
          <div className="postcard-tray" role="group" aria-label={`已選 ${mix.length} / 3 區`}>
            {[0, 1, 2].map(i => { const entry = mix[i]; const d = entry && DISTRICTS.find(x => x.id === entry.id)!;
              return entry && d ? <button type="button" key={entry.id} className="postcard-slot is-filled gk-pop" aria-label={`移除${d.name}聲景`} onClick={() => toggleDistrict(entry.id)}><b>{BED_GLYPH[d.bed]}</b><span>{d.name}</span><i aria-hidden="true">✕</i></button>
                : <span key={`empty-${i}`} className="postcard-slot" aria-hidden="true"><b>＋</b><span>空位</span></span>; })}
            <span className="postcard-tray-count" aria-hidden="true">{mix.length}/3</span>
          </div>
          <div className="postcard-tabs" role="tablist" aria-label="行政區分組">
            {GROUPS.map(g => { const count = mix.filter(entry => DISTRICTS.find(d => d.id === entry.id)!.group === g).length;
              return <button type="button" role="tab" key={g} id={`postcard-tab-${g}`} aria-selected={group === g} aria-controls={`postcard-panel-${g}`} data-postcard-tab={g} className={`postcard-tab${group === g ? ' is-active' : ''}`} onClick={() => setGroup(g)}><b>{g}</b><small>{GROUP_HINT[g]}</small>{count > 0 && <em>{count}</em>}</button>; })}
          </div>
          {GROUPS.map(g => <div className="postcard-district-group" key={g} role="tabpanel" id={`postcard-panel-${g}`} aria-labelledby={`postcard-tab-${g}`} hidden={group !== g}>
            <div className="postcard-district-grid">
              {DISTRICTS.filter(d => d.group === g).map(d => {
                const selected = mix.some(entry => entry.id === d.id);
                return <button type="button" className={`studio-choice postcard-pad${selected ? ' is-on' : ''}`} key={d.id} data-postcard-district={d.id} data-postcard-group={d.group} aria-pressed={selected} aria-disabled={!selected && mix.length >= 3} aria-describedby="postcard-selection-help" onClick={() => toggleDistrict(d.id)}><b aria-hidden="true">{BED_GLYPH[d.bed]}</b><span>{d.name}</span></button>;
              })}
            </div>
          </div>)}
          <details className="postcard-help"><summary>說明</summary><p className="studio-muted" id="postcard-selection-help">最多選 3 區，已選 {mix.length} / 3。山／海／屯／城為瀏覽分組，不是地理地圖。</p></details>
        </fieldset> : <div className="studio-card postcard-receiver-info">
          <h2>一份只含聲音的配方</h2>
          <p>{receiverState === 'checking' ? '正在檢查聆聽連結…' : receiverState === 'valid' ? '已保留寄件人選擇的行政區與音量。不會自動播放。' : '這份聆聽連結無效，沒有載入任何聲音。'}</p>
          <p className="studio-muted">不會自動播放。連結不含留言或暱稱；相同配方會得到相同合成聲景。</p>
          <a className="studio-button secondary" href="/postcard/">自己做一張</a>
        </div>}

        <section className="postcard-mixer" aria-labelledby="postcard-mixer-title">
          <h2 className="postcard-step" id="postcard-mixer-title"><span className="gk-badge">02</span> 調一點聲音</h2>
          {!mix.length && <div className="postcard-empty"><b aria-hidden="true">♪</b>{receiver ? '有效的聲景配方會顯示在這裡。' : '先選一區，讓第一個音符進來。'}</div>}
          {mix.map(entry => {
            const district = DISTRICTS.find(d => d.id === entry.id)!;
            const bed = SOUND_BEDS[district.bed];
            const status = audio.current?.status(entry.id) ?? { state: 'stopped', message: '尚未播放' };
            return <div className={`postcard-track gk-pop${status.state === 'error' ? ' has-error' : ''}${status.state === 'playing' ? ' is-playing' : ''}`} key={entry.id}>
              <div className="postcard-track-heading"><span className="postcard-track-glyph" aria-hidden="true">{BED_GLYPH[district.bed]}</span><h3>{district.name}<span>{bed.title}</span></h3><span className="postcard-eq" aria-hidden="true"><i /><i /><i /><i /><i /></span><button type="button" className="postcard-remove" aria-label={`移除${district.name}聲景`} onClick={() => toggleDistrict(entry.id)}>✕</button></div>
              <label className="postcard-meter" htmlFor={`gain-${entry.id}`} style={{ ['--v' as string]: entry.volume / 100 }}>
                <span className="postcard-meter-fill" aria-hidden="true" /><span className="postcard-meter-label">{district.name}音量 <output htmlFor={`gain-${entry.id}`}>{entry.volume}%</output></span>
                <input className="postcard-gain" id={`gain-${entry.id}`} type="range" min="0" max="100" step="1" value={entry.volume} aria-valuetext={`${entry.volume}%`} onChange={event => changeVolume(entry.id, Number(event.target.value))} />
              </label>
              <p className="postcard-track-status" role={status.state === 'error' ? 'alert' : undefined} data-audio-state={status.state}>{status.message}{entry.volume === 0 ? '・此軌音量為零' : ''}</p>
              <details className="postcard-help"><summary>說明</summary><p className="studio-muted">{bed.description} 編輯選配，非該區實錄。</p><span className="postcard-small-notice">{SYNTHETIC_NOTICE}</span></details>
            </div>;
          })}
          <div className="postcard-play-controls">
            <button className="postcard-play" type="button" disabled={!mix.length} onClick={play} aria-label="▶ 播放／重試">
              <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle className="postcard-ring-bg" cx="50" cy="50" r="44" /><circle className="postcard-ring" cx="50" cy="50" r="44" strokeDasharray={`${(mix.length ? playing / mix.length : 0) * RING} ${RING}`} /><path className="postcard-play-icon" d="M40 30l32 20-32 20z" /></svg>
              <span aria-hidden="true">播放／重試</span>
            </button>
            <button className="postcard-stop gk-btn gk-btn--round gk-btn--ice" type="button" disabled={!mix.length} onClick={stop} aria-label="■ 停止全部">■</button>
          </div>
          <p className="postcard-announcement gk-speech" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
          <details className="postcard-help"><summary>說明</summary><p className="studio-muted">聲音會重疊循環，音量變化以 200ms 淡入淡出。建議先降低裝置音量。</p><p className="studio-muted">已確認播放 {playing} / {mix.length} 軌。切換分頁會停止，回來不會自動恢復。</p></details>
        </section>

        {!receiver && <section className="postcard-writing" aria-labelledby="postcard-writing-title">
          <h2 className="postcard-step" id="postcard-writing-title"><span className="gk-badge">03</span> 留一點心情</h2>
          <div className="studio-field"><label className="studio-label" htmlFor="postcard-note">一句留言 <span>選填・30 字內</span></label><textarea className="studio-textarea" id="postcard-note" maxLength={30} rows={2} value={note} placeholder="今天，想把晚風寄給你。" onChange={event => updateText(event.target.value, 'note')} aria-describedby="postcard-private postcard-private-warning" /></div>
          <div className="studio-field"><label className="studio-label" htmlFor="postcard-nickname">你的暱稱 <span>選填・10 字內</span></label><input className="studio-input" id="postcard-nickname" type="text" maxLength={10} value={nickname} placeholder="一位聽風的人" onChange={event => updateText(event.target.value, 'nickname')} aria-describedby="postcard-private postcard-private-warning" autoComplete="off" /></div>
          <details className="postcard-help"><summary>說明</summary><p className="studio-muted" id="postcard-private">文字只留在本頁記憶與你下載的 PNG，不存檔、不上傳、不會放進聆聽連結。重新整理即清除。請勿輸入電子郵件、電話、證號或地址；本機檢查僅為提醒，不能保證辨識所有個資。</p></details>
          <p id="postcard-private-warning" className="postcard-private-warning" role="alert">{privateWarning}</p>
        </section>}
      </section>

      <section className="studio-preview postcard-preview" aria-label="聲音明信片預覽與匯出">
        <div className="postcard-preview-label"><span>YOUR SOUND, ON A CARD</span><span>明信片預覽</span></div>
        <div className="studio-artwork postcard-artwork" ref={artwork}>
          <div className="postcard-paper-top"><span>TAICHUNG<br />SOUND POSTCARD</span><div className={`postcard-stamp${mix.length ? ' is-slammed' : ''}`} key={mix.length ? 'stamped' : 'blank'} aria-label="聲景想像郵戳">聲景<br /><strong>想像</strong></div></div>
          <p className="postcard-art-kicker">把日常，寄給耳朵。</p>
          <h2>{names.length ? names.join(' × ') : '台中的日常'}</h2>
          <div className="postcard-wave" aria-label="抽象聲波插畫，非監測數據" role="img">
            <svg viewBox="0 0 560 190" aria-hidden="true" focusable="false">
              <path d="M0 95H560" stroke="currentColor" strokeWidth="1" opacity=".2" />
              {Array.from({ length: 56 }, (_, i) => {
                const height = 14 + Math.abs(Math.sin(i * .39) * Math.cos(i * .13)) * 140;
                return <rect key={i} x={i * 10 + 2} y={95 - height / 2} width="4" height={height} rx="2" fill="currentColor" opacity={.35 + (i % 4) * .15} />;
              })}
              <circle cx="450" cy="46" r="28" fill="none" stroke="currentColor" strokeWidth="1" opacity=".35" />
              <circle cx="450" cy="46" r="37" fill="none" stroke="currentColor" strokeWidth="1" opacity=".15" />
            </svg>
          </div>
          <div className="postcard-art-letter"><p>{note || '留一點空白，聽見此刻。'}</p><span>{nickname ? `來自 ${nickname}` : '來自，一位聽風的人'}</span></div>
          <div className="postcard-art-recipe">{mix.length ? mix.map(entry => <span key={entry.id}>{DISTRICTS.find(d => d.id === entry.id)!.name} {entry.volume}%</span>) : <span>選 1–3 區，寫下你的聲景配方</span>}</div>
          <p className="postcard-art-disclosure"><strong>{SYNTHETIC_NOTICE}</strong><br />編輯選配・原創合成音・無人聲・非監測數據</p>
          <div className="postcard-art-source">
            <p className="postcard-source-eyebrow">延伸閱讀 / 聲音之外的公共議題</p>
            <p>聲景聆聽與噪音治理是不同的事；此互動不是監測措施，也不是施政成果。</p>
            <PolicySource policyId="RES-08" />
          </div>
          <div className="postcard-art-link"><strong>圖卡不含音訊；請另分享聆聽連結</strong>{shareUrl ? <span>{shareUrl}</span> : <span>選好聲景後，這裡會附上只含配方的聆聽網址。</span>}</div>
          <p className="postcard-art-footer">獨立互動預覽・非官方・未獲授權或背書</p>
        </div>
        <StudioActions targetRef={artwork} fileName="taichung-sound-postcard" title="台中聲音明信片｜合成聲景示意・非在地實錄" shareUrl={shareUrl} />
        <details className="postcard-credits postcard-help"><summary>說明</summary><p className="studio-muted">PNG 是靜態圖卡，無法播放聲音。分享聆聽連結只包含行政區與音量，不含留言或暱稱。</p><p>6 段原創合成 WAV 循環，無 AI、無人聲，未使用任何在地實錄。選區是編輯配樂，不是聲音地圖。所有人看見相同目錄，不推論政治傾向。無麥克風權限；互動本身不需外部音訊服務。</p><p>播放引擎：Howler.js 2.2.4（MIT，Goldfire Studios）。靜態音檔從本站載入。隱藏分頁或離開頁面會停止並釋放音訊。</p></details>
      </section>
    </div>
  </StudioShell>;
}

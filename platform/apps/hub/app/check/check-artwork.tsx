import { PolicySource, readPolicy } from '@taichung/ui/studio';
import type { CheckResult } from './check-model';

export const LOCAL_MATCH_LABEL = '本機關鍵字對照，非AI語意判讀';
export const NO_LOCAL_MATCH = '本機尚未找到對應，這不代表官網沒有，請查閱完整政見';

/** Static, accessible export surface. Never passed to PageFlip. */
export function CheckArtwork({ result, revealed }: { result: CheckResult; revealed: boolean }) {
  const policy = result.policyId ? readPolicy(result.policyId) : null;
  return <>
    <header className="check-artwork-header">
      <span className="check-wordmark">台中・對開支票本</span>
      <span className="check-edition">日常願望 × 公開政見</span>
    </header>
    <div className={`check-twins${revealed ? ' is-open' : ''}`}>
      <article className="check-sheet check-personal" aria-label="第一張：我的生活願望">
        <div className="check-sheet-meta"><span>01 / 我的這一張</span><span>WISH</span></div>
        <h2>我想要的台中</h2>
        <p className="check-document-label">寫給下一個四年的生活願望</p>
        <blockquote className="check-wish">「{result.wish}」</blockquote>
        <div className="check-issuer"><span>願望署名</span><strong>{result.nickname || '一位台中生活者'}</strong></div>
        <p className="check-document-footnote">只代表填寫者自己的願望，不代替任何人承諾。</p>
      </article>
      <div className="check-perforation" aria-hidden="true"><span>對開，看見彼此</span></div>
      <article className={`check-sheet check-official${revealed ? '' : ' is-sealed'}`} aria-label={revealed ? '第二張：官方政見對照' : '尚未對開的第二張'}>
        <div className="check-sheet-meta"><span>02 / 政見這一張</span><span>POLICY</span></div>
        {revealed ? <>
          <h2>公開政見對照</h2>
          <p className="check-document-label">{policy ? `${policy.category} · ${policy.id}` : '保留你的願望，不猜測對應'}</p>
          {!policy && <p className="check-no-match">{NO_LOCAL_MATCH}</p>}
          {policy ? <PolicySource policyId={policy.id} /> : <a className="check-source-link" href="https://taichungway.tw/future" target="_blank" rel="noopener noreferrer">查閱官網完整 117 項政見 ↗</a>}
          <p className="check-document-footnote">對照只是閱讀起點，不是認同、背書或兌現證明。</p>
        </> : <div className="check-sealed-copy"><span className="check-sealed-mark" aria-hidden="true">＋</span><h2>第二張，等你對開</h2><p>先保留自己的願望，<br />再看看公開政見怎麼說。</p></div>}
      </article>
    </div>
    {revealed && <div className="check-stamp-row"><span>把願望與政見放在一起，留給未來持續關心。</span><strong className="check-stamp">我們的四年<span>願望 × 對照</span></strong></div>}
    <footer className="check-export-notes">
      <p>{LOCAL_MATCH_LABEL}。</p>
      <p>非官方互動作品；非有價證券，無金額、無兌付效力；署名僅為使用者暱稱。</p>
      <p>內容只在本頁記憶體處理，不傳送、不儲存、不追蹤；分享前請再次確認沒有個人資料。官網：taichungway.tw/future</p>
    </footer>
  </>;
}

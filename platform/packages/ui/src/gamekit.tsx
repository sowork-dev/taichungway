import type { ReactNode } from 'react';

/** Shared gradient for the filled stars; mount once per page. */
export function GameDefs() {
  return <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}><defs>
    <linearGradient id="gk-star-on" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset=".55" stopColor="#A9D4FA" /><stop offset="1" stopColor="#4C9BF2" /></linearGradient>
  </defs></svg>;
}
const STAR = 'M32 4l8.5 18.2 19.7 2.4-14.5 13.6 3.8 19.6L32 48.5 14.5 57.8l3.8-19.6L3.8 24.6l19.7-2.4z';
export function Stars({ value, max = 3, label }: { value: number; max?: number; label?: string }) {
  return <span className="gk-stars" role="img" aria-label={label ?? `${value} / ${max} 顆星`}>{Array.from({ length: max }, (_, i) =>
    <svg key={i} className={`gk-star${i < value ? '' : ' is-off'}`} viewBox="0 0 64 64" aria-hidden="true"><path d={STAR} /></svg>)}</span>;
}
export function Hearts({ value, max = 3 }: { value: number; max?: number }) {
  return <span className="gk-hearts" role="img" aria-label={`${value} / ${max} 顆愛心`}>{Array.from({ length: max }, (_, i) =>
    <svg key={i} className={`gk-heart${i < value ? '' : ' is-off'}`} viewBox="0 0 64 58" aria-hidden="true"><path d="M32 54C10 38 4 28 4 18 4 9 11 4 18 4c6 0 11 3 14 9 3-6 8-9 14-9 7 0 14 5 14 14 0 10-6 20-28 36z" /></svg>)}</span>;
}
export function Coin({ children }: { children: ReactNode }) {
  return <span className="gk-chip"><span className="gk-coin" aria-hidden="true">✦</span>{children}</span>;
}
export type GameIconName = 'chat' | 'city' | 'bubble' | 'comic' | 'check' | 'postcard' | 'fortune' | 'flavor';
const I = { stroke: '#06162B', strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
export function GameIcon({ name, className = 'gk-tile-icon' }: { name: GameIconName; className?: string }) {
  const body: Record<GameIconName, ReactNode> = {
    chat: <><path d="M10 14h44a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H32L18 58V48h-8a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#FFFFFF" {...I} /><circle cx="22" cy="31" r="4" fill="#1A63C8" /><circle cx="34" cy="31" r="4" fill="#4C9BF2" /><circle cx="46" cy="31" r="4" fill="#7FC0F0" /></>,
    city: <><rect x="6" y="26" width="18" height="32" rx="3" fill="#7FC0F0" {...I} /><rect x="22" y="12" width="20" height="46" rx="3" fill="#FFFFFF" {...I} /><rect x="40" y="30" width="18" height="28" rx="3" fill="#4C9BF2" {...I} /><path d="M28 22h8M28 32h8M28 42h8M12 36h6M12 46h6M46 40h6M46 50h6" stroke="#1A63C8" strokeWidth="3" strokeLinecap="round" /><path d="M32 12V4l9 3-9 3" fill="#1A63C8" {...I} /></>,
    bubble: <><path d="M32 4C32 4 12 26 12 40a20 20 0 0 0 40 0C52 26 32 4 32 4z" fill="#4C9BF2" {...I} /><path d="M22 40a10 10 0 0 0 7 9" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" /><circle cx="44" cy="14" r="5" fill="#7FC0F0" {...I} /></>,
    comic: <><rect x="6" y="6" width="23" height="23" rx="3" fill="#FFFFFF" {...I} /><rect x="35" y="6" width="23" height="23" rx="3" fill="#7FC0F0" {...I} /><rect x="6" y="35" width="23" height="23" rx="3" fill="#4C9BF2" {...I} /><rect x="35" y="35" width="23" height="23" rx="3" fill="#FFFFFF" {...I} /><circle cx="17" cy="17" r="5" fill="#1A63C8" /><path d="M40 22l7-9 7 9z" fill="#FFFFFF" /><path d="M12 48l8-7 7 7" stroke="#FFFFFF" strokeWidth="3.5" fill="none" /><path d="M41 47h12" stroke="#1A63C8" strokeWidth="4" strokeLinecap="round" /></>,
    check: <><rect x="4" y="12" width="56" height="40" rx="5" fill="#FFFFFF" {...I} /><path d="M12 24h24M12 33h18M12 42h12" stroke="#7FC0F0" strokeWidth="4" strokeLinecap="round" /><circle cx="46" cy="38" r="9" fill="#1A63C8" {...I} /><path d="M41 38l4 4 6-8" stroke="#FFFFFF" strokeWidth="3.5" fill="none" strokeLinecap="round" /></>,
    postcard: <><rect x="4" y="12" width="56" height="40" rx="5" fill="#FFFFFF" {...I} /><rect x="42" y="18" width="12" height="14" rx="2" fill="#7FC0F0" {...I} /><path d="M12 36v6m6-14v22m6-18v14m6-20v26m-0 0" stroke="#1A63C8" strokeWidth="4" strokeLinecap="round" /></>,
    fortune: <><circle cx="32" cy="32" r="26" fill="#7FC0F0" {...I} /><circle cx="32" cy="32" r="18" fill="#FFFFFF" {...I} /><text x="32" y="40" textAnchor="middle" fontSize="24" fontWeight="900" fill="#1A63C8" fontFamily="'Noto Sans TC','PingFang TC',sans-serif">福</text></>,
    flavor: <><path d="M6 24h52l-4-14H10z" fill="#1A63C8" {...I} /><path d="M18 24l-2-14M30 24l-1-14M42 24l1-14M54 24l-2-14" stroke="#FFFFFF" strokeWidth="3.5" /><rect x="10" y="24" width="44" height="32" rx="3" fill="#FFFFFF" {...I} /><rect x="16" y="32" width="14" height="24" fill="#4C9BF2" {...I} /><circle cx="42" cy="40" r="6" fill="#7FC0F0" {...I} /></>,
  };
  return <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">{body[name]}</svg>;
}

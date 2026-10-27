import type { ReactNode } from 'react';
import type { ComicSceneId } from './story';

const I = { stroke: '#06162B', strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const body: Record<ComicSceneId, ReactNode> = {
  market: <><path d="M6 26h52l-4-15H10z" fill="#1A63C8" {...I} /><path d="M19 26l-2-15M31 26l-1-15M43 26l1-15M55 26l-2-15" stroke="#FFFFFF" strokeWidth="3.5" /><rect x="10" y="26" width="44" height="30" rx="3" fill="#FFFFFF" {...I} /><rect x="16" y="34" width="14" height="22" fill="#4C9BF2" {...I} /><circle cx="42" cy="42" r="6" fill="#7FC0F0" {...I} /></>,
  corner: <><rect x="4" y="44" width="56" height="14" rx="3" fill="#4C9BF2" {...I} /><path d="M14 48v6M26 48v6M38 48v6M50 48v6" stroke="#FFFFFF" strokeWidth="4" /><rect x="40" y="6" width="14" height="30" rx="5" fill="#FFFFFF" {...I} /><circle cx="47" cy="14" r="3.5" fill="#1A63C8" /><circle cx="47" cy="22" r="3.5" fill="#7FC0F0" /><circle cx="47" cy="30" r="3.5" fill="#4C9BF2" /><path d="M47 36v8" {...I} /></>,
  park: <><circle cx="24" cy="22" r="14" fill="#7FC0F0" {...I} /><circle cx="36" cy="26" r="10" fill="#4C9BF2" {...I} /><path d="M24 36v14" {...I} /><rect x="30" y="44" width="28" height="6" rx="2" fill="#FFFFFF" {...I} /><path d="M33 50v7M55 50v7" {...I} /></>,
  station: <><rect x="6" y="14" width="52" height="32" rx="7" fill="#FFFFFF" {...I} /><rect x="12" y="20" width="14" height="12" rx="2" fill="#7FC0F0" {...I} /><rect x="30" y="20" width="14" height="12" rx="2" fill="#7FC0F0" {...I} /><path d="M6 38h52" stroke="#1A63C8" strokeWidth="5" /><circle cx="18" cy="48" r="6" fill="#4C9BF2" {...I} /><circle cx="46" cy="48" r="6" fill="#4C9BF2" {...I} /></>,
  mountain: <><circle cx="48" cy="16" r="8" fill="#FFFFFF" {...I} /><path d="M2 54L22 18l16 24 8-10 16 22z" fill="#4C9BF2" {...I} /><path d="M22 18l-6 10 6-3 5 5z" fill="#FFFFFF" {...I} /></>,
  coast: <><circle cx="46" cy="16" r="9" fill="#FFFFFF" {...I} /><path d="M2 34q10-8 20 0t20 0 20 0v22H2z" fill="#4C9BF2" {...I} /><path d="M6 46q8-6 16 0t16 0 16 0" stroke="#FFFFFF" strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M14 26l8-12 8 12z" fill="#7FC0F0" {...I} /></>,
};
export function SceneIcon({ id }: { id: ComicSceneId }) {
  return <svg className="comic-scene-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">{body[id]}</svg>;
}
